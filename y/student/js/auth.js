/* Student Dashboard - Authentication & Session Logging */

// Module-level flag the rest of the app reads via `window.isDemoUser`.
// Set after we load the user's doc and see role === 'demo'.
window.isDemoUser = false;

// Returns the three denormalized "scope" fields every session document
// needs to carry so teacher Firestore rules can do per-doc access
// checks at read time (Phase B security). Falls back to empty strings
// if the student profile isn't cached yet - those sessions will only
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
//
// RUNS ONCE PER SIGNED-IN USER. Firebase fires onAuthStateChanged more than
// once on a normal load: first with the persisted user, then again when the ID
// token is refreshed against the server. Without a guard the ENTIRE boot below
// ran twice - the user doc re-read, the profile chips rewritten, the avatar
// reloaded, the login re-logged - and everything downstream repainted with it.
// That is the "everything refreshes a second time" on the student dashboard:
// the profile icon, the Classroom Mode tile, the assignments, all of it.
//
// student/js/hub-preload.js and student/js/placement-tile.js already guard
// their own auth listeners this way (`if (started) return` / `if (booted)
// return`); this one was the exception.
//
// Keyed on uid rather than a plain boolean so a genuine account switch in the
// same tab still boots properly.
let bootedForUid = null;

// Resolves once every classic script on the page has run (DOMContentLoaded).
function domReady() {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise(function (resolve) {
    document.addEventListener('DOMContentLoaded', function () { resolve(); }, { once: true });
  });
}

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    bootedForUid = null;                 // signed out: allow a fresh boot later
    if (window.LLHubBoot) LLHubBoot.release('signed-out');
    window.location.replace('index.html');
    return;
  }
  if (bootedForUid === user.uid) return; // token refresh, not a new sign-in
  bootedForUid = user.uid;

  // Email-verification gate (defense-in-depth - the login page already
  // enforces this, but a bookmarked URL would bypass it). Demo accounts
  // are pre-created with emailVerified:true by the admin script, so this
  // applies uniformly to every account.
  if (!user.emailVerified) {
    await auth.signOut();
    if (window.LLHubBoot) LLHubBoot.release('signed-out');
    window.location.replace('index.html');
    return;
  }

  // Account gate (mirrors the login page): a deactivated or expired account
  // must not reach the dashboard, even via a bookmarked/refreshed URL. The
  // check fails OPEN on a transient read error, so a network blip never locks
  // anyone out. Verification-due is NOT a block here (returns ok:true) - the
  // verify-gate modal handles that separately.
  if (window.AccountGate) {
    try {
      const gate = await window.AccountGate.check(db, user.uid);
      if (!gate.ok) {
        await auth.signOut();
        if (window.LLHubBoot) LLHubBoot.release('signed-out');
        window.location.replace('index.html');
        return;
      }
    } catch (e) { /* fail open - never block the dashboard on a gate error */ }
  }

  // Log login activity (we'll skip for demo a few lines down once we know
  // their role).
  let activityLoggedHere = false;

  // Load avatar + profile from user doc, and reconcile bestStreak between
  // Firestore (canonical - survives device changes) and localStorage
  // (live on this device). Use the max of both; if localStorage is ahead
  // (e.g. streak earned while offline), push that value up to Firestore.
  // WAIT FOR THE PAGE'S OTHER SCRIPTS. Everything below calls functions from
  // files that load AFTER this one - loadJourneyStats and LLJourneyCache
  // (progress.js), loadAvatarFromFirebase (avatar.js), showDemoBanner - and
  // the auth callback can run while those are still downloading. Awaiting the
  // login log used to hide that by accident; without it a fast connection hit
  // "loadJourneyStats is not defined": no percentages, and the boot hold sat
  // out its full cap. The read starts now so it still overlaps the loading.
  const userDocRead = db.collection('users').doc(user.uid).get();
  userDocRead.catch(function () {});   // handled below; no stray rejection warning meanwhile
  await domReady();

  // This student's own tile percentages from their last visit (see
  // LLJourneyCache.primeFor). NOT a "stats ready" signal: the copy is stale
  // after practice elsewhere (grammar in-page, writing on its own page,
  // another device), and revealing on it made a tile jump once the fresh
  // numbers landed. The boot hold waits for loadJourneyStats; this copy is
  // what shows if the hold's cap comes first.
  try { if (window.LLJourneyCache) LLJourneyCache.primeFor(user.uid); } catch (e) {}

  try {
    const userDoc = await userDocRead;
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
      // Tell the university logo the profile is here (js/org-brand.js). Its own
      // re-checks give up after ~20s, so a slow load would otherwise never
      // show the seal.
      try { if (window.LLOrgBrand) LLOrgBrand.refresh(); } catch (e) {}
      // Student info chips (class / level / module / year) inside the "Your
      // Assignments" box - all from THIS already-loaded doc, so 0 extra
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
      } catch (e) { /* non-fatal - chips just won't show */ }
      if (window.isDemoUser) {
        showDemoBanner();
      } else if (typeof ActivityLogger !== 'undefined') {
        // Log login only for real users - keeps activityLogs meaningful.
        // Not awaited: the log reads the user document again and writes a row,
        // two round trips the avatar and the tile percentages below used to
        // queue behind. log() catches its own errors (activity-logger.js:82-85);
        // confirmLogout made the same change for the same reason.
        ActivityLogger.logLogin();
        activityLoggedHere = true;
      }
      if (typeof loadAvatarFromFirebase === 'function') {
        loadAvatarFromFirebase(data);
      }
    }

    // (re-resolve userDoc fields below - userDoc was fetched above)
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
    // Fallback - still show whatever localStorage has
    const savedBestStreak = localStorage.getItem('bestStreak');
    if (savedBestStreak) {
      const bestStreakEl = document.getElementById('bestStreak');
      if (bestStreakEl) bestStreakEl.textContent = savedBestStreak;
    }
  }

  // The user document has landed or failed. Without it the seal cannot be
  // decided at all (org-brand.js waits for it on purpose, for demo accounts),
  // so the logo has nothing left to wait for either.
  if (window.LLHubBoot) {
    LLHubBoot.ready('user');
    if (!window.currentStudentData) LLHubBoot.ready('logo');
  }

  // Load journey stats when user logs in
  loadJourneyStats();
});

