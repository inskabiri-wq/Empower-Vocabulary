/* Teacher Dashboard - Activity & Alerts */

// Read a CSS custom property at runtime so inline hex literals in
// HTML template strings stay aligned with the dashboard palette.
// (overview-v2.js exposes the same idea as THEME_COLORS; we keep
//  this file standalone with a tiny helper for clarity.)
function _cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (_) { return fallback; }
}

/* ── ESSAYS WAITING TO BE GRADED ──────────────────────────────────────────
   ONE definition, used by both Overviews. The v2 Overview draws the band a
   teacher actually sees; the legacy alert card uses the same numbers. Two
   implementations of one count is how two screens start disagreeing.

   Counted from `allWritingSubs`, the live snapshot teacher-assignments.js
   already holds, so this costs NO extra Firestore reads. A submission is
   waiting unless its status is 'graded' or 'returned' - the same test
   grading-stats.js applies, so the Grading tab cannot contradict it.
   ------------------------------------------------------------------------ */
window.LLEssaysWaiting = function (opts) {
  const doneWindowDays = (opts && Number(opts.doneWindowDays) > 0) ? Number(opts.doneWindowDays) : 7;
  const empty = { count: 0, list: [], overdue: 0, done: 0, doneWindowDays: doneWindowDays,
                  byAssignment: [], orphaned: 0 };
  const list = [];
  let done = 0, overdue = 0, orphaned = 0;
  try {
    const subs = (typeof allWritingSubs !== 'undefined' && allWritingSubs) ? allWritingSubs : {};

    // Deadlines live on the ASSIGNMENT, not the submission, so overdue needs
    // a join. allAssignments is already in memory; this adds no reads.
    const deadlineById = {};
    const liveAssignments = {};
    let haveAssignments = false;
    try {
      const asg = (typeof allAssignments !== 'undefined' && Array.isArray(allAssignments)) ? allAssignments : [];
      haveAssignments = asg.length > 0;
      asg.forEach((a) => {
        if (!a || !a.id) return;
        liveAssignments[a.id] = true;
        if (!a.deadline) return;
        const d = a.deadline.toDate ? a.deadline.toDate() : new Date(a.deadline);
        if (d && !isNaN(d.getTime())) deadlineById[a.id] = d;
      });
    } catch (_) { /* no assignments loaded yet: nothing is overdue, not a crash */ }

    const now = Date.now();
    const doneCutoff = now - doneWindowDays * 86400000;

    Object.keys(subs).forEach((k) => {
      const s = subs[k];
      if (!s) return;
      const st = s.status || 'submitted';

      if (st === 'graded' || st === 'returned') {
        // ONLY THIS TEACHER'S OWN MARKING.
        //
        // This branch used to return BEFORE the ownership guard below, so for
        // a non-admin teacher `done` counted every graded essay in the whole
        // school while `count`, `overdue`, `orphaned` and the list beside it
        // were correctly limited to their own assignments. One number in the
        // band was measuring something different from the rest of it.
        //
        // The guard is repeated here rather than hoisted above this branch,
        // because `orphaned` must NOT count a graded essay. That counter is
        // the pile a teacher can never clear, and marked work is not waiting
        // work - hoisting the guard would inflate it with finished essays.
        // Same predicate, deliberately different consequence: skip, do not
        // count. For an admin, allAssignments is the full list, so nothing is
        // skipped and the admin view stays school-wide.
        //
        // A graded essay whose assignment was deleted is dropped rather than
        // counted. There is no problem left to surface - the work is done -
        // so unlike the waiting path it does not need a visible tally.
        if (haveAssignments && s.assignmentId && !liveAssignments[s.assignmentId]) return;
        // Marked WITHIN the window. All-time would only ever grow and stop
        // meaning anything; "12 marked this week" is a number you can act on.
        const g = s.gradedAt && s.gradedAt.toDate ? s.gradedAt.toDate()
                : (s.gradedAt ? new Date(s.gradedAt) : null);
        if (g && !isNaN(g.getTime()) && g.getTime() >= doneCutoff) done++;
        return;
      }

      // ORPHANS. Deleting an assignment removes only the assignment document;
      // its submissions stay behind. Counting those puts work in the band that
      // a teacher can never clear - there is no assignment left to grade
      // against - so the to-do list becomes permanently uncloseable.
      //
      // Guarded on haveAssignments: before the assignments snapshot arrives
      // the map is empty and EVERYTHING would look orphaned, which would hide
      // real work. Only filter once we actually know what exists.
      //
      // For a non-admin teacher allAssignments is already scoped to their own,
      // so this also drops another teacher's submissions - which is correct
      // here: this band is their marking queue, not everyone's.
      // Counted, not silently swallowed: the band says how many there are so
      // the problem is visible instead of just missing.
      if (haveAssignments && s.assignmentId && !liveAssignments[s.assignmentId]) { orphaned++; return; }

      const at = s.submittedAt && s.submittedAt.toDate ? s.submittedAt.toDate()
               : (s.submittedAt ? new Date(s.submittedAt) : null);
      const due = deadlineById[s.assignmentId];
      const isOverdue = !!(due && due.getTime() < now);
      if (isOverdue) overdue++;

      list.push({
        name:  s.userName || s.studentName || s.userEmail || 'A student',
        cls:   s.studentClass || 'No class',
        title: s.assignmentTitle || 'Writing submission',
        overdue: isOverdue,
        // Hours waiting, or null when the doc carries no timestamp. Null
        // sorts last rather than pretending to be zero hours old.
        hours: at ? Math.max(0, Math.round((now - at.getTime()) / 3600000)) : null
      });
    });

    // Overdue first, then oldest first inside each group: that is the order a
    // teacher would actually work through them.
    list.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (b.hours == null ? -1 : b.hours) - (a.hours == null ? -1 : a.hours);
    });
  } catch (_) { return empty; }

  // Which assignments the waiting work belongs to, biggest pile first.
  const counts = {};
  list.forEach((e) => { counts[e.title] = (counts[e.title] || 0) + 1; });
  const byAssignment = Object.keys(counts)
    .map((t) => ({ title: t, n: counts[t] }))
    .sort((a, b) => b.n - a.n);

  return { count: list.length, list: list, overdue: overdue,
           done: done, doneWindowDays: doneWindowDays, byAssignment: byAssignment,
           orphaned: orphaned };
};

