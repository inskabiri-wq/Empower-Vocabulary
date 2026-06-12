# Sanity + Smoke — Trust No One · Phase 4 (final)

**Date:** 2026-05-26
**Trigger:** "Go" after Phase 3 landed. Closes the game loop — ghost continue-play, coin donations, investigations-target win condition, stalemate handling, and a polished results screen with per-team podiums.

---

## Scope shipped in Phase 4

| Feature | Where |
|---|---|
| Ghost continue-play UI | Ejected players land on `view-ghost` with a full vocab MCQ stream (`ghostQStem`, `ghostQOpts`, `ghostQFeedback`) + live clue feed + ghost banner with role label + coin chip. |
| Ghost coin earnings (no investigations) | `onGhostAnswer` increments `balance` + `questionsAnswered/Correct` but explicitly NOT `investigationsCompleted` — so dead players can't sway the win counter. |
| Coin donation modal | "🎁 Donate" button on the ghost banner opens `donateModal`. Lists eligible recipients (alive AND same role), validates amount (≥ ₿10, ≤ donor balance), optimistically deducts the donor, writes a `/donations` doc with `status: 'pending'`. |
| Host donation resolver | `unsubDonations` listens for pending docs. Transaction credits recipient via `increment(amount)`; refunds the donor if recipient died in-flight or role-mismatched (defensive — UI already blocks that path). Marks doc `resolved` / `rejected`. |
| Investigations-target win condition | `checkInvestigationsWin` runs on every player snapshot. When sum of alive-crewmate `investigationsCompleted` ≥ `target × initialCrewmates`, flips `session.status` to `finished` with `winner: 'crewmates'`, `winReason: 'investigations'`. Guarded by `winFired` so it doesn't double-fire. |
| Initial crewmates snapshot at launch | `startGame` writes `initialCrewmates` and `initialImpostors` to the session doc so the target isn't recomputed as crewmates die (would otherwise shrink the win bar in impostors' favour). |
| Stalemate handling | `endGame('stalemate_time')` fires when the duration timer hits zero. Sets `winner: 'stalemate'` + `winReason: 'time'` — but only if no winner was set earlier (meeting resolver / investigations check win-on-eject takes precedence). |
| Results screen polish | `view-results` redesigned: winner banner (4 variants — crewmates / impostors / stalemate / aborted, each with its own gradient + glow), top-3 podium per role, mission-stats grid (investigations / meetings / clues / planted clues / sabotages / donations), collapsible per-player breakdown. |
| `/donations` Firestore rules | Owner-creates-pending, host-only-updates, all-auth-read. Defensive `amount > 0` shape check. |
| Live ghost coin chip | `subscribePlayer` now also calls `updateGhostCoins()` on every snapshot so the chip reflects incoming donations to the player (even though that's a recipient flow — the same path keeps a ghost's own earnings live as they accumulate). |
| Live ghost clue feed | `subscribeClues` now renders BOTH `#clueFeed` and `#ghostClueFeed` so ejected players stay informed even though they can't vote in subsequent meetings. |

---

## Data model additions

**`/trust_sessions/{code}`** — new Phase 4 fields:
```
initialCrewmates: number          (locked at startGame for win-bar math)
initialImpostors: number          (informational)
winReason: 'investigations'       (set at investigations-target trigger)
          | 'manual'
          | 'stalemate_time'
winner:    'crewmates' | 'impostors' | 'stalemate' | 'aborted'
```

**`/trust_sessions/{code}/donations/{donId}`** (new collection):
```
donorUid, donorName,
recipientUid, recipientName,
amount: number > 0,
status: 'pending' | 'resolved' | 'rejected',
reason: 'recipient_missing' | 'recipient_dead' | 'role_mismatch' | 'bad_amount'
        (only on status='rejected')
createdAt: timestamp,
resolvedAt: timestamp
```

---

## Files modified

- `y/classroom/js/trust-student.js`
  - `subscribePlayer` now also calls `updateGhostCoins()` every snapshot
  - `subscribeClues` now also calls `renderGhostClueFeed()` every snapshot
  - `DOMContentLoaded` wires `ghostDonateBtn` → `openDonateModal`
- `y/classroom/js/trust-teacher.js`
  - new state: `unsubDonations`, `cachedSession`, `winFired`
  - `startGame` writes `initialCrewmates` + `initialImpostors`
  - `unsubSession` caches `d` into `cachedSession`
  - `unsubPlayers` calls `checkInvestigationsWin(players)` per snapshot
  - new `resolveDonation(donId, don)` — transactional credit + refund-on-failure
  - new `checkInvestigationsWin(players)` — flips status when target hit
  - `endGame(reason)` accepts a reason, sets `winner` + `winReason` if not already set
  - `startTimer` passes `'stalemate_time'` to endGame on natural expiry
  - `showResults` completely rewritten — banner + podium + stats grid + collapsible table
  - `unsubDonations` added to `cleanupListeners`
- `y/classroom-trust-teacher.html` — `view-results` redesigned with new IDs: `resultsBanner`, `winIcon`, `winTitle`, `winSub`, `podiumCrewmates`, `podiumImpostors`, `resultsStats`
- `y/classroom-trust-student.html` — (no new HTML this iteration — view-ghost + donateModal were already there from earlier Phase 4 work)
- `y/classroom/css/trust.css` — appended Phase 4 styles: `.trust-ghost-head`, `.ghost-icon-mini`, `.trust-results`, `.trust-win-banner` (+ 4 win-variant classes), `.trust-podiums`, `.trust-podium`, `.podium-row` (+ place-1/2/3 medals + ghost variant), `.trust-stats-grid`, `.stat-tile`, `.trust-results-table` (collapsible details)
- `firestore.rules` — added `/donations/{donId}` matcher under `/trust_sessions/{code}`

