#!/usr/bin/env node
/**
 * tools/game-registry-check.js
 *
 * Every classroom game needs THREE things, and the AI Quiz shipped with two:
 *
 *   1. a launcher button on classroom-teacher.html   (#pickXxx)
 *   2. a row in the toggle map at the foot of that page (game_xxx -> pickXxx)
 *   3. a row in FEATURES in teacher/js/feature-activation.js
 *
 * The AI Quiz had 1 and 2 but not 3, so it was playable but could never be
 * switched off, and it simply did not appear in Admin > Features > Classroom
 * games. Nothing failed; the switch just was not there. This asserts all three
 * agree, in both directions.
 *
 * Run:  node tools/game-registry-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const hub = read('classroom-teacher.html');
const feat = read('teacher/js/feature-activation.js');

// 2. the toggle map: game_xxx: 'pickXxx'
const mapBlock = hub.match(/var MAP = \{[\s\S]*?\};/);
if (!mapBlock) { console.log('FAIL - could not find the game toggle MAP in classroom-teacher.html'); process.exit(1); }
const mapped = {};
for (const m of mapBlock[0].matchAll(/(game_\w+)\s*:\s*'([^']+)'/g)) mapped[m[1]] = m[2];

// 3. the admin registry
const registered = new Set();
for (const m of feat.matchAll(/id:\s*'(game_\w+)'/g)) registered.add(m[1]);

const failures = [];
for (const [flag, btnId] of Object.entries(mapped)) {
  if (!new RegExp('id="' + btnId + '"').test(hub)) {
    failures.push(flag + ' points at #' + btnId + ', which is not on classroom-teacher.html');
  }
  if (!registered.has(flag)) {
    failures.push(flag + ' can be gated but has NO row in FEATURES (teacher/js/feature-activation.js), '
      + 'so an admin can never switch it off');
  }
}
for (const flag of registered) {
  if (!(flag in mapped)) {
    failures.push(flag + ' has an admin switch but nothing gates it on classroom-teacher.html, '
      + 'so turning it off would do nothing');
  }
}

const names = [...registered].sort();
console.log('  games gated on the hub : ' + Object.keys(mapped).length);
console.log('  games in Admin switches: ' + registered.size);
console.log('  ' + names.join(', '));
if (failures.length) {
  console.log('\nFAIL - ' + failures.length + ' registry gap(s):');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nPASS - every classroom game has a launcher, a gate and an admin switch.');
