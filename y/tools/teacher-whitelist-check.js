#!/usr/bin/env node
'use strict';
/* ============================================================
   teacher-whitelist-check.js - does "Add Teacher" actually work?
   ------------------------------------------------------------
   WHY

   Admin > Teachers has an "Add Teacher" form. It takes a staff email, writes
   it to settings/teacherEmails, and tells the admin:

       "Email added to whitelist. They will get teacher access on registration."

   Alireza added a teacher that way, the teacher tried to sign in with Google,
   and was told they had no permission to log in. He deleted them, they signed
   in normally as a student, he promoted them with the crown button, and that
   worked.

   This reproduces all three paths against the emulator with real ID tokens, so
   the diagnosis is demonstrated rather than argued.

   THE THREE PATHS

     1. whitelisted user, NO user doc yet  -> the Google handler writes
        role:'teacher' on create. firestore.rules users/create requires
        role == 'student'. Expected: DENIED.

     2. whitelisted user who is ALREADY a student -> the Google handler writes
        role:'teacher' on update. The self-update branch requires
        roleUnchanged(). Expected: DENIED.

     3. admin promotes the same student -> the admin branch of users/update
        allows it for a teacher-eligible email. Expected: ALLOWED.

   If 1 and 2 are DENIED and 3 is ALLOWED, the whitelist is decorative: the
   only thing that ever grants teacher is the crown button.

   Usage:  node y/tools/teacher-whitelist-check.js       (needs the emulators)
   ============================================================ */

const path = require('path');

const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const DOCS = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

const ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';
const NEW_TEACHER = 'zz.whitelist.probe@fsm.edu.tr';

let pass = 0, fail = 0;
const failures = [];
const ok = (m) => { pass++; console.log('  ok    ' + m); };
const bad = (m, d) => { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); };

/* ---- auth emulator: mint a verified identity, idempotently ---- */
async function identity(email) {
  const key = 'fake-api-key';
  const post = async (ep, body) => {
    const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/${ep}?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return r.json();
  };
  let j = await post('accounts:signUp', { email, password: 'Passw0rd!', returnSecureToken: true });
  if (!j.idToken && j.error && /EMAIL_EXISTS/.test(j.error.message || '')) {
    j = await post('accounts:signInWithPassword', { email, password: 'Passw0rd!', returnSecureToken: true });
  }
  if (!j.idToken) throw new Error('could not mint ' + email + ': ' + JSON.stringify(j.error || j));
  // The app gates on emailVerified, so mark it verified like a Google sign-in.
  await post('accounts:update', { idToken: j.idToken, emailVerified: true });
  j = await post('accounts:signInWithPassword', { email, password: 'Passw0rd!', returnSecureToken: true });
  return { uid: j.localId, token: j.idToken };
}

/* ---- firestore REST as a given identity ---- */
const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));

