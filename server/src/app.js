const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { setupGitHubStrategy, setupSerialization, validateGitHubConfig } = require('./config/github');
const emailService = require('./services/emailService');

dotenv.config();

const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: String(process.env.TRUST_PROXY || 'true').toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET,
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/auth/github/callback',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5000,http://127.0.0.1:5000',
  sessionCookieSecure:
    (process.env.SESSION_COOKIE_SECURE || 'auto').toLowerCase() === 'auto'
      ? null
      : String(process.env.SESSION_COOKIE_SECURE || 'false').toLowerCase() === 'true',
  sessionCookieSameSite: process.env.SESSION_COOKIE_SAME_SITE || 'lax'
};

function validateConfig() {
  const required = [
    ['JWT_SECRET', config.jwtSecret],
    ['GITHUB_CLIENT_ID', process.env.GITHUB_CLIENT_ID],
    ['GITHUB_CLIENT_SECRET', process.env.GITHUB_CLIENT_SECRET],
    ['GITHUB_CALLBACK_URL', config.githubCallbackUrl]
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

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

    if (['localhost', '127.0.0.1'].includes(callbackUrl.hostname)) {
      throw new Error('In production, GITHUB_CALLBACK_URL cannot point to localhost or 127.0.0.1.');
    }
  }
}

async function startServer() {
  validateConfig();

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

  setupGitHubStrategy(passport);
  setupSerialization(passport);

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

  const removedMessage = 'Email/password and OTP endpoints were removed. Use GitHub sign-in only.';
  app.post(['/register', '/verify-otp', '/forgot-password', '/reset-password', '/login'], (req, res) => {
    return res.status(410).json({ message: removedMessage, authMode: 'github-only' });
  });

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
      storage: 'file',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Unexpected server error.' });
  });

  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
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
