#!/usr/bin/env node
'use strict';
/* ============================================================
   games-scoring-check.js - does a right answer actually beat a wrong one?
   ------------------------------------------------------------
   WHY

   The project checks a lot of structure and almost no arithmetic. "The
   correct answer is always option A" survived in production because nothing
   ever asked whether playing the game produced the right number.

   This asks. Three ways:

   A. THE FORMULAS, EXTRACTED FROM SOURCE AND EXECUTED. Not a copy that can
      drift: the expression text is pulled out of the shipped file and eval'd,
      so if someone edits the formula this runs the edited one. If the line
      cannot be found at all the check fails loudly, which is the right
      outcome - a changed scoring formula deserves a fresh look.

   B. LEADERBOARD ORDERING, against the emulator, using the same
      orderBy('score','desc') the hosts actually run.

   C. INCREMENT SEMANTICS. Several games comment that an atomic increment
      means "two answers can never race". That is a claim about Firestore
      under concurrency, and it is testable.

   Sections B and C need the emulator; A does not. Without it, A still runs
   and B/C report as skipped rather than quietly passing.

   Usage:  node y/tools/games-scoring-check.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Y = path.join(__dirname, '..');
const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const DOCS = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

let pass = 0, fail = 0, skip = 0;
const failures = [];
function ok(m) { pass++; console.log('  ok    ' + m); }
function bad(m, d) { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); }
function skipped(m) { skip++; console.log('  skip  ' + m); }

/* Pull the right-hand side of an assignment out of a shipped file and make it
   callable. `marker` must appear on the line; `vars` are the names the
   expression uses. */
function formulaFrom(relFile, marker, vars) {
  const file = path.join(Y, relFile);
  if (!fs.existsSync(file)) return { err: 'file not found: ' + relFile };
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.indexOf(marker) !== -1);
  if (!line) return { err: 'line not found in ' + relFile + ' containing: ' + marker };
  const eq = line.indexOf('=');
  if (eq === -1) return { err: 'no assignment on that line: ' + line.trim().slice(0, 70) };
  let expr = line.slice(eq + 1).trim().replace(/;\s*$/, '');
  const box = { Math };
  vm.createContext(box);
  try {
    const fn = vm.runInContext('(function(' + vars.join(',') + '){ return (' + expr + '); })', box);
    return { fn, expr };
  } catch (e) { return { err: 'could not compile: ' + e.message.slice(0, 70) }; }
}

// ── A. the formulas ───────────────────────────────────────────
console.log('A. scoring formulas, extracted from the shipped files and executed\n');

// AI Quiz: gained = correct ? (100 + Math.round(50 * frac)) : 0
(function aiquiz() {
  const f = formulaFrom('classroom/js/aiquiz-student.js', 'var gained = correct ?', ['correct', 'frac']);
  if (f.err) { bad('AI Quiz formula: ' + f.err); return; }
  console.log('       AI Quiz  ->  ' + f.expr);
  if (f.fn(false, 1) === 0 && f.fn(false, 0) === 0) ok('AI Quiz: a wrong answer scores 0, at any speed');
  else bad('AI Quiz: a WRONG answer scored ' + f.fn(false, 1));

  const fast = f.fn(true, 1), slow = f.fn(true, 0), mid = f.fn(true, 0.5);
  if (fast > 0 && slow > 0) ok('AI Quiz: a correct answer always scores something (' + slow + ' to ' + fast + ')');
  else bad('AI Quiz: a correct answer scored 0 somewhere', 'fast=' + fast + ' slow=' + slow);

  if (fast > mid && mid > slow) ok('AI Quiz: faster is worth more (' + slow + ' < ' + mid + ' < ' + fast + ')');
  else bad('AI Quiz: the speed bonus is not monotonic', 'slow=' + slow + ' mid=' + mid + ' fast=' + fast);

  let mono = true;
  for (let i = 1; i <= 100; i++) { if (f.fn(true, i / 100) < f.fn(true, (i - 1) / 100)) mono = false; }
  if (mono) ok('AI Quiz: monotonic across 100 steps of the clock');
  else bad('AI Quiz: score DROPS somewhere as time-left increases');
})();

// Scramble: points = ok ? 100 + secondsLeft * 2 : 0
(function scramble() {
  const f = formulaFrom('classroom/js/scramble-student.js', 'const points = ok ?', ['ok', 'secondsLeft']);
  if (f.err) { bad('Scramble formula: ' + f.err); return; }
  console.log('       Scramble ->  ' + f.expr);
  if (f.fn(false, 40) === 0) ok('Scramble: a wrong answer scores 0');
  else bad('Scramble: a WRONG answer scored ' + f.fn(false, 40));
  if (f.fn(true, 0) > 0) ok('Scramble: a correct answer with no time left still scores (' + f.fn(true, 0) + ')');
  else bad('Scramble: a correct-but-slow answer scored 0');
  if (f.fn(true, 40) > f.fn(true, 10)) ok('Scramble: faster is worth more (' + f.fn(true, 10) + ' < ' + f.fn(true, 40) + ')');
  else bad('Scramble: the speed bonus does not increase with time left');
})();

