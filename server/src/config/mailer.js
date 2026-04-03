const nodemailer = require('nodemailer');

function createMailer(config) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });

  return transporter;
}

async function sendOtpEmail(transporter, from, to, otp) {
  const subject = 'Your OTP Code';
  const text = `Your verification code is ${otp}. It expires in 5 minutes.`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text
  });

  return {
    messageId: info.messageId || '',
    accepted: Array.isArray(info.accepted) ? info.accepted : [],
    rejected: Array.isArray(info.rejected) ? info.rejected : [],
    response: info.response || ''
  };
}

module.exports = { createMailer, sendOtpEmail };
