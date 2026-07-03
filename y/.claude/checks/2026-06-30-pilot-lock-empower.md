# 2026-06-30 - Pilot: lock app to Empower, hide the Book picker (modular)

## Request
Students must only see/use the Empower book for the pilot. Disconnect Gateway,
hide the book choice entirely (they should not know content is book-based),
do not break anything (pilot tomorrow), keep it reversible.

## Change - one flag: window.FORCE_BOOK
- config.js: added window.FORCE_BOOK = "empower" (set to null to restore Gateway
  + the picker). selectedBook now = FORCE_BOOK || localStorage || "empower", so a
  stale "gateway" in localStorage can no longer leak in.
- student.js: savedBook honours FORCE_BOOK; when set, hides the whole Book
  sel-group (#bookSelGroup) on the dashboard.
- ui.js changeBook(): coerces book to FORCE_BOOK defensively (assignments box /
  restored pill state can never switch to gateway).
- student-dashboard.html: added id="bookSelGroup" to the Book sel-group so it can
  be hidden by the flag. Gateway pill/option left in the DOM (hidden) so flipping
  the flag brings everything back with zero further edits.

## Why safe
- Nothing references Gateway content when locked: dataset load, assignment match
  (a.book !== currentBook), and the user-doc book field all resolve to empower.
- Level + Unit pickers untouched; only the Book row is hidden.
- Fully reversible: set window.FORCE_BOOK = null.

## Sanity
- node --check config.js / student.js / ui.js / service-worker.js: OK.
- My new lines added 0 em dashes.
- Cache-first assets -> bumped service-worker CACHE_VERSION v68 -> v69.
- No deploy / no push.
