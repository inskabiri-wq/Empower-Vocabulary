# 2026-06-14 — Fix: starting a Reading/Listening assignment showed the logout modal

## Symptom
Clicking "Start" on a Reading or Listening assignment opened the
"Leaving So Soon? Are you sure you want to log out?" modal instead of opening the
exam home. (Console showed `Starting assignment: Object` at student-assignments.js:1582,
then the logout modal.)

## Cause
In `startAssignment()` (y/assignments/js/student-assignments.js) the reading and
listening branches navigated with a raw `window.location.hash = '#reading'` /
`'#listening'`. That pushes a history entry that `student/js/back-nav.js` does not
track in its `navStack`. The result is a desynced back-stack: a system/browser back
press is read as "at the hub root", and back-nav's popstate handler opens the logout
modal (its intended root-back behavior) instead of returning to the previous screen.

Every other skill navigates the right way — vocab via `showScreen('menuScreen')`,
writing via `location.href`, grammar via a function, and the hub tiles via
`openSkill()` → `showScreen(skill.screen)` — i.e. through the patched `showScreen`
that back-nav tracks. Only reading/listening poked the hash directly.

## Fix
Route reading/listening the same way the hub tile does — a single, back-nav-tracked
screen swap:
```js
if (sk === 'reading' || sk === 'listening') {
  const screenId = (sk === 'reading') ? 'readingScreen' : 'listeningScreen';
  if (typeof window.openSkill === 'function') window.openSkill({ id: sk, screen: screenId });
  else if (typeof showScreen === 'function' && document.getElementById(screenId)) showScreen(screenId);
  else window.location.hash = '#' + sk;   // last-resort fallback
  return;
}
```
`readingScreen` / `listeningScreen` already exist in student-dashboard.html, and
`window.openSkill` is exposed by hub.js.

## Verification
- `node --check` on student-assignments.js — pass.
- Isolated back-nav.js in a harness with a stub `showScreen` + `openLogoutModal`:
  navigate to readingScreen via the patched showScreen, then drive popstate:
  - after nav: active = readingScreen, logout count = 0
  - after 1st back: active = hubScreen (returned to hub), logout count = 0
  - after 2nd back (at hub root): logout count = 1 (intended)
  So opening the assignment lands on the exam home; back returns to the hub; the
  logout prompt only appears on a back press FROM the hub, as designed.

## Versions
- student-assignments.js ?v=2 -> **v3** (student-dashboard.html)
- service-worker CACHE_VERSION v43 -> **v44**

## Not done
- No deploy (hosting-only change). No GitHub push.
