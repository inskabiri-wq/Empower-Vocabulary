/* Student Dashboard - Authentication & Session Logging */

// Module-level flag the rest of the app reads via `window.isDemoUser`.
// Set after we load the user's doc and see role === 'demo'.
window.isDemoUser = false;

// Returns the three denormalized "scope" fields every session document
// needs to carry so teacher Firestore rules can do per-doc access
// checks at read time (Phase B security). Falls back to empty strings
// if the student profile isn't cached yet — those sessions will only
// be visible to admin until they're backfilled by the migration script.
function studentScopeFields() {
  const d = window.currentStudentData || {};
  return {
    studentClass:  d.studentClass  || '',
    studentLevel:  d.level         || '',
    studentModule: d.module        || ''
  };
}
window.studentScopeFields = studentScopeFields;

// Auth Protection
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Email-verification gate (defense-in-depth — the login page already
  // enforces this, but a bookmarked URL would bypass it). Demo accounts
  // are pre-created with emailVerified:true by the admin script, so this
  // applies uniformly to every account.
  if (!user.emailVerified) {
    await auth.signOut();
    window.location.href = 'index.html';
    return;
  }

  // Log login activity (we'll skip for demo a few lines down once we know
  // their role).
  let activityLoggedHere = false;

  // Load avatar + profile from user doc, and reconcile bestStreak between
  // Firestore (canonical — survives device changes) and localStorage
  // (live on this device). Use the max of both; if localStorage is ahead
  // (e.g. streak earned while offline), push that value up to Firestore.
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      window.isDemoUser = (data.role === 'demo');
      // Cache the student's profile globally so the various session
      // writers (vocab, reading-exam, listening-exam, etc.) can stamp
      // studentClass / studentLevel / studentModule onto every session
      // they create. The teacher dashboard relies on these denormalized
      // fields to scope what each teacher can read at the Firestore-rule
      // layer (no more "any teacher reads any session" via the console).
      window.currentStudentData = data;
      // Student info chips (class / level / module / year) inside the "Your
      // Assignments" box — all from THIS already-loaded doc, so 0 extra
      // Firestore reads. Only non-empty values are shown.
      try {
        var anyChip = false;
        [['infoClass',  data.studentClass,  'Class'],
         ['infoLevel',  data.level,         'Level'],
         ['infoModule', data.module,        'Module'],
         ['infoYear',   data.academicYear,  '']
        ].forEach(function (row) {
          var el = document.getElementById(row[0]);
          if (!el) return;
          var v = (row[1] == null ? '' : String(row[1])).trim();
          if (v) {
            var label = row[2];
            // Don't double a label the value already carries (e.g. module stored
            // as "Module 1" → "Module 1", not "Module Module 1").
            var text = (label && v.toLowerCase().indexOf(label.toLowerCase()) === 0)
              ? v : (label ? label + ' ' + v : v);
            el.textContent = text; el.style.display = ''; anyChip = true;
          } else { el.style.display = 'none'; }
        });
        var chipsWrap = document.getElementById('studentInfoChips');
        if (chipsWrap) chipsWrap.style.display = anyChip ? '' : 'none';
      } catch (e) { /* non-fatal — chips just won't show */ }
      if (window.isDemoUser) {
        showDemoBanner();
      } else if (typeof ActivityLogger !== 'undefined') {
        // Log login only for real users — keeps activityLogs meaningful.
        await ActivityLogger.logLogin();
        activityLoggedHere = true;
      }
      if (typeof loadAvatarFromFirebase === 'function') {
        loadAvatarFromFirebase(data);
      }
    }

    // (re-resolve userDoc fields below — userDoc was fetched above)
    const fsBest = (userDoc.exists && userDoc.data().stats && userDoc.data().stats.bestStreak) || 0;
    const lsBest = parseInt(localStorage.getItem('bestStreak') || '0', 10) || 0;
    const trueBest = Math.max(fsBest, lsBest);
    if (trueBest > 0) {
      localStorage.setItem('bestStreak', String(trueBest));
      const el = document.getElementById('bestStreak');
      if (el) el.textContent = String(trueBest);
    }
    // If this device held a higher value than the cloud, push it up so
    // other devices see it next time they log in.
    if (lsBest > fsBest && typeof syncBestStreakToFirestore === 'function') {
      syncBestStreakToFirestore(lsBest);
    }
  } catch (e) {
    console.log('Could not load user doc from Firebase:', e);
    // Fallback — still show whatever localStorage has
    const savedBestStreak = localStorage.getItem('bestStreak');
    if (savedBestStreak) {
      const bestStreakEl = document.getElementById('bestStreak');
      if (bestStreakEl) bestStreakEl.textContent = savedBestStreak;
    }
  }

  // Load journey stats when user logs in
  loadJourneyStats();
});

