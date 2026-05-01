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
  // Delete all documents in the users collection
  const usersSnapshot = await db.collection('users').get();
  if (usersSnapshot.empty) {
    console.log('No users to delete.');
    return;
  }
  const batchSize = 500;
  let deleted = 0;
  const docs = usersSnapshot.docs;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    docs.slice(i, i + batchSize).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(batchSize, docs.length - i);
  }
  console.log(`Deleted ${deleted} user documents from the users collection.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error creating users collection:', err);
  if (err && err.stack) {
    console.error('Stack trace:', err.stack);
  }
  process.exit(1);
});