/* ============================================================
   VOCAB ASSIGNMENT - unit gating
   ------------------------------------------------------------
   The Create/Edit Assignment modal's Unit dropdown is static HTML
   (All Units + Unit 1..12). This hides/disables any word-list the
   admin hid from the ASSIGNMENTS scope (settings/contentControls
   .assignmentsHidden.vocabulary), so teachers cannot assign it.

   Unit ids are level-qualified ("A2::Unit 1") since a unit name
   repeats across levels, so gating is recomputed whenever the level
   changes. Reads the shared window.CC_ASSIGNMENTS_HIDDEN that
   exam-form.js keeps live; fails open if it has not loaded.

   Called from teacher-assignments.js at modal open (create + edit)
   and on the level dropdown's change event.
   ============================================================ */
(function () {
  'use strict';

  function hiddenVocab() {
    var cc = window.CC_ASSIGNMENTS_HIDDEN || {};
    return Array.isArray(cc.vocabulary) ? cc.vocabulary : [];
  }

  // allowReset: when the currently selected unit is now hidden, fall back to
  // "All Units". True for a fresh Create form + level changes; false when
  // opening Edit (never silently rewrite an existing assignment's unit).
  window.gateVocabAssignUnits = function (allowReset) {
    var lvlEl = document.getElementById('assignmentLevel');
    var unitEl = document.getElementById('assignmentUnit');
    if (!lvlEl || !unitEl) return;
    var level = lvlEl.value || '';
    var hidden = hiddenVocab();
    var opts = unitEl.options;
    for (var i = 0; i < opts.length; i++) {
      var v = opts[i].value;
      if (v === 'all' || v === '') { opts[i].hidden = false; opts[i].disabled = false; continue; }
      var off = hidden.indexOf(level + '::' + v) !== -1;
      opts[i].hidden = off;
      opts[i].disabled = off;
    }
    if (allowReset && unitEl.selectedIndex >= 0 && unitEl.options[unitEl.selectedIndex].disabled) {
      unitEl.value = 'all';
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var lvlEl = document.getElementById('assignmentLevel');
    if (lvlEl) lvlEl.addEventListener('change', function () { window.gateVocabAssignUnits(true); });
    // Re-gate live if the admin toggles while a form is open (keep selection).
    document.addEventListener('assignments-hidden-ready', function () { window.gateVocabAssignUnits(false); });
  });
})();
