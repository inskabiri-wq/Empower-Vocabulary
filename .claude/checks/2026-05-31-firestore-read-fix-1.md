# Firestore read fix #1 — scope the student-assignments query

**Date:** 2026-05-31
**Trigger:** user hit the Spark-plan 50K reads/day cap; audit flagged this as the #1 per-student read burner. User: "do it but not the even cheaper thing."

---

## The problem
`assignments/js/student-assignments.js` loaded **every** assignment with `deadline ≥ 30 days ago` and filtered by class/level/module/individual **in the browser**. So each student downloaded *all* active assignments in the school to find their ~handful.
→ ~O(all active assignments) per student per load. 400 students × ~60 active assignments ≈ **24,000 reads / refresh-round**, and it grows as you add classes.

## The fix (implemented)
Replaced the one broad query with **up to 4 narrow, parallel scope queries**, merged:
- `targetType=='class'  && targetClass==myClass`
- `targetType=='level'  && targetLevel==myLevel`
- `targetType=='module' && targetModule==myModule`
- `targetStudents array-contains uid`   (individual)

(skips any scope the student doesn't have). Then a **safety-net pass re-applies the original match logic** (so behaviour is identical), drops anything outside the 30-day deadline window (mirrors the old server `deadline >=`, incl. excluding no-deadline docs), and sorts deadline-ascending.

→ Now **O(this student's assignments)** — typically ~60 → ~5 per student; **~24,000 → ~2,000 reads / round** (~12×), and it no longer grows with the school.

## Why it's correct (no assignments dropped)
- `normClass` === `_normCls` === `trim().toUpperCase()` (confirmed `teacher/js/students.js:9`).
- **Every** creation path stores `targetClass` normalized (`teacher-assignments.js:1179`, `writing-form.js:245`, `exam-form.js:256`), so `where('targetClass','==', normClass(studentClass))` matches exactly.
- The safety-net filter re-runs the exact old `isForMyClass/Level/Module/Me` checks, so any stray doc is still excluded the same way.

## Indexes
**None required.** Multiple equality filters are served by Firestore's zig-zag merge on automatic single-field indexes; `array-contains` is auto-indexed; no `orderBy` (sorted client-side). If Firestore ever asks for a composite index at runtime it returns a one-click link — add it to `firestore.indexes.json` then.

## ⚠️ One caveat
A *legacy* assignment whose `targetClass` was stored **un-normalized** (created outside the normalizing paths, before this code) wouldn't match the equality query and would stop showing. All current creation paths normalize, so this is unlikely — but if you want zero risk, run a one-time check/backfill to normalize any stray `targetClass`/`targetLevel`/`targetModule` values (happy to write that tool).

## Checks
- `node --check assignments/js/student-assignments.js` → **OK**.
- No dangling reference to the removed broad-`snap` var (only the new local `snap` in the merge loop remains).
- **Not live-tested yet** — your 50K read quota is exhausted today; verify after it resets (~10 AM Istanbul): log in as a student, confirm the same assignments appear, and watch the Firestore usage drop.

## Scope / deploy
One function in `student-assignments.js`. No rules change, no index change, no schema change. Hosting-only deploy. (Did **not** do the bigger `audienceUids` denormalization, per your call.)

---

# Firestore read fix #2 — skip the 100-session fallback read when it's never used

**Trigger:** audit item #2 (up to 100 `sessions` reads per student per dashboard load). User: implement only if it affects **no one** (teacher/students/them).

## The proof of safety (why it can't change anyone's view)
`checkMyAssignmentStatus()` (the function the UI renders from, `student-assignments.js:1010`) **returns from `myCompletions[id]` first** (line 1015-1018) and **only falls through to session-matching (`allSessions`) for assignments that have no completion record.** `myCompletions` is loaded (line 175) *before* the sessions query. So:
- If **every** assignment already has an `/assignmentCompletions` record → `allSessions` is **never read** → loading it is pure waste → skipping it is behaviour-neutral.
- The moment **any** assignment lacks a record (reading/listening exams that complete via session-match, or a vocab assignment whose completion doc is missing) → we load the sessions **exactly as before** (unchanged 100-doc query).

Isolation verified: `student-assignments.js` loads **only on `student-dashboard.html`**; the student-page `allSessions` is consumed **only** by `checkMyAssignmentStatus`; the teacher dashboard's `allSessions` is a **separate** `let` in `teacher/js/config.js` on a different page. Nothing teacher-side is touched.

Edge cases checked: completions-load failure → `myCompletions` stays `{}` → `_needsSessionFallback` true → loads as before (no regression). A record with `completed:false` still short-circuits at line 1015, so skipping sessions for it is correct.

## The change
Gated **only the network call**: `_needsSessionFallback = myAssignments.some(a => !myCompletions[a.id])`; if false, `sessionsSnap` becomes an empty stub (`{forEach(){}}`) → `allSessions = []`, **0 reads**. Everything else (the `allSessions` reset, the `forEach`, the `catch`) is byte-for-byte unchanged.

## Win
Students whose assignments are all completion-tracked (the common steady state): **up to 100 → 0 reads** per dashboard load. Students with a pending session-matched assignment: unchanged.

## Checks
- `node --check` → OK.
- **Not live-tested** (read quota exhausted today) — after reset, confirm a student with all-done assignments still shows them correctly and Firestore usage drops.

---

# Firestore read fix #3 — dedupe progress.js's second full-collection read

**Trigger:** `student/js/progress.js` read the student's **entire** `sessions` collection with **no limit**, in **two** places — `loadJourneyStats()` (dashboard load) and `loadMapProgress()` (Learning Map open). Same data, fetched twice.

## Why it's safe (no displayed number changes)
- `loadJourneyStats()` runs on dashboard load (`auth.js:96/169`); `loadMapProgress()` runs **only** from the Learning Map button — always *after* the dashboard fetch, in the **same page-view**. Sessions can't change mid-page-view (completing practice navigates to `app.html` → returning reloads the dashboard + cache), so the cached set is always current for the map.
- Both functions already iterate the **same** `sessions where userId==me` set; only their aggregation differs. The map's aggregation is **byte-identical** after the change — only its *source* changed (cache vs re-query).
- **Fallback preserved:** if `_sessionsCache` was never populated (e.g. map somehow opened before stats loaded, or the stats fetch failed), `loadMapProgress()` runs its original query → identical behaviour.

## The change (`progress.js`)
- `let _sessionsCache = null;` (module scope).
- `loadJourneyStats()` caches the raw session docs it already iterates (`_sessionsCache.push(session)` in the existing loop — no extra iteration).
- `loadMapProgress()` reuses `_sessionsCache` when present, else falls back to its own query. Aggregation loop unchanged.

## Win
Opening the Learning Map now costs **0 reads** (was a full re-read of every session) in the normal flow. The dashboard-load read in `loadJourneyStats()` **remains** — it genuinely needs every session (unique-words count, lifetime accuracy, per-activity breakdown), so it can't be capped without wrong stats. Reducing *that* would need denormalized lifetime counters on the user doc (bigger change; not done).

## Checks
- `node --check student/js/progress.js` → OK; `snap` now only inside the fallback branch (no dangling ref).
- **Not live-tested** (quota exhausted today) — after reset: open the Learning Map, confirm it shows the same per-unit progress, and that no second sessions read fires.

---

# Firestore read fix #4 — pause teacher whole-collection listeners while the dashboard is hidden

**Trigger:** the teacher Assignments page attaches **two whole-collection `onSnapshot` listeners** — `assignmentCompletions` and `writingSubmissions` (`teacher-assignments.js:371,413`). They read every such doc in the **whole school** on attach and re-read on **every write** while attached. User chose the "safer small step."

## Why the originally-offered step was abandoned
The plan I floated ("attach only on the Assignments tab") turned out to be **unsafe**: `allCompletions`/`allWritingSubs` are **also** read by the **Overview** teaser (`assignments-overview.js`), the **Activity** tab (`activity.js`), and the **student-detail** modal (`student-detail.js`). Tab-scoping would leave those surfaces empty → a regression. So I did **not** do that.

## What I did instead (zero visible impact)
**Page Visibility pause.** A `visibilitychange` handler in `teacher-assignments.js`:
- **Hidden** (teacher switches tab/app, or minimises) → detach both heavy listeners.
- **Visible again** → re-attach via `loadAssignmentCompletions()` (which also re-kicks the writing-subs listener) and refresh.

The scoped assignments listener is left attached (cheap). No bootstrap reorder, no schema change, no rules change — purely additive.

## Why it can't affect anyone
- While **visible** (any tab — Overview/Activity/Assignments), the listeners are attached and every surface behaves **exactly** as before.
- While **hidden**, nothing is rendered, so there's nothing to affect. On return we re-attach + refresh before the teacher interacts.
- The completions listener only ever live-re-renders the **Assignments list** (lines 377-379) — it never live-re-rendered Overview/Activity today — so pausing changes no surface's live behaviour. Re-attach is idempotent (`loadAssignmentCompletions` tears down first).

## Win
Kills the biggest real-world idle drain: a teacher dashboard **left open in a background tab all day** re-reading every student's completion/submission write across the school. While backgrounded → **0 reads**. Does **not** shrink the one-time full read on attach/return (that needs the scoped `assignmentId in […]` refactor we deferred as too risky to do untested).

## Checks
- `node --check assignments/js/teacher-assignments.js` → OK.
- **Not live-tested** (quota exhausted) — after reset: open the teacher dashboard, switch to another browser tab for a bit, return; confirm completion bars/Overview still correct and console shows the pause/resume logs.

## Still deferred (needs testing + care)
Scoping the attach-time read to the teacher's own assignments (`assignmentId in` chunks, attached from the assignments snapshot). Bigger payoff but reorders the assignments bootstrap — revisit when you can verify live.
