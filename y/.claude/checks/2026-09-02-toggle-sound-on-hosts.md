# 2026-09-02 - the mute switch reaches the pages that make the noise

## The gap

The settings panel decides whether to show the Sound Effects row by asking
`typeof window.toggleSound === 'function'`. That function was defined in two
places only: `student/js/ui.js` and inline in `app.html`.

So on every classroom **host** page - the projector, in a hall, running the
cues added this week - there was no Sound switch, and after the volume slider
was placed under it, no slider either. The control was furthest from the person
who needs it: a teacher whose countdown tick is too loud had to open the
student dashboard to fix it.

## Fix

`window.toggleSound` is defined in `js/sound.js`, so it exists wherever the
engine does. Nine host pages gain both the switch and the volume slider.

**It is a guarded fallback, not a replacement.** The dashboard and `app.html`
load their own version *after* this file and their function declarations
replace it, which is what should happen: theirs also update an on-page
`#soundToggle` button and its icon. The guard means load order cannot turn
that into a clobber either way.

Script tag order does not matter here, and the gate says so explicitly: the
panel mounts on `DOMContentLoaded`, by which point every script on the page has
run. `placement.html` loads them in the opposite order and is fine.

## Executed

| | |
| --- | --- |
| the switch now EXISTS on an engine-only page | PASS |
| one press mutes, another unmutes | PASS |
| persisted as exactly `'true'` / `'false'` - the form the panel reads | PASS |
| switching ON unlocks the audio context on that gesture | PASS |
| muted: `play()` returns false | PASS |
| **ui.js's richer version still replaces the fallback** | PASS |
| ...and still writes the same key | PASS |

## The gate matched my own comment

The first version of the new assertion was `/window\.toggleSound\s*=/`, which
also matched the **prose** in the comment above the assignment
("asking `typeof window.toggleSound === 'function'`"). So when I renamed the
real assignment to prove the gate worked, **it passed anyway**.

Caught because the proof did not fail. It is line-anchored and code-shaped now
(`/^\s*window\.toggleSound\s*=\s*function/m`) and fails correctly when the
assignment is renamed.

This is the third time a check has matched prose instead of code - the sheet
name inside an HTML comment, the filename inside another, and now this. The
habit that catches it every time is the same: break the thing on purpose and
insist on seeing red.

## Ritual

- `node --check` across every `.js` including functions - 0 failures
- **twelve** executed suites - all pass
- gates: eighteen, all PASS
- em-dash scan - clean
- backed up before editing
- bump: sound.js, CACHE_VERSION -> **v399**; `--check` OK

## Verify after deploying

Open a classroom host page (AI Quiz is the one that matters), click the
settings gear. There should now be a **Sound Effects** switch with an
**Effects volume** slider under it. Turning it off should silence the join
blip and the countdown tick on that page.