// Tug of War: increment(ok ? 1 : 0)
(function tug() {
  const file = path.join(Y, 'classroom/js/tug-student.js');
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.indexOf('increment(ok ?') !== -1);
  if (!line) { bad('Tug: the scoring increment line was not found'); return; }
  const m = line.match(/increment\(\s*ok\s*\?\s*([0-9]+)\s*:\s*([0-9]+)\s*\)/);
  if (!m) { bad('Tug: could not read the increment', line.trim().slice(0, 70)); return; }
  console.log('       Tug      ->  increment(ok ? ' + m[1] + ' : ' + m[2] + ')');
  if (Number(m[2]) === 0) ok('Tug: a wrong answer adds 0');
  else bad('Tug: a WRONG answer adds ' + m[2]);
  if (Number(m[1]) > 0) ok('Tug: a correct answer adds ' + m[1]);
  else bad('Tug: a correct answer adds nothing');
})();

// Bingo: a mark is worth less than a bingo
(function bingo() {
  const src = fs.readFileSync(path.join(Y, 'classroom/js/bingo-student.js'), 'utf8');
  const nums = (src.match(/increment\(\s*(\d+)\s*\)/g) || []).map(s => Number(s.replace(/\D/g, '')));
  if (nums.length < 2) { bad('Bingo: expected at least two score increments, found ' + nums.length); return; }
  const mark = Math.min.apply(null, nums), bingo = Math.max.apply(null, nums);
  console.log('       Bingo    ->  mark +' + mark + ', bingo +' + bingo);
  if (mark > 0) ok('Bingo: marking a called word scores (' + mark + ')');
  else bad('Bingo: marking scores nothing');
  if (bingo > mark) ok('Bingo: a bingo is worth more than a single mark (' + bingo + ' > ' + mark + ')');
  else bad('Bingo: a bingo is not worth more than a mark');
})();

// ── B and C need the emulator ─────────────────────────────────
//
// Via the Admin SDK, not raw REST. The first version used the REST
// `documents:runQuery` endpoint and HUNG: runQuery streams its results and a
// plain fetch never settles on it, so the whole check produced no output at
// all, not even section A, because stdout was still buffered when it stalled.
// The SDK handles the stream, and it is what retention-check.js already uses.
(async () => {
  let up = false;
  try { up = (await fetch(`http://${FS}/`)).status === 200; } catch (e) {}

  console.log('\nB. leaderboard ordering, against the emulator');
  console.log('C. increment semantics under concurrency\n');

  if (!up) {
    skipped('leaderboard ordering (emulator not running)');
    skipped('increment semantics (emulator not running)');
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = FS;
    process.env.GCLOUD_PROJECT = PROJECT;
    let admin;
    try { admin = require(path.join(Y, '..', 'functions', 'node_modules', 'firebase-admin')); }
    catch (e) { bad('could not load firebase-admin: ' + e.message.slice(0, 60)); admin = null; }

    if (admin) {
      admin.initializeApp({ projectId: PROJECT });
      const db = admin.firestore();
      const players = db.collection('aiquiz_sessions').doc('SCOR1').collection('players');

      // ── B. ordering, using the host's own query shape ────
      const want = [['p_top', 900], ['p_mid', 450], ['p_low', 120], ['p_zero', 0]];
      for (const [id, score] of want) await players.doc(id).set({ uid: id, name: id, score });

      const snap = await players.orderBy('score', 'desc').limit(10).get();
      const rows = snap.docs.map(d => d.id);
      const order = rows.join(' > ');
      if (order === 'p_top > p_mid > p_low > p_zero') ok('leaderboard orders highest first  (' + order + ')');
      else bad('leaderboard order is wrong', 'got: ' + order);
      if (rows[0] === 'p_top') ok('the winner is the top scorer');
      else bad('the winner is not the top scorer');

      // ── C. increments ───────────────────────────────────
      const P = players.doc('p_inc');
      await P.set({ uid: 'p_inc', name: 'inc', score: 0 });
      const INC = (by) => P.update({ score: admin.firestore.FieldValue.increment(by) });

      await INC(0);
      let got = (await P.get()).get('score');
      if (got === 0) ok('increment(0) leaves the score unchanged (a wrong answer costs nothing)');
      else bad('increment(0) changed the score to ' + got);

      // Several games comment that an atomic increment means two answers can
      // never race. 25 at once, every one must land.
      await Promise.all(Array.from({ length: 25 }, () => INC(100)));
      got = (await P.get()).get('score');
      if (got === 2500) ok('25 simultaneous increments all landed (2500, no lost updates)');
      else bad('concurrent increments LOST updates', 'expected 2500, got ' + got);

      // A wrong answer in AI Quiz writes increment(0) alongside answeredQ, so
      // the score must survive that untouched.
      await P.update({ score: admin.firestore.FieldValue.increment(0), answeredQ: 3 });
      got = (await P.get()).get('score');
      if (got === 2500) ok('a wrong-answer write (increment 0 + answeredQ) does not disturb the score');
      else bad('a wrong-answer write changed the score to ' + got);

      for (const [id] of want) await players.doc(id).delete();
      await P.delete();
      await db.collection('aiquiz_sessions').doc('SCOR1').delete();
    }
  }

  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
    failures.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('PASS - ' + pass + ' scoring checks' + (skip ? ', ' + skip + ' skipped (no emulator)' : '') + '.');
})().catch(e => { console.error('ERROR: ' + (e && e.message)); process.exit(2); });
