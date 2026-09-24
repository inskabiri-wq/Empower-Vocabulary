#!/usr/bin/env node
/* ============================================================
   light-coverage.js

   Finds CSS rules that paint a DARK surface or near-WHITE text
   and have no light-mode counterpart. Those are the rules that
   stay dark after a repaint - the "boxes are still the old
   colour" reports.

   A rule is considered covered if ANY of these is true:
     - every colour in it is a var(), so a token override reaches it
     - a `.light-mode <same selector>` rule exists somewhere
     - it already sits inside a theme block

   Run:  node y/tools/light-coverage.js            (report)
         node y/tools/light-coverage.js --strict   (exit 1 if any)

   This exists because the repaint kept missing pockets: the
   teacher assignment card, the courses page, the Admin tab. Each
   was found by a screenshot rather than by a tool, which does not
   scale and is not something to rely on.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

// Surfaces darker than roughly #2a2a2a, and text lighter than roughly #e0e0e0.
function lum(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function rgbLum(v) {
  const n = v.match(/\d+(\.\d+)?/g);
  if (!n || n.length < 3) return null;
  // ignore near-transparent paints: they inherit whatever is behind them
  if (n.length > 3 && parseFloat(n[3]) < 0.5) return null;
  return 0.299 * +n[0] + 0.587 * +n[1] + 0.114 * +n[2];
}
const SURFACE_PROP = /^(background|background-color|background-image)$/;
const TEXT_PROP    = /^(color|-webkit-text-fill-color)$/;
const THEME_SEL    = /light-mode|theme-sepia|theme-contrast|data-theme|\[data-rd-theme/;

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

// Pass 1: collect every selector that has a light-mode variant anywhere.
const covered = new Set();
const files = cssFiles(ROOT);
const parsed = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rules = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    const rawSel = src.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let depth = 1, j = open + 1;
    while (j < src.length && depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
    const body = src.slice(open + 1, j - 1);
    i = j;
    if (!rawSel || rawSel.startsWith('@')) continue;
    for (const sel of rawSel.split(',')) {
      const s = sel.trim().replace(/\s+/g, ' ');
      if (!s) continue;
      if (THEME_SEL.test(s)) {
        // record the selector this light rule covers
        covered.add(s.replace(/^\s*(\.light-mode|body\.light-mode|:root)\s*/, '').trim());
        covered.add(s);
      }
      rules.push({ file: f, sel: s, body, themed: THEME_SEL.test(s) });
    }
  }
  parsed.push(...rules);
}

// Pass 2: flag dark rules with no counterpart.
const findings = [];
for (const r of parsed) {
  if (r.themed) continue;
  const decls = r.body.split(';');
  // White text is CORRECT on a filled control - a blue button, a red badge.
  // Only flag near-white text when the same rule does not give it a ground of
  // its own to sit on. Without this the report is mostly filled buttons and
  // nobody reads it.
  const paintsOwnGround = decls.some(d => {
    const c = d.indexOf(':');
    if (c === -1) return false;
    const prop = d.slice(0, c).trim().toLowerCase();
    if (!SURFACE_PROP.test(prop)) return false;
    const v = d.slice(c + 1);
    if (/var\(/.test(v)) return true;                 // token-driven ground
    if (/gradient|currentColor/.test(v)) return true; // a painted fill
    const hexes = v.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
    const rgbs  = v.match(/rgba?\([^)]*\)/g) || [];
    // any non-transparent ground counts
    return hexes.some(h => lum(h) !== null) || rgbs.some(g => rgbLum(g) !== null);
  });
  for (const d of decls) {
    const c = d.indexOf(':');
    if (c === -1) continue;
    const prop = d.slice(0, c).trim().toLowerCase();
    const val  = d.slice(c + 1).trim();
    if (prop.startsWith('--')) continue;
    const isSurface = SURFACE_PROP.test(prop);
    const isText    = TEXT_PROP.test(prop);
    if (!isSurface && !isText) continue;
    if (isText && paintsOwnGround) continue;
    // a value made only of var() follows its token, so it is already covered
    const bare = val.replace(/var\([^)]*\)/g, '');
    const hexes = bare.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
    const rgbs  = bare.match(/rgba?\([^)]*\)/g) || [];
    let bad = null;
    for (const h of hexes) { const L = lum(h); if (L === null) continue;
      if (isSurface && L < 42) bad = h; if (isText && L > 224) bad = h; }
    for (const g of rgbs) { const L = rgbLum(g); if (L === null) continue;
      if (isSurface && L < 42) bad = g; if (isText && L > 224) bad = g; }
    if (!bad) continue;
    if (covered.has(r.sel)) continue;
    // Deliberate: video/canvas letterboxing is black in every player, and a
    // white gap round a video frame reads as a rendering bug.
    if (/iframe|video|canvas/.test(r.sel)) continue;
    findings.push({
      file: path.relative(ROOT, r.file).replace(/\\/g, '/'),
      sel: r.sel.slice(0, 62), prop, value: bad, kind: isSurface ? 'dark surface' : 'near-white text'
    });
  }
}

const byFile = {};
for (const f of findings) (byFile[f.file] = byFile[f.file] || []).push(f);

console.log('LIGHT COVERAGE\n');
console.log('  rules painting dark with no light-mode counterpart: ' + findings.length + '\n');
Object.keys(byFile).sort((a, b) => byFile[b].length - byFile[a].length).forEach(f => {
  console.log('  ' + f + '  (' + byFile[f].length + ')');
  byFile[f].slice(0, 8).forEach(x => console.log('      ' + x.kind.padEnd(16) + x.prop + ': ' + x.value + '   ' + x.sel));
  if (byFile[f].length > 8) console.log('      ... ' + (byFile[f].length - 8) + ' more');
});
if (!findings.length) console.log('  none - every dark rule has a light counterpart or is token-driven.');
if (STRICT && findings.length) process.exit(1);
