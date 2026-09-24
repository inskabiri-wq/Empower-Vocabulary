#!/usr/bin/env node
/**
 * sound-wiring-check.js
 *
 * A sound that does not play makes no error. That is the whole problem:
 * playSound() lived in student/js/ui.js, which one page loads, so the nine
 * classroom games were silent for months and nothing ever said so.
 *
 * This gate asserts the wiring instead of the sound:
 *   1. any page whose scripts call the engine actually LOADS the engine
 *   2. nobody re-implements it (no second AudioContext outside sound.js)
 *   3. the engine still exposes what the callers use
 *   4. student game pages stay deliberately silent - that is a decision,
 *      not an accident, and a future edit should have to argue with it
 */
const fs = require('fs');
const path = require('path');

const Y = path.resolve(__dirname, '..');
let failures = 0;
const fail = (m) => { console.log('  FAIL  ' + m); failures++; };
const pass = (m) => console.log('  ok    ' + m);
const read = (p) => fs.readFileSync(path.join(Y, p), 'utf8');
const html = fs.readdirSync(Y).filter((f) => f.endsWith('.html'));

// ── 1. the engine exposes what callers rely on ───────────────────────────
console.log('\n1. js/sound.js exposes its API');
{
  const s = read('js/sound.js');
  ['play', 'enabled', 'setEnabled', 'warmUp', 'types'].forEach((m) => {
    if (!new RegExp('\\b' + m + '\\s*:').test(s)) fail('LLSound.' + m + ' is gone');
  });
  // Every cue any page asks for must exist.
  const defined = [...s.matchAll(/^\s{4}(\w+):\s*function\s*\(c\)/gm)].map((m) => m[1]);
  if (defined.length < 5) fail('only ' + defined.length + ' cues found in SOUNDS - parsing may have broken');
  else pass(defined.length + ' cues defined: ' + defined.join(', '));

  const used = new Set();
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|vendor/.test(e.name)) walk(p); return; }
    if (!/\.(js|html)$/.test(e.name)) return;
    if (p.includes(path.join('tools', 'demos'))) return;
    const t = fs.readFileSync(p, 'utf8');
    [...t.matchAll(/(?:LLSound\.play|MG\.sfx)\(\s*'([a-zA-Z]+)'/g)].forEach((m) => used.add(m[1]));
  });
  walk(Y);
  const missing = [...used].filter((u) => !defined.includes(u));
  if (missing.length) fail('cues used but not defined: ' + missing.join(', '));
  else pass([...used].length + ' cues are called, all of them defined');
}

// ── 2. the pages that are MEANT to make sound load the engine ────────────
// Asserting the design rule directly, rather than trying to infer which
// scripts "really" call the engine. Every call site is guarded (`if
// (window.LLSound)` / `MG.sfx`), so a missing engine is silent rather than
// broken - which means static call-detection cannot tell a genuine gap from
// a deliberate no-op. The rule below is the thing that actually matters.
console.log('\n2. the pages that should make sound, do');
{
  const loadsEngine = (page) => /<script[^>]+src="js\/sound\.js/.test(read(page));

  // Host pages: the projector. These are where classroom sound belongs.
  const hosts = html.filter((f) => /^classroom-.*-teacher\.html$/.test(f));
  const silentHosts = hosts.filter((f) => !loadsEngine(f));
  if (silentHosts.length) fail('host pages missing the engine: ' + silentHosts.join(', '));
  else pass(hosts.length + ' classroom host pages load it');

  // Pages with their own playSound() that delegates to the engine. Without
  // the script tag those calls are silently no-ops - exactly the near-miss
  // this gate was written after.
  ['student-dashboard.html', 'app.html'].forEach((f) => {
    if (!html.includes(f)) return;
    const t = read(f);
    const delegates = /LLSound/.test(t) || t.includes('student/js/ui.js');
    if (delegates && !loadsEngine(f)) {
      fail(f + ' delegates playSound() to LLSound but never loads js/sound.js');
    }
  });
  pass('the two pages with their own playSound() load it');
}

// ── 3. nobody re-implements it ───────────────────────────────────────────
console.log('\n3. one engine, not three');
{
  const offenders = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|vendor|tools/.test(e.name)) walk(p); return; }
    if (!/\.(js|html)$/.test(e.name)) return;
    const rel = path.relative(Y, p).replace(/\\/g, '/');
    if (rel === 'js/sound.js') return;
    const t = fs.readFileSync(p, 'utf8');
    // Creating a context is the tell. classroom-timer.js has its own single
    // beep and predates this; it is grandfathered by name rather than by
    // accident, so a NEW one still fails.
    if (/new\s+\(?\s*(window\.)?AudioContext|webkitAudioContext\s*\)?\s*\(/.test(t)
        && rel !== 'js/classroom-timer.js') {
      offenders.push(rel);
    }
  });
  walk(Y);
  if (offenders.length) fail('a second sound engine appeared in: ' + offenders.join(', '));
  else pass('only js/sound.js creates an AudioContext (classroom-timer.js grandfathered)');
}

