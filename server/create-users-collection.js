// Usage: node server/create-users-collection.js serviceAccountKey.json

const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const keyPath = process.argv[2];
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('Usage: node server/create-users-collection.js serviceAccountKey.json');
    process.exit(1);
  }

  const resolvedKeyPath = require('path').resolve(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(require(resolvedKeyPath)),
  });

  const db = admin.firestore();
  // Add a sample user document
  const userRef = db.collection('users').doc();
  await userRef.set({
    username: 'sampleuser',
    email: 'sample@example.com',
    createdAt: new Date().toISOString()
  });
  console.log('Created users collection with a sample document:', userRef.id);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error creating users collection:', err);
  if (err && err.stack) {
    console.error('Stack trace:', err.stack);
  }
  process.exit(1);
});