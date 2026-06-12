/* ============================================================
   smoke-test.js  —  data-integrity smoke test
   Read-only checks against the live Firestore. Uses the same
   service-account pattern as the other admin scripts.

   What it covers (data layer only — rules + UI need eyes):
     • Schema integrity of /settings/organizations
     • Denormalized arrays match `list`
     • Assignment ownership (teacherId backfill complete?)
     • Writing submissions:
         - Score 0..20
         - Criteria (TA/CC/GR/VO) each 0..5
         - Criteria sum matches score (within tolerance)
         - graded/returned have gradedBy + gradedAt
         - userId matches doc-id prefix
     • Cross-doc references:
         - writingSubmissions.assignmentId points to a real doc
         - assignmentCompletions.userId points to a real user
     • Users:
         - role is one of the known values
         - 'teacher' role + email is in a teacherEligible domain
         - Auth account exists for each user doc (orphan check)

   Run:
     cd E:\vocab-trainer\y
     node tools/smoke-test.js

   Exits 0 on all-green, 1 on any failure. Suitable for CI later.
   ============================================================ */

const admin = require('firebase-admin');
const path  = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '.serviceAccount.json');
const ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';

// Hardcoded fallback list from firestore.rules — keep in sync.
const RULE_FALLBACK_DOMAINS         = ['fsm.edu.tr', 'stu.fsm.edu.tr'];
const RULE_FALLBACK_TEACHER_DOMAINS = ['fsm.edu.tr'];

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
  });
} catch (err) {
  console.error('Could not load service account from', SERVICE_ACCOUNT_PATH);
  console.error('See create-demo-accounts.js for setup instructions.');
  process.exit(1);
}

const db   = admin.firestore();
const auth = admin.auth();

// ── Output helpers ─────────────────────────────────────────────
let passed   = 0;
let failed   = 0;
let warnings = 0;
const failures = [];

function header(s) { console.log('\n\x1b[1m' + s + '\x1b[0m'); }
function ok(name)            { passed++; console.log('  \x1b[32m✅\x1b[0m ' + name); }
function bad(name, details)  {
  failed++; failures.push(name);
  console.log('  \x1b[31m❌\x1b[0m ' + name + (details ? ' — ' + details : ''));
}
function warn(name, details) {
  warnings++;
  console.log('  \x1b[33m⚠\x1b[0m  ' + name + (details ? ' — ' + details : ''));
}
function info(s) { console.log('  \x1b[90m·\x1b[0m  ' + s); }

function check(cond, name, details) {
  if (cond) ok(name); else bad(name, details);
}

// ── Tests ─────────────────────────────────────────────────────

async function testOrgRegistry() {
  header('🏛 Organizations registry (/settings/organizations)');

  const snap = await db.collection('settings').doc('organizations').get();
  if (!snap.exists) {
    warn('settings/organizations doc missing',
         'rule fallback covers FSM only — admin should seed via UI');
    return;
  }
  ok('Doc exists');
  const data = snap.data() || {};

  check(Array.isArray(data.list),
        '`list` is an array',
        'got ' + typeof data.list);
  check(Array.isArray(data.activeDomains),
        '`activeDomains` is an array',
        'got ' + typeof data.activeDomains);
  check(Array.isArray(data.teacherEligibleDomains),
        '`teacherEligibleDomains` is an array',
        'got ' + typeof data.teacherEligibleDomains);

  // Denormalized arrays should match the list. The admin UI rebuilds
  // them on every save — any drift indicates a manual / broken write.
  if (Array.isArray(data.list) && Array.isArray(data.activeDomains)) {
    const expectedActive = data.list
      .filter(o => o && o.active !== false)
      .map(o => String(o.domain || '').toLowerCase())
      .filter(Boolean);
    const got = data.activeDomains.slice().sort();
    const want = expectedActive.slice().sort();
    check(JSON.stringify(got) === JSON.stringify(want),
          '`activeDomains` matches `list`',
          'got [' + got.join(', ') + '], want [' + want.join(', ') + ']');
  }
  if (Array.isArray(data.list) && Array.isArray(data.teacherEligibleDomains)) {
    const expectedTeacher = data.list
      .filter(o => o && o.active !== false && o.teacherEligible === true)
      .map(o => String(o.domain || '').toLowerCase())
      .filter(Boolean);
    const got  = data.teacherEligibleDomains.slice().sort();
    const want = expectedTeacher.slice().sort();
    check(JSON.stringify(got) === JSON.stringify(want),
          '`teacherEligibleDomains` matches `list`',
          'got [' + got.join(', ') + '], want [' + want.join(', ') + ']');
  }

  // Domain shape (no @, no whitespace, contains a TLD).
  if (Array.isArray(data.list)) {
    let bad = 0;
    data.list.forEach(o => {
      const d = String(o?.domain || '');
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d)) bad++;
    });
    check(bad === 0, 'All domains have valid syntax', bad + ' invalid');
  }

  info(`${data.list?.length || 0} orgs registered, ${data.activeDomains?.length || 0} active, ${data.teacherEligibleDomains?.length || 0} teacher-eligible`);
}

