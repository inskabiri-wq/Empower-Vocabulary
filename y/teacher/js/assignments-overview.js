/* ============================================================
   assignments-overview.js  —  Phase G follow-up
   Renders an "Assignments Overview" card into the Overview tab.

   Scope-aware (the user's explicit ask — "teachers see what
   they need to see"):
     • Non-admin teacher  → only their own assignments. Shows
       four KPIs + a per-skill mini-breakdown.
     • Admin              → aggregate across the school, plus a
       per-teacher table so admin can see how each colleague is
       doing.

   Self-installs into #tab-overview right after the Level
   Distribution section. Re-renders on every Firestore snapshot
   change by patching teacher-assignments.js's renderAssignments
   call (we don't add another listener — same data already
   streamed live).

   Reads (all already-loaded by teacher-assignments.js):
     allAssignments, allCompletions, allWritingSubs,
     allStudents, currentUserData, isAdmin()

   No new Firestore reads.
   ============================================================ */

(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Find or create the panel inside #tab-overview. Anchored after
  // the level distribution section so the layout stays predictable.
  function ensurePanel() {
    let panel = document.getElementById('assignmentsOverviewPanel');
    if (panel) return panel;
    const tab = document.getElementById('tab-overview');
    if (!tab) return null;

    panel = document.createElement('div');
    panel.id = 'assignmentsOverviewPanel';
    panel.className = 'section';
    panel.style.cssText = 'margin-top: 20px;';
    panel.innerHTML = `
      <div class="section-header" style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div>
          <h2 class="section-title">📚 Assignments Overview</h2>
          <p style="margin: 2px 0 0; font-size: 0.8em; color: var(--text-muted, #94a3b8);">
            At-a-glance KPIs &amp; per-skill totals. Manage assignments on the Assignments tab.
          </p>
        </div>
        <span id="aoScopeBadge" style="font-size: 0.78em; color: var(--text-muted); font-weight: 600;"></span>
      </div>
      <div id="assignmentsOverviewBody"></div>
    `;

    // Insert after the first DIRECT-CHILD section if we can find it,
    // otherwise just append. Must scope to ":scope > .section": a nested
    // .section's nextSibling is NOT a child of tab, so insertBefore would
    // throw "node ... not a child of this node" (the recurring overview bug).
    const anchor = tab.querySelector(':scope > .section');
    if (anchor && anchor.nextSibling && anchor.nextSibling.parentNode === tab) {
      tab.insertBefore(panel, anchor.nextSibling);
    } else {
      tab.appendChild(panel);
    }
    return panel;
  }

  // Per-assignment status panel — mounted on the Activity tab.
  // Different from the Overview panel above (KPIs + per-skill + per-
  // teacher breakdown): this one is a flat list, one row per
  // assignment, so the teacher / admin can see at a glance "which
  // of my assignments has work waiting on me."
  function ensureActivityPanel() {
    let panel = document.getElementById('assignmentStatusPanel');
    if (panel) return panel;
    const tab = document.getElementById('tab-activity');
    if (!tab) return null;

    panel = document.createElement('div');
    panel.id = 'assignmentStatusPanel';
    panel.className = 'section';
    panel.style.cssText = 'margin-top: 24px;';
    panel.innerHTML = `
      <div class="section-header" style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div>
          <h2 class="section-title">📋 Assignment Status</h2>
          <p style="margin: 2px 0 0; font-size: 0.8em; color: var(--text-muted, #94a3b8);">
            Per-assignment grading status, pending-first. Edit assignments on the Assignments tab.
          </p>
        </div>
        <span id="asScopeBadge" style="font-size: 0.78em; color: var(--text-muted); font-weight: 600;"></span>
      </div>
      <div id="assignmentStatusBody"></div>
    `;
    // Mount at the END of the activity tab so the existing Recent
    // Activity stream stays at the top (where teachers expect it).
    tab.appendChild(panel);
    return panel;
  }

  // ── Aggregation helpers ────────────────────────────────────
  function _skillOf(a) {
    if (typeof SKILL_REGISTRY !== 'undefined' && SKILL_REGISTRY.skillOf) {
      return SKILL_REGISTRY.skillOf(a);
    }
    return (a && a.skill) || 'vocabulary';
  }

  // Build per-assignment stat — { writing only:
  //   pendingGrading, graded, returned, totalSubs
  // }. For other skills, just counts completions among target roster.
  function _statsForAssignment(a) {
    const sk = _skillOf(a);
    let pendingGrading = 0, graded = 0, returned = 0, totalSubs = 0;
    let completedCount = 0;

    if (sk === 'writing') {
      // Walk allWritingSubs looking for docs whose id ends with `_${a.id}`.
      const subs = (typeof allWritingSubs !== 'undefined') ? allWritingSubs : {};
      Object.keys(subs).forEach(k => {
        if (!k.endsWith('_' + a.id)) return;
        const s = subs[k];
        totalSubs++;
        if (s.status === 'graded')        graded++;
        else if (s.status === 'returned') returned++;
        else                              pendingGrading++;   // 'submitted' or missing
      });
      // For writing, "completed" = graded.
      completedCount = graded;
    } else {
      // Vocab / reading / listening — count assignmentCompletions
      // marked completed for this assignment id.
      const comps = (typeof allCompletions !== 'undefined') ? allCompletions : {};
      Object.keys(comps).forEach(k => {
        if (!k.endsWith('_' + a.id)) return;
        const c = comps[k];
        if (c.completed) completedCount++;
      });
    }
    return { skill: sk, pendingGrading, graded, returned, totalSubs, completedCount };
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    const panel = ensurePanel();
    if (!panel) return;
    const body = document.getElementById('assignmentsOverviewBody');
    if (!body) return;

    const am = (typeof isAdmin === 'function') ? isAdmin() : false;
    const me = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
    // `allAssignments` is declared with `let` in teacher-assignments.js
    // — which puts it in the shared script-scope record but NOT on
    // window. Reading `window.allAssignments` would always be undefined
    // and the panel would render empty forever. Use the bare name with
    // a typeof guard — same pattern used a few lines down for
    // allCompletions / allWritingSubs.
    const assignments = (typeof allAssignments !== 'undefined' && Array.isArray(allAssignments))
      ? allAssignments
      : [];

    // Scope filter: non-admin teachers see only assignments they own.
    // Admin sees everything; we also build a per-teacher breakdown.
    const visible = am ? assignments : assignments.filter(a => a.teacherId === me);

    // Scope badge
    const scopeBadge = document.getElementById('aoScopeBadge');
    if (scopeBadge) {
      scopeBadge.textContent = am
        ? `👑 Admin view — ${assignments.length} total across all teachers`
        : `Your assignments only — ${visible.length}`;
    }

    if (visible.length === 0) {
      body.innerHTML = `
        <div style="padding: 24px; color: var(--text-muted); text-align: center;
                    background: rgba(255,255,255,0.03);
                    border: 1px dashed rgba(255,255,255,0.15);
                    border-radius: 10px;">
          ${am
            ? 'No assignments yet across the school.'
            : "You haven't created any assignments yet. Use the Assignments tab to make your first one."}
        </div>
      `;
      return;
    }

    // Aggregate
    let totalAssign = visible.length;
    let pendingGrading = 0, totalSubs = 0, graded = 0, returned = 0;
    const bySkill = {}; // skillId → { count, completed, pendingGrading }
    visible.forEach(a => {
      const s = _statsForAssignment(a);
      pendingGrading += s.pendingGrading;
      totalSubs      += s.totalSubs;
      graded         += s.graded;
      returned       += s.returned;
      if (!bySkill[s.skill]) bySkill[s.skill] = { count: 0, completed: 0, pendingGrading: 0, returned: 0 };
      bySkill[s.skill].count++;
      bySkill[s.skill].completed      += s.completedCount;
      bySkill[s.skill].pendingGrading += s.pendingGrading;
      bySkill[s.skill].returned       += s.returned;
    });

    // ── KPI strip ──
    const kpi = (label, value, icon, accent) => `
      <div style="padding: 12px 14px; border-radius: 10px;
                  background: rgba(255,255,255,0.03);
                  border: 1px solid rgba(255,255,255,0.06);
                  display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 1.5em;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 0.68em; font-weight: 700; letter-spacing: 0.08em;
                      color: #94a3b8; text-transform: uppercase;">${label}</div>
          <div style="font-size: 1.35em; font-weight: 800; color: ${accent}; line-height: 1.1; margin-top: 2px;">
            ${value}
          </div>
        </div>
      </div>
    `;
    const kpiStrip = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                  gap: 10px; margin-bottom: 16px;">
        ${kpi('Assignments',     String(totalAssign),   '📋', '#a5b4fc')}
        ${kpi('Submissions',     String(totalSubs),     '📥', '#7dd3fc')}
        ${kpi('Pending grading', String(pendingGrading), '⏳', pendingGrading > 0 ? '#fcd34d' : '#86efac')}
        ${kpi('Returned',        String(returned),      '🔄', returned > 0 ? '#f59e0b' : '#94a3b8')}
      </div>
    `;

    // ── Per-skill mini ──
    const skillOrder = ['writing','reading','listening','vocabulary','grammar','speaking'];
    const skillIcons = { writing:'✍️', reading:'📖', listening:'🎧', vocabulary:'📚', grammar:'📐', speaking:'🎤' };
    const skillNames = { writing:'Writing', reading:'Reading', listening:'Listening', vocabulary:'Vocabulary', grammar:'Grammar', speaking:'Speaking' };
    const skillBreakdown = skillOrder
      .filter(s => bySkill[s])
      .map(s => {
        const b = bySkill[s];
        const extras = [];
        if (b.pendingGrading) extras.push(`<span style="color:#fcd34d;">⏳ ${b.pendingGrading}</span>`);
        if (b.returned)       extras.push(`<span style="color:#f59e0b;">🔄 ${b.returned}</span>`);
        if (b.completed)      extras.push(`<span style="color:#86efac;">✓ ${b.completed}</span>`);
        return `
          <div style="padding: 10px 12px; border-radius: 8px;
                      background: rgba(255,255,255,0.025);
                      border: 1px solid rgba(255,255,255,0.06);">
            <div style="display:flex; align-items:center; gap:8px; font-weight: 700; color: var(--text-primary);">
              <span style="font-size:1.1em;">${skillIcons[s] || '📋'}</span>
              ${skillNames[s] || s}
              <span style="color: var(--text-muted); font-weight: 500; font-size: 0.85em;">· ${b.count}</span>
            </div>
            <div style="display: flex; gap: 10px; font-size: 0.82em; margin-top: 4px;">
              ${extras.join('') || '<span style="color: var(--text-muted);">No submissions yet</span>'}
            </div>
          </div>
        `;
      }).join('');
    const skillsRow = skillBreakdown ? `
      <div style="font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em;
                  color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">
        By skill
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                  gap: 8px; margin-bottom: 16px;">
        ${skillBreakdown}
      </div>
    ` : '';

    // ── Per-teacher breakdown (admin only) ──
    let perTeacher = '';
    if (am) {
      const byTeacher = {};
      assignments.forEach(a => {
        const tid = a.teacherId || '__none__';
        if (!byTeacher[tid]) {
          byTeacher[tid] = {
            teacherId: tid,
            teacherName: a.teacherName || (tid === '__none__' ? '(unowned / legacy)' : tid),
            count: 0, pendingGrading: 0, returned: 0, totalSubs: 0
          };
        }
        const t = byTeacher[tid];
        t.count++;
        const s = _statsForAssignment(a);
        t.pendingGrading += s.pendingGrading;
        t.returned       += s.returned;
        t.totalSubs      += s.totalSubs;
      });
      const rows = Object.values(byTeacher)
        .sort((x, y) => (y.pendingGrading - x.pendingGrading) || (y.count - x.count))
        .map(t => `
          <tr style="border-top: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 8px 12px; color: var(--text-primary); font-weight: 600;">
              ${_esc(t.teacherName)}
            </td>
            <td style="padding: 8px 12px; text-align: center;">${t.count}</td>
            <td style="padding: 8px 12px; text-align: center;">${t.totalSubs}</td>
            <td style="padding: 8px 12px; text-align: center; color: ${t.pendingGrading > 0 ? '#fcd34d' : '#86efac'}; font-weight: 600;">
              ${t.pendingGrading}
            </td>
            <td style="padding: 8px 12px; text-align: center; color: ${t.returned > 0 ? '#f59e0b' : 'var(--text-muted)'};">
              ${t.returned}
            </td>
          </tr>
        `).join('');
      perTeacher = `
        <div style="font-size: 0.72em; font-weight: 700; letter-spacing: 0.06em;
                    color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">
          By teacher
        </div>
        <div style="position: relative; max-width: 100%;">
          <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;
                      border-radius: 8px;">
          <table style="width: 100%; min-width: 600px;
                        border-collapse: collapse; font-size: 0.9em;
                        background: rgba(255,255,255,0.02); border-radius: 8px;
                        overflow: hidden;">
            <thead>
              <tr style="background: rgba(255,255,255,0.04);">
                <th style="text-align: left; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Teacher</th>
                <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Assignments</th>
                <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Submissions</th>
                <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Pending</th>
                <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Returned</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          </div>
          <div style="position: absolute; top: 0; right: 0; width: 24px; height: 100%;
                      background: linear-gradient(to right, transparent, rgba(15,23,42,0.6));
                      pointer-events: none; border-radius: 0 8px 8px 0; opacity: 0.6;"></div>
        </div>
      `;
    }

    body.innerHTML = kpiStrip + skillsRow + perTeacher;
  }

  // ── Per-assignment list (Activity tab) ─────────────────────
  // One row per assignment with: title, skill icon, owner (admin
  // only), submissions count, pending count, returned count,
  // completed count. Sorted: pending first, then most recent.
  function renderActivityList() {
    const panel = ensureActivityPanel();
    if (!panel) return;
    const body = document.getElementById('assignmentStatusBody');
    if (!body) return;

    const am = (typeof isAdmin === 'function') ? isAdmin() : false;
    const me = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
    // Same `let` vs `window` issue as the overview render — read the
    // bare name from the shared script scope.
    const assignments = (typeof allAssignments !== 'undefined' && Array.isArray(allAssignments))
      ? allAssignments
      : [];
    const visible = am ? assignments : assignments.filter(a => a.teacherId === me);

    const scopeBadge = document.getElementById('asScopeBadge');
    if (scopeBadge) {
      scopeBadge.textContent = am
        ? `👑 Admin view — every teacher's assignments`
        : `Your assignments only`;
    }

    if (visible.length === 0) {
      // Friendlier empty state — icon + headline + actionable guidance
      // + a "Create one now" button that jumps to the Assignments tab.
      // The old bland "No assignments anywhere yet." left teachers
      // staring at a flat line of text.
      const headline = am
        ? "No assignments across the school yet"
        : "You haven't created any assignments";
      const sub = am
        ? "Once teachers start creating assignments, you'll see live status for each one here."
        : "Once you create one from the Assignments tab, you'll be able to track student progress, pending submissions, and completion rates here.";
      body.innerHTML = `
        <div style="padding: 32px 24px; text-align: center;
                    background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(59,130,246,0.03));
                    border: 1px dashed rgba(99,102,241,0.25);
                    border-radius: 14px;">
          <div style="font-size: 2.6em; margin-bottom: 8px; opacity: 0.8;">📋</div>
          <h3 style="margin: 0 0 8px; font-weight: 700; color: var(--text-primary, #f1f5f9); font-size: 1.05em;">
            ${headline}
          </h3>
          <p style="margin: 0 0 16px; color: var(--text-muted, #94a3b8); font-size: 0.9em; line-height: 1.55; max-width: 520px; margin-inline: auto;">
            ${sub}
          </p>
          ${am ? '' : `
            <button type="button" onclick="switchTab('assignments')"
                    style="background: linear-gradient(135deg, #6366f1, #a78bfa);
                           border: none; color: #fff; padding: 9px 18px; border-radius: 10px;
                           font-family: inherit; font-weight: 600; font-size: 0.9em; cursor: pointer;
                           box-shadow: 0 8px 22px -10px rgba(99,102,241,0.6);
                           transition: filter 0.15s, transform 0.1s;"
                    onmouseover="this.style.filter='brightness(1.1)'"
                    onmouseout="this.style.filter='brightness(1)'">
              📋 Go to Assignments tab
            </button>
          `}
        </div>
      `;
      return;
    }

    // Decorate + sort
    const skillIcons = { writing:'✍️', reading:'📖', listening:'🎧', vocabulary:'📚', grammar:'📐', speaking:'🎤' };
    const rows = visible.map(a => {
      const stats = _statsForAssignment(a);
      const deadline = a.deadline?.toDate ? a.deadline.toDate() : (a.deadline ? new Date(a.deadline) : null);
      const created  = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : null);
      return { a, stats, deadline, created };
    }).sort((x, y) => {
      // 1. Anything with pending grading floats up
      if ((x.stats.pendingGrading > 0) !== (y.stats.pendingGrading > 0))
        return x.stats.pendingGrading > 0 ? -1 : 1;
      // 2. Most-recently created
      const cx = x.created?.getTime() || 0;
      const cy = y.created?.getTime() || 0;
      return cy - cx;
    });

    const ownerHeader   = am ? '<th style="text-align: left; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Owner</th>' : '';
    // Tablet fix: the wrapper needs proper touch scrolling AND the
    // table needs a min-width — otherwise on tablet widths the table
    // squishes into unreadability instead of triggering the wrapper's
    // horizontal scroll. A subtle right-edge gradient hints that the
    // table is scrollable.
    const html = `
      <div style="position: relative; max-width: 100%;">
        <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;
                    border-radius: 8px;">
          <table style="width:100%; min-width: ${am ? '780px' : '680px'};
                        border-collapse: collapse; font-size: 0.9em;
                        background: rgba(255,255,255,0.02); border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: rgba(255,255,255,0.04);">
              <th style="text-align: left;   padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Assignment</th>
              <th style="text-align: left;   padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Skill</th>
              ${ownerHeader}
              <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Submissions</th>
              <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Pending</th>
              <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Returned</th>
              <th style="text-align: center; padding: 8px 12px; color: #94a3b8; font-weight: 600; font-size: 0.85em;">Graded / Done</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(({ a, stats }) => {
              const icon = skillIcons[stats.skill] || '📋';
              const ownerCell = am
                ? `<td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.88em;">${_esc(a.teacherName || (a.teacherId ? '(no name)' : '(legacy)'))}</td>`
                : '';
              return `
                <tr style="border-top: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 8px 12px; color: var(--text-primary); font-weight: 600;
                             max-width: 320px; white-space: nowrap; overflow: hidden;
                             text-overflow: ellipsis;"
                      title="${_esc(a.title || 'Untitled')}">
                    ${_esc(a.title || 'Untitled')}
                  </td>
                  <td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.88em;">
                    ${icon} ${_esc(stats.skill)}
                  </td>
                  ${ownerCell}
                  <td style="padding: 8px 12px; text-align: center; color: #cbd5e1;">${stats.totalSubs}</td>
                  <td style="padding: 8px 12px; text-align: center;
                             color: ${stats.pendingGrading > 0 ? '#fcd34d' : 'var(--text-muted)'};
                             font-weight: ${stats.pendingGrading > 0 ? '700' : '400'};">
                    ${stats.pendingGrading}
                  </td>
                  <td style="padding: 8px 12px; text-align: center;
                             color: ${stats.returned > 0 ? '#f59e0b' : 'var(--text-muted)'};
                             font-weight: ${stats.returned > 0 ? '700' : '400'};">
                    ${stats.returned}
                  </td>
                  <td style="padding: 8px 12px; text-align: center; color: ${stats.completedCount > 0 ? '#86efac' : 'var(--text-muted)'};">
                    ${stats.completedCount}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        </div>
        <!-- Subtle right-edge gradient that hints the table can scroll
             horizontally. Pointer-events: none so it doesn't interfere
             with clicks. -->
        <div style="position: absolute; top: 0; right: 0; width: 24px; height: 100%;
                    background: linear-gradient(to right, transparent, rgba(15,23,42,0.6));
                    pointer-events: none; border-radius: 0 8px 8px 0;
                    opacity: 0.6;"></div>
      </div>
      <div style="margin-top: 8px; font-size: 0.78em; color: var(--text-muted);">
        Sorted by pending-grading first, then most-recently-created.
        <span style="margin-left: 8px; opacity: 0.7;">· Scrollable on narrow screens →</span>
      </div>
    `;
    body.innerHTML = html;
  }

  // ── Hook into the existing render pipeline ─────────────────
  // teacher-assignments.js calls renderAssignments() on every
  // Firestore snapshot tick — for the assignments collection AND
  // for completions. We wrap it so our card re-renders the same
  // moment those do. No new listeners → no extra Firestore cost.
  // Combined renderer — call after every relevant data change so
  // BOTH panels stay in sync.
  function renderAll() {
    try { render(); }              catch (e) { console.warn('[assignments-overview] overview render failed:', e); }
    try { renderActivityList(); }  catch (e) { console.warn('[assignments-overview] activity render failed:', e); }
  }

  // Module-level guards (one per wrapped function). The previous
  // approach tagged the wrapper with `__aoPatched`, but once a SECOND
  // patcher (dashboard-extras.js) wraps over us, its wrapper hides our
  // tag and we'd re-wrap on the next tick — escalating without bound.
  // A module-scoped boolean guarantees we wrap each target exactly once.
  const _aoWrapped = Object.create(null);
  function _patchRenderAssignments() {
    if (_aoWrapped.renderAssignments) return true;
    if (typeof window.renderAssignments !== 'function') return false;
    const original = window.renderAssignments;
    const wrapped = function () {
      const r = original.apply(this, arguments);
      renderAll();
      return r;
    };
    window.renderAssignments = wrapped;
    _aoWrapped.renderAssignments = true;
    return true;
  }

  // We also patch renderOverviewV2 so opening the Overview tab
  // forces a fresh render even if no assignment data has changed
  // (e.g. when the dashboard first loads).
  function _patchRenderOverview() {
    if (_aoWrapped.renderOverviewV2) return true;
    if (typeof window.renderOverviewV2 !== 'function') return false;
    const original = window.renderOverviewV2;
    const wrapped = function () {
      const r = original.apply(this, arguments);
      renderAll();
      return r;
    };
    window.renderOverviewV2 = wrapped;
    _aoWrapped.renderOverviewV2 = true;
    return true;
  }

  // Also patch loadRecentActivity (the Activity tab's render entry)
  // so switching to that tab forces a refresh of the Assignment
  // Status panel below it.
  function _patchLoadRecentActivity() {
    if (_aoWrapped.loadRecentActivity) return true;
    if (typeof window.loadRecentActivity !== 'function') return false;
    const original = window.loadRecentActivity;
    const wrapped = function () {
      const r = original.apply(this, arguments);
      renderAll();
      return r;
    };
    window.loadRecentActivity = wrapped;
    _aoWrapped.loadRecentActivity = true;
    return true;
  }

  // Try to patch right away, again on auth ready, and again on a
  // small delay so all the consumer modules finish loading.
  function tryWire() {
    _patchRenderAssignments();
    _patchRenderOverview();
    _patchLoadRecentActivity();
    renderAll();
  }
  if (typeof auth !== 'undefined') auth.onAuthStateChanged(tryWire);
  setTimeout(tryWire, 800);
  setTimeout(tryWire, 2500);

  // Expose for manual debugging from the console.
  window.renderAssignmentsOverview = renderAll;
})();
