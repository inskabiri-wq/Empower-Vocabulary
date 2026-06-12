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

  function load() {
    db.collection('settings').doc('featureToggles').get().then(snap => {
      window.featureToggles = snap.exists ? (snap.data() || {}) : {};
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
