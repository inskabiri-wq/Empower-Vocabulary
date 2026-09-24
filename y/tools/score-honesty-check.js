#!/usr/bin/env node
/**
 * score-honesty-check.js
 *
 * Guards one rule: an UNMARKED session must never be averaged as a zero.
 *
 * A writing exam that the teacher has not graded is written with no
 * `percentage` field at all (student/js/writing-exam.js), and pronunciation
 * practice marks nothing by design. The old `sum += (s.percentage || 0)`
 * turned both into a 0% that also counted in the divisor, so a student
 * waiting on three essay marks read as someone who scored zero three times -
 * on their card, in their profile modal, in the class average, and in every
 * sheet of the Reports workbook.
 *
 * This gate fails if that pattern comes back, and it EXECUTES the real
 * helpers rather than only reading them, because `node --check` cannot catch
 * a ReferenceError.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const Y = path.resolve(__dirname, '..');
let failures = 0;
const fail = (m) => { console.log('  FAIL  ' + m); failures++; };
const pass = (m) => console.log('  ok    ' + m);

// ── 1. the banned pattern ────────────────────────────────────────────────
// `percentage || 0` is only ever safe when it is NOT feeding an average.
// Any occurrence inside a reduce/sum that is later divided is the bug.
console.log('\n1. no un-marked session is summed into an average');

const AGG_FILES = [
  'teacher/js/reports-admin.js',
  'teacher/js/students.js',
  'teacher/js/student-detail.js',
  'teacher/js/modals.js',
];
for (const rel of AGG_FILES) {
  const src = fs.readFileSync(path.join(Y, rel), 'utf8');
  const lines = src.split(/\r?\n/);
  let bad = 0;
  lines.forEach((ln, i) => {
    if (/^\s*(\/\/|\*)/.test(ln)) return;                 // comments may cite it
    if (!/percentage\s*\|\|\s*0/.test(ln)) return;
    // Summing it, or reducing it, is the failure mode.
    if (/\bsum\b|\breduce\b|\+=/.test(ln)) {
      fail(`${rel}:${i + 1} sums \`percentage || 0\` into an average`);
      bad++;
    }
  });
  if (!bad) pass(`${rel} - clean`);
}

// ── 2. no average divides by a raw attempt count ─────────────────────────
console.log('\n2. averages divide by the MARKED count, not the attempt count');
{
  const src = fs.readFileSync(path.join(Y, 'teacher/js/reports-admin.js'), 'utf8');
  const raw = src.split(/\r?\n/).filter((ln, i) =>
    !/^\s*(\/\/|\*)/.test(ln) && /\.sum\s*\/\s*\w+\.n\b/.test(ln));
  if (raw.length) raw.forEach(ln => fail('reports-admin.js divides by .n: ' + ln.trim()));
  else pass('reports-admin.js - every average goes through bucketAvg()');
}

// ── 3. score-utils is loaded, and loaded FIRST ───────────────────────────
console.log('\n3. score-utils.js is wired into the dashboard before its consumers');
{
  const html = fs.readFileSync(path.join(Y, 'teacher-dashboard.html'), 'utf8');
  // Match the actual <script src=...> tag. A plain indexOf finds the file
  // named inside an HTML comment hundreds of lines earlier and reports a
  // load-order failure that does not exist.
  const at = (f) => {
    const m = html.match(new RegExp('<script[^>]+src=["\']' + f.replace(/[.\/]/g, '\\$&') + '\\?'));
    return m ? m.index : -1;
  };
  const su = at('teacher/js/score-utils.js');
  if (su < 0) fail('teacher-dashboard.html never loads score-utils.js');
  else {
    pass('score-utils.js is loaded');
    for (const f of ['teacher/js/students.js', 'teacher/js/modals.js',
                     'teacher/js/reports-admin.js', 'teacher/js/student-detail.js']) {
      const p = at(f);
      if (p >= 0 && p < su) fail(`${f} loads BEFORE score-utils.js`);
    }
    if (!failures) pass('every consumer loads after it');
  }
}

// ── 4. the helper actually behaves (executed, not read) ──────────────────
console.log('\n4. LLScore behaves on the cases that caused the bug');
{
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(Y, 'teacher/js/score-utils.js'), 'utf8')
                    .replace(/\}\)\(window\);\s*$/, '})(window);'), ctx);
  const S = ctx.window.LLScore;
  if (!S) { fail('score-utils.js did not export LLScore'); }
  else {
    const graded   = { activity: 'reading-exam', percentage: 90 };
    const zero     = { activity: 'reading-exam', percentage: 0 };
    const ungraded = { activity: 'writing-exam' };                    // no percentage
    const pron     = { activity: 'pronunciation', percentage: 0 };
    const flagged  = { activity: 'reading-exam', percentage: 50, unscored: true };

    const t = (label, ok) => ok ? pass(label) : fail(label);
    t('a graded session counts',            S.isScored(graded) === true);
    t('a genuine 0% still counts',          S.isScored(zero) === true);
    t('an UNGRADED essay does not count',   S.isScored(ungraded) === false);
    t('pronunciation does not count',       S.isScored(pron) === false);
    t('an explicitly unscored row does not', S.isScored(flagged) === false);

    // The headline case: one 90 and three un-marked essays is 90, not 22.
    const avg = S.avg([graded, ungraded, ungraded, ungraded]);
    t('90 + three un-marked essays averages 90 (not 22)', avg === 90);

    t('nothing marked returns null, not 0',  S.avg([ungraded, pron]) === null);
    t('best() of nothing is null, not -Infinity', S.best([ungraded]) === null);
    t('unscoredCount counts the waiting ones', S.unscoredCount([graded, ungraded, pron]) === 2);
    t('a real 0% average is 0, not null',    S.avg([zero]) === 0);
  }
}

console.log('');
if (failures) { console.log(`score-honesty-check: ${failures} FAILED`); process.exit(1); }
console.log('score-honesty-check: all checks passed');
