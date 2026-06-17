/* ============================================================
   CONTENT CONTROLS - student-side loader
   ------------------------------------------------------------
   Reads settings/contentControls once after sign-in and exposes it
   as window.CONTENT_CONTROLS so the practice runners can hide
   assignment-only exams and the grammar drill can read its question
   count. A missing doc / load error means nothing is hidden and the
   grammar count falls back to its default. Uses the dashboard's
   global `db` + `auth`. One read per session.

   Shape: { practiceHidden: { reading:[ids], listening:[ids] },
            grammarQuestionCount: <number> }

   Helpers:
     window.isPracticeHidden(skill, examId)  -> bool
     window.grammarQuestionCount(fallback)   -> number
   ============================================================ */
(function () {
  'use strict';

  window.CONTENT_CONTROLS = window.CONTENT_CONTROLS || { practiceHidden: { reading: [], listening: [], grammar: [] }, grammarQuestionCount: null };

  window.isPracticeHidden = function (skill, examId) {
    var cc = window.CONTENT_CONTROLS || {};
    var ph = cc.practiceHidden || {};
    var arr = Array.isArray(ph[skill]) ? ph[skill] : [];
    return arr.indexOf(examId) !== -1;
  };

  window.grammarQuestionCount = function (fallback) {
    var cc = window.CONTENT_CONTROLS || {};
    var n = cc.grammarQuestionCount;
    return (typeof n === 'number' && n > 0) ? n : (fallback || 12);
  };

  function load() {
    db.collection('settings').doc('contentControls').get().then(function (snap) {
      var d = snap.exists ? (snap.data() || {}) : {};
      var ph = (d.practiceHidden && typeof d.practiceHidden === 'object') ? d.practiceHidden : {};
      window.CONTENT_CONTROLS = {
        practiceHidden: {
          reading: Array.isArray(ph.reading) ? ph.reading : [],
          listening: Array.isArray(ph.listening) ? ph.listening : [],
          grammar: Array.isArray(ph.grammar) ? ph.grammar : []
        },
        grammarQuestionCount: (typeof d.grammarQuestionCount === 'number' && d.grammarQuestionCount > 0) ? d.grammarQuestionCount : null
      };
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
