/* ============================================================
   CONTENT CONTROLS - classroom-side loader
   ------------------------------------------------------------
   Reads settings/contentControls once after sign-in and exposes the
   CLASSROOM scope (classroomHidden) so live games never draw from a
   word-list or grammar topic the admin has hidden from classroom.
   A missing doc / read error means nothing is hidden (fail open),
   so a game always works even if this read fails.

   Load this BEFORE the per-game script (teacher.js, heist-student.js,
   trust-student.js) on every classroom page. Self-sufficient: it gets
   its own Firestore/Auth handle straight off the compat SDK once the
   page has called initializeApp (the student game scripts keep their
   db/auth IIFE-scoped, so we cannot borrow a page global). A live
   listener keeps it fresh so an admin toggle applies to the next game.

   Helpers (all fail-open when nothing loaded):
     window.ccClassroomVocabUnitHidden(level, unit)  -> bool
     window.ccClassroomGrammarHidden(topicId)        -> bool
   Vocabulary units are stored level-qualified ("A2::Unit 1") since a
   unit name repeats across levels.
   ============================================================ */
(function () {
  'use strict';

  window.CC_CLASSROOM = window.CC_CLASSROOM || {
    classroomHidden: { reading: [], listening: [], grammar: [], vocabulary: [] }
  };

  window.ccClassroomVocabUnitHidden = function (level, unit) {
    var cc = window.CC_CLASSROOM || {};
    var ch = cc.classroomHidden || {};
    var arr = Array.isArray(ch.vocabulary) ? ch.vocabulary : [];
    return arr.indexOf(String(level) + '::' + String(unit)) !== -1;
  };

  window.ccClassroomGrammarHidden = function (topicId) {
    var cc = window.CC_CLASSROOM || {};
    var ch = cc.classroomHidden || {};
    var arr = Array.isArray(ch.grammar) ? ch.grammar : [];
    return arr.indexOf(topicId) !== -1;
  };

  function load(db) {
    db.collection('settings').doc('contentControls').onSnapshot(function (snap) {
      var d = snap.exists ? (snap.data() || {}) : {};
      var ch = (d.classroomHidden && typeof d.classroomHidden === 'object') ? d.classroomHidden : {};
      window.CC_CLASSROOM.classroomHidden = {
        reading: Array.isArray(ch.reading) ? ch.reading : [],
        listening: Array.isArray(ch.listening) ? ch.listening : [],
        grammar: Array.isArray(ch.grammar) ? ch.grammar : [],
        vocabulary: Array.isArray(ch.vocabulary) ? ch.vocabulary : []
      };
      document.dispatchEvent(new CustomEvent('cc-classroom-ready'));
    }, function (e) { console.warn('cc-classroom', e); });
  }

  function init() {
    // The page owns initializeApp; we just grab the shared compat handle.
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) { setTimeout(init, 500); return; }
    var auth = firebase.auth();
    var db = firebase.firestore();
    var waitAuth = function (tries) {
      if (auth.currentUser) { load(db); return; }
      if (tries <= 0) return;
      setTimeout(function () { waitAuth(tries - 1); }, 500);
    };
    waitAuth(40);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