// Log session with correct field names
async function logSessionToFirestore() {
  const user = auth.currentUser;
  if (!user) return;

  // Demo users don't write sessions - keeps teacher analytics clean and
  // matches what the firestore.rules already enforce on the server.
  if (window.isDemoUser) {
    console.log('Demo mode - session not saved');
    return;
  }

  const total = currentWords.length;

  // SOME ACTIVITIES ARE NOT MARKED, and must not be recorded as if they were.
  //
  // Pronunciation is listen-and-repeat: nothing in it ever decides an answer
  // is right, so `score` stays 0 and every session was being stored as 0%.
  // That is not only a wrong label. teacher/js/activity.js averages
  // `percentage` across a student's sessions and flags anyone under 50% as
  // needing attention, so practising pronunciation dragged a student toward
  // being reported as struggling.
  //
  // Unscored activities save with percentage left UNDEFINED, which the
  // teacher views already know how to skip.
  const UNSCORED = ['pronunciation'];

  // PRONUNCIATION IS SCORED ONLY IF THE STUDENT ACTUALLY SPOKE.
  //
  // Saying the words is optional, and the microphone is missing entirely on
  // Safari and Firefox. So the session is marked only over the words that were
  // ATTEMPTED, and a student who just listened and repeated still saves an
  // unscored session exactly as before. Skipping is not a wrong answer, and a
  // browser without a recogniser must not look like a failed attempt.
  const pron = (currentActivity === 'pronunciation' && typeof getPronStats === 'function')
    ? getPronStats() : null;
  const pronScored = !!(pron && pron.attempted > 0);

  const isUnscored = UNSCORED.indexOf(currentActivity) !== -1 && !pronScored;
  const pct = isUnscored ? null
    : pronScored ? Math.round((pron.correct / Math.max(1, pron.attempted)) * 100)
    : Math.round((score / Math.max(1, total)) * 100);
  // Spread into the write, so an unscored session carries no percentage field
  // at all rather than a zero.
  const scoreFields = isUnscored
    ? { unscored: true, wordsPractised: total }
    : pronScored
      ? { score: Number(pron.correct), total: Number(pron.attempted),
          percentage: Number(pct || 0),
          correctAnswers: Number(pron.correct), totalQuestions: Number(pron.attempted),
          // Both numbers, so a teacher can see "4 of 10 words were attempted"
          // rather than reading 4/4 as a ten-word exercise.
          wordsPractised: total, wordsAttempted: Number(pron.attempted) }
      : { score: Number(score || 0), total: Number(total || 0),
          percentage: Number(pct || 0),
          correctAnswers: Number(score || 0), totalQuestions: Number(total || 0) };

  // Get current book (defaults to 'empower' if not set)
  const currentBook = typeof selectedBook !== 'undefined' ? selectedBook : 'empower';

  const vocabDetail = (typeof getVocabDetails === 'function') ? (getVocabDetails() || []) : [];
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
          ...scoreFields,
          wordsLearned: words,
          // Only when there is something in it. Attaching an empty array to
          // every session is what made pronunciation rows look expandable.
          ...(vocabDetail.length ? { vocabDetails: vocabDetail } : {}),
        ...(pronScored ? { pronDetails: getPronDetails() } : {}),
          ...(pronScored ? { pronDetails: getPronDetails() } : {}),
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
        ...scoreFields,
        wordsLearned: currentWords.map(w => w.word),
        ...(vocabDetail.length ? { vocabDetails: vocabDetail } : {}),
        ...scope,                                            // studentClass / studentLevel / studentModule
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // Running totals on the student's own document, so the teacher dashboard's
    // average is exact over the whole year instead of over whatever fell inside
    // its most-recent-1000-session window. Both write branches above converge
    // here, so one call covers them. Unscored sessions pass null and the helper
    // ignores them - counting a pronunciation session that marked nothing is
    // the bug this whole area already had once.
    if (window.LLRollup) LLRollup.record(db, user.uid, isUnscored ? null : pct);

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
  // The modal STAYS UP until the redirect. Closing it here put the live
  // dashboard back on screen, fully clickable, for as long as everything
  // below took - which on this page included an awaited Firestore write, so
  // about a second. A student could start a game in that window, and on a
  // shared machine the next person could click into the session that is
  // leaving. It now shows "Signing out..." with both buttons disabled.
  if (window.AppDialog && AppDialog.busy) AppDialog.busy('logoutModal');

  // FIRE AND FORGET, not awaited. This is the same call the teacher dashboard
  // already made non-blocking, for the same reason: the write is issued while
  // still signed in so it is in flight before signOut runs and normally
  // lands. If a slow network means it does not, the cost is one missing row
  // in the activity log - far cheaper than a second of the user's time on
  // every single logout.
  if (typeof ActivityLogger !== 'undefined') {
    try { ActivityLogger.logLogout(); } catch (_) {}
  }

  // Drop the cached journey stats. progress.js now primes the FIRST paint from
  // this copy so the hub does not redraw when the real numbers arrive, which
  // makes it load-bearing rather than a mere backup - and on a shared campus
  // machine the next student must not see the previous one's percentages, even
  // for the second before Firestore answers. Signing out is rare, so the cost
  // is one un-primed load for whoever signs in next.
  // The key is per-uid now (see progress.js), so clear this user's entry and
  // the legacy unscoped one. Any OTHER user's entry is left alone: it is
  // already unreachable for them, because priming only ever reads the key
  // belonging to the Firebase session that is actually restored.
  try {
    var _u = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
    if (_u) localStorage.removeItem('journeyStats:' + _u);
    localStorage.removeItem('journeyStats');
  } catch (_) {}

  // Same reasoning for the remembered role. student/js/teacher-return.js uses
  // it to put the "Teacher Dashboard" button up at parse time instead of after
  // the user document loads; leaving it behind would flash that button at
  // whoever signs in next on a shared machine, until their own document
  // arrived and removed it again.
  try { localStorage.removeItem('ll-role'); } catch (_) {}

  if (typeof auth !== 'undefined') {
    auth.signOut().then(() => {
      window.location.replace('index.html');
    }).catch(error => {
      console.error('Logout error:', error);
      // Give the modal back before complaining, or the student is left with a
      // dead "Signing out..." button and no way to retry or cancel.
      if (window.AppDialog && AppDialog.unbusy) AppDialog.unbusy('logoutModal');
      AppDialog.alert('Error logging out. Please try again.');
    });
  } else {
    window.location.replace('index.html');
  }
}

