/* ============================================================
   GRAMMAR ASSIGNMENT FORM
   Skill = 'grammar'. Mirrors exam-form.js so it behaves exactly
   like Reading/Listening, but assigns PRACTICE (a CEFR level +
   optional topics), not a scored exam.

   Reads window.GRAMMAR_PRACTICE (grammar-content.js, loaded first)
   for the level + topic lists.

   Data shape written to /assignments:
     {
       title, skill: 'grammar',
       level,                 // 'A2' | 'B1' | 'B1+' | 'B2'
       topics,                // [] = whole level, else [topicId,...]
       topicTitles,           // mirrored titles for the row UI
       targetType, targetClass, targetLevel, targetModule, targetStudents,
       deadline, teacherId, teacherName, createdAt, updatedAt
     }
   ============================================================ */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function GP() { return window.GRAMMAR_PRACTICE || null; }

  // ── Level + topic pickers ────────────────────────────────────
  function populateGrammarLevels() {
    const sel = document.getElementById('grammarLevelSelect');
    if (!sel) return;
    const data = GP();
    const levels = (data && data.levels) ? data.levels : [];
    sel.innerHTML = '<option value="">- Select a level -</option>' +
      levels.map(lv => `<option value="${escapeHtml(lv)}">${escapeHtml(lv)}</option>`).join('');
  }

  function _unitOfTopic(t) { const m = String(t.blurb || '').match(/Units?\s+(\d+)/i); return m ? parseInt(m[1], 10) : 0; }

  function populateGrammarTopics(level) {
    const box = document.getElementById('grammarTopicsBox');
    if (!box) return;
    const data = GP();
    const topics = (data && data.byLevel && data.byLevel[level]) ? data.byLevel[level] : [];
    if (!level) {
      box.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9em; margin: 0;">Pick a level first.</p>';
      return;
    }
    if (!topics.length) {
      box.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9em; margin: 0;">No topics for this level yet.</p>';
      return;
    }

    // Group topics by coursebook Unit (parsed from the blurb), like the student board.
    const groups = {};
    topics.forEach(t => { const u = _unitOfTopic(t); (groups[u] = groups[u] || []).push(t); });
    const units = Object.keys(groups).map(Number).sort((a, b) => a - b);

    const tools = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <button type="button" class="select-action-btn" onclick="grammarTopicsSelectAll(true)">Select all</button>
        <button type="button" class="select-action-btn" onclick="grammarTopicsSelectAll(false)">Clear</button>
        <span style="color:var(--text-muted);font-size:0.8em;margin-left:auto;">None selected = the whole level</span>
      </div>`;

    // Same card look as the Specific Students picker: .student-checkbox-item
    // gives the custom checkbox + hover/checked glow, and the grid container
    // shows several topics per row. The outer #grammarTopicsBox scrolls, so
    // the per-unit grids must not cap their own height.
    const groupsHtml = units.map(u => {
      const rows = groups[u].map(t => {
        const n = (t.questions || []).length;
        return `<label class="student-checkbox-item">
          <input type="checkbox" class="grammar-topic-checkbox" value="${escapeHtml(t.id)}" data-title="${escapeHtml(t.title)}">
          <span class="student-checkbox-name">${escapeHtml(t.title)}</span>
          <span class="student-checkbox-class">${n} Q</span>
        </label>`;
      }).join('');
      return `<div style="margin-bottom:10px;">
          <div style="font-size:0.72em;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent-primary,#3b82f6);margin:8px 2px 6px;">Unit ${u}</div>
          <div class="student-checkbox-items" style="max-height:none;overflow:visible;padding-right:0;">${rows}</div>
        </div>`;
    }).join('');

    box.innerHTML = tools + groupsHtml;
  }

  window.grammarTopicsSelectAll = function (on) {
    document.querySelectorAll('#grammarTopicsBox .grammar-topic-checkbox').forEach(cb => { cb.checked = !!on; });
  };

  window.onGrammarLevelChange = function () {
    const lvl = document.getElementById('grammarLevelSelect').value;
    populateGrammarTopics(lvl);
  };

  // ── Class / student selectors (shared helpers, like exam-form) ──
  async function populateGrammarClasses() {
    if (typeof populateClassDropdownScoped === 'function') {
      populateClassDropdownScoped('grammarTargetClass');
      return;
    }
    const sel = document.getElementById('grammarTargetClass');
    if (!sel) return;
    const fromStudents = (Array.isArray(allStudents) ? allStudents : [])
      .map(s => (s && s.studentClass ? String(s.studentClass).trim() : '')).filter(Boolean);
    let registry = [];
    try {
      const doc = await db.collection('settings').doc('availableClasses').get();
      if (doc.exists && Array.isArray(doc.data().classes)) {
        registry = doc.data().classes.map(s => String(s).trim()).filter(Boolean);
      }
    } catch (_) {}
    const all = [...new Set([...fromStudents, ...registry])].sort();
    sel.innerHTML = '<option value="">- Select a class -</option>' +
      all.map(c => `<option value="${c.replace(/"/g, '&quot;')}">${c.replace(/</g, '&lt;')}</option>`).join('');
  }

  function populateGrammarStudents() {
    if (typeof window.StudentPicker !== 'undefined') {
      window.StudentPicker.render({ containerId: 'grammarTargetStudentsList', checkboxClass: 'grammar-student-checkbox' });
      return;
    }
    const list = document.getElementById('grammarTargetStudentsList');
    if (!list) return;
    const visible = (typeof studentsAllowedForCurrentUser === 'function')
      ? studentsAllowedForCurrentUser() : (Array.isArray(allStudents) ? allStudents : []);
    list.innerHTML = (!visible || !visible.length)
      ? '<p style="color: var(--text-muted); font-size: 0.9em;">No students in your classes.</p>'
      : visible.map(s => `<label class="wr-student-row">
          <input type="checkbox" class="grammar-student-checkbox" value="${s.id}">
          <span class="wr-student-name">${(s.name || s.email || 'Unknown').replace(/</g, '&lt;')}</span>
          <span class="wr-student-class">${(s.studentClass || '').replace(/</g, '&lt;')}</span>
        </label>`).join('');
  }

  window.onGrammarTargetTypeChange = function () {
    const v = document.getElementById('grammarTargetType').value;
    const boxes = {
      class:      document.getElementById('grammarClassTargetGroup'),
      level:      document.getElementById('grammarLevelTargetGroup'),
      module:     document.getElementById('grammarModuleTargetGroup'),
      individual: document.getElementById('grammarIndividualTargetGroup')
    };
    Object.keys(boxes).forEach(key => {
      if (boxes[key]) boxes[key].style.display = (key === v) ? (key === 'individual' ? 'block' : '') : 'none';
    });
  };

  // ── Open / close ─────────────────────────────────────────────
  function openGrammarAssignmentModal(prefill) {
    const modal = document.getElementById('grammarAssignmentModal');
    if (!modal) return;

    document.getElementById('grammarAssignmentId').value = '';
    document.getElementById('grammarAssignmentSkill').value = 'grammar';
    document.getElementById('grammarTitle').value = '';
    document.getElementById('grammarTargetType').value = 'class';
    document.getElementById('grammarDeadline').value = '';
    document.getElementById('grammarModalTitle').innerHTML = '✏️ New Grammar Assignment';

    if (typeof applyRoleScopeToTargetDropdown === 'function') {
      applyRoleScopeToTargetDropdown('grammarTargetType');
    }
    populateGrammarLevels();
    // Default to the first level so the topic list is populated.
    const data = GP();
    const firstLevel = (data && data.levels && data.levels[0]) ? data.levels[0] : '';
    document.getElementById('grammarLevelSelect').value = firstLevel;
    populateGrammarTopics(firstLevel);
    populateGrammarClasses();
    populateGrammarStudents();
    window.onGrammarTargetTypeChange();

    if (prefill && typeof prefill === 'object') applyGrammarPrefill(prefill);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeGrammarAssignmentModal() {
    const modal = document.getElementById('grammarAssignmentModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── Save ─────────────────────────────────────────────────────
  async function saveGrammarAssignment() {
    const saveBtn = document.querySelector('#grammarAssignmentModal .modal-btn-save');
    const originalText = saveBtn ? saveBtn.innerHTML : '';

    const assignmentId = document.getElementById('grammarAssignmentId').value;
    const title        = document.getElementById('grammarTitle').value.trim();
    const level        = document.getElementById('grammarLevelSelect').value;
    const targetType   = document.getElementById('grammarTargetType').value;
    const deadline     = document.getElementById('grammarDeadline').value;

    if (typeof clearFieldErrors === 'function') clearFieldErrors('grammarAssignmentModal');
    const errs = (typeof validateAll === 'function') ? validateAll([
      { id: 'grammarTitle',        msg: 'Assignment title is required.' },
      { id: 'grammarLevelSelect',  msg: 'Please pick a level.' },
      { id: 'grammarDeadline',     msg: 'Due date cannot be empty.' },
      { id: 'grammarDeadline',     msg: 'Year must be between 2024 and 2099.',
        test: v => { const d = new Date(v); return v && !isNaN(d.getTime()) && d.getFullYear() >= 2024 && d.getFullYear() <= 2099; } },
      { id: 'grammarTargetClass',  msg: 'Please select a target class.',  when: () => targetType === 'class' },
      { id: 'grammarTargetLevel',  msg: 'Please select a target level.',  when: () => targetType === 'level' },
      { id: 'grammarTargetModule', msg: 'Please select a target module.', when: () => targetType === 'module' }
    ]) : [];
    if (targetType === 'individual') {
      const checked = document.querySelectorAll('.grammar-student-checkbox:checked').length;
      if (checked === 0) {
        const anchor = document.getElementById('grammarTargetStudentsList');
        if (anchor) errs.push({ id: 'grammarTargetStudentsList', msg: 'Please select at least one student.', el: anchor });
      }
    }
    if (errs.length) {
      if (typeof showFieldErrors === 'function') showFieldErrors(errs, 'grammarAssignmentModal');
      return;
    }
    const deadlineDate = new Date(deadline);

    let targetClass = '', targetLevel = '', targetModule = '', targetStudents = [];
    if (targetType === 'class') {
      targetClass = (typeof _normCls === 'function')
        ? _normCls(document.getElementById('grammarTargetClass').value)
        : (document.getElementById('grammarTargetClass').value || '').trim().toUpperCase();
    } else if (targetType === 'level') {
      targetLevel = (document.getElementById('grammarTargetLevel').value || '').trim();
    } else if (targetType === 'module') {
      targetModule = (document.getElementById('grammarTargetModule').value || '').trim();
    } else if (targetType === 'individual') {
      targetStudents = Array.from(document.querySelectorAll('.grammar-student-checkbox:checked')).map(cb => cb.value);
    }

    // Topics: checked = subset, none checked = whole level.
    const checkedTopics = Array.from(document.querySelectorAll('.grammar-topic-checkbox:checked'));
    const topics      = checkedTopics.map(cb => cb.value);
    const topicTitles = checkedTopics.map(cb => cb.getAttribute('data-title') || cb.value);

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';
      saveBtn.classList.add('saving');
    }

    const data = {
      title, skill: 'grammar',
      level, topics, topicTitles,
      targetType, targetClass, targetLevel, targetModule, targetStudents,
      deadline: deadlineDate,
      teacherId: auth.currentUser.uid,
      teacherName: (typeof userData !== 'undefined' && userData && userData.name) || auth.currentUser.email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (assignmentId) {
        await db.collection('assignments').doc(assignmentId).update(data);
        if (typeof showSuccess === 'function') showSuccess('Updated', '✏️ Grammar assignment updated.');
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('assignments').add(data);
        if (typeof showSuccess === 'function') showSuccess('Created', '✏️ Grammar assignment created.');
      }
      closeGrammarAssignmentModal();
      if (typeof loadAssignments === 'function') await loadAssignments();
    } catch (err) {
      console.error('Error saving grammar assignment:', err);
      if (typeof showError === 'function') showError('Save Failed', err.message || 'Could not save the assignment.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText || 'Save Assignment';
        saveBtn.classList.remove('saving');
      }
    }
  }

  // ── Edit prefill ─────────────────────────────────────────────
  function applyGrammarPrefill(a) {
    document.getElementById('grammarAssignmentId').value = a.id || '';
    document.getElementById('grammarTitle').value        = a.title || '';
    document.getElementById('grammarTargetType').value   = a.targetType || 'class';
    if (a.level) {
      document.getElementById('grammarLevelSelect').value = a.level;
      populateGrammarTopics(a.level);
    }
    if (Array.isArray(a.topics) && a.topics.length) {
      document.querySelectorAll('.grammar-topic-checkbox').forEach(cb => {
        cb.checked = a.topics.includes(cb.value);
      });
    }
    if (a.deadline) {
      const d = a.deadline.toDate ? a.deadline.toDate() : new Date(a.deadline);
      document.getElementById('grammarDeadline').value = d.toISOString().split('T')[0];
    }
    window.onGrammarTargetTypeChange();
    if (a.targetType === 'class' && a.targetClass) {
      document.getElementById('grammarTargetClass').value = a.targetClass;
    } else if (a.targetType === 'level' && a.targetLevel) {
      document.getElementById('grammarTargetLevel').value = a.targetLevel;
    } else if (a.targetType === 'module' && a.targetModule) {
      document.getElementById('grammarTargetModule').value = a.targetModule;
    } else if (a.targetType === 'individual' && Array.isArray(a.targetStudents)) {
      setTimeout(() => {
        if (typeof window.StudentPicker !== 'undefined') {
          window.StudentPicker.setSelected('grammarTargetStudentsList', 'grammar-student-checkbox', a.targetStudents);
        } else {
          document.querySelectorAll('.grammar-student-checkbox').forEach(cb => { cb.checked = a.targetStudents.includes(cb.value); });
        }
      }, 50);
    }
    document.getElementById('grammarModalTitle').innerHTML = '🖊️ Edit Grammar Assignment';
  }

  // ── Hook into the routing globals (chain off earlier overrides) ──
  const _prevRoute = window.routeToCreationForm || null;
  window.routeToCreationForm = function (skill) {
    if (skill && skill.id === 'grammar') {
      try { document.getElementById('assignmentSkill').value = 'vocabulary'; } catch (_) {}
      openGrammarAssignmentModal();
      return;
    }
    if (typeof _prevRoute === 'function') return _prevRoute(skill);
  };

  const _prevEdit = window.openEditAssignmentModal || null;
  window.openEditAssignmentModal = async function (assignmentId) {
    const a = (Array.isArray(allAssignments) ? allAssignments : []).find(x => x.id === assignmentId);
    const skill = a && (typeof SKILL_REGISTRY !== 'undefined' ? SKILL_REGISTRY.skillOf(a) : (a.skill || 'vocabulary'));
    if (a && skill === 'grammar') {
      openGrammarAssignmentModal({ ...a, id: assignmentId });
      return;
    }
    if (typeof _prevEdit === 'function') return _prevEdit(assignmentId);
  };

  // ── Public ──────────────────────────────────────────────────
  window.openGrammarAssignmentModal  = openGrammarAssignmentModal;
  window.closeGrammarAssignmentModal = closeGrammarAssignmentModal;
  window.saveGrammarAssignment       = saveGrammarAssignment;
})();
