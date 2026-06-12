# Sanity + Smoke — Listening Classroom (Phase 3 of Classroom-Mode-grows-up)

**Date:** 2026-05-27
**Trigger:** User said "go" after Phase 2 (Reading Classroom) landed. Builds the Listening Classroom: host plays the audio on classroom speakers, students see only the questions on their phones (audio URL is never sent to students), per-pack `replayPolicy` + Q-marker broadcast.

---

## What shipped

| Feature | Where |
|---|---|
| 5th game-mode picker card "Listening Exam" | `y/classroom-teacher.html` — `#pickListening` with sky-blue gradient, NEW badge |
| Inline setup form | `#listeningSetupScreen` — level → exam → time limit → **replayPolicy** (teacher / once / unlimited) → discussion toggle → Q-marker toggle |
| Dropdown wiring | `fillListeningLevels()` + `fillListeningExams(level)` — uses `EXAM_REGISTRY.examsForLevel('listening', level)`, same shape as the Reading-Exam helpers |
| Submit handoff | `?auto=1&level=B1&exam=sample-fsmept&dur=30&disc=1&qmark=1&policy=teacher` → `classroom-listening-teacher.html` |
| `/listening_sessions` Firestore rules | Mirror `/reading_sessions`: teacher creates as host, owner+host write players, all-auth read. `/answers/{questionId}` subcollection same shape. |
| Host HTML | `y/classroom-listening-teacher.html` — auto-creating placeholder; lobby; live split-pane (audio player on the left, host-only progress grid + answer-key on the right); Q-marker navigator row; results screen |
| Student HTML | `y/classroom-listening-student.html` — join · waiting · exam (questions only, **no audio file**, **no transcript**) · audio-status hint row · submitted · revealed · done |
| Host controller | `y/classroom/js/listening-teacher.js` — auth gate · auto-create · sanitizes `LISTENING_EXAMS[examId]` into a student-safe manifest (strips `.answer` everywhere) · audio player wiring (play/pause/restart/seek/skip-10) · `replayPolicy` enforcement · replay counter · Q-marker (prev / next / clear) · writes `audioStatus` + `replayCount` + `activeQuestionKey` to the session · same client-side grading + reveal mechanism as reading-teacher.js |
| Student controller | `y/classroom/js/listening-student.js` — anonymous auth · join · renders questions only from `session.questionsManifest` · audio-status hint string from `session.audioStatus` (pulsing dot, no answer info) · Q-marker subscribe → scroll the matching item into view + apply a sky-blue glow ring · supports listening-specific section types (`mcq` / `truefalse` / `fillblank`) |
| Listening theme CSS | `y/classroom/css/listening.css` — sky-blue accent (`#38bdf8` / `#0ea5e9`), audio-player styling (72px circular play button, progress bar, scrubber), pulsing audio-status dot, `.exam-item.is-active-q` highlight ring, brand-consistent with reading.css |

---

## The no-leak design — same three layers + an audio layer

1. **Audio URL is never written to Firestore.** The host pulls `audio: 'student/audio/listening-exam-1.mp3'` from `EXAM_REGISTRY` at runtime, sets it on the `<audio>` element, but never persists it. Students' tabs read the session doc and don't see any audio path.

2. **Question manifest is sanitized.** `loadAndSanitizeExam()` reads `window.LISTENING_EXAMS[id]` and builds a parallel structure that contains only id / type / label / instructions / question text / option text — never `answer`. The answer key lives in a JS closure on the host's tab only, until reveal.

3. **Student UI strips every correctness signal.** Identical rules to reading: selected = brand violet, no ✓/✗, no running score, no sounds, no animation. Audio-status dot is sky-blue (playing), violet (paused), emerald (ended) — none of those colors map to correctness, they're playback states.

4. **Q-marker highlight is sky-blue, not green/red.** When the host advances `activeQuestionKey`, the student's matching `.exam-item` gets `.is-active-q` which paints a sky-blue glow ring + smooth-scrolls it into view. The highlight is purely an attention nudge — it never communicates whether the answer is right.

Same known limitation as reading: a savvy student with DevTools could fetch the audio URL by reading exam-registry.js directly. Out of scope for v1 (documented threat-model boundary).

