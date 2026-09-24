#!/usr/bin/env node
/**
 * tools/teacher-mobile-check.js
 *
 * The teacher dashboard used to refuse to open on a phone: a gate said "this
 * screen needs a computer" and offered a cut-down teacher-mobile.html instead.
 * That gate is gone, and the dashboard itself is now the phone view - which
 * means the two modules that make it fit are load-bearing. If either one stops
 * loading, the page does not fail loudly. It renders a 220px sidebar and an
 * 11-column table on a 390px screen, and the first person to find out is a
 * teacher holding a phone.
 *
 * So this asserts the things a browser cannot tell you are missing:
 *   1. both phone modules are loaded, as real script tags, versioned
 *   2. no gate has come back, and none of the deleted files have returned
 *   3. every tab the bottom bar promises actually exists in the sidebar
 *   4. no CSS declares a grid track wider than a phone's content box
 *
 * Run:  node tools/teacher-mobile-check.js
 *       node tools/teacher-mobile-check.js --json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const PAGE = 'teacher-dashboard.html';

// The modules that make the dashboard usable below 768px. Both are required:
// the shell without the tables gives you a tab bar over a sideways-scrolling
// table, and the tables without the shell gives you cards behind a sidebar
// that covers them.
const MODULES = ['teacher/js/mobile-shell.js', 'teacher/js/mobile-tables.js'];

// Deleted at step 6. Listed by name so that restoring one is a deliberate act
// with a failing check attached, not a quiet `git checkout` nobody reviews.
const REMOVED = [
  'teacher-mobile.html',
  'teacher/js/mobile-view.js',
  'js/desktop-gate.js',
  'tools/demos/teacher-mobile-trace.html',
  'tools/demos/desktop-gate-trace.html'
];

// A 390px phone minus the 14px gutters `.t2-main` sets on each side. Any fixed
// track wider than this overflows the screen sideways, which is the single
// failure mode that makes a page feel broken rather than merely cramped.
const PHONE_CONTENT = 362;

function read(f) {
  const p = path.join(ROOT, f);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function walk(dir, out) {
  out = out || [];
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) { if (e.name !== 'vendor') walk(rel, out); }
    else if (/\.(js|css)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const failures = [];
const notes = [];
function fail(msg) { failures.push(msg); }

// ── 1. Both modules load, as real script tags, versioned ──────────────────
//
// The regex insists on a real <script src=...>. A previous check in this repo
// passed against a page that only MENTIONED its module in a comment, so the
// tag itself is what gets matched, and `?v=` with it: an unversioned asset is
// served from the service worker's cache and a fix can look undeployed for
// days.
const page = read(PAGE);
if (!page) {
  fail(PAGE + ' is missing');
} else {
  for (const mod of MODULES) {
    const base = mod.split('/').pop().replace('.', '\\.');
    const tag = new RegExp('<script[^>]+src=["\'][^"\']*' + base + '\\?v=\\d+', 'i');
    if (!tag.test(page)) {
      fail(PAGE + ' does not load ' + mod + ' as a versioned <script> tag');
    }
  }
  // A gate is anything that stops the page on a narrow screen. Named broadly
  // rather than by filename, so reintroducing one under a new name still trips.
  if (/desktop-gate|ll-gate\b|needs a computer/i.test(page)) {
    fail(PAGE + ' looks like it has a phone gate again');
  }
}

for (const mod of MODULES) {
  if (!read(mod)) fail(mod + ' is missing');
}

// ── 2. The removed files stay removed ─────────────────────────────────────
for (const f of REMOVED) {
  if (fs.existsSync(path.join(ROOT, f))) {
    fail(f + ' is back; it was deleted when the gate was removed');
  }
}
// And nothing points at them.
for (const f of walk('.').concat([PAGE])) {
  if (f === 'tools/teacher-mobile-check.js') continue;
  const src = read(f);
  if (!src) continue;
  if (/\bdesktop-gate\.js|teacher-mobile\.html|teacher\/js\/mobile-view\.js/.test(src)) {
    // A comment explaining the history is fine; a src/href is not.
    if (/(?:src|href)=["'][^"']*(?:desktop-gate\.js|teacher-mobile\.html|mobile-view\.js)/.test(src)) {
      fail(f + ' still references a deleted gate file');
    }
  }
}

// ── 3. The bar cannot promise a tab the sidebar does not have ─────────────
//
// mobile-shell builds its bar by READING the sidebar, so a renamed data-tab
// does not break the page - it silently drops that entry into the More sheet
// and the bar comes back with four items where five were intended. Nothing
// throws. This is the check that notices.
const shell = read(MODULES[0]);
if (shell && page) {
  const m = shell.match(/var\s+PRIMARY\s*=\s*\[([^\]]*)\]/);
  if (!m) {
    fail('mobile-shell.js has no PRIMARY list; this check cannot verify the bar');
  } else {
    const primary = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    const inSidebar = new Set(
      [...page.matchAll(/class="[^"]*t2-nav-item[^"]*"[^>]*data-tab="([^"]+)"/g)].map(x => x[1])
        .concat([...page.matchAll(/data-tab="([^"]+)"[^>]*class="[^"]*t2-nav-item/g)].map(x => x[1]))
    );
    for (const tab of primary) {
      if (!inSidebar.has(tab)) {
        fail('bottom bar wants a "' + tab + '" tab, but no .t2-nav-item in ' + PAGE + ' has data-tab="' + tab + '"');
      }
    }
    notes.push('bar tabs: ' + primary.join(', ') + ' + More');
  }
}

// ── 4. No grid track wider than a phone's content box ─────────────────────
//
// `repeat(auto-fit, minmax(430px, 1fr))` reads as responsive and is not: on a
// phone auto-fit drops to one column, but that column keeps its 430px minimum
// and hangs 68px off the screen. `minmax(min(430px,100%), 1fr)` is the fix, so
// a `min(` in the track is what makes this pass.
const wide = [];
for (const f of walk('teacher').concat(['teacher-dashboard.html'])) {
  const src = read(f);
  if (!src) continue;
  src.split('\n').forEach((line, i) => {
    for (const mm of line.matchAll(/minmax\(\s*(min\()?\s*(\d{3,4})px/g)) {
      if (!mm[1] && +mm[2] > PHONE_CONTENT) {
        wide.push(f + ':' + (i + 1) + '  minmax(' + mm[2] + 'px, ...)');
      }
    }
  });
}
for (const w of wide) {
  fail('grid track too wide for a phone (wrap it in min(..., 100%)): ' + w);
}

// ── 5. No multi-column grid declared INLINE ───────────────────────────────
//
// An inline `style="grid-template-columns: 1.4fr 1fr"` outranks any media
// query, so the rule that collapses a row to one column on a phone silently
// loses. That is exactly how the Overview kept a two-column Needs Attention /
// Recent Activity row at 390px and pushed the whole page sideways, and nothing
// in a stylesheet can defend against it. Put the split in a class instead.
for (const f of ['teacher-dashboard.html'].concat(walk('teacher').filter(x => /\.js$/.test(x)))) {
  const src = read(f);
  if (!src) continue;
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/style\s*=\s*["'][^"']*grid-template-columns\s*:\s*([^;"']+)/gi)) {
      const value = m[1].trim();
      // `repeat(auto-fit|auto-fill, ...)` collapses to one column by itself, so
      // it needs no media query and cannot be trapped by this. Only an explicit
      // side-by-side split can be, and two or more `fr` tracks is what that
      // looks like: a fixed rail such as `90px 1fr 46px` is a single flexible
      // column and fits a phone fine.
      if (/repeat\(\s*auto-(fit|fill)/i.test(value)) continue;
      const frTracks = (value.match(/(^|\s)[\d.]*fr\b/g) || []).length;
      if (frTracks >= 2) {
        fail('side-by-side grid declared inline, which beats every media query '
          + '(move it to a class): ' + f + ':' + (i + 1) + '  ' + value);
      }
    }
  });
}

// ── Report ────────────────────────────────────────────────────────────────
const json = process.argv.includes('--json');
if (json) {
  console.log(JSON.stringify({ ok: failures.length === 0, failures, notes }, null, 2));
} else {
  for (const n of notes) console.log('  ' + n);
  if (failures.length) {
    console.log('');
    for (const f of failures) console.log('  FAIL  ' + f);
    console.log('\nFAIL - ' + failures.length + ' problem(s) with the teacher phone view.');
  } else {
    console.log('\nPASS - dashboard loads both phone modules, the gate is gone and stays gone, '
      + 'every bar tab exists, no track overflows a phone.');
  }
}
process.exit(failures.length ? 1 : 0);
