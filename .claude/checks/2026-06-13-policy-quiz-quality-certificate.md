# 2026-06-13 — Policy course: quiz quality + final exam + certificate

Teacher feedback addressed:
1. "some questions are stupidly or funnily easy or unrelated"
2. "the longer answer is always the correct one"
3. "make sure the final quiz is not the minor quiz repeated ones"
4. "some miss alignments for the certificate"
5. Add three signatories.

## What changed

**`y/student/js/policy-course-content.js`**
- Rewrote all four module quiz arrays (6 / 5 / 6 / 5 questions) and the final exam.
  Removed the jokey / unrelated distractors; every wrong option is now a plausible,
  on-topic misreading of the rule.
- **Answer-length tell removed.** Distractors were lengthened in 14 questions so the
  correct answer is no longer the conspicuously longest. Measured: the correct answer
  is now the single longest option in **8 / 32 (25%)** — i.e. chance level — down from
  ~100%. No question has a length gap >= 10 chars between the correct answer and the
  next-longest distractor. (Display order is also shuffled at render time, so neither
  length nor position is a tell.)
- **Final exam is now distinct from the module quizzes.** It is 10 scenario /
  application questions (Maria's edited AI sentences, opening AI in a timed exam,
  responsibility for a factual error, AI-supplied outline, group recording, deleted
  chat, human-in-control, why declaring = transparency, second-violation outcome,
  spirit-of-the-guidelines). Verified: **0** final-exam question stems duplicate any
  module-quiz stem.
- Added an alignment note to Module 1 Lesson 1 (EN + TR): the guidelines follow the
  UNESCO Recommendation on the Ethics of AI and the EU AI Act (transparency, human
  oversight, accountability).

**Certificate — 3 signatories**
- `certificate.signatories` (replaces single `signName`/`signTitle`):
  - Koray TUNÇ — Head of Department / Bölüm Başkanı
  - Zeynep Bilgehan CAN — Assistant Head of Department · Academic / Bölüm Başkan Yardımcısı · Akademik
  - Derya ÖZDEMİR — Program Coordinator / Program Koordinatörü
- `policy-course.html`: cert bottom = centered seal, then `#pcCertSignRow`, then a
  single centered meta line (ID · Date · Final score).
- `policy-course.js` `renderCertificate()` builds one signature column per signatory
  (line + name + bilingual title); falls back to legacy fields if absent.
- `policy-course.css`: `.pc-cert-bottom` column layout; `.pc-cert-signrow` 3-column
  flex (each `.pc-cert-sig` max-width 30%, gap 5% -> 100%, no overflow); mobile
  overrides at <=560px.

## Cache / version bumps
- `policy-course-content.js` ?v=4 -> **v5** (courses.html, policy-course.html, teacher-dashboard.html, student-dashboard.html)
- `policy-course.js` ?v=4 -> **v5** (policy-course.html)
- `policy-course.css` ?v=3 -> **v4** (policy-course.html)  *(courses.html still ?v=3 — it does not render the certificate; harmless)*
- `service-worker.js` CACHE_VERSION v38 -> **v39**

## Verification
- `node --check` on policy-course-content.js and policy-course.js — pass.
- Content lint over all 32 questions: 0 structural problems; every question has the
  bilingual stem + exactly 4 options, each with EN + TR; no duplicate options
  (EN or TR); answer index in range.
- Em-dash scan of the content: **none**.
- correct = single-longest option: 8/32 (25%).
- final-vs-module stem overlap: 0.
- Certificate JS<->CSS class names aligned (`pc-cert-signrow`, `pc-cert-sig`,
  `-line`/`-name`/`-title`, `pc-cert-bottom`).

## Signatures as handwriting (follow-up)
- Each signatory name now renders in the Great Vibes script as a signature
  sitting on the line, with the printed name + bilingual title beneath.
- `policy-course.js` renderCertificate adds `.pc-cert-sig-script`.
- `policy-course.css`: `.pc-cert-sig-script` (Great Vibes, `white-space:nowrap`),
  signrow switched `align-items: flex-end` -> `flex-start` so the three lines
  stay aligned regardless of how the printed name/title wrap.
- Verified via a throwaway harness loading the real CSS: signature lines aligned
  at desktop (`[460,460,460]`) and phone (`[199,199,199]`), no overflow.

## Certificate fact-check (name + code)
Teacher feedback: "set up the rule so that i would check name and code to fact check."
- **Issuance** (`policy-course.js` passTest): when a final exam is passed, in
  addition to `courseProgress/{uid}.certificate`, writes a verification record
  `certificates/{certId}` = { certId, uid, name, courseId, courseName, score,
  total, earnedAt }. Non-fatal if it fails (cert still works from courseProgress).
