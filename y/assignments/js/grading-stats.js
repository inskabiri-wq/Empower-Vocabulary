/* =============================================================
   grading-stats.js  —  Phase F.3
   Teacher-facing aggregate analytics for writing-grade workflow.

   Renders a modal showing, across all writing assignments the
   teacher can see:
     • KPI strip: pending / graded / avg score / avg turnaround
     • Per-class breakdown (avg score, pending count)
     • Per-assignment breakdown (graded count, avg score, oldest pending)

   One-shot fetch (not live) — the data is read once when the
   modal is opened and cached for that view. Reopening re-fetches.

   Public API (exposed on window):
     openGradingStats()
     closeGradingStats()

   The script self-injects a "📊 Grading Stats" button into the
   assignments-tab header alongside "+ New Assignment" so no
   manual HTML wiring is needed.
   ============================================================= */

(function () {
  'use strict';

  // ── State (per-modal-open) ─────────────────────────────────
  // Flat list of { submission, assignment } pairs. Rebuilt on open.
  let _rows = [];

  // ── DOM helpers ────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Skill classifier — reuses SKILL_REGISTRY if present, otherwise
  // falls back to the `skill` field.
  function _isWriting(a) {
    if (typeof SKILL_REGISTRY !== 'undefined' && SKILL_REGISTRY?.skillOf) {
      return SKILL_REGISTRY.skillOf(a) === 'writing';
    }
    return (a?.skill || '') === 'writing';
  }

  // ── Self-injection: add the "Grading Stats" button to the
  // assignments-tab header. Runs after DOMContentLoaded so the
  // header is in place. Idempotent.
  function _installButton() {
    if (document.getElementById('openGradingStatsBtn')) return;
    // Look for the "+ New Assignment" button (the most reliable
    // anchor on the assignments tab — it's been there since v1).
    const newBtn = document.querySelector('button[onclick*="openAssignmentModal"], button[onclick*="routeToCreationForm"]');
    if (!newBtn || !newBtn.parentElement) return;
    const btn = document.createElement('button');
    btn.id = 'openGradingStatsBtn';
    btn.type = 'button';
    btn.className = newBtn.className || '';
    btn.style.cssText = `
      background: linear-gradient(135deg, #a855f7, #7c3aed);
      color: white; border: none; padding: 8px 14px;
      border-radius: 8px; font-weight: 600; cursor: pointer;
      margin-left: 8px; font-size: 0.92em;
    `;
    btn.innerHTML = '📊 Grading Stats';
    btn.addEventListener('click', () => openGradingStats());
    newBtn.parentElement.insertBefore(btn, newBtn.nextSibling);
  }

  // ── Open the modal ─────────────────────────────────────────
  async function openGradingStats() {
    _showModal(_loadingHtml());

    // Pull every writing assignment the teacher can see. The global
    // `allAssignments` is populated by teacher-assignments.js's live
    // listener — we just filter it. It's declared with `let` so it
    // lives in the shared script scope (NOT on window), so we read
    // the bare name with a typeof guard.
    const _all = (typeof allAssignments !== 'undefined' && Array.isArray(allAssignments))
      ? allAssignments
      : [];
    const writingAssignments = _all.filter(_isWriting);

    if (writingAssignments.length === 0) {
      _showModal(_emptyHtml('No writing assignments yet. Create one to see grading stats.'));
      return;
    }

    // Per-assignment fetch — Firestore's `in` operator is capped at
    // 30 entries, and we'd still need to chunk above that. One get()
    // per assignment is simpler, and the rule layer already lets a
    // scoped teacher read these.
    _rows = [];
    const failed = [];
    await Promise.all(writingAssignments.map(async (a) => {
      try {
        const snap = await db.collection('writingSubmissions')
          .where('assignmentId', '==', a.id)
          .get();
        snap.forEach(doc => {
          _rows.push({ submission: { id: doc.id, ...doc.data() }, assignment: a });
        });
      } catch (e) {
        failed.push({ aid: a.id, msg: e.message });
        console.warn('[grading-stats] fetch failed for', a.id, e);
      }
    }));

    _showModal(_renderHtml(writingAssignments, _rows, failed));
  }
  function closeGradingStats() {
    const m = document.getElementById('gradingStatsModal');
    if (m) m.remove();
  }

  // ── HTML builders ──────────────────────────────────────────
  function _showModal(innerHtml) {
    let m = document.getElementById('gradingStatsModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'gradingStatsModal';
      m.style.cssText = `
        position: fixed; inset: 0; z-index: 10100;
        background: rgba(2, 6, 23, 0.78); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; box-sizing: border-box;
      `;
      m.addEventListener('click', (e) => { if (e.target === m) closeGradingStats(); });
      document.body.appendChild(m);
      document.addEventListener('keydown', _escClose);
    }
    m.innerHTML = innerHtml;
  }
  function _escClose(e) { if (e.key === 'Escape') closeGradingStats(); }

  function _wrap(body, opts) {
    opts = opts || {};
    // CSV export button — only shown once data has loaded and there's
    // at least one submission row to export. Builds the CSV in-memory
    // and triggers a Blob download; no server round-trip.
    const csvBtn = opts.showExport ? `
      <button type="button" onclick="window.exportGradingStatsCsv && window.exportGradingStatsCsv();"
              style="background: rgba(34,197,94,0.20); color:#86efac;
                     border: 1px solid rgba(34,197,94,0.40);
                     padding: 6px 12px; border-radius: 8px;
                     font-size: 0.85em; font-weight: 600; cursor: pointer;
                     margin-right: 8px;">
        ⬇ Export CSV
      </button>
    ` : '';
    return `
      <div style="background: var(--surface-elevated, #0f172a);
                  border: 1px solid rgba(255,255,255,0.08);
                  border-radius: 16px; max-width: 960px; width: 100%;
                  max-height: 90vh; display: flex; flex-direction: column;
                  box-shadow: 0 24px 60px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; gap:12px;
                    padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <span style="font-size:1.4em;">📊</span>
          <div style="flex:1;">
            <div style="font-size:1.05em; font-weight:700; color:#f1f5f9;">Writing Grading Stats</div>
            <div style="font-size:0.8em; color:#94a3b8; margin-top:2px;">
              Across all writing assignments visible to you.
            </div>
          </div>
          ${csvBtn}
          <button type="button" onclick="closeGradingStats()"
                  aria-label="Close"
                  style="background: rgba(255,255,255,0.06);
                         border: 1px solid rgba(255,255,255,0.10);
                         color:#cbd5e1; width:32px; height:32px;
                         border-radius:8px; cursor:pointer; font-size:1.1em;">✕</button>
        </div>
        <div style="padding: 18px 20px; overflow-y: auto; flex:1;">
          ${body}
        </div>
      </div>
    `;
  }

  // ── CSV export ─────────────────────────────────────────────
  // RFC-4180 escaping: wrap in quotes if the field contains a comma,
  // quote, or newline; double any internal quotes.
  function _csvEsc(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function _toIso(t) {
    if (!t) return '';
    const d = t.toDate ? t.toDate() : new Date(t);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  function exportGradingStatsCsv() {
    if (!Array.isArray(_rows) || _rows.length === 0) {
      AppDialog.alert('Nothing to export — no submissions loaded.');
      return;
    }
    const header = [
      'Student Name', 'Class', 'Level', 'Assignment Title', 'Question Type',
      'Status',
      // Phase G.6 — per-criterion columns + total
      'TA (/5)', 'CC (/5)', 'GR (/5)', 'VO (/5)', 'Total Score (/20)',
      'Word Count', 'Teacher Comment',
      'Submitted At', 'Graded At', 'Graded By', 'Turnaround (hours)'
    ];
    const lines = [header.map(_csvEsc).join(',')];
    _rows.forEach(({ submission: s, assignment: a }) => {
      const subAt   = s.submittedAt?.toDate?.() || (s.submittedAt ? new Date(s.submittedAt) : null);
      const gradeAt = s.gradedAt?.toDate?.()    || (s.gradedAt    ? new Date(s.gradedAt)    : null);
      const turn = (subAt && gradeAt && gradeAt > subAt)
        ? ((gradeAt.getTime() - subAt.getTime()) / 3600000).toFixed(2)
        : '';
      const c = s.criteria || {};
      const row = [
        s.userName || '',
        s.studentClass || a.targetClass || '',
        s.level || a.level || '',
        a.title || s.assignmentTitle || '',
        s.questionType || a.questionType || '',
        s.status || 'submitted',
        (c.TA != null ? c.TA : ''),
        (c.CC != null ? c.CC : ''),
        (c.GR != null ? c.GR : ''),
        (c.VO != null ? c.VO : ''),
        (s.score != null ? s.score : ''),
        (s.wordCount != null ? s.wordCount : ''),
        s.teacherComment || '',
        _toIso(s.submittedAt),
        _toIso(s.gradedAt),
        s.gradedBy || '',
        turn
      ];
      lines.push(row.map(_csvEsc).join(','));
    });
    // BOM prefix so Excel opens UTF-8 correctly on Windows.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `writing-grades-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  window.exportGradingStatsCsv = exportGradingStatsCsv;

  function _loadingHtml() {
    return _wrap(`
      <div style="text-align:center; padding: 40px 20px; color:#94a3b8;">
        <div style="font-size: 2em; margin-bottom: 8px;">⏳</div>
        Loading submissions…
      </div>
    `);
  }
  function _emptyHtml(msg) {
    return _wrap(`
      <div style="text-align:center; padding: 40px 20px; color:#94a3b8;">
        <div style="font-size: 2em; margin-bottom: 8px;">✨</div>
        ${_esc(msg)}
      </div>
    `);
  }

  // ── The real renderer ──────────────────────────────────────
  function _renderHtml(writingAssignments, rows, failed) {
    // ----- aggregate stats -----
    let pendingCount  = 0;
    let gradedCount   = 0;
    let scoreSum      = 0;
    let scoreNum      = 0;
    let turnaroundSumMs = 0;
    let turnaroundNum   = 0;

    // Per-class accumulator (keys = normalized class code)
    const byClass = new Map();   // class -> { graded:0, pending:0, scoreSum:0, scoreN:0 }
    // Per-assignment accumulator
    const byAssign = new Map();  // aid -> { title, graded:0, pending:0, scoreSum:0, scoreN:0, oldestPending:null }

    rows.forEach(({ submission: s, assignment: a }) => {
      const cls = String(a.targetClass || '').trim().toUpperCase() || '—';
      const ck = cls;
      if (!byClass.has(ck)) byClass.set(ck, { graded: 0, pending: 0, scoreSum: 0, scoreN: 0 });
      if (!byAssign.has(a.id)) byAssign.set(a.id, {
        title: a.title || '(untitled)', graded: 0, pending: 0,
        scoreSum: 0, scoreN: 0, oldestPending: null
      });
      const cAcc = byClass.get(ck);
      const aAcc = byAssign.get(a.id);

      const status = s.status || 'submitted';
      if (status === 'graded' || status === 'returned') {
        gradedCount++;
        cAcc.graded++;
        aAcc.graded++;
        if (s.score != null && !isNaN(Number(s.score))) {
          const sc = Number(s.score);
          scoreSum += sc; scoreNum++;
          cAcc.scoreSum += sc; cAcc.scoreN++;
          aAcc.scoreSum += sc; aAcc.scoreN++;
        }
        // Turnaround
        const subAt   = s.submittedAt?.toDate?.() || (s.submittedAt ? new Date(s.submittedAt) : null);
        const gradeAt = s.gradedAt?.toDate?.()    || (s.gradedAt ? new Date(s.gradedAt) : null);
        if (subAt && gradeAt && gradeAt > subAt) {
          turnaroundSumMs += (gradeAt.getTime() - subAt.getTime());
          turnaroundNum++;
        }
      } else {
        pendingCount++;
        cAcc.pending++;
        aAcc.pending++;
        const subAt = s.submittedAt?.toDate?.() || (s.submittedAt ? new Date(s.submittedAt) : null);
        if (subAt && (!aAcc.oldestPending || subAt < aAcc.oldestPending)) {
          aAcc.oldestPending = subAt;
        }
      }
    });

    const avgScore       = scoreNum > 0 ? (scoreSum / scoreNum) : null;
    const avgTurnaround  = turnaroundNum > 0 ? (turnaroundSumMs / turnaroundNum) : null;

    // ----- KPI strip -----
    const kpis = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                  gap: 12px; margin-bottom: 22px;">
        ${_kpiCard('Pending grading', String(pendingCount), '⏳',
                   pendingCount > 0 ? '#fcd34d' : '#86efac')}
        ${_kpiCard('Graded', String(gradedCount), '✅', '#86efac')}
        ${_kpiCard('Avg score',
                   avgScore != null ? (avgScore.toFixed(1) + ' / 20') : '—',
                   '🎯',
                   avgScore == null ? '#94a3b8'
                   : (avgScore / 20) >= 0.8 ? '#86efac'
                   : (avgScore / 20) >= 0.6 ? '#7dd3fc'
                   : '#fcd34d')}
        ${_kpiCard('Avg turnaround',
                   avgTurnaround != null ? _formatDuration(avgTurnaround) : '—',
                   '⏱',
                   '#a78bfa')}
      </div>
    `;

    // ----- Per-class table -----
    const classRows = Array.from(byClass.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cls, acc]) => {
        const avg = acc.scoreN > 0 ? (acc.scoreSum / acc.scoreN).toFixed(1) : '—';
        const tone = acc.pending > 0 ? '#fcd34d' : '#86efac';
        return `
          <tr style="border-top: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 8px 12px; color:#e2e8f0; font-weight:600;">${_esc(cls)}</td>
            <td style="padding: 8px 12px; color:${tone};">${acc.pending}</td>
            <td style="padding: 8px 12px; color:#cbd5e1;">${acc.graded}</td>
            <td style="padding: 8px 12px; color:#cbd5e1;">${avg}${acc.scoreN > 0 ? ' / 20' : ''}</td>
          </tr>
        `;
      }).join('');

    const classTable = classRows ? `
      <div style="margin-bottom: 22px;">
        <div style="font-size: 0.78em; font-weight: 700; letter-spacing: 0.08em;
                    color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">
          🏫 By Class
        </div>
        <table style="width:100%; border-collapse: collapse; background: rgba(255,255,255,0.02);
                      border-radius: 10px; overflow: hidden; font-size: 0.9em;">
          <thead>
            <tr style="background: rgba(255,255,255,0.04);">
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Class</th>
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Pending</th>
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Graded</th>
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Avg score</th>
            </tr>
          </thead>
          <tbody>${classRows}</tbody>
        </table>
      </div>
    ` : '';

    // ----- Per-assignment table -----
    // Pending-first, oldest-pending second, alphabetical title third.
    // The Open button reuses the per-assignment submissions modal
    // (writing-submissions-view.js) we shipped in Phase D.
    const sortedAssignRowsHtml = Array.from(byAssign.entries())
      .sort((a, b) => {
        // 1. Pending first
        if ((a[1].pending > 0) !== (b[1].pending > 0)) return a[1].pending > 0 ? -1 : 1;
        // 2. Older oldest-pending first
        const ao = a[1].oldestPending?.getTime() || Infinity;
        const bo = b[1].oldestPending?.getTime() || Infinity;
        if (ao !== bo) return ao - bo;
        // 3. Alphabetical title
        return String(a[1].title).localeCompare(String(b[1].title));
      })
      .map(([aid, acc]) => {
        const avg = acc.scoreN > 0 ? (acc.scoreSum / acc.scoreN).toFixed(1) : '—';
        const tone = acc.pending > 0 ? '#fcd34d' : '#86efac';
        const oldest = acc.oldestPending ? _relativeTime(acc.oldestPending) : '—';
        return `
          <tr style="border-top: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 8px 12px; color:#e2e8f0; font-weight:600; max-width: 280px;
                       white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${_esc(acc.title)}
            </td>
            <td style="padding: 8px 12px; color:${tone};">${acc.pending}</td>
            <td style="padding: 8px 12px; color:#cbd5e1;">${acc.graded}</td>
            <td style="padding: 8px 12px; color:#cbd5e1;">${avg}${acc.scoreN > 0 ? ' / 20' : ''}</td>
            <td style="padding: 8px 12px; color:#94a3b8; font-size: 0.88em;">${oldest}</td>
            <td style="padding: 8px 12px; text-align: right;">
              <button type="button"
                onclick="closeGradingStats(); if(typeof openWritingSubmissionsList==='function') openWritingSubmissionsList('${_esc(aid)}');"
                style="background: rgba(168,85,247,0.20); color:#e9d5ff;
                       border: 1px solid rgba(168,85,247,0.40);
                       padding: 4px 10px; border-radius: 6px;
                       font-size: 0.82em; font-weight: 600; cursor: pointer;">
                Open →
              </button>
            </td>
          </tr>
        `;
      }).join('');

    const assignTable = sortedAssignRowsHtml ? `
      <div>
        <div style="font-size: 0.78em; font-weight: 700; letter-spacing: 0.08em;
                    color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">
          📝 By Assignment <span style="font-weight: 400; text-transform: none; letter-spacing: 0; color:#64748b;">(pending first)</span>
        </div>
        <table style="width:100%; border-collapse: collapse; background: rgba(255,255,255,0.02);
                      border-radius: 10px; overflow: hidden; font-size: 0.9em;">
          <thead>
            <tr style="background: rgba(255,255,255,0.04);">
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Assignment</th>
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Pending</th>
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Graded</th>
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Avg score</th>
              <th style="text-align:left; padding: 8px 12px; color:#94a3b8; font-weight:600; font-size:0.85em;">Oldest pending</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${sortedAssignRowsHtml}</tbody>
        </table>
      </div>
    ` : '';

    // ----- Failure note -----
    const failNote = failed.length ? `
      <div style="margin-top: 16px; padding: 10px 14px; border-radius: 8px;
                  background: rgba(245, 158, 11, 0.10);
                  border: 1px solid rgba(245, 158, 11, 0.30);
                  color: #fcd34d; font-size: 0.86em;">
        ⚠ Couldn't read submissions for ${failed.length} assignment${failed.length === 1 ? '' : 's'}.
        Check the console for details.
      </div>
    ` : '';

    return _wrap(kpis + classTable + assignTable + failNote, { showExport: true });
  }

  function _kpiCard(label, value, icon, accent) {
    return `
      <div style="padding: 14px 16px; border-radius: 12px;
                  background: rgba(255,255,255,0.03);
                  border: 1px solid rgba(255,255,255,0.06);
                  display:flex; align-items:center; gap:12px;">
        <div style="font-size: 1.6em;">${icon}</div>
        <div style="flex:1; min-width: 0;">
          <div style="font-size: 0.7em; font-weight: 700; letter-spacing: 0.08em;
                      color: #94a3b8; text-transform: uppercase;">${label}</div>
          <div style="font-size: 1.4em; font-weight: 800; color: ${accent}; line-height: 1.1; margin-top: 2px;">
            ${value}
          </div>
        </div>
      </div>
    `;
  }

  // Pretty-print a duration in ms → "2h 14m" or "3d 6h" or "42m".
  function _formatDuration(ms) {
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60)       return totalMin + 'm';
    const totalHr = Math.round(totalMin / 60 * 10) / 10;
    if (totalHr < 24)        return totalHr + 'h';
    const totalDay = Math.round(totalHr / 24 * 10) / 10;
    return totalDay + 'd';
  }

  // Relative time string like "3 days ago".
  function _relativeTime(d) {
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0)             return 'just now';
    const min = Math.floor(diffMs / 60000);
    if (min < 1)                return 'just now';
    if (min < 60)               return min + ' min ago';
    const hr = Math.floor(min / 60);
    if (hr < 24)                return hr + 'h ago';
    const day = Math.floor(hr / 24);
    if (day < 30)               return day + 'd ago';
    return d.toLocaleDateString();
  }

  // ── Install + expose ───────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _installButton);
  } else {
    _installButton();
  }
  // Re-attempt after a moment — some dashboards lazily build the
  // assignments tab after auth, by which time DOMContentLoaded
  // already fired and the button anchor wasn't on the page yet.
  setTimeout(_installButton, 1500);
  setTimeout(_installButton, 4000);

  window.openGradingStats  = openGradingStats;
  window.closeGradingStats = closeGradingStats;
})();
