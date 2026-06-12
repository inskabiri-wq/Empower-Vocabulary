/* ============================================
   CLASSROOM MODE - Teacher JavaScript
   Empower Vocabulary Trainer
   ============================================ */

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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// PARTICLES ANIMATION
// ============================================

function initParticles() {
  const canvas = document.getElementById('particles-bg');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const particles = [];
  const particleCount = 50;
  
  class Particle {
    constructor() {
      this.reset();
    }
    
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 0.5;
      this.speedY = (Math.random() - 0.5) * 0.5;
      this.opacity = Math.random() * 0.5 + 0.2;
      this.color = ['#3b82f6', '#0ea5e9', '#06b6d4', '#10b981'][Math.floor(Math.random() * 4)];
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
  
  function animate() {
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
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.1 * (1 - dist/120)})`;
          ctx.stroke();
        }
      });
    });
    
    requestAnimationFrame(animate);
  }
  
  animate();
  
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

// ============================================
// MUSIC CONTROL
// ============================================

let musicPlaying = false;
let currentTrackIndex = -1;

const musicTracks = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3'
];

function playRandomTrack() {
  const audio = document.getElementById('bgMusic');
  let idx = Math.floor(Math.random() * musicTracks.length);
  if (idx === currentTrackIndex) idx = (idx + 1) % musicTracks.length;
  currentTrackIndex = idx;
  audio.src = musicTracks[idx];
  audio.load();
  const p = audio.play();
  if (p && p.catch) p.catch(() => {});
}

function toggleMusic() {
  const audio = document.getElementById('bgMusic');
  const btn = document.getElementById('musicBtn');

  if (musicPlaying) {
    audio.pause();
    btn.textContent = '🎵';
    btn.classList.remove('playing');
  } else {
    playRandomTrack();
    btn.textContent = '🔊';
    btn.classList.add('playing');
  }
  musicPlaying = !musicPlaying;
}

function nextTrack() {
  if (musicPlaying) {
    playRandomTrack();
  }
}

function setVolume(value) {
  const audio = document.getElementById('bgMusic');
  audio.volume = value / 100;
}

document.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('bgMusic');
  if (audio) {
    audio.volume = 0.3;
    audio.loop = false; // Don't loop single track — play next random instead
    audio.addEventListener('ended', () => {
      if (musicPlaying) playRandomTrack();
    });
  }
  initParticles();
});

// ============================================
// CUSTOM CONFIRM MODAL
// ============================================

let confirmModalCallback = null;

function showConfirmModal(icon, title, text, buttonText, callback) {
  document.getElementById('confirmModalIcon').textContent = icon;
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalText').textContent = text;
  document.getElementById('confirmModalBtn').textContent = buttonText;
  confirmModalCallback = callback;
  document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('active');
  confirmModalCallback = null;
}

function confirmModalAction() {
  if (confirmModalCallback) {
    confirmModalCallback();
  }
  closeConfirmModal();
}

// Auth Protection
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  checkTeacherAccess();
});

let currentUser = null;
let currentSession = null;
let currentSessionData = null;
let playersListener = null;

// beforeunload guard — if the teacher has an active session and tries
// to close the tab / hit browser back, give them a chance to bail.
// Browsers show their own generic "Leave site?" prompt (custom strings
// are ignored on every modern browser since 2016) — setting returnValue
// is what triggers it. We only enable when the session is "active"
// (game in flight), not during setup or after results.
window.addEventListener('beforeunload', (e) => {
  const inFlight = currentSessionData && currentSessionData.status === 'active';
  if (inFlight) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

// ============================================
// ACCESS CONTROL
// ============================================

async function checkTeacherAccess() {
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (!doc.exists || doc.data().role !== 'teacher') {
      // Access denied is terminal — the page can't function as a teacher
      // host without teacher role. Show a brief toast, then redirect.
      // We can't use showError here because the toast CSS is appended
      // to <body> during init and we're about to navigate away; use
      // sessionStorage to relay the message to the destination instead.
      try { sessionStorage.setItem('pendingFlash', 'Access denied. Teachers only.'); } catch (_) {}
      window.location.href = 'student-dashboard.html';
      return;
    }
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('teacherName').textContent = currentUser.displayName || currentUser.email;
  } catch (error) {
    console.error('Access check error:', error);
    showError('Error checking access');
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function createSession() {
  const level = document.getElementById('sessionLevel').value;
  const unit = document.getElementById('sessionUnit').value;
  const wordCount = parseInt(document.getElementById('sessionWordCount').value);
  const timeLimit = parseInt(document.getElementById('sessionTimeLimit').value);
  // Question source: vocab / grammar / mixed. The setup screen's Questions
  // select is the source of truth; window.classroomMode tracks it.
  const srcSel = document.getElementById('sessionQSource');
  const qMode = (srcSel && srcSel.value) || window.classroomMode || 'vocab';

  if (!level) {
    showError('Please select a level');
    return;
  }

  // Generate unique session code
  let sessionCode = generateSessionCode();

  // Check if code already exists
  const existingSession = await db.collection('classroom_sessions').doc(sessionCode).get();
  if (existingSession.exists) {
    sessionCode = generateSessionCode(); // Try again
  }

  // Get the question set. Grammar questions ride in the same `words` array
  // shape (word = the sentence stem, definition = the right answer) so every
  // existing lobby / results / answers view keeps working. Mixed = half
  // vocabulary + half grammar from the same level/unit, shuffled together.
  let words;
  if (qMode === 'grammar') {
    words = getGrammarQuestionsForSession(level, unit, wordCount);
  } else if (qMode === 'mixed') {
    const halfG = Math.ceil(wordCount / 2);
    // Unit values are numeric in grammar/mixed mode; vocab uses "Unit N".
    const vUnit = (unit && unit !== 'all') ? ('Unit ' + unit) : 'all';
    const g = getGrammarQuestionsForSession(level, unit, halfG);
    const v = getWordsForSession(level, vUnit, wordCount - g.length);
    words = shuffleArray(g.concat(v)).slice(0, wordCount);
  } else {
    words = getWordsForSession(level, unit, wordCount);
  }

  if (words.length === 0) {
    showError(qMode === 'vocab' ? 'No words found for selected level/unit' : 'No questions found for selected level/unit');
    return;
  }

  const sessionData = {
    code: sessionCode,
    status: 'waiting', // waiting, active, finished
    mode: qMode,
    level: level,
    unit: unit,
    wordCount: words.length,
    timeLimit: timeLimit,
    words: words,
    createdBy: currentUser.uid,
    teacherName: currentUser.displayName || currentUser.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    startedAt: null,
    endedAt: null
  };
  
  try {
    await db.collection('classroom_sessions').doc(sessionCode).set(sessionData);
    currentSession = sessionCode;
    currentSessionData = sessionData;
    showSessionLobby(sessionCode, sessionData);
    listenToPlayers(sessionCode);
  } catch (error) {
    console.error('Error creating session:', error);
    showError('Failed to create session: ' + error.message);
  }
}

function getWordsForSession(level, unit, count) {
  // Access vocabulary from global variable (loaded from datasets.json)
  if (typeof vocabulary === 'undefined' || vocabulary === null) {
    console.error('Vocabulary not loaded');
    return [];
  }
  
  let availableWords = [];
  
  if (vocabulary[level]) {
    if (unit && unit !== 'all') {
      // Filter by unit
      availableWords = vocabulary[level].filter(w => w.unit === unit);
    } else {
      // Get all words from this level
      availableWords = [...vocabulary[level]];
    }
  }
  
  // Map to consistent format for game
  availableWords = availableWords.map(w => ({
    word: w.word,
    definition: w.def,
    example: w.ex,
    pos: w.pos,
    unit: w.unit
  }));
  
  // Shuffle and limit
  availableWords = shuffleArray(availableWords);
  return availableWords.slice(0, count);
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Grammar Race question source — pulls from the same generated bank the
// solo grammar practice uses (grammar-content.js must be loaded on the page).
function getGrammarQuestionsForSession(level, unit, count) {
  const GP = window.GRAMMAR_PRACTICE;
  if (!GP || !GP.byLevel || !GP.byLevel[level]) {
    console.error('Grammar bank not loaded');
    return [];
  }
  const unitOf = t => { const m = String(t.blurb || '').match(/Units?\s+(\d+)/i); return m ? parseInt(m[1], 10) : 0; };
  let topics = GP.byLevel[level];
  if (unit && unit !== 'all') topics = topics.filter(t => unitOf(t) === parseInt(unit, 10));
  const qs = [];
  topics.forEach(t => (t.questions || []).forEach(q => qs.push({
    word: q.stem,                      // stem rides in the "word" slot
    definition: q.options[q.answer],   // correct answer rides in "definition"
    options: q.options,
    answer: q.answer,
    explain: q.explain || '',
    pos: '',
    unit: 'Unit ' + unitOf(t)
  })));
  return shuffleArray(qs).slice(0, count);
}

// ============================================
// SESSION LOBBY
// ============================================

function showSessionLobby(code, data) {
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'block';

  document.getElementById('displaySessionCode').textContent = code;
  document.getElementById('sessionInfo').innerHTML = `
    <strong>Level:</strong> ${data.level} |
    <strong>Unit:</strong> ${data.unit || 'All'} |
    <strong>Words:</strong> ${data.wordCount} |
    <strong>Time:</strong> ${data.timeLimit}s per question
  `;

  // ── QR code ───────────────────────────────────────────────
  // Build a join URL that opens the student page with the code
  // pre-filled, then encode it into a QR. Using location.origin +
  // the page's directory makes this work whether the app is hosted
  // at root or under a subpath (e.g. github-pages projects).
  // qrserver is a free public QR generator — no library needed.
  const dir = location.pathname.replace(/[^/]+$/, '');
  const joinUrl = `${location.origin}${dir}classroom-student.html?code=${encodeURIComponent(code)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(joinUrl)}`;

  const qrImg  = document.getElementById('sessionQRImg');
  const qrCard = document.getElementById('sessionQRCard');
  if (qrImg)  qrImg.src = qrSrc;
  if (qrCard) qrCard.style.display = '';
}

function listenToPlayers(sessionCode) {
  if (playersListener) {
    playersListener(); // Unsubscribe previous listener
  }
  
  playersListener = db.collection('classroom_sessions').doc(sessionCode)
    .collection('players')
    .onSnapshot(snapshot => {
      updatePlayersDisplay(snapshot.docs);
    });
}

function updatePlayersDisplay(playerDocs) {
  const container = document.getElementById('playersContainer');
  const countEl = document.getElementById('playerCount');
  
  countEl.textContent = playerDocs.length;
  
  if (playerDocs.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">Waiting for students to join...</p>';
    return;
  }
  
  container.innerHTML = playerDocs.map(doc => {
    const player = doc.data();
    const statusClass = player.status || 'ready';
    const statusText = player.status === 'finished' ? '✓ Done' : 
                       player.status === 'playing' ? '⏳ Playing' : '✓ Ready';
    
    return `
      <div class="player-card">
        <div class="player-avatar">${getInitials(player.name)}</div>
        <div class="player-name">${escapeHtml(player.name)}</div>
        <div class="player-status ${statusClass}">${statusText}</div>
        ${player.score !== undefined ? `<div class="player-score" style="color: var(--success); font-weight: 700; margin-top: 4px;">${player.score} pts</div>` : ''}
      </div>
    `;
  }).join('');
  
  // Enable start button if at least 1 player
  document.getElementById('startGameBtn').disabled = playerDocs.length === 0;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================
// GAME CONTROL
// ============================================

async function startGame() {
  if (!currentSession) return;
  
  try {
    await db.collection('classroom_sessions').doc(currentSession).update({
      status: 'active',
      startedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    document.getElementById('startGameBtn').style.display = 'none';
    document.getElementById('endGameBtn').style.display = 'inline-flex';
    document.getElementById('sessionStatus').innerHTML = '<span style="color: var(--success);">🟢 Game in Progress</span>';
    
    // Listen to live results
    listenToResults();
  } catch (error) {
    console.error('Error starting game:', error);
    showError('Failed to start game');
  }
}

async function endGame() {
  if (!currentSession) return;
  
  showConfirmModal(
    '🏁',
    'End Game?',
    'Are you sure you want to end the game? All students will be moved to results.',
    'Yes, End Game',
    async () => {
      try {
        await db.collection('classroom_sessions').doc(currentSession).update({
          status: 'finished',
          endedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Trigger confetti!
        createConfetti();
        
        showResults();
      } catch (error) {
        console.error('Error ending game:', error);
        showError('Failed to end game');
      }
    }
  );
}

// Confetti celebration
function createConfetti() {
  const colors = ['#3b82f6', '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  
  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    confetti.style.width = Math.random() * 10 + 5 + 'px';
    confetti.style.height = confetti.style.width;
    confetti.style.animation = `confettiFall ${Math.random() * 3 + 2}s linear forwards`;
    confetti.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 5000);
  }
}

function listenToResults() {
  // Already listening via playersListener, just update display
  db.collection('classroom_sessions').doc(currentSession)
    .collection('players')
    .orderBy('score', 'desc')
    .onSnapshot(snapshot => {
      updatePlayersDisplay(snapshot.docs);
      updateLiveLeaderboard(snapshot.docs);
    });
}

function updateLiveLeaderboard(playerDocs) {
  const container = document.getElementById('liveLeaderboard');
  if (!container) return;
  
  const sorted = playerDocs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(p => p.score !== undefined)
    .sort((a, b) => b.score - a.score);
  
  if (sorted.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No scores yet</p>';
    return;
  }
  
  container.innerHTML = sorted.slice(0, 10).map((player, index) => `
    <div class="leaderboard-item">
      <div class="leaderboard-rank">${index + 1}</div>
      <div class="leaderboard-player">
        <div class="leaderboard-avatar">${getInitials(player.name)}</div>
        <div class="leaderboard-name">${escapeHtml(player.name)}</div>
      </div>
      <div class="leaderboard-score">${player.score} pts</div>
    </div>
  `).join('');
}

// ============================================
// RESULTS
// ============================================

async function showResults() {
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'block';
  
  const playersSnapshot = await db.collection('classroom_sessions').doc(currentSession)
    .collection('players')
    .orderBy('score', 'desc')
    .get();
  
  const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Cache for download
  cachedSessionPlayers = players;
  cachedSessionMeta = {
    level: currentSessionData?.level || '',
    unit: currentSessionData?.unit === 'all' ? 'All Units' : (currentSessionData?.unit || ''),
    wordCount: currentSessionData?.wordCount || 0,
    date: new Date().toISOString().slice(0, 10)
  };

  // Show podium for top 3
  const podiumHtml = createPodium(players.slice(0, 3));
  document.getElementById('podiumContainer').innerHTML = podiumHtml;
  
  // Session summary
  const totalWords = currentSessionData?.wordCount || 0;
  const summaryHtml = `
    <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px;">
      <div style="background: var(--bg-item); border-radius: 12px; padding: 16px 24px; text-align: center; min-width: 120px;">
        <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-primary);">${players.length}</div>
        <div style="color: var(--text-muted); font-size: 0.85rem;">Players</div>
      </div>
      <div style="background: var(--bg-item); border-radius: 12px; padding: 16px 24px; text-align: center; min-width: 120px;">
        <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-primary);">${cachedSessionMeta.level}</div>
        <div style="color: var(--text-muted); font-size: 0.85rem;">Level</div>
      </div>
      <div style="background: var(--bg-item); border-radius: 12px; padding: 16px 24px; text-align: center; min-width: 120px;">
        <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-primary);">${totalWords}</div>
        <div style="color: var(--text-muted); font-size: 0.85rem;">Words</div>
      </div>
      <div style="background: var(--bg-item); border-radius: 12px; padding: 16px 24px; text-align: center; min-width: 120px;">
        <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-primary);">${players.length > 0 ? Math.round(players.reduce((s, p) => s + (p.score || 0), 0) / players.length) : 0}</div>
        <div style="color: var(--text-muted); font-size: 0.85rem;">Avg Score</div>
      </div>
    </div>
  `;
  let summaryEl = document.getElementById('sessionSummary');
  if (!summaryEl) {
    summaryEl = document.createElement('div');
    summaryEl.id = 'sessionSummary';
    document.getElementById('podiumContainer').insertAdjacentElement('afterend', summaryEl);
  }
  summaryEl.innerHTML = summaryHtml;

  // Full leaderboard with details
  const leaderboardHtml = players.map((player, index) => {
    const correct = player.correctAnswers || 0;
    const accuracy = totalWords > 0 ? Math.round((correct / totalWords) * 100) : 0;
    return `
      <div class="leaderboard-item">
        <div class="leaderboard-rank">${index + 1}</div>
        <div class="leaderboard-player">
          <div class="leaderboard-avatar">${getInitials(player.name)}</div>
          <div>
            <div class="leaderboard-name">${escapeHtml(player.name)}</div>
            <div class="leaderboard-details">${correct}/${totalWords} correct (${accuracy}%)</div>
          </div>
        </div>
        <div class="leaderboard-score">${player.score || 0} pts</div>
      </div>
    `;
  }).join('');
  
  document.getElementById('fullLeaderboard').innerHTML = leaderboardHtml;

  // Load and display per-question review
  loadPerQuestionReview(players);
}

async function loadPerQuestionReview(players) {
  const reviewEl = document.getElementById('perQuestionReview');
  if (!reviewEl) return;

  const words = currentSessionData?.words || [];
  if (words.length === 0 || players.length === 0) {
    reviewEl.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No question data available.</p>';
    return;
  }

  // Fetch each player's per-question answers from Firestore
  const playerAnswers = {}; // { playerId: { "0": answerDoc, "1": answerDoc, ... } }

  try {
    await Promise.all(players.map(async (player) => {
      const snap = await db.collection('classroom_sessions').doc(currentSession)
        .collection('players').doc(player.id)
        .collection('answers').get();
      const answers = {};
      snap.forEach(doc => { answers[doc.id] = doc.data(); });
      playerAnswers[player.id] = answers;
    }));
  } catch (err) {
    console.warn('Could not load per-question answers:', err);
    reviewEl.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Could not load per-question data.</p>';
    return;
  }

  // Build the review table
  // Columns: Student name | Q1 | Q2 | ... | Total
  let html = '<table class="review-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">';

  // Header row: word names
  html += '<thead><tr>';
  html += '<th style="padding:8px 12px; text-align:left; border-bottom:2px solid var(--border-color); position:sticky; left:0; background:var(--bg-card); z-index:1; min-width:130px;">Student</th>';
  words.forEach((w, i) => {
    html += `<th style="padding:8px 6px; text-align:center; border-bottom:2px solid var(--border-color); min-width:80px; white-space:nowrap;" title="${escapeHtml(w.definition || w.def || '')}">${i + 1}. ${escapeHtml(w.word)}</th>`;
  });
  html += '<th style="padding:8px 12px; text-align:center; border-bottom:2px solid var(--border-color); font-weight:700;">Score</th>';
  html += '</tr></thead>';

  // Body rows: one per player
  html += '<tbody>';
  players.forEach((player) => {
    const answers = playerAnswers[player.id] || {};
    let correctCount = 0;

    html += '<tr>';
    html += `<td style="padding:6px 12px; border-bottom:1px solid var(--border-color); font-weight:600; position:sticky; left:0; background:var(--bg-card); z-index:1; white-space:nowrap;">${escapeHtml(player.name)}</td>`;

    words.forEach((w, i) => {
      const ans = answers[String(i)];
      let cell = '<span style="color:var(--text-muted);">—</span>';
      if (ans) {
        if (ans.isCorrect) {
          correctCount++;
          cell = '<span style="color:var(--success); font-size:1.1rem;" title="Correct">✓</span>';
        } else {
          const studentAns = ans.studentAnswer || '(no answer)';
          cell = `<span style="color:var(--error); font-size:1.1rem; cursor:help;" title="${escapeHtml(studentAns)}">✗</span>`;
        }
      }
      html += `<td style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color);">${cell}</td>`;
    });

    const pct = words.length > 0 ? Math.round((correctCount / words.length) * 100) : 0;
    html += `<td style="padding:6px 12px; text-align:center; border-bottom:1px solid var(--border-color); font-weight:700;">${correctCount}/${words.length} (${pct}%)</td>`;
    html += '</tr>';
  });

  // Footer row: per-question success rate
  html += '<tr style="background:rgba(59,130,246,0.05);">';
  html += '<td style="padding:8px 12px; font-weight:700; border-top:2px solid var(--border-color); position:sticky; left:0; background:rgba(59,130,246,0.05); z-index:1;">Success Rate</td>';
  words.forEach((w, i) => {
    let correct = 0;
    let total = 0;
    players.forEach(p => {
      const ans = (playerAnswers[p.id] || {})[String(i)];
      if (ans) {
        total++;
        if (ans.isCorrect) correct++;
      }
    });
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
    const color = rate >= 70 ? 'var(--success)' : rate >= 40 ? 'var(--warning)' : 'var(--error)';
    html += `<td style="padding:6px; text-align:center; border-top:2px solid var(--border-color); font-weight:600; color:${color};">${rate}%</td>`;
  });
  html += '<td style="padding:6px 12px; border-top:2px solid var(--border-color);"></td>';
  html += '</tr>';

  html += '</tbody></table>';

  // Add legend
  html += `
    <div style="display:flex; gap:16px; margin-top:12px; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap;">
      <span><span style="color:var(--success);">✓</span> = Correct</span>
      <span><span style="color:var(--error);">✗</span> = Wrong (hover to see student's answer)</span>
      <span><span>—</span> = No data</span>
    </div>
  `;

  reviewEl.innerHTML = html;
}