document.getElementById('logoutModal').addEventListener('click', (e) => {
  // Not while it is signing out: dismissing the backdrop then would put the
  // live dashboard back on screen for exactly the window this overlay exists
  // to cover.
  if (window.AppDialog && AppDialog.isBusy && AppDialog.isBusy('logoutModal')) return;
  if (e.target === e.currentTarget) closeLogoutModal();
});

/* ---------- Demo banner ---------- */
// Minimal, single-DOM-node banner so the user always knows they're in demo
// mode. No new CSS file - all inline style. Idempotent (safe to call twice).
function showDemoBanner() {
  if (document.getElementById('demoBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'demoBanner';
  bar.setAttribute('role', 'status');
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0',
    'z-index:9999',
    'background:linear-gradient(135deg,#3b82f6,#3b82f6)',
    'color:#1a1a24', 'font-weight:600',
    'text-align:center', 'padding:8px 12px',
    'font-size:0.9em',
    'box-shadow:0 2px 8px rgba(0,0,0,0.25)'
  ].join(';');
  bar.textContent = '👀 Demo mode - your progress isn’t saved. Expires in 7 days.';
  document.body.appendChild(bar);
  // Push page content down so the banner doesn't overlap the header.
  document.body.style.paddingTop = (parseInt(getComputedStyle(document.body).paddingTop) || 0) + 36 + 'px';
}
