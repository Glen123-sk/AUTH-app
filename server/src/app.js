const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { connectDatabase, disconnectDatabase, getDatabaseStatus } = require('./config/db');
const { createMailer, sendOtpEmail } = require('./config/mailer');
const { createAuthRouter } = require('./routes/authRoutes');

dotenv.config();

const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '10m',
  sessionExpiresInDays: Number(process.env.SESSION_EXPIRES_IN_DAYS || 30),
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM || 'Auth App <no-reply@example.com>',
  corsOrigin: process.env.CORS_ORIGIN || 'https://nexl.me,https://www.nexl.me,http://localhost:5000,http://127.0.0.1:5000'
};

function validateConfig() {
  const required = [
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
  await connectDatabase(config.mongoUri);

  const transporter = createMailer(config);
  try {
    await transporter.verify();
    console.log('SMTP transporter verified');
  } catch (error) {
    console.warn(`SMTP verification failed: ${error.message}`);
    console.warn('The server will still start, but OTP email sending will fail until SMTP credentials are fixed.');
  }

  const app = express();

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

  const mailer = {
    sendOtpEmail: (from, to, otp) => sendOtpEmail(transporter, from, to, otp)
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

  app.use(express.static(path.join(__dirname, '..', '..', 'client')));

  app.get('/health', (req, res) => {
    const dbStatus = getDatabaseStatus();
    const isHealthy = dbStatus === 'connected';

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
        await disconnectDatabase();
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
