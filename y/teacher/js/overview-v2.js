/* ============================================================
   TEACHER DASHBOARD v2 — Overview-tab data + chrome wiring
   Phase 1 of the "Teacher's Dash" Claude Design handoff.
   Reads the SAME globals the legacy dashboard already loads
   (allStudents, allSessions, currentUserData) — no new fetches,
   no extra Firestore round-trips. Pure render layer.
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  // THEME_COLORS — JS-side mirror of the CSS palette tokens.
  // Reads the values from CSS custom properties on :root so the
  // dashboard charts/badges stay aligned with the rest of the
  // teacher dashboard when colors change. Falls back to hard-coded
  // hex if a token isn't loaded yet (defensive — shouldn't happen
  // in practice because dashboard-v2.css loads before this script).
  //
  // Naming mirrors the --t2-* tokens in dashboard-v2.css plus a
  // couple of extras (orange, sky, indigo, rose) used by the
  // per-activity color coding on the popularity chart.
  // ============================================================
  const _css = (typeof getComputedStyle === 'function')
    ? getComputedStyle(document.documentElement)
    : null;
  function _read(name, fallback) {
    if (!_css) return fallback;
    const v = _css.getPropertyValue(name).trim();
    return v || fallback;
  }
  const THEME_COLORS = {
    blue:   _read('--t2-blue',   '#3b82f6'),
    cyan:   _read('--t2-cyan',   '#22d3ee'),
    green:  _read('--t2-green',  '#22c55e'),
    amber:  _read('--t2-amber',  '#f59e0b'),
    red:    _read('--t2-red',    '#ef4444'),
    purple: _read('--t2-purple', '#a855f7'),
    // Extras for activity-popularity color coding only:
    orange: _read('--t2-orange', '#fb923c'),
    sky:    _read('--t2-sky',    '#0ea5e9'),
    indigo: _read('--t2-indigo', '#6366f1'),
    rose:   _read('--t2-rose',   '#fb7185'),
    muted:  _read('--t2-text-muted', '#7d8590'),
  };

  // ---- Activate v2 layout class on <body> --------------------------
  // Script tag is at end-of-body, so document.body already exists.
  // Adding the class synchronously avoids a one-frame flash of the
  // unstyled sidebar before DOMContentLoaded fires.
  if (document.body) {
    document.body.classList.add('t2-active');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('t2-active');
    });
  }

  // ============================================================
  // SVG ICON SYSTEM — Lucide-style line icons
  //   Replaces the casual emojis that read as "playful school app"
  //   with crisp 1.8px-stroke icons that read as "tool". Each icon
  //   uses currentColor so it tints with whatever the parent text
  //   color is — works on the sidebar (muted/active states), the
  //   stat cards (per-card accent), and the panel titles.
  // ============================================================
  const ICONS = {
    'graduation-cap':
      '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    'layout-grid':
      '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    'users':
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'target':
      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'zap':
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'trending-up':
      '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'bar-chart':
      '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'file-text':
      '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>',
    'clipboard-list':
      '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    'activity':
      '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'crown':
      '<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14"/>',
    'flask':
      '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
    'gamepad':
      '<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z"/>',
    'download':
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    'log-out':
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    'alert-triangle':
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
    'plus':
      '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
    'arrow-right':
      '<line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>'
  };

  function t2Icon(name, size) {
    const paths = ICONS[name];
    if (!paths) return '';
    const s = size || 18;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }

  // Walk the DOM and replace any element that has [data-icon] with the
  // corresponding SVG. Run once after parse for static HTML; call again
  // after innerHTML rewrites if needed. Idempotent — re-running on the
  // same element just re-emits the same SVG.
  function hydrateIcons(root) {
    root = root || document;
    root.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      const size = el.getAttribute('data-icon-size');
      el.innerHTML = t2Icon(name, size ? parseInt(size, 10) : null);
    });
  }
  window.t2Icon        = t2Icon;
  window.t2HydrateIcons = hydrateIcons;

  // Hydrate the static sidebar + stat-card icons immediately. The script
  // tag lives at end-of-body so the DOM is parsed; running here avoids
  // any flash of broken/empty icon containers.
  if (document.readyState !== 'loading') {
    hydrateIcons();
  } else {
    document.addEventListener('DOMContentLoaded', () => hydrateIcons());
  }

  // ============================================================
  // Helpers
  // ============================================================
  function $(id) { return document.getElementById(id); }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function dayDiff(a, b) {
    return Math.floor((startOfDay(a) - startOfDay(b)) / 86400000);
  }
  function sessionDate(s) {
    if (!s) return null;
    if (s.createdAt && typeof s.createdAt.toDate === 'function') return s.createdAt.toDate();
    if (s.createdAt instanceof Date) return s.createdAt;
    if (typeof s.createdAt === 'string') {
      const d = new Date(s.createdAt);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // Initials from "Firstname Lastname" → "FL". Falls back to email
  // local-part initials if no name is set.
  function initialsOf(student) {
    const src = (student.name || (student.email || '').split('@')[0] || '?').trim();
    const parts = src.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function timeAgo(date) {
    if (!date) return '';
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60)         return 'Just now';
    if (diff < 3600)       return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400)      return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 7 * 86400)  return `${Math.floor(diff / 86400)} d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ============================================================
  // Sparkline SVG builder — matches the design's gradient + line
  // ============================================================
  function makeSparkline(data, color, width, height) {
    width  = width  || 100;
    height = height || 28;
    if (!data || data.length === 0) {
      data = [0, 0, 0, 0, 0, 0, 0]; // empty state still renders a flat baseline
    }
    if (data.length === 1) data = [data[0], data[0]];

    const min = Math.min.apply(null, data);
    const max = Math.max.apply(null, data);
    const range = (max - min) || 1;

    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const area = `M0,${height} L${pts.split(' ').join(' L')} L${width},${height} Z`;
    const id   = 'spk-' + color.replace('#', '') + '-' + Math.random().toString(36).slice(2, 7);

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow:visible">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="${color}" stop-opacity="0.25" />
            <stop offset="100%" stop-color="${color}" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#${id})"></path>
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
      </svg>
    `;
  }

  // ============================================================
  // Period state — driven by the "Last 7 days / Last 30 days" select
  //   Window in days. Sparklines, trend deltas, and the Activity
  //   Popularity panel all key off this value.
  //   Totals (Total Students, Total Sessions, Avg Score lifetime) are
  //   intentionally NOT windowed — they're absolute counts.
  // ============================================================
  let t2Period = 7;

  function t2SetPeriod(value) {
    const days = parseInt(value, 10) || 7;
    if (days === t2Period) return;
    t2Period = days;
    // Re-render only the surfaces affected by the period:
    //   stat cards (sparkline + trend), activity popularity, and
    //   the panel subtitle text.
    renderStatCards();
    renderActivityPopularity();
    refreshActivityPopularitySubtitle();
  }
  window.t2SetPeriod = t2SetPeriod;

  function refreshActivityPopularitySubtitle() {
    const sub = document.querySelector('#t2popularity')
      && document.querySelector('#t2popularity').closest('.t2-panel')
      && document.querySelector('#t2popularity').closest('.t2-panel').querySelector('.t2-panel-sub');
    if (sub) {
      sub.textContent = `Which games students used most — last ${t2Period} days`;
    }
  }

  // ============================================================
  // Compute series + deltas for the 4 stat cards
  //   Buckets[0]..[N-1] map oldest..today over the active window.
  //   Trend = % change vs the immediately-prior window of equal size.
  // ============================================================
  function computeOverviewMetrics() {
    // CRITICAL: config.js declares allSessions/allStudents with `let` at
    // script top-level. In browsers, that creates a global LEXICAL
    // binding (reachable as a bare identifier from later scripts) but
    // NOT a property on `window`. Accessing `window.allSessions`
    // returns undefined and every metric collapses to 0. Use the bare
    // identifier through `typeof` to read safely.
    const sessions = (typeof allSessions !== 'undefined' && Array.isArray(allSessions)) ? allSessions : [];
    const students = (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : [];

    const now = new Date();
    const today = startOfDay(now);
    const N = t2Period; // window size in days

    // Daily session counts for last N days (index N-1 = today)
    const dailySessions = new Array(N).fill(0);
    // Daily distinct active-student counts for last N days
    const dailyActiveSets = Array.from({ length: N }, () => new Set());

    // Prior N-day window for trend deltas
    let priorWindowSessions = 0;
    let priorWindowScoreSum = 0, priorWindowScoreN = 0;
    let thisWindowScoreSum  = 0, thisWindowScoreN  = 0;

    sessions.forEach(s => {
      const d = sessionDate(s);
      if (!d) return;
      const offset = dayDiff(today, d); // 0 = today, 1 = yesterday, …
      if (offset >= 0 && offset < N) {
        const idx = (N - 1) - offset;
        dailySessions[idx] += 1;
        if (s.userId) dailyActiveSets[idx].add(s.userId);
        if (typeof s.percentage === 'number') {
          thisWindowScoreSum += s.percentage;
          thisWindowScoreN += 1;
        }
      } else if (offset >= N && offset < N * 2) {
        priorWindowSessions += 1;
        if (typeof s.percentage === 'number') {
          priorWindowScoreSum += s.percentage;
          priorWindowScoreN += 1;
        }
      }
    });

    const dailyActive = dailyActiveSets.map(set => set.size);
    const thisWindowSessions = dailySessions.reduce((a, b) => a + b, 0);
    const sessionsTrend = trendBetween(thisWindowSessions, priorWindowSessions);

    const thisWindowAvg  = thisWindowScoreN  ? thisWindowScoreSum / thisWindowScoreN  : 0;
    const priorWindowAvg = priorWindowScoreN ? priorWindowScoreSum / priorWindowScoreN : 0;
    const scoreTrendPts = thisWindowScoreN && priorWindowScoreN
      ? Math.round(thisWindowAvg - priorWindowAvg)
      : 0;

    // Active TODAY = unique users with a session whose start-of-day === today
    // (always absolute "today", regardless of window size)
    const activeTodayCount = dailyActive[N - 1];

    // Students added within the active window (only when createdAt exists)
    const newInWindow = students.filter(s => {
      const d = s.createdAt && s.createdAt.toDate ? s.createdAt.toDate() : null;
      return d && dayDiff(today, d) >= 0 && dayDiff(today, d) < N;
    }).length;

    // Per-day distinct-active-students curve. Proxy for "Total Students"
    // sparkline since we don't have historical roster data — gives shape
    // (engagement movement) without claiming to be enrollment history.
    const studentSpark = dailyActive.slice();

    const periodLabel = N === 7 ? 'this week' : `last ${N} days`;
    return {
      students: {
        total: students.length,
        spark: studentSpark,
        trendLabel: newInWindow > 0 ? `${newInWindow} ${periodLabel}` : null,
        trendUp: newInWindow > 0
      },
      sessions: {
        total: sessions.length,
        spark: dailySessions,
        trendLabel: sessionsTrend.label,
        trendUp: sessionsTrend.up,
        trendFlat: sessionsTrend.flat
      },
      activeToday: {
        count: activeTodayCount,
        of: students.length,
        spark: dailyActive,
        alert: students.length > 0 && activeTodayCount / students.length < 0.2
      },
      avgScore: {
        // Use ALL-TIME average so the headline number matches the legacy
        // metric the teacher already trusts; trend is computed period-over-
        // period (so it reflects momentum, not lifetime accuracy).
        value: avgPercentage(sessions),
        spark: dailySparkScore(sessions, today, N),
        trendLabel: scoreTrendPts !== 0 ? `${Math.abs(scoreTrendPts)}pts` : null,
        trendUp: scoreTrendPts > 0,
        trendFlat: scoreTrendPts === 0
      }
    };
  }

  function trendBetween(thisN, priorN) {
    if (priorN === 0 && thisN === 0) return { label: null, up: false, flat: true };
    if (priorN === 0)               return { label: 'new', up: true,  flat: false };
    const pct = Math.round(((thisN - priorN) / priorN) * 100);
    if (pct === 0) return { label: '0%', up: false, flat: true };
    return { label: `${Math.abs(pct)}%`, up: pct > 0, flat: false };
  }

  function avgPercentage(sessions) {
    if (!sessions.length) return 0;
    let sum = 0, n = 0;
    sessions.forEach(s => {
      if (typeof s.percentage === 'number') { sum += s.percentage; n += 1; }
    });
    return n ? Math.round(sum / n) : 0;
  }

  function dailySparkScore(sessions, today, windowDays) {
    const N = windowDays || 7;
    const buckets = Array.from({ length: N }, () => ({ sum: 0, n: 0 }));
    sessions.forEach(s => {
      const d = sessionDate(s);
      if (!d) return;
      const offset = dayDiff(today, d);
      if (offset >= 0 && offset < N && typeof s.percentage === 'number') {
        const idx = (N - 1) - offset;
        buckets[idx].sum += s.percentage;
        buckets[idx].n += 1;
      }
    });
    return buckets.map(b => (b.n ? Math.round(b.sum / b.n) : 0));
  }

  // ============================================================
  // Render — Stat cards
  // ============================================================
  function renderStatCards() {
    const m = computeOverviewMetrics();

    fillCard('students', {
      icon: '👥',
      value: m.students.total,
      label: 'Total Students',
      sub: null,
      spark: m.students.spark,
      trend: m.students.trendLabel,
      trendUp: m.students.trendUp,
      trendFlat: false
    });
    fillCard('sessions', {
      // 🧠 = practice sessions; 🎯 is reserved for Multiple Choice activity
      icon: '🧠',
      value: m.sessions.total.toLocaleString(),
      label: 'Total Sessions',
      sub: null,
      spark: m.sessions.spark,
      trend: m.sessions.trendLabel,
      trendUp: m.sessions.trendUp,
      trendFlat: m.sessions.trendFlat
    });
    fillCard('active', {
      icon: '⚡',
      value: m.activeToday.count,
      label: 'Active Today',
      sub: m.activeToday.of > 0 ? `${m.activeToday.count} of ${m.activeToday.of} students` : null,
      spark: m.activeToday.spark,
      trend: null,
      trendUp: false,
      trendFlat: false,
      alert: m.activeToday.alert
    });
    fillCard('score', {
      icon: '📈',
      value: `${m.avgScore.value}%`,
      label: 'Avg. Score',
      sub: null,
      spark: m.avgScore.spark,
      trend: m.avgScore.trendLabel,
      trendUp: m.avgScore.trendUp,
      trendFlat: m.avgScore.trendFlat
    });
  }

  // Color per stat card — keeps the design's accent mapping.
  // Sourced from THEME_COLORS so changing --t2-* re-themes here too.
  const CARD_ACCENTS = {
    students: THEME_COLORS.cyan,
    sessions: THEME_COLORS.purple,
    active:   THEME_COLORS.amber,
    score:    THEME_COLORS.green
  };

  function fillCard(id, data) {
    const valueEl = $(`t2val-${id}`);
    const labelEl = $(`t2lbl-${id}`);
    const subEl   = $(`t2sub-${id}`);
    const sparkEl = $(`t2spark-${id}`);
    const trendEl = $(`t2trend-${id}`);
    const cardEl  = $(`t2card-${id}`);

    if (valueEl) valueEl.textContent = data.value;
    if (labelEl) labelEl.textContent = data.label;
    if (subEl)   subEl.textContent   = data.sub || '';
    if (subEl)   subEl.style.display = data.sub ? '' : 'none';
    if (sparkEl) sparkEl.innerHTML   = makeSparkline(data.spark, CARD_ACCENTS[id]);
    if (trendEl) {
      if (data.trend) {
        trendEl.style.display = '';
        trendEl.classList.remove('up', 'down', 'flat');
        trendEl.classList.add(data.trendFlat ? 'flat' : (data.trendUp ? 'up' : 'down'));
        const arrow = data.trendFlat ? '·' : (data.trendUp ? '↑' : '↓');
        trendEl.textContent = `${arrow} ${data.trend}`;
      } else {
        trendEl.style.display = 'none';
      }
    }
    if (cardEl) {
      cardEl.classList.toggle('alert', !!data.alert);
    }
  }

  // ============================================================
  // Render — Level Distribution mini-bar chart
  // ============================================================
  const LEVELS_ORDER = ['A2', 'B1', 'B1+', 'B2'];
  const LEVEL_COLORS = {
    'A2':  THEME_COLORS.blue,
    'B1':  THEME_COLORS.cyan,
    'B1+': THEME_COLORS.purple,
    'B2':  THEME_COLORS.green
  };

  // Count STUDENTS per level (their assigned profile level), not
  // sessions. The panel is titled "Level Distribution" → it should
  // answer "how is my roster distributed across CEFR levels?", which
  // is a student-count question. Using sessions answered an engagement
  // question instead, which we already cover with Total Sessions and
  // Weekly Activity. Distinct concerns, distinct panels.
  function renderLevelDistribution() {
    const students = (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : [];
    const counts = { 'A2': 0, 'B1': 0, 'B1+': 0, 'B2': 0 };
    students.forEach(s => {
      if (s && counts.hasOwnProperty(s.level)) counts[s.level] += 1;
    });

    const max = Math.max.apply(null, LEVELS_ORDER.map(l => counts[l])) || 1;

    const barsEl = $('t2levelBars');
    const legendEl = $('t2levelLegend');
    if (!barsEl || !legendEl) return;

    barsEl.innerHTML = LEVELS_ORDER.map(level => {
      const v = counts[level];
      const h = Math.max(6, Math.round((v / max) * 100)); // % of track
      return `
        <div class="t2-bar-col">
          <span class="num">${v}</span>
          <div class="t2-bar-track">
            <div class="t2-bar-fill" style="height:${h}%; background:${LEVEL_COLORS[level]}"></div>
          </div>
          <span class="lbl">${level}</span>
        </div>
      `;
    }).join('');

    legendEl.innerHTML = LEVELS_ORDER.map(level => `
      <div class="t2-legend-item">
        <span class="t2-legend-dot" style="background:${LEVEL_COLORS[level]}"></span>
        <span class="lbl">${level}</span>
        <span class="val">${counts[level]}</span>
      </div>
    `).join('');
  }

  // ============================================================
  // Render — Activity Popularity (last 7 days)
  //   Counts sessions by `activity` field over the trailing week,
  //   ranks them, and renders a horizontal bar list. Answers
  //   "which games are students actually using?" — directly
  //   actionable for content / curriculum decisions in a way the
  //   day-by-hour heatmap was not.
  // ============================================================
  // Canonical activity meta — icon set must match activity.js
  // activityIcons. Each activity has ONE icon used everywhere in the
  // teacher dashboard. Colors are intentionally varied per activity to
  // make the popularity chart readable; they pull from THEME_COLORS at
  // the top of this file (no more inline hex literals here).
  const ACTIVITY_META = {
    'grammar-choice':     { name: 'Grammar · Multiple Choice',  icon: '🎯', color: THEME_COLORS.amber },
    'grammar-fill':       { name: 'Grammar · Fill in the Blank', icon: '📝', color: THEME_COLORS.amber },
    'grammar-unscramble': { name: 'Grammar · Unscramble',        icon: '🧩', color: THEME_COLORS.amber },
    'match':           { name: 'Match',            icon: '🔗', color: THEME_COLORS.purple },
    'choice':          { name: 'Multiple Choice',  icon: '🎯', color: THEME_COLORS.blue   },
    'fillblank':       { name: 'Fill in Blank',    icon: '📝', color: THEME_COLORS.amber  },
    'spelling':        { name: 'Spelling',         icon: '⌨️', color: THEME_COLORS.cyan   },
    'reverse':         { name: 'Listening Mode',   icon: '🔄', color: THEME_COLORS.orange },
    'order':           { name: 'Word Order',       icon: '🔀', color: THEME_COLORS.green  },
    'pronunciation':   { name: 'Pronunciation',    icon: '🗣️', color: THEME_COLORS.sky    },
    'unscramble':      { name: 'Unscramble',       icon: '🧩', color: THEME_COLORS.red    },
    'listening-exam':  { name: 'Listening Exam',   icon: '🎧', color: THEME_COLORS.indigo },
    'reading-exam':    { name: 'Reading Exam',     icon: '📖', color: THEME_COLORS.rose   }
  };

  function renderActivityPopularity() {
    const root = $('t2popularity');
    if (!root) return;

    const sessions = (typeof allSessions !== 'undefined' && Array.isArray(allSessions)) ? allSessions : [];
    const now = Date.now();
    const cutoff = now - t2Period * 86400000; // active period

    // Tally by activity within the window
    const tally = {};
    let total = 0;
    sessions.forEach(s => {
      const d = sessionDate(s);
      if (!d) return;
      const t = d.getTime();
      if (t < cutoff || t > now) return;
      const a = s.activity || 'other';
      tally[a] = (tally[a] || 0) + 1;
      total += 1;
    });

    if (total === 0) {
      const phrase = t2Period === 7 ? 'this week' : `the last ${t2Period} days`;
      root.innerHTML = `<div class="t2-popularity-empty">No sessions yet in ${phrase}.</div>`;
      return;
    }

    // Sort entries descending by count, drop unknowns to the bottom
    const entries = Object.keys(tally)
      .map(k => ({ key: k, count: tally[k] }))
      .sort((a, b) => b.count - a.count);

    const max = entries[0].count || 1;

    root.innerHTML = entries.map(e => {
      const meta = ACTIVITY_META[e.key] || { name: e.key, icon: '•', color: THEME_COLORS.muted };
      const pct = Math.max(2, Math.round((e.count / max) * 100));
      const sharePct = total > 0 ? Math.round((e.count / total) * 100) : 0;
      return `
        <div class="t2-pop-row" title="${escapeHtml(meta.name)} — ${e.count} session${e.count === 1 ? '' : 's'} (${sharePct}% of period total)">
          <span class="t2-pop-icon" aria-hidden="true">${meta.icon}</span>
          <span class="t2-pop-name">${escapeHtml(meta.name)}</span>
          <div class="t2-pop-track">
            <div class="t2-pop-fill" style="width:${pct}%; background:${meta.color}"></div>
          </div>
          <span class="t2-pop-count">${e.count}</span>
        </div>
      `;
    }).join('');
  }

  // ============================================================
  // Render — Needs Attention list
  //   Reuses the legacy `allStudents` + `allSessions` + the same
  //   "struggling" definitions activity.js computes for the alert
  //   cards (inactive 7+ days, low score, no sessions).
  // ============================================================
  function buildAttentionList() {
    const students = (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : [];
    const sessions = (typeof allSessions !== 'undefined' && Array.isArray(allSessions)) ? allSessions : [];
    const now = Date.now();

    // Group sessions by userId for fast lookup
    const byUser = {};
    sessions.forEach(s => {
      if (!s.userId) return;
      (byUser[s.userId] = byUser[s.userId] || []).push(s);
    });

    const rows = [];
    students.forEach(s => {
      const mySessions = byUser[s.id] || [];
      const issues = [];
      let severity = 'info';
      let avgScore = 0;

      if (mySessions.length === 0) {
        issues.push('No sessions completed');
        severity = 'warning';
      } else {
        // Average score across this student's sessions
        let sum = 0, n = 0;
        let lastDate = null;
        mySessions.forEach(sess => {
          if (typeof sess.percentage === 'number') { sum += sess.percentage; n += 1; }
          const d = sessionDate(sess);
          if (d && (!lastDate || d > lastDate)) lastDate = d;
        });
        avgScore = n ? Math.round(sum / n) : 0;

        const daysSince = lastDate ? Math.floor((now - lastDate.getTime()) / 86400000) : 999;

        if (daysSince >= 7) {
          issues.push(`Inactive ${daysSince} days`);
          severity = daysSince >= 14 ? 'critical' : 'warning';
        }
        if (n > 0 && avgScore < 50) {
          issues.push(`Avg score ${avgScore}%`);
          severity = avgScore < 40 ? 'critical' : 'warning';
        }
      }

      if (issues.length > 0) {
        rows.push({ student: s, issues, severity, avgScore });
      }
    });

    // Sort: critical first, then warning, then info
    const order = { critical: 0, warning: 1, info: 2 };
    rows.sort((a, b) => order[a.severity] - order[b.severity]);
    return rows;
  }

  function renderNeedsAttention() {
    const listEl  = $('t2attnList');
    const countEl = $('t2attnCount');
    if (!listEl) return;

    const rows = buildAttentionList();
    if (countEl) {
      countEl.textContent = rows.length === 1 ? '1 student' : `${rows.length} students`;
    }

    if (rows.length === 0) {
      listEl.innerHTML = `
        <div class="t2-attn-empty">
          <span class="ico">✨</span>
          <span>All clear — every student is engaged.</span>
        </div>
      `;
      return;
    }

    // Cap at 6 to keep the panel reasonable
    const shown = rows.slice(0, 6);
    const flagged = _getFlagged();
    listEl.innerHTML = shown.map(r => {
      const sev = r.severity;
      const sevClass = `severity-${sev}`;
      const badgeClass = sev === 'critical' ? 'critical' : sev === 'warning' ? 'warning' : 'info';
      const sevColor = sev === 'critical' ? THEME_COLORS.red
                     : sev === 'warning'  ? THEME_COLORS.amber
                     : THEME_COLORS.blue;
      const init = initialsOf(r.student);
      const issueText = r.issues.join(' · ');
      const safeName = escapeHtml(r.student.name || r.student.email || '?');
      const isFlagged = flagged.has(r.student.id);
      return `
        <div class="t2-attn-row ${sevClass}">
          <div class="t2-attn-avatar"
               style="background:${sevColor}20; border-color:${sevColor}50; color:${sevColor};">
            ${escapeHtml(init)}
          </div>
          <div class="t2-attn-info">
            <div class="t2-attn-name">${safeName}${isFlagged ? ' <span title="Flagged for follow-up">🚩</span>' : ''}</div>
            <div class="t2-attn-issue">${escapeHtml(issueText)}</div>
          </div>
          <span class="t2-badge ${badgeClass}">${sev.toUpperCase()}</span>
          <button type="button" class="t2-attn-flag ${isFlagged ? 'on' : ''}"
                  title="${isFlagged ? 'Unflag' : 'Flag for follow-up'}"
                  onclick="t2ToggleFlag('${escapeHtml(r.student.id)}')">${isFlagged ? '🚩' : '⚐'}</button>
          <button type="button" class="t2-attn-action"
                  onclick="t2OpenStudent('${escapeHtml(r.student.id)}')">View</button>
        </div>
      `;
    }).join('');
  }

  // ── Flag-for-follow-up (Missing#3) ─────────────────────────
  // A lightweight local marker so a teacher can earmark students to
  // circle back to. Persisted in localStorage (per browser) — no
  // Firestore write, no schema change. Keyed by the teacher's uid so
  // two teachers sharing a machine don't see each other's flags.
  function _flagKey() {
    let uid = 'anon';
    try { if (auth && auth.currentUser) uid = auth.currentUser.uid; } catch (_) {}
    return 't2-flagged-' + uid;
  }
  function _getFlagged() {
    try {
      const raw = localStorage.getItem(_flagKey());
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) { return new Set(); }
  }
  function t2ToggleFlag(uid) {
    const set = _getFlagged();
    if (set.has(uid)) set.delete(uid); else set.add(uid);
    try { localStorage.setItem(_flagKey(), JSON.stringify([...set])); } catch (_) {}
    renderNeedsAttention();   // re-render so the flag state flips immediately
  }
  window.t2ToggleFlag = t2ToggleFlag;

  // Click "View" on a needs-attention row → open the rich student
  // drill-down modal (student-detail.js) when available. Falls back to
  // the legacy "switch to Students tab + scroll/highlight" behaviour if
  // the modal module didn't load for some reason.
  function t2OpenStudent(uid) {
    if (typeof window.openStudentDetailModal === 'function') {
      window.openStudentDetailModal(uid);
      return;
    }
    if (typeof switchTab === 'function') {
      switchTab('students');
    }
    // Defer until the Students tab paints — the table body might be
    // re-rendering from a filter change. Two RAFs covers the worst case.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // The students table renderer wires `data-id` on each row's
      // edit/delete buttons. Find the row that contains an action with
      // this uid.
      const trigger = document.querySelector(`#studentsTableBody [data-id="${cssEscape(uid)}"]`);
      const row = trigger ? trigger.closest('tr') : null;
      if (!row) return;
      // Scroll the row into view in the page scroll container
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight pulse — applied via CSS class, removed after 2s
      row.classList.add('t2-row-highlight');
      setTimeout(() => row.classList.remove('t2-row-highlight'), 2000);
    }));
  }
  // CSS.escape-style helper for IDs that might contain special chars
  // (Firestore IDs are alphanumeric with dashes/underscores, but be safe).
  function cssEscape(s) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
  }
  window.t2OpenStudent = t2OpenStudent;

  // ============================================================
  // Render — Recent Activity feed
  //   Pulls the 6 most recent sessions, formats with timeAgo + a
  //   color dot mapped to the activity outcome.
  // ============================================================
  function dotColorForSession(s) {
    const pct = s.percentage;
    if (typeof pct !== 'number') return THEME_COLORS.cyan;
    if (pct >= 80) return THEME_COLORS.green;
    if (pct >= 50) return THEME_COLORS.amber;
    return THEME_COLORS.red;
  }

  const ACTIVITY_VERB = {
    'grammar-choice':     'practised Grammar · Multiple Choice',
    'grammar-fill':       'practised Grammar · Fill in the Blank',
    'grammar-unscramble': 'practised Grammar · Unscramble',
    choice:        'completed Multiple Choice',
    match:         'completed Match',
    fillblank:     'completed Fill in Blank',
    spelling:      'completed Spelling',
    reverse:       'completed Listening Mode',
    order:         'completed Word Order',
    pronunciation: 'completed Pronunciation',
    unscramble:    'completed Unscramble',
    'listening-exam': 'submitted Listening Exam',
    'reading-exam':   'submitted Reading Exam'
  };

  function renderRecentActivity() {
    const listEl = $('t2feedList');
    if (!listEl) return;
    // CRITICAL: config.js declares allSessions/allStudents with `let` at
    // script top-level. In browsers, that creates a global LEXICAL
    // binding (reachable as a bare identifier from later scripts) but
    // NOT a property on `window`. Accessing `window.allSessions`
    // returns undefined and every metric collapses to 0. Use the bare
    // identifier through `typeof` to read safely.
    const sessions = (typeof allSessions !== 'undefined' && Array.isArray(allSessions)) ? allSessions : [];
    const students = (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : [];
    const studentNameById = {};
    students.forEach(s => { studentNameById[s.id] = s.name || (s.email || '').split('@')[0]; });

    // allSessions is loaded `orderBy createdAt desc`, so already sorted.
    // 5-item teaser — the Activity tab carries the full filterable list.
    const top = sessions.slice(0, 5);

    if (top.length === 0) {
      listEl.innerHTML = `<div class="t2-feed-empty">No activity yet — sessions will appear here as students practice.</div>`;
      return;
    }

    listEl.innerHTML = top.map(s => {
      const d   = sessionDate(s);
      const who = studentNameById[s.userId] || 'Student';
      const verb = ACTIVITY_VERB[s.activity] || 'completed a session';
      const pctText = (typeof s.percentage === 'number') ? ` · ${s.percentage}%` : '';
      const dot = dotColorForSession(s);
      // Lockdown breach indicator on reading-exam attempts:
      // amber ⚠ when the student tab-switched during a TIMED reading.
      // Helps teachers spot suspicious sessions in the feed at a glance.
      const breach = (s.activity === 'reading-exam'
                      && s.mode === 'timed'
                      && (s.tabSwitches || 0) > 0)
        ? ` <span title="Tab switched ${s.tabSwitches} time${s.tabSwitches === 1 ? '' : 's'} during the timed exam"
                  style="color:${THEME_COLORS.amber};font-weight:700;">⚠ ${s.tabSwitches}</span>`
        : '';
      return `
        <div class="t2-feed-row">
          <span class="t2-feed-dot" style="background:${dot}"></span>
          <div>
            <div class="t2-feed-text"><strong>${escapeHtml(who)}</strong> ${escapeHtml(verb)}${escapeHtml(pctText)}${breach}</div>
            <div class="t2-feed-time">${escapeHtml(timeAgo(d))}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================================
  // Page header — greeting + per-tab subtitle
  //   "Good morning/afternoon/evening, <FirstName> 👋"
  //   Subtitle changes per active tab.
  // ============================================================
  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }
  function firstNameFromUserData() {
    const ud = (typeof currentUserData !== 'undefined') ? currentUserData : null;
    if (!ud) return 'there';
    // Prefer the actual `name` field if set — that's what the teacher
    // typed during registration. Take the first whitespace-separated
    // token so "Alireza Kabiri" → "Alireza".
    const name = (ud.name || '').trim();
    if (name) return name.split(/\s+/)[0];
    // Fall back to email local-part with title-cased first segment
    // ("akabiriaslifar@..." → "Akabiriaslifar"). Better than dumping
    // the whole email into a greeting line.
    const email = (ud.email || '').trim();
    if (email) {
      const local = email.split('@')[0].split(/[._-]+/)[0];
      if (local) return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return 'there';
  }

  const TAB_HEADERS = {
    overview: () => {
      const attn = buildAttentionList().length;
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const sub = attn > 0
        ? `${dateStr} · <span class="alert-callout">${attn} student${attn === 1 ? '' : 's'} need${attn === 1 ? 's' : ''} your attention</span>`
        : `${dateStr} · Everything looks good today`;
      return {
        title: `${getGreeting()}, ${escapeHtml(firstNameFromUserData())} 👋`,
        sub: sub,
        showOverviewActions: true
      };
    },
    students:    () => ({ title: '👥 Students',     sub: 'Monitor and manage your student roster' }),
    assignments: () => ({ title: '📋 Assignments',  sub: 'Manage and track student assignments' }),
    courses:     () => ({ title: '🎓 Courses',      sub: 'Activate mini courses and track certificates' }),
    activity:    () => ({ title: '📈 Activity',     sub: 'View recent session and practice activity' }),
    admin:       () => ({ title: '👑 Admin',        sub: 'Manage teacher accounts and class assignments' })
  };

  function renderHeaderForTab(tabName) {
    const h = $('t2HeaderTitle');
    const s = $('t2HeaderSub');
    const a = $('t2OverviewActions');
    if (!h || !s) return;
    const fn = TAB_HEADERS[tabName] || TAB_HEADERS.overview;
    const out = fn();
    h.innerHTML = out.title;
    s.innerHTML = out.sub;
    if (a) a.style.display = out.showOverviewActions ? '' : 'none';
  }

  // ============================================================
  // Sidebar wiring
  //   Sidebar items have the same data-tab attributes as the old
  //   top-tab buttons, so the legacy switchTab() already handles
  //   them. We just need to mirror the .active class onto the
  //   sidebar items and refresh the header text on each switch.
  // ============================================================
  function wireSidebarSync() {
    // Patch switchTab so it also re-renders the v2 header + sidebar
    // active-state. Defer until DOM is ready and switchTab is defined.
    const orig = window.switchTab;
    if (typeof orig !== 'function') {
      // switchTab is loaded inline at the bottom of teacher-dashboard.html;
      // try again on next tick.
      setTimeout(wireSidebarSync, 30);
      return;
    }
    window.switchTab = function (tabName) {
      orig(tabName);
      // Mirror active state onto sidebar items
      document.querySelectorAll('.t2-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabName);
      });
      renderHeaderForTab(tabName);
    };
  }

  function setSidebarBadge(count) {
    const badge = $('t2sidebarAlertBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = String(count);
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  function setSidebarProfile() {
    // Same `let`-not-on-window trap as allStudents/allSessions —
    // currentUserData and currentUser are also script-top `let`.
    const ud = (typeof currentUserData !== 'undefined') ? currentUserData : null;
    const u  = (typeof currentUser     !== 'undefined') ? currentUser     : null;
    const nameEl  = $('t2profileName');
    const roleEl  = $('t2profileRole');
    const initEl  = $('t2profileInit');
    if (!nameEl) return;
    const name = (ud && (ud.name || ud.email)) || (u && u.email) || 'Educator';
    nameEl.textContent = name.split('@')[0];
    if (roleEl) {
      const isAdmin = window.isAdmin && window.isAdmin();
      roleEl.textContent = isAdmin ? 'Admin' : 'Educator';
    }
    if (initEl) {
      initEl.textContent = initialsOf({ name: ud && ud.name, email: ud && ud.email });
    }
  }

  // ============================================================
  // Public entry point — call this AFTER loadDashboard finishes.
  // Renders every v2 surface in one pass.
  // ============================================================
  function renderOverviewV2() {
    try {
      setSidebarProfile();
      renderStatCards();
      renderLevelDistribution();
      renderActivityPopularity();
      renderNeedsAttention();
      renderRecentActivity();
      // (Confusing word pairs card is admin-only now; mounted by admin.js
      // inside the Admin tab. Intentionally NOT shown on Overview.)
      // Header reflects the *currently active* tab — read it from the
      // class state on existing tab-content elements.
      const active = document.querySelector('.tab-content.active');
      const tabName = active ? active.id.replace(/^tab-/, '') : 'overview';
      renderHeaderForTab(tabName);
      // Mirror active state onto sidebar items
      document.querySelectorAll('.t2-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabName);
      });
      // Sidebar attention badge mirrors needs-attention count
      setSidebarBadge(buildAttentionList().length);
    } catch (e) {
      console.error('[overview-v2] render error:', e);
    }
  }

  // Expose
  window.renderOverviewV2     = renderOverviewV2;
  window.t2RenderHeaderForTab = renderHeaderForTab;

  // Bootstrap sidebar wiring SYNCHRONOUSLY (not on DOMContentLoaded).
  // Reasoning: the inline <script> in teacher-dashboard.html (a) defines
  // switchTab, then (b) registers its OWN DOMContentLoaded listener that
  // calls switchTab(savedTab) to restore the last viewed tab. If we
  // defer our patch to DOMContentLoaded, the inline listener fires first
  // (registered earlier) and runs the unpatched switchTab — meaning the
  // sidebar's .active class never mirrors the restored tab on cold load.
  // Patching at IIFE time (this overview-v2.js file is included AFTER
  // the inline script in the HTML) sidesteps the race.
  wireSidebarSync();

  // The "+ New Assignment" header button — defer to the existing
  // assignment modal opener. Switch tabs first so the user lands on
  // the right context after creating.
  window.t2NewAssignment = function () {
    if (typeof switchTab === 'function') switchTab('assignments');
    if (typeof openCreateAssignmentModal === 'function') {
      openCreateAssignmentModal();
    } else {
      console.warn('[overview-v2] openCreateAssignmentModal not available');
    }
  };
})();
