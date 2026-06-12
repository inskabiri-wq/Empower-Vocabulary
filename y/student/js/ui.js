/* Student Dashboard - UI Controls, Settings, Screens */

// SETTINGS MODAL
function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Close settings modal on background click
document.addEventListener('DOMContentLoaded', () => {
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }
});

// SETTINGS TOGGLES
function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('soundToggle');
  const icon = document.getElementById('soundIcon');
  btn.classList.toggle('active', soundEnabled);
  icon.textContent = soundEnabled ? '🔊' : '🔇';
  localStorage.setItem('soundEnabled', soundEnabled);
}

function toggleTurkish() {
  turkishEnabled = !turkishEnabled;
  const btn = document.getElementById('trToggle');
  const info = document.getElementById('turkishInfo');
  btn.classList.toggle('active', turkishEnabled);
  if (info) info.classList.toggle('visible', turkishEnabled);
  localStorage.setItem('turkishEnabled', turkishEnabled);
}

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const btn = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  const isLight = document.body.classList.contains('light-mode');
  btn.classList.toggle('active', isLight);
  icon.textContent = isLight ? '☀️' : '🌙';
  label.textContent = isLight ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
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
  
  // Theme toggle - default is dark
  if (localStorage.getItem('theme') === 'light') {
    toggleTheme();
  }
  
  // Load best streak
  const savedStreak = localStorage.getItem('bestStreak');
  if (savedStreak) document.getElementById('bestStreak').textContent = savedStreak;
}

// ============================================
// IMPROVED PLEASANT ACADEMIC SOUNDS
// ============================================

// Shared AudioContext — browsers limit concurrent contexts (Chrome caps
// around 6) and suspend any context created before a user gesture. The
// previous implementation spawned a fresh context per playSound() call:
// first-click sounds were often silent, and a long session eventually
// triggered "context was not allowed to start" warnings with dropped
// audio. One shared context, resumed lazily on each call, removes both
// issues without changing the SFX design.
let _sharedAudioCtx = null;
function getAudioCtx() {
  try {
    if (!_sharedAudioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _sharedAudioCtx = new AC();
    }
    if (_sharedAudioCtx.state === 'suspended') {
      _sharedAudioCtx.resume().catch(() => {});
    }
    return _sharedAudioCtx;
  } catch (e) {
    return null;
  }
}

function playSound(type) {
  if (!soundEnabled) return;

  const ctx = getAudioCtx();
  if (!ctx) return;

  if (type === 'correct') {
    // Pleasant "ding" chime - like a gentle bell
    // Uses a major third interval for a happy, affirming sound
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.3, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    // Main tone (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    gain1.gain.setValueAtTime(0.4, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);
    
    // Harmonic overtone (E6) - adds brightness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, ctx.currentTime); // E6
    gain2.gain.setValueAtTime(0.15, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.25);
    
    // Soft shimmer (G#5) - major third for pleasant feel
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.connect(gain3);
    gain3.connect(masterGain);
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(830.6, ctx.currentTime); // G#5
    gain3.gain.setValueAtTime(0.1, ctx.currentTime);
    gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc3.start(ctx.currentTime + 0.05);
    osc3.stop(ctx.currentTime + 0.35);
    
  } else if (type === 'incorrect') {
    // Soft, gentle "nope" - not harsh, just informative
    // Two descending tones, soft and brief
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.15, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    
    // First tone (A4) - soft start
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);
    
    // Second tone (F4) - gentle descent
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(349.23, ctx.currentTime + 0.12); // F4
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.35);
    
  } else if (type === 'complete') {
    // Triumphant ascending arpeggio - C major chord progression
    // Like a gentle "achievement unlocked" sound
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(0.25, ctx.currentTime);
    
    // C major arpeggio: C5, E5, G5, C6
    const notes = [
      { freq: 523.25, time: 0, duration: 0.6 },      // C5
      { freq: 659.25, time: 0.1, duration: 0.5 },    // E5
      { freq: 783.99, time: 0.2, duration: 0.4 },    // G5
      { freq: 1046.50, time: 0.3, duration: 0.5 }    // C6
    ];
    
    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + note.time);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + note.time + note.duration);
      osc.start(ctx.currentTime + note.time);
      osc.stop(ctx.currentTime + note.time + note.duration);
      
      // Add subtle harmonic for richness
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(note.freq * 2, ctx.currentTime + note.time);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + note.time);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + note.time + note.duration * 0.7);
      osc2.start(ctx.currentTime + note.time);
      osc2.stop(ctx.currentTime + note.time + note.duration * 0.7);
    });
    
    // Final shimmer
    setTimeout(() => {
      masterGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    }, 600);
  }
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
// a higher value already stored in Firestore. Silent failure — the
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
// keep the visible pill UI in sync. The pills mirror hidden <select>
// elements via syncPillsToSelect(); programmatic callers like
// startAssignment() (from the assignments box) used to bypass that
// sync entirely, so the pills stayed on the previous value and the UI
// lied about what scope the user was actually in.
async function changeBook(book) {
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
  const allUnits = [...new Set(data.map(w => w.unit).filter(u => u))];

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

  // Dashboard v2 pill mirror — rebuild unit pills to match the native select
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
// Dashboard v2 — pill-select wiring (mirrors hidden native selects
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
    // Delegated click — survives unit-pill re-renders
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
  const data = datasets[selectedLevel] || [];
  if (selectedUnit === 'all') return data;
  return data.filter(w => w.unit == selectedUnit);
}

function updateWordCount() {
  const n = getFilteredWords().length;
  const el = document.getElementById('wordCount');
  if (el) el.textContent = n;
  // Dashboard welcome banner (design v2) — mirror word count
  const welcomeCount = document.getElementById('welcomeWordCount');
  if (welcomeCount) welcomeCount.textContent = n;
}

// SCREENS
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function backToMenu() {
  showScreen('menuScreen');
}

// CONFETTI
function createConfetti() {
  const colors = ['#3b82f6', '#06b6d4', '#0ea5e9', '#10b981', '#eab308'];
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
// the student dashboard's CSS scope — meaning the toast rendered as
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
    background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #2dd4bf 100%);
    color: #ffffff;
    padding: 12px 22px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.01em;
    z-index: 9999;
    box-shadow: 0 10px 30px -10px rgba(13, 148, 136, 0.55),
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
