/* ============================================
   STYLE 6: FLOATING CARD - Login Page JavaScript
   Empower Vocabulary Trainer
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
    this.color = Math.random() > 0.5 ? '#3b82f6' : '#06b6d4';
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

const firebaseConfig = {
  apiKey: "AIzaSyDmTTictWJmxVxj9frqSODPUjOgpRPPNzU",
  authDomain: "empower-vocabulary-practice.firebaseapp.com",
  projectId: "empower-vocabulary-practice",
  storageBucket: "empower-vocabulary-practice.firebasestorage.app",
  messagingSenderId: "136270199832",
  appId: "1:136270199832:web:174222066ef1cbdc8f576d",
  measurementId: "G-1BBXBVEP5C"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize App Check
try {
  const appCheck = firebase.appCheck();
  appCheck.activate('6Lc-jS0sAAAAADZHuluoJrM8aJWCLwiJPedS8ki7', true);
} catch (error) {
  console.log('App Check initialization failed:', error);
}

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

// ============================================
// AUTH STATE CHANGE HANDLER
// ============================================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Check if this is a pending Google completion
    if (pendingGoogleUser) {
      return; // Don't redirect, waiting for form completion
    }
    
    const email = user.email || '';
    // Phase H — dynamic via OrgRegistry. Falls back to hardcoded FSM
    // if OrgRegistry hasn't loaded yet (race on first paint).
    const isAllowed = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
      ? window.OrgRegistry.checkEmail(email).ok
      : ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
         (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr'));
    
    if (!isAllowed) {
      await auth.signOut();
      showMessage('Access denied. Only FSM university emails are allowed.', 'error');
      return;
    }
    
    // Check if user document exists and has required fields
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const data = userDoc.data();
      const role = data.role || 'student';
      
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
      // NOT linger in browser history — otherwise the system back
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
    // Phase H — dynamic via OrgRegistry. Falls back to hardcoded FSM
    // if OrgRegistry hasn't loaded yet (race on first paint).
    const isAllowed = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
      ? window.OrgRegistry.checkEmail(email).ok
      : ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
         (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr'));
    
    if (!isAllowed) {
      await auth.signOut();
      showMessage('Access denied. Only FSM university emails are allowed.', 'error');
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
// LOGIN
// ============================================
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

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

  if (classNumber < 0 || classNumber > 999) {
    showMessage('Class number must be between 000 and 999', 'error');
    return;
  }

  const studentClass = classLetter + classNumber;
  // Phase H — dynamic via OrgRegistry (with FSM fallback).
  const _check = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
    ? window.OrgRegistry.checkEmail(email)
    : { ok: ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
             (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr')),
        reason: 'Only FSM email addresses (@fsm.edu.tr or @stu.fsm.edu.tr) can register.' };

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
      // Account lifecycle fields (added Phase J — student-managed
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
          B2: { studied: 0, mastered: 0 }
        }
      }
    }, { merge: true });

    showMessage('Account created! Redirecting...', 'success');
  } catch (error) {
    console.error('Registration error:', error);
    let message = 'Registration failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists.';
    if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
    if (error.code === 'auth/weak-password') message = 'Password is too weak.';
    showMessage(message, 'error');
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
    // Phase H — dynamic via OrgRegistry. Falls back to hardcoded FSM
    // if OrgRegistry hasn't loaded yet (race on first paint).
    const isAllowed = (typeof window.OrgRegistry !== 'undefined' && window.OrgRegistry.checkEmail)
      ? window.OrgRegistry.checkEmail(email).ok
      : ((email || '').toLowerCase().endsWith('@fsm.edu.tr') ||
         (email || '').toLowerCase().endsWith('@stu.fsm.edu.tr'));

    if (!isAllowed) {
      await auth.signOut();
      showMessage('Access denied. Only FSM university emails (@fsm.edu.tr or @stu.fsm.edu.tr) are allowed.', 'error');
      return;
    }

    // Check if user is a teacher
    const role = await checkIfTeacher(email);
    
    // Check if user document exists
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    
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
        await userRef.update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          role: 'teacher'
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
        // Has all required fields - update and redirect
        await userRef.update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          role: 'student'
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
        <select id="googleLevel" class="form-select" required>
          <option value="">Select your level</option>
          <option value="A2">A2 - Elementary</option>
          <option value="B1">B1 - Intermediate</option>
          <option value="B1+">B1+ - Upper Intermediate</option>
          <option value="B2">B2 - Advanced</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Class</label>
        <div class="form-row">
          <select id="googleClassLetter" class="form-select form-select-small" required>
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
        <select id="googleModule" class="form-select" required>
          <option value="">Select current module</option>
          <option value="Module 1">Module 1</option>
          <option value="Module 2">Module 2</option>
          <option value="Module 3">Module 3</option>
          <option value="Module 4">Module 4</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Academic Year</label>
        <select id="googleYear" class="form-select" required>
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
      // Account lifecycle (Phase J — see register() above for full notes).
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
          B2: { studied: 0, mastered: 0 }
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
