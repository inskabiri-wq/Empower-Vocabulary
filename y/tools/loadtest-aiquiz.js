#!/usr/bin/env node
/**
 * loadtest-aiquiz.js - the 1000-student rehearsal you can run without 1000 phones.
 *
 * WHY THIS EXISTS
 *
 * The AI Quiz was reviewed for 1000 concurrent students by reading the code and
 * counting document operations. That is worth something, but it is arithmetic,
 * not evidence. This drives the REAL join path over the wire, concurrently, and
 * reports what actually happened.
 *
 * WHAT IT DOES, AND WHAT IT REFUSES TO DO
 *
 * It talks to the local Firebase EMULATOR and nothing else. It checks the
 * emulator is there before it starts and exits if it is not, so it can never be
 * pointed at production by accident. Load-testing the live project would burn
 * real quota, fill the real database with fake students, and could trip Google's
 * abuse protection on the day you least want that.
 *
 * Students are simulated with real anonymous ID tokens from the Auth emulator,
 * so FIRESTORE RULES ARE ENFORCED exactly as they are for a real phone. Only the
 * one-time seeding of the quiz uses the emulator's `owner` bypass, because
 * standing up a teacher account is not what is being measured.
 *
 * It exercises the same four steps a joining student performs:
 *
 *   1. anonymous sign-in                            (Auth)
 *   2. read the session doc by code                 (1 read)
 *   3. write themselves into players/{uid}          (1 write)
 *   4. read the question bank once                  (1 read)
 *
 * then a scoring storm: every student answering the same question at the same
 * moment, as an atomic increment, which is the single most contended write in
 * the game.
 *
 * WHAT IT CANNOT TELL YOU. Read this part.
 *
 *   - the venue wifi. This is the most likely thing to actually break, and no
 *     amount of local testing sees it. Access points commonly cap out around
 *     50 concurrent clients.
 *   - real phone CPU, and the browser's own rendering
 *   - Google's production-side auth quotas, which the emulator does not model
 *
 * USAGE
 *   firebase emulators:start --only auth,firestore      (in another terminal)
 *   node y/tools/loadtest-aiquiz.js                     (defaults to 200)
 *   node y/tools/loadtest-aiquiz.js 1000
 *   node y/tools/loadtest-aiquiz.js 1000 --questions 12
 */

const PROJECT = 'empower-vocabulary-practice';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const COLL = 'aiquiz_sessions';
const DOCS = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

const argv = process.argv.slice(2);
// Parse the flag FIRST and remove it with its value, so the positional student
// count cannot be read as the question count. Left as `find(/^\d+$/)` over the
// raw argv, `--questions` was absent, indexOf returned -1, argv[0] was the
// student count, and an 8-question game silently became a 200-question one.
const qFlag = argv.indexOf('--questions');
const QN = (qFlag >= 0 && /^\d+$/.test(argv[qFlag + 1] || '')) ? Number(argv[qFlag + 1]) : 8;
const positional = argv.filter((a, i) => i !== qFlag && i !== qFlag + 1);
const N = Number(positional.find((a) => /^\d+$/.test(a))) || 200;
// A FRESH code per run. Deriving it from N alone meant two runs at the same
// size shared one session, so anything a previous cleanup failed to remove was
// counted as this run's players: a clean 200-student run reported 250 of 200
// and accused Firestore of losing updates it had never been given.
const CODE = 'LT' + String(N).padStart(4, '0') + '_' + Date.now().toString(36).slice(-5).toUpperCase();

// ── tiny helpers ─────────────────────────────────────────────────────────
const OWNER = { Authorization: 'Bearer owner' };
const asUser = (t) => ({ Authorization: 'Bearer ' + t });

async function j(url, opts) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }
  return { ok: r.ok, status: r.status, body };
}

const S = (v) => ({ stringValue: String(v) });
const I = (v) => ({ integerValue: String(v) });

