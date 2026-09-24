/* ============================================================
   Cloud Functions for Lingualab
   ----------------------------------------------------------------
   Currently hosts one scheduled job:

     sendWritingReminders
       Runs every 60 minutes via Cloud Scheduler.
       Finds writingSubmissions with:
         status === 'submitted'
         submittedAt < now - 12h
         reminderEmailSent !== true
       And emails the owning teacher exactly ONCE per submission.
       Marks `reminderEmailSent: true` + `reminderEmailSentAt` on
       the doc so we never spam.

   NO EMAIL IS SENT TODAY. There is no provider, no mail dependency and
   no secret, so this deploys and runs without asking for anything:

       firebase deploy --only functions:sendWritingReminders

   It finds the submissions that need a reminder, resolves the teacher,
   formats the message, and then stops - because emailProviderReady()
   returns false. Nothing is marked as reminded, so no reminder is lost
   while the transport is missing.

   To see what it WOULD send without sending: REMINDERS_DRY_RUN=1 in
   functions/.env, then read the logs.

   To actually send later, implement the two functions marked
   "THE PROVIDER SEAM" further down. University SMTP is the recommended
   route; a hosted API works the same way.

   Cost while dormant: 720 invocations/month (hourly) x $0.0000004,
   which is well under a cent.
   ============================================================ */

// Explicit v1 import: in firebase-functions v5+ the root export starts moving
// to the v2 API, but all four functions here use the v1 API (runWith/onCall).
// 'firebase-functions/v1' is stable across v4/v5/v6, so the upgrade changes
// nothing about behavior.
const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
// No mail library. See "NO EMAIL PROVIDER IS CONFIGURED" below.
// Exam writing rubrics (IELTS / GRE / TOEFL / CELPIP / PTE). Authored once at
// y/assignments/js/writing-rubrics.js; this is the byte-identical copy that
// ships with the functions bundle. Keep them in step:
//   node y/tools/rubric-sync.js --fix
const RUBRICS   = require('./writing-rubrics');

// ── Email credentials: SECRETS, not functions.config() ────────────
//
// NO EMAIL PROVIDER IS CONFIGURED, DELIBERATELY.
//
// SendGrid was removed. Nothing in this file talks to a mail service, no
// dependency is installed for one, and no secret is declared - which is what
// makes `firebase deploy` stop asking for a SENDGRID_KEY.
//
// Plain env vars with defaults rather than defineString(): a declared param
// prompts on deploy until a value is stored, and there is nothing here worth
// answering a prompt for while the sending step is a stub. Set them in
// functions/.env if you ever want to override them.
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@fsm.edu.tr';
const SENDER_NAME  = process.env.SENDER_NAME  || 'Lingualab';

admin.initializeApp();
const db = admin.firestore();

// Cache the teacher email lookup in-process so a burst of reminders
// for the same teacher only hits Firestore once.
const teacherEmailCache = new Map();

async function lookupTeacherEmail(assignmentDoc) {
  const a = assignmentDoc;
  if (a.teacherEmail) return a.teacherEmail;
  if (!a.teacherId) return null;
  if (teacherEmailCache.has(a.teacherId)) return teacherEmailCache.get(a.teacherId);
  try {
    const u = await db.collection('users').doc(a.teacherId).get();
    const email = u.exists ? (u.data().email || null) : null;
    teacherEmailCache.set(a.teacherId, email);
    return email;
  } catch (e) {
    teacherEmailCache.set(a.teacherId, null);
    return null;
  }
}

function formatReminderEmail({ student, assignment, submission, hoursAgo }) {
  const subAt = submission.submittedAt
    ? new Date(submission.submittedAt.toMillis()).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
      })
    : '-';
  return `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 16px 20px; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 1.2em;">⏳ Writing submission awaiting grading</h2>
      </div>
      <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p>Hi,</p>
        <p>A writing submission has been waiting for your review for <strong>${hoursAgo} hours</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.92em;">
          <tr><td style="padding: 6px 0; color: #6b7280;">Student</td><td style="padding: 6px 0;"><strong>${escape(student)}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Class</td><td style="padding: 6px 0;">${escape(submission.studentClass || '-')}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Assignment</td><td style="padding: 6px 0;">${escape(assignment.title || '(untitled)')}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Submitted</td><td style="padding: 6px 0;">${escape(subAt)}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Word count</td><td style="padding: 6px 0;">${Number(submission.wordCount) || 0}</td></tr>
        </table>
        <p style="margin-top: 18px;">
          <a href="https://your-app.web.app/teacher-dashboard.html" style="display: inline-block; background: #6366f1; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open teacher dashboard →</a>
        </p>
        <p style="color: #9ca3af; font-size: 0.82em; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          This is an automated reminder. You will receive at most one email per submission. To stop these reminders, the student must be marked Graded or Returned.
        </p>
      </div>
    </div>
  `;
}

function escape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── THE PROVIDER SEAM ────────────────────────────────────────────────────
   Everything else about reminders works: finding ungraded submissions,
   resolving the teacher, formatting the email, not sending twice. The only
   missing piece is the transport, and it is deliberately just these two
   functions so adding one later is a small, contained change.

   TO WIRE UP A PROVIDER:

     University SMTP (recommended for FSMVU - free, no third party, and mail
     genuinely from your own domain so it is not filtered):
       1. npm i nodemailer  (in functions/)
       2. put SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS in functions/.env
          (or, for the password, `firebase functions:secrets:set SMTP_PASS`
          and add `secrets: ['SMTP_PASS']` back to the runWith below)
       3. return true from emailProviderReady() when the host is present
       4. create a transport in sendReminderEmail() and send `msg`

     A hosted API (Brevo, Resend, Mailgun): same two functions, using their
     SDK instead. Note that sending as @fsm.edu.tr through any of them needs
     SPF/DKIM records added to the domain by whoever runs its DNS.

   `msg` is already in the shape every provider expects:
     { to, from: { email, name }, subject, html }
   ------------------------------------------------------------------------ */

// Is there anything to send with? False today, on purpose.
function emailProviderReady() {
  return false;
}

// Returns TRUE only if the message really went. Returning false is the
// signal to the caller that the submission must NOT be marked as reminded.
async function sendReminderEmail(msg) {
  if (!emailProviderReady()) return false;
  throw new Error('emailProviderReady() returned true but sendReminderEmail() ' +
                  'has no transport - wire one up before enabling it.');
}

