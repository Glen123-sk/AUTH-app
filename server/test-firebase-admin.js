// Usage: node server/test-firebase-admin.js serviceAccountKey.json

const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const keyPath = process.argv[2];
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('Usage: node server/test-firebase-admin.js serviceAccountKey.json');
    process.exit(1);
  }

  const resolvedKeyPath = require('path').resolve(keyPath);
  try {
    admin.initializeApp({
      credential: admin.credential.cert(require(resolvedKeyPath)),
    });
    console.log('Firebase Admin initialized successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing Firebase Admin:', err);
    process.exit(1);
  }
}

main();