#!/usr/bin/env node
'use strict';
/* ============================================================
   grandfather-closed-check.js - the ownership loopholes stay shut.
   ------------------------------------------------------------
   A "grandfather" here is a rule that GRANTED access because an ownership
   field was MISSING, rather than because the caller proved ownership. Seven
   of them were live, every one proven exploitable against the emulator with
   a real second teacher's ID token:

     _ownsClassroomSession   createdBy   classroom_sessions
     the inline player-kick rule         classroom_sessions/players
     _ownsHeistSession       hostUid     heist_sessions
     _ownsTrustSession       hostUid     trust_sessions
     _ownsMiniSession        hostUid     tug / bingo / scramble / aiquiz
     _ownsReadingSession     hostUid     reading_sessions
     _ownsListeningSession   hostUid     listening_sessions

   This re-runs the exact exploit and asserts it now FAILS, and it checks the
   other direction too: a real owner must still be able to run their own room.
   A rules change that denied everything would make the exploit test pass for
   the wrong reason, so both directions are required.

   EMULATOR ONLY. Push the current rules first:
     node <scratchpad>/push-rules.js
   Usage:
     node y/tools/grandfather-closed-check.js
   ============================================================ */

const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const DOCS = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

let pass = 0, fail = 0;
const failed = [];
function check(name, status, expected) {
  const allowed = status >= 200 && status < 300;
  const good = expected === 'allow' ? allowed : status === 403;
  if (good) { pass++; console.log('  ok    ' + name); }
  else { fail++; failed.push(name); console.log('  FAIL  ' + name + '  (expected ' + expected + ', got ' + status + ')'); }
}
function fval(v) {
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  return { stringValue: String(v) };
}
function fdoc(o) { const f = {}; Object.keys(o).forEach(k => { f[k] = fval(o[k]); }); return { fields: f }; }
async function req(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(`${DOCS}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return r.status;
}
const write = (p, t, o) => req('PATCH', p, t, fdoc(o));
const del = (p, t) => req('DELETE', p, t);

async function identity(email) {
  const base = `http://${AUTH}/identitytoolkit.googleapis.com/v1`;
  const post = async (path, body) => (await fetch(`${base}/${path}?key=emulator`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })).json();
  let j = await post('accounts:signUp', { email, password: 'Passw0rd!', returnSecureToken: true });
  if (!j.idToken && j.error && /EMAIL_EXISTS/.test(j.error.message || '')) {
    j = await post('accounts:signInWithPassword', { email, password: 'Passw0rd!', returnSecureToken: true });
  }
  if (!j.idToken) throw new Error('token: ' + JSON.stringify(j).slice(0, 140));
  return { uid: j.localId, token: j.idToken };
}

// collection, ownership field, helper it exercises
const CASES = [
  ['classroom_sessions', 'createdBy', '_ownsClassroomSession'],
  ['heist_sessions',     'hostUid',   '_ownsHeistSession'],
  ['trust_sessions',     'hostUid',   '_ownsTrustSession'],
  ['tug_sessions',       'hostUid',   '_ownsMiniSession'],
  ['bingo_sessions',     'hostUid',   '_ownsMiniSession'],
  ['scramble_sessions',  'hostUid',   '_ownsMiniSession'],
  ['aiquiz_sessions',    'hostUid',   '_ownsMiniSession (AI QUIZ)'],
  ['reading_sessions',   'hostUid',   '_ownsReadingSession'],
  ['listening_sessions', 'hostUid',   '_ownsListeningSession'],
];
const OWNERLESS = 'GFNONE';
const OWNED = 'GFOWNED';

(async () => {
  let up = false;
  try { up = (await fetch(`http://${FS}/`)).status === 200; } catch (e) {}
  if (!up) { console.error('Firestore emulator not reachable. Refusing to run.'); process.exit(2); }

  const owner = await identity('gf.owner@example.test');
  const other = await identity('gf.other@example.test');
  for (const who of [owner, other]) {
    await write(`users/${who.uid}`, 'owner', { email: 'x@y.z', name: 'GF', role: 'teacher', active: true });
  }

  console.log('Ownership grandfathers: the exploit must fail, the owner must still work\n');

  for (const [coll, field, helper] of CASES) {
    // Seed with the owner bypass: one session with NO ownership field (the
    // legacy shape the grandfather used to wave through), one properly owned.
    await write(`${coll}/${OWNERLESS}`, 'owner', { code: OWNERLESS, status: 'lobby' });
    const ownedDoc = { code: OWNED, status: 'lobby' };
    ownedDoc[field] = owner.uid;
    await write(`${coll}/${OWNED}`, 'owner', ownedDoc);

    // THE EXPLOIT: a different teacher touching the ownerless session.
    check(`${coll}: DENY other teacher UPDATE of ownerless doc  [${helper}]`,
      await write(`${coll}/${OWNERLESS}`, other.token, { code: OWNERLESS, status: 'hijacked' }), 'deny');
    check(`${coll}: DENY other teacher DELETE of ownerless doc`,
      await del(`${coll}/${OWNERLESS}`, other.token), 'deny');

    // THE OTHER DIRECTION: the real owner must still control their own room.
    const upd = Object.assign({}, ownedDoc, { status: 'active' });
    check(`${coll}: ALLOW the real owner to update their own room`,
      await write(`${coll}/${OWNED}`, owner.token, upd), 'allow');
    check(`${coll}: DENY other teacher UPDATE of an OWNED room`,
      await write(`${coll}/${OWNED}`, other.token, upd), 'deny');
    check(`${coll}: ALLOW the real owner to delete their own room`,
      await del(`${coll}/${OWNED}`, owner.token), 'allow');

    await del(`${coll}/${OWNERLESS}`, 'owner');
    await del(`${coll}/${OWNED}`, 'owner');
  }

  // The player-kick rule: the orphaned-roster case that was the widest hole.
  await write(`classroom_sessions/${OWNED}`, 'owner', { code: OWNED, createdBy: owner.uid });
  await write(`classroom_sessions/${OWNED}/players/s1`, 'owner', { uid: 's1', name: 'S' });
  check('players: ALLOW the session owner to kick a player',
    await del(`classroom_sessions/${OWNED}/players/s1`, owner.token), 'allow');

  await write(`classroom_sessions/${OWNED}/players/s2`, 'owner', { uid: 's2', name: 'S' });
  check('players: DENY another teacher kicking from an OWNED session',
    await del(`classroom_sessions/${OWNED}/players/s2`, other.token), 'deny');

  // Orphaned roster: parent session deleted, players left behind. This is the
  // normal end state of every game, and used to be open to any teacher.
  await del(`classroom_sessions/${OWNED}`, 'owner');
  await write(`classroom_sessions/${OWNED}/players/s3`, 'owner', { uid: 's3', name: 'S' });
  check('players: DENY any teacher kicking from an ORPHANED session (parent deleted)',
    await del(`classroom_sessions/${OWNED}/players/s3`, other.token), 'deny');
  await del(`classroom_sessions/${OWNED}/players/s3`, 'owner');

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
    failed.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('PASS - all ' + pass + ' checks: every grandfather is shut, and every owner still controls their own room.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(2); });
