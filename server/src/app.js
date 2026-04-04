const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { createMailer, sendOtpEmail } = require('./config/mailer');
const { setupGitHubStrategy, setupSerialization, validateGitHubConfig } = require('./config/github');
const emailService = require('./services/emailService');
const { readStore, writeStore } = require('./config/emailAuthStore');
const {
  normalizeEmail,
  isValidEmail,
  isStrongPassword,
  generateOtp,
  hashSecret,
  compareSecret,
  otpExpiresAt,
  otpRateLimitState,
  otpOnCooldown,
  createAccessToken,
  createResetToken,
  verifyResetToken,
  generateTokenId
} = require('./utils/auth');

dotenv.config();

const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: String(process.env.TRUST_PROXY || 'true').toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '10m',
  appName: process.env.APP_NAME || 'Nexl',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpRequireTls: String(process.env.SMTP_REQUIRE_TLS || 'true').toLowerCase() === 'true',
  smtpRejectUnauthorized: String(process.env.SMTP_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true',
  smtpConnectionTimeoutMs: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
  smtpGreetingTimeoutMs: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
  smtpSocketTimeoutMs: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM || 'Auth App <no-reply@example.com>',
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://nexl.me/auth/github/callback',
  corsOrigin: process.env.CORS_ORIGIN || 'http://nexl.me',
  sessionCookieSecure:
    (process.env.SESSION_COOKIE_SECURE || 'auto').toLowerCase() === 'auto'
      ? null
      : String(process.env.SESSION_COOKIE_SECURE || 'false').toLowerCase() === 'true',
  sessionCookieSameSite: process.env.SESSION_COOKIE_SAME_SITE || 'lax'
};

function validateConfig() {
  const required = [
    ['JWT_SECRET', config.jwtSecret],
    ['SMTP_HOST', config.smtpHost],
    ['SMTP_USER', config.smtpUser],
    ['SMTP_PASS', config.smtpPass]
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && config.githubCallbackUrl) {
    let callbackUrl;
    try {
      callbackUrl = new URL(config.githubCallbackUrl);
    } catch {
      throw new Error('GITHUB_CALLBACK_URL is not a valid URL.');
    }

    if (config.nodeEnv === 'production') {
      if (callbackUrl.protocol !== 'https:') {
        throw new Error('In production, GITHUB_CALLBACK_URL must use https.');
      }

      if (callbackUrl.hostname === 'localhost' || callbackUrl.hostname === '127.0.0.1') {
        throw new Error('In production, GITHUB_CALLBACK_URL cannot point to a loopback host.');
      }
    }
  }
}

