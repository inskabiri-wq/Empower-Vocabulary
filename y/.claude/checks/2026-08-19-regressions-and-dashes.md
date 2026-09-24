# 2026-08-19 - Three reported issues + the em-dash sweep

## 1. Stats rendered as a vertical column in the Quest Board (my regression)
Every rule that lays those blocks out is scoped to the screen they came from
(`#menuScreen .dash-stats`, `#grammarScreen .gr-stats`). Moving the nodes into
the modal took them out of that scope, so the grid and flex rules stopped
matching and they fell back to block stacking.

Fixed by aliasing the scope rather than hand-copying ~67 rules: every selector
starting `#menuScreen .dash-welcome|.dash-stat` (and the grammar equivalents)
now also has a `.qc-summary ...` form. No values move, so the in-modal
appearance cannot drift from the on-screen one. 63 selectors.

The aliaser got it wrong twice first, both SILENTLY:
  - a `/* comment */` directly above a rule is part of the selector text, so
    `startsWith('#menuScreen ')` was false. The stats grid has exactly such a
    comment, which is why it stayed vertical after a pass that reported success.
  - @media blocks were copied through untouched, so no responsive rule was
    aliased.
Restored from backup and re-ran: 40 aliases -> 63.
Verified: 5 cards, one row, grid of 5 equal columns; summary 423px -> 223px.

## 2. "The refresh is still there"
The onSnapshot fix was right, but I never shipped it: `feature-toggles.js` was
still referenced as `?v=3` in student-dashboard.html, so the browser kept
serving the CACHED file with the old one-shot `get()`. An earlier bump run had
missed it. Now v4.

Lesson matching the project guide: bump and re-check before concluding a fix
did not work.

## 3. "No units yet for C1"
Not a loading bug, and making it say "Loading..." would have been a lie.
`grammar-content.js` declares `levels: ['A2','B1','B1+','B2','C1']` but its
`byLevel` index only has A2 / B1 / B1+ / B2. So a C1 tab was offered that could
never hold anything.

grammar.js now derives the level list from `byLevel`, keeping declared order.
A level appears the moment its content does, and never before. C1 is gone from
both the screen pills and the map tabs. grammar-sanity still PASSes.

NOTE: vocabulary's Quest Board still hardcodes a C1 tab in student-dashboard.html
(line ~350). Not touched - vocabulary's content lives elsewhere and I did not
verify whether C1 words exist.

## 4. Em dashes - done
782 dashes across 72 files replaced with hyphens, 240 of them on user-visible
lines: "- Select a class -", "Nothing to export - no submissions loaded.",
"Submitted - awaiting teacher feedback.", and 113 in the teacher comment bank.

Excluded deliberately: `vendor/` (third-party xlsx, 78), `.tmp/` and `.claude/`
(not shipped, 126), and `*.md` (53). Only the two dash characters change, so
this cannot alter a selector, value, identifier or control flow.

App code is now at 0.

## Verification
- node --check on every JS file in the repo: passes.
- grammar-sanity PASS, theme-sanity PASS, tokenise-colors idempotent,
  inline-css-check PASS, light-coverage 0, bump --check no drift.
- Service worker v243. 48 files bumped for the dash sweep.

## Not done
- The Claude Design loaders project (84483ca7-...) returns 404 and is not in the
  accessible list: DesignSync only sees design-SYSTEM projects the user can
  write to, and that link is a regular design project. Needs the file another
  way.
- Vocabulary screen density below the header (the activity grid itself).
- The 13 unit pills -> dropdown.
- Nothing deployed.

---

## 5. Grammar unit count did not follow the selection
`.gr-count` printed `info.totalQ` - the sum across EVERY unit at the level -
with the label "questions at A2". Picking U1 changed the pills, the games and
the description, but that number sat unchanged and looked stuck.

It now follows `state.selectedUnit`:
  All -> 2326, "questions at A2"
  U1  ->  568, "questions in Unit 1"
  U2  ->  208, "questions in Unit 2"
  U3  ->  148, "questions in Unit 3"
  back to All -> 2326
Verified by clicking the real pills in the harness.

## 6. I broke the repo's own em-dash detector, then fixed it
`tools/emdash-scan.js` held `var DASH = /[<en><em><bar>]/` - a LIST of dash
characters. My repo-wide dash sweep treated that tool as app source and rewrote
the literals to hyphens, leaving `/[--<bar>]/`. A regex reads that as the RANGE
U+002D to U+2015, which matches nearly every letter and digit, so the guard
fired on every line of every file and started blocking edits. It reported "630
dashes" in a file that had none, citing lines like `(function () {`.

Two separate things were wrong and both are now fixed:
  - the regex is written with unicode ESCAPES (\u2013 \u2014 \u2015) so a future
    dash sweep cannot corrupt it again. The reason is stated in the file.
  - the sweep should never have included `tools/`.

Checked every other line the sweep touched that was not a comment. Only three,
all benign: two display placeholders, and `dashboard-extras.js` where a filter
compares `c.cls !== '-'` - its PRODUCER lines (`|| '-'`) changed in the same
pass, so the comparison still matches. Verified against the backup.

Detector re-proved after the fix: flags a real em dash, ignores an emoji-only
line (the byte 0x97 inside U+1F5FA is what a byte-wise reader mistakes for an en
dash), reports grammar.js clean.

## Verification (final)
- node --check every JS file: passes.
- grammar-sanity PASS, theme-sanity PASS, light-coverage 0,
  inline-css-check PASS, bump --check no drift.
- em-dash scan across 206 app files: clean.
- Service worker v244.
