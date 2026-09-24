#!/usr/bin/env node
'use strict';
/* ============================================================
   games-answer-check.js - can a student score well by guessing a position?
   ------------------------------------------------------------
   WHY

   Every AI Quiz question was authored with the correct option first
   (`answer: 0` in all 22) and nothing shuffled them, so tapping A twenty
   times scored 100%. It reached production, in the game chosen for a
   1000-student event, and the six-track benchmark did not find it. A person
   asking a good question did.

   That bug has a shape, and the shape is what this checks for across EVERY
   source of multiple-choice questions in the app:

     a bank authored with the answer in a fixed slot,
     consumed by code that does not shuffle.

   Either half alone is fine. A fixed-slot bank is fine if the consumer
   shuffles (which is how AI Quiz was fixed). An unshuffling consumer is fine
   if the bank is authored with the answers spread (which is what the grammar
   bank does). Both together is the bug.

   WHAT IT CHECKS

   1. The grammar bank (GRAMMAR_PRACTICE, 5541 questions). MG.grammarMCQs
      passes `q.answer` straight through without shuffling, so this bank MUST
      be spread at authoring time.
   2. MG.vocabMCQs, executed for real, not read. It builds options at runtime
      and must spread the answer across positions.
   3. Every reading and listening exam JSON. Letter answers ("a".."d") must
      not cluster in one slot.

   No emulator needed; this reads and executes source.
   Usage:  node y/tools/games-answer-check.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Y = path.join(__dirname, '..');
let pass = 0, fail = 0;
const failures = [];
function ok(m) { pass++; console.log('  ok    ' + m); }
function bad(m, d) { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); }

// A distribution is "guessable" when one slot carries far more than its share.
// Uniform over N options is 1/N; anything past 45% of the total is a red flag
// regardless of N, and a single slot holding everything is the AI Quiz bug.
function judge(name, counts, total, tolerance) {
  const slots = Object.keys(counts);
  if (!total) { bad(name + ': no questions found'); return; }
  const top = Math.max.apply(null, Object.values(counts));
  const share = top / total;
  const shown = slots.sort().map(k => k + ':' + counts[k]).join('  ');
  if (slots.length <= 1) {
    bad(name + ' is GUESSABLE - every answer sits in slot ' + slots[0],
      total + ' questions, all in one position');
  } else if (share > (tolerance || 0.45)) {
    bad(name + ' is SKEWED - ' + (share * 100).toFixed(1) + '% share in one slot', shown);
  } else {
    ok(name + '  ' + total + ' questions, top slot ' + (share * 100).toFixed(1) + '%  [' + shown + ']');
  }
}

// ── 1. the grammar bank ───────────────────────────────────────
(function grammarBank() {
  const src = path.join(Y, 'student', 'js', 'skills', 'grammar-content.js');
  if (!fs.existsSync(src)) { bad('grammar bank: file not found at ' + src); return; }
  const box = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.createContext(box);
  try { vm.runInContext(fs.readFileSync(src, 'utf8'), box, { timeout: 30000 }); }
  catch (e) { bad('grammar bank: could not evaluate - ' + e.message.slice(0, 80)); return; }
  const GP = box.window.GRAMMAR_PRACTICE;
  if (!GP || !GP.byLevel) { bad('grammar bank: GRAMMAR_PRACTICE not exposed'); return; }
  const counts = {}; let total = 0;
  Object.keys(GP.byLevel).forEach(l => (GP.byLevel[l] || []).forEach(t =>
    (t.questions || []).forEach(q => { counts[q.answer] = (counts[q.answer] || 0) + 1; total++; })));
  judge('grammar bank (consumed UNSHUFFLED by MG.grammarMCQs)', counts, total);
})();

// ── 2. MG.vocabMCQs, executed ─────────────────────────────────
(function vocabBuilder() {
  const src = path.join(Y, 'classroom', 'js', 'minigame-core.js');
  if (!fs.existsSync(src)) { bad('minigame-core: not found'); return; }
  // It touches document at call time, not load time, but stub enough that
  // loading cannot throw.
  const stubEl = { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} };
  const box = {
    window: {}, MG: undefined,
    document: {
      createElement: () => Object.assign({}, stubEl),
      body: Object.assign({}, stubEl),
      addEventListener() {}, getElementById: () => null,
      querySelector: () => null, querySelectorAll: () => []
    },
    localStorage: { getItem: () => null, setItem() {} },
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, Math, Date, JSON, Array, Object, String, Number
  };
  box.window.document = box.document;
  vm.createContext(box);
  try { vm.runInContext(fs.readFileSync(src, 'utf8'), box, { timeout: 20000 }); }
  catch (e) { bad('minigame-core: could not evaluate - ' + e.message.slice(0, 90)); return; }
  const MG = box.window.MG;
  if (!MG || typeof MG.vocabMCQs !== 'function') { bad('MG.vocabMCQs not exposed'); return; }

  // A synthetic wordlist in the shape vocabPool expects.
  const words = [];
  for (let i = 0; i < 60; i++) {
    words.push({ word: 'word' + i, def: 'definition number ' + i,
      ex: 'A sentence containing word' + i + ' inside it.', unit: 'Unit 1', level: 'B1' });
  }
  const vocabulary = { 'B1': words };
  const counts = {}; let total = 0;
  for (let run = 0; run < 40; run++) {
    let qs = [];
    try { qs = MG.vocabMCQs(vocabulary, 'B1', 'all', 20) || []; }
    catch (e) { bad('MG.vocabMCQs threw: ' + e.message.slice(0, 80)); return; }
    qs.forEach(q => {
      if (typeof q.answer !== 'number') return;
      counts[q.answer] = (counts[q.answer] || 0) + 1; total++;
    });
  }
  if (!total) { bad('MG.vocabMCQs produced no questions from the synthetic wordlist'); return; }
  judge('MG.vocabMCQs (built at runtime)', counts, total);
})();

// ── 3. the reading and listening exam JSONs ───────────────────
(function examJson() {
  const roots = [path.join(Y, 'student', 'data', 'readings'),
                 path.join(Y, 'student', 'data', 'listening')];
  const files = [];
  roots.forEach(function walkRoot(root) {
    if (!fs.existsSync(root)) return;
    (function walk(d) {
      fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.json$/i.test(e.name)) files.push(p);
      });
    })(root);
  });
  if (!files.length) { ok('exam JSONs: none found to check'); return; }

  const counts = {}; let total = 0, parsed = 0;
  const skewed = [];
  files.forEach(f => {
    let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return; }
    parsed++;
    const mine = {}; let n = 0;
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 8) return;
      if (Array.isArray(o)) return o.forEach(x => walk(x, depth + 1));
      // Only count LETTER answers: those are positional and therefore
      // guessable. Free-text answers cannot be guessed by slot.
      if (typeof o.answer === 'string' && /^[a-hA-H]$/.test(o.answer.trim())) {
        const k = o.answer.trim().toLowerCase();
        counts[k] = (counts[k] || 0) + 1; total++;
        mine[k] = (mine[k] || 0) + 1; n++;
      }
      Object.keys(o).forEach(k => walk(o[k], depth + 1));
    })(j, 0);

    // PER FILE, not just in aggregate. Found by deliberately breaking this
    // check: a whole exam authored with every answer in slot "a" raised the
    // corpus top slot from 26.5% to only 28.9% and sailed through. One bad
    // exam is exactly the AI Quiz bug, and it must not be able to hide in
    // the average of 46 good ones.
    //
    // Needs at least 10 answers before judging: a 4-question section can
    // legitimately land a,a,b,a by chance.
    if (n >= 10) {
      const top = Math.max.apply(null, Object.values(mine)) / n;
      if (top > 0.7) {
        skewed.push(path.basename(path.dirname(f)) + '/' + path.basename(f) +
          '  ' + n + ' answers, ' + (top * 100).toFixed(0) + '% in one slot  ' +
          Object.keys(mine).sort().map(k => k + ':' + mine[k]).join(' '));
      }
    }
  });
  console.log('  (' + parsed + ' exam files parsed)');
  if (!total) { ok('exam JSONs: no letter-style answers to skew'); return; }
  judge('reading/listening exam answer letters, overall', counts, total, 0.40);
  if (skewed.length) {
    bad('individual exams whose answers cluster in one slot', skewed.join('\n        '));
  } else {
    ok('no single exam clusters its answers (checked each file with 10+ letter answers)');
  }
})();

console.log('');
if (fail) {
  console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
  failures.forEach(f => console.log('   - ' + f));
  console.log('\nA student could score above chance by always picking the same slot.');
  process.exit(1);
}
console.log('PASS - all ' + pass + ' question sources spread the correct answer.');
