# Empower Write demo moved on-server + localhost link fixed · 2026-06-12

## Why
The teacher Writing-Assignment modal's "AI correction (PREVIEW)" tab had a
hardcoded `http://localhost:8830/.staging/empower-write/` link — it only
worked on the dev machine and would break for every teacher once deployed.
User asked to deploy the FULL Empower Write demo (not a sample), on the
server, click-to-open.

## What Empower Write is (verified before deploying)
- Static AI writing-corrector DEMO at .staging/empower-write/. Renders
  SEEDED sample essays instantly (js/sample.js) at 3 depths (Light/Medium/
  Deep). NO live API call, NO key, NO backend in the demo path ("live AI
  runs once mounted"). So it is safe to put on a public URL.
- Reuses the real app engine: writing-comment-bank.js + writing-annotations.js.

## Done
- Copied .staging/empower-write/ -> y/empower-write/ (deployable; .staging is
  firebase-ignored via **/.*, y/empower-write is not).
- Fixed the 3 external relative paths in index.html (were ../../y/...):
  variables.css -> ../index/css/variables.css;
  writing-comment-bank.js + writing-annotations.js -> ../assignments/js/.
- Softened staging wording (title/tag/footer -> "demo").
- Removed staging-only docs from the deployed copy (COST/PROMPT/README/SCHEMA
  .md) — kept in .staging as the source of record.
- Repointed the teacher-dashboard "Open the working preview ▶" link:
  localhost:8830/.staging/... -> empower-write/ . Updated the note text.
- Deleted the interim y/writing-feedback-demo.html (the real demo supersedes
  the static sample I built earlier).

## Verified live (preview server)
- /empower-write/ = 200; variables.css / comment-bank / annotations all 200
  at the new relative paths.
- Page boots: title "Empower Write · Demo", CORRECTOR_SAMPLES loaded,
  window.WritingAnnotations present, 5 sample options, 3 depth chips, results
  panel visible, 14 inline highlight marks rendered, 0 JS errors.
- node --check on all 3 demo JS files OK. firebase ignore list does NOT
  match y/empower-write -> it deploys.
- Grep: 0 localhost/.staging/8830/empower-write refs remain in the deployable
  app (tools/ + .tmp/ are ignored anyway).

## Cache
- SW v37 -> v38 (new static files).

## Deploy
- firebase deploy --only hosting.

## Deferred (user said "then we will go for GitHub")
- GitHub push: remote already set (origin =
  github.com/inskabiri-wq/Empower-Vocabulary). Do NOT auto-push; wait for
  the user. When they ask: one push + give them the link to bookmark, no
  auto-updates after.
