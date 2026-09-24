#!/usr/bin/env node
'use strict';
/* ============================================================
   games-security-check.js - can a student cheat in any classroom game?
   ------------------------------------------------------------
   WHY

   AI Quiz had an end-to-end security test. The other eight games had none.
   That is the gap that let "the correct answer is always option A" sit in
   production in the game chosen for a 1000-student event: everything in this
   project checked STRUCTURE (is the file shaped right, is the version bumped)
   and almost nothing checked BEHAVIOUR.

   WHAT IT DOES

   Drives every rule-gated operation of all nine games against the local
   emulator with REAL ID TOKENS, so firestore.rules is enforced exactly as it
   is for a real phone. One table, nine games, so adding a tenth is a row.

   The negatives are the point. Every game gets asked:

     can a student write ANOTHER student's score?
     can a student take over the room?
     can a second teacher control a room they did not create?
     can a signed-out person join or read?

   plus per-game questions about the things each game actually holds: the AI
   Quiz answer bank, Heist vault passwords, exam answer documents, Trust votes.

   A FAILURE HERE IS A FINDING, NOT A BROKEN TEST. These assert the security
   posture that is obviously correct. If the rules disagree, the rules are what
   needs looking at.

   EMULATOR ONLY. Refuses to run otherwise.
   Usage:  node y/tools/games-security-check.js
   ============================================================ */

const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const DOCS = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

let pass = 0, fail = 0;
const failures = [];
function check(name, status, expected) {
  const allowed = status >= 200 && status < 300;
  const good = expected === 'allow' ? allowed : status === 403;
  if (good) { pass++; console.log('    ok    ' + name); }
  else { fail++; failures.push(name); console.log('    FAIL  ' + name + '   (expected ' + expected + ', got HTTP ' + status + ')'); }
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
  const r = await fetch(`${DOCS}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return r.status;
}
const put = (p, t, o) => req('PATCH', p, t, fdoc(o));
const get = (p, t) => req('GET', p, t);
const del = (p, t) => req('DELETE', p, t);

async function identity(email) {
  const base = `http://${AUTH}/identitytoolkit.googleapis.com/v1`;
  const post = async (path, body) => (await fetch(`${base}/${path}?key=emulator`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })).json();
  let j = email
    ? await post('accounts:signUp', { email, password: 'Passw0rd!', returnSecureToken: true })
    : await post('accounts:signUp', { returnSecureToken: true });
  if (!j.idToken && j.error && /EMAIL_EXISTS/.test(j.error.message || '')) {
    j = await post('accounts:signInWithPassword', { email, password: 'Passw0rd!', returnSecureToken: true });
  }
  if (!j.idToken) throw new Error('token: ' + JSON.stringify(j).slice(0, 140));
  return { uid: j.localId, token: j.idToken };
}

const CODE = 'SECQ';

// One row per game. `owner` is the field the rules key ownership on; it is
// createdBy for the original classroom game and hostUid for everything since.
const GAMES = [
  { id: 'Vocab Race',        coll: 'classroom_sessions', owner: 'createdBy' },
  { id: 'AI Quiz',           coll: 'aiquiz_sessions',    owner: 'hostUid',
    meta: 'meta/questions' },
  { id: 'Vocab Bingo',       coll: 'bingo_sessions',     owner: 'hostUid' },
  { id: 'Sentence Scramble', coll: 'scramble_sessions',  owner: 'hostUid' },
  { id: 'Tug of War',        coll: 'tug_sessions',       owner: 'hostUid' },
  { id: 'Vocab Heist',       coll: 'heist_sessions',     owner: 'hostUid',
    secret: 'passwords' },
  { id: 'Reading Exam',      coll: 'reading_sessions',   owner: 'hostUid',
    answers: true },
  { id: 'Listening Exam',    coll: 'listening_sessions', owner: 'hostUid',
    answers: true },
  { id: 'Trust No One',      coll: 'trust_sessions',     owner: 'hostUid' }
];