exports.sendWritingReminders = functions
  .runWith({ memory: '256MB', timeoutSeconds: 540 })
  .pubsub.schedule('every 60 minutes')
  .timeZone('Europe/Istanbul')   // adjust if FSM moves
  .onRun(async () => {
    // Secret first, deprecated config second, so an existing setup keeps
    // working and a new one never touches the API that is going away.
    const FROM_EMAIL = SENDER_EMAIL;
    const FROM_NAME  = SENDER_NAME;

    // Short-circuit while there is no provider. The pass still runs below in
    // dry-run mode when you want to see what it WOULD send; flip this by
    // setting REMINDERS_DRY_RUN=1 in functions/.env. Returning here by default
    // keeps the scheduled job at a few cents a month doing nothing.
    if (!emailProviderReady() && process.env.REMINDERS_DRY_RUN !== '1') {
      console.log('No email provider configured - reminder pass skipped. ' +
                  'See sendReminderEmail() to wire one up.');
      return null;
    }

    const twelveHoursAgo = new admin.firestore.Timestamp(
      Math.floor((Date.now() - 12 * 60 * 60 * 1000) / 1000), 0
    );

    // Pull candidate submissions. We can't use compound where()
    // for both status AND submittedAt without a composite index;
    // simpler to filter status server-side and walk the result.
    const snap = await db.collection('writingSubmissions')
      .where('status', '==', 'submitted')
      .where('submittedAt', '<', twelveHoursAgo)
      .limit(500)   // safety cap per run; next run picks up the rest
      .get();

    let sent = 0, skipped = 0, errors = 0;

    for (const doc of snap.docs) {
      const sub = doc.data();
      if (sub.reminderEmailSent) { skipped++; continue; }
      if (!sub.assignmentId)     { skipped++; continue; }

      const aSnap = await db.collection('assignments').doc(sub.assignmentId).get();
      if (!aSnap.exists) { skipped++; continue; }
      const assignment = aSnap.data();

      const teacherEmail = await lookupTeacherEmail(assignment);
      if (!teacherEmail) { skipped++; continue; }

      const subAtMs = sub.submittedAt ? sub.submittedAt.toMillis() : 0;
      const hoursAgo = subAtMs ? Math.floor((Date.now() - subAtMs) / 3600000) : 12;

      const msg = {
        to: teacherEmail,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: `⏳ Awaiting grade: ${assignment.title || 'Writing submission'}`,
        html: formatReminderEmail({
          student: sub.userName || 'A student',
          assignment, submission: sub, hoursAgo
        })
      };

      try {
        const delivered = await sendReminderEmail(msg);
        // Only mark it sent if it ACTUALLY went. A dry run, or a stub that
        // did nothing, must leave the submission untouched - otherwise the
        // reminder is silently consumed and the teacher is never told, which
        // is worse than sending nothing at all.
        if (delivered) {
          await doc.ref.update({
            reminderEmailSent:   true,
            reminderEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sent++;
        } else {
          console.log('would email', msg.to, '·', msg.subject);
          skipped++;
        }
      } catch (e) {
        console.error('reminder send failed for', doc.id, '·', e.message || e);
        errors++;
      }
    }

    console.log(`writing-reminders: sent=${sent} skipped=${skipped} errors=${errors}`);
    return null;
  });

/* ============================================================
   rosterImport  (callable, admin-only)
   ------------------------------------------------------------
   Bulk-creates pre-verified accounts and the per-module class
   roster from a validated Excel import. The same function does
   BOTH jobs:
     - Year one: an email with no account yet gets a new,
       pre-verified account (emailVerified:true, so the existing
       login flow's verification step is bypassed for them) plus a
       generated temporary password it returns to the admin.
     - Every module after: an email that already has an account is
       reused (never recreated); only its module + level + class
       enrollment is (re)written. Enrollments are keyed by
       uid + moduleId, so two modules can never overlap.

   mode:'validate' -> validates only, writes NOTHING, returns the
                      dry-run report (this is the safety gate).
   mode:'commit'   -> only runs if there are zero HARD problems;
                      performs the idempotent writes.

   Match key is EMAIL (lower-cased, trimmed). Re-running the same
   sheet never duplicates anyone.

   Needs the Blaze plan (Cloud Functions). Deploy steps: see
   functions/HOWTO-DEPLOY.md.
   ============================================================ */

const ADMIN_EMAIL    = 'akabiriaslifar@fsm.edu.tr';
const ALLOWED_LEVELS = ['A2', 'B1', 'B1+', 'B2', 'C1'];
const CLASS_RE       = /^[A-Za-z]\d{3}$/;   // e.g. D302 (warning only, not a hard fail)

// Logical field -> the column header expected in the uploaded sheet.
// Adjust the right-hand strings to match your real Excel headers; the
// dry-run report flags any row a field cannot be read from. Header
// matching is case- and whitespace-insensitive, so "Email" / "email" both work.
const COLUMN_MAP = {
  student: { name: 'name', email: 'email', studentNo: 'studentNo', class: 'class', level: 'level' },
  teacher: { name: 'name', email: 'email', class: 'class', level: 'level' }
};

function normEmail(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function isEmail(v)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

// Read a logical field from a row, tolerant of header case/whitespace.
function pick(row, header) {
  if (row == null || typeof row !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(row, header)) return row[header];
  const want = String(header).trim().toLowerCase();
  for (const k of Object.keys(row)) {
    if (String(k).trim().toLowerCase() === want) return row[k];
  }
  return '';
}
function field(row, kind, logical) { return pick(row, COLUMN_MAP[kind][logical]); }

// A short, unambiguous join code for a class QR (no 0/O/1/I/L).
function genJoinCode(n) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < (n || 6); i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function genTempPassword() {
  const A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 10; i++) s += A[Math.floor(Math.random() * A.length)];
  return s + '!7';   // guarantees length + a digit + a symbol
}

async function assertAdmin(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  const email = normEmail(context.auth.token && context.auth.token.email);
  if (email === ADMIN_EMAIL) return;
  const u = await db.collection('users').doc(context.auth.uid).get();
  if (u.exists && u.data().role === 'admin') return;
  throw new functions.https.HttpsError('permission-denied', 'Admin only.');
}

// Validate one sheet. Hard problems block commit; warnings do not.
function validateRows(rows, kind) {
  const clean = [], problems = [], excluded = [], seen = new Map();
  (rows || []).forEach((row, i) => {
    const line = i + 2;   // header is line 1
    const name  = String(field(row, kind, 'name')  || '').trim();
    const email = normEmail(field(row, kind, 'email'));
    const level = String(field(row, kind, 'level') || '').trim();
    const cls   = String(field(row, kind, 'class') || '').trim();
    const studentNo = kind === 'student' ? String(field(row, kind, 'studentNo') || '').trim() : '';

    // No email = no account (email is the login key). Skip into "excluded"
    // rather than blocking the whole import.
    if (!email)         { excluded.push({ line, kind, name, reason: 'no email' }); return; }
    if (!isEmail(email)){ problems.push({ line, kind, field: 'email', issue: 'invalid email: ' + email }); return; }
    if (!name)          { problems.push({ line, kind, field: 'name',  issue: 'missing name' }); return; }
    if (kind === 'student' && !cls) { problems.push({ line, kind, field: 'class', issue: 'missing class' }); return; }
    if (seen.has(email)){ problems.push({ line, kind, field: 'email', issue: 'duplicate email (also line ' + seen.get(email) + '): ' + email }); return; }

    if (level && ALLOWED_LEVELS.indexOf(level) === -1)
      problems.push({ line, kind, field: 'level', issue: 'unknown level: ' + level, warn: true });

    seen.set(email, line);
    // teachers may list several classes (comma / semicolon separated)
    const classes = kind === 'teacher'
      ? cls.split(/[,;]/).map(c => c.trim()).filter(Boolean)
      : [cls];
    classes.forEach(c => { if (c && !CLASS_RE.test(c)) problems.push({ line, kind, field: 'class', issue: 'class code looks unusual: ' + c, warn: true }); });
    clean.push({ line, name, email, level, class: cls, classes, studentNo, role: kind });
  });
  return { clean, problems, excluded };
}

async function emailHasAccount(email) {
  try { const u = await admin.auth().getUserByEmail(email); return u.uid; }
  catch (e) { if (e && e.code === 'auth/user-not-found') return null; throw e; }
}

exports.rosterImport = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    await assertAdmin(context);

    const mode     = (data && data.mode === 'commit') ? 'commit' : 'validate';
    const year     = String((data && data.year)   || '').trim();
    const moduleId = String((data && data.module) || '').trim();
    if (!year || !moduleId)
      throw new functions.https.HttpsError('invalid-argument', 'year and module are required.');

    const sV = validateRows(data && data.students, 'student');
    const tV = validateRows(data && data.teachers, 'teacher');

    // An email must not appear in both sheets.
    const tEmails = new Set(tV.clean.map(p => p.email));
    const crossDup = [];
    sV.clean.forEach(p => { if (tEmails.has(p.email)) crossDup.push({ kind: 'both', field: 'email', issue: 'email is in BOTH the student and teacher sheet: ' + p.email }); });

    const allProblems = [...sV.problems, ...tV.problems, ...crossDup];
    const hardProblems = allProblems.filter(p => !p.warn);
    const excluded = [...(sV.excluded || []), ...(tV.excluded || [])];

    // Classify clean people as new vs existing (drives the dry-run counts).
    const people = [...sV.clean, ...tV.clean];
    let newAccounts = 0, matchedExisting = 0;
    for (const p of people) {
      p._uid = await emailHasAccount(p.email);
      if (p._uid) matchedExisting++; else newAccounts++;
    }

    // Distinct classes in this import (from student rows + teacher rows).
    const classSet = new Set();
    sV.clean.forEach(p => p.class && classSet.add(p.class));
    tV.clean.forEach(p => p.classes.forEach(c => classSet.add(c)));

    const report = {
      mode, year, module: moduleId,
      students: { total: (data.students || []).length, valid: sV.clean.length },
      teachers: { total: (data.teachers || []).length, valid: tV.clean.length },
      newAccounts, matchedExisting, relocations: people.length,
      classes: [...classSet].sort(),
      excluded: { count: excluded.length, rows: excluded },
      problems: allProblems, hardProblemCount: hardProblems.length
    };

    if (mode === 'validate' || hardProblems.length) {
      return { ok: hardProblems.length === 0, committed: false, report };
    }

    // ---- COMMIT (idempotent) ----
    await db.collection('modules').doc(moduleId).set(
      { year, label: moduleId, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid }, { merge: true });

    // teacher email per class (first teacher that lists it)
    const teacherByClass = {};
    tV.clean.forEach(p => p.classes.forEach(c => { if (!teacherByClass[c]) teacherByClass[c] = p; }));
    // a representative level per class (from the students in it)
    const levelByClass = {};
    sV.clean.forEach(p => { if (p.class && p.level && !levelByClass[p.class]) levelByClass[p.class] = p.level; });

    // Chunked batch writer (Firestore caps a batch at 500 ops).
    let batch = db.batch(), ops = 0;
    async function flush() { if (ops) { await batch.commit(); batch = db.batch(); ops = 0; } }
    function set(ref, obj) { batch.set(ref, obj, { merge: true }); if (++ops >= 400) return flush(); }

    // classes (keep an existing joinCode if the class already exists)
    for (const code of classSet) {
      const classKey = moduleId + '__' + code;
      const ref = db.collection('classes').doc(classKey);
      const existing = await ref.get();
      const joinCode = existing.exists && existing.data().joinCode ? existing.data().joinCode : genJoinCode(6);
      const t = teacherByClass[code] || null;
      await set(ref, {
        moduleId, year, code, joinCode,
        level: levelByClass[code] || (t && t.level) || null,
        teacherEmail: t ? t.email : null,
        teacherName:  t ? t.name  : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    await flush();

    // accounts + enrollments
    const credentials = [];   // returned to the admin for new accounts only
    for (const p of people) {
      let uid = p._uid;
      if (!uid) {
        const tempPassword = genTempPassword();
        const created = await admin.auth().createUser({
          email: p.email, emailVerified: true, password: tempPassword,
          displayName: p.name, disabled: false
        });
        uid = created.uid;
        credentials.push({ email: p.email, name: p.name, role: p.role, tempPassword });
      }
      // Write the SAME user-doc fields the app already reads/writes, so an
      // imported student lands in their class/level exactly like a self-verified
      // one. Students: studentClass/level/module/academicYear. Teachers:
      // assignedClasses (drives the teacher dashboard's class scoping). The
      // Admin SDK bypasses the rules' identity-lock, so relocation each module
      // (D302 -> D305) just overwrites studentClass; the student still cannot
      // change it themselves.
      const userRef = db.collection('users').doc(uid);
      const userDoc = {
        email: p.email, name: p.name, role: p.role,
        studentNo: p.studentNo || null,
        academicYear: year, module: moduleId,
        mustSetPassword: p._uid ? admin.firestore.FieldValue.delete() : true,
        rosterManaged: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (p.role === 'student') {
        userDoc.studentClass = p.class;
        userDoc.level = p.level || null;
      } else {
        // Teacher: assignedClasses is what scopes the dashboard to their classes.
        // Do NOT set assignedYear here - config.js treats it as a `level` filter,
        // which would hide all their students.
        userDoc.assignedClasses = p.classes;
      }
      await set(userRef, userDoc);
      const enrollRef = db.collection('enrollments').doc(uid + '__' + moduleId);
      await set(enrollRef, {
        uid, email: p.email, name: p.name, role: p.role,
        moduleId, year, level: p.level || null,
        class: p.role === 'student' ? p.class : null,
        classes: p.role === 'teacher' ? p.classes : null,
        studentNo: p.studentNo || null, active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    await flush();

    const runRef = await db.collection('importRuns').add({
      year, module: moduleId, by: context.auth.uid,
      at: admin.firestore.FieldValue.serverTimestamp(),
      created: credentials.length, relocated: people.length - credentials.length,
      classes: [...classSet].sort()
    });

    return { ok: true, committed: true, runId: runRef.id, report, credentials };
  });

/* ============================================================
   createDemoAccount  (callable, admin-only)
   ------------------------------------------------------------
   Creates ONE pre-verified account (emailVerified:true, so the
   login flow's email-link step is bypassed for it) with an
   admin-chosen ACTIVATION DATE. The activation date is written to
   `registeredAt`, which is exactly the field the account-gate uses
   for the 1-year expiry - so the admin can hand out a demo login
   that "activated" on any date they choose.

   Idempotent by email: if the email already has an account it is
   reused (never duplicated) - password (if given) + emailVerified
   are refreshed and the user doc is re-written. Flags the doc
   `demoAccount:true` so these are easy to find / clean up later.

   Input (data):
     email*        - login email
     name*         - display name
     role          - 'student' (default) | 'teacher'
     password      - optional; auto-generated + returned if omitted
     activationDate- optional ISO/date string; defaults to now
     level,studentClass,module,academicYear,book - required for a
                     student (the login flow needs all four profile
                     fields before it will land them on the dashboard)
   Returns: { ok, uid, email, role, existed, generatedPassword, registeredAt }
   ============================================================ */
exports.createDemoAccount = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    await assertAdmin(context);

    const email = normEmail(data && data.email);
    const name  = String((data && data.name) || '').trim();
    const role  = (data && data.role === 'teacher') ? 'teacher' : 'student';
    let password = String((data && data.password) || '').trim();
    if (!isEmail(email)) throw new functions.https.HttpsError('invalid-argument', 'A valid email is required.');
    if (!name)           throw new functions.https.HttpsError('invalid-argument', 'Name is required.');
    if (password && password.length < 6)
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.');

    // Student profile fields - the login flow (main.js) will not land a
    // student on the dashboard unless level + class + module + year are set.
    let level, studentClass, moduleId, academicYear, book;
    if (role === 'student') {
      level        = String((data && data.level) || '').trim();
      studentClass = String((data && data.studentClass) || '').trim();
      moduleId     = String((data && data.module) || '').trim();
      academicYear = String((data && data.academicYear) || '').trim();
      book         = String((data && data.book) || 'empower').trim() || 'empower';
      if (ALLOWED_LEVELS.indexOf(level) === -1)
        throw new functions.https.HttpsError('invalid-argument', 'Level must be one of ' + ALLOWED_LEVELS.join(', ') + '.');
      if (!studentClass) throw new functions.https.HttpsError('invalid-argument', 'Class is required for a student.');
      if (!moduleId)     throw new functions.https.HttpsError('invalid-argument', 'Module is required for a student.');
      if (!academicYear) throw new functions.https.HttpsError('invalid-argument', 'Academic year is required for a student.');
    }

    // Activation date -> registeredAt (the 1-year expiry anchor).
    let registeredAt;
    if (data && data.activationDate) {
      const d = new Date(data.activationDate);
      if (isNaN(d.getTime())) throw new functions.https.HttpsError('invalid-argument', 'activationDate is not a valid date.');
      registeredAt = admin.firestore.Timestamp.fromDate(d);
    } else {
      registeredAt = admin.firestore.Timestamp.now();
    }

    // Create OR reuse the auth account (always pre-verified).
    let uid = await emailHasAccount(email);
    const existed = !!uid;
    let generatedPassword = null;
    if (!uid) {
      if (!password) { password = genTempPassword(); generatedPassword = password; }
      const created = await admin.auth().createUser({
        email, emailVerified: true, password, displayName: name, disabled: false
      });
      uid = created.uid;
    } else {
      const upd = { emailVerified: true, displayName: name, disabled: false };
      if (password) upd.password = password;
      await admin.auth().updateUser(uid, upd);
    }

    // Write the user doc the app reads on login. registeredAt = the admin's
    // chosen activation date; lastVerifiedAt = now so no re-verify modal pops.
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userDoc = {
      email, name, role, active: true,
      demoAccount: true,
      registeredAt,
      lastVerifiedAt: admin.firestore.Timestamp.now(),
      createdAt: now, updatedAt: now,
      createdByAdmin: context.auth.uid
    };
    if (role === 'student') {
      userDoc.level = level;
      userDoc.studentClass = studentClass;
      userDoc.module = moduleId;
      userDoc.academicYear = academicYear;
      userDoc.book = book;
    }
    await db.collection('users').doc(uid).set(userDoc, { merge: true });

    return {
      ok: true, uid, email, role, existed,
      generatedPassword,                       // null if the admin supplied one
      registeredAt: registeredAt.toDate().toISOString()
    };
  });

/* ============================================================
   listDemoAccounts  (callable, admin-only)
   ------------------------------------------------------------
   Returns every user tagged demoAccount:true, so the admin panel can
   list them (with their activation date -> expiry) and offer delete.
   ============================================================ */
exports.listDemoAccounts = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    await assertAdmin(context);
    const snap = await db.collection('users').where('demoAccount', '==', true).limit(500).get();
    const iso = (v) => (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : null;
    const accounts = snap.docs.map((d) => {
      const u = d.data() || {};
      return {
        uid: d.id,
        email: u.email || '',
        name: u.name || '',
        role: u.role || '',
        level: u.level || '',
        studentClass: u.studentClass || '',
        active: u.active !== false,
        registeredAt: iso(u.registeredAt),
        createdAt: iso(u.createdAt)
      };
    });
    accounts.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return { ok: true, accounts };
  });

/* ============================================================
   deleteDemoAccount  (callable, admin-only)
   ------------------------------------------------------------
   Deletes ONE demo account (auth user + users doc). Guarded: refuses
   unless the users doc is tagged demoAccount:true, so a real student
   or teacher can never be removed through this path.
   ============================================================ */
exports.deleteDemoAccount = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    await assertAdmin(context);
    const uid = String((data && data.uid) || '').trim();
    if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid is required.');

    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists || (doc.data() || {}).demoAccount !== true) {
      throw new functions.https.HttpsError('failed-precondition', 'Not a demo account - refusing to delete.');
    }
    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      if (!e || e.code !== 'auth/user-not-found') throw e;   // ignore an already-gone auth user
    }
    await db.collection('users').doc(uid).delete();
    return { ok: true, uid };
  });