// ── 4. student game pages stay silent, ON PURPOSE ────────────────────────
console.log('\n4. student game pages are deliberately silent');
{
  const studentPages = html.filter((f) => /^classroom-.*-student\.html$/.test(f));
  const noisy = studentPages.filter((f) => /<script[^>]+src="js\/sound\.js/.test(read(f)));
  if (noisy.length) {
    fail('these student pages now load the sound engine: ' + noisy.join(', ') +
         '. These games run on a projector with a room full of phones - a cue ' +
         'on every device is a thousand chimes at once. If this is intended, ' +
         'change this gate deliberately.');
  } else {
    pass(studentPages.length + ' student game pages load no sound engine');
  }
}

// ── 5. everything that makes noise obeys the one switch ──────────────────
// The timer beep ignored it, so muting the app silenced everything except
// the timer - on six pages including the teacher dashboard. A switch that
// does not silence something reads as broken, so this is asserted.
console.log('\n5. every sound source obeys the Sound Effects switch');
{
  const t = read('js/classroom-timer.js');
  if (!/soundEnabled/.test(t)) {
    fail('js/classroom-timer.js no longer checks soundEnabled - the timer would ' +
         'beep with the app muted.');
  } else {
    pass('the timer beep checks soundEnabled');
  }
  // The engine itself gates on it too.
  if (!/soundEnabled/.test(read('js/sound.js'))) fail('js/sound.js stopped reading soundEnabled');
  else pass('the shared engine gates on soundEnabled');

  // And the settings row has to describe what it now controls, or a student
  // who mutes it and still hears something assumes it is broken.
  const st = read('js/app-settings.js');
  const m = st.match(/name:\s*'Sound Effects',\s*desc:\s*'([^']+)'/);
  if (!m) fail('the Sound Effects row in app-settings.js changed shape');
  else if (/^Play sounds for correct\/incorrect answers$/.test(m[1])) {
    fail('the Sound Effects description still mentions only answers, but the ' +
         'switch also governs classroom cues and the timer');
  } else pass('the switch describes what it actually controls');
}

// ── 6. the switch is reachable wherever sound plays ──────────────────────
// The settings panel shows the Sound Effects row only where
// `typeof window.toggleSound === 'function'`. That used to be defined in two
// places only, so on every classroom HOST page - the projector, in a hall -
// there was no way to mute or turn down the cues from the page making them.
console.log('\n6. the Sound switch is reachable on every page that plays');
{
  const s = read('js/sound.js');
  // Line-anchored and code-shaped ON PURPOSE. A loose /window\.toggleSound\s*=/
  // also matched the PROSE in the comment above the assignment ("asking
  // `typeof window.toggleSound === 'function'`"), so the gate passed while the
  // real assignment was renamed away. Same trap as the sheet-name regex that
  // matched a filename inside an HTML comment.
  if (!/^\s*window\.toggleSound\s*=\s*function/m.test(s)) {
    fail('js/sound.js no longer defines window.toggleSound - the Sound Effects ' +
         'switch and the volume slider would vanish from every classroom host page.');
  } else pass('js/sound.js defines window.toggleSound');

  // It must be a FALLBACK, not a clobber: the dashboard and app.html have
  // their own that also update an on-page button, and load after this file.
  if (!/typeof window\.toggleSound !== 'function'/.test(s)) {
    fail('the toggleSound fallback is unguarded - it could clobber the richer ' +
         'version on the dashboard depending on load order.');
  } else pass('it is guarded, so a page with its own version keeps it');

  // The panel mounts on DOMContentLoaded, so script ORDER does not matter -
  // only that both files are on the page at all.
  const hosts = html.filter((f) => /^classroom-.*-teacher\.html$/.test(f));
  const bad = hosts.filter((f) => {
    const t = read(f);
    return !/src="js\/sound\.js/.test(t) || !/src="js\/app-settings\.js/.test(t);
  });
  if (bad.length) fail('host pages missing sound.js or app-settings.js: ' + bad.join(', '));
  else pass(hosts.length + ' host pages have both, so the switch renders there');
}

console.log('');
if (failures) { console.log(`sound-wiring-check: ${failures} FAILED`); process.exit(1); }
console.log('sound-wiring-check: all checks passed');
