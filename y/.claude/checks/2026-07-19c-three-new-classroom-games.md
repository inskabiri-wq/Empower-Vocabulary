# 2026-07-19c - Three new classroom games: Tug of War, Vocab Bingo, Sentence Scramble

User picked these 3 from the options list. HARD REQUIREMENT honored: the join
room is the SAME as the existing games (session code + qrserver QR card +
classroom-<game>-student.html?code= prefill), old games untouched, everything
modular, results + CSV + gameReports -> Admin > Reports at the end.

## Architecture (mirrors The Heist)
- Per game: classroom-<g>-teacher.html + classroom-<g>-student.html +
  classroom/js/<g>-teacher.js + <g>-student.js. Host tab = referee.
- NEW shared infra: classroom/js/minigame-core.js (MG: esc/shuffle/codes/QR/
  toasts/music/CSV/ask + ALL question builders) and
  classroom/css/minigames.css (shared shell, per-game accent via body class).
- 5-char codes (Heist/Trust=4, Race=6). classroom/js/student.js joinSession
  now routes 5-char codes across tug/bingo/scramble_sessions.
- Content NEVER invented: vocab verbatim from datasets.json, grammar from
  GRAMMAR_PRACTICE, both through cc-classroom hidden-content filters.
  DIFFICULTY RULE applied: A2 = gap-fill / gapped-sentence clues; definitions
  only from B1 up (per vocab-question-difficulty memory).
- Hosts build all content into the session doc; student pages load no banks.
- Emulator opt-in hook (localhost + localStorage.useEmulators='1') added to
  all 6 new scripts AND classroom/js/student.js (parity with teacher.js).

## Games
1. TUG OF WAR (tug_sessions, body.tug, amber/red): auto-balanced RED vs BLUE,
   continuous MCQ stream (vocab/grammar/mixed, level+unit), every correct = 1
   pull; projector rope; win = target lead (10/15/25) or timer lead. Report
   outcome "Red team wins 3-0", players tagged [R]/[B].
2. VOCAB BINGO (bingo_sessions, body.bingo, purple/pink): 20-32 word pool,
   per-student random 4x4 card (rejoin-safe), host calls clues on the
   projector (A2 gap sentences / B1+ definitions), students tap the word;
   uncalled tap = 3s lockout; mark +10, line BINGO +50 (timestamped order);
   answer key on results.
3. SENTENCE SCRAMBLE (scramble_sessions, body.scramble, green): synchronized
   rounds of the bank's own example sentences (4-10 words) scrambled
   (position-indexed chips so duplicate words work); correct = 100 + 2/sec
   left; rounds auto-advance on timer or all-submitted (+ manual Next);
   sentence review on results.

## Wiring
- classroom-teacher.html: 3 picker cards (NEW badges) + 3 inline setup forms
  + ?auto=1 handoffs + featureToggles MAP (game_tug/bingo/scramble, default
  visible; hide by setting false in Admin > Features).
- feature-activation.js: 3 new toggle rows. reports-admin.js: icon/name maps.
- firestore.rules: _isMiniHost(coll, code) + 3 session blocks (teacher-create
  with self hostUid, host/admin update+delete, any-auth read, players
  owner-or-host write). DEPLOY RULES REQUIRED or session creation fails.
- Fix found by E2E: onAuthStateChanged can refire after history.replaceState
  strips ?auto=1 and bounced the host back to the hub mid-create - added a
  one-shot `booted` guard in all 3 teacher controllers.

## Verification (REAL E2E on Firebase emulators - auth+firestore+hosting,
   seeded demo teacher, my rules loaded by the emulator = rules compile OK)
- Static: node --check x10 clean; em-dash scan clean; id cross-check script
  (every getElementById vs page ids) caught + fixed a missing teamBar id.
- Unit (node, real banks): A2 MCQs all gap-fill w/ 4 options; B1 all
  definition; unit filters; grammar/mixed counts; scramble rounds 4-10 words,
  really scrambled, same words; 900+ gappable A2 pool. ALL PASS.
- TUG: hub card -> setup (levels A2/B1/B1+/B2, 13 units) -> create ->
  lobby code CUHVT + QR + join URL; student joined via ?code, auto RED;
  host-wrote a Blue Bot (host rule exercised); Start; 3 gap-fill answers ->
  score 3, mini + host rope moved (knot 41%), live board; End -> RED WINS
  banner, podium, table, CSV; gameReports/tug-CUHVT-20260719 w/ outcome +
  [R]/[B] players; student saw "YOUR TEAM WINS". PASS.
- ROUTER: classroom-student.html + 5-char code QTHXF -> redirected to
  classroom-bingo-student.html?code=QTHXF. PASS.
- BINGO: A2 pool 20 -> "clues are gapped sentences"; card 16; clue 1 gap
  sentence; wrong tap -> 3s lockout (blocks even correct taps), correct tap
  after -> marked +10; called all 20 (history reveals past words); top-row
  taps -> BINGO +50 (score 90), host live banner; End -> results + 20-row
  answer key + gameReports doc (mode gap-sentences). PASS.
- SCRAMBLE: 5 rounds 40s; round 1 host answer key + timer; student built
  correct order -> +150 (100 + 25s x2); all-submitted auto-advance to round
  2; wrong order -> X + correct sentence revealed, no points; End -> table
  (1/2, 50%), 5-row sentence review, gameReports doc. PASS.

## Versions
New assets at ?v=1 (minigames.css, minigame-core.js, 6 game scripts).
feature-activation.js ?v6, reports-admin.js ?v11, SW v108 -> v109
(student.js has no ?v ref - covered by the SW purge).

## Ship
firebase deploy --only hosting AND --only firestore:rules (new collections).
Games are ON by default; hide any of them in Admin > Features if not wanted.