async function startServer() {
  validateConfig();
  const mailer = createMailer(config);
  const githubEnabled = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && config.githubCallbackUrl
  );

  const app = express();
  app.set('trust proxy', config.trustProxy ? 1 : 0);

  validateGitHubConfig();
  emailService.initialize();

  app.use(
    session({
      secret: config.jwtSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.sessionCookieSecure === null ? config.nodeEnv === 'production' : config.sessionCookieSecure,
        sameSite: config.sessionCookieSameSite,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    })
  );

  if (githubEnabled) {
    setupGitHubStrategy(passport);
    setupSerialization(passport);
  }

  app.use(passport.initialize());
  app.use(passport.session());

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin.split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      credentials: false
    })
  );
  app.use(express.json({ limit: '10kb' }));

  app.post('/register', async (req, res, next) => {
    try {
      const resend = Boolean(req.body?.resend);
      const email = normalizeEmail(req.body?.email);

      if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Enter a valid email.' });
      }

      const store = await readStore();
      const existingUser = store.users.find((u) => normalizeEmail(u.email) === email);

      if (resend) {
        const pending = store.pendingSignups.find((p) => normalizeEmail(p.email) === email);
        if (!pending) {
          return res.status(404).json({ message: 'No pending signup found for this email.' });
        }

        if (otpOnCooldown(pending)) {
          return res.status(429).json({ message: 'Please wait before requesting another OTP.' });
        }

        const limit = otpRateLimitState(pending);
        if (limit.blocked) {
          return res.status(429).json({ message: 'OTP request limit reached. Try again later.' });
        }

        const otp = generateOtp();
        pending.otpHash = await hashSecret(otp);
        pending.otpExpiresAt = otpExpiresAt().toISOString();
        pending.otpSentAt = new Date().toISOString();
        pending.otpRequestCount = limit.otpRequestCount;
        pending.otpWindowStart = limit.otpWindowStart.toISOString();

        await writeStore(store);
        await sendOtpEmail(mailer, config.smtpFrom, email, otp, { purpose: 'signup', appName: config.appName });

        return res.status(200).json({ message: 'OTP sent to your email.' });
      }

      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      const confirmPassword = String(req.body?.confirmPassword || '');

      if (username.length < 3) {
        return res.status(400).json({ message: 'Username must be at least 3 characters.' });
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must include upper, lower, number, symbol and be 8+ chars.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' });
      }

      if (existingUser) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }

      let pending = store.pendingSignups.find((p) => normalizeEmail(p.email) === email);
      const otp = generateOtp();
      const passwordHash = await hashSecret(password);
      const otpHash = await hashSecret(otp);
      const now = new Date().toISOString();

      if (!pending) {
        pending = {
          id: generateTokenId(),
          username,
          email,
          passwordHash,
          otpHash,
          otpExpiresAt: otpExpiresAt().toISOString(),
          otpSentAt: now,
          otpRequestCount: 1,
          otpWindowStart: now,
          createdAt: now,
          updatedAt: now
        };
        store.pendingSignups.push(pending);
      } else {
        const limit = otpRateLimitState(pending);
        if (limit.blocked) {
          return res.status(429).json({ message: 'OTP request limit reached. Try again later.' });
        }

        pending.username = username;
        pending.passwordHash = passwordHash;
        pending.otpHash = otpHash;
        pending.otpExpiresAt = otpExpiresAt().toISOString();
        pending.otpSentAt = now;
        pending.otpRequestCount = limit.otpRequestCount;
        pending.otpWindowStart = limit.otpWindowStart.toISOString();
        pending.updatedAt = now;
      }

      await writeStore(store);
      await sendOtpEmail(mailer, config.smtpFrom, email, otp, { purpose: 'signup', appName: config.appName });

      return res.status(200).json({ message: 'OTP sent to your email.' });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/verify-otp', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const otp = String(req.body?.otp || '').trim();
      const purpose = String(req.body?.purpose || 'signup');

      if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ message: 'Invalid email or OTP format.' });
      }

      const store = await readStore();

      if (purpose === 'signup') {
        const pendingIndex = store.pendingSignups.findIndex((p) => normalizeEmail(p.email) === email);
        if (pendingIndex < 0) {
          return res.status(404).json({ message: 'No pending signup found.' });
        }

        const pending = store.pendingSignups[pendingIndex];
        if (new Date(pending.otpExpiresAt).getTime() < Date.now()) {
          return res.status(400).json({ message: 'OTP expired. Please request a new code.' });
        }

        const valid = await compareSecret(otp, pending.otpHash);
        if (!valid) {
          return res.status(400).json({ message: 'Invalid OTP.' });
        }

        const now = new Date().toISOString();
        const user = {
          id: generateTokenId(),
          username: pending.username,
          email,
          passwordHash: pending.passwordHash,
          authMethod: 'email',
          verifiedAt: now,
          createdAt: now,
          updatedAt: now
        };

        store.users = store.users.filter((u) => normalizeEmail(u.email) !== email);
        store.users.push(user);
        store.pendingSignups.splice(pendingIndex, 1);

        await writeStore(store);
        return res.status(200).json({ message: 'Email verified successfully.' });
      }

      if (purpose === 'reset_password') {
        const reset = store.passwordResets.find((r) => normalizeEmail(r.email) === email);
        if (!reset) {
          return res.status(404).json({ message: 'No reset request found.' });
        }

        if (new Date(reset.otpExpiresAt).getTime() < Date.now()) {
          return res.status(400).json({ message: 'OTP expired. Please request a new code.' });
        }

        const valid = await compareSecret(otp, reset.otpHash);
        if (!valid) {
          return res.status(400).json({ message: 'Invalid OTP.' });
        }

        const resetToken = createResetToken(email, config.jwtSecret, config.resetTokenExpiresIn);
        return res.status(200).json({ message: 'OTP verified.', resetToken });
      }

      return res.status(400).json({ message: 'Unknown OTP purpose.' });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/login', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || '');

      const store = await readStore();
      const user = store.users.find((u) => normalizeEmail(u.email) === email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const valid = await compareSecret(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const token = createAccessToken({ sub: user.id, email: user.email, authMethod: 'email' }, config.jwtSecret, config.jwtExpiresIn);
      return res.status(200).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          authMethod: 'email'
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/forgot-password', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Enter a valid email.' });
      }

      const store = await readStore();
      const user = store.users.find((u) => normalizeEmail(u.email) === email);
      if (!user) {
        return res.status(200).json({ message: 'If this email exists, OTP has been sent.' });
      }

      const existingReset = store.passwordResets.find((r) => normalizeEmail(r.email) === email);
      if (existingReset && otpOnCooldown(existingReset)) {
        return res.status(429).json({ message: 'Please wait before requesting another OTP.' });
      }

      const limit = otpRateLimitState(existingReset || {});
      if (limit.blocked) {
        return res.status(429).json({ message: 'OTP request limit reached. Try again later.' });
      }

      const otp = generateOtp();
      const now = new Date().toISOString();
      const resetData = {
        id: existingReset?.id || generateTokenId(),
        email,
        otpHash: await hashSecret(otp),
        otpExpiresAt: otpExpiresAt().toISOString(),
        otpSentAt: now,
        otpRequestCount: limit.otpRequestCount,
        otpWindowStart: limit.otpWindowStart.toISOString(),
        createdAt: existingReset?.createdAt || now,
        updatedAt: now
      };

      store.passwordResets = store.passwordResets.filter((r) => normalizeEmail(r.email) !== email);
      store.passwordResets.push(resetData);

      await writeStore(store);
      await sendOtpEmail(mailer, config.smtpFrom, email, otp, { purpose: 'reset_password', appName: config.appName });

      return res.status(200).json({ message: 'If this email exists, OTP has been sent.' });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/reset-password', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const resetToken = String(req.body?.resetToken || '');
      const password = String(req.body?.password || '');
      const confirmPassword = String(req.body?.confirmPassword || '');

      if (!isStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must include upper, lower, number, symbol and be 8+ chars.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' });
      }

      let tokenPayload;
      try {
        tokenPayload = verifyResetToken(resetToken, config.jwtSecret);
      } catch {
        return res.status(401).json({ message: 'Invalid or expired reset session.' });
      }

      if (tokenPayload.purpose !== 'reset_password' || normalizeEmail(tokenPayload.email) !== email) {
        return res.status(401).json({ message: 'Invalid reset token.' });
      }

      const store = await readStore();
      const user = store.users.find((u) => normalizeEmail(u.email) === email);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      user.passwordHash = await hashSecret(password);
      user.updatedAt = new Date().toISOString();
      store.passwordResets = store.passwordResets.filter((r) => normalizeEmail(r.email) !== email);

      await writeStore(store);
      return res.status(200).json({ message: 'Password reset successful.' });
    } catch (error) {
      return next(error);
    }
  });

  if (githubEnabled) {
    app.get('/auth/github', passport.authenticate('github', { scope: ['user:email', 'user'] }));

    app.get(
      '/auth/github/callback',
      passport.authenticate('github', { failureRedirect: '/login.html?error=github_auth_failed' }),
      (req, res) => {
        res.redirect('/success.html?type=login&source=github');
      }
    );

    app.get('/auth/github/user', (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      return res.status(200).json({
        user: {
          id: String(req.user.id || ''),
          username: req.user.username,
          email: req.user.email,
          githubId: req.user.githubId,
          githubProfile: req.user.githubProfile,
          authMethod: req.user.authMethod
        }
      });
    });
  }

  app.get('/confirm-email', async (req, res) => {
    const token = req.query.token;
    if (!token) {
      return res.status(400).json({ message: 'Confirmation token is required' });
    }

    const email = emailService.verifyConfirmationToken(token);
    if (!email) {
      return res.status(400).json({ message: 'Invalid or expired confirmation token' });
    }

    try {
      // Send welcome email after confirmation
      const userName = req.query.name || 'User';
      await emailService.sendWelcomeEmail(email, userName);
      return res.status(200).json({ message: 'Email confirmed successfully. Welcome email sent.' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to process confirmation' });
    }
  });

  app.use(express.static(path.join(__dirname, '..', '..', 'client')));

  app.get('/health', (req, res) => {
    res.status(200).json({
      ok: true,
      storage: String(process.env.GITHUB_DB_MODE || 'file').toLowerCase() === 'api' ? 'github-api' : 'file',
      authMode: githubEnabled ? 'email+github' : 'email-only',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Unexpected server error.' });
  });

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  const gracefulShutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('Shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