function createPodium(topPlayers) {
  const medals = ['🥇', '🥈', '🥉'];
  const positions = ['first', 'second', 'third'];
  
  return topPlayers.map((player, index) => `
    <div class="podium-place ${positions[index]}">
      <div class="podium-rank">${medals[index]}</div>
      <div class="podium-name">${escapeHtml(player.name)}</div>
      <div class="podium-score">${player.score || 0} pts</div>
    </div>
  `).join('');
}

// ============================================
// NAVIGATION
// ============================================

async function cancelSession() {
  if (currentSession) {
    const okCancel = await AppDialog.confirm(
      'Students will be disconnected from this session.',
      { title: 'Cancel this session?', okLabel: 'Cancel session', danger: true, icon: '🏳️' });
    if (okCancel) {
      try {
        await db.collection('classroom_sessions').doc(currentSession).delete();
      } catch (e) {
        console.log('Could not delete session');
      }
      if (playersListener) playersListener();
      currentSession = null;
    } else {
      return;
    }
  }
  
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'block';
}

function newSession() {
  showDownloadModal(() => {
    if (playersListener) playersListener();
    currentSession = null;
    currentSessionData = null;
    cachedSessionPlayers = [];
    cachedSessionMeta = {};
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('setupScreen').style.display = 'block';
    document.getElementById('sessionLevel').value = '';
    document.getElementById('sessionUnit').value = 'all';
    // Reset lobby UI for new session
    document.getElementById('startGameBtn').style.display = 'inline-flex';
    document.getElementById('startGameBtn').disabled = true;
    document.getElementById('endGameBtn').style.display = 'none';
    document.getElementById('sessionStatus').innerHTML = '<span style="color: var(--warning);">⏳ Waiting to start...</span>';
  });
}

