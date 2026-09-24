#!/usr/bin/env node
'use strict';
/* ============================================================
   faq-check.js - common questions: who can read, who can write, is it wired?
   ------------------------------------------------------------
   faqs/{id} is written in Admin > FAQ (teacher/js/faq-admin.js) and read in
   Messages & help and on the sign-in page (js/faq.js). The lines:

     1. only the admin writes; every field is checked, nothing extra stored
     2. a PUBLISHED question is readable by anyone, signed in or not - the
        sign-in page reads it before anyone has signed in
     3. a DRAFT is the admin's only; a query must ask for published == true
     4. an update keeps the question's first date

   Static checks, no emulator needed:
     - the topic keys agree between js/faq.js and firestore.rules, and every
       Messages & help topic has an FAQ topic (the questions shown after a
       student picks a topic are matched on it)
     - the starter questions fit the rules and arrive as drafts
     - the answer text is escaped before a web address becomes a link
     - the search folds accents and Turkish i
     - every page with the profile hub loads js/faq.js first; the sign-in page
       and the teacher dashboard are wired

   Real ID tokens against the emulator; writes via :commit with REQUEST_TIME
   transforms, exactly as serverTimestamp() does. Leaves the emulator as found.

   Usage:  node y/tools/push-rules.js && node y/tools/faq-check.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const Y = path.join(__dirname, '..');
const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const ROOT = 'projects/' + PROJECT + '/databases/(default)/documents';
const DOCS = 'http://' + FS + '/v1/' + ROOT;
const ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';

let pass = 0, fail = 0;
const failures = [];
const ok = (m) => { pass++; console.log('  ok    ' + m); };
const bad = (m, d) => { fail++; failures.push(m); console.log('  FAIL  ' + m + (d ? '\n        ' + d : '')); };
const expect = (label, got, want) => (got === want ? ok(label + ' (' + got + ')') : bad(label, 'got ' + got + ', expected ' + want));
const read = (rel) => fs.readFileSync(path.join(Y, rel), 'utf8');

// Load js/faq.js the way a page does, minus the page.
function loadFaqModule() {
  const win = {};
  const doc = { readyState: 'complete', querySelector: () => null, getElementById: () => null,
                addEventListener() {}, createElement: () => ({}), head: { appendChild() {} } };
  new Function('window', 'document', 'firebase', read('js/faq.js'))(win, doc, undefined);
  return win.LLFaq;
}
function objectLiteral(src, marker) {
  const at = src.indexOf(marker);
  if (at === -1) return null;
  const open = src.indexOf(marker.trim().slice(-1) === '[' ? '[' : '{', at);
  const close = marker.trim().slice(-1) === '[' ? ']' : '}';
  const openCh = src[open];
  let depth = 0, j = open, inStr = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === openCh) depth++; else if (c === close && --depth === 0) break;
  }
  try { return new Function('return (' + src.slice(open, j + 1) + ');')(); } catch (e) { return null; }
}

// ── static ──────────────────────────────────────────────────────────────
console.log('TOPICS');
const rules = fs.readFileSync(path.join(Y, '..', 'firestore.rules'), 'utf8');
const LLFaq = loadFaqModule();
{
  const m = rules.match(/function\s+faqTopics\s*\(\)\s*\{\s*return\s*\[([^\]]*)\]/);
  const ruleKeys = m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  const appKeys = LLFaq ? LLFaq.TOPICS.map(t => t.key) : [];
  const a = appKeys.slice().sort().join(','), r = ruleKeys.slice().sort().join(',');
  if (!ruleKeys.length || !appKeys.length) bad('could not read both topic lists', 'rules ' + ruleKeys.length + ', js/faq.js ' + appKeys.length);
  else if (a !== r) bad('js/faq.js and firestore.rules list different FAQ topics', 'app: ' + a + '\n        rules: ' + r);
  else ok('js/faq.js and firestore.rules list the same ' + appKeys.length + ' topics');

  const hub = read('js/profile-hub.js');
  const ST = objectLiteral(hub, 'var SUPPORT_TOPICS = {');
  const supKeys = ST ? Object.keys(ST).reduce((acc, k) => acc.concat(ST[k].map(t => t.key)), []) : [];
  const orphan = supKeys.filter(k => appKeys.indexOf(k) === -1);
  if (!supKeys.length) bad('could not read SUPPORT_TOPICS in js/profile-hub.js');
  else if (orphan.length) bad('Messages & help topics with no FAQ topic', orphan.join(', '));
  else ok('every Messages & help topic can have questions shown for it (' + [...new Set(supKeys)].length + ')');
}

console.log('\nSTARTERS');
const adminSrc = read('teacher/js/faq-admin.js');
{
  const S = objectLiteral(adminSrc, 'var STARTERS = [');
  const keys = LLFaq ? LLFaq.TOPICS.map(t => t.key) : [];
  if (!S || !S.length) bad('could not read STARTERS in teacher/js/faq-admin.js');
  else {
    const wrong = S.filter(s => !(typeof s.q === 'string' && s.q.length >= 3 && s.q.length <= 200 &&
      typeof s.a === 'string' && s.a.length >= 1 && s.a.length <= 3000 && keys.indexOf(s.topic) !== -1 && typeof s.onLogin === 'boolean'));
    if (wrong.length) bad('starter questions the rules would refuse', wrong.map(s => s.q).join(' | '));
    else ok('all ' + S.length + ' starter questions fit the rules');
    const EM = String.fromCharCode(0x2014);   // the house rule: no em dash
    const dash = S.filter(s => (s.q + s.a).indexOf(EM) !== -1);
    if (dash.length) bad('starter questions contain an em dash', dash.map(s => s.q).join(' | '));
    else ok('no em dash in the starter questions');
  }
  if (/published:\s*false/.test(adminSrc.slice(adminSrc.indexOf('function addStarters')))) ok('starters are added as drafts (published: false)');
  else bad('starters are not added as drafts', 'addStarters must write published: false');
}

console.log('\nRENDERING AND SEARCH');
if (!LLFaq) bad('could not load js/faq.js');
else {
  const html = LLFaq.itemsHtml([{ q: '<img src=x onerror=alert(1)>', a: 'See https://example.com/a?b=1&c=2. <script>x</script>\nLine two' }]);
  if (/<img|<script/i.test(html)) bad('question or answer text reaches the page as HTML', html);
  else ok('question and answer text is escaped');
  if (/<a href="https:\/\/example\.com\/a\?b=1&amp;c=2"/.test(html) && !/c=2\.</.test(html.replace(/<\/a>.*/, ''))) ok('a web address becomes a link, without the full stop after it');
  else bad('web addresses are not linked correctly', html);
  const list = [
    { q: 'Şifremi unuttum', a: 'Giriş sayfasında...', topic: 'account' },
    { q: 'I forgot my password.', a: 'Tap "Forgot password?" on the sign-in page.', topic: 'account' },
    { q: 'The app looks old', a: 'Refresh the page.', topic: 'technical' }
  ];
  expect('"sifre" finds "Şifremi"', LLFaq.search(list, 'sifre').length, 1);
  expect('"FORGOT sign-in" needs both words', LLFaq.search(list, 'FORGOT sign-in').length, 1);
  expect('a capital I typed on a Turkish keyboard (İ) still matches', LLFaq.search(list, 'İ forgot').length, 1);
  expect('an empty search shows everything', LLFaq.search(list, '   ').length, 3);
  expect('forTopic keeps one topic', LLFaq.forTopic(list, 'account').length, 2);
}

