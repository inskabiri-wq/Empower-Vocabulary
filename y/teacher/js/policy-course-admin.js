/* ============================================================
   COURSES - teacher panel (Courses tab)
   ------------------------------------------------------------
   Self-contained: uses the dashboard's global `db` + `auth`, touches
   ONLY #policyCoursePanel + #courseActivateModal. Never interferes
   with the assignment pipeline.

   Activation scope is COMBINABLE (assignment-style ticks): any mix of
   classes + levels + modules + academic years. An empty section means
   no restriction on that dimension; all empty = everyone. Saved to
   settings/policyCourse:
     { active, scope: { classes, levels, modules, years },
       updatedAt, updatedBy }
   (course-target.js also honours older targetType/classes docs.)

   NOTE: the dashboard student list is a bare `let allStudents` global
   (config.js), NOT window.allStudents - always read it via typeof.
   ============================================================ */
(function () {
  'use strict';

  let cfg = null;          // settings/policyCourse data
  let bodyOpen = false;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const COURSE = window.POLICY_COURSE || { modules: [], config: {} };
  const BAN_MS = ((COURSE.config && COURSE.config.banHours) || 48) * 3600 * 1000;

  function studentList() {
    try { if (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) return allStudents; } catch (_) {}
    return [];
  }
  function distinctFromStudents(field) {
    const set = new Set();
    studentList().forEach(s => {
      const v = s && s[field] ? String(s[field]).trim() : '';
      if (v) set.add(v);
    });
    return [...set].sort();
  }

  // ── Status pill ────────────────────────────────────────────
  function scopeText(c) {
    if (!c || !c.active) return '';
    const s = (c.scope && typeof c.scope === 'object') ? c.scope : null;
    if (s) {
      const parts = [];
      if (Array.isArray(s.classes) && s.classes.length) parts.push('classes ' + s.classes.join(', '));
      if (Array.isArray(s.levels) && s.levels.length) parts.push('levels ' + s.levels.join(', '));
      if (Array.isArray(s.modules) && s.modules.length) parts.push(s.modules.join(', '));
      if (Array.isArray(s.years) && s.years.length) parts.push(s.years.join(', '));
      return parts.length ? parts.join(' + ') : 'everyone';
    }
    // Legacy docs
    if (Array.isArray(c.targets) && c.targets.length) return (c.targetType || 'class') + ': ' + c.targets.join(', ');
    if (Array.isArray(c.classes) && c.classes.length) return 'classes ' + c.classes.join(', ');
    return 'everyone';
  }

  function statusPill() {
    const el = $('pcAdminStatus');
    if (!el) return;
    if (!cfg || !cfg.active) {
      el.textContent = 'Not activated';
      el.style.background = 'rgba(148,163,184,0.15)';
      el.style.color = 'var(--text-muted, #94a3b8)';
    } else {
      el.textContent = 'Active for ' + scopeText(cfg);
      el.style.background = 'rgba(16,185,129,0.15)';
      el.style.color = '#34d399';
    }
    const btn = $('pcAdminToggleBtn');
    if (btn) {
      // Activation / deactivation is admin-only. Teachers still see the status
      // pill and their class's completions, but not the toggle. (Firestore
      // rules also reject non-admin writes to settings/policyCourse.)
      var admin = (typeof isAdmin === 'function') && isAdmin();
      btn.style.display = admin ? '' : 'none';
      btn.textContent = (cfg && cfg.active) ? 'Deactivate' : 'Activate';
    }
  }

  async function loadConfig() {
    try {
      const snap = await db.collection('settings').doc('policyCourse').get();
      cfg = snap.exists ? snap.data() : null;
    } catch (e) { console.warn('policyCourse cfg load', e); }
    statusPill();
  }

  // ── Activation modal (combinable ticks) ────────────────────
  // Levels and modules are a FIXED canonical set (matches the registration
  // dropdowns: A2/B1/B1+/B2 and Module 1-4). Reading them from the roster
  // would surface junk values (old demo accounts storing "1", "2"), so we
  // never do. Classes and academic years genuinely vary, so those come
  // from the roster (with a year fallback).
  const DIMS = [
    { id: 'caClasses', key: 'classes', opts: () => distinctFromStudents('studentClass') },
    { id: 'caLevels',  key: 'levels',  opts: () => ['A2', 'B1', 'B1+', 'B2'] },
    { id: 'caModules', key: 'modules', opts: () => ['Module 1', 'Module 2', 'Module 3', 'Module 4'] },
    { id: 'caYears',   key: 'years',   opts: () => { const v = distinctFromStudents('academicYear'); return v.length ? v : ['2025-2026']; } }
  ];

  function openActivateModal() {
    const modal = $('courseActivateModal');
    if (!modal) return;
    const pre = (cfg && cfg.scope && typeof cfg.scope === 'object') ? cfg.scope : {};
    DIMS.forEach(dim => {
      const box = $(dim.id);
      if (!box) return;
      const opts = dim.opts();
      const checked = Array.isArray(pre[dim.key]) ? pre[dim.key] : [];
      box.innerHTML = opts.length
        ? opts.map(v => `<label class="student-checkbox-item">
            <input type="checkbox" class="ca-tick" data-dim="${dim.key}" value="${esc(v)}" ${checked.indexOf(v) >= 0 ? 'checked' : ''}>
            <span class="student-checkbox-name">${esc(v)}</span>
          </label>`).join('')
        : '<p style="color:var(--text-muted,#94a3b8); margin:4px; font-size:0.85em;">No values found in the roster yet.</p>';
    });
    modal.querySelectorAll('.ca-tick').forEach(cb => cb.addEventListener('change', updateScopeSummary));
    updateScopeSummary();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  window.closeCourseActivateModal = function () {
    const modal = $('courseActivateModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  };
  function collectScope() {
    const scope = { classes: [], levels: [], modules: [], years: [] };
    document.querySelectorAll('.ca-tick:checked').forEach(cb => {
      const k = cb.getAttribute('data-dim');
      if (scope[k]) scope[k].push(cb.value);
    });
    return scope;
  }
  function updateScopeSummary() {
    const el = $('caScopeSummary');
    if (!el) return;
    el.textContent = 'Will activate for: ' + scopeText({ active: true, scope: collectScope() });
  }
  async function saveActivation() {
    const u = (typeof auth !== 'undefined' && auth.currentUser) || null;
    if (!u) return;
    const scope = collectScope();
    try {
      await db.collection('settings').doc('policyCourse').set({
        active: true,
        scope: scope,
        // Clear legacy fields so old readers can't disagree with scope.
        targetType: firebase.firestore.FieldValue.delete(),
        targets: firebase.firestore.FieldValue.delete(),
        classes: firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: u.uid
      }, { merge: true });
    } catch (e) {
      console.error('activate course', e);
      if (typeof AppDialog !== 'undefined') AppDialog.alert('Could not save: ' + e.message);
      return;
    }
    window.closeCourseActivateModal();
    await loadConfig();
  }

  async function toggleActive() {
    const u = (typeof auth !== 'undefined' && auth.currentUser) || null;
    if (!u) return;
    if (cfg && cfg.active) {
      const ok = (typeof AppDialog !== 'undefined' && AppDialog.confirm)
        ? await AppDialog.confirm('Deactivate the course? Students keep their progress but it disappears from their dashboards.')
        : true;
      if (!ok) return;
      await db.collection('settings').doc('policyCourse').set({
        active: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: u.uid
      }, { merge: true });
      await loadConfig();
      return;
    }
    openActivateModal();
  }

  // ── Completion table ───────────────────────────────────────
  function studentStatus(p) {
    if (p.certificate && p.certificate.certId) return ['🎓 Certified', '#34d399'];
    const tests = [];
    COURSE.modules.forEach(m => tests.push([(m.title && m.title.en) || m.id, (p.modules || {})[m.id] || {}]));
    tests.push(['Final', p.finalExam || {}]);
    for (const [label, t] of tests) {
      const fails = t.fails || 0;
      if (!t.passed && fails >= 2 && t.lastFailAt && typeof t.lastFailAt.toMillis === 'function' &&
          t.lastFailAt.toMillis() + BAN_MS > Date.now()) {
        return ['⛔ Banned (' + label.split(' ·')[0] + ')', '#f87171'];
      }
    }
    for (const [, t] of tests) {
      if (!t.passed && t.restudy) return ['📖 Restudying', '#fbbf24'];
    }
    return ['▶ In progress', 'var(--text-muted, #94a3b8)'];
  }

  async function loadCompletions() {
    const body = $('pcAdminBody');
    if (bodyOpen) { body.style.display = 'none'; bodyOpen = false; return; }
    bodyOpen = true;
    body.style.display = '';
    body.innerHTML = '<p style="color:var(--text-muted,#94a3b8); padding:10px 2px;">Loading completions...</p>';
    let rows = [];
    try {
      const snap = await db.collection('courseProgress').limit(500).get();
      snap.forEach(d => { const r = d.data(); r._uid = d.id; rows.push(r); });
    } catch (e) {
      console.error('courseProgress load', e);
      body.innerHTML = '<p style="color:#f87171; padding:10px 2px;">Could not load completions: ' + esc(e.message) + '</p>';
      return;
    }
    // Scope to the teacher's own students. Admin sees everyone; a teacher only
    // sees completions for students in their (already class-scoped) roster, so
    // the summary counts and the table reflect just their class.
    if (!(typeof isAdmin === 'function' && isAdmin())) {
      const mine = new Set(studentList().map(s => s.id));
      rows = rows.filter(r => mine.has(r._uid));
    }
    const totalMods = COURSE.modules.length;
    rows.sort((a, b) => String(a.userName || '').localeCompare(String(b.userName || '')));
    const startedCount = rows.length;
    const certified = rows.filter(r => r.certificate && r.certificate.certId).length;
    const roster = studentList();
    const summary = `${certified} certified · ${startedCount} started` +
      (roster.length ? ` · ${Math.max(0, roster.length - startedCount)} not started` : '');

    if (!rows.length) {
      body.innerHTML = `<p style="color:var(--text-muted,#94a3b8); padding:10px 2px;">${esc(summary)}. No student has started the course yet.</p>`;
      return;
    }
    body.innerHTML = `
      <p style="color:var(--text-muted,#94a3b8); margin:6px 2px 10px; font-weight:700;">${esc(summary)}</p>
      <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:0.88em;">
        <thead><tr>
          ${['Student', 'Class', 'Modules', 'Final', 'Certificate', 'Status'].map(h =>
            `<th style="text-align:left; padding:8px 10px; border-bottom:1px solid var(--border-color, rgba(59,130,246,0.25)); color:var(--text-muted,#94a3b8); font-size:0.85em; text-transform:uppercase; letter-spacing:0.05em;">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.map(p => {
            const passedMods = COURSE.modules.filter(m => ((p.modules || {})[m.id] || {}).passed).length;
            const fin = p.finalExam || {};
            const cert = p.certificate || {};
            const certDate = (cert.earnedAt && typeof cert.earnedAt.toDate === 'function') ? cert.earnedAt.toDate().toLocaleDateString() : '';
            const [stat, color] = studentStatus(p);
            return `<tr>
              <td style="padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.12); font-weight:700;">${esc(p.userName || '?')}</td>
              <td style="padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.12);">${esc(p.studentClass || '-')}</td>
              <td style="padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.12);">${passedMods} / ${totalMods}</td>
              <td style="padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.12);">${fin.passed ? '✅ ' + (fin.score || 0) + '/' + (fin.total || 0) : '-'}</td>
              <td style="padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.12);">${cert.certId ? esc(cert.certId) + (certDate ? ' · ' + esc(certDate) : '') : '-'}</td>
              <td style="padding:8px 10px; border-bottom:1px solid rgba(148,163,184,0.12); font-weight:800; color:${color};">${stat}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;
  }

  // ── Fact-check a certificate (by code + name) ──────────────
  // Tolerant name compare: trim, collapse spaces, Turkish-aware lower.
  function normName(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr'); }

  async function verifyCertificate() {
    const out = $('pcVerifyResult');
    if (!out) return;
    const code = String(($('pcVerifyCode') || {}).value || '').trim().toUpperCase();
    const typedName = String(($('pcVerifyName') || {}).value || '').trim();
    if (!code) { out.innerHTML = '<span style="color:#fbbf24;">Enter the certificate code printed on the document.</span>'; return; }
    out.innerHTML = '<span style="color:var(--text-muted,#94a3b8);">Checking...</span>';

    let rec = null;
    try {
      const snap = await db.collection('certificates').doc(code).get();
      if (snap.exists) rec = snap.data();
    } catch (e) { console.warn('cert verify get', e); }
    // Fallback: scan courseProgress for certs issued before the
    // /certificates collection existed (or if that write failed).
    if (!rec) {
      try {
        const qs = await db.collection('courseProgress').limit(500).get();
        qs.forEach(d => {
          if (rec) return;
          const p = d.data();
          if (p.certificate && String(p.certificate.certId || '').toUpperCase() === code) {
            rec = { name: p.certificate.name || p.userName, score: p.certificate.score,
                    total: p.certificate.total, earnedAt: p.certificate.earnedAt,
                    courseName: 'AI Use Guidelines' };
          }
        });
      } catch (e) { console.warn('cert verify scan', e); }
    }

    if (!rec) {
      out.innerHTML = '<div style="padding:10px 12px; border-radius:8px; background:rgba(248,113,113,0.12); color:#f87171; font-weight:700;">✗ No certificate found with code <strong>' + esc(code) + '</strong>. It was not issued here.</div>';
      return;
    }
    const when = (rec.earnedAt && typeof rec.earnedAt.toDate === 'function') ? rec.earnedAt.toDate().toLocaleDateString() : '';
    const details = esc(rec.name || '?') + ' · ' + esc(rec.courseName || 'AI Use Guidelines') +
      (when ? ' · ' + esc(when) : '') + (rec.score != null ? ' · ' + rec.score + '/' + rec.total : '');
    if (!typedName || normName(typedName) === normName(rec.name)) {
      out.innerHTML = '<div style="padding:10px 12px; border-radius:8px; background:rgba(16,185,129,0.12); color:#34d399; font-weight:700;">✓ Genuine certificate.<div style="font-weight:600; color:var(--text-primary,#e6edf3); margin-top:4px;">' + details + '</div></div>';
    } else {
      out.innerHTML = '<div style="padding:10px 12px; border-radius:8px; background:rgba(251,191,36,0.12); color:#fbbf24; font-weight:700;">⚠ This code is real, but it was issued to a different name. The name on the document may have been altered.<div style="font-weight:600; color:var(--text-primary,#e6edf3); margin-top:4px;">On record: ' + details + '</div><div style="margin-top:2px; color:var(--text-muted,#94a3b8);">You typed: ' + esc(typedName) + '</div></div>';
    }
  }

  // ── Boot ───────────────────────────────────────────────────
  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 400); return; }
    const tBtn = $('pcAdminToggleBtn');
    const cBtn = $('pcAdminCompletionsBtn');
    if (!tBtn || !cBtn) return;
    tBtn.addEventListener('click', toggleActive);
    cBtn.addEventListener('click', loadCompletions);
    const vBtn = $('pcVerifyBtn');
    if (vBtn) vBtn.addEventListener('click', verifyCertificate);
    const vCode = $('pcVerifyCode');
    if (vCode) vCode.addEventListener('keydown', e => { if (e.key === 'Enter') verifyCertificate(); });
    const vName = $('pcVerifyName');
    if (vName) vName.addEventListener('keydown', e => { if (e.key === 'Enter') verifyCertificate(); });
    const saveBtn = $('caSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveActivation);
    const waitAuth = () => {
      if (auth.currentUser) { loadConfig(); return; }
      setTimeout(waitAuth, 500);
    };
    waitAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
