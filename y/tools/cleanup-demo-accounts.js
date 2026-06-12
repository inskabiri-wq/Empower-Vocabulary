/* ============================================================
   cleanup-demo-accounts.js
   Deletes demo user docs whose expiresAt has passed.
   Run manually (or on a schedule) with:

     node tools/cleanup-demo-accounts.js

   Requires:
     1. firebase-admin installed:  npm i firebase-admin
     2. A service-account JSON file at  tools/.serviceAccount.json
        (download from Firebase Console → Project settings →
        Service accounts → Generate new private key).
        DO NOT commit this file. The .gitignore already excludes it.

   What it does:
     - Lists users/{uid} where role == 'demo' and expiresAt < now
     - Deletes that doc
     - Optionally deletes the auth account too (anonymous users
       hang around in Firebase Auth forever otherwise)
   ============================================================ */

const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '.serviceAccount.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
  });
} catch (err) {
  console.error('Could not load service account from', SERVICE_ACCOUNT_PATH);
  console.error('See the header comment in this file for setup instructions.');
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  const now = admin.firestore.Timestamp.now();
  const snap = await db.collection('users')
    .where('role', '==', 'demo')
    .where('expiresAt', '<', now)
    .get();

  if (snap.empty) {
    console.log('No expired demo accounts. Nothing to do.');
    return;
  }

  console.log(`Found ${snap.size} expired demo account(s).`);

  for (const doc of snap.docs) {
    const uid = doc.id;
    try {
      // Delete the user doc first (rule-safe since admin SDK bypasses rules).
      await doc.ref.delete();
      console.log('  Deleted users/' + uid);

      // Best-effort: also delete the auth account so it doesn't pile up.
      try {
        await auth.deleteUser(uid);
        console.log('  Deleted auth uid ' + uid);
      } catch (authErr) {
        console.warn('  Could not delete auth uid', uid, '-', authErr.message);
      }
    } catch (err) {
      console.error('  Failed to delete', uid, '-', err.message);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