- **Firestore rule** (`firestore.rules`): new `match /certificates/{certId}` —
  read by any signed-in user; create only by the owner (uid match, certId ==
  doc id); update denied (immutable); delete admin-only.
- **Teacher UI** (`teacher-dashboard.html` Courses tab + `policy-course-admin.js`):
  a "Fact-check a certificate" panel — name + code inputs + Check. Looks up
  `certificates/{code}` (case-insensitive code), falls back to scanning
  courseProgress for legacy/pre-existing certs. Name compare is Turkish-aware
  (trim + collapse spaces + locale lower). Three outcomes: ✓ genuine (shows
  name/course/date/score), ⚠ code real but name differs (shows the on-record
  name), ✗ code not found.
- Verified: node --check both JS; rules braces balanced + block present;
  name-normalise unit tests pass (incl. Turkish İ/I, Ç/Ö); end-to-end harness
  with a stubbed db produced all four expected result states.
- Cache bumps: policy-course.js v5 -> **v6**, policy-course-admin.js v4 -> **v5**,
  service-worker v39 -> **v40**.

## Fourth signatory (follow-up)
- Added Alireza KABIRI · EdTech and AI Coordinator (tr: Eğitim Teknolojileri ve
  Yapay Zekâ Koordinatörü) to `certificate.signatories` (now 4).
- CSS: signrow now fits 4 columns (`.pc-cert-sig` max-width 30% -> 23%, gap 5% ->
  4%, script font clamp lowered to 12-16px so the longest names fit one line).
  Phone (<=560px) wraps to a 2 x 2 grid (`flex-wrap: wrap`, sig max-width 46%,
  script 13px).
- Verified via harness: desktop 4 lines aligned (447px) no overflow; phone 2x2,
  both rows aligned (198/198, 266/266) no overflow.
- Cache bumps: policy-course-content.js v5 -> **v6**, policy-course.css v4 ->
  **v5**, service-worker v40 -> **v41**.

## Intro video + completion charts (follow-up)
- **Video**: added `video: 'https://www.youtube.com/watch?v=8GrXXnSIEmQ'` to Module 1
  Lesson 1. The renderer already supports a per-lesson `video` field and auto-embeds
  the YouTube player (verified the embed regex -> youtube.com/embed/8GrXXnSIEmQ).
- **Charts** (teacher Courses tab): new "📊 Charts" button toggles `#pcChartsBox`.
  `loadCharts()` in policy-course-admin.js reads courseProgress once and renders, in
  pure CSS (no chart lib, matching the dashboard): 4 metric cards (cohort/started/
  certified/avg final), a masked conic donut (certified / in progress / not started),
  per-stage pass-rate bars (4 modules + final), and a final-score histogram.
- Verified via a stubbed-db harness: with 10 roster / 6 started / 3 certified the panel
  showed Started 60%, Certified 30%, Avg 7.8/10, donut present, 5 stage bars, 11 score
  buckets, all values correct.
- Cache bumps: policy-course-content.js v6 -> **v7**, policy-course-admin.js v5 -> **v6**,
  service-worker v41 -> **v42**.
- **REVERTED next turn at user request:** the in-app completion charts (📊 Charts button,
  `#pcChartsBox`, `loadCharts`/`pct`, init wiring) were removed from teacher-dashboard.html
  and policy-course-admin.js. The video stays. admin js -> **v7**, service-worker -> **v43**.
  The Firebase reads chart lives only as a standalone file:
  `E:\tmp\firebase-load-400-students.html` (shown on the phrase "reads chart" — see memory).

## Scale note (400 concurrent students)
- Lessons/quizzes ship in the static `policy-course-content.js` (served by Hosting CDN,
  cached by the service worker) — NOT Firestore. 400 readers = CDN load, trivial.
- Each student reads only 3 small docs (settings/policyCourse, own users doc, own
  courseProgress) and writes only their OWN courseProgress + certificates doc — no
  shared hot document, so no per-doc write contention.
- Firestore handles this comfortably on Blaze. No bottleneck for 400 concurrent.

## Not done (by policy)
- No deploy. The fact-check needs BOTH `firebase deploy --only hosting` AND
  `firebase deploy --only firestore:rules` (the new /certificates rule). The video +
  charts are hosting-only.
- No GitHub push (push only when the user explicitly says "push").
