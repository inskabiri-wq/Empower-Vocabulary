/* ============================================================
   CONTENT CONTROLS - admin panel (#tab-admin)
   ------------------------------------------------------------
   Per-item "hide from practice" for reading + listening exams AND
   grammar topics, browsed by LEVEL tabs (A1/A2/B1/B1+/B2). Hidden
   items are assignment-only: they disappear from free practice but
   still work when assigned. Stored in settings/contentControls:
     { practiceHidden: { reading:[examId], listening:[examId],
                         grammar:[topicId] } }
   Writes are admin-only (general /settings rule); the student side
   reads it via content-controls-student.js. Nothing is deleted.
   ============================================================ */
(function () {
  'use strict';

  var cfg = { practiceHidden: { reading: [], listening: [], grammar: [], vocabulary: [] }, hiddenLevels: { reading: [], listening: [], grammar: [], vocabulary: [] } };
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
    { id: 'grammar', label: '✏️ Grammar' }
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
      '<div style="font-weight:800; font-size:14px; color:var(--t2-text,#e6edf3); margin-bottom:10px;">' + title + '</div>' + inner + '</div>';
  }

  function toggleRow(skill, id, label) {
    var hidden = isHidden(skill, id);
    return '<div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid ' +
        (hidden ? 'rgba(245,158,11,0.5)' : 'var(--t2-border,#30363d)') + '; border-radius:8px; margin-bottom:6px; ' +
        (hidden ? 'background:rgba(245,158,11,0.06);' : '') + '">' +
      '<div style="flex:1; min-width:0;">' +
        '<div style="font-size:13px; color:var(--t2-text,#e6edf3); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(label) + '</div>' +
        '<div style="font-size:11px; font-weight:600; margin-top:1px; color:' + (hidden ? '#f59e0b' : 'var(--t2-green,#22c55e)') + ';">' +
          (hidden ? 'Hidden from practice · assignment-only' : 'In practice') + '</div>' +
      '</div>' +
      '<button type="button" class="cc-toggle" data-skill="' + skill + '" data-id="' + esc(id) + '" ' +
        'style="cursor:pointer; font-family:inherit; font-size:12px; font-weight:500; color:var(--t2-text-muted,#7d8590); background:transparent; border:1px solid var(--t2-border,#30363d); border-radius:20px; padding:5px 14px; white-space:nowrap;">' +
        (hidden ? 'Show in practice' : 'Hide from practice') + '</button>' +
    '</div>';
  }

  function scrollWrap(rows) { return '<div style="max-height:340px; overflow:auto; padding-right:6px;">' + rows + '</div>'; }

  // Whole-level on/off (deactivates every item of a skill at a level).
  function isLevelOff(skill, level) {
    var hl = cfg.hiddenLevels || {};
    return Array.isArray(hl[skill]) && hl[skill].indexOf(level) !== -1;
  }
  function levelToggle(skill, level) {
    var off = isLevelOff(skill, level);
    return '<button type="button" class="cc-level-toggle" data-skill="' + skill + '" data-level="' + esc(level) + '" ' +
      'style="cursor:pointer; font-family:inherit; font-size:11px; font-weight:800; padding:3px 12px; border-radius:14px; margin-left:8px; white-space:nowrap; ' +
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
  function ensureVocabUnits() {
    if (vocabUnits || vocabLoading) return;
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
      var n = units.filter(function (u) { return isHidden('vocabulary', level + '::' + u); }).length;
      if (n) title += ' &middot; <span style="color:#f59e0b;">' + n + ' hidden</span>';
      var rows = units.map(function (u) { return toggleRow('vocabulary', level + '::' + u, u); }).join('');
      inner = '<div style="font-size:12px; color:var(--t2-text-muted,#7d8590); padding:2px 2px 8px;">Deactivate individual word lists. A hidden list vanishes from free practice but still works when assigned.</div>' + scrollWrap(rows);
    }
    return section(title, inner);
  }

  function examBlock(skill, icon, name, level) {
    if (typeof window.EXAM_REGISTRY === 'undefined') return '';
    var exams = (window.EXAM_REGISTRY.examsForLevel(skill, level) || []).filter(function (e) { return e.available !== false; });
    if (!exams.length) return '';
    var off = isLevelOff(skill, level);
    var n = exams.filter(function (e) { return isHidden(skill, e.id); }).length;
    var rows = exams.map(function (e) { return toggleRow(skill, e.id, e.title || e.id); }).join('');
    var title = icon + ' ' + name + ' &middot; ' + esc(level) + (!off && n ? (' &middot; <span style="color:#f59e0b;">' + n + ' hidden</span>') : '') + levelToggle(skill, level);
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
      rows += '<div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--t2-text-muted,#7d8590); margin:10px 0 4px;">Unit ' + esc(u) + '</div>';
      groups[u].forEach(function (t) { rows += toggleRow('grammar', t.id, t.title || t.id); });
    });
    var off = isLevelOff('grammar', level);
    var n = topics.filter(function (t) { return isHidden('grammar', t.id); }).length;
    var title = '✏️ Grammar topics &middot; ' + esc(level) + (!off && n ? (' &middot; <span style="color:#f59e0b;">' + n + ' hidden</span>') : '') + levelToggle('grammar', level);
    return section(title, (off ? offBanner() : '') + scrollWrap(rows));
  }

  function render() {
    var box = $('contentControlsBody');
    if (!box) return;
    if (typeof window.EXAM_REGISTRY === 'undefined') { box.innerHTML = '<p style="color:#f87171; font-size:12px;">Exam registry not loaded.</p>'; return; }
    var levels = allLevels();
    if (!levels.length) { box.innerHTML = '<p style="color:var(--t2-text-muted,#7d8590); font-size:12px;">No content found.</p>'; return; }
    if (!activeLevel || levels.indexOf(activeLevel) === -1) activeLevel = (levels.indexOf('A2') >= 0 ? 'A2' : levels[0]);

    var tabs = '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">' + levels.map(function (l) {
      var on = l === activeLevel;
      return '<button type="button" class="cc-tab" data-level="' + esc(l) + '" ' +
        'style="cursor:pointer; font-family:inherit; font-weight:800; font-size:13px; padding:7px 16px; border-radius:20px; ' +
        'border:1px solid ' + (on ? 'var(--t2-green,#22c55e)' : 'var(--t2-border,#30363d)') + '; ' +
        'background:' + (on ? 'rgba(34,197,94,0.12)' : 'transparent') + '; ' +
        'color:' + (on ? 'var(--t2-green,#22c55e)' : 'var(--t2-text-muted,#7d8590)') + ';">' + esc(l) + '</button>';
    }).join('') + '</div>';

    // Skill tabs (All / Reading / Listening / Grammar) above the level tabs.
    var skillTabs = '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">' + SKILL_TABS.map(function (s) {
      var on = s.id === activeSkill;
      return '<button type="button" class="cc-skill-tab" data-skilltab="' + s.id + '" ' +
        'style="cursor:pointer; font-family:inherit; font-weight:800; font-size:12px; padding:6px 14px; border-radius:20px; ' +
        'border:1px solid ' + (on ? 'var(--t2-blue,#3b82f6)' : 'var(--t2-border,#30363d)') + '; ' +
        'background:' + (on ? 'rgba(59,130,246,0.14)' : 'transparent') + '; ' +
        'color:' + (on ? '#60a5fa' : 'var(--t2-text-muted,#7d8590)') + ';">' + esc(s.label) + '</button>';
    }).join('') + '</div>';

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
    box.querySelectorAll('.cc-skill-tab').forEach(function (b) { b.addEventListener('click', function () { activeSkill = b.getAttribute('data-skilltab'); render(); }); });
    box.querySelectorAll('.cc-tab').forEach(function (b) { b.addEventListener('click', function () { activeLevel = b.getAttribute('data-level'); render(); }); });
    box.querySelectorAll('.cc-toggle').forEach(function (b) { b.addEventListener('click', function () { flip(b.getAttribute('data-skill'), b.getAttribute('data-id')); }); });
    box.querySelectorAll('.cc-level-toggle').forEach(function (b) { b.addEventListener('click', function () { flipLevel(b.getAttribute('data-skill'), b.getAttribute('data-level')); }); });
  }

  function save() {
    var u = (typeof auth !== 'undefined' && auth.currentUser) || null;
    if (!u) return Promise.resolve();
    // merge:true keeps any other fields (e.g. a legacy grammarQuestionCount) intact.
    return db.collection('settings').doc('contentControls').set({
      practiceHidden: cfg.practiceHidden,
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
