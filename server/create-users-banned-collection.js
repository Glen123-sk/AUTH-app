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
  // Add 10 fake banned user documents
  const fakeUsers = Array.from({ length: 10 }, (_, i) => ({
    username: `banneduser${i + 1}`,
    email: `banned${i + 1}@example.com`,
    reason: 'Violation of terms',
    bannedAt: new Date(Date.now() - i * 86400000).toISOString(),
    admin: `admin${(i % 3) + 1}@example.com`
  }));

  for (const user of fakeUsers) {
    const bannedRef = db.collection('users_banned').doc();
    await bannedRef.set(user);
    console.log('Created users_banned document:', bannedRef.id, user);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Error creating users_banned collection:', err);
  if (err && err.stack) {
    console.error('Stack trace:', err.stack);
  }
  process.exit(1);
});