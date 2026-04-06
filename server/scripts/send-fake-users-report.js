const fs = require('fs/promises');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // Dotenv is optional when env vars are provided by the host process.
}

const firebaseAdmin = require('firebase-admin');
const nodemailer = require('nodemailer');

const FIREBASE_SERVICE_ACCOUNT_JSON = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const FIREBASE_SERVICE_ACCOUNT_PATH = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 0);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_FROM_EMAIL = String(process.env.SMTP_FROM_EMAIL || '').trim();
const SMTP_FROM_NAME = String(process.env.SMTP_FROM_NAME || 'Auth App').trim();
const REPORT_TO_EMAIL = String(process.env.REPORT_TO_EMAIL || SMTP_FROM_EMAIL).trim();

const FAKE_USER_PREFIX = String(process.env.FAKE_USER_PREFIX || 'fake.user').trim().toLowerCase();
const FAKE_USER_DOMAIN = String(process.env.FAKE_USER_DOMAIN || 'example.test').trim().toLowerCase();

async function loadServiceAccount() {
  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = await fs.readFile(path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8');
    return JSON.parse(raw);
  }

  throw new Error('Missing Firebase service account. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.');
}

function ensureSmtpConfigured() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL || !REPORT_TO_EMAIL) {
    throw new Error('SMTP configuration is incomplete. Check SMTP_* and REPORT_TO_EMAIL in server/.env.');
  }
}

async function initFirebaseAdmin() {
  if (firebaseAdmin.apps.length > 0) {
    return;
  }

  const serviceAccount = await loadServiceAccount();
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount)
  });
}

async function getAllUsers() {
  const users = [];
  let pageToken;

  do {
    const result = await firebaseAdmin.auth().listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  return users;
}

function isFakeUser(record) {
  const email = String(record.email || '').toLowerCase();
  return email.startsWith(FAKE_USER_PREFIX) && email.endsWith(`@${FAKE_USER_DOMAIN}`);
}

function toRow(record) {
  return {
    uid: record.uid,
    email: record.email || '',
    displayName: record.displayName || '',
    emailVerified: Boolean(record.emailVerified),
    disabled: Boolean(record.disabled),
    createdAt: record.metadata?.creationTime || '',
    lastSignInAt: record.metadata?.lastSignInTime || ''
  };
}

function asCsv(rows) {
  const headers = ['uid', 'email', 'displayName', 'emailVerified', 'disabled', 'createdAt', 'lastSignInAt'];
  const escapeCsv = (value) => {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
  }
  return lines.join('\n');
}

async function sendReport(rows) {
  ensureSmtpConfigured();

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const now = new Date().toISOString();
  const subject = `Fake users report (${rows.length}) - ${now}`;

  const text = [
    `Generated at: ${now}`,
    `Filter: ${FAKE_USER_PREFIX}*@${FAKE_USER_DOMAIN}`,
    `Total fake users: ${rows.length}`,
    '',
    ...rows.map((r, i) => `${i + 1}. ${r.email} | uid=${r.uid} | verified=${r.emailVerified} | disabled=${r.disabled}`)
  ].join('\n');

  const htmlRows = rows.map((r) => (
    `<tr><td>${r.email}</td><td>${r.uid}</td><td>${r.displayName}</td><td>${r.emailVerified}</td><td>${r.disabled}</td><td>${r.createdAt}</td></tr>`
  )).join('');

  const html = `<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif;">
    <h2>Fake users report</h2>
    <p><strong>Generated at:</strong> ${now}<br>
    <strong>Filter:</strong> ${FAKE_USER_PREFIX}*@${FAKE_USER_DOMAIN}<br>
    <strong>Total fake users:</strong> ${rows.length}</p>
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr><th>Email</th><th>UID</th><th>Name</th><th>Verified</th><th>Disabled</th><th>Created At</th></tr>
      </thead>
      <tbody>${htmlRows}</tbody>
    </table>
  </body>
</html>`;

  const csv = asCsv(rows);
  const info = await transport.sendMail({
    from: SMTP_FROM_NAME ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>` : SMTP_FROM_EMAIL,
    to: REPORT_TO_EMAIL,
    subject,
    text,
    html,
    attachments: [
      {
        filename: 'fake-users-report.csv',
        content: csv,
        contentType: 'text/csv'
      }
    ]
  });

  return info;
}

async function main() {
  await initFirebaseAdmin();
  const allUsers = await getAllUsers();
  const fakeRows = allUsers.filter(isFakeUser).map(toRow);
  const info = await sendReport(fakeRows);

  console.log(`Report sent to: ${REPORT_TO_EMAIL}`);
  console.log(`Matched fake users: ${fakeRows.length}`);
  console.log(`Message ID: ${info.messageId || 'n/a'}`);
}

main().catch((error) => {
  console.error('Failed to send fake users report email.');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