/* ============================================================
   analyzeWriting  (callable, teacher-gated)
   ------------------------------------------------------------
   Live writing feedback for the lingualab-write corrector. Uses the
   CHEAPEST structured-output model (Gemini Flash) with a responseSchema
   so the returned JSON matches EXACTLY what the corrector renders. NO
   numeric scores. Every call is logged to /aiUsage (who / when / depth).

   Access: the admin always; otherwise the caller's uid must be listed in
   settings/aiWritingAccess.teacherUids (admin manages this from the
   Teachers panel). Students are OFF for now (studentsEnabled flag reserved).

   Config: firebase functions:config:set gemini.key="AIza..." [gemini.model=...]
   Input:  { essay, rubric:'essay'|'academic'|'short', depth:'light'|'medium'|'deep', task? }
   Output: { ok, correction }  (correction = the render-ready object)
   ============================================================ */
// Two-tier access, all held in settings/aiWritingAccess:
//   teacherUids[] -> base access (Light + Medium)
//   deepUids[]    -> extra permission to use Deep
//   deepCaps{uid} -> per-teacher Deep allowance (0/missing = unlimited)
//   deepUsed{uid} -> server-incremented Deep count (see analyzeWriting)
// The admin (ADMIN_EMAIL) always passes every tier.
async function assertWritingAI(context, depth) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  const email = normEmail(context.auth.token && context.auth.token.email);
  const name = (context.auth.token && (context.auth.token.name || context.auth.token.displayName)) || email;
  const uid = context.auth.uid;
  const isAdmin = email === ADMIN_EMAIL;
  const snap = await db.collection('settings').doc('aiWritingAccess').get();
  const d = snap.exists ? (snap.data() || {}) : {};
  const teacherUids = Array.isArray(d.teacherUids) ? d.teacherUids : [];
  // Base access (Light + Medium).
  if (!isAdmin && teacherUids.indexOf(uid) === -1) {
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to use Writing AI. Ask your admin to enable it for you.');
  }
  // Deep needs a SEPARATE permission and must stay under the per-teacher cap.
  if (depth === 'deep' && !isAdmin) {
    const deepUids = Array.isArray(d.deepUids) ? d.deepUids : [];
    if (deepUids.indexOf(uid) === -1) {
      throw new functions.https.HttpsError('permission-denied', 'Deep analysis needs extra permission. Ask your admin to enable Deep for your account.');
    }
    const caps = (d.deepCaps && typeof d.deepCaps === 'object') ? d.deepCaps : {};
    const used = (d.deepUsed && typeof d.deepUsed === 'object') ? d.deepUsed : {};
    const cap = Number(caps[uid]) || 0;        // 0 or missing = unlimited
    const usedN = Number(used[uid]) || 0;
    if (cap > 0 && usedN >= cap) {
      throw new functions.https.HttpsError('resource-exhausted', 'You have used all ' + cap + ' of your Deep analyses. Ask your admin to raise your limit.');
    }
  }
  return { uid: uid, email: email, name: name, isAdmin: isAdmin };
}

