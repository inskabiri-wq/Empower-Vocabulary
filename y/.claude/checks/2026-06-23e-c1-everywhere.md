# 2026-06-23 - C1 level everywhere

Per the user: add C1 to EVERY place a level is picked, even though there is no
C1 content yet (0 vocab words, 0 grammar topics, 0 C1 exams). Empty C1 sections
are acceptable; the engines must NOT crash on an empty level.

## Where C1 was added
JS level arrays (added 'C1' after 'B2'):
- student/js/content-controls-student.js (VOCAB_LEVELS)
- student/js/skills/grammar-content.js (levels) -> grammar level pills
- student/js/skills/reading.js (levels) -> reading level tabs
- teacher/js/admin.js (LEVELS)
- teacher/js/content-controls.js (LEVEL_ORDER + VOCAB_LEVELS) and allLevels()
  now seeds VOCAB_LEVELS into the set so the C1 content tab actually shows
  (it was gated by content presence; vocab block renders, exam/grammar return '').
- teacher/js/overview-v2.js (LEVELS_ORDER)
- teacher/js/policy-course-admin.js (caLevels options)
- index/js/main.js (the two per-level stats buckets)
- functions/index.js + roster-import.js ALLOWED_LEVELS already had C1.

HTML / in-JS pickers (added a C1 option/pill/tab after B2):
- app.html (vocab select), classroom-teacher.html (level select),
  index.html (registration level), index/js/main.js (in-JS level select),
  student-dashboard.html (profile select, vocab pill, vocab native select,
  Learning Map level tab), teacher-dashboard.html (7 assignment-form level
  selects + 1 level filter).

## Deliberately NOT touched
- games.js levelOrder: that is DISTRACTOR-selection logic, not a picker, and
  dead for C1 (no C1 words). Left as-is.
- teacher-dashboard "level-name" cards (levelB2Count etc.): a READ-ONLY sessions
  stat grid, not a picker. Left as-is.
- tools/demos/*: dev-only, hosting-ignored.

## How "no crash on empty C1" is guaranteed
- Grammar: unitsAt/unitTopics use `(DATA.byLevel[level] || [])` -> empty map.
- Vocab: getFilteredWords/populateUnitSelector use `datasets[level] || []` ->
  empty pool + empty unit picker; startActivity shows the friendly no-words msg.

## Verification
- `node --check` clean on all 8 edited JS files.
- The bulk edit ran via an audited script that PRINTED a per-change count;
  counts matched the prior grep (teacher-dashboard 7 form selects + 1 filter,
  etc.).
- Caught + fixed a regex-overlap bug: the em-dash option regex also matched the
  hyphen "B2 - Advanced", double-adding C1 to the student-dashboard vocab select
  (lines 680-681). Collapsed to one. Re-scanned ALL edited HTML for consecutive
  duplicate C1 options: none remain.
- No em dashes introduced (the one reading.js hit is a pre-existing comment).
- REAL-browser smoke (preview static-y, throwaway _c1_harness.html, deleted):
  grammar levels = [A2,B1,B1+,B2,C1]; the C1 pill renders; clicking it -> NO
  crash, no JS errors, empty map (0 units), game picker still shows. PASS.

## Cache versions bumped
- grammar-content.js v10 -> v11 (5 refs), content-controls.js v6 -> v7,
  content-controls-student.js v5 -> v6, policy-course-admin.js v10 -> v11.
- Unversioned changed JS (reading.js, admin.js, overview-v2.js, main.js) ride
  the service-worker bump: CACHE_VERSION v65 -> v66. HTML is network-first.

## Not done
- No deploy. No push. No C1 CONTENT was created (intentional) - C1 vocab/grammar/
  exams light up automatically the moment that content is added.