// ============================================================
// ACTIVITY DROPDOWN - rebuilt every time the skill pill changes
// so the visible activity options always match the selected skill.
// Previously the dropdown had a hard-coded list of vocab-only
// activities, which made the Activity tab look like it was showing
// vocabulary data even when "📖 Reading" was selected.
// ============================================================
const SKILL_ACTIVITY_OPTIONS = {
  all: [
    { value: 'match',           label: '🔗 Match' },
    { value: 'choice',          label: '🎯 Multiple Choice' },
    { value: 'reverse',         label: '🔄 Listening Mode (vocab)' },
    { value: 'spelling',        label: '⌨️ Spelling' },
    { value: 'fillblank',       label: '📝 Fill in Blank' },
    { value: 'order',           label: '🔀 Word Order' },
    { value: 'pronunciation',   label: '🗣️ Pronunciation' },
    { value: 'unscramble',      label: '🧩 Unscramble' },
    { value: 'listening-exam',  label: '🎧 Listening Exam' },
    { value: 'reading-exam',    label: '📖 Reading Exam' }
  ],
  vocabulary: [
    { value: 'match',           label: '🔗 Match' },
    { value: 'choice',          label: '🎯 Multiple Choice' },
    { value: 'reverse',         label: '🔄 Listening Mode' },
    { value: 'spelling',        label: '⌨️ Spelling' },
    { value: 'fillblank',       label: '📝 Fill in Blank' },
    { value: 'order',           label: '🔀 Word Order' },
    { value: 'pronunciation',   label: '🗣️ Pronunciation' },
    { value: 'unscramble',      label: '🧩 Unscramble' }
  ],
  listening: [
    { value: 'listening-exam',  label: '🎧 Listening Exam' }
  ],
  reading: [
    { value: 'reading-exam',    label: '📖 Reading Exam' }
  ],
  // Future skills - no logged activities yet, so dropdown shows only "All"
  grammar: [
    { value: 'grammar-choice',     label: '🎯 Multiple Choice' },
    { value: 'grammar-fill',       label: '📝 Fill in the Blank' },
    { value: 'grammar-unscramble', label: '🧩 Unscramble' }
  ],
  writing:  [],
  speaking: []
};

