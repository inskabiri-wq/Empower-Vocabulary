/* ============================================================
   WRITING AI - page gate
   ------------------------------------------------------------
   Same posture the dashboards already use (see teacher/js/config.js):
   no signed-in user => send the visitor to the LOGIN page instead of
   rendering the tool. Before this, lingualab-write/index.html rendered
   fully for anyone with the URL (the AI call itself was still refused
   server-side by assertWritingAI, but the whole tool was on screen -
   and the URL is printed into every PDF, so it does get shared).

   Signed in still needs the Writing AI grant: the admin, or a uid in
   settings/aiWritingAccess.teacherUids. analyzeWriting enforces the
   same rule server-side, so this is defence in depth plus a clean
   message instead of a permission error after a wasted paste.

   FAIL CLOSED: index.html carries class="cor-checking" which hides the
   app, and only a passing check removes it. If auth never answers we
   go to login rather than reveal the page.
   ============================================================ */
(function () {
  'use strict';

  var LOGIN = '../index.html';
  // Asked for, not typed in. The fallback is the value this line used to
  // hold, so if js/tenant.js ever fails to load the gate behaves exactly as
  // it did before rather than locking everyone out.
  var ADMIN_EMAIL = (window.Tenant && window.Tenant.get('adminEmail', 'akabiriaslifar@fsm.edu.tr'))
    || 'akabiriaslifar@fsm.edu.tr';
  var html = document.documentElement;

  function reveal() { html.classList.remove('cor-checking'); }
  function toLogin() { window.location.replace(LOGIN); }
  function deny() {
    reveal();
    var app = document.querySelector('.cor-app');
    if (app) app.style.display = 'none';
    var box = document.getElementById('corGateDenied');
    if (box) box.hidden = false;
  }

  if (typeof firebase === 'undefined' || !firebase.auth) { toLogin(); return; }

  var settled = false;
  // Never leave the page hidden forever. If auth has not reported back,
  // treat it as signed out and go to login (fail closed, not fail open).
  var timer = setTimeout(function () {
    if (!settled) { settled = true; toLogin(); }
  }, 8000);

  firebase.auth().onAuthStateChanged(function (user) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);

    if (!user) { toLogin(); return; }
    if (String(user.email || '').toLowerCase() === ADMIN_EMAIL) { reveal(); return; }
    if (!firebase.firestore) { deny(); return; }

    firebase.firestore().collection('settings').doc('aiWritingAccess').get()
      .then(function (snap) {
        var d = snap.exists ? (snap.data() || {}) : {};
        var granted = Array.isArray(d.teacherUids) ? d.teacherUids : [];
        if (granted.indexOf(user.uid) !== -1) reveal(); else deny();
      })
      .catch(function () { deny(); });
  });
})();
