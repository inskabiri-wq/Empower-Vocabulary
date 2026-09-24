#!/usr/bin/env node
/**
 * tools/alerts-runtime-check.js
 *
 * ACTUALLY RUN checkStrugglingStudents(), because `node --check` cannot catch
 * the thing that broke it.
 *
 * Rewriting the needs-attention card to use the rolled-up average removed a
 * `const sessions = ...` declaration while a template literal further down
 * still read `sessions.length`. That is a ReferenceError: valid syntax, throws
 * on execution. It surfaced as "Error loading data: sessions is not defined"
 * and took the whole teacher dashboard down to Access Denied - for the admin.
 *
 * Syntax checks pass on that. Only running the function finds it. So this
 * executes the SHIPPED function against stub globals and asserts it completes
 * and fills the cards, for students with rolled-up totals, without them, and
 * with none at all.
 *
 * Run:  node tools/alerts-runtime-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'teacher/js/activity.js'), 'utf8');

// Lift the function out by brace matching so this runs the real thing.
function slice(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no function ' + name);
  let d = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}

// LLEssaysWaiting is an ASSIGNMENT, not a declaration, so slice() cannot find
// it. Pulling in the real one means the gate tests the shared helper the v2
// Overview also calls, rather than a copy of it.
function sliceAssigned(name) {
  const at = src.indexOf('window.' + name + ' = function');
  if (at < 0) throw new Error('no window.' + name);
  let d = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(at, i + 1) + ';'; }
  }
  throw new Error('unbalanced ' + name);
}

const written = {};
function el(id) {
  return {
    id,
    style: {},
    set innerHTML(v) { written[id] = String(v); },
    get innerHTML() { return written[id] || ''; },
    set textContent(v) { written[id] = String(v); },
    get textContent() { return written[id] || ''; }
  };
}

function run(label, students, sessions, expect, writingSubs) {
  Object.keys(written).forEach(k => delete written[k]);
  const sandbox = {
    console,
    allStudents: students,
    allSessions: sessions,
    allAssignments: [],
    // The live writingSubmissions map the dashboard already holds. The
    // essays-waiting card counts from it, so the gate must supply it or that
    // path is never executed.
    allWritingSubs: writingSubs || {},
    getInitials: (s) => String(s || '?').charAt(0).toUpperCase(),
    escapeHtml: (s) => String(s == null ? '' : s),
    _cssVar: () => '#000',
    document: { getElementById: (id) => el(id) },
    // The rolled-up average helper, as student/js/score-rollup.js defines it.
    window: {
      LLRollup: {
        averageFor(d) {
          const n = Number(d && d.statsScoredSessions);
          const sum = Number(d && d.statsScoreSum);
          if (!isFinite(n) || !isFinite(sum) || n <= 0) return null;
          return sum / n;
        }
      }
    }
  };
  vm.createContext(sandbox);
  let err = null;
  try {
    // The shared essays helper first: checkStrugglingStudents calls it, and
    // running the REAL one means this gate covers the same code the v2
    // Overview's band uses rather than a copy of it.
    vm.runInContext(sliceAssigned('LLEssaysWaiting') + '\n' +
                    slice('checkStrugglingStudents') + '\ncheckStrugglingStudents();', sandbox);
  } catch (e) {
    err = e;
  }
  const flagged = /alert-student-item/.test(written.lowScoreList || '');
  const shownPct = (written.lowScoreList || '').match(/>(\d+)%</);
  const shownN = (written.lowScoreList || '').match(/>(\d+) sessions</);
  const essaysN = written.essaysWaitingCount;
  const essaysRows = ((written.essaysWaitingList || '').match(/alert-student-item/g) || []).length;
  const ok = !err
    && (expect.essays == null || String(essaysN) === String(expect.essays))
    && (expect.essayRows == null || essaysRows === expect.essayRows)
    && flagged === expect.flagged
    && (expect.pct == null || (shownPct && Number(shownPct[1]) === expect.pct))
    && (expect.n == null || (shownN && Number(shownN[1]) === expect.n));
  if (!ok) {
    console.log('  FAIL  ' + label);
    if (err) console.log('          threw: ' + err.message);
    else if (expect.essays != null) console.log('          essaysCount=' + essaysN + ' rows=' + essaysRows +
      '   expected ' + JSON.stringify(expect));
    else console.log('          flagged=' + flagged + ' pct=' + (shownPct && shownPct[1]) +
      ' n=' + (shownN && shownN[1]) + '   expected ' + JSON.stringify(expect));
  } else {
    console.log('  ok    ' + label.padEnd(56) +
      (flagged ? ('flags at ' + (shownPct && shownPct[1]) + '% over ' + (shownN && shownN[1]) + ' sessions')
               : 'nothing to flag'));
  }
  return ok;
}

const S = (id, extra) => Object.assign({ id, name: 'Student ' + id, email: id + '@x' }, extra || {});
const sess = (userId, pct) => ({ userId, percentage: pct, activity: 'choice', createdAt: { toDate: () => new Date() } });

let all = true;

// THE EXACT REGRESSION: a student WITH rolled-up totals and no matching rows
// in the session window. This is what threw.
all &= run('rolled-up totals, no sessions in the window',
  [S('a', { statsScoredSessions: 4, statsScoreSum: 120 })], [], { flagged: true, pct: 30, n: 4 });

all &= run('rolled-up totals, above the threshold',
  [S('a', { statsScoredSessions: 4, statsScoreSum: 320 })], [], { flagged: false });

all &= run('no counters, falls back to the session window',
  [S('b')], [sess('b', 20), sess('b', 40)], { flagged: true, pct: 30, n: 2 });

all &= run('no counters and no sessions is not "low"',
  [S('c')], [], { flagged: false });

// ── ESSAYS WAITING ────────────────────────────────────────────────────────
// Counted from allWritingSubs, which the dashboard already holds live. These
// run the same function, so a ReferenceError in the new block fails here.
const sub = (name, status, hoursAgo) => ({
  userName: name, studentClass: 'A1', assignmentTitle: 'Essay 1',
  status: status,
  submittedAt: { toDate: () => new Date(Date.now() - hoursAgo * 3600000) }
});

all &= run('three ungraded essays are counted and listed',
  [], [], { flagged: false, essays: 3, essayRows: 3 },
  { s1: sub('Ada', 'submitted', 5), s2: sub('Bo', undefined, 30), s3: sub('Cy', 'submitted', 100) });

all &= run('graded and returned work does NOT count',
  [], [], { flagged: false, essays: 1, essayRows: 1 },
  { s1: sub('Ada', 'graded', 5), s2: sub('Bo', 'returned', 5), s3: sub('Cy', 'submitted', 5) });

all &= run('no submissions at all shows zero, not a crash',
  [], [], { flagged: false, essays: 0, essayRows: 0 }, {});

all &= run('a submission with no timestamp does not throw',
  [], [], { flagged: false, essays: 1, essayRows: 1 },
  { s1: { userName: 'Dee', status: 'submitted' } });

all &= run('a null entry in the map is skipped',
  [], [], { flagged: false, essays: 1, essayRows: 1 },
  { s1: null, s2: sub('Eve', 'submitted', 2) });

all &= run('counters win over the window when both exist',
  [S('d', { statsScoredSessions: 10, statsScoreSum: 200 })], [sess('d', 95)], { flagged: true, pct: 20, n: 10 });

all &= run('no students at all', [], [], { flagged: false });

all &= run('a student with zero counters is not divided by zero',
  [S('e', { statsScoredSessions: 0, statsScoreSum: 0 })], [], { flagged: false });

console.log(all ? '\nPASS - the alerts card runs and reports the same set it counts.'
                : '\nFAIL');
process.exit(all ? 0 : 1);
