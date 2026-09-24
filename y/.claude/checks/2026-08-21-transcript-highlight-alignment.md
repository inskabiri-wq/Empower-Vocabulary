# 2026-08-21 - News Media / Slang transcript highlight ran ahead of the audio

Reported: on these two exams only, the highlight is ahead of the spoken words.
Confirmed by the user after measurement ("highlight is ahead").

## Three separate causes, all specific to these two files

### 1. The mp3s start with silence the transcript does not know about

| | speech actually starts | first cue started |
| --- | --- | --- |
| forger (control) | 0.08s | 0.00s |
| news-media | 0.42s | 0.00s |
| slang | 0.42s | 0.00s |

Whisper timed the **WMA**. The conversion (`Lavc60.31`, ffmpeg) wrote silence
onto the front of the mp3, so every cue fired before its words were spoken.

### 2. There is NO drift - an earlier reading of mine was wrong

A first pass compared the SRT span against the audible span and appeared to
show 1.54s of drift on Slang. That was an artifact: the end-of-speech detector
was catching trailing noise rather than the last word. Measuring properly over
210 / 154 / 73 anchors:

| | implied drift across the whole file |
| --- | --- |
| news-media | -0.03s |
| slang | +0.04s |
| forger (control) | -0.04s |

None. Acting on the first reading would have applied a bogus rescale.

### 3. The per-word sweep assumed one speaking rate for every recording

`NATURAL_WPS` was hardcoded to 2.8, and the word index is
`max(linear, natural)`, so the faster of the two always won. On a long cue the
highlight raced to the last word and parked there while the speaker was still
going.

| | median cue | longest | cues > 6s | real words/sec |
| --- | --- | --- | --- | --- |
| forger | 2.60s | 5.00s | **0** | 2.54 |
| news-media | 3.00s | 10.00s | 7 | 2.10 |
| slang | **5.00s** | **14.00s** | **33** | 2.09 |

The Forger has no cue over six seconds, which is why this never showed there.

## How the offset was actually measured

Two methods disagreed, and the first one was wrong.

**Rejected - nearest-boundary matching.** Snapping each audio silence to the
nearest cue boundary is self-normalising: shift every cue and the silences
simply re-pair with different boundaries, so the score barely moves. It cannot
measure a global offset. It initially suggested +0.30 / +0.49 and I applied
those before noticing the flaw.

**Rejected - leading silence.** `0.42 - 0.08 = 0.34s` looks convincing but
Whisper starts its first cue at 0.00 whether or not the audio does, so the
first cue is not an anchor.

**Used - cross-correlation, no pairing step.** Slide every cue boundary
together across offsets and score against a continuous "quietness" envelope at
10ms resolution. Whisper puts boundaries at pauses, so the true offset is the
peak. Sharp: the plateau within 2% of the maximum is 0.01-0.02s wide. The
Forger provides the method's own bias (-0.03s), which cancels by differencing.

Final shifts applied: **news-media +0.14s**, **slang +0.21s**.

## Result

| | first cue | residual | vs control | peak score |
| --- | --- | --- | --- | --- |
| news-media | 0.14s | -0.03 | **0** | 0.585 |
| slang | 0.21s | -0.03 | **0** | 0.532 |
| forger (control) | 0.00s | -0.03 | 0 | 0.780 |

All three now sit at the same residual as the exam nobody has complained about.

The two new files score lower (0.53-0.59 against the Forger's 0.78) because
they are more continuous speech with fewer clean pauses, so their boundaries
line up less crisply. That is a property of the recordings, not leftover
misalignment - the peak location is what matters and it now matches.

## Code change

`NATURAL_WPS` is no longer a constant. It is measured from each exam's own
transcript, cached on the exam, and clamped to 1.5-4.0:

```
sample-fsmept       1.24 -> 1.50 (clamped)
fsmept-forger       2.54
fsmept-best-places  2.63
fsmept-museum       2.65
fsmept-news-media   2.10
fsmept-slang        2.09
```

The three existing FSMEPT exams land at 2.54-2.65, so they barely move from the
old 2.80. Future imports get their own rate with no constant to remember.

## Ritual

- `node --check` listening-exam.js - ok
- em-dash scan - clean
- inline-css-check / anim-cost-check / tile-art-check - all PASS
- `bump.js listening-exam.js` - v13, CACHE_VERSION v296 -> **v297**
- `bump.js --check` - OK, no drift
- Only the two new exams' cue times were rewritten; The Forger's first cues are
  byte-identical and the total cue count across the file is unchanged.