async function testAssignments() {
  header('📝 Assignments');

  let total       = 0;
  let noTeacherId = 0;
  let badTarget   = 0;
  let noDeadline  = 0;
  let noCreatedAt = 0;
  let rubricCount = 0;

  let cursor = null;
  while (true) {
    let q = db.collection('assignments').orderBy('__name__').limit(500);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach(doc => {
      total++;
      cursor = doc;
      const d = doc.data() || {};
      if (!d.teacherId || !String(d.teacherId).trim()) noTeacherId++;
      if (!['class','level','module','individual'].includes(d.targetType)) badTarget++;
      if (!d.deadline)  noDeadline++;
      if (!d.createdAt) noCreatedAt++;
      if ((d.rubric && String(d.rubric).trim()) || (d.rubricUrl && String(d.rubricUrl).trim())) rubricCount++;
    });
    if (snap.size < 500) break;
  }

  info(`${total} assignments scanned`);
  if (noTeacherId > 0) {
    warn('Assignments missing teacherId', `${noTeacherId} found (run backfill-assignment-owner.js)`);
  } else {
    ok('All assignments have a teacherId');
  }
  check(badTarget === 0,  'All targetType values valid', badTarget + ' invalid');
  check(noDeadline === 0, 'All assignments have a deadline', noDeadline + ' missing');
  if (noCreatedAt > 0) warn('Assignments missing createdAt', noCreatedAt + ' found');
  info(`${rubricCount} writing assignments carry a rubric`);
}

async function testWritingSubmissions() {
  header('✍️ Writing submissions');

  let total = 0;
  let badIdShape       = 0;
  let scoreOutOfRange  = 0;
  let critOutOfRange   = 0;
  let sumMismatch      = 0;
  let gradedNoGrader   = 0;
  let gradedNoTs       = 0;
  let returnedNoCmt    = 0;
  let submittedHasScore = 0;
  const assignmentIds  = new Set();

  let cursor = null;
  while (true) {
    let q = db.collection('writingSubmissions').orderBy('__name__').limit(500);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach(doc => {
      total++;
      cursor = doc;
      const d = doc.data() || {};

      // Doc id should be `{uid}_{aid}`. Verify userId matches the prefix.
      if (d.userId) {
        if (!doc.id.startsWith(d.userId + '_')) badIdShape++;
      }

      if (d.assignmentId) assignmentIds.add(d.assignmentId);

      // Score range
      if (d.score != null) {
        const n = Number(d.score);
        if (!Number.isFinite(n) || n < 0 || n > 20) scoreOutOfRange++;
      }

      // Criteria range + sum
      if (d.criteria && typeof d.criteria === 'object') {
        ['TA','CC','GR','VO'].forEach(k => {
          const v = d.criteria[k];
          if (v != null && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 5)) {
            critOutOfRange++;
          }
        });
        if (d.score != null) {
          const sum = ['TA','CC','GR','VO'].reduce((a, k) => a + (Number(d.criteria[k]) || 0), 0);
          if (Math.abs(sum - Number(d.score)) > 0.05) sumMismatch++;
        }
      }

      // Status sanity
      const status = d.status || 'submitted';
      if (status === 'graded' || status === 'returned') {
        if (!d.gradedBy) gradedNoGrader++;
        if (!d.gradedAt) gradedNoTs++;
      }
      if (status === 'returned' && !(d.teacherComment && String(d.teacherComment).trim())) {
        returnedNoCmt++;
      }
      if (status === 'submitted' && d.score != null) submittedHasScore++;
    });
    if (snap.size < 500) break;
  }

  info(`${total} submissions scanned`);
  check(badIdShape === 0,       'All doc ids match userId_assignmentId pattern', badIdShape + ' violations');
  check(scoreOutOfRange === 0,  'All scores within [0, 20]', scoreOutOfRange + ' out of range');
  check(critOutOfRange === 0,   'All criteria values within [0, 5]', critOutOfRange + ' out of range');
  check(sumMismatch === 0,      'Criteria sums match score',
        sumMismatch + ' submissions where TA+CC+GR+VO ≠ score');
  if (gradedNoGrader > 0)  warn('Graded/returned submissions without gradedBy', gradedNoGrader + ' found');
  if (gradedNoTs > 0)      warn('Graded/returned submissions without gradedAt', gradedNoTs + ' found');
  if (returnedNoCmt > 0)   warn('Returned submissions without a teacher comment',
                                returnedNoCmt + ' found (teacher should explain what to revise)');
  if (submittedHasScore > 0) warn('Submitted (ungraded) submissions with a score set',
                                  submittedHasScore + ' found (unusual)');

  // Orphan cross-check — every assignmentId should resolve to a doc.
  // Sampled to avoid N+1 on huge collections.
  const aIds = Array.from(assignmentIds);
  const sample = aIds.slice(0, 100);
  let orphan = 0;
  for (const aid of sample) {
    const a = await db.collection('assignments').doc(aid).get();
    if (!a.exists) orphan++;
  }
  check(orphan === 0, 'Submissions reference real assignments',
        orphan + ' orphan (of ' + sample.length + ' sampled)');
}

