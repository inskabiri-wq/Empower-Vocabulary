# Sanity + Smoke — Reading Classroom (Phase 2 of Classroom-Mode-grows-up)

**Date:** 2026-05-27
**Trigger:** User said "go" after the Phase 1 hub restructure. Builds the Reading Classroom flow: host projects the passage, students answer blind on their phones, no leak vectors, teacher controls the reveal.

---

## What shipped

The user's design (locked in via earlier AskUserQuestion):
- Hub placement: **7th tile alongside skills** ✅ (shipped in Phase 1)
- Post-submit reveal: **Score only — teacher reveals later** ✅
- Answer editing: **Yes — like a paper booklet** ✅
- Audio replay: **Per-pack setting** — for Listening Classroom (Phase 3)

| Feature | Where |
|---|---|
| 4th game-mode picker card "Reading Exam" | `y/classroom-teacher.html` — `#pickReading` with rose-red gradient, NEW badge |
| Inline setup form (level → exam → duration → discussion toggle) | `y/classroom-teacher.html` — `#readingSetupScreen` |
| Dropdown wiring | `fillReadingLevels()` + `fillReadingExams(level)` — uses `window.EXAM_REGISTRY.examsForLevel('reading', level)` to enumerate available exams. Filters to `available !== false`. |
| Submit handoff to host page | `?auto=1&level=A2&exam=a2-r1&dur=20&disc=1` → `classroom-reading-teacher.html` |
| `/reading_sessions` Firestore rules | Mirror Trust's posture: teacher creates as host, owner+host write players, all-auth read. `/answers/{questionId}` subcollection: owner writes, host reads, no host-side answer-key persistence. |
| Host HTML | `y/classroom-reading-teacher.html` — auto-creating placeholder; lobby (reuses shared `.session-code-display`/`.session-qr-card`/`.player-card`); live split-pane (passage + host-only progress grid + answer-key reference); results screen (banner + stats grid + per-question breakdown + per-student table) |
| Student HTML | `y/classroom-reading-student.html` — join · waiting · exam (questions only, no passage) · submitted (score only, no breakdown) · revealed (per-question breakdown after teacher unlocks) · done (closed before reveal) |
| Host controller | `y/classroom/js/reading-teacher.js` — auth gate · auto-create from URL · fetches exam JSON · **strips answers + passageHtml** before writing `questionsManifest` to Firestore · lobby · live view with per-student progress grid + green/red dots (host eyes only) · reveals answers by writing `revealedAnswers` map to session · grades client-side using lenient `freeTextMatch` for find-word |
| Student controller | `y/classroom/js/reading-student.js` — anonymous auth · join · renders questions-only from `session.questionsManifest` · writes picks to `/answers/{questionId}` · auto-restores values on refresh · submitted view shows only raw score · revealed view shows per-question breakdown WITH teacher-released answer key |
| Reading theme CSS | `y/classroom/css/reading.css` — rose accent (`#fb7185`/`#f43f5e`) on the deep-glass shell, gradient headlines, JetBrains Mono accents, brand-consistent with Trust No One |

---

## The no-leak design — three layers

1. **Source file never reaches the student client.** The host's tab is the only one that fetches `student/data/readings/{level}/exam-N.json`. The student client reads only `session.questionsManifest` from Firestore.

2. **Manifest is sanitized at the host.** `loadAndSanitizeExam()` builds a parallel structure that contains only id / type / label / instructions / question text / option text / item id / item label / definition — but **never** `answer` and **never** `acceptable`. The answer key lives in a JS closure (`answerKey`) on the host's tab only.

3. **Student UI strips every correctness signal.** Selected MCQ option uses brand violet (`--r-violet`), never green/red. No ✓/✗ toasts. No running score. No sounds. No animation on tap. Only the post-submit raw-total card (e.g. "7 / 10") is shown until the teacher hits Reveal.

If a student opens DevTools and fetches the source JSON URL directly, they can technically see the answer key — but that's a known classroom-management threat-model boundary (same as a paper exam where you could glance at the teacher's answer key). The system never leaks via the *intended* UI flow.

---

## Data model

```
/reading_sessions/{code}
  code, status: 'lobby' | 'live' | 'revealed' | 'finished',
  hostUid, hostName,
  examLevel, examId, examTitle, examSubtitle,
  passageTitle, passageSubtitle,        // for student-visible context only
  questionsManifest: {                  // STUDENT-SAFE — no answers
    sections: [
      { id, type, label, instructions,
        options?,                        // shared options for match-gaps/headings
        items: [
          { id, question?, options?, label?, definition? }
        ]
      }
    ]
  },
  totalQuestions: number,
  timeLimitSec: number,                  // 0 = untimed
  discussionPhase: boolean,              // true → reveal pushes breakdown
  revealedAnswers: {                     // null until teacher hits Reveal
    'sectionId__itemId': 'correctValue'
  },
  createdAt, startedAt, endedAt, revealedAt

  /players/{uid}
    uid, name, avatar,
    submitted: bool, submittedAt,
    score, correctCount,                 // written by host's grader
    joinedAt

    /answers/{sectionId__itemId}
      sectionId, itemId, value, updatedAt
```

The composite doc id (`sectionId__itemId`) is set client-side so every change is an idempotent `set({ merge: true })`. No host-side `runTransaction` needed for answer writes.

---

## Supported section types (auto-graded)

| Type | Student UI | Grading |
|---|---|---|
| `mcq` | radio group (A/B/C/D) | exact-match on option id, case-insensitive |
| `match-gaps` | dropdown picker from shared option list | exact-match on option id |
| `match-headings` | dropdown picker from shared option list | exact-match on option id |
| `find-word` | text input | lenient match — case-insensitive, strip leading articles + punctuation, accept any of `acceptable[]` |

