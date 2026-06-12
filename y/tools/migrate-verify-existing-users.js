/* ============================================================
   migrate-verify-existing-users.js

   ONE-TIME migration. Marks emailVerified=true for every Firebase
   Auth user whose Firestore user doc was created BEFORE the cutoff
   date below. This fixes the existing-user lockout caused by
   today's introduction of the email-verification gate (existing
   accounts never went through the verification flow when they
   registered, so their emailVerified flag is false).

   Safe properties:
     - Only verifies users with a Firestore user doc whose
       createdAt < VERIFY_USERS_CREATED_BEFORE.
     - Only verifies users on @fsm.edu.tr or @stu.fsm.edu.tr.
     - Skips users who are already verified.
     - Re-runnable: doing nothing for users it has already
       processed.

   Run:
     cd E:\vocab-trainer\y
     node tools/migrate-verify-existing-users.js

   Requires the same tools/.serviceAccount.json as the other
   admin scripts.
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

// ============================================================
// CUTOFF — only users whose Firestore doc was created before this
// date are auto-verified. Set it to roughly when today's deploy
// happened, so that any NEW registrations after that still have
// to go through the normal email-verification flow.
// ============================================================
const VERIFY_USERS_CREATED_BEFORE = new Date('2026-05-11T23:59:59Z');

// Domains we'll auto-verify. Anything outside this list is skipped
// (defensive — we don't auto-verify random emails).
const ALLOWED_DOMAINS = ['@fsm.edu.tr', '@stu.fsm.edu.tr'];

function isAllowedDomain(email) {
  if (!email) return false;
  const e = String(email).toLowerCase().trim();
  return ALLOWED_DOMAINS.some(d => e.endsWith(d));
}

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  console.log('Migration starting.');
  console.log('Cutoff (verify users created before):', VERIFY_USERS_CREATED_BEFORE.toISOString());
  console.log('');

  const snap = await db.collection('users').get();
  console.log(`Scanning ${snap.size} Firestore user doc(s)...`);

  let counters = {
    verified: 0,
    alreadyVerified: 0,
    skippedDomain: 0,
    skippedAfterCutoff: 0,
    skippedNoEmail: 0,
    skippedMissingAuth: 0,
    failed: 0,
  };

  for (const doc of snap.docs) {
    const uid = doc.id;
    const data = doc.data() || {};
    const email = data.email;
    const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null;

    // Demo accounts already created with verified=true; skip.
    if (data.role === 'demo') continue;

    if (!email) {
      counters.skippedNoEmail++;
      continue;
    }

    if (!isAllowedDomain(email)) {
      counters.skippedDomain++;
      console.log(`  skip (non-FSM domain): ${email}`);
      continue;
    }

    if (createdAt && createdAt > VERIFY_USERS_CREATED_BEFORE) {
      counters.skippedAfterCutoff++;
      // No log line — new accounts are expected to go through the
      // normal verification flow.
      continue;
    }

    // Look up auth record.
    let authRec;
    try {
      authRec = await auth.getUser(uid);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        counters.skippedMissingAuth++;
        console.log(`  skip (auth record missing): ${email}`);
        continue;
      }
      throw err;
    }

    if (authRec.emailVerified) {
      counters.alreadyVerified++;
      continue;
    }

    try {
      await auth.updateUser(uid, { emailVerified: true });
      counters.verified++;
      console.log(`  verified: ${email}`);
    } catch (err) {
      counters.failed++;
      console.error(`  FAILED for ${email}: ${err.message}`);
    }
  }

  console.log('');
  console.log('Done.');
  console.log('  Newly verified:        ', counters.verified);
  console.log('  Already verified:      ', counters.alreadyVerified);
  console.log('  Skipped (after cutoff):', counters.skippedAfterCutoff);
  console.log('  Skipped (non-FSM):     ', counters.skippedDomain);
  console.log('  Skipped (no email):    ', counters.skippedNoEmail);
  console.log('  Skipped (no auth rec): ', counters.skippedMissingAuth);
  console.log('  Failed:                ', counters.failed);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
