# 2026-08-23 - eight reported items: logout delay, admin tabs, sticky bar, stray text

Six fixed with a cause found and measured. Two could not be reproduced and need
a screenshot.

## 1. Logout took about a second after the dialog closed

`teacher/js/modals.js`:

```js
if (typeof ActivityLogger !== 'undefined') {
  await ActivityLogger.logLogout();     // a Firestore round trip
}
await auth.signOut();
```

The dialog closes the instant you tap Log out, then the app AWAITED a Firestore
write before signing out. That await is the pause, and it is the exact
behaviour reported: popup gone, then a beat, then logged out.

The write is now issued without being awaited. It goes out while still signed
in, so it is in flight before `signOut()` runs and normally lands. If a slow
network means it does not, the cost is one missing row in the activity log,
which is far cheaper than a second of the user's time on every single logout.

Swept the rest of the app for the same shape: this was the only one.

## 5. Cancel / Save bar was a dark strip on a white modal

Reported as "cancel and save stays when we scroll down or up". It is sticky by
design; the problem is what it looked like.

Five copies of this inline style:

```html
style="position: sticky; bottom: 0; background: var(--bg-card, #152035); ..."
```

`--bg-card` IS defined, at `#152035`, and has **no light-mode override**, so the
`#152035` fallback was never even reached and every one of these painted a dark
navy band across the bottom of a white modal, following you as you scrolled.

Measured before: `rgb(21, 32, 53)` on the white theme.

An inline style cannot respond to a theme, so the five copies were replaced by
one `.modal-sticky-actions` class using `--t2-surface`, which IS theme-aware.

| | before | after |
| --- | --- | --- |
| light mode | rgb(21,32,53) | **rgb(255,255,255)** |
| dark mode | rgb(21,32,53) | rgb(22,27,34) |
| border | fixed blue | themed |

## 2. Admin sub-tabs

Eight pills (Teachers, Features, Access, Demo accounts and the rest) wrapping to
**four ragged rows** of different lengths, each only 35px tall.

Now one swipeable row, matching the skill strip: `nowrap` with horizontal
scroll, scrollbar hidden on both engines, scroll-snap, and 44px tap targets.

Verified the container itself fits (358px box in a 386px column), the page does
not scroll sideways, and the off-screen tabs are reachable by swiping.

## 3. Student row flashed highlighted before opening

A tap selects text before it fires the click, so the whole row flashed as
selected and only then opened the report. The row is a button in all but name.
`user-select: none` plus a transparent `-webkit-tap-highlight-color`, with an
`:active` background kept so the tap is still acknowledged.

## 6 + 8. The stray sentences, deleted

Both reports were the same three lines in the assignment Preview:

- "The student clicks Start {skill} on their dashboard -> lands on the {skill}
  skill home -> picks the exam above." (reading and listening)
- "The student clicks Start Practice -> the vocabulary trainer loads ... They
  score points and must reach 100% ..." (vocabulary)
- "The {skill} skill runner isn't built yet - preview will follow when it is."
  (everything else)

Gone. The exam and details boxes above them already say what the preview is for.

Three other "isn't built yet" strings remain and were deliberately NOT touched,
because they are functional messages rather than stray commentary:

| where | when it shows |
| --- | --- |
| `student-assignments.js:1739` | a student taps a skill with no runner |
| `teacher-assignments.js:145` | a teacher opens an unsupported creation form |
| `teacher-dashboard.html:2862` | same, in the modal |

Removing those would leave a dead tap with no feedback. Flagged for a decision.

## 4 and 7: could not reproduce

Measured both against markup lifted from the shipped page, at 390px:

| | result |
| --- | --- |
| skill picker modal (New Assignment) | box 347px, fits, grid collapses to one column, no overflow |
| writing assignment form | box 371px, fits, no row overflows, no input overflows |

Neither shows overflow or a broken track, so whatever is wrong is something my
overflow checks do not capture (spacing, order, or something only visible with
real data). Asked for a screenshot rather than guess, since guessing here is
what produced two regressions earlier this week.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity - all PASS
- bump: mobile-shell.js v10, modals.js v3, dashboard-v2.css v17,
  teacher-assignments.js v3, CACHE_VERSION v329 -> **v330**
- `bump.js --check` - OK

## Pattern, again

Item 5 is the third defect this week caused by an inline style that no
stylesheet rule could reach: the inline grid on the Overview, the inline flex on
the Activity filters, and now five inline sticky bars with a hardcoded dark
background. Widening `teacher-mobile-check.js` to flag inline `background` and
`display` declarations on structural rows would catch the whole family.

---

# Follow-up: the rest of the developer notes, and a gate for them

The sentences reported were not only the ones I removed. The full set included
two I had not found:

- `add more or toggle availability in y/assignments/js/exam-registry.js`
  A SOURCE PATH, shown to teachers under the exam picker.
- `This is what your students will see when they open the assignment from
  their dashboard.`

Both gone. The exam hint is now just the count of available exams; the preview
caption is deleted.

## Two more found by sweeping

I had said the remaining "isn't built yet" strings were functional messages and
left them. Re-reading them, they were not fit to show anyone:

| where | was | now |
| --- | --- | --- |
| teacher, unsupported skill | "structurally supported but the creation form isn't built yet. We'll wire it up in the next phase." | "{Skill} assignments cannot be created yet. You can assign {list} now." |
| student, unsupported skill | "The {skill} skill runner isn't built yet. Your teacher will know." | "{Skill} practice is not available yet. Please ask your teacher." |

"We'll wire it up in the next phase" is a developer's roadmap in a teacher's
homework tool. Both now say what the person can do instead of what the codebase
has not done.

## `tools/ui-text-check.js`

This is the second time these have been reported and the second time I found
more of them only after being told. They are easy to write while building a
feature and nearly impossible to spot afterwards, because each appears in one
state of one screen that nobody revisits.

The gate flags, in anything that looks like interface text:

- source file paths and script or stylesheet names
- "isn't built yet" / "not built yet"
- TODO, FIXME, XXX
- "wire it up", "next phase", "Phase 2"
- lorem ipsum and placeholder copy

It skips comments (tracking `/* ... */` ACROSS lines, since a single-line test
flagged a note sitting inside a block comment in `writing-rubrics.js`), asset
references, and `fsmvu-loaders.html`, which is a documentation page where naming
a stylesheet is the point.

Verified both ways: **PASS** on the cleaned tree, and re-introducing the
exam-registry path makes it **FAIL**.

## Ritual

- `node --check` on all four touched files - ok
- em-dash scan - clean
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity,
  **ui-text-check** - all PASS
- bump: exam-form.js v2, teacher-assignments.js v4, student-assignments.js v12,
  CACHE_VERSION v330 -> **v331**
- `bump.js --check` - OK
