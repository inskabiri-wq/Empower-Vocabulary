#!/usr/bin/env node
/**
 * tools/tile-art-check.js
 *
 * Every skill on the student hub should have artwork, and every piece of
 * artwork should belong to a real skill.
 *
 * WHY
 * The hub's tiles are driven by a SKILLS list in student/js/hub.js, and their
 * artwork is a matching file in y/img/skill-tiles/. Nothing connected the two,
 * so when the set of skills and the set of images drifted apart it showed up as
 * one tile silently looking different from the rest - which is exactly how the
 * Courses tile shipped with no image while the other seven had one.
 *
 * Missing art is a FAILURE. Orphaned art is only a warning: a file can exist
 * ahead of a skill being switched on, or after one is retired, and neither is
 * broken.
 *
 *   node tools/tile-art-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HUB = path.join(ROOT, 'student', 'js', 'hub.js');
const DIR = path.join(ROOT, 'img', 'skill-tiles');
// Kept in step with js/tile-images.js
const EXTS = ['webp', 'jpg', 'jpeg', 'png', 'svg'];

// Cards appended to the grid by their own module rather than listed in SKILLS.
const EXTRA = ['placement'];

function hubSkillIds() {
  const src = fs.readFileSync(HUB, 'utf8');
  const start = src.indexOf('SKILLS');
  if (start < 0) throw new Error('SKILLS not found in hub.js');
  // Only ids inside the SKILLS array, not every `id:` in the file.
  let i = src.indexOf('[', start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (!depth) { end = i; break; } }
  }
  const block = src.slice(start, end > 0 ? end : undefined);
  const ids = [];
  for (const m of block.matchAll(/\bid:\s*'([a-z0-9-]+)'/gi)) ids.push(m[1]);
  return [...new Set(ids)];
}

function artFor(id) {
  for (const e of EXTS) {
    if (fs.existsSync(path.join(DIR, 'skill-tile-' + id + '.' + e))) return 'skill-tile-' + id + '.' + e;
  }
  return null;
}

if (!fs.existsSync(DIR)) {
  console.error('tile-art-check: ' + path.relative(ROOT, DIR) + ' does not exist');
  process.exit(1);
}

const wanted = hubSkillIds().concat(EXTRA);
const missing = [];
const have = {};
for (const id of wanted) {
  const f = artFor(id);
  if (f) have[id] = f; else missing.push(id);
}

// Anything in the folder that no skill claims.
const claimed = new Set(Object.values(have));
const orphans = fs.readdirSync(DIR)
  .filter(f => /^skill-tile-.+\.(webp|jpg|jpeg|png|svg)$/i.test(f))
  .filter(f => !claimed.has(f));

console.log('hub skills with artwork: ' + Object.keys(have).length + ' / ' + wanted.length);
for (const id of wanted) {
  console.log('  ' + (have[id] ? '  ok  ' : ' MISS ') + id + (have[id] ? '  ' + have[id] : ''));
}
if (orphans.length) {
  console.log('\nartwork no skill claims (not a failure):');
  orphans.forEach(f => console.log('  ' + f));
}

if (missing.length) {
  console.log('\nFAIL - no artwork for: ' + missing.join(', '));
  console.log('Add y/img/skill-tiles/skill-tile-<id>.(webp|jpg|png|svg) - see y/img/README.md');
  process.exit(1);
}
console.log('\nPASS - every hub tile has artwork.');
