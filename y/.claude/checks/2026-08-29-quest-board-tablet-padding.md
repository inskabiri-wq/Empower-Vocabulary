# 2026-08-29 - the Quest Board on a tablet: no padding at all above 600px

Reported as the vocabulary and grammar map boxes being misaligned on tablet and
phone. The tablet half is real and now fixed. The phone half was already
correct, and saying so is more useful than pretending otherwise.

## The cause

`.modal-content` is given padding in exactly **one** place in the entire app:

```css
/* student/css/styles.css */
@media (max-width: 600px) {
  .modal-content { padding: 28px 24px; }
}
```

There is no base rule. Above 600px the `* { padding: 0 }` reset is what
applies, so the Quest Board had **zero horizontal padding** on every tablet and
every desktop. Its cards sat flush against the sheet border.

The visible symptom was asymmetry rather than tightness. The sheet is
`overflow-y: auto`, so the scrollbar held ~17px on the right while the left had
nothing. Content was genuinely off-centre by the width of a scrollbar, which is
what "not properly aligned" looks like.

Measured at 768px, all four bands (title, level tabs, summary, card grid):

| | left inset | right inset |
| --- | --- | --- |
| before | **0px** | **17px** |
| after | **45px** | **45px** |

## The fix

Padding on `.learning-map-modal` at every width, plus `scrollbar-gutter: stable
both-edges` so the gutter is reserved on both sides and the sheet stays
symmetric whether or not it is scrolling.

Deliberately **scoped to this board**, not fixed on `.modal-content`. That class
is shared by thirteen modals, and widening the blast radius in the week of a
demo is not worth it.

The phone value is repeated in a `max-width: 600px` block. That is not
redundancy: `extra.css` loads after `styles.css` and both selectors are one
class, so without it the new desktop padding would win on phones too and change
a layout that was already right.

## Measured after, six widths

| viewport | padding | left | right | sideways scroll |
| --- | --- | --- | --- | --- |
| 1024 | 32/28 | 45 | 45 | no |
| 834 (iPad Air) | 32/28 | 45 | 45 | no |
| 768 (tablet portrait) | 32/28 | 45 | 45 | no |
| 601 | 32/28 | 30 | 30 | no |
| 390 (iPhone) | 28/24 | 26 | 26 | no |
| 360 | 28/24 | 26 | 26 | no |

Title, level tabs, summary strip and card grid share one inset at every width.
Phone numbers are identical to before the change.

Grammar's `openMap()` builds the same `.modal-content.learning-map-modal`
chrome, so this fixes both boards from one rule.

## The phone was not broken

At 390px every band already shared a left edge at 36px and a width of 319px,
nothing overflowed, no text truncated, and the challenge rows totalled 243px
inside a 293px row. Reporting it as fixed would have been false.

## Two harness bugs caught before they became findings

1. **No `<meta name="viewport">` in the probe.** Asking for a 601px viewport
   returned `viewport: 980`, because without that tag a narrow emulation falls
   back to the 980px layout viewport. Every narrow measurement was silently
   reporting the desktop layout. Caught only because the probe echoes the width
   it actually got.
2. **Three stylesheets instead of nine.** The dashboard loads nine, and source
   order decides which of two equal-specificity rules wins. The finding was
   re-measured with all nine before being acted on, and it held.

The probe also waits on `link.sheet` and then polls for a value only the real
CSS can produce, never a fixed delay, and cache-busts each `<link>` by
re-setting its href rather than trusting a reload.

`y/tools/demos/qc-map-align.html` is kept for the next time this comes up.

## Logged, not done

**The other twelve modals have the same gap.** Nothing in any stylesheet gives
`.modal-content` padding above 600px. Whether that shows depends on each
modal's own inner markup, and the Quest Board is the one that was reported. A
base `.modal-content` padding would fix them all in one line, but it needs the
other twelve checked for double padding first.

## Ritual

- CSS braces 913/913, comments 238/238
- em-dash scan - clean
- gates: seventeen, all PASS
- bump: extra.css v37, CACHE_VERSION -> **v381**; `--check` OK
