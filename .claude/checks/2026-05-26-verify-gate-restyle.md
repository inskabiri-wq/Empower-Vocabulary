# Sanity + Smoke — Verify-Gate Modal Restyle

**Date:** 2026-05-26
**Trigger:** Teacher feedback — original verify-gate modal looked "naive."
Restyle to match the wider app's premium dark-glass aesthetic.

---

## Standing preferences captured this session

These are **persistent** until the user tells me otherwise. From their words:

1. **"Stylish" = whole-app theme reach.**
   When the user says "make this stylish" they mean: redesign with the existing dark-glass / gradient / blur language used by `.modal-content`, `.dash-welcome`, the heist UI, etc. Do not invent a new theme per element.

2. **Sanity + smoke check after every change.**
   Every meaningful edit ends with:
   - HTML div balance
   - JS syntax check (`new Function(src)`)
   - DOM ↔ JS id cross-check for anything I just touched
   - Re-run `node tools/validate-readings.js` if registry/data layer was touched
   - Write a dated log to `.claude/checks/YYYY-MM-DD-<topic>.md`

---

## What changed in this round

### `student-dashboard.html`
- `#verifyGateModal` inner card rewritten.
- New structure: `.vg-card` → `.vg-head` (gradient icon disc + title + subtitle) → `.vg-error` → `.vg-form` with `.vg-field` / `.vg-label` / `.vg-select-wrap` / `.vg-select` / `.vg-input` / `.vg-submit`.
- Module field marked `.vg-field-key` (amber halo) + label badge `.vg-must-change` (pulsing).
- Hint paragraph `#verifyModuleHint` added below the module dropdown for per-user "Previous: …" copy.
- Inline SVG check-shield icon instead of the bare emoji.

### `student/css/extra.css`
- Appended ~200 lines of `.vg-*` styles.
- Aligned with the existing `.modal-content` dark-glass + scale-up animation.
- Cyan→indigo gradient on the icon disc and the submit button (informational tone; reds reserved for danger actions like logout / end-game).
- Amber halo + pulsing badge on the module field per the user's spec that the module **must** change every cycle.
- Custom select chevron via `appearance: none` + absolute-positioned `.vg-chev` so the dropdown arrow matches across Chromium / Firefox / Safari.
- Focus rings: 4px halo at `rgba(99,102,241,0.22)` (matches the existing app accent).
- Mobile breakpoint at 520px — class row collapses to single column, header icon shrinks 56→48px.

### `student/js/verify-gate.js`
- Dropped the `modSel.previousElementSibling.innerHTML = …` hack (was injecting markup into the label).
- Now writes the "Previous: Module X" copy into the new dedicated `#verifyModuleHint` paragraph.
- Error visibility now driven by CSS `.vg-error:not(:empty) { display: block }` — JS just sets/clears `textContent`.

### What was NOT touched
- `firestore.rules` — no rule change required, the verification update path was already wired in Phase J.
- The `gate.check()` helper in `index/js/account-gate.js` — still drives whether the modal opens.
- The pre-fill / submit / Firestore update logic — same as before, just rewired to new IDs.

---

## Checks run

| Check | Result |
|---|---|
| `student-dashboard.html` div balance | ✅ 348 / 348 |
| `student/js/verify-gate.js` syntax | ✅ OK |
| All 9 expected DOM/JS ids present on both sides | ✅ OK |
| `node tools/validate-readings.js` | ✅ 46 exams, 227 checks, 0 fails |

---

## Manual smoke test (next time the gate fires)

1. Open `student-dashboard.html` while signed in as a student with `lastVerifiedAt` > 60 days (or absent).
2. Confirm:
   - Modal scales in with the existing dark-glass overlay + backdrop blur.
   - Gradient icon disc at top-left, two-line title + subtitle.
   - Module dropdown is amber-highlighted with a pulsing "MUST CHANGE ↑" badge.
   - Previous module appears in the hint line below the module dropdown.
   - Tab order works through all four fields, focus rings visible.
   - On submit with same-as-previous module → red banner appears (should be impossible — dropdown excludes current — defensive).
   - On successful submit → modal fades out, dashboard unblocks.
   - Mobile (≤520px): class row stacks, no horizontal overflow.

---

## Open items not addressed in this round

(carried over from the earlier session — for context only)

- Heist v1 hint↔word JSON leak (v1.1 hardening)
- Cloud Functions for Heist referee + writing reminder (Blaze gate)
- The `firebase deploy --only firestore:rules` is still needed before any of the rules from this session take effect in production.
