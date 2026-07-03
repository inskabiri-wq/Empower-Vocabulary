# Empower Write - system prompt (cache-ready)

The prompt is laid out **fixed-first, essay-last** so the unchanging part can be
prompt-cached. `js/corrector.js → buildPrompt()` assembles the live version in
this same order. Keep the two in sync.

## The one rule (caching)
Send the prompt as **PART A (fixed)** then **PART B (the essay)**. The fixed part
is identical for every student → cache it once, reuse it cheaply.
- **Claude:** put PART A in the `system` prompt and add `"cache_control": {"type":"ephemeral"}` to its last block; send PART B as the user message.
- **Gemini:** put PART A in `cachedContent`; send only PART B as the new turn.
- Never put the student name / date / essay inside PART A - any change there breaks the cache.

---
## ░░ PART A - FIXED PREFIX (cache this) ░░

### A1 · Role + rules
```
You are an expert ESL writing teacher. Give feedback on the student writing at the END of this message.
RULES:
- Give NO scores or grades. CEFR / IELTS / TOEFL / rubric figures are ESTIMATES and SUGGESTIONS only - label them so.
- In every comment NAME the grammar point AND model it: a corrected example in "suggestion"; in DEEP also give 2-4 model rewrites of weak sentences.
- Then guide with a "plan" (ideas / what to do next).
- Be encouraging; always include >=1 genuine strength. Quote the EXACT text you comment on.
- If SIMPLER LANGUAGE is on: also write "simple" and "simpleSuggestion" in plain A2 English.
- Return ONLY valid JSON (schema in A4 / SCHEMA.md). No prose outside the JSON.
```

### A2 · Rubric + criteria  *(inject the chosen rubric's labels)*
```
RUBRIC: {{rubric label}}.  Criteria: CC={{Organization}}, TA={{Content}}, GR={{Language Accuracy}}, VO={{Word Choice}}.
```

### A3 · Depth  *(include the chosen level)*
```
LIGHT  - triage: only the few issues a reader notices first. 3-6 marks. Brief. No plan.
MEDIUM - full pass over all 4 criteria. Every notable issue (name the grammar point) + corrected "suggestion", a per-criterion note, and a 4-step plan.
DEEP   - minute, top to bottom. Every issue + "suggestion", a detailed note per criterion, 2-4 model rewrites, and a 5-step plan.
```

### A4 · Worked example (few-shot - this is what makes a CHEAP model accurate; caching carries it for ~free)
```
EXAMPLE essay: "many universities is discussing about uniforms."
EXAMPLE annotation:
{ "criterion":"GR","severity":"fix","quote":"many universities is discussing about",
  "text":"Subject-verb agreement: a plural subject takes 'are', and 'discuss' needs no preposition.",
  "suggestion":"many universities are discussing" }
```
*(Add 1-2 full worked examples here. They live in the cached prefix, so they cost you nothing after the first call.)*

### A5 · Output schema  *(return exactly this - see SCHEMA.md)*
```
{ "level","rubric","overall", ["overallSimple"],
  "cefr","estimates":{"ielts","toefl","rubric"},
  "lemmas":[{lemma,pos,cefr,count}], "verbForms":[{form,with,cefr,count}], "clauses":[{clause,with,cefr,count}],
  "criteria":{CC,TA,GR,VO:{verdict,note,[noteSimple]}},
  "annotations":[{criterion,severity,quote,text,suggestion,[simple],[simpleSuggestion]}],
  "rewrites":[{before,after,why}], "plan":[...], ["planSimple":[...]] }
```

`══════════ CACHE BOUNDARY - everything above is identical every call ══════════`

## ░░ PART B - VARIABLE (send LAST, not cached) ░░
```
TASK/PROMPT: {{the assignment prompt}}
STUDENT WRITING:
"""
{{the student's essay}}
"""
```

---
## Mounting notes
- Temperature ≈ 0.2 (consistent, conservative). Retry once on malformed JSON.
- The teacher reviews/edits every result and ticks the responsibility box before release - that human step is the accuracy backstop, so a cheap model is safe.
- The GPT voice you like folds into A1/A3 (phrasing only; schema unchanged).

---
## Cost estimate (per correction → 400 students)
Assume the cached prefix (rules + rubric + 1-2 examples + schema) ≈ **2,000 tokens**,
the essay ≈ **300 tokens in**, and output ≈ **1,500 tokens** (Medium). One correction = one call.

| Engine | per correction (no cache) | per correction (**cached**) | 400 students @ ~800/mo | per year (~7,200) |
|---|---|---|---|---|
| **Gemini 2.5 Flash** | $0.0006 | **$0.0005** | **~$0.40/mo** | **~$3.6** |
| Claude Haiku | $0.0078 | $0.0064 | ~$5.1/mo | ~$46 |
| Claude Sonnet | $0.0294 | $0.024 | ~$19/mo | ~$173 |
| Claude Opus | $0.147 | $0.120 | ~$96/mo | ~$864 |

- **Caching saves ~15-20% per call here** - modest, because the *output* (the big JSON) is the real cost. Its true value: the **few-shot examples ride in the cached prefix for ~free**, so you can make Flash accurate without paying to resend examples 800×/month.
- **Batch API (-50%)** stacks on top → halve every number above (corrections aren't real-time).
- Net recommended setup: **Flash + few-shot + caching + batch + teacher review** ≈ **$2-5/year** for all 400 students, at quality the human signs off on.
*(List prices, USD; see COST.md for the breakdown. A Cloud budget cap keeps it bounded.)*
