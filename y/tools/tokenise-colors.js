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

// value -> token, but ONLY on a text property (`color`, `-webkit-text-fill-color`).
// These are pale tints that are legible on dark navy and invisible on white:
// pale red on a red-tinted card, pale green on a green one, and so on. They are
// kept out of MAP on purpose - the same pale red is often ALSO the card's border
// or background, where swapping in the dark light-mode value would be wrong.
// Property-scoping is what makes them safe to rewrite.
const TEXT_MAP = {
  // Accent / link text.
  '#93c5fd': '--text-accent',
  '#7dd3fc': '--text-accent',
  '#bfdbfe': '--text-accent',
  '#c4b5fd': '--text-accent',
  '#ddd6fe': '--text-accent',
  '#e0e7ff': '--text-accent',
  '#67e8f9': '--text-accent',
  // Success text.
  '#6ee7b7': '--text-success',
  '#86efac': '--text-success',
  // Error text.
  '#fca5a5': '--text-error',
  // Warning text.
  '#fef08a': '--text-warning',
  '#fde68a': '--text-warning',
  '#facc15': '--text-warning',
  '#fcd34d': '--text-warning',
  // Near-white body text that MAP does not carry.
  '#e8edf7': '--text-primary',
  '#b4c0d8': '--text-secondary',
  '#d7dfee': '--text-secondary',
  'rgba(232,237,247,0.55)': '--text-muted',
  'rgba(232,237,247,0.65)': '--text-muted'
};

// Which declarations TEXT_MAP is allowed to touch.
const TEXT_PROP = /^\s*(?:-webkit-)?text-fill-color\s*$|^\s*color\s*$|^\s*caret-color\s*$|^\s*text-decoration-color\s*$/;

// ---- The translucent-white idiom -------------------------------------------
// `rgba(255,255,255,a)` is dark-theme shorthand for "slightly lighter than the
// surface": a raised panel, a hairline border, dimmed label text. On a white
// page all three render as nothing at all - an invisible box with invisible
// text in it. There were 175 of them.
//
// They collapse to three tints, chosen by PROPERTY and alpha. Crucially the
// tokens are declared ONLY in the theme blocks, never in :root, so in dark mode
// `var(--tint-line, rgba(255,255,255,0.08))` falls through to the original
// literal and dark is unchanged to the byte.
const SURFACE_PROP = /^\s*background(-color|-image)?\s*$/;
const BORDER_PROP  = /^\s*(border|border-(top|right|bottom|left)|border(-[a-z]+)?-color|outline|outline-color)\s*$/;

function whiteAlpha(v) {
  const m = /^rgba\(255,255,255,([\d.]+)\)$/.exec(v);
  return m ? parseFloat(m[1]) : null;
}
// A raised surface only. Higher alphas are near-solid white panels that already
// suit a light page, so they are left alone.
function surfaceTint(v) {
  const a = whiteAlpha(v);
  return (a !== null && a > 0 && a <= 0.08) ? '--tint-surface' : undefined;
}
function borderTint(v) {
  const a = whiteAlpha(v);
  if (a === null) return undefined;
  if (a > 0 && a <= 0.14) return '--tint-line';
  if (a > 0.14 && a <= 0.35) return '--tint-line-strong';
  return undefined;
}
// Dimmed white label text maps onto the text tokens that already exist.
function whiteTextToken(v) {
  const a = whiteAlpha(v);
  if (a === null) return undefined;
  if (a >= 0.75) return '--text-primary';
  if (a >= 0.56) return '--text-secondary';
  if (a >= 0.3)  return '--text-muted';
  return undefined;
}

// A colour inside one of these selectors is a THEME OVERRIDE - it is the
// light/sepia/contrast value itself. Tokenising it would make the theme
// point at the token it is supposed to be setting.
const THEME_SELECTOR = /(light-mode|theme-sepia|theme-contrast)/;

// A theme PREVIEW swatch paints the theme it offers, not the theme in use, so
// its colours must stay literal. Tokenising them drew the light swatch in
// near-white on near-white the moment light became the default.
const PREVIEW_SELECTOR = /(rd-pref-swatch|wr-pref-swatch|as-theme-swatch|theme-preview)/;

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+(?:\s*,\s*[0-9.]+)?\)/g;