console.log('\nWIRING');
{
  const faqSrc = read('js/faq.js');
  const queries = (faqSrc.match(/collection\('faqs'\)/g) || []).length;
  if (queries === 1 && /collection\('faqs'\)\.where\('published', '==', true\)/.test(faqSrc)) ok('the one student query in js/faq.js asks for published == true');
  else bad('a student query in js/faq.js may not ask for published == true', queries + ' queries found');

  const pages = fs.readdirSync(Y).filter(f => /\.html$/.test(f));
  const hubPages = pages.filter(p => /<script src="js\/profile-hub\.js/.test(read(p)));
  const missing = hubPages.filter(p => { const s = read(p); const a = s.indexOf('<script src="js/faq.js'); return a === -1 || a > s.indexOf('<script src="js/profile-hub.js'); });
  if (!hubPages.length) bad('found no page that loads js/profile-hub.js');
  else if (missing.length) bad('pages with the profile hub that do not load js/faq.js before it', missing.join(', '));
  else ok('all ' + hubPages.length + ' profile-hub pages load js/faq.js first (' + hubPages.join(', ') + ')');

  const idx = read('index.html');
  if (/data-login-faq hidden/.test(idx) && /id="faqModal"/.test(idx) && /data-faq-open/.test(idx) && /<script src="js\/faq\.js/.test(idx) && /Contact us<\/a>/.test(idx)) ok('the sign-in page has the hidden link, the dialog and the script; "Contact us" is kept');
  else bad('the sign-in page is not fully wired for common questions');

  const td = read('teacher-dashboard.html');
  const tdOk = /data-target="faqPanel"/.test(td) && /'faqPanel'/.test(td) && /id="faqPanel"/.test(td) &&
    /<script src="js\/faq\.js/.test(td) && /<script src="teacher\/js\/faq-admin\.js/.test(td) && /teacher\/css\/faq\.css/.test(td);
  if (tdOk) ok('Admin > FAQ is wired: sub-tab, panel, sub-tab list, scripts and stylesheet');
  else bad('Admin > FAQ is not fully wired in teacher-dashboard.html');
}

// ── emulator ────────────────────────────────────────────────────────────
async function identity(adminSdk, email) {
  const post = async (ep, body) => (await fetch(
    'http://' + AUTH + '/identitytoolkit.googleapis.com/v1/' + ep + '?key=fake-api-key',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  let j = await post('accounts:signUp', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  if (!j.idToken && j.error && /EMAIL_EXISTS/.test(j.error.message || '')) {
    j = await post('accounts:signInWithPassword', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  }
  try { await adminSdk.auth().updateUser(j.localId, { emailVerified: true }); } catch (e) {}
  j = await post('accounts:signInWithPassword', { email: email, password: 'Passw0rd!', returnSecureToken: true });
  return { uid: j.localId, token: j.idToken, email: email };
}
const enc = (v) => {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
const now = (f) => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' });
const hdr = (token) => Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {});
function createW(p, data) {
  return { update: { name: ROOT + '/' + p, fields: fields(data) }, currentDocument: { exists: false },
           updateTransforms: [now('createdAt'), now('updatedAt')] };
}
function updateW(p, data, transforms) {
  return { update: { name: ROOT + '/' + p, fields: fields(data) }, updateMask: { fieldPaths: Object.keys(data) },
           updateTransforms: transforms || [now('updatedAt')] };
}
async function commit(writes, token) {
  const r = await fetch(DOCS + ':commit', { method: 'POST', headers: hdr(token), body: JSON.stringify({ writes: writes }) });
  return r.status;
}
async function get(p, token) { return (await fetch(DOCS + '/' + p, { headers: hdr(token) })).status; }
async function del(p, token) { return (await fetch(DOCS + '/' + p, { method: 'DELETE', headers: hdr(token) })).status; }
async function query(token, filters) {
  const where = !filters.length ? undefined : (filters.length === 1
    ? { fieldFilter: { field: { fieldPath: filters[0] }, op: 'EQUAL', value: { booleanValue: true } } }
    : { compositeFilter: { op: 'AND', filters: filters.map(f => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: { booleanValue: true } } })) } });
  const sq = { from: [{ collectionId: 'faqs' }] };
  if (where) sq.where = where;
  const r = await fetch(DOCS + ':runQuery', { method: 'POST', headers: hdr(token), body: JSON.stringify({ structuredQuery: sq }) });
  let body = null; try { body = await r.json(); } catch (e) {}
  if (!r.ok || (Array.isArray(body) && body.some(x => x && x.error))) return { status: 403, n: 0 };
  return { status: 200, n: (body || []).filter(x => x && x.document).length };
}

(async () => {
  let up = false;
  try { up = (await fetch('http://' + FS + '/')).status === 200; } catch (e) {}
  if (!up) { console.log('\n  skip  emulator not running (rule checks not run)'); finish(); return; }

  process.env.FIRESTORE_EMULATOR_HOST = FS;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;   // never production Auth
  process.env.GCLOUD_PROJECT = PROJECT;
  const admin = require(path.join(Y, '..', 'functions', 'node_modules', 'firebase-admin'));
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();

  const stu = await identity(admin, 'zz.faq.student@stu.fsm.edu.tr');
  const teacher = await identity(admin, 'zz.faq.teacher@fsm.edu.tr');
  const boss = await identity(admin, ADMIN_EMAIL);
  const people = [stu, teacher, boss];

  // Leave the emulator as found: the users these touch, and every FAQ.
  const beforeUsers = {};
  for (const u of people) {
    const s = await db.collection('users').doc(u.uid).get();
    beforeUsers[u.uid] = s.exists ? s.data() : null;
  }
  const beforeFaqs = (await db.collection('faqs').get()).docs.map(d => ({ id: d.id, data: d.data() }));
  for (const f of beforeFaqs) await db.collection('faqs').doc(f.id).delete();
  await db.collection('users').doc(stu.uid).set({ email: stu.email, role: 'student', studentClass: 'B125' });
  await db.collection('users').doc(teacher.uid).set({ email: teacher.email, role: 'teacher', assignedClasses: ['B125'] });
  await db.collection('users').doc(boss.uid).set(Object.assign({}, beforeUsers[boss.uid] || {}, { email: boss.email, role: 'teacher' }));

  const faq = (extra) => Object.assign({ q: 'I forgot my password.', a: 'Tap "Forgot password?".', topic: 'account',
    order: 10, published: true, onLogin: true, updatedBy: ADMIN_EMAIL }, extra || {});

  try {
    console.log('\nWRITING');
    expect('the admin adds a published question', await commit([createW('faqs/zzLive', faq())], boss.token), 200);
    expect('the admin adds a draft', await commit([createW('faqs/zzDraft', faq({ q: 'A draft question', published: false, onLogin: false, order: 20 }))], boss.token), 200);
    expect('the admin adds a published question NOT for the sign-in page', await commit([createW('faqs/zzInApp', faq({ q: 'In the app only', onLogin: false, order: 30 }))], boss.token), 200);
    expect('a teacher CANNOT add a question', await commit([createW('faqs/zzT', faq({ updatedBy: teacher.email }))], teacher.token), 403);
    expect('a student CANNOT add a question', await commit([createW('faqs/zzS', faq({ updatedBy: stu.email }))], stu.token), 403);
    expect('nobody signed out can add one', await commit([createW('faqs/zzA', faq())], null), 403);
    expect('an unknown topic is refused', await commit([createW('faqs/zzX1', faq({ topic: 'free-pizza' }))], boss.token), 403);
    expect('a question over 200 characters is refused', await commit([createW('faqs/zzX2', faq({ q: new Array(202).join('x') }))], boss.token), 403);
    expect('an answer over 3000 characters is refused', await commit([createW('faqs/zzX3', faq({ a: new Array(3002).join('x') }))], boss.token), 403);
    expect('an empty answer is refused', await commit([createW('faqs/zzX4', faq({ a: '' }))], boss.token), 403);
    expect('an order that is not a whole number is refused', await commit([createW('faqs/zzX5', faq({ order: 1.5 }))], boss.token), 403);
    expect('"published" must be true or false', await commit([createW('faqs/zzX6', faq({ published: 'yes' }))], boss.token), 403);
    expect('an extra field cannot be smuggled in', await commit([createW('faqs/zzX7', faq({ pinned: true }))], boss.token), 403);
    expect('a missing field is refused', await commit([createW('faqs/zzX8', (() => { const d = faq(); delete d.onLogin; return d; })())], boss.token), 403);
    expect('"updatedBy" must be the admin\'s own address', await commit([createW('faqs/zzX9', faq({ updatedBy: 'someone@fsm.edu.tr' }))], boss.token), 403);
    expect('the admin edits a question', await commit([updateW('faqs/zzLive', { a: 'On the sign-in page, tap "Forgot password?".', updatedBy: ADMIN_EMAIL })], boss.token), 200);
    expect('an edit cannot rewrite the first date',
      await commit([updateW('faqs/zzLive', { createdAt: new Date('2020-01-01'), updatedBy: ADMIN_EMAIL })], boss.token), 403);
    expect('an edit cannot set updatedAt to any time it likes',
      await commit([updateW('faqs/zzLive', { order: 11, updatedAt: new Date('2099-01-01'), updatedBy: ADMIN_EMAIL }, [])], boss.token), 403);
    expect('a teacher CANNOT edit a question', await commit([updateW('faqs/zzLive', { a: 'Changed', updatedBy: teacher.email })], teacher.token), 403);

    console.log('\nREADING');
    expect('signed out, a published question can be read (the sign-in page)', await get('faqs/zzLive', null), 200);
    expect('signed out, a DRAFT cannot be read', await get('faqs/zzDraft', null), 403);
    expect('a student reads a published question', await get('faqs/zzLive', stu.token), 200);
    expect('a student CANNOT read a draft', await get('faqs/zzDraft', stu.token), 403);
    expect('a teacher CANNOT read a draft', await get('faqs/zzDraft', teacher.token), 403);
    expect('the admin reads a draft', await get('faqs/zzDraft', boss.token), 200);
    let r = await query(null, ['published', 'onLogin']);
    expect('signed out, the sign-in page query works', r.status, 200);
    expect('...and returns only the published sign-in question', r.n, 1);
    r = await query(stu.token, ['published']);
    expect('a student lists the published questions (Messages & help)', r.status, 200);
    expect('...and gets both published ones, not the draft', r.n, 2);
    expect('a student CANNOT list without asking for published only', (await query(stu.token, [])).status, 403);
    expect('signed out, a list without published == true is refused', (await query(null, [])).status, 403);
    r = await query(boss.token, []);
    expect('the admin lists every question, drafts included (Admin > FAQ)', r.status, 200);
    expect('...all three', r.n, 3);

    console.log('\nDELETING');
    expect('a student CANNOT delete a question', await del('faqs/zzLive', stu.token), 403);
    expect('a teacher CANNOT delete a question', await del('faqs/zzLive', teacher.token), 403);
    expect('the admin deletes a question', await del('faqs/zzInApp', boss.token), 200);
  } finally {
    // ── restore ──
    for (const d of (await db.collection('faqs').get()).docs) await d.ref.delete();
    for (const f of beforeFaqs) await db.collection('faqs').doc(f.id).set(f.data);
    for (const u of people) {
      const b = beforeUsers[u.uid];
      if (b) await db.collection('users').doc(u.uid).set(b); else await db.collection('users').doc(u.uid).delete().catch(() => {});
    }
  }
  finish();
})().catch(e => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(2); });

function finish() {
  console.log('');
  if (fail) {
    console.log('FAIL - ' + fail + ' of ' + (pass + fail) + ':');
    failures.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('PASS - ' + pass + ' FAQ checks.');
}
