/* Student Dashboard - Progress, Profile, Achievements, Learning Map */

// Level rank titles based on level
const levelRanks = {
  1: { title: 'Beginner', icon: '🌱' },
  2: { title: 'Learner', icon: '📚' },
  3: { title: 'Student', icon: '✏️' },
  4: { title: 'Scholar', icon: '🎓' },
  5: { title: 'Expert', icon: '💡' },
  6: { title: 'Master', icon: '🏆' },
  7: { title: 'Champion', icon: '👑' },
  8: { title: 'Legend', icon: '⭐' },
  9: { title: 'Virtuoso', icon: '💎' },
  10: { title: 'Grandmaster', icon: '🔱' }
};

// Activity icons mapping
const activityIcons = {
  'match': '🎴',
  'choice': '📋',
  'reverse': '🎧',
  'spelling': '✏️',
  'fillblank': '📖',
  'order': '🧩',
  'pronunciation': '🎙️',
  'unscramble': '🔡',
  'listening-exam': '🎤'
};

// Activity display names
const activityNames = {
  'match': 'Match Game',
  'choice': 'Multiple Choice',
  'reverse': 'Listening Mode',
  'spelling': 'Spelling',
  'fillblank': 'Fill in Blank',
  'order': 'Word Order',
  'pronunciation': 'Pronunciation',
  'unscramble': 'Unscramble',
  'listening-exam': 'Listening Exam'
};

// Raw session docs cached by loadJourneyStats() so the Learning Map
// (loadMapProgress) can reuse them instead of re-reading every session
// a second time. Reset on each loadJourneyStats run (per page-view).
let _sessionsCache = null;

async function loadJourneyStats() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Plain `where` query — no `orderBy` because the composite index
    // (userId + createdAt) isn't created in Firestore, which made the
    // first attempt fail with HTTP 400 every page load (cosmetic but
    // noisy). The loop below already sorts client-side to find the
    // most recent session, so server-side ordering is unnecessary.
    const sessionsSnapshot = await db.collection('sessions')
      .where('userId', '==', user.uid)
      .get();
    
    // Cache the raw session docs so the Learning Map can reuse them instead
    // of re-reading the whole collection. Same page-view = same data.
    _sessionsCache = [];

    let totalCorrect = 0;
    let totalQuestions = 0;
    let activitiesMap = {};
    let uniqueWords = new Set();
    let recentSession = null;
    let recentTime = 0;
    
    sessionsSnapshot.forEach(doc => {
      const session = doc.data();
      if (_sessionsCache) _sessionsCache.push(session);
      // Handle both old and new field names
      totalCorrect += session.correctAnswers || session.score || 0;
      totalQuestions += session.totalQuestions || session.total || 0;
      
      // Track activities
      const activity = session.activity || 'unknown';
      activitiesMap[activity] = (activitiesMap[activity] || 0) + 1;
      
      // Track unique words learned
      if (session.wordsLearned && Array.isArray(session.wordsLearned)) {
        session.wordsLearned.forEach(w => uniqueWords.add(w));
      }
      
      // Find most recent session
      const sessionTime = session.createdAt?.toMillis?.() || 0;
      if (sessionTime > recentTime) {
        recentTime = sessionTime;
        recentSession = session;
      }
    });
    
    journeyStats = {
      totalSessions: sessionsSnapshot.size,
      totalWordsLearned: uniqueWords.size,
      totalCorrect: totalCorrect,
      totalQuestions: totalQuestions,
      averageScore: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      activitiesCompleted: activitiesMap,
      recentActivity: recentSession
    };
    
    // Save to localStorage as backup
    localStorage.setItem('journeyStats', JSON.stringify(journeyStats));
    
    // Update the journey card UI
    updateJourneyCard();
    
    console.log('Journey stats loaded:', journeyStats);
    
  } catch (e) {
    console.error('Could not load journey stats from Firebase:', e);
    
    // Try to load from localStorage backup
    const savedStats = localStorage.getItem('journeyStats');
    if (savedStats) {
      journeyStats = JSON.parse(savedStats);
      updateJourneyCard();
      console.log('Loaded journey stats from localStorage backup');
    }
  }
}

