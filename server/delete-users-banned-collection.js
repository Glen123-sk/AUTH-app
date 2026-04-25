// Usage: node server/delete-users-banned-collection.js <path-to-service-account-key.json>

const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
  const keyPath = process.argv[2];
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('Usage: node server/delete-users-banned-collection.js <path-to-service-account-key.json>');
    process.exit(1);
  }

  const resolvedKeyPath = require('path').resolve(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(require(resolvedKeyPath)),
  });

  const db = admin.firestore();
  const snapshot = await db.collection('users_banned').get();
  if (snapshot.empty) {
    console.log('No documents found in users_banned collection.');
    process.exit(0);
  }
  let count = 0;
  for (const doc of snapshot.docs) {
    await doc.ref.delete();
    console.log('Deleted document:', doc.id);
    count++;
  }
  console.log(`Deleted ${count} documents from users_banned collection.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error deleting users_banned collection:', err);
  if (err && err.stack) {
    console.error('Stack trace:', err.stack);
  }
  process.exit(1);
});