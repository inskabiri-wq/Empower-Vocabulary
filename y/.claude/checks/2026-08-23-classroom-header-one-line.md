# 2026-08-23 - classroom header on one line, greeting traded away

Asked: if the "Hello, Alireza" greeting goes, can the rest sit on one line?

## Short answer: yes, but not from the greeting alone

Measured before changing anything, at 390px (a 362px content box):

| item | width |
| --- | --- |
| ← Dashboard | 119 |
| Lingualab lockup | 119 |
| Hello, Alireza | 34 |
| Logout | 80 |
| settings wheel | 44 |
| gaps (4 x 8) | 32 |
| **total** | **428 in a 362 box** |

Dropping the greeting takes it to 386, still 24px too wide. The greeting was
worth 42px of the 66px deficit, not all of it.

## Where the rest came from

Nothing else was removed. The remaining 24px, and the extra needed on narrower
phones, came from:

- header padding 12px -> 8px a side, gap 8px -> 4px
- nav buttons 6px/10px padding at 0.82rem -> 6px/8px at 0.74rem
- the lockup allowed to shrink, **within a floor**

The floor matters. `.ll-brand` carries `min-width: 0` from
`css/app-settings.css`, so an unbounded shrink is what collapsed it to 0px in
the first round and painted the flask on top of the greeting. `min-width: 86px`
is derived from the 360px budget rather than picked by eye: a 360px phone gives
a 344px content box, and Dashboard (119) + Logout (80) + wheel (44) + three 4px
gaps take 255, leaving 89 for the lockup.

## Where it works

| width | one line | spill | horizontal overflow |
| --- | --- | --- | --- |
| 430 | yes | 0 | 0 |
| 412 | yes | 0 | 0 |
| 390 | yes | 0 | 0 |
| 375 | yes | 0 | 0 |
| 360 | yes | 0 | 0 |
| **320** | **no** | 5 | **40px** |
| 1280 | yes (greeting still shown) | 0 | 0 |

Verified on `classroom-student.html` too, since it shares this stylesheet: one
line with no spill at 390 and 360.

At 320px the four items genuinely do not fit with the Dashboard label spelled
out. That width is an iPhone SE 1st generation and very old Android; if it ever
matters, the lever is shortening "← Dashboard" to the arrow alone.

## Two mistakes made and corrected on the way

**1. My row counting was wrong.** I compared each item's `top`, which differs
between items of different height, so a single row reported as three. Comparing
vertical CENTRES is the correct test, and it changed the reading completely: the
bar was already on one line in a case I had called broken.

**2. A rule for the back button stripped Logout as well.** Both carry
`.ll-navbtn`, so a narrow-screen rule meant to reduce "← Dashboard" to an arrow
hid Logout's label too and made BOTH buttons wider (119 -> 141, 80 -> 101). Backed
out entirely. There is now a comment on that rule saying the class covers the
pair.

## Ritual

- em-dash scan - clean
- brace balance - 237 / 237
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity - all PASS
- bump: styles.css v44 -> **v45**, CACHE_VERSION v328 -> **v329**
- `bump.js --check` - OK

## What was traded

"Hello, <name>" no longer shows in the classroom header on phones. It is hidden,
not deleted, so anything reading that element still works, and it still shows on
desktop. The name remains visible in the profile everywhere else in the app.
