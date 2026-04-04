const nodemailer = require('nodemailer');

const OTP_EXPIRY_MINUTES = 5;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailCopy(purpose) {
  if (purpose === 'reset_password') {
    return {
      subject: 'Reset Your Password: OTP Code',
      heading: 'Password Reset Request',
      intro: 'Use the one-time code below to reset your password.',
      footer: 'If you did not request a password reset, you can safely ignore this email.'
    };
  }

  return {
    subject: 'Verify Your Account: OTP Code',
    heading: 'Verify Your Email',
    intro: 'Use the one-time code below to complete your signup.',
    footer: 'If you did not start signup, you can safely ignore this email.'
  };
}

function buildOtpEmailHtml({ otp, appName, purpose }) {
  const copy = getEmailCopy(purpose);
  const safeOtp = escapeHtml(otp);
  const safeAppName = escapeHtml(appName);

  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:#f4f7fb;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:24px;background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#ffffff;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;">${copy.heading}</h1>
                <p style="margin:10px 0 0;font-size:14px;line-height:1.5;opacity:0.95;">${safeAppName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${copy.intro}</p>
                <div style="margin:0 0 18px;padding:14px 16px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:12px;text-align:center;">
                  <span style="display:block;font-size:30px;letter-spacing:8px;font-weight:800;color:#0f172a;">${safeOtp}</span>
                </div>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#334155;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">${copy.footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildOtpEmailText({ otp, appName, purpose }) {
  const copy = getEmailCopy(purpose);
  return `${copy.heading}\n\n${copy.intro}\n\nOTP: ${otp}\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\n${copy.footer}\n\n${appName}`;
}

function createMailer(config) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: config.smtpRequireTls,
    connectionTimeout: config.smtpConnectionTimeoutMs,
    greetingTimeout: config.smtpGreetingTimeoutMs,
    socketTimeout: config.smtpSocketTimeoutMs,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: config.smtpRejectUnauthorized
    }
  });

  return transporter;
}

async function sendOtpEmail(transporter, from, to, otp, options = {}) {
  const purpose = options.purpose || 'signup';
  const appName = options.appName || 'Nexl';
  const subject = getEmailCopy(purpose).subject;
  const text = buildOtpEmailText({ otp, appName, purpose });
  const html = buildOtpEmailHtml({ otp, appName, purpose });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });

  return {
    messageId: info.messageId || '',
    accepted: Array.isArray(info.accepted) ? info.accepted : [],
    rejected: Array.isArray(info.rejected) ? info.rejected : [],
    response: info.response || ''
  };
}

module.exports = { createMailer, sendOtpEmail };