function updateJourneyCard() {
  // Update main stats
  const currentStreakEl = document.getElementById('currentStreak');
  const bestStreakEl = document.getElementById('bestStreak');
  const accuracyEl = document.getElementById('journeyAccuracy');
  const wordsEl = document.getElementById('journeyWords');
  const sessionsEl = document.getElementById('journeySessions');
  
  if (currentStreakEl) currentStreakEl.textContent = sessionStreak || 0;
  if (bestStreakEl) bestStreakEl.textContent = localStorage.getItem('bestStreak') || 0;
  if (accuracyEl) accuracyEl.textContent = journeyStats.averageScore + '%';
  if (wordsEl) wordsEl.textContent = journeyStats.totalWordsLearned || 0;
  if (sessionsEl) sessionsEl.textContent = journeyStats.totalSessions || 0;

  // Dashboard welcome banner (design v2) — mirror streak
  const welcomeStreak = document.getElementById('welcomeStreak');
  if (welcomeStreak) welcomeStreak.textContent = sessionStreak || 0;

  // Update level display
  updateLevelDisplay();
  
  // Update last session
  updateLastSessionDisplay();
}

function updateLevelDisplay() {
  const level = userProfile.level || 1;
  const xp = userProfile.xp || 0;
  const xpInCurrentLevel = xp % 100;
  const xpNeeded = 100;
  
  // Get rank info
  const rankLevel = Math.min(level, 10);
  const rank = levelRanks[rankLevel] || levelRanks[1];
  
  // Update badge
  const badgeIcon = document.getElementById('levelBadgeIcon');
  const levelRankEl = document.getElementById('levelRank');
  const levelDisplay = document.getElementById('currentLevelDisplay');
  
  if (badgeIcon) badgeIcon.textContent = rank.icon;
  if (levelRankEl) levelRankEl.textContent = rank.title;
  if (levelDisplay) levelDisplay.textContent = level;
  
  // Update XP bar
  const xpFill = document.getElementById('xpBarFill');
  const currentXP = document.getElementById('currentXPDisplay');
  const nextXP = document.getElementById('nextLevelXP');
  
  if (xpFill) xpFill.style.width = xpInCurrentLevel + '%';
  if (currentXP) currentXP.textContent = xpInCurrentLevel;
  if (nextXP) nextXP.textContent = xpNeeded;

  // Dashboard XP milestone ticks (design v2): mark any milestone ≤ current XP as hit
  document.querySelectorAll('#xpMilestones .xp-milestone').forEach(m => {
    const mark = parseInt(m.dataset.xp, 10) || 0;
    m.classList.toggle('hit', xpInCurrentLevel >= mark);
  });
}

function updateLastSessionDisplay() {
  const lastSessionCard = document.getElementById('lastSessionCard');
  if (!lastSessionCard) return;
  
  if (journeyStats.recentActivity) {
    const activity = journeyStats.recentActivity;
    const activityType = activity.activity || 'unknown';
    const percentage = activity.percentage || activity.score || 0;
    
    // Update icon
    const iconEl = document.getElementById('lastSessionIcon');
    if (iconEl) iconEl.textContent = activityIcons[activityType] || '📚';
    
    // Update activity name
    const activityEl = document.getElementById('lastSessionActivity');
    if (activityEl) activityEl.textContent = activityNames[activityType] || activityType;
    
    // Update progress bar
    const barFill = document.getElementById('lastSessionBarFill');
    const percentEl = document.getElementById('lastSessionPercent');
    
    if (barFill) barFill.style.width = percentage + '%';
    if (percentEl) percentEl.textContent = percentage + '%';
    
    lastSessionCard.style.display = 'block';
  } else {
    // Show "no sessions" state
    const activityEl = document.getElementById('lastSessionActivity');
    if (activityEl) activityEl.textContent = 'Start your first session!';
    
    const barFill = document.getElementById('lastSessionBarFill');
    const percentEl = document.getElementById('lastSessionPercent');
    if (barFill) barFill.style.width = '0%';
    if (percentEl) percentEl.textContent = '—';
  }
}

