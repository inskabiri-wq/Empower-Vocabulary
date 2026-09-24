/* ============================================================
   ACCESS - unified grants panel (#aiWritingPanel, admin only)
   ------------------------------------------------------------
   ONE home for every teacher/semi-admin permission, modular so
   new capabilities plug in as columns. Current capabilities:
     - Writing AI (use)          -> settings/aiWritingAccess.teacherUids
     - Writing AI Deep (+ cap)   -> settings/aiWritingAccess.deepUids/deepCaps
       (deepUsed is written server-side by analyzeWriting - read-only here)
     - Placement (manage tab)    -> settings/placementAccess.teacherUids
     - Courses (manage tab)      -> settings/coursesAccess.teacherUids
   Every change AUTOSAVES (no save button). Only granted teachers
   are listed; add via the unified .ll-select dropdown. The owner
   admin (ADMIN_EMAIL) implicitly has everything and is not listed.
   Servers/rules still enforce each grant independently.

   This file also keeps the corrector entry points working:
   the sidebar + more-menu "Writing AI" links are ALWAYS visible
   and click-gated (allowed -> open corrector; else themed popup).
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function db_() { return (typeof db !== 'undefined') ? db : (window.firebase && firebase.firestore ? firebase.firestore() : null); }
  var ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';

  var teachers = null;          // [{uid,name,email}]
  var ai = { teacherUids: [], deepUids: [], deepCaps: {}, deepUsed: {} };
  var pl = { teacherUids: [] };
  var co = { teacherUids: [] };
  var loading = false;

  // ── Corrector entry points (sidebar + more-menu) ─────────────
  function currentUser() {
    if (typeof auth !== 'undefined' && auth.currentUser) return auth.currentUser;
    if (window.firebase && firebase.auth && firebase.auth().currentUser) return firebase.auth().currentUser;
    return null;
  }
  function whenAuth(cb, tries) {
    tries = (tries == null) ? 40 : tries;
    var u = currentUser();
    if (u) { cb(u); return; }
    if (tries <= 0) { cb(null); return; }
    setTimeout(function () { whenAuth(cb, tries - 1); }, 400);
  }
  function hasAccess(user) {
    var d = db_();
    if (!d || !user) return Promise.resolve(false);
    if (String(user.email || '').toLowerCase() === ADMIN_EMAIL) return Promise.resolve(true);
    return d.collection('settings').doc('aiWritingAccess').get().then(function (snap) {
      var cfg = snap.exists ? (snap.data() || {}) : {};
      return (Array.isArray(cfg.teacherUids) ? cfg.teacherUids : []).indexOf(user.uid) !== -1;
    }).catch(function () { return false; });
  }
  function noAccessPopup() {
    var msg = 'You don’t have permission to use Writing AI yet. Ask your admin to enable it for your account.';
    if (window.AppDialog && AppDialog.alert) AppDialog.alert(msg); else alert(msg);
  }
  function gateNavClicks() {
    ['aiWritingNav', 'aiWritingMore'].forEach(function (id) {
      var a = $(id);
      if (!a) return;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        whenAuth(function (u) {
          hasAccess(u).then(function (ok) {
            if (ok) window.open(a.getAttribute('href') || 'lingualab-write/index.html', '_blank', 'noopener');
            else noAccessPopup();
          });
        }, 6);
      });
    });
  }

  // ── Data ─────────────────────────────────────────────────────
  function load() {
    if (loading) return;
    loading = true;
    var d = db_();
    if (!d) { renderError('Firestore not ready.'); loading = false; return; }
    Promise.all([
      d.collection('users').where('role', 'in', ['teacher', 'admin']).limit(1000).get(),
      d.collection('settings').doc('aiWritingAccess').get(),
      d.collection('settings').doc('placementAccess').get(),
      d.collection('settings').doc('coursesAccess').get()
    ]).then(function (res) {
      teachers = res[0].docs.map(function (doc) { var u = doc.data() || {}; return { uid: doc.id, name: u.name || u.email || doc.id, email: u.email || '' }; })
        .filter(function (t) { return String(t.email).toLowerCase() !== ADMIN_EMAIL; })
        .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      var a = res[1].exists ? (res[1].data() || {}) : {};
      ai.teacherUids = Array.isArray(a.teacherUids) ? a.teacherUids : [];
      ai.deepUids = Array.isArray(a.deepUids) ? a.deepUids : [];
      ai.deepCaps = a.deepCaps || {};
      ai.deepUsed = a.deepUsed || {};
      var p = res[2].exists ? (res[2].data() || {}) : {};
      pl.teacherUids = Array.isArray(p.teacherUids) ? p.teacherUids : [];
      var co0 = res[3] && res[3].exists ? (res[3].data() || {}) : {};
      co.teacherUids = Array.isArray(co0.teacherUids) ? co0.teacherUids : [];
      loading = false;
      render();
    }).catch(function (e) { loading = false; renderError((e && e.message) || 'Could not load teachers.'); });
  }
  function note(msg) {
    var n = $('accSaveNote');
    if (n) { n.textContent = msg; setTimeout(function () { if (n.textContent === msg) n.textContent = ''; }, 2200); }
  }
  function saveAi() {
    var d = db_(); if (!d) return;
    d.collection('settings').doc('aiWritingAccess').set({
      teacherUids: ai.teacherUids, deepUids: ai.deepUids, deepCaps: ai.deepCaps,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () { note('Saved.'); })
      .catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not save (admin only): ' + e.message); });
  }
  function savePl() {
    var d = db_(); if (!d) return;
    d.collection('settings').doc('placementAccess').set({
      teacherUids: pl.teacherUids,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () { note('Saved.'); })
      .catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not save (admin only): ' + e.message); });
  }

  function saveCo() {
    var d = db_(); if (!d) return;
    d.collection('settings').doc('coursesAccess').set({
      teacherUids: co.teacherUids,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () { note('Saved.'); })
      .catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not save (admin only): ' + e.message); });
  }

  // Audit trail: every grant/revoke is recorded (who did what to whom, when)
  // in /accessAudit and shown at the bottom of the panel.
  var audit = null;
  function logAudit(action, uid) {
    var d = db_(); if (!d) return;
    var t = null;
    (teachers || []).some(function (x) { if (x.uid === uid) { t = x; return true; } return false; });
    var me = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    d.collection('accessAudit').add({
      action: action, targetUid: uid, targetName: (t && t.name) || uid,
      by: (me && (me.email || me.uid)) || '',
      at: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function () {});
    audit = null;   // refetch on next render
  }
  function loadAudit() {
    var d = db_(); if (!d) return;
    d.collection('accessAudit').orderBy('at', 'desc').limit(15).get().then(function (snap) {
      audit = snap.docs.map(function (x) { return x.data(); });
      var box = $('accAuditBox');
      if (box) box.innerHTML = auditHtml();
    }).catch(function () { audit = []; });
  }
  function auditHtml() {
    if (!Array.isArray(audit)) { loadAudit(); return '<span style="color:var(--t2-text-muted,#7d8590);">Loading...</span>'; }
    if (!audit.length) return '<span style="color:var(--t2-text-muted,#7d8590);">No changes recorded yet.</span>';
    return audit.map(function (a) {
      // A just-written row has no server timestamp yet - show "just now"
      // instead of a bare dash.
      var when = (a.at && a.at.seconds)
        ? new Date(a.at.seconds * 1000).toLocaleString()
        : 'just now';
      var act = String(a.action || '');
      var revoked = /revok/i.test(act);
      var tint = revoked ? '#f87171' : 'var(--t2-green,#22c55e)';
      var bg = revoked ? 'rgba(248,113,113,0.10)' : 'rgba(34,197,94,0.10)';
      var bd = revoked ? 'rgba(248,113,113,0.35)' : 'rgba(34,197,94,0.35)';
      return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--t2-border,#30363d);border-radius:10px;margin-bottom:6px;">' +
        '<span style="font-size:12.5px;font-weight:700;padding:4px 11px;border-radius:999px;border:1px solid ' + bd + ';background:' + bg + ';color:' + tint + ';white-space:nowrap;">' + esc(act) + '</span>' +
        '<span style="flex:1;min-width:0;font-size:13.5px;color:var(--t2-text,#e6edf3);">for <b>' + esc(a.targetName || a.targetUid) + '</b></span>' +
        '<span style="font-size:12.5px;color:var(--t2-text-muted,#7d8590);white-space:nowrap;">' + esc(a.by || '?') + ' &middot; ' + esc(when) + '</span>' +
      '</div>';
    }).join('');
  }


  function grantedUids() {
    var set = {};
    ai.teacherUids.forEach(function (u) { set[u] = 1; });
    pl.teacherUids.forEach(function (u) { set[u] = 1; });
    // Someone granted ONLY Courses still has to appear in the list, or an
    // admin cannot see or revoke that grant.
    co.teacherUids.forEach(function (u) { set[u] = 1; });
    return Object.keys(set);
  }

  // ── Render ───────────────────────────────────────────────────
  function renderError(msg) {
    var box = $('aiWritingBody');
    if (box) box.innerHTML = '<div style="font-size:13px;color:#f87171;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:12px 14px;">' + esc(msg) + '</div>';
  }
  function render() {
    var box = $('aiWritingBody');
    if (!box) return;
    if (teachers === null) { load(); return; }

    var granted = grantedUids();
    var byUid = {};
    teachers.forEach(function (t) { byUid[t.uid] = t; });
    var notGranted = teachers.filter(function (t) { return granted.indexOf(t.uid) === -1; });

    var intro = '<div style="font-size:13px;color:var(--t2-text-muted,#7d8590);margin-bottom:14px;">One place for every permission. Add a teacher, then tick exactly what they may do - each tick saves instantly. Writing AI = the corrector; Deep = the minute-analysis tier (limit per teacher, blank = unlimited); Placement = may manage the Placement tab; Courses = may manage the mini courses. You (the admin) always have everything.'
      + ' <span id="accSaveNote" style="color:#16a34a;font-weight:700;"></span></div>';

    var addRow = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:16px;">' +
      '<div><label style="display:block;font-size:12px;font-weight:700;color:var(--t2-text-muted,#7d8590);margin-bottom:4px;">Add a teacher</label>' +
      '<select id="accAddSel" class="ll-select" style="min-width:250px;">' +
        (notGranted.length ? notGranted.map(function (t) { return '<option value="' + esc(t.uid) + '">' + esc(t.name) + (t.email ? ' (' + esc(t.email) + ')' : '') + '</option>'; }).join('') : '<option value="">Every teacher already has a grant</option>') +
      '</select></div>' +
      '<button type="button" id="accAddBtn" ' + (notGranted.length ? '' : 'disabled ') + 'style="cursor:pointer;font-family:inherit;font-weight:800;font-size:14px;padding:10px 18px;border-radius:10px;border:none;background:#2563eb;color:#fff;' + (notGranted.length ? '' : 'opacity:.5;cursor:default;') + '">+ Add</button>' +
      '</div>';

    var rows;
    if (!granted.length) {
      rows = '<div style="font-size:13px;color:var(--t2-text-muted,#7d8590);">No teacher has any grant yet. Add one above.</div>';
    } else {
      var th = function (t) { return '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid var(--t2-border,#30363d);color:var(--t2-text-muted,#7d8590);font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">' + t + '</th>'; };
      var td = 'padding:9px 10px;border-bottom:1px solid var(--t2-border,#30363d);font-size:13.5px;';
      rows = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr>' + th('Teacher') + th('Writing AI') + th('Deep') + th('Deep limit') + th('Deep used') + th('Placement') + th('Courses') + th('') + '</tr></thead><tbody>' +
        granted.map(function (uid) {
          var t = byUid[uid] || { uid: uid, name: uid, email: '' };
          var useOn = ai.teacherUids.indexOf(uid) !== -1;
          var deepOn = ai.deepUids.indexOf(uid) !== -1;
          var cap = ai.deepCaps[uid] || '';
          var used = ai.deepUsed[uid] || 0;
          var plOn = pl.teacherUids.indexOf(uid) !== -1;
          var coOn = co.teacherUids.indexOf(uid) !== -1;
          var overCap = cap && used >= cap;
          return '<tr>' +
            '<td style="' + td + '"><b>' + esc(t.name) + '</b>' + (t.email ? '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);">' + esc(t.email) + '</div>' : '') + '</td>' +
            '<td style="' + td + '"><input type="checkbox" class="acc-use" data-uid="' + esc(uid) + '"' + (useOn ? ' checked' : '') + '></td>' +
            '<td style="' + td + '"><input type="checkbox" class="acc-deep" data-uid="' + esc(uid) + '"' + (deepOn ? ' checked' : '') + (useOn ? '' : ' disabled') + '></td>' +
            '<td style="' + td + '"><input type="number" min="0" class="acc-cap" data-uid="' + esc(uid) + '" value="' + esc(cap) + '" placeholder="unlimited"' + (deepOn ? '' : ' disabled') + ' style="width:88px;font-family:inherit;font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid var(--t2-border,#30363d);background:transparent;color:var(--t2-text,#e6edf3);"></td>' +
            '<td style="' + td + (overCap ? 'color:#f87171;font-weight:700;' : '') + '">' + used + (cap ? ' / ' + cap : '') + '</td>' +
            '<td style="' + td + '"><input type="checkbox" class="acc-pl" data-uid="' + esc(uid) + '"' + (plOn ? ' checked' : '') + '></td>' +
            '<td style="' + td + '"><input type="checkbox" class="acc-co" data-uid="' + esc(uid) + '"' + (coOn ? ' checked' : '') + '></td>' +
            '<td style="' + td + '"><button type="button" class="acc-revoke" data-uid="' + esc(uid) + '" style="cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(248,113,113,0.5);background:rgba(248,113,113,0.08);color:#f87171;">Revoke all</button></td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    // Audit trail: who changed what, for whom, when (last 15).
    var auditBlock = '<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--t2-border,#30363d);">' +
      '<div style="font-size:13px;font-weight:800;margin-bottom:8px;">Recent access changes</div>' +
      '<div id="accAuditBox" style="font-size:12.5px;color:var(--t2-text,#e6edf3);">' + auditHtml() + '</div></div>';

    box.innerHTML = intro + addRow + rows + auditBlock;

    if ($('accAddBtn')) $('accAddBtn').addEventListener('click', function () {
      var s = $('accAddSel'); if (!s || !s.value) return;
      if (ai.teacherUids.indexOf(s.value) === -1) ai.teacherUids.push(s.value);   // default grant: Writing AI use
      logAudit('granted Writing AI', s.value);
      saveAi(); render();
    });
    box.querySelectorAll('.acc-use').forEach(function (c) {
      c.addEventListener('change', function () {
        var uid = c.getAttribute('data-uid');
        if (c.checked) { if (ai.teacherUids.indexOf(uid) === -1) ai.teacherUids.push(uid); }
        else {
          ai.teacherUids = ai.teacherUids.filter(function (u) { return u !== uid; });
          ai.deepUids = ai.deepUids.filter(function (u) { return u !== uid; });   // Deep requires Use
        }
        logAudit((c.checked ? 'granted' : 'revoked') + ' Writing AI', uid);
        saveAi(); render();
      });
    });
    box.querySelectorAll('.acc-deep').forEach(function (c) {
      c.addEventListener('change', function () {
        var uid = c.getAttribute('data-uid');
        if (c.checked) { if (ai.deepUids.indexOf(uid) === -1) ai.deepUids.push(uid); }
        else ai.deepUids = ai.deepUids.filter(function (u) { return u !== uid; });
        logAudit((c.checked ? 'granted' : 'revoked') + ' Deep', uid);
        saveAi(); render();
      });
    });
    box.querySelectorAll('.acc-cap').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var uid = inp.getAttribute('data-uid');
        var v = parseInt(inp.value, 10);
        if (v > 0) ai.deepCaps[uid] = v; else delete ai.deepCaps[uid];
        logAudit('set Deep limit to ' + (v > 0 ? v : 'unlimited'), uid);
        saveAi();
      });
    });
    box.querySelectorAll('.acc-pl').forEach(function (c) {
      c.addEventListener('change', function () {
        var uid = c.getAttribute('data-uid');
        if (c.checked) { if (pl.teacherUids.indexOf(uid) === -1) pl.teacherUids.push(uid); }
        else pl.teacherUids = pl.teacherUids.filter(function (u) { return u !== uid; });
        logAudit((c.checked ? 'granted' : 'revoked') + ' Placement', uid);
        savePl(); render();
      });
    });
    box.querySelectorAll('.acc-co').forEach(function (c) {
      c.addEventListener('change', function () {
        var uid = c.getAttribute('data-uid');
        if (c.checked) { if (co.teacherUids.indexOf(uid) === -1) co.teacherUids.push(uid); }
        else co.teacherUids = co.teacherUids.filter(function (u) { return u !== uid; });
        logAudit((c.checked ? 'granted' : 'revoked') + ' Courses', uid);
        saveCo(); render();
      });
    });
    box.querySelectorAll('.acc-revoke').forEach(function (b) {
      b.addEventListener('click', function () {
        var uid = b.getAttribute('data-uid');
        var doIt = function () {
          ai.teacherUids = ai.teacherUids.filter(function (u) { return u !== uid; });
          ai.deepUids = ai.deepUids.filter(function (u) { return u !== uid; });
          delete ai.deepCaps[uid];
          pl.teacherUids = pl.teacherUids.filter(function (u) { return u !== uid; });
          // "Revoke all" has to mean ALL. A capability added later that is not
          // cleared here leaves a teacher holding something after an admin has
          // deliberately taken everything away, which is the worst way to keep
          // a permission.
          co.teacherUids = co.teacherUids.filter(function (u) { return u !== uid; });
          logAudit('revoked ALL grants', uid);
          saveAi(); savePl(); saveCo(); render();
        };
        if (window.AppDialog && AppDialog.confirm) AppDialog.confirm('Remove ALL grants for this teacher?').then(function (ok) { if (ok) doIt(); });
        else if (confirm('Remove all grants for this teacher?')) doIt();
      });
    });
  }

  function init() {
    gateNavClicks();
    if (!$('aiWritingBody')) return;
    var subTab = document.querySelector('#adminSubNav .admin-subtab[data-target="aiWritingPanel"]');
    var once = false;
    if (subTab) subTab.addEventListener('click', function () { if (!once) { once = true; setTimeout(render, 120); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
