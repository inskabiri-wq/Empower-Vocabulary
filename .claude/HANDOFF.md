# Empower Lab — Project Handoff (for another Claude)

A practical, pick-up-cold briefing for the **Empower Lab** web app. Read this top to
bottom before changing anything. Per-change detail lives in `.claude/checks/2026-*.md`.

---

## 1. What this is
- **Empower Lab** — an English-learning platform for **Fatih Sultan Mehmet Vakıf Üniversitesi (FSMVÜ)**, ~**400 students**, in/near launch.
- Skills hub with **7 tiles**: 📚 Vocabulary · 🎧 Listening · ✏️ Grammar · 📖 Reading · ✍️ Writing · 🎤 Speaking · 🎮 Classroom Mode.
- Live **Classroom games**: Vocab Race, **The Heist** 🦹, **Trust No One** 🕵️, **Reading Exam**, **Listening Exam**.
- **Assignments** system across all skills; **Writing** has teacher grading + inline annotations.

## 2. Stack & where things live
- **Firebase**: Hosting + Firestore + Auth. **Free "Spark" plan** (see constraints).
- **Web root = `y/`** (this is what Firebase serves). All pages are `y/*.html` at the root.
- **`firestore.rules`** at the **repo root** (not under `y/`). Rules are the real security boundary.
- Key dirs under `y/`:
  - Pages: `index.html` (login), `app.html` (vocab practice), `student-dashboard.html`, `teacher-dashboard.html`, `classroom-*.html`, `writing-exam.html`, `reading-exam`/`listening-exam` (inside student screens).
  - `css/brand.css` loads on every page (global reset + tokens). Per-area CSS under `student/css`, `teacher/css`, `classroom/css`, `assignments/css`, `index/css`.
  - JS per area: `student/js`, `teacher/js`, `classroom/js`, `assignments/js`, `index/js`, `activity-tracker/js`.
  - PWA: `manifest.json`, `service-worker.js`, `pwa-register.js`, app icons at `y/` root (`fsm-logo.png`, `apple-touch-icon.png`, `android-chrome-*.png`, `favicon*`), plus `fsmvu-seal.png` + `css/fsmvu-loader.css` + `js/fsmvu-loader.js` (the crimson seal loaders) + `fsmvu-loaders.html` (gallery).
  - Shared: `js/app-dialog.js` (themed alert/confirm/prompt → `window.AppDialog`).

