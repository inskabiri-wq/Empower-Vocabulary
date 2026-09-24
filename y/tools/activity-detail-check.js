#!/usr/bin/env node
/**
 * tools/activity-detail-check.js
 *
 * A Recent Activity row says "tap for items" and expands to the questions the
 * student got right and wrong. It must say that ONLY when there are items.
 *
 * It did not. The generic session writer attached `vocabDetails: []` to every
 * practice session including pronunciation, which never fills it, and the row
 * renderer tested `Array.isArray()` - true for an empty array. So a
 * pronunciation row advertised detail, opened, and showed an empty box.
 *
 * This runs the SHIPPED renderer from teacher/js/activity.js against one
 * session of every kind and asserts what expands.
 *
 * Run:  node tools/activity-detail-check.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'teacher/js/activity.js'), 'utf8');

// The row renderer is inside a map callback, so lift the two pieces it needs.
const gdBlock = src.match(/\/\/ LENGTH, NOT JUST Array\.isArray[\s\S]*?\|\| null;/);
const detailBlock = src.match(/const detailHtml = gd \? `[\s\S]*?` : '';/);
if (!gdBlock || !detailBlock) { console.log('FAIL: could not lift the renderer'); process.exit(1); }

const sb = {
  console,
  escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  _cssVar: () => '#c9d1d9'
};
vm.createContext(sb);

function render(session) {
  sb.session = session;
  // Wrapped in a function, or the second run redeclares `const pick` in the
  // same context and throws before any assertion is reached.
  vm.runInContext(
    '(function(){' + gdBlock[0] + '\n' + detailBlock[0] +
    '\nglobalThis.__gd = gd; globalThis.__html = detailHtml;})()', sb);
  const gd = sb.__gd, html = sb.__html;
  return {
    clickable: !!gd,
    items: gd ? gd.length : 0,
    // how many ticks/crosses actually render
    rendered: (html.match(/✅|❌/g) || []).length
  };
}

let ok = true;
function t(label, session, wantClickable, wantItems) {
  const r = render(session);
  const good = r.clickable === wantClickable && r.items === wantItems && r.rendered === wantItems;
  if (!good) ok = false;
  console.log((good ? '  ok    ' : '  FAIL  ') + label.padEnd(52) +
    'tap=' + (r.clickable ? 'yes' : 'no ') + '  items=' + r.items + '  drawn=' + r.rendered +
    (good ? '' : '   EXPECTED tap=' + wantClickable + ' items=' + wantItems));
}

const G = [{ q: 'He ___ tea', picked: 'drink', correct: 'drinks', ok: false },
           { q: 'They ___ here', picked: 'live', correct: 'live', ok: true }];
const V = [{ q: 'abandon', picked: 'keep', correct: 'leave', ok: false }];
const P = [{ q: 'thorough', picked: 'through', correct: 'thorough', ok: false }];

console.log('EXPANDS');
t('grammar practice (grammarDetails)', { activity: 'grammar-choice', grammarDetails: G }, true, 2);
t('vocabulary practice (vocabDetails)', { activity: 'choice', vocabDetails: V }, true, 1);
t('pronunciation WITH a spoken attempt (pronDetails)', { activity: 'pronunciation', pronDetails: P }, true, 1);

console.log('\nDOES NOT PRETEND TO EXPAND');
t('THE REPORTED BUG: pronunciation, vocabDetails: []', { activity: 'pronunciation', vocabDetails: [] }, false, 0);
t('an old session with no detail fields', { activity: 'choice' }, false, 0);
t('grammar with an empty answers array', { activity: 'grammar-fill', grammarDetails: [] }, false, 0);
t('pronunciation, listened only (no pronDetails)', { activity: 'pronunciation', unscored: true }, false, 0);
t('every detail field empty at once', { grammarDetails: [], vocabDetails: [], pronDetails: [] }, false, 0);
t('a field that is not an array', { grammarDetails: 'nope' }, false, 0);

console.log('\nPRECEDENCE');
t('grammar wins over an empty vocab array', { grammarDetails: G, vocabDetails: [] }, true, 2);
t('vocab used when grammar is empty', { grammarDetails: [], vocabDetails: V }, true, 1);
t('pron used when the other two are empty', { grammarDetails: [], vocabDetails: [], pronDetails: P }, true, 1);

console.log(ok ? '\nPASS - a row offers "tap for items" only when there are items.'
               : '\nFAIL');
process.exit(ok ? 0 : 1);
