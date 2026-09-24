# 2026-08-26 - why Vocab Race and Grammar Race had a different error popup

Reported with two screenshots: a small corner toast reading "Please select a"
for Vocab Race / Grammar Race, and a centred card reading "📊 Missing level /
Pick a level first. / OK" for everything else. Asked: search and say why.

## Why

**Both popups come from the same file.** `classroom-teacher.html` hosts every
classroom game, and it answers the same mistake in two different ways depending
on which button you press.

| you press | handler | what you get |
| --- | --- | --- |
| Create Session (Vocab Race / Grammar Race) | `classroom/js/teacher.js:297` `showError()` | `.cls-toast`, top corner, fades |
| any of the eight other game launchers | inline script, `classroom-teacher.html` lines 1309-1503, 9 x `AppDialog.alert(...)` | centred card, title, icon, OK |

Nothing decided that. It is age.

Vocab Race is the original classroom flow and its `showError()` predates
`js/app-dialog.js`; it hand-rolls a toast div. The eight launchers were written
afterwards, when the shared dialog already existed, and used it. The page has
loaded `js/app-dialog.js` at line 12 - in `<head>`, long before
`classroom/js/teacher.js` at line 1107 - the entire time, so the old code could
always have called it and simply never did.

**This is also why my previous pass did not fix it.** I unified the toast
CLASSES (`.mg-toast`, `.heist-toast`, `.trust-toast` and friends all took
`.cls-toast`'s appearance) and reported the popups as consistent. They were
consistent, as toasts. But the comparison being made is toast versus MODAL, and
no amount of matching toast styling closes that. I checked that the toasts
looked alike instead of checking what each button actually opens.

## Fix

`showError()` now routes to `AppDialog.alert()`, which converts all seven call
sites in `teacher.js` at once. The toast body is kept only as a fallback for
the case where `app-dialog.js` did not load, because a validation message that
silently fails to appear is worse than one in the wrong shape.

Two messages were also reworded so the two halves of the page say the same
sentence rather than a near-miss:

| before | after |
| --- | --- |
| `showError('Please select a level')` | `'Pick a level first.'` + title `Missing level` + icon `📊` |
| `'No words found for selected level/unit'` | `'No words found for that level and unit.'` + title `Nothing to play` + icon `📭` |

The first is now word for word identical to what the eight launchers show.

`kind` still selects a title and icon (`error` -> Cannot continue / ⚠️,
`info` -> Nothing to show / ℹ️, `success` -> Done / ✅) and callers may override
both, which is how the two above are done.

## Verified, not assumed

`showError` and `SHOW_ERROR_STYLE` were pulled out of the shipped
`classroom/js/teacher.js` by brace matching and evaluated in a frame with the
real `app-dialog.js` and stylesheets, then called:

```
rendersModal:  true
stillAToast:   false
title:         true      (Missing level)
message:       true      (Pick a level first.)
icon:          true      (📊)
hasOk:         true
rendered:      "📊Missing levelPick a level first.OK"
```

Identical to the second screenshot.

## Deliberately NOT changed

The eight game pages keep `MG.toast` for in-game feedback ("Only 12 questions
in the modules you chose"). Those fire mid-game, and a modal that has to be
dismissed in front of a room is worse than a notice that fades. The rule this
settles on is the one the rest of the app already follows:

- **blocking validation, where the teacher must go and fix something** -> modal
- **transient feedback during play** -> toast

`classroom/js/student.js` also has a `showError`, but it writes into the join
screen's own `#errorMessage` element and only falls back to `AppDialog.alert`
when that element is absent. That is an inline field error, not a popup, and it
matches the eight game join screens.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on `teacher.js` - clean
- gates: lobby, ui-text, inline-css, profile-hub, teacher-mobile,
  grammar-sanity - **all PASS**
- bump: `teacher.js` v4 -> **v5**, CACHE_VERSION v342 -> **v343**;
  `bump.js --check` OK
