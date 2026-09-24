# 2026-09-24 (b) - HOTFIX: game hosts showed no players in a live class

He said: "all games can't find players when they go for the QR code. no
players, embarrassed me."

## What happened (evidence, read-only production reads)

- Production rooms from this morning (07:06-07:14 UTC): trust GSHD (15
  players), trust KUMR (14), heist ZYVW (15). Students DID join: their
  player docs are in Firestore (real students' names; not repeated here). The rooms
  stayed in "lobby" because the host screen never showed them.
- Anonymous sign-in is enabled; the live ruleset equals the file on disk
  (rules-live-check PASS); every live game page and asset returns 200.
- Reproduced on the emulator: an anonymous phone joined a Trust room, the
  host stayed at 0, and the host console showed
  "ReferenceError: MG is not defined at renderRoster".

## Cause

The Trust, Heist, Reading and Listening HOST scripts play a "student
joined" sound with MG.sfx('join') as the FIRST line of renderRoster. Those
four pages never load classroom/js/minigame-core.js, which defines MG, so
every join threw before the player count and list were written. The line
came in with the join-sound change (files dated 2026-09-08). The other games
(AI Quiz, Bingo, Scramble, Tug, Vocab Race) load minigame-core.js or use no
MG and were never affected. No gate opened these host pages with a real join.

## Fix

- The four hosts call js/sound.js (which they do load) directly, guarded and
  in try/catch: a sound can never stop the roster from drawing.
- New gate tools/page-globals-check.js: every classroom page must load what
  its scripts use (MG). Fails on the broken file, passes on the fix; picked
  up by gates.js automatically.
- Proven: emulator Trust room with the fixed script (v5): an anonymous phone
  joined and the host showed "QR Phone - Ready", count 1.

## Also in this deploy (second review, low/medium)

- progress.js: an offline, empty-from-cache sessions answer is treated as a
  failure (keeps the student's saved numbers instead of writing zeros).
- scramble-teacher.js: listeners stay attached until the results reads finish
  (offline host no longer gets an empty podium/report); duplicate or
  abandoned player docs that never answered are not counted as "no answer".
- grammar.js: the per-drill full stats re-read was removed again (cost).
- Not done yet: the teacher Overview message list at 340 px on laptops (an
  opened message's reply box sits below the fold inside the list) and the
  long list on phones. Queued.

## Ritual

node --check on every touched script; no em/en dash; gates.js 35 passed, 0
failed (1 production gate skipped); bump.js --check consistent at v456.

## Deploy

    firebase deploy --only hosting
Then on the classroom laptop: open the game page and refresh once (or close
the tab and reopen) so the new version loads before students scan.
