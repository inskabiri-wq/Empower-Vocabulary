/* ============================================
   STYLE 6: FLOATING CARD - Login Page JavaScript
   Lingualab
   ============================================ */

// ============================================
// PARTICLE ANIMATION
// ============================================

const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

const particles = [];
const particleCount = 60;

class Particle {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.4;
    this.speedY = (Math.random() - 0.5) * 0.4;
    this.opacity = Math.random() * 0.4 + 0.1;
    this.color = Math.random() > 0.5 ? '#3b82f6' : '#2563eb';
  }
  
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.reset();
    }
  }
  
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle());
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  
  // Draw connections
  particles.forEach((p1, i) => {
    particles.slice(i + 1).forEach(p2 => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 100) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.08 * (1 - dist/100)})`;
        ctx.stroke();
      }
    });
  });
  
  requestAnimationFrame(animateParticles);
}

animateParticles();
window.addEventListener('resize', resizeCanvas);

// ============================================
// FIREBASE CONFIGURATION
// ============================================

// THE LOGIN PAGE. Firebase is started by js/firebase-init.js, which reads the
// project from js/tenant.js. This file used to name one project directly,
// and this page is the one that matters most: a second university deployed
// with that line would have authenticated its students against the wrong
// project's user list and read that project's data.
if (!firebase.apps.length) {
  throw new Error('login: js/tenant.js + js/firebase-init.js must load first.');
}
const auth = firebase.auth();
const db = firebase.firestore();

// LOCAL TESTING ONLY: talk to the Firebase emulators instead of production.
// Runs only when BOTH are true: the page is served from localhost AND the
// tester has set localStorage.useEmulators = '1'. Production domains and
// normal local previews are untouched. See y/tools/README-emulator-e2e.md.
try {
  if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
      localStorage.getItem('useEmulators') === '1') {
    auth.useEmulator('http://127.0.0.1:9099');
    db.useEmulator('127.0.0.1', 8080);
    console.warn('[emulator] connected to LOCAL Auth (9099) + Firestore (8080)');
  }
} catch (e) { /* never block app boot */ }

// App Check: intentionally NOT initialized. The app-check-compat SDK is not
// loaded on any page, so firebase.appCheck() throws and protection never
// activated (this used to fail on every load). If bot/abuse protection is
// wanted later, load firebase-app-check-compat.js, configure a reCAPTCHA key
// for the live domain, and enable enforcement in the console as a deliberate,
// tested rollout - a misconfigured App Check can block ALL traffic.

// ============================================
// GLOBAL STATE FOR GOOGLE SIGN-IN COMPLETION
// ============================================
let pendingGoogleUser = null;

// ============================================
// UI FUNCTIONS
// ============================================

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));
  
  if (tab === 'login') {
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else if (tab === 'register') {
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('registerForm').classList.add('active');
  } else if (tab === 'complete') {
    // Hide tabs for completion form
    document.querySelector('.tabs').style.display = 'none';
    document.getElementById('googleCompleteForm').classList.add('active');
  }
  
  hideMessage();
}

function showMessage(message, type) {
  const box = document.getElementById('messageBox');
  box.textContent = message;
  box.className = 'message ' + type;
}

function hideMessage() {
  document.getElementById('messageBox').className = 'message';
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Please wait...';
  } else {
    btn.disabled = false;
    if (btnId === 'loginBtn') btn.innerHTML = 'Sign In →';
    else if (btnId === 'registerBtn') btn.innerHTML = 'Create Account →';
    else if (btnId === 'completeBtn') btn.innerHTML = 'Complete Registration →';
  }
}

// ============================================
// TOS MODAL
// ============================================

function openTosModal(event) {
  if (event) event.preventDefault();
  const modal = document.getElementById('tosModal');
  if (modal) modal.classList.add('open');
}

function closeTosModal() {
  const modal = document.getElementById('tosModal');
  if (modal) modal.classList.remove('open');
}

function showLang(lang) {
  const enContent = document.getElementById('tosEN');
  const trContent = document.getElementById('tosTR');
  const enBtn = document.getElementById('langEN');
  const trBtn = document.getElementById('langTR');
  
  if (lang === 'en') {
    enContent.style.display = 'block';
    trContent.style.display = 'none';
    enBtn.classList.add('active');
    trBtn.classList.remove('active');
  } else {
    enContent.style.display = 'none';
    trContent.style.display = 'block';
    trBtn.classList.add('active');
    enBtn.classList.remove('active');
  }
}

// ============================================
// AUTH FUNCTIONS
// ============================================

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

// Set true while register() runs its own create -> send-verification ->
// sign-out flow, so this handler doesn't fight it (it fires on account
// creation, before the profile doc + verification email are done).
let registrationInProgress = false;

// ============================================
// AUTH STATE CHANGE HANDLER
// ============================================
auth.onAuthStateChanged(async (user) => {
  // An ANONYMOUS session is a classroom game (the join screens sign phones in
  // anonymously on this same site), not someone signing in. It used to fall
  // through to the email check below, get signed out, and pop "University
  // email required" at a student who had only opened the sign-in page -
  // signing out the game in any other tab too. Leave it alone: a real sign-in
  // replaces it, and "Contact us" works with it (firestore.rules allows the
  // sign-in page message with no sign-in or an anonymous one).
  if (user && user.isAnonymous) return;
  if (user) {
    if (registrationInProgress) return;
    // Check if this is a pending Google completion
    if (pendingGoogleUser) {
      return; // Don't redirect, waiting for form completion
    }
    
    const email = user.email || '';
    // Phase H - dynamic via OrgRegistry. Falls back to the built-in
    // if OrgRegistry hasn't loaded yet (race on first paint).
    const isAllowed = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
      ? window.OrgRegistry.checkEmail(email).ok
      : ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
         (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr'));
    
    if (!isAllowed) {
      await auth.signOut();
      showFsmEmailPopup();
      return;
    }

    // Email must be verified before entering. Google sign-in is verified
    // automatically (so it passes straight through); email/password users
    // must click the link we email them. Re-send on each attempt so they
    // always have a fresh one, then sign out and show a clear popup.
    if (!user.emailVerified) {
      // The verification email is sent once, at REGISTRATION - NOT on every
      // login. Here we just block and explain, and offer a user-initiated
      // resend (so a lost/expired link is recoverable without auto-spamming).
      var resend = false;
      if (window.AppDialog && AppDialog.confirm) {
        try {
          resend = await AppDialog.confirm(
            'Please verify your email before logging in. We sent a verification link to ' +
            (email || 'your inbox') + ' when you registered. Check your spam folder too.',
            { title: '📧 Verify your email', okLabel: 'Resend link', cancelLabel: 'OK' });
        } catch (_) {}
      } else {
        showVerifyEmailPopup(email);
      }
      if (resend) { await sendVerification(user); }
      await auth.signOut();
      if (resend && window.AppDialog && AppDialog.alert) {
        try { AppDialog.alert('A new verification link is on its way. Open it, then log in.', { title: '📧 Link sent' }); } catch (_) {}
      }
      return;
    }

    // Check if user document exists and has required fields
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const data = userDoc.data();
      let role = data.role || 'student';

      // WHITELIST PROMOTION, on the password-login path too.
      //
      // Admin > Teachers promises teacher access on the next sign-in. Only
      // the Google path ever consulted the whitelist, so without this a
      // whitelisted teacher who signs in with a password stays a student for
      // ever while the admin panel lists them as Pending. Checked BEFORE the
      // student-fields gate below, because a teacher has no level / class /
      // module and must not be sent to the student completion form.
      //
      // One extra read, only for accounts that are still students.
      // firestore.rules permits exactly student -> teacher for a whitelisted
      // owner; a refusal leaves them a student rather than blocking login.
      if (role === 'student') {
        try {
          if ((await checkIfTeacher(data.email || user.email || '')) === 'teacher') {
            await userRef.update({ role: 'teacher' });
            role = 'teacher';
          }
        } catch (e) {
          console.warn('Whitelist promotion refused, continuing as student:', e.message || e);
        }
      }

      // Check if student has required fields
      if (role === 'student' && (!data.level || !data.studentClass || !data.module || !data.academicYear)) {
        // Existing user but missing required fields - show completion form
        pendingGoogleUser = user;
        showGoogleCompleteForm(user);
        return;
      }
      
      // Update last login
      await userRef.update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Redirect based on role. Use .replace() so /index.html does
      // NOT linger in browser history - otherwise the system back
      // button from the dashboard pops back into the login page,
      // then a second back press leaves the app (see back-nav.js).
      if (role === 'teacher') {
        window.location.replace('teacher-dashboard.html');
      } else {
        // Students: gate first (yearly expiry + verification flag).
        if (window.AccountGate) {
          const gate = await window.AccountGate.check(db, user.uid);
          if (!gate.ok) {
            try { await auth.signOut(); } catch (_) {}
            const msgBox = document.getElementById('messageBox') || document.body;
            msgBox.appendChild(window.AccountGate.renderInlineBlocker(gate.message));
            return;
          }
        }
        window.location.replace('student-dashboard.html');
      }
    } else {
      // New user - will be handled by login/register functions
      // For Google sign-in, this is handled in signInWithGoogle
    }
  }
});

async function checkUserRoleAndRedirect(user) {
  try {
    const email = user.email || '';
    // Phase H - dynamic via OrgRegistry. Falls back to the built-in
    // if OrgRegistry hasn't loaded yet (race on first paint).
    const isAllowed = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
      ? window.OrgRegistry.checkEmail(email).ok
      : ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
         (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr'));
    
    if (!isAllowed) {
      await auth.signOut();
      showFsmEmailPopup();
      return;
    }
    
    const roleFromWhitelist = await checkIfTeacher(email);
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      // Update last login and role
      await userRef.update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        role: roleFromWhitelist
      });
      
      if (roleFromWhitelist === 'teacher') {
        window.location.replace('teacher-dashboard.html');
      } else {
        if (window.AccountGate) {
          const gate = await window.AccountGate.check(db, user.uid);
          if (!gate.ok) {
            try { await auth.signOut(); } catch (_) {}
            const msgBox = document.getElementById('messageBox') || document.body;
            msgBox.appendChild(window.AccountGate.renderInlineBlocker(gate.message));
            return;
          }
        }
        window.location.replace('student-dashboard.html');
      }
    }
  } catch (error) {
    console.error('Error checking role / redirecting:', error);
  }
}

// ============================================
// INSTITUTIONAL EMAIL GATE (shared by login + register)
// ============================================
// True when the email belongs to an allowed organization domain.
function isFsmEmailAllowed(email) {
  email = (email || '').toLowerCase().trim();
  if (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail) {
    try { return !!window.OrgRegistry.checkEmail(email).ok; } catch (_) {}
  }
  return email.endsWith('@fsm.edu.tr') || email.endsWith('@stu.fsm.edu.tr');
}
// Styled, app-themed popup explaining the institutional-email requirement.
// Falls back to the inline message box if AppDialog ever fails to load.
// The wording names no university: this text ships to every institution, and
// the domains that are actually accepted live in settings/organizations.
function showFsmEmailPopup() {
  var msg = 'Please sign in with your university email address. ' +
    'If you are not sure which address to use, ask your department.';
  if (window.AppDialog && AppDialog.alert) { AppDialog.alert(msg, { title: '🎓 University email required' }); }
  else { showMessage(msg, 'error'); }
}

// Continue URL the verification email links back to. Must be an authorized
// domain - the app's own origin is - so it sends the user to the login page.
function verifyActionSettings() {
  try { return { url: window.location.origin + '/index.html', handleCodeInApp: false }; }
  catch (_) { return undefined; }
}
// Send the verification email. Tries the nice continue-to-login link first; if
// Firebase rejects the continue URL (e.g. unauthorized domain), falls back to a
// plain verification email so the link always goes out.
async function sendVerification(user) {
  try { await user.sendEmailVerification(verifyActionSettings()); return true; }
  catch (e1) {
    try { await user.sendEmailVerification(); return true; }
    catch (e2) { console.warn('sendEmailVerification failed:', e2); return false; }
  }
}
// "We sent you a link" popup, shown right after a successful registration.
function showCheckEmailPopup(email) {
  var msg = 'Account created! We sent a verification link to ' + (email || 'your email') +
    '. Open it, click the link, then come back here and log in. (Check your spam folder too.)';
  if (window.AppDialog && AppDialog.alert) { AppDialog.alert(msg, { title: '📧 Check your email' }); }
  else { showMessage(msg, 'success'); }
}
// Shown when login is attempted before the email is verified (we re-send first).
function showVerifyEmailPopup(email) {
  var msg = 'Please verify your email before logging in. Check your inbox (and spam) for the ' +
    'verification link we sent when you registered.';
  if (window.AppDialog && AppDialog.alert) { AppDialog.alert(msg, { title: '📧 Verify your email' }); }
  else { showMessage(msg, 'error'); }
}

// ============================================
// LOGIN
// ============================================
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  if (!isFsmEmailAllowed(email)) { showFsmEmailPopup(); return; }

  setLoading('loginBtn', true);

  try {
    await auth.signInWithEmailAndPassword(email, password);
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

// ============================================
// REGISTER (Email/Password)
// ============================================
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

  if (!isFsmEmailAllowed(email)) { showFsmEmailPopup(); return; }

  if (classNumber < 0 || classNumber > 999) {
    showMessage('Class number must be between 000 and 999', 'error');
    return;
  }

  const studentClass = classLetter + classNumber;
  // Phase H - dynamic via OrgRegistry (with the built-in fallback).
  const _check = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
    ? window.OrgRegistry.checkEmail(email)
    : { ok: ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
             (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr')),
        reason: 'Only approved institutional email addresses can register.' };

  if (!_check.ok) {
    showMessage(_check.reason || 'This email domain is not authorized to register.', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('Password must be at least 6 characters', 'error');
    return;
  }

  setLoading('registerBtn', true);

  try {
    registrationInProgress = true;   // suppress the auth-state redirect during this flow
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    await userCredential.user.updateProfile({ displayName: name });

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
      // Account lifecycle fields (added Phase J - student-managed
      // verification + yearly expiry).
      //   • active: false → blocked from logging in, must contact admin
      //   • registeredAt: anchor for the 1-year expiry check
      //   • lastVerifiedAt: anchor for the 60-day re-verify gate.
      //     Set to "now" at registration because the student JUST
      //     filled out level/class/module on this form, so it counts
      //     as their first verification.
      active: true,
      registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastVerifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      stats: {
        totalSessions: 0,
        totalWordsStudied: 0,
        bestStreak: 0,
        currentStreak: 0,
        levelProgress: {
          A2: { studied: 0, mastered: 0 },
          B1: { studied: 0, mastered: 0 },
          'B1+': { studied: 0, mastered: 0 },
          B2: { studied: 0, mastered: 0 }, C1: { studied: 0, mastered: 0 }
        }
      }
    }, { merge: true });

    // Send the verification link, sign out, and tell them to check their inbox.
    // They verify via the email, then log in (the dashboard gate only admits
    // verified accounts). Their profile is already saved above.
    await sendVerification(userCredential.user);
    await auth.signOut();
    showCheckEmailPopup(email);
  } catch (error) {
    console.error('Registration error:', error);
    let message = 'Registration failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists.';
    if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
    if (error.code === 'auth/weak-password') message = 'Password is too weak.';
    showMessage(message, 'error');
  } finally {
    registrationInProgress = false;
    setLoading('registerBtn', false);
  }
}

// ============================================
// PASSWORD RESET
// ============================================
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

// ============================================
// GOOGLE SIGN-IN
// ============================================
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    const email = user.email;
    
    // Check for allowed domains
    // Phase H - dynamic via OrgRegistry. Falls back to the built-in
    // if OrgRegistry hasn't loaded yet (race on first paint).
    const isAllowed = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
      ? window.OrgRegistry.checkEmail(email).ok
      : ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
         (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr'));

    if (!isAllowed) {
      await auth.signOut();
      showMessage('Access denied. This account is not on an approved university email domain.', 'error');
      return;
    }

    // THE USER DOCUMENT IS THE SOURCE OF TRUTH FOR ROLE.
    //
    // This function used to write `role` on EVERY Google sign-in - 'teacher'
    // when the whitelist said so, 'student' otherwise - and firestore.rules
    // refused both, which surfaced as "Google sign-in failed: Missing or
    // insufficient permissions" and read to the user as being denied
    // permission to log in. Two separate live failures:
    //
    //   1. role:'teacher' on a NEW doc was refused because users/create
    //      demanded role == 'student'. This is the one a freshly whitelisted
    //      teacher hit. The rules now accept it when the admin-written
    //      whitelist vouches for the address.
    //   2. role:'student' written onto an EXISTING TEACHER's document was
    //      refused by roleUnchanged(). That is a demotion attempt on every
    //      single login, so a teacher promoted with the crown button could
    //      not sign in with Google AT ALL. Nothing in the UI said why.
    //
    // Now the role is READ from the document, and only ever written when it
    // is genuinely changing and the rules allow that change.
    const whitelisted = (await checkIfTeacher(email)) === 'teacher';

    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    let role = userDoc.exists
      ? (userDoc.data().role || 'student')
      : (whitelisted ? 'teacher' : 'student');

    // An existing student who has since been whitelisted gets promoted here.
    // firestore.rules permits exactly this transition. If it is refused we
    // carry on as a student rather than failing the login - the admin can
    // still use the crown button, and a refused promotion must never cost
    // someone their access.
    if (userDoc.exists && whitelisted && role === 'student') {
      try {
        await userRef.update({ role: 'teacher' });
        role = 'teacher';
      } catch (e) {
        console.warn('Whitelist promotion refused, continuing as student:', e.message || e);
      }
    }

    if (role === 'teacher') {
      // Teachers don't need extra fields - create/update and redirect
      if (!userDoc.exists) {
        await userRef.set({
          name: user.displayName || '',
          email: email,
          role: 'teacher',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // role deliberately NOT written - see the note above.
        await userRef.update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      showMessage('Login successful! Redirecting...', 'success');
      window.location.replace('teacher-dashboard.html');
      return;
    }

    // For students - check if they have required fields
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data.level && data.studentClass && data.module && data.academicYear) {
        // Has all required fields - update and redirect.
        // role deliberately NOT written - see the note above.
        await userRef.update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Account gate (yearly expiry + verification flag)
        if (window.AccountGate) {
          const gate = await window.AccountGate.check(db, user.uid);
          if (!gate.ok) {
            try { await auth.signOut(); } catch (_) {}
            const msgBox = document.getElementById('messageBox') || document.body;
            msgBox.appendChild(window.AccountGate.renderInlineBlocker(gate.message));
            return;
          }
        }
        showMessage('Login successful! Redirecting...', 'success');
        window.location.replace('student-dashboard.html');
        return;
      }
    }
    
    // New student OR existing student without required fields
    // Show completion form
    pendingGoogleUser = user;
    showGoogleCompleteForm(user);

  } catch (error) {
    console.error('Google sign-in error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      showMessage('Sign-in cancelled.', 'error');
    } else {
      showMessage('Google sign-in failed: ' + error.message, 'error');
    }
  }
}

// ============================================
// GOOGLE SIGN-IN COMPLETION FORM
// ============================================
function showGoogleCompleteForm(user) {
  // Create completion form if it doesn't exist
  let completeForm = document.getElementById('googleCompleteForm');
  
  if (!completeForm) {
    completeForm = document.createElement('div');
    completeForm.id = 'googleCompleteForm';
    completeForm.className = 'form-section';
    completeForm.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 2.5em; margin-bottom: 10px;">👋</div>
        <h2 style="color: var(--text-primary); margin-bottom: 8px;">Welcome, <span id="googleUserName"></span>!</h2>
        <p style="color: var(--text-muted); font-size: 0.9em;">Please complete your profile to continue</p>
      </div>
      
      <div class="form-group">
        <label class="form-label">Your Email</label>
        <input type="email" id="googleEmail" class="form-input no-icon" disabled style="opacity: 0.7;">
      </div>
      
      <div class="form-group">
        <label class="form-label">Level</label>
        <select id="googleLevel" class="form-select ll-select" required>
          <option value="">Select your level</option>
          <option value="A2">A2 - Elementary</option>
          <option value="B1">B1 - Intermediate</option>
          <option value="B1+">B1+ - Upper Intermediate</option>
          <option value="B2">B2 - Advanced</option>
          <option value="C1">C1 - Proficiency</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Class</label>
        <div class="form-row">
          <select id="googleClassLetter" class="form-select form-select-small ll-select" required>
            <option value="">--</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
          <input type="number" id="googleClassNumber" class="form-input no-icon" placeholder="e.g. 125" min="100" max="199" required>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Module</label>
        <select id="googleModule" class="form-select ll-select" required>
          <option value="">Select current module</option>
          <option value="Module 1">Module 1</option>
          <option value="Module 2">Module 2</option>
          <option value="Module 3">Module 3</option>
          <option value="Module 4">Module 4</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Academic Year</label>
        <select id="googleYear" class="form-select ll-select" required>
          <option value="">Select academic year</option>
          <option value="2025-2026">2025-2026</option>
          <option value="2026-2027">2026-2027</option>
          <option value="2027-2028">2027-2028</option>
        </select>
      </div>
      
      <button class="btn-submit" id="completeBtn" onclick="completeGoogleRegistration()">Complete Registration →</button>
      
      <button class="btn-google" style="margin-top: 12px;" onclick="cancelGoogleRegistration()">
        ← Cancel and Sign Out
      </button>
    `;
    
    // Insert after registerForm
    const registerForm = document.getElementById('registerForm');
    registerForm.parentNode.insertBefore(completeForm, registerForm.nextSibling);
  }
  
  // Fill in user info
  document.getElementById('googleUserName').textContent = user.displayName || 'Student';
  document.getElementById('googleEmail').value = user.email;
  
  // Show the completion form
  showTab('complete');
  showMessage('Please complete your profile to continue.', 'success');
}

