# 2026-08-26 - the export button, and a dead file I edited

Asked simply: where is the export button. The answer took three findings, two of
them mine.

## 1. There was no export button on that tab, by design

The live markup carries this instead:

```html
<!-- Excel export moved into Admin > Reports (reports-admin.js). -->
```

A deliberate decision, and the right one: reporting has a single home.

## 2. But Reports does not export the activity logs

`reports-admin.js` builds its workbook from students, sessions, games,
assignments and AI usage. **The activity logs are in none of them.**

So the button was removed from the tab in favour of Reports, and Reports never
picked them up. There has been **no way to export the activity logs from the UI
at all**, while `exportToExcel()` sat in `activity-admin.js` fully written with
nothing calling it.

## 3. I put the retention controls in a file that renders nowhere

`activity-logs-tab.html` looks exactly like the Activity Logs markup. It is
referenced by **nothing** - `teacher-dashboard.html` carries its own copy. My
retention row went into the dead one, so it was invisible, and nothing
complained: the JS just finds `null` and does nothing.

## Fixed

Both the download and the retention row are now in **teacher-dashboard.html**,
the page that actually renders, and removed from the dead file.

The download button sits with the delete controls rather than in Reports, and
the comment says why:

> Reporting lives in Admin > Reports. This download is not a report: it is the
> mandatory FIRST STEP of deleting logs below, and the delete refuses to run
> until it has been used. Putting it anywhere else would make that guard
> theatre.

Verified: all 14 ids the Activity Logs code reaches for exist in the live page,
and all 5 handlers the markup calls exist on the object.

## New gate: tools/live-markup-check.js

Because "I edited the wrong copy of the markup" produces no error anywhere.

It asserts every id the code drives exists in `teacher-dashboard.html`, every
handler the markup calls exists in the JS, the delete control is never on the
page without the download beside it, and **the dead file stays dead** rather
than quietly becoming a second source of truth.

**Proved it catches the mistake it exists for:** putting the retention controls
back into `activity-logs-tab.html` makes it fail with

> activity-logs-tab.html is referenced by nothing yet carries retention
> controls - they render nowhere. Put them in teacher-dashboard.html.

and restoring the file makes it pass again.

## Left for a decision

- **`activity-logs-tab.html` is dead and I have not deleted it.** It is
  referenced by nothing. Deleting it would remove a trap, but it may be kept
  deliberately as a template, so that is your call.
- **Activity logs are still absent from the Reports workbook.** If they belong
  in the single reporting home, that is one more sheet in `exportWorkbook()`.
  Not started.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- `teacher-dashboard.html` `<div>` balance 395/395
- gates: **fourteen**, all PASS (live-markup-check is new)
- bump: activity-admin.js v8, CACHE_VERSION -> **v368**; `--check` OK
