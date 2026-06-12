/* ============================================================
   backfill-session-scope.js
   ONE-TIME migration for Phase B (per-doc teacher access).

   Adds studentClass / studentLevel / studentModule onto every
   existing /sessions document by reading the matching student's
   /users doc. New sessions written after the Phase B deploy
   already have these fields stamped at write time; this script
   covers the legacy backlog so non-admin teachers don't see
   "missing sessions" after the rules deploy.

   Run:
     cd E:\vocab-trainer\y
     node tools/backfill-session-scope.js

   Requires tools/.serviceAccount.json (same as the other admin
   scripts). Re-runnable safely — skips sessions already stamped.
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
  console.error('See create-demo-accounts.js for setup instructions.');
  process.exit(1);
}

const db = admin.firestore();

async function main() {
  console.log('Backfilling session scope fields...');
  console.log('');

  // Cache user docs to avoid one get() per session
  const userCache = new Map();
  async function getUser(uid) {
    if (userCache.has(uid)) return userCache.get(uid);
    try {
      const snap = await db.collection('users').doc(uid).get();
      const data = snap.exists ? snap.data() : null;
      userCache.set(uid, data);
      return data;
    } catch (err) {
      console.warn(`  Could not load user ${uid}: ${err.message}`);
      userCache.set(uid, null);
      return null;
    }
  }

  // Iterate sessions in batches via paginated cursor to keep memory
  // bounded for large collections.
  const BATCH_SIZE = 500;
  let cursor = null;
  let counters = {
    scanned: 0,
    alreadyStamped: 0,
    stamped: 0,
    noUser: 0,
    failed: 0
  };

  while (true) {
    let q = db.collection('sessions').orderBy('__name__').limit(BATCH_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    const writer = db.batch();
    let pending = 0;

    for (const doc of snap.docs) {
      counters.scanned++;
      const data = doc.data() || {};

      // Already stamped — Phase B fields exist with non-empty strings
      // or the studentClass is at least defined (could be '' for users
      // who haven't filled it). We treat presence of the key as "done".
      if ('studentClass' in data && 'studentLevel' in data && 'studentModule' in data) {
        counters.alreadyStamped++;
        cursor = doc;
        continue;
      }

      if (!data.userId) {
        counters.noUser++;
        cursor = doc;
        continue;
      }

      const user = await getUser(data.userId);
      if (!user) {
        // Student account was deleted. Stamp empty so the doc isn't
        // re-scanned next run; non-admin teachers will not be able to
        // read it (correct — no owner).
        writer.update(doc.ref, {
          studentClass:  '',
          studentLevel:  '',
          studentModule: ''
        });
        counters.stamped++;
        pending++;
        cursor = doc;
        continue;
      }

      writer.update(doc.ref, {
        studentClass:  user.studentClass  || '',
        studentLevel:  user.level         || '',
        studentModule: user.module        || ''
      });
      counters.stamped++;
      pending++;
      cursor = doc;
    }

    if (pending > 0) {
      try {
        await writer.commit();
      } catch (err) {
        counters.failed += pending;
        counters.stamped -= pending;
        console.error(`  Batch commit failed: ${err.message}`);
      }
    }

    if (snap.size < BATCH_SIZE) break;  // last page
  }

  console.log('');
  console.log('Done.');
  console.log('  Sessions scanned:        ', counters.scanned);
  console.log('  Already stamped:         ', counters.alreadyStamped);
  console.log('  Newly stamped:           ', counters.stamped);
  console.log('  Skipped (no userId):     ', counters.noUser);
  console.log('  Failed:                  ', counters.failed);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
