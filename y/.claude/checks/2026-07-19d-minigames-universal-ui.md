# 2026-07-19d - Mini-games restyled to the UNIVERSAL classroom UI + music

User feedback on the 3 new games: underlined links, different coloring/fonts/
backgrounds, different-looking results/reports screens. Rule going forward:
game MECHANICS may look different (rope, bingo card, chips, per-game accent),
but the BASICS are the universal classroom look - fonts, background,
shadowing, cards, buttons, code display, rosters, leaderboards, podium.

## What changed
- minigames.css REWRITTEN as a thin layer: no more custom palette/background/
  font. Only game widgets remain (tug rope, bingo call card + grid, scramble
  chips, QR-card copy, mg-live-grid, feedback/opts, toast) - all styled with
  the classroom tokens (--bg-item, --border-color, --accent-primary...) plus
  a per-game accent var used ONLY inside those widgets.
- All 6 game pages rebuilt on the classroom scaffold: gradient-bg + 4
  floating shapes, .header (gradient h1 title, btn btn-secondary links - NO
  underline), .container/.card, .session-code-display (dashed box + Space
  Mono code), the SAME .session-qr-card, .players-section/.players-grid,
  .form-group/.form-label/.form-input/.code-input join forms,
  .lobby-container student screens with .waiting-animation dots,
  .leaderboard-list results, .podium, .game-timer, btn-success start /
  btn-danger end / btn-secondary download / btn-primary new-session.
- JS renderers now emit the canonical components: .player-card rosters
  (avatar circle + name + status; tug adds team border), .leaderboard-item
  rows (rank/name/details/score, current-user highlight), .podium-place
  first/second/third with medals (CSS handles the 2-1-3 order), timer
  'warning' class, MG.ask emits the real .confirm-modal component.
- MUSIC: each game now rotates 6 tracks (was 3) with distinct sets per game,
  all from the same free library the existing games use (SoundHelix - the
  only media host in the CSP). All 16 track URLs verified reachable. NOTE
  told to user: for genuinely custom music, drop own mp3 files under y/
  (media-src 'self' already allows them) and we point the playlists there.

## Verification (Firebase emulators, real teacher login)
- Tug host lobby computed: body Poppins + #0a0f1a, gradient-bg + 4 shapes,
  header h1, back links textDecoration none + --bg-item bg, dashed
  session-code-display + Space Mono, .card #152035 r20, QR card. PASS
- Student join: lobby-icon/title, Space Mono code input (prefilled from QR
  URL), gradient primary button, waiting dots; joined -> team pill. PASS
- Roster renders .player-card (50% avatar circle). Live board renders
  .leaderboard-item. End -> real .confirm-modal -> results: 2x podium-place
  (first has gold gradient + CSS order 2), leaderboard-items, btn classes.
- Screenshot of bingo join page: visually identical to classic classroom.
- node --check x7 OK; leftover mg-* class scan clean; id cross-check ALL OK;
  bump.js: all restyled assets ?v=3, SW v109 -> v110, consistent.

## Ship
firebase deploy --only hosting (+ firestore:rules if not yet deployed from
2026-07-19c). Hard refresh for SW v110.
