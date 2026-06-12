# Grammar practice wired into the teacher dashboard · 2026-06-09

The "nothing is wired" fix: grammar practice now flows into EVERY teacher view,
because it writes to the same `sessions` collection vocab/exams use.

## Student side (grammar.js v9->v10)
- Per-question capture: each game pushes { q, picked, correct, ok } to state.answers
  (choice / fill / unscramble).
- On the result screen, logGrammarAttempt() writes a `sessions` doc:
  { userId, userName, activity: 'grammar-choice'|'grammar-fill'|'grammar-unscramble',
    skill:'grammar', level, unit, score, total, percentage, correctAnswers,
    totalQuestions, grammarDetails:[per-question], assignmentId, ...studentScopeFields,
    createdAt }.
  - Guarded: real (non-demo) users only (window.isDemoUser), wrapped in try/catch so a
    write failure can NEVER break the game.
  - Reuses studentScopeFields() so scoped teachers see it (studentClass/level/module).
- Rules: the existing /sessions create rule already allows this (canWriteAsRealUser +
  userId==uid + percentage 0..100). NO rules change, NO new collection.

## Teacher side (classification + labels)
- teacher/js/skills/index.js ACTIVITY_TO_SKILL: grammar-choice/-fill/-unscramble -> 'grammar'
  so the skill pill "Grammar" filters them in.
- teacher/js/activity.js: SKILL_ACTIVITY_OPTIONS.grammar now lists the 3 games (dropdown),
  + activityIcons / activityNames entries -> friendly labels in the Recent Activity list.
- teacher/js/overview-v2.js: ACTIVITY_META + ACTIVITY_VERB entries -> grammar shows in
  "Activity Popularity" (amber bars) and the dashboard "Recent Activity" feed
  ("practised Grammar · Multiple Choice").

So once a student plays a grammar game: it appears in the Grammar tab (no more "No
activity found"), the dashboard Recent Activity, Activity Popularity, Total Sessions,
the student drill-down, and the alerts - all automatically.

## Cache
- grammar.js v9->v10, service-worker.js v20->v21 (busts the teacher JS, which loads
  without a ?v= query).

## Verify
- node --check: grammar.js, activity.js, skills/index.js, overview-v2.js all OK.
- grammar.js writes to 'sessions' (not the old grammarAttempts), activity='grammar-<game>',
  grammarDetails present, isDemoUser guard present.
- index ACTIVITY_TO_SKILL + activity dropdown grammar options present.

## Deploy
- firebase deploy --only hosting, reopen (SW -> v21). Have a student play a grammar game,
  then check Activity tab -> Grammar.

## Still open (raised by user, not yet built)
- A teacher DRILL-DOWN that shows the per-question grammarDetails (the data is captured;
  surfacing "which items were missed" is a follow-up view).
- A unified, searchable selection component reused across the teacher dash (topics /
  students / classes) - proposed to the user.
- Vocab->grammar feature parity items (more game types, etc.) - pending user priority.
