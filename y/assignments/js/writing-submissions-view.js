/* ============================================================
   WRITING SUBMISSIONS VIEWER — Phase 5
   Minimal modal that lists every writingSubmissions row for an
   assignment and lets the teacher open + read each essay. Builds
   the foundation for a future grading UI (the score / comment
   fields already exist on the doc — just no form to fill them
   in yet).

   Loaded after writing-form.js on teacher-dashboard.html.
   Exposes window.openWritingSubmissionsList(assignmentId).
   ============================================================ */

(function () {
  'use strict';

  // Cache so repeated open-close on the same assignment doesn't
  // re-fetch needlessly.
  const cache = new Map();

  // Active filter for the submissions list. 'all' | 'submitted'
  // | 'not_submitted' | 'late' | 'in_progress'.
  let _statusFilter = 'all';

  // Live snapshot unsubscriber — set when the modal is open so we
  // can detach the listener on close (no rule-read storms).
  let _liveUnsubscribe = null;

  // Current assignment context for the live render to pick up.
  let _ctx = null;

  function ensureModal() {
    if (document.getElementById('wsListModal')) return;
    const html = `
      <div id="wsListModal" class="modal-overlay">
        <div class="modal-box" style="max-width: 880px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <div style="position: sticky; top: 0; background: inherit; padding-bottom: 10px; z-index: 2; backdrop-filter: blur(6px);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h3 id="wsListTitle" style="margin:0;">✍️ Submissions</h3>
              <button class="modal-btn modal-btn-cancel" onclick="closeWritingSubmissionsList()" style="padding: 6px 14px;">Close</button>
            </div>
            <div id="wsListSubtitle" style="color: var(--text-muted); font-size: 0.9em; margin-top: 6px;"></div>
          </div>
          <div id="wsListBody" style="margin-top: 12px;"></div>
        </div>
      </div>

      <!-- Phase G.5: full-screen essay viewer.
           The cramped 760px modal got replaced with a takeover view so
           we can fit rubric + essay + per-criterion grading on one screen
           without scrolling overload. The inner is a two-column grid that
           collapses on narrow viewports. -->
      <div id="wsEssayModal" class="modal-overlay">
        <div class="modal-box"
             style="max-width: 1280px; width: 96vw; max-height: 96vh;
                    overflow: hidden; padding: 0; display: flex;
                    flex-direction: column;">
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center;
                      padding: 14px 20px; border-bottom: 1px solid var(--border-color);
                      background: rgba(168,85,247,0.06);">
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <span style="font-size: 1.5em;">📄</span>
              <div style="min-width:0;">
                <h3 id="wsEssayTitle"
                    style="margin:0; font-size: 1.05em; color: var(--text-primary);
                           white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Essay</h3>
                <div id="wsEssayStudentMeta"
                     style="color: var(--text-muted); font-size: 0.82em; margin-top: 2px;"></div>
              </div>
            </div>
            <button class="modal-btn modal-btn-cancel"
                    onclick="closeWritingEssay()" style="padding: 6px 14px;">✕ Close</button>
          </div>

          <!-- Body: two-column grid (essay+rubric / grading sidebar) -->
          <div id="wsEssayGrid"
               style="display: grid; grid-template-columns: minmax(0, 1fr) 380px;
                      gap: 18px; padding: 18px 20px; overflow: hidden; flex: 1;">
            <!-- Left column: rubric + essay -->
            <div id="wsEssayLeftCol"
                 style="display: flex; flex-direction: column; gap: 14px;
                        overflow-y: auto; min-height: 0;">
              <div id="wsEssayMeta"
                   style="color: var(--text-muted); font-size: 0.85em;"></div>
              <div id="wsEssayRubric"></div>
              <div id="wsEssayBody"
                   style="white-space: pre-wrap; line-height: 1.7; color: var(--text-primary);
                          padding: 18px 20px; background: rgba(255,255,255,0.03);
                          border: 1px solid var(--border-color); border-radius: 10px;
                          font-size: 1.02em; min-height: 220px;
                          font-family: Georgia, 'Times New Roman', serif;"></div>
            </div>

            <!-- Right column: grading sidebar -->
            <div id="wsEssayFooter"
                 style="overflow-y: auto; min-height: 0;
                        background: rgba(167,139,250,0.05); border: 1px solid rgba(167,139,250,0.20);
                        border-radius: 10px; padding: 14px;"></div>
          </div>
        </div>
      </div>

      <!-- Responsive: stack on narrow viewports -->
      <style id="wsEssayResponsiveCss">
        @media (max-width: 900px) {
          #wsEssayGrid {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto;
            overflow-y: auto !important;
          }
          #wsEssayLeftCol, #wsEssayFooter {
            overflow: visible !important;
          }
        }
      </style>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  }

  async function openWritingSubmissionsList(assignmentId) {
    ensureModal();
    const modal    = document.getElementById('wsListModal');
    const titleEl  = document.getElementById('wsListTitle');
    const subEl    = document.getElementById('wsListSubtitle');
    const bodyEl   = document.getElementById('wsListBody');

    const a = (typeof allAssignments !== 'undefined' ? allAssignments : []).find(x => x.id === assignmentId);
    titleEl.textContent = '✍️ Submissions — ' + (a?.title || 'Writing Assignment');
    subEl.textContent   = a?.prompt
      ? a.prompt.slice(0, 180) + (a.prompt.length > 180 ? '…' : '')
      : '';
    bodyEl.innerHTML    = '<p style="color: var(--text-muted); padding: 30px; text-align: center;">Loading submissions…</p>';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Stash context for the live render.
    _ctx = { assignmentId, assignment: a, roster: [], submissions: [] };
    _statusFilter = 'all';

    // Compute the target roster — every student the assignment targets,
    // even those who haven't submitted yet. This is what makes the panel
    // a tracking dashboard rather than just a submitter list.
    _ctx.roster = computeTargetRoster(a);

    // Attach a live snapshot listener so the panel updates the moment
    // a student submits. Detached on close.
    try {
      _liveUnsubscribe = db.collection('writingSubmissions')
        .where('assignmentId', '==', assignmentId)
        .onSnapshot((snap) => {
          const rows = [];
          snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
          _ctx.submissions = rows;
          cache.set(assignmentId, rows);
          renderTracker();
        }, (err) => {
          console.error('Submissions snapshot failed:', err);
          if (err.code === 'failed-precondition' && err.message && err.message.includes('index')) {
            const m = err.message.match(/https?:\/\/\S+/);
            bodyEl.innerHTML = `
              <div style="padding: 24px; color: var(--text-muted); text-align: center;">
                <div style="font-size: 2em; margin-bottom: 8px;">⏳</div>
                <p>Firestore needs a composite index to list submissions.</p>
                ${m ? `<a href="${m[0]}" target="_blank" style="color: var(--accent-primary); text-decoration: underline;">Create / check index in Firebase Console →</a>` : ''}
              </div>
            `;
          } else {
            bodyEl.innerHTML = `<p style="color: var(--error); padding: 30px; text-align: center;">Error: ${err.message || err}</p>`;
          }
        });
    } catch (err) {
      console.error('Submissions listener attach failed:', err);
      bodyEl.innerHTML = `<p style="color: var(--error); padding: 30px; text-align: center;">${err.message || err}</p>`;
    }
  }

  // Builds the list of students the assignment targets, from the
  // already-loaded allStudents global. Works for all four target
  // scopes (class / level / module / individual).
  function computeTargetRoster(a) {
    if (!a) return [];
    const all = Array.isArray(allStudents) ? allStudents : [];
    if (a.targetType === 'class') {
      const tc = String(a.targetClass || '').trim().toUpperCase();
      return all.filter(s => String(s.studentClass || '').trim().toUpperCase() === tc);
    }
    if (a.targetType === 'level') {
      return all.filter(s => String(s.level || '').trim() === String(a.targetLevel || '').trim());
    }
    if (a.targetType === 'module') {
      return all.filter(s => String(s.module || '').trim() === String(a.targetModule || '').trim());
    }
    if (a.targetType === 'individual') {
      const ids = Array.isArray(a.targetStudents) ? a.targetStudents : [];
      return all.filter(s => ids.includes(s.id));
    }
    return [];
  }

  // Renders the dashboard (header + filter pills + status table).
  // Called both on first open AND on every onSnapshot tick — that's
  // what makes it a "live" tracking dashboard.
  function renderTracker() {
    if (!_ctx) return;
    const bodyEl = document.getElementById('wsListBody');
    if (!bodyEl) return;
    const a       = _ctx.assignment;
    const roster  = _ctx.roster;
    const subs    = _ctx.submissions;
    const subById = new Map(subs.map(r => [r.userId, r]));

    const deadline = a?.deadline?.toDate ? a.deadline.toDate() : (a?.deadline ? new Date(a.deadline) : null);
    const now      = Date.now();

    // Compute per-student status. Order of precedence:
    //   - sub.status === 'returned'   → 'returned' (teacher has sent it
    //     back to the student, waiting on revision — DON'T classify as
    //     "submitted needs grading" anymore; the teacher already acted)
    //   - sub.status === 'graded'     → 'graded'
    //   - submitted before deadline   → 'submitted'
    //   - submitted after deadline    → 'late'
    //   - no submission + past due    → 'overdue'
    //   - no submission + before due  → 'not_submitted'
    const decorated = roster.map(s => {
      const sub = subById.get(s.id);
      let status = 'not_submitted';
      let when   = null;
      if (sub) {
        const submittedAt = sub.submittedAt?.toDate ? sub.submittedAt.toDate() : null;
        if (sub.status === 'returned') {
          status = 'returned';
        } else if (submittedAt && deadline && submittedAt > deadline) {
          status = 'late';
        } else if (sub.status === 'graded') {
          status = 'graded';
        } else {
          status = 'submitted';
        }
        when = submittedAt;
      } else if (deadline && deadline.getTime() < now) {
        status = 'overdue';
      }
      return { student: s, sub, status, when };
    });

    // Counters for the filter chips. `returned` is its own bucket —
    // teacher has done their part, ball is in the student's court.
    const counts = {
      all:           decorated.length,
      submitted:     decorated.filter(d => d.status === 'submitted' || d.status === 'graded' || d.status === 'late').length,
      returned:      decorated.filter(d => d.status === 'returned').length,
      not_submitted: decorated.filter(d => d.status === 'not_submitted' || d.status === 'overdue').length,
      late:          decorated.filter(d => d.status === 'late').length,
      overdue:       decorated.filter(d => d.status === 'overdue').length
    };

    // Build the filter strip.
    const filterChip = (id, label, color) => `
      <button type="button"
              class="ws-filter-pill ${_statusFilter === id ? 'active' : ''}"
              data-filter="${id}"
              style="background:${_statusFilter === id ? color : 'rgba(255,255,255,0.04)'}; color:${_statusFilter === id ? '#fff' : 'var(--text-secondary)'}; border:1px solid ${_statusFilter === id ? color : 'rgba(255,255,255,0.10)'}; padding:5px 12px; border-radius:999px; font-size:0.85em; font-weight:600; cursor:pointer;">
        ${label} <span style="opacity:0.7;">(${counts[id] || 0})</span>
      </button>
    `;
    const filterStrip = `
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin: 0 0 12px 0;">
        ${filterChip('all',           'All',             'var(--accent-primary)')}
        ${filterChip('submitted',     '✓ Submitted',     'var(--success)')}
        ${filterChip('returned',      '🔄 Returned',     '#f59e0b')}
        ${filterChip('not_submitted', '⏳ Not submitted', 'var(--text-muted)')}
        ${filterChip('late',          '⚠ Late',          'var(--warning)')}
        ${filterChip('overdue',       '❌ Overdue',      'var(--error)')}
      </div>
    `;

    // Apply filter. `submitted` now EXCLUDES returned essays — once
    // a teacher returns one, it's the student's job, not part of the
    // "pending grading" queue.
    const visible = decorated.filter(d => {
      if (_statusFilter === 'all')           return true;
      if (_statusFilter === 'submitted')     return d.status === 'submitted' || d.status === 'graded' || d.status === 'late';
      if (_statusFilter === 'returned')      return d.status === 'returned';
      if (_statusFilter === 'not_submitted') return d.status === 'not_submitted' || d.status === 'overdue';
      if (_statusFilter === 'late')          return d.status === 'late';
      if (_statusFilter === 'overdue')       return d.status === 'overdue';
      return true;
    });

    // Live banner showing the headline numbers.
    const summaryBanner = `
      <div style="display:flex; gap: 14px; flex-wrap:wrap; padding: 8px 12px; background: rgba(167, 139, 250, 0.08); border:1px solid rgba(167, 139, 250, 0.25); border-radius:10px; margin-bottom: 12px; font-size: 0.88em;">
        <span><strong style="color: var(--text-primary);">${counts.submitted}</strong> / ${roster.length} submitted</span>
        ${counts.returned > 0 ? `<span style="color: #f59e0b;"><strong>${counts.returned}</strong> 🔄 awaiting revision</span>` : ''}
        ${counts.late    > 0 ? `<span style="color: var(--warning);"><strong>${counts.late}</strong> late</span>` : ''}
        ${counts.overdue > 0 ? `<span style="color: var(--error);"><strong>${counts.overdue}</strong> overdue</span>` : ''}
        <span style="margin-left:auto; color: var(--text-muted); font-size: 0.85em;">🔴 Live</span>
      </div>
    `;

    // Empty-state for no roster (target list empty).
    if (roster.length === 0) {
      bodyEl.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 2.6em; margin-bottom: 8px;">👥</div>
          <p>No students match this assignment's target.</p>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = summaryBanner + filterStrip + `
      <table style="width:100%; border-collapse: collapse; font-size: 0.92em;">
        <thead>
          <tr style="background: rgba(255,255,255,0.04); text-align: left;">
            <th style="padding: 10px 12px;">Student</th>
            <th style="padding: 10px 12px;">Class</th>
            <th style="padding: 10px 12px; text-align: center;">Words</th>
            <th style="padding: 10px 12px; text-align: center;">Time</th>
            <th style="padding: 10px 12px; text-align: center;">Status</th>
            <th style="padding: 10px 12px;"></th>
          </tr>
        </thead>
        <tbody>
          ${visible.map(({ student, sub, status, when }) => {
            const time = sub?.timeSpentSec ? `${Math.floor(sub.timeSpentSec / 60)}m ${sub.timeSpentSec % 60}s` : '—';
            const auto = sub?.autoSubmitted ? ` <span title="Auto-submitted on timeout" style="color: var(--warning);">⏱</span>` : '';
            const breach = (sub && (sub.tabSwitches || 0) > 0) ? ` <span title="Tab switched ${sub.tabSwitches} time(s)" style="color: var(--warning);">⚠ ${sub.tabSwitches}</span>` : '';
            const statusBadge = (function () {
              const map = {
                submitted:     { lbl: '✓ Submitted',    color: 'var(--success)' },
                graded:        { lbl: '🎓 Graded',       color: 'var(--success)' },
                returned:      { lbl: '🔄 Returned',     color: '#f59e0b' },
                late:          { lbl: '⚠ Late',          color: 'var(--warning)' },
                overdue:       { lbl: '❌ Overdue',      color: 'var(--error)' },
                not_submitted: { lbl: '⏳ Not submitted', color: 'var(--text-muted)' }
              };
              const m = map[status] || map.not_submitted;
              return `<span style="background: rgba(${_skillRgb(m.color)},0.12); color: ${m.color}; padding: 3px 10px; border-radius: 10px; font-weight: 700; font-size: 0.85em; white-space: nowrap;">${m.lbl}</span>`;
            })();
            // View-essay button: prominent for fresh submissions (teacher
            // needs to grade them), muted for returned ones (teacher
            // already acted — student's turn now). The button still
            // works in both states so the teacher can re-check what
            // they returned, but the visual hierarchy stops shouting.
            const viewBtn = sub
              ? (status === 'returned'
                  ? `<button class="modal-btn modal-btn-cancel" style="padding: 5px 12px; font-size: 0.85em; opacity: 0.75;"
                             title="Waiting on student revision"
                             onclick="openWritingEssay('${sub.id.replace(/'/g, "\\'")}', '${String(_ctx.assignmentId).replace(/'/g, "\\'")}')">📖 Re-open</button>`
                  : `<button class="modal-btn modal-btn-save" style="padding: 5px 12px; font-size: 0.85em;"
                             onclick="openWritingEssay('${sub.id.replace(/'/g, "\\'")}', '${String(_ctx.assignmentId).replace(/'/g, "\\'")}')">View essay</button>`)
              : `<span style="color: var(--text-dim); font-size: 0.85em;">—</span>`;
            return `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 10px 12px;">${(student.name || student.email || 'Student').replace(/</g,'&lt;')}${auto}${breach}</td>
                <td style="padding: 10px 12px; color: var(--text-muted);">${(student.studentClass || '').replace(/</g,'&lt;')}</td>
                <td style="padding: 10px 12px; text-align: center;">${sub?.wordCount || '—'}</td>
                <td style="padding: 10px 12px; text-align: center; color: var(--text-muted);">${time}</td>
                <td style="padding: 10px 12px; text-align: center;">${statusBadge}</td>
                <td style="padding: 10px 12px; text-align: right;">${viewBtn}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Wire the filter pill clicks.
    bodyEl.querySelectorAll('.ws-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        _statusFilter = btn.dataset.filter;
        renderTracker();
      });
    });
  }

  // Tiny helper to colorize rgba() for the status badge backgrounds —
  // accepts either a hex string or a CSS var() expression.
  function _skillRgb(v) {
    if (!v) return '255,255,255';
    const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(v);
    if (m) return `${parseInt(m[1],16)}, ${parseInt(m[2],16)}, ${parseInt(m[3],16)}`;
    // For CSS-var values we just use a neutral white. The text colour
    // is what matters visually; the background tint is decorative.
    return '255,255,255';
  }

  function closeWritingSubmissionsList() {
    const modal = document.getElementById('wsListModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    // Detach the live listener — otherwise it keeps reading docs
    // forever, which would burn Firestore reads in the background.
    if (typeof _liveUnsubscribe === 'function') {
      try { _liveUnsubscribe(); } catch (_) {}
      _liveUnsubscribe = null;
    }
    _ctx = null;

    // No manual refresh needed: loadAssignmentCompletions() now stays
    // live via onSnapshot, so the assignment-row completion bar is
    // already in sync with whatever the Submissions dashboard just
    // showed.
  }

  async function openWritingEssay(submissionId, assignmentId) {
    ensureModal();
    const modal = document.getElementById('wsEssayModal');
    const titleEl = document.getElementById('wsEssayTitle');
    const studentMetaEl = document.getElementById('wsEssayStudentMeta');
    const metaEl  = document.getElementById('wsEssayMeta');
    const rubricEl = document.getElementById('wsEssayRubric');
    const bodyEl  = document.getElementById('wsEssayBody');
    const footerEl = document.getElementById('wsEssayFooter');

    bodyEl.textContent = 'Loading…';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Try cache first
    let row = null;
    if (cache.has(assignmentId)) {
      row = cache.get(assignmentId).find(r => r.id === submissionId);
    }
    if (!row) {
      try {
        const d = await db.collection('writingSubmissions').doc(submissionId).get();
        if (d.exists) row = { id: d.id, ...d.data() };
      } catch (err) {
        bodyEl.textContent = 'Failed to load: ' + (err.message || err);
        return;
      }
    }
    if (!row) {
      bodyEl.textContent = 'Submission not found.';
      return;
    }

    // Look up the assignment for rubric + title context.
    const a = (typeof allAssignments !== 'undefined' ? allAssignments : []).find(x => x.id === assignmentId) || {};

    // ── Header ──
    titleEl.textContent = (a.title || 'Writing Assignment');
    const subAt   = row.submittedAt?.toDate?.() || (row.submittedAt ? new Date(row.submittedAt) : null);
    const subAtTxt = subAt ? subAt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
    studentMetaEl.innerHTML = `
      <strong style="color:#cbd5e1;">${escAttr(row.userName || 'Student')}</strong>
      ${row.studentClass ? ` · Class ${escAttr(row.studentClass)}` : ''}
      ${row.level ? ` · ${escAttr(row.level)}` : ''}
      &nbsp;·&nbsp; Submitted ${subAtTxt}
    `;

    // ── Stats meta row (left col, above rubric) ──
    metaEl.innerHTML = `
      <span><strong>Words:</strong> ${row.wordCount || 0}</span>
      &nbsp;·&nbsp; <span><strong>Time:</strong> ${row.timeSpentSec ? Math.floor(row.timeSpentSec / 60) + 'm ' + (row.timeSpentSec % 60) + 's' : '—'}</span>
      &nbsp;·&nbsp; <span><strong>Status:</strong> ${row.status || 'submitted'}</span>
      ${row.autoSubmitted ? '&nbsp;·&nbsp; <span style="color: var(--warning);">⏱ Auto-submitted</span>' : ''}
      ${(row.tabSwitches || 0) > 0 ? `&nbsp;·&nbsp; <span style="color: var(--warning);">⚠ Tab switched ${row.tabSwitches}×</span>` : ''}
    `;

    // ── Rubric panel (Phase G.4) ──
    // The rubric lives on the assignment doc as free-form text and/or
    // a link to a hosted PDF/Doc. If neither is set we skip the panel
    // entirely rather than show a placeholder.
    const rubricText = String(a.rubric || '').trim();
    const rubricUrl  = String(a.rubricUrl || '').trim();
    if (rubricText || rubricUrl) {
      rubricEl.innerHTML = `
        <details open style="background: rgba(45, 212, 191, 0.06);
                             border: 1px solid rgba(45, 212, 191, 0.25);
                             border-radius: 10px; padding: 10px 14px;">
          <summary style="cursor: pointer; font-weight: 700; color: #5eead4;
                          font-size: 0.85em; letter-spacing: 0.04em;
                          text-transform: uppercase;">
            📋 Rubric (click to collapse)
          </summary>
          ${rubricText ? `
            <div style="margin-top: 8px; color: var(--text-primary);
                        font-size: 0.93em; line-height: 1.6;
                        white-space: pre-wrap;">
              ${escHtml(rubricText)}
            </div>
          ` : ''}
          ${rubricUrl ? `
            <div style="margin-top: 10px;">
              <a href="${escAttr(rubricUrl)}" target="_blank" rel="noopener"
                 style="display: inline-flex; align-items: center; gap: 6px;
                        background: rgba(45, 212, 191, 0.18); color: #99f6e4;
                        border: 1px solid rgba(45, 212, 191, 0.40);
                        padding: 6px 12px; border-radius: 8px;
                        text-decoration: none; font-weight: 600; font-size: 0.88em;">
                📎 Open rubric file →
              </a>
            </div>
          ` : ''}
        </details>
      `;
    } else {
      rubricEl.innerHTML = '';
    }

    // ── Essay body + inline annotations (Phase: writing feedback v2) ──
    // The essay is now an interactive surface: select text → right-click
    // (or use the floating button) → criterion + score + comment bank →
    // an anchored inline comment. Falls back to plain text if the
    // annotation engine didn't load, so grading never breaks.
    const rubricType = a.rubricType || 'essay';
    if (window.WritingAnnotations) {
      _setupAnnotations(bodyEl, row, submissionId, assignmentId, rubricType);
    } else {
      bodyEl.textContent = row.responseText || '(No text submitted.)';
    }

    // Phone guard — inline tools need a real screen. Non-blocking warn.
    if (window.WritingAnnotations && WritingAnnotations.isPhone()) {
      const warn = document.createElement('div');
      warn.style.cssText = 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);'
        + 'color:#fcd34d;border-radius:8px;padding:8px 12px;font-size:0.85em;margin-bottom:10px;';
      warn.textContent = '⚠ Grading is best on a computer — the inline-comment tools are hard to use on a small screen.';
      metaEl.parentNode.insertBefore(warn, metaEl);
    }

    // ── Grading sidebar (Phase G.6 — criterion-based) ──
    // Replaces the old single-score input with four criterion sliders
    // (TA / CC / GR / VO, each 0..5). The total = sum, capped at 20,
    // and is what we write to the `score` field for backward compat.
    // The four criterion values also go up in a `criteria` map so the
    // student dashboard can show the breakdown.
    const criteria = row.criteria || {};
    const cTA = criteria.TA != null ? criteria.TA : '';
    const cCC = criteria.CC != null ? criteria.CC : '';
    const cGR = criteria.GR != null ? criteria.GR : '';
    const cVO = criteria.VO != null ? criteria.VO : '';
    const currentComment = row.teacherComment || '';
    const currentStatus  = row.status || 'submitted';
    const gradedByName   = row.gradedBy || '';
    const gradedAtTxt    = row.gradedAt && row.gradedAt.toDate
      ? row.gradedAt.toDate().toLocaleString()
      : (row.gradedAt ? new Date(row.gradedAt).toLocaleString() : '');

    footerEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="margin: 0; color: var(--text-primary);">🎓 Grading</h4>
      </div>
      ${gradedAtTxt ? `
        <div style="font-size: 0.78em; color: var(--text-muted); margin-bottom: 10px;">
          Last graded ${escHtml(gradedAtTxt)} by ${escHtml(gradedByName)}
        </div>
      ` : ''}

      <!-- Criterion grid -->
      <div style="font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em;
                  color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">
        Per-criterion score (each /5)
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        ${_criterionInput('wsGradeTA', 'TA', 'Task Achievement', cTA)}
        ${_criterionInput('wsGradeCC', 'CC', 'Coherence & Cohesion', cCC)}
        ${_criterionInput('wsGradeGR', 'GR', 'Grammatical Range', cGR)}
        ${_criterionInput('wsGradeVO', 'VO', 'Vocabulary', cVO)}
      </div>

      <!-- Total (auto-computed, read-only) -->
      <div style="display: flex; align-items: center; justify-content: space-between;
                  padding: 8px 12px; border-radius: 8px;
                  background: rgba(168,85,247,0.10);
                  border: 1px solid rgba(168,85,247,0.30);
                  margin-bottom: 12px;">
        <span style="font-weight: 700; color: var(--text-primary);">Total</span>
        <span id="wsGradeTotal" style="font-weight: 800; font-size: 1.2em; color: #c4b5fd;">
          — / 20
        </span>
      </div>

      <!-- Comment -->
      <label for="wsGradeComment" style="display:block; font-weight: 600; color: var(--text-primary);
                                          margin-bottom: 4px; font-size: 0.92em;">Overall comment</label>
      <textarea id="wsGradeComment" rows="4"
                placeholder="Feedback for the student (visible after Graded / Returned)…"
                style="width: 100%; padding: 8px 10px; border-radius: 8px;
                       background: var(--bg-item, rgba(255,255,255,0.04));
                       color: var(--text-primary); border: 1px solid var(--border-color);
                       resize: vertical; font-family: inherit; font-size: 0.92em;
                       margin-bottom: 12px; box-sizing: border-box;">${escHtml(currentComment)}</textarea>

      <!-- Status -->
      <label for="wsGradeStatus" style="display:block; font-weight: 600;
                                         color: var(--text-primary); margin-bottom: 4px;
                                         font-size: 0.92em;">Status</label>
      <select id="wsGradeStatus"
              style="padding: 8px 10px; border-radius: 8px; width: 100%; box-sizing: border-box;
                     background: var(--bg-item, rgba(255,255,255,0.04));
                     color: var(--text-primary); border: 1px solid var(--border-color);
                     margin-bottom: 4px;">
        <option value="submitted" ${currentStatus === 'submitted' ? 'selected' : ''}>⏳ Submitted (not yet graded)</option>
        <option value="graded"    ${currentStatus === 'graded'    ? 'selected' : ''}>✅ Graded (final)</option>
        <option value="returned"  ${currentStatus === 'returned'  ? 'selected' : ''}>🔄 Returned (ask student to revise)</option>
      </select>
      <div style="font-size: 0.76em; color: var(--text-muted);
                  margin-bottom: 14px; line-height: 1.45;">
        Pick <strong>Returned</strong> to send the essay back for revision. Comment + scores are preserved as context.
      </div>

      <!-- Save -->
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="modal-btn modal-btn-cancel" onclick="closeWritingEssay()">Close</button>
        <button class="modal-btn modal-btn-save" id="wsGradeSaveBtn">💾 Save grade</button>
      </div>
      <div id="wsGradeError" style="margin-top: 8px; color: var(--error); font-size: 0.88em; display: none;"></div>
    `;

    // Wire live total + save handler.
    const tEls = ['wsGradeTA', 'wsGradeCC', 'wsGradeGR', 'wsGradeVO'].map(id => document.getElementById(id));
    const totalEl = document.getElementById('wsGradeTotal');
    function recomputeTotal() {
      let sum = 0; let any = false;
      tEls.forEach(el => {
        if (!el) return;
        const v = el.value.trim();
        if (v !== '') { sum += Number(v) || 0; any = true; }
      });
      totalEl.textContent = any ? `${sum.toFixed(1)} / 20` : '— / 20';
      totalEl.style.color = !any ? '#94a3b8'
                          : sum >= 16 ? '#86efac'
                          : sum >= 12 ? '#7dd3fc'
                          : '#fcd34d';
    }
    tEls.forEach(el => el && el.addEventListener('input', recomputeTotal));
    recomputeTotal();

    const saveBtn = document.getElementById('wsGradeSaveBtn');
    if (saveBtn) {
      saveBtn.onclick = () => saveGrading(submissionId, assignmentId);
    }
  }

  // ── Inline-annotation wiring for the teacher grading view ──
  // Holds the working annotation list for the open essay, renders the
  // highlights, and wires select → compose. Annotations auto-persist
  // on every add/delete so a teacher never loses them by forgetting to
  // press "Save grade". They're ALSO included in saveGrading.
  let _annState = null;   // { submissionId, assignmentId, list, text, rubric }

  function _setupAnnotations(bodyEl, row, submissionId, assignmentId, rubric) {
    const text = row.responseText || '';
    _annState = {
      submissionId, assignmentId, rubric,
      text,
      list: Array.isArray(row.annotations) ? row.annotations.slice() : []
    };

    function rerender() {
      WritingAnnotations.render(bodyEl, text, _annState.list, {
        mode: 'teacher',
        rubric: rubric,
        onDelete: (id) => {
          _annState.list = _annState.list.filter(x => x.id !== id);
          _persistAnnotations();
          rerender();
        }
      });
    }
    rerender();

    // Floating "💬 Comment" button shown when text is selected inside
    // the essay. Covers trackpads / anyone who doesn't right-click.
    let fab = document.getElementById('waFab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'waFab';
      fab.type = 'button';
      fab.textContent = '💬 Comment';
      fab.style.cssText = 'position:absolute;z-index:10060;display:none;'
        + 'background:#6366f1;color:#fff;border:none;border-radius:8px;padding:6px 12px;'
        + 'font-family:inherit;font-weight:600;font-size:0.85em;cursor:pointer;'
        + 'box-shadow:0 6px 20px rgba(99,102,241,0.5);';
      document.body.appendChild(fab);
    }
    let pendingSel = null;
    function hideFab() { fab.style.display = 'none'; pendingSel = null; }

    function onSelect(ev) {
      const sel = WritingAnnotations.getSelection(bodyEl);
      if (!sel) { hideFab(); return; }
      pendingSel = sel;
      // Position the FAB near the selection end.
      const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
      fab.style.top = (window.scrollY + r.bottom + 6) + 'px';
      fab.style.left = (window.scrollX + r.left) + 'px';
      fab.style.display = 'block';
    }
    bodyEl.addEventListener('mouseup', onSelect);
    bodyEl.addEventListener('keyup', onSelect);

    fab.onclick = () => { if (pendingSel) { compose(pendingSel); hideFab(); } };

    // Right-click anywhere in the essay with an active selection → compose.
    bodyEl.addEventListener('contextmenu', (e) => {
      const sel = WritingAnnotations.getSelection(bodyEl);
      if (sel) { e.preventDefault(); compose(sel); hideFab(); }
    });

    function compose(sel) {
      WritingAnnotations.openComposer({
        rubric: rubric,
        quote: sel.quote,
        onSave: (partial) => {
          const ann = {
            id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            criterion: partial.criterion,
            score: partial.score,
            text: partial.text,
            quote: sel.quote,
            start: sel.start,
            end: sel.end,
            by: (window.auth && auth.currentUser && auth.currentUser.email) || 'teacher'
          };
          _annState.list.push(ann);
          _persistAnnotations();
          rerender();
        }
      });
    }
  }

  // Persist just the annotations array (auto-save). The Firestore rule
  // allows the teacher-grading branch to touch `annotations` on its own.
  async function _persistAnnotations() {
    if (!_annState) return;
    try {
      await db.collection('writingSubmissions').doc(_annState.submissionId)
        .update({ annotations: _annState.list });
      // keep the cache row in sync so re-open shows them
      const rows = cache.get(_annState.assignmentId);
      if (rows) {
        const r = rows.find(x => x.id === _annState.submissionId);
        if (r) r.annotations = _annState.list.slice();
      }
    } catch (e) {
      console.warn('annotation auto-save failed:', e && e.message);
    }
  }

  // Tiny rendering helpers — escape user content for safe inline HTML,
  // and build a labeled criterion input cell.
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escAttr(s) { return escHtml(s); }
  function _criterionInput(id, code, fullName, value) {
    return `
      <div>
        <label for="${id}" style="display:block; font-weight: 700; font-size: 0.88em;
                                  color: var(--text-primary); margin-bottom: 4px;">
          ${escHtml(code)}
          <span style="font-weight: 400; color: var(--text-muted); font-size: 0.82em;">
            · ${escHtml(fullName)}
          </span>
        </label>
        <input type="number" id="${id}" min="0" max="5" step="0.5" value="${value === '' ? '' : escAttr(value)}"
               placeholder="0–5"
               style="padding: 8px 10px; border-radius: 8px; width: 100%; box-sizing: border-box;
                      background: var(--bg-item, rgba(255,255,255,0.04));
                      color: var(--text-primary); border: 1px solid var(--border-color);
                      font-size: 1em;">
      </div>
    `;
  }

  // Persists the teacher's grade back to the writingSubmissions doc.
  // Only allowed fields go up (the rule enforces the same limitation),
  // and the cache is updated locally so the row reflects the new
  // status without round-tripping to Firestore.
  async function saveGrading(submissionId, assignmentId) {
    const saveBtn = document.getElementById('wsGradeSaveBtn');
    const errEl   = document.getElementById('wsGradeError');
    const cmtEl   = document.getElementById('wsGradeComment');
    const stEl    = document.getElementById('wsGradeStatus');
    // Phase G.6 — criterion inputs replace the single score field.
    const taEl = document.getElementById('wsGradeTA');
    const ccEl = document.getElementById('wsGradeCC');
    const grEl = document.getElementById('wsGradeGR');
    const voEl = document.getElementById('wsGradeVO');

    function showErr(msg) {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
    function clearErr() { if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; } }
    clearErr();

    const status = stEl ? stEl.value : 'submitted';

    // Parse each criterion. Empty → null; otherwise must be 0..5.
    function parseCrit(el, code) {
      if (!el) return { ok: true, value: null };
      const raw = el.value.trim();
      if (raw === '') return { ok: true, value: null };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 5) {
        return { ok: false, error: `${code} must be a number between 0 and 5.` };
      }
      return { ok: true, value: n };
    }
    const pTA = parseCrit(taEl, 'TA');
    const pCC = parseCrit(ccEl, 'CC');
    const pGR = parseCrit(grEl, 'GR');
    const pVO = parseCrit(voEl, 'VO');
    for (const p of [pTA, pCC, pGR, pVO]) {
      if (!p.ok) { showErr(p.error); return; }
    }

    // Build the criteria map. If ANY criterion is set, persist all four
    // (missing ones become 0 so the math works downstream). If NONE are
    // set, criteria stays null — the rule allows that for backwards
    // compat with the old single-score path.
    const anyCrit = [pTA, pCC, pGR, pVO].some(p => p.value != null);
    let criteria = null;
    let score = null;
    if (anyCrit) {
      criteria = {
        TA: pTA.value != null ? pTA.value : 0,
        CC: pCC.value != null ? pCC.value : 0,
        GR: pGR.value != null ? pGR.value : 0,
        VO: pVO.value != null ? pVO.value : 0
      };
      // Compute total — clamped to 0..20 just in case of float drift.
      score = Math.max(0, Math.min(20, criteria.TA + criteria.CC + criteria.GR + criteria.VO));
    }

    const comment = (cmtEl ? cmtEl.value : '').trim();

    // Gating by status — different rules per outcome:
    //   • 'graded' (final): MUST have a numeric total, since this is
    //     the student-visible grade. Comments alone aren't enough.
    //   • 'returned' (revise): scores are OPTIONAL. The teacher is
    //     asking for changes, not delivering a final mark — a comment
    //     telling the student WHAT to fix is what matters. Score can
    //     stay null and the teacher can grade after re-submission.
    //   • 'submitted': no validation (clearing out a draft).
    if (status === 'graded' && score == null) {
      showErr('Score the four criteria before marking as Graded (final).');
      return;
    }
    if (status === 'returned' && !comment) {
      showErr('Add a comment so the student knows what to revise.');
      return;
    }

    const update = {
      score,
      criteria,
      teacherComment: comment || null,
      status,
      gradedBy: (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) || 'teacher',
      gradedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    // Include inline annotations for THIS submission (also auto-saved on
    // each add/delete, but persisted here too so nothing is ever lost).
    if (_annState && _annState.submissionId === submissionId && Array.isArray(_annState.list)) {
      update.annotations = _annState.list;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
      await db.collection('writingSubmissions').doc(submissionId).update(update);

      // Update local cache so the list row reflects the new status
      // without a round-trip. (The live snapshot will sync on its own
      // tick too — this is just for instant feedback.)
      if (cache.has(assignmentId)) {
        const list = cache.get(assignmentId);
        const idx = list.findIndex(r => r.id === submissionId);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...update, gradedAt: new Date() };
        }
      }

      // Status-aware success label so the teacher gets explicit
      // confirmation that the RIGHT thing happened. Previously it
      // just said "✓ Saved" which read the same whether you'd
      // returned for revision or marked final — confusing.
      if (saveBtn) {
        if (status === 'returned')   saveBtn.textContent = '🔄 Returned to student';
        else if (status === 'graded') saveBtn.textContent = '✅ Final grade saved';
        else                          saveBtn.textContent = '✓ Saved';
      }

      // Activity log entry for this grading action (Phase G fix).
      // Without this, the activity log was silent on the grading
      // workflow — teachers could grade dozens of essays and the
      // log would show nothing. We emit a typed entry so the log
      // can later filter by grade-action.
      if (typeof ActivityLogger !== 'undefined') {
        const a = (typeof allAssignments !== 'undefined' ? allAssignments : []).find(x => x.id === assignmentId) || {};
        const eventType = (status === 'graded')   ? 'assignment_graded'
                        : (status === 'returned') ? 'assignment_returned'
                        : null;
        if (eventType) {
          try {
            ActivityLogger.log(eventType, {
              assignmentId,
              assignmentTitle: a.title || '',
              submissionId,
              studentId: submissionId.split('_')[0],
              studentName: (typeof allStudents !== 'undefined'
                ? (allStudents.find(s => s.id === submissionId.split('_')[0])?.name)
                : null) || '',
              score: score,
              skill: 'writing'
            });
          } catch (_) { /* logger optional */ }
        }
      }
      setTimeout(() => {
        // Refresh the modal by reopening so meta + form show the new state.
        openWritingEssay(submissionId, assignmentId);
      }, 900);
    } catch (err) {
      console.error('Grading save failed:', err);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save grade'; }
      showErr('Could not save: ' + (err.message || err));
    }
  }

  function closeWritingEssay() {
    const modal = document.getElementById('wsEssayModal');
    if (modal) modal.classList.remove('active');
    // Tidy up annotation UI artifacts.
    const fab = document.getElementById('waFab');
    if (fab) fab.style.display = 'none';
    if (window.WritingAnnotations) WritingAnnotations.closeBubble();
    _annState = null;
  }

  window.openWritingSubmissionsList = openWritingSubmissionsList;
  window.closeWritingSubmissionsList = closeWritingSubmissionsList;
  window.openWritingEssay  = openWritingEssay;
  window.closeWritingEssay = closeWritingEssay;
})();
