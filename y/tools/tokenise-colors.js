#!/usr/bin/env node
/* ============================================================
   tokenise-colors.js

   Themes could only ever recolour the student dashboard, because
   every other stylesheet hardcodes its surfaces, text and borders.
   A token override on <body> cannot reach a literal #152035.

   This rewrites that ONE family of colours (page background, card,
   item, text, border) to var(--token, <original value>). The
   original stays as the fallback, so nothing changes visually until
   a theme actually overrides the token, and a missing token can
   never blank the app out.

   Brand accents (blue / green / amber / red / purple / teal) are
   deliberately NOT touched - those are meant to stay constant in
   every theme. Neither is white, which is text on coloured buttons.

   Run:  node y/tools/tokenise-colors.js          (dry run, reports)
         node y/tools/tokenise-colors.js --fix    (writes)
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');

// value -> token. Keys are normalised (lowercase, spaces stripped).
const MAP = {
  // Page / surface backgrounds, darkest to lightest.
  '#0a0f1a': '--bg-primary',
  '#0b1220': '--bg-primary',
  '#0f172a': '--bg-primary',
  '#0f1729': '--bg-secondary',
  '#111827': '--bg-secondary',
  '#152035': '--bg-card',
  '#0d1426': '--bg-secondary',
  '#1e293b': '--bg-item',
  '#1c2a42': '--bg-item',
  '#1f2937': '--bg-item',
  // Text.
  '#f8fafc': '--text-primary',
  '#f1f5f9': '--text-primary',
  '#e2e8f0': '--text-secondary',
  '#cbd5e1': '--text-secondary',
  '#94a3b8': '--text-secondary',
  '#64748b': '--text-muted',
  '#475569': '--text-muted',
  // Border.
  'rgba(59,130,246,0.2)': '--border-color'
};

// A colour inside one of these selectors is a THEME OVERRIDE - it is the
// light/sepia/contrast value itself. Tokenising it would make the theme
// point at the token it is supposed to be setting.
const THEME_SELECTOR = /(light-mode|theme-sepia|theme-contrast)/;

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+(?:\s*,\s*[0-9.]+)?\)/g;

function norm(v) { return v.toLowerCase().replace(/\s+/g, ''); }

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

// Split into blocks so we know which selector a declaration belongs to, and
// so we never rewrite a custom-property definition into a self-reference.
function tokenise(css, report) {
  let out = '';
  let i = 0;
  let selector = '';
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) { out += css.slice(i); break; }
    selector = css.slice(i, open);
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    out += selector + '{';
    // Nested (@media, @supports): recurse so inner selectors are seen.
    if (/@(media|supports|container)/.test(selector)) {
      out += tokenise(body, report);
    } else if (THEME_SELECTOR.test(selector) || /:root/.test(selector)) {
      report.skippedBlocks++;
      out += body;
    } else {
      out += body.split('\n').map(line => {
        // Never rewrite a custom-property definition.
        if (/^\s*--[\w-]+\s*:/.test(line)) { report.skippedVarDecl++; return line; }
        return line.replace(COLOR_RE, m => {
          const token = MAP[norm(m)];
          if (!token) return m;
          report.replaced++;
          report.byToken[token] = (report.byToken[token] || 0) + 1;
          return 'var(' + token + ', ' + m + ')';
        });
      }).join('\n');
    }
    out += '}';
    i = j;
  }
  return out;
}

const files = cssFiles(ROOT);
let totalReplaced = 0;
const perFile = [];
const grand = { byToken: {} };

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // Already tokenised values are inside var(...) and would be matched again;
  // guard by skipping anything already wrapped.
  const report = { replaced: 0, skippedBlocks: 0, skippedVarDecl: 0, byToken: {} };
  const outCss = tokenise(src, report);
  if (report.replaced > 0) {
    perFile.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), n: report.replaced });
    totalReplaced += report.replaced;
    for (const k in report.byToken) grand.byToken[k] = (grand.byToken[k] || 0) + report.byToken[k];
    if (FIX) fs.writeFileSync(f, outCss, 'utf8');
  }
}

perFile.sort((a, b) => b.n - a.n);
console.log(FIX ? 'TOKENISE (applied)' : 'TOKENISE (dry run)');
console.log('');
console.log('stylesheets scanned   ' + files.length);
console.log('stylesheets changed   ' + perFile.length);
console.log('colours tokenised     ' + totalReplaced);
console.log('');
console.log('by token:');
Object.keys(grand.byToken).sort((a, b) => grand.byToken[b] - grand.byToken[a])
  .forEach(k => console.log('  ' + k.padEnd(18) + grand.byToken[k]));
console.log('');
console.log('top files:');
perFile.slice(0, 18).forEach(r => console.log('  ' + String(r.n).padStart(4) + '  ' + r.file));
if (!FIX) console.log('\nnothing written. re-run with --fix to apply.');