function rebuildActivityDropdown(skillKey) {
  const sel = document.getElementById('activityFilter');
  if (!sel) return;
  const key = (skillKey && SKILL_ACTIVITY_OPTIONS[skillKey]) ? skillKey : 'all';
  const opts = SKILL_ACTIVITY_OPTIONS[key];
  const skillLabel = key === 'all' ? 'All Activities'
                  : key === 'vocabulary' ? 'All Vocabulary Activities'
                  : key === 'reading'    ? 'All Reading Attempts'
                  : key === 'listening'  ? 'All Listening Attempts'
                  : `All ${key.charAt(0).toUpperCase() + key.slice(1)} Activities`;
  const previous = sel.value;
  let html = `<option value="all">${skillLabel}</option>`;
  opts.forEach(o => {
    html += `<option value="${o.value}">${o.label}</option>`;
  });
  sel.innerHTML = html;
  // Try to preserve the previous selection if still valid; otherwise default
  // to "all" (because the previous activity may not exist in the new skill).
  const stillValid = previous === 'all' || opts.some(o => o.value === previous);
  sel.value = stillValid ? previous : 'all';
}
window.rebuildActivityDropdown = rebuildActivityDropdown;

// Build the dropdown once at boot, then again whenever the skill pill
// changes (skills/index.js calls loadRecentActivity, which we now hook
// to rebuild the dropdown first).
document.addEventListener('DOMContentLoaded', () => {
  rebuildActivityDropdown('all');
});