// ============================================
// PROFILE SYSTEM
// ============================================
function loadProfile() {
  const saved = localStorage.getItem('vocabProfile');
  if (saved) {
    userProfile = JSON.parse(saved);
  }
  
  // Try to load from Firebase
  if (typeof auth !== 'undefined' && auth.currentUser) {
    db.collection('users').doc(auth.currentUser.uid).get().then(doc => {
      if (doc.exists && doc.data().profile) {
        userProfile = { ...userProfile, ...doc.data().profile };
        localStorage.setItem('vocabProfile', JSON.stringify(userProfile));
        updateProfileDisplay();
      }
    }).catch(e => console.log('Could not load profile from Firebase'));
  }
  
  updateProfileDisplay();
}

// updateProfileDisplay is defined canonically in avatar.js (loaded after this file).
// This stub ensures calls made during progress.js setup don't crash before avatar.js loads.
if (typeof updateProfileDisplay === 'undefined') {
  function updateProfileDisplay() {
    document.getElementById('profileXPLevel').textContent = userProfile.level;
    document.getElementById('profileXP').textContent = userProfile.xp;
    updateAchievements();
    if (typeof updateLevelDisplay === 'function') updateLevelDisplay();
  }
}

function updateAchievements() {
  const achievements = document.querySelectorAll('.achievement');
  achievements.forEach(ach => {
    const id = ach.dataset.id;
    if (userProfile.achievements?.includes(id)) {
      ach.classList.add('unlocked');
    }
  });
}

function openProfileModal() {
  document.getElementById('profileModal').classList.add('active');
  updateProfileDisplay();
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('active');
}

// selectAvatar is now handled by avatar.js with DiceBear images
/*
function selectAvatar(element) {
  if (element.classList.contains('locked')) {
    const unlockXP = element.dataset.unlock;
    AppDialog.alert(`You need ${unlockXP} XP to unlock this avatar!`);
    return;
  }
  
  document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  
  userProfile.avatar = element.dataset.avatar;
  document.getElementById('avatarPreview').textContent = userProfile.avatar;
}
*/

async function saveProfile() {
  // Save locally
  localStorage.setItem('vocabProfile', JSON.stringify(userProfile));
  
  // Save to Firebase
  if (typeof auth !== 'undefined' && auth.currentUser) {
    try {
      await db.collection('users').doc(auth.currentUser.uid).update({
        profile: userProfile
      });
    } catch (e) {
      console.log('Could not save profile to Firebase');
    }
  }
  
  updateProfileDisplay();
  closeProfileModal();
  
  // Show success feedback
  showToast('Profile saved! ✓');
}

function addXP(amount) {
  const oldLevel = userProfile.level;
  userProfile.xp += amount;
  userProfile.level = Math.floor(userProfile.xp / 100) + 1;
  
  if (userProfile.level > oldLevel) {
    showToast(`🎉 Level Up! You're now level ${userProfile.level}!`);
  }
  
  updateProfileDisplay();
  localStorage.setItem('vocabProfile', JSON.stringify(userProfile));
}

// ============================================
// LEARNING MAP - Quest Board + Unit Cards
// ============================================

