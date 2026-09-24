/* ============================================================
   TEACHER RETURN - a way back to the teacher dashboard
   ------------------------------------------------------------
   The teacher sidebar links to student-dashboard.html ("Lingualab"), and
   nothing linked back, so a teacher who looked at the student side had to
   retype the URL or log out. This adds a "Teacher Dashboard" button to the
   student dashboard header.

   STUDENTS MUST NEVER SEE IT.

   The button is not rendered-then-hidden - it is never created unless the
   account is a teacher. There is no CSS rule to defeat and no hidden node: a
   student's page simply does not contain the element.

   WHY THERE IS A CACHE
   The role lives in the user's Firestore document, which auth.js fetches over
   the network. Waiting for that put the button on screen noticeably later than
   everything around it. So the answer from last time is remembered in
   localStorage and applied at PARSE time - the same trick feature-toggles.js
   and progress.js already use to get the tiles and the rings up immediately.
   This script is loaded after the headers in the markup, so the button is in
   place before the first paint rather than after a round trip.

   The cache is a HINT, never the authority. When the real document arrives the
   role is re-checked, and if it is not a teacher the button is removed again.
   So a stale or hand-edited cache self-corrects within the same page load.

   ON SECURITY
   This is a convenience, not a boundary, and nothing here is trusted with
   access. teacher-dashboard.html gates itself - teacher/js/config.js shows
   "Access Denied" unless the document says role is 'teacher' - and the
   Firestore rules gate the data underneath. Someone who hand-edited this cache
   key would reveal a link that takes them straight to Access Denied, and it
   would vanish again the moment their real document loaded. The role check
   here is about not showing students a door they cannot open.

   ON COST
   Zero extra Firestore reads. auth.js already fetches the user document and
   parks it on window.currentStudentData; this reads the copy in memory.
   ============================================================ */
(function () {
  'use strict';

  var CACHE_KEY = 'll-role';
  var TEACHER = 'teacher';
  var TRIES = 60;                    // ~6s at 100ms, then stop waiting

  function readCachedRole() {
    try {
      var v = localStorage.getItem(CACHE_KEY);
      return typeof v === 'string' && v ? v : null;
    } catch (_) { return null; }
  }

  function writeCachedRole(role) {
    try {
      if (typeof role === 'string' && role) localStorage.setItem(CACHE_KEY, role);
      else localStorage.removeItem(CACHE_KEY);
    } catch (_) { /* private mode: the button just waits for the document */ }
  }

  function liveRole() {
    var d = window.currentStudentData;
    if (!d || typeof d !== 'object') return null;
    return typeof d.role === 'string' ? d.role : null;
  }

  function makeButton() {
    var a = document.createElement('a');
    a.href = 'teacher-dashboard.html';
    // It borrows .logout-btn purely for the pill look of the header buttons, so
    // no new CSS is needed. NOTE for anyone adding logout behaviour later:
    // nothing currently binds to .logout-btn (the real ones use an inline
    // onclick), but if you ever write querySelectorAll('.logout-btn') to wire
    // one up, exclude [data-teacher-return] or you will log teachers out when
    // they meant to go back.
    a.className = 'logout-btn tr-teacher-btn';
    a.title = 'Back to the teacher dashboard';
    a.setAttribute('data-teacher-return', '');
    a.style.textDecoration = 'none';
    var ico = document.createElement('span');
    ico.textContent = '🎓';
    var label = document.createElement('span');
    label.textContent = 'Teacher Dashboard';
    a.appendChild(ico);
    a.appendChild(label);
    return a;
  }

  function inject() {
    // Every screen has its own .dashboard-header, so place one in each rather
    // than only the hub - a teacher who navigates into a skill screen would
    // otherwise lose the way back again.
    var rights = document.querySelectorAll('.dashboard-header .header-right');
    Array.prototype.forEach.call(rights, function (right) {
      if (right.querySelector('[data-teacher-return]')) return;   // idempotent
      // Sit before Logout so the destructive action stays last. The :not()
      // matters - this button wears .logout-btn too, so without it the anchor
      // could resolve to our own button rather than the real Logout.
      var logout = right.querySelector('.logout-btn:not([data-teacher-return])');
      var btn = makeButton();
      if (logout) right.insertBefore(btn, logout);
      else right.appendChild(btn);
    });
  }

  function removeAll() {
    var existing = document.querySelectorAll('[data-teacher-return]');
    Array.prototype.forEach.call(existing, function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
  }

  // ── 1. Optimistic, at parse time ─────────────────────────────────────────
  // Only ever from a remembered 'teacher'. Any other cached value, or none,
  // shows nothing and waits for the document.
  var optimistic = readCachedRole() === TEACHER;
  if (optimistic) inject();

  // ── 2. The document decides ──────────────────────────────────────────────
  var settled = false;
  function settle(role) {
    if (settled) return;
    settled = true;
    writeCachedRole(role);
    if (role === TEACHER) {
      inject();
      // Screens can re-render after this (skills render on demand), so
      // re-assert for a while. inject() is idempotent, so no duplicates.
      var n = 0;
      var timer = setInterval(function () {
        if (++n > 20) { clearInterval(timer); return; }
        inject();
      }, 500);
    } else {
      // Wrong guess, or a cache left behind by someone else on this device.
      removeAll();
    }
  }

  var tries = 0;
  (function waitForDoc() {
    var role = liveRole();
    if (role == null) {
      if (++tries <= TRIES) setTimeout(waitForDoc, 100);
      // If it never arrives we leave the optimistic state alone: the page is
      // signed out or broken, and either way the destination still gates.
      return;
    }
    settle(role);
  })();

  // Headers belonging to screens that are built later still need one.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (settled ? liveRole() === TEACHER : optimistic) inject();
    });
  }
})();
