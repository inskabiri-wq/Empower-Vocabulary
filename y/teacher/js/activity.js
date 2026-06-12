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

// ============================================================
// ACTIVITY DROPDOWN — rebuilt every time the skill pill changes
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
  // Future skills — no logged activities yet, so dropdown shows only "All"
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
  // dropdown showing only vocab activities — making the page look like
  // it was reporting vocabulary data when the user wanted reading.
  rebuildActivityDropdown(skillFilter);

  const filter = document.getElementById('activityFilter').value;
  const bookFilter = document.getElementById('activityBookFilter')?.value || 'all';

  let filtered = allSessions;

  // Skill filter — applied first so activity dropdown always sees a
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
  
  // Canonical activity icon set — keep in sync with overview-v2.js
  // ACTIVITY_META. Each activity has ONE icon used everywhere in the
  // teacher dashboard.
  const activityIcons = {
    'grammar-choice': '🎯', 'grammar-fill': '📝', 'grammar-unscramble': '🧩',
    choice:            '🎯',  // Multiple Choice — target
    match:             '🔗',  // Match — link
    spelling:          '⌨️',  // Spelling — typing
    fillblank:         '📝',  // Fill in Blank — writing
    order:             '🔀',  // Word Order — shuffle
    reverse:           '🔄',  // Reverse Mode — reverse arrows
    pronunciation:     '🗣️',  // Pronunciation — speaking
    unscramble:        '🧩',  // Unscramble — puzzle
    'unscramble-diff': '🧩',
    'listening-exam':  '🎧',  // Listening exam — headphones
    listening:         '🎧',
    'reading-exam':    '📖',  // Reading exam — book
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
  
  const bookIcons = {
    empower: '📘',
    gateway: '📗'
  };
  
  container.innerHTML = filtered.slice(0, 30).map(session => {
    const date = session.createdAt?.toDate ? session.createdAt.toDate() : new Date();
    const timeAgo = getTimeAgo(date);
    const bookIcon = bookIcons[session.book] || '📚';
    
    let scoreClass = '';
    if (session.percentage < 50) scoreClass = 'low';
    else if (session.percentage < 70) scoreClass = 'medium';

    // Lockdown breach flag — shown when a TIMED reading attempt
    // recorded any tab switches. Helps the teacher spot suspicious
    // sessions at a glance.
    const breachFlag = (session.activity === 'reading-exam'
                       && session.mode === 'timed'
                       && (session.tabSwitches || 0) > 0)
      ? ` <span title="Tab switched ${session.tabSwitches} time${session.tabSwitches === 1 ? '' : 's'} during a timed exam"
                style="color:${_cssVar('--t2-amber', '#f59e0b')};font-weight:700;">⚠ ${session.tabSwitches}</span>`
      : '';
    const autoSubmitFlag = (session.activity === 'reading-exam' && session.autoSubmitted)
      ? ` <span title="Time ran out — auto-submitted" style="color:${_cssVar('--t2-text-muted', '#7d8590')};font-size:11px;">⏱ auto</span>`
      : '';

    // Score column — skill-aware:
    //   • Writing rows: show the grading status (✓ Submitted /
    //     🎓 Graded / 🔄 Returned) by looking up the matching
    //     writingSubmissions doc. The word count was meaningless
    //     here — what the teacher actually wants to see is
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
    } else if (typeof session.percentage === 'number' && Number.isFinite(session.percentage)) {
      scoreLabel = `${session.percentage}%`;
    } else {
      scoreLabel = '-';
    }

    // Student name — prefer the canonical name from the users doc
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
    const gd = Array.isArray(session.grammarDetails) ? session.grammarDetails : null;
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
              ${escapeHtml(displayName)} <span style="opacity: 0.7;">${bookIcon}</span>${breachFlag}
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
  
  // 2. Average score below 50%
  const lowScoreStudents = allStudents.filter(s => {
    const sessions = allSessions.filter(sess => sess.userId === s.id);
    if (sessions.length === 0) return false;
    const avg = sessions.reduce((sum, sess) => sum + (sess.percentage || 0), 0) / sessions.length;
    return avg < 50;
  });
  
  if (lowScoreStudents.length > 0) {
    totalAlerts += lowScoreStudents.length;
    document.getElementById('lowScoreCard').style.display = 'block';
    document.getElementById('lowScoreList').innerHTML = lowScoreStudents
      .map(s => {
        const initials = getInitials(s.name || s.email);
        const sessions = allSessions.filter(sess => sess.userId === s.id);
        const avg = sessions.length > 0
          ? Math.round(sessions.reduce((sum, sess) => sum + (sess.percentage || 0), 0) / sessions.length)
          : 0;
        return `
          <div class="alert-student-item">
            <div class="alert-student-info">
              <div class="alert-student-avatar">${initials}</div>
              <div>
                <div class="alert-student-name">${escapeHtml(s.name) || escapeHtml(s.email)}</div>
                <div class="alert-student-class">${sessions.length} sessions</div>
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
  
  // Update alert summary cards in Overview
  const summaryGrid = document.getElementById('alertSummaryGrid');
  if (summaryGrid) {
    if (totalAlerts > 0) {
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
        if (el) el.style.borderColor = count > 0 ? 'rgba(245,158,11,0.5)' : '';
      };
      setWarning('alertCardInactive', inactiveStudents.length);
      setWarning('alertCardLowScore', lowScoreStudents.length);
      setWarning('alertCardNoSessions', noSessionStudents.length);
      setWarning('alertCardTotal', totalAlerts);
    } else {
      summaryGrid.style.display = 'none';
    }
  }

  // Show/hide empty state
  document.getElementById('noAlertsMessage').style.display = totalAlerts === 0 ? 'block' : 'none';
}
