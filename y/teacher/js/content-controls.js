/* ============================================================
   CONTENT CONTROLS - admin panel (#tab-admin)
   ------------------------------------------------------------
   Every content item (reading + listening exams, grammar topics,
   vocabulary word-lists) has per-item THREE-SCOPE visibility. Each
   item has independent toggles for where it appears:
     - Practice     (student free-practice)
     - Classroom    (live classroom games)
     - Assignments  (teacher assignment pickers)
   Browsed by LEVEL tabs.

   Stored in settings/contentControls:
     { practiceHidden:    { reading:[examId], listening:[examId],
                            grammar:[topicId], vocabulary:[unitId] },
       classroomHidden:   { reading:[], listening:[], grammar:[], vocabulary:[] },
       assignmentsHidden: { reading:[], listening:[], grammar:[], vocabulary:[] },
       hiddenLevels:      { reading:[lvl], ... } }
   Vocabulary unit ids are level-qualified ("A2::Unit 1").

   Writes are admin-only (general /settings rule). Enforcement:
   practice via content-controls-student.js; classroom via
   cc-classroom.js (games) + classroom-teacher picker (exams);
   assignments via exam-form.js + grammar-form.js + the vocab
   unit gating in teacher-assignments.js.
   ============================================================ */
(function () {
  'use strict';

  var cfg = {
    practiceHidden: { reading: [], listening: [], grammar: [], vocabulary: [] },
    classroomHidden: { reading: [], listening: [], grammar: [], vocabulary: [] },
    assignmentsHidden: { reading: [], listening: [], grammar: [], vocabulary: [] },
    hiddenLevels: { reading: [], listening: [], grammar: [], vocabulary: [] }
  };
  var activeLevel = null;
  var activeSkill = 'all';   // 'all' | 'reading' | 'listening' | 'grammar'
  var LEVEL_ORDER = ['A1', 'A2', 'B1', 'B1+', 'B2', 'C1'];
  // Vocabulary units are read lazily from the shared dataset (same file the
  // student dashboard loads). Cache shape: { A2:['Unit 1', ...], ... }.
  var vocabUnits = null;
  var vocabLoading = false;
  var SKILL_TABS = [
    { id: 'all', label: 'All' },
    { id: 'vocabulary', label: '📚 Vocabulary' },
    { id: 'reading', label: '📖 Reading' },
    { id: 'listening', label: '🎧 Listening' },
    { id: 'grammar', label: '✏️ Grammar' },
    // Mini courses get their own tab (next to Grammar): the course on/off AND
    // its per-module toggles live here - the single home for every
    // activate/deactivate control. Future courses appear as more blocks.
    { id: 'courses', label: '🎓 Mini courses' },
    // Placement sits beside Mini courses because it is the same kind of
    // decision as the rest of this panel: which content a student meets.
    // The panel body is rendered by teacher/js/placement-admin.js into
    // #placementContentMount, so the two files stay independent.
    { id: 'placement', label: '🎯 Placement' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function GP() { return window.GRAMMAR_PRACTICE || null; }
  function unitNo(blurb) { var m = String(blurb || '').match(/Units?\s+(\d+)/i); return m ? m[1] : '?'; }

  function hiddenSet(skill) {
    if (!cfg.practiceHidden || !Array.isArray(cfg.practiceHidden[skill])) return [];
    return cfg.practiceHidden[skill];
  }
  function isHidden(skill, id) { return hiddenSet(skill).indexOf(id) !== -1; }

  // Three-scope helpers (reading/listening exams only). scope is one of
  // 'practice' | 'classroom' | 'assignments', mapping to the cfg key.
  var SCOPES = [
    { id: 'practice', key: 'practiceHidden', label: 'Practice' },
    { id: 'classroom', key: 'classroomHidden', label: 'Classroom' },
    { id: 'assignments', key: 'assignmentsHidden', label: 'Assignments' }
  ];
  function scopeKey(scope) {
    for (var i = 0; i < SCOPES.length; i++) if (SCOPES[i].id === scope) return SCOPES[i].key;
    return 'practiceHidden';
  }
  function isScopeHidden(scope, skill, id) {
    var map = cfg[scopeKey(scope)] || {};
    return Array.isArray(map[skill]) && map[skill].indexOf(id) !== -1;
  }

  function allLevels() {
    var set = {};
    if (typeof window.EXAM_REGISTRY !== 'undefined') {
      window.EXAM_REGISTRY.levelsFor('reading').forEach(function (l) { set[l] = 1; });
      window.EXAM_REGISTRY.levelsFor('listening').forEach(function (l) { set[l] = 1; });
    }
    var g = GP();
    if (g && Array.isArray(g.levels)) g.levels.forEach(function (l) { set[l] = 1; });
    // Vocab levels always appear as tabs (so C1 shows even before any
    // reading/listening/grammar content exists for it).
    VOCAB_LEVELS.forEach(function (l) { set[l] = 1; });
    var out = LEVEL_ORDER.filter(function (l) { return set[l]; });
    Object.keys(set).forEach(function (l) { if (out.indexOf(l) === -1) out.push(l); });
    return out;
  }

  function section(title, inner) {
    return '<div style="background:var(--t2-surface,#161b22); border:1px solid var(--t2-border,#30363d); border-radius:12px; padding:16px 18px; margin-bottom:16px;">' +
      '<div style="font-weight:800; font-size:15px; color:var(--t2-text,#e6edf3); margin-bottom:10px;">' + title + '</div>' + inner + '</div>';
  }

  function toggleRow(skill, id, label) {
    var hidden = isHidden(skill, id);
    return '<div class="cc-row" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid ' +
        (hidden ? 'rgba(59,130,246,0.5)' : 'var(--t2-border,#30363d)') + '; border-radius:8px; margin-bottom:6px; ' +
        (hidden ? 'background:rgba(59,130,246,0.06);' : '') + '">' +
      '<div style="flex:1; min-width:0;">' +
        '<div style="font-size:14px; color:var(--t2-text,#e6edf3); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(label) + '</div>' +
        '<div style="font-size:12px; font-weight:600; margin-top:1px; color:' + (hidden ? '#3b82f6' : 'var(--t2-green,#22c55e)') + ';">' +
          (hidden ? 'Hidden from practice · assignment-only' : 'In practice') + '</div>' +
      '</div>' +
      '<button type="button" class="cc-toggle" data-skill="' + skill + '" data-id="' + esc(id) + '" ' +
        'style="cursor:pointer; font-family:inherit; font-size:13px; font-weight:500; color:var(--t2-text-muted,#7d8590); background:transparent; border:1px solid var(--t2-border,#30363d); border-radius:20px; padding:5px 14px; white-space:nowrap;">' +
        (hidden ? 'Show in practice' : 'Hide from practice') + '</button>' +
    '</div>';
  }

  function scrollWrap(rows) { return '<div style="max-height:340px; overflow:auto; padding-right:6px;">' + rows + '</div>'; }

  // Reading/listening exam row: one pill per scope. Green = visible there,
  // amber = hidden there. Clicking a pill flips only that scope.
  function examScopeRow(skill, id, label) {
    var hiddenScopes = SCOPES.filter(function (s) { return isScopeHidden(s.id, skill, id); });
    var anyHidden = hiddenScopes.length > 0;
    var status = anyHidden
      ? 'Hidden from: ' + hiddenScopes.map(function (s) { return s.label.toLowerCase(); }).join(', ')
      : 'Visible everywhere';
    var pills = SCOPES.map(function (s) {
      var off = isScopeHidden(s.id, skill, id);
      return '<button type="button" class="cc-scope" data-scope="' + s.id + '" data-skill="' + skill + '" data-id="' + esc(id) + '" ' +
        'title="' + (off ? 'Show in ' : 'Hide from ') + s.label.toLowerCase() + '" ' +
        'style="cursor:pointer; font-family:inherit; font-size:12px; font-weight:700; padding:4px 11px; border-radius:14px; white-space:nowrap; ' +
        'border:1px solid ' + (off ? 'rgba(59,130,246,0.55)' : 'rgba(34,197,94,0.45)') + '; ' +
        'background:' + (off ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.08)') + '; ' +
        'color:' + (off ? '#3b82f6' : 'var(--t2-green,#22c55e)') + ';">' +
        (off ? '✕ ' : '✓ ') + s.label + '</button>';
    }).join('');
    return '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:8px 10px; border:1px solid ' +
        (anyHidden ? 'rgba(59,130,246,0.5)' : 'var(--t2-border,#30363d)') + '; border-radius:8px; margin-bottom:6px; ' +
        (anyHidden ? 'background:rgba(59,130,246,0.06);' : '') + '">' +
      '<div style="flex:1; min-width:180px;">' +
        '<div style="font-size:14px; color:var(--t2-text,#e6edf3); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(label) + '</div>' +
        '<div style="font-size:12px; font-weight:600; margin-top:1px; color:' + (anyHidden ? '#3b82f6' : 'var(--t2-green,#22c55e)') + ';">' + status + '</div>' +
      '</div>' +
      '<div style="display:flex; gap:6px; flex-wrap:wrap;">' + pills + '</div>' +
    '</div>';
  }

  // Whole-level on/off (deactivates every item of a skill at a level).
  function isLevelOff(skill, level) {
    var hl = cfg.hiddenLevels || {};
    return Array.isArray(hl[skill]) && hl[skill].indexOf(level) !== -1;
  }
  function levelToggle(skill, level) {
    var off = isLevelOff(skill, level);
    return '<button type="button" class="cc-level-toggle" data-skill="' + skill + '" data-level="' + esc(level) + '" ' +
      'style="cursor:pointer; font-family:inherit; font-size:12px; font-weight:800; padding:3px 12px; border-radius:14px; margin-left:8px; white-space:nowrap; ' +
      'border:1px solid ' + (off ? 'rgba(248,113,113,0.55)' : 'var(--t2-border,#30363d)') + '; ' +
      'background:' + (off ? 'rgba(248,113,113,0.14)' : 'transparent') + '; ' +
      'color:' + (off ? '#f87171' : 'var(--t2-text-muted,#7d8590)') + ';">' +
      (off ? 'Level OFF · activate' : 'Deactivate level') + '</button>';
  }
  function offBanner() {
    return '<div style="font-size:11.5px; color:#f87171; background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.3); border-radius:8px; padding:7px 10px; margin-bottom:8px;">Whole level deactivated for free practice (assignments still work).</div>';
  }

  // Lazily load the vocab dataset once, then re-render so unit toggles appear.
  // Same path config.js uses; teacher-dashboard.html sits at the app root.
  var VOCAB_LEVELS = ['A2', 'B1', 'B1+', 'B2', 'C1'];
  // Waits for the panel to actually appear, then loads. Armed at most once.
  //
  // A setTimeout poll, NOT an IntersectionObserver. IO is the obvious tool and
  // was the first implementation, but it cannot be verified in this project's
  // preview pane: the pane never composites, so IO never fires there, exactly
  // like requestAnimationFrame. Rather than ship a mechanism that cannot be
  // tested before it reaches a classroom, this uses a check that behaves the
  // same everywhere. It is one boolean per 500ms while the panel is closed,
  // and it stops for good the moment the panel opens.
  var vocabPoll = null;
  function loadVocabWhenVisible() {
    if (vocabPoll || vocabUnits || vocabLoading) return;
    var tick = function () {
      vocabPoll = null;
      if (vocabUnits || vocabLoading) return;
      var box = $('contentControlsBody');
      if (!box) return;                       // panel gone: stop polling
      if (box.offsetParent) {
        ensureVocabUnits();
        // Repaint too: the panel may have been drawn while hidden, showing
        // the "no units yet" state, and nothing else would refresh it.
        if (!vocabLoading && !vocabUnits) render();
        return;
      }
      vocabPoll = setTimeout(tick, 500);
    };
    vocabPoll = setTimeout(tick, 500);
  }

  function ensureVocabUnits() {
    if (vocabUnits || vocabLoading) return;
    // MEASURED: datasets.json is 689 KB raw, 106 KB gzipped, and it was fetched
    // on EVERY teacher dashboard load. The "lazily load" comment below was true
    // of the second fetch only: init() binds to DOMContentLoaded and renders
    // whatever tab is open, and render() calls this unconditionally, so the
    // panel never had to be opened. Teachers are on mobile data.
    //
    // Now it waits until the panel is actually on screen. Everything else in
    // the panel still renders immediately; only the per-unit vocabulary
    // toggles arrive a moment later, which is the same behaviour the fetch
    // always had.
    var box = $('contentControlsBody');
    if (box && !box.offsetParent) { loadVocabWhenVisible(); return; }
    vocabLoading = true;
    fetch('datasets.json').then(function (r) { return r.json(); }).then(function (d) {
      var out = {};
      VOCAB_LEVELS.forEach(function (lvl) {
        var words = Array.isArray(d[lvl]) ? d[lvl] : [];
        var units = [];
        words.forEach(function (w) { if (w && w.unit && units.indexOf(w.unit) === -1) units.push(w.unit); });
        units.sort(function (a, b) {
          return (parseInt(String(a).replace(/\D/g, ''), 10) || 0) - (parseInt(String(b).replace(/\D/g, ''), 10) || 0);
        });
        out[lvl] = units;
      });
      vocabUnits = out;
      vocabLoading = false;
      render();
    }).catch(function (e) { console.warn('vocab units load', e); vocabLoading = false; vocabUnits = {}; render(); });
  }

  // Vocabulary: whole-level on/off PLUS per-unit (word-list) toggles. A hidden
  // unit's words drop out of free practice everywhere (the student engine
  // filters them at its single pool chokepoint). Unit ids are level-qualified
  // ("A2::Unit 1") since unit names repeat across levels.
  function vocabBlock(level) {
    if (VOCAB_LEVELS.indexOf(level) === -1) return '';
    var off = isLevelOff('vocabulary', level);
    var title = '📚 Vocabulary &middot; ' + esc(level) + levelToggle('vocabulary', level);
    if (off) {
      return section(title, offBanner() +
        '<div style="font-size:12px; color:var(--t2-text-muted,#7d8590); padding:4px 2px;">Free vocabulary practice for ' + esc(level) + ' is OFF. Students can still do it when you assign it.</div>');
    }
    var units = vocabUnits ? (vocabUnits[level] || []) : null;
    var inner;
    if (units === null) {
      ensureVocabUnits();
      inner = '<div style="font-size:12px; color:var(--t2-text-muted,#7d8590); padding:4px 2px;">Loading word lists...</div>';
    } else if (!units.length) {
      inner = '<div style="font-size:12px; color:var(--t2-text-muted,#7d8590); padding:4px 2px;">No word lists found for ' + esc(level) + '.</div>';
    } else {
      var n = units.filter(function (u) {
        return SCOPES.some(function (s) { return isScopeHidden(s.id, 'vocabulary', level + '::' + u); });
      }).length;
      if (n) title += ' &middot; <span style="color:#3b82f6;">' + n + ' restricted</span>';
      var rows = units.map(function (u) { return examScopeRow('vocabulary', level + '::' + u, u); }).join('');
      inner = '<div style="font-size:12px; color:var(--t2-text-muted,#7d8590); padding:2px 2px 8px;">Toggle each word list per surface: Practice (free practice), Classroom (live games) and Assignments.</div>' + scrollWrap(rows);
    }
    return section(title, inner);
  }

  function examBlock(skill, icon, name, level) {
    if (typeof window.EXAM_REGISTRY === 'undefined') return '';
    var exams = (window.EXAM_REGISTRY.examsForLevel(skill, level) || []).filter(function (e) { return e.available !== false; });
    if (!exams.length) return '';
    var off = isLevelOff(skill, level);
    var n = exams.filter(function (e) {
      return SCOPES.some(function (s) { return isScopeHidden(s.id, skill, e.id); });
    }).length;
    var rows = exams.map(function (e) { return examScopeRow(skill, e.id, e.title || e.id); }).join('');
    var title = icon + ' ' + name + ' &middot; ' + esc(level) + (!off && n ? (' &middot; <span style="color:#3b82f6;">' + n + ' restricted</span>') : '') + levelToggle(skill, level);
    return section(title, (off ? offBanner() : '') + scrollWrap(rows));
  }

  function grammarBlock(level) {
    var g = GP();
    var topics = (g && g.byLevel && g.byLevel[level]) ? g.byLevel[level] : [];
    if (!topics.length) return '';
    var groups = {};
    topics.forEach(function (t) { var u = unitNo(t.blurb); (groups[u] = groups[u] || []).push(t); });
    var rows = '';
    Object.keys(groups).sort(function (a, b) { return (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0); }).forEach(function (u) {
      rows += '<div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--t2-text-muted,#7d8590); margin:10px 0 4px;">Unit ' + esc(u) + '</div>';
      groups[u].forEach(function (t) { rows += examScopeRow('grammar', t.id, t.title || t.id); });
    });
    var off = isLevelOff('grammar', level);
    var n = topics.filter(function (t) {
      return SCOPES.some(function (s) { return isScopeHidden(s.id, 'grammar', t.id); });
    }).length;
    var title = '✏️ Grammar topics &middot; ' + esc(level) + (!off && n ? (' &middot; <span style="color:#3b82f6;">' + n + ' restricted</span>') : '') + levelToggle('grammar', level);
    return section(title, (off ? offBanner() : '') + scrollWrap(rows));
  }

  // ── Mini course (policy course) activation ───────────────────
  // Moved here from the Courses tab so every activate/deactivate control has
  // ONE home. Targeting (who sees it) stays in the Courses tab.
  var pcCfg = null, pcLoading = false;
  function loadPcCfg() {
    if (pcLoading) return;
    pcLoading = true;
    db.collection('settings').doc('policyCourse').get().then(function (s) {
      pcCfg = s.exists ? (s.data() || {}) : {};
      render();
    }).catch(function () { pcCfg = {}; });
  }
  function courseBlock() {
    if (pcCfg === null) { loadPcCfg(); return ''; }
    var on = !!pcCfg.active;
    var head = '<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">' +
      '<span style="font-size:20px;">🎓</span>' +
      '<div style="flex:1; min-width:0;">' +
        '<div style="font-weight:800; font-size:15px; color:var(--t2-text,#e6edf3);">Mini course (policy / onboarding)</div>' +
        '<div style="font-size:12px; font-weight:600; margin-top:1px; color:' + (on ? 'var(--t2-green,#22c55e)' : '#3b82f6') + ';">' + (on ? 'Active - targeted students see it' : 'Deactivated - hidden from students') + '</div>' +
      '</div>' +
      '<button type="button" id="ccCourseToggle" style="cursor:pointer; font-family:inherit; font-size:13px; font-weight:700; padding:7px 16px; border-radius:20px; border:1px solid ' + (on ? 'rgba(248,113,113,0.5)' : 'var(--t2-green,#22c55e)') + '; background:transparent; color:' + (on ? '#f87171' : 'var(--t2-green,#22c55e)') + ';">' + (on ? 'Deactivate' : 'Activate') + '</button>' +
      '</div>';
    // Per-module toggles (moved here from the Courses tab). Deactivating a
    // module drops it from the course AND from certificate completion.
    var mods = (window.POLICY_COURSE && Array.isArray(window.POLICY_COURSE.modules)) ? window.POLICY_COURSE.modules : [];
    var hidden = Array.isArray(pcCfg.hiddenModules) ? pcCfg.hiddenModules : [];
    var rows = mods.map(function (m) {
      var off = hidden.indexOf(m.id) !== -1;
      var name = (m.title && (m.title.en || m.title)) || m.id;
      return '<div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid ' +
          (off ? 'rgba(248,113,113,0.5)' : 'var(--t2-border,#30363d)') + '; border-radius:8px; margin-bottom:6px; ' + (off ? 'background:rgba(248,113,113,0.06);' : '') + '">' +
        '<span style="font-size:18px;">' + esc(m.icon || '📘') + '</span>' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="font-size:14px; color:var(--t2-text,#e6edf3); font-weight:600;">' + esc(name) + '</div>' +
          '<div style="font-size:12px; font-weight:600; margin-top:1px; color:' + (off ? '#f87171' : 'var(--t2-green,#22c55e)') + ';">' + (off ? 'Deactivated' : 'Active') + '</div>' +
        '</div>' +
        '<button type="button" class="cc-course-mod" data-mid="' + esc(m.id) + '" style="cursor:pointer; font-family:inherit; font-size:13px; font-weight:600; color:var(--t2-text-muted,#7d8590); background:transparent; border:1px solid var(--t2-border,#30363d); border-radius:20px; padding:5px 14px;">' +
          (off ? 'Activate' : 'Deactivate') + '</button>' +
      '</div>';
    }).join('');
    var modBlock = mods.length
      ? '<div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--t2-text-muted,#7d8590); margin:6px 2px 8px;">Modules (deactivate to drop from the course + certificate)</div>' + rows
      : '';
    return section('🎓 Mini courses', head + modBlock);
  }
  function flipCourseModule(mid) {
    pcCfg = pcCfg || {};
    var arr = Array.isArray(pcCfg.hiddenModules) ? pcCfg.hiddenModules.slice() : [];
    var i = arr.indexOf(mid);
    if (i === -1) arr.push(mid); else arr.splice(i, 1);
    pcCfg.hiddenModules = arr;
    db.collection('settings').doc('policyCourse').set({ hiddenModules: arr, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
      .catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not save: ' + e.message); });
    render();
  }
  function flipCourse() {
    pcCfg = pcCfg || {};
    pcCfg.active = !pcCfg.active;
    db.collection('settings').doc('policyCourse').set({ active: pcCfg.active, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
      .catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not save: ' + e.message); });
    render();
  }

  function render() {
    var box = $('contentControlsBody');
    if (!box) return;
    // Arm the visibility watcher on EVERY render while the panel is hidden.
    //
    // Doing it only from inside ensureVocabUnits() was not enough and was
    // caught in the browser: that function is reached from one branch of the
    // vocabulary section (units === null), so if the panel rendered while
    // hidden without taking that branch, nothing armed the watcher and the
    // unit toggles would never have loaded at all. Arming here does not
    // depend on which section rendered.
    if (!box.offsetParent) loadVocabWhenVisible();
    else ensureVocabUnits();
    if (typeof window.EXAM_REGISTRY === 'undefined') { box.innerHTML = '<p style="color:#f87171; font-size:12px;">Exam registry not loaded.</p>'; return; }
    var levels = allLevels();
    if (!levels.length) { box.innerHTML = '<p style="color:var(--t2-text-muted,#7d8590); font-size:12px;">No content found.</p>'; return; }
    if (!activeLevel || levels.indexOf(activeLevel) === -1) activeLevel = (levels.indexOf('A2') >= 0 ? 'A2' : levels[0]);

    var tabs = '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">' + levels.map(function (l) {
      var on = l === activeLevel;
      return '<button type="button" class="cc-tab" data-level="' + esc(l) + '" ' +
        'style="cursor:pointer; font-family:inherit; font-weight:800; font-size:14px; padding:7px 16px; border-radius:20px; ' +
        'border:1px solid ' + (on ? 'var(--t2-green,#22c55e)' : 'var(--t2-border,#30363d)') + '; ' +
        'background:' + (on ? 'rgba(34,197,94,0.12)' : 'transparent') + '; ' +
        'color:' + (on ? 'var(--t2-green,#22c55e)' : 'var(--t2-text-muted,#7d8590)') + ';">' + esc(l) + '</button>';
    }).join('') + '</div>';

    // Skill tabs (All / Reading / Listening / Grammar) above the level tabs.
    var skillTabs = '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">' + SKILL_TABS.map(function (s) {
      var on = s.id === activeSkill;
      return '<button type="button" class="cc-skill-tab" data-skilltab="' + s.id + '" ' +
        'style="cursor:pointer; font-family:inherit; font-weight:800; font-size:13px; padding:6px 14px; border-radius:20px; ' +
        'border:1px solid ' + (on ? 'var(--t2-blue,#3b82f6)' : 'var(--t2-border,#30363d)') + '; ' +
        'background:' + (on ? 'rgba(59,130,246,0.14)' : 'transparent') + '; ' +
        'color:' + (on ? '#60a5fa' : 'var(--t2-text-muted,#7d8590)') + ';">' + esc(s.label) + '</button>';
    }).join('') + '</div>';

    // Placement tab: the level tabs do not apply, and the body belongs to
    // placement-admin.js. This renders the chips plus an empty mount and asks
    // that module to fill it, so neither file has to know the other's markup.
    if (activeSkill === 'placement') {
      box.innerHTML = skillTabs + '<div id="placementContentMount"></div>';
      box.querySelectorAll('.cc-skill-tab').forEach(function (b) {
        b.addEventListener('click', function () { activeSkill = b.getAttribute('data-skilltab'); render(); });
      });
      if (window.PlacementAdmin && typeof window.PlacementAdmin.renderContent === 'function') {
        window.PlacementAdmin.renderContent();
      }
      return;
    }

    // Mini courses tab: level tabs do not apply - just the course blocks.
    if (activeSkill === 'courses') {
      box.innerHTML = skillTabs + courseBlock();
      var pcBtn2 = box.querySelector('#ccCourseToggle');
      if (pcBtn2) pcBtn2.addEventListener('click', flipCourse);
      box.querySelectorAll('.cc-course-mod').forEach(function (b) { b.addEventListener('click', function () { flipCourseModule(b.getAttribute('data-mid')); }); });
      box.querySelectorAll('.cc-skill-tab').forEach(function (b) { b.addEventListener('click', function () { activeSkill = b.getAttribute('data-skilltab'); render(); }); });
      return;
    }

    var content = '';
    if (activeSkill === 'all' || activeSkill === 'vocabulary') content += vocabBlock(activeLevel);
    if (activeSkill === 'all' || activeSkill === 'reading') content += examBlock('reading', '📖', 'Reading', activeLevel);
    if (activeSkill === 'all' || activeSkill === 'listening') content += examBlock('listening', '🎧', 'Listening', activeLevel);
    if (activeSkill === 'all' || activeSkill === 'grammar') content += grammarBlock(activeLevel);
    if (!content) {
      var what = (activeSkill === 'all') ? 'vocabulary, reading, listening or grammar' : activeSkill;
      content = '<p style="color:var(--t2-text-muted,#7d8590); font-size:12px;">No ' + what + ' content at ' + esc(activeLevel) + '.</p>';
    }

    box.innerHTML = skillTabs + tabs + content;
    var pcBtn = box.querySelector('#ccCourseToggle');
    if (pcBtn) pcBtn.addEventListener('click', flipCourse);
    box.querySelectorAll('.cc-skill-tab').forEach(function (b) { b.addEventListener('click', function () { activeSkill = b.getAttribute('data-skilltab'); render(); }); });
    box.querySelectorAll('.cc-tab').forEach(function (b) { b.addEventListener('click', function () { activeLevel = b.getAttribute('data-level'); render(); }); });
    box.querySelectorAll('.cc-toggle').forEach(function (b) { b.addEventListener('click', function () { flip(b.getAttribute('data-skill'), b.getAttribute('data-id')); }); });
    box.querySelectorAll('.cc-scope').forEach(function (b) { b.addEventListener('click', function () { flipScope(b.getAttribute('data-scope'), b.getAttribute('data-skill'), b.getAttribute('data-id')); }); });
    box.querySelectorAll('.cc-level-toggle').forEach(function (b) { b.addEventListener('click', function () { flipLevel(b.getAttribute('data-skill'), b.getAttribute('data-level')); }); });
  }

  function save() {
    var u = (typeof auth !== 'undefined' && auth.currentUser) || null;
    if (!u) return Promise.resolve();
    // merge:true keeps any other fields (e.g. a legacy grammarQuestionCount) intact.
    return db.collection('settings').doc('contentControls').set({
      practiceHidden: cfg.practiceHidden,
      classroomHidden: cfg.classroomHidden,
      assignmentsHidden: cfg.assignmentsHidden,
      hiddenLevels: cfg.hiddenLevels,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: u.uid
    }, { merge: true }).catch(function (e) {
      console.error('contentControls save', e);
      if (typeof AppDialog !== 'undefined') AppDialog.alert('Could not save (admin only): ' + e.message);
    });
  }

  function flip(skill, id) {
    cfg.practiceHidden = cfg.practiceHidden || {};
    var arr = Array.isArray(cfg.practiceHidden[skill]) ? cfg.practiceHidden[skill].slice() : [];
    var i = arr.indexOf(id);
    if (i === -1) arr.push(id); else arr.splice(i, 1);
    cfg.practiceHidden[skill] = arr;
    save();
    render();
  }

  function flipScope(scope, skill, id) {
    var key = scopeKey(scope);
    cfg[key] = cfg[key] || {};
    var arr = Array.isArray(cfg[key][skill]) ? cfg[key][skill].slice() : [];
    var i = arr.indexOf(id);
    if (i === -1) arr.push(id); else arr.splice(i, 1);
    cfg[key][skill] = arr;
    save();
    render();
  }

  function flipLevel(skill, level) {
    cfg.hiddenLevels = cfg.hiddenLevels || {};
    var arr = Array.isArray(cfg.hiddenLevels[skill]) ? cfg.hiddenLevels[skill].slice() : [];
    var i = arr.indexOf(level);
    if (i === -1) arr.push(level); else arr.splice(i, 1);
    cfg.hiddenLevels[skill] = arr;
    save();
    render();
  }

  function load() {
    db.collection('settings').doc('contentControls').get().then(function (snap) {
      var d = snap.exists ? (snap.data() || {}) : {};
      var ph = (d.practiceHidden && typeof d.practiceHidden === 'object') ? d.practiceHidden : {};
      cfg.practiceHidden = {
        reading: Array.isArray(ph.reading) ? ph.reading : [],
        listening: Array.isArray(ph.listening) ? ph.listening : [],
        grammar: Array.isArray(ph.grammar) ? ph.grammar : [],
        vocabulary: Array.isArray(ph.vocabulary) ? ph.vocabulary : []
      };
      var ch = (d.classroomHidden && typeof d.classroomHidden === 'object') ? d.classroomHidden : {};
      cfg.classroomHidden = {
        reading: Array.isArray(ch.reading) ? ch.reading : [],
        listening: Array.isArray(ch.listening) ? ch.listening : [],
        grammar: Array.isArray(ch.grammar) ? ch.grammar : [],
        vocabulary: Array.isArray(ch.vocabulary) ? ch.vocabulary : []
      };
      var ah = (d.assignmentsHidden && typeof d.assignmentsHidden === 'object') ? d.assignmentsHidden : {};
      cfg.assignmentsHidden = {
        reading: Array.isArray(ah.reading) ? ah.reading : [],
        listening: Array.isArray(ah.listening) ? ah.listening : [],
        grammar: Array.isArray(ah.grammar) ? ah.grammar : [],
        vocabulary: Array.isArray(ah.vocabulary) ? ah.vocabulary : []
      };
      var hl = (d.hiddenLevels && typeof d.hiddenLevels === 'object') ? d.hiddenLevels : {};
      cfg.hiddenLevels = {
        reading: Array.isArray(hl.reading) ? hl.reading : [],
        listening: Array.isArray(hl.listening) ? hl.listening : [],
        grammar: Array.isArray(hl.grammar) ? hl.grammar : [],
        vocabulary: Array.isArray(hl.vocabulary) ? hl.vocabulary : []
      };
      render();
    }).catch(function (e) { console.warn('contentControls load', e); render(); });
  }

  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 400); return; }
    if (!$('contentControlsBody')) return;
    var waitAuth = function () {
      if (auth.currentUser) { load(); return; }
      setTimeout(waitAuth, 500);
    };
    waitAuth();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