// ============================================
// SESSION DATA DOWNLOAD & CLEANUP
// ============================================

// Cached results for download (populated in showResults)
let cachedSessionPlayers = [];
let cachedSessionMeta = {};

function downloadSessionData() {
  if (!cachedSessionPlayers.length) {
    showError('No session data available to download.', 'info');
    return;
  }

  const meta = cachedSessionMeta;
  const rows = [
    ['Rank', 'Name', 'Score', 'Correct Answers', 'Level', 'Unit', 'Session Date'],
    ...cachedSessionPlayers.map((p, i) => [
      i + 1,
      p.name || '',
      p.score || 0,
      p.correctAnswers || 0,
      meta.level || '',
      meta.unit || 'All',
      meta.date || ''
    ])
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-results-${meta.date || 'unknown'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteCurrentSession() {
  if (!currentSession) return;
  try {
    await db.collection('classroom_sessions').doc(currentSession).delete();
  } catch (e) {
    console.log('Could not delete session:', e);
  }
}

function showDownloadModal(onContinue) {
  const modal = document.getElementById('downloadModal');
  modal.style.display = 'flex';

  const dlBtn = document.getElementById('downloadAndContinueBtn');
  const skipBtn = document.getElementById('skipDownloadBtn');

  const cleanup = (shouldDownload) => {
    modal.style.display = 'none';
    dlBtn.onclick = null;
    skipBtn.onclick = null;
    if (shouldDownload) downloadSessionData();
    deleteCurrentSession().then(onContinue);
  };

  dlBtn.onclick = () => cleanup(true);
  skipBtn.onclick = () => cleanup(false);
}

function deleteSessionOnLeave(e) {
  if (!currentSession) return;
  e.preventDefault();
  // Read the anchor's href so the download modal can route to whichever
  // exit the teacher actually clicked (Dashboard, Classroom Mode, etc.).
  // Fallback to the dashboard if there's no href for any reason.
  const target = (e.currentTarget && e.currentTarget.getAttribute('href')) || 'teacher-dashboard.html';
  showDownloadModal(() => {
    window.location.href = target;
  });
}

function logout() {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
}

// ============================================
// UTILITIES
// ============================================

// Themed toast — replaces the old plain `alert()`. Floats top-right,
// auto-dismisses, dark-mode card matching the rest of the classroom UI.
// `kind` is 'error' (default), 'info', or 'success' — controls the
// left-border accent color.
function showError(message, kind) {
  kind = kind || 'error';
  const t = document.createElement('div');
  t.className = 'cls-toast cls-toast-' + kind;
  t.textContent = message;
  document.body.appendChild(t);
  // Force a reflow so the transition fires
  void t.offsetWidth;
  t.classList.add('shown');
  setTimeout(() => {
    t.classList.remove('shown');
    t.classList.add('fade-out');
  }, 2800);
  setTimeout(() => t.remove(), 3400);
}

function copySessionCode(btn) {
  const code = document.getElementById('displaySessionCode').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = originalText, 2000);
  });
}

