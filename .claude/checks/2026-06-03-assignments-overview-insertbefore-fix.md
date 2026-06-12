# Fix: assignments-overview insertBefore NotFoundError · 2026-06-03

## Symptom
Teacher dashboard console: 53 repeating errors —
`[assignments-overview] overview render failed: NotFoundError: Failed to execute
'insertBefore' on 'Node': The node before which the new node is to be inserted is
not a child of this node.` (ensurePanel → render → renderAll).

## Root cause
`y/teacher/js/assignments-overview.js` → `ensurePanel()`:
```
const anchor = tab.querySelector('.section');      // matches ANY descendant .section
if (anchor && anchor.nextSibling) tab.insertBefore(panel, anchor.nextSibling);
```
`querySelector('.section')` returns the first `.section` **anywhere** inside the tab —
often a NESTED one. Its `nextSibling` is therefore NOT a direct child of `tab`, so
`tab.insertBefore(panel, thatSibling)` throws. Because the insert fails, the panel is
never created, so the early `getElementById` guard never short-circuits and it throws
again on every render → the 53 repeats.

## Fix (minimal, scoped)
```
const anchor = tab.querySelector(':scope > .section');   // DIRECT-child sections only
if (anchor && anchor.nextSibling && anchor.nextSibling.parentNode === tab) {
  tab.insertBefore(panel, anchor.nextSibling);
} else {
  tab.appendChild(panel);
}
```
- `:scope > .section` guarantees the anchor is a direct child, so its `nextSibling` is a
  child of `tab` → insertBefore is valid. Extra `parentNode === tab` guard for safety.
- Falls back to `appendChild` when no direct-child section exists. Preserves placement
  intent (panel after the first top-level section) and the panel id + all render/data logic.
- Sibling `ensureActivityPanel()` uses `appendChild` only → not affected.

## Verify / deploy
- `node --check y/teacher/js/assignments-overview.js` → clean.
- Bumped `service-worker.js` CACHE_VERSION v9 → **v10** so installed users get the fix.
- User action: `firebase deploy --only hosting`, then hard-refresh. Overview render error should be gone (0 repeats).
- (Live teacher-dashboard not E2E-tested here — needs auth; fix is a deterministic DOM-scope correction.)
