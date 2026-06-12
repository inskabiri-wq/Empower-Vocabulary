/* ============================================================
   TEACHER — Dashboard extras
   ------------------------------------------------------------
   Two self-installing panels, same pattern as
   assignments-overview.js (patch the render pipeline, read
   already-loaded globals, no new Firestore reads):

     • Missing#5 — Class comparison (Overview tab)
         Per-class avg score / sessions / active-this-week,
         side by side, + a cohort this-week-vs-last-week delta.

     • Missing#7 — Deadline calendar (Assignments tab)
         Month grid with assignment-deadline chips, prev/next nav.

   Reads: allStudents, allSessions, allAssignments (bare names —
   they're `let`-scoped in config.js / teacher-assignments.js,
   reachable from this classic script but NOT on window).
   ============================================================ */
(function () {
  'use strict';

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _students()    { try { return (typeof allStudents    !== 'undefined' && Array.isArray(allStudents))    ? allStudents    : []; } catch (_) { return []; } }
  function _sessions()    { try { return (typeof allSessions    !== 'undefined' && Array.isArray(allSessions))    ? allSessions    : []; } catch (_) { return []; } }
  function _assignments() { try { return (typeof allAssignments !== 'undefined' && Array.isArray(allAssignments)) ? allAssignments : []; } catch (_) { return []; } }
  function _sessDate(s) {
    if (s && s.createdAt && s.createdAt.toDate) return s.createdAt.toDate();
    if (s && s.createdAt) return new Date(s.createdAt);
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // Missing#5 — CLASS COMPARISON
  // ═══════════════════════════════════════════════════════════
  function ensureClassPanel() {
    let panel = document.getElementById('classComparisonPanel');
    if (panel) return panel;
    const tab = document.getElementById('tab-overview');
    if (!tab) return null;
    panel = document.createElement('div');
    panel.id = 'classComparisonPanel';
    panel.className = 'section';
    panel.style.cssText = 'margin-top: 20px;';
    panel.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">🏫 Class Comparison</h2>
          <p style="margin: 2px 0 0; font-size: 0.8em; color: var(--text-muted, #94a3b8);">
            Average score by class, side by side · plus this week vs last week.
          </p>
        </div>
      </div>
      <div id="classComparisonBody"></div>
    `;
    tab.appendChild(panel);
    return panel;
  }

  function renderClassComparison() {
    const panel = ensureClassPanel();
    if (!panel) return;
    const body = document.getElementById('classComparisonBody');
    if (!body) return;

    const students = _students();
    const sessions = _sessions();

    // Map userId → class for fast session grouping.
    const classByUser = {};
    students.forEach(s => { classByUser[s.id] = (s.studentClass || '').trim() || '—'; });

    // Group.
    const byClass = {};
    students.forEach(s => {
      const c = (s.studentClass || '').trim() || '—';
      if (!byClass[c]) byClass[c] = { cls: c, students: 0, sessions: 0, scoreSum: 0, scoreN: 0, activeWeek: new Set() };
      byClass[c].students++;
    });
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let thisWeek = 0, lastWeek = 0;
    sessions.forEach(sn => {
      const c = classByUser[sn.userId];
      const d = _sessDate(sn);
      const age = d ? (now - d.getTime()) : Infinity;
      if (age < weekMs) thisWeek++;
      else if (age < 2 * weekMs) lastWeek++;
      if (!c || !byClass[c]) return;
      byClass[c].sessions++;
      if (typeof sn.percentage === 'number') { byClass[c].scoreSum += sn.percentage; byClass[c].scoreN++; }
      if (age < weekMs) byClass[c].activeWeek.add(sn.userId);
    });

    const rows = Object.values(byClass)
      .filter(c => c.cls !== '—' || c.students > 0)
      .map(c => ({
        cls: c.cls,
        students: c.students,
        sessions: c.sessions,
        avg: c.scoreN ? Math.round(c.scoreSum / c.scoreN) : 0,
        active: c.activeWeek.size
      }))
      .sort((a, b) => b.avg - a.avg);

    if (rows.length === 0) {
      body.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted,#94a3b8);">No class data yet.</div>`;
      return;
    }

    // Week-vs-week delta chip.
    let deltaChip = '';
    if (thisWeek || lastWeek) {
      const diff = thisWeek - lastWeek;
      const pct = lastWeek ? Math.round((diff / lastWeek) * 100) : (thisWeek ? 100 : 0);
      const up = diff >= 0;
      deltaChip = `
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;
                    margin-bottom:14px; padding:10px 14px; border-radius:10px;
                    background:rgba(255,255,255,0.025); border:1px solid var(--border-color, rgba(255,255,255,0.06));">
          <span style="font-size:0.82em; color:var(--text-muted,#94a3b8); text-transform:uppercase; letter-spacing:0.05em; font-weight:700;">Activity trend</span>
          <span style="font-weight:700;">${thisWeek} sessions this week</span>
          <span style="color:${up ? '#86efac' : '#fca5a5'}; font-weight:700;">
            ${up ? '▲' : '▼'} ${Math.abs(pct)}%
          </span>
          <span style="color:var(--text-muted,#94a3b8); font-size:0.85em;">vs ${lastWeek} last week</span>
        </div>`;
    }

    const barRows = rows.map(r => {
      const color = r.avg >= 80 ? '#22c55e' : r.avg >= 50 ? '#f59e0b' : '#ef4444';
      return `
        <div style="display:grid; grid-template-columns: 90px 1fr 46px; align-items:center; gap:10px; margin-bottom:8px;">
          <div style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${_esc(r.cls)}">${_esc(r.cls)}</div>
          <div style="position:relative; height:22px; background:rgba(148,163,184,0.12); border-radius:6px; overflow:hidden;">
            <div style="position:absolute; inset:0 auto 0 0; width:${r.avg}%; background:${color}; border-radius:6px; transition:width 0.5s;"></div>
            <div style="position:absolute; inset:0; display:flex; align-items:center; padding:0 8px; font-size:0.72em; color:var(--text-muted,#cbd5e1);">
              ${r.students} student${r.students === 1 ? '' : 's'} · ${r.sessions} sessions · ${r.active} active this wk
            </div>
          </div>
          <div style="text-align:right; font-weight:800; font-variant-numeric:tabular-nums; color:${color};">${r.avg}%</div>
        </div>`;
    }).join('');

    body.innerHTML = deltaChip + `<div style="margin-top:4px;">${barRows}</div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // Missing#7 — DEADLINE CALENDAR
  // ═══════════════════════════════════════════════════════════
  // Viewed month persists across data re-renders.
  let _calMonth = new Date(); _calMonth.setDate(1);

  function ensureCalPanel() {
    let panel = document.getElementById('deadlineCalendarPanel');
    if (panel) return panel;
    const tab = document.getElementById('tab-assignments');
    if (!tab) return null;
    panel = document.createElement('div');
    panel.id = 'deadlineCalendarPanel';
    panel.className = 'section';
    panel.style.cssText = 'margin-top: 20px;';
    panel.innerHTML = `
      <div class="section-header" style="display:flex; align-items:center; justify-content:space-between;">
        <div>
          <h2 class="section-title">🗓️ Deadline Calendar</h2>
          <p style="margin: 2px 0 0; font-size: 0.8em; color: var(--text-muted, #94a3b8);">
            Assignment due-dates at a glance.
          </p>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="t2-btn" id="calPrevBtn" style="padding:4px 10px;">‹</button>
          <span id="calMonthLabel" style="font-weight:700; min-width:130px; text-align:center;"></span>
          <button type="button" class="t2-btn" id="calNextBtn" style="padding:4px 10px;">›</button>
        </div>
      </div>
      <div id="deadlineCalendarBody"></div>
    `;
    tab.appendChild(panel);
    // Wire nav once.
    panel.querySelector('#calPrevBtn').addEventListener('click', () => {
      _calMonth.setMonth(_calMonth.getMonth() - 1); renderCalendar();
    });
    panel.querySelector('#calNextBtn').addEventListener('click', () => {
      _calMonth.setMonth(_calMonth.getMonth() + 1); renderCalendar();
    });
    return panel;
  }

  const SKILL_ICON = { writing:'✍️', reading:'📖', listening:'🎧', vocabulary:'📚', grammar:'✏️', speaking:'🎤' };
  function _skillOf(a) {
    if (typeof SKILL_REGISTRY !== 'undefined' && SKILL_REGISTRY.skillOf) return SKILL_REGISTRY.skillOf(a);
    return a.skill || 'vocabulary';
  }

  function renderCalendar() {
    const panel = ensureCalPanel();
    if (!panel) return;
    const body = document.getElementById('deadlineCalendarBody');
    const label = document.getElementById('calMonthLabel');
    if (!body) return;

    const year = _calMonth.getFullYear();
    const month = _calMonth.getMonth();
    if (label) label.textContent = _calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Bucket assignment deadlines by yyyy-mm-dd.
    const byDay = {};
    _assignments().forEach(a => {
      const dl = a.deadline?.toDate ? a.deadline.toDate() : (a.deadline ? new Date(a.deadline) : null);
      if (!dl) return;
      if (dl.getFullYear() !== year || dl.getMonth() !== month) return;
      const key = dl.getDate();
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(a);
    });

    const firstDow = new Date(year, month, 1).getDay();      // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayD = new Date();
    const isThisMonth = todayD.getFullYear() === year && todayD.getMonth() === month;

    const dowHeader = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      .map(d => `<div class="cal-dow">${d}</div>`).join('');

    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell cal-empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const due = byDay[day] || [];
      const isToday = isThisMonth && todayD.getDate() === day;
      const chips = due.slice(0, 3).map(a => {
        const sk = _skillOf(a);
        return `<div class="cal-chip" title="${_esc(a.title || 'Untitled')} (${_esc(sk)})">${SKILL_ICON[sk] || '📋'} ${_esc((a.title || 'Untitled').slice(0, 14))}</div>`;
      }).join('');
      const more = due.length > 3 ? `<div class="cal-more">+${due.length - 3} more</div>` : '';
      cells += `
        <div class="cal-cell ${isToday ? 'cal-today' : ''} ${due.length ? 'cal-has' : ''}">
          <div class="cal-day">${day}</div>
          ${chips}${more}
        </div>`;
    }

    body.innerHTML = `
      <div class="cal-grid cal-head">${dowHeader}</div>
      <div class="cal-grid">${cells}</div>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // Wire into the render pipeline (same as assignments-overview.js)
  // ═══════════════════════════════════════════════════════════
  function renderAll() {
    try { renderClassComparison(); } catch (e) { console.warn('[dashboard-extras] class comparison failed:', e); }
    try { renderCalendar(); }        catch (e) { console.warn('[dashboard-extras] calendar failed:', e); }
  }

  // Module-level guard so each target function is wrapped AT MOST ONCE
  // by this module — no matter how many times tryWire runs (setTimeout
  // fires + every onAuthStateChanged tick). Tagging the wrapper itself
  // (the old approach) breaks when a SECOND patcher — assignments-
  // overview.js — wraps over us: its wrapper hides our tag, so we'd
  // re-wrap, then it re-wraps, escalating without bound on every tick.
  const _patched = Object.create(null);
  function _patch(name) {
    if (_patched[name]) return true;
    if (typeof window[name] !== 'function') return false;
    const original = window[name];
    const wrapped = function () {
      const r = original.apply(this, arguments);
      renderAll();
      return r;
    };
    window[name] = wrapped;
    _patched[name] = true;
    return true;
  }
  function tryWire() {
    _patch('renderOverviewV2');
    _patch('renderAssignments');
    renderAll();
  }
  if (typeof auth !== 'undefined') auth.onAuthStateChanged(tryWire);
  setTimeout(tryWire, 900);
  setTimeout(tryWire, 2600);

  window.renderDashboardExtras = renderAll;
})();