function _crit() {
  return { type: 'OBJECT', properties: { verdict: { type: 'STRING' }, note: { type: 'STRING' }, noteSimple: { type: 'STRING' } }, required: ['verdict', 'note'] };
}
// The CLASSROOM rubrics keep the original four criteria. Exam rubrics
// (IELTS / GRE / TOEFL / CELPIP / PTE) declare their own - one for the
// holistic exams, seven for the PTE essay - and everything below is
// built from that list, so the engine never hard-codes a count.
const CLASSIC_CRIT = { CC: 'Organization', TA: 'Task Achievement', GR: 'Grammatical Accuracy', VO: 'Word Choice' };
function critsFor(rubricId) {
  const r = RUBRICS.get(rubricId);
  if (r) return r.criteria.map(function (c) { return { key: c.key, label: c.label, what: c.what }; });
  return Object.keys(CLASSIC_CRIT).map(function (k) { return { key: k, label: CLASSIC_CRIT[k], what: '' }; });
}
function writingSchema(depth, crits) {
  var keys = (crits && crits.length ? crits : critsFor('essay')).map(function (c) { return c.key; });
  var critProps = {};
  keys.forEach(function (k) { critProps[k] = _crit(); });
  var schema = {
    type: 'OBJECT',
    properties: {
      cefr: { type: 'STRING' },
      estimates: { type: 'OBJECT', properties: { ielts: { type: 'STRING' }, toefl: { type: 'STRING' }, rubric: { type: 'STRING' } }, required: ['ielts', 'toefl', 'rubric'] },
      overall: { type: 'STRING' },
      overallSimple: { type: 'STRING' },
      criteria: { type: 'OBJECT', properties: critProps, required: keys.slice() },
      annotations: {
        type: 'ARRAY', items: {
          type: 'OBJECT', properties: {
            criterion: { type: 'STRING', enum: keys.slice() },
            severity: { type: 'STRING', enum: ['fix', 'tip', 'strength'] },
            quote: { type: 'STRING' }, text: { type: 'STRING' },
            suggestion: { type: 'STRING' }, simple: { type: 'STRING' }, simpleSuggestion: { type: 'STRING' }
          }, required: ['criterion', 'severity', 'quote', 'text']
        }
      },
      vocabProfile: {
        type: 'OBJECT', properties: {
          cefr: { type: 'STRING' }, note: { type: 'STRING' },
          distribution: { type: 'ARRAY', items: { type: 'OBJECT', properties: { band: { type: 'STRING' }, count: { type: 'INTEGER' } }, required: ['band', 'count'] } }
        }, required: ['cefr', 'distribution']
      },
      grammarProfile: {
        type: 'OBJECT', properties: {
          cefr: { type: 'STRING' }, note: { type: 'STRING' },
          features: { type: 'ARRAY', items: { type: 'OBJECT', properties: { feature: { type: 'STRING' }, count: { type: 'INTEGER' }, cefr: { type: 'STRING' }, examples: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['feature'] } }
        }, required: ['cefr', 'features']
      },
      // DEEP-only profiler tables (the sortable Words / Verb forms / Clauses
      // cards with the List<->Distribution toggle). The corrector has always
      // been able to render these - only the pre-baked sample essays carried
      // the data, so live analysis fell back to the 3-bar summary. Asking for
      // them in the deep schema gives deep runs the full profiler.
      lemmas: {
        type: 'ARRAY', items: {
          type: 'OBJECT', properties: {
            lemma: { type: 'STRING' }, pos: { type: 'STRING' }, cefr: { type: 'STRING' }, count: { type: 'INTEGER' }
          }, required: ['lemma', 'cefr', 'count']
        }
      },
      verbForms: {
        type: 'ARRAY', items: {
          type: 'OBJECT', properties: {
            form: { type: 'STRING' }, with: { type: 'STRING' }, cefr: { type: 'STRING' }, count: { type: 'INTEGER' },
            sentences: { type: 'ARRAY', items: { type: 'STRING' } }
          }, required: ['form', 'cefr', 'count']
        }
      },
      clauses: {
        type: 'ARRAY', items: {
          type: 'OBJECT', properties: {
            clause: { type: 'STRING' }, with: { type: 'STRING' }, cefr: { type: 'STRING' }, count: { type: 'INTEGER' },
            sentences: { type: 'ARRAY', items: { type: 'STRING' } }
          }, required: ['clause', 'cefr', 'count']
        }
      },
      plan: { type: 'ARRAY', items: { type: 'STRING' } },
      planSimple: { type: 'ARRAY', items: { type: 'STRING' } },
      rewrites: { type: 'ARRAY', items: { type: 'OBJECT', properties: { before: { type: 'STRING' }, after: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['before', 'after'] } }
    }
  };
  // Depth-aware required list = a HARD guarantee (constrained decoding): the model
  // CANNOT omit these, so a cheaper model can't silently drop the level estimate,
  // vocab/grammar profiles, plan, or rewrites. Light stays lean on purpose.
  var req = ['cefr', 'estimates', 'overall', 'criteria', 'annotations'];
  if (depth === 'medium' || depth === 'deep') req.push('vocabProfile', 'grammarProfile', 'plan');
  if (depth === 'deep') req.push('rewrites', 'lemmas', 'verbForms', 'clauses');
  schema.required = req;
  return schema;
}
function writingPrompt(essay, rubric, depth, task) {
  const spec = RUBRICS.get(rubric);
  const crits = critsFor(rubric);
  const n = crits.length;
  const rubricName = spec ? (spec.exam + ' - ' + spec.task)
    : (rubric === 'academic' ? 'academic paragraph' : (rubric === 'short' ? 'short paragraph' : 'opinion / argument essay (intermediate to upper-intermediate)'));
  const depthSpec = {
    light: 'LIGHT (quick triage): mark ONLY the highest-impact errors a reader notices first (aim 4-7 annotations). One compact note per criterion. Do NOT include vocabProfile, grammarProfile, plan, planSimple or rewrites.',
    medium: 'MEDIUM (full correction): a complete pass across every criterion with a fix or tip on every notable point (aim 8-16 annotations). Include vocabProfile, grammarProfile and a short "plan"; and for every criterion note + the overall + each annotation, also give the plain-English "noteSimple" / "overallSimple" / "planSimple" / "simple" (+ "simpleSuggestion"). Do NOT include rewrites.',
    deep: 'DEEP (minute analysis): everything MEDIUM has, PLUS "rewrites" - model rewrites of 3-6 of the weakest sentences (before / after / why) - and the three PROFILER tables below. Name grammar points precisely.'
  }[depth] || 'MEDIUM.';
  // Caps matter: these three lists are the bulk of a deep response's output
  // tokens, and deep runs on the pricier model. The counts below keep a deep
  // run roughly one and a half times a medium one instead of several times.
  const profilerSpec = [
    'PROFILER TABLES (deep only, all three required):',
    '  "lemmas": the content words actually used, one entry per dictionary form (lemma), with "pos" (noun/verb/adjective/adverb...), a CEFR band for that word, and "count" = how many times it appears in this text. Up to 40 entries, most frequent and most notable first. Do NOT list function words (the, a, of, and, is).',
    '  "verbForms": the verb structures used, e.g. "present perfect" with "has been", each with its CEFR band, a count, and 1 to 2 short "sentences" quoted from the text showing it. Up to 12 entries.',
    '  "clauses": the clause types used, e.g. "relative clause" with "which", each with its CEFR band, a count, and 1 to 2 short "sentences" quoted from the text. Up to 10 entries.',
    '  Every "sentences" item must be copied verbatim from the essay. Counts must be real counts, not guesses.'
  ].join('\n');
  // The criteria block is generated from the rubric, so a holistic exam gets
  // ONE criterion and the PTE essay gets seven, with no engine change.
  const critLines = crits.map(function (c) {
    return '  ' + c.key + ' = ' + c.label + (c.what ? ' (' + c.what + ')' : '');
  }).join('\n');
  const lines = [
    'You are an experienced writing examiner giving structured, encouraging feedback. Every level figure you give is an ESTIMATE and a SUGGESTION, never an official score.',
    'Rubric: ' + rubricName + '.'
  ];
  if (spec) {
    lines.push('What this task asks of the writer: ' + spec.guidance);
    if (spec.wordTarget) lines.push('Expected length: ' + spec.wordTarget + (spec.timeMin ? ' in about ' + spec.timeMin + ' minutes under exam conditions.' : '.') + ' Count the words yourself and say plainly if the piece is under or over length, because length affects this exam.');
    lines.push('This exam is marked on ' + (n === 1 ? 'ONE holistic judgement' : n + ' separate criteria') + ', on a ' + spec.scale.name + ' scale from ' + spec.scale.min + ' to ' + spec.scale.max + '.');
    lines.push('For EACH criterion, "verdict" must be a short estimated ' + spec.scale.name + ' for that criterion (for example "' + spec.scale.name + ' ' + (spec.scale.step === 0.5 ? (Math.round(spec.scale.max * 0.7 * 2) / 2) : Math.round(spec.scale.max * 0.7)) + '"), and "note" must justify it against what that criterion measures.');
    lines.push('Put an overall estimated ' + spec.scale.name + ' in estimates.rubric (for example "' + spec.scale.name + ' ' + (spec.scale.step === 0.5 ? (Math.round(spec.scale.max * 0.7 * 2) / 2) : Math.round(spec.scale.max * 0.7)) + '"). Keep estimates.ielts and estimates.toefl as rough CEFR-equivalent references.');
    lines.push('Calibration, in our own words - a strong response: ' + spec.anchors.high + ' A middling response: ' + spec.anchors.mid + ' A weak response: ' + spec.anchors.low);
    lines.push('Judge ONLY against this exam task. Do not import criteria from other exams, and do not quote official published band descriptors - write every judgement in your own plain English.');
  } else {
    lines.push('For each criterion, "verdict" is a two or three word judgement (for example "Solid", "Needs work") and "note" explains it.');
  }
  lines.push('Criteria codes to use in "criteria" and in every annotation\'s "criterion" - use these EXACT keys and no others:\n' + critLines);
  lines.push('Annotation severity: "fix" = a clear error, "tip" = an improvement/upgrade, "strength" = genuine praise. Every annotation MUST include "quote" - an EXACT, verbatim substring copied from the essay (same case and punctuation), 3 to 12 words ONLY, so it can be located. For "fix"/"tip" also give "suggestion" = the corrected version of JUST that quoted span, about 20 words max. Never invent a quote that is not in the essay. NEVER paste a whole sentence, paragraph, or the whole essay into "quote" or "suggestion"; full-sentence rewrites belong ONLY in the "rewrites" field (deep mode), one weak sentence each.');
  if (n === 1) lines.push('This rubric is HOLISTIC: put every annotation under "' + crits[0].key + '", and make the single criterion note a full, evidence-based judgement of the whole response.');
  lines.push('Depth: ' + depthSpec);
  if (depth === 'deep') lines.push(profilerSpec);
  lines.push(task ? ('The writing task/prompt was: "' + task + '".') : 'No task prompt was provided; infer the task from the text and say so if it matters.');
  lines.push('Set cefr to a short estimate like "A2 to B1". Return ONLY JSON that fits the schema, and fill EVERY field the schema requires for this depth with real, specific content - never leave a required section (level estimate, criteria, vocab/grammar profile, plan, rewrites) empty or generic.');
  lines.push('', 'ESSAY:', '"""', essay, '"""');
  return lines.join('\n');
}
async function callGemini(key, model, essay, rubric, depth, task) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const body = {
    contents: [{ role: 'user', parts: [{ text: writingPrompt(essay, rubric, depth, task) }] }],
    // Deep now also returns the three profiler tables, so it needs headroom:
    // a truncated response is not "shorter feedback", it is invalid JSON and
    // the whole run fails. You are billed for tokens produced, not for the cap.
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: (depth === 'deep') ? 16384 : 8192,
      responseMimeType: 'application/json',
      responseSchema: writingSchema(depth, critsFor(rubric))
    }
  };
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new functions.https.HttpsError('internal', 'Gemini error: ' + ((json && json.error && json.error.message) || ('HTTP ' + resp.status)));
  const txt = json && json.candidates && json.candidates[0] && json.candidates[0].content &&
    json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text;
  if (!txt) throw new functions.https.HttpsError('internal', 'The writing AI returned no content (possibly blocked or empty).');
  let out;
  try { out = JSON.parse(txt); } catch (e) { throw new functions.https.HttpsError('internal', 'The writing AI did not return valid JSON.'); }
  // Real token counts straight from the API, so cost is MEASURED, not guessed.
  // `modelVersion` is what the -latest alias actually resolved to: the only way
  // to notice Google repointing an alias, which silently changes the price
  // (flash-lite-latest moving 2.5 -> 3.5 multiplied output cost about 6x).
  const um = (json && json.usageMetadata) || {};
  return {
    correction: out,
    usage: {
      modelVersion: (json && json.modelVersion) || '',
      promptTokens: Number(um.promptTokenCount) || 0,
      outputTokens: Number(um.candidatesTokenCount) || 0,
      thoughtsTokens: Number(um.thoughtsTokenCount) || 0,
      totalTokens: Number(um.totalTokenCount) || 0
    }
  };
}

