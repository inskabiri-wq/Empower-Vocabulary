# Assignment cards → accordion (student dashboard)

**Date:** 2026-05-31
**Trigger:** "put accordion on assignments — click to open. (we have the accordion skill.)" + earlier: skip lazy-feedback if risky.

---

## Lazy writing-feedback — deliberately NOT done (explained to user)
The writing feedback (status, score, comment preview, "returned for revision" banner) is built **inline at render time** from `myWritingSubmissions` (read synchronously in 6+ places in the card render). Deferring that fetch would force **async per-card re-rendering** of the delicate assignments render — real risk in the fragile area — to save **~1–2 reads** (students have few writing assignments). Bad trade; left the eager (cheap, parallel) fetch as-is.

## Visual accordion — done (safe, additive)
The card already had a natural seam: `.my-assignment-header` (icon + title + meta) and `.my-assignment-body` whose **first** row is the deadline. So:
- **Header + deadline stay visible** (title / skill / status / due-date at a glance).
- Wrapped the rest (`progress + grade + goal + CTA`) in a new **`.asg-acc-detail`** that collapses.
- Header is the click target (`toggleAsgCard(this)` toggles `.asg-collapsed` on the card; updates `aria-expanded`). Chevron rotates.
- **Default: all cards collapsed** (matches "click to open"; the rail becomes a tidy list of headers).
- **0 reads on expand** — all data's already in memory; expanding is pure display.

`.asg-acc-detail` has `padding:0`, so `max-height:0` collapses it cleanly (no sliver — the bug we fixed before). Collapsed also zeroes the deadline's bottom-margin for a tight look.

## Files
- `assignments/js/student-assignments.js` — card root `asg-acc asg-collapsed`; header `onclick`/`role`/`aria`; chevron; `.asg-acc-detail` wrap; `toggleAsgCard()` + `window` export.
- `assignments/css/assignments.css` — accordion CSS (cursor, collapse, chevron rotate).
- `service-worker.js` — `CACHE_VERSION` **v7 → v8**.

## Checks
- `node --check student-assignments.js` → OK (template literal intact, divs matched).
- assignments.css braces 212/212.
- Wiring verified: root class, header toggle, `.asg-acc-detail`, `toggleAsgCard` export, SW v8.

## Note / option
Defaulted **all** cards collapsed. If you'd rather **pending** cards start open (Start button visible) and only **completed** ones collapse, it's a one-line change (`asg-collapsed` → conditional on `status.completed`).

## Deploy
Hosting-only. `firebase deploy --only hosting` → worker v8 → auto-reload → accordion live.
