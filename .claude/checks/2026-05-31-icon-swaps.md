# Icon improvements — 8 concept swaps

**Date:** 2026-05-31
**Trigger:** "bring me all the icons i wanna improve them 🚀" → user picked replacements from alternatives I offered.

---

## What changed (concept → icon)

| Concept | Old | New | Scope |
|---|---|---|---|
| Join (game) | 🚀 | 🎟️ | "Join Game", "Join mission" buttons |
| Trust No One (brand) | 🚀 | 🕵️ | logo, picker card, setup heading, "Create … Room" |
| The Heist (brand) | 🏦 | 🦹 | hero, watermark, logo, "Vaults", picker card, setup, create |
| Coins (currency) | ₿ | 💸 | every balance / reward / cost / donation / particle |
| End (game/exam) | ⏹️ | 🏳️ | "End Game" button + cancel-session dialog icon |
| Join another | 🎯 | ➕ | post-game buttons (trust/heist/reading/listening) |
| Sessions (stat) | 📊 | 🧠 | teacher overview "Total Sessions" card |
| Next track (music) | ⏭️ | 🎶 | all 6 music-control bars |

## How it was done safely (no look-alikes touched)
Several emoji were **overloaded**, so I mapped every occurrence first and swapped only the right concept via exact-substring rules with **expected-count assertions** (`.claude/concept-swap.py`, all 24 rules `exp==got`). Coins were a clean character swap across 8 files (`.claude/coin-swap.py`, 53×).

**Deliberately preserved:**
- 🚀 stays for Trust's space flavor (Liftoff/Ejected/Mission-underway headers, "Need 4 to launch"), **all rocket avatars** (avatar list + defaults + `avatar.js`), the generic "Create Session" button, and the assignment "🚀 Start Now" CTA.
- 📊 stays for charts/Activity-Logs/Level/Leaderboard/Per-question/Avg-score/level-badges (40+ spots). Only the one "Total Sessions" stat card changed. The student-dashboard "Sessions" tile is already a clean **SVG**, so it was left as-is.
- 🎯 stays for Multiple-Choice, goals, achievements, "investigations", "Target:" lines.

## Two nice coincidences
- **🕵️ was already** the Trust-No-One "Intelligence feed" / "Clues fired" motif — so it's a thematically perfect brand pick, not a foreign symbol.
- The Heist balance chip kept its premium **spinning gold coin** (the disc is now a blank gold token; the 💸 glyph lives in the chip text → `💸 0`), so no awkward emoji-in-a-circle and no duplicate.

## Heads-up (optional follow-up)
The music bar now shows **🎵 (play/pause)** next to **🎶 (next)** — two musical notes adjacent. It reads fine, but if you'd prefer more contrast I can switch play/pause to ▶️/⏸️. Say the word.

---

## Checks
| Check | Result |
|---|---|
| `node --check` on all 6 touched JS files | ✅ 6/6 |
| Concept-swap count assertions (`concept-swap.py`) | ✅ 24/24 `exp==got` |
| Coin swap ₿→💸 | ✅ 53 across 8 files, **0 `₿` remain** |
| Old concept-icons gone (`🏦`/`⏭️`/`⏹️`/`🎯 Join another`) | ✅ 0 remain |
| HTML parse + block-tag balance, 8 edited pages (`icon-smoke.py`) | ✅ 8/8 balanced |
| New-icon presence counts | ✅ all `exp==got` → **SMOKE PASS** |

## Deploy
Static-only change (HTML/CSS/JS) — `firebase deploy --only hosting`. **`CACHE_VERSION` bumped v2 → v3** so returning PWA students don't get the old ₿/🏦 from cached classroom JS/CSS. No Firestore rules change.

## Scripts (outside shipped `y/`)
`.claude/icon-scan.py` (inventory), `.claude/coin-swap.py`, `.claude/concept-swap.py`, `.claude/icon-smoke.py`.
