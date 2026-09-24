/* Student Dashboard - UI Controls, Settings, Screens */

// SETTINGS PANEL
// The dashboard no longer owns a settings modal. Every gear on the page carries
// data-app-settings-open and drives the shared panel in js/app-settings.js - the
// same one classroom, placement and courses open. These two remain as the named
// entry points any other code may still call.
function openSettingsModal() {
  if (window.AppSettings) window.AppSettings.open();
}

function closeSettingsModal() {
  if (window.AppSettings) window.AppSettings.close();
}

// SETTINGS TOGGLES
// The shared panel calls these and then re-reads the localStorage key each one
// writes, so the panel can never disagree with the page. The element lookups
// are optional: the old modal rows they used to update are gone, and the game
// screens' own indicators may or may not be on screen.
function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('soundToggle');
  const icon = document.getElementById('soundIcon');
  if (btn) btn.classList.toggle('active', soundEnabled);
  if (icon) icon.textContent = soundEnabled ? '🔊' : '🔇';
  localStorage.setItem('soundEnabled', soundEnabled);
  // Unlock audio on the very click that switched it ON. Browsers only let a
  // context start from a user gesture, and without this the first sound after
  // enabling is swallowed, which reads as "the switch does nothing".
  if (soundEnabled && window.LLSound) window.LLSound.warmUp();
}

function toggleTurkish() {
  turkishEnabled = !turkishEnabled;
  const btn = document.getElementById('trToggle');
  const info = document.getElementById('turkishInfo');
  if (btn) btn.classList.toggle('active', turkishEnabled);
  if (info) info.classList.toggle('visible', turkishEnabled);
  localStorage.setItem('turkishEnabled', turkishEnabled);
}

function loadSettings() {
  // Sound toggle - default is ON, so only toggle if explicitly false
  if (localStorage.getItem('soundEnabled') === 'false') {
    soundEnabled = true; // Reset to true first
    toggleSound(); // Then toggle to false
  }

  // Turkish toggle - default is OFF
  if (localStorage.getItem('turkishEnabled') === 'true') {
    turkishEnabled = false; // Reset to false first
    toggleTurkish(); // Then toggle to true
  }

  // Theme is NOT applied here. app-settings.js reads the same 'theme' key in
  // <head>, before first paint, and owns all four palettes (dark / light /
  // sepia / contrast). Re-applying it here toggled the class back off.

  // Load best streak
  const savedStreak = localStorage.getItem('bestStreak');
  if (savedStreak) document.getElementById('bestStreak').textContent = savedStreak;
}

// ============================================
// SOUNDS
// ============================================
// The engine lives in js/sound.js now, shared by every page. It used to be
// here, which is why the nine classroom games had no sound at all: this file
// is loaded by student-dashboard.html and nothing else, so playSound() did
// not exist anywhere they ran. A second, drifting copy sat inline in app.html.
//
// These two wrappers stay so the fifteen existing call sites in games.js keep
// working unchanged, and so anything that still calls getAudioCtx() finds it.
function playSound(type) {
  if (window.LLSound) window.LLSound.play(type);
}
function getAudioCtx() {
  if (window.LLSound) window.LLSound.warmUp();
  return null;   // callers only ever used this to prime the context
}

// STREAK
function updateStreak(correct) {
  if (correct) {
    sessionStreak++;
    const best = parseInt(localStorage.getItem('bestStreak') || '0');
    if (sessionStreak > best) {
      localStorage.setItem('bestStreak', sessionStreak);
      document.getElementById('bestStreak').textContent = sessionStreak;
      // Also persist to Firestore so bestStreak survives across devices,
      // cleared localStorage, and incognito sessions. Fire-and-forget.
      syncBestStreakToFirestore(sessionStreak);
    }
  } else {
    sessionStreak = 0;
  }
  document.getElementById('currentStreak').textContent = sessionStreak;
  updateStreakDisplays();
}

// Best-streak cloud sync. Uses a transaction so a lower value (e.g. from
// a freshly-cleared localStorage on a second device) can never overwrite
// a higher value already stored in Firestore. Silent failure - the
// localStorage value is still valid for this session.
async function syncBestStreakToFirestore(newBest) {
  try {
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    const user = firebase.auth().currentUser;
    if (!user || typeof db === 'undefined') return;
    const ref = db.collection('users').doc(user.uid);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return; // don't create a user doc from here
      const current = (snap.data().stats && snap.data().stats.bestStreak) || 0;
      if (newBest > current) {
        tx.update(ref, { 'stats.bestStreak': newBest });
      }
    });
  } catch (e) {
    console.warn('bestStreak cloud sync failed (still saved in localStorage):', e);
  }
}

function updateStreakDisplay() {
  document.getElementById('currentStreak').textContent = sessionStreak;
}

function updateStreakDisplays() {
  const ids = ['matchStreak', 'choiceStreak', 'reverseStreak', 'spellingStreak', 'fillStreak', 'orderStreak', 'unscrambleStreak'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = sessionStreak;
  });
}