// ============================================
// RECENT ACTIVITY
// ============================================
function loadRecentActivity() {
  const container = document.getElementById('activityList');
  const skillFilter = (typeof getSkillFilter === 'function') ? getSkillFilter('activity') : 'all';

  // Rebuild the activity-type dropdown so its options match the currently
  // selected skill pill. Without this, picking "📖 Reading" left the
  // dropdown showing only vocab activities - making the page look like
  // it was reporting vocabulary data when the user wanted reading.
  rebuildActivityDropdown(skillFilter);

  const filter = document.getElementById('activityFilter').value;
  const bookFilter = document.getElementById('activityBookFilter')?.value || 'all';

  let filtered = allSessions;

  // Skill filter - applied first so activity dropdown always sees a
  // skill-narrowed pool (e.g. picking "Listening" then a vocab activity
  // produces an empty list, which matches the pill selection).
  if (skillFilter && skillFilter !== 'all' && typeof filterSessionsBySkill === 'function') {
    filtered = filterSessionsBySkill(filtered, skillFilter);
  }

  if (filter !== 'all') {
    filtered = filtered.filter(s => s.activity === filter);
  }
  if (bookFilter !== 'all') {
    if (bookFilter === 'empower') {
      // Empower: sessions with book='empower' OR no book field (old sessions)
      filtered = filtered.filter(s => s.book === 'empower' || !s.book);
    } else {
      // Gateway: only sessions explicitly marked as gateway
      filtered = filtered.filter(s => s.book === bookFilter);
    }
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No activity found</p>
      </div>
    `;
    return;
  }
  
  // Canonical activity icon set - keep in sync with overview-v2.js
  // ACTIVITY_META. Each activity has ONE icon used everywhere in the
  // teacher dashboard.
  const activityIcons = {
    'grammar-choice': '🎯', 'grammar-fill': '📝', 'grammar-unscramble': '🧩',
    choice:            '🎯',  // Multiple Choice - target
    match:             '🔗',  // Match - link
    spelling:          '⌨️',  // Spelling - typing
    fillblank:         '📝',  // Fill in Blank - writing
    order:             '🔀',  // Word Order - shuffle
    reverse:           '🔄',  // Reverse Mode - reverse arrows
    pronunciation:     '🗣️',  // Pronunciation - speaking
    unscramble:        '🧩',  // Unscramble - puzzle
    'unscramble-diff': '🧩',
    'listening-exam':  '🎧',  // Listening exam - headphones
    listening:         '🎧',
    'reading-exam':    '📖',  // Reading exam - book
    reading:           '📖'
  };

  const activityNames = {
    'grammar-choice': 'Grammar · Multiple Choice', 'grammar-fill': 'Grammar · Fill in the Blank', 'grammar-unscramble': 'Grammar · Unscramble',
    choice: 'Multiple Choice',
    match: 'Match Game',
    spelling: 'Spelling',
    fillblank: 'Fill in Blank',
    order: 'Word Order',
    reverse: 'Listening Mode',
    pronunciation: 'Pronunciation',
    unscramble: 'Unscramble',
    'unscramble-diff': 'Unscramble (Hard)',
    'listening-exam': 'Listening Exam',
    listening: 'Listening',
    'reading-exam': 'Reading Exam',
    reading: 'Reading'
  };
  
  container.innerHTML = filtered.slice(0, 30).map(session => {
    const date = session.createdAt?.toDate ? session.createdAt.toDate() : new Date();
    const timeAgo = getTimeAgo(date);
    
    let scoreClass = '';
    if (session.percentage < 50) scoreClass = 'low';
    else if (session.percentage < 70) scoreClass = 'medium';

    // Lockdown breach flag - shown when a TIMED reading attempt
    // recorded any tab switches. Helps the teacher spot suspicious
    // sessions at a glance.
    const breachFlag = (session.activity === 'reading-exam'
                       && session.mode === 'timed'
                       && (session.tabSwitches || 0) > 0)
      ? ` <span title="Tab switched ${session.tabSwitches} time${session.tabSwitches === 1 ? '' : 's'} during a timed exam"
                style="color:${_cssVar('--t2-amber', '#3b82f6')};font-weight:700;">⚠ ${session.tabSwitches}</span>`
      : '';
    const autoSubmitFlag = (session.activity === 'reading-exam' && session.autoSubmitted)
      ? ` <span title="Time ran out - auto-submitted" style="color:${_cssVar('--t2-text-muted', '#7d8590')};font-size:11px;">⏱ auto</span>`
      : '';

    // Score column - skill-aware:
    //   • Writing rows: show the grading status (✓ Submitted /
    //     🎓 Graded / 🔄 Returned) by looking up the matching
    //     writingSubmissions doc. The word count was meaningless
    //     here - what the teacher actually wants to see is
    //     "did I grade this yet?"
    //   • Vocab / reading / listening: show percentage as before.
    //   • Anything else: em dash.
    let scoreLabel;
    if (session.activity === 'writing-exam') {
      const wsKey = `${session.userId}_${session.assignmentId}`;
      const ws = (typeof allWritingSubs !== 'undefined') ? allWritingSubs[wsKey] : null;
      const wstatus = ws?.status || 'submitted';   // submission row exists even if Firestore lag
      if (wstatus === 'graded') {
        scoreLabel = '🎓 Graded';
        scoreClass = '';                            // green = success, leave the css clean
      } else if (wstatus === 'returned') {
        scoreLabel = '🔄 Returned';
        scoreClass = 'medium';                      // amber-ish tone
      } else {
        scoreLabel = '✓ Submitted';
        scoreClass = '';
      }
    } else if (session.unscored || session.activity === 'pronunciation') {
      // Pronunciation is listen-and-repeat and marks nothing, so it has no
      // score to show. It used to arrive here as 0% and read as a total
      // failure by a student who had done the whole exercise.
      const n = session.wordsPractised || session.total || 0;
      scoreLabel = n ? `🎙️ ${n} practised` : '🎙️ Practised';
      scoreClass = '';
    } else if (typeof session.percentage === 'number' && Number.isFinite(session.percentage)) {
      scoreLabel = `${session.percentage}%`;
    } else {
      scoreLabel = '-';
    }

    // Student name - prefer the canonical name from the users doc
    // (the authoritative source) over the denormalized userName on
    // the session itself. The session might just have an email if
    // displayName was never set. Tooltip carries email + class so
    // the teacher can disambiguate two students with the same
    // first name without leaving the page.
    const studentRecord = (typeof allStudents !== 'undefined')
      ? allStudents.find(s => s.id === session.userId)
      : null;
    const displayName = (studentRecord && studentRecord.name)
      || session.userName
      || (studentRecord && studentRecord.email)
      || 'Student';
    const tipParts = [];
    if (studentRecord?.email)        tipParts.push(studentRecord.email);
    if (studentRecord?.studentClass) tipParts.push('Class ' + studentRecord.studentClass);
    if (studentRecord?.level)        tipParts.push(studentRecord.level);
    const tooltip = tipParts.join(' · ');

    // Grammar sessions carry per-question detail (grammarDetails); let the
    // teacher tap a row to expand exactly which items the student missed.
    // Grammar stores grammarDetails; vocabulary stores vocabDetails. Same shape
    // ({q, picked, correct, ok}), so ONE renderer expands either.
    // LENGTH, NOT JUST Array.isArray. An empty array is truthy, and the
    // generic session writer used to attach `vocabDetails: []` to EVERY
    // practice session including pronunciation, which never fills it. So a
    // pronunciation row advertised "tap for items", opened, and showed an
    // empty box - the detail was not missing, it was never there.
    const pick = (a) => (Array.isArray(a) && a.length) ? a : null;
    const gd = pick(session.grammarDetails)
            || pick(session.vocabDetails)
            || pick(session.pronDetails)
            || null;
    const detailHtml = gd ? `
      <div class="gr-attempt-detail" style="display:none; padding:6px 16px 12px 58px; border-bottom:1px solid rgba(255,255,255,0.05);">
        ${gd.map(d => `
          <div style="display:flex; gap:8px; align-items:flex-start; padding:3px 0; font-size:0.82em; line-height:1.4;">
            <span>${d.ok ? '✅' : '❌'}</span>
            <span style="flex:1; color:${_cssVar('--t2-text', '#c9d1d9')};">${escapeHtml(String(d.q || '').replace(/_{2,}/, '____'))}${d.ok ? '' : ` &nbsp;<span style="color:#ef4444;">chose &ldquo;${escapeHtml(d.picked || '')}&rdquo;</span> &nbsp;<span style="color:#22c55e;">answer &ldquo;${escapeHtml(d.correct || '')}&rdquo;</span>`}</span>
          </div>`).join('')}
      </div>` : '';

    return `
      <div class="activity-item"${gd ? ' style="cursor:pointer;" onclick="var d=this.nextElementSibling; if(d){d.style.display=(d.style.display===\'block\'?\'none\':\'block\');}"' : ''}>
        <div class="activity-info">
          <div class="activity-icon">${activityIcons[session.activity] || '📝'}</div>
          <div class="activity-details">
            <h4 ${tooltip ? `title="${escapeHtml(tooltip)}"` : ''}
                style="cursor: ${tooltip ? 'help' : 'default'};">
              ${escapeHtml(displayName)}${breachFlag}
            </h4>
            <p>${activityNames[session.activity] || session.activity} • ${session.level || '-'} • ${timeAgo}${autoSubmitFlag}${gd ? ' • <span style="opacity:0.7;">tap for items</span>' : ''}</p>
          </div>
        </div>
        <div class="activity-score ${scoreClass}">${scoreLabel}</div>
      </div>${detailHtml}
    `;
  }).join('');
}

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// ALERTS - STRUGGLING STUDENTS
// ============================================
function checkStrugglingStudents() {
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  
  let totalAlerts = 0;
  
  // 1. Inactive for 7+ days
  const inactiveStudents = allStudents.filter(s => {
    const lastLogin = s.lastLogin?.toDate ? s.lastLogin.toDate().getTime() : 0;
    return lastLogin < sevenDaysAgo && lastLogin > 0;
  });
  
  if (inactiveStudents.length > 0) {
    totalAlerts += inactiveStudents.length;
    document.getElementById('inactiveCard').style.display = 'block';
    document.getElementById('inactiveList').innerHTML = inactiveStudents
      .map(s => {
        const initials = getInitials(s.name || s.email);
        const lastLogin = s.lastLogin?.toDate ? s.lastLogin.toDate() : null;
        const daysAgo = lastLogin ? Math.floor((now - lastLogin.getTime()) / (24*60*60*1000)) : '?';
        return `
          <div class="alert-student-item">
            <div class="alert-student-info">
              <div class="alert-student-avatar">${initials}</div>
              <div>
                <div class="alert-student-name">${escapeHtml(s.name) || escapeHtml(s.email)}</div>
                <div class="alert-student-class">${s.studentClass || 'No class'}</div>
              </div>
            </div>
            <div class="alert-student-stat">${daysAgo} days</div>
          </div>
        `;
      })
      .join('');
  } else {
    document.getElementById('inactiveCard').style.display = 'none';
  }
  
  // Only sessions that were actually MARKED count toward an average.
  //
  // Pronunciation marks nothing, so it used to arrive here as 0% and pull a
  // student's average down. Practising it enough times was sufficient to get
  // flagged as needing attention, which is the opposite of what the practice
  // deserves. `percentage || 0` cannot tell "scored zero" from "never scored",
  // so the filter has to happen before the average, not inside it.
  const scoredOnly = (list) => list.filter(x =>
    !x.unscored && x.activity !== 'pronunciation' &&
    typeof x.percentage === 'number' && Number.isFinite(x.percentage));
  const avgOf = (list) => list.length
    ? list.reduce((sum, x) => sum + x.percentage, 0) / list.length : null;

  // THE EXACT AVERAGE WHERE THERE IS ONE.
  //
  // allSessions is the most recent 1000 rows across EVERY student. With 400
  // students active that is two or three days, so this card was flagging - and
  // failing to flag - people on a sliver of their work, and a student who was
  // busy last month counted as having done nothing.
  //
  // Running totals now live on each student's own document
  // (statsScoredSessions / statsScoreSum, written by student/js/score-rollup.js
  // as sessions are saved). They are already in memory with the student list,
  // cost no extra reads, and are exact over the whole year.
  //
  // Students who have not practised since the rollup shipped have no counters,
  // so they fall back to the session window - the behaviour they have today,
  // never worse - and become exact on their next scored session.
  const rolledCount = (s) => {
    const n = Number(s && s.statsScoredSessions);
    return (isFinite(n) && n > 0) ? n : null;
  };
  const avgForStudent = (s) => {
    // Referenced through `window` on both sides. Guarding on window.LLRollup
    // and then calling a bare LLRollup only works because window IS the global
    // in a browser; it is an implicit dependency that reads like a bug and
    // throws anywhere else.
    const R = window.LLRollup;
    const rolled = (R && typeof R.averageFor === 'function') ? R.averageFor(s) : null;
    if (rolled != null) return rolled;
    const sessions = scoredOnly(allSessions.filter(sess => sess.userId === s.id));
    return sessions.length ? avgOf(sessions) : null;
  };
  // Paired with avgForStudent so the number of sessions shown and the average
  // shown always describe the same set of work.
  const scoredCountFor = (s) => {
    const n = rolledCount(s);
    if (n != null) return n;
    return scoredOnly(allSessions.filter(sess => sess.userId === s.id)).length;
  };

  // 2. Average score below 50%
  const lowScoreStudents = allStudents.filter(s => {
    const avg = avgForStudent(s);
    if (avg == null) return false;             // nothing marked yet is not "low"
    return avg < 50;
  });
  
  if (lowScoreStudents.length > 0) {
    totalAlerts += lowScoreStudents.length;
    document.getElementById('lowScoreCard').style.display = 'block';
    document.getElementById('lowScoreList').innerHTML = lowScoreStudents
      .map(s => {
        const initials = getInitials(s.name || s.email);
        const a = avgForStudent(s);
        const avg = a == null ? 0 : Math.round(a);
        // The count has to come from the SAME place as the average, or the row
        // reads "3 sessions - 41%" where the 41% was worked out over a year and
        // the 3 is only what fell inside the recent window.
        const nSessions = scoredCountFor(s);
        return `
          <div class="alert-student-item">
            <div class="alert-student-info">
              <div class="alert-student-avatar">${initials}</div>
              <div>
                <div class="alert-student-name">${escapeHtml(s.name) || escapeHtml(s.email)}</div>
                <div class="alert-student-class">${nSessions} sessions</div>
              </div>
            </div>
            <div class="alert-student-stat">${avg}%</div>
          </div>
        `;
      })
      .join('');
  } else {
    document.getElementById('lowScoreCard').style.display = 'none';
  }
  
  // 3. No sessions at all
  const noSessionStudents = allStudents.filter(s => {
    const sessions = allSessions.filter(sess => sess.userId === s.id);
    return sessions.length === 0;
  });
  
  if (noSessionStudents.length > 0) {
    totalAlerts += noSessionStudents.length;
    document.getElementById('noSessionsCard').style.display = 'block';
    document.getElementById('noSessionsList').innerHTML = noSessionStudents
      .map(s => {
        const initials = getInitials(s.name || s.email);
        return `
          <div class="alert-student-item">
            <div class="alert-student-info">
              <div class="alert-student-avatar">${initials}</div>
              <div>
                <div class="alert-student-name">${escapeHtml(s.name) || escapeHtml(s.email)}</div>
                <div class="alert-student-class">${s.studentClass || 'No class'}</div>
              </div>
            </div>
            <div class="alert-student-stat">0 sessions</div>
          </div>
        `;
      })
      .join('');
  } else {
    document.getElementById('noSessionsCard').style.display = 'none';
  }
  
  // ESSAYS WAITING TO BE GRADED. One source of truth in LLEssaysWaiting(),
  // because the v2 Overview shows the same number and two implementations of
  // one count is how two screens start disagreeing.
  //
  // Deliberately NOT added to totalAlerts. Those three are students who need
  // help; this is work the teacher owes. Summing them means nothing.
  // Called through `window.` on purpose: it is defined as a property, and a
  // bare identifier would be a ReferenceError anywhere `window` is a plain
  // object rather than the global (which is exactly how the gate runs it).
  const _essays = window.LLEssaysWaiting ? window.LLEssaysWaiting() : { count: 0, list: [] };
  const essaysWaiting = _essays.count;
  const pendingEssays = _essays.list;

  // Write the count unconditionally. It used to be set only inside the
  // "is the alert row visible" branch, so a teacher whose last essay was
  // marked left a stale number sitting in a hidden card, ready to be shown
  // the next time any unrelated alert made the row appear.
  const _ec = document.getElementById('essaysWaitingCount');
  if (_ec) _ec.textContent = essaysWaiting;

  // Detail list, same shape as the three student cards above it.
  const essaysCard = document.getElementById('essaysWaitingCard');
  const essaysList = document.getElementById('essaysWaitingList');
  if (essaysCard && essaysList) {
    if (essaysWaiting > 0) {
      essaysCard.style.display = 'block';
      essaysList.innerHTML = pendingEssays.map((e) => {
        const waited = e.hours == null ? 'waiting'
                     : (e.hours < 24 ? e.hours + 'h waiting'
                                     : Math.floor(e.hours / 24) + 'd waiting');
        return `
          <div class="alert-student-item">
            <div class="alert-student-info">
              <div class="alert-student-avatar">${getInitials(e.name)}</div>
              <div>
                <div class="alert-student-name">${escapeHtml(e.name)}</div>
                <div class="alert-student-class">${escapeHtml(e.cls)} &middot; ${escapeHtml(e.title)}</div>
              </div>
            </div>
            <div class="alert-student-stat">${waited}</div>
          </div>
        `;
      }).join('');
    } else {
      essaysCard.style.display = 'none';
      essaysList.innerHTML = '';
    }
  }

  // Update alert summary cards in Overview
  const summaryGrid = document.getElementById('alertSummaryGrid');
  if (summaryGrid) {
    // Show the row if EITHER kind of thing needs attention. Gating on
    // totalAlerts alone would hide the essays card in exactly the case it
    // exists for: a teacher with no struggling students but a pile of marking.
    if (totalAlerts > 0 || essaysWaiting > 0) {
      summaryGrid.style.display = 'grid';
      const ic = document.getElementById('inactiveCount');
      const lc = document.getElementById('lowScoreCount');
      const nc = document.getElementById('noSessionsCount');
      const tc = document.getElementById('totalAlertsCount');
      if (ic) ic.textContent = inactiveStudents.length;
      if (lc) lc.textContent = lowScoreStudents.length;
      if (nc) nc.textContent = noSessionStudents.length;
      if (tc) tc.textContent = totalAlerts;
      // Add warning color to cards with counts > 0
      const setWarning = (id, count) => {
        const el = document.getElementById(id);
        if (el) el.style.borderColor = count > 0 ? 'rgba(59,130,246,0.5)' : '';
      };
      setWarning('alertCardInactive', inactiveStudents.length);
      setWarning('alertCardLowScore', lowScoreStudents.length);
      setWarning('alertCardNoSessions', noSessionStudents.length);
      setWarning('alertCardTotal', totalAlerts);
      setWarning('alertCardEssays', essaysWaiting);
    } else {
      summaryGrid.style.display = 'none';
    }
  }

  // Show/hide empty state
  // "All Clear!" only when there is genuinely nothing here. Gating on
  // totalAlerts alone would print "No struggling students detected" directly
  // above a card saying twelve essays are waiting to be marked.
  const _allClear = document.getElementById('noAlertsMessage');
  if (_allClear) _allClear.style.display = (totalAlerts === 0 && essaysWaiting === 0) ? 'block' : 'none';
}
