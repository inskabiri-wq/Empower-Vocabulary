# Policy mini course (onboarding + certificate) · 2026-06-10

User decisions: separate from the app, ACTIVATED from the teacher dash
(Coursera-style limitations); quiz per module + final exam; wrong-answer
limit (more than 2 wrong = fail; 1st fail = restudy; 2nd fail = 48h ban);
bilingual EN + TR. Content data arrives later; placeholder content marks
every text with SAMPLE/PLACEHOLDER.

## Files
- y/student/js/policy-course-content.js (?v=1): window.POLICY_COURSE.
  Bilingual schema {en,tr} for every text; modules[] (lessons + quiz),
  finalExam.questions, certificate texts, config {maxWrong:2, banHours:48}.
- y/policy-course.html: standalone student page (Firebase 10.7.1 compat,
  auth redirect to index.html). Views: loading / inactive / overview
  (module map + progress bar) / lesson reader (step x of y) / quiz
  (mistakes-left counter) / result / certificate.
- y/student/js/policy-course.js (?v=1): controller.
  - Modules unlock in order; final exam unlocks when all modules passed.
  - Fail = wrong > maxWrong. 1st fail -> restudy flag (must click through
    the module lessons again; for the final: a review-all flow over every
    lesson). 2nd+ fail -> ban = lastFailAt (SERVER timestamp) + banHours;
    countdown shown; client clock cannot shorten it.
  - Pass final -> certificate {certId EL-XXXXXX-base36, earnedAt, name,
    score} written once.
  - Leaving a quiz mid-way does not count as a fail.
  - EN/TR toggle re-renders any open view; choice persisted.
- y/student/css/policy-course.css (?v=1): dark Empower look + printable
  certificate (gold double border, FSMVU seal /fsmvu-seal.png, print css
  hides everything else).
- y/student/js/policy-course-card.js (?v=1) + #policyCourseBox in the
  student hub rail: card appears ONLY when settings/policyCourse.active
  and the student's class is in scope; shows progress or certificate id.
- y/teacher/js/policy-course-admin.js (?v=1) + #policyCoursePanel at the
  top of the teacher Assignments tab: status pill, Activate (scope picker:
  all classes or tick specific classes from allStudents), Deactivate,
  View completions (courseProgress query on click only: name, class,
  modules x/y, final score, certificate id/date, status incl. banned).
- firestore.rules:
  - settings/policyCourse: read isAuth, write isTeacher (additive grant
    over the admin-only /settings rule).
  - courseProgress/{studentId}: create/update owner-only +
    canWriteAsRealUser + userId stamp; read owner/admin/teacherHasScope;
    delete admin.

## Verification
- node --check on all 4 new JS files: OK.
- Content lint: bilingual completeness, 4 options, valid answer index,
  0 problems, 0 em-dashes. Placeholder warning: m2 quiz has only 2
  questions so it cannot be failed (real data needs >= 4 Q per quiz).
- ID cross-check: all 34 ids the controller references exist in
  policy-course.html; card + admin ids all present in their pages.
- NOT verified live (needs Firebase login): full flow on the deployed app.

## Deploy
- firebase deploy --only firestore:rules,hosting (rules changed!).

## Real content loaded (same day)
- Source: official FSM "AI Use Guidelines for Students" bilingual handbook
  (fsm.edu.tr PDF, 7 pages; EN pages 1-3, TR pages 4-7). Turkish lesson
  texts use the handbook's OWN Turkish version, not a translation.
- Course id ai-guidelines-v1: 4 modules, 10 lessons, 22 module-quiz
  questions + 10 final-exam questions (all 4-option, bilingual):
  M1 Purpose + coursework rules 1-8 (6 Q) · M2 The 8 AI Promises (5 Q) ·
  M3 Quick Answers + Group Work (6 Q) · M4 Consequences ladder (5 Q).
- Certificate: "AI Use Guidelines for Students" / TR official title.
- Fixed source typos (intelligenStuce, "receive assistance it with");
  replaced the handbook's em dashes per the project ban.
- Lint: 0 problems, bilingual complete, no duplicate options, all tests
  failable (every quiz > maxWrong questions), 0 em dashes.
- Cache: policy-course-content.js ?v=2 in policy-course.html,
  student-dashboard.html, teacher-dashboard.html.
