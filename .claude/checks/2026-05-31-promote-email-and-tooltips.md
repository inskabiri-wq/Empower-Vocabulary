# Promote-dialog email safeguard + student-row tooltips

**Date:** 2026-05-31
**Trigger:** (1) show the email in the "Promote to Teacher?" confirm as a safeguard; (2) hover tooltips not working on the student-row action icons.

---

## #1 — Email in the promote confirm  ✅
`teacher/js/students.js` promote dialog now reads:
> Grant teacher privileges to **{name} — {email}**? …

So the admin can verify they're promoting the intended person (not the wrong row). `whoLine = studentEmail ? "${name} — ${email}" : name`. (Note: there's *already* a hard guard — `isTeacherEligibleStudent` only allows `@fsm.edu.tr` staff emails; `@stu.fsm.edu.tr` students are blocked from promotion entirely. The email line is the extra visual confirmation.)

## #2 — Tooltips: the delete button had no `title`  ✅
The four row action icons: 👁️ View (`title`), 🖊️ Edit (`title`), 👑 Promote (`title`) — but 🗑️ **Delete had no `title`** (line 225). That's why hover "didn't work" on it. Added `title="Delete student"`. All four now show native hover tooltips (which work — the screenshot proved native titles render here).

**Why native (not a custom CSS tooltip):** these buttons live in a `<table>` cell; a CSS `::after` tooltip would risk being clipped by the table's scroll/overflow container. Native `title` tooltips never clip. Trade-off: native has the browser's ~½s hover delay.
- *Optional follow-up if the delay bugs you:* a JS tooltip appended to `document.body` (no clipping, instant). Not done — native fix is zero-risk and covers the actual gap.

## Checks
- `node --check teacher/js/students.js` → OK.
- 4/4 action buttons now carry a `title`.
- Promote message includes the email (verified).

## #3 — Cursor didn't change to a pointer on the action icons  ✅
`.action-btn-small` had **no CSS rule at all**, so the buttons used the browser-default arrow cursor on hover. Added to `teacher/css/styles.css`:
```css
.action-btn-small { cursor: pointer; transition: transform .1s, filter .15s; }
.action-btn-small:hover { filter: brightness(1.18); transform: translateY(-1px); }
.action-btn-small:active { transform: translateY(0); }
```
Now hover → hand pointer + a subtle lift. Braces 97/97.

## Deploy
Hosting-only. Rides the **v5** cache bump (so it actually reaches the browser). `firebase deploy --only hosting` → the page auto-reloads to the fresh version.