// Populate unit selector based on level (vocab dataset or grammar bank,
// depending on which picker card opened the setup screen).
function updateUnitSelector() {
  const level = document.getElementById('sessionLevel').value;
  const unitSelect = document.getElementById('sessionUnit');

  unitSelect.innerHTML = '<option value="all">All Units</option>';

  if (window.classroomMode === 'grammar' || window.classroomMode === 'mixed') {
    const GP = window.GRAMMAR_PRACTICE;
    const topics = (GP && GP.byLevel && GP.byLevel[level]) || [];
    let units = topics.map(t => {
      const m = String(t.blurb || '').match(/Units?\s+(\d+)/i);
      return m ? parseInt(m[1], 10) : 0;
    });
    if (window.classroomMode === 'mixed' && typeof vocabulary !== 'undefined' && vocabulary && vocabulary[level]) {
      // Vocab units are "Unit N" labels; merge their numbers in so the
      // teacher sees every unit that exists in EITHER source.
      units = units.concat(vocabulary[level].map(w => parseInt(String(w.unit).replace(/\D+/g, ''), 10) || 0));
    }
    [...new Set(units)].filter(u => u > 0).sort((a, b) => a - b).forEach(u => {
      unitSelect.innerHTML += `<option value="${u}">Unit ${u}</option>`;
    });
    return;
  }

  if (level && typeof vocabulary !== 'undefined' && vocabulary !== null && vocabulary[level]) {
    // Get unique units from the flat array
    const units = [...new Set(vocabulary[level].map(w => w.unit))].sort();
    units.forEach(unit => {
      unitSelect.innerHTML += `<option value="${unit}">${unit}</option>`;
    });
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const levelSelect = document.getElementById('sessionLevel');
  if (levelSelect) {
    levelSelect.addEventListener('change', updateUnitSelector);
  }
});
