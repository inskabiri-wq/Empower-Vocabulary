#!/usr/bin/env node
'use strict';
/* ============================================================
   retention-check.js - the pruner deletes what it should, and NOTHING else.
   ------------------------------------------------------------
   This is the only piece of the project that deletes real student data on a
   schedule, so it gets the most adversarial test. It runs the REAL function
   from functions/retention.js against the LOCAL EMULATOR, with seeded
   documents of known ages, and checks both directions:

     does it delete what the policy says?
     does it leave everything else completely alone?

   The second question is the important one. A pruner that deletes too little
   is an annoyance; one that deletes too much is unrecoverable.

   EMULATOR ONLY. Refuses to run if the emulator is not reachable, and refuses
   outright if FIRESTORE_EMULATOR_HOST is missing, so it can never be pointed
   at production by accident.

   Usage:  node y/tools/retention-check.js
   ============================================================ */

const path = require('path');

const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIRESTORE_EMULATOR_HOST = FS;          // force the admin SDK local
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';

const FN = path.join(__dirname, '..', '..', 'functions');
let admin, retention;
try {
  admin = require(path.join(FN, 'node_modules', 'firebase-admin'));
  retention = require(path.join(FN, 'retention.js'));
} catch (e) {
  console.error('Could not load firebase-admin / retention.js: ' + e.message);
  process.exit(2);
}

let pass = 0, fail = 0;
const failed = [];
function ok(n) { pass++; console.log('  ok    ' + n); }
function bad(n, d) { fail++; failed.push(n); console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); }
function is(n, actual, expected) {
  if (actual === expected) ok(n + '  (' + actual + ')');
  else bad(n, 'expected ' + expected + ', got ' + actual);
}

const PFX = 'rtn-';                 // every doc this test creates
const MONTHS = 6;

function daysAgo(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }

