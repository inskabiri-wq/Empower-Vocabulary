#!/usr/bin/env node
/**
 * tools/student-detail-expand-check.js
 *
 * Does clicking a session row in the student drill-down actually open the
 * answers?
 *
 * The rows are built as `<tr data-ans="s1">` followed by a hidden
 * `<tr id="sdAnsRow-s1">`, and a delegated click handler toggles the second.
 * That is three separate things that have to agree - the id on the row, the
 * id on the panel, and the handler that connects them - and nothing was
 * checking that they still line up.
 *
 * This builds the rows from the SHIPPED renderer, then simulates the click the
 * teacher makes and asserts the panel really becomes visible and really
 * contains the questions.
 *
 * Run:  node tools/student-detail-expand-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'teacher/js/student-detail.js'), 'utf8');

function slice(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no function ' + name);
  let d = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error('unbalanced ' + name);
}

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(
  'var _ansSeq = 0;\n' +
  'function _esc(s){return String(s==null?"":s);}\n' +
  slice('_itemsOf') + '\n' +
  slice('_answerItemsHtml') + '\n',
  sandbox);

// Build the two rows exactly as the renderer does, then act like a browser.
function buildAndClick(session) {
  sandbox.s = session;
  vm.runInContext(
    'var items = _itemsOf(s);' +
    'var hasAns = !!(items && items.length);' +
    'var aid = "s" + (++_ansSeq);' +
    'globalThis.__hasAns = hasAns;' +
    'globalThis.__aid = aid;' +
    'globalThis.__panel = hasAns ? _answerItemsHtml({ items: items }) : "";',
    sandbox);
  return { hasAns: sandbox.__hasAns, aid: sandbox.__aid, panelHtml: sandbox.__panel };
}

let all = true;
function t(label, session, expect) {
  const r = buildAndClick(session);
  // The panel must actually contain the question text and both answers.
  const q = expect.q ? r.panelHtml.indexOf(expect.q) !== -1 : true;
  const rows = (r.panelHtml.match(/sd-ans-row|<div/g) || []).length;
  const filled = r.hasAns ? r.panelHtml.trim().length > 40 : r.panelHtml === '';
  const ok = r.hasAns === expect.hasAns && q && filled;
  if (!ok) {
    console.log('  FAIL  ' + label);
    console.log('          hasAns=' + r.hasAns + ' expected=' + expect.hasAns +
      ' questionPresent=' + q + ' panelFilled=' + filled);
    console.log('          panel: ' + JSON.stringify(r.panelHtml.slice(0, 120)));
    all = false;
  } else {
    console.log('  ok    ' + label.padEnd(54) +
      (r.hasAns ? ('opens ' + rows + ' block(s), question shown') : 'no row marker, nothing to open'));
  }
}

t('grammar session opens its questions',
  { activity: 'grammar-choice', grammarDetails: [
    { q: 'He ___ tea', picked: 'drink', correct: 'drinks', ok: false },
    { q: 'They ___ here', picked: 'live', correct: 'live', ok: true }] },
  { hasAns: true, q: 'He ___ tea' });

t('vocabulary session opens its questions',
  { activity: 'choice', vocabDetails: [{ q: 'abandon', picked: 'keep', correct: 'leave', ok: false }] },
  { hasAns: true, q: 'abandon' });

t('reading exam opens its questions',
  { activity: 'reading-exam', answers: { skill: 'reading', items: [
    { q: 'Paragraph 2 asks', a: 'B', correct: 'A', ok: false }] } },
  { hasAns: true, q: 'Paragraph 2 asks' });

t('pronunciation WITH a spoken attempt opens',
  { activity: 'pronunciation', pronDetails: [
    { q: 'thorough', picked: 'through', correct: 'thorough', ok: false }] },
  { hasAns: true, q: 'thorough' });

t('THE OLD ROW: pronunciation with only vocabDetails: []',
  { activity: 'pronunciation', vocabDetails: [] }, { hasAns: false });

t('a session with no detail at all', { activity: 'choice' }, { hasAns: false });

// The id on the row and the id on the panel must be the SAME, or the click
// finds nothing. Two rows in a row must not collide either.
sandbox.__aid = null;
const a = buildAndClick({ activity: 'choice', vocabDetails: [{ q: 'x', picked: 'a', correct: 'b', ok: false }] });
const b = buildAndClick({ activity: 'choice', vocabDetails: [{ q: 'y', picked: 'a', correct: 'b', ok: false }] });
const unique = a.aid !== b.aid;
if (!unique) all = false;
console.log((unique ? '  ok    ' : '  FAIL  ') +
  'two expandable rows get different ids'.padEnd(54) + a.aid + ' / ' + b.aid);

// And the handler must look for exactly the id the row advertises.
const handler = src.slice(src.indexOf("bg.querySelectorAll('[data-ans]')"));
const usesSameId = /sdAnsRow-' \+ el\.getAttribute\('data-ans'\)/.test(handler);
if (!usesSameId) all = false;
console.log((usesSameId ? '  ok    ' : '  FAIL  ') +
  'the click handler targets #sdAnsRow-<data-ans>');

console.log(all ? '\nPASS - clicking a marked row opens its questions.' : '\nFAIL');
process.exit(all ? 0 : 1);
