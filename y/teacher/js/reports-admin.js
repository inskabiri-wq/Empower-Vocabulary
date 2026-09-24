/* ============================================================
   REPORTS - admin panel (#reportsPanel)
   ------------------------------------------------------------
   The ONE place for results reporting (replaces the old sidebar
   "Export Report" CSV + the Activity tab Excel button). Admin-only
   (lives in the admin tab). Classroom games keep their own live
   one-time results screens; their outcomes ALSO land here via
   /gameReports (written by classroom/js/game-report.js).

   Data sources (no new practice queries - reuses the dashboard's
   already-loaded globals):
     allStudents, allSessions, activityToSkill()  - practice data
     /gameReports                                  - finished games

   Sections:
     1. Filters: date range + level / class / module / year
     2. KPI tiles
     3. SVG charts (hand-rolled - no chart library, CSP-safe):
        sessions per day, avg score per skill, sessions per class,
        students per level
     4. Excel workbook export (SheetJS, already vendored)
     5. Games history: list + expandable scoreboard + per-game
        Excel + delete; manual retention cleanup ("delete older
        than N days") - reports are kept forever until deleted.
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function dayKey(d) {
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }
  var SKILLS = ['vocabulary', 'reading', 'listening', 'writing', 'grammar', 'speaking'];
  // Vocabulary sessions store unit as "Unit 2" but grammar stores the bare
  // number "2" - normalize so both count as the SAME coursebook unit.
  function normUnit(u) {
    u = String(u == null ? '' : u).trim();
    if (!u || u.toLowerCase() === 'all') return '';
    if (/^\d+$/.test(u)) return 'Unit ' + u;
    return u;
  }
  var GAME_ICON = { race: '🏁', heist: '🕵️', trust: '🛰️', reading: '📖', listening: '🎧', tug: '🪢', bingo: '🎱', scramble: '🔀' };
  var GAME_NAME = { race: 'Vocabulary Race', heist: 'Heist', trust: 'Trust No One', reading: 'Reading Exam', listening: 'Listening Exam', tug: 'Tug of War', bingo: 'Vocab Bingo', scramble: 'Sentence Scramble' };

  // ── State ────────────────────────────────────────────────────
  var rangeDays = 30;                   // 7 | 30 | 90 | 0 (= all time)
  var fLevel = '', fClass = '', fModule = '', fYear = '';
  var gameReports = null;               // cached /gameReports docs
  var aiUsage = null;                   // cached /aiUsage docs
  var placements = null;                // cached /placementResults docs
  var aiLoading = false;
  var gamesLoading = false;

  function cutoffMs() { return rangeDays > 0 ? (Date.now() - rangeDays * 86400000) : 0; }

  // The dashboard declares its data with top-level `let` (config.js), which
  // creates GLOBAL LEXICAL bindings - visible as bare names, but NOT as
  // window.* properties. So these must be read by bare identifier via typeof
  // guards, never through window.
  function students0() {
    return (typeof allStudents !== 'undefined' && Array.isArray(allStudents)) ? allStudents : [];
  }
  function sessions0() {
    return (typeof allSessions !== 'undefined' && Array.isArray(allSessions)) ? allSessions : [];
  }
  function skillOf(sess) {
    try {
      return (typeof activityToSkill === 'function') ? activityToSkill(sess) : 'vocabulary';
    } catch (_) { return 'vocabulary'; }
  }

  // Assignment analytics - reuses the dashboard's own globals (allAssignments
  // list + the live allCompletions map keyed "<studentId>_<assignmentId>").
  // Expected counts are derived from each assignment's target (class / level /
  // module / picked students) against the FULL roster, so completion % is real.
  function assignmentStats() {
    var list = (typeof allAssignments !== 'undefined' && Array.isArray(allAssignments)) ? allAssignments : [];
    var comp = (typeof allCompletions !== 'undefined' && allCompletions) ? allCompletions : {};
    var roster = students0();
    var cut = cutoffMs();
    var normC = function (v) { return String(v || '').toUpperCase().trim(); };
    var rows = [];
    list.forEach(function (a) {
      var d = toDate(a.deadline) || toDate(a.createdAt);
      if (cut && (!d || d.getTime() < cut)) return;
      var targets = [];
      if (a.targetType === 'class') targets = roster.filter(function (s) { return normC(s.studentClass) === normC(a.targetClass); }).map(function (s) { return s.id; });
      else if (a.targetType === 'level') targets = roster.filter(function (s) { return s.level === a.targetLevel; }).map(function (s) { return s.id; });
      else if (a.targetType === 'module') targets = roster.filter(function (s) { return s.module === a.targetModule; }).map(function (s) { return s.id; });
      else if (Array.isArray(a.targetStudents) && a.targetStudents.length) targets = a.targetStudents.slice();
      var done = 0;
      targets.forEach(function (id) {
        var c = comp[id + '_' + a.id];
        if (c && c.completed) done++;
      });
      rows.push({
        id: a.id, title: a.title || '(untitled)',
        skill: a.skill || 'vocabulary',
        target: a.targetType === 'class' ? ('Class ' + (a.targetClass || '')) : (a.targetType === 'level' ? ('Level ' + (a.targetLevel || '')) : (a.targetType === 'module' ? ('Module ' + (a.targetModule || '')) : 'Selected students')),
        deadline: d ? dayKey(d) : '',
        when: d ? d.getTime() : 0,
        expected: targets.length, done: done,
        pct: targets.length ? Math.round(done * 100 / targets.length) : 0
      });
    });
    rows.sort(function (a, b) { return b.when - a.when; });
    var totE = 0, totD = 0;
    rows.forEach(function (r) { totE += r.expected; totD += r.done; });
    return { rows: rows, overallPct: totE ? Math.round(totD * 100 / totE) : 0 };
  }

  // ── Filtered data ────────────────────────────────────────────
  function filteredStudents() {
    var list = students0();
    return list.filter(function (s) {
      if (fLevel && s.level !== fLevel) return false;
      if (fClass && String(s.studentClass || '').toUpperCase() !== fClass.toUpperCase()) return false;
      if (fModule && s.module !== fModule) return false;
      if (fYear && s.academicYear !== fYear) return false;
      return true;
    });
  }
  function filteredSessions(students) {
    var ids = {};
    students.forEach(function (s) { ids[s.id] = 1; });
    var cut = cutoffMs();
    var list = sessions0();
    return list.filter(function (sess) {
      if (!ids[sess.userId]) return false;
      if (cut) {
        var d = toDate(sess.createdAt);
        if (!d || d.getTime() < cut) return false;
      }
      return true;
    });
  }
  function filteredGames() {
    if (!Array.isArray(gameReports)) return [];
    var cut = cutoffMs();
    return gameReports.filter(function (g) {
      if (!cut) return true;
      var d = toDate(g.endedAt) || toDate(g.day);
      return d && d.getTime() >= cut;
    });
  }
  function filteredAiUsage() {
    if (!Array.isArray(aiUsage)) return [];
    var cut = cutoffMs();
    return aiUsage.filter(function (u) { if (!cut) return true; var d = toDate(u.at); return d && d.getTime() >= cut; });
  }
  function filteredPlacements() {
    if (!Array.isArray(placements)) return [];
    var cut = cutoffMs();
    return placements.filter(function (p) {
      if (cut) { var d = toDate(p.at); if (!d || d.getTime() < cut) return false; }
      if (fClass && p.studentClass !== fClass) return false;
      if (fLevel && p.profileLevel && p.profileLevel !== fLevel) return false;
      return true;
    });
  }

  // ── SVG bar chart (no library; theme-aware via CSS vars) ─────
  // items: [{label, value}] - vertical bars, value on top, (sparse) x-labels.
  // opts.big renders the large lightbox version (taller + bigger fonts).
  function barChart(items, color, opts) {
    opts = opts || {};
    if (!items.length) return '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);padding:14px 4px;">No data in this range.</div>';
    var big = !!opts.big;
    var W = big ? 1100 : 720, H = big ? 430 : 230;
    var padB = big ? 40 : 30, padT = big ? 30 : 22, padL = 8, padR = 8;
    var fVal = big ? 16 : 12, fLbl = big ? 13 : 10.5;
    var n = items.length;
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    if (max <= 0) max = 1;
    var bw = Math.max(3, Math.min(big ? 72 : 56, Math.floor((W - padL - padR) / n * 0.72)));
    var step = (W - padL - padR) / n;
    var everyN = Math.ceil(n / (opts.maxLabels || (big ? 20 : 12)));
    var bars = items.map(function (it, i) {
      var h = Math.round((H - padT - padB) * (it.value / max));
      var x = Math.round(padL + i * step + (step - bw) / 2);
      var y = H - padB - h;
      var out = '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + Math.max(h, 1) + '" rx="3" style="fill:' + color + ';opacity:.85;"><title>' + esc(it.label) + ': ' + it.value + (opts.suffix || '') + '</title></rect>';
      if (n <= (big ? 31 : 20) && it.value > 0) {
        out += '<text x="' + (x + bw / 2) + '" y="' + (y - 5) + '" text-anchor="middle" style="font-size:' + fVal + 'px;font-weight:700;fill:var(--t2-text,#e6edf3);">' + it.value + (opts.suffix || '') + '</text>';
      }
      if (i % everyN === 0) {
        out += '<text x="' + (x + bw / 2) + '" y="' + (H - (big ? 12 : 9)) + '" text-anchor="middle" style="font-size:' + fLbl + 'px;fill:var(--t2-text-muted,#7d8590);">' + esc(String(it.label).length > 11 ? String(it.label).slice(0, 11) : it.label) + '</text>';
      }
      return out;
    }).join('');
    var axis = '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" style="stroke:var(--t2-border,#30363d);stroke-width:1;"/>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" role="img">' + axis + bars + '</svg>';
  }

  // Chart cards are registered so a click re-renders the SAME data in a
  // near-fullscreen lightbox (bigger canvas + fonts, not a stretched copy).
  var chartRegistry = [];
  function chartCard(title, items, color, opts) {
    var idx = chartRegistry.length;
    chartRegistry.push({ title: title, items: items, color: color, opts: opts || {} });
    return '<div class="rep-zoom" data-zoom="' + idx + '" title="Click to enlarge" ' +
      'style="background:var(--t2-surface,#161b22);border:1px solid var(--t2-border,#30363d);border-radius:12px;padding:14px 16px;cursor:zoom-in;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="font-size:13px;font-weight:800;color:var(--t2-text,#e6edf3);flex:1;">' + title + '</div>' +
        '<span style="font-size:12px;color:var(--t2-text-muted,#7d8590);">🔍</span>' +
      '</div>' + barChart(items, color, opts) + '</div>';
  }
  // hoverMode=true: opened by resting the mouse on a card - it auto-closes
  // as soon as the cursor leaves the big dialog (a live "hover preview").
  // Clicking inside the dialog PINS it (stops auto-close, for projecting).
  // hoverMode=false (card clicked): pinned from the start.
  function openZoom(idx, hoverMode) {
    var c = chartRegistry[idx];
    if (!c) return;
    var old = document.getElementById('repZoomOverlay');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'repZoomOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;padding:3vh 3vw;cursor:zoom-out;';
    ov.innerHTML = '<div id="repZoomDialog" style="background:var(--t2-surface,#161b22);border:1px solid var(--t2-border,#30363d);border-radius:16px;padding:22px 26px;width:min(1200px,94vw);max-height:92vh;overflow:auto;cursor:default;" role="dialog" aria-modal="true">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
        '<div style="font-size:17px;font-weight:800;color:var(--t2-text,#e6edf3);flex:1;">' + c.title + '</div>' +
        '<span id="repZoomHint" style="font-size:11.5px;color:var(--t2-text-muted,#7d8590);">' + (hoverMode ? 'move the mouse away to close · click to keep open' : '') + '</span>' +
        '<button type="button" id="repZoomClose" style="cursor:pointer;font-family:inherit;font-size:13px;font-weight:800;padding:7px 16px;border-radius:9px;border:1px solid var(--t2-border,#30363d);background:transparent;color:var(--t2-text-muted,#7d8590);">✕ Close</button>' +
      '</div>' +
      barChart(c.items, c.color, Object.assign({}, c.opts, { big: true })) +
      '</div>';
    document.body.appendChild(ov);
    var dialog = ov.querySelector('#repZoomDialog');
    function close() {
      ov.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function pin() {
      hoverMode = false;
      var h = ov.querySelector('#repZoomHint');
      if (h) h.textContent = '';
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#repZoomClose').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    dialog.addEventListener('mouseleave', function () { if (hoverMode) close(); });
    // Hover-open with the cursor still on the backdrop (outside the dialog):
    // any movement there closes too, so it behaves like a true hover preview.
    ov.addEventListener('mousemove', function (e) { if (hoverMode && !dialog.contains(e.target)) close(); });
    dialog.addEventListener('click', pin);
  }
  function kpi(label, value, accent) {
    return '<div style="flex:1;min-width:130px;background:var(--t2-surface,#161b22);border:1px solid var(--t2-border,#30363d);border-radius:12px;padding:12px 14px;">' +
      '<div style="font-size:22px;font-weight:800;color:' + (accent || 'var(--t2-text,#e6edf3)') + ';">' + value + '</div>' +
      '<div style="font-size:11px;font-weight:600;color:var(--t2-text-muted,#7d8590);margin-top:2px;">' + label + '</div></div>';
  }

  // ── Aggregations ─────────────────────────────────────────────
  // Computes EVERY data family the old sidebar CSV carried, so each one can
  // be graphed: per-skill sessions + averages, per-class sessions + averages,
  // unique words (global / per student), per-student averages (distribution),
  // engagement (last login buckets), module / year splits, top units, weekly
  // score trend.
  // ── Marked-work helpers ──────────────────────────────────────────────
  // Every bucket in this file carries `n` (attempts) and, once a marked
  // session lands in it, `sn` (how many of those carried a score). The
  // average divides by `sn`; the count column still shows `n`.

  // The session's mark, or null. Falls back to the old behaviour only if
  // score-utils failed to load, so a missing script degrades rather than
  // throws.
  function scoreOf(sess) {
    if (window.LLScore) return LLScore.isScored(sess) ? sess.percentage : null;
    return (typeof sess.percentage === 'number') ? sess.percentage : null;
  }

  function addScore(bucket, pct) {
    if (pct === null) return;
    bucket.sn = (bucket.sn || 0) + 1;
    bucket.sum += pct;
  }

  // Rounded average of a bucket, or null when nothing in it was marked.
  function bucketAvg(b) {
    if (!b) return null;
    var d = (b.sn === undefined) ? b.n : b.sn;
    return d ? Math.round(b.sum / d) : null;
  }

  function aggregate(students, sessions) {
    var activeIds = {}, byDay = {}, bySkill = {}, byClass = {}, byLevelStu = {};
    var byUnit = {}, byWeek = {}, byStudent = {}, wordsByStudent = {}, allWords = {};
    SKILLS.forEach(function (k) { bySkill[k] = { n: 0, sum: 0 }; });
    var scoreSum = 0, scoreN = 0;
    sessions.forEach(function (sess) {
      activeIds[sess.userId] = 1;
      // The mark, or null when there is not one yet. `sess.percentage || 0`
      // used to turn "awaiting marking" into a zero and count it in the
      // divisor, so an un-marked essay pulled every sheet in this workbook
      // down twice over. See teacher/js/score-utils.js.
      var pct = scoreOf(sess);
      var d = toDate(sess.createdAt);
      if (d) {
        var k = dayKey(d);
        byDay[k] = (byDay[k] || 0) + 1;
        // Weekly average-score trend (weeks keyed by their Monday).
        var wk = new Date(d.getTime());
        wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7));
        var wkKey = dayKey(wk);
        if (!byWeek[wkKey]) byWeek[wkKey] = { n: 0, sum: 0 };
        byWeek[wkKey].n++; addScore(byWeek[wkKey], pct);
      }
      var sk = skillOf(sess);
      if (!bySkill[sk]) bySkill[sk] = { n: 0, sum: 0 };
      bySkill[sk].n++; addScore(bySkill[sk], pct);
      if (pct !== null) { scoreSum += pct; scoreN++; }
      var cls = String(sess.studentClass || '').toUpperCase() || '(none)';
      if (!byClass[cls]) byClass[cls] = { n: 0, sum: 0 };
      byClass[cls].n++; addScore(byClass[cls], pct);
      // Units are LEVEL-QUALIFIED ("B1 · Unit 2") because unit numbers repeat
      // across levels, and restricted to vocab + grammar (reading/listening
      // sessions put exam ids in the unit field). Tracks the vocab/grammar
      // split so the Excel sheet can answer "which skill was this".
      var unit = normUnit(sess.unit);
      if (unit && (sk === 'vocabulary' || sk === 'grammar')) {
        var uKey = (sess.level ? sess.level + ' · ' : '') + unit;
        if (!byUnit[uKey]) byUnit[uKey] = { n: 0, vocab: 0, grammar: 0, level: sess.level || '', unit: unit };
        byUnit[uKey].n++;
        if (sk === 'grammar') byUnit[uKey].grammar++; else byUnit[uKey].vocab++;
      }
      if (!byStudent[sess.userId]) byStudent[sess.userId] = { n: 0, sum: 0 };
      byStudent[sess.userId].n++; addScore(byStudent[sess.userId], pct);
      if (Array.isArray(sess.wordsLearned)) {
        if (!wordsByStudent[sess.userId]) wordsByStudent[sess.userId] = {};
        sess.wordsLearned.forEach(function (w) { wordsByStudent[sess.userId][w] = 1; allWords[w] = 1; });
      }
    });
    var byModule = {}, byYear = {};
    var engagement = { 'Active 7d': 0, '8-30d': 0, '30d+': 0, 'Never': 0 };
    students.forEach(function (s) {
      var lv = s.level || '(none)';
      byLevelStu[lv] = (byLevelStu[lv] || 0) + 1;
      var mo = s.module || '(none)';
      byModule[mo] = (byModule[mo] || 0) + 1;
      var yr = s.academicYear || '(none)';
      byYear[yr] = (byYear[yr] || 0) + 1;
      var ll = toDate(s.lastLogin);
      if (!ll) engagement['Never']++;
      else {
        var days = (Date.now() - ll.getTime()) / 86400000;
        if (days <= 7) engagement['Active 7d']++;
        else if (days <= 30) engagement['8-30d']++;
        else engagement['30d+']++;
      }
    });
    // Score distribution: per-student average bucketed like a histogram.
    var dist = { '0-49': 0, '50-69': 0, '70-84': 0, '85-100': 0 };
    Object.keys(byStudent).forEach(function (id) {
      var b = byStudent[id];
      // A student with nothing marked yet belongs in NO band. Bucketing them
      // at 0 put people who had only submitted essays into "0-49", which is
      // the band a teacher reads as "failing".
      var avg = bucketAvg(b);
      if (avg === null) return;
      if (avg < 50) dist['0-49']++;
      else if (avg < 70) dist['50-69']++;
      else if (avg < 85) dist['70-84']++;
      else dist['85-100']++;
    });
    return {
      activeCount: Object.keys(activeIds).length,
      avg: scoreN ? Math.round(scoreSum / scoreN) : 0,
      totalUniqueWords: Object.keys(allWords).length,
      byDay: byDay, bySkill: bySkill, byClass: byClass, byLevelStu: byLevelStu,
      byUnit: byUnit, byWeek: byWeek, byStudent: byStudent,
      wordsByStudent: wordsByStudent, byModule: byModule, byYear: byYear,
      engagement: engagement, dist: dist
    };
  }

  function daySeries(byDay) {
    var days = rangeDays > 0 ? rangeDays : 90;   // "all time" chart shows the last 90 days
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(Date.now() - i * 86400000);
      var k = dayKey(d);
      out.push({ label: k.slice(5), value: byDay[k] || 0 });
    }
    return out;
  }

  // ── Render ───────────────────────────────────────────────────
  function optionList(values, current) {
    return '<option value="">All</option>' + values.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }
  function uniq(list, field) {
    var set = {};
    list.forEach(function (s) { var v = s[field]; if (v) set[v] = 1; });
    return Object.keys(set).sort();
  }

  var waitTries = 0;
  function render() {
    var box = $('reportsBody');
    if (!box) return;
    // Wait briefly for the dashboard's student load; after ~12s render anyway
    // (an empty roster then shows empty charts instead of waiting forever).
    if (!students0().length && waitTries < 15) {
      waitTries++;
      box.innerHTML = '<p style="color:var(--t2-text-muted,#7d8590);font-size:12px;">Waiting for student data to load...</p>';
      setTimeout(render, 800);
      return;
    }
    var all = students0();
    var students = filteredStudents();
    var sessions = filteredSessions(students);
    var agg = aggregate(students, sessions);
    var games = filteredGames();
    var asg = assignmentStats();
    var ai = filteredAiUsage();
    var pl = filteredPlacements();

    // Filters
    var ranges = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']];
    var filters = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:14px;">' +
      '<div><label style="display:block;font-size:12px;font-weight:700;color:var(--t2-text-muted,#7d8590);margin-bottom:3px;">Period</label>' +
        '<select id="repRange" class="ll-select">' + ranges.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === rangeDays ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></div>' +
      '<div><label style="display:block;font-size:12px;font-weight:700;color:var(--t2-text-muted,#7d8590);margin-bottom:3px;">Level</label>' +
        '<select id="repLevel" class="ll-select">' + optionList(uniq(all, 'level'), fLevel) + '</select></div>' +
      '<div><label style="display:block;font-size:12px;font-weight:700;color:var(--t2-text-muted,#7d8590);margin-bottom:3px;">Class</label>' +
        '<select id="repClass" class="ll-select">' + optionList(uniq(all, 'studentClass'), fClass) + '</select></div>' +
      '<div><label style="display:block;font-size:12px;font-weight:700;color:var(--t2-text-muted,#7d8590);margin-bottom:3px;">Module</label>' +
        '<select id="repModule" class="ll-select">' + optionList(uniq(all, 'module'), fModule) + '</select></div>' +
      '<div><label style="display:block;font-size:12px;font-weight:700;color:var(--t2-text-muted,#7d8590);margin-bottom:3px;">Year</label>' +
        '<select id="repYear" class="ll-select">' + optionList(uniq(all, 'academicYear'), fYear) + '</select></div>' +
      '<button type="button" id="repExcelBtn" style="margin-left:auto;cursor:pointer;font-family:inherit;font-weight:800;font-size:13px;padding:10px 18px;border-radius:10px;border:none;background:#2563eb;color:#fff;">📥 Download Excel</button>' +
      '</div>';

    // KPIs
    var kpis = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">' +
      kpi('Students (filtered)', students.length) +
      kpi('Active in period', agg.activeCount, 'var(--t2-green,#22c55e)') +
      kpi('Practice sessions', sessions.length, '#60a5fa') +
      kpi('Average score', agg.avg + '%', agg.avg >= 70 ? 'var(--t2-green,#22c55e)' : '#3b82f6') +
      kpi('Unique words practiced', agg.totalUniqueWords, '#3b82f6') +
      kpi('Games played', games.length, '#60a5fa') +
      kpi('Assignment completion', asg.overallPct + '%', asg.overallPct >= 70 ? 'var(--t2-green,#22c55e)' : '#3b82f6') +
      kpi('AI writing analyses', ai.length, '#60a5fa') +
      kpi('Placement tests', pl.length, '#60a5fa') +
      '</div>';

    // Charts - one graph per data family of the old Export Report CSV.
    var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1, 5); };
    var skillAvgItems = SKILLS.map(function (k) {
      var b = agg.bySkill[k];
      return { label: cap(k), value: bucketAvg(b) === null ? 0 : bucketAvg(b) };
    });
    var skillNItems = SKILLS.map(function (k) { return { label: cap(k), value: agg.bySkill[k].n }; });
    var classKeys = Object.keys(agg.byClass).sort(function (a, b) { return agg.byClass[b].n - agg.byClass[a].n; }).slice(0, 10);
    var classItems = classKeys.map(function (c) { return { label: c, value: agg.byClass[c].n }; });
    var classAvgItems = classKeys.map(function (c) {
      var b = agg.byClass[c];
      return { label: c, value: bucketAvg(b) === null ? 0 : bucketAvg(b) };
    });
    var levelItems = Object.keys(agg.byLevelStu).sort().map(function (l) { return { label: l, value: agg.byLevelStu[l] }; });
    var moduleItems = Object.keys(agg.byModule).sort().map(function (m) { return { label: m.replace(/^Module\s*/i, 'M'), value: agg.byModule[m] }; });
    var yearItems = Object.keys(agg.byYear).sort().map(function (y) { return { label: y, value: agg.byYear[y] }; });
    var engItems = ['Active 7d', '8-30d', '30d+', 'Never'].map(function (k) { return { label: k, value: agg.engagement[k] || 0 }; });
    var distItems = ['0-49', '50-69', '70-84', '85-100'].map(function (k) { return { label: k + '%', value: agg.dist[k] || 0 }; });
    var weekItems = Object.keys(agg.byWeek).sort().slice(-12).map(function (w) {
      var b = agg.byWeek[w];
      return { label: w.slice(5), value: bucketAvg(b) === null ? 0 : bucketAvg(b) };
    });
    // Vocab and grammar units get SEPARATE charts (a unit's vocab practice and
    // its grammar practice are different things - do not lump them).
    var labelU = function (u) { return u.replace(/\s*·\s*Unit\s*/i, ' U').replace(/^Unit\s*/i, 'U'); };
    var vocabUnitItems = Object.keys(agg.byUnit).filter(function (u) { return agg.byUnit[u].vocab > 0; })
      .sort(function (a, b) { return agg.byUnit[b].vocab - agg.byUnit[a].vocab; }).slice(0, 10)
      .map(function (u) { return { label: labelU(u), value: agg.byUnit[u].vocab }; });
    var grammarUnitItems = Object.keys(agg.byUnit).filter(function (u) { return agg.byUnit[u].grammar > 0; })
      .sort(function (a, b) { return agg.byUnit[b].grammar - agg.byUnit[a].grammar; }).slice(0, 10)
      .map(function (u) { return { label: labelU(u), value: agg.byUnit[u].grammar }; });
    var nameOf = {};
    students.forEach(function (s) { nameOf[s.id] = String(s.name || '').split(' ')[0] || '?'; });
    var wordItems = Object.keys(agg.wordsByStudent)
      .map(function (id) { return { id: id, n: Object.keys(agg.wordsByStudent[id]).length }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 10)
      .map(function (x) { return { label: nameOf[x.id] || '?', value: x.n }; });
    var gByType = {};
    games.forEach(function (g) { gByType[g.game] = (gByType[g.game] || 0) + 1; });
    var gameItems = Object.keys(gByType).map(function (k) { return { label: GAME_NAME[k] || k, value: gByType[k] }; });
    var asgSkill = {};
    asg.rows.forEach(function (r) { asgSkill[r.skill] = (asgSkill[r.skill] || 0) + 1; });
    var asgSkillItems = Object.keys(asgSkill).map(function (k) { return { label: cap(k), value: asgSkill[k] }; });
    var asgPctItems = asg.rows.slice(0, 10).map(function (r) { return { label: r.title, value: r.pct }; });
    var aiByTeacher = {};
    ai.forEach(function (u) { var k = u.teacherName || u.teacherEmail || u.teacherId || '?'; aiByTeacher[k] = (aiByTeacher[k] || 0) + 1; });
    var aiTeacherItems = Object.keys(aiByTeacher).sort(function (a, b) { return aiByTeacher[b] - aiByTeacher[a]; }).slice(0, 12)
      .map(function (k) { return { label: String(k).split(' ')[0], value: aiByTeacher[k] }; });
    var plByLevel = {};
    pl.forEach(function (p) { var k = p.recommendedLevel || '?'; plByLevel[k] = (plByLevel[k] || 0) + 1; });
    var plLevelItems = ['A2', 'B1', 'B1+', 'B2'].filter(function (l) { return plByLevel[l]; })
      .concat(Object.keys(plByLevel).filter(function (l) { return ['A2', 'B1', 'B1+', 'B2'].indexOf(l) === -1; }))
      .map(function (l) { return { label: l, value: plByLevel[l] }; });

    chartRegistry = [];   // rebuilt every render; indices match data-zoom
    // min(430px,100%) rather than a bare 430px: auto-fit drops to one column on a
    // phone, but the track keeps its 430px minimum and overflows a 362px content
    // box by 68px. The min() lets that single column shrink to the screen.
    var grid = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(430px,100%),1fr));gap:14px;">';
    var charts = '<div style="display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:14px;">' +
      chartCard('📅 Practice sessions per day', daySeries(agg.byDay), 'var(--t2-blue,#3b82f6)', { maxLabels: 10 }) +
      grid +
        chartCard('🎯 Average score per skill (%)', skillAvgItems, 'var(--t2-green,#22c55e)', { suffix: '%' }) +
        chartCard('📚 Sessions per skill', skillNItems, '#60a5fa', {}) +
        chartCard('📈 Average score per week (%)', weekItems, 'var(--t2-green,#22c55e)', { suffix: '%' }) +
        chartCard('🧮 Score distribution (students)', distItems, '#3b82f6', {}) +
        chartCard('🏫 Sessions per class', classItems, '#60a5fa', {}) +
        chartCard('🏆 Average score per class (%)', classAvgItems, 'var(--t2-green,#22c55e)', { suffix: '%' }) +
        chartCard('📖 Top vocabulary units (level · unit)', vocabUnitItems, '#60a5fa', {}) +
        chartCard('✏️ Top grammar units (level · unit)', grammarUnitItems, '#3b82f6', {}) +
        chartCard('🔤 Top students by unique words', wordItems, '#3b82f6', {}) +
        chartCard('📊 Students per level', levelItems, '#60a5fa', {}) +
        chartCard('🗂 Students per module', moduleItems, '#60a5fa', {}) +
        chartCard('📆 Students per academic year', yearItems, '#60a5fa', {}) +
        chartCard('💤 Engagement (last login)', engItems, '#f87171', {}) +
        chartCard('🎮 Games by type', gameItems, '#60a5fa', {}) +
        chartCard('📋 Assignments by skill', asgSkillItems, '#60a5fa', {}) +
        chartCard('✅ Assignment completion % (10 most recent)', asgPctItems, 'var(--t2-green,#22c55e)', { suffix: '%' }) +
        chartCard('✍️ Writing AI analyses by teacher', aiTeacherItems, '#60a5fa', {}) +
        chartCard('🎯 Placement recommendations by level', plLevelItems, '#60a5fa', {}) +
      '</div></div>';
    if (aiUsage === null) loadAiUsage();
    if (placements === null) loadPlacements();

    // Games history
    var gamesHtml;
    if (gameReports === null) {
      gamesHtml = '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);">Loading game reports...</div>';
      loadGames();
    } else if (!games.length) {
      gamesHtml = '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);">No classroom games in this period. Reports are saved automatically when a game finishes.</div>';
    } else {
      gamesHtml = games.map(function (g, i) {
        var icon = GAME_ICON[g.game] || '🎮';
        var name = GAME_NAME[g.game] || g.game;
        var what = g.examTitle || g.unit || '';
        var lvl = g.level ? (g.level + (what ? ' · ' : '')) : '';
        var avg = g.players && g.players.length
          ? Math.round(g.players.reduce(function (s, p) { return s + (p.score || 0); }, 0) / g.players.length) : 0;
        var rows = (g.players || []).map(function (p, ri) {
          return '<tr><td style="padding:3px 12px 3px 0;color:var(--t2-text-muted,#7d8590);">' + (ri + 1) + '</td>' +
            '<td style="padding:3px 12px 3px 0;">' + esc(p.name) + '</td>' +
            '<td style="padding:3px 0;font-weight:700;">' + (p.score || 0) + '</td></tr>';
        }).join('');
        return '<details style="border:1px solid var(--t2-border,#30363d);border-radius:10px;padding:10px 14px;margin-bottom:8px;background:var(--t2-surface,#161b22);">' +
          '<summary style="cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap;list-style:none;">' +
            '<span style="font-size:16px;">' + icon + '</span>' +
            '<span style="font-weight:800;color:var(--t2-text,#e6edf3);font-size:13px;">' + esc(name) + '</span>' +
            '<span style="font-size:12px;color:var(--t2-text-muted,#7d8590);">' + esc(lvl + what) + '</span>' +
            '<span style="font-size:12px;color:var(--t2-text-muted,#7d8590);margin-left:auto;">👩‍🏫 ' + esc(g.teacherName || '-') + ' · 👥 ' + (g.playerCount || 0) + ' · ' + esc(g.day || '') + '</span>' +
          '</summary>' +
          '<div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;align-items:start;">' +
            '<table style="font-size:12.5px;color:var(--t2-text,#e6edf3);border-collapse:collapse;">' +
              '<tr style="color:var(--t2-text-muted,#7d8590);font-size:11px;"><th style="text-align:left;padding-right:12px;">#</th><th style="text-align:left;padding-right:12px;">Student</th><th style="text-align:left;">Score</th></tr>' + rows + '</table>' +
            '<div style="font-size:12px;color:var(--t2-text-muted,#7d8590);">Average: <strong style="color:var(--t2-text,#e6edf3);">' + avg + '</strong>' + (g.outcome ? '<br>Outcome: ' + esc(g.outcome) : '') + (g.mode ? '<br>Questions: ' + esc(g.mode) : '') + '</div>' +
            '<div style="margin-left:auto;display:flex;gap:8px;">' +
              '<button type="button" class="rep-game-dl" data-i="' + i + '" style="cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid var(--t2-border,#30363d);background:transparent;color:var(--t2-text-muted,#7d8590);">⬇ Excel</button>' +
              '<button type="button" class="rep-game-del" data-id="' + esc(g._id) + '" style="cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(248,113,113,0.5);background:rgba(248,113,113,0.08);color:#f87171;">Delete</button>' +
            '</div>' +
          '</div></details>';
      }).join('');
    }

    // Retention banner: gently ask when old reports pile up (manual policy).
    var oldCount = 0;
    if (Array.isArray(gameReports)) {
      var cut180 = Date.now() - 180 * 86400000;
      gameReports.forEach(function (g) { var d = toDate(g.endedAt) || toDate(g.day); if (d && d.getTime() < cut180) oldCount++; });
    }
    var banner = oldCount
      ? '<div style="font-size:12px;color:#3b82f6;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.35);border-radius:9px;padding:8px 12px;margin-bottom:10px;">You have ' + oldCount + ' game report(s) older than 6 months. Use the cleanup button if you no longer need them.</div>'
      : '';

    var cleanup = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 12px;">' +
      '<span style="font-size:12px;color:var(--t2-text-muted,#7d8590);">Game reports are kept until you delete them.</span>' +
      '<span style="margin-left:auto;display:flex;gap:8px;align-items:center;">' +
      '<select id="repCleanDays" class="ll-select"><option value="30">older than 30 days</option><option value="60">older than 60 days</option><option value="90" selected>older than 90 days</option><option value="180">older than 180 days</option></select>' +
      '<button type="button" id="repCleanBtn" style="cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:8px 14px;border-radius:8px;border:1px solid rgba(248,113,113,0.5);background:rgba(248,113,113,0.08);color:#f87171;">🗑 Clean up</button>' +
      '</span></div>';

    box.innerHTML = filters + kpis + charts +
      '<div style="font-size:14px;font-weight:800;color:var(--t2-text,#e6edf3);margin:4px 0 8px;">🎮 Classroom games</div>' +
      banner + cleanup + gamesHtml;

    // Wire controls
    $('repRange').addEventListener('change', function () { rangeDays = parseInt(this.value, 10) || 0; render(); });
    $('repLevel').addEventListener('change', function () { fLevel = this.value; render(); });
    $('repClass').addEventListener('change', function () { fClass = this.value; render(); });
    $('repModule').addEventListener('change', function () { fModule = this.value; render(); });
    $('repYear').addEventListener('change', function () { fYear = this.value; render(); });
    $('repExcelBtn').addEventListener('click', function () {
      withXlsx(function () { exportWorkbook(students, sessions, agg, games, asg, ai); });
    });
    if ($('repCleanBtn')) $('repCleanBtn').addEventListener('click', cleanupOld);
    // HOVER opens the big chart (short 120ms intent delay so scrolling past
    // does not trigger it, but it feels near-instant); moving the mouse away
    // closes it. CLICK pins it open (and is the path touch devices use).
    box.querySelectorAll('.rep-zoom').forEach(function (el) {
      var hoverTimer = null;
      el.addEventListener('mouseenter', function () {
        hoverTimer = setTimeout(function () {
          openZoom(parseInt(el.getAttribute('data-zoom'), 10), true);
        }, 120);
      });
      el.addEventListener('mouseleave', function () {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      });
      el.addEventListener('click', function () {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        openZoom(parseInt(el.getAttribute('data-zoom'), 10), false);
      });
    });
    box.querySelectorAll('.rep-game-dl').forEach(function (b) {
      b.addEventListener('click', function () { downloadGame(games[parseInt(b.getAttribute('data-i'), 10)]); });
    });
    box.querySelectorAll('.rep-game-del').forEach(function (b) {
      b.addEventListener('click', function () { deleteGame(b.getAttribute('data-id')); });
    });
  }

  // ── AI usage: load once ──────────────────────────────────────
  function loadPlacements() {
    if (placements !== null) return;
    placements = [];  // sentinel so we only fetch once
    db.collection('placementResults').limit(1000).get().then(function (snap) {
      placements = snap.docs.map(function (d) { var o = d.data(); o._id = d.id; return o; });
      render();
    }).catch(function (e) { console.warn('placements load', e); placements = []; });
  }
  function loadAiUsage() {
    if (aiLoading) return;
    aiLoading = true;
    db.collection('aiUsage').orderBy('at', 'desc').limit(1000).get().then(function (snap) {
      aiUsage = snap.docs.map(function (d) { var o = d.data(); o._id = d.id; return o; });
      aiLoading = false;
      render();
    }).catch(function (e) { console.warn('aiUsage load', e); aiUsage = []; aiLoading = false; render(); });
  }

  // ── Games: load / delete / cleanup / download ────────────────
  function loadGames() {
    if (gamesLoading) return;
    gamesLoading = true;
    db.collection('gameReports').orderBy('endedAt', 'desc').limit(300).get().then(function (snap) {
      gameReports = snap.docs.map(function (d) { var o = d.data(); o._id = d.id; return o; });
      gamesLoading = false;
      render();
    }).catch(function (e) {
      console.warn('gameReports load', e);
      gameReports = [];
      gamesLoading = false;
      render();
    });
  }

  function deleteGame(id) {
    if (!id) return;
    var go = function () {
      db.collection('gameReports').doc(id).delete().then(function () {
        gameReports = (gameReports || []).filter(function (g) { return g._id !== id; });
        render();
      }).catch(function (e) { if (window.AppDialog) AppDialog.alert('Could not delete: ' + e.message); });
    };
    if (window.AppDialog && AppDialog.confirm) {
      AppDialog.confirm('Delete this game report permanently?', { title: 'Delete report', okLabel: 'Delete', danger: true }).then(function (ok) { if (ok) go(); });
    } else if (window.confirm('Delete this game report permanently?')) { go(); }
  }

  function cleanupOld() {
    var days = parseInt(($('repCleanDays') || {}).value, 10) || 90;
    var cut = Date.now() - days * 86400000;
    var victims = (gameReports || []).filter(function (g) {
      var d = toDate(g.endedAt) || toDate(g.day);
      return d && d.getTime() < cut;
    });
    if (!victims.length) {
      if (window.AppDialog) AppDialog.alert('No game reports older than ' + days + ' days.');
      return;
    }
    var go = function () {
      var batch = db.batch();
      victims.forEach(function (g) { batch.delete(db.collection('gameReports').doc(g._id)); });
      batch.commit().then(function () {
        var dead = {};
        victims.forEach(function (g) { dead[g._id] = 1; });
        gameReports = gameReports.filter(function (g) { return !dead[g._id]; });
        render();
      }).catch(function (e) { if (window.AppDialog) AppDialog.alert('Cleanup failed: ' + e.message); });
    };
    if (window.AppDialog && AppDialog.confirm) {
      AppDialog.confirm('Delete ' + victims.length + ' game report(s) older than ' + days + ' days? This cannot be undone.', { title: 'Clean up reports', okLabel: 'Delete ' + victims.length, danger: true }).then(function (ok) { if (ok) go(); });
    } else if (window.confirm('Delete ' + victims.length + ' old game report(s)?')) { go(); }
  }

  // ── SheetJS, loaded only when an export is actually asked for ──
  //
  // MEASURED: vendor/xlsx/xlsx.full.min.js is 861 KB raw, 308 KB gzipped, and
  // teacher-dashboard.html loaded it as a plain blocking <script> on every
  // visit. It is used by exactly one file, this one, and only when a teacher
  // clicks Export. Teachers are on mobile data.
  //
  // Same shape as teacher/js/roster-import.js, which has always lazy-loaded
  // its own copy correctly. Path differs: this is the root vendor copy the
  // dashboard used to pull eagerly.
  var XLSX_SRC = 'vendor/xlsx/xlsx.full.min.js?v=1';
  var xlsxLoading = null;
  function ensureXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxLoading) return xlsxLoading;
    xlsxLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = XLSX_SRC;
      s.onload = function () { resolve(); };
      s.onerror = function () { xlsxLoading = null; reject(new Error('Could not load the spreadsheet library.')); };
      document.head.appendChild(s);
    });
    return xlsxLoading;
  }
  function withXlsx(run) {
    return ensureXlsx().then(run).catch(function (e) {
      if (window.AppDialog) AppDialog.alert((e && e.message) || 'Could not load the spreadsheet library.');
    });
  }

  function downloadGame(g) {
    if (!g) return;
    withXlsx(function () { downloadGameNow(g); });
  }
  function downloadGameNow(g) {
    if (!g || typeof XLSX === 'undefined') return;
    var rows = [
      ['Game', GAME_NAME[g.game] || g.game],
      ['Teacher', g.teacherName || ''],
      ['Level', g.level || ''],
      ['Unit / Exam', g.examTitle || g.unit || ''],
      ['Questions', g.mode || ''],
      ['Players', g.playerCount || 0],
      ['Date', g.day || ''],
      [],
      ['#', 'Student', 'Score']
    ];
    (g.players || []).forEach(function (p, i) { rows.push([i + 1, p.name || '', p.score || 0]); });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Game');
    XLSX.writeFile(wb, 'game-' + (g.game || 'report') + '-' + (g.day || '') + '.xlsx');
  }

  // ── Full workbook export ─────────────────────────────────────
  // Sheets: Summary (filters + KPIs), Students (full old-CSV parity), Skills,
  // Classes, Levels, Modules, Years, Word lists, Weekly, By day, Engagement,
  // Sessions (raw rows), Games, Game players. Everything the panel knows.
  //
  // DELIBERATELY ABSENT: the activity logs.
  //
  // Reports is the single home for reporting, and the activity logs look like
  // they belong here. They do not, and the reason is a safety one rather than
  // a tidiness one.
  //
  // The Download button on the Activity Logs tab is NOT a report. It is the
  // enforced first step of deleting those logs: pruneOlderThan() refuses to
  // delete anything that has not been downloaded in the same session. That
  // guard only means something while downloading and deleting sit together,
  // in that order, in one place.
  //
  // Add an "Activity logs" sheet here and an admin can export them from a
  // screen that has no delete button, then delete from a screen whose export
  // they skipped, and the interlock becomes theatre - it would still pass its
  // own check while no longer protecting anything.
  //
  // If activity logs are ever genuinely needed in this workbook, move the
  // export-first guard to a persisted flag first, then add the sheet.
  // tools/live-markup-check.js asserts this stays true.
  function exportWorkbook(students, sessions, agg, games, asg, ai) {
    asg = asg || assignmentStats();
    ai = ai || filteredAiUsage();
    if (typeof XLSX === 'undefined') { if (window.AppDialog) AppDialog.alert('Excel library not loaded.'); return; }
    var wb = XLSX.utils.book_new();
    var stuById = {};
    students.forEach(function (s) { stuById[s.id] = s; });

    // Sheet 0: Summary - what produced this file + the KPI numbers.
    var rangeLabel = rangeDays > 0 ? ('Last ' + rangeDays + ' days') : 'All time';
    var sumRows = [
      ['Lingualab report'],
      ['Generated', new Date().toISOString().replace('T', ' ').slice(0, 16)],
      [],
      ['Filters'],
      ['Period', rangeLabel],
      ['Level', fLevel || 'All'],
      ['Class', fClass || 'All'],
      ['Module', fModule || 'All'],
      ['Academic year', fYear || 'All'],
      [],
      ['Key numbers'],
      ['Students (filtered)', students.length],
      ['Active in period', agg.activeCount],
      ['Practice sessions', sessions.length],
      ['Average score (%)', agg.avg],
      ['Unique words practiced', agg.totalUniqueWords],
      ['Games played', (games || []).length],
      ['Assignments in period', asg.rows.length],
      ['Assignment completion (%)', asg.overallPct]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Summary');

    // Sheet 1: Students - the FULL old sidebar-CSV column set (words, status,
    // days-since-active included), respecting the panel's filters + period.
    var head = ['Name', 'Email', 'Level', 'Class', 'Module', 'Academic Year', 'Sessions', 'Words Practiced', 'Avg Score (%)'];
    SKILLS.forEach(function (k) {
      var K = k.charAt(0).toUpperCase() + k.slice(1);
      head.push(K + ' Sessions', K + ' Avg (%)');
    });
    head.push('Last Login', 'Status', 'Days Since Last Active');
    var sRows = [head];
    students.forEach(function (s) {
      var mine = sessions.filter(function (x) { return x.userId === s.id; });
      // Per-student average over MARKED sessions only; blank rather than 0
      // when nothing has been marked, so the column reads honestly.
      var _sa = window.LLScore ? LLScore.avgRounded(mine) : null;
      var avg = _sa === null ? '' : _sa;
      var words = agg.wordsByStudent[s.id] ? Object.keys(agg.wordsByStudent[s.id]).length : 0;
      var bySkill = {};
      SKILLS.forEach(function (k) { bySkill[k] = { n: 0, sum: 0 }; });
      mine.forEach(function (x) {
        var sk = skillOf(x);
        if (!bySkill[sk]) bySkill[sk] = { n: 0, sum: 0 };
        bySkill[sk].n++; addScore(bySkill[sk], scoreOf(x));
      });
      var row = [s.name || '', s.email || '', s.level || '', s.studentClass || '', s.module || '', s.academicYear || '', mine.length, words, avg];
      SKILLS.forEach(function (k) {
        var b = bySkill[k];
        row.push(b.n, bucketAvg(b) === null ? '' : bucketAvg(b));
      });
      var ll = toDate(s.lastLogin);
      var daysSince = ll ? Math.floor((Date.now() - ll.getTime()) / 86400000) : '';
      row.push(ll ? dayKey(ll) : 'Never',
        (ll && daysSince <= 7) ? 'Active' : 'Inactive',
        ll ? daysSince : 'N/A');
      sRows.push(row);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sRows), 'Students');

    // Sheet 2: Skill summary
    var kRows = [['Skill', 'Sessions', 'Avg Score (%)']];
    SKILLS.forEach(function (k) {
      var b = agg.bySkill[k];
      kRows.push([k, b.n, bucketAvg(b) === null ? '' : bucketAvg(b)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kRows), 'Skills');

    // Sheet 3: Per class
    var cRows = [['Class', 'Sessions', 'Avg Score (%)']];
    Object.keys(agg.byClass).sort().forEach(function (c) {
      var b = agg.byClass[c];
      cRows.push([c, b.n, bucketAvg(b) === null ? '' : bucketAvg(b)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cRows), 'Classes');

    // Grouped summaries keyed off the STUDENT's profile (level/module/year),
    // so they line up with the roster charts.
    function dimSheet(name, field) {
      var m = {};
      students.forEach(function (s) {
        var k = s[field] || '(none)';
        if (!m[k]) m[k] = { students: 0, n: 0, sum: 0 };
        m[k].students++;
      });
      sessions.forEach(function (x) {
        var s = stuById[x.userId];
        var k = (s && s[field]) || '(none)';
        if (!m[k]) m[k] = { students: 0, n: 0, sum: 0 };
        m[k].n++; addScore(m[k], scoreOf(x));
      });
      var rows = [[name, 'Students', 'Sessions', 'Avg Score (%)']];
      Object.keys(m).sort().forEach(function (k) {
        var b = m[k];
        rows.push([k, b.students, b.n, bucketAvg(b) === null ? '' : bucketAvg(b)]);
      });
      return rows;
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dimSheet('Level', 'level')), 'Levels');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dimSheet('Module', 'module')), 'Modules');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dimSheet('Academic year', 'academicYear')), 'Years');

    // Word lists (units): LEVEL-qualified (unit numbers repeat across levels),
    // vocab + grammar only, with the per-skill split and average.
    var uAgg = {};
    sessions.forEach(function (x) {
      var u = normUnit(x.unit);
      if (!u) return;
      var sk = skillOf(x);
      if (sk !== 'vocabulary' && sk !== 'grammar') return;
      var k = (x.level ? x.level + '|' : '|') + u;
      if (!uAgg[k]) uAgg[k] = { level: x.level || '', unit: u, n: 0, vocab: 0, grammar: 0, sum: 0 };
      uAgg[k].n++; addScore(uAgg[k], scoreOf(x));
      if (sk === 'grammar') uAgg[k].grammar++; else uAgg[k].vocab++;
    });
    var uRows = [['Level', 'Unit', 'Sessions', 'Vocabulary', 'Grammar', 'Avg Score (%)']];
    Object.keys(uAgg).sort(function (a, b) { return uAgg[b].n - uAgg[a].n; }).forEach(function (k) {
      var b = uAgg[k];
      uRows.push([b.level, b.unit, b.n, b.vocab, b.grammar,
                  bucketAvg(b) === null ? '' : bucketAvg(b)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(uRows), 'Word lists');

    // Weekly trend (weeks keyed by their Monday).
    var wRows = [['Week of', 'Sessions', 'Avg Score (%)']];
    Object.keys(agg.byWeek).sort().forEach(function (w) {
      var b = agg.byWeek[w];
      wRows.push([w, b.n, bucketAvg(b) === null ? '' : bucketAvg(b)]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wRows), 'Weekly');

    // Sheet: Sessions per day
    var dRows = [['Day', 'Sessions']];
    Object.keys(agg.byDay).sort().forEach(function (d) { dRows.push([d, agg.byDay[d]]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dRows), 'By day');

    // Engagement summary (per-student status is on the Students sheet).
    var eRows = [['Last login', 'Students']];
    ['Active 7d', '8-30d', '30d+', 'Never'].forEach(function (k) { eRows.push([k, agg.engagement[k] || 0]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eRows), 'Engagement');

    // RAW practice sessions - the most granular data, one row per session
    // (capped so a huge history cannot freeze the tab; Summary shows totals).
    var rawRows = [['Date', 'Student', 'Email', 'Class', 'Level', 'Module', 'Skill', 'Activity', 'Unit', 'Score (%)', 'Correct', 'Total', 'Words in session']];
    var RAW_CAP = 10000;
    sessions.slice(0, RAW_CAP).forEach(function (x) {
      var s = stuById[x.userId] || {};
      var d = toDate(x.createdAt);
      rawRows.push([
        d ? dayKey(d) : '', s.name || '', s.email || '',
        x.studentClass || s.studentClass || '', s.level || '', s.module || '',
        skillOf(x), x.activity || '', normUnit(x.unit) || (x.unit || ''),
        (x.percentage != null ? x.percentage : ''),
        (x.correctAnswers != null ? x.correctAnswers : (x.score != null ? x.score : '')),
        (x.totalQuestions != null ? x.totalQuestions : (x.total != null ? x.total : '')),
        Array.isArray(x.wordsLearned) ? x.wordsLearned.length : ''
      ]);
    });
    if (sessions.length > RAW_CAP) rawRows.push(['... truncated at ' + RAW_CAP + ' of ' + sessions.length + ' sessions']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rawRows), 'Sessions');

    // Assignments - one row per assignment with real completion math
    // (expected counts come from the assignment's target vs the roster).
    var aRows = [['Deadline', 'Title', 'Skill', 'Target', 'Expected', 'Completed', 'Completion (%)']];
    asg.rows.forEach(function (r) {
      aRows.push([r.deadline, r.title, r.skill, r.target, r.expected, r.done, r.pct]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aRows), 'Assignments');

    // Games summary - one row per finished game.
    var gRows = [['Date', 'Game', 'Teacher', 'Level', 'Unit / Exam', 'Questions', 'Players', 'Avg Score', 'Outcome']];
    (games || []).forEach(function (g) {
      var avg = g.players && g.players.length
        ? Math.round(g.players.reduce(function (t, p) { return t + (p.score || 0); }, 0) / g.players.length) : 0;
      gRows.push([g.day || '', GAME_NAME[g.game] || g.game, g.teacherName || '', g.level || '', g.examTitle || g.unit || '', g.mode || '', g.playerCount || 0, avg, g.outcome || '']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gRows), 'Games');

    // Game players - one row per player per game (full scoreboards).
    var gpRows = [['Date', 'Game', 'Teacher', 'Level', 'Unit / Exam', 'Rank', 'Student', 'Score']];
    (games || []).forEach(function (g) {
      (g.players || []).forEach(function (p, i) {
        gpRows.push([g.day || '', GAME_NAME[g.game] || g.game, g.teacherName || '', g.level || '', g.examTitle || g.unit || '', i + 1, p.name || '', p.score || 0]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gpRows), 'Game players');

    // AI usage - one row per writing-AI analysis (who used it, when, depth).
    var aiRows = [['Date', 'Teacher', 'Email', 'Depth', 'Rubric', 'Essay chars']];
    (ai || []).forEach(function (u) {
      var d = toDate(u.at);
      aiRows.push([d ? dayKey(d) : '', u.teacherName || '', u.teacherEmail || '', u.depth || '', u.rubric || '', u.essayChars || '']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aiRows), 'AI usage');

    // Placement - one row per finished placement test (recommendation only;
    // it never touches profiles). Essay text stays in Firestore, not the file.
    var plList = filteredPlacements();
    var pcell = function (x) { return (x && x.total) ? Math.round((x.correct / x.total) * 100) : ''; };
    var plRows = [['Date', 'Student', 'Class', 'Grammar %', 'Vocab %', 'Reading %', 'Listening %', 'Writing words', 'Recommended', 'Ladder path', 'Duration (min)']];
    plList.forEach(function (p) {
      var d = toDate(p.at), s = p.sectionScores || {};
      plRows.push([d ? dayKey(d) : '', p.name || p._id, p.studentClass || '',
        pcell(s.grammar), pcell(s.vocab), pcell(s.reading), pcell(s.listening),
        (p.writing && p.writing.words) || '', p.recommendedLevel || '', p.stagePath || '',
        p.durationSec ? Math.round(p.durationSec / 60) : '']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plRows), 'Placement');

    XLSX.writeFile(wb, 'lingualab-report-' + dayKey(new Date()) + '.xlsx');
  }

  // ── Init: lazy-render on first sub-tab open ──────────────────
  function init() {
    if (!$('reportsBody')) return;
    var subTab = document.querySelector('#adminSubNav .admin-subtab[data-target="reportsPanel"]');
    var openedOnce = false;
    if (subTab) subTab.addEventListener('click', function () {
      if (!openedOnce) { openedOnce = true; setTimeout(render, 120); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
