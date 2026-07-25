/* ============================================================
   PLACEMENT TEST - student hub tile
   ------------------------------------------------------------
   Shows a Placement card on the hub grid ONLY when
   settings/placementConfig is active AND the signed-in student
   matches its scope (shared check: course-target.js). One
   attempt: when /placementResults/{uid} exists, the card shows
   the recommended level instead of a start state (the runner
   page also refuses a second run; rules block overwrites).
   Self-healing: hub.js rebuilds #hubGrid on re-render, so a
   MutationObserver re-appends the card whenever it vanishes.
   ============================================================ */
(function () {
  'use strict';

  var state = null; // { done: bool, level: 'B1' } once eligible

  function db_() { return (typeof db !== 'undefined') ? db : (window.firebase && firebase.firestore ? firebase.firestore() : null); }

  function buildCard() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hub-card' + (state.off ? ' is-off' : '');
    btn.id = 'placementHubCard';
    btn.dataset.skill = 'placement';
    btn.setAttribute('aria-label', 'Open Placement Test');
    btn.style.setProperty('--pct', '0');
    btn.style.setProperty('--skill-accent', '#a78bfa');
    // Same convention as every other feature-toggled skill: switched OFF keeps
    // the card visible but grayed ("Not activated"), it is never removed.
    var sub = state.off ? 'Not activated'
      : (state.done ? ('Completed - recommended ' + state.level) : 'Find your English level');
    var pill = state.off ? '<span class="hub-live-pill hub-off-pill">OFF</span>'
      : '<span class="hub-live-pill">' + (state.done ? 'DONE' : 'TEST') + '</span>';
    btn.innerHTML =
      '<div class="hub-ring" style="--pct:0"><span class="hub-icon" aria-hidden="true">🎯</span></div>' +
      '<div class="hub-meta"><div class="hub-name">Placement</div>' +
      '<div class="hub-sub">' + sub + '</div></div>' +
      '<div class="hub-pct">' + pill + '</div>';
    btn.addEventListener('click', function () {
      if (state.off) {
        if (typeof AppDialog !== 'undefined' && AppDialog.alert) AppDialog.alert('The Placement Test is not activated for your programme.');
        return;
      }
      try { if (typeof logActivity === 'function') logActivity('skill_opened', { skill: 'placement' }); } catch (_) {}
      window.location.href = 'placement.html';
    });
    return btn;
  }

  function ensureCard() {
    if (!state) return;
    var grid = document.getElementById('hubGrid');
    if (!grid || document.getElementById('placementHubCard')) return;
    grid.appendChild(buildCard());
  }

  function boot(user) {
    var d = db_();
    if (!d || !user) return;
    Promise.all([
      d.collection('settings').doc('placementConfig').get(),
      d.collection('users').doc(user.uid).get(),
      d.collection('placementResults').doc(user.uid).get(),
      d.collection('settings').doc('featureToggles').get()
    ]).then(function (res) {
      var cfg = res[0].exists ? (res[0].data() || {}) : {};
      var userDoc = res[1].exists ? (res[1].data() || {}) : {};
      var toggles = res[3].exists ? (res[3].data() || {}) : {};
      if (userDoc.role && userDoc.role !== 'student') return;           // students only
      // TARGETING (placementConfig.scope) decides WHO gets the card at all;
      // the Admin > Features toggle decides its state: ON = live, OFF (or not
      // yet enabled) = grayed "Not activated" - the card is never removed.
      var inScope = (typeof window.courseActiveFor === 'function')
        ? window.courseActiveFor({ active: true, scope: cfg.scope || {} }, userDoc)
        : true;
      if (!inScope) return;
      var r = res[2].exists ? (res[2].data() || {}) : null;
      state = { off: toggles.placement !== true, done: !!r, level: (r && r.recommendedLevel) || '' };
      ensureCard();
      // hub.js wipes the grid on every render - put the card back each time.
      var grid = document.getElementById('hubGrid');
      if (grid) new MutationObserver(function () { ensureCard(); }).observe(grid, { childList: true });
    }).catch(function () {});
  }

  function waitAuth(tries) {
    tries = (tries == null) ? 40 : tries;
    var u = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser
      : (window.firebase && firebase.auth && firebase.auth().currentUser) || null;
    if (u) { boot(u); return; }
    if (tries <= 0) return;
    setTimeout(function () { waitAuth(tries - 1); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { waitAuth(); });
  else waitAuth();
})();
