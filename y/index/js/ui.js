/* ============================================
   UI.JS - User Interface Helper Functions
   Empower Vocabulary Trainer
   ============================================ */

/* ---------- Tab Switching ---------- */
function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));
  
  if (tab === 'login') {
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('registerForm').classList.add('active');
  }
  
  hideMessage();
}

/* ---------- Message Display ---------- */
function showMessage(message, type) {
  const box = document.getElementById('messageBox');
  box.textContent = message;
  box.className = 'message ' + type;
}

function hideMessage() {
  document.getElementById('messageBox').className = 'message';
}

/* ---------- Loading State ---------- */
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Please wait...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btnId === 'loginBtn' ? 'Sign In' : 'Create Account';
  }
}

/* ---------- Terms of Service Modal ---------- */
function openTosModal(event) {
  if (event) event.preventDefault();
  const modal = document.getElementById('tosModal');
  if (modal) {
    modal.classList.add('open');
  }
}

function closeTosModal() {
  const modal = document.getElementById('tosModal');
  if (modal) {
    modal.classList.remove('open');
  }
}

/* ---------- Language Toggle for TOS ---------- */
function showLang(lang) {
  if (lang === 'en') {
    document.getElementById('tosEN').style.display = 'block';
    document.getElementById('tosTR').style.display = 'none';
    document.getElementById('langEN').style.background = 'var(--accent-gradient)';
    document.getElementById('langEN').style.color = 'white';
    document.getElementById('langTR').style.background = 'transparent';
    document.getElementById('langTR').style.color = 'var(--text-secondary)';
  } else {
    document.getElementById('tosEN').style.display = 'none';
    document.getElementById('tosTR').style.display = 'block';
    document.getElementById('langTR').style.background = 'var(--accent-gradient)';
    document.getElementById('langTR').style.color = 'white';
    document.getElementById('langEN').style.background = 'transparent';
    document.getElementById('langEN').style.color = 'var(--text-secondary)';
  }
}

/* ---------- Event Listeners ---------- */
document.addEventListener('DOMContentLoaded', function() {
  // Close modal when clicking the dark background
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('tosModal');
    if (!modal) return;

    if (modal.classList.contains('open') && e.target === modal) {
      closeTosModal();
    }
  });

  // Enter key submits form
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const loginForm = document.getElementById('loginForm');
      if (loginForm.classList.contains('active')) {
        login();
      } else {
        register();
      }
    }
  });
});
