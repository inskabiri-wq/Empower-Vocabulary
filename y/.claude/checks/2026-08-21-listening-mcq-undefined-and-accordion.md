# 2026-08-21 - "undefined." distractor, transcript accordion, listening 2 + 3

## 1. Distractor D rendered as "undefined." (reported)

`renderQuestion()` in `student/js/listening-exam.js` hardcoded
`const letters = ['a', 'b', 'c']`. Any question with a fourth option rendered
`letters[3]`, which is `undefined`, so the student saw a literal **"undefined."**
label and the radio carried `value="undefined"`.

That is worse than cosmetic: the key for those questions is `d`, and a radio
whose value is the string `undefined` can never equal `d`, so **picking the
correct answer was always scored wrong**. Silent - no error anywhere.

Fixed by deriving the letters from the options the question actually has.

Audit of the shipped data (`scratchpad/audit.js`, loads the real file in a vm):

| exam | Part B options | affected |
| --- | --- | --- |
| sample-fsmept | 3 | no |
| fsmept-best-places | 3 | no |
| fsmept-forger | 4 | **yes, all 10** |
| fsmept-museum | no Part B | no |

So the report came from The Forger. Grepped the whole tree for other hardcoded
`['a','b','c']` lists: this was the only one.

## 2. Fill-blank questions rendered with no input box

The renderer replaced a **literal** `'__________'` (ten underscores). The sample
exam uses ten, but the FSMEPT papers use fifteen and seventeen, so no
replacement happened and the sentence rendered with no `<input>` at all - an
unanswerable question that still counted. Now matches `/_{3,}/`, and appends the
box if a statement has no blank rather than dropping it.

## 3. Fill-blank grading ignored alternatives

Grading was `userAnswer === q.answer.toLowerCase()`. Listening 2's key contains
`up to date / current`, meaning either is acceptable; exact matching marked both
correct answers wrong. Added `acceptsFill()`, splitting only on a **spaced**
slash so a real answer like `24/7` is not torn in half. Answers with no spaced
slash behave exactly as before, which is all five answers the app shipped with.

## 4. Transcript drawer had no accordion animation (reported)

Two independent causes, either one enough to kill it:

1. Closed track was `0fr`, open track a length. **Different types do not
   interpolate**, so the declared transition never ran.
2. The panel toggled `display: none` / `flex`, and `display` is not animatable,
   so it appeared and vanished in one frame regardless.

Fixed: both track ends are lengths now, and the panel animates opacity, padding
and border-width with `display 0.32s allow-discrete` so it stays rendered for
the whole closing animation. `@starting-style` supplies the opening from-values.
The `allow-discrete` transition is a **second** declaration duplicating the safe
one, so a browser that rejects it keeps the rest instead of dropping the lot.

Kept `display:none` while closed on purpose: a 156-cue transcript is then never
laid out until the drawer is actually opening.

Mobile was at risk here - the tab switcher shows the panel *without*
`.drawer-open`, so the new closed-state `opacity:0` would have opened the
Transcript tab onto a blank pane. Added an explicit reset inside that media
query.

## 5. Listening 2 (News Media) and 3 (Slang) - parsed, NOT wired

Two more format variations, both handled:

- **Part A of paper 2 is gap-fill**, not true/false (7 answers: declining, 70%,
  important part, up to date / current, interactive, mistakes, the headline).
- **Part B options carry no `a.` prefix in either paper.** The lettered parser
  found zero questions. Recovered by block grouping, but only under checks that
  make a wrong guess impossible: the line count must divide exactly by the
  number of answers in the key (45 / 9 = 5, so 1 question + 4 options), and
  every key letter must fall inside the resulting option count. It refuses
  rather than guess.

Parse results, with the three existing exams re-parsed to prove no regression:

```
forger      cues=111  PartA=6 (truefalse)  PartB=10  options=4
usa         cues=53   PartA=6 (truefalse)  PartB=11  options=3
museum      cues=60   PartA=6 (truefalse)  PartB=0
newsmedia   cues=156  PartA=7 (fillblank)  PartB=9   options=4
slang       cues=114  PartA=6 (truefalse)  PartB=9   options=4
```

Spot-checked the keys against the content: News Media's MCQ answers are
cross-consistent with its own Part A gaps (gap 5 "interactive" matches Q4, gap 6
"mistakes" matches Q5).

### BLOCKER: the audio is still .wma

`News Media.wma` (9.4 MB) and `Slang.wma` (9.5 MB). **No browser can decode
WMA.** Whisper produced good SRTs because it brings its own decoder, which is
why the transcripts look ready while the exams cannot ship.

Added a hard audio-existence gate to the importer, control-tested both ways
(newsmedia fails, forger passes). Nothing has been added to
`listening-exam.js` or `exam-registry.js` for these two - an exam whose audio
404s fails silently in the browser, the player simply never starts.

The SRT timings stay valid for an mp3 converted from the same source.

## Verification

| harness | result |
| --- | --- |
| `tools/demos/listening-question-render-trace.html` | 32 / 32 |
| `tools/demos/transcript-accordion-trace.html` | 17 / 17 |

Both load the real files - no stubs.

The accordion harness needed care: this preview pane is a hidden tab, so it
never composites and sampling a frame proves nothing. Instead it asks
`getAnimations()` what the engine created, because **a browser only builds a
`CSSTransition` when the two values can genuinely interpolate**. Control test,
overriding the rule back to `0fr` at runtime:

```
with 0fr:  ["column-gap", "row-gap"]                              <- no grid transition
with 0px:  ["column-gap", "grid-template-columns", "row-gap"]     <- fixed
```

One harness assertion was itself wrong at first (reading the open track
mid-transition returns the interpolated value, still `0px` at t=0); it now
finishes the transition before reading.

## Ritual

- `node --check` on listening-exam.js, import-listening.js, tile-images.js - ok
- em-dash scan of all changed files - clean
- `node tools/inline-css-check.js` - PASS
- `node tools/bump.js student/js/listening-exam.js student/css/extra.css`
  - listening-exam.js v11, extra.css v32, CACHE_VERSION v293 -> **v294**
- `node tools/bump.js --check` - OK, no drift

## Left open

- Convert the two .wma files to mp3, then the import is a single command each.
- Not deployed. v294 is undeployed.
