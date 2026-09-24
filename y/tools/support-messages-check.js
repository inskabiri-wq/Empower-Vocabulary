#!/usr/bin/env node
'use strict';
/* ============================================================
   support-messages-check.js - who can write, read and answer a message?
   ------------------------------------------------------------
   supportMessages are threads between a student and a teacher OR the admin.
   The student picks the recipient. The rules have to hold these lines:

     1. a student writes ONLY their own message, with a known recipient, topic
        and `when`, and cannot pre-fill any of the answer bookkeeping
     2. a DEMO account cannot file or reply
     3. a message addressed to the ADMIN is never readable by a teacher - a
        student may be writing about their teacher
     4. every reply is signed by the account that wrote it, under its REAL role,
        so "Answered by" cannot be forged on anyone's screen
     5. what the student wrote, and every reply, is immutable
     6. the student may mark an answer read and may re-open by replying, but
        may not mark it answered or bend the counters
     7. the SIGN-IN PAGE writes signed out, in one exact shape, to the admin
        only. Nobody signed out and no teacher can read it back; the admin
        can, and later so can the account whose VERIFIED email was typed -
        with exactly the author's rights from 6. An unverified account with
        that email cannot.

   Real ID tokens against the emulator, so the shipped rules are what is
   tested. Writes go through :commit with REQUEST_TIME transforms, exactly as
   serverTimestamp() and increment() do in the browser - so the createdAt /
   lastReplyAt / replyCount checks are exercised, not skipped.

   Usage:  node y/tools/support-messages-check.js   (Firestore + Auth emulators)
   ============================================================ */
const path = require('path');
const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const ROOT = 'projects/' + PROJECT + '/databases/(default)/documents';
const DOCS = 'http://' + FS + '/v1/' + ROOT;
const ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';

// A suffix per run, so a crashed earlier run cannot leave documents that turn
// a create test into "already exists" instead of the verdict being tested.
const RUN = 'r' + Date.now().toString(36);

let pass = 0, fail = 0;
const failures = [];
const ok = (m) => { pass++; console.log('  ok    ' + m); };
const bad = (m, d) => { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); };
function expect(label, got, want) {
  if (got === want) ok(label + ' (' + got + ')');
  else bad(label, 'got ' + got + ', expected ' + want);
}

// The email_verified CLAIM has to be in the token, because
// canWriteAsRealUser() -> isVerifiedFsm() reads it there. A self-service
// accounts:update does NOT set it; the Admin SDK does, and only a sign-in
// AFTER that carries the claim.
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
  const claims = JSON.parse(Buffer.from(j.idToken.split('.')[1], 'base64').toString());
  if (claims.email_verified !== true) {
    console.log('  !!    could not verify ' + email + ' - positives for it will fail for that reason');
  }
  return { uid: j.localId, token: j.idToken, email: email };
}

