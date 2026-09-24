# 2026-09-10 - the writing feedback modal was a hardcoded dark island

## What was wrong

`viewWritingFeedback()` in `assignments/js/student-assignments.js` built its
whole modal from inline styles with hardcoded dark-theme values, while the
student dashboard is light.

Measured on the real page:

    app  --text-primary : #0f172a      (near black)
    app  --bg-card      : white gradient
    app  --border-color : rgba(15,23,42,0.10)

    modal panel background : #0f172a   <- the app's TEXT colour, used as a background
    modal title colour     : #f1f5f9   <- near white
    modal borders          : rgba(255,255,255,0.08)

The panel read `var(--surface-elevated, #0f172a)`, and **`--surface-elevated` is
not defined anywhere in the app**, so the dark fallback always won. The modal
could never follow the theme, in either direction.

Inventory of the function: **29 distinct hardcoded colours** and **5 font sizes
under the 12px floor**, the smallest 0.55em.

## The size half

The sizes were ad-hoc `em`, which NESTS: the "/ 5" span is `0.62em` inside a
`1.2em` parent, so the real rendered size is not what the number suggests. That
is the same trap that made `.t2-btn` compute to 10.14px earlier this week.

All 20 sizes are now explicit `rem` on the app's scale, so they are stable
regardless of where the modal is mounted and regardless of the `--app-scale`
text-size setting. **Zero `em` sizes remain in the function.**

## The colour half

48 replacements, mapped semantically rather than swapped for light equivalents:

    #f1f5f9 / #e2e8f0        -> var(--text-primary, #0f172a)
    #cbd5e1                  -> var(--text-secondary, #475569)
    #94a3b8 / #64748b        -> var(--text-muted, #5b6b7f)
    var(--surface-elevated)  -> var(--bg-card, #ffffff)
    rgba(255,255,255,0.0x)   -> var(--border-color, ...) / var(--bg-item, ...)

The pastels needed real replacements, not tokens: `#86efac`, `#7dd3fc`,
`#fca5a5`, `#99f6e4`, `#bfdbfe` are dark-theme TEXT colours and are close to
invisible on a white card. They became `#15803d`, `#0369a1`, `#b91c1c`,
`#0f766e`, `#1d4ed8`. The score `oklch()` tiers were darkened by about 15
lightness points for the same reason.

## Executed, on the real student dashboard

Token resolution and contrast, measured with the fixed markup mounted in the
live page:

| element | resolved colour | contrast on white | size |
| --- | --- | --- | --- |
| panel | `rgb(255,255,255)` | | |
| title | `rgb(15,23,42)` | **17.85:1** | 17px |
| muted labels | `rgb(85,98,116)` | **6.20:1** | 12px |
| score | `rgb(21,128,61)` | **5.02:1** | 20px |
| response | `rgb(15,23,42)` | **17.85:1** | 16px |

All past WCAG AA. Every size at or above 12px.

**It follows the theme now, proven both ways.** Flipping `--bg-card`,
`--text-primary` and `--text-muted` to dark values on `body` turns the panel
`rgb(15,23,42)` with `rgb(248,250,252)` text, and removing them restores light.
Before this change it was `#0f172a` in every theme.

## Two harness failures worth recording

**The heredoc ate my backslashes.** The scripted replacement built regexes with
`'(\\s*)'`, which reached `RegExp` as `(s*)` - a literal "s", not whitespace.
So `font-size:0.75em` (no space) was replaced and `font-size: 0.78em` (with a
space) was silently skipped. Three sites survived and I only noticed because I
re-scanned afterwards. Caught by printing `re.source`.

CLAUDE.md already warns against inline `node -e` with quoted JS; this is the
adjacent trap. **Write regex-bearing scripts with the Write tool, not a bash
heredoc.**

**I set the theme tokens on the wrong element.** The first theme-following test
set `--text-primary` on `document.documentElement` and reported
`FOLLOWS_THEME: false`. The tokens are defined on `body`, which is nearer to the
test node, so the html-level value never applied. The code was fine; the probe
was wrong.

## Not verified

The modal was never rendered through its own data path. Seeding an assignment
plus a graded `writingSubmissions` doc was not enough: both are readable by the
student, but `loadMyAssignments()` filters the assignment out before
`myWritingSubmissions` is populated, so `viewWritingFeedback()` fell through to
its "No submission found" alert.

What IS verified is the thing the fix claims: these token references resolve to
readable, theme-correct colours on the student dashboard, and no size falls
under 12px. The arrangement of the markup is unchanged.

## Ritual

- `node --check` - clean; em-dash scan - 0
- 10 gates PASS, including the AI Quiz safety net (19/19) and the grandfather
  check (48/48). This file does not touch AI Quiz, but the net was run anyway.
- bump: `student-assignments.js`, CACHE_VERSION v412 -> **v413**, no drift
- emulator test data deleted

## Verify after deploying

Hard-refresh, open a graded writing assignment as a student, and press the
feedback button. The card should now be light like the rest of the dashboard,
with dark readable text, and nothing smaller than 12px.
