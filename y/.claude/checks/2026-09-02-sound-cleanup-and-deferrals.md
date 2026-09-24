# 2026-09-02 - the remaining sound faults, and what I deliberately did not do

Asked to fix everything about sound, with a hard instruction not to break
anything before the event. Those two pull against each other, because some of
the list were faults and some were new features. Faults fixed; features
deferred, listed here so the choice is visible rather than quiet.

## Fixed

### 1. The timer beep ignored the mute switch

`js/classroom-timer.js` made its own 880Hz beep and never checked
`soundEnabled`. It is on six pages **including the teacher dashboard**, so
switching Sound Effects off silenced the whole app except the timer - which
reads as a broken switch rather than a missing feature.

One guard, reading the same key directly rather than through `LLSound`, so
the file keeps working on any page with or without the engine. The rule is
identical: default ON, only an explicit `'false'` mutes.

Executed against the real `beep()`:

| | |
| --- | --- |
| default ON (key absent): beeps | PASS |
| explicitly ON: beeps | PASS |
| **MUTED: silent** | PASS |
| ...and does not even open an AudioContext | PASS |
| blocked localStorage (private mode): no throw, still beeps | PASS |
| no Web Audio support: no throw | PASS |

### 2. The switch under-described itself

It said "Play sounds for correct/incorrect answers". It now governs classroom
lobby, countdown, round and result cues across nine games, plus the timer.
Reworded to "Answer feedback, classroom game cues and the timer".

### 3. The dead music button was on EIGHT pages, not one

I reported it on the AI Quiz. Checking all fourteen pages that carry a 🎵
button: **eight** call `setupMusic()` with no playlist - AI Quiz (both), Heist
(both), Trust (both), Vocab Race, and the classroom host page. Every one threw
a TypeError when pressed. The earlier fix hides the button on all eight.

### 4. Gate extended

`sound-wiring-check` now also asserts that every sound source obeys the one
switch, and that the switch describes what it controls. **Proved**: removing
the timer's guard fails the gate with the right message.

## Deliberately NOT done before the event

Each of these is a change in behaviour, not a repair. Shipping them days
before a 1000-student demo is the risk that was asked to be avoided.

**Giving the eight silent pages a music playlist.** The button is hidden and
nothing crashes. Adding music means adding a third-party dependency to eight
more pages. If those pages should have music, that is a decision to make
calmly afterwards.

**Precaching the 44MB of listening audio.** This one I would argue against
permanently, not just now: a service worker that precaches 44MB pays that cost
on every install, risks the storage quota, and the exams are unlikely to run
during the event anyway. Streaming is the right default.

**Sounds in the reading, listening and writing exams.** A chime after every
question in a test is arguably wrong, not missing. It needs a decision, not a
patch.

**Pronunciation.** The one place the student is already speaking into a
microphone. A cue could collide with recognition, and I have no way to test
that without a real device and a real voice.

**A volume control.** New UI in a settings panel that appears on 32 pages.
Genuinely useful for hall speakers, and exactly the kind of change that should
not land days before it is needed.

**Teacher dashboard sounds.** No fault; just an absence, and I would lean
against adding them at all.

## One risk left standing, knowingly

The six pages that DO have music stream it from **soundhelix.com**. I checked
the failure path: `play()` returns a promise that is caught, so an outage or a
block means silence, never a crash. That is an acceptable failure mode and I
left it alone. Worth hosting the files yourself later; not worth touching now.

## Ritual

- `node --check` across every `.js` including functions - 0 failures
- **eight** executed suites - all pass
- gates: eighteen, all PASS
- em-dash scan - clean
- bump: classroom-timer.js, app-settings.js v39 (32 references),
  CACHE_VERSION -> **v397**; `--check` OK

## Verify after deploying

Turn Sound Effects off and start a classroom timer. It should be silent. That
is the one change here with visible behaviour, and it takes ten seconds to
confirm.
