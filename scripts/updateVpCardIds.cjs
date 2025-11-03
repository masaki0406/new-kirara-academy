#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function resolveCredential() {
  const supplied = process.env.SERVICE_ACCOUNT_PATH || process.argv[2];
  if (!supplied) {
    console.error('Usage: node scripts/updateVpCardIds.cjs <serviceAccountPath | default> [collectionName]');
    console.error('       or set SERVICE_ACCOUNT_PATH and optional VP_CARD_COLLECTION environment variables.');
    process.exit(1);
  }

  if (supplied === 'default') {
    return applicationDefault();
  }

  const absolutePath = path.resolve(process.cwd(), supplied);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const json = JSON.parse(raw);
  return cert(json);
}

async function main() {
  const credential = resolveCredential();
  initializeApp({ credential });

  const db = getFirestore();
  const collectionName = process.env.VP_CARD_COLLECTION || process.argv[3] || 'cards_vp';

  console.log(`Updating documents in collection "${collectionName}"...`);

  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.warn('No documents found. Nothing to update.');
    return;
  }

  let updated = 0;
  const operations = snapshot.docs.map((doc) => {
    const data = doc.data();
    const current = typeof data.cardId === 'string' ? data.cardId.trim() : '';
    if (!current) {
      console.log(`- setting cardId for ${doc.id}`);
      updated += 1;
      return doc.ref.update({ cardId: doc.id });
    }
    return Promise.resolve();
  });

  await Promise.all(operations);
  console.log(`Done. Updated ${updated} document(s).`);
}

main().catch((error) => {
  console.error('Unexpected error while updating VP card IDs:', error);
  process.exit(1);
});
