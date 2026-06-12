# Correction JSON - the contract between the API and the UI

`renderCorrection(obj, essayText)` accepts this object. The API (or Claude, in
practice mode) must return exactly this shape. **No scores anywhere.**

```jsonc
{
  "level":  "light | medium | deep",     // controls depth shown
  "rubric": "essay | academic | short",  // picks criterion labels

  "overall": "1-4 sentence summary, encouraging and specific.",

  // Qualitative per-criterion. Keys are the app's internal ones:
  //   CC, TA, GR, VO  (labels per rubric come from the comment bank)
  "criteria": {
    "CC": { "verdict": "Good", "note": "one or two sentences" },
    "TA": { "verdict": "Satisfactory", "note": "…" },
    "GR": { "verdict": "Needs improvement", "note": "…" },
    "VO": { "verdict": "Satisfactory", "note": "…" }
  },

  // Inline marks. `quote` MUST be copied verbatim from the essay - the
  // UI locates it (offsets are computed for you). No score field.
  "annotations": [
    {
      "criterion": "GR",                 // CC | TA | GR | VO
      "severity":  "fix",                // fix | tip | strength
      "quote":     "many universities is discussing",
      "text":      "Subject-verb agreement: plural subject takes 'are'.",
      "suggestion":"many universities are discussing"   // optional
    }
  ],

  // DEEP only - model rewrites of weak sentences.
  "rewrites": [
    { "before": "…", "after": "…", "why": "…" }
  ],

  // MEDIUM + DEEP - ordered next steps.
  "plan": [ "step 1", "step 2", "…" ]
}
```

### Field rules
- **severity**
  - `fix` - an error to correct (solid underline, criterion colour).
  - `tip` - an improvement/suggestion (dashed underline).
  - `strength` - something done well (green) - include ≥1 to stay encouraging.
- **quote** - exact substring of the essay. If two identical phrases exist, the
  UI anchors them in document order. A quote it can't find is still listed
  (marked "not located") - never dropped.
- **criterion** keys map to labels via the comment bank:
  - essay/academic: `CC`=Organization, `TA`=Content, `GR`=Language Accuracy, `VO`=Word Choice
  - short: `CC`=Organization, `TA`=Task Achievement, `GR`=Grammatical Accuracy, `VO`=Word Choice
- **No `score`/band fields** - by design. (The annotation schema in the app
  allows an optional `score`; the corrector always leaves it out.)

### Level expectations
| level | annotations | criteria.note | rewrites | plan |
|---|---|---|---|---|
| light | few (critical only) | hidden (verdict only) | - | - |
| medium | all notable | shown | - | yes |
| deep | exhaustive | shown (detailed) | 2-4 | yes |
