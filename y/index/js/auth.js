/* ============================================
   AUTH.JS - Authentication Functions
   Empower Vocabulary Trainer
   ============================================ */

// Flag to prevent onAuthStateChanged from running during registration
let isRegistering = false;

// Phase H — domain allowlist is now DATA-DRIVEN, sourced from
// /settings/organizations via window.OrgRegistry (org-registry.js).
// emailIsFsm() is kept under its historical name for minimum churn,
// but it now means "email belongs to an allowed organization." If
// OrgRegistry hasn't loaded yet (very early registration attempt),
// we fall back to the FSM hardcoded defaults so the user isn't
// blocked by a race. Firestore rules re-verify on every write.
function emailIsFsm(email) {
  if (typeof window.OrgRegistry !== 'undefined' && typeof window.OrgRegistry.checkEmail === 'function') {
    return window.OrgRegistry.checkEmail(email).ok;
  }
  // Fallback — same hardcoded FSM list as the rule's grandfather branch.
  const e = (email || '').toLowerCase().trim();
  return e.endsWith('@fsm.edu.tr') || e.endsWith('@stu.fsm.edu.tr');
}

// Friendly error message that lists the currently-allowed domains,
// for use when registration / login is rejected. Falls back to the
// generic FSM message if OrgRegistry isn't ready yet.
function _allowedDomainsHumanMessage() {
  if (typeof window.OrgRegistry !== 'undefined' && typeof window.OrgRegistry.allowedDomains === 'function') {
    const ds = window.OrgRegistry.allowedDomains();
    if (ds && ds.length) {
      return 'Only these email domains can register: ' +
        ds.map(d => '@' + d).join(', ');
    }
  }
  return 'Only FSM email addresses (@fsm.edu.tr or @stu.fsm.edu.tr) can register.';
}

/* ---------- Check teacher whitelist from Firestore ---------- */
async function checkIfTeacher(email) {
  try {
    const doc = await db.collection('settings').doc('teacherEmails').get();
    if (doc.exists) {
      const teacherEmails = (doc.data().teacherEmails || [])
        .map(e => String(e).toLowerCase().trim());

      if (teacherEmails.includes(email.toLowerCase().trim())) {
        return 'teacher';
      }
    }
    return 'student';
  } catch (error) {
    console.error('Error checking teacher status:', error);
    return 'student';
  }
}

/* ---------- On every login/refresh, recalc role from whitelist ---------- */
auth.onAuthStateChanged(user => {
  console.log('onAuthStateChanged fired. isRegistering:', isRegistering, 'user:', user?.email);
  
  // Skip during registration - register() handles its own redirect
  if (isRegistering) {
    console.log('Skipping onAuthStateChanged during registration');
    return;
  }
  
  if (user) {
    checkUserRoleAndRedirect(user);
  }
});

