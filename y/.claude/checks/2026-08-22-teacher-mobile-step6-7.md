# 2026-08-22 - teacher dashboard on phone, steps 6-7: the gate is gone

Agreed plan: bottom tab bar with More, gate off at step 6. Steps 1-5 built the
shell, the cards and the tab contents. This removes what they replaced and puts
a gate in front of the replacement so it cannot rot.

## What was deleted

Backed up to the session scratchpad first (`gate-backup-2026-08-22/`), because
this tree is long-lived uncommitted work and a delete here is unrecoverable.

| file | why it existed |
| --- | --- |
| `js/desktop-gate.js` | the "this screen needs a computer" panel |
| `teacher-mobile.html` | the cut-down phone view it sent you to |
| `teacher/js/mobile-view.js` | that page's renderer |
| `tools/demos/desktop-gate-trace.html` | demo for the gate |
| `tools/demos/teacher-mobile-trace.html` | demo for the phone view |

Plus the `<script src="/js/desktop-gate.js">` tag in `teacher-dashboard.html`,
replaced with a comment saying where the phone view went.

Swept for dangling references afterwards: `firebase.json`, `firestore.rules`,
`service-worker.js` and every `.html` / `.js` / `.css` / `.json`. **Every local
`src`/`href` in teacher-dashboard.html still resolves on disk**, and the 59
`<script>` tags still balance. The only surviving mention is one comment in
`inline-css-check.js` explaining a false positive that page once caused; put
into the past tense rather than deleted, since it still explains why that tool
strips token fallbacks.

`student/js/listening-exam.js` also uses `data-mobile-view`. Unrelated - that is
the listening transcript drawer. Left alone.

## `tools/teacher-mobile-check.js`

The dashboard is now the phone view, which makes those two modules load-bearing.
If either stops loading the page does not fail loudly: it renders a 220px
sidebar and an 11-column table on a 390px screen, and the first person to find
out is a teacher holding a phone. Four assertions:

1. **Both modules load, as real `<script>` tags, versioned.** The tag itself is
   matched, not the filename - an earlier check in this repo passed against a
   page that only mentioned its module in a comment. `?v=` is required with it,
   because an unversioned asset comes from the service worker cache and a fix
   looks undeployed for days.
2. **The gate stays gone.** The five deleted files must not exist, nothing may
   `src`/`href` them, and the page must not match `desktop-gate|ll-gate|needs a
   computer` - named by behaviour so a gate under a new filename still trips it.
3. **Every tab the bar promises exists.** `mobile-shell.js` builds the bar by
   reading the sidebar, so a renamed `data-tab` does not throw - it quietly
   drops that entry into More and the bar comes back with four items where five
   were intended. Nothing in a browser would tell you.
4. **No grid track wider than a phone's content box** (362px = 390 minus the
   14px gutters), unless wrapped in `min(..., 100%)`.

### It failed on its first run, correctly

Assertion 4 caught `teacher-dashboard.html:97` -
`grid-template-columns: repeat(auto-fit, minmax(380px, 1fr))` on `.alert-grid`,
which hangs 18px off a 390px screen. My step-3 sweep missed it because it read
`teacher/**/*.css` and this rule lives in an **inline `<style>` block in the
HTML** - the exact blind spot `inline-css-check.js` exists for. Fixed to
`minmax(min(380px, 100%), 1fr)`; swept every other page for the same shape and
found none.

That is the check earning its place on the day it was written.

## Final measurement

Assembled from the **real inline `<style>` fetched out of the shipped
teacher-dashboard.html**, not retyped, so the alert-grid fix is measured as it
ships:

| | 390 | 480 | 768 | 1280 |
| --- | --- | --- | --- | --- |
| gate shown | no | no | no | no |
| bottom bar / sidebar | bar | bar | bar | sidebar |
| bar tabs | Overview, Students, Assignments, Activity, More | same | same | hidden |
| alert grid columns | 358px | 448px | 736px | 552 + 552 |
| tables as cards | yes | yes | yes | no |
| **horizontal overflow** | **0** | **0** | **0** | **0** |
| widest element | `html` | `html` | `html` | `html` |

"Widest element is `html`" is the strong form: no descendant reaches past the
viewport at any width.

## Ritual

- `node --check` across every `.js` in the tree (via `find`) - **0 failures**
- em-dash scan on all touched files - clean
- inline-css-check - PASS
- profile-hub-check - PASS
- grammar-sanity - PASS (every unit clean)
- **teacher-mobile-check - PASS** (new)
- bump: CACHE_VERSION v318 -> **v319**
- `bump.js --check` - OK

## Deploy note

This one needs the usual hard refresh. The service worker has been caching
`teacher-mobile.html`, `desktop-gate.js` and `mobile-view.js`; until the new
worker activates, a phone can still be served the gate from cache. That is the
"it is still broken" report to expect, and it is stale cache, not a regression.

## The plan is finished

Steps 1-7 are all done: shell, cards, tab contents, gate removed, check tool in
place. The teacher dashboard now works on a phone rather than refusing to open.