/* Gemini list prices, USD per 1M tokens. Checked 2026-07-22 against
   https://ai.google.dev/gemini-api/docs/pricing - UPDATE when Google changes
   them. Output price includes thinking tokens, so we bill candidates+thoughts.
   This only stamps an ESTIMATE onto /aiUsage; the token counts logged beside
   it are the authoritative numbers. */
const GEMINI_PRICES = {
  'gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
  'gemini-2.5-flash':      { in: 0.30, out: 2.50 },
  'gemini-3.5-flash-lite': { in: 0.30, out: 2.50 },
  'gemini-3.5-flash':      { in: 1.50, out: 9.00 },
  'gemini-3.6-flash':      { in: 1.50, out: 7.50 }
};
function estimateCostUsd(modelName, usage) {
  const name = String(modelName || '');
  let price = null, best = 0;
  Object.keys(GEMINI_PRICES).forEach(function (k) {
    if (name.indexOf(k) === 0 && k.length > best) { price = GEMINI_PRICES[k]; best = k.length; }
  });
  if (!price) return 0;
  const inTok = Number(usage && usage.promptTokens) || 0;
  const outTok = (Number(usage && usage.outputTokens) || 0) + (Number(usage && usage.thoughtsTokens) || 0);
  return Math.round(((inTok * price.in + outTok * price.out) / 1e6) * 1e6) / 1e6;
}

