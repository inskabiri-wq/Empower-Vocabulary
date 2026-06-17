/* ============================================================
   ORGANIZATIONS - admin panel (#tab-admin)
   ------------------------------------------------------------
   Manage which email domains may register and which may host
   teacher accounts. Stored in settings/organizations as:
     { list: [{ name, domain, active, teacherEligible }],
       activeDomains: [...], teacherEligibleDomains: [...] }
   The sign-up gate (org-registry.js) reads this live. Writes are
   admin-only (general /settings rule). FSM domains are protected
   (can't be removed) because org-registry + the rules grandfather
   them in regardless.
   ============================================================ */
(function () {
  'use strict';

  var orgs = [];   // [{ name, domain, active, teacherEligible }]
  var FSM = ['fsm.edu.tr', 'stu.fsm.edu.tr'];   // protected fallback domains

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function deriveAndSave() {
    var u = (typeof auth !== 'undefined' && auth.currentUser) || null;
    if (!u) return Promise.resolve();
    var clean = orgs.filter(function (o) { return o.domain; });
    return db.collection('settings').doc('organizations').set({
      list: clean,
      activeDomains: clean.filter(function (o) { return o.active !== false; }).map(function (o) { return o.domain; }),
      teacherEligibleDomains: clean.filter(function (o) { return o.active !== false && o.teacherEligible === true; }).map(function (o) { return o.domain; }),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: u.uid
    }, { merge: true }).catch(function (e) {
      console.error('organizations save', e);
      if (typeof AppDialog !== 'undefined') AppDialog.alert('Could not save (admin only): ' + e.message);
    });
  }

  function toggleBtn(kind, i, on, onLabel, offLabel) {
    return '<button type="button" class="org-toggle" data-kind="' + kind + '" data-i="' + i + '" ' +
      'style="cursor:pointer; font-family:inherit; font-size:12px; font-weight:700; border-radius:20px; padding:5px 12px; white-space:nowrap; ' +
      'border:1px solid ' + (on ? 'var(--t2-green,#22c55e)' : 'var(--t2-border,#30363d)') + '; ' +
      'background:' + (on ? 'rgba(34,197,94,0.12)' : 'transparent') + '; ' +
      'color:' + (on ? 'var(--t2-green,#22c55e)' : 'var(--t2-text-muted,#7d8590)') + ';">' + (on ? onLabel : offLabel) + '</button>';
  }

  function row(o, i) {
    var locked = FSM.indexOf(String(o.domain).toLowerCase()) !== -1;
    return '<div style="display:flex; align-items:center; gap:10px; padding:12px 14px; background:var(--t2-surface,#161b22); border:1px solid var(--t2-border,#30363d); border-radius:12px; margin-bottom:10px; flex-wrap:wrap;">' +
      '<div style="flex:1; min-width:150px;">' +
        '<div style="font-weight:800; font-size:14px; color:var(--t2-text,#e6edf3);">' + esc(o.name || o.domain) + '</div>' +
        '<div style="font-size:12px; color:var(--t2-text-muted,#7d8590);">@' + esc(o.domain) + (locked ? ' &middot; FSM (protected)' : '') + '</div>' +
      '</div>' +
      toggleBtn('active', i, o.active !== false, 'Active', 'Inactive') +
      toggleBtn('teacher', i, o.teacherEligible === true, 'Can host teachers', 'Students only') +
      (locked ? '' : '<button type="button" class="org-del" data-i="' + i + '" style="cursor:pointer; font-family:inherit; font-size:12px; font-weight:600; color:#f87171; background:transparent; border:1px solid rgba(248,113,113,0.4); border-radius:20px; padding:5px 12px;">Remove</button>') +
    '</div>';
  }

  function addForm() {
    return '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:6px; padding:14px; background:rgba(59,130,246,0.06); border:1px dashed var(--t2-border,#30363d); border-radius:12px;">' +
      '<input id="orgNewName" type="text" placeholder="Organization name" autocomplete="off" style="flex:1 1 170px; padding:8px 10px; border-radius:8px; border:1px solid var(--t2-border,#30363d); background:var(--t2-bg,#0d1117); color:var(--t2-text,#e6edf3); font-size:13px;">' +
      '<input id="orgNewDomain" type="text" placeholder="email domain e.g. school.edu.tr" autocomplete="off" style="flex:1 1 180px; padding:8px 10px; border-radius:8px; border:1px solid var(--t2-border,#30363d); background:var(--t2-bg,#0d1117); color:var(--t2-text,#e6edf3); font-size:13px;">' +
      '<label style="font-size:12px; color:var(--t2-text-muted,#7d8590); display:flex; align-items:center; gap:5px;"><input type="checkbox" id="orgNewTeacher"> Can host teachers</label>' +
      '<button type="button" id="orgAddBtn" style="cursor:pointer; font-family:inherit; font-size:13px; font-weight:800; border-radius:8px; padding:8px 16px; border:none; background:#3b82f6; color:#fff;">Add organization</button>' +
    '</div>';
  }

  function render() {
    var box = $('orgAdminBody');
    if (!box) return;
    var rows = orgs.length ? orgs.map(row).join('') : '<p style="color:var(--t2-text-muted,#7d8590); font-size:12px;">No organizations yet. Add one below.</p>';
    box.innerHTML = rows + addForm();
    box.querySelectorAll('.org-toggle').forEach(function (b) { b.addEventListener('click', function () { toggle(b.getAttribute('data-kind'), parseInt(b.getAttribute('data-i'), 10)); }); });
    box.querySelectorAll('.org-del').forEach(function (b) { b.addEventListener('click', function () { removeOrg(parseInt(b.getAttribute('data-i'), 10)); }); });
    var addBtn = $('orgAddBtn');
    if (addBtn) addBtn.addEventListener('click', addOrg);
  }

  function toggle(kind, i) {
    var o = orgs[i];
    if (!o) return;
    if (kind === 'active') o.active = !(o.active !== false);
    else if (kind === 'teacher') o.teacherEligible = !(o.teacherEligible === true);
    deriveAndSave();
    render();
  }

  function removeOrg(i) {
    if (!orgs[i]) return;
    orgs.splice(i, 1);
    deriveAndSave();
    render();
  }

  function addOrg() {
    var name = (($('orgNewName') || {}).value || '');
    var domain = ((($('orgNewDomain') || {}).value || '').trim().toLowerCase()).replace(/^@/, '');
    var teacher = !!(($('orgNewTeacher') || {}).checked);
    if (!domain || domain.indexOf('.') === -1 || /\s/.test(domain)) {
      if (typeof AppDialog !== 'undefined') AppDialog.alert('Enter a valid email domain, e.g. school.edu.tr');
      return;
    }
    if (orgs.some(function (o) { return String(o.domain).toLowerCase() === domain; })) {
      if (typeof AppDialog !== 'undefined') AppDialog.alert('That domain is already in the list.');
      return;
    }
    orgs.push({ name: (name.trim() || domain), domain: domain, active: true, teacherEligible: teacher });
    deriveAndSave();
    render();
  }

  function load() {
    db.collection('settings').doc('organizations').get().then(function (snap) {
      var d = snap.exists ? (snap.data() || {}) : {};
      if (Array.isArray(d.list) && d.list.length) {
        orgs = d.list.filter(function (o) { return o && o.domain; }).map(function (o) {
          return { name: o.name || o.domain, domain: String(o.domain).toLowerCase(), active: o.active !== false, teacherEligible: o.teacherEligible === true };
        });
      } else if (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.FALLBACK && Array.isArray(window.OrgRegistry.FALLBACK.list)) {
        orgs = window.OrgRegistry.FALLBACK.list.map(function (o) {
          return { name: o.name, domain: o.domain, active: o.active !== false, teacherEligible: o.teacherEligible === true };
        });
      } else {
        orgs = [
          { name: 'FSM University (Staff)', domain: 'fsm.edu.tr', active: true, teacherEligible: true },
          { name: 'FSM University (Students)', domain: 'stu.fsm.edu.tr', active: true, teacherEligible: false }
        ];
      }
      render();
    }).catch(function (e) { console.warn('organizations load', e); render(); });
  }

  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 400); return; }
    if (!$('orgAdminBody')) return;
    var waitAuth = function () {
      if (auth.currentUser) { load(); return; }
      setTimeout(waitAuth, 500);
    };
    waitAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