---

## Replay policy enforcement

| Policy | Host's tab behavior |
|---|---|
| `teacher` (default) | Play / pause / restart / seek all unrestricted. Most flexibility. |
| `once` | Initial play works; pause/resume mid-track works; **restarting from `ended`** is blocked with a toast. The replay-count chip never moves past 0. |
| `unlimited` | All controls always available. Replay counter increments on each restart. |

The `replayCount` field on the session is also surfaced on each student's phone via the audio-status hint ("Audio is playing · replay 2"), so students always know which playthrough they're on.

---

## Data model

```
/listening_sessions/{code}
  code, status: 'lobby' | 'live' | 'revealed' | 'finished',
  hostUid, hostName,
  examLevel, examId, examTitle, examSubtitle,
  questionsManifest: { sections: [...] },     // student-safe, no answers
  totalQuestions: number,
  timeLimitSec: number,
  discussionPhase: boolean,
  qMarkerBroadcast: boolean,
  replayPolicy: 'teacher' | 'once' | 'unlimited',

  // Audio playback state — host updates as audio plays.
  audioStatus: 'idle' | 'playing' | 'paused' | 'ended',
  audioFirstPlayedAt: timestamp,
  replayCount: number,

  // Q-marker — null means no broadcast.
  activeQuestionKey: 'sectionId__itemId' | null,

  revealedAnswers: { 'sectionId__itemId': 'correctValue' },
  createdAt, startedAt, endedAt, revealedAt

  /players/{uid}                              // same shape as reading
    /answers/{sectionId__itemId}              // same shape as reading
```

The composite doc id (`sectionId__itemId`) is set client-side so every change is an idempotent `set({ merge: true })`.

---

## Supported section types (auto-graded)

| Type | Student UI | Grading |
|---|---|---|
| `mcq` | radio group (A/B/C, options from `LISTENING_EXAMS[exam].sections[].questions[].options[]`) | exact-match on letter id, case-insensitive |
| `truefalse` | two radios labeled `T — True` / `F — False` | exact-match (T or F), case-insensitive |
| `fillblank` | text input | lenient — case-insensitive, strip leading articles + punctuation; same `freeTextMatch` normalizer as reading |

The host's `loadAndSanitizeExam` reads `LISTENING_EXAMS[examId].sections[]` (note: `questions[]` not `items[]`, and options are strings not objects — these are normalized into the same shape as the reading manifest).

---

## Files modified / created

**Modified**
- `y/classroom-teacher.html` — added 5th picker card (`#pickListening`), inline `#listeningSetupScreen`, dropdown helpers (`fillListeningLevels` + `fillListeningExams`), Create-Listening-Room handler
- `firestore.rules` — added `/listening_sessions/{code}` matcher + `_ownsListeningSession` / `_isListeningHost` helpers

**Created**
- `y/classroom-listening-teacher.html`
- `y/classroom-listening-student.html`
- `y/classroom/js/listening-teacher.js`
- `y/classroom/js/listening-student.js`
- `y/classroom/css/listening.css`

---

## Checks run

