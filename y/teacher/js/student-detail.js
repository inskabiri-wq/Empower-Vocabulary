/* ============================================================
   TEACHER - Individual student drill-down (Missing#1)
   ------------------------------------------------------------
   Click a student row (or its 👁 View button) → a full-screen
   detail modal showing:
     • Profile (name / email / class / level / module / year)
     • Quick stats (sessions, avg score, words, last active)
     • Per-skill breakdown across all 6 skills
     • Assignment completion list
     • Recent sessions (last 12)
   Plus a "Print / Save PDF" button (Missing#4) that opens a
   clean print-optimized window and triggers window.print() so
   the teacher can Save-as-PDF - no PDF library needed.

   Reads only already-loaded globals (allStudents, allSessions,
   allAssignments, allCompletions). No new Firestore reads.
   Built as a self-contained module - the modal DOM is created
   on demand, so no markup needs to live in teacher-dashboard.html.
   ============================================================ */
(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _arr(name) {
    try {
      // The teacher dashboard's data globals are `let`-declared in
      // config.js / teacher-assignments.js → shared script scope, NOT
      // on window. Read by bare name with a typeof guard.
      if (name === 'students')   return (typeof allStudents   !== 'undefined' && Array.isArray(allStudents))   ? allStudents   : [];
      if (name === 'sessions')   return (typeof allSessions   !== 'undefined' && Array.isArray(allSessions))   ? allSessions   : [];
      if (name === 'assignments')return (typeof allAssignments!== 'undefined' && Array.isArray(allAssignments))? allAssignments: [];
    } catch (_) {}
    return [];
  }
  function _completions() {
    try {
      if (typeof allCompletions !== 'undefined' && allCompletions) return allCompletions;
    } catch (_) {}
    return {};
  }
  // Takes the whole SESSION, not just its activity string, so the exams'
  // explicit `skill` field is honoured. Passing only the activity is what
  // filed every writing exam under Vocabulary.
  function _skillOfActivity(sess) {
    return (typeof activityToSkill === 'function') ? activityToSkill(sess) : 'vocabulary';
  }
  function _sessionDate(s) {
    if (s && s.createdAt && s.createdAt.toDate) return s.createdAt.toDate();
    if (s && s.createdAt) return new Date(s.createdAt);
    return null;
  }

  const SKILL_META = [
    { id: 'vocabulary', icon: '📚', name: 'Vocabulary' },
    { id: 'reading',    icon: '📖', name: 'Reading' },
    { id: 'listening',  icon: '🎧', name: 'Listening' },
    { id: 'writing',    icon: '✍️', name: 'Writing' },
    { id: 'grammar',    icon: '✏️', name: 'Grammar' },
    { id: 'speaking',   icon: '🎤', name: 'Speaking' }
  ];

  const ACTIVITY_LABEL = {
    choice: 'Multiple Choice', match: 'Match', fillblank: 'Fill in Blank',
    spelling: 'Spelling', reverse: 'Listening Mode', order: 'Word Order',
    pronunciation: 'Pronunciation', unscramble: 'Unscramble',
    'listening-exam': 'Listening Exam', 'reading-exam': 'Reading Exam',
    'grammar-choice': 'Grammar · Multiple Choice', 'grammar-fill': 'Grammar · Fill in Blank',
    'grammar-unscramble': 'Grammar · Unscramble', grammar: 'Grammar'
  };

  // ── This student's sessions, ALL of them ───────────────────
  //
  // The dashboard loads the most recent 1000 sessions across everyone
  // (teacher/js/config.js), which is right for the activity feed and wrong
  // here. With 400 students active that window is two or three days, so a
  // student's "12 sessions, 64% average" was really "whatever of theirs
  // happened to fall inside the last 1000 rows", and a student who was busy
  // last month opened as if they had never used the app.
  //
  // So the detail view fetches that ONE student's sessions directly. It is a
  // query per student the teacher actually opens, not per dashboard load, and
  // it is the only place the numbers need to be complete.
  //
  // Cached per student for the session, because a teacher clicking back and
  // forth between two students should not re-read either one.
  const _sessionCache = Object.create(null);

  function _cachedSessions(studentId) {
    return _sessionCache[studentId] || null;
  }

  function _fetchSessions(studentId) {
    if (_sessionCache[studentId]) return Promise.resolve(_sessionCache[studentId]);
    let db;
    try { db = (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) ? firebase.firestore() : null; }
    catch (_) { db = null; }
    if (!db) return Promise.reject(new Error('no firestore'));
    return db.collection('sessions').where('userId', '==', studentId).get()
      .then(function (snap) {
        const rows = [];
        snap.forEach(function (d) { rows.push(Object.assign({ id: d.id }, d.data())); });
        _sessionCache[studentId] = rows;
        return rows;
      });
  }

  // ── Compute everything for one student ─────────────────────
  function _computeProfile(student) {
    // Complete set if it has arrived, otherwise the slice already in memory so
    // the modal still opens instantly with something real in it.
    const sessions = _cachedSessions(student.id)
      || _arr('sessions').filter(s => s.userId === student.id);
    const totalSessions = sessions.length;
    // Marked work only - an ungraded writing exam carries no percentage and
    // must not be averaged as a zero. See teacher/js/score-utils.js.
    const _avg = window.LLScore ? LLScore.avgRounded(sessions) : null;
    const avgScore = _avg === null ? 0 : _avg;

    // Words learned (unique)
    const words = new Set();
    sessions.forEach(s => {
      if (Array.isArray(s.wordsLearned)) s.wordsLearned.forEach(w => words.add(w));
    });

    // Per-skill rollup
    const bySkill = {};
    SKILL_META.forEach(sk => { bySkill[sk.id] = { count: 0, sum: 0 }; });
    sessions.forEach(s => {
      const sk = _skillOfActivity(s);
      if (!bySkill[sk]) bySkill[sk] = { count: 0, sum: 0 };
      // count = work done (all of it). sum/scored = the average (marked only).
      // Keeping them separate is what lets a skill row say "8 attempts" while
      // averaging the 5 that carry a mark.
      bySkill[sk].count++;
      if (!window.LLScore || LLScore.isScored(s)) {
        bySkill[sk].scored = (bySkill[sk].scored || 0) + 1;
        // Inside the guard the value is already a finite number, so no `|| 0`
        // fallback - which is the very thing that caused this bug.
        bySkill[sk].sum += Number(s.percentage);
      }
    });

    // Assignments targeting this student (class OR individual)
    const cls = String(student.studentClass || '').trim().toUpperCase();
    const comps = _completions();
    const assignments = _arr('assignments').filter(a => {
      if (a.targetType === 'class')      return String(a.targetClass || '').trim().toUpperCase() === cls;
      if (a.targetType === 'individual') return Array.isArray(a.targetStudents) && a.targetStudents.includes(student.id);
      if (a.targetType === 'level')      return String(a.targetLevel || '') === String(student.level || '');
      if (a.targetType === 'module')     return String(a.targetModule || '') === String(student.module || '');
      return false;
    }).map(a => {
      const comp = comps[student.id + '_' + a.id];
      const deadline = a.deadline?.toDate ? a.deadline.toDate() : (a.deadline ? new Date(a.deadline) : null);
      const overdue = deadline && deadline.getTime() < Date.now();
      let status = 'not-started';
      if (comp && comp.completed) status = 'done';
      else if (comp) status = 'in-progress';
      else if (overdue) status = 'overdue';
      return { a, comp, deadline, status };
    });

    const lastActive = student.lastLogin?.toDate ? student.lastLogin.toDate() : null;

    return { sessions, totalSessions, avgScore, words: words.size, bySkill, assignments, lastActive };
  }

  // ── Per-question answer detail (QA #4) ─────────────────────
  // Grammar stores its detail on the completion doc (comp.answers);
  // reading/listening store it on the session doc (s.answers). Both share
  // the uniform shape { skill, items:[{q,a,correct,ok}] }. Rendered as an
  // inline expandable panel inside this modal (no nested dialog).
  let _ansSeq = 0;
  // ONE PLACE THAT KNOWS WHERE PER-QUESTION DETAIL LIVES.
  //
  // Three activities record it in three different fields, and three views were
  // each honouring a different subset:
  //
  //   reading / listening exams -> session.answers.items  { q, a, correct, ok }
  //   grammar practice          -> session.grammarDetails { q, picked, correct, ok }
  //   vocabulary practice       -> session.vocabDetails   { q, picked, correct, ok }
  //
  //   Activity tab      honoured grammarDetails + vocabDetails, not answers
  //   this modal        honoured answers only
  //   the printed report honoured answers + grammarDetails, not vocabDetails
  //
  // So whether a row expanded depended on which screen you were on, which is
  // why grammar looked like it recorded nothing. All three shapes are the same
  // information; they are normalised here and every view uses this.
  //
  // PRONUNCIATION is genuinely absent and always will be until it is marked:
  // student/js/pronunciation.js decides nothing right or wrong, so there is no
  // per-question detail to show.
  function _itemsOf(s) {
    if (!s) return null;
    if (s.answers && Array.isArray(s.answers.items) && s.answers.items.length) return s.answers.items;
    var raw = (Array.isArray(s.grammarDetails) && s.grammarDetails.length) ? s.grammarDetails
            : (Array.isArray(s.vocabDetails) && s.vocabDetails.length) ? s.vocabDetails
            : (Array.isArray(s.pronDetails) && s.pronDetails.length) ? s.pronDetails
            : null;
    if (!raw) return null;
    return raw.map(function (it) {
      return { q: it.q, a: (it.picked != null ? it.picked : it.a), correct: it.correct, ok: !!it.ok };
    });
  }

  function _answerItemsHtml(answers) {
    const items = (answers && Array.isArray(answers.items)) ? answers.items : [];
    if (!items.length) return '<div style="padding:8px 12px;color:#94a3b8;font-size:0.85em;">No itemised answers were recorded for this attempt.</div>';
    const correct = items.filter(it => it.ok).length;
    const head = '<div style="font-size:0.78em;color:#94a3b8;margin:0 0 8px;font-weight:700;">' + correct + ' / ' + items.length + ' correct</div>';
    const rows = items.map(it =>
      '<div style="border-left:3px solid ' + (it.ok ? '#22c55e' : '#ef4444') + ';padding:6px 10px;margin:0 0 6px;background:rgba(148,163,184,0.06);border-radius:0 6px 6px 0;">' +
        '<div style="font-size:0.85em;color:var(--text-primary,#e6edf3);margin-bottom:2px;">' + _esc(it.q || '') + '</div>' +
        '<div style="font-size:0.82em;color:' + (it.ok ? '#34d399' : '#f87171') + ';">' + (it.ok ? '✓ ' : '✗ ') + _esc(String(it.a == null ? '-' : (it.a || '-'))) +
          (it.ok ? '' : ' <span style="color:#94a3b8;">&rarr; correct: <strong style="color:#cbd5e1;">' + _esc(String(it.correct || '')) + '</strong></span>') +
        '</div>' +
      '</div>').join('');
    return '<div style="padding:10px 12px;">' + head + rows + '</div>';
  }

  // ── Build the modal markup ─────────────────────────────────
  function _renderModalInner(student, p) {
    const initials = (student.name || student.email || '?').trim().charAt(0).toUpperCase();
    const isActive = p.lastActive && (Date.now() - p.lastActive.getTime()) < 7 * 24 * 60 * 60 * 1000;
    const lastActiveStr = p.lastActive
      ? p.lastActive.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Never';

    // Per-skill rows - only skills with sessions get a bar; others show "-".
    const skillRows = SKILL_META.map(sk => {
      const b = p.bySkill[sk.id] || { count: 0, sum: 0 };
      if (!b.count) {
        return `<div class="sd-skill-row sd-skill-empty">
          <span class="sd-skill-name">${sk.icon} ${sk.name}</span>
          <span class="sd-skill-none">no activity</span>
        </div>`;
      }
      // Divide by the MARKED count, not the session count. Pronunciation and
      // un-marked essays have sessions but no score, so dividing by b.count
      // would report a fraction of the real average.
      const n = (b.scored === undefined) ? b.count : b.scored;
      const avg = n ? Math.round(b.sum / n) : null;
      if (avg === null) {
        return `<div class="sd-skill-row">
          <span class="sd-skill-name">${sk.icon} ${sk.name}</span>
          <span class="sd-skill-count">${b.count} session${b.count === 1 ? '' : 's'}</span>
          <span class="sd-skill-none">not marked</span>
        </div>`;
      }
      const barColor = avg >= 80 ? '#22c55e' : avg >= 50 ? '#3b82f6' : '#ef4444';
      return `<div class="sd-skill-row">
        <span class="sd-skill-name">${sk.icon} ${sk.name}</span>
        <span class="sd-skill-count">${b.count} session${b.count === 1 ? '' : 's'}</span>
        <div class="sd-skill-bar"><div class="sd-skill-fill" style="width:${avg}%; background:${barColor};"></div></div>
        <span class="sd-skill-pct">${avg}%</span>
      </div>`;
    }).join('');

    // Assignments
    const STATUS_CHIP = {
      'done':        '<span class="sd-chip done">✅ Done</span>',
      'in-progress': '<span class="sd-chip prog">⏳ In progress</span>',
      'overdue':     '<span class="sd-chip overdue">❌ Overdue</span>',
      'not-started': '<span class="sd-chip none">⭕ Not started</span>'
    };
    const assignHtml = p.assignments.length
      ? p.assignments.map(({ a, comp, deadline, status }) => {
          const score = (comp && typeof comp.bestScore === 'number') ? ` · ${comp.bestScore}%` : '';
          const due = deadline ? deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
          const hasAns = comp && comp.answers && Array.isArray(comp.answers.items) && comp.answers.items.length;
          const aid = 'a' + (_ansSeq++);
          return `<div class="sd-assign-row"${hasAns ? ` data-ans="${aid}" style="cursor:pointer;"` : ''}>
            <div class="sd-assign-title">${_esc(a.title || 'Untitled')}<span class="sd-assign-meta"> · due ${due}${score}</span>${hasAns ? ' <span style="color:#60a5fa;font-size:0.82em;font-weight:700;">🔍 answers</span>' : ''}</div>
            ${STATUS_CHIP[status] || ''}
          </div>${hasAns ? `<div id="sdAnsRow-${aid}" style="display:none;">${_answerItemsHtml(comp.answers)}</div>` : ''}`;
        }).join('')
      : '<div class="sd-empty">No assignments target this student.</div>';

    // Recent sessions (last 12)
    const recent = [...p.sessions].sort((a, b) => {
      const da = _sessionDate(a), db = _sessionDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    }).slice(0, 12);
    const recentHtml = recent.length
      ? recent.map(s => {
          const d = _sessionDate(s);
          const ds = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
          const label = ACTIVITY_LABEL[s.activity] || s.activity || 'Session';
          const pct = (typeof s.percentage === 'number') ? `${s.percentage}%` : '-';
          const pctColor = (typeof s.percentage === 'number')
            ? (s.percentage >= 80 ? '#22c55e' : s.percentage >= 50 ? '#3b82f6' : '#ef4444')
            : '#94a3b8';
          const items = _itemsOf(s);
          const hasAns = !!(items && items.length);
          const aid = 's' + (_ansSeq++);
          return `<tr${hasAns ? ` data-ans="${aid}" style="cursor:pointer;"` : ''}>
            <td>${_esc(ds)}</td>
            <td>${_esc(label)}${hasAns ? ' <span style="color:#60a5fa;font-size:0.82em;">🔍 answers</span>' : ''}</td>
            <td style="color:${pctColor}; font-weight:600;">${pct}</td>
          </tr>${hasAns ? `<tr id="sdAnsRow-${aid}" style="display:none;"><td colspan="3" style="padding:0;">${_answerItemsHtml({ items: items })}</td></tr>` : ''}`;
        }).join('')
      : '<tr><td colspan="3" class="sd-empty">No sessions yet.</td></tr>';

    return `
      <div class="sd-modal-head">
        <div class="sd-avatar">${_esc(initials)}</div>
        <div class="sd-head-info">
          <div class="sd-name">${_esc(student.name || 'Unknown')}</div>
          <div class="sd-email">${_esc(student.email || '')}</div>
          <div class="sd-tags">
            <span class="sd-tag">${_esc(student.studentClass || '-')}</span>
            <span class="sd-tag">${_esc(student.level || '-')}</span>
            <span class="sd-tag">${_esc(student.module || '-')}</span>
            <span class="sd-tag">${_esc(student.academicYear || '-')}</span>
            <span class="sd-tag ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div class="sd-head-actions">
          ${(typeof isAdmin === 'function' && isAdmin()) ? '<button type="button" class="sd-btn" id="sdPrintBtn" title="Print / Save as PDF">🖨 Print / PDF</button>' : ''}
          <button type="button" class="sd-close" id="sdCloseBtn" aria-label="Close">✕</button>
        </div>
      </div>

      <div class="sd-quickstats">
        <div class="sd-qstat"><div class="sd-qval">${p.totalSessions}</div><div class="sd-qlbl">Sessions</div></div>
        <div class="sd-qstat"><div class="sd-qval">${p.avgScore}%</div><div class="sd-qlbl">Avg score</div></div>
        <div class="sd-qstat"><div class="sd-qval">${p.words}</div><div class="sd-qlbl">Words</div></div>
        <div class="sd-qstat"><div class="sd-qval" style="font-size:0.7em;">${_esc(lastActiveStr)}</div><div class="sd-qlbl">Last active</div></div>
      </div>

      <div class="sd-section">
        <h4 class="sd-h">Per-skill breakdown</h4>
        <div class="sd-skills">${skillRows}</div>
      </div>

      <div class="sd-section">
        <h4 class="sd-h">Assignments <span class="sd-count">(${p.assignments.length})</span></h4>
        <div class="sd-assigns">${assignHtml}</div>
      </div>

      <div class="sd-section">
        <h4 class="sd-h">Recent sessions</h4>
        <table class="sd-recent">
          <thead><tr><th>Date</th><th>Activity</th><th>Score</th></tr></thead>
          <tbody>${recentHtml}</tbody>
        </table>
        <!-- Only ever filled in when this student's full history could NOT be
             read, so the teacher knows the figures above are a recent slice
             rather than the whole term. Empty the rest of the time. -->
        <div id="sdHistoryNote" style="font-size:11.5px;color:var(--text-muted,#94a3b8);margin-top:8px;"></div>
      </div>
    `;
  }

  // ── Open / close ───────────────────────────────────────────
  let _lastFocus = null;
  // Which student the modal is currently showing. A late session query for a
  // student the teacher has already navigated away from is dropped.
  let _openFor = null;
  function openStudentDetailModal(studentId) {
    const student = _arr('students').find(s => s.id === studentId);
    if (!student) return;
    _openFor = studentId;
    const p = _computeProfile(student);
    const partial = !_cachedSessions(studentId);

    let bg = document.getElementById('sdModalOverlay');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'sdModalOverlay';
      bg.className = 'sd-overlay';
      document.body.appendChild(bg);
    }
    bg.innerHTML = `<div class="sd-modal" role="dialog" aria-modal="true">${_renderModalInner(student, p)}</div>`;
    bg.style.display = 'flex';
    // reflow then activate (scale-in)
    void bg.offsetWidth;
    bg.classList.add('active');
    _lastFocus = document.activeElement;

    const close = () => {
      _openFor = null;
      bg.classList.remove('active');
      setTimeout(() => { bg.style.display = 'none'; bg.innerHTML = ''; }, 200);
      document.removeEventListener('keydown', onEsc);
      if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (_) {} }
    };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);

    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });

    // Everything that has to be re-attached after a repaint lives in one
    // place, because the second paint below replaces the modal's innerHTML and
    // would otherwise leave a Close button that does nothing.
    function wire(profile) {
      const closeBtn = bg.querySelector('#sdCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', close);
      const printBtn = bg.querySelector('#sdPrintBtn');   // admin-only; absent for teachers
      if (printBtn) printBtn.addEventListener('click', () => printStudentReport(student, profile));
      // Clicking an assignment/session row that has itemised answers toggles an
      // inline panel showing each question, the student's answer, and the
      // correct answer.
      bg.querySelectorAll('[data-ans]').forEach((el) => {
        el.addEventListener('click', () => {
          const panel = bg.querySelector('#sdAnsRow-' + el.getAttribute('data-ans'));
          if (panel) panel.style.display = (panel.style.display === 'none' ? '' : 'none');
        });
      });
    }
    wire(p);

    // SECOND PAINT, with this student's COMPLETE history.
    //
    // Guarded on the modal still showing THIS student: a teacher who closes it
    // and opens someone else before the query lands must not get the previous
    // student's numbers painted over the new one.
    if (partial) {
      _fetchSessions(studentId).then(function () {
        if (_openFor !== studentId || bg.style.display === 'none') return;
        const fresh = _computeProfile(student);
        bg.innerHTML = `<div class="sd-modal" role="dialog" aria-modal="true">${_renderModalInner(student, fresh)}</div>`;
        wire(fresh);
      }).catch(function (e) {
        // What is on screen is not wrong, only partial, so it stays. Saying so
        // beats replacing real numbers with an error.
        console.warn('student-detail: full history unavailable', (e && e.code) || e);
        if (_openFor !== studentId || bg.style.display === 'none') return;
        const note = bg.querySelector('#sdHistoryNote');
        if (note) note.textContent = 'Recent activity only - the full history could not be loaded.';
      });
    }
  }

  // ── Missing#4: printable PDF report ────────────────────────
  // Opens a fresh window with a clean, print-optimized layout and
  // fires window.print(). The teacher's browser print dialog has a
  // "Save as PDF" destination - no PDF library needed.
  function printStudentReport(student, p) {
    const w = window.open('', '_blank', 'width=880,height=1000');
    if (!w) { AppDialog.alert('Pop-up blocked - allow pop-ups to print the report.'); return; }
    const isActive = p.lastActive && (Date.now() - p.lastActive.getTime()) < 7 * 24 * 60 * 60 * 1000;
    const lastActiveStr = p.lastActive
      ? p.lastActive.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Never';
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Best score per skill (the rollup only carries count + sum).
    const bestBySkill = {};
    p.sessions.forEach(s => {
      const pct = (typeof s.percentage === 'number') ? s.percentage : null;
      if (pct == null) return;
      const sk = _skillOfActivity(s);
      if (bestBySkill[sk] == null || pct > bestBySkill[sk]) bestBySkill[sk] = pct;
    });

    const skillRows = SKILL_META.map(sk => {
      const b = p.bySkill[sk.id] || { count: 0, sum: 0 };
      // Marked count, same reasoning as the modal rows above.
      const n = (b.scored === undefined) ? b.count : b.scored;
      const avg = n ? Math.round(b.sum / n) : null;
      const best = (bestBySkill[sk.id] != null) ? bestBySkill[sk.id] + '%' : '-';
      return `<tr>
        <td>${sk.icon} ${sk.name}</td>
        <td style="text-align:center;">${b.count || '-'}</td>
        <td style="text-align:center;">${avg == null ? '-' : avg + '%'}</td>
        <td style="text-align:center;">${best}</td>
      </tr>`;
    }).join('');

    const doneCount = p.assignments.filter(x => x.status === 'done').length;
    const STATUS_LABEL = { 'done':'Done', 'in-progress':'In progress', 'overdue':'Overdue', 'not-started':'Not started' };
    const assignRows = p.assignments.length
      ? p.assignments.map(({ a, comp, deadline, status }) => {
          const due = deadline ? deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
          const score = (comp && typeof comp.bestScore === 'number') ? comp.bestScore + '%' : '-';
          const skill = _esc(String(a.skill || a.type || '').replace(/^\w/, c => c.toUpperCase()));
          return `<tr><td>${_esc(a.title || 'Untitled')}</td><td>${skill || '-'}</td><td>${_esc(due)}</td><td>${_esc(STATUS_LABEL[status] || status)}</td><td style="text-align:center;">${score}</td></tr>`;
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:#888;">No assignments target this student.</td></tr>';

    // Recent sessions (newest first).
    const sortedSessions = [...p.sessions].sort((a, b) => {
      const da = _sessionDate(a), db = _sessionDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
    const recentRows = sortedSessions.length
      ? sortedSessions.slice(0, 25).map(s => {
          const d = _sessionDate(s);
          const ds = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
          const label = ACTIVITY_LABEL[s.activity] || s.activity || 'Session';
          const pct = (typeof s.percentage === 'number') ? s.percentage + '%' : '-';
          return `<tr><td>${_esc(ds)}</td><td>${_esc(label)}</td><td style="text-align:center;">${pct}</td></tr>`;
        }).join('')
      : '<tr><td colspan="3" style="text-align:center;color:#888;">No sessions recorded yet.</td></tr>';

    // Answer review - every attempt that captured itemised answers (assignment
    // completions first, then sessions newest-first). { q, a, correct, ok }.
    const attempts = [];
    p.assignments.forEach(({ a, comp }) => {
      if (comp && comp.answers && Array.isArray(comp.answers.items) && comp.answers.items.length)
        attempts.push({ title: a.title || 'Assignment', answers: comp.answers });
    });
    sortedSessions.forEach(s => {
      const d = _sessionDate(s);
      const ds = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const title = (ACTIVITY_LABEL[s.activity] || s.activity || 'Session') + (ds ? ' · ' + ds : '');
      const items = _itemsOf(s);
      if (items && items.length) attempts.push({ title: title, answers: { items: items } });
    });
    const answerSection = attempts.length
      ? attempts.map(at => {
          const items = at.answers.items;
          const correct = items.filter(it => it.ok).length;
          const rows = items.map((it, i) => `<tr>
            <td style="text-align:center;color:#94a3b8;">${i + 1}</td>
            <td>${_esc(it.q || '')}</td>
            <td style="color:${it.ok ? '#15803d' : '#b91c1c'};font-weight:600;">${_esc(it.a == null || it.a === '' ? '(blank)' : String(it.a))}</td>
            <td>${it.ok ? '<span style="color:#15803d;">correct</span>' : _esc(String(it.correct || ''))}</td>
          </tr>`).join('');
          return `<div class="ans-block">
            <div class="ans-h">${_esc(at.title)} <span class="ans-score">${correct} / ${items.length} correct</span></div>
            <table class="ans-tbl"><thead><tr><th style="width:22px;">#</th><th>Question</th><th>Their answer</th><th>Correct answer</th></tr></thead><tbody>${rows}</tbody></table>
          </div>`;
        }).join('')
      : '<p style="color:#888;font-size:13px;">No itemised answers were recorded for this student yet.</p>';

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Progress Report · ${_esc(student.name || 'Student')}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: var(--ll-font); color: #1e293b; padding: 32px 40px; max-width: 820px; margin: 0 auto; }
        h1 { font-size: 22px; margin: 0 0 2px; }
        .sub { color: #64748b; font-size: 13px; margin: 0 0 18px; }
        .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; margin-bottom: 18px; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; }
        .meta b { color: #475569; }
        .quick { display: flex; flex-wrap: wrap; gap: 22px; margin: 14px 0 22px; }
        .quick div { text-align: center; }
        .quick .v { font-size: 24px; font-weight: 800; color: #1d4ed8; }
        .quick .l { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin: 24px 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; color: #64748b; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .ans-block { margin: 0 0 16px; page-break-inside: avoid; }
        .ans-h { font-size: 13px; font-weight: 700; color: #334155; margin: 14px 0 4px; }
        .ans-score { font-weight: 600; color: #64748b; font-size: 12px; }
        .ans-tbl th { font-size: 11px; }
        .foot { margin-top: 28px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        @media print { body { padding: 0; } @page { margin: 1.5cm; } h2 { page-break-after: avoid; } }
      </style></head><body>
      <h1>${_esc(student.name || 'Student')} · Progress Report</h1>
      <p class="sub">${_esc(student.email || '')} · Generated ${today}</p>
      <div class="meta">
        <span><b>Class:</b> ${_esc(student.studentClass || '-')}</span>
        <span><b>Level:</b> ${_esc(student.level || '-')}</span>
        <span><b>Module:</b> ${_esc(student.module || '-')}</span>
        <span><b>Year:</b> ${_esc(student.academicYear || '-')}</span>
        <span><b>Status:</b> ${isActive ? 'Active' : 'Inactive'}</span>
        <span><b>Last active:</b> ${_esc(lastActiveStr)}</span>
      </div>
      <div class="quick">
        <div><div class="v">${p.totalSessions}</div><div class="l">Sessions</div></div>
        <div><div class="v">${p.avgScore}%</div><div class="l">Avg score</div></div>
        <div><div class="v">${p.words}</div><div class="l">Words learned</div></div>
        <div><div class="v">${doneCount}/${p.assignments.length}</div><div class="l">Assignments done</div></div>
      </div>
      <h2>Per-skill breakdown</h2>
      <table><thead><tr><th>Skill</th><th style="text-align:center;">Sessions</th><th style="text-align:center;">Avg score</th><th style="text-align:center;">Best</th></tr></thead><tbody>${skillRows}</tbody></table>
      <h2>Assignments</h2>
      <table><thead><tr><th>Assignment</th><th>Skill</th><th>Due</th><th>Status</th><th style="text-align:center;">Best</th></tr></thead><tbody>${assignRows}</tbody></table>
      <h2>Recent sessions <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:12px;color:#94a3b8;">(latest ${Math.min(25, sortedSessions.length)} of ${sortedSessions.length})</span></h2>
      <table><thead><tr><th>Date</th><th>Activity</th><th style="text-align:center;">Score</th></tr></thead><tbody>${recentRows}</tbody></table>
      <h2>Answer review</h2>
      ${answerSection}
      <div class="foot">Lingualab · FSM Language Trainer · confidential student progress report</div>
      </body></html>`);
    w.document.close();
    // Give the new window a tick to lay out before printing.
    setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 350);
  }

  // ── Wire row clicks (event delegation) ─────────────────────
  // The Students table rows + the explicit 👁 View button both open
  // the modal. We avoid hijacking clicks on the existing action
  // buttons (edit / promote / delete) by bailing if the click landed
  // on one of those.
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.btn-view[data-id]');
    if (viewBtn) { openStudentDetailModal(viewBtn.dataset.id); return; }
    // Row click - only inside the students table, and not on an action button.
    const row = e.target.closest('#studentsTableBody tr');
    if (row && !e.target.closest('.action-btn-small')) {
      const vb = row.querySelector('.btn-view[data-id]');
      if (vb) openStudentDetailModal(vb.dataset.id);
    }
  });

  window.openStudentDetailModal = openStudentDetailModal;
})();
