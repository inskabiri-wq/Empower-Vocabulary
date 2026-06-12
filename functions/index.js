/* ============================================================
   Cloud Functions for Empower Vocabulary
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
            sender.name="Empower Vocabulary"
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
    : '—';
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
          <tr><td style="padding: 6px 0; color: #6b7280;">Class</td><td style="padding: 6px 0;">${escape(submission.studentClass || '—')}</td></tr>
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
    const FROM_NAME  = ((functions.config().sender || {}).name)  || 'Empower Vocabulary';
    if (!SG_KEY) {
      console.warn('sendgrid.key not configured — skipping reminder pass.');
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
