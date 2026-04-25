// Usage: node server/create-users-banned-collection.js <path-to-service-account-key.json>

const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const keyPath = process.argv[2];
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('Usage: node server/create-users-banned-collection.js <path-to-service-account-key.json>');
    process.exit(1);
  }

  const resolvedKeyPath = require('path').resolve(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(require(resolvedKeyPath)),
  });

  const db = admin.firestore();
  // Add a sample banned user document
  const bannedRef = db.collection('users_banned').doc();
  await bannedRef.set({
    username: 'banneduser',
    email: 'banned@example.com',
    reason: 'Violation of terms',
    bannedAt: new Date().toISOString(),
    admin: 'admin@example.com'
  });
  console.log('Created users_banned collection with a sample document:', bannedRef.id);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error creating users_banned collection:', err);
  if (err && err.stack) {
    console.error('Stack trace:', err.stack);
  }
  process.exit(1);
});