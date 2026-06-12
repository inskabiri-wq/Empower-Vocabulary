# Sanity + Smoke — Heist money animations + music note

**Date:** 2026-05-27
**Trigger:** User: "animations in the hack game there is nothing! related to money!" + asked about using Gimkit's music.

---

## Money FX added

A lightweight DOM-particle system in `heist-student.js` + keyframes in `heist.css`. Everything is `position: fixed; pointer-events: none;` and self-removes after its animation — zero layout impact, no library.

| Effect | Function | Fires when |
|---|---|---|
| Floating "+₿N" / "−₿N" label | `floatCoinLabel(amount, kind, originEl)` | Every coin gain or loss — drifts up from the source + fades |
| Gold ₿ coin burst | `coinBurst(originEl, count)` | Correct earn answer (6 coins from the button); got-robbed (8 coins from the balance chip) |
| Coin shower | `coinShower(count)` | Successful heist crack — 18 coins rain from the top toward the balance chip |
| Edge flash | `screenFlash(kind)` | Heist win (green vignette) / got-robbed (red vignette) |

**Wired into:**
- `onAnswer` (correct): `coinBurst(btn, 6)` + `floatCoinLabel(reward, 'gain', btn)` — earning feels rewarding
- `subscribeMyHacks` attacker-success: `coinShower(18)` + `screenFlash('gain')` + `floatCoinLabel(stolen, 'gain')` — the big payoff
- `subscribeMyHacks` attacker-fail: `floatCoinLabel(feeBurned, 'loss')` — lost the fee
- `subscribeMyHacks` got-robbed: `coinBurst(coinsBadge, 8)` + `screenFlash('loss')` + `floatCoinLabel(stolen, 'loss')` — coins fly away

The existing balance-chip `.bump` (scale + spin) still fires on every balance change, so the chip reacts too.

**Accessibility:** all particle/flash effects are guarded by `prefers-reduced-motion: reduce` — JS skips them and a CSS `display:none` belt-and-braces. The informative floating label is kept (it conveys the amount) for reduced-motion users.

---

## Music — why I can't use Gimkit's tracks + what to do instead

Gimkit's in-game music is **copyrighted** (either their own commissioned tracks or licensed library music). Ripping those files into Empower Lab would be copyright infringement — and since you've said this is heading toward commercial use with paying customers, that's a real takedown/liability risk, not a hypothetical one. I won't pull them.

**Legal options (pick one and I'll wire it in):**

1. **Keep the current SoundHelix set** (already swapped to the darker 7/9/11/13/15 tracks for the heist). Free, already working, no new files.

2. **Royalty-free heist/money-themed tracks** — you download these once, drop the .mp3s into `y/student/audio/heist/`, and I point the player at them. Good sources:
   - **Pixabay Music** (pixabay.com/music) — search "heist", "tension", "spy" — CC0, no attribution needed, commercial-safe
   - **Incompetech (Kevin MacLeod)** — incompetech.com — search "Hidden Agenda", "Killing Time", "Bank Heist" vibes — free with attribution (CC-BY)
   - **FreePD.com** — fully public-domain, commercial-safe
   - **YouTube Audio Library** (studio.youtube.com) — filter to "no attribution required"

3. **Buy a license** for a specific heist track from a stock-music marketplace (Epidemic Sound, Artlist, PremiumBeat) if you want something polished and uniquely yours.

My recommendation: **Option 2 with Pixabay** — CC0 means zero attribution + zero commercial restrictions, which is the cleanest fit for a paid product. Send me 3-5 tracks you like (or just drop them in `y/student/audio/heist/`) and I'll wire them into the heist music rotation.

---

## Files modified

| File | Change |
|---|---|
| `y/classroom/js/heist-student.js` | Money-FX functions + wired into onAnswer + subscribeMyHacks |
| `y/classroom/css/heist.css` | Keyframes for coin-float / coin-burst / coin-rain / money-flash + reduced-motion guard |

## Checks run

| Check | Result |
|---|---|
| `node -c y/classroom/js/heist-student.js` | ✅ |
| `heist.css` brace balance | ✅ 151 / 151 |

---

## Manual smoke — hard refresh first

1. Join a Heist game as a student → answer a question correctly → 6 gold ₿ coins burst from the button + a floating "+₿10" rises near it. Balance chip bumps.
2. Crack another player's vault successfully → 18 coins rain down toward your balance chip + green edge flash + "+₿N" float.
3. Get hacked by someone → 8 coins fly off your balance chip + red edge flash + "−₿N" float.
4. Fail a crack → small red "−₿[fee]" float.
5. On a device with reduced-motion enabled → only the floating labels appear (no particles/flash), info still conveyed.