- Options are authored with answer at index 0 but the controller
  reshuffles options on every render, so display order is random.

## Courses tab + targeting modal + hub tile (user follow-up)
- Teacher dashboard: new "Courses" item in the t2 sidebar + legacy tab nav
  (#tab-courses; switchTab is generic, TAB_HEADERS got a courses entry).
  The AI Use Guidelines panel moved out of the Assignments tab into it;
  one course card per future course.
- Activate now opens an assignment-style modal (#courseActivateModal):
  Target = Everyone / Specific classes / Entire level / Entire module /
  Academic year, with checkbox cards (classes + years from allStudents,
  levels A2-B2, modules 1-4). Saved to settings/policyCourse as
  { active, targetType, targets[], classes[legacy mirror] }.
- NEW shared check student/js/course-target.js (courseActiveFor) used by
  policy-course.js (v2), policy-course-card.js (v2) and courses.html.
  13/13 unit tests pass incl. legacy classes[] docs.
- Student hub: "Courses" tile (8th tile, CERT pill, hub.js v3) ->
  courses.html catalog page (new): lists courses with state
  (locked / open / x of y modules / certified) + Continue/Start buttons.
  Registry in courses.html holds one entry per course for the future.
- Verified: node --check on 5 JS files, all 10 admin ids present, exactly
  one #tab-courses, 2 nav buttons, old panel fully removed from the
  Assignments tab, courses.html ids present.
- Cache: hub.js?v=3, policy-course.js?v=2, policy-course-card.js?v=2,
  policy-course-admin.js?v=2, course-target.js?v=1.

## Round 3 (user follow-ups, 2026-06-11)
1. COMBINABLE activation scope: the modal is now four tick sections
   (Classes + Levels + Modules + Academic years) that combine with AND
   across sections, OR within one; empty section = no restriction; all
   empty = everyone. Live summary line. Saved as settings/policyCourse
   { active, scope:{classes,levels,modules,years} }; legacy fields
   deleted on save; course-target.js v2 honours scope + both legacy
   shapes (12/12 unit tests).
2. NAMES NOT LOADING fixed: config.js declares `let allStudents` (bare
   global, NOT on window). The admin panel now reads it via typeof.
   Levels/modules/years prefer roster values, fall back to static lists.
3. Rail course card DELETED (duplicate of the hub Courses tile):
   #policyCourseBox + policy-course-card.js removed.
4. Race Questions select: no more cross-listing. openRaceSetup rebuilds
   the options to the entry card's base + "Both, mixed" only (Vocab Race
   never offers pure Grammar and vice versa).
5. Feature Activation panel (Admin tab): per-organization switches for
   all 8 hub tiles (settings/featureToggles, admin-only writes).
   Deactivated tiles stay visible: grayed, OFF pill, "Not activated"
   subtitle, click shows a dialog. NOTHING deleted, progress kept.
   New: teacher/js/feature-activation.js, student/js/feature-toggles.js,
   hub.js v4 (is-off render + feature-toggles-ready re-render),
   hub.css v14.
6. Lesson media: lessons may now carry image ('url' or {url, caption}),
   video (YouTube watch/share/shorts links auto-embed; other URLs become
   a "Watch the video" link), and link {url, label}. policy-course.js v3
   + css v2 (16:9 embed, styled figures/links).
- Verified: node --check on 6 files; 12/12 scope tests; YouTube regex
  (watch/youtu.be/shorts + mp4 fallback); modal ids present; old
  targetType ids gone; rail card gone; race static grammar option gone.

## Round 4 (user screenshots, 2026-06-11)
- Feature Activation panel MOVED to the BOTTOM of the Admin tab (after
  #teachersList) and RESTYLED with the admin v2 (t2) tokens: surface
  cards, soft borders, 12px radius, av-pill style toggle buttons, muted
  12px subtitle. Matches the stat cards above it. feature-activation.js
  v2.
- "Why does the Courses tab show the Overview greeting + New Assignment
  button?": stale cache. overview-v2.js has no ?v param; the user's
  browser had the pre-courses version cached, so renderHeaderForTab fell
  back to the overview header. The TAB_HEADERS.courses entry IS in the
  file (verified). SW bumped v35 -> v36 to force-refresh all non-?v
  statics on the next deploy; one reload after deploy shows the proper
  '🎓 Courses' header with NO New Assignment button.
