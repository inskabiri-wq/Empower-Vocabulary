/* Student Dashboard - Assignments Display */

// ============================================
// GLOBAL STATE
// ============================================
let myAssignments = [];
let myCompletions = {}; // Store completion status by assignment ID
// Phase E: writing submissions this student has made, keyed by assignmentId.
// Populated alongside myCompletions so writing cards can surface the
// teacher's score + comment without an extra round-trip when the student
// taps "View feedback".
let myWritingSubmissions = {};

// Class-code normalizer. The same helper exists in the teacher-side
// files (teacher-assignments.js, modals.js, students.js) — keep them
// in sync. Used everywhere we compare or save a class code so casing
// and whitespace differences ("b100" vs "B100 " vs "B100") never
// hide an assignment from a student.
const normClass = (s) => String(s || '').trim().toUpperCase();
// Crystal-UI filter state ('all' | 'pending' | 'done'). Lives on window so
// the inline tab onclick handlers can mutate it without import shenanigans.
let assignmentsFilter = 'all';
// Phase 4: skill-based filter ('all' | 'vocabulary' | 'reading' | 'listening' | 'writing' | ...)
let assignmentsSkillFilter = 'all';

// Hex → rgba helper (used to build translucent backgrounds from the
// SKILL_REGISTRY accent colours on student-side skill pills + badges).
function _skillRgb(hex) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(String(hex || ''));
  if (!m) return '255,255,255';
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

// ─── Phase E: "new feedback" tracking ───────────────────────────
// localStorage map: { [assignmentId]: lastSeenStatus }. When the
// teacher flips a submission to 'graded' or 'returned', the student's
// stored value falls behind and the card lights up with a pulse +
// "NEW" sticker. Marked seen the moment the student opens the
// feedback modal (viewing == acknowledged).
function _seenFeedbackMap() {
  try { return JSON.parse(localStorage.getItem('writingFeedbackSeen') || '{}'); }
  catch (_) { return {}; }
}
function _markFeedbackSeen(assignmentId, status) {
  try {
    const m = _seenFeedbackMap();
    m[assignmentId] = status;
    localStorage.setItem('writingFeedbackSeen', JSON.stringify(m));
  } catch (_) { /* private mode / quota — silent */ }
}
function _isFeedbackUnseen(assignmentId, status) {
  return _seenFeedbackMap()[assignmentId] !== status;
}

// Inject the pulse keyframes + badge glow once. Idempotent — guarded
// by a <style> element id so repeat renders don't pile up <style>s.
(function _injectFeedbackPulseCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('writing-feedback-pulse-css')) return;
  const css = document.createElement('style');
  css.id = 'writing-feedback-pulse-css';
  css.textContent = `
    @keyframes writingFeedbackPulse {
      0%, 100% { transform: scale(1);   box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
      50%      { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
    }
    .writing-feedback-new-sticker {
      display: inline-flex; align-items: center;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white; font-size: 0.62em; font-weight: 800;
      padding: 3px 7px; border-radius: 999px;
      letter-spacing: 0.06em;
      animation: writingFeedbackPulse 1.6s ease-in-out infinite;
    }
    @keyframes assignmentBadgeGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.65); }
      50%      { box-shadow: 0 0 0 7px rgba(168, 85, 247, 0); }
    }
    #assignmentBadge.has-new-feedback {
      animation: assignmentBadgeGlow 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(css);
})();

// ============================================
// LOAD MY ASSIGNMENTS
// ============================================
async function loadMyAssignments() {
  // NOTE: We no longer early-return on a missing #assignmentsContainer.
  // That element used to live in the vocabulary sidebar but the hub now
  // owns the assignments view. The fetch must always run so the hub can
  // read `myAssignments` — rendering into the legacy container is just
  // an optional output (renderMyAssignments() handles its own absence).
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    // Get current user data to know their class / level / module
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    // Normalize once — every comparison below uses the normalized form.
    const myClass  = normClass(userData?.studentClass);
    // Coerce to string before .trim() — legacy user docs may store
    // these as numbers / null / undefined, which would break .trim().
    const myLevel  = String(userData?.level  || '').trim();
    const myModule = String(userData?.module || '').trim();

    // Query ONLY the assignments that target this student — one narrow
    // query per scope (class / level / module / individual), run in
    // parallel and merged. This avoids downloading EVERY assignment in the
    // school just to filter in the browser: it was O(all active assignments)
    // per student, now O(this student's assignments). targetClass/level/
    // module are stored normalized at creation (_normCls = trim+UPPER, same
    // as normClass), so equality on the normalized value matches exactly.
    // Only equality + array-contains filters are used (no orderBy), so these
    // run on Firestore's automatic single-field indexes — no composite index
    // needed. The 30-day deadline window + sort are applied client-side,
    // cheap now that each query returns only a few docs.
    const assignCol = db.collection('assignments');
    const scopeQueries = [];
    if (myClass)  scopeQueries.push(assignCol.where('targetType', '==', 'class') .where('targetClass',  '==', myClass));
    if (myLevel)  scopeQueries.push(assignCol.where('targetType', '==', 'level') .where('targetLevel',  '==', myLevel));
    if (myModule) scopeQueries.push(assignCol.where('targetType', '==', 'module').where('targetModule', '==', myModule));
    scopeQueries.push(assignCol.where('targetStudents', 'array-contains', user.uid)); // individual

    const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000; // last 30 days + future
    const deadlineMs = (a) => a.deadline?.toDate ? a.deadline.toDate().getTime()
                            : (a.deadline ? new Date(a.deadline).getTime() : null);

    // Run scope queries in parallel; one failing query (e.g. a transient
    // error) must not take down the others — its scope just yields nothing.
    const scopeSnaps = await Promise.all(
      scopeQueries.map(q => q.get().catch(err => {
        console.warn('[assignments] scope query failed:', (err && err.message) || err);
        return { forEach: () => {} };
      }))
    );

    const seenById = {};
    scopeSnaps.forEach(snap => snap.forEach(doc => {
      if (!seenById[doc.id]) seenById[doc.id] = { id: doc.id, ...doc.data() };
    }));

    // Safety net: re-apply the ORIGINAL match logic so behaviour is identical
    // to before (the queries already pre-filter, so this just passes them
    // through and guards against any stray doc), drop anything outside the
    // 30-day deadline window (matches the old server `deadline >=` filter,
    // which also excluded docs with no deadline), then sort deadline-asc.
    myAssignments = Object.values(seenById)
      .filter(assignment => {
        const isForMyClass   = assignment.targetType === 'class'      && normClass(assignment.targetClass) === myClass;
        const isForMyLevel   = assignment.targetType === 'level'      && (assignment.targetLevel  || '').trim() === myLevel;
        const isForMyModule  = assignment.targetType === 'module'     && (assignment.targetModule || '').trim() === myModule;
        const isForMe        = assignment.targetType === 'individual' && assignment.targetStudents?.includes(user.uid);
        if (!(isForMyClass || isForMyLevel || isForMyModule || isForMe)) return false;
        const dms = deadlineMs(assignment);
        return dms !== null && dms >= cutoffMs;
      })
      .sort((a, b) => (deadlineMs(a) || 0) - (deadlineMs(b) || 0));

    // Lightweight diagnostic (no extra reads): nothing matched but the
    // student has a scope set → usually a class-code mismatch.
    if (myAssignments.length === 0 && (myClass || myLevel || myModule)) {
      console.warn(
        `[assignments] No assignments matched your class "${myClass}" / level "${myLevel}" / module "${myModule}". ` +
        `If you expected some, ask your teacher to confirm your class code matches the assignment's target.`
      );
    }
    
    // Load my completion records
    myCompletions = {};
    if (myAssignments.length > 0) {
      try {
        const completionSnap = await db.collection('assignmentCompletions')
          .where('odUserId', '==', user.uid)
          .get();
        
        completionSnap.forEach(doc => {
          const data = doc.data();
          myCompletions[data.assignmentId] = {
            completed: data.completed || false,
            attempts: data.attempts || 0,
            bestScore: data.bestScore || 0
          };
        });
        console.log('Loaded completion records:', myCompletions);
      } catch (e) {
        console.log('No completion records or error loading:', e);
      }
      
      // Also load the student's sessions from Firebase — ONLY as a fallback
      // for assignments that have NO explicit completion record. The matcher
      // (checkMyAssignmentStatus) returns from myCompletions[id] FIRST and
      // never consults allSessions when a record exists, so when every
      // assignment is already tracked in /assignmentCompletions this 100-doc
      // read is pure waste. Skipping it then is behaviour-neutral; the instant
      // any assignment needs session-matching (reading/listening exams, or a
      // vocab assignment whose completion doc is missing) we load it unchanged.
      const _needsSessionFallback = myAssignments.some(a => !myCompletions[a.id]);
      try {
        const sessionsSnap = _needsSessionFallback
          ? await db.collection('sessions')
              .where('userId', '==', user.uid)
              .orderBy('createdAt', 'desc')
              .limit(100)
              .get()
          : { forEach: () => {} };

        // Store in global for checkMyAssignmentStatus to use
        if (typeof allSessions === 'undefined') {
          window.allSessions = [];
        }
        allSessions = [];
        sessionsSnap.forEach(doc => {
          allSessions.push({ id: doc.id, ...doc.data() });
        });
        console.log('Loaded user sessions for assignment checking:', allSessions.length);
      } catch (e) {
        console.log('Error loading sessions:', e);
      }

      // Phase E: load this student's writing submissions so we can show
      // teacher feedback (score + comment) on graded writing cards.
      //
      // IMPORTANT: we fetch by exact doc id ({uid}_{aid}) rather than a
      // .where('userId','==',uid) query. The firestore rule for
      // writingSubmissions reads:
      //
      //   allow read: if isAuth() && (
      //     submissionId.matches(request.auth.uid + '_.*') ||
      //     isAdmin() || teacherHasScope()
      //   );
      //
      // The id-prefix branch is the only one a regular student passes,
      // and Firestore's static query validator can't prove a where()
      // filter narrows to ids matching that pattern — so the broader
      // query is rejected with "insufficient permissions". Per-doc
      // gets sidestep that entirely (and only fetch what we actually
      // need: submissions for the writing assignments the student
      // currently sees).
      myWritingSubmissions = {};
      try {
        const writingAids = myAssignments
          .filter(x => {
            const sk = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.skillOf(x) : (x.skill || 'vocabulary');
            return sk === 'writing';
          })
          .map(x => x.id);

        // Parallel — N is small (only writing assignments currently
        // visible to this student). Per-doc failures are silent so a
        // single missing/forbidden doc doesn't take down the rest.
        await Promise.all(writingAids.map(async (aid) => {
          try {
            const docRef = db.collection('writingSubmissions').doc(`${user.uid}_${aid}`);
            const doc = await docRef.get();
            if (doc.exists) {
              myWritingSubmissions[aid] = { id: doc.id, ...doc.data() };
            }
          } catch (_) { /* swallow — that assignment just won't show feedback */ }
        }));
        console.log('Loaded writing submissions:', Object.keys(myWritingSubmissions).length);
      } catch (e) {
        console.log('Error loading writing submissions:', e);
      }

      // BUG-FIX DERIVATION — historically writing-exam.js wrote
      // `userId` instead of `odUserId` to /assignmentCompletions, so
      // its docs didn't match the `where('odUserId', ==, uid)` query
      // above. Result: a graded writing essay still showed "Start
      // Writing" because status.completed stayed false. We now write
      // both names going forward, but for legacy docs we fix it
      // here: if a writingSubmission exists (canonical store), trust
      // THAT for completion state regardless of what assignmentComp-
      // letions said. A 'submitted' or 'graded' writing is "Done";
      // a 'returned' writing is intentionally NOT done (override
      // happens later, in the per-card decorate step).
      Object.keys(myWritingSubmissions).forEach(aid => {
        const ws = myWritingSubmissions[aid];
        if (!ws) return;
        if (ws.status === 'submitted' || ws.status === 'graded') {
          if (!myCompletions[aid] || !myCompletions[aid].completed) {
            myCompletions[aid] = {
              completed: true,
              attempts:  (myCompletions[aid]?.attempts) || 1,
              bestScore: (ws.score != null) ? Number(ws.score) : 0
            };
          }
        }
      });
    }

    renderMyAssignments();
    dispatchAssignmentsUpdated();

  } catch (error) {
    console.error('Error loading assignments:', error);
    // Surface the error in the UI if the container is on this page.
    // (container is local to renderMyAssignments; we re-fetch it here
    // so the catch block doesn't reference an undeclared variable.)
    const errContainer = document.getElementById('assignmentsContainer');
    if (errContainer) {
      errContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Unable to load assignments</p>';
    }
    // Even on failure, fire the event so the hub knows the load completed
    // (with whatever was previously in `myAssignments`, possibly empty).
    dispatchAssignmentsUpdated();
  }
}

