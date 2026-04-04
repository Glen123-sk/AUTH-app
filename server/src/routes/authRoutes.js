const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const PendingSignup = require('../models/PendingSignup');
const OtpCode = require('../models/OtpCode');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const {
  normalizeEmail,
  isValidEmail,
  isStrongPassword,
  generateOtp,
  generateTokenId,
  hashSecret,
  compareSecret,
  otpExpiresAt,
  otpRateLimitState,
  otpOnCooldown,
  createAccessToken,
  createResetToken,
  verifyResetToken
} = require('../utils/auth');

const DEFAULT_SESSION_TTL_DAYS = 30;

function getRequestMetadata(req) {
  return {
    ipAddress: String(req.ip || req.headers['x-forwarded-for'] || '').split(',')[0].trim(),
    userAgent: String(req.get('user-agent') || '')
  };
}

function createAuditLogger() {
  return async function logAuditEvent(event, { email = '', user = null, details = {}, req = null } = {}) {
    try {
      const metadata = req ? getRequestMetadata(req) : { ipAddress: '', userAgent: '' };
      await AuditLog.create({
        event,
        email: normalizeEmail(email),
        user,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details
      });
    } catch (error) {
      console.error('Failed to write audit log:', error.message);
    }
  };
}

function createSessionHelpers(sessionTtlDays) {
  const ttlDays = Number(sessionTtlDays) > 0 ? Number(sessionTtlDays) : DEFAULT_SESSION_TTL_DAYS;
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

  async function issueSession({ userId, tokenId, req }) {
    const metadata = getRequestMetadata(req);
    const tokenIssuedAt = new Date();
    const expiresAt = new Date(Date.now() + ttlMs);

    const session = await Session.create({
      user: userId,
      tokenId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      tokenIssuedAt,
      lastSeenAt: tokenIssuedAt,
      expiresAt
    });

    return session;
  }

  async function touchSession(tokenId) {
    await Session.updateOne(
      { tokenId, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { lastSeenAt: new Date() } }
    );
  }

  async function revokeSession(tokenId, reason = 'manual_logout') {
    await Session.updateOne(
      { tokenId },
      { $set: { revokedAt: new Date(), revokedReason: reason } }
    );
  }

  return { issueSession, touchSession, revokeSession };
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    return '';
  }
  return header.slice(7).trim();
}

function createAuthMiddleware(jwtSecret, sessionHelpers) {
  return async function requireAuth(req, res, next) {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({ message: 'Authorization token is required.' });
      }

      const payload = verifyResetToken(token, jwtSecret);
      if (!payload?.tokenId || !payload?.userId) {
        return res.status(401).json({ message: 'Invalid access token.' });
      }

      const session = await Session.findOne({
        tokenId: payload.tokenId,
        user: payload.userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        return res.status(401).json({ message: 'Session expired or revoked.' });
      }

      req.auth = { payload, session };
      await sessionHelpers.touchSession(payload.tokenId);
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired access token.' });
    }
  };
}

function sanitizeProfileInput(body) {
  const stringFields = ['displayName', 'fullName', 'bio', 'avatarUrl', 'phoneNumber', 'company', 'website', 'location', 'timezone'];
  const profile = {};

  for (const field of stringFields) {
    if (typeof body[field] === 'string') {
      profile[field] = body[field].trim();
    }
  }

  if (typeof body.theme === 'string') {
    const theme = body.theme.trim().toLowerCase();
    if (['light', 'dark', 'system'].includes(theme)) {
      profile.theme = theme;
    }
  }

  if (typeof body.emailNotifications === 'boolean') {
    profile.emailNotifications = body.emailNotifications;
  }

  if (typeof body.marketingEmails === 'boolean') {
    profile.marketingEmails = body.marketingEmails;
  }

  return profile;
}

