# Grammar polish pass 2: feedback color, modal fixes, ESC, topics cards · 2026-06-10

User-reported (5 items with screenshots):

## 1. Feedback explanation text barely visible (game)
- grammar.css .gr-feedback had NO color property -> the explain text fell to a
  muted inherit. Added color: var(--text-primary). (v15)

## 2. Deadline field bleeding under the Save/Cancel bar (assignment modals)
- The sticky .modal-buttons used background: inherit + backdrop blur ->
  translucent, so the date input showed through half-cut below the buttons.
- replace_all on the shared style: now solid background: var(--bg-card,#152035)
  + border-top divider. Hits all 4 sticky footers (vocab/exam, grammar,
  writing, generic). The sticky-TOP h3 of Edit Student was NOT touched
  (different style string).

## 3. White bar (native widget) in the modal
- Interpretation: native select dropdown panel / date picker rendering in OS
  light mode (solid white). Fix: `:root { color-scheme: dark; }` in
  assignments.css -> all native widget chrome (open dropdown panels, date
  pickers, scrollbars) now renders dark. If the user meant a different
  element, next screenshot will show it.

## 4. Escape key closes pop-ups
- teacher-dashboard.html: small global keydown handler. On Escape, takes the
  LAST .modal-overlay.active and CLICKS its own Cancel/close button (keeps
  each modal's cleanup: body scroll, state). Fallback: remove .active.
- Assignment-safe: identical to the user clicking Cancel, no save path touched.

## 5. Grammar Topics picker styled like the student picker
- grammar-form.js populateGrammarTopics: rows wr-student-row -> the shared
  .student-checkbox-item cards (custom glowing checkbox, hover) inside
  .student-checkbox-items responsive grid per unit (max-height:none because
  the outer #grammarTopicsBox scrolls). grammarTopicsSelectAll + save logic
  untouched (same .grammar-topic-checkbox inputs).

## 6. "Time anchors in every level" (content, grammar-content.js v9)
- Added anchors to the remaining tense topics that lacked them:
  pp (already/just), b1FuturePlans (tomorrow / next weekend / after class /
  tonight / next summer), b1pPassivePerf statements (just), b1UsedTo negative
  ("..., but he does now"), wasWere question item ('on the test last week').
- 12-rebuild lint (37,572 generated questions): 0 problems, 0 cross-tense
  questions without a time anchor, 0 em-dashes, 100% four-option.

## Cache
- grammar.css ?v=15, grammar-content.js ?v=9 (both dashboards), SW v32 -> v33
  (busts grammar-form.js + assignments.css, which have no ?v).

## Not verified live
- Visual render needs Firebase login; node --check passed on grammar-content.js
  + grammar-form.js, and the content lint executes the real shipped file.

## Deploy
- firebase deploy --only hosting (user runs it).
