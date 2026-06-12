/* Teacher Dashboard - Config & State */

// Security: HTML escape to prevent XSS via user-controlled content
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmTTictWJmxVxj9frqSODPUjOgpRPPNzU",
  authDomain: "empower-vocabulary-practice.firebaseapp.com",
  projectId: "empower-vocabulary-practice",
  storageBucket: "empower-vocabulary-practice.firebasestorage.app",
  messagingSenderId: "136270199832",
  appId: "1:136270199832:web:174222066ef1cbdc8f576d",
  measurementId: "G-1BBXBVEP5C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global State
let currentUser = null;
let userData = null;
let allStudents = [];
let allSessions = [];
let currentUserData = null;
const ADMIN_EMAIL = 'akabiriaslifar@fsm.edu.tr';

// Confirm Modal State
let confirmCallback = null;

// ===== Debug / Fail-safe =====
console.log('[boot] teacher-dashboard script loaded', new Date().toISOString(), location.href);

function fatal(msg) {
  console.error('[fatal]', msg);
  try {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'block';
    document.getElementById('accessInfo').textContent = String(msg);
  } catch (e) {
    // ignore
  }
}

window.addEventListener('error', (e) => {
  fatal(e?.error?.message || e?.message || 'Unknown script error');
});

window.addEventListener('unhandledrejection', (e) => {
  fatal(e?.reason?.message || e?.reason || 'Unhandled promise rejection');
});

// ============================================
// AUTH & ACCESS
// ============================================
function isAdmin() {
  return auth.currentUser?.email === ADMIN_EMAIL;
}

auth.onAuthStateChanged(async (user) => {
  console.log('[auth] onAuthStateChanged', user && user.email);
  if (!user) {
    console.log('[auth] no user, redirecting to index.html');
    window.location.href = 'index.html';
    return;
  }

  try {
    currentUser = user;
    console.log('[auth] currentUser set:', currentUser.email);
    await checkAccess();
  } catch (err) {
    console.error('[auth] error during access check:', err);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'block';
    document.getElementById('accessInfo').textContent = 'Error during auth: ' + err.message;
  }
});

async function checkAccess() {
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    
    if (!doc.exists) {
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('accessInfo').textContent = 'User document not found. Please contact admin at akabiriaslifar@fsm.edu.tr';
      return;
    }
    
    userData = doc.data();
    
    if (userData.role !== 'teacher') {
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('accessInfo').textContent = 
        'Your role is: ' + userData.role + '. Contact admin at akabiriaslifar@fsm.edu.tr for teacher access.';
      return;
    }
    
    await loadDashboard();
    
  } catch (error) {
    console.error('Error checking access:', error);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'block';
    
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
      document.getElementById('accessInfo').textContent = 'Permission denied. Contact admin at akabiriaslifar@fsm.edu.tr';
    } else {
      document.getElementById('accessInfo').textContent = 'Error: ' + error.message;
    }
  }
}