exports.analyzeWriting = functions
  .runWith({ memory: '512MB', timeoutSeconds: 120, secrets: ['GEMINI_KEY'] })
  .https.onCall(async (data, context) => {
    const depth = ['light', 'medium', 'deep'].indexOf(data && data.depth) !== -1 ? data.depth : 'medium';
    const who = await assertWritingAI(context, depth);
    const essay = String((data && data.essay) || '').replace(/\r\n/g, '\n').trim();
    // A rubric id is either one of the three classroom rubrics or an exam
    // rubric from the shared registry. Anything else falls back to 'essay',
    // so a stale client can never push an unknown id into the AI schema.
    const askedRubric = (data && typeof data.rubric === 'string') ? data.rubric : '';
    const rubric = (['essay', 'academic', 'short'].indexOf(askedRubric) !== -1 || RUBRICS.isExam(askedRubric)) ? askedRubric : 'essay';
    const task = String((data && data.task) || '').trim().slice(0, 2000);
    if (essay.length < 40) throw new functions.https.HttpsError('invalid-argument', 'The essay is too short to analyze.');
    if (essay.length > 12000) throw new functions.https.HttpsError('invalid-argument', 'The essay is too long (about 12000 characters max).');

    // Gemini key from Secret Manager (functions.config() is deprecated). Set it
    // once with: firebase functions:secrets:set GEMINI_KEY
    const key = process.env.GEMINI_KEY;
    if (!key) throw new functions.https.HttpsError('failed-precondition', 'Writing AI is not configured yet - an admin must set the Gemini key: firebase functions:secrets:set GEMINI_KEY.');
    // Google keeps retiring pinned model names or locking them to "existing
    // users". Try a list, CHEAPEST first, and use the first one this project is
    // allowed to call. gemini-flash-lite-latest auto-updates to the current cheap
    // Flash-Lite (fast, no heavy "thinking"); the pricey full-flash alias is only
    // a last resort. Set the GEMINI_MODEL secret/env to force a single model
    // (e.g. gemini-2.5-flash-lite for the absolute cheapest) and skip the fallback.
    const BILLING_RE = /prepay|credit|quota|billing|resource[ _]?exhausted|exceeded|rate.?limit|429/i;
    const UNAVAILABLE_RE = /no longer available|not available|not found|is not supported|unsupported|does not exist|unknown name|invalid model/i;
    // HYBRID TIERS (deliberate). Light + Medium run on the cheap Flash-Lite
    // alias; DEEP runs on the full Flash alias, because deep is where sentence
    // rewrites and precise grammar naming happen and the stronger model earns
    // its price there. Deep is already permission-gated and capped per teacher,
    // so the extra spend stays small and controlled.
    //   Flash-Lite ~ $0.30 in / $2.50 out per 1M   (as of 2026-07-22)
    //   Flash      ~ $1.50 in / $7.50 out per 1M
    // Pin an exact model with an env var to skip the fallback chain:
    //   GEMINI_MODEL       -> light + medium (and deep when GEMINI_MODEL_DEEP is unset)
    //   GEMINI_MODEL_DEEP  -> deep only
    const LITE_CHAIN = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
    const DEEP_CHAIN = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
    const pinned = (depth === 'deep')
      ? (process.env.GEMINI_MODEL_DEEP || process.env.GEMINI_MODEL)
      : process.env.GEMINI_MODEL;
    const candidates = pinned ? [pinned] : (depth === 'deep' ? DEEP_CHAIN : LITE_CHAIN);

    // The admin (who is testing/configuring) sees the real failure reason so
    // they can diagnose (billing, quota, blocked content...). Teachers get a
    // clean, non-technical message and are told to contact the admin.
    let correction, usage = {}, model, lastErr;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await callGemini(key, candidates[i], essay, rubric, depth, task);
        correction = res.correction;
        usage = res.usage || {};
        model = candidates[i];
        break;
      } catch (e) {
        lastErr = e;
        const msg = (e && e.message) || '';
        // Only fall through when THIS model is unusable. For real problems
        // (billing, blocked content, bad JSON) stop and report immediately.
        if (UNAVAILABLE_RE.test(msg) && !BILLING_RE.test(msg)) continue;
        break;
      }
    }

    if (!correction) {
      const raw = (lastErr && lastErr.message) || 'error';
      console.error('analyzeWriting: no usable model for ' + (who.email || who.uid) + ': ' + raw);
      if (who.email === ADMIN_EMAIL) {
        throw (lastErr instanceof functions.https.HttpsError) ? lastErr : new functions.https.HttpsError('internal', raw);
      }
      const billing = BILLING_RE.test(raw);
      throw new functions.https.HttpsError(
        billing ? 'unavailable' : 'internal',
        billing
          ? 'Writing AI is temporarily unavailable. Please contact your administrator.'
          : 'Writing AI could not analyze this right now. Please try again in a moment, or contact your administrator if it keeps happening.'
      );
    }
    const estUsd = estimateCostUsd(usage.modelVersion || model, usage);
    console.log('analyzeWriting: ' + depth + ' | ' + model + ' -> ' + (usage.modelVersion || '?') +
      ' | tokens in/out/think ' + (usage.promptTokens || 0) + '/' + (usage.outputTokens || 0) + '/' + (usage.thoughtsTokens || 0) +
      ' | est $' + estUsd.toFixed(5));
    correction.level = depth;
    correction.rubric = rubric;
    // Guard: keep only well-formed annotations. The quote must be a real, SHORT
    // span of the essay, and the suggestion must not be a runaway rewrite. This
    // stops the model from dumping a whole rewritten passage into one comment
    // (and keeps the corrector's substring-locator from highlighting everything).
    if (Array.isArray(correction.annotations)) {
      var okCrits = critsFor(rubric).map(function (c) { return c.key; });
      correction.annotations = correction.annotations.filter(function (a) {
        if (!a || !a.quote || essay.indexOf(a.quote) === -1) return false;
        if (okCrits.indexOf(a.criterion) === -1) return false;          // criterion outside this rubric

        var quoteWords = String(a.quote).trim().split(/\s+/).filter(Boolean).length;
        if (quoteWords > 15) return false;                                   // a pasted passage, not a span
        if (a.suggestion && String(a.suggestion).length > 300) return false; // runaway whole-essay rewrite
        return true;
      });
    }
    // Rewrites (deep) are meant to be single weak sentences; drop any that carry
    // a whole paragraph/essay so the "Model rewrites" block stays sane.
    if (Array.isArray(correction.rewrites)) {
      correction.rewrites = correction.rewrites.filter(function (r) {
        return r && r.before && r.after && String(r.before).length <= 400 && String(r.after).length <= 500;
      });
    }

    try {
      await db.collection('aiUsage').add({
        feature: 'writing', teacherId: who.uid, teacherName: who.name || who.email || '', teacherEmail: who.email || '',
        depth: depth, rubric: rubric, essayChars: essay.length, model: model,
        // Measured usage, so monthly cost can be totalled from real numbers
        // instead of estimated. modelVersion shows what the alias resolved to.
        modelVersion: usage.modelVersion || '',
        promptTokens: usage.promptTokens || 0,
        outputTokens: usage.outputTokens || 0,
        thoughtsTokens: usage.thoughtsTokens || 0,
        totalTokens: usage.totalTokens || 0,
        estCostUsd: estUsd,
        at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.warn('aiUsage log', e); }

    // Count a teacher's successful Deep run against their cap (server-authoritative,
    // read back by assertWritingAI). Admin is uncapped so is never counted.
    if (depth === 'deep' && !who.isAdmin && who.uid) {
      try {
        var inc = { deepUsed: {} };
        inc.deepUsed[who.uid] = admin.firestore.FieldValue.increment(1);
        await db.collection('settings').doc('aiWritingAccess').set(inc, { merge: true });
      } catch (e) { console.warn('deepUsed increment', e); }
    }

    return { ok: true, correction: correction };
  });