function createAuthRouter({ mailer, smtpFrom, jwtSecret, jwtExpiresIn, resetTokenExpiresIn, sessionExpiresInDays }) {
  const router = express.Router();
  const logAuditEvent = createAuditLogger();
  const sessionHelpers = createSessionHelpers(sessionExpiresInDays);
  const requireAuth = createAuthMiddleware(jwtSecret, sessionHelpers);

  const otpEndpointLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Try again later.' }
  });

  router.use(['/register', '/forgot-password'], otpEndpointLimiter);

  router.post('/register', async (req, res) => {
    try {
      const { username, email, password, confirmPassword, resend } = req.body;
      const normalizedEmail = normalizeEmail(email);

      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format.' });
      }

      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({ message: 'Email is already registered.' });
      }

      let pending = await PendingSignup.findOne({ email: normalizedEmail });

      if (resend) {
        if (!pending) {
          return res.status(404).json({ message: 'No pending signup found for this email.' });
        }
      } else {
        if (!username || String(username).trim().length < 3) {
          return res.status(400).json({ message: 'Username must be at least 3 characters.' });
        }
        if (!isStrongPassword(password)) {
          return res.status(400).json({ message: 'Password must be at least 8 chars and include upper, lower, number, and symbol.' });
        }
        if (password !== confirmPassword) {
          return res.status(400).json({ message: 'Passwords do not match.' });
        }
      }

      if (otpOnCooldown(pending)) {
        return res.status(429).json({ message: 'Please wait before requesting another OTP.' });
      }

      const rateState = otpRateLimitState(pending);
      if (rateState.blocked) {
        return res.status(429).json({ message: 'OTP request limit reached. Try again in 1 hour.' });
      }

      const otp = generateOtp();
      const otpHash = await hashSecret(otp);
      const expiresAt = otpExpiresAt();
      const now = new Date();

      if (!pending) {
        const passwordHash = await hashSecret(password);
        pending = await PendingSignup.create({
          username: String(username).trim(),
          email: normalizedEmail,
          passwordHash,
          otpHash,
          otpExpiresAt: expiresAt,
          otpSentAt: now,
          otpWindowStart: rateState.otpWindowStart,
          otpRequestCount: rateState.otpRequestCount
        });
      } else {
        pending.otpHash = otpHash;
        pending.otpExpiresAt = expiresAt;
        pending.otpSentAt = now;
        pending.otpWindowStart = rateState.otpWindowStart;
        pending.otpRequestCount = rateState.otpRequestCount;

        if (!resend) {
          pending.username = String(username).trim();
          pending.passwordHash = await hashSecret(password);
        }

        await pending.save();
      }

      const delivery = await mailer.sendOtpEmail(smtpFrom, normalizedEmail, otp, {
        purpose: 'signup',
        appName: 'Nexl'
      });
      console.log(
        `OTP email dispatch result (signup): to=${normalizedEmail}, accepted=${delivery.accepted.length}, rejected=${delivery.rejected.length}, messageId=${delivery.messageId}`
      );
      await logAuditEvent('register_otp_sent', {
        email: normalizedEmail,
        details: { resend: Boolean(resend) },
        req
      });

      return res.status(200).json({
        message: 'OTP sent to email.',
        email: normalizedEmail,
        purpose: 'signup'
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while processing signup.' });
    }
  });

  router.post('/verify-otp', async (req, res) => {
    try {
      const { email, otp, purpose } = req.body;
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !otp || !purpose) {
        return res.status(400).json({ message: 'Email, OTP, and purpose are required.' });
      }

      if (!/^\d{6}$/.test(String(otp))) {
        return res.status(400).json({ message: 'OTP must be a 6-digit number.' });
      }

      if (purpose === 'signup') {
        const pending = await PendingSignup.findOne({ email: normalizedEmail });
        if (!pending) {
          return res.status(404).json({ message: 'No pending signup found.' });
        }

        if (new Date(pending.otpExpiresAt).getTime() < Date.now()) {
          return res.status(400).json({ message: 'OTP expired. Please request a new OTP.', expired: true });
        }

        const isMatch = await compareSecret(String(otp), pending.otpHash);
        if (!isMatch) {
          return res.status(400).json({ message: 'Incorrect OTP.' });
        }

        const duplicate = await User.findOne({ email: normalizedEmail });
        if (duplicate) {
          await PendingSignup.deleteOne({ _id: pending._id });
          return res.status(409).json({ message: 'Email is already registered.' });
        }

        const createdUser = await User.create({
          username: pending.username,
          email: pending.email,
          passwordHash: pending.passwordHash
        });

        await PendingSignup.deleteOne({ _id: pending._id });

        await UserProfile.findOneAndUpdate(
          { user: createdUser._id },
          {
            $setOnInsert: {
              user: createdUser._id,
              displayName: createdUser.username,
              fullName: createdUser.username,
              theme: 'system'
            }
          },
          { upsert: true, new: true }
        );

        await logAuditEvent('register_success', {
          email: normalizedEmail,
          user: createdUser._id,
          req
        });

        return res.status(201).json({ message: 'Account created successfully.' });
      }

      if (purpose === 'reset_password') {
        const otpRecord = await OtpCode.findOne({
          email: normalizedEmail,
          purpose: 'reset_password',
          consumed: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
          return res.status(404).json({ message: 'No reset OTP found.' });
        }

        if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
          return res.status(400).json({ message: 'OTP expired. Please request a new OTP.', expired: true });
        }

        const isMatch = await compareSecret(String(otp), otpRecord.otpHash);
        if (!isMatch) {
          return res.status(400).json({ message: 'Incorrect OTP.' });
        }

        otpRecord.consumed = true;
        await otpRecord.save();

        const resetToken = createResetToken(normalizedEmail, jwtSecret, resetTokenExpiresIn);
        await logAuditEvent('reset_otp_verified', {
          email: normalizedEmail,
          req
        });
        return res.status(200).json({ message: 'OTP verified.', resetToken });
      }

      return res.status(400).json({ message: 'Invalid purpose.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while verifying OTP.' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        await logAuditEvent('login_failed', {
          email: normalizedEmail,
          details: { reason: 'unknown_email' },
          req
        });
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const validPassword = await compareSecret(password, user.passwordHash);
      if (!validPassword) {
        await logAuditEvent('login_failed', {
          email: normalizedEmail,
          user: user._id,
          details: { reason: 'invalid_password' },
          req
        });
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const tokenId = generateTokenId();

      const token = createAccessToken(
        { userId: String(user._id), email: user.email, tokenId },
        jwtSecret,
        jwtExpiresIn
      );

      await sessionHelpers.issueSession({ userId: user._id, tokenId, req });
      await logAuditEvent('login_success', {
        email: normalizedEmail,
        user: user._id,
        req
      });

      return res.status(200).json({
        message: 'Login successful.',
        token,
        user: {
          id: String(user._id),
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while logging in.' });
    }
  });

  router.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      const normalizedEmail = normalizeEmail(email);

      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format.' });
      }

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        await logAuditEvent('password_reset_email_not_found', {
          email: normalizedEmail,
          details: { reason: 'unknown_email' },
          req
        });
        return res.status(404).json({ message: 'Email is not registered.' });
      }

      let otpRecord = await OtpCode.findOne({ email: normalizedEmail, purpose: 'reset_password' }).sort({ createdAt: -1 });

      if (otpOnCooldown(otpRecord)) {
        return res.status(429).json({ message: 'Please wait before requesting another OTP.' });
      }

      const rateState = otpRateLimitState(otpRecord);
      if (rateState.blocked) {
        return res.status(429).json({ message: 'OTP request limit reached. Try again in 1 hour.' });
      }

      const otp = generateOtp();
      const otpHash = await hashSecret(otp);
      const now = new Date();
      const expiresAt = otpExpiresAt();

      if (!otpRecord) {
        otpRecord = await OtpCode.create({
          email: normalizedEmail,
          purpose: 'reset_password',
          otpHash,
          expiresAt,
          sentAt: now,
          consumed: false,
          otpWindowStart: rateState.otpWindowStart,
          otpRequestCount: rateState.otpRequestCount
        });
      } else {
        otpRecord.otpHash = otpHash;
        otpRecord.expiresAt = expiresAt;
        otpRecord.sentAt = now;
        otpRecord.consumed = false;
        otpRecord.otpWindowStart = rateState.otpWindowStart;
        otpRecord.otpRequestCount = rateState.otpRequestCount;
        await otpRecord.save();
      }

      const delivery = await mailer.sendOtpEmail(smtpFrom, normalizedEmail, otp, {
        purpose: 'reset_password',
        appName: 'Nexl'
      });
      console.log(
        `OTP email dispatch result (reset): to=${normalizedEmail}, accepted=${delivery.accepted.length}, rejected=${delivery.rejected.length}, messageId=${delivery.messageId}`
      );
      await logAuditEvent('password_reset_otp_sent', {
        email: normalizedEmail,
        user: user._id,
        req
      });

      return res.status(200).json({
        message: 'OTP sent to email.',
        email: normalizedEmail,
        purpose: 'reset_password'
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while processing forgot password.' });
    }
  });

  router.post('/reset-password', async (req, res) => {
    try {
      const { email, resetToken, password, confirmPassword } = req.body;
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !resetToken || !password || !confirmPassword) {
        return res.status(400).json({ message: 'Email, reset token, and passwords are required.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' });
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 chars and include upper, lower, number, and symbol.' });
      }

      let payload;
      try {
        payload = verifyResetToken(resetToken, jwtSecret);
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired reset token.' });
      }

      if (payload.purpose !== 'reset_password' || normalizeEmail(payload.email) !== normalizedEmail) {
        return res.status(401).json({ message: 'Invalid reset token payload.' });
      }

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      user.passwordHash = await hashSecret(password);
      await user.save();

      await Session.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'password_reset' } }
      );

      await OtpCode.deleteMany({ email: normalizedEmail, purpose: 'reset_password' });
      await logAuditEvent('password_reset_success', {
        email: normalizedEmail,
        user: user._id,
        req
      });

      return res.status(200).json({ message: 'Password reset successful.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while resetting password.' });
    }
  });

  router.get('/testmail/latest-otp', async (req, res) => {
    try {
      const namespace = process.env.TESTMAIL_NAMESPACE;
      const apiKey = process.env.TESTMAIL_API_KEY;
      const tag = String(req.query.tag || '').trim();

      if (!namespace || !apiKey) {
        return res.status(400).json({ message: 'TESTMAIL_NAMESPACE or TESTMAIL_API_KEY is not configured.' });
      }

      if (!tag) {
        return res.status(400).json({ message: 'Missing required query parameter: tag' });
      }

      const query = new URLSearchParams({
        apikey: apiKey,
        namespace,
        tag,
        limit: '1'
      });

      if (req.query.timestamp_from) {
        query.set('timestamp_from', String(req.query.timestamp_from));
      }

      const response = await fetch(`https://api.testmail.app/api/json?${query.toString()}`);
      if (!response.ok) {
        return res.status(502).json({ message: 'Testmail API request failed.' });
      }

      const payload = await response.json();
      if (payload.result !== 'success') {
        return res.status(502).json({ message: payload.message || 'Testmail API returned an error.' });
      }

      const latest = Array.isArray(payload.emails) && payload.emails.length > 0 ? payload.emails[0] : null;
      if (!latest) {
        return res.status(404).json({ message: 'No email found for this tag yet.' });
      }

      const text = String(latest.text || latest.html || '');
      const match = text.match(/\b(\d{6})\b/);
      if (!match) {
        return res.status(404).json({ message: 'No 6-digit OTP found in the latest email.' });
      }

      return res.status(200).json({
        otp: match[1],
        tag: latest.tag,
        to: latest.to,
        subject: latest.subject,
        timestamp: latest.timestamp
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while querying Testmail.' });
    }
  });

  router.get('/sessions', requireAuth, async (req, res) => {
    try {
      const sessions = await Session.find({
        user: req.auth.payload.userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      })
        .sort({ lastSeenAt: -1 })
        .select('ipAddress userAgent tokenIssuedAt lastSeenAt expiresAt createdAt');

      return res.status(200).json({
        sessions: sessions.map((session) => ({
          id: String(session._id),
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          tokenIssuedAt: session.tokenIssuedAt,
          lastSeenAt: session.lastSeenAt,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt
        }))
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while loading sessions.' });
    }
  });

  router.post('/logout', requireAuth, async (req, res) => {
    try {
      await sessionHelpers.revokeSession(req.auth.payload.tokenId, 'manual_logout');
      await logAuditEvent('logout', {
        email: req.auth.payload.email,
        user: req.auth.payload.userId,
        req
      });
      return res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while logging out.' });
    }
  });

  router.post('/logout-all', requireAuth, async (req, res) => {
    try {
      await Session.updateMany(
        { user: req.auth.payload.userId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'logout_all' } }
      );
      await logAuditEvent('logout_all', {
        email: req.auth.payload.email,
        user: req.auth.payload.userId,
        req
      });
      return res.status(200).json({ message: 'All sessions were logged out.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while logging out sessions.' });
    }
  });

  router.get('/profile', requireAuth, async (req, res) => {
    try {
      const user = await User.findById(req.auth.payload.userId).select('username email createdAt updatedAt');
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const profile = await UserProfile.findOneAndUpdate(
        { user: req.auth.payload.userId },
        {
          $setOnInsert: {
            user: req.auth.payload.userId,
            displayName: user.username,
            fullName: user.username,
            theme: 'system'
          }
        },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        user: {
          id: String(user._id),
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        profile: {
          id: String(profile._id),
          displayName: profile.displayName,
          fullName: profile.fullName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          phoneNumber: profile.phoneNumber,
          company: profile.company,
          website: profile.website,
          location: profile.location,
          timezone: profile.timezone,
          theme: profile.theme,
          emailNotifications: profile.emailNotifications,
          marketingEmails: profile.marketingEmails,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while loading profile.' });
    }
  });

  router.put('/profile', requireAuth, async (req, res) => {
    try {
      const updates = sanitizeProfileInput(req.body || {});
      const profile = await UserProfile.findOneAndUpdate(
        { user: req.auth.payload.userId },
        {
          $setOnInsert: {
            user: req.auth.payload.userId,
            displayName: '',
            fullName: '',
            theme: 'system'
          },
          $set: updates
        },
        { upsert: true, new: true }
      );

      await logAuditEvent('profile_updated', {
        email: req.auth.payload.email,
        user: req.auth.payload.userId,
        details: { fields: Object.keys(updates) },
        req
      });

      return res.status(200).json({
        message: 'Profile saved successfully.',
        profile: {
          id: String(profile._id),
          displayName: profile.displayName,
          fullName: profile.fullName,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          phoneNumber: profile.phoneNumber,
          company: profile.company,
          website: profile.website,
          location: profile.location,
          timezone: profile.timezone,
          theme: profile.theme,
          emailNotifications: profile.emailNotifications,
          marketingEmails: profile.marketingEmails,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt
        }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error while saving profile.' });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