async function checkUserRoleAndRedirect(user) {
  try {
    const email = user.email || '';

    // Domain check FIRST - block non-FSM emails
    if (!emailIsFsm(email)) {
      await auth.signOut();
      showMessage('Access denied. Only FSM university emails are allowed.', 'error');
      return;
    }

    // Email verification gate — block unverified accounts from logging in.
    if (!user.emailVerified) {
      // Cache email so the resend button works after we sign them out below.
      try { sessionStorage.setItem('pendingVerificationEmail', email); } catch (_) {}
      showVerificationPrompt(email);
      await auth.signOut();
      return;
    }

    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();

    // Role is the source-of-truth on the user doc (admin-controlled).
    // We do NOT try to recompute it from the whitelist on each login,
    // because firestore.rules block non-admin role changes — admin must
    // manually promote a user to 'teacher' via the Firebase Console.
    let role = 'student';
    if (userDoc.exists) {
      role = userDoc.data().role || 'student';
      // Touch lastLogin / name only — never role.
      await userRef.update({
        email: email,
        name: user.displayName || userDoc.data().name || '',
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Defensive: doc should already exist (created at register), but if a
      // user signed up through a path that skipped doc creation, make one as
      // a student. They can be promoted later by admin.
      await userRef.set({
        email: email,
        name: user.displayName || '',
        role: 'student',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Teachers go straight to their dashboard — they're not subject
    // to the student-account gate.
    if (role === 'teacher') {
      window.location.replace('teacher-dashboard.html');
      return;
    }

    // Students: run the account gate (yearly expiry + bi-monthly
    // verification flag) BEFORE redirecting to the dashboard.
    if (window.AccountGate) {
      const gate = await window.AccountGate.check(db, user.uid);
      if (!gate.ok) {
        // Account is expired or deactivated — sign out and surface
        // the message inline on the login page. The auth callback
        // that would otherwise redirect won't re-fire because the
        // sign-out moves the user back to anonymous state.
        try { await auth.signOut(); } catch (_) {}
        const msgBox = document.getElementById('messageBox') ||
                       document.querySelector('.login-card') ||
                       document.body;
        msgBox.appendChild(window.AccountGate.renderInlineBlocker(gate.message));
        return;
      }
    }
    // .replace() so /index.html doesn't linger in browser history —
    // see back-nav.js for the full rationale.
    window.location.replace('student-dashboard.html');
  } catch (error) {
    console.error('Error checking role / redirecting:', error);
    window.location.replace('student-dashboard.html');
  }
}

/* ---------- Login ---------- */
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  setLoading('loginBtn', true);

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    // If the account isn't verified yet, show the resend prompt and sign out.
    // (checkUserRoleAndRedirect also enforces this, but we short-circuit here
    // so the "Login successful" toast doesn't flash for unverified users.)
    if (cred.user && !cred.user.emailVerified) {
      try { sessionStorage.setItem('pendingVerificationEmail', email); } catch (_) {}
      showVerificationPrompt(email);
      await auth.signOut();
      setLoading('loginBtn', false);
      return;
    }
    // redirect happens in onAuthStateChanged → checkUserRoleAndRedirect
    showMessage('Login successful! Redirecting...', 'success');
  } catch (error) {
    console.error('Login error:', error);
    let message = 'Login failed. Please try again.';
    if (error.code === 'auth/user-not-found') message = 'No account found with this email.';
    if (error.code === 'auth/wrong-password') message = 'Incorrect password.';
    if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
    if (error.code === 'auth/invalid-credential') message = 'Invalid email or password.';
    showMessage(message, 'error');
    setLoading('loginBtn', false);
  }
}

/* ---------- Register ---------- */
async function register() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const level = document.getElementById('regLevel').value;
  const classLetter = document.getElementById('regClassLetter').value;
  const classNumber = document.getElementById('regClassNumber').value;
  const module = document.getElementById('regModule').value;
  const academicYear = document.getElementById('regYear').value;

  if (!name || !email || !password || !level || !classLetter || !classNumber || !module || !academicYear) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  // Validate class number (000-999)
  if (classNumber < 0 || classNumber > 999) {
    showMessage('Class number must be between 000 and 999', 'error');
    return;
  }

  // Combine class letter + number (e.g., "B125")
  const studentClass = classLetter + classNumber;

  // Email-domain check (Phase H — dynamic via OrgRegistry).
  if (!emailIsFsm(email)) {
    showMessage(_allowedDomainsHumanMessage(), 'error');
    return;
  }

  if (password.length < 8) {
    showMessage('Password must be at least 8 characters', 'error');
    return;
  }

  setLoading('registerBtn', true);
  
  // Set flag to prevent onAuthStateChanged from interfering
  isRegistering = true;

  try {
    console.log('1. Creating auth user...');
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    console.log('2. Auth user created:', userCredential.user.uid);
    
    await userCredential.user.updateProfile({ displayName: name });
    console.log('3. Profile updated');

    // Always create as 'student'. Teacher promotion is admin-only (via the
    // Firebase Console), which prevents self-promotion at registration time.
    console.log('4. Creating Firestore document...');
    await db.collection('users').doc(userCredential.user.uid).set({
      name,
      email,
      level,
      studentClass,
      module,
      academicYear,
      role: 'student',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      stats: {
        totalSessions: 0,
        totalWordsStudied: 0,
        bestStreak: 0,
        currentStreak: 0,
        levelProgress: {
          A2: { studied: 0, mastered: 0 },
          B1: { studied: 0, mastered: 0 },
          'B1+': { studied: 0, mastered: 0 },
          B2: { studied: 0, mastered: 0 }
        }
      }
    });
    console.log('6. Firestore document created');

    // Send verification email and sign the user out — they must verify
    // before they can sign in. This blocks fake-email accounts from ever
    // reaching the dashboard.
    try {
      await userCredential.user.sendEmailVerification();
      console.log('7. Verification email sent');
    } catch (verifyErr) {
      // Non-fatal: account exists, user can request resend on the login screen.
      console.warn('Could not send verification email:', verifyErr);
    }

    await auth.signOut();
    isRegistering = false;
    try { sessionStorage.setItem('pendingVerificationEmail', email); } catch (_) {}

    setLoading('registerBtn', false);
    showVerificationPrompt(email, /* justRegistered */ true);
    return;

  } catch (error) {
    console.error('Registration error:', error);
    isRegistering = false; // Reset flag on error
    let message = 'Registration failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists.';
    if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
    if (error.code === 'auth/weak-password') message = 'Password is too weak.';
    showMessage(message, 'error');
    setLoading('registerBtn', false);
  }
}

/* ---------- Password reset ---------- */
async function resetPassword() {
  const email = document.getElementById('loginEmail').value.trim();
  
  if (!email) {
    showMessage('Please enter your email address first', 'error');
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    showMessage('Password reset email sent! Check your inbox (and spam).', 'success');
  } catch (error) {
    console.error('Password reset error:', error);
    let message = 'Could not send reset email. Please check the email address.';
    if (error.code === 'auth/user-not-found') {
      message = 'There is no user with this email.';
    }
    showMessage(message, 'error');
  }
}

/* ---------- Google Sign-In ---------- */
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await auth.signInWithPopup(provider);
    const email = result.user.email || '';

    // Domain check (Phase H — dynamic via OrgRegistry).
    if (!emailIsFsm(email)) {
      await auth.signOut();
      showMessage('Access denied. ' + _allowedDomainsHumanMessage(), 'error');
      return;
    }

    // Google accounts are already verified, but double-check the token claim
    // — some providers return unverified accounts.
    if (!result.user.emailVerified) {
      try { sessionStorage.setItem('pendingVerificationEmail', email); } catch (_) {}
      showVerificationPrompt(email);
      await auth.signOut();
      return;
    }

    // Success - onAuthStateChanged will handle redirect
    showMessage('Login successful! Redirecting...', 'success');

  } catch (error) {
    console.error('Google sign-in error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      showMessage('Sign-in cancelled.', 'error');
    } else {
      showMessage('Google sign-in failed: ' + error.message, 'error');
    }
  }
}