async function loadDashboard() {
  // Declared OUTSIDE try/catch so the catch block can clear it on error.
  // (Previously declared with `const` inside try → out of scope in catch,
  // which made errors silently get overwritten by the timeout 30s later.)
  let loadTimeout = null;
  try {
    console.log('[loadDashboard] start');
    // Fallback: if loading doesn't finish in 30s, stop spinner and show message
    loadTimeout = setTimeout(() => {
      console.error('[loadDashboard] timeout: loading taking too long');
      try {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('accessDenied').style.display = 'block';
        document.getElementById('accessInfo').textContent = 'Loading timed out. Check console for details.';
      } catch (e) {
        console.error('Error showing timeout UI:', e);
      }
    }, 30000);
    
    // Get current user data
    const currentUserDoc = await db.collection('users').doc(auth.currentUser.uid).get();
    currentUserData = currentUserDoc.data();

    // EARLY EXIT for teachers with no scope. Firestore rules now require
    // teacherHasScope() (any assignedClasses / assignedYear / assignedModule)
    // before student data can be read. Without this client-side check, the
    // queries below would fail with "permission-denied" and break the
    // dashboard rather than just showing an empty state.
    const _hasAnyAssignmentNow = isAdmin() || (
      currentUserData && (
        (currentUserData.assignedClasses && currentUserData.assignedClasses.length > 0) ||
        currentUserData.assignedYear ||
        currentUserData.assignedModule
      )
    );
    if (!_hasAnyAssignmentNow) {
      allStudents = [];
      allSessions = [];
      populateClassFilter();
      updateStats();
      renderStudentsTable();
      if (typeof loadRecentActivity === 'function') loadRecentActivity();
      if (typeof updateLevelDistribution === 'function') updateLevelDistribution();
      if (typeof renderOverviewV2 === 'function') renderOverviewV2();
      clearTimeout(loadTimeout);
      document.getElementById('loadingScreen').style.display = 'none';
      document.getElementById('mainContent').style.display = 'flex';
      console.log('[loadDashboard] teacher has no scope — empty dashboard');
      return;
    }

    // Build scoped queries.
    //
    // Phase B: Firestore rules now require per-doc scope match for
    // non-admin teachers reading /users and /sessions. The broad
    // unfiltered queries would be rejected (the rule denies any single
    // out-of-scope doc, which fails the whole query). We add .where()
    // filters so the server only returns docs the teacher is allowed
    // to read — that satisfies the rule AND fetches less data.
    let studentsQuery = db.collection('users').where('role', '==', 'student');
    let sessionsQuery = db.collection('sessions').orderBy('createdAt', 'desc');

    if (!isAdmin()) {
      const ac = currentUserData.assignedClasses;
      const ay = currentUserData.assignedYear;
      const am = currentUserData.assignedModule;
      if (ac && ac.length > 0) {
        // Firestore 'in' supports up to 30 values. For typical teachers
        // (1-5 classes) this is fine. If you ever assign more than 30,
        // we'll have to chunk into multiple queries.
        const classes = ac.slice(0, 30);
        studentsQuery = studentsQuery.where('studentClass', 'in', classes);
        sessionsQuery = sessionsQuery.where('studentClass', 'in', classes);
      }
      if (ay) {
        studentsQuery = studentsQuery.where('level', '==', ay);
        sessionsQuery = sessionsQuery.where('studentLevel', '==', ay);
      }
      if (am) {
        studentsQuery = studentsQuery.where('module', '==', am);
        sessionsQuery = sessionsQuery.where('studentModule', '==', am);
      }
    }

    // Execute the scoped queries — wrapped in try/catch each so we can
    // tell WHICH one is failing, what the user's effective filters are,
    // and the exact Firestore error. Remove this verbose logging once
    // the dashboard is stable.
    console.log('[loadDashboard] currentUserData.role =', currentUserData && currentUserData.role);
    console.log('[loadDashboard] assignedClasses =', JSON.stringify(currentUserData && currentUserData.assignedClasses));
    console.log('[loadDashboard] assignedYear    =', JSON.stringify(currentUserData && currentUserData.assignedYear));
    console.log('[loadDashboard] assignedModule  =', JSON.stringify(currentUserData && currentUserData.assignedModule));

    allStudents = [];
    try {
      console.log('[loadDashboard] running studentsQuery...');
      const studentsSnap = await studentsQuery.get();
      studentsSnap.forEach(doc => allStudents.push({ id: doc.id, ...doc.data() }));
      console.log('[loadDashboard] studentsQuery OK, returned', allStudents.length, 'docs');
    } catch (err) {
      console.error('[loadDashboard] studentsQuery FAILED:', err.code, err.message);
      throw err;
    }

    // ── READ-QUOTA GUARD ──────────────────────────────────────
    // The free Spark tier allows 50K Firestore reads/day. This query used
    // to read EVERY session doc on every dashboard load (thousands), which
    // blows the quota fast under repeated reloads. Fix:
    //   1) keep the lifetime "Total Sessions" accurate via the cheap count()
    //      aggregation (~1 read per 1000 docs), then
    //   2) only FETCH the most recent N docs — that's all the activity feed,
    //      popularity, and recent-score analytics actually need.
    window.totalSessionsCount = null;
    try {
      const _agg = await sessionsQuery.count().get();
      window.totalSessionsCount = _agg.data().count;
    } catch (e) {
      console.warn('[loadDashboard] count() unavailable, falling back to fetched length:', e && e.code);
    }
    sessionsQuery = sessionsQuery.limit(1000);

    allSessions = [];
    try {
      console.log('[loadDashboard] running sessionsQuery (capped to 1000)...');
      const sessionsSnap = await sessionsQuery.get();
      sessionsSnap.forEach(doc => allSessions.push({ id: doc.id, ...doc.data() }));
      console.log('[loadDashboard] sessionsQuery OK, returned', allSessions.length, 'docs');
    } catch (err) {
      console.error('[loadDashboard] sessionsQuery FAILED:', err.code, err.message);
      throw err;
    }
    
    // Populate class filter
    populateClassFilter();
    
    // Update UI
    updateStats();
    renderStudentsTable();
    loadRecentActivity();
    updateLevelDistribution();
    checkStrugglingStudents();

    // v2 overview render — runs LAST so it reads the freshly-populated
    // allStudents + allSessions globals. Wrapped in typeof guard so the
    // page still works if overview-v2.js fails to load.
    if (typeof renderOverviewV2 === 'function') {
      renderOverviewV2();
    }

    // Show admin tab & activity logs section only for admin
    if (isAdmin()) {
      document.getElementById('adminTabBtn').style.display = 'flex';
      // Mirror onto the v2 sidebar's Admin item (hidden by default)
      const t2Admin = document.getElementById('t2sidebarAdmin');
      if (t2Admin) t2Admin.style.display = '';
      const logsSection = document.getElementById('activityLogsSection');
      if (logsSection) logsSection.style.display = 'block';
      if (typeof ActivityAdmin !== 'undefined' && typeof ActivityAdmin.init === 'function') {
        ActivityAdmin.init();
      }
      loadTeachers();
    }

    // finished loading successfully -> clear fallback timeout
    clearTimeout(loadTimeout);
    console.log('[loadDashboard] finished successfully');
    document.getElementById('loadingScreen').style.display = 'none';
    // v2 layout uses a sidebar + main column flex shell. The legacy
    // 'block' display would collapse that layout into a single column,
    // so we reveal as 'flex'. Any non-v2 fallback CSS still works because
    // mainContent has only one direct flex container in the page.
    document.getElementById('mainContent').style.display = 'flex';
    
  } catch (error) {
    // Clear the 30s fallback timeout — otherwise it fires later and
    // overwrites this real error message with "Loading timed out".
    clearTimeout(loadTimeout);
    console.error('Error loading dashboard:', error);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'block';
    
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
      document.getElementById('accessInfo').textContent = 'Permission denied. Contact admin at akabiriaslifar@fsm.edu.tr for access.';
    } else {
      document.getElementById('accessInfo').textContent = 'Error loading data: ' + error.message;
    }
  }
}

function populateClassFilter() {
  const classes = [...new Set(allStudents.map(s => s.studentClass).filter(Boolean))].sort();
  const select = document.getElementById('classFilter');
  
  select.innerHTML = '<option value="">All Classes</option>';
  
  classes.forEach(cls => {
    const option = document.createElement('option');
    option.value = cls;
    option.textContent = cls;
    select.appendChild(option);
  });
}
