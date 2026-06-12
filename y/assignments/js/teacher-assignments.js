/* Teacher Dashboard - Assignments Management */

// ============================================
// GLOBAL STATE
// ============================================
let allAssignments = [];
let allCompletions = {}; // { odUserId_assignmentId: { completed, bestScore, ... } }
// Phase G fix — writing submissions, keyed `${uid}_${aid}`. Used by
// calculateAssignmentCompletion() to count a writing essay as "Done"
// even when the assignmentCompletions doc is missing (legacy bug:
// writing-exam.js was writing userId not odUserId, so its completion
// docs didn't surface on the `where('odUserId', ==, uid)` query the
// admin loader uses). This map plus the per-card derivation closes
// the gap until the existing data is backfilled.
let allWritingSubs = {};

// Active skill filter for the Assignments tab. Defaults to 'all' → no
// filtering. Pills in #assignmentsSkillStrip flip this. Each render
// reads this value to narrow what's shown.
let currentAssignmentSkillFilter = 'all';

// ─── Live listener handles ──────────────────────────────────
// Phase D+: assignments + completions both stay live via
// onSnapshot so the row count / completion bar update without
// requiring the teacher to reload. We track the unsubscribers
// so they can be torn down on tab close (no orphan listeners
// burning Firestore reads in the background).
let _assignmentsUnsub = null;
let _completionsUnsub = null;
window.addEventListener('beforeunload', () => {
  if (typeof _assignmentsUnsub === 'function') { try { _assignmentsUnsub(); } catch (_) {} }
  if (typeof _completionsUnsub === 'function') { try { _completionsUnsub(); } catch (_) {} }
});

// Tiny helper used to derive translucent rgba() backgrounds from the
// SKILL_REGISTRY accent hex codes for the per-skill badges on rows.
function hexToRgb(hex) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(String(hex || ''));
  if (!m) return '255,255,255';
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

// ============================================
// SKILL PICKER + FILTER STRIP — Phase 1 of the skill-based architecture.
// ============================================
function renderSkillFilterStrip() {
  const strip = document.getElementById('assignmentsSkillStrip');
  if (!strip || typeof SKILL_REGISTRY === 'undefined') return;
  const skills = SKILL_REGISTRY.all();
  // Build pills: "All Skills" + one per registry entry.
  let html = `<button class="skill-pill ${currentAssignmentSkillFilter === 'all' ? 'active' : ''}" data-skill="all" role="tab" aria-selected="${currentAssignmentSkillFilter === 'all'}">All Skills</button>`;
  skills.forEach(s => {
    const isActive = currentAssignmentSkillFilter === s.id;
    const dim = s.status === 'coming-soon' ? 'opacity: 0.55;' : '';
    html += `<button class="skill-pill ${isActive ? 'active' : ''}" data-skill="${s.id}" role="tab" aria-selected="${isActive}" style="${dim}">${s.icon} ${s.name}</button>`;
  });
  strip.innerHTML = html;
  // One click handler on the strip — delegates to pills inside.
  if (!strip.dataset.wired) {
    strip.addEventListener('click', (e) => {
      const pill = e.target.closest('.skill-pill');
      if (!pill) return;
      currentAssignmentSkillFilter = pill.dataset.skill || 'all';
      renderSkillFilterStrip();
      renderAssignments();
    });
    strip.dataset.wired = '1';
  }
}

