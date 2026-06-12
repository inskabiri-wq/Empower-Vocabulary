/* ============================================================
   backfill-assignment-skill.js
   ONE-TIME migration for Phase 1 of the skill-based assignment
   system. Stamps every existing /assignments doc that lacks a
   `skill` field with `skill: 'vocabulary'` — because every
   assignment created before this phase was a vocabulary one.

   Run once:
     cd E:\vocab-trainer\y
     node tools/backfill-assignment-skill.js

   Requires tools/.serviceAccount.json (same setup as the other
   admin scripts). Re-runnable: skips docs that already have skill.
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
  console.log('Backfilling assignment.skill...');
  console.log('');

  const snap = await db.collection('assignments').get();
  console.log(`Scanning ${snap.size} assignment doc(s)...`);

  let counters = {
    scanned: 0,
    alreadyHasSkill: 0,
    stamped: 0,
    failed: 0
  };

  // Use a write batch for efficiency (max 500 ops per batch).
  let writer = db.batch();
  let pending = 0;
  const FLUSH_AT = 400;

  for (const doc of snap.docs) {
    counters.scanned++;
    const data = doc.data() || {};
    if ('skill' in data && data.skill) {
      counters.alreadyHasSkill++;
      continue;
    }
    writer.update(doc.ref, { skill: 'vocabulary' });
    pending++;
    counters.stamped++;
    if (pending >= FLUSH_AT) {
      try { await writer.commit(); }
      catch (err) { counters.failed += pending; counters.stamped -= pending; console.error('Batch commit failed:', err.message); }
      writer = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) {
    try { await writer.commit(); }
    catch (err) { counters.failed += pending; counters.stamped -= pending; console.error('Final commit failed:', err.message); }
  }

  console.log('');
  console.log('Done.');
  console.log('  Scanned:           ', counters.scanned);
  console.log('  Already had skill: ', counters.alreadyHasSkill);
  console.log("  Stamped 'vocabulary':", counters.stamped);
  console.log('  Failed:            ', counters.failed);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
