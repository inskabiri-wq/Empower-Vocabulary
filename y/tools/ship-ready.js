/* ============================================================
   ship-ready.js  —  one-shot pre-deploy hygiene runner.

   Sequence:
     1. node tools/backfill-assignment-owner.js
        Stamps `teacherId` on legacy assignments so the
        firestore.rules `_ownsAssignment()` grandfather clause
        becomes a no-op in practice. Safe to re-run.
     2. node tools/smoke-test.js
        Data-integrity checks: org registry schema, score
        bounds, criteria sums, doc-id shape, ownership,
        cross-collection references, role validity.
     3. Print the remaining MANUAL checks from SMOKE-TEST.md
        (the ones a script can't do — UI + security spot-checks
        via DevTools).

   Each sub-script runs in its OWN Node process so the
   firebase-admin app singletons don't collide.

   Run:
     cd E:\vocab-trainer\y
     node tools/ship-ready.js

   Exits:
     0  → backfill + smoke both clean; manual checks remain.
     1  → at least one sub-script failed; review output and
          re-run after fixing.
   ============================================================ */

const { spawn } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const HERE = __dirname;

// The sub-scripts we run, in order. If `stopOnFail` is true and
// the script exits non-zero, we abort the chain.
const STEPS = [
  {
    name:        'Backfill assignment ownership',
    file:        'backfill-assignment-owner.js',
    stopOnFail:  true   // smoke-test references teacherId — don't continue if backfill failed
  },
  {
    name:        'Data-integrity smoke test',
    file:        'smoke-test.js',
    stopOnFail:  false
  }
];

const ANSI = {
  reset:  '\x1b[0m',
  dim:    '\x1b[90m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m'
};

function banner(text) {
  const line = '─'.repeat(72);
  console.log('\n' + ANSI.dim + line + ANSI.reset);
  console.log(ANSI.bold + ' ' + text + ANSI.reset);
  console.log(ANSI.dim + line + ANSI.reset + '\n');
}

function spawnScript(file) {
  return new Promise((resolve) => {
    const full = path.join(HERE, file);
    if (!fs.existsSync(full)) {
      console.error(ANSI.red + 'Missing script: ' + full + ANSI.reset);
      return resolve(127);
    }
    const proc = spawn(process.execPath, [full], { stdio: 'inherit' });
    proc.on('exit', (code) => resolve(code == null ? 1 : code));
    proc.on('error', (err) => {
      console.error(ANSI.red + 'Failed to launch: ' + err.message + ANSI.reset);
      resolve(1);
    });
  });
}

async function main() {
  banner('🚀 Empower Vocabulary — Ship-Readiness Check');
  console.log(' Project root : ' + path.resolve(HERE, '..'));
  console.log(' Started      : ' + new Date().toISOString());

  // Sanity: service account must exist or the sub-scripts can't authenticate.
  const sa = path.join(HERE, '.serviceAccount.json');
  if (!fs.existsSync(sa)) {
    console.error('\n' + ANSI.red + '✗ Missing tools/.serviceAccount.json' + ANSI.reset);
    console.error('  Both sub-scripts use this file to talk to Firestore as admin.');
    console.error('  See create-demo-accounts.js for the same pattern.\n');
    process.exit(1);
  }

  const results = [];
  for (const step of STEPS) {
    banner('▶ ' + step.name + '   (' + step.file + ')');
    const code = await spawnScript(step.file);
    results.push({ name: step.name, file: step.file, code });

    if (code !== 0 && step.stopOnFail) {
      banner(ANSI.red + '✗ Stopping chain — ' + step.name + ' failed.' + ANSI.reset);
      break;
    }
  }

  // ── Summary ──────────────────────────────────────────────
  banner('📊 Summary');
  results.forEach(r => {
    const ok = r.code === 0;
    const tag = ok ? (ANSI.green + '✅ PASS' + ANSI.reset)
                   : (ANSI.red   + '❌ FAIL (exit ' + r.code + ')' + ANSI.reset);
    console.log('  ' + tag + '  ' + r.name + ANSI.dim + '  · ' + r.file + ANSI.reset);
  });

  const allPassed = results.length === STEPS.length && results.every(r => r.code === 0);
  if (!allPassed) {
    console.log('\n' + ANSI.red + 'At least one check failed — fix the above before deploying.' + ANSI.reset + '\n');
    process.exit(1);
  }

  // ── Remaining manual checks ─────────────────────────────
  banner('🖱  Manual checks still required (a script can\'t do these)');
  const manualChecks = [
    {
      group: 'A. Domain authorization (the new dynamic system)',
      items: [
        'In incognito, register with @gmail.com   → must show "domain not authorized"',
        'In incognito, register with @fsm.edu.tr  → succeeds',
        'As admin, open Admin tab → 🏛 Organizations card visible',
        'Try to remove the FSM rows   → blocked (🔒 protected)',
        'Add a new domain, then register in incognito with that domain → succeeds'
      ]
    },
    {
      group: 'C. Writing happy path (the lifecycle that has had the most fixes)',
      items: [
        'Submit a writing essay as a student → double-confirm flow, then lock screen on re-entry',
        'Open as teacher → full-screen viewer, rubric panel, criterion grid auto-totals',
        'Save status = Graded → button reads "✅ Final grade saved" briefly',
        'Student dashboard refresh → card shows purple grade banner with NEW pulse'
      ]
    },
    {
      group: 'D. Return-for-revision loop',
      items: [
        'Teacher marks Returned with a comment, no scores needed',
        'Student dashboard → amber "🔄 Returned for revision" card visible',
        'Click Revise → editor opens with previous text + amber revision banner',
        'Resubmit → status flips back to "Submitted", prior score/comment preserved'
      ]
    },
    {
      group: 'H. Security spot-checks (DevTools console as STUDENT)',
      items: [
        "db.collection('users').doc('OTHER_UID').get().then(d => console.log(d.exists ? 'LEAKED' : 'denied'))",
        "db.collection('writingSubmissions').doc('OTHER_UID_aid').set({score:20,status:'graded'},{merge:true}).catch(e=>console.log('denied:',e.code))",
        "db.collection('settings').doc('organizations').set({list:[{domain:'evil.com',active:true}]},{merge:true}).catch(e=>console.log('denied:',e.code))",
        "db.collection('users').doc(auth.currentUser.uid).update({role:'teacher'}).catch(e=>console.log('denied:',e.code))"
      ]
    }
  ];
  manualChecks.forEach(g => {
    console.log('  ' + ANSI.bold + g.group + ANSI.reset);
    g.items.forEach(i => console.log('    □  ' + i));
    console.log('');
  });

  console.log(ANSI.green + ANSI.bold + ' 🎉 Hygiene scripts are green.' + ANSI.reset);
  console.log(' Once the manual checks above are ticked off, you are ship-ready.\n');
  console.log(ANSI.cyan + ' Deploy with:  firebase deploy --only firestore:rules,hosting' + ANSI.reset + '\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
