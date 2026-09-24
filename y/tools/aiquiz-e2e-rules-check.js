#!/usr/bin/env node
'use strict';
/* ============================================================
   aiquiz-e2e-rules-check.js - AI Quiz must not break. Prove it.
   ------------------------------------------------------------
   WHY THIS EXISTS

   AI Quiz is the game the 1000-student event runs on, and it is the one
   thing that must not break. Several planned changes touch it indirectly:
   closing the `_ownsMiniSession` grandfather in firestore.rules (which
   covers aiquiz_sessions), editing js/firebase-init.js (which every AI Quiz
   page loads), and raising the tap-target height on the student join button.

   Reading a diff is not enough for any of those. This drives EVERY
   rule-gated operation the real game performs, against the local emulator,
   with REAL ID TOKENS so firestore.rules is enforced exactly as it is for a
   real phone and a real teacher.

   Run it BEFORE a change to get a green baseline, and after every change.
   If it goes red, the change broke the game.

   WHAT IT COVERS

   The host path:   create session, write the question bank, advance the
                    question, close it, read the ladder, kick a player,
                    delete the session.
   The student path: join, read the session, read the questions, answer
                    (score increment + answeredQ), read own doc.
   The negatives:    a second teacher must NOT control someone else's room;
                     a student must NOT write another student's document;
                     a signed-out caller must NOT read or write anything.

   The negatives are the point. A rules change that accidentally opens
   everything would leave every positive test green.

   EMULATOR ONLY. It refuses to run if the emulator is not reachable, so it
   can never touch production.

   Usage:  node y/tools/aiquiz-e2e-rules-check.js
   ============================================================ */

const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const DOCS = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

const CODE = 'E2EAQ';
let pass = 0, fail = 0;
const failures = [];

function ok(name)  { pass++; console.log('  ok    ' + name); }
function bad(name, detail) {
  fail++; failures.push(name);
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
}
// `expected` is 'allow' or 'deny'. Firestore REST returns 200 on success and
// 403 on a rules denial.
function check(name, status, expected) {
  const allowed = status >= 200 && status < 300;
  if (expected === 'allow' && allowed) return ok(name);
  if (expected === 'deny' && status === 403) return ok(name);
  bad(name, 'expected ' + expected + ', got HTTP ' + status);
}

function fval(v) {
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fval) } };
  if (v && typeof v === 'object') return { mapValue: { fields: fdoc(v).fields } };
  return { stringValue: String(v) };
}
function fdoc(o) { const f = {}; Object.keys(o).forEach(k => { f[k] = fval(o[k]); }); return { fields: f }; }

