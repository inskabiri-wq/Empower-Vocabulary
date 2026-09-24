/* ============================================================
   SET / CHANGE PASSWORD - student dashboard
   ------------------------------------------------------------
   Roster-created accounts (made by the rosterImport Cloud Function)
   are given a temporary password and a `mustSetPassword: true` flag
   on their users/{uid} doc. On first sign-in this module shows a
   themed modal that forces them to choose their own password, then
   clears the flag. It also exposes window.openChangePassword() so a
   "change password" button (any time) can reuse the same modal.

   Changing your OWN password is a pure client-side Firebase Auth
   call (updatePassword), so this needs no backend. Clearing the flag
   is an owner write to a non-identity field, which the users rules
   already allow.
   ============================================================ */
(function () {
  'use strict';

  function el(tag, style, html) { var e = document.createElement(tag); if (style) e.style.cssText = style; if (html != null) e.innerHTML = html; return e; }

  // Styling lives in student/css/extra.css (.sp-*). It used to be inline and
  // hardcoded DARK - #152035 card, #0d1117 inputs - which nobody noticed during
  // the white repaint because this modal had no button anywhere: the only way
  // to reach it was a roster account's forced first sign-in. On tokens now, so
  // it follows light / dark / sepia / contrast like every other surface.
  function buildModal(forced) {
    var overlay = el('div');
    overlay.className = 'sp-overlay';
    var card = el('div');
    card.className = 'sp-card';
    card.innerHTML =
      '<div class="sp-icon">🔒</div>' +
      '<h2 class="sp-title">' + (forced ? 'Set your password' : 'Change your password') + '</h2>' +
      '<p class="sp-lede">' +
        (forced ? 'Welcome! Please choose your own password to finish setting up your account.' : 'Choose a new password for your account.') + '</p>' +
      '<input id="spNew" class="sp-input" type="password" autocomplete="new-password" placeholder="New password (at least 6 characters)">' +
      '<input id="spConfirm" class="sp-input" type="password" autocomplete="new-password" placeholder="Confirm new password">' +
      '<div id="spErr" class="sp-err"></div>' +
      '<div class="sp-row">' +
        (forced ? '' : '<button id="spCancel" type="button" class="sp-btn sp-btn-ghost">Cancel</button>') +
        '<button id="spSave" type="button" class="sp-btn">Save password</button>' +
      '</div>';
    overlay.appendChild(card);
    return overlay;
  }

  var open = false;
  function openModal(forced) {
    if (open) return;
    open = true;
    var overlay = buildModal(forced);
    document.body.appendChild(overlay);
    var nw = overlay.querySelector('#spNew');
    var cf = overlay.querySelector('#spConfirm');
    var err = overlay.querySelector('#spErr');
    var save = overlay.querySelector('#spSave');
    var cancel = overlay.querySelector('#spCancel');
    if (nw) nw.focus();

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); open = false; }
    if (cancel) cancel.addEventListener('click', close);

    save.addEventListener('click', function () {
      err.textContent = '';
      var a = nw.value || '', b = cf.value || '';
      if (a.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
      if (a !== b) { err.textContent = 'The two passwords do not match.'; return; }
      var user = firebase.auth().currentUser;
      if (!user) { err.textContent = 'You are signed out. Please sign in again.'; return; }
      save.disabled = true; save.textContent = 'Saving...'; save.style.opacity = '0.6';
      user.updatePassword(a).then(function () {
        return db.collection('users').doc(user.uid).set(
          { mustSetPassword: firebase.firestore.FieldValue.delete() }, { merge: true }
        ).catch(function () { /* flag clear is best-effort */ });
      }).then(function () {
        close();
        try { if (typeof showToast === 'function') showToast('Password updated.'); } catch (e) {}
      }).catch(function (e) {
        save.disabled = false; save.textContent = 'Save password'; save.style.opacity = '1';
        if (e && e.code === 'auth/requires-recent-login') {
          err.textContent = 'For security, please sign out and sign in again, then change your password.';
        } else {
          err.textContent = (e && e.message) || 'Could not update the password.';
        }
      });
    });
  }

  // Public: a "Change password" button anywhere can call this.
  window.openChangePassword = function () { openModal(false); };

  // Auto-prompt roster-created accounts on first sign-in.
  function checkForced() {
    if (typeof db === 'undefined' || typeof auth === 'undefined' || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).get().then(function (snap) {
      if (snap.exists && snap.data() && snap.data().mustSetPassword === true) openModal(true);
    }).catch(function () {});
  }

  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 500); return; }
    var tries = 0;
    var wait = function () {
      if (auth.currentUser) { checkForced(); return; }
      if (++tries > 40) return;
      setTimeout(wait, 500);
    };
    wait();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
