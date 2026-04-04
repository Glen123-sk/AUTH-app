const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || '10000'),
      socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS || '20000'),
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
      }
    };

    try {
      this.transporter = nodemailer.createTransport(smtpConfig);
      this.initialized = true;
      console.log('✓ Email service initialized');
    } catch (error) {
      console.error('✗ Email service initialization failed:', error.message);
    }
  }

  async sendConfirmationEmail(userEmail, userName) {
    if (!this.transporter) {
      console.warn('Email service not initialized, skipping confirmation email');
      return false;
    }

    const confirmToken = jwt.sign(
      { email: userEmail, purpose: 'email_confirmation' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const confirmLink = `${process.env.APP_URL || 'http://nexl.me'}/confirm-email?token=${confirmToken}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: userEmail,
      subject: 'Confirm Your Email Address',
      html: `
        <h2>Welcome, ${userName}!</h2>
        <p>Please confirm your email address by clicking the link below:</p>
        <p><a href="${confirmLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Confirm Email</a></p>
        <p>Or copy this link: ${confirmLink}</p>
        <p>This link expires in 24 hours.</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✓ Confirmation email sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to send confirmation email to ${userEmail}:`, error.message);
      return false;
    }
  }

  async sendWelcomeEmail(userEmail, userName) {
    if (!this.transporter) {
      console.warn('Email service not initialized, skipping welcome email');
      return false;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: userEmail,
      subject: 'Welcome to Our App!',
      html: `
        <h2>Welcome, ${userName}!</h2>
        <p>Your email has been confirmed and your account is all set.</p>
        <p>You can now sign in anytime using your GitHub account.</p>
        <p><a href="${process.env.APP_URL || 'http://nexl.me'}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to App</a></p>
        <p>If you have any questions, feel free to reach out to us.</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✓ Welcome email sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to send welcome email to ${userEmail}:`, error.message);
      return false;
    }
  }

  verifyConfirmationToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.purpose === 'email_confirmation') {
        return decoded.email;
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new EmailService();
