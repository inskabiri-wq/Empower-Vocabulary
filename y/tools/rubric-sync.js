#!/usr/bin/env node
/* ============================================================
   rubric-sync - keep the ONE rubric registry in two places
   ------------------------------------------------------------
   The exam rubric registry is authored once at
       y/assignments/js/writing-rubrics.js
   but the analyzeWriting Cloud Function needs it too, and
   `firebase deploy --only functions` uploads ONLY the functions/
   directory - it cannot reach up into y/. So a byte-identical
   copy lives at functions/writing-rubrics.js.

   This gate makes the duplication safe: edit the y/ copy, run
   this with --fix, and the two can never silently drift.

     node y/tools/rubric-sync.js          check  (exit 1 if drifted)
     node y/tools/rubric-sync.js --fix    copy y/ -> functions/
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'y', 'assignments', 'js', 'writing-rubrics.js');
const DST = path.join(ROOT, 'functions', 'writing-rubrics.js');
const fix = process.argv.indexOf('--fix') !== -1;

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; } }

const src = read(SRC);
if (src == null) {
  console.error('rubric-sync: FAIL - source missing: ' + SRC);
  process.exit(1);
}

// The registry must stay loadable from BOTH sides (UMD): browser sets
// window.WRITING_RUBRICS, Node gets module.exports.
if (src.indexOf('module.exports') === -1 || src.indexOf('WRITING_RUBRICS') === -1) {
  console.error('rubric-sync: FAIL - the registry lost its dual browser/CommonJS export.');
  process.exit(1);
}

const dst = read(DST);
if (dst === src) {
  console.log('rubric-sync: PASS - functions/writing-rubrics.js matches the source.');
  process.exit(0);
}

if (!fix) {
  console.error('rubric-sync: FAIL - functions/writing-rubrics.js is ' + (dst == null ? 'MISSING' : 'OUT OF DATE') + '.');
  console.error('  fix it with:  node y/tools/rubric-sync.js --fix');
  process.exit(1);
}

fs.writeFileSync(DST, src);
console.log('rubric-sync: copied source -> functions/writing-rubrics.js (' + src.length + ' bytes).');