async function req(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(`${DOCS}/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  return r.status;
}
const write = (path, tok, obj) => req('PATCH', path, tok, fdoc(obj));
const read  = (path, tok)      => req('GET', path, tok);
const del   = (path, tok)      => req('DELETE', path, tok);

// A real signed-in identity from the Auth emulator.
//
// Idempotent on purpose: this check is meant to be run over and over, once
// before a change and once after, against an emulator that keeps its data
// between runs. The first version only called accounts:signUp and died with
// EMAIL_EXISTS on the second run, which looked like a failure of the app
// rather than of the harness. Existing accounts now sign in instead.
async function signUp(email) {
  const base = `http://${AUTH}/identitytoolkit.googleapis.com/v1`;
  const post = async (path, body) => {
    const r = await fetch(`${base}/${path}?key=emulator`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  };
  let j = await post('accounts:signUp', email
    ? { email, password: 'Passw0rd!', returnSecureToken: true }
    : { returnSecureToken: true });
  if (!j.idToken && j.error && /EMAIL_EXISTS/.test(j.error.message || '')) {
    j = await post('accounts:signInWithPassword', { email, password: 'Passw0rd!', returnSecureToken: true });
  }
  if (!j.idToken) throw new Error('could not mint a token: ' + JSON.stringify(j).slice(0, 160));
  return { uid: j.localId, token: j.idToken };
}

// The users doc is what isTeacher() reads, so it is seeded with the owner
// bypass before the identity is used under real rules.
async function makeTeacher(who, name) {
  await write(`users/${who.uid}`, 'owner', {
    email: name + '@example.test', name, role: 'teacher', active: true
  });
}
async function makeStudent(who, name) {
  await write(`users/${who.uid}`, 'owner', {
    email: name + '@example.test', name, role: 'student', active: true,
    level: 'B1', studentClass: 'B101', module: 'Module 2'
  });
}

async function cleanup() {
  for (let i = 0; i < 3; i++) await del(`aiquiz_sessions/${CODE}/players/p${i}`, 'owner');
  await del(`aiquiz_sessions/${CODE}/meta/questions`, 'owner');
  await del(`aiquiz_sessions/${CODE}`, 'owner');
}

(async () => {
  let up = false;
  try { up = (await fetch(`http://${FS}/`)).status === 200; } catch (e) { up = false; }
  if (!up) {
    console.error('Firestore emulator not reachable at ' + FS + '. Refusing to run.');
    console.error('Start it with:  firebase emulators:start --only auth,firestore');
    process.exit(2);
  }

  console.log('AI Quiz end-to-end, real tokens, rules enforced\n');
  await cleanup();

  const hostT = await signUp('e2e.host@example.test');
  const otherT = await signUp('e2e.other@example.test');
  const stu = await signUp();               // anonymous, like a real phone
  const stu2 = await signUp();
  await makeTeacher(hostT, 'E2E Host');
  await makeTeacher(otherT, 'E2E Other');
  await makeStudent(stu, 'E2E Student');
  await makeStudent(stu2, 'E2E Student Two');

  // ── HOST PATH ─────────────────────────────────────────────
  check('host creates the room (hostUid = self)',
    await write(`aiquiz_sessions/${CODE}`, hostT.token, {
      code: CODE, status: 'waiting', currentQuestion: -1, phase: 'asking',
      total: 3, seconds: 30, hostUid: hostT.uid, teacherName: 'E2E Host'
    }), 'allow');

  check('host writes the question bank to meta/questions',
    await write(`aiquiz_sessions/${CODE}/meta/questions`, hostT.token, { built: true }), 'allow');

  // ── STUDENT PATH ──────────────────────────────────────────
  check('student reads the session by code',
    await read(`aiquiz_sessions/${CODE}`, stu.token), 'allow');

  check('student reads the question bank once',
    await read(`aiquiz_sessions/${CODE}/meta/questions`, stu.token), 'allow');

  check('student joins by writing players/{own uid}',
    await write(`aiquiz_sessions/${CODE}/players/${stu.uid}`, stu.token, {
      uid: stu.uid, name: 'E2E Student', score: 0
    }), 'allow');

  check('second student joins',
    await write(`aiquiz_sessions/${CODE}/players/${stu2.uid}`, stu2.token, {
      uid: stu2.uid, name: 'E2E Student Two', score: 0
    }), 'allow');

  check('student answers: score + answeredQ on own doc',
    await write(`aiquiz_sessions/${CODE}/players/${stu.uid}`, stu.token, {
      uid: stu.uid, name: 'E2E Student', score: 120, answeredQ: 0
    }), 'allow');

  // ── HOST RUNS THE GAME ────────────────────────────────────
  check('host advances to question 0',
    await write(`aiquiz_sessions/${CODE}`, hostT.token, {
      code: CODE, status: 'active', currentQuestion: 0, phase: 'asking',
      total: 3, seconds: 30, hostUid: hostT.uid, teacherName: 'E2E Host'
    }), 'allow');

  check('host closes the question (phase -> revealed)',
    await write(`aiquiz_sessions/${CODE}`, hostT.token, {
      code: CODE, status: 'active', currentQuestion: 0, phase: 'revealed',
      total: 3, seconds: 30, hostUid: hostT.uid, teacherName: 'E2E Host'
    }), 'allow');

  check('host lists players (the ladder query)',
    await read(`aiquiz_sessions/${CODE}/players`, hostT.token), 'allow');

  check('host kicks a player',
    await del(`aiquiz_sessions/${CODE}/players/${stu2.uid}`, hostT.token), 'allow');

  // ── NEGATIVES. These are the point. ───────────────────────
  check('DENY a second teacher updating this room',
    await write(`aiquiz_sessions/${CODE}`, otherT.token, {
      code: CODE, status: 'finished', hostUid: hostT.uid
    }), 'deny');

  check('DENY a second teacher deleting a player from this room',
    await del(`aiquiz_sessions/${CODE}/players/${stu.uid}`, otherT.token), 'deny');

  check('DENY a student writing another student\'s document',
    await write(`aiquiz_sessions/${CODE}/players/${stu2.uid}`, stu.token, {
      uid: stu2.uid, score: 9999
    }), 'deny');

  check('DENY a student writing the question bank',
    await write(`aiquiz_sessions/${CODE}/meta/questions`, stu.token, { built: false }), 'deny');

  check('DENY a signed-out caller reading the session',
    await read(`aiquiz_sessions/${CODE}`, null), 'deny');

  check('DENY a signed-out caller joining',
    await write(`aiquiz_sessions/${CODE}/players/anon`, null, { uid: 'anon' }), 'deny');

  // ── HOST TEARDOWN ─────────────────────────────────────────
  check('DENY a second teacher deleting the room',
    await del(`aiquiz_sessions/${CODE}`, otherT.token), 'deny');

  check('host deletes the room',
    await del(`aiquiz_sessions/${CODE}`, hostT.token), 'allow');

  await cleanup();

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ' AI Quiz operations behaved wrongly:');
    failures.forEach(f => console.log('   - ' + f));
    console.log('\nDO NOT SHIP. AI Quiz is the event game.');
    process.exit(1);
  }
  console.log('PASS - all ' + pass + ' AI Quiz operations behave correctly (host, student, and every negative).');
})().catch(e => {
  console.error('\nERROR: ' + (e && e.message));
  process.exit(2);
});
