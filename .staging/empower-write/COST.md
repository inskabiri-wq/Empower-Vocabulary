# Empower Write - exact API cost per correction

This is the AI cost for the **writing corrector specifically** (one essay → one full
correction: profile tables + criteria + comments + suggestions + rewrites + plan).

## Tokens per correction
A "token" is ~0.75 of a word. One correction is one API call:

| Part | Tokens |
|---|---|
| **Input** = instructions + rubric + the essay (~220 words) + JSON schema | **~1,000 in** |
| **Output** = the JSON the app renders | Light ~700 · **Medium ~1,500** · Deep ~2,200 |

The output is the big part because of the Words/Verb-forms/Clauses tables. Use
**~1,000 in / ~1,500 out** as the typical (Medium) call.

## Cost per ONE correction (list prices)
| Engine | in $/1M | out $/1M | **Cost / correction** |
|---|---|---|---|
| **Gemini 2.5 Flash** | 0.075 | 0.30 | **$0.0005**  (0.05¢) |
| **Claude Haiku** | 0.80 | 4 | **$0.0068**  (0.7¢) |
| **Claude Sonnet** | 3 | 15 | **$0.026**  (2.6¢) |
| **Claude Opus** | 15 | 75 | **$0.128**  (12.8¢) |

## Scaled to 400 students
Assume each student gets **~2 essays corrected per month** = **800 corrections/month**,
and a **9-month** academic year = **7,200 corrections/year**.

| Engine | / month (800) | / **year** (7,200) |
|---|---|---|
| **Gemini 2.5 Flash** | **~$0.40** | **~$3.8** |
| **Claude Haiku** | ~$5.40 | ~$49 |
| **Claude Sonnet** | ~$20 | ~$185 |
| **Claude Opus** | ~$102 | ~$920 |

### Heavier usage (every student, 1 essay/week ≈ 1,600/month)
- Gemini Flash ≈ **$0.85/month** · Haiku ≈ $11 · Sonnet ≈ $41 · Opus ≈ $205.

## How to pay even less
- **Prompt caching**: the instructions + schema (~400 tokens) are identical every call → cache them (up to 90% off that input). Input is already tiny, so small effect.
- **Batch API (-50%)**: corrections are not real-time → batch them overnight, halving the bill.
- **Trim the profile**: the Words/Verb-forms/Clauses tables are ~half the output. Making them optional roughly halves output cost.

## Bottom line
On **Gemini Flash**, correcting **every essay for all 400 students costs single-digit
dollars per year** (~$4-10). Even on **Claude Sonnet** (premium quality) it's **~$185/year**.
This is the main AI consumer in the app, and it still fits comfortably inside the
funding proposal's estimate.

*Figures are public list prices (USD). Actual usage is usually lower; a Cloud budget cap
keeps it bounded.*
