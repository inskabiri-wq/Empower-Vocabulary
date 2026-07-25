/* ============================================================
   DEMO / TEST ACCOUNT CREATOR - admin panel (#demoAccountPanel)
   ------------------------------------------------------------
   Calls the createDemoAccount Cloud Function to make a single
   pre-verified login with an admin-chosen ACTIVATION DATE. The
   activation date is stored as registeredAt, which is exactly the
   field the account-gate uses for the 1-year expiry - so the admin
   controls when the account was "activated" (and when it expires).

   The Admin SDK (server side) sets emailVerified + the user doc, so
   no client-side security rule is relaxed. Requires firebase-functions
   compat (already loaded for roster import) + an admin session.
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function addYear(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }

  function toggleStudentFields() {
    var role = $('daRole') ? $('daRole').value : 'student';
    var box = $('daStudentFields');
    if (box) box.style.display = (role === 'student') ? '' : 'none';
  }
  function updateExpiryHint() {
    var a = $('daActivation') && $('daActivation').value;
    var h = $('daExpiryHint');
    if (h) h.textContent = a ? ('Account will expire on ' + addYear(a)) : '';
  }

  function row(k, v) {
    return '<tr><td style="padding:3px 14px 3px 0;color:var(--t2-text-muted,#7d8590);white-space:nowrap;">' + k +
      '</td><td style="padding:3px 0;">' + v + '</td></tr>';
  }
  function errBox(msg) {
    return '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:12px 14px;font-size:13px;color:#fca5a5;">' + esc(msg) + '</div>';
  }
  function okBox(d, payload) {
    var pw = d.generatedPassword || payload.password || '(the password you typed)';
    var expiry = d.registeredAt ? addYear(String(d.registeredAt).slice(0, 10)) : '';
    return '<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.4);border-radius:10px;padding:14px 16px;">' +
      '<div style="font-weight:800;color:#22c55e;margin-bottom:8px;">' + (d.existed ? '♻️ Existing account refreshed' : '✅ Account created') + '</div>' +
      '<table style="font-size:13px;color:var(--t2-text,#e6edf3);border-collapse:collapse;">' +
      row('Email', esc(d.email)) +
      row('Password', '<code style="background:var(--t2-bg,#0d1117);padding:2px 6px;border-radius:5px;">' + esc(pw) + '</code>') +
      row('Role', esc(d.role)) +
      (expiry ? row('Expires', esc(expiry)) : '') +
      '</table>' +
      '<div style="font-size:11px;color:var(--t2-text-muted,#7d8590);margin-top:10px;">They can log in now at <strong>' + esc(location.origin) + '</strong>. Email is already verified.</div>' +
      '</div>';
  }

  function create() {
    var btn = $('daCreateBtn'), res = $('daResult');
    if (!btn || !res) return;
    var role = $('daRole').value;
    var payload = {
      role: role,
      name: ($('daName').value || '').trim(),
      email: ($('daEmail').value || '').trim(),
      password: ($('daPassword').value || '').trim(),
      activationDate: ($('daActivation').value || '').trim()
    };
    if (role === 'student') {
      payload.level = $('daLevel').value;
      payload.studentClass = ($('daClass').value || '').trim();
      payload.module = ($('daModule').value || '').trim();
      payload.academicYear = ($('daYear').value || '').trim();
      payload.book = 'empower';
    }
    if (!payload.name || !payload.email) { res.innerHTML = errBox('Name and email are required.'); return; }
    if (typeof firebase === 'undefined' || !firebase.functions) { res.innerHTML = errBox('Cloud Functions not available on this page.'); return; }

    btn.disabled = true;
    var oldLabel = btn.textContent;
    btn.textContent = 'Creating...';
    res.innerHTML = '<div style="font-size:13px;color:var(--t2-text-muted,#7d8590);">Working...</div>';

    firebase.functions().httpsCallable('createDemoAccount')(payload)
      .then(function (r) {
        var d = (r && r.data) || {};
        res.innerHTML = okBox(d, payload);
        loadList();   // refresh the list below with the new account
      })
      .catch(function (e) {
        res.innerHTML = errBox((e && e.message) || 'Could not create the account.');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = oldLabel;
      });
  }

  // ── Existing-accounts list (demoAccount:true) ────────────────
  function fmtDate(iso) { return iso ? String(iso).slice(0, 10) : '-'; }
  function expiryOf(regIso) { return regIso ? addYear(String(regIso).slice(0, 10)) : ''; }
  function isExpired(regIso) { var e = expiryOf(regIso); return !!e && (new Date(e).getTime() < Date.now()); }

  function renderList(accounts) {
    var box = $('daList'), cnt = $('daListCount');
    if (!box) return;
    if (cnt) cnt.textContent = accounts.length ? ('(' + accounts.length + ')') : '';
    if (!accounts.length) {
      box.innerHTML = '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);">No demo accounts yet. Create one above.</div>';
      return;
    }
    box.innerHTML = accounts.map(function (a) {
      var exp = expiryOf(a.registeredAt);
      var expired = isExpired(a.registeredAt);
      var expLabel = exp ? (expired ? '<span style="color:#f87171;">expired ' + esc(exp) + '</span>' : esc(exp)) : '-';
      var meta = (a.role === 'student') ? (esc(a.level || '') + (a.studentClass ? ' &middot; ' + esc(a.studentClass) : '')) : 'teacher';
      return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 11px;border:1px solid var(--t2-border,#30363d);border-radius:9px;margin-bottom:6px;' + (expired ? 'background:rgba(248,113,113,0.05);' : '') + '">' +
        '<div style="flex:1;min-width:180px;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--t2-text,#e6edf3);overflow:hidden;text-overflow:ellipsis;">' + esc(a.email) + '</div>' +
          '<div style="font-size:11px;color:var(--t2-text-muted,#7d8590);margin-top:1px;">' + (a.role === 'teacher' ? '👩‍🏫 ' : '🎓 ') + meta + ' &middot; activated ' + fmtDate(a.registeredAt) + ' &middot; expires ' + expLabel + '</div>' +
        '</div>' +
        '<button type="button" class="da-del" data-uid="' + esc(a.uid) + '" data-email="' + esc(a.email) + '" ' +
          'style="cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(248,113,113,0.5);background:rgba(248,113,113,0.08);color:#f87171;">Delete</button>' +
      '</div>';
    }).join('');
    box.querySelectorAll('.da-del').forEach(function (b) {
      b.addEventListener('click', function () { delAccount(b.getAttribute('data-uid'), b.getAttribute('data-email')); });
    });
  }

  function loadList() {
    var box = $('daList');
    if (!box) return;
    if (typeof firebase === 'undefined' || !firebase.functions) { box.innerHTML = errBox('Cloud Functions not available.'); return; }
    if (!(firebase.auth && firebase.auth().currentUser)) { box.innerHTML = '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);">Waiting for sign-in - press Refresh.</div>'; return; }
    box.innerHTML = '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);">Loading...</div>';
    firebase.functions().httpsCallable('listDemoAccounts')({})
      .then(function (r) { var d = (r && r.data) || {}; renderList(d.accounts || []); })
      .catch(function (e) { box.innerHTML = errBox((e && e.message) || 'Could not load the list.'); });
  }

  function delAccount(uid, email) {
    if (!uid) return;
    function go() {
      firebase.functions().httpsCallable('deleteDemoAccount')({ uid: uid })
        .then(function () { loadList(); })
        .catch(function (e) {
          var box = $('daList');
          if (box) box.insertAdjacentHTML('afterbegin', errBox((e && e.message) || 'Delete failed.'));
        });
    }
    var msg = 'Delete the demo account ' + email + '? This permanently removes the login.';
    if (window.AppDialog && AppDialog.confirm) {
      AppDialog.confirm(msg, { title: 'Delete demo account', okLabel: 'Delete', danger: true }).then(function (okd) { if (okd) go(); });
    } else if (window.confirm(msg)) { go(); }
  }

  function init() {
    if (!$('daCreateBtn')) return;
    if ($('daActivation') && !$('daActivation').value) $('daActivation').value = todayISO();
    toggleStudentFields();
    updateExpiryHint();
    $('daRole').addEventListener('change', toggleStudentFields);
    $('daActivation').addEventListener('change', updateExpiryHint);
    $('daCreateBtn').addEventListener('click', create);
    if ($('daRefreshBtn')) $('daRefreshBtn').addEventListener('click', loadList);
    // Lazy-load the list the first time the admin opens this sub-tab.
    var subTab = document.querySelector('#adminSubNav .admin-subtab[data-target="demoAccountPanel"]');
    var loadedOnce = false;
    if (subTab) subTab.addEventListener('click', function () { if (!loadedOnce) { loadedOnce = true; setTimeout(loadList, 120); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