// ============================================
// RENDER MY ASSIGNMENTS  (Crystal UI)
// Layout per the Claude Design "Crystal" handoff:
//   stats-bar  →  filter-tabs  →  section-divider  →  cards
// Status drives the visual: urgent (orange), pending/normal (cyan/blue),
// overdue (muted), completed (green). Progress bar appears when the
// student has started but not finished. The XP/Streak/Rank row from
// the original prototype was removed by the user's drawing edit.
// ============================================
function renderMyAssignments() {
  const container = document.getElementById('assignmentsContainer');
  if (!container) return;

  // Compute counts up front so the stats bar reflects the FULL set,
  // independent of the active filter tab.
  const now = new Date();
  let pendingCount = 0;
  let completedCount = 0;
  // Phase E: any writing feedback the student hasn't yet acknowledged
  // glows the hub badge so they don't miss it on a quiet page.
  let hasUnseenFeedback = false;
  Object.keys(myWritingSubmissions || {}).forEach(aid => {
    const ws = myWritingSubmissions[aid];
    if (!ws) return;
    if ((ws.status === 'graded' || ws.status === 'returned') && _isFeedbackUnseen(aid, ws.status)) {
      hasUnseenFeedback = true;
    }
  });

  // Decorate each assignment with computed view-model fields once,
  // so we can sort/filter/render without re-running the same maths.
  const decorated = myAssignments.map(a => {
    const deadline = a.deadline?.toDate ? a.deadline.toDate() : new Date(a.deadline);
    const daysLeft = Math.ceil((deadline - now) / 86400000);
    const isOverdue = daysLeft < 0;
    const status = checkMyAssignmentStatus(a);

    // Phase F.4 — when a writing submission has been RETURNED, the
    // student has more work to do. assignmentCompletions still says
    // completed:true (set at submit), but the UX must treat it as
    // pending: don't sink it to the bottom, don't show ✓ Done, do
    // show the revise CTA. Override locally.
    const _isWritingSkill = (typeof SKILL_REGISTRY !== 'undefined')
      ? SKILL_REGISTRY.skillOf(a) === 'writing'
      : (a.skill || '') === 'writing';
    if (_isWritingSkill && myWritingSubmissions[a.id]?.status === 'returned') {
      status.completed = false;
    }

    if (status.completed)         completedCount++;
    else if (!isOverdue)          pendingCount++;
    return { a, deadline, daysLeft, isOverdue, status };
  });

  // Sort:
  //   1. Incomplete first (completed assignments sink to the bottom).
  //   2. Within each group: most-recently-CREATED assignment first.
  //      Students see whatever the teacher just assigned at the top
  //      of their list, so it's hard to miss. Deadline acts as the
  //      tiebreaker for assignments created at the same moment.
  decorated.sort((x, y) => {
    if (x.status.completed !== y.status.completed) {
      return x.status.completed ? 1 : -1;
    }
    const ca = x.a.createdAt?.toDate ? x.a.createdAt.toDate() : new Date(x.a.createdAt || 0);
    const cb = y.a.createdAt?.toDate ? y.a.createdAt.toDate() : new Date(y.a.createdAt || 0);
    if (cb.getTime() !== ca.getTime()) return cb.getTime() - ca.getTime();   // newest first
    return x.deadline - y.deadline;                                          // tiebreaker
  });

  // Apply the active status filter (pending/done) AND the skill filter.
  const filtered = decorated.filter(({ a, status, isOverdue }) => {
    if (assignmentsFilter === 'pending' && status.completed) return false;
    if (assignmentsFilter === 'done'    && !status.completed) return false;
    if (assignmentsSkillFilter !== 'all') {
      const sk = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.skillOf(a) : (a.skill || 'vocabulary');
      if (sk !== assignmentsSkillFilter) return false;
    }
    return true;
  });

  // ---- Build the chrome ----
  const statsBar = `
    <div class="assignments-summary">
      <span class="summary-total">${myAssignments.length} ${myAssignments.length === 1 ? 'assignment' : 'assignments'}</span>
      <span class="summary-divider"></span>
      <span class="summary-pending">${pendingCount} pending</span>
      <span class="summary-divider"></span>
      <span class="summary-done">${completedCount} done</span>
    </div>
  `;

  const filterTabs = `
    <div class="assignments-filters" role="tablist">
      ${[
        { id: 'all',     label: 'All' },
        { id: 'pending', label: '⏳ Pending' },
        { id: 'done',    label: '✓ Completed' }
      ].map(t => `
        <button type="button"
                class="assignment-filter-tab ${assignmentsFilter === t.id ? 'active' : ''}"
                role="tab"
                aria-selected="${assignmentsFilter === t.id}"
                onclick="setAssignmentsFilter('${t.id}')">${t.label}</button>
      `).join('')}
    </div>
  `;

  // ---- Skill filter pills (Phase 4) ----
  // Mirrors the teacher dashboard's skill filter. Built from SKILL_REGISTRY
  // so the same single source-of-truth drives both sides.
  const skillPills = (typeof SKILL_REGISTRY !== 'undefined') ? (function () {
    const pills = [{ id: 'all', icon: '', name: 'All Skills', accent: '#64748b' }]
      .concat(SKILL_REGISTRY.all().map(s => ({ id: s.id, icon: s.icon, name: s.name, accent: s.accent, status: s.status })));
    return `
      <div class="assignments-skill-filters" role="tablist" aria-label="Filter assignments by skill"
           style="display:flex; flex-wrap:wrap; gap:5px; margin: 4px 0 12px 0;">
        ${pills.map(p => {
          const active = assignmentsSkillFilter === p.id;
          const dim = (p.status === 'coming-soon') ? 'opacity: 0.55;' : '';
          const bg  = active ? `rgba(${_skillRgb(p.accent)}, 0.22)` : 'rgba(255,255,255,0.04)';
          const fg  = active ? p.accent : 'var(--text-secondary, #94a3b8)';
          const bd  = active ? p.accent : 'rgba(255,255,255,0.10)';
          return `
            <button type="button" role="tab" aria-selected="${active}"
                    onclick="setAssignmentsSkillFilter('${p.id}')"
                    style="background:${bg}; color:${fg}; border:1px solid ${bd}; padding:4px 9px; border-radius:999px; font-size:0.72em; font-weight:600; cursor:pointer; white-space:nowrap; ${dim}">
              ${p.icon ? p.icon + ' ' : ''}${p.name}
            </button>
          `;
        }).join('')}
      </div>
    `;
  })() : '';

  const sectionLabel = assignmentsFilter === 'done'
    ? 'Completed'
    : assignmentsFilter === 'pending' ? 'In Progress' : 'All Assignments';
  const sectionDivider = `
    <div class="assignments-section-divider">
      <span>${sectionLabel}</span>
      <div class="divider-line"></div>
    </div>
  `;

  // ---- Empty states ----
  if (myAssignments.length === 0) {
    container.innerHTML = `
      <div class="no-assignments">
        <span class="no-assignments-icon">✨</span>
        <span class="no-assignments-text">No assignments right now!</span>
      </div>
    `;
    updateAssignmentBadge(0);
    return;
  }
  if (filtered.length === 0) {
    // Build a context-aware empty message. If a skill pill is active,
    // explain why this list is empty (so it doesn't look broken).
    const skillName = (assignmentsSkillFilter !== 'all' && typeof SKILL_REGISTRY !== 'undefined')
      ? (SKILL_REGISTRY.get(assignmentsSkillFilter)?.name || '')
      : '';
    let emptyMsg;
    let emptyIcon;
    if (assignmentsSkillFilter !== 'all') {
      emptyIcon = (typeof SKILL_REGISTRY !== 'undefined' && SKILL_REGISTRY.get(assignmentsSkillFilter)?.icon) || '✨';
      emptyMsg  = `No ${skillName} assignments${assignmentsFilter === 'done' ? ' completed yet' : assignmentsFilter === 'pending' ? ' pending' : ''}.`;
    } else if (assignmentsFilter === 'done') {
      emptyIcon = '🎯';
      emptyMsg  = 'Nothing finished yet — start with a Pending one!';
    } else {
      emptyIcon = '✨';
      emptyMsg  = 'No assignments here yet ✨';
    }
    // Include the skillPills row so the user can still switch skills
    // from the empty state. Previously omitting it made the pills
    // appear to "disappear" after clicking Reading/Listening.
    container.innerHTML = statsBar + skillPills + filterTabs + sectionDivider + `
      <div class="no-assignments">
        <span class="no-assignments-icon">${emptyIcon}</span>
        <span class="no-assignments-text">${emptyMsg}</span>
      </div>
    `;
    updateAssignmentBadge(pendingCount, hasUnseenFeedback);
    return;
  }

  // ---- Activity / book lookups ----
  const activityNames = {
    'all': 'Any Activity',
    'choice': 'Multiple Choice',
    'fillblank': 'Fill in Blank',
    'match': 'Match',
    'spelling': 'Spelling',
    'reverse': 'Listening Mode',
    'order': 'Word Order',
    'pronunciation': 'Pronunciation',
    'unscramble': 'Unscramble'
  };
  const bookIconFor = b => b === 'gateway' ? '📗' : '📘';

  // Status → visual mapping. Each entry returns the bits we need to
  // colour the card: a class on the wrapper, an emoji for the status
  // icon, the wash inside that icon's tinted square, the left-accent
  // gradient, the deadline-pill class, and the CTA button class+label.
  // CTA labels are skill-aware via the `a` (assignment) param so the
  // writing button says "Start Writing" not "Start Practice".
  function visualForState({ status, daysLeft, isOverdue, a }) {
    const sk = (typeof SKILL_REGISTRY !== 'undefined' && a)
      ? SKILL_REGISTRY.skillOf(a)
      : (a && a.skill) || 'vocabulary';
    const labels = {
      completed: { vocabulary: '📋 Review',         writing: '📖 View Submission', reading: '📋 Review', listening: '📋 Review' },
      returned:  { writing: '🔄 Revise & Resubmit' },
      overdue:   { vocabulary: '🔄 Try Again',      writing: '✍️ Start Writing',    reading: '🔄 Try Again', listening: '🔄 Try Again' },
      urgent:    { vocabulary: '🚀 Start Now',      writing: '✍️ Start Writing',    reading: '🚀 Start Now', listening: '🚀 Start Now' },
      pending:   { vocabulary: '▶ Start Practice', writing: '✍️ Start Writing',    reading: '▶ Start Reading', listening: '▶ Start Listening' }
    };
    const pickLabel = (state) => (labels[state] && labels[state][sk]) || (labels[state] && labels[state].vocabulary) || '';

    if (status.completed) return {
      wrap: 'completed',
      icon: '✅',
      iconBg: 'oklch(35% 0.18 155 / 0.25)',
      iconBorder: 'oklch(55% 0.20 155 / 0.4)',
      accent: 'linear-gradient(180deg, oklch(72% 0.19 155), oklch(55% 0.22 150))',
      deadlineCls: 'done',
      btnCls: 'completed',
      btnLabel: pickLabel('completed')
    };

    // Phase G fix #2 — writing returned-for-revision deserves its OWN
    // visual state. Without this branch the card would fall through to
    // the generic "pending" visual (⏳ icon, "Not started" tone), which
    // is wrong: the student HAS done work, the teacher just sent it
    // back. Use amber so the card screams "your turn again" — matches
    // the gradeBlock banner colour set elsewhere on the card.
    // Ordered before isOverdue so a returned-and-past-due card still
    // surfaces the revision call-to-action; the deadline pill below
    // separately conveys urgency.
    const wsubState = (sk === 'writing' && typeof myWritingSubmissions !== 'undefined')
      ? myWritingSubmissions[a.id]
      : null;
    if (wsubState && wsubState.status === 'returned') return {
      wrap: 'returned',
      icon: '🔄',
      iconBg: 'oklch(35% 0.18 65 / 0.25)',
      iconBorder: 'oklch(60% 0.20 65 / 0.5)',
      accent: 'linear-gradient(180deg, oklch(78% 0.18 75), oklch(62% 0.20 60))',
      deadlineCls: 'urgent',
      btnCls: '',
      btnLabel: pickLabel('returned')
    };

    if (isOverdue) return {
      wrap: 'overdue',
      icon: '⌛',
      iconBg: 'oklch(20% 0.04 240 / 0.5)',
      iconBorder: 'oklch(45% 0.06 240 / 0.5)',
      accent: 'linear-gradient(180deg, oklch(60% 0.05 240), oklch(40% 0.05 240))',
      deadlineCls: 'overdue',
      btnCls: 'overdue',
      btnLabel: pickLabel('overdue')
    };
    if (daysLeft <= 1) return {
      wrap: 'urgent',
      icon: '🔥',
      iconBg: 'oklch(40% 0.22 45 / 0.25)',
      iconBorder: 'oklch(60% 0.22 45 / 0.4)',
      accent: 'linear-gradient(180deg, oklch(72% 0.22 55), oklch(60% 0.24 45))',
      deadlineCls: 'urgent',
      btnCls: 'urgent',
      btnLabel: pickLabel('urgent')
    };
    return {
      wrap: 'pending',
      icon: '⏳',
      iconBg: 'oklch(35% 0.15 200 / 0.25)',
      iconBorder: 'oklch(58% 0.18 200 / 0.4)',
      accent: 'linear-gradient(180deg, oklch(62% 0.22 210), oklch(52% 0.25 200))',
      deadlineCls: 'pending',
      btnCls: '',
      btnLabel: pickLabel('pending')
    };
  }

  function deadlineLabel({ status, daysLeft, isOverdue, a }) {
    if (status.completed) return 'Completed';
    // Phase G fix #2 — call out the returned state explicitly so the
    // student doesn't read this card as "fresh / not started".
    const _sk = (typeof SKILL_REGISTRY !== 'undefined' && a)
      ? SKILL_REGISTRY.skillOf(a)
      : (a && a.skill) || '';
    if (_sk === 'writing' && typeof myWritingSubmissions !== 'undefined'
        && myWritingSubmissions[a?.id]?.status === 'returned') {
      return 'Returned for revision';
    }
    if (isOverdue)        return 'Overdue';
    if (daysLeft === 0)   return 'Due Today!';
    if (daysLeft === 1)   return 'Due Tomorrow!';
    return `${daysLeft} days left`;
  }

  // ---- Build the cards ----
  const cardsHtml = filtered.map(({ a, deadline, daysLeft, isOverdue, status }) => {
    const v = visualForState({ status, daysLeft, isOverdue, a });
    const dateText = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dueText  = deadlineLabel({ status, daysLeft, isOverdue, a });

    // Skill resolves once for this card — needed below to decide
    // between the percentage progress bar (vocabulary) and the
    // writing-specific grade banner (writing skill).
    const _sk = (typeof SKILL_REGISTRY !== 'undefined')
      ? SKILL_REGISTRY.skillOf(a)
      : (a.skill || 'vocabulary');

    // Phase E: for writing assignments, the "100%" progress bar is
    // misleading — submissions aren't a percentage, they're a teacher
    // grade. So for writing we suppress the progress bar entirely and
    // render `gradeBlock` (below) instead.
    const isWriting = (_sk === 'writing');
    const wsub      = isWriting ? (myWritingSubmissions[a.id] || null) : null;

    // Progress bar — show whenever the student has attempted, OR on
    // completed cards (always 100%) to convey closure visually.
    // Skipped for writing (grade banner handles that case below).
    let progressBlock = '';
    const showProgress = !isWriting && (status.completed || (status.attempts > 0));
    if (showProgress) {
      const pct = status.completed ? 100 : (status.bestScore || 0);
      const hint = !status.completed && pct < 100
        ? `<div class="progress-hint">Need ${100 - pct}% more to complete</div>` : '';
      progressBlock = `
        <div class="my-assignment-progress-section">
          <div class="progress-info">
            <span class="progress-label">PROGRESS</span>
            <span class="progress-best">${pct}%</span>
          </div>
          <div class="assignment-progress-bar">
            <div class="assignment-progress-fill"
                 style="width:${pct}%; background:${v.accent}; color:${
                   status.completed ? 'oklch(72% 0.19 155)'
                   : v.wrap === 'urgent' ? 'oklch(72% 0.22 55)'
                   : 'oklch(62% 0.22 210)'
                 };"></div>
          </div>
          ${hint}
        </div>
      `;
    }

    // Grade banner — writing-only. Three visual states:
    //   • Graded / returned  → score chip + "View feedback" button
    //   • Submitted (await)  → muted "Awaiting teacher feedback" pill
    //   • No submission yet  → nothing (regular CTA path applies)
    let gradeBlock = '';
    if (isWriting && wsub) {
      const wstatus = wsub.status || 'submitted';
      if (wstatus === 'returned') {
        // Phase F.4 — distinct UI for "returned for revision". The
        // student needs to know this isn't a final grade, that the
        // teacher wants changes, and what those changes are. Two CTAs:
        // primary "Revise & resubmit" routes back into writing-exam
        // (which auto-pre-loads their previous text); secondary "View
        // feedback" opens the full feedback modal.
        const unseen = _isFeedbackUnseen(a.id, wstatus);
        const newSticker = unseen
          ? `<span class="writing-feedback-new-sticker" aria-label="New feedback">NEW</span>`
          : '';
        // Trim the teacher comment for inline preview; the full text
        // lives in the View feedback modal.
        const commentPreview = wsub.teacherComment
          ? escapeHtml(String(wsub.teacherComment).slice(0, 140) + (String(wsub.teacherComment).length > 140 ? '…' : ''))
          : '';
        gradeBlock = `
          <div class="my-assignment-grade-banner"
               style="display:flex; flex-direction:column; gap:8px;
                      padding:12px 14px; border-radius:10px;
                      background:rgba(245, 158, 11, 0.10);
                      border:1px solid rgba(245, 158, 11, 0.35);
                      border-left:3px solid #f59e0b;
                      margin-top:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:1.4em;">🔄</span>
              <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
                <span style="display:flex; align-items:center; gap:8px;
                             font-size:0.7em; font-weight:700; letter-spacing:0.08em;
                             color:#fcd34d; text-transform:uppercase;">
                  <span>Returned for revision</span>
                  ${newSticker}
                </span>
                <span style="font-size:0.95em; color:#fde68a;">
                  Your teacher wants changes before grading.
                </span>
              </div>
            </div>
            ${commentPreview ? `
              <div style="background: rgba(255,255,255,0.06); border-radius: 6px;
                          padding: 8px 12px; font-size: 0.85em; color: #fef3c7;
                          font-style: italic; line-height: 1.45;">
                "${commentPreview}"
              </div>
            ` : ''}
            <div style="display:flex; gap:8px; flex-wrap: wrap;">
              <button type="button"
                      style="flex:1; background: linear-gradient(135deg, #f59e0b, #d97706);
                             color: white; border: none;
                             padding: 8px 14px; border-radius: 8px;
                             font-size: 0.9em; font-weight: 700; cursor: pointer;
                             min-width: 160px;"
                      onclick="startAssignment('${escapeHtml(a.id)}')">
                🔄 Revise & resubmit
              </button>
              <button type="button"
                      style="background: rgba(255,255,255,0.10);
                             color: #fde68a; border: 1px solid rgba(255,255,255,0.18);
                             padding: 8px 12px; border-radius: 8px;
                             font-size: 0.9em; font-weight: 600; cursor: pointer;"
                      onclick="viewWritingFeedback('${escapeHtml(a.id)}')">
                📝 Full feedback
              </button>
            </div>
          </div>
        `;
      } else if (wstatus === 'graded') {
        const score = (wsub.score != null) ? wsub.score : 0;
        const max   = 20;
        const pct   = Math.max(0, Math.min(100, Math.round((Number(score) / max) * 100)));
        // Colour the grade by tier: ≥80% green, ≥60% blue, else amber.
        const tier  = pct >= 80 ? 'oklch(70% 0.20 150)'
                     : pct >= 60 ? 'oklch(65% 0.18 210)'
                     : 'oklch(72% 0.20 60)';
        // "NEW" pulse: shown when this student hasn't yet opened the
        // feedback modal for this particular status. Marked seen the
        // moment they click View feedback (handled in viewWritingFeedback).
        const unseen = _isFeedbackUnseen(a.id, wstatus);
        const newSticker = unseen
          ? `<span class="writing-feedback-new-sticker" aria-label="New feedback">NEW</span>`
          : '';
        gradeBlock = `
          <div class="my-assignment-grade-banner"
               style="display:flex; align-items:center; gap:10px;
                      padding:10px 12px; border-radius:10px;
                      background:rgba(${_skillRgb('#a855f7')}, 0.12);
                      border:1px solid rgba(${_skillRgb('#a855f7')}, 0.32);
                      margin-top:8px;">
            <span style="font-size:1.4em;">🏆</span>
            <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
              <span style="display:flex; align-items:center; gap:8px;
                           font-size:0.7em; font-weight:700; letter-spacing:0.08em;
                           color:var(--text-muted, #94a3b8); text-transform:uppercase;">
                <span>Teacher's Grade</span>
                ${newSticker}
              </span>
              <span style="font-size:1.25em; font-weight:800; color:${tier};">
                ${score} / ${max}
              </span>
            </div>
            <button type="button"
                    class="assignment-start-btn"
                    style="background:rgba(${_skillRgb('#a855f7')}, 0.25);
                           color:#e9d5ff; border:1px solid rgba(${_skillRgb('#a855f7')}, 0.45);
                           padding:6px 12px; border-radius:8px; font-size:0.85em;
                           font-weight:600; cursor:pointer;"
                    onclick="viewWritingFeedback('${escapeHtml(a.id)}')">
              📝 View feedback
            </button>
          </div>
        `;
      } else if (wstatus === 'submitted') {
        gradeBlock = `
          <div class="my-assignment-grade-banner"
               style="display:flex; align-items:center; gap:8px;
                      padding:8px 12px; border-radius:10px;
                      background:rgba(255,255,255,0.04);
                      border:1px dashed rgba(255,255,255,0.18);
                      margin-top:8px;
                      color:var(--text-secondary, #94a3b8);
                      font-size:0.88em;">
            <span>⏳</span>
            <span>Submitted — awaiting teacher feedback.</span>
            <button type="button"
                    style="margin-left:auto; background:transparent;
                           color:#a78bfa; border:none; padding:4px 8px;
                           font-size:0.85em; font-weight:600; cursor:pointer;"
                    onclick="viewWritingFeedback('${escapeHtml(a.id)}')">
              📖 View my response
            </button>
          </div>
        `;
      }
    }

    // Skill-aware completion hint. Vocabulary auto-completes at 100%;
    // writing/reading/listening are teacher-graded or just need a
    // submission to count. (_sk already resolved above.)
    const goalText = (function () {
      if (_sk === 'writing')   return 'Submit your response to complete';
      if (_sk === 'reading')   return 'Finish the reading exam to complete';
      if (_sk === 'listening') return 'Finish the listening exam to complete';
      return 'Score 100% to complete';
    })();

    // Goal row — for completed cards, show a ✓ Done marker on the right.
    const goalRow = `
      <div class="my-assignment-requirement">
        <span class="goal-icon">🎯</span>
        <span>${goalText}</span>
        ${status.completed ? '<span style="margin-left:auto;color:var(--crystal-green);font-weight:700;font-size:12px;">✓ Done</span>' : ''}
      </div>
    `;

    return `
      <div class="my-assignment-card ${v.wrap} asg-acc asg-collapsed">
        <span class="card-accent" style="background:${v.accent};"></span>

        <div class="my-assignment-header" onclick="toggleAsgCard(this)" role="button" tabindex="0" aria-expanded="false">
          <span class="my-assignment-status-icon"
                style="background:${v.iconBg};border:1px solid ${v.iconBorder};">${v.icon}</span>
          <div class="my-assignment-info">
            <h4 class="my-assignment-title">${escapeHtml(a.title || 'Assignment')}</h4>
            ${(function () {
              // Skill-aware meta line. Each skill shows the fields that
              // make sense for it; vocabulary keeps the original line.
              const sk = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.skillOf(a) : (a.skill || 'vocabulary');
              const skillMeta = (typeof SKILL_REGISTRY !== 'undefined') ? SKILL_REGISTRY.get(sk) : null;
              const skillChip = skillMeta
                ? `<span class="level-chip" style="background:rgba(${_skillRgb(skillMeta.accent)},0.18); color:${skillMeta.accent}; border:1px solid rgba(${_skillRgb(skillMeta.accent)},0.35);">${skillMeta.icon} ${skillMeta.name}</span>`
                : '';
              if (sk === 'writing') {
                const qtype = (a.questionType || 'custom').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const time  = (a.timeLimit != null) ? `⏱ ${a.timeLimit} min` : '';
                const lvl   = (a.level || a.difficulty) ? `📊 ${a.level || a.difficulty}` : '';
                return `
                  <div class="my-assignment-meta">
                    ${skillChip}
                    <span class="meta-dot">•</span>
                    <span>${escapeHtml(qtype)}</span>
                    ${time ? '<span class="meta-dot">•</span><span>' + time + '</span>' : ''}
                    ${lvl  ? '<span class="meta-dot">•</span><span>' + lvl  + '</span>' : ''}
                  </div>`;
              }
              if (sk === 'reading' || sk === 'listening') {
                const examTitle = escapeHtml(a.examTitle || a.examId || 'Exam');
                const examLvl   = a.examLevel ? `📊 ${escapeHtml(a.examLevel)}` : '';
                return `
                  <div class="my-assignment-meta">
                    ${skillChip}
                    <span class="meta-dot">•</span>
                    <span>📝 ${examTitle}</span>
                    ${examLvl ? '<span class="meta-dot">•</span><span>' + examLvl + '</span>' : ''}
                  </div>`;
              }
              // Vocabulary / legacy / future skills — keep the original line.
              return `
                <div class="my-assignment-meta">
                  ${skillChip}
                  <span class="meta-dot">•</span>
                  <span class="level-chip">${escapeHtml(a.level || '')}</span>
                  <span class="meta-dot">•</span>
                  <span>${bookIconFor(a.book)} ${escapeHtml(a.unit || 'All Units')}</span>
                  <span class="meta-dot">•</span>
                  <span>${escapeHtml(activityNames[a.activity] || 'Any Activity')}</span>
                </div>`;
            })()}
          </div>
          <span class="my-assignment-check" aria-hidden="true">${status.completed ? '✓' : ''}</span>
          <span class="asg-acc-chevron" aria-hidden="true">▾</span>
        </div>

        <div class="my-assignment-body">
          <div class="my-assignment-deadline">
            <span class="deadline-icon">📅</span>
            <span class="deadline-date">${dateText}</span>
            <span class="deadline-status ${v.deadlineCls}">${dueText}</span>
          </div>

          <div class="asg-acc-detail">
          ${progressBlock}

          ${gradeBlock}

          ${goalRow}

          ${(function () {
            // Bottom CTA strip — three mutually-exclusive states:
            //
            //   1. Completed → "View results" for vocab/reading/listening
            //      so the student can revisit their score without
            //      relaunching the task. Writing intentionally shows
            //      nothing here: the gradeBlock above already carries
            //      "View feedback" / "View my response" / "Revise &
            //      resubmit", so a second button would be a duplicate
            //      (this was the bug the teacher flagged).
            //
            //   2. Returned writing → footer suppressed; the gradeBlock
            //      itself owns the call-to-action.
            //
            //   3. Overdue → no clickable affordance. Per teacher
            //      direction, "Try again" was misleading; the student
            //      should reach out for an extension instead.
            //
            //   4. Default → the v.btnLabel CTA (Start / Resume / etc).
            if (status.completed) {
              if (isWriting) return ''; // writing has its own gradeBlock
              return `
                <div class="my-assignment-footer">
                  <button type="button"
                          class="assignment-start-btn completed"
                          onclick="startAssignment('${escapeHtml(a.id)}')">
                    📊 View results
                  </button>
                </div>`;
            }
            if (isWriting && wsub?.status === 'returned') return '';
            if (isOverdue) {
              return `
                <div class="my-assignment-footer">
                  <div class="assignment-overdue-notice"
                       role="status"
                       style="width:100%; box-sizing:border-box;
                              text-align:center;
                              padding:12px 14px; border-radius:10px;
                              background:rgba(125, 133, 144, 0.10);
                              border:1px dashed rgba(125, 133, 144, 0.35);
                              color:var(--text-secondary, #94a3b8);
                              font-size:0.92em; font-weight:600;
                              line-height:1.4;">
                    📩 Contact your teacher
                  </div>
                </div>`;
            }
            return `
              <div class="my-assignment-footer">
                <button type="button"
                        class="assignment-start-btn ${v.btnCls}"
                        onclick="startAssignment('${escapeHtml(a.id)}')">
                  ${v.btnLabel}
                </button>
              </div>`;
          })()}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = statsBar + skillPills + filterTabs + sectionDivider + cardsHtml;
  updateAssignmentBadge(pendingCount);
}

// Assignment-card accordion — clicking a card's header collapses/expands its
// detail (progress + grade + goal + CTA). The header + deadline row stay
// visible so the student still sees title / status / due-date at a glance.
// Pure display toggle — no Firestore reads.
function toggleAsgCard(headerEl) {
  const card = headerEl && headerEl.closest('.my-assignment-card');
  if (!card) return;
  const collapsed = card.classList.toggle('asg-collapsed');
  headerEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}
window.toggleAsgCard = toggleAsgCard;

// Skill filter setter — exposed on window because the rendered pills
// use inline onclick (matches the existing setAssignmentsFilter pattern).
function setAssignmentsSkillFilter(skillId) {
  assignmentsSkillFilter = skillId || 'all';
  renderMyAssignments();
}
window.setAssignmentsSkillFilter = setAssignmentsSkillFilter;

// Filter-tab handler — exposed on window because the rendered tabs use
// inline onclick (kept inline for simplicity vs. delegated listener).
function setAssignmentsFilter(filter) {
  if (filter !== 'all' && filter !== 'pending' && filter !== 'done') return;
  if (assignmentsFilter === filter) return;
  assignmentsFilter = filter;
  renderMyAssignments();
}
window.setAssignmentsFilter = setAssignmentsFilter;

// Single source of truth for "assignments are now loaded": fires from
// loadMyAssignments() once Firestore returns. Keeping the dispatch here
// (not in renderMyAssignments) means the hub still receives the signal
// even on pages that don't host the legacy #assignmentsContainer sidebar.
function dispatchAssignmentsUpdated() {
  try {
    window.assignmentsLoaded = true;
    window.dispatchEvent(new CustomEvent('assignments:updated', {
      detail: { count: Array.isArray(myAssignments) ? myAssignments.length : 0 }
    }));
  } catch (_) { /* older browsers — harmless */ }
}

// ============================================
// CHECK MY ASSIGNMENT STATUS
// ============================================
async function checkMyAssignmentStatusAsync(assignment) {
  const user = auth.currentUser;
  if (!user) return { completed: false, attempts: 0, bestScore: 0 };
  
  // First, check if there's an explicit completion record in Firebase
  try {
    const completionDoc = await db.collection('assignmentCompletions')
      .doc(`${user.uid}_${assignment.id}`)
      .get();
    
    if (completionDoc.exists) {
      const data = completionDoc.data();
      return {
        completed: data.completed || false,
        attempts: data.attempts || 0,
        bestScore: data.bestScore || 0
      };
    }
  } catch (e) {
    console.log('No completion record found, checking progress...');
  }
  
  // Fallback to progress-based checking
  return checkMyAssignmentStatus(assignment);
}

function checkMyAssignmentStatus(assignment) {
  const user = auth.currentUser;
  if (!user) return { completed: false, attempts: 0, bestScore: 0 };
  
  // First, check if we have a completion record loaded from Firebase
  if (typeof myCompletions !== 'undefined' && myCompletions[assignment.id]) {
    console.log('Found completion record for:', assignment.title, myCompletions[assignment.id]);
    return myCompletions[assignment.id];
  }
  
  const assignmentCreatedAt = assignment.createdAt?.toDate ? assignment.createdAt.toDate() : new Date(assignment.createdAt || 0);

  // ── Reading / Listening exam assignments ──────────────────
  // The solo exam runners write a /sessions doc (no completion doc),
  // so we session-match on the exam the assignment targets. Mirrors
  // the teacher-side rule in calculateAssignmentCompletion exactly so
  // both views agree. Attempting the assigned exam = completed.
  const _sk = (typeof SKILL_REGISTRY !== 'undefined')
    ? SKILL_REGISTRY.skillOf(assignment)
    : (assignment.skill || 'vocabulary');
  if (_sk === 'reading' || _sk === 'listening') {
    const examActivity = _sk === 'reading' ? 'reading-exam' : 'listening-exam';
    const aExamId = assignment.examId || assignment.unit || '';
    // Pool every session source the student side might have (same set
    // the vocab matcher reads below), so we find the exam attempt
    // wherever it landed — Firestore allSessions, in-memory myProgress,
    // or the localStorage fallbacks.
    const pool = [];
    if (typeof allSessions !== 'undefined' && Array.isArray(allSessions)) pool.push(...allSessions);
    if (typeof myProgress  !== 'undefined' && Array.isArray(myProgress))  pool.push(...myProgress);
    try {
      const lh = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
      if (Array.isArray(lh)) pool.push(...lh);
    } catch (_) {}
    try {
      const js = JSON.parse(localStorage.getItem('journeyStats') || '{}');
      if (js && Array.isArray(js.sessions)) pool.push(...js.sessions);
    } catch (_) {}

    let best = 0, hits = 0;
    pool.forEach(sess => {
      // localStorage copies may omit userId — those are this student's
      // own history by definition, so only enforce the userId check
      // when the field is present.
      if (sess.userId && sess.userId !== user.uid) return;
      if (sess.activity !== examActivity) return;
      const sd = sess.createdAt?.toDate ? sess.createdAt.toDate() : new Date(sess.createdAt || sess.timestamp || 0);
      if (sd < assignmentCreatedAt) return;
      const idOk = !aExamId
        || sess.unit === aExamId
        || (examActivity === 'listening-exam' && sess.unit === 'fsmept');
      if (!idOk) return;
      hits++;
      best = Math.max(best, Number(sess.percentage || sess.score || 0));
    });
    return { completed: hits > 0, attempts: hits, bestScore: best };
  }

  // Check multiple sources for progress data
  let matchingSessions = [];
  
  // Source 1: Check global allSessions if available (loaded from Firebase)
  if (typeof allSessions !== 'undefined' && Array.isArray(allSessions)) {
    const firebaseMatches = allSessions.filter(sess => {
      // Must be this user's session
      if (sess.userId !== user.uid) return false;
      
      const sessionDate = sess.createdAt?.toDate ? sess.createdAt.toDate() : new Date(sess.createdAt || sess.timestamp || 0);
      if (sessionDate < assignmentCreatedAt) return false;
      
      const sessionBook = sess.book || 'empower';
      if (sessionBook !== assignment.book) return false;
      if (sess.level !== assignment.level) return false;
      
      // Flexible unit matching
      if (assignment.unit && assignment.unit !== 'all') {
        const normalizeUnit = (u) => String(u).toLowerCase().replace(/unit\s*/gi, '').trim();
        if (normalizeUnit(sess.unit) !== normalizeUnit(assignment.unit)) return false;
      }
      
      if (assignment.activity && assignment.activity !== 'all' && sess.activity !== assignment.activity) return false;
      
      return true;
    });
    matchingSessions = matchingSessions.concat(firebaseMatches);
  }
  
  // Source 2: Check global myProgress if available (from student dashboard)
  if (typeof myProgress !== 'undefined' && Array.isArray(myProgress)) {
    const progressMatches = myProgress.filter(sess => {
      const sessionDate = sess.createdAt?.toDate ? sess.createdAt.toDate() : new Date(sess.createdAt || sess.timestamp || 0);
      if (sessionDate < assignmentCreatedAt) return false;
      
      const sessionBook = sess.book || 'empower';
      if (sessionBook !== assignment.book) return false;
      if (sess.level !== assignment.level) return false;
      
      // Flexible unit matching
      if (assignment.unit && assignment.unit !== 'all') {
        const normalizeUnit = (u) => String(u).toLowerCase().replace(/unit\s*/gi, '').trim();
        if (normalizeUnit(sess.unit) !== normalizeUnit(assignment.unit)) return false;
      }
      
      if (assignment.activity && assignment.activity !== 'all' && sess.activity !== assignment.activity) return false;
      
      return true;
    });
    matchingSessions = matchingSessions.concat(progressMatches);
  }
  
  // Source 3: Check sessionHistory in localStorage
  try {
    const sessionHistory = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
    const localMatches = sessionHistory.filter(sess => {
      const sessionDate = new Date(sess.createdAt || sess.timestamp || 0);
      if (sessionDate < assignmentCreatedAt) return false;
      
      const sessionBook = sess.book || 'empower';
      if (sessionBook !== assignment.book) return false;
      if (sess.level !== assignment.level) return false;
      
      // Flexible unit matching
      if (assignment.unit && assignment.unit !== 'all') {
        const normalizeUnit = (u) => String(u).toLowerCase().replace(/unit\s*/gi, '').trim();
        if (normalizeUnit(sess.unit) !== normalizeUnit(assignment.unit)) return false;
      }
      
      if (assignment.activity && assignment.activity !== 'all' && sess.activity !== assignment.activity) return false;
      
      return true;
    });
    matchingSessions = matchingSessions.concat(localMatches);
  } catch (e) {}
  
  // Source 4: Check journeyStats in localStorage
  try {
    const journeyStats = JSON.parse(localStorage.getItem('journeyStats') || '{}');
    if (journeyStats.sessions && Array.isArray(journeyStats.sessions)) {
      const journeyMatches = journeyStats.sessions.filter(sess => {
        const sessionDate = new Date(sess.createdAt || sess.timestamp || 0);
        if (sessionDate < assignmentCreatedAt) return false;
        
        const sessionBook = sess.book || 'empower';
        if (sessionBook !== assignment.book) return false;
        if (sess.level !== assignment.level) return false;
        
        // Flexible unit matching
        if (assignment.unit && assignment.unit !== 'all') {
          const normalizeUnit = (u) => String(u).toLowerCase().replace(/unit\s*/gi, '').trim();
          if (normalizeUnit(sess.unit) !== normalizeUnit(assignment.unit)) return false;
        }
        
        if (assignment.activity && assignment.activity !== 'all' && sess.activity !== assignment.activity) return false;
        
        return true;
      });
      matchingSessions = matchingSessions.concat(journeyMatches);
    }
  } catch (e) {}
  
  // Calculate results - check multiple possible field names for score
  const attempts = matchingSessions.length;
  const scores = matchingSessions.map(s => s.percentage || s.score || s.finalScore || 0);
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const completed = scores.some(score => score >= 100);
  
  // Debug log
  console.log('Assignment check:', assignment.title, { attempts, bestScore, completed, matchingSessions });
  
  return { completed, attempts, bestScore };
}

// ============================================
// MARK ASSIGNMENT AS COMPLETED
// Call this when a student completes an assignment with 100%
// ============================================
async function markAssignmentCompleted(assignmentId, score, detail) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const docId = `${user.uid}_${assignmentId}`;
    const existingDoc = await db.collection('assignmentCompletions').doc(docId).get();
    const existingData = existingDoc.exists ? existingDoc.data() : { attempts: 0, bestScore: 0 };

    const payload = {
      odUserId: user.uid,
      assignmentId: assignmentId,
      completed: score >= 100,
      attempts: (existingData.attempts || 0) + 1,
      bestScore: Math.max(existingData.bestScore || 0, score),
      lastAttempt: firebase.firestore.FieldValue.serverTimestamp(),
      completedAt: score >= 100 ? firebase.firestore.FieldValue.serverTimestamp() : null
    };
    // Per-question detail so teachers can see WHICH items the student missed
    // (QA #4). Uniform shape across skills: { skill, items:[{q,a,correct,ok}] }.
    // Only attached when the runner provides it (vocab calls without it).
    if (detail && Array.isArray(detail.items)) {
      payload.answers = {
        skill: detail.skill || null,
        items: detail.items,
        scoredPct: typeof score === 'number' ? score : null
      };
    }
    await db.collection('assignmentCompletions').doc(docId).set(payload, { merge: true });
    
    console.log('Assignment completion recorded:', { assignmentId, score });
    
    // Update local cache immediately so render shows correct status
    myCompletions[assignmentId] = {
      completed: score >= 100,
      attempts: (existingData.attempts || 0) + 1,
      bestScore: Math.max(existingData.bestScore || 0, score)
    };
    
    // Refresh the assignments display
    renderMyAssignments();
    
  } catch (error) {
    console.error('Error marking assignment complete:', error);
  }
}

// ============================================
// VIEW WRITING FEEDBACK   (Phase E — student side)
// Opens a read-only modal showing the teacher's score + comment plus
// the student's own response. Three visual states:
//   • graded / returned → score chip, comment block, status badge
//   • submitted          → "awaiting feedback" badge, no grade yet
//   • missing            → graceful fallback (shouldn't happen because
//                          the button only renders when wsub exists)
// ============================================
function viewWritingFeedback(assignmentId) {
  const ws = (typeof myWritingSubmissions !== 'undefined') ? myWritingSubmissions[assignmentId] : null;
  if (!ws) {
    AppDialog.alert('No submission found for this assignment yet.');
    return;
  }
  const a = (Array.isArray(myAssignments) ? myAssignments : []).find(x => x.id === assignmentId) || {};
  const title = a.title || 'Writing Assignment';

  // --- Helper: tier the score so the chip colour reflects performance.
  const score = (ws.score != null && !isNaN(Number(ws.score))) ? Number(ws.score) : null;
  const max   = 20;
  const pct   = (score != null) ? Math.max(0, Math.min(100, Math.round((score / max) * 100))) : 0;
  const tier  = (score == null) ? 'oklch(60% 0.05 240)'
              : pct >= 80       ? 'oklch(70% 0.20 150)'
              : pct >= 60       ? 'oklch(65% 0.18 210)'
              : 'oklch(72% 0.20 60)';

  // --- Status badge palette.
  const status = ws.status || 'submitted';
  const statusBadge = (function () {
    if (status === 'graded')   return { label: '✅ Graded',   bg: 'rgba(34,197,94,0.18)',  fg: '#86efac', bd: 'rgba(34,197,94,0.45)' };
    if (status === 'returned') return { label: '↩ Returned',  bg: 'rgba(245,158,11,0.18)', fg: '#fcd34d', bd: 'rgba(245,158,11,0.45)' };
    return                            { label: '⏳ Submitted', bg: 'rgba(148,163,184,0.18)', fg: '#cbd5e1', bd: 'rgba(148,163,184,0.45)' };
  })();

  // --- Pretty-print graded-at if present.
  const gradedAt = ws.gradedAt?.toDate ? ws.gradedAt.toDate()
                 : ws.gradedAt ? new Date(ws.gradedAt) : null;
  const gradedAtText = gradedAt ? gradedAt.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  }) : '';

  const responseText = String(ws.responseText || '');
  const wordCount    = (ws.wordCount != null) ? ws.wordCount : (responseText.trim() ? responseText.trim().split(/\s+/).length : 0);
  const comment      = String(ws.teacherComment || '').trim();

  // Tear down any previously open feedback modal (e.g. student tapping
  // a second card without closing the first).
  const existing = document.getElementById('writingFeedbackModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'writingFeedbackModal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 10050;
    background: rgba(2, 6, 23, 0.78); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px; box-sizing: border-box;
  `;

  // Score chip: only render if there's a numeric grade.
  const scoreChipHtml = (score != null) ? `
    <div style="display:flex; flex-direction:column; align-items:center;
                gap:2px; padding:10px 16px; border-radius:12px;
                background: rgba(168, 85, 247, 0.10);
                border: 1px solid rgba(168, 85, 247, 0.30);">
      <span style="font-size:0.7em; font-weight:700; letter-spacing:0.08em;
                   color:#cbd5e1; text-transform:uppercase;">Score</span>
      <span style="font-size:1.8em; font-weight:800; color:${tier}; line-height:1;">
        ${score} <span style="font-size:0.55em; color:#94a3b8;">/ ${max}</span>
      </span>
    </div>
  ` : '';

  // Phase G.6 — criterion breakdown chips. Only rendered when the
  // teacher actually used per-criterion grading; falls back silently
  // if criteria is null/missing.
  const criteria = ws.criteria || null;
  const criteriaHtml = (criteria && (status === 'graded' || status === 'returned')) ? (() => {
    const items = [
      { code: 'TA', name: 'Task Achievement',     value: criteria.TA },
      { code: 'CC', name: 'Coherence & Cohesion', value: criteria.CC },
      { code: 'GR', name: 'Grammatical Range',    value: criteria.GR },
      { code: 'VO', name: 'Vocabulary',           value: criteria.VO }
    ];
    return `
      <div style="margin-top:14px;">
        <div style="font-size:0.75em; font-weight:700; letter-spacing:0.08em;
                    color:#94a3b8; text-transform:uppercase; margin-bottom:6px;">
          🎯 Per-criterion breakdown
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap:8px;">
          ${items.map(it => {
            const v = (it.value != null && !isNaN(Number(it.value))) ? Number(it.value) : 0;
            const tone = v >= 4 ? '#86efac' : v >= 3 ? '#7dd3fc' : v >= 2 ? '#fcd34d' : '#fca5a5';
            return `
              <div style="padding:10px 12px; border-radius:8px;
                          background: rgba(255,255,255,0.04);
                          border: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size:0.68em; font-weight:700; letter-spacing:0.06em;
                            color:#94a3b8; text-transform:uppercase;">${it.code}</div>
                <div style="font-size:1.2em; font-weight:800; color:${tone}; line-height:1.2;">
                  ${v} <span style="font-size:0.62em; color:#64748b;">/ 5</span>
                </div>
                <div style="font-size:0.72em; color:#94a3b8; margin-top:2px;">${escapeHtml(it.name)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  })() : '';

  // Rubric panel (Phase G.4) — shown when the assignment carries one.
  // Two possible sources: free-form text and/or a link to a hosted file.
  const rubricText = String(a.rubric || '').trim();
  const rubricUrl  = String(a.rubricUrl || '').trim();
  const rubricHtml = (rubricText || rubricUrl) ? `
    <div style="margin-top:14px;">
      <details style="background: rgba(45, 212, 191, 0.06);
                      border: 1px solid rgba(45, 212, 191, 0.25);
                      border-radius: 10px; padding: 10px 14px;">
        <summary style="cursor: pointer; font-weight: 700; color: #5eead4;
                        font-size: 0.78em; letter-spacing: 0.06em;
                        text-transform: uppercase;">
          📋 Rubric (what you'll be graded on)
        </summary>
        ${rubricText ? `
          <div style="margin-top: 8px; color: #e2e8f0; line-height: 1.6;
                      white-space: pre-wrap; font-size: 0.92em;">
            ${escapeHtml(rubricText)}
          </div>
        ` : ''}
        ${rubricUrl ? `
          <div style="margin-top: 10px;">
            <a href="${escapeHtml(rubricUrl)}" target="_blank" rel="noopener"
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
    </div>
  ` : '';

  // Comment block: only when teacher actually wrote one.
  const commentHtml = comment ? `
    <div style="margin-top:14px;">
      <div style="font-size:0.75em; font-weight:700; letter-spacing:0.08em;
                  color:#94a3b8; text-transform:uppercase; margin-bottom:6px;">
        💬 Teacher's comment
      </div>
      <div style="padding:12px 14px; border-radius:10px;
                  background: rgba(168, 85, 247, 0.06);
                  border-left: 3px solid #a855f7;
                  color:#e2e8f0; line-height:1.55; white-space:pre-wrap;">
        ${escapeHtml(comment)}
      </div>
    </div>
  ` : (status === 'graded' || status === 'returned') ? `
    <div style="margin-top:14px; padding:10px 14px; border-radius:10px;
                background: rgba(255,255,255,0.03);
                border: 1px dashed rgba(255,255,255,0.15);
                color:#94a3b8; font-size:0.9em; font-style:italic;">
      Your teacher hasn't left a written comment for this one.
    </div>
  ` : '';

  modal.innerHTML = `
    <div style="background: var(--surface-elevated, #0f172a);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px; max-width: 720px; width: 100%;
                max-height: 90vh; display: flex; flex-direction: column;
                box-shadow: 0 24px 60px rgba(0,0,0,0.5);">
      <!-- header -->
      <div style="display:flex; align-items:center; gap:12px;
                  padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <span style="font-size:1.5em;">📝</span>
        <div style="flex:1; min-width:0;">
          <div style="font-size:1.05em; font-weight:700; color:#f1f5f9; line-height:1.2;
                      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(title)}
          </div>
          <div style="font-size:0.8em; color:#94a3b8; margin-top:2px;">
            Your writing feedback
          </div>
        </div>
        <button type="button" id="writingFeedbackCloseBtn"
                aria-label="Close"
                style="background: rgba(255,255,255,0.06);
                       border: 1px solid rgba(255,255,255,0.10);
                       color:#cbd5e1; width:32px; height:32px;
                       border-radius:8px; cursor:pointer; font-size:1.1em;">✕</button>
      </div>

      <!-- body (scrollable) -->
      <div style="padding: 18px 20px; overflow-y:auto; flex:1;">
        <!-- score + status row -->
        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
          ${scoreChipHtml}
          <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:200px;">
            <span style="display:inline-flex; align-items:center; gap:6px;
                         align-self:flex-start; padding:4px 10px; border-radius:999px;
                         background:${statusBadge.bg}; color:${statusBadge.fg};
                         border:1px solid ${statusBadge.bd}; font-size:0.8em; font-weight:600;">
              ${statusBadge.label}
            </span>
            ${ws.gradedBy ? `
              <span style="font-size:0.8em; color:#94a3b8;">
                Graded by <strong style="color:#cbd5e1;">${escapeHtml(ws.gradedBy)}</strong>
                ${gradedAtText ? ` · ${escapeHtml(gradedAtText)}` : ''}
              </span>
            ` : ''}
          </div>
        </div>

        ${criteriaHtml}

        ${rubricHtml}

        ${commentHtml}

        <!-- student's response -->
        <div style="margin-top:18px;">
          <div style="display:flex; align-items:center; justify-content:space-between;
                      margin-bottom:6px;">
            <span style="font-size:0.75em; font-weight:700; letter-spacing:0.08em;
                         color:#94a3b8; text-transform:uppercase;">
              ✍️ Your response
            </span>
            <span style="font-size:0.78em; color:#94a3b8;">
              ${wordCount} word${wordCount === 1 ? '' : 's'}
            </span>
          </div>
          <div id="writingFeedbackResponse" style="padding:14px; border-radius:10px;
                      background: rgba(255,255,255,0.03);
                      border: 1px solid rgba(255,255,255,0.08);
                      color:#e2e8f0; line-height:1.6;
                      white-space:pre-wrap; word-wrap:break-word;
                      max-height: 40vh; overflow-y:auto;">
            ${responseText ? escapeHtml(responseText) : '<em style="color:#64748b;">(empty response)</em>'}
          </div>
          <!-- Teacher's inline comments render here (graded/returned only). -->
          <div id="writingFeedbackDetached" style="margin-top:10px;"></div>
        </div>
      </div>

      <!-- footer -->
      <div style="display:flex; justify-content:flex-end; gap:8px;
                  padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.06);">
        <button type="button" id="writingFeedbackDoneBtn"
                style="background: linear-gradient(180deg, #6366f1, #4f46e5);
                       color:white; border:none; padding:8px 16px;
                       border-radius:8px; font-weight:600; cursor:pointer;">
          Got it
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ── Inline teacher annotations (read-only) ──
  // Only shown once the teacher has graded or returned the essay — the
  // same visibility gate as the score + overall comment. Highlights the
  // commented spans in the response; any comment whose anchor no longer
  // matches (e.g. after a resubmit) is listed below as a general note.
  if ((status === 'graded' || status === 'returned')
      && window.WritingAnnotations && Array.isArray(ws.annotations) && ws.annotations.length) {
    const respEl = document.getElementById('writingFeedbackResponse');
    const detEl  = document.getElementById('writingFeedbackDetached');
    if (respEl) {
      const rubricType = a.rubricType || 'essay';
      const res = WritingAnnotations.render(respEl, responseText, ws.annotations, {
        mode: 'student',
        rubric: rubricType
      });
      // Detached comments (couldn't be anchored) → a small list so the
      // student still sees the feedback.
      if (detEl && res && res.detached && res.detached.length) {
        detEl.innerHTML =
          '<div style="font-size:0.72em;font-weight:700;letter-spacing:0.06em;'
          + 'text-transform:uppercase;color:#94a3b8;margin:4px 0 6px;">Other comments</div>'
          + res.detached.map(function (an) {
              return '<div style="padding:8px 10px;border-radius:8px;'
                + 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);'
                + 'margin-bottom:6px;font-size:0.88em;color:#e2e8f0;line-height:1.5;">'
                + escapeHtml(an.text) + '</div>';
            }).join('');
      }
    }
  }

  // Phase E: opening the modal counts as "I've seen this feedback."
  // Mark it seen and re-render the underlying list so the pulse on
  // the card and the glow on the hub badge fall away. We only mark
  // when the student is actually viewing the GRADED state — opening
  // the "view my response" modal on a still-submitted essay shouldn't
  // pre-clear a future grade.
  if (status === 'graded' || status === 'returned') {
    _markFeedbackSeen(assignmentId, status);
    if (typeof renderMyAssignments === 'function') {
      try { renderMyAssignments(); } catch (_) {}
    }
  }

  // Close handlers — click backdrop, close button, footer button, or Esc.
  const close = () => {
    modal.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('#writingFeedbackCloseBtn')?.addEventListener('click', close);
  modal.querySelector('#writingFeedbackDoneBtn')?.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}
window.viewWritingFeedback = viewWritingFeedback;

// ============================================
// START ASSIGNMENT
// ============================================
async function startAssignment(assignmentId) {
  const assignment = myAssignments.find(a => a.id === assignmentId);
  if (!assignment) {
    console.error('Assignment not found:', assignmentId);
    return;
  }

  console.log('Starting assignment:', assignment);

  // Skill-aware router (Phase 4). Send each skill to its own runner.
  const sk = (typeof SKILL_REGISTRY !== 'undefined')
    ? SKILL_REGISTRY.skillOf(assignment)
    : (assignment.skill || 'vocabulary');

  if (sk === 'writing') {
    // Open the secure writing exam page with the assignment id.
    window.location.href = `writing-exam.html?assignmentId=${encodeURIComponent(assignmentId)}`;
    return;
  }
  if (sk === 'reading' || sk === 'listening') {
    // Land on the skill home first: a single screen swap that back-nav.js
    // tracks (setting location.hash directly used to desync the back-stack
    // and trigger the "Leaving so soon?" logout modal). The home is also the
    // safe fallback if the deep-link below can't find the exam.
    const screenId = (sk === 'reading') ? 'readingScreen' : 'listeningScreen';
    if (typeof window.openSkill === 'function') {
      window.openSkill({ id: sk, screen: screenId });
    } else if (typeof showScreen === 'function' && document.getElementById(screenId)) {
      showScreen(screenId);
    } else {
      window.location.hash = '#' + sk;
    }
    // If the assignment names a specific exam, open it directly instead of
    // leaving the student to hunt for it in the list.
    const examId = assignment.examId;
    const examLevel = assignment.examLevel || assignment.level || '';
    if (examId) {
      setTimeout(function () {
        try {
          if (sk === 'reading' && typeof window.openReadingExam === 'function') {
            window.openReadingExam(examLevel, examId, 'untimed');
          } else if (sk === 'listening' && typeof window.startListeningExam === 'function') {
            window.startListeningExam(examId);
          }
        } catch (e) {
          console.warn('[assignment] direct exam launch failed; staying on skill home', e);
        }
      }, 200);
    }
    return;
  }
  if (sk === 'grammar') {
    // Open the Grammar skill at the assigned level/topics. grammar.js
    // handles assignment mode (filtered topics + completion on finish).
    if (typeof window.startGrammarAssignment === 'function') {
      window.startGrammarAssignment(assignment);
    } else if (typeof showScreen === 'function') {
      showScreen('grammarScreen');
    }
    return;
  }
  // Anything else (speaking placeholder) — bail to dashboard.
  if (sk !== 'vocabulary') {
    AppDialog.alert(`The ${sk} skill runner isn't built yet. Your teacher will know.`);
    return;
  }
  // Vocabulary: fall through to the existing vocab-specific launcher.

  // CRITICAL: order matters here.
  //   changeBook() is async AND it resets selectedLevel='A2' / selectedUnit='all'
  //   as a side effect (it can't know which level you'd want under a new book).
  //   If we don't await it, the level we set immediately after gets steamrolled
  //   when changeBook eventually resolves — that's why the user saw "B1+" set
  //   in state but the pill stuck on "A2".
  //
  // Also: if the assignment's book matches the current book, skip the swap
  // entirely so we keep the user's existing level/unit context coherent.
  if (assignment.book && assignment.book !== selectedBook) {
    if (typeof changeBook === 'function') {
      await changeBook(assignment.book);
    }
  }

  // Now that the book swap (if any) is complete, set level + unit. Order:
  //   1) Level — this triggers populateUnitSelector() so the unit list is
  //      populated with the right units for that level.
  //   2) Unit — must come after the unit selector has options to pick from.
  if (assignment.level) {
    if (typeof changeLevel === 'function') {
      changeLevel(assignment.level);
    } else {
      const levelSelect = document.getElementById('levelSelect');
      if (levelSelect) levelSelect.value = assignment.level;
      selectedLevel = assignment.level;
    }
  }

  // Tiny delay so the unit selector finishes its synchronous DOM rebuild
  // before we try to assign one of its values. populateUnitSelector is
  // synchronous, so 0ms (microtask) is enough — but keep a small buffer
  // for any async observers wired to level changes elsewhere.
  setTimeout(() => {
    if (assignment.unit && assignment.unit !== 'all') {
      if (typeof changeUnit === 'function') {
        changeUnit(assignment.unit);
      } else {
        const unitSelect = document.getElementById('unitSelect');
        if (unitSelect) unitSelect.value = assignment.unit;
        selectedUnit = assignment.unit;
      }
    }
    
    // Log current state for debugging
    console.log('Assignment started with state:', {
      selectedBook,
      selectedLevel,
      selectedUnit,
      activity: assignment.activity
    });
    
    // Start the activity if specified
    if (assignment.activity && assignment.activity !== 'all') {
      setTimeout(() => {
        if (typeof startActivity === 'function') {
          startActivity(assignment.activity);
        } else {
          console.error('startActivity function not found');
        }
      }, 200);
    } else {
      // "Any Activity" assignment — there's no specific game to launch,
      // so route the student to the vocabulary practice menu where the
      // activity cards live. Book/level/unit are already pre-set above,
      // so the menu page is implicitly scoped to the assignment.
      if (typeof showScreen === 'function') {
        showScreen('menuScreen');
      }
      if (typeof showToast === 'function') {
        showToast('Select any activity to complete your assignment!');
      } else {
        AppDialog.alert('Select any activity to complete your assignment!');
      }
    }
  }, 300);
}

// ============================================
// UPDATE BADGE
// Two signals on the hub link:
//   • `count`              — number of pending assignments (drives the
//     visible numeric chip).
//   • `hasUnseenFeedback`  — Phase E. When a student has graded/returned
//     writing they haven't opened yet, we want the chip visible even if
//     pending count is 0, and we add a soft purple glow via CSS class.
//     The text becomes "★" in that pending=0 + unseen case so the chip
//     still has something to render.
// ============================================
function updateAssignmentBadge(count, hasUnseenFeedback = false) {
  const badge = document.getElementById('assignmentBadge');
  if (!badge) return;

  const shouldShow = count > 0 || !!hasUnseenFeedback;
  if (shouldShow) {
    badge.textContent = count > 0 ? String(count) : '★';
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
  badge.classList.toggle('has-new-feedback', !!hasUnseenFeedback);
}

// ============================================
// TRACK SESSION FOR ASSIGNMENTS
// ============================================
function trackSessionForAssignments(sessionData) {
  // Save to localStorage for assignment tracking
  const history = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
  
  history.push({
    ...sessionData,
    createdAt: new Date().toISOString()
  });
  
  // Keep only last 100 sessions
  if (history.length > 100) {
    history.shift();
  }
  
  localStorage.setItem('sessionHistory', JSON.stringify(history));
  
  // Re-render assignments to update status
  setTimeout(() => {
    renderMyAssignments();
  }, 500);
}

// ============================================
// INIT - Load on page load
// ============================================
// Single trigger: Firebase invokes onAuthStateChanged immediately with
// the cached user at boot, so we don't need a separate DOMContentLoaded
// timer. The previous code chained TWO setTimeouts (1500ms + 1000ms)
// which made the hub badge feel like it appeared seconds late even
// though the actual Firestore fetch only takes ~300ms.
auth.onAuthStateChanged(user => {
  if (user) loadMyAssignments();
});

// Phase G fix — refresh writing submissions when the student tabs
// back to the page. There's no live onSnapshot listener (would double
// Firestore reads), but visibility-change is a cheap proxy: if the
// teacher just returned the essay in another tab/device, the student
// sees the "Returned for revision" state the moment they refocus
// without needing a full reload.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!auth.currentUser) return;
  loadMyAssignments();
});