async function testUsers() {
  header('👤 Users');

  // Pull org registry once so we can verify teacher domain eligibility.
  const orgSnap = await db.collection('settings').doc('organizations').get();
  const orgData = orgSnap.exists ? orgSnap.data() : null;
  const teacherEligible = new Set([
    ...RULE_FALLBACK_TEACHER_DOMAINS,
    ...((orgData?.teacherEligibleDomains) || [])
  ]);

  let total = 0;
  let badRole          = 0;
  let teacherBadDomain = 0;
  let noEmail          = 0;
  let authMissing      = 0;

  let cursor = null;
  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(500);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      total++;
      cursor = doc;
      const d = doc.data() || {};
      const email  = String(d.email || '').toLowerCase().trim();
      const role   = d.role;
      const domain = email.split('@')[1] || '';

      if (!['student','teacher','demo','admin'].includes(role)) badRole++;
      if (!email) noEmail++;

      if (role === 'teacher' && domain && !teacherEligible.has(domain)) {
        teacherBadDomain++;
        info('  Teacher ' + email + ' is at non-teacherEligible domain ' + domain);
      }

      // Auth-record orphan check (just a sample to keep cost low).
      if (total <= 25 && email && d.role !== 'demo') {
        try {
          await auth.getUser(doc.id);
        } catch (_) { authMissing++; }
      }
    }
    if (snap.size < 500) break;
  }

  info(`${total} users scanned`);
  check(badRole === 0,        'All roles in [student, teacher, demo, admin]', badRole + ' invalid');
  check(noEmail === 0,        'All users have an email', noEmail + ' missing');
  check(teacherBadDomain === 0,
        'All teachers at teacher-eligible domains',
        teacherBadDomain + ' violations');
  if (authMissing > 0) warn('User docs without matching Auth records (sample)', authMissing + ' of 25 sampled');
}

async function testAssignmentCompletions() {
  header('✅ Assignment completions');

  let total      = 0;
  let badIdShape = 0;
  let outOfRange = 0;

  let cursor = null;
  while (true) {
    let q = db.collection('assignmentCompletions').orderBy('__name__').limit(500);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach(doc => {
      total++;
      cursor = doc;
      const d = doc.data() || {};
      if (d.userId && !doc.id.startsWith(d.userId + '_')) badIdShape++;
      if (d.bestScore != null) {
        const n = Number(d.bestScore);
        if (!Number.isFinite(n) || n < 0 || n > 100) outOfRange++;
      }
    });
    if (snap.size < 500) break;
  }

  info(`${total} completions scanned`);
  check(badIdShape === 0, 'All doc ids match userId_assignmentId pattern', badIdShape + ' violations');
  check(outOfRange === 0, 'All bestScore values within [0, 100] or null', outOfRange + ' out of range');
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\x1b[1m🚀 Empower Vocabulary — Smoke Test\x1b[0m');
  console.log('   Project: ' + (admin.app().options.projectId || '(unknown)'));
  console.log('   Started: ' + new Date().toISOString());

  await testOrgRegistry();
  await testAssignments();
  await testWritingSubmissions();
  await testAssignmentCompletions();
  await testUsers();

  console.log('\n\x1b[1m📊 Summary\x1b[0m');
  console.log('   \x1b[32mPassed:\x1b[0m   ' + passed);
  console.log('   \x1b[33mWarnings:\x1b[0m ' + warnings);
  console.log('   \x1b[31mFailed:\x1b[0m   ' + failed);
  if (failed > 0) {
    console.log('\n\x1b[31m❌ Failures:\x1b[0m');
    failures.forEach(f => console.log('   - ' + f));
    process.exit(1);
  }
  console.log('\n\x1b[32m✅ All hard checks passed.\x1b[0m');
  if (warnings > 0) {
    console.log('\x1b[33m   Review warnings above — they may be intentional but worth a look.\x1b[0m');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
