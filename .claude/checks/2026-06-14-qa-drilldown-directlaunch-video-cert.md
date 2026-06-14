# 2026-06-14 — QA report items: answer drill-down, direct launch, video, certificate

## #5 Money Heist copy (done)
classroom-teacher.html + classroom-heist-teacher.html: "vocab questions" -> "vocabulary
and grammar questions"; "Correct vocab answer" -> "Correct answer". (HTML, network-first.)

## #4 Teacher answer drill-down (Grammar / Reading / Listening)
Teachers could only see a score %, not which items a student missed.
- **Capture** (all three already compute per-item right/wrong; we now persist it as a
  uniform array `{ skill, items:[{q,a,correct,ok}] }`):
  - Grammar -> `markAssignmentCompleted(id, 100, detail)` writes `answers` onto the
    `assignmentCompletions` doc (student-assignments.js + skills/grammar.js).
  - Reading -> `answers` added to the `sessions` write (reading-exam.js, flattened from
    computeScore's passages/sections/items).
  - Listening -> `answers` added to the `sessions` write (listening-exam.js, collected
    in the submit loop).
- **Rules**: none needed. The `sessions` and `assignmentCompletions` rules only validate
  `percentage`/`bestScore` ranges (no field whitelist), and teachers already have read
  scope. The new field rides existing reads/writes.
- **Teacher view** (teacher/js/student-detail.js): in the per-student drill-down modal,
  any assignment row (grammar) or recent-session row (reading/listening) that has
  itemised answers becomes clickable ("🔍 answers") and toggles an inline panel listing
  each question, the student's answer, ✓/✗, and the correct answer for wrong ones.
  Inline (no nested modal); uses in-memory data already loaded.

## Direct launch from an assignment (reading/listening) + grammar/vocab check
- Grammar (`startGrammarAssignment` -> assigned level/topics) and Vocab (sets
  book/level/unit/activity then startActivity) ALREADY open the assigned content.
- Reading/Listening used to dump the student on the skill home. Now, after landing on
  the home (safe fallback, back-nav tracked), if the assignment carries `examId` we
  deep-link straight in: `window.openReadingExam(level, examId, 'untimed')` /
  `window.startListeningExam(examId)`. Falls back to the home if the exam id isn't found.

## Video blocked ("This content is blocked")
That message = the YouTube embed refused by tracking-prevention / a privacy or ad
extension / a network firewall (e.g. school network blocking YouTube). Mitigations
(policy-course.js):
- Embed via `youtube-nocookie.com` (privacy-enhanced; less often blocked) + add
  `referrerpolicy`.
- Always render a "Video not loading? Watch on YouTube" fallback link under the player,
  so a blocked embed never leaves the student stuck.
If still blocked, it is the viewer's browser/network blocking YouTube, not our code.

## Certificate signatures alignment
Titles wrapped to different line counts (1 vs 2 lines) making columns look uneven.
policy-course.css: reserved equal height on `.pc-cert-sig-name` (1 line) and
`.pc-cert-sig-title` (min-height 2.6em) so all four columns are the same height.

### Follow-up: titles overflowed the frame (clipping)
With 4 signatures + two-line titles, content exceeded the FIXED A4-ratio height
(`.pc-cert` aspect-ratio 297/210 with `.pc-cert-frame`/`.pc-cert-inner` at `height:100%`),
so titles + the "Academic" wrap spilled below the frame onto the dark page.
Fix: `.pc-cert-frame` and `.pc-cert-inner` `height:100%` -> `min-height:100%`, so the
sheet keeps the A4 ratio when content fits but GROWS taller when it doesn't, instead of
clipping. Verified in a faithful harness (real classes + CSS + content) at 1200/600/390px:
- 1200px: cert == A4 height (707), content fits (inner 524/524), no overflow.
- 600px: cert GREW beyond A4 (473 > 399), no overflow, lines aligned.
- 390px: 2x2 rows aligned, no overflow; titles + meta inside the frame at all widths.
policy-course.css v6 -> **v7**; service-worker v45 -> **v46**.

## Firebase reads impact (asked)
NONE added. Capture writes one extra field on writes that already happen (docs grow by a
few KB). The drill-down reads that field from `sessions`/`assignmentCompletions` docs the
teacher dashboard ALREADY loads, and renders from in-memory data — zero new reads.
(Contrast: the deleted completion-charts feature DID add ~1 read per started student per
click; this rides existing reads.)

## Versions
- student-assignments.js v3 -> **v4**, skills/grammar.js v17 -> **v18**,
  policy-course.js v6 -> **v7**, policy-course.css v5 -> **v6**.
- reading-exam.js / listening-exam.js / student-detail.js have no `?v=` query -> busted
  by the service-worker bump.
- service-worker v44 -> **v45**.

## Verification — sanity + smoke
- **Sanity:** node --check passed on all 8 touched JS files; em-dash scan of touched
  files (one em-dash I had added in a code comment was removed; the rest are pre-existing
  comment em-dashes, none in user-facing text); policy-course content lint OK
  (4 modules, 4 signatories, M1L1 video present); answer-item shape consistent across
  producers and the teacher renderer ({q,a,correct,ok}).
- **Smoke:** loaded every changed student/teacher module in a stubbed-globals harness and
  confirmed top-level execution is clean (0 console errors) and the functions my changes
  depend on are exposed: startGrammarAssignment, openReadingExam, startListeningExam,
  POLICY_COURSE, startAssignment, markAssignmentCompleted — all true. (The harness first
  surfaced a TypeError that turned out to be an incomplete EXAM_REGISTRY stub, not a code
  bug; fixed the stub, re-ran clean.)
- Auth-gated SPA pages redirect to index without a login, so deeper interactive smoke
  (open the drill-down modal, render the cert, play the video) needs a real session.

## Not done / next
- No deploy; hosting-only this round (no rules change). No GitHub push.
- Reading/listening direct-launch depends on the assignment carrying a valid `examId`
  (exam-form stores it); assignments without one still open the skill home.
