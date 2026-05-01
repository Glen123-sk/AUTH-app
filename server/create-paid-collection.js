// Usage: node server/create-paid-collection.js serviceAccountKey.json

const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const keyPath = process.argv[2];
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('Usage: node server/create-paid-collection.js serviceAccountKey.json');
    process.exit(1);
  }

  const resolvedKeyPath = require('path').resolve(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(require(resolvedKeyPath)),
  });

  const db = admin.firestore();
  // Add a single document to create the `paid` collection
  const docRef = await db.collection('paid').add({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    note: 'created by create-paid-collection.js',
  });

  console.log(`Created document in 'paid' collection with ID: ${docRef.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error creating paid collection:', err);
  if (err && err.stack) {
    console.error('Stack trace:', err.stack);
  }
  process.exit(1);
});