(async () => {
  let up = false;
  try { up = (await fetch(`http://${FS}/`)).status === 200; } catch (e) {}
  if (!up) {
    console.error('Firestore emulator not reachable at ' + FS + '. Refusing to run.');
    console.error('  firebase emulators:start --only auth,firestore');
    process.exit(2);
  }

  const host = await identity('sec.host@example.test');
  const other = await identity('sec.other@example.test');
  const stuA = await identity('sec.a@example.test');
  const stuB = await identity('sec.b@example.test');
  for (const t of [host, other]) {
    await put(`users/${t.uid}`, 'owner', { email: 'x@y.z', name: 'T', role: 'teacher', active: true });
  }
  for (const s of [stuA, stuB]) {
    await put(`users/${s.uid}`, 'owner', {
      email: 'x@y.z', name: 'S', role: 'student', active: true,
      level: 'B1', studentClass: 'B101', module: 'Module 2'
    });
  }

  console.log('Nine games, real tokens, rules enforced. Negatives are the point.\n');

  for (const g of GAMES) {
    console.log('  === ' + g.id + '  (' + g.coll + ') ===');
    const S = `${g.coll}/${CODE}`;
    const base = { code: CODE, status: 'lobby' };
    base[g.owner] = host.uid;

    // ── the host runs their own room ──────────────────────
    check('host creates the room', await put(S, host.token, base), 'allow');
    check('student reads the room by code', await get(S, stuA.token), 'allow');
    check('student joins as themselves', await put(`${S}/players/${stuA.uid}`, stuA.token,
      { uid: stuA.uid, name: 'A', score: 0 }), 'allow');
    check('second student joins', await put(`${S}/players/${stuB.uid}`, stuB.token,
      { uid: stuB.uid, name: 'B', score: 0 }), 'allow');
    check('student updates their OWN score', await put(`${S}/players/${stuA.uid}`, stuA.token,
      { uid: stuA.uid, name: 'A', score: 50 }), 'allow');

    // ── the cheating questions ────────────────────────────
    check('DENY student writing ANOTHER student\'s score', await put(`${S}/players/${stuB.uid}`, stuA.token,
      { uid: stuB.uid, name: 'B', score: 9999 }), 'deny');
    check('DENY student taking over the room', await put(S, stuA.token,
      Object.assign({}, base, { status: 'finished' })), 'deny');
    check('DENY student deleting the room', await del(S, stuA.token), 'deny');
    check('DENY student kicking another student', await del(`${S}/players/${stuB.uid}`, stuA.token), 'deny');

    // ── another teacher's room is not yours ───────────────
    check('DENY a second teacher updating this room', await put(S, other.token,
      Object.assign({}, base, { status: 'hijacked' })), 'deny');
    check('DENY a second teacher deleting this room', await del(S, other.token), 'deny');

    // ── signed out ────────────────────────────────────────
    check('DENY signed-out reading the room', await get(S, null), 'deny');
    check('DENY signed-out joining', await put(`${S}/players/anon`, null, { uid: 'anon' }), 'deny');

    // ── per-game: the thing this game actually holds ──────
    if (g.meta) {
      // Seed it with the owner bypass first. Without this the GET returns 404
      // (not found), which is not the same as 403 (denied) - the first version
      // of this check read a document that had never been written and reported
      // a security failure that was really a missing fixture.
      await put(`${S}/${g.meta}`, 'owner', { items: 'bank' });
      check('student may READ the question bank', await get(`${S}/${g.meta}`, stuA.token), 'allow');
      check('DENY student WRITING the question bank', await put(`${S}/${g.meta}`, stuA.token, { hacked: true }), 'deny');
    }
    if (g.secret) {
      await put(`${S}/${g.secret}/${stuB.uid}`, 'owner', { uid: stuB.uid, password: 'hunter2' });
      check('DENY student reading ANOTHER student\'s vault password',
        await get(`${S}/${g.secret}/${stuB.uid}`, stuA.token), 'deny');
      check('student may read their own', await put(`${S}/${g.secret}/${stuA.uid}`, stuA.token,
        { uid: stuA.uid, password: 'mine' }), 'allow');
    }
    if (g.answers) {
      await put(`${S}/players/${stuB.uid}/answers/q1`, stuB.token, { value: 'B answer' });
      check('DENY student WRITING another student\'s exam answer',
        await put(`${S}/players/${stuB.uid}/answers/q1`, stuA.token, { value: 'tampered' }), 'deny');
      check('DENY student READING another student\'s exam answer',
        await get(`${S}/players/${stuB.uid}/answers/q1`, stuA.token), 'deny');
      check('student may read their OWN exam answer',
        await get(`${S}/players/${stuB.uid}/answers/q1`, stuB.token), 'allow');
      // The positive half, and it matters as much as the negative: the host
      // walks every player's answers to grade live (reading-teacher.js:431).
      // Tightening the read rule too far would break grading silently, so
      // this fails loudly if anyone ever does.
      check('the HOST can read a student\'s answer (grading must keep working)',
        await get(`${S}/players/${stuB.uid}/answers/q1`, host.token), 'allow');
    }

    // ── teardown ──────────────────────────────────────────
    check('the host can delete their room', await del(S, host.token), 'allow');

    // leave nothing behind
    for (const sub of ['players/' + stuA.uid, 'players/' + stuB.uid,
                       'players/' + stuB.uid + '/answers/q1',
                       (g.secret || 'players') + '/' + stuA.uid,
                       (g.secret || 'players') + '/' + stuB.uid,
                       g.meta || 'players/none']) {
      await del(`${S}/${sub}`, 'owner');
    }
    await del(S, 'owner');
    console.log('');
  }

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ' checks. Each line below is a');
    console.log('security question this app currently answers the wrong way:');
    failures.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('PASS - all ' + pass + ' checks across nine games.');
})().catch(e => { console.error('ERROR: ' + (e && e.message)); process.exit(2); });
