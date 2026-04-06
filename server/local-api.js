const http = require('http');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {
  // Dotenv is optional when env vars are provided by the host process.
}

const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DEV_EXPOSE_LINKS = String(process.env.DEV_EXPOSE_LINKS || 'true').toLowerCase() === 'true';
const PUBLIC_APP_URL = String(process.env.PUBLIC_APP_URL || 'http://localhost:5500/client').replace(/\/$/, '');

const EMAIL_AUTH_TABLE = process.env.EMAIL_AUTH_TABLE || 'email_auth_users';
const PENDING_SIGNUPS_TABLE = process.env.PENDING_SIGNUPS_TABLE || 'pending_signups';
const PASSWORD_RESETS_TABLE = process.env.PASSWORD_RESETS_TABLE || 'password_resets';
const LOCAL_DATA_FILE = path.join(__dirname, 'data', 'email-auth.json');

const FIREBASE_API_KEY = String(process.env.FIREBASE_API_KEY || '').trim();
const FIREBASE_SERVICE_ACCOUNT_JSON = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const FIREBASE_SERVICE_ACCOUNT_PATH = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 0);
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_FROM_EMAIL = String(process.env.SMTP_FROM_EMAIL || '').trim();
const SMTP_FROM_NAME = String(process.env.SMTP_FROM_NAME || 'Auth App').trim();
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

const HAS_FIREBASE_SERVICE_ACCOUNT = Boolean(FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT_PATH);
const HAS_SMTP = Boolean(SMTP_HOST && SMTP_PORT > 0 && SMTP_USER && SMTP_PASS && SMTP_FROM_EMAIL);
const USE_FIREBASE_SMTP = Boolean(FIREBASE_API_KEY && HAS_FIREBASE_SERVICE_ACCOUNT && HAS_SMTP);

let firebaseAdmin = null;
let firebaseAdminApp = null;
let nodemailer = null;
let smtpTransport = null;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || ''));
}

function isStrongPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(String(value || ''));
}

