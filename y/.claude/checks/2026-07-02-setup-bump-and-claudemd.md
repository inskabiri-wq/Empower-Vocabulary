# 2026-07-02: setup improvements #1 (bump tool) + #2 (CLAUDE.md)

From reflection-notes.md, built the two highest-leverage, lowest-cost items.

## #1  y/tools/bump.js - cache-version helper
The most repeated manual chore (~1,477 ?v= / CACHE_VERSION touches in one session)
and the top phantom-bug source (most "still broken" reports were stale caches).
- `node y/tools/bump.js --check`  read-only: lists all 26 versioned assets + the
  service-worker CACHE_VERSION, flags any asset referenced with inconsistent versions.
- `node y/tools/bump.js <files>`  bumps ?v= for the named files across every HTML and
  bumps CACHE_VERSION once (covers no-query assets). Name-matched with a boundary so
  config.js never hits activity-config.js.
- `node y/tools/bump.js --sw`     bumps only CACHE_VERSION.
Verified: syntax OK; --check reports 26 assets, all consistent, SW v70. Write path
tested on grammar.css (17->18) + SW (v70->v71) via a scratchpad harness, asserted
bumped-by-1, then restored to 17 / v70. Final audit clean (no net change to repo).

## #2  CLAUDE.md at repo root
No CLAUDE.md existed at any level; standing rules lived only in fuzzy auto-memory.
Captured: edits go to y/ not the worktree; no em dashes; never deploy/push; protected
empower-* ids; the end-of-change ritual (now pointing at bump.js); the cache/deploy
model; and the Windows landmines (inline node -e quoting, OneDrive Desktop ENOENT,
SheetJS fs binding, stale git ls-files, preview screenshot timeouts, auth-gated
verification).

## Sanity
- node --check bump.js OK. em-dash scan on both new files: 0.
- No app behaviour changed; no deploy/push. #3, #4, #5 left as notes for later.
