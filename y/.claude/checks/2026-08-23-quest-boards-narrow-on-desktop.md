# 2026-08-23 - both Quest Boards rendered at phone width on a desktop

Reported as "you also pushed it on pc, the alignment must be only for mobile
not pc", with screenshots of the Vocabulary and Grammar Quest Boards
(map / explore) on a wide screen.

## First: this was not one of my mobile changes

Checked before touching anything, because the report was that a phone layout
had leaked onto desktop. For every selector added or changed in
`assignments/css/assignments.css` this week, tested whether it matches anything
inside `#learningMapModal` or the grammar board:

```
rulesOfMineMatchingInsideQuestBoards: { learningMap: [], grammarMap: [] }
questClassesMentionedInAssignmentsCss: []
```

Zero matches, and that stylesheet does not mention a single Quest Board class.
The boards were already like this. The instinct to look was right though: the
result genuinely IS a phone-width layout on a desktop, just not from a media
query.

## The cause

`student/css/extra.css`:

```css
.learning-map-modal {
  max-width: 900px;   /* and no width at all */
```

`max-width` only says how wide the box MAY be. This box is a flex child of a
centred `.modal-overlay`, so with no `width` it shrink-to-fits its content and
never claims the space it is allowed.

Measured, with the stylesheets confirmed applied:

| viewport | board width |
| --- | --- |
| 1440 | 385 |
| 1280 | 385 |
| 1024 | 385 |
| 390 | 358 |

385px at 1440. Essentially the phone layout on every desktop size, which is
exactly what the screenshots show.

It also explains why the two boards looked like different products: they
deliberately SHARE `.modal-content.learning-map-modal` (grammar.js builds the
same box), so the only thing making them different widths was their content.
Grammar's unit topic lines are long, so it shrink-fitted wider than vocabulary.

## Fix

One line, and it covers both boards because they share the class:

```css
width: min(900px, 95vw);
```

| viewport | vocabulary | grammar | same width | fits |
| --- | --- | --- | --- | --- |
| 1440 | **900** | **900** | yes | yes |
| 1280 | **900** | **900** | yes | yes |
| 1024 | **900** | **900** | yes | yes |
| 768 | 726 | 726 | yes | yes |
| 390 | 367 | 367 | yes | yes |

## My measurement was wrong the first time, again

The first run reported `max-width: none` at 1280 and `900px` at 1024, from a
rule that has no media query at all. That is impossible, and it was the tell:
the harness read computed style before `extra.css` had been applied.

Rewritten to wait until every `<link>` has a parsed sheet AND a probe element
reports a styled value, rather than a fixed timeout. This is the same fault as
the dead dev server and the fixed-delay auth stub: **a reading that cannot be
true is a broken probe, not a discovery.** Worth remembering that an impossible
number is the cheapest signal available, and I nearly filed the first result.

## Ritual

- em-dash scan - clean
- brace balance - 910 / 910
- all five gates - PASS
- bump: extra.css v35 -> **v36**, CACHE_VERSION v333 -> **v334**
- `bump.js --check` - OK