function nowIso() {
  return new Date().toISOString();
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function send(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

  async function ensureFirebaseAdmin() {
    if (!USE_FIREBASE_SMTP) {
      const err = new Error('Firebase SMTP mode is not configured.');
      err.status = 500;
      throw err;
    }

    if (!firebaseAdmin) {
      // Lazy-load dependency so local JSON mode works without installing Firebase Admin SDK.
      firebaseAdmin = require('firebase-admin');
    }

    if (firebaseAdminApp) {
      return firebaseAdminApp;
    }

    let serviceAccount = null;
    if (FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    } else if (FIREBASE_SERVICE_ACCOUNT_PATH) {
      const raw = await fs.readFile(path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8');
      serviceAccount = JSON.parse(raw);
    }

    firebaseAdminApp = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });

    return firebaseAdminApp;
  }

  function ensureSmtpTransport() {
    if (!USE_FIREBASE_SMTP) {
      const err = new Error('SMTP is not configured for Firebase mode.');
      err.status = 500;
      throw err;
    }

    if (!nodemailer) {
      // Lazy-load dependency so local JSON mode works without installing Nodemailer.
      nodemailer = require('nodemailer');
    }

    if (!smtpTransport) {
      smtpTransport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      });
    }

    return smtpTransport;
  }

  async function sendSmtpEmail(to, subject, html, text) {
    const transport = ensureSmtpTransport();
    await transport.sendMail({
      from: SMTP_FROM_NAME ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>` : SMTP_FROM_EMAIL,
      to,
      subject,
      html,
      text
    });
  }

  function buildAuthPageUrl(pageName) {
    return new URL(pageName.replace(/^\/+/, ''), `${PUBLIC_APP_URL}/`).toString();
  }

  function firebaseActionCodeSettings(pageName) {
    return {
      url: buildAuthPageUrl(pageName),
      handleCodeInApp: true
    };
  }

  async function firebaseIdentityFetch(action, body) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const rawMessage = String(json?.error?.message || 'AUTH_FAILED');
      const messageMap = {
        EMAIL_EXISTS: 'An account with this email already exists.',
        INVALID_EMAIL: 'Enter a valid email.',
        EMAIL_NOT_FOUND: 'Invalid email or password.',
        INVALID_PASSWORD: 'Invalid email or password.',
        USER_DISABLED: 'This account is disabled.',
        TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Try again later.',
        EXPIRED_OOB_CODE: 'This link has expired. Request a fresh email.',
        INVALID_OOB_CODE: 'This link is no longer valid.'
      };
      const err = new Error(messageMap[rawMessage] || rawMessage.replace(/_/g, ' ').toLowerCase());
      err.code = rawMessage;
      err.status = [
        'EMAIL_EXISTS'
      ].includes(rawMessage) ? 409 : 400;
      throw err;
    }

    return json;
  }

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function defaultLocalData() {
  return { users: [], pendingSignups: [], passwordResets: [] };
}

function normalizeLocalData(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    users: Array.isArray(source.users) ? source.users : [],
    pendingSignups: Array.isArray(source.pendingSignups) ? source.pendingSignups : [],
    passwordResets: Array.isArray(source.passwordResets) ? source.passwordResets : []
  };
}

async function loadLocalData() {
  try {
    const raw = await fs.readFile(LOCAL_DATA_FILE, 'utf8');
    return normalizeLocalData(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return defaultLocalData();
    }
    throw error;
  }
}

async function saveLocalData(data) {
  await fs.mkdir(path.dirname(LOCAL_DATA_FILE), { recursive: true });
  await fs.writeFile(LOCAL_DATA_FILE, `${JSON.stringify(normalizeLocalData(data), null, 2)}\n`, 'utf8');
}

function makeId() {
  return randomToken(16);
}

function normalizeForCompare(value) {
  return String(value || '').trim().toLowerCase();
}

function localTableName(table) {
  if (table === EMAIL_AUTH_TABLE) return 'users';
  if (table === PENDING_SIGNUPS_TABLE) return 'pendingSignups';
  if (table === PASSWORD_RESETS_TABLE) return 'passwordResets';
  return table;
}

function getLocalCollection(data, table) {
  const key = localTableName(table);
  if (!Array.isArray(data[key])) {
    data[key] = [];
  }
  return data[key];
}

function localPendingCodeHash(record) {
  return String(record.verify_code_hash || record.otpHash || '');
}

function localResetCodeHash(record) {
  return String(record.reset_code_hash || record.resetHash || '');
}

function shapeLocalUser(record) {
  return {
    id: record.id || makeId(),
    username: String(record.username || ''),
    email: normalizeForCompare(record.email),
    passwordHash: String(record.password_hash || record.passwordHash || ''),
    password_hash: String(record.password_hash || record.passwordHash || ''),
    authMethod: String(record.auth_method || record.authMethod || 'email'),
    auth_method: String(record.auth_method || record.authMethod || 'email'),
    verifiedAt: record.verified_at || record.verifiedAt || null,
    verified_at: record.verified_at || record.verifiedAt || null,
    createdAt: record.createdAt || record.created_at || nowIso(),
    created_at: record.createdAt || record.created_at || nowIso(),
    updatedAt: record.updatedAt || record.updated_at || nowIso(),
    updated_at: record.updatedAt || record.updated_at || nowIso()
  };
}

function shapeLocalPending(record) {
  return {
    id: record.id || makeId(),
    username: String(record.username || ''),
    email: normalizeForCompare(record.email),
    passwordHash: String(record.password_hash || record.passwordHash || ''),
    password_hash: String(record.password_hash || record.passwordHash || ''),
    verify_code_hash: String(record.verify_code_hash || record.otpHash || ''),
    otpHash: String(record.verify_code_hash || record.otpHash || ''),
    verify_code_expires_at: String(record.verify_code_expires_at || record.otpExpiresAt || ''),
    otpExpiresAt: String(record.verify_code_expires_at || record.otpExpiresAt || ''),
    verify_link_sent_at: record.verify_link_sent_at || record.otpSentAt || nowIso(),
    otpSentAt: record.verify_link_sent_at || record.otpSentAt || nowIso(),
    createdAt: record.createdAt || record.created_at || nowIso(),
    created_at: record.createdAt || record.created_at || nowIso(),
    updatedAt: record.updatedAt || record.updated_at || nowIso(),
    updated_at: record.updatedAt || record.updated_at || nowIso()
  };
}

function shapeLocalReset(record) {
  return {
    id: record.id || makeId(),
    email: normalizeForCompare(record.email),
    reset_code_hash: String(record.reset_code_hash || record.resetHash || ''),
    resetHash: String(record.reset_code_hash || record.resetHash || ''),
    reset_code_expires_at: String(record.reset_code_expires_at || record.resetExpiresAt || ''),
    resetExpiresAt: String(record.reset_code_expires_at || record.resetExpiresAt || ''),
    reset_link_sent_at: record.reset_link_sent_at || record.resetSentAt || nowIso(),
    resetSentAt: record.reset_link_sent_at || record.resetSentAt || nowIso(),
    createdAt: record.createdAt || record.created_at || nowIso(),
    created_at: record.createdAt || record.created_at || nowIso(),
    updatedAt: record.updatedAt || record.updated_at || nowIso(),
    updated_at: record.updatedAt || record.updated_at || nowIso()
  };
}

function buildAppLink(pathname, params = {}) {
  const url = new URL(pathname, `${PUBLIC_APP_URL}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function withDevLinkMessage(base, link) {
  return DEV_EXPOSE_LINKS ? `${base} Dev link: ${link}` : base;
}

async function localSelectSingleByEmail(table, email) {
  const data = await loadLocalData();
  const collection = getLocalCollection(data, table);
  return collection.find((record) => normalizeForCompare(record.email) === normalizeForCompare(email)) || null;
}

async function localSelectSingleByCodeHash(table, codeHashField, codeHash) {
  const data = await loadLocalData();
  const collection = getLocalCollection(data, table);

  if (codeHashField === 'verify_code_hash') {
    return collection.find((record) => localPendingCodeHash(record) === codeHash) || null;
  }

  if (codeHashField === 'reset_code_hash') {
    return collection.find((record) => localResetCodeHash(record) === codeHash) || null;
  }

  return collection.find((record) => String(record[codeHashField] || '') === codeHash) || null;
}

async function localUpsertByEmail(table, payload) {
  const data = await loadLocalData();
  const collection = getLocalCollection(data, table);
  const email = normalizeForCompare(payload.email);
  const index = collection.findIndex((record) => normalizeForCompare(record.email) === email);

  if (table === EMAIL_AUTH_TABLE) {
    const nextRecord = shapeLocalUser({
      ...(index >= 0 ? collection[index] : {}),
      ...payload,
      email
    });
    if (index >= 0) collection[index] = nextRecord;
    else collection.push(nextRecord);
  } else if (table === PENDING_SIGNUPS_TABLE) {
    const nextRecord = shapeLocalPending({
      ...(index >= 0 ? collection[index] : {}),
      ...payload,
      email
    });
    if (index >= 0) collection[index] = nextRecord;
    else collection.push(nextRecord);
  } else if (table === PASSWORD_RESETS_TABLE) {
    const nextRecord = shapeLocalReset({
      ...(index >= 0 ? collection[index] : {}),
      ...payload,
      email
    });
    if (index >= 0) collection[index] = nextRecord;
    else collection.push(nextRecord);
  }

  await saveLocalData(data);
}

async function localDeleteByEmail(table, email) {
  const data = await loadLocalData();
  const collection = getLocalCollection(data, table);
  const normalizedEmail = normalizeForCompare(email);
  data[localTableName(table)] = collection.filter((record) => normalizeForCompare(record.email) !== normalizedEmail);
  await saveLocalData(data);
}

async function localUpdateByEmail(table, email, payload) {
  const data = await loadLocalData();
  const collection = getLocalCollection(data, table);
  const normalizedEmail = normalizeForCompare(email);
  const index = collection.findIndex((record) => normalizeForCompare(record.email) === normalizedEmail);
  if (index < 0) return;

  if (table === EMAIL_AUTH_TABLE) {
    collection[index] = shapeLocalUser({ ...collection[index], ...payload, email: normalizedEmail });
  } else if (table === PENDING_SIGNUPS_TABLE) {
    collection[index] = shapeLocalPending({ ...collection[index], ...payload, email: normalizedEmail });
  } else if (table === PASSWORD_RESETS_TABLE) {
    collection[index] = shapeLocalReset({ ...collection[index], ...payload, email: normalizedEmail });
  }

  await saveLocalData(data);
}

async function localDeleteById(table, id) {
  const data = await loadLocalData();
  const collection = getLocalCollection(data, table);
  data[localTableName(table)] = collection.filter((record) => String(record.id || '') !== String(id));
  await saveLocalData(data);
}

async function dbSelectSingleByEmail(table, email) {
  return localSelectSingleByEmail(table, email);
}

async function dbSelectSingleByCodeHash(table, codeHashField, codeHash) {
  return localSelectSingleByCodeHash(table, codeHashField, codeHash);
}

async function dbUpsertByEmail(table, payload) {
  return localUpsertByEmail(table, payload);
}

async function dbDeleteByEmail(table, email) {
  return localDeleteByEmail(table, email);
}

async function dbUpdateByEmail(table, email, payload) {
  return localUpdateByEmail(table, email, payload);
}

async function dbDeleteById(table, id) {
  return localDeleteById(table, id);
}

async function firebaseSendVerificationEmail(email) {
  await ensureFirebaseAdmin();
  const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
  const link = await firebaseAdmin.auth().generateEmailVerificationLink(
    email,
    firebaseActionCodeSettings('otp.html')
  );

  await sendSmtpEmail(
    email,
    'Verify your account',
    `<p>Hello ${userRecord.displayName || ''},</p><p>Click the link below to verify your email:</p><p><a href="${link}">${link}</a></p>`,
    `Verify your email by opening this link: ${link}`
  );

  return link;
}

async function firebaseSendResetEmail(email) {
  await ensureFirebaseAdmin();
  const link = await firebaseAdmin.auth().generatePasswordResetLink(
    email,
    firebaseActionCodeSettings('reset-password.html')
  );

  await sendSmtpEmail(
    email,
    'Reset your password',
    `<p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p>`,
    `Reset your password using this link: ${link}`
  );

  return link;
}

async function handleFirebaseRegister(body) {
  const email = normalizeEmail(body.email);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');

  if (!isValidEmail(email)) {
    return [400, { message: 'Enter a valid email.' }];
  }
  if (username.length < 3) {
    return [400, { message: 'Username must be at least 3 characters.' }];
  }
  if (!isStrongPassword(password)) {
    return [400, { message: 'Password must include upper, lower, number, symbol and be 8+ chars.' }];
  }
  if (password !== confirmPassword) {
    return [400, { message: 'Passwords do not match.' }];
  }

  let signup;
  try {
    signup = await firebaseIdentityFetch('signUp', {
      email,
      password,
      returnSecureToken: true
    });
  } catch (error) {
    return [error.status || 400, { message: error.message || 'Signup failed.' }];
  }

  await firebaseIdentityFetch('update', {
    idToken: signup.idToken,
    displayName: username,
    returnSecureToken: true
  });

  const verifyLink = await firebaseSendVerificationEmail(email);
  return [200, {
    message: withDevLinkMessage('Verification email sent. Check your inbox to complete signup.', verifyLink)
  }];
}

async function handleFirebaseVerifyOtp(body) {
  const email = normalizeEmail(body.email);
  const resend = Boolean(body.resend);
  const oobCode = String(body.oobCode || '').trim();

  if (resend) {
    if (!isValidEmail(email)) {
      return [400, { message: 'Enter a valid email to resend verification.' }];
    }

    try {
      const verifyLink = await firebaseSendVerificationEmail(email);
      return [200, { message: withDevLinkMessage('Verification email sent again.', verifyLink) }];
    } catch (error) {
      if (String(error?.code || '').includes('user-not-found')) {
        return [404, { message: 'No pending signup found for this email.' }];
      }
      return [500, { message: 'Unable to resend verification email right now.' }];
    }
  }

  if (!oobCode) {
    return [400, { message: 'Missing verification code.' }];
  }

  try {
    await firebaseIdentityFetch('update', { oobCode });
    return [200, { message: 'Email verified successfully.' }];
  } catch (error) {
    return [400, { message: error.message || 'This verification link is no longer valid.' }];
  }
}

async function handleFirebaseLogin(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!isValidEmail(email)) {
    return [400, { message: 'Enter a valid email.' }];
  }
  if (!password) {
    return [400, { message: 'Enter your password.' }];
  }

  let signin;
  try {
    signin = await firebaseIdentityFetch('signInWithPassword', {
      email,
      password,
      returnSecureToken: true
    });
  } catch (error) {
    return [401, { message: error.message || 'Invalid email or password.' }];
  }

  const lookup = await firebaseIdentityFetch('lookup', { idToken: signin.idToken });
  const account = Array.isArray(lookup.users) ? lookup.users[0] : null;
  const emailVerified = Boolean(account?.emailVerified);

  if (!emailVerified) {
    try {
      const verifyLink = await firebaseSendVerificationEmail(email);
      return [403, {
        message: withDevLinkMessage(
          'Please verify your email before logging in. We sent a new verification link.',
          verifyLink
        )
      }];
    } catch {
      return [403, { message: 'Please verify your email before logging in.' }];
    }
  }

  return [200, {
    token: signin.idToken,
    user: {
      id: signin.localId,
      username: signin.displayName || '',
      email: signin.email,
      authMethod: 'firebase'
    }
  }];
}

async function handleFirebaseForgotPassword(body) {
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return [400, { message: 'Enter a valid email.' }];
  }

  try {
    const resetLink = await firebaseSendResetEmail(email);
    return [200, { message: withDevLinkMessage('If this email exists, a reset link has been sent.', resetLink) }];
  } catch (error) {
    if (String(error?.code || '').includes('user-not-found')) {
      return [200, { message: 'If this email exists, a reset link has been sent.' }];
    }
    return [500, { message: 'Unable to send reset email right now.' }];
  }
}

async function handleFirebaseVerifyResetCode(body) {
  const oobCode = String(body.oobCode || '').trim();
  if (!oobCode) {
    return [400, { message: 'Missing reset code.' }];
  }

  try {
    const result = await firebaseIdentityFetch('resetPassword', { oobCode });
    return [200, { message: 'Reset code verified.', email: result.email || '' }];
  } catch (error) {
    return [400, { message: error.message || 'This reset link is no longer valid.' }];
  }
}

async function handleFirebaseResetPassword(body) {
  const oobCode = String(body.oobCode || '').trim();
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');

  if (!oobCode) {
    return [400, { message: 'Missing reset code.' }];
  }
  if (!isStrongPassword(password)) {
    return [400, { message: 'Password must include upper, lower, number, symbol and be 8+ chars.' }];
  }
  if (password !== confirmPassword) {
    return [400, { message: 'Passwords do not match.' }];
  }

  try {
    await firebaseIdentityFetch('resetPassword', {
      oobCode,
      newPassword: password
    });
    return [200, { message: 'Password reset successful.' }];
  } catch (error) {
    return [400, { message: error.message || 'This reset link is no longer valid.' }];
  }
}

async function handleRegister(body) {
  if (USE_FIREBASE_SMTP) {
    return handleFirebaseRegister(body);
  }

  const email = normalizeEmail(body.email);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');

  if (!isValidEmail(email)) {
    return [400, { message: 'Enter a valid email.' }];
  }

  if (username.length < 3) {
    return [400, { message: 'Username must be at least 3 characters.' }];
  }
  if (!isStrongPassword(password)) {
    return [400, { message: 'Password must include upper, lower, number, symbol and be 8+ chars.' }];
  }
  if (password !== confirmPassword) {
    return [400, { message: 'Passwords do not match.' }];
  }

  const userExists = await dbSelectSingleByEmail(EMAIL_AUTH_TABLE, email);
  if (userExists) {
    return [409, { message: 'An account with this email already exists.' }];
  }

  const verifyCode = randomToken(24);
  const verifyLink = buildAppLink('/otp.html', { mode: 'verifyEmail', oobCode: verifyCode, email });
  await dbUpsertByEmail(PENDING_SIGNUPS_TABLE, {
    email,
    username,
    password_hash: sha256(password),
    verify_code_hash: sha256(verifyCode),
    verify_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    verify_link_sent_at: nowIso(),
    updated_at: nowIso()
  });

  return [200, { message: withDevLinkMessage('Verification email sent. Check your inbox to complete signup.', verifyLink) }];
}

async function handleVerifyOtp(body) {
  if (USE_FIREBASE_SMTP) {
    return handleFirebaseVerifyOtp(body);
  }

  const email = normalizeEmail(body.email);
  const resend = Boolean(body.resend);
  const oobCode = String(body.oobCode || '').trim();

  if (resend) {
    if (!isValidEmail(email)) {
      return [400, { message: 'Enter a valid email to resend verification.' }];
    }

    const pending = await dbSelectSingleByEmail(PENDING_SIGNUPS_TABLE, email);
    if (!pending) {
      return [404, { message: 'No pending signup found for this email.' }];
    }

    const verifyCode = randomToken(24);
    const verifyLink = buildAppLink('/otp.html', { mode: 'verifyEmail', oobCode: verifyCode, email });
    await dbUpdateByEmail(PENDING_SIGNUPS_TABLE, email, {
      verify_code_hash: sha256(verifyCode),
      verify_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      verify_link_sent_at: nowIso(),
      updated_at: nowIso()
    });

    return [200, { message: withDevLinkMessage('Verification email sent again.', verifyLink) }];
  }

  if (!oobCode) {
    return [400, { message: 'Missing verification code.' }];
  }

  const pending = await dbSelectSingleByCodeHash(PENDING_SIGNUPS_TABLE, 'verify_code_hash', sha256(oobCode));
  if (!pending) {
    return [400, { message: 'This verification link is no longer valid.' }];
  }

  if (new Date(pending.verify_code_expires_at).getTime() < Date.now()) {
    return [400, { message: 'This verification link has expired. Request a new one.' }];
  }

  await dbUpsertByEmail(EMAIL_AUTH_TABLE, {
    email: normalizeEmail(pending.email),
    username: String(pending.username || ''),
    password_hash: String(pending.password_hash || ''),
    auth_method: 'email',
    verified_at: nowIso(),
    updated_at: nowIso()
  });
  await dbDeleteByEmail(PENDING_SIGNUPS_TABLE, normalizeEmail(pending.email));

  return [200, { message: 'Email verified successfully.' }];
}

async function handleLogin(body) {
  if (USE_FIREBASE_SMTP) {
    return handleFirebaseLogin(body);
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const user = await dbSelectSingleByEmail(EMAIL_AUTH_TABLE, email);

  if (user && sha256(password) === String(user.password_hash || '')) {
    return [200, {
      token: randomToken(24),
      user: {
        id: String(user.id || ''),
        username: String(user.username || ''),
        email: user.email,
        authMethod: 'email'
      }
    }];
  }

  const pending = await dbSelectSingleByEmail(PENDING_SIGNUPS_TABLE, email);
  if (pending && sha256(password) === String(pending.password_hash || '')) {
    const verifyCode = randomToken(24);
    const verifyLink = buildAppLink('/otp.html', { mode: 'verifyEmail', oobCode: verifyCode, email });
    await dbUpdateByEmail(PENDING_SIGNUPS_TABLE, email, {
      verify_code_hash: sha256(verifyCode),
      verify_code_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      verify_link_sent_at: nowIso(),
      updated_at: nowIso()
    });

    return [403, {
      message: withDevLinkMessage(
        'Please verify your email before logging in. We sent a new verification link.',
        verifyLink
      )
    }];
  }

  return [401, { message: 'Invalid email or password.' }];
}

async function handleForgotPassword(body) {
  if (USE_FIREBASE_SMTP) {
    return handleFirebaseForgotPassword(body);
  }

  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) {
    return [400, { message: 'Enter a valid email.' }];
  }

  const user = await dbSelectSingleByEmail(EMAIL_AUTH_TABLE, email);
  if (!user) {
    return [200, { message: 'If this email exists, a reset link has been sent.' }];
  }

  const oobCode = randomToken(24);
  const resetLink = buildAppLink('/reset-password.html', { oobCode, email });
  await dbUpsertByEmail(PASSWORD_RESETS_TABLE, {
    email,
    reset_code_hash: sha256(oobCode),
    reset_code_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    reset_link_sent_at: nowIso(),
    updated_at: nowIso()
  });

  return [200, { message: withDevLinkMessage('If this email exists, a reset link has been sent.', resetLink) }];
}

async function handleVerifyResetCode(body) {
  if (USE_FIREBASE_SMTP) {
    return handleFirebaseVerifyResetCode(body);
  }

  const oobCode = String(body.oobCode || '').trim();
  if (!oobCode) {
    return [400, { message: 'Missing reset code.' }];
  }

  const reset = await dbSelectSingleByCodeHash(PASSWORD_RESETS_TABLE, 'reset_code_hash', sha256(oobCode));
  if (!reset) {
    return [400, { message: 'This reset link is no longer valid.' }];
  }
  if (new Date(reset.reset_code_expires_at).getTime() < Date.now()) {
    return [400, { message: 'This reset link has expired.' }];
  }

  return [200, { message: 'Reset code verified.', email: reset.email }];
}

async function handleResetPassword(body) {
  if (USE_FIREBASE_SMTP) {
    return handleFirebaseResetPassword(body);
  }

  const oobCode = String(body.oobCode || '').trim();
  const password = String(body.password || '');
  const confirmPassword = String(body.confirmPassword || '');

  if (!oobCode) {
    return [400, { message: 'Missing reset code.' }];
  }

  if (!isStrongPassword(password)) {
    return [400, { message: 'Password must include upper, lower, number, symbol and be 8+ chars.' }];
  }
  if (password !== confirmPassword) {
    return [400, { message: 'Passwords do not match.' }];
  }

  const reset = await dbSelectSingleByCodeHash(PASSWORD_RESETS_TABLE, 'reset_code_hash', sha256(oobCode));
  if (!reset) {
    return [400, { message: 'This reset link is no longer valid.' }];
  }

  if (new Date(reset.reset_code_expires_at).getTime() < Date.now()) {
    return [400, { message: 'This reset link has expired.' }];
  }

  const email = normalizeEmail(reset.email);
  const user = await dbSelectSingleByEmail(EMAIL_AUTH_TABLE, email);
  if (!user) {
    return [404, { message: 'User not found.' }];
  }

  await dbUpdateByEmail(EMAIL_AUTH_TABLE, email, {
    password_hash: sha256(password),
    updated_at: nowIso()
  });
  if (reset.id !== undefined && reset.id !== null) {
    await dbDeleteById(PASSWORD_RESETS_TABLE, reset.id);
  } else {
    await dbDeleteByEmail(PASSWORD_RESETS_TABLE, email);
  }

  return [200, { message: 'Password reset successful.' }];
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const routePath = url.pathname.startsWith('/api/') ? url.pathname.slice(4) : url.pathname;

  if (routePath === '/health' && req.method === 'GET') {
    send(res, 200, {
      ok: true,
      authMode: USE_FIREBASE_SMTP ? 'firebase-smtp' : 'email-only',
      storage: USE_FIREBASE_SMTP ? 'firebase-auth+smtp' : 'local-json',
      timestamp: nowIso()
    });
    return;
  }

  if (req.method !== 'POST') {
    send(res, 404, { message: 'Not found' });
    return;
  }

  let body;
  try {
    body = await parseJsonBody(req);
  } catch (error) {
    send(res, 400, { message: error.message || 'Invalid request body.' });
    return;
  }

  let result;

  if (routePath === '/register') result = await handleRegister(body);
  else if (routePath === '/verify-otp') result = await handleVerifyOtp(body);
  else if (routePath === '/login') result = await handleLogin(body);
  else if (routePath === '/forgot-password') result = await handleForgotPassword(body);
  else if (routePath === '/verify-reset-code') result = await handleVerifyResetCode(body);
  else if (routePath === '/reset-password') result = await handleResetPassword(body);
  else result = [404, { message: 'Not found' }];

  send(res, result[0], result[1]);
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    send(res, 500, { message: error?.message || 'Internal server error.' });
  });
});

server.listen(PORT, () => {
  console.log(`Local auth API listening on http://127.0.0.1:${PORT}`);
});
