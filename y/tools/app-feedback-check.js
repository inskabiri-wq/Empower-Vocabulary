#!/usr/bin/env node
'use strict';
/* ============================================================
   app-feedback-check.js - "Rate Lingualab": who can rate, and who can read it?
   ------------------------------------------------------------
   appFeedback/{uid} holds one rating per person (js/app-rating.js), read in
   Admin > Feedback (teacher/js/feedback-admin.js). The lines:

     1. you rate only as YOURSELF: your own uid, your own email, your real role
     2. stars are a whole 1-5; "what helps" chips come from the fixed list;
        the comment is bounded; nothing extra can be stored
     3. a demo account cannot rate
     4. an update keeps the first rating's date
     5. nobody but the owner and the admin can read a rating - not another
        student, not a teacher

   Plus a static check that the chip keys in js/app-rating.js are exactly the
   ones the rules accept, so no chip a user can tap is refused by the server.

   Real ID tokens against the emulator; writes via :commit with REQUEST_TIME
   transforms, exactly as serverTimestamp() does. Leaves the emulator as found.

   Usage:  node y/tools/push-rules.js && node y/tools/app-feedback-check.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const ROOT = 'projects/' + PROJECT + '/databases/(default)/documents';
const DOCS = 'http://' + FS + '/v1/' + ROOT;
const ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';

let pass = 0, fail = 0;
const failures = [];
const ok = (m) => { pass++; console.log('  ok    ' + m); };
const bad = (m, d) => { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); };
const expect = (label, got, want) => (got === want ? ok(label + ' (' + got + ')') : bad(label, 'got ' + got + ', expected ' + want));

// ── static: the chip lists agree ─────────────────────────────────────────
console.log('CHIP LISTS');
{
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
  const m = rules.match(/function\s+feedbackLikes\s*\(\)\s*\{\s*return\s*\[([^\]]*)\]/);
  const ruleKeys = m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app-rating.js'), 'utf8');
  const at = src.indexOf('var LIKES =');
  let appKeys = [];
  let studentKeys = [];
  if (at !== -1) {
    const open = src.indexOf('{', at);
    let depth = 0, j = open;
    for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
    const LIKES = new Function('return (' + src.slice(open, j + 1) + ');')();
    Object.keys(LIKES).forEach(role => LIKES[role].forEach(c => { if (appKeys.indexOf(c[0]) === -1) appKeys.push(c[0]); }));
    studentKeys = (LIKES.student || []).map(c => c[0]);
  }
  // The union above cannot see a chip dropped from ONE role: 'placement' was
  // teacher-only until 2026-09-24 and the union was 13 either way. The
  // students' list is checked on its own for the chips it must offer.
  const STUDENT_MUST = ['vocabulary', 'grammar', 'listening', 'reading', 'writing', 'speaking', 'classroom', 'courses', 'placement'];
  const lost = STUDENT_MUST.filter(k => studentKeys.indexOf(k) === -1);
  if (lost.length) bad('chips missing from the STUDENT list in js/app-rating.js', lost.join(', '));
  else ok('students are offered all ' + STUDENT_MUST.length + ' chips, Placement included');
  const missing = appKeys.filter(k => ruleKeys.indexOf(k) === -1);
  const unused = ruleKeys.filter(k => appKeys.indexOf(k) === -1);
  if (!ruleKeys.length || !appKeys.length) bad('could not read both chip lists', 'rules ' + ruleKeys.length + ', app ' + appKeys.length);
  else if (missing.length) bad('chips a user can tap that the rules REFUSE', missing.join(', '));
  else ok('every chip in js/app-rating.js is accepted by the rules (' + appKeys.length + ')');
  if (ruleKeys.length && appKeys.length && unused.length) bad('the rules accept chips nobody can tap', unused.join(', '));
  else if (ruleKeys.length && appKeys.length) ok('no chip in the rules is unreachable');
}

async function identity(adminSdk, email) {
  const post = async (ep, body) => (await fetch(
    'http://' + AUTH + '/identitytoolkit.googleapis.com/v1/' + ep + '?key=fake-api-key',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  let j = await post('accounts:signUp', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  if (!j.idToken && j.error && /EMAIL_EXISTS/.test(j.error.message || '')) {
    j = await post('accounts:signInWithPassword', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  }
  try { await adminSdk.auth().updateUser(j.localId, { emailVerified: true }); } catch (e) {}
  j = await post('accounts:signInWithPassword', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  return { uid: j.localId, token: j.idToken, email: email };
}

const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
const now = (f) => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' });

// create: full document, createdAt + updatedAt stamped by the server
function createW(p, data) {
  return { update: { name: ROOT + '/' + p, fields: fields(data) }, currentDocument: { exists: false },
           updateTransforms: [now('createdAt'), now('updatedAt')] };
}
// update: only the given fields, updatedAt stamped; createdAt left alone unless given
function updateW(p, data, transforms) {
  return { update: { name: ROOT + '/' + p, fields: fields(data) }, updateMask: { fieldPaths: Object.keys(data) },
           updateTransforms: transforms || [now('updatedAt')] };
}
async function commit(writes, token) {
  const r = await fetch(DOCS + ':commit', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ writes: writes }) });
  return r.status;
}
async function read(p, token) {
  return (await fetch(DOCS + '/' + p, { headers: { Authorization: 'Bearer ' + token } })).status;
}
async function list(token) {
  const r = await fetch(DOCS + ':runQuery', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'appFeedback' }] } }) });
  let body = null; try { body = await r.json(); } catch (e) {}
  return (!r.ok || (Array.isArray(body) && body.some(x => x && x.error))) ? 403 : 200;
}

function rating(who, extra) {
  return Object.assign({
    userId: who.uid, role: 'student', name: 'Test Student', email: who.email,
    studentClass: 'B125', level: 'B1', module: 'Module 4',
    stars: 4, liked: ['vocabulary', 'grammar'], comment: 'The listening exams are great.', page: 'student-dashboard.html'
  }, extra || {});
}

(async () => {
  let up = false;
  try { up = (await fetch('http://' + FS + '/')).status === 200; } catch (e) {}
  if (!up) { console.log('\n  skip  emulator not running'); process.exit(fail ? 1 : 0); }

  process.env.FIRESTORE_EMULATOR_HOST = FS;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;   // never production Auth
  process.env.GCLOUD_PROJECT = PROJECT;
  const admin = require(path.join(__dirname, '..', '..', 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();

  const stu = await identity(admin, 'zz.rate.student@stu.fsm.edu.tr');
  const other = await identity(admin, 'zz.rate.other@stu.fsm.edu.tr');
  const teacher = await identity(admin, 'zz.rate.teacher@fsm.edu.tr');
  const demo = await identity(admin, 'zz.rate.demo@fsm.edu.tr');
  const boss = await identity(admin, ADMIN_EMAIL);
  const all = [stu, other, teacher, demo, boss];

  // Leave the emulator as found (the admin account is shared with the seed).
  const before = {};
  for (const u of all) {
    const s = await db.collection('users').doc(u.uid).get();
    before[u.uid] = { user: s.exists ? s.data() : null,
                      fb: (await db.collection('appFeedback').doc(u.uid).get()).data() || null };
    await db.collection('appFeedback').doc(u.uid).delete().catch(() => {});
  }
  await db.collection('users').doc(stu.uid).set({ email: stu.email, role: 'student', studentClass: 'B125' });
  await db.collection('users').doc(other.uid).set({ email: other.email, role: 'student' });
  await db.collection('users').doc(teacher.uid).set({ email: teacher.email, role: 'teacher', assignedClasses: ['B125'] });
  await db.collection('users').doc(demo.uid).set({ email: demo.email, role: 'student', demoAccount: true });
  await db.collection('users').doc(boss.uid).set(Object.assign({}, before[boss.uid].user || {}, { email: boss.email, role: 'teacher' }));

  const P = (u) => 'appFeedback/' + u.uid;

  console.log('\nRATING');
  expect('a student rates as themselves', await commit([createW(P(stu), rating(stu))], stu.token), 200);
  expect('...and can change it later', await commit([updateW(P(stu), { stars: 5, comment: 'Even better now.' })], stu.token), 200);
  // Placement was a teacher-only chip until 2026-09-24. An update of stu's own
  // doc, not a create for 'other': the 403 creates below must fail for their
  // own reason, not because a doc already exists.
  expect('a student can pick Placement', await commit([updateW(P(stu), { liked: ['vocabulary', 'placement'] })], stu.token), 200);
  expect('a teacher rates as a teacher', await commit([createW(P(teacher), rating(teacher, { role: 'teacher', name: 'T', studentClass: '', level: '', module: '', liked: ['assignments', 'writingai'] }))], teacher.token), 200);
  expect('a student CANNOT write a rating under another uid', await commit([createW(P(other), rating(other))], stu.token), 403);
  expect('a DEMO account cannot rate', await commit([createW(P(demo), rating(demo))], demo.token), 403);
  expect('a student CANNOT pose as a teacher', await commit([createW(P(other), rating(other, { role: 'teacher' }))], other.token), 403);
  expect('the email must be the rater\'s own', await commit([createW(P(other), rating(other, { email: 'someone@stu.fsm.edu.tr' }))], other.token), 403);
  expect('0 stars is refused', await commit([createW(P(other), rating(other, { stars: 0 }))], other.token), 403);
  expect('6 stars is refused', await commit([createW(P(other), rating(other, { stars: 6 }))], other.token), 403);
  expect('half a star is refused', await commit([createW(P(other), rating(other, { stars: 3.5 }))], other.token), 403);
  expect('an unknown "what helps" chip is refused', await commit([createW(P(other), rating(other, { liked: ['vocabulary', 'free-pizza'] }))], other.token), 403);
  expect('a comment over 1000 characters is refused', await commit([createW(P(other), rating(other, { comment: new Array(1002).join('x') }))], other.token), 403);
  expect('an extra field cannot be smuggled in', await commit([createW(P(other), rating(other, { isFeatured: true }))], other.token), 403);
  expect('an update cannot rewrite the first rating\'s date',
    await commit([updateW(P(stu), { createdAt: new Date('2020-01-01') }, [now('updatedAt')])], stu.token), 403);
  expect('an update cannot set updatedAt to any time it likes',
    await commit([updateW(P(stu), { stars: 3, updatedAt: new Date('2099-01-01') }, [])], stu.token), 403);

  console.log('\nREADING');
  expect('you can read your own rating', await read(P(stu), stu.token), 200);
  expect('another student CANNOT read it', await read(P(stu), other.token), 403);
  expect('a teacher CANNOT read a student\'s rating', await read(P(stu), teacher.token), 403);
  expect('the admin reads it', await read(P(stu), boss.token), 200);
  expect('the admin can list every rating (Admin > Feedback)', await list(boss.token), 200);
  expect('a student CANNOT list the ratings', await list(stu.token), 403);
  expect('a teacher CANNOT list the ratings', await list(teacher.token), 403);

  // ── restore ──
  for (const u of all) {
    const b = before[u.uid];
    if (b.user) await db.collection('users').doc(u.uid).set(b.user); else await db.collection('users').doc(u.uid).delete().catch(() => {});
    if (b.fb) await db.collection('appFeedback').doc(u.uid).set(b.fb); else await db.collection('appFeedback').doc(u.uid).delete().catch(() => {});
  }

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
    failures.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('PASS - ' + pass + ' app-feedback checks.');
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(2); });