// BOOK, LEVEL & UNIT
//
// Each of these mutates global state (selectedBook/Level/Unit) AND must
// keep the visible pill UI in sync. The pills mirror hidden <select class="ll-select">
// elements via syncPillsToSelect(); programmatic callers like
// startAssignment() (from the assignments box) used to bypass that
// sync entirely, so the pills stayed on the previous value and the UI
// lied about what scope the user was actually in.
async function changeBook(book) {
  // Pilot lock: never switch away from the forced book, even if something
  // calls this programmatically (assignments box, restored pill state, etc.).
  if (window.FORCE_BOOK) book = window.FORCE_BOOK;
  selectedBook = book;
  localStorage.setItem('selectedBook', book);

  // Guard the swap so activity buttons can't fire against a half-swapped
  // `datasets` object (race between loadBookDataset's await and a user
  // click).
  datasetsReady = false;

  // Load the dataset if not already loaded
  if (!allBookData[book]) {
    await loadBookDataset(book);
  } else {
    datasets = allBookData[book];
  }

  datasetsReady = true;

  // Reset to defaults
  selectedLevel = 'A2';
  selectedUnit = 'all';
  const levelSel = document.getElementById('levelSelect');
  const bookSel  = document.getElementById('bookSelect');
  if (levelSel) levelSel.value = 'A2';
  if (bookSel)  bookSel.value = book;

  populateUnitSelector();
  updateWordCount();
  updateActivityCards();

  // Sync visible pills with the new state
  syncPillsToSelect('bookPills',  'bookSelect');
  syncPillsToSelect('levelPills', 'levelSelect');

  // Show toast notification
  const bookNames = { 'empower': '📘 Empower', 'gateway': '📗 Gateway' };
  showToast(`Switched to ${bookNames[book] || book}`);
}

// Update activity cards based on book (some games need example sentences)
function updateActivityCards() {
  const gamesNeedingSentences = [
    { id: 'spellingCard', activity: 'spelling' },
    { id: 'fillblankCard', activity: 'fillblank' },
    { id: 'orderCard', activity: 'order' }
  ];
  const isGateway = selectedBook === 'gateway';
  
  gamesNeedingSentences.forEach(game => {
    const card = document.getElementById(game.id);
    if (!card) return;
    
    if (isGateway) {
      card.classList.add('coming-soon');
      card.onclick = function(e) {
        e.preventDefault();
        showToast('🚧 Coming Soon for Gateway!');
      };
    } else {
      card.classList.remove('coming-soon');
      card.onclick = function() {
        startActivity(game.activity);
      };
    }
  });
}

function changeLevel(level) {
  selectedLevel = level;
  selectedUnit = 'all';
  const levelSel = document.getElementById('levelSelect');
  if (levelSel) levelSel.value = level;
  populateUnitSelector();        // rebuilds unit pills + syncs them
  updateWordCount();
  syncPillsToSelect('levelPills', 'levelSelect');
}

function changeUnit(unit) {
  selectedUnit = unit;
  const unitSel = document.getElementById('unitSelect');
  if (unitSel) unitSel.value = unit;
  updateWordCount();
  syncPillsToSelect('unitPills', 'unitSelect');
}

function populateUnitSelector() {
  const data = datasets[selectedLevel] || [];
  const unitHidden = (u) => typeof window.isVocabUnitHidden === 'function'
    && window.isVocabUnitHidden(selectedLevel, u);
  const allUnits = [...new Set(data.map(w => w.unit).filter(u => u))].filter(u => !unitHidden(u));

  // If the student was parked on a unit that just got deactivated, fall back to
  // "All Units" so they never sit on an empty (and now hidden) selection.
  if (selectedUnit !== 'all' && unitHidden(selectedUnit)) selectedUnit = 'all';

  const regularUnits = allUnits.filter(u => !String(u).toLowerCase().includes('unassigned')).sort((a, b) => {
    const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
    const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
    return numA - numB;
  });
  const hasUnassigned = allUnits.some(u => String(u).toLowerCase().includes('unassigned'));

  const select = document.getElementById('unitSelect');
  select.innerHTML = '<option value="all">All Units</option>';

  regularUnits.forEach(u => {
    select.innerHTML += `<option value="${u}">${u}</option>`;
  });

  if (hasUnassigned) {
    const unassignedValue = allUnits.find(u => String(u).toLowerCase().includes('unassigned'));
    select.innerHTML += `<option value="${unassignedValue}">Bonus</option>`;
  }

  // Dashboard v2 pill mirror - rebuild unit pills to match the native select
  const pillsEl = document.getElementById('unitPills');
  if (pillsEl) {
    let pillsHTML = '<div class="sel-opt" data-value="all">All</div>';
    regularUnits.forEach(u => {
      const short = String(u).replace(/unit\s*/i, 'U');
      pillsHTML += `<div class="sel-opt" data-value="${u}">${short}</div>`;
    });
    if (hasUnassigned) {
      const unassignedValue = allUnits.find(u => String(u).toLowerCase().includes('unassigned'));
      pillsHTML += `<div class="sel-opt" data-value="${unassignedValue}">Bonus</div>`;
    }
    pillsEl.innerHTML = pillsHTML;
    syncPillsToSelect('unitPills', 'unitSelect');
  }
}