/* ---------- Email verification helpers ---------- */

// Track last resend time to throttle client-side (Firebase also throttles).
let lastResendAt = 0;

async function resendVerification() {
  const now = Date.now();
  if (now - lastResendAt < 60_000) {
    const wait = Math.ceil((60_000 - (now - lastResendAt)) / 1000);
    showMessage(`Please wait ${wait}s before requesting another email.`, 'error');
    return;
  }

  // We need a signed-in user to call sendEmailVerification(). If they're
  // signed out (the normal case here), we ask them to enter their password
  // briefly so we can re-authenticate, send, and sign out again.
  const email = (() => {
    try { return sessionStorage.getItem('pendingVerificationEmail') || ''; } catch (_) { return ''; }
  })();

  if (!email) {
    showMessage('Please enter your email in the Sign In form first, then click Resend.', 'error');
    return;
  }

  const password = await AppDialog.prompt(
    'Confirm your password to resend the verification email:',
    { title: 'Resend verification', password: true, okLabel: 'Resend', icon: '✉️' });
  if (!password) return;

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await cred.user.sendEmailVerification();
    await auth.signOut();
    lastResendAt = Date.now();
    showMessage('Verification email sent. Check your inbox (and spam).', 'success');
  } catch (error) {
    console.error('Resend verification error:', error);
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      showMessage('Wrong password — could not resend.', 'error');
    } else if (error.code === 'auth/too-many-requests') {
      showMessage('Too many requests. Please try again later.', 'error');
    } else {
      showMessage('Could not resend verification email.', 'error');
    }
  }
}

// Renders the "please verify your email" panel inline on the login screen.
// Called after register, or after a sign-in attempt with an unverified account.
function showVerificationPrompt(email, justRegistered) {
  const panel = document.getElementById('verifyPanel');
  if (!panel) {
    // Fallback if the HTML element isn't on the page for some reason —
    // just use the existing message box.
    showMessage(
      justRegistered
        ? `Account created. We've sent a verification link to ${email}. Verify, then sign in.`
        : `Please verify ${email} before signing in. Check your inbox.`,
      'success'
    );
    return;
  }
  const emailSpan = document.getElementById('verifyEmail');
  if (emailSpan) emailSpan.textContent = email;
  panel.style.display = 'block';
}

function hideVerificationPrompt() {
  const panel = document.getElementById('verifyPanel');
  if (panel) panel.style.display = 'none';
}

// (Demo sign-in is no longer button-based. Demo accounts are shared
// credentials pre-created by admin via tools/create-demo-accounts.js;
// visitors log in via the normal Sign In form. Their user doc has
// role:'demo', which applies the same restrictions as before via rules
// and the client guards in y/student/js/auth.js.)
