# 2026-09-02 - one sound engine, and the classroom games can finally be heard

## What was wrong

The engine lived in `student/js/ui.js`, loaded by exactly **one** page. So
`playSound()` did not exist on any classroom game page, and the nine games had
been silent since they were written. A second, cruder copy sat inline in
`app.html` - a single oscillator, and a **brand new AudioContext on every
call**, which is the precise bug the shared version had been written to fix.

Meanwhile the "Sound Effects" switch appears on 32 pages and governed two.

## Now: js/sound.js

`window.LLSound`, loaded beside `js/app-dialog.js` on 18 pages. Still entirely
synthesised - no audio files, nothing to download, works offline.

The three originals were moved **note for note**, and the suite asserts the
exact frequencies so vocabulary sounds identical: correct is still E5 + G#5 +
E6, incorrect still F4 + A4, complete still a four-note arpeggio with
harmonics.

Eight new cues for the classroom: `join`, `start`, `tick`, `tickUrgent`, `end`,
`score`, `win`, `fail`. All short and quiet on purpose - they play through hall
speakers, often several times a minute, and anything with a tail turns to mush.

`ui.js` and `app.html` keep thin `playSound()` wrappers so all fifteen existing
call sites work unchanged.

## Wired into the games

**AI Quiz host** (the one that matters for the event): a blip as students
arrive, a two-note rise on Start, a tick on each of the **last five seconds
only**, a close when the question ends, a flourish at the results.

**The other seven host games** get the join cue through their shared
`renderRoster(players)`.

Two guards that matter at cohort scale:

- **join is throttled to one per 400ms.** A thousand students arriving would
  otherwise fire a cue per arrival, and the host machine would be scheduling
  oscillators instead of drawing the roster. Verified: 50 rapid joins play
  once.
- **it only fires when the roster GROWS**, so a snapshot caused by a score
  change stays silent.

The countdown ticks only the final five seconds, once per second. `runTimer`
polls at 250ms, so without a guard each second would tick four times.

## Student phones stay silent, deliberately

These games run on a projector with a room full of phones. A cue on every
device is a thousand chimes at once. The eight `classroom-*-student.html` pages
do not load the engine, `MG.sfx` is a no-op there, and **the gate fails if that
changes** - so it has to be argued with rather than drifted into.

## A live bug found on the way

`classroom-aiquiz-teacher.html` and its student page carry a 🎵 button wired to
`toggleMusic()`, but both call `MG.setupMusic()` with **no tracks**. Pressing it
ran `playRandom()`, which read `tracks.length` on `undefined`: a TypeError, on
the host page for a 1000-student event. `setupMusic` now treats an empty
playlist as a real case - the button is hidden and every entry point is a
no-op.

Also worth knowing: background music in bingo/tug/scramble streams from
**soundhelix.com**, a third-party demo site, allowed explicitly in the CSP
`media-src`. Nothing changed there, but a live demo depending on someone else's
server is worth a decision.

## Executed: 17 checks against the real engine

Against a fake Web Audio API, asserting the notes actually scheduled:

| | |
| --- | --- |
| all 11 cues registered, every one schedules a note | PASS |
| the three originals keep their exact frequencies | PASS |
| **20 plays create exactly ONE AudioContext** | PASS |
| sound OFF plays nothing and opens no context | PASS |
| default is ON when the key is absent | PASS |
| **50 rapid joins play once, not 50 times** | PASS |
| unknown or missing types never throw | PASS |
| no Web Audio support: no throw, returns false | PASS |

## New gate: tools/sound-wiring-check.js

A sound that does not play makes no error - which is exactly why nine games
were silent for months and nothing said so. It asserts the wiring: the API
exists, every cue that is called is defined, host pages load the engine, pages
with their own `playSound()` load it, nobody creates a second AudioContext, and
student game pages stay silent.

**Proved against all three failures**: removing the tag from `app.html`,
removing it from a host page, and adding it to a student page each fail with
the right message.

## A mistake worth recording

The scripted edit that added the join cue to seven files **wrote a literal
`\x01` byte** where the captured function signature should have gone, deleting
`function renderRoster(players) {` from all seven. `node --check` caught it
immediately, but there was **no backup**, and `git checkout` is forbidden here
because the tree is long-lived uncommitted work.

Repaired by matching the stray byte and reconstructing the two lines, then
verified: 0 syntax failures, no control bytes anywhere in `classroom/js`,
`js`, or `student/js`, and all seven have both the declaration and the call.

The lesson is the one already in the notes and ignored again: copy to the
scratchpad before a scripted rewrite of multiple files.

## Ritual

- `node --check` across every `.js` - 0 failures
- six executed suites - all pass
- gates: **eighteen**, all PASS (sound-wiring-check is new)
- em-dash scan - clean
- bump: sound.js v1, ui.js, minigame-core.js and all eight host game scripts,
  CACHE_VERSION -> **v395**; `--check` OK

## Not verified in the real app

Cue design is a judgement call that only a real room settles. Volumes and
lengths were chosen for hall speakers but heard by nobody yet. Worth one pass
with the projector before the event, especially the countdown tick.