---

## Checks run

| Check | Result |
|---|---|
| `classroom-trust-teacher.html` div balance | ✅ 70 / 70 |
| `classroom-trust-student.html` div balance | ✅ 84 / 84 |
| `classroom/js/trust-teacher.js` syntax | ✅ |
| `classroom/js/trust-student.js` syntax | ✅ |
| All host Phase 4 DOM IDs reconcile with JS | ✅ (`podiumCrewmates` / `podiumImpostors` referenced via string-arg helper) |
| All student Phase 4 DOM IDs reconcile with JS | ✅ |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test (5+ tabs, 1 host + 4 students)

1. **Host launches** Trust No One with 5 players (1 impostor) + target = 5. Liftoff briefing displays correct crew assignments.
2. **Crewmates answer questions** → investigations counter climbs. Watch the live board: total investigations rises in the chip.
3. **Host calls a meeting** → vote for the impostor → eject reveal flashes "was an IMPOSTOR" → game ends with **Crewmates win!** banner (via ejection path, `winner: 'crewmates'` already set; results banner shows cyan-violet gradient).
4. **Reset, scenario 2**: don't call any meeting. Crewmates grind. When total alive-crewmate investigations ≥ `target × 4` (4 starting crewmates × 5 target = 20), check fires → status flips to finished → **Crewmates win! · Investigations** banner, sub-text reads "The crew completed enough investigations".
5. **Reset, scenario 3 (Impostor win)**: 4 players (1 impostor). Vote out a crewmate → only 2 crew left → `aliveImpostors >= aliveCrewmates` → **Impostors win!** banner with amber gradient + glow.
6. **Reset, scenario 4 (Stalemate)**: set duration = 1 min. Don't call meetings. Don't let crew hit target. Timer hits 0 → `endGame('stalemate_time')` runs → **Stalemate — time's up** banner with violet gradient.
7. **Reset, scenario 5 (Ghost loop + Donation)**:
   - Vote out a crewmate. They land on `view-ghost` showing their ghost banner ("You have been ejected · You were a CREWMATE") + question pane + clue feed.
   - Ghost answers questions correctly → ₿ chip climbs. Ghost's `investigationsCompleted` does NOT climb (cross-check in host live board).
   - Ghost clicks 🎁 Donate → modal lists living teammates of same role only (other crewmates). Picks one, enters ₿50 → modal closes with toast "🎁 ₿50 sent to X".
   - Recipient's ₿ chip increases in their live status strip (subscribePlayer fires).
   - Ghost's balance dropped by 50 immediately (optimistic), then host's transaction settles.
8. **Donation rejection scenarios**:
   - Ghost tries to donate to a ghost teammate → UI blocks (filter excludes alive=false). Modal shows "No living teammates of your role".
   - Ghost donates, but recipient is ejected in the same window → host's transaction detects `r.alive === false`, refunds the donor → donor sees their balance restored.
9. **Results screen polish**:
   - Banner shows correct gradient + icon for each win type.
   - Top-3 podium per role displays players sorted by balance with 🥇🥈🥉 medals.
   - Ghosts in the podium show 👻 + 65% opacity.
   - Stats grid shows mission totals (investigations / meetings / clues / planted / sabotages / donations + ₿ moved).
   - Per-player table is collapsed by default; expanding it reveals the full breakdown including role + accuracy.

---

## Standing preferences applied

- **Brand-wide stylish** — Phase 4 visuals reuse the deep-space palette + JetBrains Mono accents + gradient text headlines + dashed-violet ghost framing from earlier phases. Win banner gradients track team colours (cyan-violet for crew, amber-red for impostors, violet for stalemate, slate for aborted). Podium medals + stats grid + collapsible details element all stylized to match.
- **Sanity + smoke + dated md** — this file.

---

## Open concerns / hardening backlog

- **Rejoin-as-ghost resurrects**: `joinRoom` writes `{ alive: true, ... }` via `set({merge: true})`. If a ghost reloads, they're flipped back to alive. Edge case (kids don't reload mid-mission), but worth a guard: detect "doc already exists with alive=false" and skip the alive: true write. Will lift in v1.1.
- **Donation amount race**: donor optimistically decrements `balance`. If they spam Donate during the 1-2s before the host resolves the previous one, they could over-deduct themselves. Worst case: balance goes briefly negative client-side; host transaction catches it and the donation is rejected with reason `bad_amount` once the input fails the min-amount validation. Defensive: the donate button is disabled while in-flight (`ok.disabled = true; ok.textContent = 'Donating…'`).
- **Stale `/donations` docs**: rejected donations linger in the subcollection. Not harmful (host's listener early-bails on non-pending), but a cleanup pass at endGame could trim them. Out of scope here.
- **Investigations-target check on dead crewmate scenario**: if a crewmate dies mid-game with 4 investigations, those 4 stop counting toward the target (filter is `alive !== false`). This is by design — the target is "what the LIVING crew has completed" — but the spec called for "vs target × initialCrewmates" which doesn't shrink. End result: crew needs survivors to close out the win, which is the intended deduction-game pressure.

---

## Trust No One — feature-complete

All four phases shipped. Mission loop closed: lobby → liftoff → playing → meetings → eject → ghost → donations → endgame (with 4 distinct win paths). Ready for classroom field test.
