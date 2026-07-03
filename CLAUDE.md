# Lingualab - project guide

Lingualab is a Firebase web app (Firestore + Auth + Hosting, PWA) for ~400 FSMVU
English-prep students. Firebase project id: `empower-vocabulary-practice`. Admin:
`akabiriaslifar@fsm.edu.tr`. The app lives in `y/`. The visible brand is "Lingualab"
(it was formerly "Empower Lab").

## Where to work
- Make ALL edits in `E:\vocab-trainer\y\`. Do NOT edit the worktree copy under
  `.claude\worktrees\...`, even when a session's working directory is there.

## Hard rules (never violate)
- NO em dashes anywhere: not in code, comments, UI strings, or chat replies. Use
  hyphens.
- NEVER run `firebase deploy` or `git push`. The user does both himself. (GitHub is
  push-only backup: only push when told, never pull, never commit the service-account
  key.)
- Do not break protected functional ids when renaming or scrubbing text: the Firebase
  id `empower-vocabulary-practice`, element ids like `empower-shell-*`, the `'empower'`
  book key, and the "Empower" coursebook name. Only visible brand text becomes
  "Lingualab".

## After every change (the ritual)
1. `node --check` the JS you touched. For a full sweep use `find y -name '*.js'`
   (not `git ls-files`, which can be stale after renames).
2. Scan what you changed for em dashes.
3. Grammar-content edits MUST pass `node y/tools/grammar-sanity.js` (all units clean).
4. Bump cache versions: `node y/tools/bump.js <changed-file ...>` (see below).
5. Write a short dated log in `y/.claude/checks/YYYY-MM-DD-topic.md`.

## Cache / deploy model (why a "fixed" bug can look unfixed)
Browsers and the PWA service worker cache aggressively, so a change can appear
un-deployed until caches refresh. Two mechanisms:
- Assets referenced with `?v=N` in the HTML (e.g. `grammar.js?v=30`): bump N.
- `service-worker.js` `CACHE_VERSION='vN'`: bump once; this purges everything else.

`node y/tools/bump.js <files>` does both and keeps versions consistent.
`node y/tools/bump.js --check` audits all versions read-only and flags drift.
After the user deploys, one hard refresh (or reopening the tab) is needed so the new
service worker activates. Most "it is still broken / this again" reports have been
stale caches, not real regressions - bump and re-check before deep debugging.

## Windows / tooling landmines (each has cost real debugging time)
- Do NOT inline `node -e "..."` with quoted JS - shell quoting breaks with "unexpected
  EOF". Write a script to the scratchpad and run that instead.
- The Desktop is under OneDrive; writing to `C:\Users\kabir\Desktop\...` can ENOENT.
  Save to Downloads.
- Vendored SheetJS (`y/teacher/js/vendor/xlsx.full.min.js`) cannot bind `fs`. Read with
  `XLSX.read(fs.readFileSync(f), {type:'buffer'})`, write with
  `XLSX.write(wb, {type:'buffer', bookType:'xlsx'})` + `fs.writeFileSync`.
- Preview screenshots sometimes time out; verify layout via `preview_eval` geometry
  instead, and cache-bust CSS by re-setting each `<link>` href (the reload alone keeps
  the old stylesheet).

## Verifying
The real app is auth-gated (needs a signed-in student), which a session cannot do. So
verify UI/logic through isolated harnesses served by the `static-y` launch config, or
through code-level checks. Do NOT claim a browser flow was verified when only the logic
was. Firebase emulators are configured in `.claude/launch.json` if a real login flow is
needed.
