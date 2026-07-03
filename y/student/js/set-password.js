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

  function buildModal(forced) {
    var overlay = el('div', 'position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(2,6,16,0.72); backdrop-filter:blur(3px); font-family:"DM Sans","Segoe UI",system-ui,sans-serif;');
    var card = el('div', 'width:100%; max-width:400px; background:#152035; border:1px solid rgba(59,130,246,0.25); border-radius:16px; padding:24px; box-shadow:0 24px 60px rgba(0,0,0,0.5); color:#f8fafc;');
    card.innerHTML =
      '<div style="font-size:34px; text-align:center; line-height:1;">🔒</div>' +
      '<h2 style="font-size:19px; font-weight:800; text-align:center; margin:8px 0 4px;">' + (forced ? 'Set your password' : 'Change your password') + '</h2>' +
      '<p style="font-size:13px; color:#94a3b8; text-align:center; margin:0 0 16px; line-height:1.5;">' +
        (forced ? 'Welcome! Please choose your own password to finish setting up your account.' : 'Choose a new password for your account.') + '</p>' +
      '<input id="spNew" type="password" autocomplete="new-password" placeholder="New password (at least 6 characters)" style="width:100%; box-sizing:border-box; padding:11px 13px; margin-bottom:10px; border:1px solid rgba(59,130,246,0.25); border-radius:10px; background:#0d1117; color:#f8fafc; font-family:inherit; font-size:14px;">' +
      '<input id="spConfirm" type="password" autocomplete="new-password" placeholder="Confirm new password" style="width:100%; box-sizing:border-box; padding:11px 13px; border:1px solid rgba(59,130,246,0.25); border-radius:10px; background:#0d1117; color:#f8fafc; font-family:inherit; font-size:14px;">' +
      '<div id="spErr" style="font-size:12.5px; color:#f87171; min-height:18px; margin:8px 2px 0;"></div>' +
      '<div style="display:flex; gap:10px; margin-top:8px;">' +
        (forced ? '' : '<button id="spCancel" type="button" style="flex:1; cursor:pointer; font-family:inherit; font-weight:700; font-size:14px; padding:11px; border-radius:10px; border:1px solid rgba(59,130,246,0.25); background:transparent; color:#94a3b8;">Cancel</button>') +
        '<button id="spSave" type="button" style="flex:2; cursor:pointer; font-family:inherit; font-weight:800; font-size:14px; padding:11px; border-radius:10px; border:none; background:#3b82f6; color:#fff;">Save password</button>' +
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
