# Reflection notes - setup improvement candidates (2026-07-02)

Diagnosis only. Evidence mined from the three vocab-trainer session transcripts by two
subagents, plus ground-truth checks of the setup itself. Ranked by leverage
(recurrence x benefit vs build cost), most leverage first.

Sessions referenced:
- S1 = funny-khorana (current, 117MB, ~29,500 lines: grammar debug, roster importer,
  pilot prep, Empower lock, mobile fixes, back-button fix)
- S2 = vigilant-mirzakhani (42MB, Jun 29: distractor logic, avatar conflicts,
  listening/audio, dataset integrity)
- S3 = wizardly-shannon (292KB, Jun 30: scoped audio audit - ran clean, zero friction)

Counts caveat: raw rg counts include system-context echoes (e.g. "worktree" ~8,700 in
S2 is mostly harness noise; "sanity"/"smoke" are partly inflated by the memory index
repeating in every turn). Direction is reliable; magnitudes are approximate.

---

## 1. Automate the cache-version bump (build: LOW, recurrence: EVERY change) - AUTOMATION

The single most repeated manual chore, and the single biggest source of phantom bugs.

- S1: ~1,477 combined `?v=` / `CACHE_VERSION` references; SW bumped v66 -> v70 by hand
  (4 times); "hard refresh" coached 19x. Every code change ended with a hand-edited
  version bump across html refs + service worker.
- S2: ~47 cache-bust refs, 596 build/deploy-cycle references.
- Consequence evidence: ~25 of the 29 issues in the FSM reviewer tracker were OLD-DEPLOY
  artifacts; the "passive both correct" screenshot was stale code; user frustration
  ("this again!") traces largely to fixed-but-stale-served bugs.

Candidate: `y/tools/bump.js` - given the list of changed files (or git diff), bump every
`?v=` reference to those files in all html, bump `CACHE_VERSION` once, and print a
consistency report (any versioned file referenced with two different v numbers fails).
Run it as the last step of any change. Kills the whole "reviewer tests stale JS" bug class.

## 2. Create CLAUDE.md - the standing rules live nowhere durable (build: TRIVIAL) - FIX

Ground truth: no CLAUDE.md exists at user, repo, y/, or worktree level, and no hooks are
configured. Every standing rule survives only in auto-memory files (probabilistic recall)
and gets re-stated in session summaries.

Rules that had to be re-derived or re-stated across S1/S2 and belong in a repo-root
CLAUDE.md:
- Edits go to E:\vocab-trainer\y\ (main repo), never the worktree copy.
- NO em dashes ever, in any output or file.
- Never run firebase deploy or git push; user does both. Push-only GitHub remote.
- Protected functional ids: empower-vocabulary-practice, empower-shell-*, the 'empower'
  book key, "Empower" coursebook name (visible brand is "Lingualab").
- End-of-change ritual: preflight checks + dated md log in y/.claude/checks/.
- Grammar edits must PASS node y/tools/grammar-sanity.js.
- Windows quirks (each cost real debugging time): never inline `node -e` with quoted
  code (7x "unexpected EOF" in S1 - write a script file to the scratchpad instead);
  Desktop is under OneDrive (ENOENT - use Downloads); vendored SheetJS cannot bind fs
  (use XLSX.write buffer + fs.writeFileSync); git ls-files can be stale after renames
  (use find for syntax sweeps); preview screenshots can time out (verify via
  preview_eval geometry instead).

## 3. One preflight script for the sanity ritual (build: LOW, recurrence: EVERY change) - AUTOMATION (+ optional skill)

The ritual (node --check sweep, em-dash scan, grammar-sanity, smoke, dated log) is
performed by hand with freshly-typed one-liners every time - and those ad-hoc one-liners
are exactly where the shell-quoting failures happen.

- S1: node --check ~1,109 refs, em-dash scans repeated per change, 15 SyntaxError +
  7 unexpected EOF from inline scripting, 34 E:\tmp workaround files.
- S2: 422 exit-code errors across the session's command loops.
- Manual scanning also MISSED things: 5 shipped user-facing em dashes were only caught
  late in S1's final sweep.

Candidate: `y/tools/preflight.js` - one command that runs: (a) node --check over every
real .js on disk (find-based, excludes vendor/min), (b) em-dash scan limited to
user-facing strings, (c) grammar-sanity, (d) version-consistency (from #1), (e)
JSON.parse of datasets.json + gateway_dataset.json (S2 lost hours to "dataset showing
0 words" corruption - 62 TypeErrors), then prints PASS/FAIL. Optionally wrap as a
personal skill so "/preflight" is one invocation; at minimum reference it in CLAUDE.md.

## 4. Emulator-seeded test login for real E2E (build: MODERATE) - AUTOMATION/INFRA

The app is auth-gated, so no session can ever truly verify login -> hub -> games.
Everything gets verified through throwaway harnesses instead.

- S1: 267 harness references, 29 "auth-gated / needs a signed-in student" blockers;
  the pre-pilot "end to end" check could only smoke the login page and code-verify the
  rest. Back-button, header, hint fixes each needed a custom harness page.
- S2: 356 preview-verify loops, 28 preview timeouts (7.9% failure rate).
- firebase emulators are ALREADY configured in .claude/launch.json but unused.

Candidate: a seed script (Auth emulator + Firestore emulator with one demo student +
one teacher + a class doc) plus a documented "verify against emulator" flow. Converts
"cannot verify, deploy and pray" into genuine login/games/grammar E2E before pilots.
Half-session build; highest payoff of the moderate-cost items.

## 5. Em-dash guard as a PostToolUse hook (build: LOW) - AUTOMATION

The rule is absolute but enforcement is manual and after-the-fact; S1 shipped 5
user-facing em dashes that survived multiple manual sweeps until the final audit.
A warn-only PostToolUse hook on Edit/Write (scan the written file for user-facing
em/en dashes outside comments/regex classes) closes the gap at write time.
Alternative: accept #3's preflight as the only gate and skip the hook (zero cost).

## 6. No action needed (explicitly considered)

- Preview screenshot timeouts (S1 several, S2 28x): tool flakiness, workaround is
  documented in #2 (verify via preview_eval). Not fixable from repo side.
- Regression frustration ("this again!" - 10 pushbacks S1, ~40 correction signals S2):
  root causes are stale deploys (#1), manual ritual gaps (#3), and no real E2E (#4);
  no separate artifact needed.
- Session shape: S3 (small, scoped) ran with ZERO friction signals vs S1/S2 mega
  sessions. Behavioral note, not a build: prefer scoped sessions when possible.
- 119-item completed task list clutters every turn: cosmetic; clear when convenient.
- A skill for roster/xlsx handling: the SheetJS quirks recur, but they are 3 lines of
  guidance (#2) - a full skill does not pay for itself yet.

---

Evidence sources: subagent A report (S1), subagent B report (S2+S3), ground-truth
checks (CLAUDE.md/hooks/skills presence) run 2026-07-02. No code or settings were
changed as part of this diagnosis.
