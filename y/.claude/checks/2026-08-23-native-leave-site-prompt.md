# 2026-08-23 - the browser's "Leave site?" box instead of ours

Reported with a screenshot of Chrome's own "Leave site? Changes you made may not
be saved." on the writing exam preview.

## The constraint, stated plainly

That box comes from a `beforeunload` handler, and **it cannot be replaced with
the app's Leave / Stay dialog.** Every modern browser shows its own generic
prompt and ignores any custom text, deliberately, so that a page cannot lie
about what leaving will do. The only thing under our control is **whether it
fires at all**.

So this is not a case of using the wrong dialog. It is a case of arming a
browser prompt in situations that do not warrant one.

## Where it was wrong

`student/js/writing-exam.js` armed the guard whenever the work was not
submitted, with no other conditions:

```js
window.addEventListener('beforeunload', (e) => {
  if (state.submitted) return;
  e.preventDefault(); e.returnValue = ''; return '';
});
```

Two situations that should never have raised it:

**Preview mode.** The URL in the screenshot is `?preview=1` with `Words: 0`, and
the page's own banner says "PREVIEW MODE - teacher view. Nothing is saved." The
prompt warned a teacher about losing changes on a page that saves nothing, every
single time they pressed "✕ Close Preview" (which navigates with
`location.href`, so the guard fired).

**After the app already asked.** The page has the shared Leave / Stay dialog for
the phone back-button path. Answering Leave there then navigated, which raised
the browser's prompt on top: the same question twice, the second time in a box
we cannot style.

## Fix

A `state.leaving` flag, set immediately before any navigation the app performs
on purpose, and both new conditions in the guard:

```js
if (state.submitted || state.preview || state.leaving) return;
```

Set at all three deliberate exits: Close Preview, the submitted-work path, and
the Leave branch of the app's dialog. Verified no other navigation is left
unguarded; the two `location.replace('index.html')` auth redirects run inside
`onAuthStateChanged` at the top of `bootstrap()` and return before
`wireSecurity()` ever registers the guard.

## The same shape elsewhere

Swept for it rather than waiting for the next report. Classroom teacher and
student both arm a guard while a game is in flight, and both navigate
deliberately while it is armed:

| file | deliberate exits that were double-prompting |
| --- | --- |
| `classroom/js/teacher.js` | Log out, and the download-modal exit to another page |
| `classroom/js/student.js` | Log out, joining a Heist room, joining a mini-game |

All now set the same flag first. Logging out of a live game asked twice before:
the app's Log out / Stay, then the browser's.

## Verification, honestly

This is a control-flow change on an auth-gated page, so it was verified by
reading and by a static sweep of every navigation site in the three files, not
by a browser run. `node --check` passes across the tree and the flag is set at
every exit that can occur while a guard is armed (3 sites in writing-exam, 3 in
classroom student, 2 in classroom teacher).

What a real check would look like: open the preview and press Close Preview, and
expect to land on the dashboard with no browser prompt.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan - clean
- all five gates - PASS
- bump: writing-exam.js v5, classroom student.js v5, classroom teacher.js v3,
  CACHE_VERSION v332 -> **v333**
- `bump.js --check` - OK
