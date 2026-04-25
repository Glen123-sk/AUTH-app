// Usage: node server/list-collections.js serviceAccountKey.json

const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
	const keyPath = process.argv[2];
	if (!keyPath || !fs.existsSync(keyPath)) {
		console.error('Usage: node server/list-collections.js serviceAccountKey.json');
		process.exit(1);
	}


	const resolvedKeyPath = require('path').resolve(keyPath);
	admin.initializeApp({
		credential: admin.credential.cert(require(resolvedKeyPath)),
	});

	const db = admin.firestore();
	const collections = await db.listCollections();
	console.log('Top-level Firestore collections:');
	for (const col of collections) {
		console.log('-', col.id);
	}
	process.exit(0);
}

main().catch((err) => {
	console.error('Error listing collections:', err);
	process.exit(1);
});


