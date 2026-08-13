# 2026-08-11 - One nav button for the whole app

Follow-up to 2026-08-10 (wheel in page header). The wheel was consistent, but
the buttons NEXT to it were not: classroom's "Dashboard" and placement's "Exit"
looked like controls from two different products.

## What was wrong

The same control (Dashboard / Exit / Back) was written five different ways.

| where | how it was styled |
|---|---|
| classroom, bingo/scramble/tug hosts | `.btn.btn-secondary` (12px 24px, radius 12) |
| placement | a full inline `style=` blob (8px 14px, radius 10) |
| courses, policy course | `.pc-back` - a plain text link, no button at all |
| heist / trust / reading / listening hosts | `.heist-btn` etc + inline `padding: 7px 14px; font-size: 0.85em` |
| the wheel itself | 42px, radius 12, with a drop shadow |

Six looks for one job.

## What changed

`.ll-navbtn` in `y/css/app-settings.css` - one definition, applied to every
top-of-page nav control on 12 pages. Height 36, radius 10, 1px
`--border-color`, `--bg-item`, `--text-secondary`, 0.85rem/700, hover to
`--accent-primary`.

- Doubled selector (`.ll-navbtn.ll-navbtn`) so it outranks the page-level rules
  on specificity rather than on load order, and without `!important`.
- The per-page inline `style=` attributes were REMOVED, not overridden. An
  inline style beats any class, so leaving them would have silently kept four
  pages off the shared look.
- The wheel is now the same button, just square: 36px, radius 10, same border,
  same background, no shadow. Previously it was 42px with a drop shadow, which
  is why the gear and the Exit next to it read as unrelated on placement.

Also fixed while placing the wheel: `classroom/css/styles.css` `.header` and
`corrector.css` `.cor-header` are both `justify-content: space-between`, so
adding the wheel as a third child would have pushed the page title into the
middle of the bar. `.as-hosthdr` (added by `placeInHeader()`) switches those to
`flex-start` and lets the last cluster claim the free space, so the title stays
beside the wheel.

## Deliberately NOT changed

The end-screen CTA pairs on the heist / trust / reading / listening hosts
(`Run another round` + `Back to Classroom`). Those sit next to a large
`primary` sibling; shrinking only the secondary to 36px would have created a
new mismatch. `.ll-navbtn` is for top-of-page nav, not in-flow CTAs. Three of
them were converted by the first pass and then reverted.

Skills pages (`student-dashboard.html`) untouched, per standing instruction.

## Verified against the served files

Real `css/app-settings.css` + `js/app-settings.js` loaded from the server,
against the real `brand.css`, `classroom/css/styles.css`,
`student/css/policy-course.css` and `index/css/variables.css`, with transitions
disabled before reading computed styles.

9 controls measured: 5 nav buttons (classroom link, classroom button, courses,
placement, heist host), 3 in-header wheels, 1 floating wheel.

```
distinctLooks: [ "36 | 1px rgba(59,130,246,0.2) | 10px | rgb(28,42,66) | none" ]
EVERYTHING_MATCHES: true
```

One look. Anchor and button included - those had differed before because `.btn`
renders differently on an `<a>`.

Header layout after the wheel joins: `justifyContent: flex-start`, title 22px
to the right of the wheel, actions pinned to the right edge (24px = the
header's own padding). No second bar.

## Gates

- `node --check y/js/app-settings.js` - PASS
- `node y/tools/ui-sanity.js` - PASS
- `node y/tools/grammar-sanity.js` - PASS
- em-dash scan on every touched file - 0 (two pre-existing ones in
  `classroom-student.html` comments removed as well)
- temp proof page deleted

## Files touched

`css/app-settings.css`, `js/app-settings.js`, `placement.html`, `courses.html`,
`policy-course.html`, `classroom-student.html`, `classroom-teacher.html`,
`classroom-heist-teacher.html`, `classroom-trust-teacher.html`,
`classroom-listening-teacher.html`, `classroom-reading-teacher.html`,
`classroom-bingo-teacher.html`, `classroom-scramble-teacher.html`,
`classroom-tug-teacher.html`, `service-worker.js`

## Versions

`app-settings.css?v=12`, `app-settings.js?v=13`, service worker `v138`.

## Deploy owed

```
firebase deploy --only hosting
```
