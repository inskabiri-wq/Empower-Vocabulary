# 2026-09-23 - logout dialog sizes, org logo, window.db

## 1. Logout dialog buttons were never the same size

Asked repeatedly, answered by eye each time, so it kept coming back. Measured
instead, with the real markup from each dashboard against the real stylesheet
that page loads (`y/tools/harness/logout-dialog-size.html`).

Before:

| page | Stay | Log out | off by | height |
|---|---|---|---|---|
| student | 98.5px | 124.1px | 25.6px | 53px |
| teacher | 65.4px | 86.7px | 21.3px | 37px |
| classroom | 110px | 110px | same | 42px |

Two separate faults:

- **Inside one dialog.** `.modal-btn` had no width rule except in classroom,
  so each button was as wide as its own text. "Stay" is shorter than "Log out",
  so it could only ever be narrower.
- **Across pages.** Three different `.modal-btn` rules existed - student
  `14px 32px` / radius 12, teacher `10px 20px` / radius 8, classroom
  `10px 22px` / radius 10 - for the same dialog.

`AppDialog` had the same first fault: `.appdlg-btn` used `flex: 1 1 auto`,
where each button starts at its own text width and grows from there.

### Fix

One geometry rule in `y/css/brand.css`, next to the `.ll-dialog-icon` rule that
had already settled the same argument for the icon (72 / 52 / 3em -> 56px):

- `.ll-dialog .modal-buttons .modal-btn` with `flex: 1 1 0` (equal starting
  width, so the two always finish equal), `min-width: 110px`, `max-width:
  200px`, `padding: 12px 22px`, `border-radius: 10px`, `min-height: 48px`
- the `<= 480px` stack restated in that block, because the per-page rules that
  used to do it are plain `.modal-btn` and now lose on specificity
- `y/js/app-dialog.js` `.appdlg-btn` changed to the same numbers

Colour is untouched, so cancel / confirm / delete keep their meaning. Height is
levelled with `min-height`, not a border width: the three pages use different
border widths and those carry the colour, so normalising the border would have
stripped the student outline or painted a new one on the teacher button.

After: **0px difference inside every dialog, 48px tall on all three pages**,
1px across pages (card width rounding). At 380px all three stack, both full
width. `AppDialog` verified at `runningCodeHasFix: true` - the first run of that
harness served a cached `app-dialog.js` and reported the old rule.

## 2. Organizations panel was deleting the logo

`org-admin.js` `load()` rebuilt each entry as `{name, domain, active,
teacherEligible}` and `deriveAndSave()` wrote that whole list back. `logo` was
not read, so the first toggle of anything in that panel would have silently
dropped it - the field would not have survived being set by hand either.

- `load()` now carries `logo` through
- `deriveAndSave()` writes the entry field by field, omitting an empty logo
  rather than storing `""`
- each row has a logo input (saved on `change`, not per keystroke) with a
  thumbnail preview, so the field has a home in the UI at last

## 3. window.db (from earlier the same day)

Nothing in this app sets `window.db`; every file declares `const db =
firebase.firestore()` in a scope, which does not become a window property. Both
`y/js/profile-hub.js` and `y/teacher/js/messages-admin.js` now resolve it
through a local `fdb()`. This is what made the support popup say "You are not
signed in" and Admin > Messages sit on "Loading...".

Note: the same bug means **choosing an avatar has never persisted to
Firestore**. Not fixed here.

## 4. Volume row alignment

Pre-existing, not caused by this week's work (`app-settings.css` mtime Aug 26,
`app-settings.js` Sep 2). `.as-row` is a two-column grid and the volume row has
three children. Fixed with `.as-row.as-sfxvol-row { display: flex; }`.

## Checks

- `node --check` across every project JS: clean
- em-dash scan: clean (0 files)
- `node y/tools/gates.js`: 29 passed, 0 failed, 1 skipped (rules-live, needs
  `--prod`)
- `node y/tools/bump.js` on brand.css, app-dialog.js, org-admin.js,
  profile-hub.js, messages-admin.js, app-settings.css; CACHE_VERSION v430 ->
  v431; `--check` reports no drift

## Still on the user

- **Deploy the rules.** Live ruleset was still `ce8d2f70` (2026-09-11), with
  `supportMessages` and `isDemoAccount` missing. Support Send fails until
  `firebase deploy --only firestore:rules` lands.
- **Set the FSM logo** in Admin > Organizations: type `fsmvu-seal.png` in the
  new logo box on both rows. The file is already deployed and returns 200; the
  only thing missing was the field. Setting it directly in Firestore was
  refused by the sandbox, and would have been wiped by the panel anyway before
  fix 2 above.
