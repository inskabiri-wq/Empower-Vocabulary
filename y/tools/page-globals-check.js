#!/usr/bin/env node
'use strict';
/* ============================================================
   page-globals-check.js - does every game page load what its code uses?
   ------------------------------------------------------------
   On 2026-09-24 four classroom HOST pages (Trust, Heist, Reading, Listening)
   showed "no players" in a live class while 15 students had joined: their
   roster code called MG.sfx('join') first, and those pages never load
   classroom/js/minigame-core.js, which is what defines MG. Every join threw
   "MG is not defined" before the player count was written.

   This reads every classroom-*.html page, collects the local scripts it
   loads (in order) plus its inline scripts, and fails when any of them uses
   MG.something while nothing on that page defines MG. The emulator gates
   never caught it because none of them opens these host pages in a browser.

   Static: reads files only. Usage:  node y/tools/page-globals-check.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const Y = path.join(__dirname, '..');

const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const DEFINES_MG = /window\.MG\s*=|(?:^|[^.\w])(?:var|let|const)\s+MG\s*=/m;
const USES_MG = /(^|[^.\w$])MG\.\w+/m;

let pass = 0, fail = 0;
const pages = fs.readdirSync(Y).filter(f => /^classroom.*\.html$/.test(f)).sort();
for (const p of pages) {
  const html = fs.readFileSync(path.join(Y, p), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1])
    .filter(s => !/^https?:|^\/\//.test(s)).map(s => s.split('?')[0].replace(/^\//, ''));
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const files = srcs.map(s => {
    let t = '';
    try { t = fs.readFileSync(path.join(Y, s), 'utf8'); } catch (e) { return { s, t: null }; }
    return { s, t: strip(t) };
  });
  const missing = files.filter(f => f.t === null).map(f => f.s);
  if (missing.length) { fail++; console.log('  FAIL  ' + p + ' loads files that do not exist: ' + missing.join(', ')); continue; }
  const all = files.map(f => f.t).join('\n') + '\n' + strip(inline);
  const users = files.filter(f => USES_MG.test(f.t)).map(f => f.s);
  if (USES_MG.test(strip(inline))) users.push('(inline script)');
  if (users.length && !DEFINES_MG.test(all)) {
    fail++;
    console.log('  FAIL  ' + p + ' uses MG (' + users.join(', ') + ') but loads nothing that defines it (classroom/js/minigame-core.js)');
  } else {
    pass++;
    console.log('  ok    ' + p);
  }
}
console.log('');
if (fail) { console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ' game pages would throw "MG is not defined".'); process.exit(1); }
console.log('PASS - all ' + pass + ' game pages load what their scripts use.');
