# 2026-08-23 - writing form buttons: matched to Cancel, properly this time

Reported for the third time: the tabs and Back / Next do not look like Cancel and
do not have its animation.

## Why my earlier check passed while the buttons still looked wrong

`.modal-btn-cancel` is defined TWICE:

| file | padding | radius | border | transition |
| --- | --- | --- | --- | --- |
| `teacher/css/styles.css:628` | 10px 20px (from `.modal-btn`) | 8px | none | none |
| `assignments/css/assignments.css:714` | **12px 24px** | **10px** | **1px blue** | **all 0.3s** |

`assignments.css` loads on `teacher-dashboard.html` and wins. On 2026-08-22 I
matched `.wtab` / `.wnav-btn` to the FIRST one, measured "37px and zero
differences", and reported it as done. The comparison was against a button that
is not the one on screen.

I also only compared four properties (height, padding, radius, font-size).
Background, border, transition and the hover transform were never checked, and
three of those four differed.

## Fix: one rule, not a copy

The tabs and Back / Next now SHARE the Cancel rule rather than restating its
values:

```css
.modal-btn-cancel,
.wtab,
.wnav-btn { ... }

.modal-btn-cancel:hover,
.wtab:hover,
.wnav-btn:hover { ... transform: translateY(-2px); }

.light-mode .modal-btn-cancel,
.light-mode .wtab,
.light-mode .wnav-btn { ... }
```

Every appearance declaration for `.wtab` and `.wnav-btn` was deleted from the
inline `<style>` block in `teacher-dashboard.html`. Only `[hidden]` behaviour
stays there. Copying is what let them drift, so there is now nothing to drift.

The selected step keeps its accent fill (`.wtab.active`), but takes its padding,
radius and border from the shared rule, so the tabs do not resize as you move
through the wizard.

## Verified

All 22 computed properties compared against the real Cancel button, in light
mode (the app's default):

Cancel: height 47px, padding 12px 24px, radius 10px, border 1px
rgba(59,130,246,0.3), transition all 0.3s.

| button | differences from Cancel |
| --- | --- |
| inactive tab | **0** |
| Back | **0** |
| Next | **0** |
| active tab | same height, padding and radius (accent fill by design) |

Properties compared: padding x4, border width / style / colour, radius,
background-image, background-colour, colour, font-family, font-size,
font-weight, letter-spacing, line-height, cursor, transition-property /
duration / timing-function, box-shadow, rendered height.

The hover animation now covers them: the `translateY(-2px)` rule lists
`.wtab:hover` and `.wnav-btn:hover` alongside `.modal-btn-cancel:hover`.

## One check that did not work

I tried to read the parsed rules back out of the CSSOM as extra proof, and the
probe returned zero rules from the iframe's stylesheet. That is a harness
limitation, not a CSS fault: the computed styles above are read from rendered
elements, which is stronger evidence than rule text anyway, and the file's
braces balance (268/268) so nothing was dropped by a syntax error.

## Ritual

- em-dash scan - clean
- brace balance on the edited stylesheet - 268 / 268
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity - all PASS
- bump: assignments.css v19 -> **v20**, CACHE_VERSION v327 -> **v328**
- `bump.js --check` - OK

## The general lesson

Before matching one element to another, find EVERY rule that defines the target.
A second definition in a later stylesheet is invisible to a check that greps one
file, and that is what made this wrong three times.