// Game challenges that define "mastery" of a unit.
// NOTE: "Listening Mode" here is the vocabulary practice mode (hear the
// definition → pick the word) — distinct from the Listening *skill* exam,
// which lives on its own skill screen and is intentionally NOT a per-unit
// vocabulary challenge. Renamed for clarity so users don't conflate them.
const mapChallenges = [
  { activity: 'choice',      icon: '📋', name: 'Multiple Choice', threshold: 70 },
  { activity: 'match',       icon: '🎴', name: 'Match Game',      threshold: 70 },
  { activity: 'reverse',     icon: '🎧', name: 'Listening Mode',  threshold: 70 },
  { activity: 'spelling',    icon: '✏️', name: 'Spelling',        threshold: 70 },
  { activity: 'fillblank',   icon: '📖', name: 'Fill in Blank',   threshold: 70 },
  { activity: 'order',       icon: '🧩', name: 'Word Order',      threshold: 70 },
  { activity: 'unscramble',  icon: '🔡', name: 'Unscramble',      threshold: 70 }
];

function openLearningMap() {
  document.getElementById('learningMapModal').classList.add('active');
  loadMapProgress().then(() => {
    const lvl = selectedLevel || 'A2';
    showMapLevel(lvl);
    // Activate the correct tab
    document.querySelectorAll('.level-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.level === lvl);
    });
  });
}

function closeLearningMap() {
  document.getElementById('learningMapModal').classList.remove('active');
}

async function loadMapProgress() {
  if (typeof auth !== 'undefined' && auth.currentUser) {
    try {
      // Reuse the sessions already fetched by loadJourneyStats() on dashboard
      // load — same page-view, same data — to avoid a second full-collection
      // read. Fall back to a fresh query only if the cache was never populated.
      let sessions;
      if (Array.isArray(_sessionsCache)) {
        sessions = _sessionsCache;
      } else {
        const snap = await db.collection('sessions')
          .where('userId', '==', auth.currentUser.uid)
          .get();
        sessions = snap.docs.map(d => d.data());
      }

      mapProgress = {};

      sessions.forEach(s => {
        const key = `${s.level}-${s.unit}`;
        if (!mapProgress[key]) {
          mapProgress[key] = { completed: 0, total: 0, score: 0, games: {} };
        }
        const p = mapProgress[key];
        p.completed += s.correctAnswers || s.score || 0;
        p.total += s.totalQuestions || s.total || 0;
        p.score = Math.max(p.score, s.percentage || 0);

        // Track per-game best score
        const act = s.activity || 'unknown';
        const pct = s.percentage || 0;
        if (!p.games[act] || pct > p.games[act]) {
          p.games[act] = pct;
        }
      });
    } catch (e) {
      console.log('Could not load map progress:', e);
    }
  }
}

