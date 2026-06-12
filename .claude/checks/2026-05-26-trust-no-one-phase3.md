# Sanity + Smoke — Trust No One · Phase 3

**Date:** 2026-05-26
**Trigger:** "Go" after Phase 2 landed. Adds meetings + voting + eject mechanics on top of the clue/sabotage engine.

---

## Scope shipped in Phase 3

| Feature | Where |
|---|---|
| Host "Call meeting" button | New button in `classroom-trust-teacher.html` live header. Confirm modal → opens meeting + flips `session.status: 'meeting'`. |
| Student "Emergency meeting" button | New button in the right pane of `view-play`. Disabled while cooldown active or no buttons left. Confirm modal → creates `/meetings` doc; host's tab flips status. |
| Host listener for student-called meetings | `trust-teacher.js` listens to `/meetings where status='open'` and flips `session.status` (rules block students from writing that field). |
| Meeting view (host + student) | Full-screen takeover with red urgency pulse bar, 60s countdown, voter grid + skip tile. Host sees live vote counts on each tile; students don't (deduction game). |
| Voting | Students click a tile → write `/meetings/{id}/votes/{myUid}`. Re-clickable until timer expires (changes vote). |
| Meeting resolver (host) | When timer expires (or host clicks "End meeting now"), reads all votes, tallies, picks ejection target (random tiebreak), flips `alive: false` on the loser, marks meeting `resolved`, sets `meetingCooldownUntil`, flips `session.status` back to `playing` (or `finished` if win condition triggers). |
| Win-condition checks at meeting resolve | Crewmate victory: `aliveImpostors === 0`. Impostor victory: `aliveImpostors >= aliveCrewmates`. Triggers `status: finished` + `winner` field. |
| Eject reveal screen (host + student) | 5-second role-reveal animation showing the ejected player's role + a vote tally. Auto-returns to live. |
| Skip-vote handling | "Skip" tile in the grid. If "skip" wins the tally OR ties any player, no one is ejected. Reveal shows "🕊️ Vote skipped." |
| Ghost view (skeleton) | When `alive` flips false, student goes to `view-ghost` with a static "you've been ejected" screen. Phase 4 will add continue-playing + donation. |
| Meeting cooldown banner | Visible on host live view between meetings. Same `meetingCooldownUntil` field also disables the student emergency button. |
| Cleanup | Host + student tear down meeting / vote listeners on both meeting resolution AND on `cleanupListeners()`. |

## Data model additions

**`/trust_sessions/{code}`** — new fields used by Phase 3:
```
activeMeetingId: string | null       (current meeting if any)
meetingCooldownUntil: timestamp      (next meeting allowed after)
winner: 'crewmates' | 'impostors'    (set when status flips to finished)
```

**`/trust_sessions/{code}/meetings/{id}`** (rules from Phase 1 already in place):
```
calledBy, calledByName, reason, duration (60),
startedAt, endedAt,
status: 'open' | 'resolved',
tally: { uid: count, … },
ejectedUid, ejectedName, ejectedRole, ejectedAvatar
```

**`/trust_sessions/{code}/meetings/{id}/votes/{voterUid}`**:
```
targetUid: string | 'skip',
targetName: string,
submittedAt: timestamp
```

---

## Files modified

- `y/classroom/js/trust-teacher.js` — meeting listener (status flip on new open meetings), `openMeeting`, `openHostMeetingView`, `renderHostMeetingGrid`, `startMeetingTimer`, `resolveMeeting`, `showHostEjectReveal`, `startCooldownTickerHost`, expanded session-status switch, wired Call-meeting + End-meeting-now buttons, expanded cleanup
- `y/classroom/js/trust-student.js` — `callEmergencyMeeting`, `refreshEmergencyBtn`, `openStudentMeetingView`, `renderStudentMeetingGrid`, `submitVote`, `startMeetingTimer`, `showStudentEjectReveal`, `renderGhostView`, expanded session-status switch (drives `view-meeting`, `view-ghost`), expanded `subscribePlayer` for the alive→ghost transition, `setInterval` ticker for cooldown countdown
- `y/classroom-trust-teacher.html` — added Call-meeting + End-meeting buttons, cooldown banner, `view-meeting` + `view-eject` panels
- `y/classroom-trust-student.html` — added emergency button + hint line, `view-meeting`, `view-eject`, `view-ghost` panels
- `y/classroom/css/trust.css` — `.trust-meeting`, `.meeting-head`, `.meeting-timer`, `.meeting-grid`, `.meeting-tile`, `.meeting-footer`, `.trust-eject`, `.role-card .role-meta`, `.trust-ghost`

