/* ============================================================
   CONTENT CONTROLS - student-side loader
   ------------------------------------------------------------
   Reads settings/contentControls once after sign-in and exposes it
   as window.CONTENT_CONTROLS so the practice runners can hide
   assignment-only exams/topics and the grammar drill can read its
   question count. A missing doc / load error means nothing is hidden
   and the grammar count falls back to its default. Uses the
   dashboard's global `db` + `auth`. One read per session.

   Shape: { practiceHidden: { reading:[ids], listening:[ids], grammar:[ids] },
            hiddenLevels:  { reading:[lvls], listening:[lvls], grammar:[lvls] },
            grammarQuestionCount: <number> }

   Whole-level deactivations (hiddenLevels) are EXPANDED into the
   per-item practiceHidden lists at load time, so the existing
   isPracticeHidden() checks in the practice runners cascade with no
   extra wiring. Uses EXAM_REGISTRY (reading/listening) + GRAMMAR_PRACTICE
   (grammar), both loaded before this script on the student dashboard.

   Helpers:
     window.isPracticeHidden(skill, id)   -> bool
     window.isLevelHidden(skill, level)   -> bool
     window.grammarQuestionCount(fallback)-> number
   ============================================================ */
(function () {
  'use strict';

  window.CONTENT_CONTROLS = window.CONTENT_CONTROLS || {
    practiceHidden: { reading: [], listening: [], grammar: [], vocabulary: [] },
    hiddenLevels: { reading: [], listening: [], grammar: [], vocabulary: [] },
    grammarQuestionCount: null
  };

  window.isPracticeHidden = function (skill, examId) {
    var cc = window.CONTENT_CONTROLS || {};
    var ph = cc.practiceHidden || {};
    var arr = Array.isArray(ph[skill]) ? ph[skill] : [];
    return arr.indexOf(examId) !== -1;
  };

  window.isLevelHidden = function (skill, level) {
    var cc = window.CONTENT_CONTROLS || {};
    var hl = cc.hiddenLevels || {};
    var arr = Array.isArray(hl[skill]) ? hl[skill] : [];
    return arr.indexOf(level) !== -1;
  };

  // Vocabulary word-lists (units) are stored level-qualified ("A2::Unit 1") in
  // practiceHidden.vocabulary, since a unit name repeats across levels.
  window.isVocabUnitHidden = function (level, unit) {
    var cc = window.CONTENT_CONTROLS || {};
    var ph = cc.practiceHidden || {};
    var arr = Array.isArray(ph.vocabulary) ? ph.vocabulary : [];
    return arr.indexOf(String(level) + '::' + String(unit)) !== -1;
  };

  window.grammarQuestionCount = function (fallback) {
    var cc = window.CONTENT_CONTROLS || {};
    var n = cc.grammarQuestionCount;
    return (typeof n === 'number' && n > 0) ? n : (fallback || 12);
  };

  // Fold whole-level deactivations into the per-item hidden lists, so the
  // existing isPracticeHidden() checks hide every item of a deactivated level.
  function expandHiddenLevels(hidden, hl) {
    function add(skill, ids) {
      ids.forEach(function (id) { if (id != null && hidden[skill].indexOf(id) === -1) hidden[skill].push(id); });
    }
    var ER = window.EXAM_REGISTRY;
    ['reading', 'listening'].forEach(function (sk) {
      (hl[sk] || []).forEach(function (lvl) {
        if (ER && ER.examsForLevel) {
          try { add(sk, (ER.examsForLevel(sk, lvl) || []).map(function (e) { return e.id; })); } catch (_) {}
        }
      });
    });
    var GP = window.GRAMMAR_PRACTICE;
    (hl.grammar || []).forEach(function (lvl) {
      if (GP && GP.byLevel && Array.isArray(GP.byLevel[lvl])) {
        add('grammar', GP.byLevel[lvl].map(function (t) { return t.id; }));
      }
    });
  }

  function arr3(o) {
    return {
      reading: Array.isArray(o.reading) ? o.reading.slice() : [],
      listening: Array.isArray(o.listening) ? o.listening.slice() : [],
      grammar: Array.isArray(o.grammar) ? o.grammar.slice() : [],
      vocabulary: Array.isArray(o.vocabulary) ? o.vocabulary.slice() : []
    };
  }

  // Hide deactivated vocabulary LEVELS from the static level picker (pills +
  // native select). Vocab's pickers are plain HTML with no re-render hook, so
  // we toggle them here directly (keeps the flagship vocab UI untouched). If the
  // student is sitting on a now-hidden level, switch them to the first active one.
  var VOCAB_LEVELS = ['A2', 'B1', 'B1+', 'B2', 'C1'];
  function applyVocabLevelGating() {
    var cc = window.CONTENT_CONTROLS || {};
    var hidden = (cc.hiddenLevels && Array.isArray(cc.hiddenLevels.vocabulary)) ? cc.hiddenLevels.vocabulary : [];
    VOCAB_LEVELS.forEach(function (lvl) {
      var off = hidden.indexOf(lvl) !== -1;
      var pill = document.querySelector('#levelPills .sel-opt[data-value="' + lvl + '"]');
      if (pill) pill.style.display = off ? 'none' : '';
      var opt = document.querySelector('#levelSelect option[value="' + lvl + '"]');
      if (opt) { opt.hidden = off; opt.disabled = off; }
    });
    try {
      if (typeof selectedLevel !== 'undefined' && hidden.indexOf(selectedLevel) !== -1) {
        var first = VOCAB_LEVELS.filter(function (l) { return hidden.indexOf(l) === -1; })[0];
        if (first && typeof changeLevel === 'function') changeLevel(first);
      }
    } catch (_) {}
  }

  function load() {
    db.collection('settings').doc('contentControls').get().then(function (snap) {
      var d = snap.exists ? (snap.data() || {}) : {};
      var ph = (d.practiceHidden && typeof d.practiceHidden === 'object') ? d.practiceHidden : {};
      var hl = arr3((d.hiddenLevels && typeof d.hiddenLevels === 'object') ? d.hiddenLevels : {});
      var hidden = arr3(ph);
      expandHiddenLevels(hidden, hl);
      window.CONTENT_CONTROLS = {
        practiceHidden: hidden,
        hiddenLevels: hl,
        grammarQuestionCount: (typeof d.grammarQuestionCount === 'number' && d.grammarQuestionCount > 0) ? d.grammarQuestionCount : null
      };
      try { applyVocabLevelGating(); } catch (e) { console.warn('vocab level gating', e); }
      // Re-render the unit picker + word count now that hidden units are known.
      try { if (typeof populateUnitSelector === 'function') populateUnitSelector(); } catch (_) {}
      try { if (typeof updateWordCount === 'function') updateWordCount(); } catch (_) {}
      document.dispatchEvent(new CustomEvent('content-controls-ready'));
    }).catch(function (e) { console.warn('contentControls', e); });
  }

  function init() {
    if (typeof db === 'undefined' || typeof auth === 'undefined') { setTimeout(init, 500); return; }
    var waitAuth = function (tries) {
      if (auth.currentUser) { load(); return; }
      if (tries <= 0) return;
      setTimeout(function () { waitAuth(tries - 1); }, 500);
    };
    waitAuth(40);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