function showMapLevel(level) {
  document.querySelectorAll('.level-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.level === level);
  });

  const container = document.getElementById('learningMapContainer');
  const data = datasets[level] || [];

  if (data.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Loading vocabulary data...</p>';
    setTimeout(() => {
      if (datasets[level] && datasets[level].length > 0) showMapLevel(level);
    }, 500);
    return;
  }

  // Sort units
  let units = [...new Set(data.map(w => w.unit).filter(Boolean))];
  const regular = units.filter(u => !String(u).toLowerCase().includes('unassigned')).sort((a, b) => {
    return (parseInt(String(a).replace(/\D/g, '')) || 0) - (parseInt(String(b).replace(/\D/g, '')) || 0);
  });
  const bonus = units.filter(u => String(u).toLowerCase().includes('unassigned'));
  units = [...regular, ...bonus];

  if (units.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No units available.</p>';
    return;
  }

  // Level-wide stats
  let levelCompleted = 0;
  let levelTotal = 0;
  let levelChallengesDone = 0;
  let levelChallengesTotal = 0;

  const cardsHtml = units.map((unit, index) => {
    const key = `${level}-${unit}`;
    const prog = mapProgress[key] || { completed: 0, total: 0, score: 0, games: {} };
    const wordCount = data.filter(w => w.unit === unit).length;
    const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
    const displayName = String(unit).toLowerCase().includes('unassigned') ? 'Bonus Words' : unit;

    // Build challenge rows
    let doneCount = 0;
    const challengeRows = mapChallenges.map(ch => {
      const best = prog.games[ch.activity] || 0;
      const done = best >= ch.threshold;
      if (done) doneCount++;
      return `
        <div class="qc-challenge ${done ? 'done' : ''}" onclick="startChallengeFromMap('${level}','${unit}','${ch.activity}'); event.stopPropagation();" title="${done ? 'Completed!' : 'Score ' + ch.threshold + '% to complete'}">
          <span class="qc-challenge-icon">${ch.icon}</span>
          <span class="qc-challenge-name">${ch.name}</span>
          <span class="qc-challenge-score">${best > 0 ? best + '%' : '—'}</span>
          <span class="qc-challenge-check">${done ? '✅' : '⬜'}</span>
        </div>`;
    }).join('');

    const totalChallenges = mapChallenges.length;
    levelChallengesDone += doneCount;
    levelChallengesTotal += totalChallenges;
    levelCompleted += prog.completed;
    levelTotal += prog.total;

    // Donut chart (SVG)
    const radius = 32;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (pct / 100) * circ;
    const donutColor = doneCount === totalChallenges ? '#10b981' : pct > 0 ? '#3b82f6' : '#334155';

    // Unit status
    const isComplete = doneCount === totalChallenges;
    const isStarted = prog.total > 0;
    const statusClass = isComplete ? 'qc-complete' : isStarted ? 'qc-active' : 'qc-new';
    const statusLabel = isComplete ? '🏆 Mastered' : isStarted ? '📖 In Progress' : '🆕 Not Started';

    return `
      <div class="qc-card ${statusClass}">
        <div class="qc-card-header">
          <div class="qc-donut">
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle cx="38" cy="38" r="${radius}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>
              <circle cx="38" cy="38" r="${radius}" fill="none" stroke="${donutColor}" stroke-width="6"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
                stroke-linecap="round" transform="rotate(-90 38 38)"
                style="transition: stroke-dashoffset 0.6s ease;"/>
            </svg>
            <div class="qc-donut-label">${pct}%</div>
          </div>
          <div class="qc-unit-info">
            <div class="qc-unit-name">${displayName}</div>
            <div class="qc-unit-words">${wordCount} words</div>
            <div class="qc-unit-status">${statusLabel}</div>
            <div class="qc-quest-progress">${doneCount}/${totalChallenges} challenges</div>
          </div>
        </div>
        <div class="qc-challenges">
          ${challengeRows}
        </div>
      </div>`;
  }).join('');

  // Level summary bar at top
  const levelPct = levelTotal > 0 ? Math.round((levelCompleted / levelTotal) * 100) : 0;
  const summaryHtml = `
    <div class="qc-level-summary">
      <div class="qc-summary-stat">
        <div class="qc-summary-value">${levelPct}%</div>
        <div class="qc-summary-label">Accuracy</div>
      </div>
      <div class="qc-summary-stat">
        <div class="qc-summary-value">${levelChallengesDone}</div>
        <div class="qc-summary-label">Challenges Done</div>
      </div>
      <div class="qc-summary-stat">
        <div class="qc-summary-value">${units.length}</div>
        <div class="qc-summary-label">Units</div>
      </div>
      <div class="qc-summary-stat">
        <div class="qc-summary-value">${data.length}</div>
        <div class="qc-summary-label">Total Words</div>
      </div>
    </div>`;

  container.innerHTML = summaryHtml + '<div class="qc-grid">' + cardsHtml + '</div>';
}

function startChallengeFromMap(level, unit, activity) {
  closeLearningMap();

  // Set level and unit, then launch game
  document.getElementById('levelSelect').value = level;
  changeLevel(level);

  setTimeout(() => {
    document.getElementById('unitSelect').value = unit;
    changeUnit(unit);
    // Start the activity directly
    if (typeof startActivity === 'function') {
      startActivity(activity);
    }
  }, 150);
}

// Close modals on background click
document.addEventListener('click', (e) => {
  if (e.target.id === 'profileModal') closeProfileModal();
  if (e.target.id === 'learningMapModal') closeLearningMap();
});