## Files NOT touched

- `firestore.rules` — `/meetings/{id}` + `/votes/{voterUid}` paths were declared in Phase 1 with the right permissions. No re-deploy needed.

---

## Checks run

| Check | Result |
|---|---|
| `classroom-trust-teacher.html` div balance | ✅ 62 / 62 |
| `classroom-trust-student.html` div balance | ✅ 70 / 70 |
| `classroom/js/trust-teacher.js` syntax | ✅ |
| `classroom/js/trust-student.js` syntax | ✅ |
| All Phase 3 host DOM IDs reconcile with JS | ✅ (view-eject appears via `setView('eject')` — that's the expected pattern, prepends `view-`) |
| All Phase 3 student DOM IDs reconcile with JS | ✅ (same `view-*` pattern; `meetingInstruction` is static text, no JS access needed) |
| `node tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test (5+ tabs)

1. **Host launches** a Trust No One game with 5 players (1 impostor). After liftoff briefing, all see the live view.
2. **Host clicks "Call meeting"** → confirm modal → all players (including ghosts) get pulled to `view-meeting`. 60-second timer counts down in JetBrains Mono.
3. **Students click tiles** → tile gains amber border + the "you voted for X" footer updates. Re-clicking another tile switches their vote.
4. **Host sees live vote counts** on each tile (students do not — that's the deduction game).
5. **Timer expires** → host's resolver fires. The most-voted player is ejected. If "Skip" wins, no eject — reveal shows the dove + "Vote skipped".
6. **All players land on `view-eject`** for 5 seconds. Reveal animation runs (cyan card if crewmate, amber if impostor). Tally chips at the bottom.
7. **Auto-flip to live** after countdown. The cooldown banner appears on the host view; emergency button on students is greyed out until cooldown elapses.
8. **Ejected student** is automatically routed to `view-ghost` once their `alive` flag flips. Phase 4 will let them keep answering for coins.
9. **Student-called emergency meeting**: alive student with at least 1 button left clicks 🚨 → confirm → meeting fires same flow. Their button counter decrements.
10. **Win condition fires**: if the eject leaves zero impostors → game ends with `winner: 'crewmates'`. If impostors ≥ crewmates → `winner: 'impostors'`. Status flips to `finished` and everyone moves to the results screen.

---

## Standing preferences applied

- **Brand-wide stylish** — meeting view uses the same dark-glass + gradient text + `JetBrains Mono` timer pattern as the rest of Trust. Eject reveal reuses the liftoff `role-card` shape with a new `.role-meta` line. Ghost view echoes the briefing shell with a dashed border to signal "out".
- **Sanity + smoke + dated md** — this file.

---

## Phase 4 backlog (final)

1. **Ghost continue-play UI** — vocab MCQ stream for ejected players + coin counter (no investigations toward the win counter).
2. **Coin donation** — ejected player → alive teammate of same role only. Modal with target picker. Inter-team transfer rejected by client + (defensively) server checks.
3. **Investigations-target win condition** — automatic detection: when total crewmate investigations completed ≥ target × alive crewmates, crewmates win. (Currently only ejection-based wins fire.)
4. **Time-up exit** — already wired: when the duration timer expires the host calls `endGame()`. Phase 4 should also write the winner field with a "Stalemate (time)" indicator.
5. **Results screen polish** — show winning team banner, podium per role, full tally breakdown (clues planted, sabotages succeeded, coins donated, votes cast).

---

## Open concerns / hardening backlog

- **Tiebreak**: my current resolver picks a random tied player. Could be controversial; consider "skip wins ties" as a friendlier default. (Currently: skip only wins if it has the highest vote OR it ties for highest. A tied player-vs-player loses to skip too — check the code: `if (winners[0] !== 'skip' && !winners.includes('skip'))` — yes, skip wins ties involving it.)
- **Race condition** on near-simultaneous meeting triggers: 2 students + host clicking within the same Firestore propagation window. The "already-in-meeting" guard in the host listener handles this but the rejected meeting docs stick around as orphans. Cleanup pass can collect them in v1.1.
- **Ghost rules**: currently `alive=false` players can still write to their player doc (sabotage, plant fake clue) per Firestore rules. The host should ignore stale charges from dead impostors, but for safety, defensive guards on the student side already check `myPlayer.alive` before firing any action.
