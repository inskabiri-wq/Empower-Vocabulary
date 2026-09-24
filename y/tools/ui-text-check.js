#!/usr/bin/env node
/**
 * tools/ui-text-check.js
 *
 * Developer notes must not reach a teacher or a student.
 *
 * The app shipped a line telling teachers to "add more or toggle availability
 * in y/assignments/js/exam-registry.js", and another saying a skill runner
 * "isn't built yet". A teacher cannot act on a source path, and text like that
 * makes a working product read as a half-finished one. They are easy to write
 * while building a feature and almost impossible to spot again afterwards,
 * because they only appear in one state of one screen.
 *
 * This flags strings that look like they reach the interface and contain
 * something only a developer should see.
 *
 * Run:  node tools/ui-text-check.js
 *       node tools/ui-text-check.js --json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const BAD = [
  { re: /\by\/[a-z0-9_-]+\/[a-z0-9_/-]+\.(js|css|html)\b/i, why: 'source file path' },
  { re: /\b[a-z0-9_-]+\.(js|css)\b/i,                       why: 'script or stylesheet name' },
  { re: /is ?n'?t built yet|not built yet|not yet built/i,   why: 'unfinished-product wording' },
  { re: /\bTODO\b|\bFIXME\b|\bXXX\b/,                        why: 'work marker' },
  { re: /wire it up|we'?ll wire|next phase|\bPhase \d/i,     why: 'roadmap wording' },
  { re: /lorem ipsum|\bplaceholder text\b/i,                 why: 'placeholder copy' }
];

// Directories that are not shipped interface.
const SKIP_DIRS = new Set(['node_modules', '.claude', 'vendor', 'tools', '.git']);

// Pages that exist to DOCUMENT the app rather than to be used by a teacher or
// a student. Naming a stylesheet is the point of these, not a leak.
const SKIP_FILES = new Set(['fsmvu-loaders.html']);

// Lines that are plainly not UI text.
function isNotUi(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^(\/\/|\/\*|\*|<!--|-->)/.test(t)) return true;        // comments
  if (/<script|<link|<meta|require\(|^import |from ['"]/.test(t)) return true;
  if (/\b(src|href)\s*=/.test(t)) return true;                 // asset references
  if (/^\s*(const|let|var)\s+\w+\s*=\s*require/.test(t)) return true;
  return false;
}

// Lines that plausibly BUILD interface text.
function looksLikeUi(line) {
  return /textContent|innerHTML|innerText|\.title\s*=|placeholder\s*=|alert\(|confirm\(/.test(line)
      || />[^<>]{12,}</.test(line)
      || /^\s*['"`][^'"`]{12,}/.test(line.trim());
}

function walk(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (SKIP_FILES.has(path.basename(file))) continue;
  const src = fs.readFileSync(file, 'utf8');
  // Track block comments across lines. A single-line test cannot tell that
  // line 46 sits inside a /* ... */ that opened on line 30, which is how the
  // rubric-sync note in writing-rubrics.js was flagged as interface text.
  let inBlock = false;
  src.split('\n').forEach((line, i) => {
    const wasInBlock = inBlock;
    const opens = (line.match(/\/\*/g) || []).length;
    const closes = (line.match(/\*\//g) || []).length;
    if (opens > closes) inBlock = true;
    else if (closes > opens) inBlock = false;
    if (wasInBlock || inBlock) return;
    if (isNotUi(line) || !looksLikeUi(line)) return;
    for (const b of BAD) {
      if (b.re.test(line)) {
        hits.push({ file: rel, line: i + 1, why: b.why, text: line.trim().slice(0, 130) });
        break;
      }
    }
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ok: hits.length === 0, hits }, null, 2));
} else if (hits.length) {
  for (const h of hits) {
    console.log('  FAIL  [' + h.why + ']  ' + h.file + ':' + h.line);
    console.log('        ' + h.text);
  }
  console.log('\nFAIL - ' + hits.length + ' developer note(s) reachable from the interface.');
} else {
  console.log('\nPASS - no source paths, work markers or unfinished-product wording in interface text.');
}
process.exit(hits.length ? 1 : 0);
