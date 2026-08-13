#!/usr/bin/env node
/* ============================================================
   UI SANITY - one app, one look.
   ------------------------------------------------------------
   The app has ONE dropdown style: the shared `.ll-select` class
   (visually identical to the Students filter bar's
   `.filter-select`). This gate fails when a <select> ships
   WITHOUT one of those classes, so a new panel can never
   quietly introduce a fifth look.

   Run:  node y/tools/ui-sanity.js
         node y/tools/ui-sanity.js --list     (show every offender)

   Exit code 0 = clean, 1 = offenders found.

   ALLOWLIST below is for selects that legitimately cannot use
   the shared class (e.g. a game's themed control). Add a path
   with a REASON or the gate stays red.
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');

var REPO = path.resolve(__dirname, '..', '..');
var ROOT = path.join(REPO, 'y');
var SHOW_ALL = process.argv.indexOf('--list') !== -1;

// Directories that are not shipped app UI.
// (y/tools is node tooling, not shipped UI - and this file's own doc text
// contains <select> examples that would otherwise flag themselves.)
var SKIP = /node_modules|[\\/]\.tmp[\\/]|[\\/]\.claude[\\/]|marketing-site|[\\/]y[\\/]tools[\\/]/;

// The one true dropdown look (ll-select = shared; filter-select = the original
// Students bar it was modelled on).
// Matched as a WHOLE CLASS TOKEN, never a substring: `activity-filter-select`
// contains "filter-select" but is a different class, and a substring test
// silently passed those (they ended up unstyled).
function isUnified(tag) {
  var m = tag.match(/class\s*=\s*(["'])([^"']*)\1/);
  if (!m) return false;
  var tokens = m[2].split(/\s+/);
  return tokens.indexOf('ll-select') !== -1 || tokens.indexOf('filter-select') !== -1;
}

// Selects that may keep their own look, with the reason they are exempt.
var ALLOWLIST = [
  { match: /y[\\/]classroom[\\/]/, why: 'classroom game screens use their own game-show theming' },
  { match: /y[\\/]classroom-[^\\/]*\.html$/, why: 'classroom game pages (projector theme)' },
  { match: /y[\\/]lingualab-write[\\/]/, why: 'writing corrector has its own .cor-select scale' },
  { match: /y[\\/]student[\\/]css[\\/]/, why: 'stylesheet, not markup' }
];

function allowed(rel) {
  for (var i = 0; i < ALLOWLIST.length; i++) if (ALLOWLIST[i].match.test(rel)) return ALLOWLIST[i].why;
  return null;
}

function walk(dir, out) {
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

var files = walk(ROOT, []);
var total = 0, unified = 0, exempt = 0;
var offenders = {};

files.forEach(function (file) {
  var rel = path.relative(REPO, file).replace(/\\/g, '/');
  var text = fs.readFileSync(file, 'utf8');
  var re = /<select\b[^>]*>/g;
  var m;
  while ((m = re.exec(text))) {
    total++;
    var tag = m[0];
    if (isUnified(tag)) { unified++; continue; }
    var why = allowed(rel);
    if (why) { exempt++; continue; }
    var line = text.slice(0, m.index).split(/\n/).length;
    (offenders[rel] = offenders[rel] || []).push({
      line: line,
      tag: tag.replace(/\s+/g, ' ').slice(0, 100)
    });
  }
});

function head(s) { return '\n' + s + '\n' + new Array(s.length + 1).join('-'); }

var badFiles = Object.keys(offenders).sort();
var badCount = badFiles.reduce(function (n, f) { return n + offenders[f].length; }, 0);

console.log(head('UI SANITY - dropdown consistency'));
console.log('files scanned      ' + files.length);
console.log('<select> found     ' + total);
console.log('unified            ' + unified + '  (ll-select / filter-select)');
console.log('exempt             ' + exempt + '  (allowlisted themes)');
console.log('NOT unified        ' + badCount + '  across ' + badFiles.length + ' file(s)');

if (badFiles.length) {
  console.log(head('offenders'));
  badFiles.forEach(function (f) {
    var list = offenders[f];
    console.log(f + '  (' + list.length + ')');
    (SHOW_ALL ? list : list.slice(0, 3)).forEach(function (o) {
      console.log('   line ' + o.line + ': ' + o.tag);
    });
    if (!SHOW_ALL && list.length > 3) console.log('   ... +' + (list.length - 3) + ' more (run with --list)');
  });
  console.log('\nFIX: add class="ll-select" to the tag (keep any other classes),');
  console.log('or allowlist the file in y/tools/ui-sanity.js WITH a reason.');
}

console.log('\n' + (badCount === 0 ? 'PASS - every dropdown uses the one app style'
                                   : 'FAIL - ' + badCount + ' dropdown(s) off-style'));
process.exit(badCount === 0 ? 0 : 1);