// List every player doc, following pagination. The REST list endpoint caps the
// page it returns regardless of pageSize and hands back a nextPageToken; a
// single call reported 150 of 200 players and made a clean run look like it had
// lost updates. The harness was wrong, not Firestore.
async function listAllPlayers() {
  const out = [];
  let token = '';
  do {
    const url = `${DOCS}/${COLL}/${CODE}/players?pageSize=300` + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const r = await j(url, { headers: OWNER });
    const body = r.body || {};
    (body.documents || []).forEach((d) => out.push(d));
    token = body.nextPageToken || '';
  } while (token);
  return out;
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function report(label, ms, errs) {
  const ok = ms.slice().sort((a, b) => a - b);
  const line = (k, v) => console.log('    ' + k.padEnd(22) + v);
  console.log('\n  ' + label);
  line('succeeded', `${ms.length} / ${ms.length + errs.length}`);
  if (ms.length) {
    line('median', pct(ok, 50).toFixed(0) + ' ms');
    line('p95', pct(ok, 95).toFixed(0) + ' ms');
    line('slowest', ok[ok.length - 1].toFixed(0) + ' ms');
  }
  if (errs.length) {
    const tally = {};
    errs.forEach((e) => { tally[e] = (tally[e] || 0) + 1; });
    Object.keys(tally).forEach((k) => line('FAILED: ' + k, tally[k]));
  }
  return errs.length;
}

// Run `fn` for every item with a ceiling on how many are in flight at once.
// Real students do not arrive in one instantaneous burst, and an unbounded
// 1000-way fan-out measures Node's socket pool rather than Firestore.
async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

// ── safety: emulator or nothing ──────────────────────────────────────────
async function assertEmulator() {
  if (!/^(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|$)/.test(FS) ||
      !/^(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|$)/.test(AUTH)) {
    console.error('REFUSING TO RUN: the emulator hosts are not local.\n' +
                  `  firestore=${FS}\n  auth=${AUTH}\n` +
                  'This tool never runs against the live project.');
    process.exit(2);
  }
  try {
    const r = await fetch(`http://${FS}/`);
    if (!r.ok && r.status !== 404) throw new Error('status ' + r.status);
  } catch (e) {
    console.error('Cannot reach the Firestore emulator at ' + FS + '.\n' +
                  'Start it first, from E:\\vocab-trainer:\n\n' +
                  '  firebase emulators:start --only auth,firestore\n');
    process.exit(2);
  }
}

// ── seed one quiz, the way the teacher page would ────────────────────────
async function seed() {
  const items = Array.from({ length: QN }, (_, k) => ({
    mapValue: { fields: {
      q: S('Load test question ' + (k + 1)),
      a: { arrayValue: { values: [S('alpha'), S('bravo'), S('charlie'), S('delta')] } },
      correct: I(k % 4)
    } }
  }));

  await j(`${DOCS}/${COLL}?documentId=${CODE}`, {
    method: 'POST', headers: { ...OWNER, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      status: S('lobby'), currentQuestion: I(-1),
      hostName: S('Load test'), createdAt: { timestampValue: new Date().toISOString() }
    } })
  });

  await j(`${DOCS}/${COLL}/${CODE}/meta?documentId=questions`, {
    method: 'POST', headers: { ...OWNER, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { items: { arrayValue: { values: items } } } })
  });
}

async function cleanup() {
  // The emulator has no recursive delete over REST; players are removed one by
  // one. Harmless either way, since emulator data dies with the process.
  const docs = await listAllPlayers();
  await pool(docs, 32, (d) => j(`http://${FS}/v1/${d.name}`, { method: 'DELETE', headers: OWNER }));
  await j(`${DOCS}/${COLL}/${CODE}/meta/questions`, { method: 'DELETE', headers: OWNER });
  await j(`${DOCS}/${COLL}/${CODE}`, { method: 'DELETE', headers: OWNER });
}

