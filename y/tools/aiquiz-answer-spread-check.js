#!/usr/bin/env node
'use strict';
/* ============================================================
   aiquiz-answer-spread-check.js - the right answer must not always be first.
   ------------------------------------------------------------
   THE BUG THIS EXISTS TO CATCH

   classroom/js/ai-quiz-questions.js authors every question with the correct
   option first (`answer: 0` in all 22, which is the readable way to write
   them). Nothing shuffled them before they reached the phones, so the first
   button was always right: a student could score 100% by tapping A twenty
   times without reading anything. In the game chosen for a 1000-student
   event.

   WHAT THIS CHECKS

   1. The bank really is authored answer-first, so the shuffle is load-bearing
      and not decorative. If someone later hand-shuffles the bank instead,
      this reports it rather than silently passing.
   2. aiquiz-teacher.js still applies shuffleOptions at room creation, and
      still writes the SHUFFLED list (`questions`) to meta/questions rather
      than the raw `picked`, so the projector and the phones agree.
   3. The REAL shuffleOptions function, extracted from the shipped file and
      executed here, keeps the correct option correct: over many trials, the
      option sitting at the returned `answer` index is always the same option
      that was correct before the shuffle.
   4. Over many trials the correct index is actually spread across positions,
      not stuck at 0.

   Point 3 executes the shipped source rather than a copy, so this cannot pass
   while the real function is broken.

   Usage:  node y/tools/aiquiz-answer-spread-check.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'classroom', 'js');
const TEACHER = path.join(ROOT, 'aiquiz-teacher.js');
const BANK = path.join(ROOT, 'ai-quiz-questions.js');

let failures = 0;
function ok(msg) { console.log('  ok    ' + msg); }
function bad(msg) { failures++; console.log('  FAIL  ' + msg); }

// ── 1. the bank is authored answer-first ─────────────────────
const bankSrc = fs.readFileSync(BANK, 'utf8');
const answers = (bankSrc.match(/answer:\s*(\d+)/g) || []).map(s => parseInt(s.replace(/\D/g, ''), 10));
if (!answers.length) {
  bad('no `answer:` fields found in ai-quiz-questions.js - has the bank format changed?');
} else if (answers.every(a => a === 0)) {
  ok('bank is authored answer-first (' + answers.length + ' questions, all answer: 0) so the shuffle is load-bearing');
} else {
  const spread = {};
  answers.forEach(a => { spread[a] = (spread[a] || 0) + 1; });
  ok('bank answers are already spread ' + JSON.stringify(spread) + ' - shuffle still required, just no longer the only defence');
}

// ── 2. the host still applies it, and ships the shuffled list ──
const teacherSrc = fs.readFileSync(TEACHER, 'utf8');
if (/questions\s*=\s*picked\.map\(\s*shuffleOptions\s*\)/.test(teacherSrc)) {
  ok('createRoom shuffles: questions = picked.map(shuffleOptions)');
} else {
  bad('createRoom no longer shuffles. Expected `questions = picked.map(shuffleOptions)`.');
}
// The meta write must use the shuffled array, not the raw pick.
const metaBlock = teacherSrc.slice(teacherSrc.indexOf("meta').doc('questions')"), teacherSrc.length);
const metaHead = metaBlock.slice(0, 400);
if (/items:\s*questions\.map/.test(metaHead)) {
  ok('meta/questions is written from the shuffled `questions`');
} else if (/items:\s*picked\.map/.test(metaHead)) {
  bad('meta/questions is written from the RAW `picked`. The phones and the projector would disagree.');
} else {
  bad('could not tell which array meta/questions is written from - check aiquiz-teacher.js by hand.');
}

// ── 3+4. execute the REAL shuffleOptions ─────────────────────
const fnMatch = teacherSrc.match(/function shuffleOptions\(q\)\s*\{[\s\S]*?\n  \}/);
if (!fnMatch) {
  bad('shuffleOptions not found in aiquiz-teacher.js - cannot execute it.');
} else {
  // Same Fisher-Yates copy that minigame-core.js provides at runtime.
  const mgSrc = fs.readFileSync(path.join(ROOT, 'minigame-core.js'), 'utf8');
  const shuffleMatch = mgSrc.match(/MG\.shuffle = function \(a\) \{[\s\S]*?\n  \};/);
  if (!shuffleMatch) {
    bad('MG.shuffle not found in minigame-core.js - cannot execute the real shuffle.');
  } else {
    const sandbox = { MG: {}, Math: Math, Array: Array, Object: Object, console: console };
    vm.createContext(sandbox);
    vm.runInContext(shuffleMatch[0].replace(/^MG\.shuffle/, 'MG.shuffle'), sandbox);
    vm.runInContext(fnMatch[0] + '\nthis.shuffleOptions = shuffleOptions;', sandbox);
    const shuffleOptions = sandbox.shuffleOptions;

    const TRIALS = 400;
    const q = {
      id: 'probe', module: 'm',
      q: { en: 'probe' },
      options: [{ en: 'RIGHT' }, { en: 'w1' }, { en: 'w2' }, { en: 'w3' }],
      answer: 0
    };
    const positions = {};
    let mismatches = 0;
    let mutated = 0;
    for (let i = 0; i < TRIALS; i++) {
      const out = shuffleOptions(q);
      if (out.options[out.answer].en !== 'RIGHT') mismatches++;
      if (out.options.length !== 4) mismatches++;
      positions[out.answer] = (positions[out.answer] || 0) + 1;
      // the input must never be mutated: the host reuses `picked`
      if (q.options[0].en !== 'RIGHT' || q.answer !== 0) mutated++;
    }
    if (mismatches === 0) ok('over ' + TRIALS + ' trials the option at the new index is always the correct one');
    else bad(mismatches + ' of ' + TRIALS + ' trials pointed `answer` at the WRONG option');

    if (mutated === 0) ok('the source question object is never mutated');
    else bad('shuffleOptions mutated its input in ' + mutated + ' trials');

    const seen = Object.keys(positions).length;
    if (seen >= 3) ok('correct answer lands in ' + seen + ' different positions ' + JSON.stringify(positions));
    else bad('correct answer only ever landed in ' + seen + ' position(s): ' + JSON.stringify(positions));

    // A 2-option question and a malformed one must not throw or corrupt.
    const two = shuffleOptions({ options: [{ en: 'R' }, { en: 'w' }], answer: 0 });
    if (two.options[two.answer].en === 'R') ok('2-option question still maps correctly');
    else bad('2-option question mapped to the wrong option');

    const one = shuffleOptions({ options: [{ en: 'only' }], answer: 0 });
    if (one && one.options && one.options.length === 1) ok('single-option question is passed through untouched');
    else bad('single-option question was corrupted');
  }
}

console.log('');
if (failures) {
  console.log('FAIL - ' + failures + ' problem(s). The AI Quiz answer position is not trustworthy.');
  process.exit(1);
}
console.log('PASS - the correct answer is shuffled and still correct.');