// The same, but left UNVERIFIED on purpose: someone who registered with an
// address they do not own. The account may survive from an earlier run, so it
// is marked unverified explicitly and signed in again for a token saying so.
async function unverifiedIdentity(adminSdk, email) {
  const post = async (ep, body) => (await fetch(
    'http://' + AUTH + '/identitytoolkit.googleapis.com/v1/' + ep + '?key=fake-api-key',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  let j = await post('accounts:signUp', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  if (!j.idToken && j.error && /EMAIL_EXISTS/.test(j.error.message || '')) {
    j = await post('accounts:signInWithPassword', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  }
  try { await adminSdk.auth().updateUser(j.localId, { emailVerified: false }); } catch (e) {}
  j = await post('accounts:signInWithPassword', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  const claims = JSON.parse(Buffer.from(j.idToken.split('.')[1], 'base64').toString());
  if (claims.email_verified === true) {
    console.log('  !!    ' + email + ' is still verified - its negatives prove nothing');
  }
  return { uid: j.localId, token: j.idToken, email: email };
}

// A leftover anonymous session (the classroom games sign in anonymously), which
// the sign-in page may still have attached when someone writes from it.
async function anonymousIdentity() {
  const r = await fetch('http://' + AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  const j = await r.json();
  const claims = JSON.parse(Buffer.from(j.idToken.split('.')[1], 'base64').toString());
  if (!claims.firebase || claims.firebase.sign_in_provider !== 'anonymous') {
    console.log('  !!    the anonymous token does not say sign_in_provider anonymous');
  }
  return { uid: j.localId, token: j.idToken, email: '' };
}

// Signed out = no Authorization header at all, exactly what the sign-in page
// sends. (A token of null must not become "Bearer null".)
const authHeaders = (token, extra) => Object.assign({}, extra || {}, token ? { Authorization: 'Bearer ' + token } : {});

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

// ── write shapes, as the browser SDK sends them ─────────────────────────────
const now = (f) => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' });
const plusOne = (f) => ({ fieldPath: f, increment: { integerValue: '1' } });

function createW(p, data, transforms) {
  return {
    update: { name: ROOT + '/' + p, fields: fields(data) },
    currentDocument: { exists: false },
    updateTransforms: transforms || [now('createdAt')]
  };
}
function patchW(p, data, transforms) {
  return {
    update: { name: ROOT + '/' + p, fields: fields(data) },
    updateMask: { fieldPaths: Object.keys(data) },
    updateTransforms: transforms || []
  };
}

async function commit(writes, token) {
  const r = await fetch(DOCS + ':commit', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ writes: writes })
  });
  return r.status;
}
async function read(p, token) {
  const r = await fetch(DOCS + '/' + p, { headers: authHeaders(token) });
  return r.status;
}
// A LIST query is judged differently from a get: Firestore must prove the rule
// for every document the query COULD return. This is what the teacher inbox
// and the student's "your messages" actually run.
async function query(parent, sq, token) {
  const r = await fetch(DOCS + (parent ? '/' + parent : '') + ':runQuery', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ structuredQuery: sq })
  });
  let body = null;
  try { body = await r.json(); } catch (e) {}
  const denied = !r.ok || (Array.isArray(body) && body.some(x => x && x.error)) || (body && body.error);
  return denied ? 403 : 200;
}
const eq = (f, v) => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: enc(v) } });
const and = (...fs) => ({ compositeFilter: { op: 'AND', filters: fs } });

function msg(uid, extra) {
  return Object.assign({
    userId: uid,
    name: 'Test Student',
    email: 'zz.support.student@stu.fsm.edu.tr',
    studentClass: 'B125',
    level: 'B1',
    module: 'Module 4',
    to: 'teacher',
    topic: 'lesson',
    when: 'today',
    message: 'I do not understand question 3 of the homework.',
    status: 'open'
  }, extra || {});
}
function reply(who, role, text) {
  return { text: text || 'Here is the answer.', authorUid: who.uid, authorName: 'Someone', authorEmail: who.email, authorRole: role };
}

// A sign-in page message exactly as js/signin-support.js writes it: every
// field present (the rules demand all of them), name and email as typed.
const SIGNIN_EMAIL = 'zz.support.signin@stu.fsm.edu.tr';
const UNVERIFIED_EMAIL = 'zz.support.unverified@stu.fsm.edu.tr';
function signinMsg(extra) {
  return Object.assign({
    source: 'signin',
    name: 'Sign-in Visitor',
    email: SIGNIN_EMAIL,
    to: 'admin',
    topic: 'account',
    when: 'today',
    device: 'Android phone - Chrome',
    page: 'index.html',
    message: 'I cannot sign in, it says my password is wrong.',
    status: 'open'
  }, extra || {});
}
const without = (o, k) => { const c = Object.assign({}, o); delete c[k]; return c; };