## 3. HARD CONSTRAINTS (Spark plan)
- **NO Cloud Functions.** Everything is client-side. Classroom games use a **"host-as-referee"** model: the teacher's browser is the authority; students read/write Firestore directly, gated by **rules**.
- **Firestore free quota ≈ 50,000 doc reads/day** (resets ~midnight US Pacific ≈ 10:00 Istanbul). Reads are a real budget — see §7.
- **Security = Firestore rules.** A student can read **only their own** `users/{uid}` doc (can't read teacher docs). Teachers with scope can read student data. Treat rules as the enforcement layer; client checks are courtesy only.

## 4. STANDING PREFERENCES (the user's rules — always apply)
1. **"Whenever I say *stylish*, apply the idea across the whole app's theme"** — don't ask each time; make it consistent app-wide.
2. **After ANY change: run a sanity + smoke check, AND write a dated md** in `.claude/checks/` (`YYYY-MM-DD-topic.md`). The user does not want to ask twice or hit a glitch. This is mandatory.
3. **Be extremely careful around assignments.** "Every time you touch assignments something bad happens." Prove-it-first: read the code, confirm no behaviour change, keep render/data logic intact. Bias to additive/CSS-only changes there.
4. **The user deploys, not the agent.** You cannot run `firebase deploy`. Always end with the exact command for them.
5. **Bump `CACHE_VERSION` on EVERY deploy that changes CSS/JS** (see §6) — this caused repeated "I still see the old version" pain. Non-negotiable now.

## 5. Verification workflow (no Playwright installed)
- JS syntax: `node --check <file>`.
- CSS: brace-balance count (`{` vs `}`).
- HTML: tag-balance via Python `html.parser` (div/span/etc. open==close).
- Concept/structure checks: small Python scripts in `.claude/*.py` (kept OUT of shipped `y/`).
- **Live check**: `Invoke-WebRequest https://empower-vocabulary-practice.web.app/<path>` to confirm what's actually deployed.
- Environment runs **PowerShell (cp1252 console)** + Python 3.14. When printing from Python, `sys.stdout.reconfigure(encoding='utf-8')` or avoid emoji in prints (cp1252 crashes on them). Bash tool also available.

## 6. Deploy & the cache-version discipline (READ THIS)
- Deploy: **`firebase deploy --only hosting`** (add `,firestore:rules` when rules change).
- The service worker (`y/service-worker.js`) is **HTML = network-first**, **static CSS/JS/img = cache-first within `CACHE_VERSION`**. So **changed CSS/JS will NOT reach users until `CACHE_VERSION` is bumped** (e.g. `v9` → `v10`). `pwa-register.js` then auto-reloads the page once when the new worker takes over.
- **Therefore: every time you change any CSS/JS that ships, bump `const CACHE_VERSION` in `service-worker.js`.** (Currently at **`v9`**.) Forgetting this = the user sees stale pages. This was the single most recurring bug.
- After deploy the user should hard-refresh (or relaunch the PWA); with the version bump it auto-reloads.

## 7. Firestore reads — mindset + what's done
The student dashboard was the big scaler (×400). Fixes already shipped:
1. **Assignments scoped** — `student-assignments.js` queries only the student's class/level/module/individual assignments (was: all of them) → ~60→~5 reads/load.
2. **Session-fallback gated** — the 100-session read only runs if an assignment lacks a completion record.
3. **Learning-map dedupe** — `progress.js` reuses the dashboard's session fetch instead of re-reading all sessions.
4. **Teacher listeners pause when hidden** — `teacher-assignments.js` detaches the two whole-collection `onSnapshot`s on `visibilitychange` (idle background tabs were re-reading every write).
- **Rules of thumb:** scope queries server-side; reuse already-loaded `window.currentStudentData` / in-memory data (0 reads); collapsing/accordions do NOT save reads (the list is already loaded; expanding is free).
- **Deferred (don't do blind):** scope the teacher whole-collection listeners by `assignmentId in […]` (needs the bootstrap reorder); denormalize lifetime stats so `loadJourneyStats` doesn't read all sessions.

## 8. Feature inventory (all built this project)
- **Classroom games** (`classroom/`): Vocab Race, Heist (Bitcoin→💸 coins, vault crack, music), Trust No One (space/among-us, meetings, donations, ghost play), Reading Exam + Listening Exam (host projects content; students answer **blind** — no ✓/✗ leak; teacher reveals; projector-safe host toggle). All on `/trust_sessions`, `/heist_sessions`, `/reading_sessions`, `/listening_sessions`, `/classroom_sessions`.
- **Assignments lifecycle** (all 4 skills): create (class/level/module/individual targets) → student sees/starts → completion recorded (`assignmentCompletions` `{uid}_{aid}`, field `odUserId`) → teacher progress/grading. Reading/listening complete via session-match.
- **Writing feedback v2**: teacher inline annotations (select text → criterion → comment bank) + a **comment bank** (`assignments/js/writing-comment-bank.js`, essay/academic/short × CC/TA/GR/VO × scores 0–5 × 10). Students see feedback when graded/returned. Block grading on phones.
- **Accordions** everywhere appropriate (reading/listening exams per-section + per-question; **assignment cards** on the student dash) — CSS `max-height` collapse (NOT `grid 0fr`), prominent branded chevron chips, full collapse (no sliver).
- **AppDialog** (`js/app-dialog.js`): themed alert/confirm/prompt replacing native popups app-wide; global checkbox/radio `accent-color`.
- **Icons**: curated emoji set (Join 🎟️, Trust 🕵️, Heist 🦹, Coins 💸, End 🏳️, Join-another ➕, Sessions 🧠, Next-track 🎶). **FSMVÜ seal loaders** (6 variants in `css/fsmvu-loader.css`; **Ring Rotation, white** on in-app loading screens; **Progress Ring** considered) + a **launch splash** on `index.html` (white spinning seal → fades to login).
- **Student dashboard**: full-width **two-column hub** (skills left, rail right), **info chips** (Class/Level/Module/Year, from the already-loaded user doc, 0 reads) merged into the "Your Assignments" box, compact skill-filter pills.
- **Teacher dashboard**: overview, student drill-down, needs-attention, PDF report, class/week comparison, deadline calendar; promote-to-teacher shows the email as a safeguard (+ rules only allow `@fsm.edu.tr` staff).
- **PWA**: installable, offline shell, safe-update worker.

## 8b. Content & authoring workflows (existing tooling — predates this session)
How the **content** is produced. Lives in `y/tools/` (local Node scripts, **not shipped to users**) and `y/student/data/`.

### Listening-exam synced transcript — the "Whisper" workflow
The listening exam shows a transcript that highlights line-by-line as the audio plays (drawer UI in `student-dashboard.html`: `#examTranscript` / `toggleTranscriptDrawer`). The timed lines are `const EXAM_TRANSCRIPT = [...]` in `student/js/listening-exam.js`. Produced by:
1. Run **Whisper** (e.g. WhisperDesktop) on `student/audio/listening-exam-1.mp3` → save SRT to `student/audio/listening-exam-1.srt`.
2. From `y/`: **`node tools/align-from-srt.js`** — re-times the EXAM_TRANSCRIPT segments against the Whisper SRT. **Keeps the hand-cleaned transcript TEXT**; only updates each segment's `start`/`end` to what Whisper heard. Writes `tools/exam-transcript.aligned.js` + a per-segment delta/confidence report (never edits the source). Flags: `--srt2`/`--srt2Offset` (merge a trimmed re-run when Whisper dies mid-file), `--source`, `--out`, `--verbose`.
3. Eyeball the diffs → paste the new array over `EXAM_TRANSCRIPT` in `student/js/listening-exam.js`.
- **Net:** text is human-authored/cleaned; **Whisper only supplies timings**, run **offline on the author's machine**. There is **no in-app transcription / no Whisper at runtime** (important: no server, Spark plan).

### Reading exams
`student/data/readings/<LEVEL>/exam-N.json` with source passages in `student/data/readings/_raw/<LEVEL>/exam-N.txt`. `tools/validate-readings.js` sanity-checks them.

### Vocabulary datasets
`datasets.json` + `gateway_dataset.json` (words by level/unit), `student/js/multipleChoiceOverrides.json`, `student/js/inflection.js`.

### Design hand-offs (how new UI is created)
The user mocks UI in **Claude Design** (claude.ai/design) and exports a bundle — a **gzipped tar** served at `api.anthropic.com/v1/design/h/<id>` (fetch **anonymously**; `gunzip` + `untar`). Each bundle has a README ("read the chat transcripts first") + the HTML/CSS prototype; we recreate it for real in the app. This is exactly how the **FSMVÜ seal loaders** were built (bundle unpacked under `.tmp/design-LaNAV/`). Older bundles: `y/.tmp/design-pkg/`, `y/.tmp/teacher-design/`.

### Other `tools/` scripts (local, `node tools/<name>.js` from `y/`)
`smoke-test.js`, `ship-ready.js`, `validate-readings.js`, `backfill-session-scope.js`, `backfill-assignment-skill.js`, `backfill-assignment-owner.js`, `create-demo-accounts.js` / `cleanup-demo-accounts.js`, `migrate-verify-existing-users.js`.

## 9. Gotchas / lessons
- **Cache version** (§6) — the #1 recurring trap.
- **`y/assets` is a FILE, not a dir** (a stray 8 KB copy). Brand images live at **`y/` root** by convention. New static files: prefer the Write tool (works for new `y/` files); PowerShell `Copy-Item` to a *new* path under `y/` has hit odd failures.
- **`:has()`** is used for scoped CSS (e.g. `.container:has(#hubScreen.active)`); fine for modern browsers, degrades gracefully.
- **`@keyframes` collisions** — the app already has `spin`/`breathe`; prefix new ones (the loader uses `fsmvu-*`).
- The app already had FSM branding (`fsm-logo.png`, app icons) before the seal loaders.

## 10. Live/prod
- Hosting URL: **https://empower-vocabulary-practice.web.app** (project `empower-vocabulary-practice`).
- Firebase config is inline in each page's `<script>` (apiKey etc. — fine, it's a public web config; security is in the rules).

## 11. Where the detailed history is
`.claude/checks/2026-05-27-*.md` and `2026-05-31-*.md` — one dated md per change (classroom builds, accordions, dashboard overhaul, assignment lifecycle audit, reading/listening completion, PWA, writing feedback v2, dialogs+checkboxes, icon swaps, FSMVÜ loaders, two-column hub, rail refine, Firestore read fixes #1–#4, classroom back-nav + cache root-cause, promote-email + tooltips, student info chips, assignment accordion). Start there for any specific subsystem.
