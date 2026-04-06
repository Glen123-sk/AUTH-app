const fs = require('fs/promises');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // Dotenv is optional when env vars are provided by the host process.
}

const firebaseAdmin = require('firebase-admin');

const DEFAULT_COUNT = 20;
const DEFAULT_PASSWORD = 'Test1234!';
const EMAIL_PREFIX = String(process.env.FAKE_USER_PREFIX || 'fake.user').trim();
const EMAIL_DOMAIN = String(process.env.FAKE_USER_DOMAIN || 'example.test').trim();
const PASSWORD = String(process.env.FAKE_USER_PASSWORD || DEFAULT_PASSWORD).trim();
const FIREBASE_SERVICE_ACCOUNT_JSON = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const FIREBASE_SERVICE_ACCOUNT_PATH = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();

function parseCountArg() {
  const raw = process.argv[2];
  if (!raw) return DEFAULT_COUNT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1000) {
    throw new Error('Count must be an integer between 1 and 1000. Example: node scripts/create-fake-firebase-users.js 20');
  }
  return parsed;
}

async function loadServiceAccount() {
  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = await fs.readFile(path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH), 'utf8');
    return JSON.parse(raw);
  }

  throw new Error('Missing Firebase service account. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in server/.env.');
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

async function createOrSkipUser(index) {
  const email = `${EMAIL_PREFIX}${index}@${EMAIL_DOMAIN}`.toLowerCase();
  const displayName = `Fake User ${index}`;

  try {
    const existing = await firebaseAdmin.auth().getUserByEmail(email);
    return { status: 'skipped', uid: existing.uid, email };
  } catch (error) {
    if (error && error.code !== 'auth/user-not-found') {
      throw error;
    }
  }

  const created = await firebaseAdmin.auth().createUser({
    email,
    password: PASSWORD,
    displayName,
    emailVerified: true,
    disabled: false
  });

  return { status: 'created', uid: created.uid, email };
}

async function main() {
  const count = parseCountArg();
  await initFirebaseAdmin();

  const results = [];
  for (let i = 1; i <= count; i += 1) {
    const result = await createOrSkipUser(i);
    results.push(result);
  }

  const created = results.filter((x) => x.status === 'created');
  const skipped = results.filter((x) => x.status === 'skipped');

  console.log(`Firebase fake-user seeding complete.`);
  console.log(`Requested: ${count}`);
  console.log(`Created: ${created.length}`);
  console.log(`Skipped (already existed): ${skipped.length}`);
  console.log('Sample accounts:');

  results.slice(0, 5).forEach((entry) => {
    console.log(` - ${entry.email} (${entry.status})`);
  });

  console.log(`Password used for all newly created users: ${PASSWORD}`);
}

main().catch((error) => {
  console.error('Failed to seed fake Firebase users.');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
