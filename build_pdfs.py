"""Build the operational PDFs.

Run:  python build_pdfs.py

Outputs (in E:/vocab-trainer/):
  - DEMO-CREDENTIALS.pdf     The shareable credentials sheet
  - DEMO-ACCOUNT.pdf         Internal reference on how demo accounts work
  - WALKTHROUGH.pdf          Three-audience walkthrough (admin/teachers/students)

The credentials list is kept in sync with y/tools/create-demo-accounts.js
manually — if you rotate passwords there, update DEMO_ACCOUNTS below too.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER


# Keep this synced with y/tools/create-demo-accounts.js DEMO_ACCOUNTS
DEMO_ACCOUNTS = [
    {"email": "demo1@stu.fsm.edu.tr", "password": "EmpowerDemo2025!", "name": "Demo Account 1"},
    {"email": "demo2@stu.fsm.edu.tr", "password": "EmpowerDemo2025!", "name": "Demo Account 2"},
    {"email": "demo3@stu.fsm.edu.tr", "password": "EmpowerDemo2025!", "name": "Demo Account 3"},
]

APP_URL = "https://empower-vocabulary-practice.web.app"


# ---------- Shared styles -------------------------------------------------

base = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=base["Heading1"], fontName="Helvetica-Bold",
    fontSize=20, leading=24, spaceBefore=4, spaceAfter=10, textColor=colors.HexColor("#0f172a"))
H2 = ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold",
    fontSize=14, leading=18, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#1e293b"))
H3 = ParagraphStyle("H3", parent=base["Heading3"], fontName="Helvetica-Bold",
    fontSize=11, leading=14, spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#334155"))
BODY = ParagraphStyle("Body", parent=base["BodyText"], fontName="Helvetica",
    fontSize=10, leading=14, spaceAfter=6, alignment=TA_LEFT, textColor=colors.HexColor("#1f2937"))
BULLET = ParagraphStyle("Bullet", parent=BODY, leftIndent=14, bulletIndent=2, spaceAfter=3)
CODE = ParagraphStyle("Code", parent=base["Code"], fontName="Courier",
    fontSize=9, leading=12, leftIndent=10, rightIndent=10, spaceBefore=4, spaceAfter=8,
    textColor=colors.HexColor("#0f172a"), backColor=colors.HexColor("#f1f5f9"),
    borderColor=colors.HexColor("#cbd5e1"), borderWidth=0.5, borderPadding=6)
NOTE = ParagraphStyle("Note", parent=BODY, fontName="Helvetica-Oblique",
    fontSize=9.5, leading=13, leftIndent=14, rightIndent=14, spaceBefore=4, spaceAfter=10,
    textColor=colors.HexColor("#475569"), backColor=colors.HexColor("#fff7ed"),
    borderColor=colors.HexColor("#fed7aa"), borderWidth=0.5, borderPadding=6)
TITLE_PAGE = ParagraphStyle("TitlePage", parent=H1, fontSize=28, leading=32, spaceAfter=16, alignment=TA_LEFT)
SUBTITLE_PAGE = ParagraphStyle("SubtitlePage", parent=BODY, fontSize=12, leading=16,
    textColor=colors.HexColor("#475569"), spaceAfter=20)
CRED_VALUE = ParagraphStyle("CredValue", parent=BODY, fontName="Courier-Bold",
    fontSize=12, leading=16, textColor=colors.HexColor("#0f172a"))


def p(text, style=BODY): return Paragraph(text, style)
def bullets(items): return [Paragraph(f"&bull;&nbsp; {x}", BULLET) for x in items]
def code(text):
    safe = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>"))
    return Paragraph(safe, CODE)


def table(data, col_widths=None, header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("FONT", (0,0), (-1,-1), "Helvetica", 9),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LINEBELOW", (0,0), (-1,0), 0.75, colors.HexColor("#cbd5e1")),
        ("LINEBELOW", (0,1), (-1,-1), 0.25, colors.HexColor("#e2e8f0")),
    ]
    if header:
        style.append(("FONT", (0,0), (-1,0), "Helvetica-Bold", 9))
        style.append(("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f1f5f9")))
    for r in range(2, len(data), 2):
        style.append(("BACKGROUND", (0,r), (-1,r), colors.HexColor("#fafafa")))
    t.setStyle(TableStyle(style))
    return t


def make_doc(filename, title):
    return SimpleDocTemplate(filename, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
        title=title, author="Empower Vocabulary")


# ==========================================================================
# DEMO-CREDENTIALS.pdf
# ==========================================================================

def build_credentials(out_path):
    doc = make_doc(out_path, "Empower Vocabulary — Demo Credentials")
    story = [
        Paragraph("Demo Account Credentials", TITLE_PAGE),
        Paragraph(
            "Three shared accounts for visitors who want to try the platform "
            "without registering. Share these credentials privately — they "
            "do not appear anywhere in the app's UI.",
            SUBTITLE_PAGE),

        Paragraph("How to use", H2),
        Paragraph(f'Go to <font face="Courier">{APP_URL}</font>, click <b>Sign In</b>, '
                  "enter one of the email + password pairs below, and click <b>Sign In</b>.",
                  BODY),

        Paragraph("Credentials", H2),
    ]

    # Render each credential as a clean card
    for acct in DEMO_ACCOUNTS:
        story.append(table([
            ["Account",   acct["name"]],
            ["Email",     Paragraph(f'<font face="Courier-Bold" size="12">{acct["email"]}</font>', BODY)],
            ["Password",  Paragraph(f'<font face="Courier-Bold" size="12">{acct["password"]}</font>', BODY)],
            ["URL",       Paragraph(f'<font face="Courier">{APP_URL}</font>', BODY)],
        ], col_widths=[3.0*cm, 13.5*cm], header=False))
        story.append(Spacer(1, 10))

    story += [
        Paragraph("What demo users can and cannot do", H2),
        table([
            ["Action", "Demo user"],
            ["Sign in and reach the student dashboard", "Yes"],
            ["Open the hub and browse all six skills", "Yes"],
            ["Play Vocabulary activities", "Yes — but score is NOT saved"],
            ["Read Reading exam texts and questions", "Yes (read-only)"],
            ["Listen to Listening exam audio", "Yes (read-only)"],
            ["Submit a Reading / Listening answer", "No — blocked"],
            ["Join a classroom session by code", "Yes — appears in roster"],
            ["Submit a classroom answer", "No — blocked"],
            ["See teacher assignments list", "Yes (read-only)"],
            ["Submit an assignment completion", "No — blocked"],
            ["Open the teacher dashboard", "No — blocked"],
            ["Be promoted to teacher", "No — permanent restriction"],
        ], col_widths=[10.5*cm, 6.0*cm]),

        Paragraph("Important", NOTE),
        p("These credentials are shared. Any progress one visitor makes appears to the next visitor "
          "who logs in to the same account. Demo accounts do not save sessions to the database, so "
          "this is mostly cosmetic — streaks reset on refresh."),

        Paragraph("Sharing checklist", H2),
        *bullets([
            "Do NOT email these credentials to anyone outside FSMVU.",
            "Do NOT put them in any public document or website.",
            "DO share them privately with prospective students, parents, visiting researchers, or "
            "anyone who needs a brief tour of the platform.",
            "Print this PDF if it is easier to hand over in person — but shred copies once obsolete.",
        ]),

        Paragraph("Rotating passwords", H2),
        p("To change the passwords for these accounts:"),
        *bullets([
            'Open <font face="Courier">E:\\vocab-trainer\\y\\tools\\create-demo-accounts.js</font>.',
            "Edit the password fields in the DEMO_ACCOUNTS list at the top of the file.",
            'Add <font face="Courier">rotate: true</font> to each entry whose password changed.',
            'Run <font face="Courier">node tools/create-demo-accounts.js</font> from the y folder.',
            "Edit DEMO_ACCOUNTS in build_pdfs.py to match, then run python build_pdfs.py to regenerate this PDF.",
        ]),

        Paragraph("Deleting demo accounts", H2),
        p("Go to Firebase Console → Authentication → Users → search for the demo email → delete. "
          "Also delete the matching Firestore <i>users/{uid}</i> doc. The accounts will then no longer work."),
    ]

    doc.build(story)


# ==========================================================================
# DEMO-ACCOUNT.pdf  (internal reference — kept for admin reading)
# ==========================================================================

def build_demo_reference(out_path):
    doc = make_doc(out_path, "Empower Vocabulary — Demo Account Reference")
    story = [
        Paragraph("Demo Account Reference", TITLE_PAGE),
        Paragraph("Internal documentation: how demo accounts work, who can use them, "
                  "and what they are not allowed to do.", SUBTITLE_PAGE),

        Paragraph("What is a demo account?", H2),
        p("A pre-created Firebase Auth account whose Firestore user doc carries "
          "<i>role: 'demo'</i>. Visitors log in via the normal Sign In form using shared "
          "credentials issued by admin. There is no public Demo button. "
          "From the visitor's perspective it looks exactly like signing in as a student, "
          "with a permanent orange banner reminding them they are in demo mode."),

        Paragraph("Who is it for?", H2),
        *bullets([
            "Prospective FSM students evaluating the platform before they have an @stu.fsm.edu.tr email.",
            "Parents or family members wanting to see what their student is using.",
            "Visiting researchers or guests from other institutions.",
            "You (admin) for quick QA without polluting analytics.",
        ]),

        Paragraph("Where the credentials live", H2),
        p("DEMO-CREDENTIALS.pdf — kept on disk at the project root. Share privately, never publicly."),

        Paragraph("What demo users can do", H2),
        table([
            ["Area", "Demo user"],
            ["Open the hub and any skill card", "Yes"],
            ["Play Vocabulary activities", "Yes — gameplay only, score not saved"],
            ["Open Reading exam, read text, see questions", "Yes (read-only)"],
            ["Open Listening exam, hear audio, see questions", "Yes (read-only)"],
            ["Submit a Reading or Listening answer", "No — Firestore rules block"],
            ["Join a classroom by code", "Yes — appears in roster"],
            ["Submit answers in classroom", "No — blocked"],
            ["See the list of teacher assignments", "Yes (read-only)"],
            ["Submit an assignment completion", "No — blocked"],
            ["Access the teacher dashboard", "No — blocked"],
            ["Be promoted to teacher", "No — permanent restriction"],
        ], col_widths=[10.5*cm, 6.0*cm]),

        PageBreak(),

        Paragraph("Security model", H2),
        p("The demo restrictions are enforced at two layers:"),

        Paragraph("Layer 1 — Firestore rules (server-side)", H3),
        *bullets([
            "Each demo account's user doc has <i>role: 'demo'</i>.",
            "Helper <i>isDemo()</i> reads that role.",
            "Every write rule that matters (sessions, assignmentCompletions, classroom answers, "
            "activityLogs) requires <i>canWriteAsRealUser()</i> — which excludes demo.",
            "Reads remain open the same way they are for real students — demo users see the same "
            "content but cannot interact with it.",
        ]),

        Paragraph("Layer 2 — Client-side guards (UX)", H3),
        *bullets([
            "On dashboard load, <i>window.isDemoUser</i> is set when the role is 'demo'.",
            "The orange banner is injected at the top of the page.",
            "<i>logSessionToFirestore()</i> short-circuits for demo users — no console errors.",
        ]),

        Paragraph("Abuse vectors and what stops them", H2),
        table([
            ["Vector", "Mitigation"],
            ["A demo user tries to submit answers / save progress",
             "Firestore rules reject. Client-side, the submit either short-circuits or fails silently."],
            ["A demo user tries to read other users' private data",
             "Same rules as students: only their own user doc, only their own sessions."],
            ["A demo user tries to open the teacher dashboard",
             "Client gate redirects to access-denied; even if bypassed, Firestore rules block queries."],
            ["A demo user is somehow promoted to teacher",
             "Cannot happen: rules block role:'teacher' writes when target email is @stu.fsm.edu.tr."],
            ["Credentials leaked publicly",
             "Rotate passwords via create-demo-accounts.js (see DEMO-CREDENTIALS.pdf)."],
            ["Lots of strangers using the same demo accounts",
             "Acceptable — they cannot affect real data. If concerned, rotate or delete the accounts."],
        ], col_widths=[7.0*cm, 9.6*cm]),

        Paragraph("How to disable demos if you ever need to", H2),
        p("Two levels, from softest to firmest:"),
        *bullets([
            "<b>Soft — rotate passwords.</b> Any unauthorised holders can no longer sign in.",
            "<b>Hard — delete the accounts.</b> Firebase Console → Authentication → Users → delete; "
            "and Firestore → users → delete each demo user doc.",
        ]),

        Paragraph("FAQ", H2),

        Paragraph('"Can I let a guest teacher try the teacher dashboard?"', H3),
        p("Not via demo. Demo role is locked to student-shape access. Create a real account with "
          "their email and promote it from the Students tab. Demote when the tour ends."),

        Paragraph('"Two visitors logged into the same demo account at the same time — is that OK?"', H3),
        p("Yes. Firebase Auth allows multiple concurrent sessions on the same account. The shared "
          "state is purely cosmetic since demos don't save sessions."),

        Paragraph('"How do I add a fourth demo account?"', H3),
        p('Open <font face="Courier">y/tools/create-demo-accounts.js</font>, add a new entry to the '
          "DEMO_ACCOUNTS list, run the script. Then update build_pdfs.py with the new entry and "
          "regenerate this PDF and DEMO-CREDENTIALS.pdf."),
    ]
    doc.build(story)


# ==========================================================================
# TEACHERS-GUIDE.pdf — standalone, short, plain English
# ==========================================================================

def build_teachers_guide(out_path):
    doc = make_doc(out_path, "Empower Vocabulary — Teachers' Guide")

    # Slightly larger body text for scan-friendly reading.
    BIG = ParagraphStyle("BigBody", parent=BODY, fontSize=11, leading=15)
    BIG_BULLET = ParagraphStyle("BigBullet", parent=BIG, leftIndent=14, bulletIndent=2, spaceAfter=4)

    def b(items):
        return [Paragraph(f"&bull;&nbsp; {x}", BIG_BULLET) for x in items]

    story = [
        Paragraph("Empower Vocabulary", TITLE_PAGE),
        Paragraph("Teachers' Guide — read once, keep handy.", SUBTITLE_PAGE),

        Paragraph("1. Signing in", H2),
        Paragraph(f'Go to <font face="Courier">{APP_URL}</font>. Click <b>Sign In</b>. '
                  'Use your <font face="Courier">@fsm.edu.tr</font> email and your password.',
                  BIG),
        Paragraph("If this is your first time after the recent update", NOTE),
        Paragraph(
            "You may briefly land on the student dashboard. That is normal — every account starts "
            "as a student. Tell Alireza once and your account will be switched to teacher. Then "
            "log out and log back in. After that you will always land on the teacher dashboard.",
            BIG),

        Paragraph("2. Helping a student who cannot log in", H2),
        Paragraph("Almost every student support question is one of these three. The fix is in front of you.", BIG),

        Paragraph('"I registered but it just shows a Verify your email message."', H3),
        Paragraph(
            "They did not click the verification link yet. Tell them: open their inbox, find the email "
            'from <font face="Courier">noreply@empower-vocabulary-practice.firebaseapp.com</font>, click '
            "the link inside, then return to the app and sign in. Tell them to check spam.",
            BIG),

        Paragraph('"I never got the verification email."', H3),
        Paragraph(
            "On the login page, have them type their email and password and click <b>Sign In</b>. "
            'The Verify panel appears with a <b>Resend email</b> button. Click it, enter the password '
            "again, and a new email is sent. They wait 1 minute and check inbox + spam.",
            BIG),

        Paragraph('"It says \'Only FSM email addresses can register\'."', H3),
        Paragraph(
            'They are trying to register with a personal email like Gmail. Only '
            '<font face="Courier">@fsm.edu.tr</font> and <font face="Courier">@stu.fsm.edu.tr</font> '
            "addresses work. If they need to try the app without an FSM email, give them one of the "
            "demo accounts (see section 4 below).",
            BIG),

        PageBreak(),

        Paragraph("3. What's new since the security update", H2),
        Paragraph("Three changes you should be aware of. None of them require you to do anything.", BIG),

        *b([
            "<b>Every new student must verify their email</b> before they can sign in. The link expires "
            "after a while — if a student waits too long, have them click <b>Resend email</b>.",
            "<b>You cannot read another student's answers</b> in classroom sessions. This is a deliberate "
            "anti-cheating change. You can still see scores, statistics, and progress — but raw answers "
            "are now private to each student (and to teachers viewing their own classroom).",
            "<b>Anyone trying to break in is blocked</b>. Direct URL access to the teacher dashboard, "
            "API-level role hacking, and registering with a non-FSM email all fail at the database "
            "level. You do not have to worry about misconfigurations on the student's side.",
        ]),

        Paragraph("4. Demo accounts", H2),
        Paragraph(
            "Three shared demo accounts exist for visitors who want to see the platform without "
            "registering. The credentials live with Alireza (in DEMO-CREDENTIALS.pdf). You do not "
            "normally hand them out yourself — Alireza does, on request.",
            BIG),
        Paragraph(
            'You may occasionally see "Demo Account 1", "Demo Account 2", or "Demo Account 3" appear '
            "in a classroom roster. That is a visitor exploring. They cannot submit answers and they "
            "do not affect your real student data. Ignore them.",
            BIG),

        Paragraph("5. When to contact Alireza", H2),
        Paragraph("Contact Alireza for any of these:", BIG),
        *b([
            "You logged in but landed on the student dashboard and you should be a teacher.",
            "A student cannot log in even after clicking the verification link.",
            "Someone is showing up as a teacher who should not be.",
            "A demo account credential needs to be rotated.",
            "Anything looks wrong, weird, or unexpected.",
        ]),
        Paragraph('Email: <font face="Courier">akabiriaslifar@fsm.edu.tr</font>', BIG),
        Paragraph("Important", NOTE),
        Paragraph(
            "Do not try to fix issues yourself in the Firebase Console. The security rules are strict "
            "on purpose — well-meaning manual edits can break logins for the whole class. Tell Alireza "
            "what you tried to do and what you saw on screen.",
            BIG),
    ]
    doc.build(story)


# ==========================================================================
# WALKTHROUGH.pdf — kept for admin/teacher/student instructions
# ==========================================================================

def build_walkthrough(out_path):
    doc = make_doc(out_path, "Empower Vocabulary — Walkthroughs")
    story = [
        Paragraph("Empower Vocabulary", TITLE_PAGE),
        Paragraph("Walkthroughs &mdash; Admin, Teachers, Students", SUBTITLE_PAGE),
        Spacer(1, 8),
        p("Three audiences in one document. Part A is for you (the admin). "
          "Parts B and C are copy-paste-ready emails to teachers and students."),
        PageBreak(),

        Paragraph("Part A &mdash; Admin / Owner Walkthrough", H1),

        Paragraph("A.1 What changed", H2),
        table([
            ["Area", "How it works now"],
            ["Email domain", "Enforced in Firestore rules + client. @fsm.edu.tr or @stu.fsm.edu.tr only."],
            ["Email verification", "Required for every real user. Demo accounts pre-verified by admin."],
            ["Demo accounts", "Three pre-created shared accounts. Credentials in DEMO-CREDENTIALS.pdf. No public button."],
            ["Teacher promotion", "Admin-only, via 👑 button in the teacher dashboard Students tab."],
            ["@stu.fsm.edu.tr promotion", "Permanently blocked. Cannot be promoted via UI or API."],
            ["Classroom answer privacy", "Only writer or teacher can read."],
            ["Password minimum", "8 chars."],
        ], col_widths=[4.5*cm, 12.0*cm]),

        Paragraph("A.2 Deployment", H2),
        p("From the project root:"),
        code("firebase deploy --only firestore:rules,hosting"),
        Paragraph("To create the demo accounts (one-time)", H3),
        *bullets([
            "Firebase Console → Project settings → Service accounts → Generate new private key.",
            'Save as <font face="Courier">E:\\vocab-trainer\\y\\tools\\.serviceAccount.json</font>.',
            'Run <font face="Courier">cd E:\\vocab-trainer\\y &amp;&amp; npm install firebase-admin</font>.',
            'Run <font face="Courier">node tools/create-demo-accounts.js</font>.',
            "Three demo accounts are now live. See DEMO-CREDENTIALS.pdf for what to share.",
        ]),

        Paragraph("A.3 Promoting a teacher", H2),
        *bullets([
            "Have the teacher register with their @fsm.edu.tr email and verify it.",
            "Have them sign in once. They land on the student dashboard (correct — every new account starts as student).",
            "Open the teacher dashboard as admin. Go to the Students tab.",
            "Find their row. Click the 👑 button. Confirm.",
            "Tell them to log out and log back in. They now land on the teacher dashboard.",
        ]),
        Paragraph("@stu.fsm.edu.tr accounts cannot be promoted", NOTE),
        p("The 👑 button does not appear for @stu.fsm.edu.tr rows, and the Firestore rules reject "
          "any role-change attempt for those addresses. This is intentional and permanent."),

        Paragraph("A.4 Demoting a teacher", H2),
        *bullets([
            "Admin tab → click the teacher's row to expand it → 👤 Demote to Student.",
        ]),

        Paragraph("A.5 Rotating demo passwords", H2),
        *bullets([
            'Edit DEMO_ACCOUNTS in <font face="Courier">y/tools/create-demo-accounts.js</font>.',
            'Add <font face="Courier">rotate: true</font> to entries whose password changed.',
            'Run the script. Then update DEMO_ACCOUNTS in <font face="Courier">build_pdfs.py</font> and re-run <font face="Courier">python build_pdfs.py</font>.',
        ]),

        PageBreak(),

        Paragraph("Part B &mdash; For Teachers", H1),
        p("Copy this into an email for your teaching staff."),
        Spacer(1, 8),

        Paragraph("How to use Empower Vocabulary", H2),
        Paragraph("1. Signing in", H3),
        p('Go to the app. Use your <font face="Courier">@fsm.edu.tr</font> email. '
          "If this is your first time logging in after the changes, you may be sent to the student dashboard. "
          "Tell Alireza once and your account will be promoted; log out and back in to land on the teacher dashboard."),

        Paragraph("2. New students registering", H3),
        p("Students register with their @stu.fsm.edu.tr email, click the verification link in their inbox, "
          'then sign in. If a student says "I can\'t log in", 99% of the time they didn\'t click the verification link.'),

        Paragraph("3. Demo accounts", H3),
        p("Three shared demo accounts exist for visitors. The credentials live in DEMO-CREDENTIALS.pdf "
          'with Alireza. Demo users appear as "Demo Account 1/2/3" in classroom rosters and cannot submit '
          "anything that is graded or saved. They’re for tours, not real classes."),

        Paragraph("4. Things you cannot do anymore", H3),
        *bullets([
            "You cannot read other students' classroom answers unless you're a teacher (you are, but the rule stops cheating between students).",
        ]),

        Paragraph("5. If something feels wrong", H3),
        p('Email Alireza: <font face="Courier">akabiriaslifar@fsm.edu.tr</font>. '
          "Don't try to fix anything yourself in the Firebase Console."),

        PageBreak(),

        Paragraph("Part C &mdash; For Students", H1),
        p("Copy this into an email or pin it where students can read it."),
        Spacer(1, 8),

        Paragraph("How to use Empower Vocabulary", H2),
        Paragraph("Step 1: Register", H3),
        p('Click the <b>Register</b> tab. Use your <font face="Courier">@stu.fsm.edu.tr</font> email. '
          "Fill in your name, class, module, and academic year. Click <b>Create Account</b>."),
        Paragraph("Step 2: Verify your email", H3),
        p('You will receive an email from <font face="Courier">noreply@empower-vocabulary-practice.firebaseapp.com</font>. '
          "Click the link in it. Check your spam folder if you don't see it after 1 minute."),
        Paragraph("Step 3: Sign in", H3),
        p("Click <b>Sign In</b> on the app. Enter your email and password. You will reach your dashboard."),

        Paragraph("Common problems", H2),
        table([
            ["Problem", "Fix"],
            ['"Please verify your email" after clicking the link',
             "Click the link a second time. Go back to the app and sign in."],
            ['"I never got the verification email."',
             'Type your email and password on the login page, then click <b>Resend email</b>. '
             "Wait 1 minute and check inbox and spam."],
            ['"It says \'Only FSM email addresses can register\'."',
             'Use <font face="Courier">@fsm.edu.tr</font> or <font face="Courier">@stu.fsm.edu.tr</font>. '
             "Personal Gmail, Hotmail, etc. don't work."],
        ], col_widths=[5.5*cm, 11.2*cm]),
    ]
    doc.build(story)


# ==========================================================================
# Main
# ==========================================================================

if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    creds    = os.path.join(here, "DEMO-CREDENTIALS.pdf")
    ref      = os.path.join(here, "DEMO-ACCOUNT.pdf")
    teachers = os.path.join(here, "TEACHERS-GUIDE.pdf")
    walk     = os.path.join(here, "WALKTHROUGH.pdf")
    build_credentials(creds)
    print(f"Wrote {creds}")
    build_demo_reference(ref)
    print(f"Wrote {ref}")
    build_teachers_guide(teachers)
    print(f"Wrote {teachers}")
    build_walkthrough(walk)
    print(f"Wrote {walk}")
