#!/usr/bin/env node
'use strict';
/* ============================================================
   aiquiz-lang-check.js - is the AI Quiz really in two languages?
   ------------------------------------------------------------
   The AI Quiz runs in English, Türkçe, or both (asked for 2026-09-23: "the
   AI QUIZ ... in 2 languages"). The teacher picks on the setup screen; each
   phone can switch. That only works if EVERYTHING it shows has both sides:

     1. every active question, and every one of its options, has non-empty
        English AND Turkish (a missing side shows as a blank line)
     2. every module title has both
     3. every string in the phone's STR table has both
     4. no English message is left hard-coded in the phone script, where the
        switch could never reach it
     5. the setup screen offers both / en / tr, the phone page has the switch,
        and every data-i18n key on the phone page exists in STR

   Static: reads the files, no emulator needed.
   Usage:  node y/tools/aiquiz-lang-check.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const Y = path.join(__dirname, '..');

let pass = 0, fail = 0;
const failures = [];
const ok = (m) => { pass++; console.log('  ok    ' + m); };
const bad = (m, d) => { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); };
const full = (x) => typeof x === 'string' && x.trim().length > 0;

// ── the bank ──
const bankSrc = fs.readFileSync(path.join(Y, 'classroom', 'js', 'ai-quiz-questions.js'), 'utf8');
const sandbox = {};
new Function('window', bankSrc)(sandbox);
const BANK = sandbox.AI_QUIZ;

console.log('QUESTION BANK');
if (!BANK || !Array.isArray(BANK.questions)) {
  bad('could not load window.AI_QUIZ from classroom/js/ai-quiz-questions.js');
} else {
  const active = BANK.questions.filter(q => q.active !== false);
  const missing = [];
  active.forEach(q => {
    if (!q.q || !full(q.q.en) || !full(q.q.tr)) missing.push(q.id + ' question');
    (q.options || []).forEach((o, i) => {
      if (!o || !full(o.en) || !full(o.tr)) missing.push(q.id + ' option ' + 'ABCD'.charAt(i));
    });
  });
  if (missing.length) bad(missing.length + ' question texts are missing a language', missing.slice(0, 12).join(', '));
  else ok('all ' + active.length + ' active questions and every option have English and Turkish');

  const mods = BANK.modules || {};
  const badMods = Object.keys(mods).filter(k => !mods[k] || !full(mods[k].en) || !full(mods[k].tr));
  if (badMods.length) bad('module titles missing a language', badMods.join(', '));
  else ok('all ' + Object.keys(mods).length + ' module titles have English and Turkish');

  const unknown = active.filter(q => !mods[q.module]).map(q => q.id);
  if (unknown.length) bad('questions point at a module with no title', unknown.join(', '));
  else ok('every question belongs to a titled module');
}

// ── the phone ──
console.log('\nPHONE');
const stuSrc = fs.readFileSync(path.join(Y, 'classroom', 'js', 'aiquiz-student.js'), 'utf8');
let STR = null;
{
  const at = stuSrc.indexOf('var STR = {');
  if (at !== -1) {
    const open = stuSrc.indexOf('{', at);
    let depth = 0, j = open, inStr = null;
    for (; j < stuSrc.length; j++) {
      const c = stuSrc[j];
      if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
    }
    try { STR = new Function('return (' + stuSrc.slice(open, j + 1) + ');')(); } catch (e) { STR = null; }
  }
}
if (!STR) {
  bad('could not read the STR table in classroom/js/aiquiz-student.js');
} else {
  const half = Object.keys(STR).filter(k => !full(STR[k].en) || !full(STR[k].tr));
  if (half.length) bad('phone strings missing a language', half.join(', '));
  else ok('all ' + Object.keys(STR).length + ' phone strings have English and Turkish');
}

// Hard-coded English the switch cannot reach: a toast or a textContent given a
// plain English sentence rather than t(...).
const leftovers = [];
stuSrc.split('\n').forEach((line, i) => {
  if (/MG\.toast\(\s*'[A-Z]/.test(line) || /\.textContent\s*=\s*'[A-Z][a-z]/.test(line)) leftovers.push((i + 1) + ': ' + line.trim().slice(0, 90));
});
if (leftovers.length) bad('English left hard-coded in the phone script', leftovers.join('\n        '));
else ok('no English message is left hard-coded in the phone script');

// ── the pages ──
console.log('\nPAGES');
const stuHtml = fs.readFileSync(path.join(Y, 'classroom-aiquiz-student.html'), 'utf8');
const teaHtml = fs.readFileSync(path.join(Y, 'classroom-aiquiz-teacher.html'), 'utf8');
const langs = ['en', 'both', 'tr'].filter(l => stuHtml.indexOf('data-aiq-lang="' + l + '"') !== -1);
if (langs.length === 3) ok('the phone page has the EN / EN+TR / TR switch');
else bad('the phone language switch is incomplete', 'found: ' + langs.join(', '));

const keys = (stuHtml.match(/data-i18n(?:-ph)?="([^"]+)"/g) || []).map(m => m.replace(/.*="([^"]+)"/, '$1'));
const unknownKeys = STR ? keys.filter(k => !STR[k]) : keys;
if (!keys.length) bad('the phone page has no translatable labels (data-i18n)');
else if (unknownKeys.length) bad('the phone page uses keys the STR table does not have', unknownKeys.join(', '));
else ok('all ' + keys.length + ' translatable labels on the phone page exist in STR');

const opts = ['both', 'en', 'tr'].filter(l => new RegExp('<select id="qLang"[\\s\\S]*?value="' + l + '"[\\s\\S]*?</select>').test(teaHtml));
if (opts.length === 3) ok('the setup screen offers English + Türkçe, English and Türkçe');
else bad('the setup screen language choice is incomplete', 'found: ' + opts.join(', '));

const teaSrc = fs.readFileSync(path.join(Y, 'classroom', 'js', 'aiquiz-teacher.js'), 'utf8');
if (/lang:\s*lang,/.test(teaSrc) && /s\.lang\b/.test(stuSrc)) ok('the room carries the language and the phones read it');
else bad('the language is not carried from the room to the phones');

// The projector's big "Question 2 of 20" is read by the whole room, so a
// Turkish room must show "Soru 2 / 20" (found English-only in the 2026-09-23 run).
if (/\$\('qProgress'\)\.textContent\s*=\s*lang\s*===\s*'tr'/.test(teaSrc) && /'Soru '/.test(teaSrc)) ok('the projector question counter follows the room language');
else bad('the projector question counter is not in the room language', "expected $('qProgress').textContent = lang === 'tr' ? ... in aiquiz-teacher.js");

console.log('');
if (fail) {
  console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
  failures.forEach(f => console.log('   - ' + f));
  process.exit(1);
}
console.log('PASS - ' + pass + ' AI Quiz language checks.');
