#!/usr/bin/env node
'use strict';
/* ============================================================
   dialog-scope-check.js - does a shared dialog rule reach too far?
   ------------------------------------------------------------
   `.ll-dialog` in css/brand.css is NOT the logout dialog. It is the shared
   shape and motion layer, and four different dialogs wear it:

     .modal-content / .modal-box   the logout dialogs        <- the shared look
     .ph-panel                     the profile hub panels    (js/profile-hub.js)
     .rd-confirm                   the reading exam confirm  (student/css/reading-exam.css)
     .appdlg-card                  AppDialog                 (js/app-dialog.js)

   So a rule written as `.ll-dialog > h3` does not style "the dialog title" - it
   styles the title of all four, including three that were deliberately tuned
   differently. That mistake was made once: it would have retyped the profile
   hub's panel headings and its 4px sub-line, and flattened the reading exam
   confirm, whose phone @media override would also have become dead code
   because a media query adds no specificity.

   This gate holds three lines:

     1. no rule under .ll-dialog may target a BARE ELEMENT as its subject -
        match on a class, so the selector can only reach markup that opted in
     2. brand.css must never name another dialog's private classes
     3. the two logout dialogs must keep the same shape AND the same words -
        two different sentences cannot produce the same box however the CSS is
        written, which is what made one card 71px taller than the other

   Usage:  node y/tools/dialog-scope-check.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BRAND = path.join(ROOT, 'css', 'brand.css');
const STUDENT = path.join(ROOT, 'student-dashboard.html');
const TEACHER = path.join(ROOT, 'teacher-dashboard.html');

let pass = 0, fail = 0;
const failures = [];
const ok = (m) => { pass++; console.log('  ok    ' + m); };
const bad = (m, d) => { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); };

// Classes that belong to a dialog which is NOT the shared logout look. If
// brand.css names one of these, the shared layer has reached into a dialog
// that only wanted shape and motion from it.
const PRIVATE_CLASSES = [
  'ph-panel', 'ph-title', 'ph-sub', 'ph-row',
  'rd-confirm-title', 'rd-confirm-message', 'rd-confirm-icon',
  'appdlg-title', 'appdlg-msg', 'appdlg-icon'
];

const BARE_ELEMENTS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'button', 'a', 'li', 'ul'
];

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Every selector list in the file: the text before each `{` that is not an
// at-rule prelude.
function selectorLists(css) {
  const out = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@')) continue;
    out.push(sel);
  }
  return out;
}

// The SUBJECT of a selector is its last compound - the thing actually styled.
// `.ll-dialog > h3` has subject `h3`; `.ll-dialog > .modal-title` has
// subject `.modal-title`.
function subjectOf(sel) {
  const parts = sel.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

const brand = fs.readFileSync(BRAND, 'utf8');
const brandCss = stripComments(brand);

console.log('SCOPE - a shared rule must match a class, never a bare element');

const llSelectors = [];
selectorLists(brandCss).forEach(list => {
  list.split(',').forEach(one => {
    const s = one.trim();
    if (s.indexOf('.ll-dialog') !== -1) llSelectors.push(s);
  });
});

if (!llSelectors.length) {
  bad('found no .ll-dialog rules in css/brand.css - has the file moved?');
} else {
  const offenders = llSelectors.filter(s => {
    const subj = subjectOf(s);
    // A subject is safe when it carries a class, id or attribute of its own.
    if (/[.#\[]/.test(subj)) return false;
    return BARE_ELEMENTS.indexOf(subj.replace(/:.*$/, '').toLowerCase()) !== -1;
  });
  if (offenders.length) {
    bad(offenders.length + ' .ll-dialog rule(s) target a bare element',
      offenders.join('\n        ') +
      '\n        Give the markup a class and match that instead - .ll-dialog is worn by' +
      '\n        the profile hub panel, the reading exam confirm and AppDialog too.');
  } else {
    ok(llSelectors.length + ' .ll-dialog selectors, every one matching on a class');
  }
}

console.log('\nPRIVACY - brand.css must not name another dialog\'s classes');
const named = PRIVATE_CLASSES.filter(c => new RegExp('\\.' + c + '\\b').test(brandCss));
if (named.length) {
  bad('brand.css names ' + named.length + ' private dialog class(es)',
    named.map(c => '.' + c).join(', ') +
    '\n        Those belong to profile-hub.js / reading-exam.css / app-dialog.js.');
} else {
  ok('none of the ' + PRIVATE_CLASSES.length + ' private dialog classes appear in brand.css');
}

console.log('\nLOGOUT DIALOGS - same classes, same words');

const student = fs.readFileSync(STUDENT, 'utf8');
const teacher = fs.readFileSync(TEACHER, 'utf8');

// Walk the div nesting from the overlay's opening tag until it closes, so the
// slice is exactly this modal. A fixed-size window was tried first and ran off
// the end into the NEXT modal, which reported that modal's inline font-size as
// this one's - a gate that invents failures is worse than no gate.
function logoutModal(html, file) {
  const i = html.indexOf('id="logoutModal"');
  if (i === -1) { bad(file + ': no #logoutModal found'); return null; }
  const start = html.lastIndexOf('<div', i);
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  let depth = 0, m;
  while ((m = tag.exec(html)) !== null) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + 6);
  }
  bad(file + ': #logoutModal is never closed');
  return null;
}

const sMod = logoutModal(student, 'student-dashboard.html');
const tMod = logoutModal(teacher, 'teacher-dashboard.html');

if (sMod && tMod) {
  [['student', sMod], ['teacher', tMod]].forEach(([name, mod]) => {
    const hasTitle = /class="[^"]*\bmodal-title\b/.test(mod);
    const hasMsg = /class="[^"]*\bmodal-message\b/.test(mod);
    if (hasTitle && hasMsg) ok(name + ' logout dialog carries .modal-title and .modal-message');
    else bad(name + ' logout dialog is missing ' +
      [!hasTitle && '.modal-title', !hasMsg && '.modal-message'].filter(Boolean).join(' and '),
      'The shared rules in brand.css match on those classes, so without them this' +
      '\n        dialog silently keeps its own sizing.');
  });

  // Inline font-size / margin would beat every stylesheet and re-open the gap.
  [['student', sMod], ['teacher', tMod]].forEach(([name, mod]) => {
    const inline = mod.match(/style="[^"]*(font-size|margin)[^"]*"/g);
    if (inline) bad(name + ' logout dialog has inline sizing that outranks brand.css',
      inline.join('  '));
    else ok(name + ' logout dialog has no inline font-size or margin');
  });

  const msgOf = (mod) => {
    const m = mod.match(/class="[^"]*\bmodal-message\b[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
  };
  const sMsg = msgOf(sMod), tMsg = msgOf(tMod);
  if (!sMsg || !tMsg) {
    bad('could not read the message text from both logout dialogs');
  } else if (sMsg === tMsg) {
    ok('both logout dialogs use the same sentence (' + sMsg.length + ' chars)');
  } else {
    bad('the two logout dialogs use different wording, so the boxes cannot match',
      'student (' + sMsg.length + '): ' + sMsg + '\n        teacher (' + tMsg.length + '): ' + tMsg);
  }
}

console.log('');
if (fail) {
  console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
  failures.forEach(f => console.log('   - ' + f));
  process.exit(1);
}
console.log('PASS - ' + pass + ' dialog scope checks.');
