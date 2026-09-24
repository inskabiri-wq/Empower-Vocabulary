#!/usr/bin/env node
'use strict';
/* ============================================================
   push-rules.js - load firestore.rules into the running EMULATOR
   ------------------------------------------------------------
   The emulator reads firestore.rules once, at startup. Edit the rules while
   it is running and every check keeps testing the OLD ruleset - which once
   produced a whole "the fix works" run that proved nothing at all.

   So this uploads, then READS THE RULESET BACK and compares byte counts. A
   silent 400 from the emulator is the failure mode worth catching: it leaves
   the old rules live and says nothing.

   EMULATOR ONLY. This talks to FIRESTORE_EMULATOR_HOST and cannot reach
   production - deploying real rules is `firebase deploy --only firestore:rules`
   and is the owner's to run.

   Usage:  node y/tools/push-rules.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const PROJECT = process.env.GCLOUD_PROJECT || 'empower-vocabulary-practice';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const RULES = path.join(__dirname, '..', '..', 'firestore.rules');

(async () => {
  if (!fs.existsSync(RULES)) { console.error('missing ' + RULES); process.exit(2); }
  const content = fs.readFileSync(RULES, 'utf8');
  const localBytes = Buffer.byteLength(content, 'utf8');

  let up = false;
  try { up = (await fetch(`http://${FS}/`)).status === 200; } catch (e) {}
  if (!up) { console.error('emulator not running at ' + FS); process.exit(2); }

  const url = `http://${FS}/emulator/v1/projects/${PROJECT}:securityRules`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  });

  if (res.status !== 200) {
    console.error('upload FAILED: HTTP ' + res.status);
    console.error((await res.text()).slice(0, 600));
    process.exit(1);
  }

  // Read it back. Trusting the 200 is how the old ruleset stayed live once.
  const back = await fetch(url);
  if (back.status !== 200) {
    console.log('uploaded ' + localBytes + ' bytes (could not read back: HTTP ' + back.status + ')');
    process.exit(0);
  }
  const j = await back.json();
  const file = (((j.rules || {}).files) || [])[0] || {};
  const liveBytes = Buffer.byteLength(file.content || '', 'utf8');

  console.log('local  firestore.rules : ' + localBytes + ' bytes');
  console.log('live   emulator ruleset: ' + liveBytes + ' bytes');
  if (liveBytes === localBytes) {
    console.log('\nPASS - the emulator is running the rules on disk.');
  } else {
    console.error('\nFAIL - byte counts differ. The emulator is NOT running your edits.');
    process.exit(1);
  }
})().catch(e => { console.error('ERROR: ' + (e && e.message)); process.exit(2); });
