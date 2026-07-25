/* ============================================================
   PLACEMENT TEST - teacher panel (#tab-placement)
   ------------------------------------------------------------
   ACCESS MODES:
     - admin  (ADMIN_EMAIL)                  -> full management, ALL results
     - manage (settings/placementAccess uid) -> full config, but results
       are limited to the teacher's assignedClasses
     - reports (teacher WITH assignedClasses)-> READ-ONLY results of
       their classes only. Teachers without classes never see the tab.
   The ON/OFF switch lives in Admin > Features
   (featureToggles.placement); grants live in Admin > Access.
   Every result row opens a DETAIL view (same spirit as the
   reading exam results): section scores + the student's writing.
   Writing routing - REDIRECT ONLY, no review UI of its own:
     - AI mode     -> Writing AI corrector page (localStorage llwPrefill)
     - manual mode -> the SAME grading screen as writing assignments
       (openWritingEssay on the {uid}_placement writingSubmissions doc
       that placement.js files at submit time).
   Recommendation only - never writes student profiles.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function db_() { return (typeof db !== 'undefined') ? db : (window.firebase && firebase.firestore ? firebase.firestore() : null); }
  function students0() { return (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : []; }
  var ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';
  function me() { return (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : (window.firebase && firebase.auth && firebase.auth().currentUser) || null; }
  function isAdminUser(u) { return !!u && String(u.email || '').toLowerCase() === ADMIN_EMAIL; }

  var LEVELS = ['A2', 'B1', 'B1+', 'B2'];
  var MODULES = ['Module 1', 'Module 2', 'Module 3', 'Module 4'];
  var YEARS = ['2025-2026', '2026-2027', '2027-2028'];

  var cfg = { scope: { classes: [], levels: [], modules: [], years: [] }, readingExamId: 'auto', listeningExamId: 'auto', writingMode: 'manual', writingPrompt: '' };
  var results = [];
  var loaded = false, loading = false;
  var mode = 'reports';       // 'admin' | 'manage' | 'reports'
  var myClasses = [];         // reports mode: the teacher's assignedClasses

  function canManage() { return mode === 'admin' || mode === 'manage'; }

  // ── Tab visibility + mode ───────────────────────────────────
  // Admin: always. Granted teachers: manage view. Other teachers:
  // reports view, and ONLY when they actually have assignedClasses -
  // a teacher with no classes has nothing to report on.
  function revealTab(user) {
    var d = db_(); if (!d || !user) return;
    var show = function () { var b = document.querySelector('.t2-nav-item[data-tab="placement"]'); if (b) b.style.display = ''; };
    if (isAdminUser(user)) { mode = 'admin'; show(); if (loaded) render(); return; }
    Promise.all([
      d.collection('settings').doc('placementAccess').get(),
      d.collection('users').doc(user.uid).get()
    ]).then(function (res) {
      var a = res[0].exists ? (res[0].data() || {}) : {};
      var granted = (Array.isArray(a.teacherUids) ? a.teacherUids : []).indexOf(user.uid) !== -1;
      var u = res[1].exists ? (res[1].data() || {}) : {};
      var classes = (Array.isArray(u.assignedClasses) ? u.assignedClasses : []).filter(Boolean);
      if (granted) { mode = 'manage'; show(); if (loaded) render(); return; }
      if (classes.length) show();
    }).catch(function () {});
  }

  function load() {
    if (loading) return; loading = true;
    var d = db_(); if (!d) { renderError('Firestore not ready.'); loading = false; return; }
    var u = me();
    Promise.all([
      d.collection('settings').doc('placementConfig').get(),
      d.collection('placementResults').get(),
      u ? d.collection('users').doc(u.uid).get() : Promise.resolve(null)
    ]).then(function (res) {
      var c = res[0].exists ? (res[0].data() || {}) : {};
      var s = c.scope || {};
      ['classes', 'levels', 'modules', 'years'].forEach(function (k) { cfg.scope[k] = Array.isArray(s[k]) ? s[k] : []; });
      cfg.readingExamId = c.readingExamId || 'auto';
      cfg.listeningExamId = c.listeningExamId || 'auto';
      cfg.writingMode = c.writingMode || 'manual';
      cfg.writingPrompt = c.writingPrompt || '';
      results = res[1].docs.map(function (doc) { var r = doc.data() || {}; r._id = doc.id; return r; })
        .sort(function (a, b) { return (b.at && b.at.seconds || 0) - (a.at && a.at.seconds || 0); });
      var mine = res[2] && res[2].exists ? (res[2].data() || {}) : {};
      myClasses = (Array.isArray(mine.assignedClasses) ? mine.assignedClasses : []).map(function (x) { return String(x).trim(); }).filter(Boolean);
      loaded = true; loading = false;
      render();
    }).catch(function (e) { loading = false; renderError((e && e.message) || 'Could not load.'); });
  }

  function saveCfg() {
    var d = db_(); if (!d) return;
    var u = me();
    d.collection('settings').doc('placementConfig').set({
      scope: cfg.scope, readingExamId: cfg.readingExamId, listeningExamId: cfg.listeningExamId,
      writingMode: cfg.writingMode, writingPrompt: cfg.writingPrompt,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: u ? u.uid : ''
    }, { merge: true }).then(function () {
      var n = $('plSaveNote'); if (n) { n.textContent = 'Saved.'; setTimeout(function () { n.textContent = ''; }, 2500); }
    }).catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not save: ' + e.message); });
  }
  function classList() {
    var set = {};
    students0().forEach(function (s) { if (s && s.studentClass) set[s.studentClass] = 1; });
    return Object.keys(set).sort();
  }
  // Unified-dropdown targeting: pick a value from the .ll-select to ADD it;
  // selected values appear beside it with an x to remove. None selected = all.
  function chipGroup(label, group, all) {
    var sel = cfg.scope[group];
    var remaining = all.filter(function (v) { return sel.indexOf(v) === -1; });
    var dd = '<select class="ll-select pl-scope-add" data-group="' + esc(group) + '" style="min-width:170px;">' +
      '<option value="">Add ' + esc(label.toLowerCase()) + '...</option>' +
      remaining.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('') +
      '</select>';
    var picked = sel.map(function (v) {
      return '<span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;border:1px solid var(--accent-primary,#3b82f6);background:rgba(59,130,246,0.14);color:var(--accent-primary,#3b82f6);border-radius:999px;padding:6px 12px;">' + esc(v) +
        '<button type="button" class="pl-scope-del" data-group="' + esc(group) + '" data-val="' + esc(v) + '" style="cursor:pointer;border:none;background:none;color:#f87171;font-weight:800;font-size:14px;line-height:1;padding:0;">&times;</button></span>';
    }).join('');
    return '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:var(--text-muted,#94a3b8);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">' + esc(label) +
      ' <span style="font-weight:500;text-transform:none;letter-spacing:0;">(none selected = all)</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' + dd + picked + '</div></div>';
  }

  // Unified dropdowns (.ll-select) for exam picks + writing mode.
  function examOptions(skill, current) {
    var REG = window.EXAM_REGISTRY;
    var html = '<option value="auto"' + (current === 'auto' ? ' selected' : '') + '>Auto - match the student’s ladder level</option>';
    if (REG) REG.levelsFor(skill).forEach(function (lvl) {
      (REG.examsForLevel(skill, lvl) || []).forEach(function (e) {
        if (e.available === false) return;
        html += '<option value="' + esc(e.id) + '"' + (current === e.id ? ' selected' : '') + '>' + esc(lvl + ' - ' + e.title) + '</option>';
      });
    });
    return html;
  }
  function lbl(t) { return '<label style="display:block;font-size:12px;font-weight:700;color:var(--text-muted,#94a3b8);margin:0 0 4px;">' + t + '</label>'; }
  function contentBlock() {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">' +
      '<div style="min-width:260px;flex:1;">' + lbl('Reading exam') + '<select id="plReadingSel" class="ll-select" style="width:100%;">' + examOptions('reading', cfg.readingExamId) + '</select></div>' +
      '<div style="min-width:260px;flex:1;">' + lbl('Listening exam') + '<select id="plListeningSel" class="ll-select" style="width:100%;">' + examOptions('listening', cfg.listeningExamId) + '</select></div>' +
      '<div style="min-width:220px;">' + lbl('Writing') + '<select id="plWritingSel" class="ll-select" style="width:100%;">' +
        '<option value="manual"' + (cfg.writingMode === 'manual' ? ' selected' : '') + '>On - manual review</option>' +
        '<option value="ai"' + (cfg.writingMode === 'ai' ? ' selected' : '') + '>On - AI-assisted review</option>' +
        '<option value="off"' + (cfg.writingMode === 'off' ? ' selected' : '') + '>Off</option>' +
      '</select></div></div>' +
      '<div>' + lbl('Writing prompt (blank = default)') +
      '<input type="text" id="plWritingPromptInp" class="ll-select" style="width:100%;cursor:text;" value="' + esc(cfg.writingPrompt) + '" placeholder="Some people prefer studying alone, others in groups. Which do you prefer, and why?"></div>' +
      '<div style="font-size:11.5px;color:var(--text-muted,#94a3b8);margin-top:8px;">Language questions come from the app&rsquo;s own grammar bank and vocabulary lists (nothing is auto-written) and climb the CEFR ladder (A2 &gt; B1 &gt; B1+ &gt; B2). Essays are saved with the result; open a result&rsquo;s Details to review the writing.</div>';
  }

  function fmtDate(ts) {
    if (!ts || !ts.seconds) return '';
    var d = new Date(ts.seconds * 1000);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function pct(x) { return (x && x.total) ? Math.round((x.correct / x.total) * 100) + '%' : '-'; }

  function renderError(msg) {
    var box = $('placementBody');
    if (box) box.innerHTML = '<div style="font-size:13px;color:#f87171;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:12px 14px;">' + esc(msg) + '</div>';
  }

  // Only the ADMIN sees every result; all other teachers (granted or
  // not) see just their own classes.
  function visibleResults() {
    if (mode === 'admin') return results;
    return results.filter(function (r) { return myClasses.indexOf(String(r.studentClass || '').trim()) !== -1; });
  }

  // ── Result DETAIL (scores + writing), same spirit as the reading
  //    exam's result screen: big total, then one row per section. ──
  function ensureDetailModal() {
    if ($('plDetailModal')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div id="plDetailModal" class="modal-overlay">' +
        '<div class="modal-box" style="max-width:900px;width:94vw;max-height:92vh;overflow-y:auto;padding:22px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
            '<h3 id="plDetailTitle" style="margin:0;font-size:1.08em;">Placement result</h3>' +
            '<button type="button" class="modal-btn modal-btn-cancel" id="plDetailClose" style="padding:6px 14px;">Close</button>' +
          '</div>' +
          '<div id="plDetailBody" style="margin-top:14px;"></div>' +
        '</div>' +
      '</div>');
    $('plDetailClose').addEventListener('click', closeDetail);
    $('plDetailModal').addEventListener('click', function (e) { if (e.target === $('plDetailModal')) closeDetail(); });
  }
  function closeDetail() {
    var m = $('plDetailModal');
    if (m) m.classList.remove('active');
  }
  function scoreColor(p) { return p >= 70 ? '#22c55e' : p >= 50 ? '#f59e0b' : '#fbbf24'; }
  function detailRow(tag, title, correct, total) {
    var p = total ? Math.round((correct / total) * 100) : 0;
    return '<div style="display:flex;align-items:center;gap:12px;border:1px solid var(--border-color,rgba(255,255,255,0.12));border-radius:12px;padding:10px 14px;">' +
      '<span style="min-width:40px;text-align:center;font-weight:800;font-size:11.5px;color:var(--accent-primary,#3b82f6);border:1px solid rgba(59,130,246,0.4);border-radius:8px;padding:4px 6px;">' + esc(tag) + '</span>' +
      '<span style="flex:1;font-weight:600;font-size:13.5px;">' + esc(title) + '</span>' +
      '<span style="font-weight:800;font-size:13.5px;color:' + scoreColor(p) + ';">' + correct + '/' + total + ' &middot; ' + p + '%</span>' +
      '</div>';
  }
  // Hand the essay to the Writing AI corrector: same-origin localStorage
  // prefill that lingualab-write/js/corrector.js consumes on load.
  function openInCorrector(r) {
    try {
      localStorage.setItem('llwPrefill', JSON.stringify({
        essay: (r.writing && r.writing.text) || '',
        task: (r.writing && r.writing.prompt) || '',
        student: r.name || '',
        from: 'placement',
        at: Date.now()
      }));
    } catch (_) {}
    window.open('lingualab-write/index.html', '_blank', 'noopener');
  }
  // Manual review = the SAME grading screen as writing assignments,
  // opened on the {uid}_placement writingSubmissions doc that
  // placement.js filed when the student submitted.
  function openManualGrading(r) {
    var d = db_(); if (!d) return;
    var sid = r._id + '_placement';
    d.collection('writingSubmissions').doc(sid).get().then(function (s) {
      if (!s.exists || typeof window.openWritingEssay !== 'function') {
        var msg = !s.exists
          ? 'No grading copy exists for this attempt (it was taken before manual grading was wired). Reset the attempt if it must be re-done.'
          : 'The grading screen is not available on this page.';
        if (window.AppDialog && AppDialog.alert) AppDialog.alert(msg); else alert(msg);
        return;
      }
      closeDetail();
      window.openWritingEssay(sid, 'placement');
    }).catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not open the grading screen: ' + e.message); });
  }
  function openDetail(uid) {
    var r = results.find(function (x) { return x._id === uid; });
    if (!r) return;
    ensureDetailModal();
    var s = r.sectionScores || {};
    var rungs = Array.isArray(r.rungs) ? r.rungs : [];

    var c = 0, t = 0;
    rungs.forEach(function (x) { c += Number(x.correct) || 0; t += Number(x.total) || 0; });
    [s.reading, s.listening].forEach(function (x) { if (x && x.total) { c += Number(x.correct) || 0; t += Number(x.total) || 0; } });
    var p = t ? Math.round((c / t) * 100) : 0;

    var head =
      '<div style="text-align:center;border:1px solid var(--border-color,rgba(255,255,255,0.12));border-radius:14px;padding:18px;margin-bottom:14px;">' +
        '<div style="font-size:30px;font-weight:800;color:' + scoreColor(p) + ';">' + c + ' / ' + t + '</div>' +
        '<div style="font-size:15px;font-weight:700;color:var(--text-muted,#94a3b8);margin-top:2px;">' + p + '% overall</div>' +
        '<div style="margin-top:8px;font-size:13px;">Recommended level: <span style="font-weight:800;color:var(--accent-primary,#3b82f6);font-size:15px;">' + esc(r.recommendedLevel || '?') + '</span></div>' +
      '</div>';

    var rows = '';
    rungs.forEach(function (x) { rows += detailRow(x.band, 'Language - level ' + x.band, Number(x.correct) || 0, Number(x.total) || 0); });
    if (s.grammar && s.grammar.total) rows += detailRow('GR', 'Grammar (all levels)', Number(s.grammar.correct) || 0, Number(s.grammar.total) || 0);
    if (s.vocab && s.vocab.total) rows += detailRow('VO', 'Vocabulary (all levels)', Number(s.vocab.correct) || 0, Number(s.vocab.total) || 0);
    if (s.reading && s.reading.total) rows += detailRow('RD', 'Reading exam', Number(s.reading.correct) || 0, Number(s.reading.total) || 0);
    if (s.listening && s.listening.total) rows += detailRow('LI', 'Listening exam', Number(s.listening.correct) || 0, Number(s.listening.total) || 0);
    rows = '<div style="display:flex;flex-direction:column;gap:8px;">' + rows + '</div>';

    // Writing: SHOW the essay + one redirect button. No review UI here -
    // correcting happens on the existing pages (Writing AI / assignment
    // grading screen), per the teacher's explicit instruction.
    var writing = '';
    if (r.writing && r.writing.text) {
      var isAi = r.writing.mode === 'ai';
      writing =
        '<div style="margin-top:18px;border:1px solid var(--border-color,rgba(255,255,255,0.12));border-radius:14px;padding:16px;">' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">' +
            '<span style="font-size:13px;font-weight:800;">Writing (' + (Number(r.writing.words) || 0) + ' words)</span>' +
            '<span style="font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;border:1px solid ' + (isAi ? 'rgba(167,139,250,0.5);color:#a78bfa;' : 'rgba(59,130,246,0.5);color:var(--accent-primary,#3b82f6);') + '">' + (isAi ? 'AI-assisted review' : 'Manual review') + '</span>' +
            (isAi
              ? '<button type="button" id="plRevAiBtn" style="cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:800;padding:7px 14px;border-radius:9px;border:none;background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;">Open in Writing AI &rarr;</button>'
              : '<button type="button" id="plRevManualBtn" style="cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:800;padding:7px 14px;border-radius:9px;border:none;background:var(--accent-primary,#3b82f6);color:#fff;">Open manual grading &rarr;</button>') +
          '</div>' +
          (r.writing.prompt ? '<div style="font-size:12.5px;color:var(--text-muted,#94a3b8);font-style:italic;margin-bottom:8px;">Prompt: ' + esc(r.writing.prompt) + '</div>' : '') +
          '<div style="white-space:pre-wrap;line-height:1.7;font-family:Georgia,\'Times New Roman\',serif;font-size:14.5px;background:rgba(255,255,255,0.03);border:1px solid var(--border-color,rgba(255,255,255,0.1));border-radius:10px;padding:14px 16px;max-height:320px;overflow-y:auto;">' + esc(r.writing.text) + '</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted,#94a3b8);margin-top:8px;">' +
            (isAi ? 'Correcting happens on the Writing AI page - the essay and prompt load automatically.'
                  : 'Grading happens on the same screen as writing assignments (scores, comment, inline annotations).') +
          '</div>' +
        '</div>';
    } else {
      writing = '<div style="margin-top:16px;font-size:13px;color:var(--text-muted,#94a3b8);">No writing was submitted for this attempt.</div>';
    }

    $('plDetailTitle').textContent = (r.name || r._id) + (r.studentClass ? ' (' + r.studentClass + ')' : '') + (r.at && r.at.seconds ? ' - ' + fmtDate(r.at) : '');
    $('plDetailBody').innerHTML = head + rows + writing;
    if ($('plRevAiBtn')) $('plRevAiBtn').addEventListener('click', function () { openInCorrector(r); });
    if ($('plRevManualBtn')) $('plRevManualBtn').addEventListener('click', function () { openManualGrading(r); });
    $('plDetailModal').classList.add('active');
  }

  function render() {
    var box = $('placementBody'); if (!box) return;
    if (!loaded) { load(); return; }

    var vis = visibleResults();

    var head;
    if (canManage()) {
      head = '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px;">' +
        '<span style="font-size:13px;color:var(--text-muted,#94a3b8);">On/off lives in <b>Admin &rsaquo; Features</b>; teacher grants live in <b>Admin &rsaquo; Access</b>. Every change here saves instantly. One attempt each; Reset allows a retake. Results are recommendations only.' +
        (mode === 'manage' ? ' Results below show <b>only your classes</b>.' : '') + '</span>' +
        '<span id="plSaveNote" style="font-size:12.5px;color:#16a34a;"></span></div>';
    } else {
      head = '<div style="font-size:13px;color:var(--text-muted,#94a3b8);margin-bottom:10px;">Placement reports for your classes' +
        (myClasses.length ? ' (<b>' + myClasses.map(esc).join('</b>, <b>') + '</b>)' : '') +
        '. Results are recommendations only; the test itself is managed by the admin.</div>';
    }

    var rows;
    if (!vis.length) {
      rows = '<div style="font-size:13px;color:var(--text-muted,#94a3b8);padding:10px 0;">' +
        (mode === 'admin' ? 'No results yet.'
          : myClasses.length ? 'No results for your classes yet.'
          : 'No classes are assigned to your account, so no results can be shown. Ask the admin to set your classes.') +
        '</div>';
    } else {
      var headers = ['Student', 'Class', 'Date', 'Grammar', 'Vocab', 'Reading', 'Listening', 'Writing', 'Recommended', ''];
      rows = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr>' + headers.map(function (h) {
          return '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid var(--border-color,rgba(255,255,255,0.12));color:var(--text-muted,#94a3b8);font-size:11.5px;text-transform:uppercase;letter-spacing:0.04em;">' + h + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        vis.map(function (r) {
          var s = r.sectionScores || {};
          var td = 'padding:8px 10px;border-bottom:1px solid var(--border-color,rgba(255,255,255,0.08));';
          return '<tr>' +
            '<td style="' + td + 'font-weight:600;">' + esc(r.name || r._id) + '</td>' +
            '<td style="' + td + '">' + esc(r.studentClass || '') + '</td>' +
            '<td style="' + td + 'white-space:nowrap;">' + fmtDate(r.at) + '</td>' +
            '<td style="' + td + '">' + pct(s.grammar) + '</td>' +
            '<td style="' + td + '">' + pct(s.vocab) + '</td>' +
            '<td style="' + td + '">' + pct(s.reading) + '</td>' +
            '<td style="' + td + '">' + pct(s.listening) + '</td>' +
            '<td style="' + td + '">' + (r.writing && r.writing.text ? (Number(r.writing.words) || '?') + 'w' : '-') + '</td>' +
            '<td style="' + td + '"><span style="font-weight:800;color:var(--accent-primary,#3b82f6);">' + esc(r.recommendedLevel || '?') + '</span></td>' +
            '<td style="' + td + 'white-space:nowrap;">' +
              '<button type="button" class="pl-detail" data-uid="' + esc(r._id) + '" style="cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:5px 12px;border-radius:8px;border:1px solid var(--border-color,rgba(255,255,255,0.2));background:transparent;color:var(--text-primary,#f8fafc);">Details</button>' +
              (canManage() ? ' <button type="button" class="pl-reset" data-uid="' + esc(r._id) + '" data-name="' + esc(r.name || '') + '" style="cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:5px 12px;border-radius:8px;border:1px solid rgba(248,113,113,0.5);background:rgba(248,113,113,0.08);color:#f87171;">Reset</button>' : '') +
            '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    box.innerHTML = head +
      (canManage()
        ? '<div style="border:1px solid var(--border-color,rgba(255,255,255,0.12));border-radius:12px;padding:16px;margin-bottom:18px;">' +
          '<div style="font-size:13px;font-weight:800;margin-bottom:10px;">Test content</div>' + contentBlock() + '</div>' +
          '<div style="border:1px solid var(--border-color,rgba(255,255,255,0.12));border-radius:12px;padding:16px;margin-bottom:18px;">' +
          '<div style="font-size:13px;font-weight:800;margin-bottom:10px;">Who sees the tile</div>' +
          (chipGroup('Classes', 'classes', classList()) + chipGroup('Levels', 'levels', LEVELS) + chipGroup('Modules', 'modules', MODULES) + chipGroup('Academic years', 'years', YEARS)) +
          '</div>'
        : '') +
      '<div style="font-size:13px;font-weight:800;margin-bottom:8px;">Results (' + vis.length + ')</div>' + rows;

    // AUTOSAVE: every management control persists the moment it changes.
    ['plReadingSel', 'plListeningSel', 'plWritingSel'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () {
        cfg.readingExamId = ($('plReadingSel') && $('plReadingSel').value) || 'auto';
        cfg.listeningExamId = ($('plListeningSel') && $('plListeningSel').value) || 'auto';
        cfg.writingMode = ($('plWritingSel') && $('plWritingSel').value) || 'manual';
        saveCfg();
      });
    });
    if ($('plWritingPromptInp')) $('plWritingPromptInp').addEventListener('change', function () {
      cfg.writingPrompt = $('plWritingPromptInp').value.trim();
      saveCfg();
    });
    box.querySelectorAll('.pl-scope-add').forEach(function (s) {
      s.addEventListener('change', function () {
        if (!s.value) return;
        var arr = cfg.scope[s.getAttribute('data-group')];
        if (arr.indexOf(s.value) === -1) arr.push(s.value);
        saveCfg();
        render();
      });
    });
    box.querySelectorAll('.pl-scope-del').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.getAttribute('data-group'), v = b.getAttribute('data-val');
        cfg.scope[g] = cfg.scope[g].filter(function (x) { return x !== v; });
        saveCfg();
        render();
      });
    });
    box.querySelectorAll('.pl-detail').forEach(function (b) {
      b.addEventListener('click', function () { openDetail(b.getAttribute('data-uid')); });
    });
    box.querySelectorAll('.pl-reset').forEach(function (b) {
      b.addEventListener('click', function () {
        var uid = b.getAttribute('data-uid'), nm = b.getAttribute('data-name') || 'this student';
        var doDelete = function () {
          db_().collection('placementResults').doc(uid).delete()
            .then(function () { results = results.filter(function (r) { return r._id !== uid; }); render(); })
            .catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not reset: ' + e.message); });
          // Also clear the manual-grading copy so a retake starts clean.
          // (Delete is admin-gated in rules; harmless if it stays.)
          db_().collection('writingSubmissions').doc(uid + '_placement').delete().catch(function () {});
        };
        if (window.AppDialog && AppDialog.confirm) AppDialog.confirm('Reset the placement attempt for ' + nm + '?').then(function (ok) { if (ok) doDelete(); });
        else if (confirm('Reset placement attempt for ' + nm + '?')) doDelete();
      });
    });
  }

  function whenAuth(cb, tries) {
    tries = (tries == null) ? 40 : tries;
    var u = me();
    if (u) { cb(u); return; }
    if (tries <= 0) return;
    setTimeout(function () { whenAuth(cb, tries - 1); }, 400);
  }
  function init() {
    whenAuth(function (u) { revealTab(u); });
    var btn = document.querySelector('.t2-nav-item[data-tab="placement"]');
    var once = false;
    if (btn) btn.addEventListener('click', function () { if (!once) { once = true; setTimeout(render, 150); } });
    if (localStorage.getItem('teacherActiveTab') === 'placement') setTimeout(render, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
