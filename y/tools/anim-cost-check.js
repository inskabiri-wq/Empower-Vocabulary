#!/usr/bin/env node
/**
 * tools/anim-cost-check.js
 *
 * Fails if any FOREVER-RUNNING animation animates a property the browser
 * cannot composite.
 *
 * WHY
 * `transform` and `opacity` are handled by the GPU compositor: the element is
 * painted once and then moved or faded, costing almost nothing per frame.
 * Everything else - box-shadow, background-position, width, top, filter - makes
 * the CPU re-rasterise the element on EVERY frame. One such animation set to
 * `infinite` means the device never gets an idle frame.
 *
 * That is what made the teacher's Galaxy Tab S9 FE+ feel sluggish just sitting
 * on the tiles: `badgePulse` animated box-shadow and `dashXpShine` animated
 * background-position, both infinite, on a 2560x1600 panel. Neither was caught
 * by the earlier touch gate, which only removed backdrop-filter.
 *
 * A one-shot entrance animation is fine and is ignored - it costs a few frames
 * once. Only `infinite` is checked.
 *
 *   node tools/anim-cost-check.js            # all student + shared CSS
 *   node tools/anim-cost-check.js --all      # every .css and .html in y/
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Safe to animate: the compositor owns these.
const CHEAP = new Set(['transform', 'opacity', 'visibility',
                       // custom properties: only meaningful via @property, and
                       // the arc loader registers one deliberately
                       'offset-distance']);

// Properties whose animation forces a repaint or reflow every frame. Not
// exhaustive - it is the set this codebase has actually reached for.
const EXPENSIVE = [
  'box-shadow', 'background-position', 'background-size', 'background-color',
  'background', 'filter', 'backdrop-filter', 'width', 'height', 'top', 'left',
  'right', 'bottom', 'margin', 'padding', 'border-radius', 'border-width',
  'color', 'text-shadow', 'clip-path', 'max-height', 'font-size'
];

// Known exceptions, each with the reason it is acceptable. The cost of an
// always-on repaint is only paid while the thing is ON SCREEN, so an animation
// that runs for a second during loading is not the same problem as one that
// runs for as long as a student looks at the hub.
//
// Add to this ONLY with a reason. A permanently failing check is a check
// people learn to ignore.
const ALLOW = {
  'musicPulse':     'classroom game pages only, never the student hub',
  'as-sk':          'skeleton placeholder - runs for the second before data lands',
  'fsmvu-breathe':  'loader, on screen only while something is loading',
  'fsmvu-draw':     'loader variant, same',
  'fsmvu-splash':   'login splash, one pass then the element is removed',
  'vgPulse':        'a "must change" badge in the vocab game, rarely on screen'
};

function cssFiles(all) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules', '.git', '.tmp', '.claude', 'vendor'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.css$/i.test(e.name)) out.push(p);
      else if (all && /\.html$/i.test(e.name)) out.push(p);
    }
  })(ROOT);
  return out;
}

// Which keyframe names are used with `infinite`?
function infiniteNames(css) {
  const names = new Set();
  for (const m of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/gi)) {
    const v = m[1];
    if (!/\binfinite\b/i.test(v)) continue;
    // first token that is not a time, easing, keyword or number
    for (const tok of v.split(/[\s,]+/)) {
      if (!tok) continue;
      if (/^\d|^(infinite|linear|ease|ease-in|ease-out|ease-in-out|both|forwards|backwards|alternate|reverse|none|running|paused|normal|steps|cubic-bezier)/i.test(tok)) continue;
      if (/^(cubic-bezier|steps)\(/i.test(tok)) continue;
      names.add(tok.replace(/[(),]/g, ''));
      break;
    }
  }
  return names;
}

function keyframeBodies(css) {
  const map = {};
  const re = /@keyframes\s+([\w-]+)\s*\{/gi;
  let m;
  while ((m = re.exec(css))) {
    // brace-match the block rather than regex to the first "}", which would
    // stop at the end of the first keyframe step
    let i = re.lastIndex - 1, depth = 0, end = -1;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') { depth--; if (!depth) { end = i; break; } }
    }
    if (end > 0) map[m[1]] = css.slice(re.lastIndex, end);
  }
  return map;
}

const files = cssFiles(process.argv.includes('--all'));
const findings = [];
const allowed = [];

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const css = /\.html$/i.test(f)
    ? [...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n')
    : raw;
  if (!css.trim()) continue;

  const infinite = infiniteNames(css);
  if (!infinite.size) continue;
  const bodies = keyframeBodies(css);

  for (const name of infinite) {
    const body = bodies[name];
    if (!body) continue;                       // defined in another file
    const props = new Set();
    for (const pm of body.matchAll(/(^|[;{\s])([a-z-]+)\s*:/gi)) props.add(pm[2].toLowerCase());
    const bad = [...props].filter(p => EXPENSIVE.includes(p) && !CHEAP.has(p));
    if (bad.length) {
      const rec = { file: path.relative(ROOT, f).split(path.sep).join('/'), name, bad };
      if (ALLOW[name]) allowed.push(Object.assign({ why: ALLOW[name] }, rec));
      else findings.push(rec);
    }
  }
}

if (allowed.length) {
  console.log('Allowed exceptions (not on the hub, or only briefly on screen):');
  for (const x of allowed) console.log('  ' + x.name.padEnd(16) + x.why);
  console.log('');
}
if (!findings.length) {
  console.log('PASS - no always-on animation repaints on a screen a student sits on.');
  process.exit(0);
}
console.log('Infinite animations that repaint on every frame:\n');
for (const x of findings) {
  console.log('  ' + x.file + '  @keyframes ' + x.name);
  console.log('      animates: ' + x.bad.join(', '));
}
console.log('\nFAIL - ' + findings.length + ' always-on animation(s) on the paint path.');
console.log('Move them to transform / opacity, usually by animating a pseudo-element.');
process.exit(1);
