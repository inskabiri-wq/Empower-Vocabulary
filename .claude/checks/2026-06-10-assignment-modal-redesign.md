# Assignment modals: bigger + multi-column student picker · 2026-06-10

## Bigger modals
- teacher-dashboard.html: the grammar + vocab/exam assignment modals were
  max-width 680px. Now max-width min(960px, 96vw); width 96%; max-height 92vh.
  (Writing modal was already wide; left as is.) replace_all hit both at once.

## Student picker (shared across ALL assignment forms)
- assignments.css .student-checkbox-items: single scrolly column -> a responsive
  CARD GRID: repeat(auto-fill, minmax(210px, 1fr)), gap 6px, max-height 380px.
  So you see many students at once instead of scrolling one column.
- .student-checkbox-item: added a subtle border + bg so each is a tidy card.
- These classes are shared by vocab (populateAssignmentStudents) AND
  StudentPicker (grammar / writing / exam), so the upgrade applies everywhere
  ("design all over the assignment pop-ups"). The filter (display flex/none) still
  works inside the grid (flex item is still a grid item).

## Cache
- service-worker.js v29 -> v30. (teacher-dashboard.html is network-first; assignments.css
  is busted by the SW bump.)

## Verify
- assignments.css braces 213/213. Both modals widened (0 old 680px left). Grid + card present.

## Heist (reconfirm, NOT re-touched)
- Earlier fix = the PASSWORD: the player sees their vault word the whole game + is told
  when it rotates (subscribeMyPassword). The end-of-session RESULTS screen ("Heist
  Complete" standings) was NOT changed - asked the user if that screen is the concern.

## Deploy
- firebase deploy --only hosting (SW v30).
