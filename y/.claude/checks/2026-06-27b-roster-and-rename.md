# 2026-06-27 - Roster importer improvements + empower-write rename + Empower Lab scrub

## Roster importer (from the handwritten punch-list, per user's edits)
Files: y/teacher/js/roster-import.js (?v=1 -> ?v=2), functions/index.js (mirror).
- A. SHOW PER CLASS: validation preview now groups valid students + teachers by
  class (each class header + count, then the people), replacing the old flat
  "classes in this import" chip row.
- B. NO EMAIL = EXCLUDE, DON'T BLOCK: a row with no email goes to a separate
  "Excluded (no email)" list and is skipped; the import still proceeds for
  everyone who has an email. Was a hard "missing email" problem that blocked
  commit. Mirrored in functions/index.js validateRows (returns excluded[]) and
  report.excluded. Invalid (malformed) emails are still a hard problem (typo).
- C. CLICKABLE DATA: the per-class names, the excluded list, and the problems
  list are now click-to-expand rows that reveal that person's parsed details
  (email / student no / class / level). One delegated click handler on #riReport
  (CSP-safe, no inline JS); toggles the following .ri-det.
- D. PRE-ADVANCED -> C1: added pre-advanced / pre-adv / pre advance (and variants)
  to LEVEL_WORD so they normalise to C1 (alongside advanced -> C1).
- Dropped per the note: #1 orientation mini-course, #4 remove-excel. Re-choosing a
  file already works via the native file inputs (pick again), so no new button.
- "warning 27": interpreted as "the rows were not clickable" -> fixed by C.

## empower-write -> lingualab-write
- Renamed the served folder y/empower-write -> y/lingualab-write (untracked on
  disk; plain mv). No "Empower" text inside it.
- Updated the one link in teacher-dashboard.html (the AI-correction PREVIEW button).
- Note: .staging/empower-write/ (internal, not served) left as-is.

## Scrub "Empower Lab" -> "Lingualab"
- 25 occurrences across 14 files under the repo .claude dirs (check logs,
  HANDOFF.md, FUNDING-PROPOSAL.md, make-proposal-pdf.py title strings,
  pw-pwa.js stale PWA-name assertion, icon-inventory.txt examples, one stale
  permission entry in a worktree settings.local.json). 0 remaining.
- Home-dir memory files were intentionally left (they record the rename history).
- Functional ids untouched (empower-vocabulary-practice, empower-shell-, the
  'empower' book key, the "Empower" coursebook name).

## Sanity
- node --check roster-import.js + functions/index.js OK.
- Stubbed-DOM load smoke of roster-import.js OK (exports renderClassCards/ensureQr/buildJoinUrl).
- em-dash scan: 0 (also fixed 3 pre-existing em dashes in functions/index.js
  reminder-email placeholders + a warn message).
- No deploy, no push. Browser-eyeball the roster preview after deploy (admin tab).
