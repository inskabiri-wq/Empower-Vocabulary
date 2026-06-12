/* ============================================================
   backfill-assignment-owner.js
   ONE-TIME migration for the Phase E security pass:
     Adds `teacherId` onto every existing /assignments document
     that doesn't already carry one.

   Background:
     The hardened firestore.rules require teacherId to match the
     editor's uid on update/delete. Legacy docs without teacherId
     are grandfathered (anyone can edit them) for backward compat.
     This script stamps teacherId on those legacy docs so the
     grandfather clause becomes a no-op in practice — every doc
     is owned by someone after we run this.

   Resolution order for each legacy doc:
     1. teacherEmail field present  → look up user by email → uid
     2. teacherName field present   → look up user by displayName → uid
     3. Fallback                    → admin's uid (akabiriaslifar@…)

   Run:
     cd E:\vocab-trainer\y
     node tools/backfill-assignment-owner.js

   Requires tools/.serviceAccount.json (same as the other admin
   scripts). Re-runnable safely — skips docs already stamped.
   ============================================================ */

const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '.serviceAccount.json');
const ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';

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
const auth = admin.auth();

// In-memory cache so we don't re-query the same email/name repeatedly.
const emailCache = new Map();   // email -> uid (or null if not found)
const nameCache  = new Map();   // name  -> uid (or null if not found)

async function uidFromEmail(email) {
  if (!email) return null;
  const key = String(email).trim().toLowerCase();
  if (emailCache.has(key)) return emailCache.get(key);
  try {
    const rec = await auth.getUserByEmail(key);
    emailCache.set(key, rec.uid);
    return rec.uid;
  } catch (_) {
    emailCache.set(key, null);
    return null;
  }
}

async function uidFromName(name) {
  if (!name) return null;
  const key = String(name).trim();
  if (nameCache.has(key)) return nameCache.get(key);
  // Auth has no direct "find user by displayName" — search the users
  // collection by `name` field instead. Only takes the first match
  // (displayName isn't guaranteed unique).
  try {
    const snap = await db.collection('users')
      .where('name', '==', key)
      .limit(1)
      .get();
    const uid = snap.empty ? null : snap.docs[0].id;
    nameCache.set(key, uid);
    return uid;
  } catch (_) {
    nameCache.set(key, null);
    return null;
  }
}

async function main() {
  console.log('Backfilling assignment ownership (teacherId)...');
  console.log('');

  // Resolve admin uid up front — used as the fallback owner.
  let adminUid = null;
  try {
    const adminRec = await auth.getUserByEmail(ADMIN_EMAIL);
    adminUid = adminRec.uid;
    console.log(`  Admin uid: ${adminUid}`);
  } catch (err) {
    console.error(`  Could not resolve admin email ${ADMIN_EMAIL}: ${err.message}`);
    console.error('  Aborting — backfill requires a fallback owner.');
    process.exit(1);
  }

  const BATCH_SIZE = 500;
  let cursor = null;
  const counters = {
    scanned:        0,
    alreadyStamped: 0,
    fromEmail:      0,
    fromName:       0,
    fromFallback:   0,
    failed:         0
  };

  while (true) {
    let q = db.collection('assignments').orderBy('__name__').limit(BATCH_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;

    const writer = db.batch();
    let pending = 0;

    for (const doc of snap.docs) {
      counters.scanned++;
      const data = doc.data() || {};
      cursor = doc;

      // Already owned — nothing to do. Treat empty string / null as
      // "not stamped" so old half-migrations get cleaned up.
      if (data.teacherId && String(data.teacherId).trim()) {
        counters.alreadyStamped++;
        continue;
      }

      // Try in order: email → name → admin fallback.
      let resolvedUid = null;
      let source = null;

      if (data.teacherEmail) {
        resolvedUid = await uidFromEmail(data.teacherEmail);
        if (resolvedUid) source = 'email';
      }
      if (!resolvedUid && data.teacherName) {
        resolvedUid = await uidFromName(data.teacherName);
        if (resolvedUid) source = 'name';
      }
      if (!resolvedUid) {
        resolvedUid = adminUid;
        source = 'fallback';
      }

      writer.update(doc.ref, { teacherId: resolvedUid });
      pending++;
      if (source === 'email')    counters.fromEmail++;
      if (source === 'name')     counters.fromName++;
      if (source === 'fallback') counters.fromFallback++;

      console.log(`  ${doc.id}  →  ${source} (${resolvedUid})`);
    }

    if (pending > 0) {
      try {
        await writer.commit();
      } catch (err) {
        counters.failed += pending;
        counters.fromEmail = Math.max(0, counters.fromEmail - pending);
        console.error(`  Batch commit failed: ${err.message}`);
      }
    }

    if (snap.size < BATCH_SIZE) break;
  }

  console.log('');
  console.log('Done.');
  console.log('  Assignments scanned:     ', counters.scanned);
  console.log('  Already stamped:         ', counters.alreadyStamped);
  console.log('  Resolved by email:       ', counters.fromEmail);
  console.log('  Resolved by name:        ', counters.fromName);
  console.log('  Fallback to admin:       ', counters.fromFallback);
  console.log('  Failed:                  ', counters.failed);
  console.log('');
  console.log('Next step: update firestore.rules to drop the grandfather');
  console.log('clause in _ownsAssignment() if all assignments are now stamped.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
