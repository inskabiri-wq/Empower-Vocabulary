# 2026-08-12c - Lingualab lockup everywhere, grammar motion, cycling subtitles

Three requests, all "make it the same as vocabulary".

## 1. The Lingualab lockup on placement, courses and the game pages

The skill screens open with a cap mark, the word "Lingualab", and the page name
on a line beneath. Placement, courses, the policy course and the 18 classroom
game pages opened with only their own title, so they read as separate products.

Done in `js/app-settings.js`, not in 20 files. `placeInHeader()` now calls
`addBrand(header, after)`, which builds the lockup and **moves** the page's own
title element into it as the subtitle. Moved, not copied or rebuilt, so ids
survive - verified `#pcCourseTitle` (policy course) and `#plExitBtn` /
`#backToClassroom` are still queryable afterwards.

Four games (heist, trust, listening, reading - student and teacher, 8 pages)
have **no `<header>` element at all**; their chrome is a `.<game>-top` bar. Those
were the only pages left with no branding and a gear floating over the artwork.
`GAME_BAR_SELECTORS` covers them.

Those bars REPEAT - a page uses `.heist-top` for chrome and again inside a later
view (measured: 2 occurrences on every teacher variant). They are resolved by
**document order**, never by visibility, because at mount the chrome bar can be
the hidden one while a game view is showing. Verified `bars[0] === the bar we
picked` on the teacher pages.

Rendered results:

| page | bar | subtitle |
|---|---|---|
| classroom-bingo-student | `header.header` | 🎱 Vocab Bingo |
| placement | `.ll-header` | 🎯 Placement Test |
| courses | `.pc-header` | 🎓 Courses |
| policy-course | `.pc-header` | 🎓 Policy Course (`#pcCourseTitle` intact) |
| heist-student | `.heist-top` | 🦹 The Heist |
| reading-teacher | `.reading-top` | none - lockup sits after the nav button |

Teacher game pages have no title ELEMENT (their breadcrumb is inline-styled
divs), so they get the wordmark alone with their breadcrumb beside it. Wordmark
18.4px/900/Nunito in the teal-to-blue gradient, cap 19x19, matching the skill
screens. No page overflows horizontally after the insert.

The two dashboards are untouched: they supply `[data-app-settings-open]`, so
`placeInHeader()` never runs there and they keep the branding they already have.

## 2. Grammar's stat row had no motion

`#grammarScreen .gr-stat` (Mastered / Best / Accuracy / Questions / Challenges)
had **no `transition` and no `:hover`** - the only stat strip in the app that
did not react. It now carries vocabulary's exact values from `extra.css`:
`translateY(-2px)`, elevated surface, `0 6px 20px rgba(0,0,0,0.3)`, 0.2s.

Grammar was also missing vocabulary's staged entrance. Both screens now assemble
in the same order at the same pace:

| element | delay |
|---|---|
| welcome banner | 0.05s |
| XP block | 0.1s |
| stat row | 0.15s |
| game grid | 0.2s |

`.gr-game-card` already matched `.activity-card` (lift + accent bar), and
`.gr-welcome-ava` already had `dashFloat`, so those were left alone.

## 3. The rotating subtitle, on every skill screen

Only vocabulary cycled. The cause was one character: the inline script used
`document.querySelector('.dash-cycle-wrapper')` - **singular** - so it drove the
first wrapper in the document and nothing else. Grammar, listening, reading,
writing and speaking each carried a wrapper that never moved.

Now one timer drives all six, each with its own phrase set, and only the wrapper
on the ACTIVE screen advances (`offsetParent` is null inside a hidden `.screen`)
so hidden screens do not churn or desynchronise. Verified by capturing the
interval callback and ticking it manually - a hidden tab throttles real timers
to about once a minute, so a wall-clock test would have proved nothing:

    menuScreen       across A2 · B1 · B1+ · B2 -> with 10 interactive activities -> ...
    grammarScreen    unit by unit -> with 5 challenge games -> master a unit ...
    listeningScreen  real exam timing -> replay any section -> ...
    readingScreen    timed or untimed, your choice -> real FSMEPT passages -> ...
    writingScreen    graded against the exam rubric -> revise and resubmit -> ...
    speakingScreen   at your own pace -> hear yourself back -> ...

Writing and speaking were included although only grammar, listening and reading
were asked for: they carry the same wrapper and leaving two screens static would
have recreated the inconsistency.

## Harness

`y/tools/demos/header-diag.html?page=<file>` renders any page's markup without
its scripts (so auth guards cannot redirect) and loads `app-settings.js` on top.
That is how courses, the policy course and the teacher game pages were checked -
all three are auth-gated and redirect to login when opened directly.

## Gates

- `node --check` on every touched JS - pass
- `theme-sanity.js` PASS, `ui-sanity.js` PASS, `grammar-sanity.js` PASS,
  `bump.js --check` OK
- em-dash scan on added lines: 0
- app-settings.js v22, app-settings.css v38, grammar.css v24; service worker v191
