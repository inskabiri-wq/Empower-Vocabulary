# 2026-08-31 - auditing the other twelve modals: none of them were broken

After fixing the Quest Board's missing padding I logged that twelve other
modals share `.modal-content` and might have the same gap. Checked properly.
**They do not.** No further fix is needed.

## Why the worry was reasonable but wrong

`student/css/styles.css` gives `.modal-content` padding only inside
`@media (max-width: 600px)`, so on that stylesheet a modal is unpadded above
600px. The mistake in my reasoning was assuming all thirteen modals are
governed by that stylesheet. They are not, and they split into two families
that never meet:

- **Seven live on classroom pages**, which load `classroom/css/styles.css`
  instead. That file has its own `.modal-content` with **`padding: 26px 28px`**
  at base plus a narrow-width override. Those pages do not load
  `student/css/styles.css` at all, so they were never exposed.
- **The rest carry a variant class that sets its own padding.**

## Measured, not read

Both families were rendered in their own iframe with their own real stylesheet
set, because auditing them under one set would have proved nothing about
either. Computed padding at 834px:

| modal | padding | verdict |
| --- | --- | --- |
| learning-map-modal (vocabulary + grammar Quest Board) | 32px 28px | fixed earlier |
| vg-card (level/class gate) | 32px 34px | own padding |
| ll-dialog (logout / confirm) | 28px 28px 22px | own padding |
| AppDialog card (alert/confirm/prompt) | 28px 28px 22px | own padding |
| plain .modal-content, classroom pages | 26px 28px | own padding |
| plain .modal-content, dashboard stylesheet | **0px** | see below |

## The one zero is a trap, not a bug

A bare `.modal-content` with no variant class **does** come out unpadded under
the dashboard's stylesheets. But no such element exists there:

- `student-dashboard.html` has three modals, all with a variant class
  (`vg-card`, `ll-dialog`, `learning-map-modal`)
- every bare `class="modal-content"` in the app is on a classroom page
- `classroom/js/refresh-guard.js` also builds a bare one, and it is loaded by
  eight classroom pages and by neither `student-dashboard.html` nor
  `placement.html`

So it is latent: the day someone adds a plain `.modal-content` to the student
dashboard, it will silently have no padding. Worth knowing, nothing to fix.

## Two harness bugs, again caught before they became findings

1. **rAF polling hung the probe.** The Browser pane was hidden, so
   `visibilityState` is "hidden", `requestAnimationFrame` never fires, and the
   wait loop blocked until the 45s timeout. This is already in memory and I
   still wrote it. Now polls with `setTimeout`.
2. **The iframe was served a cached stylesheet**, so the Quest Board reported
   `0px` padding, i.e. the audit claimed a modal I had already fixed was still
   broken. Every sheet URL is now cache-busted per run.

Both produced confident, wrong output. Neither would have announced itself.

`y/tools/demos/modal-padding-audit.html` is kept; re-running it after any
modal CSS change re-checks all six variants in one call.

## Ritual

- gates: seventeen, all PASS
- em-dash scan - clean
- no shipped file changed, so no bump; `--check` still consistent at v381