(async () => {
  let up = false;
  try { up = (await fetch('http://' + FS + '/')).status === 200; } catch (e) {}
  if (!up) { console.log('  skip  emulator not running'); process.exit(0); }

  process.env.FIRESTORE_EMULATOR_HOST = FS;
  // AUTH TOO, and before firebase-admin is loaded. This line was missing: only
  // Firestore was pointed at the emulator, so admin.auth().updateUser() - the
  // call that marks test accounts verified - was aimed at PRODUCTION Auth. It
  // failed quietly only because this machine has no production credentials in
  // the shell; with them set it would have been a test touching real users.
  // It also meant any test account not verified in some earlier session never
  // got its email_verified claim.
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
  process.env.GCLOUD_PROJECT = PROJECT;
  const admin = require(path.join(__dirname, '..', '..', 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();

  // Same rule as the user docs below: restore what was there. A plain set()
  // here used to wipe the emulator's organisation list, which is what the
  // Admin > Organizations panel (and the header logo) read.
  const orgRef = db.collection('settings').doc('organizations');
  const orgBefore = (await orgRef.get()).data() || null;
  await orgRef.set({
    activeDomains: ['fsm.edu.tr', 'stu.fsm.edu.tr'],
    teacherEligibleDomains: ['fsm.edu.tr']
  }, { merge: true });

  const stu = await identity(admin, 'zz.support.student@stu.fsm.edu.tr');
  const other = await identity(admin, 'zz.support.other@stu.fsm.edu.tr');
  const demo = await identity(admin, 'zz.support.demo@fsm.edu.tr');
  const teacher = await identity(admin, 'zz.support.teacher@fsm.edu.tr');
  const boss = await identity(admin, ADMIN_EMAIL);
  // A demo TEACHER with a real class, exactly as production had it on
  // 2026-09-23 (demo.teacher@fsm.edu.tr assigned to B125).
  const demoTeacher = await identity(admin, 'zz.support.demoteacher@fsm.edu.tr');
  // The person who wrote from the sign-in page, once they CAN sign in: a
  // verified account under the email they typed. And an unverified account
  // under a typed email, which must get nothing.
  const signinUser = await identity(admin, SIGNIN_EMAIL);
  const unverified = await unverifiedIdentity(admin, UNVERIFIED_EMAIL);
  const anon = await anonymousIdentity();

  // Remember any user document that was already there, and put it back at the
  // end. The admin email in particular is shared with the emulator seed
  // (seed-emulator.js), and this gate used to DELETE that account's users doc
  // on the way out - after which the teacher dashboard said "User document
  // not found" for the admin until the seed was re-run. A gate must leave the
  // emulator the way it found it.
  const before = {};
  const people = [stu, other, demo, teacher, boss, demoTeacher, signinUser, unverified];
  for (const u of people) {
    const snap = await db.collection('users').doc(u.uid).get();
    before[u.uid] = snap.exists ? snap.data() : null;
  }

  await db.collection('users').doc(stu.uid).set({ email: stu.email, role: 'student', studentClass: 'B125' });
  await db.collection('users').doc(other.uid).set({ email: other.email, role: 'student', studentClass: 'B126' });
  // Exactly how createDemoAccount writes one in production: a verified FSM
  // account with a NORMAL role, marked only by demoAccount:true.
  await db.collection('users').doc(demo.uid).set({
    email: demo.email, role: 'student', demoAccount: true, createdByAdmin: true
  });
  await db.collection('users').doc(teacher.uid).set({ email: teacher.email, role: 'teacher', assignedClasses: ['B125'] });
  await db.collection('users').doc(boss.uid).set({ email: boss.email, role: 'teacher' });
  await db.collection('users').doc(demoTeacher.uid).set({
    email: demoTeacher.email, role: 'teacher', assignedClasses: ['B125'], demoAccount: true, createdByAdmin: true
  });
  // Ordinary students once registered. Nothing on these documents is what
  // lets them in: the sign-in rules look only at the verified token email.
  await db.collection('users').doc(signinUser.uid).set({ email: signinUser.email, role: 'student', studentClass: 'B127' });
  await db.collection('users').doc(unverified.uid).set({ email: unverified.email, role: 'student', studentClass: 'B127' });

  const P = (id) => 'supportMessages/' + RUN + '-' + id;
  const made = [];

  console.log('CREATING');
  let s = await commit([createW(P('toTeacher'), msg(stu.uid))], stu.token);
  expect('a student can write to their teacher', s, 200); made.push(P('toTeacher'));

  s = await commit([createW(P('toAdmin'), msg(stu.uid, {
    to: 'admin', topic: 'technical', device: 'Android phone - Chrome', page: '/student-dashboard.html'
  }))], stu.token);
  expect('a student can write to the admin, with device and page attached', s, 200); made.push(P('toAdmin'));

  s = await commit([createW(P('noWhen'), msg(stu.uid, { to: 'admin', topic: 'idea', when: '' }))], stu.token);
  expect('an idea needs no "when"', s, 200); made.push(P('noWhen'));

  s = await commit([createW(P('forged'), msg(other.uid))], stu.token);
  expect('a student CANNOT forge another student as the author', s, 403);

  s = await commit([createW(P('demo'), msg(demo.uid))], demo.token);
  expect('a DEMO account cannot file a message', s, 403);

  s = await commit([createW(P('preAnswered'), msg(stu.uid, { status: 'answered' }))], stu.token);
  expect('a message cannot be filed already answered', s, 403);

  s = await commit([createW(P('preSigned'), msg(stu.uid, { answeredBy: { name: 'Admin', email: ADMIN_EMAIL, role: 'admin' } }))], stu.token);
  expect('a message cannot arrive pre-signed "answered by the admin"', s, 403);

  s = await commit([createW(P('empty'), msg(stu.uid, { message: '' }))], stu.token);
  expect('an empty message is refused', s, 403);

  s = await commit([createW(P('long'), msg(stu.uid, { message: new Array(2002).join('x') }))], stu.token);
  expect('a message over 2000 characters is refused', s, 403);

  s = await commit([createW(P('topic'), msg(stu.uid, { topic: 'refund' }))], stu.token);
  expect('an unknown topic is refused', s, 403);

  s = await commit([createW(P('to'), msg(stu.uid, { to: 'principal' }))], stu.token);
  expect('an unknown recipient is refused', s, 403);

  s = await commit([createW(P('when'), msg(stu.uid, { when: 'tomorrow' }))], stu.token);
  expect('an unknown "when" is refused', s, 403);

  s = await commit([createW(P('clientTime'), msg(stu.uid, { createdAt: new Date('2030-01-01') }), [])], stu.token);
  expect('createdAt must be the server time, not one the student picks', s, 403);

  s = await commit([createW(P('fakeEmail'), msg(stu.uid, { email: 'someone.else@stu.fsm.edu.tr' }))], stu.token);
  expect("a message cannot claim an email that is not the sender's", s, 403);

  s = await commit([createW(P('longName'), msg(stu.uid, { name: new Array(102).join('n') }))], stu.token);
  expect('a "name" over 100 characters is refused', s, 403);

  console.log('\nREADING');
  expect('the author reads their own message', await read(P('toTeacher'), stu.token), 200);
  expect('another student CANNOT read it', await read(P('toTeacher'), other.token), 403);
  expect('the teacher reads a message addressed to teachers', await read(P('toTeacher'), teacher.token), 200);
  expect('the teacher CANNOT read a message addressed to the admin', await read(P('toAdmin'), teacher.token), 403);
  expect('the admin reads a message addressed to the admin', await read(P('toAdmin'), boss.token), 200);
  expect('the admin reads a message addressed to teachers', await read(P('toTeacher'), boss.token), 200);
  expect("a DEMO teacher with a real class CANNOT read a real student's message", await read(P('toTeacher'), demoTeacher.token), 403);
  expect("a DEMO teacher's inbox query is refused",
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('to', 'teacher') }, demoTeacher.token), 403);

  expect('the teacher inbox query (to == teacher) is allowed',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('to', 'teacher') }, teacher.token), 200);
  expect('a teacher query WITHOUT the recipient filter is refused',
    await query(null, { from: [{ collectionId: 'supportMessages' }] }, teacher.token), 403);
  expect('the admin inbox query (everything) is allowed',
    await query(null, { from: [{ collectionId: 'supportMessages' }] }, boss.token), 200);
  expect('the student "your messages" query is allowed',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('userId', stu.uid) }, stu.token), 200);
  expect('the student unread-badge query is allowed',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: and(eq('userId', stu.uid), eq('studentUnread', true)) }, stu.token), 200);
  expect('a student CANNOT query someone else\'s messages',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('userId', other.uid) }, stu.token), 403);

  console.log('\nANSWERING');
  const answerAs = (who, role, target, extra) => [
    createW(target + '/replies/' + RUN + '-' + Math.random().toString(36).slice(2, 8), reply(who, role)),
    patchW(target, Object.assign({
      status: 'answered',
      studentUnread: true,
      answeredBy: { name: 'Someone', email: who.email, role: role }
    }, extra || {}), [now('answeredAt'), now('lastReplyAt'), plusOne('replyCount')])
  ];

  expect('the teacher answers a message addressed to teachers (reply + status in one batch)',
    await commit(answerAs(teacher, 'teacher', P('toTeacher')), teacher.token), 200);
  expect('the teacher CANNOT answer a message addressed to the admin',
    await commit(answerAs(teacher, 'teacher', P('toAdmin')), teacher.token), 403);
  expect('a DEMO teacher CANNOT answer a real student',
    await commit(answerAs(demoTeacher, 'teacher', P('toTeacher')), demoTeacher.token), 403);
  expect('a teacher CANNOT sign a reply as "admin"',
    await commit(answerAs(teacher, 'admin', P('toTeacher')), teacher.token), 403);

  s = await commit([createW(P('toTeacher') + '/replies/' + RUN + '-forge',
    Object.assign(reply(teacher, 'teacher'), { authorEmail: ADMIN_EMAIL }))], teacher.token);
  expect('a teacher CANNOT put someone else\'s email on a reply', s, 403);

  s = await commit([patchW(P('toTeacher'), { answeredBy: { name: 'Admin', email: ADMIN_EMAIL, role: 'admin' } })], teacher.token);
  expect('a teacher CANNOT record the answer as the admin\'s', s, 403);

  expect('the admin answers a message addressed to the admin',
    await commit(answerAs(boss, 'admin', P('toAdmin')), boss.token), 200);
  expect('the admin can also answer a message addressed to teachers',
    await commit(answerAs(boss, 'admin', P('toTeacher')), boss.token), 200);

  const replies = (target) => ({ from: [{ collectionId: 'replies' }] });
  expect('the author reads the replies', await query(P('toTeacher'), replies(), stu.token), 200);
  expect('the admin reads the teacher\'s replies', await query(P('toTeacher'), replies(), boss.token), 200);
  expect('another student CANNOT read the replies', await query(P('toTeacher'), replies(), other.token), 403);
  expect('the teacher CANNOT read replies on an admin message', await query(P('toAdmin'), replies(), teacher.token), 403);

  console.log('\nTHE STUDENT, AFTER AN ANSWER');
  s = await commit([patchW(P('toTeacher'), { studentUnread: false })], stu.token);
  expect('the student can mark the answer as read', s, 200);

  s = await commit([patchW(P('toTeacher'), { studentUnread: true })], stu.token);
  expect('the student CANNOT mark it unread again', s, 403);

  s = await commit([patchW(P('toAdmin'), { status: 'answered' })], stu.token);
  expect('the student CANNOT mark a message answered', s, 403);

  s = await commit([patchW(P('toTeacher'), { answeredBy: { name: 'Me', email: stu.email, role: 'teacher' } })], stu.token);
  expect('the student CANNOT change who answered', s, 403);

  s = await commit([patchW(P('toTeacher'), { message: 'edited after sending' })], stu.token);
  expect('the student CANNOT edit what was sent', s, 403);

  s = await commit([patchW(P('toTeacher'), { lastReplyAt: new Date('2099-01-01') })], stu.token);
  expect('the student CANNOT push lastReplyAt into the future', s, 403);

  s = await commit([patchW(P('toTeacher'), { replyCount: 50 })], stu.token);
  expect('the student CANNOT set any replyCount it likes', s, 403);

  const followUp = [
    createW(P('toTeacher') + '/replies/' + RUN + '-f1', reply(stu, 'student', 'Thank you, but question 4 too?')),
    patchW(P('toTeacher'), { status: 'open' }, [now('lastReplyAt'), plusOne('replyCount')])
  ];
  expect('the student replies in the thread, which re-opens it', await commit(followUp, stu.token), 200);

  s = await commit([createW(P('toTeacher') + '/replies/' + RUN + '-f2', reply(stu, 'teacher'))], stu.token);
  expect('the student CANNOT sign a reply as a teacher', s, 403);

  s = await commit([createW(P('toTeacher') + '/replies/' + RUN + '-f3', reply(other, 'student'))], other.token);
  expect('another student CANNOT reply in the thread', s, 403);

  s = await commit([patchW(P('toTeacher') + '/replies/' + RUN + '-f1', { text: 'rewritten' })], stu.token);
  expect('a reply CANNOT be edited once written', s, 403);

  console.log('\nSTAFF LIMITS');
  s = await commit([patchW(P('toTeacher'), { message: 'edited by staff' })], teacher.token);
  expect('staff CANNOT edit what the student wrote', s, 403);

  s = await commit([patchW(P('toTeacher'), { to: 'admin' })], teacher.token);
  expect('a teacher CANNOT re-route a message', s, 403);

  s = await commit([patchW(P('toAdmin'), { status: 'open' })], teacher.token);
  expect('a teacher CANNOT change the status of an admin message', s, 403);

  s = await commit([patchW(P('toTeacher'), { status: 'open' })], teacher.token);
  expect('the teacher can re-open a message', s, 200);

  // ── 7. the sign-in page ───────────────────────────────────────────────────
  // SIGNED_OUT is a null token: no Authorization header, as the page sends it.
  const SIGNED_OUT = null;

  console.log('\nTHE SIGN-IN PAGE - WRITING SIGNED OUT');
  s = await commit([createW(P('signin'), signinMsg())], SIGNED_OUT);
  expect('signed out, a complete sign-in page message is accepted', s, 200); made.push(P('signin'));

  s = await commit([createW(P('signinAnon'), signinMsg({ topic: 'technical', when: '', device: '' }))], anon.token);
  expect('with a leftover anonymous game session attached, it is accepted too', s, 200); made.push(P('signinAnon'));

  s = await commit([createW(P('signinUnv'), signinMsg({ email: UNVERIFIED_EMAIL, topic: 'other' }))], SIGNED_OUT);
  expect('a message typed under an address nobody has verified is still accepted (it is only read back verified)', s, 200);
  made.push(P('signinUnv'));

  const refusedSignedOut = [
    ['addressed to a teacher', { to: 'teacher' }],
    ['a student-only topic ("grade")', { topic: 'grade' }],
    ['an unknown "when"', { when: 'tomorrow' }],
    ['an email that is not an address', { email: 'not-an-email' }],
    ['an email with a space in it', { email: 'zz support@stu.fsm.edu.tr' }],
    ['an email not stored lowercase', { email: 'ZZ.Support.Signin@stu.fsm.edu.tr' }],
    ['an email over 120 characters', { email: new Array(120).join('a') + '@stu.fsm.edu.tr' }],
    ['a one-letter name', { name: 'A' }],
    ['a name over 100 characters', { name: new Array(102).join('n') }],
    ['a device line over 120 characters', { device: new Array(122).join('d') }],
    ['a page other than the sign-in page', { page: '/student-dashboard.html' }],
    ['an empty message', { message: '' }],
    ['a message over 2000 characters', { message: new Array(2002).join('x') }],
    ['a userId (which the student read rule would honour)', { userId: signinUser.uid }],
    ['a studentClass', { studentClass: 'B125' }],
    ['a status of "answered"', { status: 'answered' }],
    ['a pre-signed "answered by the admin"', { answeredBy: { name: 'Admin', email: ADMIN_EMAIL, role: 'admin' } }],
    ['a source other than "signin"', { source: 'profile' }]
  ];
  // Every attempt is queued for clean-up, not just the ones meant to pass: a
  // write that is wrongly ACCEPTED would otherwise be left in the emulator.
  const attempt = (id, data, token, transforms) => {
    made.push(P(id));
    return commit([createW(P(id), data, transforms)], token);
  };
  let n = 0;
  for (const [label, extra] of refusedSignedOut) {
    expect('signed out, ' + label + ' is refused', await attempt('bad' + (n++), signinMsg(extra), SIGNED_OUT), 403);
  }
  for (const k of ['name', 'email', 'when', 'device', 'page', 'source']) {
    expect('signed out, a message with no "' + k + '" is refused', await attempt('miss-' + k, without(signinMsg(), k), SIGNED_OUT), 403);
  }
  expect('signed out, createdAt must still be the server time',
    await attempt('signinClock', signinMsg({ createdAt: new Date('2030-01-01') }), SIGNED_OUT, []), 403);

  expect('a SIGNED-IN student cannot use the sign-in shape (their path binds uid and email)',
    await attempt('signinAsStudent', signinMsg({ email: stu.email }), stu.token), 403);
  expect('a signed-in teacher cannot use the sign-in shape either',
    await attempt('signinAsTeacher', signinMsg({ email: teacher.email }), teacher.token), 403);

  console.log('\nTHE SIGN-IN PAGE - WHO CAN READ IT');
  expect('signed out, it CANNOT be read back', await read(P('signin'), SIGNED_OUT), 403);
  expect('signed out, it CANNOT be listed',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: and(eq('source', 'signin'), eq('email', SIGNIN_EMAIL)) }, SIGNED_OUT), 403);
  expect('the anonymous session that wrote one CANNOT read it', await read(P('signinAnon'), anon.token), 403);
  expect('a teacher CANNOT read it', await read(P('signin'), teacher.token), 403);
  expect('a teacher CANNOT list sign-in page messages',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('source', 'signin') }, teacher.token), 403);
  expect('the teacher inbox query (to == teacher) still works beside them',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('to', 'teacher') }, teacher.token), 200);
  expect('the admin reads it', await read(P('signin'), boss.token), 200);
  expect('the admin lists sign-in page messages',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('source', 'signin') }, boss.token), 200);

  console.log('\nTHE SIGN-IN PAGE - THE ADMIN ANSWERS');
  expect('the admin answers a sign-in page message (reply + status in one batch)',
    await commit(answerAs(boss, 'admin', P('signin')), boss.token), 200);
  expect('the admin answers the unverified one too (its reader, not its writer, is what is gated)',
    await commit(answerAs(boss, 'admin', P('signinUnv')), boss.token), 200);
  expect('a teacher CANNOT answer a sign-in page message',
    await commit(answerAs(teacher, 'teacher', P('signin')), teacher.token), 403);
  expect('a teacher CANNOT read its replies', await query(P('signin'), replies(), teacher.token), 403);
  expect('signed out, its replies CANNOT be read', await query(P('signin'), replies(), SIGNED_OUT), 403);
  s = await commit([patchW(P('signin'), { status: 'answered' })], SIGNED_OUT);
  expect('signed out, it CANNOT be changed', s, 403);

  console.log('\nTHE SIGN-IN PAGE - LATER, SIGNED IN WITH THE TYPED EMAIL (VERIFIED)');
  const mine = (who) => and(eq('source', 'signin'), eq('email', who.email));
  expect('the "sent from the sign-in page" query (source + own email) is allowed',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: mine(signinUser) }, signinUser.token), 200);
  expect('the unread-dot query (source + own email + studentUnread) is allowed',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: and(eq('source', 'signin'), eq('email', signinUser.email), eq('studentUnread', true)) }, signinUser.token), 200);
  expect('a query on source alone (everyone\'s) is refused',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: eq('source', 'signin') }, signinUser.token), 403);
  expect('they read it', await read(P('signin'), signinUser.token), 200);
  expect('they read its replies', await query(P('signin'), replies(), signinUser.token), 200);
  s = await commit([patchW(P('signin'), { studentUnread: false })], signinUser.token);
  expect('they mark the answer as read', s, 200);
  s = await commit([patchW(P('signin'), { studentUnread: true })], signinUser.token);
  expect('they CANNOT mark it unread again', s, 403);
  s = await commit([patchW(P('signin'), { message: 'edited after sending' })], signinUser.token);
  expect('they CANNOT edit what was sent', s, 403);
  s = await commit([patchW(P('signin'), { email: 'someone.else@stu.fsm.edu.tr' })], signinUser.token);
  expect('they CANNOT re-address it to another email', s, 403);
  expect('they reply in the thread, which re-opens it', await commit([
    createW(P('signin') + '/replies/' + RUN + '-s1', reply(signinUser, 'student', 'Thank you, it works now.')),
    patchW(P('signin'), { status: 'open' }, [now('lastReplyAt'), plusOne('replyCount')])
  ], signinUser.token), 200);
  // Only now, with the thread open again, is "answered" a real change. (While
  // the admin's answer stood, writing 'answered' was a no-op and is allowed.)
  s = await commit([patchW(P('signin'), { status: 'answered' })], signinUser.token);
  expect('they CANNOT mark it answered', s, 403);
  s = await commit([createW(P('signin') + '/replies/' + RUN + '-s2', reply(signinUser, 'admin'))], signinUser.token);
  expect('they CANNOT sign a reply as the admin', s, 403);
  expect('the admin can still reply after them',
    await commit(answerAs(boss, 'admin', P('signin')), boss.token), 200);

  console.log('\nTHE SIGN-IN PAGE - SAME EMAIL, NOT VERIFIED / SOMEONE ELSE');
  expect('an UNVERIFIED account with the typed email CANNOT list it',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: mine(unverified) }, unverified.token), 403);
  expect('an UNVERIFIED account with the typed email CANNOT read it', await read(P('signinUnv'), unverified.token), 403);
  expect('an UNVERIFIED account with the typed email CANNOT read its replies', await query(P('signinUnv'), replies(), unverified.token), 403);
  s = await commit([patchW(P('signinUnv'), { studentUnread: false })], unverified.token);
  expect('an UNVERIFIED account with the typed email CANNOT mark it read', s, 403);
  s = await commit([createW(P('signinUnv') + '/replies/' + RUN + '-u1', reply(unverified, 'student'))], unverified.token);
  expect('an UNVERIFIED account with the typed email CANNOT reply', s, 403);

  expect('a different student CANNOT read it', await read(P('signin'), other.token), 403);
  expect('a different student CANNOT list it by typing its email into the query',
    await query(null, { from: [{ collectionId: 'supportMessages' }], where: mine(signinUser) }, other.token), 403);
  expect('a different student CANNOT read its replies', await query(P('signin'), replies(), other.token), 403);
  s = await commit([createW(P('signin') + '/replies/' + RUN + '-o1', reply(other, 'student'))], other.token);
  expect('a different student CANNOT reply in it', s, 403);
  s = await commit([patchW(P('signin'), { studentUnread: false })], other.token);
  expect('a different student CANNOT mark it read', s, 403);

  // ── clean up everything this run made ─────────────────────────────────────
  for (const p of made) {
    const ref = db.doc(p);
    const reps = await ref.collection('replies').get();
    for (const d of reps.docs) await d.ref.delete().catch(() => {});
    await ref.delete().catch(() => {});
  }
  for (const u of people) {
    const ref = db.collection('users').doc(u.uid);
    if (before[u.uid]) await ref.set(before[u.uid]).catch(() => {});
    else await ref.delete().catch(() => {});
  }
  if (orgBefore) await orgRef.set(orgBefore).catch(() => {});
  // A fresh anonymous account is made every run; do not let them pile up.
  await admin.auth().deleteUser(anon.uid).catch(() => {});

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
    failures.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('PASS - ' + pass + ' support-message checks.');
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(2); });
