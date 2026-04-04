const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { connectDatabase, disconnectDatabase, getDatabaseStatus } = require('./config/db');
const { createMailer, sendOtpEmail } = require('./config/mailer');
const { createAuthRouter } = require('./routes/authRoutes');
const { setupGitHubStrategy, setupSerialization, validateGitHubConfig } = require('./config/github');

dotenv.config();

const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: String(process.env.TRUST_PROXY || 'true').toLowerCase() === 'true',
  useGithubAuthOnly: String(process.env.USE_GITHUB_AUTH_ONLY || 'false').toLowerCase() === 'true',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '10m',
  sessionExpiresInDays: Number(process.env.SESSION_EXPIRES_IN_DAYS || 30),
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
  corsOrigin: process.env.CORS_ORIGIN || 'https://nexl.me,https://www.nexl.me,http://localhost:5000,http://127.0.0.1:5000',
  sessionCookieSecure:
    (process.env.SESSION_COOKIE_SECURE || 'auto').toLowerCase() === 'auto'
      ? null
      : String(process.env.SESSION_COOKIE_SECURE || 'false').toLowerCase() === 'true',
  sessionCookieSameSite: process.env.SESSION_COOKIE_SAME_SITE || 'lax'
};

function validateConfig() {
  const required = config.useGithubAuthOnly
    ? [
        ['JWT_SECRET', config.jwtSecret],
        ['GITHUB_CLIENT_ID', process.env.GITHUB_CLIENT_ID],
        ['GITHUB_CLIENT_SECRET', process.env.GITHUB_CLIENT_SECRET]
      ]
    : [
        ['MONGO_URI', config.mongoUri],
        ['JWT_SECRET', config.jwtSecret],
        ['SMTP_HOST', config.smtpHost],
        ['SMTP_USER', config.smtpUser],
        ['SMTP_PASS', config.smtpPass]
      ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function startServer() {
  validateConfig();
  if (!config.useGithubAuthOnly) {
    await connectDatabase(config.mongoUri);
  }

  let transporter = null;
  if (!config.useGithubAuthOnly) {
    transporter = createMailer(config);
    try {
      await transporter.verify();
      console.log('SMTP transporter verified');
    } catch (error) {
      console.warn(`SMTP verification failed: ${error.message}`);
      console.warn('The server will still start, but OTP email sending will fail until SMTP credentials are fixed.');
    }
  }

  const app = express();
  app.set('trust proxy', config.trustProxy ? 1 : 0);

  // Passport & Session Configuration
  validateGitHubConfig();

  app.use(
    session({
      secret: config.jwtSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.sessionCookieSecure === null ? config.nodeEnv === 'production' : config.sessionCookieSecure,
        sameSite: config.sessionCookieSameSite,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // Setup Passport strategies
  setupGitHubStrategy(passport, { useDatabase: !config.useGithubAuthOnly });
  setupSerialization(passport, { useDatabase: !config.useGithubAuthOnly });

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

  if (!config.useGithubAuthOnly) {
    const mailer = {
      sendOtpEmail: (from, to, otp, options) => sendOtpEmail(transporter, from, to, otp, options)
    };

    app.use(
      '/',
      createAuthRouter({
        mailer,
        smtpFrom: config.smtpFrom,
        jwtSecret: config.jwtSecret,
        jwtExpiresIn: config.jwtExpiresIn,
        resetTokenExpiresIn: config.resetTokenExpiresIn,
        sessionExpiresInDays: config.sessionExpiresInDays
      })
    );
  }

  // GitHub OAuth routes
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    app.get('/auth/github', passport.authenticate('github', { scope: ['user:email', 'user'] }));

    app.get(
      '/auth/github/callback',
      passport.authenticate('github', { failureRedirect: '/login.html?error=github_auth_failed' }),
      (req, res) => {
        // Successful authentication, redirect to client
        res.redirect('/success.html?type=login&source=github');
      }
    );

    // Endpoint to get current GitHub user info (if logged in via GitHub)
    app.get('/auth/github/user', (req, res) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      return res.status(200).json({
        user: {
          id: String(req.user._id || req.user.id || ''),
          username: req.user.username,
          email: req.user.email,
          githubId: req.user.githubId,
          githubProfile: req.user.githubProfile,
          authMethod: req.user.authMethod
        }
      });
    });
  }

  app.use(express.static(path.join(__dirname, '..', '..', 'client')));

  app.get('/health', (req, res) => {
    const dbStatus = config.useGithubAuthOnly ? 'disabled' : getDatabaseStatus();
    const isHealthy = config.useGithubAuthOnly ? true : dbStatus === 'connected';

    res.status(isHealthy ? 200 : 503).json({
      ok: isHealthy,
      dbStatus,
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
    server.close(async () => {
      try {
        if (!config.useGithubAuthOnly) {
          await disconnectDatabase();
        }
        console.log('Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
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
