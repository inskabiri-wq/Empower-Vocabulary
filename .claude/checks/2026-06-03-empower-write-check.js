/* Smoke check for the staging Empower Write.
   - loads config + sample under a stubbed window (no DOM needed)
   - verifies EVERY annotation quote anchors in the essay (in order)
   - checks CSS brace balance + index.html structure
   Run: node 2026-06-03-empower-write-check.js */
const fs = require('fs');
const BASE = 'E:/vocab-trainer/.staging/empower-write/';
let fail = 0;
const ok = (m) => console.log('  ok  ' + m);
const bad = (m) => { console.log(' FAIL ' + m); fail++; };

// ── load config + sample (safe: no DOM at load time) ──
global.window = {};
try {
  eval(fs.readFileSync(BASE + 'js/corrector-config.js', 'utf8'));
  eval(fs.readFileSync(BASE + 'js/sample.js', 'utf8'));
  ok('config + sample evaluate cleanly');
} catch (e) { bad('eval error: ' + e.message); }

const SAMPLES = global.window.CORRECTOR_SAMPLES || (global.window.CORRECTOR_SAMPLE ? [global.window.CORRECTOR_SAMPLE] : []);
const LV = global.window.CORRECTOR_LEVELS;
if (!SAMPLES.length || !LV) bad('globals missing');

// ── sequential quote anchoring (mirrors corrector.js) ──
function anchorReport(text, anns) {
  let cursor = 0; const miss = [];
  anns.forEach(a => {
    const q = a.quote || '';
    let s = q ? text.indexOf(q, cursor) : -1;
    if (s === -1 && q) s = text.indexOf(q);
    if (s === -1) miss.push(q); else cursor = s + q.length;
  });
  return miss;
}
SAMPLES.forEach((S, si) => {
  const tag = 'S' + (si + 1) + '(' + (S.rubric || '?') + ')';
  ['light', 'medium', 'deep'].forEach(lv => {
    const c = S.corrections && S.corrections[lv];
    if (!c) { bad(tag + ' ' + lv + ': correction missing'); return; }
    const miss = anchorReport(S.essay, c.annotations);
    if (miss.length) miss.forEach(q => bad(tag + ' ' + lv + ' quote NOT found: "' + q + '"'));
    else ok(tag + ' ' + lv + ': all ' + c.annotations.length + ' quotes anchor');
    if (!c.overall) bad(tag + ' ' + lv + ': missing overall');
    if (!c.criteria) bad(tag + ' ' + lv + ': missing criteria');
    const sevs = new Set(c.annotations.map(a => a.severity));
    [...sevs].forEach(s => { if (!['fix', 'tip', 'strength'].includes(s)) bad(tag + ' ' + lv + ': bad severity ' + s); });
    if (!c.annotations.some(a => a.severity === 'strength')) bad(tag + ' ' + lv + ': no strength');
  });
});

// ── CSS brace balance ──
try {
  const css = fs.readFileSync(BASE + 'css/corrector.css', 'utf8');
  const open = (css.match(/{/g) || []).length, close = (css.match(/}/g) || []).length;
  if (open === close) ok('corrector.css braces balanced (' + open + ')');
  else bad('corrector.css braces ' + open + ' { vs ' + close + ' }');
} catch (e) { bad('css read: ' + e.message); }

// ── index.html quick structure ──
try {
  const html = fs.readFileSync(BASE + 'index.html', 'utf8');
  const need = [
    '../../y/index/css/variables.css',
    '../../y/assignments/js/writing-comment-bank.js',
    '../../y/assignments/js/writing-annotations.js',
    'js/corrector-config.js', 'js/sample.js', 'js/corrector.js',
    'id="corEssayBox"', 'id="corPanel"', 'id="corLevels"'
  ];
  need.forEach(n => html.includes(n) ? ok('html has ' + n) : bad('html MISSING ' + n));
  const od = (html.match(/<div/g) || []).length, cd = (html.match(/<\/div>/g) || []).length;
  if (od === cd) ok('html <div> balanced (' + od + ')'); else bad('html div ' + od + ' open vs ' + cd + ' close');
  if (html.trim().endsWith('</html>')) ok('html closes'); else bad('html not closed');
} catch (e) { bad('html read: ' + e.message); }

// ── referenced real files exist ──
['y/index/css/variables.css', 'y/assignments/js/writing-comment-bank.js', 'y/assignments/js/writing-annotations.js']
  .forEach(p => fs.existsSync('E:/vocab-trainer/' + p) ? ok('real file present: ' + p) : bad('real file MISSING: ' + p));

console.log(fail ? ('\nRESULT: FAIL (' + fail + ')') : '\nRESULT: PASS');
process.exit(fail ? 1 : 0);