async function completeGoogleRegistration() {
  if (!pendingGoogleUser) {
    showMessage('Session expired. Please sign in again.', 'error');
    return;
  }
  
  const level = document.getElementById('googleLevel').value;
  const classLetter = document.getElementById('googleClassLetter').value;
  const classNumber = document.getElementById('googleClassNumber').value;
  const module = document.getElementById('googleModule').value;
  const academicYear = document.getElementById('googleYear').value;

  if (!level || !classLetter || !classNumber || !module || !academicYear) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  if (classNumber < 0 || classNumber > 999) {
    showMessage('Class number must be between 000 and 999', 'error');
    return;
  }

  const studentClass = classLetter + classNumber;

  setLoading('completeBtn', true);

  try {
    const user = pendingGoogleUser;
    
    await db.collection('users').doc(user.uid).set({
      name: user.displayName || '',
      email: user.email,
      level,
      studentClass,
      module,
      academicYear,
      role: 'student',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      // Account lifecycle (Phase J - see register() above for full notes).
      active: true,
      registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastVerifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
      stats: {
        totalSessions: 0,
        totalWordsStudied: 0,
        bestStreak: 0,
        currentStreak: 0,
        levelProgress: {
          A2: { studied: 0, mastered: 0 },
          B1: { studied: 0, mastered: 0 },
          'B1+': { studied: 0, mastered: 0 },
          B2: { studied: 0, mastered: 0 }, C1: { studied: 0, mastered: 0 }
        }
      }
    }, { merge: true });

    pendingGoogleUser = null;
    showMessage('Profile completed! Redirecting...', 'success');
    
    setTimeout(() => {
      window.location.replace('student-dashboard.html');
    }, 1000);

  } catch (error) {
    console.error('Profile completion error:', error);
    showMessage('Failed to save profile: ' + error.message, 'error');
    setLoading('completeBtn', false);
  }
}

async function cancelGoogleRegistration() {
  pendingGoogleUser = null;
  await auth.signOut();
  
  // Reset UI
  document.querySelector('.tabs').style.display = 'flex';
  document.getElementById('googleCompleteForm')?.classList.remove('active');
  showTab('login');
  showMessage('Signed out. You can try again.', 'success');
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Close modal on background click
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('tosModal');
    if (modal && modal.classList.contains('open') && e.target === modal) {
      closeTosModal();
    }
  });

  // Enter key submits form
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const loginForm = document.getElementById('loginForm');
      const googleCompleteForm = document.getElementById('googleCompleteForm');
      
      if (googleCompleteForm && googleCompleteForm.classList.contains('active')) {
        completeGoogleRegistration();
      } else if (loginForm.classList.contains('active')) {
        login();
      } else {
        register();
      }
    }
  });
});