| Check | Result |
|---|---|
| `classroom-listening-teacher.html` div balance | ✅ 54 / 54 |
| `classroom-listening-student.html` div balance | ✅ 45 / 45 |
| `classroom-teacher.html` div balance (after picker edits) | ✅ 115 / 115 |
| `classroom/js/listening-teacher.js` syntax | ✅ |
| `classroom/js/listening-student.js` syntax | ✅ |
| `classroom/css/listening.css` brace balance | ✅ 163 / 163 |
| All host DOM IDs reconcile with JS | ✅ (only `view-` from setView loop unmatched, expected) |
| All student DOM IDs reconcile with JS | ✅ (`myStatusChip` is created dynamically by `setIdStrip()`'s innerHTML — same pattern as reading) |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test plan (host + 4 students)

1. **Teacher** opens `classroom-teacher.html` → 5 picker cards appear. New "Listening Exam" card has sky-blue accent + NEW badge. Click → setup form opens.
2. Level dropdown shows B1 (only level with available listening content). Pick → exam dropdown re-fills with "FSMEPT Listening 1".
3. Pick exam, leave defaults (teacher-controlled replay, 30 min, discussion + Q-marker on), click Create Listening Room → handoff → "Preparing the listening room…" flashes → lobby with code + QR + replay-policy chip.
4. **4 students** scan QR → join, type name → "Ready to listen" waiting view.
5. **Teacher** clicks Start exam → all students flip to the exam view. Audio-status row says "Listen for your teacher to start the audio."
6. **Teacher** clicks the big circular play button → audio starts playing on classroom speakers; student phones immediately update to "🔊 Audio is playing". Pulsing sky-blue dot animates.
7. **On student phones**: question list visible, **no audio player, no transcript text, no leak**. Selected radio uses brand violet. Changing answers updates immediately, no ✓/✗.
8. **Teacher** clicks Next Q → `activeQuestionKey` advances → student phones scroll to the matching item with a sky-blue glow ring. Repeating advances through all items. Clear button removes the highlight.
9. **Teacher** clicks Restart → audio jumps to 0:00, plays again. Replay-count chip increments. Student phones show "🔊 Audio is playing · replay 1".
10. **Switch policy to `once`** (create a new room): clicking Restart after `ended` shows a "Replay disabled by policy (once only)" toast and audio stays at the end. Replay-count chip stays at 0.
11. **A student taps Submit** → confirm → submitted card with raw score only ("0 / 15" until host writes back).
12. **Teacher** clicks Reveal → answers pushed → submitted students transition to the revealed view with per-question right/wrong rows showing their pick vs. the correct answer.
13. **Teacher** clicks End exam → results screen with stats grid (students / submitted / avg / Qs / replays / top) + per-question breakdown bars + per-student table sorted by score.

---

## Open concerns / hardening backlog

- **Audio URL leak via DevTools**: same threat-model boundary as reading source files. The audio file is on Firebase Hosting (no auth gate), and the path is enumerable from exam-registry.js. Documented; out of scope for v1.
- **Once-only policy on first play**: if the host accidentally double-clicks play / pauses for 1s then plays again, `audioStartedOnce` flips after the first play but the policy guard only triggers on restart-from-ended. Mid-track pause/resume is intentionally allowed (otherwise students can't get a moment to read). The strict definition is "you can play through the audio one time end-to-end" — which is what teachers expect for IELTS-style listening.
- **Q-marker desync on late joiners**: a student who joins after the host has already advanced the marker will land on the current Q immediately because the session snapshot includes the current `activeQuestionKey`. Good.
- **Audio plays through the host's tab only**: if the host loses focus / tab is backgrounded, some browsers throttle audio. Documented — teachers should keep the tab foregrounded while playing.
- **Single listening exam in the registry**: only `sample-fsmept` (B1) is available. The picker shows just that one. Authoring more is a content task — add entries to `SKILLS_CATALOG.listening` in exam-registry.js + add the question content to `LISTENING_EXAMS` in `student/js/listening-exam.js`.
- **`LISTENING_EXAMS` is a JS module** (not a JSON file). Loading `student/js/listening-exam.js` on the host page exposes the const at script scope but also defines a number of solo-mode functions in global scope. None of them auto-run; the file is safe to include. Long-term we could extract the data to a JSON file for cleaner separation.

---

## Standing preferences applied

- **Brand-wide stylish** — Listening theme is the sibling of Reading: same deep-glass + gradient + JetBrains Mono accent language, just with sky-blue as the dominant hue. Audio player is brand-consistent (big circular play button with the sky→sky-2 gradient + drop-shadow, scrubber as an invisible overlay over the fill). Q-marker highlight uses the same sky-blue tone so it's visually paired with the audio-status dot.
- **Sanity + smoke + dated md** — this file.

---

## Done

Phase 1 (hub restructure): ✅ shipped
Phase 2 (Reading Classroom): ✅ shipped
Phase 3 (Listening Classroom): ✅ shipped (this file)

Classroom Mode now has 5 modes: Vocab Race · The Heist · Trust No One · Reading Exam · Listening Exam — each on-brand and discoverable from the unified `classroom-teacher.html` picker. Student dashboard hub shows Classroom Mode as the 7th tile.
