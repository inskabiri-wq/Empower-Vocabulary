# 2026-08-22 - teacher dashboard on phone, step 1: the shell

Agreed plan: bottom tab bar with More, gate stays until step 6.

## Writing form buttons, finished first

The tabs and Back/Next were matched to `.modal-btn-cancel` last round by fill,
padding and radius - and were still visibly different, which the user said. So
they were MEASURED rather than eyeballed:

```
Cancel   h 37   pad 10/20   radius 8px   border 0px none   size 13.33px
wtab     h 42   pad 10/20   radius 8px   border 1px solid  size 14.40px
```

Three real differences left. `.modal-btn` sets `border: none` and NO font-size,
so a 1px border and an explicit `0.9em` made those buttons 5px taller. Both
dropped; hover moved from border-colour to background since there is no border
to colour now.

After: every button in the form - the four tabs, Back, Next, Cancel and Save -
reports **37px and zero differences** from Cancel.

## The shell

`teacher/js/mobile-shell.js`, loaded after `overview-v2.js` (which hydrates the
sidebar icons it copies).

Below 768px the 220px sidebar is hidden and replaced by a fixed bottom bar:
Overview, Students, Assignments, Activity, More. Everything else - Writing AI,
Courses, Admin, Placement, Widgets, Display, Lingualab, Classroom, Logout - is
in the More sheet, with Logout last, in red, behind a separator.

### It reads the sidebar rather than listing tabs

Every entry is built from the real `.t2-nav-item` elements, so the bar cannot
drift from the navigation it mirrors. A tab added, renamed or removed there
appears here for free. Same reasoning as the profile hub being one module rather
than thirteen copies - and this list already picked up a "Writing AI" tab that
was not in my own scoping notes.

Actions delegate to the sidebar row: `switchTab` for tabs, otherwise
`el.click()`, so the widgets tray, the settings panel and the logout modal all
run their existing code. No second implementation of anything.

### Role-gated rows

Placement and Admin ship `style="display:none"` and are revealed later once the
account is known. A MutationObserver re-syncs the bar, so an admin does not have
to reload to get the Admin entry, and a non-admin never sees one.

Measured with the REAL sidebar markup lifted out of teacher-dashboard.html:

| | 390px | 390px, admin revealed | 1280px |
| --- | --- | --- | --- |
| bottom bar visible | yes | yes | no |
| sidebar visible | no | no | yes |
| tabs | Overview, Students, Assignments, Activity, More | same | - |
| Admin in the More sheet | no | **yes** | - |
| smallest tap target | 56px | 56px | - |
| horizontal overflow | none | none | none |

Desktop is untouched: the sidebar is still the navigation above 768px.

## Phone logout had no confirm

`teacher-mobile.html`'s `tmLogout()` called `auth.signOut()` on the first tap
with no warning - on a phone that is one mis-tap away at all times. It now uses
the shared dialog with Log out / Stay, and the page loads `js/app-dialog.js`,
which it never did.

That page is deleted at step 6, but it is what the gate puts in front of
teachers until then, so it should not be the one screen that signs you out
without asking.

## What step 1 deliberately does NOT do

No tab's CONTENTS are converted. The wide tables in Students, Assignments and
Reports are still wide - that is step 2, and it is the bulk of the work. This is
only the frame they drop into.

## Ritual

- `node --check` mobile-shell.js - ok
- em-dash scan - clean
- inline-css-check / profile-hub-check - PASS
- bump: mobile-shell.js v2, CACHE_VERSION v314 -> **v316**
- `bump.js --check` - OK

## Next

Step 2: rows become cards below 768px, shared by Students, Assignments and
Reports. Then 3-5 (Overview/Students read-only, Assignments, Activity log),
then 6 (delete the gate and teacher-mobile.html), then 7 (a
`teacher-mobile-check.js` gate plus a measured harness at 390/480/768/1280).
