/* ============================================================
   WRITING ASSIGNMENT FORM — Phase 2
   Dedicated open/close/save logic for skill='writing' assignments.
   Lives alongside teacher-assignments.js (which handles the
   vocabulary form + the skill picker). Loaded AFTER both
   skill-registry.js and teacher-assignments.js so it can wire
   into routeToCreationForm() via the global override below.

   Data shape written to /assignments collection:
     {
       title, skill: 'writing',
       prompt, questionType, timeLimit, autoSubmit,
       minWords, targetWords, difficulty, rubric, aiCorrection,
       targetType, targetClass, targetStudents,
       deadline, teacherId, teacherName,
       createdAt, updatedAt
     }
   ============================================================ */

(function () {
  'use strict';

  // ── Open / close ────────────────────────────────────────────
  function openWritingAssignmentModal(prefill) {
    const modal = document.getElementById('writingAssignmentModal');
    if (!modal) return;

    // Reset everything
    document.getElementById('writingAssignmentId').value = '';
    document.getElementById('writingTitle').value        = '';
    document.getElementById('writingPrompt').value       = '';
    document.getElementById('writingQuestionType').value = 'opinion-essay';
    document.getElementById('writingLevel').value        = '';
    document.getElementById('writingTimeLimit').value    = 40;
    document.getElementById('writingTargetWords').value  = '';
    document.getElementById('writingMinWords').value     = '';
    document.getElementById('writingRubric').value       = '';
    const _rubricUrlReset = document.getElementById('writingRubricUrl');
    if (_rubricUrlReset) _rubricUrlReset.value = '';
    const _rubricTypeReset = document.getElementById('writingRubricType');
    if (_rubricTypeReset) _rubricTypeReset.value = 'essay';
    document.getElementById('writingAutoSubmit').checked = true;
    document.getElementById('writingAiCorrection').checked = false;
    document.getElementById('writingTargetType').value   = 'class';
    document.getElementById('writingDeadline').value     = '';
    document.getElementById('writingModalTitle').innerHTML = '✍️ New Writing Assignment';

    // Apply role-based scope BEFORE populating:
    //   - Non-admin teachers lose the Level + Module target options
    //   - Class dropdown is scoped to their assigned classes
    //   - Student picker shows only students in their assigned classes
    if (typeof applyRoleScopeToTargetDropdown === 'function') {
      applyRoleScopeToTargetDropdown('writingTargetType');
    }
    if (typeof populateClassDropdownScoped === 'function') {
      populateClassDropdownScoped('writingTargetClass');
    } else {
      populateWritingClasses();
    }
    populateWritingStudents();
    onWritingTargetTypeChange();

    // Apply any prefill (edit mode)
    if (prefill && typeof prefill === 'object') {
      applyWritingPrefill(prefill);
    }

    switchWritingTab('details');   // always open on the first tab
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Tabbed writing modal: show one pane, highlight its tab. Field IDs and
  // save logic are untouched (hidden panes stay in the DOM, so getElementById
  // still reads every value on Save regardless of which tab is showing).
  // Wizard order for the tabs. Next/Back walk this list; the tab bar can still
  // jump anywhere. AI feedback is the last page (page 4).
  var WRITING_TABS = ['details', 'settings', 'targeting', 'ai'];

  function currentWritingTab() {
    const m = document.getElementById('writingAssignmentModal');
    if (!m) return 'details';
    const open = m.querySelector('.wtab-pane:not([hidden])');
    return open ? open.getAttribute('data-wpane') : 'details';
  }

  function switchWritingTab(name) {
    const m = document.getElementById('writingAssignmentModal');
    if (!m) return;
    m.querySelectorAll('.wtab-pane').forEach(p => { p.hidden = (p.getAttribute('data-wpane') !== name); });
    m.querySelectorAll('.wtab').forEach(t => t.classList.toggle('active', t.getAttribute('data-wtab') === name));
    // Back hides on the first page; Next hides on the last page (AI feedback).
    const i = WRITING_TABS.indexOf(name);
    const back = document.getElementById('writingBackBtn');
    const next = document.getElementById('writingNextBtn');
    const save = document.getElementById('writingSaveBtn');
    const last = (i >= WRITING_TABS.length - 1);
    if (back) back.hidden = (i <= 0);   // no Back on the first page
    if (next) next.hidden = last;       // no Next on the last page (AI)
    if (save) save.hidden = !last;      // Save shows ONLY on the last page (AI)
    const box = m.querySelector('.modal-box'); if (box) box.scrollTop = 0;
  }
  window.switchWritingTab = switchWritingTab;

  function nextWritingTab() {
    const i = WRITING_TABS.indexOf(currentWritingTab());
    if (i > -1 && i < WRITING_TABS.length - 1) switchWritingTab(WRITING_TABS[i + 1]);
  }
  function prevWritingTab() {
    const i = WRITING_TABS.indexOf(currentWritingTab());
    if (i > 0) switchWritingTab(WRITING_TABS[i - 1]);
  }
  window.nextWritingTab = nextWritingTab;
  window.prevWritingTab = prevWritingTab;

  function closeWritingAssignmentModal() {
    const modal = document.getElementById('writingAssignmentModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── Target selectors ─────────────────────────────────────────
  // Mirror the vocabulary modal's target logic but with writing IDs.
  // Class list is built from TWO sources, merged:
  //   1. student-derived: every studentClass present on allStudents
  //   2. admin-registered: settings/availableClasses (classes added in
  //      the Admin tab that may not have students yet)
  // Refetched every open so newly-added classes show up without a
  // page reload.
  async function populateWritingClasses() {
    const sel = document.getElementById('writingTargetClass');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Loading classes —</option>';

    // Source 1: student-derived
    const fromStudents = (Array.isArray(allStudents) ? allStudents : [])
      .map(s => (s && s.studentClass ? String(s.studentClass).trim() : ''))
      .filter(Boolean);

    // Source 2: admin-registered. Wrapped in try/catch — missing doc or
    // permission denied is fine, we just fall back to source 1.
    let registry = [];
    try {
      const doc = await db.collection('settings').doc('availableClasses').get();
      if (doc.exists) {
        const v = doc.data().classes;
        if (Array.isArray(v)) registry = v.map(s => String(s).trim()).filter(Boolean);
      }
    } catch (_) { /* no-op */ }

    const all = [...new Set([...fromStudents, ...registry])].sort();
    sel.innerHTML = '<option value="">— Select a class —</option>'
      + all.map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c.replace(/</g, '&lt;')}</option>`).join('');
  }

  function populateWritingStudents() {
    // Phase G follow-up — delegate to the shared StudentPicker module
    // (assignments/js/student-picker.js) so the writing form gets the
    // same search box + select-all + live count UX that the vocab form
    // has. We pass the existing `writing-student-checkbox` class so any
    // code elsewhere that queries .writing-student-checkbox still
    // finds the same elements.
    if (typeof window.StudentPicker !== 'undefined') {
      window.StudentPicker.render({
        containerId:   'writingTargetStudentsList',
        checkboxClass: 'writing-student-checkbox'
        // Default student source = studentsAllowedForCurrentUser()
      });
      return;
    }
    // Fallback (should be unreachable in production — student-picker.js
    // is loaded before this file in teacher-dashboard.html). Kept so a
    // misconfigured page still shows the list, just without search.
    const list = document.getElementById('writingTargetStudentsList');
    if (!list) return;
    const visible = (typeof studentsAllowedForCurrentUser === 'function')
      ? studentsAllowedForCurrentUser()
      : (Array.isArray(allStudents) ? allStudents : []);
    if (!Array.isArray(visible) || visible.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9em;">No students in your classes.</p>';
      return;
    }
    list.innerHTML = visible.map(s => {
      const name = (s.name || s.email || 'Unknown').replace(/</g, '&lt;');
      const cls  = (s.studentClass || '').replace(/</g, '&lt;');
      return `
        <label class="wr-student-row">
          <input type="checkbox" class="writing-student-checkbox" value="${s.id}">
          <span class="wr-student-name">${name}</span>
          <span class="wr-student-class">${cls}</span>
        </label>
      `;
    }).join('');
  }

  window.onWritingTargetTypeChange = function () {
    const v = document.getElementById('writingTargetType').value;
    // Show only the relevant scope picker, hide the others.
    const boxes = {
      class:    document.getElementById('writingClassTargetGroup'),
      level:    document.getElementById('writingLevelTargetGroup'),
      module:   document.getElementById('writingModuleTargetGroup'),
      individual: document.getElementById('writingIndividualTargetGroup')
    };
    Object.keys(boxes).forEach(key => {
      if (boxes[key]) boxes[key].style.display = (key === v) ? (key === 'individual' ? 'block' : '') : 'none';
    });
  };

  // ── Save ────────────────────────────────────────────────────
  async function saveWritingAssignment() {
    console.log('[writing] saveWritingAssignment START');
    try {
      return await _doSaveWritingAssignment();
    } catch (err) {
      console.error('[writing] saveWritingAssignment THREW:', err);
      if (typeof showError === 'function') {
        showError('Unexpected error', err && err.message ? err.message : String(err));
      } else {
        AppDialog.alert('Save failed: ' + (err && err.message ? err.message : err));
      }
    }
  }
  async function _doSaveWritingAssignment() {
    const saveBtn = document.querySelector('#writingAssignmentModal .modal-btn-save');
    const originalText = saveBtn ? saveBtn.innerHTML : '';

    const assignmentId = document.getElementById('writingAssignmentId').value;
    const title        = document.getElementById('writingTitle').value.trim();
    const prompt       = document.getElementById('writingPrompt').value.trim();
    const questionType = document.getElementById('writingQuestionType').value;
    const level        = document.getElementById('writingLevel').value || null;
    const timeLimit    = parseInt(document.getElementById('writingTimeLimit').value, 10);
    const targetWords  = parseInt(document.getElementById('writingTargetWords').value, 10);
    const minWords     = parseInt(document.getElementById('writingMinWords').value, 10);
    const rubric       = document.getElementById('writingRubric').value.trim();
    // Phase G fix — second rubric source. Teacher pastes a public link
    // (Google Drive PDF, Google Doc, etc.) instead of (or alongside)
    // pasting the rubric text. Native file upload via Firebase Storage
    // is on the roadmap; this URL field is the no-infrastructure
    // alternative that works today.
    const rubricUrlEl  = document.getElementById('writingRubricUrl');
    const rubricUrl    = (rubricUrlEl ? rubricUrlEl.value : '').trim();
    // rubricType drives the inline-comment bank in the grading view
    // (essay / academic / short). Defaults to 'essay' if the control
    // is somehow absent.
    const rubricTypeEl = document.getElementById('writingRubricType');
    const rubricType   = (rubricTypeEl ? rubricTypeEl.value : 'essay') || 'essay';
    const autoSubmit   = !!document.getElementById('writingAutoSubmit').checked;
    const aiCorrection = !!document.getElementById('writingAiCorrection').checked;
    const targetType   = document.getElementById('writingTargetType').value;
    const deadline     = document.getElementById('writingDeadline').value;

    // ── Inline validation (Phase A) ──
    clearFieldErrors('writingAssignmentModal');
    const errs = validateAll([
      { id: 'writingTitle',        msg: 'Assignment title is required.' },
      { id: 'writingPrompt',       msg: 'Writing prompt is required — what should students write about?' },
      { id: 'writingTimeLimit',    msg: 'Time limit must be a positive number (in minutes).',
        test: v => Number(v) >= 1 },
      { id: 'writingDeadline',     msg: 'Due date cannot be empty.' },
      { id: 'writingDeadline',     msg: 'Year must be between 2024 and 2099.',
        test: v => { const d = new Date(v); return v && !isNaN(d.getTime()) && d.getFullYear() >= 2024 && d.getFullYear() <= 2099; } },
      { id: 'writingTargetClass',  msg: 'Please select a target class.',  when: () => targetType === 'class' },
      { id: 'writingTargetLevel',  msg: 'Please select a target level.',  when: () => targetType === 'level' },
      { id: 'writingTargetModule', msg: 'Please select a target module.', when: () => targetType === 'module' }
    ]);
    if (targetType === 'individual') {
      const checked = document.querySelectorAll('.writing-student-checkbox:checked').length;
      if (checked === 0) {
        const anchor = document.getElementById('writingTargetStudentsList');
        if (anchor) errs.push({ id: 'writingTargetStudentsList', msg: 'Please select at least one student.', el: anchor });
      }
    }
    if (errs.length) {
      showFieldErrors(errs, 'writingAssignmentModal');
      return;
    }
    const deadlineDate = new Date(deadline);

    // Values are collected here — validation already happened above
    // via validateAll() / showFieldErrors().
    let targetClass = '';
    let targetLevel = '';
    let targetModule = '';
    let targetStudents = [];

    if (targetType === 'class') {
      targetClass = (typeof _normCls === 'function')
        ? _normCls(document.getElementById('writingTargetClass').value)
        : (document.getElementById('writingTargetClass').value || '').trim().toUpperCase();
    } else if (targetType === 'level') {
      targetLevel = (document.getElementById('writingTargetLevel').value || '').trim();
    } else if (targetType === 'module') {
      targetModule = (document.getElementById('writingTargetModule').value || '').trim();
    } else if (targetType === 'individual') {
      const checks = document.querySelectorAll('.writing-student-checkbox:checked');
      targetStudents = Array.from(checks).map(cb => cb.value);
    }

    // Show loading
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';
      saveBtn.classList.add('saving');
    }

    const data = {
      title,
      skill: 'writing',
      prompt,
      questionType,
      level,                                      // CEFR level: A2/B1/B1+/B2 (was 'difficulty' in early drafts)
      timeLimit,                                  // minutes
      targetWords:  Number.isFinite(targetWords) ? targetWords : null,
      minWords:     Number.isFinite(minWords)    ? minWords    : null,
      rubric:       rubric || null,
      rubricUrl:    rubricUrl || null,           // link to PDF / Doc
      rubricType:   rubricType,                  // essay | academic | short → drives comment bank
      autoSubmit,
      aiCorrection,
      manualGrading: true,                        // implicit / always-on
      targetType,
      targetClass,
      targetLevel,
      targetModule,
      targetStudents,
      deadline:     deadlineDate,
      teacherId:    auth.currentUser.uid,
      teacherName:  (typeof userData !== 'undefined' && userData?.name) || auth.currentUser.email,
      updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (assignmentId) {
        await db.collection('assignments').doc(assignmentId).update(data);
        if (typeof ActivityLogger !== 'undefined' && ActivityLogger.logAssignmentUpdated) {
          try { await ActivityLogger.logAssignmentUpdated({ assignmentId, skill: 'writing' }); } catch (_) {}
        }
        showSuccess('Updated', '✍️ Writing assignment updated.');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection('assignments').add(data);
        if (typeof ActivityLogger !== 'undefined' && ActivityLogger.logAssignmentCreated) {
          try { await ActivityLogger.logAssignmentCreated({ assignmentId: ref.id, skill: 'writing' }); } catch (_) {}
        }
        showSuccess('Created', '✍️ Writing assignment created.');
      }

      closeWritingAssignmentModal();
      if (typeof loadAssignments === 'function') {
        await loadAssignments();
      }
    } catch (err) {
      console.error('Error saving writing assignment:', err);
      showError('Save Failed', err.message || 'Could not save the writing assignment.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText || 'Save Assignment';
        saveBtn.classList.remove('saving');
      }
    }
  }

  // ── Edit prefill ────────────────────────────────────────────
  function applyWritingPrefill(a) {
    document.getElementById('writingAssignmentId').value = a.id || '';
    document.getElementById('writingTitle').value        = a.title || '';
    document.getElementById('writingPrompt').value       = a.prompt || '';
    document.getElementById('writingQuestionType').value = a.questionType || 'opinion-essay';
    // Backward-compat: early Phase-2 drafts stored this as `difficulty`.
    document.getElementById('writingLevel').value        = a.level || a.difficulty || '';
    document.getElementById('writingTimeLimit').value    = a.timeLimit || 40;
    document.getElementById('writingTargetWords').value  = (a.targetWords != null) ? a.targetWords : '';
    document.getElementById('writingMinWords').value     = (a.minWords    != null) ? a.minWords    : '';
    document.getElementById('writingRubric').value       = a.rubric || '';
    const rubricUrlInput = document.getElementById('writingRubricUrl');
    if (rubricUrlInput) rubricUrlInput.value = a.rubricUrl || '';
    const rubricTypeInput = document.getElementById('writingRubricType');
    if (rubricTypeInput) rubricTypeInput.value = a.rubricType || 'essay';
    document.getElementById('writingAutoSubmit').checked   = (a.autoSubmit !== false);   // default true
    document.getElementById('writingAiCorrection').checked = !!a.aiCorrection;
    document.getElementById('writingTargetType').value     = a.targetType || 'class';
    if (a.deadline) {
      const d = a.deadline.toDate ? a.deadline.toDate() : new Date(a.deadline);
      document.getElementById('writingDeadline').value = d.toISOString().split('T')[0];
    }
    onWritingTargetTypeChange();
    if (a.targetType === 'class' && a.targetClass) {
      document.getElementById('writingTargetClass').value = a.targetClass;
    } else if (a.targetType === 'level' && a.targetLevel) {
      document.getElementById('writingTargetLevel').value = a.targetLevel;
    } else if (a.targetType === 'module' && a.targetModule) {
      document.getElementById('writingTargetModule').value = a.targetModule;
    } else if (a.targetType === 'individual' && Array.isArray(a.targetStudents)) {
      setTimeout(() => {
        // Prefer the shared picker's helper so the "N selected" counter
        // updates too. Falls back to raw DOM if picker isn't loaded.
        if (typeof window.StudentPicker !== 'undefined') {
          window.StudentPicker.setSelected('writingTargetStudentsList', 'writing-student-checkbox', a.targetStudents);
        } else {
          document.querySelectorAll('.writing-student-checkbox').forEach(cb => {
            cb.checked = a.targetStudents.includes(cb.value);
          });
        }
      }, 50);
    }
    document.getElementById('writingModalTitle').innerHTML = '🖊️ Edit Writing Assignment';
  }

  // ── Hook into the skill picker router ────────────────────────
  // teacher-assignments.js exposes routeToCreationForm via the global
  // scope (defined at file top-level). We override it here to add the
  // 'writing' case while keeping everything else identical.
  const _originalRoute = window.routeToCreationForm || null;
  window.routeToCreationForm = function (skill) {
    if (skill && skill.id === 'writing') {
      // Make sure the assignmentSkill hidden field on the vocab modal
      // doesn't accidentally pick up "writing" if the user closes this
      // and opens the vocab modal next.
      try { document.getElementById('assignmentSkill').value = 'vocabulary'; } catch (_) {}
      openWritingAssignmentModal();
      return;
    }
    if (typeof _originalRoute === 'function') return _originalRoute(skill);
    // Fallback: best-effort delegate to the vocabulary path
    if (typeof openVocabularyAssignmentModal === 'function') openVocabularyAssignmentModal();
  };

  // ── Hook into the edit flow so writing assignments edit in this modal ──
  const _originalEdit = window.openEditAssignmentModal || null;
  window.openEditAssignmentModal = async function (assignmentId) {
    const a = (Array.isArray(allAssignments) ? allAssignments : []).find(x => x.id === assignmentId);
    const skill = a && (typeof SKILL_REGISTRY !== 'undefined' ? SKILL_REGISTRY.skillOf(a) : (a.skill || 'vocabulary'));
    if (skill === 'writing' && a) {
      openWritingAssignmentModal({ ...a, id: assignmentId });
      return;
    }
    if (typeof _originalEdit === 'function') return _originalEdit(assignmentId);
  };

  // ── Public ──────────────────────────────────────────────────
  window.openWritingAssignmentModal  = openWritingAssignmentModal;
  window.closeWritingAssignmentModal = closeWritingAssignmentModal;
  window.saveWritingAssignment       = saveWritingAssignment;
})();
