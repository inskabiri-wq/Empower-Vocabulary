# 2026-08-19 - Full diagnostic: hidden skills + "refresh twice"

## Finding 1 - the strip called the wrong function
My previous fix changed `SKILL_REGISTRY.active()` to honour the org toggles.
The student assignments strip does not call that. It calls `.all()`:

    student-assignments.js:470   SKILL_REGISTRY.all()   <- ignores toggles
    teacher-assignments.js:49    SKILL_REGISTRY.all()
    teacher-assignments.js:81    SKILL_REGISTRY.all()
    teacher-assignments.js:142   SKILL_REGISTRY.active()   (only correct caller)

So the fix landed on the one call site that was already fine. I had assumed the
registry was a single choke point without checking who actually called what.

`.active()` is not the right function for a strip either: it also drops
'coming-soon' skills, which are meant to show DIMMED. That is why Speaking looks
greyed in the screenshot - Speaking is `status: 'coming-soon'`, which is a
different thing from being switched off.

Added a third method so the three meanings are distinct:
    all()     - every skill, no filtering. Config screens.
    visible() - minus the ones an admin switched off. Anything a student SEES.
    active()  - visible AND finished. Anything a student can OPEN.
The three strips now use visible().

## Finding 2 - nothing re-rendered the strip
Only hub.js and placement-tile.js listened for `feature-toggles-ready`. The
toggles arrive asynchronously (auth, then a Firestore read), so whenever the
assignments block rendered first it listed every skill and then never corrected
itself. student-assignments.js listens now, so an admin flipping a switch
reaches an open student page with no refresh at all.

## Finding 3 - THE "refresh twice", and it is not the tiles
service-worker.js serves same-origin static assets CACHE-FIRST, keyed on the
FULL url. That means:
  - a file referenced as `foo.js?v=7` gets a NEW url when bumped, misses the
    cache, and is fetched fresh on the FIRST reload.
  - a file referenced as `foo.js` with no query keeps the same url for ever.
    The only thing that can dislodge it is the old cache being deleted, which
    happens when the NEW service worker activates - one reload cycle later.
    First refresh: old file. Second refresh: new file.

60 references were unversioned, teacher-assignments.js among them. All 97
matching references across every page now carry a ?v=, so tools/bump.js can
manage them (it skips anything without a query) and one refresh is enough.
Five files then showed version DRIFT - the same asset at ?v=1 in one page and
its real version in another - and were unified.

## What was already correct
- hub.js renders SKELETONS until the toggles land, so the grid never shows a
  tile it is about to remove. Verified earlier with a MutationObserver: one
  mutation, deactivated tiles never present in any observed state.
- The registry logic itself is right at every stage of the boot. New trace page
  `y/tools/demos/toggle-trace.html` asserts it: 8/8 PASS, including the case
  that matters - before the toggles arrive visible() MUST return all six,
  because nothing can know what is off until the data lands. That is exactly
  why the re-render in Finding 2 is the fix, not a different default.

## Verification
- toggle-trace: 8/8.
- Harness: registry visible() = vocabulary/listening/reading/grammar with
  speaking+writing off; hub shows the matching 6 tiles.
- No broken asset references after versioning 97 refs (all HEAD 200).
- node --check every JS file, manifest valid, theme-sanity, light-coverage 0,
  inline-css-check, grammar-sanity, bump --check consistent.
- Service worker v254.

## Note for the next deploy
Because 97 references changed from unversioned to versioned, this particular
deploy still needs the usual one hard refresh for the new service worker to
activate. From the NEXT deploy onward a single normal refresh is enough.
