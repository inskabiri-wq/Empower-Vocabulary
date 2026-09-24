# 2026-08-21 - the second refresh (found), listening 2 + 3 wired

## 1. The second refresh - actual root cause, reproduced in a test

I have called this fixed four times. This time it is reproduced deterministically
and control-tested, so here is the evidence rather than another assurance.

**Cause.** `student/js/feature-toggles.js` primes `window.featureToggles` from
`localStorage['ll-feature-toggles']` at parse time so the first paint is already
correct. It set the toggles but **not `lastPublished`**. So when the first
SERVER snapshot arrived, `publish()` compared the new signature against `null`,
saw a "change" even when the server agreed with the cache byte for byte, and
dispatched `feature-toggles-ready`.

Four modules re-render on that event:

| listener | what the student sees redraw |
| --- | --- |
| `student/js/hub.js:427` | every hub tile, including Classroom Mode |
| `assignments/js/student-assignments.js:1885` | the assignment card |
| `student/js/placement-tile.js:157` | the placement tile |
| `student/js/skills/grammar.js:795` | the grammar screen |

That is exactly the reported list: "the icon on profile the classroom mode the
assignment and so on". It hits **every returning student**, because a returning
student is precisely the one with a populated cache.

**Fix.** One line, plus a shared `sigOf()` so both sites compute the signature
the same way:

```js
lastPublished = sigOf(cached);
```

A server snapshot that CONFIRMS the cache is now silent. One that genuinely
differs still publishes and still repaints, which is correct and rare.

### Ruled out first (so this is not another guess)

- **Duplicate auth boots.** Four separate `onAuthStateChanged` subscriptions
  exist on the student path. `auth.js` (`bootedForUid`), `hub-preload.js`
  (`started`) and `placement-tile.js` (`booted`) are all guarded. Checked, not
  assumed.
- **onSnapshot cache-then-server.** `feature-toggles.js` is the only
  `onSnapshot` in the student path, and it already gates on
  `metadata.fromCache`.
- **`policy-course.js:639`** has an UNGUARDED `onAuthStateChanged` that calls
  `boot(u)` on every fire. It loads only on `policy-course.html`, so it is not
  this bug, but it is a real double-boot on its own page. Left alone, logged
  here.

### Control test

Removing only the new line and re-running the harness:

```
5. SERVER snapshot that AGREES announces nothing  ->  1   FAIL
11. same toggles in a different key order          ->  1   FAIL
```

Restored: 13 / 13. The harness loads the REAL module and fakes only the
Firestore transport, so the gating logic under test is shipped code.

## 2. Instrumentation, because four code-reading diagnoses were not enough

New `js/boot-trace.js`, opt-in with `?boot=1`, wired into the dashboard next to
`perf-hud.js`. A **MutationObserver** on `#hubGrid`, `#assignmentsContainer` and
the avatar nodes measures what actually redrew - it does not care which function
ran or what triggered it. If a container is rewritten twice, the student saw it
change twice, regardless of my theory.

Counting is coalesced per tick: one `innerHTML` assignment fires dozens of
mutation records but is ONE visible redraw, and a naive counter reporting "x30"
would send me chasing a bug that does not exist. Verified.

To use: open `student-dashboard.html?boot=1`, do not touch the screen, wait
about ten seconds, press "copy report". Any container above x1 is a real second
refresh, and the gap between its timestamps is the flash.

## 3. Listening 2 (News Media) and 3 (Slang) - now live

mp3s arrived. Verified before wiring, with a new `tools/mp3-probe.js` that walks
MPEG frames (no ffmpeg, no dependencies) - because a size check cannot tell a
re-encode from a truncation, and if the audio length does not match the SRT then
every transcript timestamp is wrong:

```
listening-forger.mp3        5m05s   64kbps cbr  mono    <- controls, already live
listening-best-places.mp3   4m52s   64kbps cbr  mono
listening-museum.mp3        4m35s   64kbps cbr  mono
News Media.mp3              9m48s  156kbps vbr  stereo  <- SRT says 587s  OK
Slang.mp3                   9m56s  150kbps vbr  stereo  <- SRT says 594s  OK
```

Durations match. **Size does not**: these are ~11MB where every existing exam is
~2.2MB, because they came back 156kbps VBR stereo rather than 64kbps mono. Audio
is runtime cache-first in the service worker, so each lands in every student's
cache. Shipped anyway - working exams beat a smaller download - but a re-encode
would cut each to about 4.7MB. ffmpeg is not installed on this machine.

### Numbering corrected

The registry numbered exams by INSERTION order while the exam data used the
FSMEPT paper numbers, so the two files disagreed about **every** title:

| exam | data said | registry said |
| --- | --- | --- |
| The Forger | Listening 1 | Listening 2 |
| Best Places | Listening 4 | Listening 3 |
| Museum | Listening 5 | Listening 4 |

A teacher assigning "Listening 2" would have picked the wrong paper. Both files
now follow the source documents (`FSMEPT LISTENING 2 News Media.docx`), and the
sample exam is retitled to remove the collision with Forger at number 1. Titles
are display only; `examId` is what assignments store, and no id changed.

Note `assignments/js/exam-form.js:321` freezes `examTitle` into each assignment
document, so assignments created before today keep their old label. Harmless -
lookups are id-keyed - but it explains any mismatch in old records.

## Verification

| harness | result |
| --- | --- |
| `toggle-republish-trace.html` (new) | 13 / 13, control-tested |
| `boot-trace-trace.html` (new) | 12 / 12 |
| `listening-exams-trace.html` | 57 / 57, all four surfaces |
| `listening-question-render-trace.html` | 32 / 32 |
| `transcript-accordion-trace.html` | 17 / 17 |

`listening-exams-trace.html` once reported "3 of 5 exams" against a file that
contained all five - the browser served a cached `listening-exam.js`. It now
injects its scripts with a cache-buster instead of using static `src` tags. A
stale pass is worse than no harness.

## Ritual

- `node --check` on all six changed/new JS files - ok
- em-dash scan - clean (Whisper output needed no normalisation)
- `node tools/bump.js feature-toggles.js listening-exam.js exam-registry.js`
  - feature-toggles v9, listening-exam v12, exam-registry v4, CACHE_VERSION **v295**
- `node tools/bump.js --check` - OK, no drift

## Left open

- Not deployed. v295.
- Re-encode the two new mp3s to 64kbps mono to match the others (~11MB -> ~4.7MB).
- `policy-course.js:639` unguarded auth boot on policy-course.html.
- Two `updateProfileDisplay` definitions exist (`avatar.js:96`, `progress.js:283`,
  the latter behind a `typeof` guard). Works, but fragile.