function norm(v) { return v.toLowerCase().replace(/\s+/g, ''); }

// Split a line into declaration-sized chunks on top-level `;` only. Semicolons
// inside url(), gradients or data: URIs must not split, or the property name of
// the following chunk is garbage and TEXT_PROP silently stops matching.
// Separators are kept attached so join('') round-trips the line byte for byte.
function splitDecls(line) {
  const parts = [];
  let depth = 0, start = 0;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) { parts.push(line.slice(start, k + 1)); start = k + 1; }
  }
  parts.push(line.slice(start));
  return parts;
}

// Apply `fn` to the colours in a value, but SKIP anything already inside a
// var(...) group. Without this the tool is not idempotent: the fallback it
// writes still contains the literal, so the next run matches it again and
// produces var(--x, var(--x, #hex)), one layer deeper every time.
function replaceOutsideVar(value, fn) {
  let out = '', k = 0;
  while (k < value.length) {
    const at = value.indexOf('var(', k);
    if (at === -1) { out += value.slice(k).replace(COLOR_RE, fn); break; }
    out += value.slice(k, at).replace(COLOR_RE, fn);
    let depth = 0, j = at;
    for (; j < value.length; j++) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')') { depth--; if (depth === 0) { j++; break; } }
    }
    out += value.slice(at, j);          // verbatim, already tokenised
    k = j;
  }
  return out;
}

// Collapse var(--x, var(--x, V)) -> var(--x, V), however deep. Repairs files
// that earlier, non-idempotent runs already nested.
function collapseNested(css) {
  const re = /var\((--[\w-]+),\s*var\(\1,\s*([^()]*(?:\([^()]*\)[^()]*)*)\)\)/g;
  let prev;
  do { prev = css; css = css.replace(re, 'var($1, $2)'); } while (css !== prev);
  return css;
}

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
    } else if (THEME_SELECTOR.test(selector) || PREVIEW_SELECTOR.test(selector) || /:root/.test(selector)) {
      report.skippedBlocks++;
      out += body;
    } else {
      out += body.split('\n').map(line => {
        // Never rewrite a custom-property definition.
        if (/^\s*--[\w-]+\s*:/.test(line)) { report.skippedVarDecl++; return line; }
        // Rewrite PER DECLARATION, not per line. One line often carries several
        // (`background: x; color: y`), and TEXT_MAP must only reach the text
        // one - otherwise a pale red used as both a border and a label gets the
        // dark light-mode value in the border too.
        return splitDecls(line).map(part => {
          const colon = part.indexOf(':');
          const prop = colon === -1 ? '' : part.slice(0, colon).replace(/^[\s;]+/, '');
          const isText = TEXT_PROP.test(prop);
          return replaceOutsideVar(part, m => {
            const v = norm(m);
            const token = MAP[v]
              || (isText ? (TEXT_MAP[v] || whiteTextToken(v)) : undefined)
              || (SURFACE_PROP.test(prop) ? surfaceTint(v) : undefined)
              || (BORDER_PROP.test(prop)  ? borderTint(v)  : undefined);
            if (!token) return m;
            report.replaced++;
            report.byToken[token] = (report.byToken[token] || 0) + 1;
            return 'var(' + token + ', ' + m + ')';
          });
        }).join('');
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

let totalCollapsed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // Repair earlier non-idempotent runs first, THEN tokenise. replaceOutsideVar
  // keeps this run from adding a fresh layer.
  const flat = collapseNested(src);
  if (flat !== src) totalCollapsed++;
  const report = { replaced: 0, skippedBlocks: 0, skippedVarDecl: 0, byToken: {} };
  const outCss = tokenise(flat, report);
  if (report.replaced > 0 || flat !== src) {
    if (report.replaced > 0) {
      perFile.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), n: report.replaced });
      totalReplaced += report.replaced;
      for (const k in report.byToken) grand.byToken[k] = (grand.byToken[k] || 0) + report.byToken[k];
    }
    if (FIX) fs.writeFileSync(f, outCss, 'utf8');
  }
}

perFile.sort((a, b) => b.n - a.n);
console.log(FIX ? 'TOKENISE (applied)' : 'TOKENISE (dry run)');
console.log('');
console.log('stylesheets scanned   ' + files.length);
console.log('nested var() repaired ' + totalCollapsed);
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
