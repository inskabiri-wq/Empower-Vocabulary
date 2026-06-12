/* ============================================================
   EXAM ASSIGNMENT FORM — Phase 2 (reading + listening)
   Shared modal logic for skill='reading' and skill='listening'.
   Replaces the placeholder where those tiles opened the
   vocabulary form. Reads from EXAM_REGISTRY for the exam picker.

   Data shape written to /assignments:
     {
       title, skill: 'reading' | 'listening',
       examId,                   // e.g. 'b2-exam-1' / 'fsmept-exam-1'
       examTitle, examLevel,     // mirrored from the registry for the row UI
       targetType, targetClass, targetLevel, targetModule, targetStudents,
       deadline, teacherId, teacherName,
       createdAt, updatedAt
     }
   ============================================================ */

(function () {
  'use strict';

  // Active skill while the modal is open ('reading' or 'listening').
  // Set when openExamAssignmentModal(skill) is called.
  let activeExamSkill = 'reading';

  // ── Open / close ─────────────────────────────────────────────
  function openExamAssignmentModal(skillId, prefill) {
    activeExamSkill = (skillId === 'listening') ? 'listening' : 'reading';
    const modal = document.getElementById('examAssignmentModal');
    if (!modal) return;

    // Reset
    document.getElementById('examAssignmentId').value    = '';
    document.getElementById('examAssignmentSkill').value = activeExamSkill;
    document.getElementById('examTitle').value           = '';
    document.getElementById('examTargetType').value      = 'class';
    document.getElementById('examDeadline').value        = '';

    // Title bar reflects which skill the picker is for
    const skillMeta = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.get(activeExamSkill) : null;
    const titleEl = document.getElementById('examModalTitle');
    if (titleEl && skillMeta) {
      titleEl.innerHTML = `${skillMeta.icon} New ${skillMeta.name} Assignment`;
    }

    // Role-based scope — non-admin loses Level/Module options + class
    // dropdown narrows to their assigned classes + student picker to
    // students in those classes.
    if (typeof applyRoleScopeToTargetDropdown === 'function') {
      applyRoleScopeToTargetDropdown('examTargetType');
    }
    populateExamDropdown();
    if (typeof populateClassDropdownScoped === 'function') {
      populateClassDropdownScoped('examTargetClass');
    } else {
      populateExamClasses();
    }
    populateExamStudents();
    onExamTargetTypeChange();

    if (prefill && typeof prefill === 'object') {
      applyExamPrefill(prefill);
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeExamAssignmentModal() {
    const modal = document.getElementById('examAssignmentModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── Exam dropdown ────────────────────────────────────────────
  // Phase G — exams are grouped under <optgroup label="LEVEL"> so the
  // hierarchy (skill → level → exam) is visible at a glance. Unavailable
  // exams render disabled with a "(unavailable)" suffix so admins can
  // see what's offline without leaving the picker. We pull from
  // EXAM_REGISTRY.examsForLevel() — the canonical catalog.
  function populateExamDropdown() {
    const sel = document.getElementById('examPickerSelect');
    const hint = document.getElementById('examPickerHint');
    if (!sel) return;
    if (typeof EXAM_REGISTRY === 'undefined') {
      sel.innerHTML = '<option value="">Exam registry not loaded</option>';
      return;
    }
    const levels = EXAM_REGISTRY.levelsFor(activeExamSkill);
    // Total available across all levels — drives the "N exams"
    // banner and the empty-state branch.
    let availableCount = 0;
    let unavailableCount = 0;

    const groupsHtml = levels.map(lvl => {
      const exams = EXAM_REGISTRY.examsForLevel(activeExamSkill, lvl);
      if (!exams.length) return '';   // skip empty levels to keep the dropdown tidy
      const opts = exams.map(e => {
        const isAvail = (e.available !== false);
        if (isAvail) availableCount++; else unavailableCount++;
        const label = e.title || e.id;
        const suffix = isAvail ? '' : ' (unavailable)';
        return `<option value="${escapeAttr(e.id)}" ${isAvail ? '' : 'disabled'}>
          ${escapeHtml(label)}${suffix}
        </option>`;
      }).join('');
      return `<optgroup label="${escapeAttr(lvl)}">${opts}</optgroup>`;
    }).join('');

    if (availableCount === 0 && unavailableCount === 0) {
      sel.innerHTML = '<option value="">— No exams available yet —</option>';
      if (hint) {
        hint.textContent = `No ${activeExamSkill} exams are registered yet. Add entries to y/assignments/js/exam-registry.js to make them assignable.`;
      }
      return;
    }

    sel.innerHTML = '<option value="">— Select an exam —</option>' + groupsHtml;
    if (hint) {
      const unavailNote = unavailableCount > 0
        ? ` · <span style="color:#fbbf24;">${unavailableCount} disabled</span>`
        : '';
      hint.innerHTML = `
        <span style="display:inline-block; background:rgba(45,212,191,0.15);
                     color:#2dd4bf; padding:3px 10px; border-radius:10px;
                     font-weight:600;">
          ${availableCount} ${activeExamSkill} exam${availableCount === 1 ? '' : 's'} available
        </span>${unavailNote}
        <span style="margin-left:6px;">— add more or toggle availability in
          <code style="background:rgba(255,255,255,0.06); padding:1px 5px; border-radius:4px;">
            y/assignments/js/exam-registry.js
          </code>
        </span>`;
    }
  }

  // ── Tiny inline escape helpers (avoid pulling another script in) ──
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── Class / student selectors ────────────────────────────────
  // Class list merges student-derived classes with admin-registered
  // ones (settings/availableClasses). Refetched on each open so newly
  // added classes appear without a page reload.
  async function populateExamClasses() {
    const sel = document.getElementById('examTargetClass');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Loading classes —</option>';

    const fromStudents = (Array.isArray(allStudents) ? allStudents : [])
      .map(s => (s && s.studentClass ? String(s.studentClass).trim() : ''))
      .filter(Boolean);

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

  function populateExamStudents() {
    // Same shared picker as the writing form. See student-picker.js.
    if (typeof window.StudentPicker !== 'undefined') {
      window.StudentPicker.render({
        containerId:   'examTargetStudentsList',
        checkboxClass: 'exam-student-checkbox'
      });
      return;
    }
    // Fallback: bare list, no search. Kept for paranoia.
    const list = document.getElementById('examTargetStudentsList');
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
          <input type="checkbox" class="exam-student-checkbox" value="${s.id}">
          <span class="wr-student-name">${name}</span>
          <span class="wr-student-class">${cls}</span>
        </label>
      `;
    }).join('');
  }

  window.onExamTargetTypeChange = function () {
    const v = document.getElementById('examTargetType').value;
    const boxes = {
      class:    document.getElementById('examClassTargetGroup'),
      level:    document.getElementById('examLevelTargetGroup'),
      module:   document.getElementById('examModuleTargetGroup'),
      individual: document.getElementById('examIndividualTargetGroup')
    };
    Object.keys(boxes).forEach(key => {
      if (boxes[key]) boxes[key].style.display = (key === v) ? (key === 'individual' ? 'block' : '') : 'none';
    });
  };

  // ── Save ─────────────────────────────────────────────────────
  async function saveExamAssignment() {
    const saveBtn = document.querySelector('#examAssignmentModal .modal-btn-save');
    const originalText = saveBtn ? saveBtn.innerHTML : '';

    const assignmentId = document.getElementById('examAssignmentId').value;
    const skill        = document.getElementById('examAssignmentSkill').value || 'reading';
    const title        = document.getElementById('examTitle').value.trim();
    const examId       = document.getElementById('examPickerSelect').value;
    const targetType   = document.getElementById('examTargetType').value;
    const deadline     = document.getElementById('examDeadline').value;

    // ── Inline validation (Phase A) ──
    clearFieldErrors('examAssignmentModal');
    const errs = validateAll([
      { id: 'examTitle',         msg: 'Assignment title is required.' },
      { id: 'examPickerSelect',  msg: 'Please pick an exam from the dropdown.' },
      { id: 'examDeadline',      msg: 'Due date cannot be empty.' },
      { id: 'examDeadline',      msg: 'Year must be between 2024 and 2099.',
        test: v => { const d = new Date(v); return v && !isNaN(d.getTime()) && d.getFullYear() >= 2024 && d.getFullYear() <= 2099; } },
      { id: 'examTargetClass',   msg: 'Please select a target class.',  when: () => targetType === 'class' },
      { id: 'examTargetLevel',   msg: 'Please select a target level.',  when: () => targetType === 'level' },
      { id: 'examTargetModule',  msg: 'Please select a target module.', when: () => targetType === 'module' }
    ]);
    if (targetType === 'individual') {
      const checked = document.querySelectorAll('.exam-student-checkbox:checked').length;
      if (checked === 0) {
        const anchor = document.getElementById('examTargetStudentsList');
        if (anchor) errs.push({ id: 'examTargetStudentsList', msg: 'Please select at least one student.', el: anchor });
      }
    }
    if (errs.length) {
      showFieldErrors(errs, 'examAssignmentModal');
      return;
    }
    const deadlineDate = new Date(deadline);

    // Collect target values (validation already happened above).
    let targetClass = '', targetLevel = '', targetModule = '', targetStudents = [];
    if (targetType === 'class') {
      targetClass = (typeof _normCls === 'function')
        ? _normCls(document.getElementById('examTargetClass').value)
        : (document.getElementById('examTargetClass').value || '').trim().toUpperCase();
    } else if (targetType === 'level') {
      targetLevel = (document.getElementById('examTargetLevel').value || '').trim();
    } else if (targetType === 'module') {
      targetModule = (document.getElementById('examTargetModule').value || '').trim();
    } else if (targetType === 'individual') {
      const checks = document.querySelectorAll('.exam-student-checkbox:checked');
      targetStudents = Array.from(checks).map(cb => cb.value);
    }

    // Mirror exam metadata onto the assignment for the row UI
    const exam = (typeof EXAM_REGISTRY !== 'undefined') ? EXAM_REGISTRY.find(skill, examId) : null;
    const examTitle = exam ? (exam.title || examId) : examId;
    const examLevel = exam ? (exam.level || null) : null;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';
      saveBtn.classList.add('saving');
    }

    const data = {
      title, skill,
      examId, examTitle, examLevel,
      targetType, targetClass, targetLevel, targetModule, targetStudents,
      deadline: deadlineDate,
      teacherId: auth.currentUser.uid,
      teacherName: (typeof userData !== 'undefined' && userData?.name) || auth.currentUser.email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (assignmentId) {
        await db.collection('assignments').doc(assignmentId).update(data);
        showSuccess('Updated', `${skill === 'reading' ? '📖 Reading' : '🎧 Listening'} assignment updated.`);
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('assignments').add(data);
        showSuccess('Created', `${skill === 'reading' ? '📖 Reading' : '🎧 Listening'} assignment created.`);
      }
      closeExamAssignmentModal();
      if (typeof loadAssignments === 'function') await loadAssignments();
    } catch (err) {
      console.error('Error saving exam assignment:', err);
      showError('Save Failed', err.message || 'Could not save the assignment.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText || 'Save Assignment';
        saveBtn.classList.remove('saving');
      }
    }
  }

  // ── Edit prefill ─────────────────────────────────────────────
  function applyExamPrefill(a) {
    document.getElementById('examAssignmentId').value = a.id || '';
    document.getElementById('examTitle').value        = a.title || '';
    document.getElementById('examPickerSelect').value = a.examId || '';
    document.getElementById('examTargetType').value   = a.targetType || 'class';
    if (a.deadline) {
      const d = a.deadline.toDate ? a.deadline.toDate() : new Date(a.deadline);
      document.getElementById('examDeadline').value = d.toISOString().split('T')[0];
    }
    onExamTargetTypeChange();
    if (a.targetType === 'class' && a.targetClass) {
      document.getElementById('examTargetClass').value = a.targetClass;
    } else if (a.targetType === 'level' && a.targetLevel) {
      document.getElementById('examTargetLevel').value = a.targetLevel;
    } else if (a.targetType === 'module' && a.targetModule) {
      document.getElementById('examTargetModule').value = a.targetModule;
    } else if (a.targetType === 'individual' && Array.isArray(a.targetStudents)) {
      setTimeout(() => {
        if (typeof window.StudentPicker !== 'undefined') {
          window.StudentPicker.setSelected('examTargetStudentsList', 'exam-student-checkbox', a.targetStudents);
        } else {
          document.querySelectorAll('.exam-student-checkbox').forEach(cb => {
            cb.checked = a.targetStudents.includes(cb.value);
          });
        }
      }, 50);
    }
    document.getElementById('examModalTitle').innerHTML = (a.skill === 'listening' ? '🖊️ Edit Listening Assignment' : '🖊️ Edit Reading Assignment');
  }

  // ── Hook into the routing globals ────────────────────────────
  // Chain off any earlier override (writing-form.js sets one for
  // skill === 'writing'). For reading/listening we override here.
  const _prevRoute = window.routeToCreationForm || null;
  window.routeToCreationForm = function (skill) {
    if (skill && (skill.id === 'reading' || skill.id === 'listening')) {
      // Defensive: clear the vocab modal's hidden skill so subsequent
      // vocab opens default to 'vocabulary'.
      try { document.getElementById('assignmentSkill').value = 'vocabulary'; } catch (_) {}
      openExamAssignmentModal(skill.id);
      return;
    }
    if (typeof _prevRoute === 'function') return _prevRoute(skill);
  };

  const _prevEdit = window.openEditAssignmentModal || null;
  window.openEditAssignmentModal = async function (assignmentId) {
    const a = (Array.isArray(allAssignments) ? allAssignments : []).find(x => x.id === assignmentId);
    const skill = a && (typeof SKILL_REGISTRY !== 'undefined' ? SKILL_REGISTRY.skillOf(a) : (a.skill || 'vocabulary'));
    if (a && (skill === 'reading' || skill === 'listening')) {
      openExamAssignmentModal(skill, { ...a, id: assignmentId });
      return;
    }
    if (typeof _prevEdit === 'function') return _prevEdit(assignmentId);
  };

  // ── Public ──────────────────────────────────────────────────
  window.openExamAssignmentModal  = openExamAssignmentModal;
  window.closeExamAssignmentModal = closeExamAssignmentModal;
  window.saveExamAssignment       = saveExamAssignment;
})();