/* ============================================================
   pruneRetention - the 6-month policy, run on a schedule.
   ------------------------------------------------------------
   WHY

   activity-tracker/js/activity-config.js has carried `retentionMonths: 6`
   since the KVKK conversation, with the note "Nothing enforces this on its
   own". The Activity Logs tab offers a button and somebody has to remember
   to press it. This is the same policy, on a timer.

   MEASURED against production before this was written:
     activityLogs  4394 docs, oldest 2026-02-28,  185 older than 6 months
     sessions      3049 docs, oldest 2025-12-22, 1397 older than 6 months

   That second number is why `sessions` ships DISABLED with no window.
   Pruning it at six months would delete 46% of the practice history, and
   sessions are what the Reports tab draws on. That is a policy decision AND
   a reporting decision, and neither is mine to make.

   THE SAFETY PROPERTIES, in the order they matter

   1. OFF UNLESS ASKED. No settings/retention document means this does
      nothing at all.
   2. DRY RUN UNLESS TOLD OTHERWISE. Even enabled, it only counts and logs
      until `dryRun: false` is set. You read a real number before anything
      is deleted.
   3. A FLOOR ON THE WINDOW. Under 3 months is refused, because `months: 0`
      is far more likely to be a typo than an instruction.
   4. A HARDCODED ALLOWLIST. Config picks settings for a collection, never
      the collection. Nothing in Firestore can aim this at `users`.
   5. DOCUMENTS WITHOUT THE FIELD ARE INVISIBLE to a range query, so they
      can never be selected. A Firestore guarantee, not one this code has
      to earn.
   6. CAPPED PER RUN, with an audit row written for every run, dry included.

   Configure by hand, once, at settings/retention:

     { activityLogs: { enabled: true,  months: 6, dryRun: false },
       sessions:     { enabled: false, months: 24 } }

   To stop it immediately set enabled:false. No deploy needed.

   The logic lives in ./retention.js so y/tools/retention-check.js can run the
   REAL code against the emulator instead of a copy of it.

   NOT EXPORTED SINCE 2026-09-11. Alireza removed the deployed function with
   `firebase functions:delete pruneRetention`. An `exports.` here would have
   silently recreated it on the next `firebase deploy --only functions` - for
   any unrelated reason, a fix to analyzeWriting say - so the export is held
   back rather than the code deleted.

   Nothing else depends on this export: y/tools/retention-check.js requires
   ./retention.js directly, so that gate still exercises the real logic.

   TO RE-ENABLE: rename `_pruneRetention_notExported` below back to
   `exports.pruneRetention`, deploy functions, then create settings/retention.
   Without that document it does nothing even when deployed.
   ============================================================ */
