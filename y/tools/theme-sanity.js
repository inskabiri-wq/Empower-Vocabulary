#!/usr/bin/env node
/* ============================================================
   theme-sanity.js

   A theme that defines only SOME tokens leaves the rest at their
   dark values, which is exactly what made "change the colour" look
   like it only recoloured the buttons. Every theme must define the
   complete set, or this fails.

   Also flags surface/text colours that went back to being hardcoded,
   since those cannot follow any theme.

   Run: node y/tools/theme-sanity.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// The app's own token vocabulary, as :root actually defines it. Tokens that
// only a theme sets are not required here.
const REQUIRED = [
  '--bg-primary', '--bg-secondary', '--bg-card',
  '--text-primary', '--text-secondary', '--text-muted', '--border-color'
];
const THEMES = ['body.light-mode', 'body.theme-sepia', 'body.theme-contrast'];

const css = fs.readFileSync(path.join(ROOT, 'css', 'app-settings.css'), 'utf8');
const vars = fs.readFileSync(path.join(ROOT, 'index', 'css', 'variables.css'), 'utf8');

function blockFor(source, selector) {
  const i = source.indexOf(selector + ' {');
  if (i === -1) return null;
  const open = source.indexOf('{', i);
  let depth = 1, j = open + 1;
  while (j < source.length && depth > 0) {
    if (source[j] === '{') depth++;
    else if (source[j] === '}') depth--;
    j++;
  }
  return source.slice(open + 1, j - 1);
}

let fail = 0;
console.log('THEME SANITY\n');

// 1. :root must define the full vocabulary, so a fallback always exists.
const rootBlock = blockFor(vars, ':root');
const missingRoot = REQUIRED.filter(t => !new RegExp('(^|\\s)' + t + '\\s*:').test(rootBlock || ''));
if (missingRoot.length) { fail++; console.log('  FAIL  :root missing ' + missingRoot.join(', ')); }
else console.log('  ok    :root defines all ' + REQUIRED.length + ' tokens');

// 2. Each theme must define every one of them.
for (const sel of THEMES) {
  const b = blockFor(css, sel);
  if (!b) { fail++; console.log('  FAIL  ' + sel + ' block not found'); continue; }
  const missing = REQUIRED.filter(t => !new RegExp('(^|\\s)' + t + '\\s*:').test(b));
  if (missing.length) { fail++; console.log('  FAIL  ' + sel + ' missing ' + missing.join(', ')); }
  else console.log('  ok    ' + sel + ' complete');
}

// 3. No surface/text colour may go back to being hardcoded.
const BANNED = /#(0a0f1a|0b1220|0f172a|0f1729|152035|0d1426|1c2a42|f8fafc|f1f5f9|94a3b8|64748b)\b/i;
function cssFiles(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) cssFiles(p, out);
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}
let strays = 0;
for (const f of cssFiles(ROOT)) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (rel === 'index/css/variables.css' || rel === 'css/app-settings.css') continue;
  const src = fs.readFileSync(f, 'utf8');
  // Track the enclosing selector. A colour inside a .light-mode block is the
  // light VALUE, not an untokenised stray, and it normally sits a line or two
  // below the selector rather than on it.
  let inTheme = false;
  src.split('\n').forEach((line, i) => {
    if (line.indexOf('{') !== -1) inTheme = /light-mode|theme-sepia|theme-contrast/.test(line);
    else if (line.indexOf('}') !== -1 && inTheme) { inTheme = false; return; }
    if (inTheme) return;
    if (/^\s*--[\w-]+\s*:/.test(line)) return;
    if (/light-mode|theme-sepia|theme-contrast/.test(line)) return;
    // A hardcoded value is fine as the FALLBACK inside var(); flag it only
    // when it stands alone.
    const stripped = line.replace(/var\([^)]*\)/g, '');
    if (BANNED.test(stripped)) { strays++; if (strays <= 8) console.log('  WARN  ' + rel + ':' + (i + 1) + ' untokenised surface colour'); }
  });
}
console.log(strays ? '  WARN  ' + strays + ' untokenised surface colour(s) remain'
                   : '  ok    no untokenised surface colours');

console.log('');
console.log(fail ? 'FAIL - a theme is incomplete' : 'PASS - every theme defines every token');
process.exit(fail ? 1 : 0);
