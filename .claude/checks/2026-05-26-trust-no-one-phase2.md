# Sanity + Smoke — Trust No One · Phase 2

**Date:** 2026-05-26
**Trigger:** "Go phase 2." Adds clue engine + sabotage + false-clue planting on top of the Phase 1 scaffold.

---

## Scope shipped in Phase 2

| Feature | Where |
|---|---|
| Clue cadence engine | `trust-teacher.js · fireScheduledClue` — fires every 60s while session is in `playing`. First clue fires 8s after launch so the feed isn't empty. |
| TRUE-clue generation from real stats | `generateTrueClue` — detects last-3-correct streaks, last-2-wrong slumps, and falls back to "top investigator" leaderboard observations |
| FALSE-clue generation from random templates | `generateFalseClue` — 6 plausible-sounding templates about a random alive player |
| Reliability slider hook | `session.settings.reliability` rolls TRUE vs FALSE per fire |
| Sabotage from impostors | Roster card `💥` button (impostor-only, alive-only, crewmate-target-only). Confirm modal. Writes `/sabotages/{id}` with `status: pending`. |
| Sabotage resolver | `trust-teacher.js · resolveSabotage` — atomic transaction: −₿20 from target balance (clamped to 0), marks sabotage resolved, fires a `sabotage_trail` clue |
| False-clue planting from impostors | "Plant a fake clue" button → target picker modal (crewmates only). Writes `/clues/{id}` with `injected: true`. |
| Live clue feed on host view | New right-side panel beside the leaderboard. Shows TRUE / NOISE / PLANTED tags (host only — students don't see these labels). |
| Live clue feed on student view | New panel under the investigation pane. Just text + timestamp (no truth tags — that's the deduction game). |
| Impostor tools panel (student) | Visible only when `myPlayer.role === 'impostor'` and `alive !== false`. Shows live sabotage + fake-clue charges. |
| Cleanup | `cleanupListeners` now also tears down `unsubSabotages` and the clue interval. |

## Data model additions

**`/trust_sessions/{code}/clues/{id}`** (Firestore rules already cover this from Phase 1):
```
{
  createdAt, status: 'pending'|'resolved',
  targetUid, targetName, text, kind,
  isTrue: bool, injected: bool, attackerUid?: uid
}
```
- Scheduled clues are written by the host with `status: 'resolved'` directly.
- Impostor-planted clues are written client-side with `status: 'pending'` to satisfy the existing create rule, but the host doesn't need to resolve them — they're already useful as-is. (Could be cleaned up to `status: 'resolved'` by the host in a future hardening pass; not blocking.)

**`/trust_sessions/{code}/sabotages/{id}`** (also from Phase 1 rules):
```
{
  createdAt, status: 'pending'|'resolved',
  attackerUid, attackerName, targetUid, targetName,
  effect: 'coin_penalty', amountTaken?: number, resolvedAt?: ts
}
```

---

## Files modified

- `y/classroom/js/trust-teacher.js` — `playerHistory` snapshot map, clue engine (`fireScheduledClue` + `generateTrueClue` + `generateFalseClue`), sabotage resolver (`resolveSabotage`), live clue feed render (`renderClueFeed`), cleanup additions
- `y/classroom/js/trust-student.js` — `subscribeClues` + `renderClueFeed`, `doSabotage`, `plantClue`, `refreshImpostorTools`, `openSabotageModal`, `openPlantClueModal`, roster now injects `💥` buttons for impostors viewing crewmates
- `y/classroom-trust-teacher.html` — clue-feed panel in live view, layout updated to 1.4fr / 1fr grid
- `y/classroom-trust-student.html` — clue feed under investigation pane, impostor tools panel, sabotage-confirm modal, plant-fake-clue modal

## Files NOT touched

- `firestore.rules` — the `/clues` + `/sabotages` paths were declared in Phase 1 with the right permissions. No re-deploy needed.
- `trust.css` — no new styles required; reuses existing `.trust-chip`, `.modal-content`, `.trust-btn`.

---

## Checks run

| Check | Result |
|---|---|
| `classroom-trust-teacher.html` div balance | ✅ 46 / 46 |
| `classroom-trust-student.html` div balance | ✅ 45 / 45 |
| `classroom/js/trust-teacher.js` syntax | ✅ |
| `classroom/js/trust-student.js` syntax | ✅ |
| All Phase 2 host DOM IDs reconcile with JS | ✅ |
| All Phase 2 student DOM IDs reconcile with JS | ✅ |
| Function symbols only present where expected | ✅ (no DOM rendering of internal function names — correct) |
| `node tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test (real browsers)

1. Host launches a Trust No One game with ≥4 players (1 impostor for a clear test).
2. After liftoff briefing → on the **host live view**, the right pane shows the clue feed; first clue lands ~8 seconds into play. Subsequent clues fire every 60 seconds.
3. Each clue on the host view shows one of three tags: **TRUE** (cyan), **NOISE** (indigo), **PLANTED** (amber).
4. On any **student tab**, the clue feed under the question shows the same clue text but WITHOUT the truth tag (that's the deduction game).
5. As the **impostor**, the right pane now shows the impostor-tools card with live sabotage / fake-clue counters. Crewmate roster cards now have a 💥 button next to their investigations count.
6. Click 💥 → confirm modal → ₿20 disappears from the target's coin balance + a `⚠️ Someone tampered with [target]'s investigation` clue fires in everyone's feed.
7. Click "Plant a fake clue" → target picker modal showing only crewmates → pick one → a `📉 [target] keeps getting wrong answers` (or similar) clue fires. Host view tags it PLANTED.
8. Charges decrement live and the buttons gray out / hide when depleted.

---

## Standing preferences applied

- **Brand-wide stylish** — reused existing `.trust-chip`, `.modal-content`, `.trust-btn` classes. New layouts feel native to the existing Trust + classroom UI.
- **Sanity + smoke + dated md** — this file.

---

## Phase 3 backlog (next round)

- Meeting trigger (student emergency button + teacher "Call meeting" anytime).
- Meeting screen: 60s timer, anonymous vote tally, reveal at timer end.
- Eject mechanic: most-voted player → role-reveal animation → spectator mode (skeleton; full ghost UX lands in Phase 4).
- Question stream pauses during meetings.
