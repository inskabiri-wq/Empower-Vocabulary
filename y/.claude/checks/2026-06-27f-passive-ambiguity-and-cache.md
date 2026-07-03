# 2026-06-27 - "both correct" passive question = OLD deployed code; cache bump

## The screenshot ("All the tickets ____ sold" with were/are both valid)
- That is the OLD generator. The CURRENT bank produces:
  "The tickets ____ sold."  [have being | have been | has been | are been]
  i.e. distractors are FORM errors (wrong agreement / malformed), so "were"/"are"
  are not offered and there is no second correct answer. Fixed sessions ago in the
  b1p/b2-passive-perfect rewrite; the user was seeing a deploy from before it.
- Root cause of seeing stale content: old deploy and/or PWA service-worker cache.

## Proactive fix found by the ambiguity scan
- a2-was-were used "this morning" as the past time anchor for busy/late. If it is
  still morning, "They ARE busy this morning" is defensible -> ambiguous with the
  past answer. Changed those two anchors to "earlier today" (unambiguously past).
- Scanned the whole current bank for >=2 of {was,were,have been,has been} without a
  time anchor: 120 hits, but all the rest are agreement contrasts (has been vs have
  been, only one agrees) or form-error distractors - not ambiguous.

## Cache
- service-worker.js CACHE_VERSION v66 -> v67 (forces students to fetch fresh assets
  so stale grammar JS cannot linger). grammar-content.js ?v=30 -> ?v=31.

## Sanity
- node --check OK. em-dash 0. checker PASS (82 units, 5541 q, 0/0/0/0).
- REDEPLOY hosting to ship. The SW bump + ?v=31 force the update on devices.