const retention = require('./retention');

// eslint-disable-next-line no-unused-vars
const _pruneRetention_notExported = functions
  .runWith({ memory: '256MB', timeoutSeconds: 540 })
  .pubsub.schedule('every sunday 03:00')
  .timeZone('Europe/Istanbul')
  .onRun(async () => {
    let cfg = null;
    try {
      const doc = await db.collection('settings').doc('retention').get();
      cfg = doc.exists ? (doc.data() || null) : null;
    } catch (e) {
      console.error('retention: could not read settings/retention', e);
      return null;
    }
    if (!cfg) {
      console.log('retention: no settings/retention document - nothing to do.');
      return null;
    }

    const results = [];
    for (const coll of Object.keys(retention.COLLECTIONS)) {
      try {
        results.push(await retention.pruneOneCollection(db, coll, cfg[coll]));
      } catch (e) {
        console.error('retention: ' + coll + ' failed', e);
        results.push({ collection: coll, deleted: 0, error: String(e && e.message).slice(0, 200) });
      }
    }

    results.forEach(function (r) {
      console.log('retention: ' + r.collection + ' -> ' +
        (r.error ? ('ERROR ' + r.error)
                 : (r.skipped ? r.skipped
                              : ('deleted ' + r.deleted + ' of ' + r.matched +
                                 ' older than ' + r.cutoff + ', ' + r.remaining + ' left'))));
    });

    // An audit row for every run, dry ones included, so there is a record of
    // what this did and when even if nobody was reading the logs.
    try {
      await db.collection('settings').doc('retentionRuns')
        .set({ ['run_' + new Date().toISOString().slice(0, 10)]: {
          at: admin.firestore.FieldValue.serverTimestamp(),
          results: results
        } }, { merge: true });
    } catch (e) { console.warn('retention: could not write the audit row', e); }

    return null;
  });
