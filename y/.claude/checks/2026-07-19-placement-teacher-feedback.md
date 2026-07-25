# 2026-07-19 - Placement: teacher feedback round (5 items)

## 1. "Where are the questions from? Do not create any - delete created ones"
Audited placement.js: there are NO hand-written or AI-generated questions to
delete. Grammar comes verbatim from GRAMMAR_PRACTICE (the sanity-gated bank,
levels A2/B1/B1+/B2 - the bank has no A1) and vocabulary verbatim from
datasets.json (word/def/example, 951/634/603/462 words per level). Tightened
anyway:
- vocabQs: REMOVED the cross-level fallback (a rung can no longer silently mix
  other levels) and distractors now prefer the same part of speech at the same
  level, mirroring the Multiple Choice game's pool logic.
- Ladder stays A2 > B1 > B1+ > B2 (the app's levels; no A1 content exists).
- Admin panel hint now states the sources explicitly.

## 2. Language score screen must match the reading part's UI
New #plScore screen reuses the reading exam's OWN result classes
(rd-result-total / rd-result-row / rd-pct-* from reading-exam.css, --rd-* vars
mirrored on #plScore): big colored total, %, then one row per level with a pct
chip. Same on the final #plDone screen (GR/VO/RD/LI rows + WR "sent to your
teacher" row) instead of the old text line.

## 3. Listening had two Exit buttons stacked top-left
The exam's own .exam-back-btn overlapped the fixed placement Exit button.
Placement CSS hides #listeningExamScreen .exam-back-btn (it navigated to a
dashboard-only screen anyway - dead in placement).

## 4. Post-submit "everything got smaller"
submitListeningExam() adds drawer-open, and extra.css pads the whole screen
right by min(480px,92vw) for the transcript drawer - which placement hides, so
the layout just shrank for nothing. Placement CSS now zeroes that padding;
verified width identical pre/post submit (1265px -> 1265px), transcript still
hidden.

## 5. Writing result was a raw gibberish popup
placement-admin.js: the Read button is replaced by a per-row Details modal
(reading-style score list: per-level rows + reading + listening + overall +
recommended badge) with the essay in a serif reader box, plus:
- mode 'ai': "Open in Writing AI" writes localStorage llwPrefill and opens
  lingualab-write; corrector.js consumePrefill() (new) loads essay + prompt
  into the form one-shot.
- mode 'manual' (and ai too): teacher comment + optional /100 score saved to
  placementResults.{uid}.writingReview.
- firestore.rules: placementResults update was `false`; now teachers may
  update ONLY writingReview (diff().affectedKeys().hasOnly) - students still
  can never touch a finished attempt.

## 6. Teachers see placement REPORTS only (user's decision)
The Placement tab is now visible to every teacher: admin + placementAccess
grantees keep the full manage view; other teachers get a read-only reports
view filtered to their assignedClasses (no config, no reset; Details + review
allowed). Dead accessBlock() grant UI removed (grants live in Admin > Access).

## Files
placement.html (CSS fixes + #plScore + vars), student/js/placement.js ?v=5,
teacher/js/placement-admin.js ?v=5, lingualab-write/js/corrector.js ?v=7,
teacher-dashboard.html (comment), firestore.rules, SW v106 -> v107.

## Verification
- node --check x3 OK; em-dash scan of changed files clean (firestore.rules
  hits are pre-existing lines); bump.js --check consistent.
- Browser E2E on static-y (real pages, stubbed auth/db): full student run -
  46 ladder Qs, rd-styled score screen (computed surface/radius/colors),
  real reading submit + Continue, listening ONE exit btn (computed
  display:none on back btn), post-submit width unchanged, writing 34w,
  done screen 5 rd rows, staff preview wrote nothing.
- Teacher harness (temp, deleted): plain teacher -> tab revealed, only 11-A
  results, 0 Reset; granted -> full config, 2 results, 2 Reset. Details modal:
  rows + essay + AI chip; AI button -> llwPrefill written + corrector opened;
  Save review -> update {writingReview} only. Corrector consumed prefill and
  cleared the key.

## Ship
firebase deploy --only hosting AND --only firestore:rules (the review save
FAILS without the rules deploy). Then one hard refresh for SW v107.
