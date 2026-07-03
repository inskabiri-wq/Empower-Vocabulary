# 2026-06-27 - Roster edit/delete + themed errors + dead-code delete + hint tighten

## Roster importer (roster-import.js ?v=2 -> ?v=3)
- PER CLASS, SCROLLABLE + TABS (C): the "By class" view is a chip/tab bar (click a
  class to jump) over a 420px scrollable panel with sticky class headers - long
  rosters no longer blow up the page.
- EDIT / DELETE ANY ROW (D): clicking a person expands details with Edit + Delete.
  Delete (themed confirm) removes the row from state and re-validates; Edit shows
  an inline form (name/email/student no/class/level), Save updates state and
  re-validates. Works on per-class rows, excluded rows, and problem rows - so a
  no-email or duplicate can be fixed in place. Extracted revalidate() so edits
  re-run the same validation as the initial parse.
- THEMED ERROR POPUPS (E): errors now use AppDialog.alert (same modal style as the
  rest of the app), with a plain-language translation - "Could not create
  accounts: internal" explains it means the Cloud Functions backend is not
  reachable yet (needs Blaze), not a sheet problem. File-read + commit errors routed
  through showError().

## Grammar: dead code deleted (B)
- Removed the unused FIXED hand-bank (~493 lines) + the old G.comp / G.superl
  generators (the "in the city" templates) - 48 KB. Every topic has a VALID
  generator, so these never ran. Simplified the 4 assembly ternaries to
  `VALID[t.id] ? buildValidated(...) : []`. Checker still PASS, so nothing broke.

## Grammar: hints tightened (A)
- The "157 distractor-in-hint" were almost all deliberate paradigm tables
  (a2-be "I am, he/she/it is..."; some vs any) which the checker does not flag as
  leaks (answer is in the hint = teaching table). The real cases were:
  - 5 incidental word collisions (a hint using "are/is/be/take/get" that equalled
    an option token) in b1p-deduction, b1-future-plans, b1-modals-possibility,
    b2-be-used-to, b2-reporting-verbs -> reworded token-free.
  - b1-used-to negative bank: the shared hint "used to + base verb" pointed at the
    WRONG option ("used to") for negatives whose answer is "use to" -> gave the
    negative bank its own token-free hint.
- Also fixed a tautology surfaced by the doubled-word check: "Are the students
  students?" / "The students are students." - a2-be + a2-be-questions now skip
  subject-contains-complement pairs.
- distractor-in-hint is now 0.

## FINAL: node y/tools/grammar-sanity.js -> PASS
- 82 units, 5541 questions. structure 0, give-aways 0, semantic 0, distractor-in-hint 0.
- node --check (grammar-content, roster-import, functions) OK. em-dash 0. roster
  stubbed-load OK. grammar-content.js ?v=28 -> ?v=29; roster-import.js ?v=3.
- No deploy/push (user does). Redeploy hosting to ship roster v3 + grammar v29.

## 2026-06-27d: a/an ambiguous distractors
- a2-a-an distractors were ["an","the","one"] - but "the X" and "one X" are both
  valid, so two options were defensible. Changed to ["other article","every","each"]
  (every/each are ungrammatical in "It is ___ N" for every noun, incl. food), so
  exactly one option is correct. Checker PASS. grammar-content.js v29 -> v30.
