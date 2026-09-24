#!/usr/bin/env node
'use strict';
/* ============================================================
   lobby-listener-check.js - one players listener per host, not two.
   ------------------------------------------------------------
   THE BUG THIS EXISTS TO CATCH

   Every classroom host attaches a listener to the session's `players`
   subcollection twice: once in the lobby, and again when the game goes live.
   Five of the nine games assigned the second one straight over the same
   variable without calling the first unsubscribe. Both listeners then stayed
   live for the rest of the game, so every player write was delivered to the
   host twice and billed twice, and the render callback ran twice per change.

   classroom/js/teacher.js was worse: its second attach never captured the
   returned handle at all, so it could not be released even in principle.

   trust-teacher.js, reading-teacher.js and listening-teacher.js always did it
   correctly (`if (unsub) unsub();` immediately before reassigning), and
   aiquiz-teacher.js goes further and drops the listener entirely during play.
   So the fix had a correct in-repo pattern to copy.

   WHAT THIS CHECKS, AND WHAT IT DOES NOT

   This is a STRUCTURAL check on the source, not a runtime one. It asserts that
   every reassignment of a players-listener handle is preceded by a release of
   the previous one. It cannot prove the listener count at runtime; that would
   need a driven game with real students. Read it as "the guard is present and
   has not regressed", which is exactly the thing that silently rots.

   Usage:  node y/tools/lobby-listener-check.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'classroom', 'js');

// file -> the variable that holds the players-listener unsubscribe handle
const TARGETS = [
  { file: 'teacher.js',          v: 'playersListener' },
  { file: 'bingo-teacher.js',    v: 'unsubPlayers' },
  { file: 'scramble-teacher.js', v: 'unsubPlayers' },
  { file: 'tug-teacher.js',      v: 'unsubPlayers' },
  { file: 'heist-teacher.js',    v: 'unsubPlayers' },
  { file: 'trust-teacher.js',    v: 'unsubPlayers' },
];

// How far above an assignment we accept the release call. The release is
// normally the line immediately before; a few lines of comment in between is
// fine, a release 40 lines up is a different code path and does not count.
const WINDOW = 12;

let failures = 0;
let checked = 0;

TARGETS.forEach(function (t) {
  const p = path.join(ROOT, t.file);
  if (!fs.existsSync(p)) {
    console.log('  SKIP  ' + t.file + ' (not found)');
    return;
  }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

  // Assignments of the handle that subscribe to a players collection. The
  // .onSnapshot may be on the same line or a following one, so look ahead.
  const assigns = [];
  lines.forEach(function (ln, i) {
    const re = new RegExp('^\\s*' + t.v + '\\s*=');
    if (!re.test(ln)) return;
    const ahead = lines.slice(i, i + 4).join(' ');
    if (!/collection\(\s*['"]players['"]\s*\)/.test(ahead)) return;
    if (!/onSnapshot/.test(ahead)) return;
    assigns.push(i);
  });

  if (assigns.length === 0) {
    console.log('  SKIP  ' + t.file + ' (no players-listener assignment found)');
    return;
  }

  // Every assignment must be preceded by a release of the same handle. The
  // FIRST one included: entering a lobby twice is a real path (create a room,
  // go back, create another), and that is exactly how the guard was written
  // in the files that got it right.
  const releaseRe = new RegExp('(^|[^\\w.])' + t.v + '\\s*\\(\\s*\\)');
  assigns.forEach(function (idx) {
    checked++;
    const from = Math.max(0, idx - WINDOW);
    const before = lines.slice(from, idx).join('\n');
    if (releaseRe.test(before)) {
      console.log('  ok    ' + t.file + ':' + (idx + 1) + '  releases before reassigning');
    } else {
      failures++;
      console.log('  FAIL  ' + t.file + ':' + (idx + 1)
        + '  assigns ' + t.v + ' without releasing the previous listener');
      console.log('        ' + (lines[idx] || '').trim().slice(0, 90));
    }
  });
});

console.log('');
if (failures) {
  console.log('FAIL - ' + failures + ' of ' + checked + ' players-listener assignments do not release first.');
  console.log('Fix: add `if (' + '<handle>' + ') ' + '<handle>' + '();` immediately before the assignment,');
  console.log('the way classroom/js/trust-teacher.js already does.');
  process.exit(1);
}
console.log('PASS - all ' + checked + ' players-listener assignments release the previous listener first.');
