#!/usr/bin/env node
'use strict';
/* ============================================================
   seed-emulator.js - create a demo student + teacher + class in
   the LOCAL Firebase emulators, so real login -> vocab -> grammar
   can be tested without touching production.
   ------------------------------------------------------------
   No dependencies: talks to the Auth and Firestore emulator REST
   APIs directly. Run it AFTER `firebase emulators:start`.

   Usage:
     node y/tools/seed-emulator.js            seed the running emulators
     node y/tools/seed-emulator.js --dry-run  print the requests only

   Ports/project can be overridden with FIREBASE_AUTH_EMULATOR_HOST,
   FIRESTORE_EMULATOR_HOST, GCLOUD_PROJECT. See README-emulator-e2e.md.
   ============================================================ */
var PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
var AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
var FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
var DRY = process.argv.indexOf('--dry-run') !== -1;

function nowIso() { return new Date().toISOString(); }
function ts() { return { __ts: nowIso() }; }

// Firestore typed-value encoding.
function fval(v) {
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v && v.__ts) return { timestampValue: v.__ts };
  return { stringValue: String(v) };
}
function fdoc(obj) { var f = {}; Object.keys(obj).forEach(function (k) { f[k] = fval(obj[k]); }); return { fields: f }; }

// Demo entities. The user doc carries every field the app gates read:
// role/active (account-gate), registeredAt (yearly expiry), lastVerifiedAt
// (verify-gate modal), plus level/class/module/book so the dashboard renders.
var STUDENT = { uid: 'demo-student-uid', email: 'demo.student@fsm.edu.tr', password: 'Passw0rd!', name: 'Demo Student' };
var TEACHER = { uid: 'demo-teacher-uid', email: 'demo.teacher@fsm.edu.tr', password: 'Passw0rd!', name: 'Demo Teacher' };
var studentDoc = { email: STUDENT.email, name: STUDENT.name, role: 'student', active: true, level: 'B1', studentClass: 'B101', module: 'Module 2', academicYear: '2025-26', book: 'empower', registeredAt: ts(), lastVerifiedAt: ts(), createdAt: ts(), lastLogin: ts() };
var teacherDoc = { email: TEACHER.email, name: TEACHER.name, role: 'teacher', active: true, createdAt: ts() };
var classDoc = { name: 'Pilot Class B101', level: 'B1', book: 'empower', teacherId: TEACHER.uid, code: 'DEMO01', createdAt: ts() };

function authCreate(u) {
  var url = 'http://' + AUTH + '/identitytoolkit.googleapis.com/v1/projects/' + PROJECT + '/accounts';
  var body = { localId: u.uid, email: u.email, password: u.password, emailVerified: true, displayName: u.name };
  return send('AUTH  ' + u.email, url, 'POST', body);
}
function fsWrite(coll, id, doc) {
  var url = 'http://' + FS + '/v1/projects/' + PROJECT + '/databases/(default)/documents/' + coll + '/' + id;
  return send('FS    ' + coll + '/' + id, url, 'PATCH', fdoc(doc));
}
function send(label, url, method, body) {
  var opts = { method: method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify(body) };
  if (DRY) { console.log('\n[' + label + ']\n' + method + ' ' + url + '\n' + JSON.stringify(body)); return Promise.resolve(); }
  return fetch(url, opts).then(function (r) { return r.text().then(function (t) { console.log(label + ' -> ' + r.status + (r.ok ? ' OK' : ' ' + t.slice(0, 200))); }); });
}

async function main() {
  console.log((DRY ? '[DRY RUN] ' : '') + 'Seed emulators  project=' + PROJECT + '  auth=' + AUTH + '  firestore=' + FS);
  await authCreate(STUDENT);
  await authCreate(TEACHER);
  await fsWrite('users', STUDENT.uid, studentDoc);
  await fsWrite('users', TEACHER.uid, teacherDoc);
  await fsWrite('classes', 'demo-class', classDoc);
  console.log('\nDone. Sign in as  ' + STUDENT.email + ' / ' + STUDENT.password + '  (student)');
  console.log('           or as  ' + TEACHER.email + ' / ' + TEACHER.password + '  (teacher)');
}
main().catch(function (e) { console.error('seed failed: ' + e.message + '\n(are the emulators running? see README-emulator-e2e.md)'); process.exit(1); });