async function write(pathStr, data, token, mask) {
  let url = `${DOCS}/${pathStr}`;
  if (mask) url += '?' + mask.map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ fields: fields(data) }),
  });
  return r.status;
}
async function del(pathStr, token) {
  const r = await fetch(`${DOCS}/${pathStr}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  return r.status;
}

(async () => {
  let up = false;
  try { up = (await fetch(`http://${FS}/`)).status === 200; } catch (e) {}
  if (!up) { console.log('  skip  emulator not running'); process.exit(0); }

  process.env.FIRESTORE_EMULATOR_HOST = FS;
  process.env.GCLOUD_PROJECT = PROJECT;
  const admin = require(path.join(__dirname, '..', '..', 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();

  console.log('Reproducing the "Add Teacher" flow against the emulator.\n');

  // Leave the emulator as it was found. This used to overwrite
  // settings/organizations with no `list` and delete settings/teacherEmails,
  // which wiped the organisation rows other checks and the header logo read
  // (found 2026-09-23: the student dashboard lost its logo after a gates run).
  const orgRef = db.collection('settings').doc('organizations');
  const emailsRef = db.collection('settings').doc('teacherEmails');
  const orgBefore = (await orgRef.get()).data() || null;
  const emailsBefore = (await emailsRef.get()).data() || null;

  // Seed the tenant exactly as production has it (verified live earlier).
  // Merged, so an existing organisation list survives.
  await orgRef.set({
    activeDomains: ['fsm.edu.tr', 'stu.fsm.edu.tr'],
    teacherEligibleDomains: ['fsm.edu.tr'],
  }, { merge: true });

  // What Admin > Teachers "Add Teacher" actually writes.
  await db.collection('settings').doc('teacherEmails').set({ teacherEmails: [NEW_TEACHER] });
  console.log('  (settings/teacherEmails now contains ' + NEW_TEACHER + ')\n');

  const adminId = await identity(ADMIN_EMAIL);
  const teach = await identity(NEW_TEACHER);
  await db.collection('users').doc(teach.uid).delete().catch(() => {});

  // ── PATH 1: brand new whitelisted user, the Google handler's create ──
  console.log('PATH 1 - whitelisted, no user doc yet (the Google handler creates the doc)');
  let s = await write('users/' + teach.uid, {
    name: 'Probe Teacher', email: NEW_TEACHER, role: 'teacher',
  }, teach.token);
  if (s === 200) ok('a WHITELISTED address may create itself as a teacher (200) - the fix');
  else bad('whitelisted create with role:"teacher" returned ' + s + ', expected 200');

  await db.collection('users').doc(teach.uid).delete().catch(() => {});
  s = await write('users/' + teach.uid, {
    name: 'Probe Teacher', email: NEW_TEACHER, role: 'student',
  }, teach.token);
  if (s === 200) ok('the same address may still create itself as a student (200)');
  else bad('create with role:"student" returned ' + s + ', expected 200');

  // ── PATH 2: already a student, then whitelisted ──
  console.log('\nPATH 2 - whitelisted AFTER registering as a student');
  s = await write('users/' + teach.uid, { role: 'teacher' }, teach.token, ['role']);
  if (s === 200) ok('a whitelisted student may promote itself to teacher (200) - the fix');
  else bad('whitelisted self-promotion returned ' + s + ', expected 200');

  // ── THE NEGATIVES. The whole point is that ONLY the whitelist grants this ──
  console.log('\nNEGATIVES - the grant must come from the admin-written whitelist, nothing else');

  const outsider = await identity('zz.outsider.probe@fsm.edu.tr');
  await db.collection('users').doc(outsider.uid).delete().catch(() => {});
  s = await write('users/' + outsider.uid, {
    name: 'Outsider', email: 'zz.outsider.probe@fsm.edu.tr', role: 'teacher',
  }, outsider.token);
  if (s === 403) ok('a NON-whitelisted staff address cannot create itself as a teacher (403)');
  else bad('non-whitelisted create as teacher returned ' + s + ', expected 403');

  await db.collection('users').doc(outsider.uid)
    .set({ email: 'zz.outsider.probe@fsm.edu.tr', role: 'student' });
  s = await write('users/' + outsider.uid, { role: 'teacher' }, outsider.token, ['role']);
  if (s === 403) ok('a NON-whitelisted student cannot promote itself (403)');
  else bad('non-whitelisted self-promotion returned ' + s + ', expected 403');

  // A @stu address ON the whitelist still must not become a teacher: the rule
  // requires the domain to be teacher-eligible as well, so an admin typo in
  // one document cannot grant staff access on its own.
  await db.collection('settings').doc('teacherEmails')
    .set({ teacherEmails: [NEW_TEACHER, 'zz.stu.probe@stu.fsm.edu.tr'] });
  const stuWl = await identity('zz.stu.probe@stu.fsm.edu.tr');
  await db.collection('users').doc(stuWl.uid).delete().catch(() => {});
  s = await write('users/' + stuWl.uid, {
    name: 'Student', email: 'zz.stu.probe@stu.fsm.edu.tr', role: 'teacher',
  }, stuWl.token);
  if (s === 403) ok('a @stu address ON the whitelist still cannot become a teacher (403)');
  else bad('whitelisted @stu create as teacher returned ' + s + ', expected 403');

  // The narrow branch must not be a general-purpose role escape hatch.
  s = await write('users/' + teach.uid, { role: 'demo' }, teach.token, ['role']);
  if (s === 403) ok('a whitelisted teacher cannot self-assign role:"demo" (403)');
  else bad('self-assign demo returned ' + s + ', expected 403');

  s = await write('users/' + teach.uid, { role: 'student' }, teach.token, ['role']);
  if (s === 403) ok('the promotion branch is one-way - cannot self-demote (403)');
  else bad('self-demotion returned ' + s + ', expected 403');

  await db.collection('users').doc(outsider.uid).delete().catch(() => {});
  await db.collection('users').doc(stuWl.uid).delete().catch(() => {});
  await db.collection('settings').doc('teacherEmails').set({ teacherEmails: [NEW_TEACHER] });

  // ── PATH 3: the crown button still works ──
  console.log('\nPATH 3 - admin promotes with the crown button (students.js promoteStudentToTeacher)');
  await db.collection('users').doc(teach.uid).set({ email: NEW_TEACHER, role: 'student' });
  s = await write('users/' + teach.uid, { role: 'teacher', email: NEW_TEACHER }, adminId.token, ['role', 'email']);
  if (s === 200) ok('admin promotion to teacher is ALLOWED (200) - the path that worked');
  else bad('admin promotion returned ' + s + ', expected 200');

  // And the guard that stops a student address being promoted.
  const stu = await identity('zz.whitelist.probe@stu.fsm.edu.tr');
  await db.collection('users').doc(stu.uid).set({ email: 'zz.whitelist.probe@stu.fsm.edu.tr', role: 'student' });
  s = await write('users/' + stu.uid, { role: 'teacher', email: 'zz.whitelist.probe@stu.fsm.edu.tr' },
    adminId.token, ['role', 'email']);
  if (s === 403) ok('even admin cannot promote a @stu address (403) - teacherEligibleDomains holds');
  else bad('admin promoted a @stu address, returned ' + s + ', expected 403');

  // ── the client must never write a role it is not allowed to write ──
  //
  // The rules above are only half the fix. signInWithGoogle used to write
  // role on EVERY sign-in, including role:'student' onto an existing
  // teacher's document - a demotion attempt that roleUnchanged() refused, so
  // a crown-promoted teacher could not sign in with Google at all. These
  // assertions fail if that pattern comes back.
  console.log('\nThe client must not write a role it cannot write');
  const fsmod = require('fs');
  const mainSrc = fsmod.readFileSync(path.join(__dirname, '..', 'index', 'js', 'main.js'), 'utf8');

  const googleFn = mainSrc.slice(mainSrc.indexOf('async function signInWithGoogle'));
  const body = googleFn.slice(0, googleFn.indexOf('\n}'));
  if (body.indexOf("role: 'student'") === -1) {
    ok("signInWithGoogle no longer writes role:'student' (the demotion that locked teachers out)");
  } else bad("signInWithGoogle still writes role:'student' - crown-promoted teachers cannot sign in");

  if (/lastLogin[\s\S]{0,120}role:\s*'teacher'/.test(body)) {
    bad("signInWithGoogle still writes role:'teacher' alongside lastLogin on an existing doc");
  } else ok('signInWithGoogle writes the role only when creating a fresh document');

  const idxHtml = fsmod.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  if (idxHtml.indexOf('index/js/auth.js') === -1) {
    ok('index.html does not load index/js/auth.js - main.js is the live path');
  } else bad('index.html now loads auth.js too - the duplicate handlers may both be live');

  // The password-login path must consult the whitelist too, or Admin's
  // "they get access on the next sign-in" is only true for Google.
  if (/WHITELIST PROMOTION, on the password-login path too/.test(mainSrc)) {
    ok('the password-login path promotes whitelisted teachers as well');
  } else bad('the password-login path no longer carries the whitelist promotion');

  // ── cleanup ──
  await db.collection('users').doc(teach.uid).delete().catch(() => {});
  await db.collection('users').doc(stu.uid).delete().catch(() => {});
  if (emailsBefore) await emailsRef.set(emailsBefore).catch(() => {});
  else await emailsRef.delete().catch(() => {});
  if (orgBefore) await orgRef.set(orgBefore).catch(() => {});

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
    failures.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('PASS - ' + pass + ' checks. The whitelist grants teacher, and nothing else does.');
})().catch(e => { console.error('ERROR: ' + (e && e.message)); process.exit(2); });
