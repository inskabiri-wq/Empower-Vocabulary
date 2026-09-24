# 2026-08-26 - pronunciation marking, the Placement chip, and two access holes

## 1. TWO ACCESS HOLES, and the second was worse than reported

Reported: Parisa sees the Placement tab without being ticked in Access, and
there is no tick for Courses at all.

### Placement: a grant that everyone passed

`revealTab()` ended with:

```js
if (granted) { mode = 'manage'; show(); return; }
if (classes.length) show();          // <-- ANY teacher with a class
```

So the Access tick decided whether a teacher could MANAGE placement, and
nothing at all decided whether they could SEE it. A read-only reports view was
meant as a courtesy and became a hole. Removed: the grant is now the only way
in.

### Courses: no gate of any kind

The Courses sidebar button had **no `display:none` and no check anywhere**.
Every teacher could open the mini-course admin and activate or deactivate the
course and its modules for the whole organisation. There was no `coursesAccess`
document, no column in the Access panel, nothing.

Added, mirroring Placement exactly: a **Courses** column in Admin > Access
(`settings/coursesAccess.teacherUids`), autosaving, audit-logged, included in
"Revoke all", included in the "Semi-admin (all)" preset, and listed even for a
teacher granted ONLY Courses (or an admin could not see or revoke it). The tab
starts hidden and `policy-course-admin.js` reveals it for the admin or a
granted teacher. It fails closed: a read error leaves it hidden.

### THE PART THAT MATTERED MOST: the rules ignored both grants

Hiding a tab is not a permission. The rules said:

```
match /settings/policyCourse    { allow write: if isTeacher(); }
match /settings/placementConfig { allow write: if isTeacher(); }
```

**Any teacher could write either document directly**, grant or no grant, tab or
no tab. The dashboard had a panel handing out exactly these two capabilities
and the server was not consulting it.

Both now go through one helper that reads the grant document, and fails closed
when it is missing:

```
function _granted(grantDoc) {
  return isAdmin() || (
    isTeacher() &&
    exists(/databases/$(database)/documents/settings/$(grantDoc)) &&
    request.auth.uid in get(...).data.get('teacherUids', [])
  );
}
```

### Verified against the emulator with the real rules

A teacher **with an assigned class** (the exact case that leaked) and no grant,
against a granted teacher:

| attempt | result |
| --- | --- |
| ungranted teacher writes `policyCourse` | **denied** |
| ungranted teacher writes `placementConfig` | **denied** |
| ungranted teacher READS `placementConfig` | ALLOWED (students need it) |
| granted teacher writes `policyCourse` | ALLOWED |
| granted teacher writes `placementConfig` | ALLOWED |
| granted teacher widens their OWN grant | **denied** |

`firestore.rules` was copied to the scratchpad first. 18 lines added, nothing
else touched, and the em-dash count is unchanged at 41 (all pre-existing).
The AI Quiz end-to-end was re-run afterwards against the new rules: **0
failures**.

## 2. Pronunciation is marked now, carefully

The activity captured nothing: it spoke a word and the student pressed Next.
That is why it had no score and no per-question detail anywhere.

**The concern, stated before building it:** browser speech recognition is
trained on fluent speech. A Turkish speaker pronouncing a word perfectly well
can still come back mis-transcribed, and marking hard on that discourages
exactly the students who need the practice. Three rules follow:

1. **Optional.** Listen-and-repeat is unchanged; the microphone is an offer.
   The button does not appear at all on Safari or Firefox.
2. **Only attempted words count.** Skipping is not a wrong answer. A session
   where nothing was attempted stays **unscored**, so it cannot drag an average
   down, and the end screen still says "10 words practised".
3. **Generous with the recogniser, strict about the word.**

### The matcher, and a mistake my own test caught

The first version allowed an edit or two of slack. It accepted **"car" for
"cat"** on a three-letter word. Tightening the length rule then still accepted
**"ship" for "chip"** and **"through" for "thorough"** - the exact minimal pairs
a pronunciation exercise exists to teach.

Fuzzy distance was the wrong tool: it cannot tell "the learner said a different
word" from "the recogniser misheard". It is gone. Recogniser noise is absorbed
a different way instead - **five alternatives are requested and any of them
counts**, punctuation and articles are stripped, a word inside a returned
phrase counts, and British/American spellings are folded together by seven
narrow suffix rules.

| accepted | rejected |
| --- | --- |
| exact, punctuation, "to abandon", "the abandon", inside a phrase | ship/chip, through/thorough, car/cat, bad/bat |
| colour/color, realise/realize, centre/center, programme/program, travelling/traveling, acknowledgement/acknowledgment | live/leave, desert/dessert, thin/then |
| | four/for, our/or, rise/rice, are/aer (the spelling rules do not over-reach) |

26 cases, all passing.

Per-word detail is saved as `pronDetails` in the same `{q, picked, correct, ok}`
shape as grammar and vocabulary, so the Activity tab and both student-detail
views expand it with no extra work. A microphone refused or a silent room
records **nothing** rather than a wrong answer.

## 3. Placement moved again, to a chip inside Content

It is now a category chip next to **Mini courses**, not an Admin sub-tab. The
sub-tab added earlier was removed. `content-controls.js` owns the chips and
renders an empty mount; `placement-admin.js` fills it through a small
`window.PlacementAdmin.renderContent()` surface, so neither file knows the
other's markup.

## 4. That box on a phone

The Content rows are `[icon] [title + status] [Activate/Deactivate]` built as a
nowrap flex row with inline styles and **no class to target**. At 390px a title
like "Module 1 - Purpose and Rules of AI Use" and a button cannot share a line.

Added `.cc-row` / `.cc-row-btn` hooks, and under 620px the button moves to its
own full-width line beneath the title with a bigger tap target. Nothing hidden.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan on every touched file - clean (rules unchanged at 41,
  pre-existing)
- gates: all eight PASS
- AI Quiz e2e against the NEW rules: 20 students, 4 questions, **0 failures**
- bump: pronunciation.js v2, auth.js v10, games.js v4, student styles.css v52,
  content-controls.js v14, dashboard-v2.css v18, ai-writing-admin.js v10,
  placement-admin.js v13, policy-course-admin.js v15,
  CACHE_VERSION -> **v359**; `--check` OK

## Note for the deploy

`firestore.rules` changed, so this needs a **rules deploy**, not only hosting.
Until then the two settings documents stay writable by any teacher.
