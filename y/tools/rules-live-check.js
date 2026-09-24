#!/usr/bin/env node
'use strict';
/* ============================================================
   rules-live-check.js - is the DEPLOYED ruleset the file on disk?
   ------------------------------------------------------------
   Hosting and Firestore rules deploy separately, so it is entirely possible
   to ship the app and leave the old rules live. Nothing in the app would look
   wrong; the security holes would simply still be open.

   This reads the ACTIVE ruleset back from the Firebase Rules API and compares
   it byte for byte with firestore.rules, then greps the LIVE text for the
   grandfather patterns that were closed. It answers "did the rules deploy
   actually land" with evidence instead of assumption.

   READ ONLY: two GETs against firebaserules.googleapis.com. Nothing is
   written, nothing is deployed.

   Requires tools/.serviceAccount.json.
   Usage:  node y/tools/rules-live-check.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const KEY = path.join(__dirname, '.serviceAccount.json');
const LOCAL = path.join(__dirname, '..', '..', 'firestore.rules');
if (!fs.existsSync(KEY)) { console.error('Missing ' + KEY); process.exit(2); }
if (!fs.existsSync(LOCAL)) { console.error('Missing ' + LOCAL); process.exit(2); }

let admin;
try { admin = require(path.join(__dirname, '..', '..', 'functions', 'node_modules', 'firebase-admin')); }
catch (e) { console.error('firebase-admin not found: ' + e.message); process.exit(2); }

const sa = require(KEY);
const PROJECT = sa.project_id;

(async () => {
  const cred = admin.credential.cert(sa);
  const tok = (await cred.getAccessToken()).access_token;
  const get = async (url) => {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error(url.split('/').pop() + ' -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
    return r.json();
  };

  const rel = await get(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`);
  const rs = await get(`https://firebaserules.googleapis.com/v1/${rel.rulesetName}`);
  const live = ((rs.source && rs.source.files) || []).map(f => f.content).join('');
  const disk = fs.readFileSync(LOCAL, 'utf8');

  console.log('project        : ' + PROJECT);
  console.log('active ruleset : ' + rel.rulesetName.split('/').pop());
  console.log('created        : ' + (rs.createTime || '?'));
  console.log('live bytes     : ' + live.length);
  console.log('disk bytes     : ' + disk.length);

  const identical = live === disk;
  console.log('\nlive ruleset === firestore.rules on disk : ' + (identical ? 'YES' : 'NO'));

  // Independent of the byte compare: are the loopholes actually gone LIVE?
  const openField = (live.match(/!\('[A-Za-z]+' in resource\.data\)/g) || []);
  const openDoc = (live.match(/!exists\(\/databases/g) || []);
  console.log('\nGrandfather patterns in the LIVE ruleset:');
  console.log('  missing-FIELD grants    : ' + openField.length + (openField.length ? '  <-- STILL OPEN' : '  (none)'));
  console.log('  missing-DOCUMENT grants : ' + openDoc.length + (openDoc.length ? '  <-- STILL OPEN' : '  (none)'));

  const closedHelpers = (live.match(/\(\('[A-Za-z]+' in resource\.data\) && resource\.data\./g) || []).length;
  console.log('  closed ownership checks : ' + closedHelpers);

  console.log('');
  if (!identical || openField.length || openDoc.length) {
    console.log('FAIL - the deployed rules are not the closed ones.');
    console.log('Deploy them with:  firebase deploy --only firestore:rules');
    process.exit(1);
  }
  console.log('PASS - the closed rules are live in production.');
})().catch(e => { console.error('ERROR: ' + (e && e.message)); process.exit(2); });
