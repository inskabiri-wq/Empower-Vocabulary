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

   Prerequisites BEFORE first deploy:
     1. Project on Firebase Blaze (pay-as-you-go) plan.
     2. SendGrid account (free tier = 100 emails/day).
        Generate an API key with "Mail Send" full access.
     3. Configure secrets:
          firebase functions:config:set \
            sendgrid.key="SG.xxxxx" \
            sender.email="noreply@yourdomain.tld" \
            sender.name="Lingualab"
     4. cd functions && npm install
     5. firebase deploy --only functions

   Cost: 200 invocations/month (every hour × 24h × 30 days = 720
   invocations but most are no-ops) × $0.0000004 = ~$0.30/month.
   SendGrid free tier covers 100 emails/day = 3000/month, well
   above realistic reminder volume.
   ============================================================ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const sgMail    = require('@sendgrid/mail');

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

exports.sendWritingReminders = functions
  .runWith({ memory: '256MB', timeoutSeconds: 540 })
  .pubsub.schedule('every 60 minutes')
  .timeZone('Europe/Istanbul')   // adjust if FSM moves
  .onRun(async () => {
    const SG_KEY = (functions.config().sendgrid || {}).key;
    const FROM_EMAIL = ((functions.config().sender || {}).email) || 'noreply@example.com';
    const FROM_NAME  = ((functions.config().sender || {}).name)  || 'Lingualab';
    if (!SG_KEY) {
      console.warn('sendgrid.key not configured - skipping reminder pass.');
      return null;
    }
    sgMail.setApiKey(SG_KEY);

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
        await sgMail.send(msg);
        await doc.ref.update({
          reminderEmailSent:   true,
          reminderEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        sent++;
      } catch (e) {
        console.error('SendGrid failed for', doc.id, '·', e.message || e);
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
