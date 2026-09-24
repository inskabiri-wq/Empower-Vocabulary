# 2026-08-23 - IELTS criteria were being scored in half bands

Reported: the Writing AI's "By criterion" panel showed Task Achievement 6.5 and
Grammatical Range and Accuracy 5.5. IELTS does not award those.

## The rule

IELTS publishes its Writing band descriptors at WHOLE bands. Each of the four
criteria is awarded a whole band (5, 6, 7). The four are then averaged and the
OVERALL score is rounded to the nearest half band. So a half band is correct for
an overall score and never for a single criterion.

The app had it the other way round: a single `step: 0.5` was used for both.

## Cause

`assignments/js/writing-rubrics.js` declared, on all three IELTS rubrics:

```js
scale: { min: 0, max: 9, step: 0.5, name: 'IELTS band' },
```

That step is only used for the toolbar summary line, so it did not actually
constrain anything. The real problem was that nothing constrained the model:
`lingualab-write/js/corrector.js` built the prompt with

```js
' Give each criterion verdict as an estimated ' + scale.name + '.'
```

and a criterion verdict is FREE TEXT the model writes, rendered verbatim. Asked
for "an estimated IELTS band" with no further constraint, it returned half
bands.

## Fix, in two layers

**1. The scale now distinguishes the two steps.** `criterionStep` is the step of
a single criterion; `step` stays the step of the reported/overall score. IELTS
gets `criterionStep: 1`. `WRITING_RUBRICS.criterionStep(id)` falls back to
`step` for every other exam, so nothing else changes.

**2. The prompt says so, and the renderer enforces it.** The prompt now states
that a criterion must be a whole band and that 6.5 is not valid for one. Asking
is not the same as knowing, though, so `normaliseVerdict()` snaps any number in
a criterion verdict to that exam's criterion step and clamps it to the scale's
range on the way to the screen. The OVERALL estimate is deliberately not passed
through it, because a half band is right there.

## Verified

Against the exact values in the report:

| verdict | rendered |
| --- | --- |
| IELTS BAND 6.5 | **7** |
| IELTS BAND 6.0 | 6 |
| IELTS BAND 5.5 | **6** |
| IELTS BAND 8.5 | 9 |
| IELTS BAND 9.5 | 9 (clamped to max) |
| "no number at all" | unchanged |

And the scales that legitimately use half points are untouched:

| exam | criterionStep | "4.5" |
| --- | --- | --- |
| IELTS | 1 | snaps |
| GRE Analytical Writing | 0.5 | **left as 4.5** |
| TOEFL | 1 | snaps to 4 |

GRE is the case worth calling out: its 0-6 scale really is scored in half point
increments, so it must NOT be snapped. Deriving the step from the rubric rather
than hardcoding "round IELTS" is what keeps that correct.

## One judgement call worth knowing about

Half values round UP: 6.5 becomes 7, 5.5 becomes 6. That mirrors how IELTS
rounds an overall score upward at the half. Rounding down would be the
conservative reading and is a one-character change (`Math.floor` in place of
`Math.round` in `normaliseVerdict`) if the marking should be stricter.

## Ritual

- `node --check` writing-rubrics.js, corrector.js - ok
- em-dash scan - clean
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity - all PASS
- bump: writing-rubrics.js v3 -> **v4**, corrector.js v13 -> **v14**,
  CACHE_VERSION v323 -> **v324**
- `bump.js --check` - OK