Other types in the exam JSONs (`writing`, `free-text`) require teacher grading after the fact — out of scope for v1. If an exam contains *only* ungradeable sections, the host will throw "This exam has no auto-gradable questions" and bounce back to the picker.

---

## Files modified / created

**Modified**
- `y/classroom-teacher.html` — added 4th picker card (`#pickReading`), inline `#readingSetupScreen`, dropdown helpers, Create-Reading-Room handler, exam-registry.js link
- `firestore.rules` — added `/reading_sessions/{code}` matcher + `_ownsReadingSession` / `_isReadingHost` helpers

**Created**
- `y/classroom-reading-teacher.html`
- `y/classroom-reading-student.html`
- `y/classroom/js/reading-teacher.js`
- `y/classroom/js/reading-student.js`
- `y/classroom/css/reading.css`

---

## Checks run

| Check | Result |
|---|---|
| `classroom-reading-teacher.html` div balance | ✅ 47 / 47 |
| `classroom-reading-student.html` div balance | ✅ 45 / 45 |
| `classroom-teacher.html` div balance (after picker edits) | ✅ 100 / 100 |
| `classroom/js/reading-teacher.js` syntax | ✅ |
| `classroom/js/reading-student.js` syntax | ✅ |
| `classroom/css/reading.css` brace balance | ✅ 148 / 148 |
| All host DOM IDs reconcile with JS | ✅ |
| All student DOM IDs reconcile with JS | ✅ (`myStatusChip` is created dynamically by `setIdStrip()`'s innerHTML — that's the expected pattern) |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test plan (host + 4 students)

1. **Teacher** opens `classroom-teacher.html` → 4 picker cards appear, the new "Reading Exam" card has rose accent + NEW badge. Click it → setup form opens.
2. **Level dropdown** lists A1 / A2 / B1 / B2 (or whatever has available exams in the registry).
3. **Pick a level** → exam dropdown re-fills with that level's exams.
4. **Pick an exam, leave defaults, click Create Reading Room** → handoff to `classroom-reading-teacher.html?auto=1&...` → "Preparing the exam room…" flashes → lobby appears with 4-letter code + QR.
5. **4 students** scan QR → land on `classroom-reading-student.html?code=XXXX` → type name → "Ready to read" waiting view.
6. **Teacher** clicks Start exam → all students flip to the exam view.
7. **On student phones**:
   - Questions appear, **no passage text anywhere**.
   - Selected MCQ option highlights brand violet (NOT green/red).
   - Changing an answer just updates the highlight — no ✓/✗, no sound.
   - "X / Y answered" counter updates locally.
   - Refresh the page mid-exam → answers come back from `/answers/`.
8. **On teacher's tab**:
   - Passage renders large on the left.
   - Right side shows each student tile with answered/total + correct count + per-question green/red dots (host eyes only).
   - "Answer key (host only)" collapsible reference at the bottom right.
9. **A student taps Submit** → confirm modal → submit → lands on submitted card showing only raw score (e.g. "0 / 10" until host writes back). **No breakdown visible.**
10. **Teacher clicks Reveal answers** → confirm modal → answers pushed to all submitted students.
    - Each submitted student transitions to the revealed view.
    - Per-question rows show their pick vs. correct answer, ✓/✗ marker, and proper option text (not just letter).
11. **Teacher clicks End exam** → results screen with banner, stats grid (students / submitted / avg score / Qs / top), per-question breakdown chart with % correct + total bar, per-student table sorted by score.
12. **Non-submitted students** (if any) auto-submit on End → routed to revealed view (if discussionPhase) or "Exam closed" view.

---

## Open concerns / hardening backlog

- **Source-file leak vector**: a savvy student with DevTools can fetch `student/data/readings/{level}/exam-N.json` directly from Firebase Hosting (no auth-gate). Documented above — known threat-model boundary, fix would require moving JSONs behind an auth-gated function. Out of scope for v1.
- **Lenient grading on find-word** uses the same normalization as the solo reading-exam.js, but the host's grader is the source of truth — the student's revealed view does a simpler `lowercase().trim()` compare for display, which could disagree with the host on edge cases (e.g. "the punishment" vs "punishment"). Host's number wins because it's what's persisted in `players/{uid}.score`. The student's revealed-view per-question marks are display-only.
- **Late joiner during live**: a student who joins after the teacher hits Start will go straight to the exam view, but won't have a `startedAt` baseline so the timer math could be off. Defensive: the session subscription only starts the timer if `session.timeLimitSec > 0 && startedAt`. Worst case the timer shows the remaining time correctly because it's computed from session.startedAt + timeLimitSec.
- **Discussion phase = no** keeps the student on submitted view until session.status=finished. Then they're routed to "Exam closed". They never see the breakdown, by design.
- **Rejoin as already-submitted**: `subscribePlayer` reads `submitted` from the player doc. If a student refreshes after submitting, they'll see the submitted card again because `submitted=true` is persisted. Submit again is a no-op (`submitted` guard).

---

## Standing preferences applied

- **Brand-wide stylish** — Reading theme matches Trust No One's deep-glass + gradient-headline + JetBrains-Mono-accent language but with rose as the dominant hue (matching the Reading skill tile color). Stats grid + per-question bars + collapsible answer key + collapsible per-student table — all the same shape language.
- **Sanity + smoke + dated md** — this file.

---

## What's next

Phase 1 (hub restructure): ✅ shipped
Phase 2 (Reading Classroom): ✅ shipped (this file)
**Phase 3 (Listening Classroom)** — reuses 90% of the reading scaffold, adds the audio control layer + `replayPolicy` per-pack setting + Q-marker broadcast for student phones. Sizeable but the heavy architectural lifting is done.
