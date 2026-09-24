#!/usr/bin/env node
/* ============================================================
   inline-css-check.js

   The app keeps ~1,200 lines of CSS INSIDE HTML <style> blocks -
   teacher-dashboard.html alone has 1,151 with 27 design tokens.
   Every other tool here walks *.css and therefore cannot see any
   of it. That is where the Admin tab's dark palette hid through
   an entire repaint: `#tab-admin` redeclared the --t2-* tokens in
   dark, and an ID selector outranks the .light-mode override in
   the stylesheet, so the Teachers / Demo accounts / Organization
   panels stayed navy while the rest of the app turned white.

   Run:  node y/tools/inline-css-check.js
   Reports any HTML page whose inline CSS declares a dark palette,
   paints dark surfaces or sets near-white text WITHOUT any
   light-mode rules to go with it.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || require('path').resolve(__dirname, '..');

// A dark surface is decided by LUMINANCE, not by how the hex happens to start.
//
// This used to be /#(0.....|1.....|2[0-2]....)/ - anything whose first byte was
// low. That flags saturated colours that are nowhere near dark: #16a34a, the
// green "active today" dot, was reported as a dark surface purely because it
// begins with a 1. A checker that cries wolf is a checker people switch off.
const HEX = /#([0-9a-f]{6})\b/ig;

function luminance(hex) {
  const n = parseInt(hex, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// 0.12 sits well below any surface a light theme would use and well above a
// mid-tone accent. #0d1117 is 0.006; #16a34a is 0.26.
function hasDarkSurface(css) {
  HEX.lastIndex = 0;
  let m;
  while ((m = HEX.exec(css))) {
    if (luminance(m[1]) < 0.12) return true;
  }
  return false;
}
const DARKISH = { test: hasDarkSurface };
const NEARWHITE_TEXT = /(?:^|[;{])\s*(?:-webkit-)?color\s*:\s*(#(?:f[0-9a-f]{5}|e[6-9a-f][0-9a-f]{4})|white|rgba\(\s*255\s*,\s*255\s*,\s*255)/i;

// Not part of the app: a design reference sheet whose entire purpose is showing
// the WHITE seal treatment against a dark ground. Being dark is the point.
const EXEMPT = new Set(['fsmvu-loaders.html']);
const files = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !EXEMPT.has(f));
const report = [];

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const blocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  if (!blocks.length) continue;

  let darkTokens = [], darkRules = 0, whiteText = 0, hasLight = false;
  let offset = 0;

  for (const b of blocks) {
    const css = b[1];
    if (/light-mode|theme-sepia|theme-contrast/.test(css)) hasLight = true;

    // walk rules so we can name the selector that owns a dark value
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf('{', i);
      if (open === -1) break;
      const sel = css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').pop().trim();
      let depth = 1, j = open + 1;
      while (j < css.length && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      const body = css.slice(open + 1, j - 1);
      i = j;
      if (!sel || sel.startsWith('@')) continue;
      if (/light-mode|theme-sepia|theme-contrast/.test(sel)) continue;

      const defs = [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)]
        .filter(m => DARKISH.test(m[2]));
      if (defs.length) darkTokens.push({ sel, n: defs.length, sample: defs[0][1] + ': ' + defs[0][2].trim().slice(0, 24) });

      // Strip token DEFINITIONS, and also token FALLBACKS.
      //
      // `color: var(--text-primary, #0f172a)` is not a dark rule. The theme
      // supplies the value; the literal is only reached if the token is
      // missing entirely, and it is the correct colour for the dark theme
      // anyway. Counting those flagged the old teacher-mobile.html - a page written
      // entirely in tokens - as having "3 dark rules", which is exactly the
      // sort of false positive that teaches you to ignore the tool.
      const withoutTokens = body
        .replace(/--[\w-]+\s*:[^;]+;?/g, '')          // definitions
        // Fallbacks, allowing ONE level of nesting so that
        // `var(--tint-line, rgba(15,23,42,.06))` is stripped too. A flat
        // [^()]* stops at the first "(" and leaves the rgba behind, which is
        // how one false positive survived the first version of this fix.
        .replace(/var\(\s*--[\w-]+\s*,(?:[^()]|\([^()]*\))*\)/g, '');
      if (DARKISH.test(withoutTokens)) darkRules++;
      if (NEARWHITE_TEXT.test(body)) whiteText++;
    }
  }

  if (darkTokens.length || darkRules || whiteText) {
    report.push({ f, darkTokens, darkRules, whiteText, hasLight });
  }
}

console.log('CSS inside HTML <style> blocks that still assumes a dark page\n');
for (const r of report) {
  console.log('  ' + r.f + (r.hasLight ? '   (has some light-mode rules)' : '   <-- NO light-mode rules at all'));
  console.log('      dark rules: ' + r.darkRules + '    near-white text rules: ' + r.whiteText);
  for (const t of r.darkTokens.slice(0, 6)) {
    console.log('      palette on `' + t.sel + '`  (' + t.n + ' tokens)  e.g. ' + t.sample);
  }
  console.log('');
}
if (!report.length) { console.log('  none'); process.exit(0); }
var unguarded = report.filter(function (r) { return !r.hasLight; });
if (unguarded.length) {
  console.log('FAIL - ' + unguarded.length + ' page(s) with inline dark CSS and no light-mode rules:');
  unguarded.forEach(function (r) { console.log('  ' + r.f); });
  process.exit(1);
}
console.log('PASS - every page with inline dark CSS also has light-mode rules.');
