# 2026-08-26 - the Preset column is gone, and how the answer rows actually work

## 1. Preset: deleted

It was a **derived label wearing the costume of a control**. It read the tick
boxes back and showed a name for the combination, or "Custom" when the
combination had no name. Once Courses became a fourth capability, most
combinations have no name - hence a column reading "Writing only / Custom /
Custom / Semi-admin / Semi-admin" next to the ticks that actually decide
everything.

Two ways to fix it: invent more preset names, or remove a control that never
carried information the ticks did not already show. Removed.

Gone: `applyPreset()`, the `<select>`, its table cell, its column header and its
change handler. Header count and cell count verified equal (8 and 8), so no
column is skewed.

The ticks stay, and they are the real thing: each one autosaves on change and is
audit-logged on its own.

## 2. How the answer rows work, and whether they work

**They do.** Here is the mechanism, since it was not obvious.

In the student drill-down, a session row is only clickable **when that session
recorded per-question detail**. When it did, the row is rendered as:

```html
<tr data-ans="s1"> ... Grammar - Multiple Choice  🔍 answers ... </tr>
<tr id="sdAnsRow-s1" style="display:none"> ...the questions... </tr>
```

A delegated click handler toggles the hidden row. So three separate things have
to agree - the id on the row, the id on the panel, and the handler that joins
them - and **the marker to look for is the small blue `🔍 answers` next to the
activity name.** A row without that marker has nothing behind it and will not
respond, by design.

### Which activities have detail to show

| activity | records per-question detail? |
| --- | --- |
| grammar practice (all three games) | yes, always |
| vocabulary practice | yes, always |
| reading / listening exams | yes, always |
| **pronunciation** | **only when the student uses the microphone**, and only since today |
| writing exam | no per-question items - it is one essay |

### New gate: tools/student-detail-expand-check.js

It builds the rows from the shipped renderer and asserts the click actually
opens something - 8 cases, all passing:

| case | result |
| --- | --- |
| grammar session | opens, question text present |
| vocabulary session | opens, question text present |
| reading exam | opens, question text present |
| pronunciation with a spoken attempt | opens, question text present |
| **pronunciation with only `vocabDetails: []`** | **no marker, nothing to open** |
| session with no detail at all | no marker |
| two expandable rows in one list | get different ids, no collision |
| the handler targets `#sdAnsRow-<data-ans>` | yes, the ids match |

That last pair is the part worth having: the row id and the panel id are
generated separately, so a mismatch would silently produce rows that look
clickable and do nothing.

## 3. So why does YOUR row still not open

Because that particular session has nothing to open. It is two days old;
pronunciation only began recording anything today, and only via the microphone.
It carries the empty `vocabDetails: []` the old writer attached to every
session - which is exactly why it used to *say* "tap for items" and then show an
empty box.

It should now render **without** the `🔍 answers` marker. If it still shows the
marker after a hard refresh, that is a real bug and worth telling me; if it
shows no marker, the code is doing the right thing and there is genuinely
nothing recorded for that attempt.

To see one work: do a grammar or vocabulary activity, then open that student -
the newest row will carry the marker.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: **twelve**, all PASS (student-detail-expand-check is new)
- bump: ai-writing-admin.js v11, CACHE_VERSION -> **v364**; `--check` OK

## Status

Courses/Placement rules deploy: **done** (confirmed). Nothing outstanding on
that front.
