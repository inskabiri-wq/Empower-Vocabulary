/* ============================================================
   FEATURE TOGGLES - student dashboard loader
   ------------------------------------------------------------
   Reads settings/featureToggles once after sign-in and exposes it
   as window.featureToggles, then tells hub.js to re-render so
   deactivated tiles show their grayed "Not activated" state.
   A missing doc or a load error means everything stays active.
   Uses the dashboard's global `db` + `auth`.
   ============================================================ */
(function () {
  'use strict';

  // Hide any vocabulary practice MODE cards an admin deactivated
  // (settings/featureToggles.mode_*). 3 cards have ids; the other 5 only have an
  // inline startActivity('X') handler, so we match those by the onclick string.
  var MODE_BY_ID = { mode_spelling: 'spellingCard', mode_fillblank: 'fillblankCard', mode_order: 'orderCard' };
  var MODE_BY_ACT = { mode_match: 'match', mode_choice: 'choice', mode_reverse: 'reverse', mode_pronunciation: 'pronunciation', mode_unscramble: 'unscramble' };
  function applyModeGating() {
    var ft = window.featureToggles || {};
    Object.keys(MODE_BY_ID).forEach(function (k) {
      if (ft[k] === false) { var e = document.getElementById(MODE_BY_ID[k]); if (e) e.style.display = 'none'; }
    });
    var cards = document.querySelectorAll('.activity-card');
    Object.keys(MODE_BY_ACT).forEach(function (k) {
      if (ft[k] !== false) return;
      cards.forEach(function (card) {
        var oc = card.getAttribute('onclick') || '';
        if (oc.indexOf("startActivity('" + MODE_BY_ACT[k] + "')") !== -1) card.style.display = 'none';
      });
    });
  }

  function load() {
    db.collection('settings').doc('featureToggles').get().then(snap => {
      window.featureToggles = snap.exists ? (snap.data() || {}) : {};
      try { applyModeGating(); } catch (e) { console.warn('mode gating', e); }
      document.dispatchEvent(new CustomEvent('feature-toggles-ready'));
    }).catch(e => { console.warn('featureToggles', e); });
  }

  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 500); return; }
    const waitAuth = (tries) => {
      if (auth.currentUser) { load(); return; }
      if (tries <= 0) return;
      setTimeout(() => waitAuth(tries - 1), 500);
    };
    waitAuth(40);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
