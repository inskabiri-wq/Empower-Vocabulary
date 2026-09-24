#!/usr/bin/env node
'use strict';
/* ============================================================
   gates.js - run every gate with one command.
   ------------------------------------------------------------
   WHY THIS EXISTS

   There are two dozen gates in this folder and, until now, nothing ran them
   together. `ship-ready.js` chains a backfill and the data smoke test;
   `preflight.js` does bump, em-dash and grammar. Everything else only ran when
   somebody remembered it, one command at a time.

   That is exactly how a gate rots: it passes for months, someone changes the
   thing it guards, and nobody finds out because nobody ran it. The AI Quiz
   safety net and the security-rule check are the two that must never rot, and
   both were in that category the day they were written.

   WHAT IT DOES

   Discovers every *-check.js and *-sanity.js in this folder, classifies each
   by what it needs, and runs them in their own Node process so no two share a
   firebase-admin singleton.

     static    no dependencies. Always run.
     emulator  needs auth+firestore on 127.0.0.1. Run if reachable, else SKIP
               loudly rather than silently passing.
     prod      talks to the LIVE project. Only with --prod, never by default.

   Exit code is non-zero if any gate fails, so it can be wired into a hook or
   a CI step later without changing anything here.

   Usage:
     node y/tools/gates.js            static + emulator (if it is up)
     node y/tools/gates.js --prod     also the production read-only checks
     node y/tools/gates.js --list     show the classification and exit
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = __dirname;
const ARGS = process.argv.slice(2);
const WANT_PROD = ARGS.indexOf('--prod') !== -1;
const LIST_ONLY = ARGS.indexOf('--list') !== -1;

// gates.js must never run itself, and these are not gates.
const NOT_A_GATE = new Set(['gates.js', 'preflight.js', 'ship-ready.js', 'smoke-test.js']);

function classify(file) {
  const src = fs.readFileSync(path.join(DIR, file), 'utf8');
  if (/serviceAccount/.test(src) && !/EMULATOR_HOST/.test(src)) return 'prod';
  if (/127\.0\.0\.1:(8080|9099)|EMULATOR_HOST/.test(src)) return 'emulator';
  return 'static';
}

const gates = fs.readdirSync(DIR)
  .filter(f => (/-check\.js$/.test(f) || /-sanity\.js$/.test(f)) && !NOT_A_GATE.has(f))
  .sort()
  .map(f => ({ file: f, kind: classify(f) }));

async function emulatorUp() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  try {
    const r = await fetch('http://' + host + '/');
    return r.status === 200;
  } catch (e) { return false; }
}

(async () => {
  const up = await emulatorUp();

  if (LIST_ONLY) {
    console.log('gate                                kind');
    gates.forEach(g => console.log('  ' + g.file.padEnd(34) + g.kind));
    console.log('\nemulator reachable: ' + (up ? 'yes' : 'no'));
    console.log('total: ' + gates.length);
    return;
  }

  const results = [];
  let widest = 0;
  gates.forEach(g => { if (g.file.length > widest) widest = g.file.length; });

  for (const g of gates) {
    if (g.kind === 'prod' && !WANT_PROD) {
      results.push({ g, state: 'SKIP', why: 'production, pass --prod to include' });
      continue;
    }
    if (g.kind === 'emulator' && !up) {
      results.push({ g, state: 'SKIP', why: 'emulator not running' });
      continue;
    }
    process.stdout.write('  ' + g.file.padEnd(widest + 2));
    const r = spawnSync(process.execPath, [path.join(DIR, g.file)], {
      encoding: 'utf8', timeout: 180000
    });
    const outText = ((r.stdout || '') + (r.stderr || '')).trim();
    if (r.status === 0) {
      console.log('PASS');
      results.push({ g, state: 'PASS' });
    } else {
      console.log('FAIL');
      results.push({ g, state: 'FAIL', out: outText.split('\n').slice(-12).join('\n') });
    }
  }

  const skipped = results.filter(r => r.state === 'SKIP');
  const failed = results.filter(r => r.state === 'FAIL');
  const passed = results.filter(r => r.state === 'PASS');

  if (skipped.length) {
    console.log('\nSkipped:');
    skipped.forEach(r => console.log('  ' + r.g.file + '  (' + r.why + ')'));
  }

  if (failed.length) {
    console.log('\n' + '='.repeat(60));
    failed.forEach(r => {
      console.log('\nFAIL  ' + r.g.file);
      console.log(r.out.split('\n').map(l => '      ' + l).join('\n'));
    });
    console.log('\n' + '='.repeat(60));
  }

  console.log('\n' + passed.length + ' passed, ' + failed.length + ' failed, ' + skipped.length + ' skipped');
  if (!up) {
    console.log('The emulator was not running. Start it to include the AI Quiz');
    console.log('safety net and the security-rule check:');
    console.log('  firebase emulators:start --only auth,firestore');
  }
  process.exit(failed.length ? 1 : 0);
})();
