# Sanity + Smoke — Trust No One · Phase 1

**Date:** 2026-05-26
**Trigger:** New classroom game requested ("third card in the picker"). Phase 1 = picker + setup form + lobby + role assignment + question stream + basic results. Phases 2-4 add clues/sabotage, meetings/voting, ghost mode.

---

## Scope shipped in Phase 1

| Layer | Built |
|---|---|
| Picker card on `classroom-teacher.html` | ✓ 3rd card "Trust No One" with NEW badge |
| Inline setup form | ✓ pack / impostors (1–4) / target / reliability / reward / duration / student-meetings / meeting cooldown |
| Hand-off to host page | ✓ `?auto=1&pack=…&imp=…&…` URL params, pre-paint sync prevents flash |
| Host page (`classroom-trust-teacher.html`) | ✓ auto-create, lobby with code+QR+roster (Vocab-Race-identical chrome), Start button, liftoff briefing with full crew + roles, live board, results screen |
| Student page (`classroom-trust-student.html`) | ✓ join, waiting/airlock, role reveal (crewmate / impostor + fellow-impostors list), question stream, status chips, final standing |
| CSS (`classroom/css/trust.css`) | ✓ deep-space gradient + starfield, indigo/cyan/amber palette, role cards with reveal animation, status chips, brand-consistent buttons |
| Firestore rules (`/trust_sessions/{code}/...`) | ✓ players + clues + sabotages + meetings + meeting votes paths declared (Phase 2-3 can write without re-deploy) |
| Background music | ✓ same five-track loop + control as the rest of classroom mode |
| Brand-reset CSS link | ✓ included on both new pages |

## What Phase 1 does NOT have (by design)

These come in later phases — already wired in the data model & rules so adding them is non-breaking:

- Sabotage UI (impostor button)
- False-clue UI (impostor)
- Clue feed in the play view
- Meeting trigger (student emergency button + teacher button)
- Voting screen
- Eject mechanic
- Ghost mode (continue playing + donate)
- Auto win-condition detection (currently host clicks End)

---

## Files created / modified

**Created:**
- `y/classroom-trust-teacher.html`
- `y/classroom-trust-student.html`
- `y/classroom/js/trust-teacher.js`
- `y/classroom/js/trust-student.js`
- `y/classroom/css/trust.css`

**Modified:**
- `y/classroom-teacher.html` — added 3rd picker card, Trust setup screen view, picker hover/focus rules, JS wiring for pack load + back link + create handoff
- `firestore.rules` — added `/trust_sessions/{code}/...` block with players, clues, sabotages, meetings, votes paths

---

## Checks run

| Check | Result |
|---|---|
| `classroom-trust-teacher.html` div balance | ✅ 42 / 42 |
| `classroom-trust-student.html` div balance | ✅ 33 / 33 |
| `classroom-teacher.html` div balance | ✅ 88 / 88 (was 70 pre-Trust) |
| `classroom/js/trust-teacher.js` syntax | ✅ |
| `classroom/js/trust-student.js` syntax | ✅ |
| All 23 host-page id's reconciled across DOM and JS | ✅ (volumeSlider expected to be DOM-only — wired via inline `onchange`) |
| All 15 student-page id's reconciled | ✅ (same volumeSlider note) |
| `node tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test (when next on a real browser + deployed rules)

1. **Picker** — open `classroom-teacher.html` → confirm three cards (Vocab Race, The Heist, Trust No One NEW badge). Hover lifts each card. Click Trust No One → reveals inline setup form.
2. **Setup** — pack dropdown populates from `heist-packs.json`; impostors dropdown defaults to 2; reliability defaults to Normal. Submit → navigates to `classroom-trust-teacher.html?auto=1&…`, sees `🚀 Preparing the mission…` placeholder for ~half a second, then lobby.
3. **Lobby** — same DOM as Vocab Race + Heist (big code, QR card, player grid). Start button is disabled until at least 4 players join. Open `classroom-student.html` (or scan the QR) in 4 incognito tabs to simulate.
4. **Liftoff** — host hits Start. Host briefly sees their crew with roles labeled (cyan crewmate / amber impostor). Each student tab sees their own role-reveal card with a scale-in animation. Impostor students also see a "Your fellow impostors: …" callout.
5. **Play** — after 8s the host's view flips to the live board (rank, role, alive/ghost, investigations count, coins, accuracy). Each student's tab shows a vocab MCQ. Correct answer → coins go up, investigations counter ticks up. Host board updates live.
6. **End** — host clicks End mission → themed confirm modal → confirm → both host (full per-player breakdown) and students (personal final standing) see the results screen. Run Another Round returns to the picker.

---

## Standing preferences applied this round

- **Stylish = brand-wide reach.** Reused `classroom/css/styles.css` lobby chrome so Trust looks like the other two games in lobby; added a *deep-space* `trust.css` layer (indigo/cyan/amber, starfield gradient) for the unique screens (briefing, status chips, role card animation).
- **Sanity + smoke + dated md.** This file.

---

## Open items / Phase 2 backlog

(none of these block Phase 1's playability — Phase 2-4 to deliver them)

1. **Phase 2** — Clue engine (every ~60s drop) + impostor sabotage button + impostor false-clue button. Firestore `clues` + `sabotages` paths already accept writes.
2. **Phase 3** — Meeting triggers (student emergency button + teacher "Start meeting" button), 60s vote timer, anonymous-until-reveal voting, eject mechanic with role-reveal animation.
3. **Phase 4** — Ghost mode (continue answering, donate coins to alive teammates of same role), automatic win condition wiring (crewmates vote off all impostors OR target hit; impostors ≥ alive crewmates), final podium with per-team win.
4. **Deploy gate** — `firebase deploy --only firestore:rules` needed before any of Phase 1 actually runs in production (new `/trust_sessions/...` block).
5. **Smoke test on real devices** — only verified in static analysis. The full end-to-end flow needs at least one human + two phone tabs.