function openSkillPickerModal() {
  if (typeof SKILL_REGISTRY === 'undefined') {
    console.warn('SKILL_REGISTRY not loaded — falling back to vocabulary form');
    openVocabularyAssignmentModal();
    return;
  }
  const grid = document.getElementById('skillPickerGrid');
  const modal = document.getElementById('skillPickerModal');
  if (!grid || !modal) return;

  grid.innerHTML = SKILL_REGISTRY.all().map(s => {
    const comingSoon = s.status === 'coming-soon';
    return `
      <button type="button"
              class="skill-picker-tile"
              data-skill="${s.id}"
              data-status="${s.status}"
              style="
                position: relative;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 14px;
                padding: 22px 16px;
                color: var(--text-primary);
                cursor: pointer;
                text-align: center;
                transition: 0.2s;
                ${comingSoon ? 'opacity: 0.55;' : ''}
              "
              onmouseover="this.style.borderColor='${s.accent}'; this.style.background='rgba(255,255,255,0.06)';"
              onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.background='rgba(255,255,255,0.04)';">
        <div style="font-size: 2.2em; line-height: 1; margin-bottom: 8px;">${s.icon}</div>
        <div style="font-weight: 600; font-size: 1.05em; color: ${s.accent};">${s.name}</div>
        <div style="font-size: 0.85em; color: var(--text-muted); margin-top: 4px;">${s.subtitle || ''}</div>
        ${comingSoon ? `<span style="position: absolute; top: 8px; right: 8px; background: rgba(245,158,11,0.18); color: #fbbf24; font-size: 0.7em; padding: 2px 8px; border-radius: 10px;">SOON</span>` : ''}
      </button>
    `;
  }).join('');

  // One delegated click handler for the whole grid.
  grid.onclick = (e) => {
    const tile = e.target.closest('.skill-picker-tile');
    if (!tile) return;
    const skillId = tile.dataset.skill;
    const skill = SKILL_REGISTRY.get(skillId);
    if (!skill) return;
    closeSkillPickerModal();
    if (skill.status === 'coming-soon') {
      showComingSoon(skill);
      return;
    }
    routeToCreationForm(skill);
  };

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSkillPickerModal() {
  const modal = document.getElementById('skillPickerModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

function showComingSoon(skill) {
  const modal = document.getElementById('comingSoonModal');
  document.getElementById('comingSoonIcon').textContent  = skill.icon;
  document.getElementById('comingSoonTitle').textContent = `${skill.name} — Coming soon`;
  document.getElementById('comingSoonBody').textContent  =
    `${skill.name} assignments are structurally supported but the creation form isn't built yet. ` +
    `We'll wire it up in the next phase. Other skills (currently available: ` +
    SKILL_REGISTRY.active().map(a => a.name).join(', ') + `) can be assigned now.`;
  if (modal) modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeComingSoonModal() {
  const modal = document.getElementById('comingSoonModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Routes the picker's skill choice to the right creation form.
// For Phase 1 only 'vocabulary' has a real form — the others land here
// but the registry says they're coming-soon so the picker already
// short-circuited above. This switch is the hook point for Phase 2+.
function routeToCreationForm(skill) {
  switch (skill.id) {
    case 'vocabulary':
      openVocabularyAssignmentModal();
      break;
    // 'reading' / 'listening' are handled by exam-form.js which
    // overrides routeToCreationForm and intercepts them before this
    // function runs. They never reach this switch.
    // 'writing' is handled by writing-form.js the same way.
    default:
      // Coming-soon skills land here as a safety net.
      showComingSoon(skill);
  }
}

// Wraps the existing assignment modal open with a skill stamp.
function openVocabularyAssignmentModal(skillOverride) {
  // Reset modal to "create" mode and stamp the skill.
  document.getElementById('assignmentId').value = '';
  document.getElementById('assignmentSkill').value = skillOverride || 'vocabulary';
  // Update modal title to reflect the picked skill.
  const skill = SKILL_REGISTRY.get(skillOverride || 'vocabulary');
  const titleEl = document.getElementById('assignmentModalTitle');
  if (titleEl && skill) {
    titleEl.innerHTML = `${skill.icon} New ${skill.name} Assignment`;
  }
  // Delegate to the existing creation flow.
  if (typeof openCreateAssignmentModal === 'function') {
    openCreateAssignmentModal();
  } else {
    const modal = document.getElementById('assignmentModal');
    if (modal) modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

window.openSkillPickerModal    = openSkillPickerModal;
window.closeSkillPickerModal   = closeSkillPickerModal;
window.closeComingSoonModal    = closeComingSoonModal;
window.openVocabularyAssignmentModal = openVocabularyAssignmentModal;

// ============================================================
// PREVIEW AS STUDENT — Phase C (extended in Phase F)
// Lets a teacher click any assignment row and see what the
// student sees. Routing per skill:
//   • writing  → writing-exam.html?preview=1&assignmentId=X
//                (its own dedicated standalone page).
//   • reading  → student-dashboard.html with previewSkill=reading +
//                previewLevel + previewExam params. The dashboard's
//                _previewModeBoot hook (student.js) detects them and
//                calls openReadingExam() with __previewMode set, so
//                session writes / XP / activity logs are all skipped.
//   • listening → same pattern, calls startListeningExam().
//   • vocabulary → static card preview modal (the vocab trainer has
//                no concept of a per-assignment preview).
// ============================================================
function previewAssignmentAsStudent(assignmentId) {
  const a = allAssignments.find(x => x.id === assignmentId);
  if (!a) {
    if (typeof showError === 'function') showError('Not found', 'Assignment not found.');
    return;
  }
  const skill = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.skillOf(a) : (a.skill || 'vocabulary');

  if (skill === 'writing') {
    // Open the secure writing page in a new tab with the preview flag.
    const url = `writing-exam.html?preview=1&assignmentId=${encodeURIComponent(assignmentId)}`;
    window.open(url, '_blank', 'noopener');
    return;
  }

  if (skill === 'reading' || skill === 'listening') {
    // Need an examId to know which exam to open. If the assignment
    // doesn't have one (legacy / mis-saved), fall back to the
    // generic placeholder modal so the teacher still gets context.
    if (!a.examId) {
      showAssignmentPreviewModal(a, skill);
      return;
    }
    const params = new URLSearchParams({
      preview:      '1',
      previewSkill: skill,
      previewExam:  a.examId,
      previewLevel: a.examLevel || (skill === 'listening' ? 'exam' : ''),
      previewMode:  'untimed'   // teachers don't need a countdown to review
    });
    const url = `student-dashboard.html?${params.toString()}`;
    window.open(url, '_blank', 'noopener');
    return;
  }

  // Vocabulary / unknown → static card preview modal.
  showAssignmentPreviewModal(a, skill);
}
window.previewAssignmentAsStudent = previewAssignmentAsStudent;

function showAssignmentPreviewModal(a, skill) {
  const skillMeta = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.get(skill) : null;
  const accent = skillMeta?.accent || 'var(--accent-primary)';
  const icon   = skillMeta?.icon   || '📋';
  const name   = skillMeta?.name   || skill;

  // Build a one-shot modal so we don't permanently inject HTML.
  let modal = document.getElementById('previewAssignmentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'previewAssignmentModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const deadline = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline);
  const dueText  = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Body varies by skill — show what the student will see when they
  // click into the assignment.
  let bodySpecific = '';
  if (skill === 'reading' || skill === 'listening') {
    bodySpecific = `
      <div style="background: rgba(${_hexToRgbForPreview(accent)},0.10); border:1px solid rgba(${_hexToRgbForPreview(accent)},0.30); border-radius:10px; padding:14px; margin-top:14px;">
        <div style="font-weight:700; color:${accent}; margin-bottom:6px;">📝 Exam</div>
        <div style="color: var(--text-primary);">${(a.examTitle || a.examId || '(no exam selected)').replace(/</g,'&lt;')}</div>
        ${a.examLevel ? `<div style="font-size:0.85em; color: var(--text-muted); margin-top:4px;">Level: ${a.examLevel}</div>` : ''}
      </div>
      <p style="margin-top:14px; color: var(--text-muted); font-size: 0.88em;">
        The student clicks ▶ Start ${name} on their dashboard → lands on the ${name} skill home → picks the exam above.
      </p>
    `;
  } else if (skill === 'vocabulary') {
    bodySpecific = `
      <div style="background: rgba(${_hexToRgbForPreview(accent)},0.10); border:1px solid rgba(${_hexToRgbForPreview(accent)},0.30); border-radius:10px; padding:14px; margin-top:14px;">
        <div style="font-weight:700; color:${accent}; margin-bottom:8px;">📚 Vocabulary practice details</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.92em;">
          <div><span style="color:var(--text-muted);">Book:</span> ${(a.book === 'gateway' ? '📗 Gateway' : '📘 Empower')}</div>
          <div><span style="color:var(--text-muted);">Level:</span> ${a.level || '—'}</div>
          <div><span style="color:var(--text-muted);">Unit:</span> ${a.unit || 'All Units'}</div>
          <div><span style="color:var(--text-muted);">Activity:</span> ${a.activity === 'all' ? 'Any Activity' : (a.activity || 'Any Activity')}</div>
        </div>
      </div>
      <p style="margin-top:14px; color: var(--text-muted); font-size: 0.88em;">
        The student clicks ▶ Start Practice → the vocabulary trainer loads with the book/level/unit/activity above pre-selected.
        They score points and must reach 100% to mark the assignment complete.
      </p>
    `;
  } else {
    bodySpecific = `
      <p style="margin-top:14px; color: var(--text-muted);">
        The ${name} skill runner isn't built yet — preview will follow when it is.
      </p>
    `;
  }

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
        <h3 style="margin:0;">👤 Preview as Student</h3>
        <button class="modal-btn modal-btn-cancel" onclick="closeAssignmentPreviewModal()" style="padding: 6px 14px;">Close</button>
      </div>

      <div style="background: rgba(${_hexToRgbForPreview(accent)},0.05); border-radius: 12px; padding: 16px; border-left: 4px solid ${accent};">
        <div style="display:flex; align-items:center; gap:8px; font-size:0.78em; color:${accent}; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:6px;">
          ${icon} ${name}
        </div>
        <h4 style="color: var(--text-primary); margin: 0 0 4px 0;">${(a.title || 'Assignment').replace(/</g,'&lt;')}</h4>
        <div style="color: var(--text-muted); font-size: 0.85em;">📅 Due: ${dueText}</div>
      </div>

      ${bodySpecific}

      <p style="margin-top:18px; color: var(--text-muted); font-size:0.78em; font-style: italic;">
        This is what your students will see when they open the assignment from their dashboard.
      </p>
    </div>
  `;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAssignmentPreviewModal() {
  const m = document.getElementById('previewAssignmentModal');
  if (m) m.classList.remove('active');
  document.body.style.overflow = '';
}
window.closeAssignmentPreviewModal = closeAssignmentPreviewModal;

// Local hex→rgb helper — keeps preview's translucent backgrounds in
// sync with the skill accent without depending on the global hexToRgb.
function _hexToRgbForPreview(hex) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(String(hex || ''));
  return m ? `${parseInt(m[1],16)}, ${parseInt(m[2],16)}, ${parseInt(m[3],16)}` : '167, 139, 250';
}

// `_normCls` is declared once in teacher/js/students.js (loads first
// among the teacher scripts). All teacher-side classic scripts share
// the same top-level scope, so we just USE it here — declaring again
// would throw a "Identifier has already been declared" SyntaxError
// that breaks every script after this one.

// ============================================
// LOAD ASSIGNMENT COMPLETIONS — live via onSnapshot
// Resolves on the FIRST snapshot so existing `await
// loadAssignmentCompletions()` callers still work. Stays attached
// after that, re-rendering rows when any /assignmentCompletions
// doc is created or updated. Detaches on tab close.
// ============================================
function loadAssignmentCompletions() {
  return new Promise((resolve) => {
    // Tear down any prior listener so re-calling this function (e.g.
    // legacy refresh after the Submissions modal closes) doesn't leak.
    if (typeof _completionsUnsub === 'function') {
      try { _completionsUnsub(); } catch (_) {}
      _completionsUnsub = null;
    }
    let isFirst = true;
    _completionsUnsub = db.collection('assignmentCompletions').onSnapshot(
      (snap) => {
        allCompletions = {};
        snap.forEach(doc => { allCompletions[doc.id] = doc.data(); });
        // Re-render the assignment list on every change (skip the
        // first one — loadAssignments will trigger its own render).
        if (!isFirst && typeof renderAssignments === 'function') {
          renderAssignments();
          if (typeof updateAssignmentStats === 'function') updateAssignmentStats();
        }
        if (isFirst) {
          isFirst = false;
          console.log('[live] completions: initial', Object.keys(allCompletions).length, 'records');
          // Kick the writing-submissions listener once completions
          // are seeded. Parallel listener — keeps the card counts
          // honest for writing assignments where the legacy bug
          // meant assignmentCompletions docs never made it into the
          // odUserId query above.
          _attachWritingSubsListener();
          resolve();
        }
      },
      (err) => {
        console.warn('Completions snapshot error:', err.message || err);
        if (isFirst) { isFirst = false; resolve(); }
      }
    );
  });
}

// Phase G fix — live snapshot of every writingSubmission visible to
// this teacher (rules allow `teacherHasScope() || isAdmin()`). Used
// by calculateAssignmentCompletion to mark a writing as Done when
// the canonical doc says 'submitted' / 'graded' / 'returned', even
// if the old buggy assignmentCompletions write is missing.
let _writingSubsUnsub = null;
function _attachWritingSubsListener() {
  if (typeof _writingSubsUnsub === 'function') {
    try { _writingSubsUnsub(); } catch (_) {}
    _writingSubsUnsub = null;
  }
  try {
    _writingSubsUnsub = db.collection('writingSubmissions').onSnapshot(
      (snap) => {
        allWritingSubs = {};
        snap.forEach(d => { allWritingSubs[d.id] = d.data(); });
        // Re-render after the first paint of completions has already
        // happened. Cheap — same render path as the completions
        // listener.
        if (typeof renderAssignments === 'function') {
          renderAssignments();
          if (typeof updateAssignmentStats === 'function') updateAssignmentStats();
        }
      },
      (err) => {
        // Permission errors expected for teachers without scope —
        // those teachers simply don't see writing-submission counts.
        console.warn('[live] writingSubmissions snapshot error:', err.message || err);
      }
    );
  } catch (e) {
    console.warn('Could not attach writingSubmissions listener:', e);
  }
}
// Detach on tab close so we don't leak the listener.
window.addEventListener('beforeunload', () => {
  if (typeof _writingSubsUnsub === 'function') {
    try { _writingSubsUnsub(); } catch (_) {}
    _writingSubsUnsub = null;
  }
});

// ── Read-saver: pause the two WHOLE-COLLECTION listeners (completions +
// writingSubmissions) while the dashboard tab is HIDDEN (teacher switched to
// another tab/app, or minimised). Left open in a background tab they re-read
// every student's completion/submission write across the whole school, all
// day — a major idle drain. While hidden nothing is rendered, so pausing is
// invisible; on return we re-attach (one fresh read) and live updates resume
// exactly as before. The SCOPED assignments listener is left alone — it's
// cheap and only fires on the teacher's own assignment changes.
let _pausedWhileHidden = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (typeof _completionsUnsub === 'function' || typeof _writingSubsUnsub === 'function') {
      if (typeof _completionsUnsub === 'function') { try { _completionsUnsub(); } catch (_) {} _completionsUnsub = null; }
      if (typeof _writingSubsUnsub === 'function') { try { _writingSubsUnsub(); } catch (_) {} _writingSubsUnsub = null; }
      _pausedWhileHidden = true;
      console.log('[reads] dashboard hidden — paused completion/submission listeners');
    }
  } else if (_pausedWhileHidden) {
    _pausedWhileHidden = false;
    console.log('[reads] dashboard visible — resuming completion/submission listeners');
    // loadAssignmentCompletions() re-attaches BOTH (it kicks the writing-subs
    // listener on its first snapshot) and refreshes the data. It tears down
    // any prior listener first, so this is safe to call repeatedly.
    if (typeof loadAssignmentCompletions === 'function') loadAssignmentCompletions();
  }
});

// ============================================
// LOAD ASSIGNMENTS — live via onSnapshot
// Resolves on the FIRST snapshot so existing `await loadAssignments()`
// callers (the dashboard bootstrap) still work as before. After that,
// the listener stays attached and re-renders on every assignment
// create / update / delete — same UX as the Submissions dashboard.
// Detaches on `beforeunload` (see the global hook near the top of
// this file).
// ============================================
function loadAssignments() {
  return new Promise((resolve) => {
    const container = document.getElementById('assignmentsList');
    if (!container) { resolve(); return; }

    // Tear down any prior listener if loadAssignments is called twice
    // (e.g. on a manual refresh path) so we don't end up double-firing.
    if (typeof _assignmentsUnsub === 'function') {
      try { _assignmentsUnsub(); } catch (_) {}
      _assignmentsUnsub = null;
    }

    // Build the query — non-admin teachers see only their own
    // assignments. The composite-index fallback path is preserved.
    function makeQuery(withOrderBy) {
      let q = db.collection('assignments');
      if (!isAdmin()) q = q.where('teacherId', '==', auth.currentUser.uid);
      if (withOrderBy) q = q.orderBy('createdAt', 'desc');
      return q;
    }

    let isFirst = true;
    function attach(q) {
      _assignmentsUnsub = q.onSnapshot(
        (snap) => {
          allAssignments = [];
          snap.forEach(doc => allAssignments.push({ id: doc.id, ...doc.data() }));
          // Defensive client-side sort (covers the no-orderBy fallback).
          allAssignments.sort((a, b) => {
            const da  = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return db2 - da;
          });
          if (typeof renderAssignments      === 'function') renderAssignments();
          if (typeof updateAssignmentStats === 'function')  updateAssignmentStats();
          if (isFirst) {
            isFirst = false;
            console.log('[live] assignments: initial', allAssignments.length, 'records');
            // Wire completions live (returns a promise; we don't have
            // to await it before resolving because completions render
            // independently on their first tick).
            if (typeof loadAssignmentCompletions === 'function') loadAssignmentCompletions();
            resolve();
          }
        },
        (err) => {
          // Composite-index fallback: retry without the orderBy.
          if (err.code === 'failed-precondition' && /index/i.test(err.message || '')) {
            console.warn('Composite index missing for assignments; falling back to client-side sort');
            try { _assignmentsUnsub(); } catch (_) {}
            attach(makeQuery(/* withOrderBy */ false));
            return;
          }
          console.error('Assignments snapshot error:', err);
          if (isFirst) {
            const msg = err.code === 'permission-denied'
              ? 'Permission denied. Please contact the admin.'
              : 'Error loading assignments. Please refresh the page.';
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px;">${msg}</p>`;
            isFirst = false;
            resolve();
          }
        }
      );
    }
    attach(makeQuery(/* withOrderBy */ true));
  });
}

// ============================================
// RENDER ASSIGNMENTS
// ============================================
function renderAssignments() {
  const container = document.getElementById('assignmentsList');
  if (!container) return;

  // Ensure the skill filter strip is rendered (idempotent — safe to call
  // every render; it only re-wires the click handler once).
  renderSkillFilterStrip();

  // Apply the active skill filter. Legacy assignments without a `skill`
  // field are treated as 'vocabulary' (see SKILL_REGISTRY.skillOf).
  const visible = (currentAssignmentSkillFilter === 'all')
    ? allAssignments
    : allAssignments.filter(a => SKILL_REGISTRY.skillOf(a) === currentAssignmentSkillFilter);

  if (visible.length === 0) {
    const noMatchMsg = (currentAssignmentSkillFilter === 'all')
      ? 'Create your first assignment to get started'
      : `No assignments for ${SKILL_REGISTRY.get(currentAssignmentSkillFilter)?.name || currentAssignmentSkillFilter} yet.`;
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 4em; margin-bottom: 16px;">📋</div>
        <h3 style="margin-bottom: 8px; color: var(--text-primary);">${currentAssignmentSkillFilter === 'all' ? 'No Assignments Yet' : 'No matching assignments'}</h3>
        <p style="color: var(--text-muted);">${noMatchMsg}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = visible.map(assignment => {
    const deadline = assignment.deadline?.toDate ? assignment.deadline.toDate() : new Date(assignment.deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    const isOverdue = daysLeft < 0;
    const isUrgent = daysLeft <= 3 && daysLeft >= 0;
    
    // Calculate completion stats
    const completion = calculateAssignmentCompletion(assignment);
    const isFullyCompleted = completion.percentage === 100 && completion.total > 0;
    
    const bookIcon = assignment.book === 'gateway' ? '📗' : '📘';
    const bookName = assignment.book === 'gateway' ? 'Gateway' : 'Empower';
    
    const activityNames = {
      'all': 'Any Activity',
      'choice': 'Multiple Choice',
      'fillblank': 'Fill in Blank',
      'match': 'Match',
      'spelling': 'Spelling',
      'reverse': 'Listening Mode',
      'order': 'Word Order',
      'pronunciation': 'Pronunciation'
    };
    
    // Skill badge — shows the icon + name from the registry. Legacy
    // rows (no skill field) render as Vocabulary.
    const skillMeta = (typeof SKILL_REGISTRY !== 'undefined')
      ? SKILL_REGISTRY.get(SKILL_REGISTRY.skillOf(assignment))
      : null;
    const skillBadge = skillMeta
      ? `<span class="assignment-skill-badge" style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:12px; font-size:0.78em; font-weight:600; background:rgba(${hexToRgb(skillMeta.accent)},0.18); color:${skillMeta.accent}; border:1px solid rgba(${hexToRgb(skillMeta.accent)},0.35); margin-right:8px;">${skillMeta.icon} ${skillMeta.name}</span>`
      : '';

    let statusBadge = '';
    let cardClass = '';
    if (isFullyCompleted) {
      statusBadge = '<span class="assignment-status completed">✅ All Complete</span>';
      cardClass = 'fully-completed';
    } else if (isOverdue) {
      statusBadge = '<span class="assignment-status overdue">❌ Overdue</span>';
      cardClass = 'overdue';
    } else if (isUrgent) {
      statusBadge = '<span class="assignment-status urgent">⚠️ Due Soon</span>';
      cardClass = 'urgent';
    } else {
      statusBadge = '<span class="assignment-status active">⏳ Active</span>';
      cardClass = '';
    }
    // Prepend skill badge to status badge so they render together
    statusBadge = skillBadge + statusBadge;
    
    // Different card body for completed vs in-progress
    let cardBody = '';
    if (isFullyCompleted) {
      // Clean completed view
      cardBody = `
        <div class="assignment-card-body completed-body">
          <div class="completed-summary">
            <div class="completed-stat">
              <span class="completed-stat-icon">👥</span>
              <span class="completed-stat-value">${completion.total}</span>
              <span class="completed-stat-label">Students</span>
            </div>
            <div class="completed-stat">
              <span class="completed-stat-icon">✅</span>
              <span class="completed-stat-value">${completion.completed}</span>
              <span class="completed-stat-label">Completed</span>
            </div>
            <div class="completed-stat">
              <span class="completed-stat-icon">🎉</span>
              <span class="completed-stat-value">100%</span>
              <span class="completed-stat-label">Success Rate</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // In-progress view with progress bar
      const remaining = completion.total - completion.completed;
      cardBody = `
        <div class="assignment-card-body">
          <div class="assignment-progress-section">
            <div class="assignment-progress-header">
              <span>Completion Progress</span>
              <span class="assignment-progress-text">${completion.completed}/${completion.total} students (${completion.percentage}%)</span>
            </div>
            <div class="assignment-progress-bar">
              <div class="assignment-progress-fill" style="width: ${completion.percentage}%"></div>
            </div>
          </div>
          
          <div class="assignment-remaining-info">
            <span class="remaining-count">📊 ${remaining} student${remaining !== 1 ? 's' : ''} remaining</span>
          </div>
          
          <div class="assignment-students-summary">
            <div class="summary-item completed">
              <span class="summary-icon">✅</span>
              <span class="summary-count">${completion.completed}</span>
              <span class="summary-label">Done</span>
            </div>
            <div class="summary-item pending">
              <span class="summary-icon">⏳</span>
              <span class="summary-count">${completion.inProgress}</span>
              <span class="summary-label">Trying</span>
            </div>
            <div class="summary-item not-started">
              <span class="summary-icon">⭕</span>
              <span class="summary-count">${completion.notStarted}</span>
              <span class="summary-label">Not Started</span>
            </div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="assignment-card ${cardClass}">
        <div class="assignment-card-header">
          <div class="assignment-title-row">
            <h3 class="assignment-title">${escapeHtml(assignment.title) || 'Untitled Assignment'}</h3>
            ${statusBadge}
          </div>
          <div class="assignment-meta">
            ${(function () {
              // Skill-aware meta line. Vocabulary shows book/level/unit/activity.
              // Writing shows question type + time limit. Reading/Listening
              // show their unit (exam) when we wire those forms later;
              // for Phase 1 they reuse the vocabulary fields, so the same
              // line is fine for them.
              const sk = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.skillOf(assignment) : 'vocabulary';
              if (sk === 'writing') {
                const qtype = (assignment.questionType || 'custom').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const time  = (assignment.timeLimit != null) ? `⏱ ${assignment.timeLimit} min` : '';
                // Read `level`, fall back to legacy `difficulty` for early drafts.
                const lvl   = (assignment.level || assignment.difficulty) ? `📊 ${assignment.level || assignment.difficulty}` : '';
                return `<span>${qtype}</span>${time ? '<span>•</span><span>' + time + '</span>' : ''}${lvl ? '<span>•</span><span>' + lvl + '</span>' : ''}`;
              }
              if (sk === 'reading' || sk === 'listening') {
                // Reading / listening rows: show the picked exam title +
                // its level (mirrored at save time from EXAM_REGISTRY).
                const examTitle = assignment.examTitle || assignment.examId || '— No exam selected —';
                const examLvl   = assignment.examLevel ? `📊 ${assignment.examLevel}` : '';
                return `<span>📝 ${examTitle}</span>${examLvl ? '<span>•</span><span>' + examLvl + '</span>' : ''}`;
              }
              // Vocabulary / legacy / reading / listening (Phase 1 fallback)
              return `<span>${bookIcon} ${bookName}</span>
                <span>•</span>
                <span>📊 ${assignment.level || '-'}</span>
                <span>•</span>
                <span>📖 ${assignment.unit || 'All Units'}</span>
                <span>•</span>
                <span>🎮 ${activityNames[assignment.activity] || assignment.activity || '-'}</span>`;
            })()}
          </div>
          <div class="assignment-target">
            <span>🎯 Target: ${assignment.targetType === 'class' ? 'Class ' + assignment.targetClass : 'Individual Students'}</span>
            <span>•</span>
            <span>📅 Due: ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${isOverdue ? '(Overdue)' : daysLeft === 0 ? '(Today!)' : daysLeft === 1 ? '(Tomorrow)' : `(${daysLeft} days left)`}</span>
          </div>
        </div>
        
        ${cardBody}
        
        <div class="assignment-card-footer">
          ${(function () {
            const _sk = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.skillOf(assignment) : 'vocabulary';
            // "View Details" opens the attempts-based "Student Progress"
            // panel — good for vocabulary / reading / listening where
            // a numeric bestScore + attempt count make sense. For
            // WRITING that view is misleading because:
            //   • bestScore is always 0/null until teacher grades
            //   • "Completed" is set on submit, NOT on grading, so the
            //     panel and the proper Submissions tracker can disagree
            //     on the same student (e.g. "Completed" vs "Returned").
            // For writing, the Submissions modal is the canonical view,
            // so we hide View Details on writing rows.
            const viewDetailsBtn = (_sk === 'writing')
              ? ''
              : `<button class="assignment-btn view" onclick="viewAssignmentDetails('${assignment.id}')">
                   <span>👁️</span> View Details
                 </button>`;
            // Phase C: Preview-as-student. Writing opens its dedicated
            // exam page in preview mode; other skills get a generic
            // modal explaining what the student will see (the actual
            // runners aren't wired for preview yet — Phase C+ work).
            const previewBtn = `<button class="assignment-btn view" onclick="previewAssignmentAsStudent('${assignment.id}')">
                 <span>👤</span> Preview
               </button>`;
            // Writing rows get the Submissions list shortcut as their
            // canonical "see who did what" entry point.
            const submissionsBtn = (_sk === 'writing')
              ? `<button class="assignment-btn view" onclick="openWritingSubmissionsList('${assignment.id}')">
                   <span>✍️</span> Submissions
                 </button>`
              : '';
            return viewDetailsBtn + previewBtn + submissionsBtn;
          })()}
          ${(function () {
            // Phase H follow-up — ownership-aware Edit/Delete buttons.
            // Mirror the firestore.rules `_ownsAssignment()` logic so
            // the UI doesn't dangle buttons that the rule layer would
            // reject. Three cases:
            //   1. Admin               → see Edit + Delete on every row
            //   2. Owner (teacherId)   → see Edit + Delete on own rows
            //   3. Legacy (no teacherId) → see Edit + Delete (rule
            //      grandfathered until the backfill stamps an owner)
            //   4. Other teacher       → no Edit/Delete, just View
            // For level/module-targeted assignments specifically, only
            // admin can have created them in the first place (rule
            // gates create), so they implicitly fall into case 1.
            const myUid     = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
            const amAdmin   = (typeof isAdmin === 'function') ? isAdmin() : false;
            const ownerId   = assignment.teacherId || null;
            const isOwner   = ownerId && myUid && ownerId === myUid;
            const isLegacy  = !ownerId;
            const canMutate = amAdmin || isOwner || isLegacy;
            if (!canMutate) return '';
            return `
              <button class="assignment-btn edit" onclick="openEditAssignmentModal('${assignment.id}')">
                <span>✏️</span> Edit
              </button>
              <button class="assignment-btn delete" onclick="deleteAssignment('${assignment.id}')">
                <span>🗑️</span> Delete
              </button>
            `;
          })()}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// CALCULATE COMPLETION
// ============================================
function calculateAssignmentCompletion(assignment) {
  // ── Resolve the target roster — same logic as the live Submissions
  //    dashboard so the two stay in sync. All four scopes supported:
  //    class · level · module · individual.
  let targetStudents = [];
  if (assignment.targetType === 'class') {
    const tc = _normCls(assignment.targetClass);
    targetStudents = allStudents.filter(s => _normCls(s.studentClass) === tc);
  } else if (assignment.targetType === 'level') {
    const tl = String(assignment.targetLevel || '').trim();
    targetStudents = allStudents.filter(s => String(s.level || '').trim() === tl);
  } else if (assignment.targetType === 'module') {
    const tm = String(assignment.targetModule || '').trim();
    targetStudents = allStudents.filter(s => String(s.module || '').trim() === tm);
  } else if (assignment.targetType === 'individual' || (assignment.targetStudents && assignment.targetStudents.length > 0)) {
    targetStudents = allStudents.filter(s => (assignment.targetStudents || []).includes(s.id));
  }

  if (targetStudents.length === 0) {
    return { total: 0, completed: 0, inProgress: 0, notStarted: 0, percentage: 0 };
  }

  // Skill-aware completion check:
  //   • writing → trust the assignmentCompletions doc (writing-exam.js
  //     sets completed: true on submit) plus optional fallback check
  //     against the writingSubmissions doc id we can derive.
  //   • vocabulary → existing logic: assignmentCompletions OR a
  //     matching session at 100%.
  //   • reading / listening → check assignmentCompletions plus any
  //     session whose activity matches the exam-skill.
  const sk = (typeof SKILL_REGISTRY !== 'undefined')
    ? SKILL_REGISTRY.skillOf(assignment)
    : (assignment.skill || 'vocabulary');

  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;

  const assignmentCreatedAt = assignment.createdAt?.toDate ? assignment.createdAt.toDate() : new Date(assignment.createdAt);

  targetStudents.forEach(student => {
    const completionKey = `${student.id}_${assignment.id}`;
    const completionRecord = allCompletions[completionKey];

    // Explicit completion record wins for every skill — it's the
    // canonical "this student is done" signal.
    if (completionRecord && completionRecord.completed) {
      completed++;
      return;
    }

    // Writing assignments don't have a "score-100%" gate — submission
    // alone counts. Two sources of truth, in priority order:
    //   1. assignmentCompletions doc (the canonical "this is done"
    //      flag; works once the legacy odUserId bug is fixed)
    //   2. writingSubmissions doc with status 'submitted' or 'graded'
    //      (canonical writing store; covers legacy docs where the
    //      completion write was wrong-keyed). 'returned' is NOT
    //      done — student still owes a revision.
    if (sk === 'writing') {
      if (completionRecord && completionRecord.completed) {
        // Already counted as completed above (line 779) — defensive.
        completed++;
        return;
      }
      const wsKey = completionKey;   // same `{uid}_{aid}` pattern
      const wsRec = (typeof allWritingSubs !== 'undefined') ? allWritingSubs[wsKey] : null;
      if (wsRec && (wsRec.status === 'submitted' || wsRec.status === 'graded')) {
        completed++;
        return;
      }
      if (wsRec && wsRec.status === 'returned') {
        // Teacher returned for revision — student has done WORK but
        // hasn't finished the loop. Count as "in progress" so the
        // card doesn't lie about the state.
        inProgress++;
        return;
      }
      if (completionRecord) inProgress++;
      else                  notStarted++;
      return;
    }

    // Reading / listening: the solo exam runners (reading-exam.js /
    // listening-exam.js) record a /sessions doc but no completion doc,
    // so we session-match here — same idea as vocab below, but keyed on
    // the EXAM the assignment targets. A session counts when:
    //   • it's the right exam activity (reading-exam / listening-exam),
    //   • it was created after the assignment, and
    //   • its exam id (stored in session.unit) matches assignment.examId.
    // Attempting the assigned exam = done (graded exams have no "100%"
    // gate). An explicit completionRecord still wins (checked above).
    if (sk === 'reading' || sk === 'listening') {
      const examActivity = sk === 'reading' ? 'reading-exam' : 'listening-exam';
      const aExamId = assignment.examId || assignment.unit || '';
      const did = allSessions.some(sess => {
        if (sess.userId !== student.id) return false;
        if (sess.activity !== examActivity) return false;
        const sd = sess.createdAt?.toDate ? sess.createdAt.toDate() : new Date(sess.createdAt || 0);
        if (sd < assignmentCreatedAt) return false;
        // Exam-id match. Legacy listening sessions stored unit:'fsmept'
        // before the real-id fix; treat those as a match when the
        // assignment has no usable exam id OR the session pre-dates the
        // fix (single listening exam, so it's unambiguous).
        if (!aExamId) return true;
        if (sess.unit === aExamId) return true;
        if (examActivity === 'listening-exam' && sess.unit === 'fsmept') return true;
        return false;
      });
      if (did) { completed++; return; }
      if (completionRecord) inProgress++;
      else notStarted++;
      return;
    }

    // Vocabulary — original logic kept intact. Match sessions by
    // book / level / unit / activity and look for a 100% score.
    const matchingSessions = allSessions.filter(sess => {
      if (sess.userId !== student.id) return false;
      const sessionDate = sess.createdAt?.toDate ? sess.createdAt.toDate() : new Date(sess.createdAt);
      if (sessionDate < assignmentCreatedAt) return false;
      const sessionBook = sess.book || 'empower';
      if (sessionBook !== assignment.book) return false;
      if (sess.level !== assignment.level) return false;
      if (assignment.unit && assignment.unit !== 'all' && sess.unit !== assignment.unit) return false;
      if (assignment.activity && assignment.activity !== 'all' && sess.activity !== assignment.activity) return false;
      return true;
    });
    const hasCompleted = matchingSessions.some(sess => Number(sess.percentage) >= 100);

    if (hasCompleted) {
      completed++;
    } else if (matchingSessions.length > 0 || (completionRecord && completionRecord.attempts > 0)) {
      inProgress++;
    } else {
      notStarted++;
    }
  });
  
  const total = targetStudents.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { total, completed, inProgress, notStarted, percentage };
}

// ============================================
// UPDATE STATS
// ============================================
function updateAssignmentStats() {
  const activeCount = allAssignments.filter(a => {
    const deadline = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline);
    return deadline >= new Date();
  }).length;
  
  const overdueCount = allAssignments.filter(a => {
    const deadline = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline);
    const completion = calculateAssignmentCompletion(a);
    return deadline < new Date() && completion.percentage < 100;
  }).length;
  
  const el1 = document.getElementById('activeAssignmentsCount');
  const el2 = document.getElementById('overdueAssignmentsCount');
  
  if (el1) el1.textContent = activeCount;
  if (el2) el2.textContent = overdueCount;
}

// ============================================
// CREATE ASSIGNMENT MODAL
// ============================================
function openCreateAssignmentModal() {
  document.getElementById('assignmentModalTitle').textContent = '📋 Create New Assignment';
  document.getElementById('assignmentId').value = '';
  document.getElementById('assignmentTitle').value = '';
  document.getElementById('assignmentBook').value = 'empower';
  document.getElementById('assignmentLevel').value = 'A2';
  document.getElementById('assignmentUnit').value = 'all';
  document.getElementById('assignmentActivity').value = 'all';
  document.getElementById('assignmentTargetType').value = 'class';
  document.getElementById('assignmentDeadline').value = '';
  
  // Set minimum date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('assignmentDeadline').setAttribute('min', today);

  // Role-based scope — hide Entire Level / Entire Module options for
  // non-admin teachers + narrow the class dropdown to their assigned
  // classes only.
  if (typeof applyRoleScopeToTargetDropdown === 'function') {
    applyRoleScopeToTargetDropdown('assignmentTargetType');
  }
  if (typeof populateClassDropdownScoped === 'function') {
    populateClassDropdownScoped('assignmentTargetClass');
  } else {
    populateAssignmentClasses();
  }

  // Show class selector by default; onTargetTypeChange will switch
  // groups if the type changes.
  onTargetTypeChange();

  document.getElementById('assignmentModal').classList.add('active');
}

function closeAssignmentModal() {
  document.getElementById('assignmentModal').classList.remove('active');
}

function onTargetTypeChange() {
  const targetType = document.getElementById('assignmentTargetType').value;
  // Show only the relevant scope picker; hide the other three.
  const boxes = {
    class:      document.getElementById('classTargetGroup'),
    level:      document.getElementById('levelTargetGroup'),
    module:     document.getElementById('moduleTargetGroup'),
    individual: document.getElementById('individualTargetGroup')
  };
  Object.keys(boxes).forEach(key => {
    if (!boxes[key]) return;
    // individualTargetGroup uses display:block (vertical list);
    // the other three are inline form groups → default display.
    boxes[key].style.display = (key === targetType) ? (key === 'individual' ? 'block' : '') : 'none';
  });
  // Populate the student checkbox list lazily when the teacher actually
  // picks the individual scope (saves an unnecessary loop on the others).
  if (targetType === 'individual') populateAssignmentStudents();
}

function populateAssignmentClasses() {
  const select = document.getElementById('assignmentTargetClass');
  // Build the unique class list from normalized values so legacy mixed-case
  // student records collapse into a single canonical option per class.
  const classes = [...new Set(
    allStudents.map(s => _normCls(s.studentClass)).filter(Boolean)
  )].sort();

  select.innerHTML = '<option value="">-- Select Class --</option>';
  classes.forEach(cls => {
    const count = allStudents.filter(s => _normCls(s.studentClass) === cls).length;
    select.innerHTML += `<option value="${cls}">${cls} (${count} students)</option>`;
  });
}

function populateAssignmentStudents() {
  const container = document.getElementById('assignmentStudentsList');
  // Role scope — admins see all students; non-admin teachers see only
  // students in their assigned classes.
  const visible = (typeof studentsAllowedForCurrentUser === 'function')
    ? studentsAllowedForCurrentUser()
    : (Array.isArray(allStudents) ? allStudents : []);

  if (!visible || visible.length === 0) {
    container.innerHTML = `
      <p style="color: var(--text-muted); padding: 14px; text-align: center;">
        No students in your assigned classes yet.
      </p>`;
    return;
  }

  container.innerHTML = `
    <div class="student-search-box">
      <input type="text" id="studentSearchInput" class="student-search-input" autocomplete="off" placeholder="🔍 Search students..." oninput="filterAssignmentStudents()">
    </div>
    <div class="student-select-actions">
      <button type="button" class="select-action-btn" onclick="selectAllStudents()">Select All</button>
      <button type="button" class="select-action-btn" onclick="deselectAllStudents()">Deselect All</button>
      <span class="selected-count" id="selectedStudentCount">0 selected</span>
    </div>
    <div class="student-checkbox-items" id="studentCheckboxItems">
      ${visible.map(student => `
        <label class="student-checkbox-item" data-name="${(student.name || '').toLowerCase()}" data-email="${(student.email || '').toLowerCase()}" data-class="${(student.studentClass || '').toLowerCase()}">
          <input type="checkbox" value="${student.id}" class="assignment-student-checkbox" onchange="updateSelectedCount()">
          <span class="student-checkbox-name">${student.name || student.email}</span>
          <span class="student-checkbox-class">${student.studentClass || 'No class'}</span>
        </label>
      `).join('')}
    </div>
  `;
}

function filterAssignmentStudents() {
  const searchTerm = document.getElementById('studentSearchInput').value.toLowerCase().trim();
  const items = document.querySelectorAll('.student-checkbox-item');
  
  items.forEach(item => {
    const name = item.dataset.name || '';
    const email = item.dataset.email || '';
    const cls = item.dataset.class || '';
    
    const matches = name.includes(searchTerm) || email.includes(searchTerm) || cls.includes(searchTerm);
    item.style.display = matches ? 'flex' : 'none';
  });
}

function selectAllStudents() {
  const visibleCheckboxes = document.querySelectorAll('.student-checkbox-item:not([style*="display: none"]) .assignment-student-checkbox');
  visibleCheckboxes.forEach(cb => cb.checked = true);
  updateSelectedCount();
}

function deselectAllStudents() {
  document.querySelectorAll('.assignment-student-checkbox').forEach(cb => cb.checked = false);
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = document.querySelectorAll('.assignment-student-checkbox:checked').length;
  const countEl = document.getElementById('selectedStudentCount');
  if (countEl) {
    countEl.textContent = `${count} selected`;
    countEl.classList.toggle('has-selection', count > 0);
  }
}

// ============================================
// SAVE ASSIGNMENT
// ============================================
async function saveAssignment() {
  const saveBtn = document.querySelector('#assignmentModal .modal-btn-save');
  const originalText = saveBtn.innerHTML;
  
  const assignmentId = document.getElementById('assignmentId').value;
  const title = document.getElementById('assignmentTitle').value.trim();
  const book = document.getElementById('assignmentBook').value;
  const level = document.getElementById('assignmentLevel').value;
  const unit = document.getElementById('assignmentUnit').value;
  const activity = document.getElementById('assignmentActivity').value;
  const targetType = document.getElementById('assignmentTargetType').value;
  const deadline = document.getElementById('assignmentDeadline').value;

  // ---- Inline validation (Phase A) ----
  // Run all rules at once so the teacher sees every missing field, not
  // just the first one. Errors render inline next to each field PLUS
  // a banner at the top of the modal.
  clearFieldErrors('assignmentModal');
  const errs = validateAll([
    { id: 'assignmentTitle',         msg: 'Assignment title is required.' },
    { id: 'assignmentDeadline',      msg: 'Due date cannot be empty.' },
    { id: 'assignmentTargetClass',   msg: 'Please select a class.',  when: () => targetType === 'class' },
    { id: 'assignmentTargetLevel',   msg: 'Please select a level.',  when: () => targetType === 'level' },
    { id: 'assignmentTargetModule',  msg: 'Please select a module.', when: () => targetType === 'module' }
  ]);
  // "Specific Students" needs a custom check — the input isn't a single
  // <select>, it's a list of checkboxes — so we collect it manually.
  if (targetType === 'individual') {
    const checked = document.querySelectorAll('.assignment-student-checkbox:checked').length;
    if (checked === 0) {
      // Use the surrounding form-group's first child as the anchor.
      const anchor = document.getElementById('assignmentStudentsList');
      if (anchor) errs.push({ id: 'assignmentStudentsList', msg: 'Please select at least one student.', el: anchor });
    }
  }
  if (errs.length) {
    showFieldErrors(errs, 'assignmentModal');
    return;
  }

  // Sanity-check the parsed deadline. Firestore Timestamps must fit in
  // the seconds field; a 5-digit year (e.g. typed "20206") overflows and
  // the SDK throws "Timestamp seconds out of range". Reject early with
  // a clear message instead of letting Firebase fail mid-write.
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    showError('Invalid Deadline', 'Please pick a valid date.');
    return;
  }
  const year = deadlineDate.getFullYear();
  if (year < 2024 || year > 2099) {
    showError(
      'Invalid Deadline',
      `The year must be between 2024 and 2099. You entered ${year}.`
    );
    return;
  }

  // Four target scopes — class / level / module / individual.
  // Each writes its own dedicated field on the assignment doc so
  // the student-side matcher (student-assignments.js) can check
  // exactly which scope it belongs to without ambiguity.
  let targetClass = '';
  let targetLevel = '';
  let targetModule = '';
  let targetStudents = [];

  // Values are read from the inputs — validation already happened above
  // via validateAll(), so we just collect cleanly here.
  if (targetType === 'class') {
    // Normalize on write so the assignment doc always stores the
    // canonical (uppercase, trimmed) form. Compare-side normalization
    // covers legacy data; this prevents the issue at the source.
    targetClass = _normCls(document.getElementById('assignmentTargetClass').value);
  } else if (targetType === 'level') {
    targetLevel = (document.getElementById('assignmentTargetLevel').value || '').trim();
  } else if (targetType === 'module') {
    targetModule = (document.getElementById('assignmentTargetModule').value || '').trim();
  } else if (targetType === 'individual') {
    const checkboxes = document.querySelectorAll('.assignment-student-checkbox:checked');
    targetStudents = Array.from(checkboxes).map(cb => cb.value);
  }
  
  // Show loading state
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';
  saveBtn.classList.add('saving');
  
  // Skill field — populated by the picker. Falls back to 'vocabulary'
  // for safety if the hidden input is somehow blank (legacy behaviour).
  const skill = (document.getElementById('assignmentSkill')?.value || 'vocabulary');

  const assignmentData = {
    title,
    skill,                                       // ← new Phase 1 field
    book,
    level,
    unit,
    activity,
    targetType,
    targetClass,
    targetLevel,                                 // ← new "Entire Level" scope
    targetModule,                                // ← new "Entire Module" scope
    targetStudents,
    deadline: deadlineDate,
    teacherId: auth.currentUser.uid,
    teacherName: userData?.name || auth.currentUser.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    if (assignmentId) {
      // Update existing
      await db.collection('assignments').doc(assignmentId).update(assignmentData);
      
      // Log activity
      if (typeof ActivityLogger !== 'undefined') {
        await ActivityLogger.logAssignmentEdited({
          assignmentId: assignmentId,
          title: title,
          changes: 'updated'
        });
      }
      
      // Success animation
      saveBtn.innerHTML = '✅ Updated!';
      saveBtn.classList.remove('saving');
      saveBtn.classList.add('success');
      
      setTimeout(() => {
        closeAssignmentModal();
        saveBtn.innerHTML = originalText;
        saveBtn.classList.remove('success');
        saveBtn.disabled = false;
      }, 1000);
      
    } else {
      // Create new
      assignmentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const docRef = await db.collection('assignments').add(assignmentData);
      
      // Log activity
      if (typeof ActivityLogger !== 'undefined') {
        await ActivityLogger.logAssignmentCreated({
          assignmentId: docRef.id,
          title: title,
          targetType: targetType,
          targetClass: targetClass || null,
          targetStudentsCount: targetStudents.length || 0,
          deadline: deadline
        });
      }
      
      // Success animation
      saveBtn.innerHTML = '✅ Created!';
      saveBtn.classList.remove('saving');
      saveBtn.classList.add('success');
      
      setTimeout(() => {
        closeAssignmentModal();
        saveBtn.innerHTML = originalText;
        saveBtn.classList.remove('success');
        saveBtn.disabled = false;
      }, 1000);
    }
    
    await loadAssignments();
    
  } catch (error) {
    console.error('Error saving assignment:', error);
    saveBtn.innerHTML = '❌ Error';
    saveBtn.classList.remove('saving');
    saveBtn.classList.add('error');
    
    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.classList.remove('error');
      saveBtn.disabled = false;
    }, 2000);
    
    showError('Error', 'Failed to save assignment: ' + error.message);
  }
}

// ============================================
// EDIT ASSIGNMENT
// ============================================
async function openEditAssignmentModal(assignmentId) {
  const assignment = allAssignments.find(a => a.id === assignmentId);
  if (!assignment) return;
  
  // Preserve the assignment's existing skill on edit; new edits don't
  // re-open the skill picker. Falls back to 'vocabulary' for legacy docs.
  const editSkill = (typeof SKILL_REGISTRY !== 'undefined')
    ? SKILL_REGISTRY.skillOf(assignment)
    : (assignment.skill || 'vocabulary');
  document.getElementById('assignmentSkill').value = editSkill;
  const editSkillMeta = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.get(editSkill) : null;
  document.getElementById('assignmentModalTitle').innerHTML = editSkillMeta
    ? `🖊️ Edit ${editSkillMeta.icon} ${editSkillMeta.name} Assignment`
    : '🖊️ Edit Assignment';
  document.getElementById('assignmentId').value = assignmentId;
  document.getElementById('assignmentTitle').value = assignment.title || '';
  document.getElementById('assignmentBook').value = assignment.book || 'empower';
  document.getElementById('assignmentLevel').value = assignment.level || 'A2';
  document.getElementById('assignmentUnit').value = assignment.unit || 'all';
  document.getElementById('assignmentActivity').value = assignment.activity || 'all';
  document.getElementById('assignmentTargetType').value = assignment.targetType || 'class';
  
  // Set deadline
  const deadline = assignment.deadline?.toDate ? assignment.deadline.toDate() : new Date(assignment.deadline);
  document.getElementById('assignmentDeadline').value = deadline.toISOString().split('T')[0];
  
  // Populate and set target. onTargetTypeChange() handles the show/hide
  // of the four scope pickers (class / level / module / individual) so
  // we just call it once after setting the targetType.
  populateAssignmentClasses();
  onTargetTypeChange();

  if (assignment.targetType === 'class') {
    document.getElementById('assignmentTargetClass').value = assignment.targetClass || '';
  } else if (assignment.targetType === 'level') {
    document.getElementById('assignmentTargetLevel').value = assignment.targetLevel || '';
  } else if (assignment.targetType === 'module') {
    document.getElementById('assignmentTargetModule').value = assignment.targetModule || '';
  } else if (assignment.targetType === 'individual') {
    populateAssignmentStudents();
    // Check the relevant students after the list has rendered.
    setTimeout(() => {
      document.querySelectorAll('.assignment-student-checkbox').forEach(cb => {
        cb.checked = assignment.targetStudents?.includes(cb.value);
      });
    }, 100);
  }

  document.getElementById('assignmentModal').classList.add('active');
}

// ============================================
// DELETE ASSIGNMENT
// ============================================
function deleteAssignment(assignmentId) {
  const assignment = allAssignments.find(a => a.id === assignmentId);
  if (!assignment) return;
  
  showConfirm(
    '🗑️',
    'Delete Assignment?',
    `Are you sure you want to delete "${assignment.title}"? This action cannot be undone.`,
    'Yes, Delete',
    async () => {
      try {
        await db.collection('assignments').doc(assignmentId).delete();
        
        // Log activity
        if (typeof ActivityLogger !== 'undefined') {
          await ActivityLogger.logAssignmentDeleted({
            assignmentId: assignmentId,
            title: assignment.title
          });
        }
        
        showSuccess('Deleted', 'Assignment has been deleted.');
        await loadAssignments();
      } catch (error) {
        console.error('Error deleting assignment:', error);
        showError('Error', 'Failed to delete assignment: ' + error.message);
      }
    }
  );
}

// ============================================
// VIEW ASSIGNMENT DETAILS
// ============================================
function viewAssignmentDetails(assignmentId) {
  const assignment = allAssignments.find(a => a.id === assignmentId);
  if (!assignment) return;

  // Get target students — full four-scope support (class / level /
  // module / individual). Previously this only handled class + the
  // legacy targetStudents shape, so level/module-scoped assignments
  // came up empty in the Student Progress list.
  let targetStudents = [];
  if (assignment.targetType === 'class') {
    const tc = _normCls(assignment.targetClass);
    targetStudents = allStudents.filter(s => _normCls(s.studentClass) === tc);
  } else if (assignment.targetType === 'level') {
    const tl = String(assignment.targetLevel || '').trim();
    targetStudents = allStudents.filter(s => String(s.level || '').trim() === tl);
  } else if (assignment.targetType === 'module') {
    const tm = String(assignment.targetModule || '').trim();
    targetStudents = allStudents.filter(s => String(s.module || '').trim() === tm);
  } else if (assignment.targetType === 'individual' || assignment.targetStudents?.length > 0) {
    targetStudents = allStudents.filter(s => (assignment.targetStudents || []).includes(s.id));
  }
  
  const assignmentCreatedAt = assignment.createdAt?.toDate ? assignment.createdAt.toDate() : new Date(assignment.createdAt);
  
  // Build student status list
  let studentRows = targetStudents.map(student => {
    // Check explicit completion record first
    const completionKey = `${student.id}_${assignment.id}`;
    const completionRecord = allCompletions[completionKey];

    const matchingSessions = allSessions.filter(sess => {
      if (sess.userId !== student.id) return false;
      const sessionDate = sess.createdAt?.toDate ? sess.createdAt.toDate() : new Date(sess.createdAt);
      if (sessionDate < assignmentCreatedAt) return false;
      const sessionBook = sess.book || 'empower';
      if (sessionBook !== assignment.book) return false;
      if (sess.level !== assignment.level) return false;
      if (assignment.unit && assignment.unit !== 'all' && sess.unit !== assignment.unit) return false;
      if (assignment.activity && assignment.activity !== 'all' && sess.activity !== assignment.activity) return false;
      return true;
    });

    const sessionBest = matchingSessions.length > 0
      ? Math.max(...matchingSessions.map(s => Number(s.percentage) || 0))
      : 0;
    const completionBest = completionRecord ? (completionRecord.bestScore || 0) : 0;
    const bestScore = Math.max(sessionBest, completionBest);

    const totalAttempts = Math.max(matchingSessions.length, completionRecord?.attempts || 0);

    const hasCompleted = (completionRecord && completionRecord.completed) ||
                         matchingSessions.some(sess => Number(sess.percentage) >= 100);

    let statusBadge = '';
    if (hasCompleted) {
      statusBadge = '<span class="detail-status completed">✅ Completed</span>';
    } else if (totalAttempts > 0) {
      statusBadge = '<span class="detail-status in-progress">⏳ In Progress</span>';
    } else {
      statusBadge = '<span class="detail-status not-started">⭕ Not Started</span>';
    }

    return `
      <div class="detail-student-row">
        <div class="detail-student-info">
          <span class="detail-student-name">${student.name || student.email}</span>
          <span class="detail-student-class">${student.studentClass || 'No class'}</span>
        </div>
        <div class="detail-student-stats">
          <span class="detail-attempts">${totalAttempts} attempts</span>
          <span class="detail-best-score">Best: ${bestScore}%</span>
          ${statusBadge}
        </div>
      </div>
    `;
  }).join('');
  
  if (targetStudents.length === 0) {
    studentRows = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No students in this target group</p>';
  }
  
  const deadline = assignment.deadline?.toDate ? assignment.deadline.toDate() : new Date(assignment.deadline);
  const bookIcon = assignment.book === 'gateway' ? '📗' : '📘';
  
  const activityNames = {
    'all': 'Any Activity',
    'choice': 'Multiple Choice',
    'fillblank': 'Fill in Blank',
    'match': 'Match',
    'spelling': 'Spelling',
    'reverse': 'Listening Mode',
    'order': 'Word Order',
    'pronunciation': 'Pronunciation'
  };
  
  // Skill-aware meta line. Vocabulary uses book/level/unit/activity;
  // reading/listening use examTitle + examLevel; writing uses
  // questionType + level + timeLimit. Without this, the modal
  // rendered literal "undefined" for fields a given skill doesn't
  // have (e.g. assignment.activity on a reading row).
  const _sk = (typeof SKILL_REGISTRY !== 'undefined')
    ? SKILL_REGISTRY.skillOf(assignment)
    : (assignment.skill || 'vocabulary');
  let metaLine = '';
  if (_sk === 'writing') {
    const qtype = (assignment.questionType || 'custom').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    metaLine = `
      <span>✍️ Writing</span>
      <span>•</span>
      <span>${escapeHtml(qtype)}</span>
      ${assignment.level     ? '<span>•</span><span>📊 ' + escapeHtml(assignment.level)              + '</span>' : ''}
      ${assignment.timeLimit ? '<span>•</span><span>⏱ ' + assignment.timeLimit + ' min'              + '</span>' : ''}`;
  } else if (_sk === 'reading' || _sk === 'listening') {
    const examTitle = escapeHtml(assignment.examTitle || assignment.examId || '— No exam selected —');
    metaLine = `
      <span>${_sk === 'reading' ? '📖 Reading' : '🎧 Listening'}</span>
      <span>•</span>
      <span>📝 ${examTitle}</span>
      ${assignment.examLevel ? '<span>•</span><span>📊 ' + escapeHtml(assignment.examLevel) + '</span>' : ''}`;
  } else {
    // Vocabulary (and any other unrecognized skill — keeps the legacy
    // fields visible) — guarded against undefined.
    metaLine = `
      <span>${bookIcon} ${assignment.book === 'gateway' ? 'Gateway' : 'Empower'}</span>
      <span>•</span>
      <span>📊 ${escapeHtml(assignment.level || '—')}</span>
      <span>•</span>
      <span>📖 ${escapeHtml(assignment.unit || 'All Units')}</span>
      <span>•</span>
      <span>🎮 ${escapeHtml(activityNames[assignment.activity] || assignment.activity || 'Any Activity')}</span>`;
  }

  // Target line — supports all four scopes, falls back to a generic
  // count for any unknown shape so it can never render undefined.
  let targetLine;
  if (assignment.targetType === 'class')      targetLine = 'Class ' + (assignment.targetClass || '—');
  else if (assignment.targetType === 'level')  targetLine = 'Level ' + (assignment.targetLevel || '—');
  else if (assignment.targetType === 'module') targetLine = 'Module ' + (assignment.targetModule || '—');
  else                                         targetLine = targetStudents.length + ' Students';

  document.getElementById('assignmentDetailContent').innerHTML = `
    <div class="detail-header">
      <h3>${escapeHtml(assignment.title || 'Untitled assignment')}</h3>
      <div class="detail-meta">${metaLine}</div>
      <div class="detail-meta">
        <span>🎯 ${escapeHtml(targetLine)}</span>
        <span>•</span>
        <span>📅 Due: ${deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        <span>•</span>
        <span>👨‍🏫 By: ${escapeHtml(assignment.teacherName || 'Unknown')}</span>
      </div>
    </div>

    <div class="detail-students-section">
      <h4>Student Progress (${targetStudents.length} students)</h4>
      <div class="detail-students-list">
        ${studentRows}
      </div>
    </div>
  `;
  
  document.getElementById('assignmentDetailModal').classList.add('active');
}

function closeAssignmentDetailModal() {
  document.getElementById('assignmentDetailModal').classList.remove('active');
}
