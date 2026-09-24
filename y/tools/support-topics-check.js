#!/usr/bin/env node
'use strict';
/* ============================================================
   support-topics-check.js - do the three copies of the message lists agree?
   ------------------------------------------------------------
   The student's "Messages & help" flow offers a recipient, a topic and a
   "when". Those keys live in THREE places, and each copy does a different job:

     js/profile-hub.js             what the student can PICK
     firestore.rules               what the server will ACCEPT
     teacher/js/messages-admin.js  what staff can FILTER on, and the words
                                   they see for it

   If they drift, it fails quietly in a different way each time:
     - a topic the student can pick but the rules do not list is refused, and
       the student just sees "could not send"
     - a topic the rules accept but the inbox does not know renders as a bare
       "Message" and can never be filtered for
     - a label that differs means staff read different words from the ones
       the student chose
     - a topic offered under "My teacher" but filed as admin-only in the inbox
       never appears in the teacher's topic filter

   The SIGN-IN PAGE (js/signin-support.js, SIGNIN_TOPICS) offers a SUBSET,
   written signed out and always to the admin. The rules pin that subset in
   supportSigninTopics(); a key the page offers but the rules do not list is
   refused with nothing but "could not send" for someone who already cannot
   sign in. Until that file exists, its comparison reports a skip, not a fail.

   Static: reads the files, no emulator needed.
   Usage:  node y/tools/support-topics-check.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HUB = path.join(ROOT, 'js', 'profile-hub.js');
const INBOX = path.join(ROOT, 'teacher', 'js', 'messages-admin.js');
const SIGNIN = path.join(ROOT, 'js', 'signin-support.js');
const RULES = path.join(ROOT, '..', 'firestore.rules');

let pass = 0, fail = 0;
const failures = [];
const ok = (m) => { pass++; console.log('  ok    ' + m); };
const bad = (m, d) => { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); };

// Pull `var NAME = <literal>;` out of a source file and evaluate just that
// literal. These are our own files and plain object/array literals, so
// evaluating the literal is exact where a regex over it would be guesswork.
function literal(src, name, file) {
  const at = src.indexOf('var ' + name + ' =');
  if (at === -1) { bad(file + ': no `var ' + name + '` found'); return null; }
  let i = src.indexOf('=', at) + 1;
  while (/\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) { bad(file + ': ' + name + ' is not an object or array literal'); return null; }
  let depth = 0, j = i, inStr = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) break;
  }
  try { return new Function('return (' + src.slice(i, j + 1) + ');')(); }
  catch (e) { bad(file + ': could not read ' + name + ' - ' + e.message); return null; }
}

// Pull the string list out of `function NAME() { return [...]; }` in the rules.
function rulesList(src, fn) {
  const m = src.match(new RegExp('function\\s+' + fn + '\\s*\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\]'));
  if (!m) { bad('firestore.rules: no ' + fn + '() found'); return null; }
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(s => s !== undefined);
}

const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const diff = (a, b) => a.filter(x => b.indexOf(x) === -1);

const hub = fs.readFileSync(HUB, 'utf8');
const inbox = fs.readFileSync(INBOX, 'utf8');
const rules = fs.readFileSync(RULES, 'utf8');

const hubTo = literal(hub, 'SUPPORT_TO', 'profile-hub.js');
const hubTopics = literal(hub, 'SUPPORT_TOPICS', 'profile-hub.js');
const hubWhens = literal(hub, 'SUPPORT_WHENS', 'profile-hub.js');
const inTopics = literal(inbox, 'TOPICS', 'messages-admin.js');
const inWhens = literal(inbox, 'WHENS', 'messages-admin.js');
const inTo = literal(inbox, 'RECIPIENTS', 'messages-admin.js');
const rTopics = rulesList(rules, 'supportTopics');
const rWhens = rulesList(rules, 'supportWhens');
const rTo = (rules.match(/request\.resource\.data\.to in \[([^\]]*)\]/) || [])[1];

if (hubTo && hubTopics && hubWhens && inTopics && inWhens && inTo && rTopics && rWhens && rTo) {
  console.log('RECIPIENTS');
  const hubToKeys = Object.keys(hubTo);
  const rToKeys = rTo.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
  if (same(hubToKeys, rToKeys) && same(hubToKeys, inTo)) ok('all three list the same recipients: ' + hubToKeys.join(', '));
  else bad('the recipient lists differ', 'hub ' + hubToKeys + ' | rules ' + rToKeys + ' | inbox ' + inTo);
  hubToKeys.forEach(k => {
    if (!Array.isArray(hubTopics[k]) || !hubTopics[k].length) bad('profile-hub offers no topics for "' + k + '"');
  });

  console.log('\nTOPICS');
  const hubKeys = [];
  Object.keys(hubTopics).forEach(to => hubTopics[to].forEach(t => { if (hubKeys.indexOf(t.key) === -1) hubKeys.push(t.key); }));
  const inKeys = Object.keys(inTopics);

  const notInRules = diff(hubKeys, rTopics);
  if (notInRules.length) bad('the student can pick topics the rules will REFUSE', notInRules.join(', '));
  else ok('every topic the student can pick is accepted by the rules');

  const notInInbox = diff(rTopics, inKeys);
  if (notInInbox.length) bad('the rules accept topics the inbox cannot label or filter', notInInbox.join(', '));
  else ok('every topic the rules accept has a label and a filter in the inbox');

  const unused = diff(rTopics, hubKeys);
  if (unused.length) bad('the rules accept topics no student can ever pick', unused.join(', '));
  else ok('no topic in the rules is left unreachable');

  // Same words on both sides.
  const wording = [];
  Object.keys(hubTopics).forEach(to => hubTopics[to].forEach(t => {
    const s = inTopics[t.key];
    if (s && (s.label !== t.label || s.icon !== t.icon)) wording.push(t.key + ': "' + t.icon + ' ' + t.label + '" vs "' + s.icon + ' ' + s.label + '"');
  }));
  if (wording.length) bad('staff would read different words from the ones the student chose', wording.join('\n        '));
  else ok('staff see exactly the icon and words the student chose, for every topic');

  // A topic offered under a recipient must be one that recipient's inbox
  // treats as theirs, or it never shows in their topic filter.
  const misfiled = [];
  Object.keys(hubTopics).forEach(to => hubTopics[to].forEach(t => {
    const s = inTopics[t.key];
    if (s && s.to !== 'both' && s.to !== to) misfiled.push(t.key + ' is offered under "' + to + '" but filed as "' + s.to + '" in the inbox');
  }));
  if (misfiled.length) bad('topics are filed under the wrong recipient in the inbox', misfiled.join('\n        '));
  else ok('each topic is filed under the recipient that offers it');

  console.log('\nWHEN');
  const hubWhenKeys = hubWhens.map(w => w.key);
  const rWhenKeys = rWhens.filter(w => w !== '');
  if (rWhens.indexOf('') === -1) bad('the rules do not allow an empty "when", which an idea sends');
  else ok('the rules allow an empty "when" for topics that skip that step');
  if (same(hubWhenKeys, rWhenKeys) && same(hubWhenKeys, Object.keys(inWhens))) ok('all three list the same "when" choices: ' + hubWhenKeys.join(', '));
  else bad('the "when" lists differ', 'hub ' + hubWhenKeys + ' | rules ' + rWhenKeys + ' | inbox ' + Object.keys(inWhens));
}

// ── the sign-in page subset ────────────────────────────────────────────────
const rSignin = rulesList(rules, 'supportSigninTopics');
if (rSignin && rTopics && inTopics && rWhens) {
  console.log('\nSIGN-IN PAGE');
  // The list only counts if the signed-out create rule actually uses it, and
  // that rule must send everything to the admin.
  if (/request\.resource\.data\.topic in supportSigninTopics\(\)/.test(rules)) ok('the sign-in create rule checks its topic against supportSigninTopics()');
  else bad('no create rule checks `topic in supportSigninTopics()` - the subset is not enforced');
  if (/request\.resource\.data\.source == 'signin'[\s\S]{0,1500}request\.resource\.data\.to == 'admin'/.test(rules)) ok("the sign-in create rule pins `to == 'admin'`");
  else bad("the sign-in create rule does not pin `to == 'admin'` - a teacher could be routed one");

  const outside = diff(rSignin, rTopics);
  if (outside.length) bad('the sign-in topics are not all in supportTopics()', outside.join(', '));
  else ok('the sign-in topics (' + rSignin.join(', ') + ') are a subset of supportTopics()');

  // Always to the admin, so each must be one the inbox files under the admin
  // (or both), or it sits under a teacher filter no teacher can open.
  const teacherOnly = rSignin.filter(k => inTopics[k] && inTopics[k].to !== 'admin' && inTopics[k].to !== 'both');
  if (teacherOnly.length) bad('sign-in topics filed as teacher-only in the inbox', teacherOnly.join(', '));
  else ok('every sign-in topic is filed under the admin in the inbox');

  if (!fs.existsSync(SIGNIN)) {
    console.log('  skip  js/signin-support.js does not exist yet - its SIGNIN_TOPICS were NOT compared');
  } else {
    const signin = fs.readFileSync(SIGNIN, 'utf8');
    const pageTopics = literal(signin, 'SIGNIN_TOPICS', 'signin-support.js');
    if (pageTopics) {
      const pageKeys = pageTopics.map(t => t && t.key);
      if (same(pageKeys, rSignin)) ok('the sign-in page offers exactly the rules subset: ' + pageKeys.join(', '));
      else bad('the sign-in page topics differ from supportSigninTopics()', 'page ' + pageKeys + ' | rules ' + rSignin);

      // Same words the admin reads in the inbox, where the page gives them.
      const wording = [];
      pageTopics.forEach(t => {
        const s = t && inTopics[t.key];
        if (!s) return;
        if ((t.label !== undefined && t.label !== s.label) || (t.icon !== undefined && t.icon !== s.icon)) {
          wording.push(t.key + ': "' + (t.icon || '') + ' ' + t.label + '" vs "' + s.icon + ' ' + s.label + '"');
        }
      });
      if (wording.length) bad('the admin would read different words from the ones the sign-in page offered', wording.join('\n        '));
      else ok('the admin sees the same icon and words the sign-in page offered');
    }

    // Optional: if the page keeps its own "when" list, it must match too.
    if (signin.indexOf('var SIGNIN_WHENS =') !== -1) {
      const pageWhens = literal(signin, 'SIGNIN_WHENS', 'signin-support.js');
      if (pageWhens) {
        const keys = pageWhens.map(w => (w && typeof w === 'object') ? w.key : w);
        const rWhenKeys = rWhens.filter(w => w !== '');
        if (same(keys, rWhenKeys)) ok('the sign-in page offers the same "when" choices as the rules');
        else bad('the sign-in page "when" choices differ from supportWhens()', 'page ' + keys + ' | rules ' + rWhenKeys);
      }
    }
  }
}

console.log('');
if (fail) {
  console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
  failures.forEach(f => console.log('   - ' + f));
  process.exit(1);
}
console.log('PASS - ' + pass + ' support topic checks.');