// ── the run ──────────────────────────────────────────────────────────────
(async function main() {
  await assertEmulator();

  console.log('='.repeat(66));
  console.log('  AI Quiz load test - ' + N + ' students, ' + QN + ' questions');
  console.log('  emulator only: firestore=' + FS + '  auth=' + AUTH);
  console.log('='.repeat(66));

  await seed();
  console.log('\n  seeded session ' + CODE);

  const CONC = Math.min(64, N);
  let problems = 0;
  const t0 = Date.now();

  // 1. anonymous sign-in
  const signMs = [], signErr = [], students = [];
  await pool(Array.from({ length: N }, (_, i) => i), CONC, async () => {
    const t = Date.now();
    const r = await j(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    if (r.ok && r.body && r.body.idToken) {
      signMs.push(Date.now() - t);
      students.push({ uid: r.body.localId, token: r.body.idToken });
    } else signErr.push('auth ' + r.status);
  });
  problems += report('1. anonymous sign-in', signMs, signErr);

  // 2. read the session doc by code
  const readMs = [], readErr = [];
  await pool(students, CONC, async (s) => {
    const t = Date.now();
    const r = await j(`${DOCS}/${COLL}/${CODE}`, { headers: asUser(s.token) });
    if (r.ok) readMs.push(Date.now() - t); else readErr.push('read ' + r.status);
  });
  problems += report('2. read the session by code', readMs, readErr);

  // 3. write themselves into players/{uid}
  const joinMs = [], joinErr = [];
  await pool(students, CONC, async (s, i) => {
    const t = Date.now();
    const r = await j(`${DOCS}/${COLL}/${CODE}/players/${s.uid}`, {
      method: 'PATCH', headers: { ...asUser(s.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { name: S('Student ' + (i + 1)), score: I(0) } })
    });
    if (r.ok) joinMs.push(Date.now() - t);
    else joinErr.push('join ' + r.status + (r.status === 403 ? ' (rules)' : ''));
  });
  problems += report('3. join (write players/{uid})', joinMs, joinErr);

  // 4. read the question bank once
  const qMs = [], qErr = [];
  await pool(students, CONC, async (s) => {
    const t = Date.now();
    const r = await j(`${DOCS}/${COLL}/${CODE}/meta/questions`, { headers: asUser(s.token) });
    if (r.ok) qMs.push(Date.now() - t); else qErr.push('questions ' + r.status);
  });
  problems += report('4. read the question bank', qMs, qErr);

  // 5. the scoring storm: everyone answers the same question at once.
  const scoreMs = [], scoreErr = [];
  const sTime = Date.now();
  await pool(students, CONC, async (s) => {
    const t = Date.now();
    const r = await j(`${DOCS}:commit`, {
      method: 'POST', headers: { ...asUser(s.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [{
        transform: {
          document: `projects/${PROJECT}/databases/(default)/documents/${COLL}/${CODE}/players/${s.uid}`,
          fieldTransforms: [{ fieldPath: 'score', increment: I(100) }]
        }
      }] })
    });
    if (r.ok) scoreMs.push(Date.now() - t); else scoreErr.push('score ' + r.status);
  });
  const stormMs = Date.now() - sTime;
  problems += report('5. scoring storm (atomic increment)', scoreMs, scoreErr);
  console.log('    ' + 'whole storm'.padEnd(22) + stormMs + ' ms for ' + scoreMs.length + ' writes');

  // 6. did the increments actually land? This is the correctness check that
  //    matters: a lost update here is a student whose score silently vanishes.
  const players = await listAllPlayers();
  const scores = players.map((d) => Number((((d.fields || {}).score) || {}).integerValue || 0));
  const at100 = scores.filter((v) => v === 100).length;
  console.log('\n  6. correctness after the storm');
  console.log('    ' + 'player docs'.padEnd(22) + players.length + ' / ' + students.length);
  console.log('    ' + 'scored exactly 100'.padEnd(22) + at100 + ' / ' + scores.length);
  if (players.length !== students.length || at100 !== scores.length) {
    console.log('    ' + 'LOST UPDATES'.padEnd(22) + 'yes - investigate before the event');
    problems++;
  } else {
    console.log('    ' + 'lost updates'.padEnd(22) + 'none');
  }

  // ── the budget arithmetic, from the run rather than from a guess ────────
  const perStudent = 2 + 1 + 1;                 // 2 reads, 1 join write, +1 read
  const perQuestion = 1 + 1;                    // 1 listener tick, 1 score write
  const total = N * (perStudent + QN * perQuestion);
  console.log('\n  document operations for one full game of this size');
  console.log('    ' + 'per student, joining'.padEnd(22) + perStudent);
  console.log('    ' + 'per student, per Q'.padEnd(22) + perQuestion);
  console.log('    ' + `total (${N} x ${QN}Q)`.padEnd(22) + total.toLocaleString());
  console.log('    ' + 'Firestore free tier'.padEnd(22) + '50,000 reads + 20,000 writes / day');

  await cleanup();

  console.log('\n' + '='.repeat(66));
  console.log(problems
    ? `  ${problems} stage(s) had failures. Do not treat this as a pass.`
    : '  All stages passed with no failures and no lost updates.');
  console.log('  Wall clock: ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log('\n  STILL UNTESTED, and it is the likeliest thing to break:');
  console.log('  the venue wifi. Ask FSMVU IT for the access point model and its');
  console.log('  concurrent client limit before the day.');
  console.log('='.repeat(66));
  process.exit(problems ? 1 : 0);
})();
