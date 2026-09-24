#!/usr/bin/env node
'use strict';
/* ============================================================
   prod-profile.js - READ ONLY profile of the live database.
   ------------------------------------------------------------
   The one benchmark track that never ran. Answers: how much data is really
   there, which collections grow without bound, and what the monthly read cost
   actually is rather than a formula with an unknown in it.

   STRICTLY READ ONLY. It calls .count() and .get() and nothing else. There is
   a guard below that greps this file's own source for mutation methods and
   refuses to run if any are present, so the promise is enforced rather than
   asserted. Real student data is on the other end of this.

   Requires tools/.serviceAccount.json (note: NOT .json.json - that double
   extension was why the admin tools could not find the key).

   Usage:  node y/tools/prod-profile.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

// ── The read-only guard, enforced on this file's own source ──
const SELF = fs.readFileSync(__filename, 'utf8');
const BANNED = ['.set(', '.update(', '.add(', '.delete(', '.create(',
  '.batch(', '.commit(', 'runTransaction', 'setCustomUserClaims',
  'updateUser', 'deleteUser', 'createUser'];
const guardBody = SELF.slice(SELF.indexOf('// ---- profile starts here ----'));
const found = BANNED.filter(b => guardBody.indexOf(b) !== -1);
if (found.length) {
  console.error('REFUSING TO RUN: this file contains mutation calls: ' + found.join(', '));
  process.exit(2);
}

const KEY = path.join(__dirname, '.serviceAccount.json');
if (!fs.existsSync(KEY)) {
  console.error('Missing ' + KEY);
  console.error('If you have .serviceAccount.json.json, rename it (drop the second .json).');
  process.exit(2);
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST is set. Unset it: this profiles PRODUCTION.');
  process.exit(2);
}

let admin;
try { admin = require(path.join(__dirname, '..', '..', 'functions', 'node_modules', 'firebase-admin')); }
catch (e) { console.error('Could not load firebase-admin from functions/node_modules: ' + e.message); process.exit(2); }

// ---- profile starts here ----
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const COLLECTIONS = [
  'users', 'sessions', 'settings', 'courseProgress', 'certificates',
  'activityLogs', 'assignments', 'assignmentCompletions', 'writingSubmissions',
  'aiUsage', 'accessAudit', 'placementResults', 'gameReports',
  'classroom_sessions', 'heist_sessions', 'trust_sessions', 'tug_sessions',
  'bingo_sessions', 'scramble_sessions', 'aiquiz_sessions',
  'reading_sessions', 'listening_sessions',
  'modules', 'classes', 'enrollments', 'importRuns'
];

// Grows with every student action, so it never stops growing on its own.
const UNBOUNDED = new Set([
  'sessions', 'activityLogs', 'assignmentCompletions', 'writingSubmissions',
  'aiUsage', 'accessAudit', 'gameReports', 'certificates', 'courseProgress'
]);

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }

(async () => {
  console.log('Lingualab production profile  (READ ONLY)\n');
  const counts = {};
  let total = 0;

  console.log(pad('collection', 26) + pad('docs', 10) + 'grows with use');
  console.log('-'.repeat(56));
  for (const c of COLLECTIONS) {
    let n = null;
    try {
      const agg = await db.collection(c).count().get();
      n = agg.data().count;
    } catch (e) {
      n = 'ERR ' + (e.code || e.message || '').toString().slice(0, 18);
    }
    counts[c] = n;
    if (typeof n === 'number') total += n;
    console.log(pad(c, 26) + pad(n, 10) + (UNBOUNDED.has(c) ? 'YES' : ''));
  }
  console.log('-'.repeat(56));
  console.log(pad('TOTAL', 26) + pad(total, 10));

  // The two listeners that read a whole collection on every teacher dashboard
  // open. This is the number the cost estimate was missing.
  const comp = counts['assignmentCompletions'];
  const subs = counts['writingSubmissions'];
  if (typeof comp === 'number' && typeof subs === 'number') {
    const perOpen = comp + subs;
    const opens = 27 * 5 * 20;              // 27 teachers, 5 opens/day, 20 days
    const reads = perOpen * opens;
    const usd = (reads / 100000) * 0.06;
    console.log('\nTeacher dashboard, the two whole-collection listeners');
    console.log('  docs delivered per dashboard open : ' + perOpen);
    console.log('  opens per month (27 x 5 x 20)     : ' + opens);
    console.log('  reads per month                   : ' + reads.toLocaleString());
    console.log('  cost per month at 0.06 USD/100k   : ' + usd.toFixed(2) + ' USD');
  }

  // Auth totals, paged, read only.
  try {
    let users = 0, page;
    do {
      const res = await admin.auth().listUsers(1000, page);
      users += res.users.length;
      page = res.pageToken;
    } while (page);
    console.log('\nAuth accounts: ' + users);
  } catch (e) {
    console.log('\nAuth accounts: ERR ' + (e.code || e.message));
  }

  console.log('\nDone. Nothing was written.');
  process.exit(0);
})().catch(e => { console.error('ERROR: ' + (e && e.message)); process.exit(1); });
