const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // Dotenv is optional when env vars are provided by the host process.
}

const nodemailer = require('nodemailer');

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 0);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_FROM_EMAIL = String(process.env.SMTP_FROM_EMAIL || '').trim();
const SMTP_FROM_NAME = String(process.env.SMTP_FROM_NAME || 'COM-Serve').trim();

const PREVIEW_TO_EMAIL = String(process.env.PREVIEW_TO_EMAIL || 'glenmaluleke987@gmail.com').trim();
const ACTION_URL = String(process.env.PREVIEW_ACTION_URL || 'https://com-serve.example/verify?token=preview-token').trim();

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildStyledEmail({ title, eyebrow, intro, actionText, actionUrl, footer }) {
  const safeTitle = escapeHtml(title);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeIntro = escapeHtml(intro);
  const safeActionText = escapeHtml(actionText);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeFooter = escapeHtml(footer);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --ink: #0f172a;
      --muted: #334155;
      --line: #d8e2ee;
      --card: #ffffff;
      --primary: #0b78d1;
      --primary-hover: #095da3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
    }
    .container { max-width: 680px; margin: 0 auto; padding: 32px 14px; }
    .brand { text-align: center; margin-bottom: 14px; color: #0f172a; font-size: 26px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 900; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 22px; overflow: hidden; box-shadow: 0 6px 18px rgba(2, 6, 23, 0.08); }
    .hero { background: #eef6ff; color: #0f172a; padding: 30px 26px 24px; position: relative; }
    .hero:after { content: ''; position: absolute; right: -24px; top: -24px; width: 110px; height: 110px; border-radius: 50%; background: rgba(11, 120, 209, 0.12); }
    .eyebrow { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #dbeafe; color: #1e3a8a; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; }
    .title { margin: 0; font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; }
    .intro { margin: 14px 0 0; font-size: 16px; line-height: 1.65; color: #1e293b; max-width: 560px; }
    .content { padding: 24px 26px 22px; }
    .button { display: inline-block; padding: 14px 24px; border-radius: 12px; background: var(--primary); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: none; }
    .divider { margin: 20px 0 16px; border: 0; border-top: 1px dashed #cfdceb; }
    .label { margin: 0 0 8px; font-size: 12px; color: #334155; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    .link-box { margin: 0; padding: 10px 12px; background: #ffffff; border: 1px solid #bfd3e9; border-radius: 10px; color: #0b4f86; font-size: 12px; line-height: 1.6; word-break: break-all; }
    .footer { border-top: 1px solid var(--line); padding: 16px 26px 24px; color: #334155; font-size: 12px; line-height: 1.7; background: #f9fbff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">COM-Serve</div>
    <div class="card">
      <div class="hero">
        <div class="eyebrow">Preview email</div>
        <h1 class="title">${safeTitle}</h1>
        <p class="intro">${safeIntro}</p>
      </div>
      <div class="content">
        <a href="${safeActionUrl}" class="button">${safeActionText}</a>
        <hr class="divider">
        <p class="label">Manual link</p>
        <p class="link-box">${safeActionUrl}</p>
      </div>
      <div class="footer">${safeFooter}</div>
    </div>
  </div>
</body>
</html>`;
}

function buildWalletStatementEmail({ customerName, walletName, amountDue, dueDate, walletId, paymentUrl, note }) {
  const safeCustomerName = escapeHtml(customerName);
  const safeWalletName = escapeHtml(walletName);
  const safeAmountDue = escapeHtml(amountDue);
  const safeDueDate = escapeHtml(dueDate);
  const safeWalletId = escapeHtml(walletId);
  const safePaymentUrl = escapeHtml(paymentUrl);
  const safeNote = escapeHtml(note);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { color-scheme: light; --bg:#f4f7fb; --ink:#0f172a; --muted:#334155; --line:#d8e2ee; --card:#ffffff; --primary:#0b78d1; --primary-hover:#095da3; --warning-bg:#fff7ed; --warning-border:#fdba74; --warning-ink:#9a3412; }
    *{box-sizing:border-box}
    body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:Arial,'Helvetica Neue',Helvetica,sans-serif}
    .container{max-width:680px;margin:0 auto;padding:32px 14px}
    .brand{text-align:center;margin-bottom:14px;color:#0f172a;font-size:26px;letter-spacing:.08em;text-transform:uppercase;font-weight:900}
    .card{background:var(--card);border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:0 6px 18px rgba(2,6,23,.08)}
    .hero{background:#eef6ff;color:#0f172a;padding:30px 26px 24px;position:relative}
    .hero:after{content:'';position:absolute;right:-24px;top:-24px;width:110px;height:110px;border-radius:50%;background:rgba(11,120,209,.12)}
    .eyebrow{display:inline-block;padding:6px 12px;border-radius:999px;background:#dbeafe;color:#1e3a8a;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px}
    .title{margin:0;font-size:30px;line-height:1.15;letter-spacing:-.02em}
    .intro{margin:14px 0 0;font-size:16px;line-height:1.65;color:#1e293b;max-width:560px}
    .content{padding:24px 26px 22px}
    .summary{margin:0 0 18px;padding:18px 18px 16px;border:1px solid var(--line);border-radius:16px;background:#f8fbff}
    .summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .summary-item{padding:12px 14px;border-radius:12px;background:#ffffff;border:1px solid #d7e9f9}
    .summary-label{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#334155;font-weight:700}
    .summary-value{margin:0;font-size:20px;line-height:1.2;color:#0f172a;font-weight:900}
    .amount{color:#b91c1c;font-size:30px;letter-spacing:-.03em}
    .banner{margin:0 0 16px;padding:12px 14px;border-radius:12px;background:var(--warning-bg);border:1px solid var(--warning-border);color:var(--warning-ink);font-size:13px;line-height:1.6;font-weight:700}
    .button{display:inline-block;padding:14px 24px;border-radius:12px;background:var(--primary);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;box-shadow:none}
    .button:hover{background:var(--primary-hover)}
    .divider{margin:20px 0 16px;border:0;border-top:1px dashed #cfdceb}
    .label{margin:0 0 8px;font-size:12px;color:#334155;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
    .link-box{margin:0;padding:10px 12px;background:#ffffff;border:1px solid #bfd3e9;border-radius:10px;color:#0b4f86;font-size:12px;line-height:1.6;word-break:break-all}
    .footer{border-top:1px solid var(--line);padding:16px 26px 24px;color:#334155;font-size:12px;line-height:1.7;background:#f9fbff}
    @media only screen and (max-width:600px){.container{padding:20px 10px}.hero{padding:24px 18px 20px}.content,.footer{padding-left:18px;padding-right:18px}.title{font-size:25px}.summary-grid{grid-template-columns:1fr}.amount{font-size:26px}}
  </style>
</head>
<body>
  <div class='container'>
    <div class='brand'>COM-Serve</div>
    <div class='card'>
      <div class='hero'>
        <div class='eyebrow'>Wallet statement</div>
        <h1 class='title'>Wallet balance update</h1>
        <p class='intro'>Hello ${safeCustomerName}, here is the latest wallet summary for ${safeWalletName}.</p>
      </div>
      <div class='content'>
        <div class='summary'>
          <p class='banner'>Amount owing is shown below. Please review the wallet summary and settle the balance by the due date.</p>
          <div class='summary-grid'>
            <div class='summary-item'><p class='summary-label'>Amount owing</p><p class='summary-value amount'>${safeAmountDue}</p></div>
            <div class='summary-item'><p class='summary-label'>Due date</p><p class='summary-value'>${safeDueDate}</p></div>
            <div class='summary-item'><p class='summary-label'>Wallet ID</p><p class='summary-value'>${safeWalletId}</p></div>
            <div class='summary-item'><p class='summary-label'>Wallet</p><p class='summary-value'>${safeWalletName}</p></div>
          </div>
        </div>
        <a href='${safePaymentUrl}' class='button'>View wallet</a>
        <hr class='divider'>
        <p class='label'>Payment link</p>
        <p class='link-box'>${safePaymentUrl}</p>
      </div>
      <div class='footer'>${safeNote}</div>
    </div>
  </div>
</body>
</html>`;
}

function validateSmtpConfig() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
    throw new Error('SMTP config is incomplete. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL.');
  }
}

async function main() {
  validateSmtpConfig();

  const html = buildWalletStatementEmail({
    customerName: 'Glen',
    walletName: 'Primary Wallet',
    amountDue: 'R30',
    dueDate: '12 April 2026',
    walletId: 'WLT-204981',
    paymentUrl: ACTION_URL,
    note: 'If you believe this balance is incorrect, please contact support before making payment.'
  });

  const text = [
    'COM-Serve Wallet Template Preview',
    '',
    'This is a live preview email.',
    `Link: ${ACTION_URL}`
  ].join('\n');

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const info = await transport.sendMail({
    from: SMTP_FROM_NAME ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>` : SMTP_FROM_EMAIL,
    to: PREVIEW_TO_EMAIL,
    subject: 'COM-Serve wallet template preview',
    html,
    text
  });

  console.log(`Preview email sent to: ${PREVIEW_TO_EMAIL}`);
  console.log(`Message ID: ${info.messageId || 'n/a'}`);
}

main().catch((error) => {
  console.error('Failed to send template preview email.');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