// Log session with correct field names
async function logSessionToFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  // Demo users don't write sessions — keeps teacher analytics clean and
  // matches what the firestore.rules already enforce on the server.
  if (window.isDemoUser) {
    console.log('Demo mode — session not saved');
    return;
  }

  const total = currentWords.length;
  const pct = Math.round((score / Math.max(1, total)) * 100);
  
  // Get current book (defaults to 'empower' if not set)
  const currentBook = typeof selectedBook !== 'undefined' ? selectedBook : 'empower';

  const scope = studentScopeFields();

  try {
    // If "all" units selected, group words by their actual unit and log separately
    if (selectedUnit === 'all') {
      const wordsByUnit = {};
      currentWords.forEach(w => {
        const unit = w.unit || 'unknown';
        if (!wordsByUnit[unit]) {
          wordsByUnit[unit] = [];
        }
        wordsByUnit[unit].push(w.word);
      });

      for (const [unit, words] of Object.entries(wordsByUnit)) {
        await db.collection('sessions').add({
          userId: user.uid,
          userName: user.displayName || user.email || 'Student',
          book: currentBook,
          activity: currentActivity || 'unknown',
          level: selectedLevel || '',
          unit: unit,
          score: Number(score || 0),
          total: Number(total || 0),
          percentage: Number(pct || 0),
          correctAnswers: Number(score || 0),
          totalQuestions: Number(total || 0),
          wordsLearned: words,
          ...scope,                                           // studentClass / studentLevel / studentModule
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } else {
      await db.collection('sessions').add({
        userId: user.uid,
        userName: user.displayName || user.email || 'Student',
        book: currentBook,
        activity: currentActivity || 'unknown',
        level: selectedLevel || '',
        unit: selectedUnit || 'all',
        score: Number(score || 0),
        total: Number(total || 0),
        percentage: Number(pct || 0),
        correctAnswers: Number(score || 0),
        totalQuestions: Number(total || 0),
        wordsLearned: currentWords.map(w => w.word),
        ...scope,                                            // studentClass / studentLevel / studentModule
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // Refresh journey stats after logging
    await loadJourneyStats();
    
    // Log activity for admin tracking
    if (typeof ActivityLogger !== 'undefined') {
      await ActivityLogger.logPracticeCompleted({
        book: currentBook,
        level: selectedLevel || '',
        unit: selectedUnit || 'all',
        activity: currentActivity || 'unknown',
        score: pct,
        wordsCount: total
      });
    }
    
    console.log('Session logged successfully');
  } catch (e) {
    console.error('Failed to log session:', e);
  }
}

function logout() {
  openLogoutModal();
}

// Custom Logout Modal Functions
function openLogoutModal() {
  document.getElementById('logoutModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLogoutModal() {
  document.getElementById('logoutModal').classList.remove('active');
  document.body.style.overflow = '';
}

async function confirmLogout() {
  closeLogoutModal();
  
  // Log logout activity before signing out
  if (typeof ActivityLogger !== 'undefined') {
    await ActivityLogger.logLogout();
  }
  
  if (typeof auth !== 'undefined') {
    auth.signOut().then(() => {
      window.location.href = 'index.html';
    }).catch(error => {
      console.error('Logout error:', error);
      AppDialog.alert('Error logging out. Please try again.');
    });
  } else {
    window.location.href = 'index.html';
  }
}

document.getElementById('logoutModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeLogoutModal();
});

/* ---------- Demo banner ---------- */
// Minimal, single-DOM-node banner so the user always knows they're in demo
// mode. No new CSS file — all inline style. Idempotent (safe to call twice).
function showDemoBanner() {
  if (document.getElementById('demoBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'demoBanner';
  bar.setAttribute('role', 'status');
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'z-index:9999',
    'background:linear-gradient(135deg,#f59e0b,#f97316)',
    'color:#1a1a24', 'font-weight:600',
    'text-align:center', 'padding:8px 12px',
    'font-size:0.9em',
    'box-shadow:0 2px 8px rgba(0,0,0,0.25)'
  ].join(';');
  bar.textContent = '👀 Demo mode — your progress isn’t saved. Expires in 7 days.';
  document.body.appendChild(bar);
  // Push page content down so the banner doesn't overlap the header.
  document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop) || 0) + 36 + 'px';
}