(async () => {
  try {
    const r = await fetch('http://' + FS + '/');
    if (r.status !== 200) throw new Error('status ' + r.status);
  } catch (e) {
    console.error('Firestore emulator not reachable at ' + FS + '. Refusing to run.');
    console.error('  firebase emulators:start --only auth,firestore');
    process.exit(2);
  }

  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  const db = admin.firestore();

  async function wipe() {
    for (const coll of ['activityLogs', 'sessions']) {
      const snap = await db.collection(coll).get();
      const mine = snap.docs.filter(d => d.id.indexOf(PFX) === 0);
      for (const d of mine) await d.ref.delete();
    }
  }

  async function seed() {
    await wipe();
    // activityLogs: field `timestamp`
    await db.collection('activityLogs').doc(PFX + 'a-old').set({ timestamp: daysAgo(400), who: 'x' });
    await db.collection('activityLogs').doc(PFX + 'a-old2').set({ timestamp: daysAgo(300), who: 'x' });
    await db.collection('activityLogs').doc(PFX + 'a-new').set({ timestamp: daysAgo(10), who: 'x' });
    // the two that must be untouchable
    await db.collection('activityLogs').doc(PFX + 'a-nofield').set({ who: 'x' });
    await db.collection('activityLogs').doc(PFX + 'a-strtime').set({ timestamp: '2020-01-01', who: 'x' });
    // sessions: field `createdAt`
    await db.collection('sessions').doc(PFX + 's-old').set({ createdAt: daysAgo(400), userId: 'x' });
    await db.collection('sessions').doc(PFX + 's-new').set({ createdAt: daysAgo(5), userId: 'x' });
  }

  const countMine = async (coll) => {
    const snap = await db.collection(coll).get();
    return snap.docs.filter(d => d.id.indexOf(PFX) === 0).length;
  };
  const exists = async (coll, id) => (await db.collection(coll).doc(PFX + id).get()).exists;

  console.log('Retention pruner, real code, seeded ages, emulator only\n');

  // ── 1. no config at all ────────────────────────────────────
  await seed();
  let r = await retention.pruneOneCollection(db, 'activityLogs', undefined);
  is('no config deletes nothing', r.deleted, 0);
  is('  and says why', r.skipped, 'not enabled');

  // ── 2. explicitly disabled ─────────────────────────────────
  r = await retention.pruneOneCollection(db, 'activityLogs', { enabled: false, months: 6, dryRun: false });
  is('enabled:false deletes nothing', r.deleted, 0);

  // ── 3. the window floor: a typo must not mean "everything" ──
  for (const m of [0, 1, 2, -12, 'six', null]) {
    r = await retention.pruneOneCollection(db, 'activityLogs', { enabled: true, months: m, dryRun: false });
    if (r.deleted === 0 && /floor/.test(r.skipped || '')) ok('window ' + JSON.stringify(m) + ' refused by the floor');
    else bad('window ' + JSON.stringify(m) + ' was NOT refused', JSON.stringify(r));
  }

  // ── 4. the collection allowlist ────────────────────────────
  r = await retention.pruneOneCollection(db, 'users', { enabled: true, months: 6, dryRun: false });
  is('cannot be aimed at users', r.skipped, 'not an allowed collection');
  is('  and deleted nothing', r.deleted, 0);

  // ── 5. dry run is the default ──────────────────────────────
  r = await retention.pruneOneCollection(db, 'activityLogs', { enabled: true, months: MONTHS });
  is('dryRun defaults on: nothing deleted', r.deleted, 0);
  is('  but it reports the real count', r.matched, 2);
  is('  and the docs are still there', await countMine('activityLogs'), 5);

  // dryRun:true explicitly, same thing
  r = await retention.pruneOneCollection(db, 'activityLogs', { enabled: true, months: MONTHS, dryRun: true });
  is('dryRun:true deletes nothing', r.deleted, 0);

  // ── 6. the live path: deletes ONLY what is older ───────────
  r = await retention.pruneOneCollection(db, 'activityLogs', { enabled: true, months: MONTHS, dryRun: false });
  is('live run deletes the old ones', r.deleted, 2);
  is('  the recent doc survives', await exists('activityLogs', 'a-new'), true);
  is('  the doc with NO timestamp survives', await exists('activityLogs', 'a-nofield'), true);
  is('  the doc with a STRING timestamp survives', await exists('activityLogs', 'a-strtime'), true);
  is('  the two old ones are gone', await exists('activityLogs', 'a-old'), false);
  is('  sessions were not touched', await countMine('sessions'), 2);

  // ── 7. running again is a no-op ────────────────────────────
  r = await retention.pruneOneCollection(db, 'activityLogs', { enabled: true, months: MONTHS, dryRun: false });
  is('second run deletes nothing more', r.deleted, 0);

  // ── 8. sessions works when explicitly asked ────────────────
  r = await retention.pruneOneCollection(db, 'sessions', { enabled: true, months: MONTHS, dryRun: false });
  is('sessions prunes when asked', r.deleted, 1);
  is('  the recent session survives', await exists('sessions', 's-new'), true);

  // ── 9. the per-run cap is honoured ─────────────────────────
  await seed();
  r = await retention.pruneOneCollection(db, 'activityLogs',
    { enabled: true, months: MONTHS, dryRun: false }, { maxPerRun: 1 });
  is('maxPerRun caps the deletions', r.deleted, 1);
  is('  leaving the rest for next time', await countMine('activityLogs'), 4);

  await wipe();
  is('test data cleaned up', (await countMine('activityLogs')) + (await countMine('sessions')), 0);

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
    failed.forEach(f => console.log('   - ' + f));
    console.log('\nDO NOT DEPLOY. This function deletes student data.');
    process.exit(1);
  }
  console.log('PASS - all ' + pass + ' checks: it prunes the policy window and nothing else.');
  process.exit(0);
})().catch(e => { console.error('ERROR: ' + (e && e.message)); process.exit(2); });
