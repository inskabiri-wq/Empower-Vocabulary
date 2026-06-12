# Empower Lab — Infrastructure Budget Request
**Scope:** 400 students + ~10 teachers, one academic year. All figures are **Google / registrar list prices in USD** (billed monthly). The platform is **already built** — this covers *running* it, not building it.

---

### 1 · Two web addresses (domains)
| For | Recommended option | Cost |
|---|---|---|
| The **app** (Empower Lab) | **Subdomain of `fsm.edu.tr`** — e.g. `empowerlab.fsm.edu.tr`. The university already owns `fsm.edu.tr`; IT just adds one DNS record. | **$0** |
| The **FSM hub** (Google Sites) | Map a custom domain to the free Google Site — e.g. `hub.fsm.edu.tr`. Google Sites itself is free. | **$0** |
| *If a brand‑new public domain is preferred instead* | `empowerlab.app` or `empowerlab.com.tr` | **≈ $12–15 / year each** |

> The "$500–$2,000" figures you've seen are for **premium/aftermarket domain names** or **paying an agency to build a website** — neither applies: the site exists, and a normal domain is ~$1/month. **Cheapest, cleanest path: ask IT for two free `*.fsm.edu.tr` subdomains → $0.**

### 2 · Firebase **Blaze** (pay‑as‑you‑go) — why, and the math
**Why:** the free *Spark* plan has a hard cap of **50,000 database reads/day**. When 400 students log in at peak, the app **stops working** (we have already hit this). Blaze removes the cap — you pay only for usage **above** the free tier (which Blaze keeps) — and it's required to switch on any Google API.

**Typical day, after the read-optimisations already shipped:**
| Source | Reads/day |
|---|---|
| ~250 active students × ~50 reads | 12,500 |
| ~3–4 classroom games × ~2,000 | 7,000 |
| ~10 teachers × ~300 | 3,000 |
| **Total** | **≈ 22,500 — well under the 50,000 free quota** |

- **Reads** beyond free: **$0.06 per 100,000.** A heavy 200,000-read exam day = (200,000 − 50,000) × $0.06⁄100,000 = **$0.09.**
- **Writes:** ~12,000/day < 20,000 free → **$0.** **Storage:** a full year ≈ <0.2 GB < 1 GB free → **$0.** **Hosting:** PWA-cached, within free transfer → **~$0–1.**
- **Realistic Firebase bill: $0–5 / month.** Blaze's value is **reliability + unlocking APIs**, not a large bill.

### 3 · APIs — what each unlocks, and what it costs
| API | What it adds to the app | Monthly cost — 400 students |
|---|---|---|
| **Text‑to‑Speech** | Native-quality audio for vocabulary, listening & pronunciation models (generated once) | **≈ $0** — first 1M characters free; our whole word list is ~16K characters |
| **Gemini (AI)** | Draft writing feedback, grammar checks, auto-generate exam questions, a tutor chatbot | **≈ $1–10** — Gemini Flash is $0.075 / 1M input tokens; 800 graded essays ≈ **$0.20** |
| **Speech‑to‑Text** | The **Speaking** skill — score pronunciation from student recordings | **≈ $47–95** ($0.024/min; 5–10 min per student/mo) **— or $0** using the free in‑browser Web Speech API |
| Cloud Functions / Storage | Server-side game logic; store audio recordings | **≈ $0** (free tiers cover this scale) |

### 4 · Bottom line (per year, 400 students)
| Tier | Includes | / month | **/ year** |
|---|---|---|---|
| **Essential** *(recommended start)* | free `fsm.edu.tr` subdomains · Blaze headroom · Text-to-Speech · Gemini AI feedback · Speaking via free browser API | **≈ $5–8** | **≈ $60–100** |
| **+ Premium Speaking** | adds Google Speech-to-Text pronunciation scoring | **≈ $55–100** | **≈ $700–1,200** |

**For approval:** running the **entire** platform for 400 students costs **under ~$10/month** (a few hundred TL) on the Essential tier — because the software is already built and Firebase's free tier absorbs almost all usage. The only large *optional* cost is premium speech scoring, which can start at **$0** with the browser API and be upgraded later.

*Safeguard: set a Google Cloud **budget alert / cap** (e.g. $25/month) so spending can never surprise us — it emails before any overage and the project can be capped.*