// ────────────────────────────────────────────────────────────
// Dashboard v2 - pill-select wiring (mirrors hidden native selects
// so existing changeBook/changeLevel/changeUnit wiring stays intact).
// ────────────────────────────────────────────────────────────
function syncPillsToSelect(pillsId, selectId) {
  const pills = document.getElementById(pillsId);
  const select = document.getElementById(selectId);
  if (!pills || !select) return;
  const v = select.value;
  pills.querySelectorAll('.sel-opt').forEach(p => {
    p.classList.toggle('active', p.dataset.value === v);
  });
}

function wireDashboardPills() {
  const pairs = [
    ['bookPills',  'bookSelect'],
    ['levelPills', 'levelSelect'],
    ['unitPills',  'unitSelect']
  ];
  pairs.forEach(([pillsId, selectId]) => {
    const pills = document.getElementById(pillsId);
    const select = document.getElementById(selectId);
    if (!pills || !select) return;
    // Delegated click - survives unit-pill re-renders
    pills.addEventListener('click', (e) => {
      const opt = e.target.closest('.sel-opt');
      if (!opt || !pills.contains(opt)) return;
      const v = opt.dataset.value;
      if (v == null || select.value === v) { syncPillsToSelect(pillsId, selectId); return; }
      select.value = v;
      select.dispatchEvent(new Event('change'));
      syncPillsToSelect(pillsId, selectId);
    });
    syncPillsToSelect(pillsId, selectId);
  });
}

function getFilteredWords() {
  let data = datasets[selectedLevel] || [];
  // Drop words from admin-deactivated units (word lists). This is the single
  // pool chokepoint every vocab game runs through, so filtering here covers
  // "All Units" and every per-mode game in one place.
  if (typeof window.isVocabUnitHidden === 'function') {
    data = data.filter(w => !window.isVocabUnitHidden(selectedLevel, w.unit));
  }
  if (selectedUnit === 'all') return data;
  return data.filter(w => w.unit == selectedUnit);
}

function updateWordCount() {
  const n = getFilteredWords().length;
  const el = document.getElementById('wordCount');
  if (el) el.textContent = n;
  // Dashboard welcome banner (design v2) - mirror word count
  const welcomeCount = document.getElementById('welcomeWordCount');
  if (welcomeCount) welcomeCount.textContent = n;
}

// SCREENS
function showScreen(id) {
  // Leaving the hub while it is still held (a deep link or preview the head
  // check did not catch): show the page now, never a hidden screen.
  if (id !== 'hubScreen' && window.LLHubBoot) LLHubBoot.release('screen');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  // Every screen lives in ONE long document and is shown by toggling a class,
  // so the window keeps whatever scroll offset the previous screen had. Open a
  // skill from halfway down the hub, come back, and you land in the middle of
  // the page with the header off-screen - which reads as the header having
  // moved. Each screen is a fresh view and starts at its top.
  //
  // `auto`, not `smooth`: this is a screen change, not a scroll, and animating
  // it means the new screen visibly slides past on every navigation.
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch (_) {
    window.scrollTo(0, 0);            // older browsers reject the options form
  }
}

function backToMenu() {
  showScreen('menuScreen');
}

// CONFETTI
function createConfetti() {
  const colors = ['#3b82f6', '#2563eb', '#2563eb', '#10b981', '#3b82f6'];
  for (let i = 0; i < 60; i++) {
    const conf = document.createElement('div');
    conf.className = 'confetti';
    conf.style.background = colors[Math.floor(Math.random() * colors.length)];
    conf.style.left = Math.random() * 100 + 'vw';
    conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
    conf.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(conf);
    setTimeout(() => conf.remove(), 4000);
  }
}

// PROGRESS
function setProgress(id, current, total) {
  const pct = (current / total) * 100;
  document.getElementById(id).style.width = pct + '%';
}

// FEEDBACK
function showFeedback(correct) {
  const msg = document.createElement('div');
  msg.className = `feedback-msg ${correct ? 'correct' : 'incorrect'}`;
  msg.textContent = correct ? '✔' : '✗';
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 600);
}

// TOAST
// NOTE: previously used `var(--accent-gradient)` which is undefined in
// the student dashboard's CSS scope - meaning the toast rendered as
// white text on no background and looked like a floating system error.
// Now it has a proper dark teal gradient that matches the brand and
// always renders, regardless of which page calls showToast().
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #93c5fd 100%);
    color: #ffffff;
    padding: 12px 22px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.01em;
    z-index: 9999;
    box-shadow: 0 10px 30px -10px rgba(37, 99, 235, 0.55),
                0 2px 6px rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    max-width: min(90vw, 520px);
    text-align: center;
    backdrop-filter: blur(8px);
    animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Add toast animation
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes toastOut { from { opacity: 1; } to { opacity: 0; } }
`;
document.head.appendChild(toastStyle);
