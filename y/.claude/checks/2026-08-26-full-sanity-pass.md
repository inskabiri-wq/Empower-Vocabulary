# 2026-08-26 - Placement as its own tab, the resume bar explained, and a full sanity pass

## 1. Placement is now an Admin sub-tab

Asked for a tab. "Placement" was already a MAIN sidebar tab sitting directly
after Courses (the mini course); what was buried was the parts/counts panel I
had appended to the bottom of Admin > Content.

It now has its own entry in the Admin sub-nav, between Content and Reports:

```
Teachers | Features | Content | 🎯 Placement | Reports | Access | Demo | Roster | Organizations
```

- new `#placementContentPanel`, registered in the sub-nav's `IDS` list (without
  that the button would have done nothing)
- the mount was **removed** from inside the Content panel, not duplicated
- the Placement MAIN tab's copy now points at **Admin > Placement**, not
  Admin > Content

Split of responsibility: this tab CONFIGURES the test (which parts run, how
many questions per band). The Placement main tab RUNS it (exam choice, writing
mode, results). Same `cfg`, same `saveCfg`, one source of truth.

## 2. The resume bar now explains itself

It said: *"Quiz MVRTQ is still open. It has not started yet."* with two
buttons. The reaction was "what is this, what should I do with that?" - which
is the correct reaction, because the bar answered none of the three questions a
person actually has.

It now says where the room came from, what state it is in, and what each button
does:

> **You have a quiz room still open: MVRTQ**
> You created it earlier and never ended it, so it is still live and any
> students who joined are still waiting on it. Nobody has started it - it is
> still sitting in the lobby.
> *Go back to it reopens that room where you left off. Discard closes it for
> everyone and leaves you here to set up a new one. If you are not sure,
> Discard is safe.*

(For MVRTQ specifically: nothing was ever started, so Discard.)

---

# 3. Full sanity pass over everything done today

## Structural

| check | result |
| --- | --- |
| `node --check` every JS file in the tree | **160 files, 0 failures** |
| CSS braces and comments, every stylesheet | all balanced |
| `<div>` balance, all 11 edited HTML pages | all matched |
| em dashes across every file touched today | **0** |

### One real defect found, and it was NOT from today

`css/app-settings.css` had a comment block **closed early**: a `*/` at what is
now line 787, with six more lines of prose after it, then a second `*/`. Those
six lines were being parsed as CSS, and CSS error recovery swallows everything
up to the next `{` - which was the opening brace of the `.as-launch` rule.

**The settings-gear styling was silently not applying.** Confirmed by measuring
after the fix: the gear is `44x44` with a `12px` radius again, and the new
`.ll-file` picker resolves to its `10px` radius. Every other stylesheet in the
tree was swept for the same defect; none had it.

## Gates - all eight PASS

lobby, ui-text, inline-css, profile-hub, teacher-mobile, grammar-sanity,
game-registry, roster-import-torture (29 cases).

## Behaviour, measured rather than assumed

### Headers, all nine classroom hosts

| | desktop 1280 | phone 390 |
| --- | --- | --- |
| overflow | **0 everywhere** | **0 everywhere** |
| identical radius + background | light **yes**, dark **yes** | |
| game name folded into the lockup | **all nine** | |
| actions container found for the wheel | **all nine** | |

### Toasts

Every toast on every page is **58px tall**. Before today's `body` qualifier it
stretched from `top:88px` to minigames' `bottom:30px` - about **790px**, painted
over the whole lobby. Both toast families (`.cls-toast` and the five mini-game
classes) resolve to the same top, max-width and font-size on desktop and phone.

### AI Quiz - end to end against the real rules

Emulator, 30 students, 6 questions: **0 failures**.

- session document **206 bytes**, so the per-question fan-out stays cheap
- ladder **60 reads** total, ten per question regardless of room size
- top score exactly **720 (6 x 120)** - concurrent `increment` did not race
- a student **cannot** write another student's score

### AI Quiz - the 19 changes from today, all asserted

Setup always renders on boot (no auto-hijack) · `tryResume` gone · resume is a
bar with two buttons · Discard closes the room for students · the bar explains
both buttons · roster listener released at quiz start · checkpoints on create
and each question · cleared on end · game report filed · two DIFFERENT module
errors · blocking validation uses the shared dialog · student signs in on page
load · retry with backoff and jitter · refresh guard only once in a room ·
resume mount present · game-report.js, app-dialog.js, refresh-guard.js all
loaded · canvas is a sibling of `.floating-shapes`, not inside it.

### Listener release, re-measured at 300 players

| | callbacks per question | per 20-question game |
| --- | --- | --- |
| listener attached (old) | 126 | 2,520 |
| released at quiz start (now) | **0** | **0** |

Fan-out unchanged and linear: one host write, 60 listeners, **60 callbacks**.

### Roster - the real instructors file, after every change today

28 teachers out of 16 classes, **0 hard problems**, 28 flagged as needing an
email. `Zach [D-302,D-303]`, `Büşra [D-302,D-304,B-124]`.

### Placement

All **19 config shapes** still resolve correctly. Sub-tab wiring verified: the
button exists, its panel exists, it is in the `IDS` list, the mount is inside
it, and the mount is **gone** from the Content panel.

## Ritual

- bump: aiquiz-teacher.js v5, minigames.css v10, app-settings.css v54 (31
  refs), placement-admin.js v11, CACHE_VERSION -> **v351**; `--check` OK

## Still open, honestly

- **The lag.** Measured and ruled OUT of the QR panel (21.5ms). Not
  investigated further. Next suspect is the Admin tab loading 400 students plus
  1000 sessions on every open.
- **The needs-attention average** on the Activity tab is still computed from the
  1000-session window. The per-student detail view was fixed; this one needs
  rollup-on-write.
- **The ToS revision** is drafted and waiting on the KVKK office.
