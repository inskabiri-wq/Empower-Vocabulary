/* ============================================
   CLASSROOM MODE - Student JavaScript
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

// Initialize audio
(function() {
  const audio = document.getElementById('bgMusic');
  if (audio) {
    audio.volume = 0.3;
    audio.loop = false;
    audio.addEventListener('ended', () => {
      if (musicPlaying) playRandomTrack();
    });
  }
})();

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

// Auth Protection
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('studentName').textContent = currentUser.displayName || currentUser.email;
});

let currentUser = null;
let currentSession = null;
let sessionData = null;
let sessionListener = null;

// beforeunload guard — discourage students from accidentally swiping
// back during a live game. Browsers show their own "Leave site?"
// prompt; we just have to set returnValue. Only active while the game
// is actually in flight, so the join screen and the final-results
// screen don't nag.
window.addEventListener('beforeunload', (e) => {
  if (sessionData && sessionData.status === 'active') {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});
let currentQuestionIndex = 0;
let score = 0;
let correctAnswers = 0;
let questionStartTime = 0;
let gameWords = [];
let timerInterval = null;
let answerProcessed = false;   // prevents double processAnswer per question
let nextQuestionTimeout = null; // tracks pending setTimeout for cleanup
let gameActive = false;         // prevents double startGame from snapshot
let lastStudentAnswer = '';     // captures the student's answer text for per-question tracking
let lastQuestionType = '';      // 'multiple' or 'type'

// ============================================
// JOIN SESSION
// ============================================

async function joinSession() {
  const codeInput = document.getElementById('sessionCodeInput');
  const code = codeInput.value.trim().toUpperCase();

  // Two valid code shapes now:
  //   • 6-char (vocab race / classic classroom)  — classroom_sessions
  //   • 4-char (The Heist)                       — heist_sessions
  // Reject anything else early.
  if (code.length !== 6 && code.length !== 4) {
    showError('Codes are 4 letters (Heist) or 6 characters (Classroom).');
    return;
  }

  try {
    // Heist codes are 4 chars — check that collection first. If found,
    // redirect to the dedicated heist-student page (it has the vault /
    // hint UI, totally different layout). The ?code= query string
    // pre-fills the input on the next page so the student doesn't
    // re-type.
    if (code.length === 4) {
      const heistDoc = await db.collection('heist_sessions').doc(code).get();
      if (heistDoc.exists) {
        window.location.href = 'classroom-heist-student.html?code=' + encodeURIComponent(code);
        return;
      }
      showError('Heist room not found. Check the code with your teacher.');
      return;
    }

    // 6-char path: classic classroom (Vocab Race).
    const sessionDoc = await db.collection('classroom_sessions').doc(code).get();

    if (!sessionDoc.exists) {
      showError('Session not found. Please check the code.');
      return;
    }
    
    sessionData = sessionDoc.data();
    
    if (sessionData.status === 'finished') {
      showError('This session has already ended.');
      return;
    }
    
    currentSession = code;
    
    // Add player to session
    await db.collection('classroom_sessions').doc(code)
      .collection('players').doc(currentUser.uid).set({
        name: currentUser.displayName || currentUser.email.split('@')[0],
        odmail: currentUser.email,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'ready',
        score: 0,
        correctAnswers: 0
      });
    
    // Show waiting lobby
    showWaitingLobby();
    
    // Listen for game start
    listenToSession();
    
  } catch (error) {
    console.error('Error joining session:', error);
    showError('Failed to join session. Please try again.');
  }
}

function showWaitingLobby() {
  document.getElementById('joinScreen').style.display = 'none';
  document.getElementById('waitingScreen').style.display = 'block';
  
  document.getElementById('waitingSessionCode').textContent = currentSession;
  document.getElementById('waitingSessionInfo').innerHTML = `
    <strong>Level:</strong> ${sessionData.level} | 
    <strong>Words:</strong> ${sessionData.wordCount} | 
    <strong>Teacher:</strong> ${sessionData.teacherName}
  `;
}

function listenToSession() {
  sessionListener = db.collection('classroom_sessions').doc(currentSession)
    .onSnapshot(doc => {
      if (!doc.exists) {
        showError('Session was cancelled');
        leaveSession();
        return;
      }

      const data = doc.data();
      sessionData = data;

      if (data.status === 'active' && !gameActive &&
          document.getElementById('waitingScreen').style.display !== 'none') {
        startGame();
      }

      if (data.status === 'finished') {
        // Trigger results from game screen OR from waitingResultsScreen
        const onGame = document.getElementById('gameScreen').style.display !== 'none';
        const onWaiting = document.getElementById('waitingResultsScreen').style.display !== 'none';
        if (onGame || onWaiting) {
          endGame();
        }
      }
    });
}

// ============================================
// GAME LOGIC
// ============================================

function startGame() {
  // Prevent double start from rapid Firestore snapshots
  if (gameActive) return;
  gameActive = true;

  document.getElementById('waitingScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';

  // Clean up any stale state from previous game
  clearInterval(timerInterval);
  if (nextQuestionTimeout) { clearTimeout(nextQuestionTimeout); nextQuestionTimeout = null; }
  answerProcessed = false;

  // Reset game state
  score = 0;
  correctAnswers = 0;
  currentQuestionIndex = 0;
  gameWords = [...sessionData.words];

  // Update status
  updatePlayerStatus('playing');

  // Show first question
  showQuestion();
}

function showQuestion() {
  if (currentQuestionIndex >= gameWords.length) {
    finishGame();
    return;
  }

  answerProcessed = false; // reset for new question

  const word = gameWords[currentQuestionIndex];
  const totalQuestions = gameWords.length;
  
  // Update progress
  document.getElementById('questionProgress').textContent = `${currentQuestionIndex + 1}/${totalQuestions}`;
  document.getElementById('progressFill').style.width = `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`;
  document.getElementById('currentScore').textContent = score;
  
  // Grammar questions carry their own options and are always multiple
  // choice. Decided PER ITEM (not per session) so 'mixed' sessions render
  // each question correctly; vocab items keep the random multiple/type mix.
  const isGrammarItem = Array.isArray(word.options) && word.options.length >= 2;
  const questionType = isGrammarItem ? 'multiple' : (Math.random() > 0.4 ? 'multiple' : 'type');
  lastQuestionType = questionType;
  lastStudentAnswer = '';

  const questionContainer = document.getElementById('questionContainer');
  questionStartTime = Date.now();

  // Start timer
  startTimer(sessionData.timeLimit);

  if (isGrammarItem) {
    showGrammarChoice(word, questionContainer);
  } else if (questionType === 'multiple') {
    showMultipleChoice(word, questionContainer);
  } else {
    showTypeQuestion(word, questionContainer);
  }
}

// Grammar Race question: the sentence (with a blank) + the question's own
// four options, reshuffled per student so neighbours can't copy positions.
function showGrammarChoice(q, container) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const stemHtml = esc(q.word).replace(/_{2,}/, '<span style="display:inline-block;min-width:64px;border-bottom:3px solid #fb923c;vertical-align:bottom;"></span>');
  const opts = shuffleArray((q.options || []).map((t, i) => ({ text: t, correct: i === q.answer })));

  container.innerHTML = `
    <div class="question-card">
      <div class="question-type">📝 Grammar</div>
      <div class="question-word" style="font-size: 1.25rem; line-height: 1.6;">${stemHtml}</div>
      <div class="question-prompt">Choose the word that completes the sentence:</div>
      <div class="options-grid">
        ${opts.map(opt => `
          <button class="option-btn" onclick="selectOption(this, ${opt.correct})" data-correct="${opt.correct}">
            ${esc(opt.text)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function showMultipleChoice(word, container) {
  // Get wrong options from other words, preferring same POS to avoid giveaways
  const normPOS = (pos) => {
    if (!pos) return '';
    const m = pos.toLowerCase().trim().match(/^(noun|verb|adjective|adverb|preposition|pronoun|conjunction|determiner|phrase|exclamation|interjection)/);
    return m ? m[1] : pos.toLowerCase().trim();
  };
  const correctPOS = normPOS(word.pos);
  const otherWords = gameWords.filter(w => w.word !== word.word);
  // Prefer same POS, fall back to any word if not enough matches
  const samePOS = otherWords.filter(w => normPOS(w.pos) === correctPOS);
  const pool = samePOS.length >= 3 ? samePOS : otherWords;
  const shuffledOthers = shuffleArray(pool).slice(0, 3);
  
  // Create options array with correct answer
  const options = shuffleArray([
    { text: word.definition || word.example, correct: true },
    ...shuffledOthers.map(w => ({ text: w.definition || w.example, correct: false }))
  ]);
  
  container.innerHTML = `
    <div class="question-card">
      <div class="question-type">📝 Multiple Choice</div>
      <div class="question-word">${word.word}</div>
      ${word.pos ? `<div class="question-pos">(${word.pos})</div>` : ''}
      <div class="question-prompt">Select the correct definition or example:</div>
      <div class="options-grid">
        ${options.map((opt, i) => `
          <button class="option-btn" onclick="selectOption(this, ${opt.correct})" data-correct="${opt.correct}">
            ${opt.text}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function showTypeQuestion(word, container) {
  // Show definition/example, ask for the word
  const hint = word.definition || word.example || '';
  const trimmedWord = word.word.trim();
  const firstLetter = (trimmedWord[0] || '?').toUpperCase();
  
  container.innerHTML = `
    <div class="question-card">
      <div class="question-type">⌨️ Type the Answer</div>
      <div class="question-prompt" style="font-size: 1.2rem; margin-bottom: 8px;">${hint}</div>
      ${word.pos ? `<div class="question-pos">(${word.pos})</div>` : ''}
      <div class="question-prompt">Type the word that matches this definition:</div>
      <div class="type-answer-container">
        <input type="text" id="typeAnswerInput" class="type-input" placeholder="Type your answer..." autocomplete="off" autofocus>
        <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">Hint: Starts with "${firstLetter}"</div>
        <button class="btn btn-primary submit-answer-btn" onclick="submitTypedAnswer()">Submit Answer</button>
      </div>
    </div>
  `;
  
  // Focus input and listen for Enter key
  const input = document.getElementById('typeAnswerInput');
  input.focus();
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitTypedAnswer();
  });
}

function selectOption(btn, isCorrect) {
  if (answerProcessed) return; // already answered (timer or click)

  lastStudentAnswer = btn.textContent.trim();

  // Disable all buttons
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

  // Show result
  btn.classList.add(isCorrect ? 'correct' : 'incorrect');

  // Highlight correct answer if wrong
  if (!isCorrect) {
    document.querySelector('.option-btn[data-correct="true"]').classList.add('correct');
  }

  // Calculate score
  processAnswer(isCorrect);
}

function submitTypedAnswer() {
  if (answerProcessed) return; // already answered (timer or click)

  const input = document.getElementById('typeAnswerInput');
  const answer = input.value.trim().toLowerCase();
  const correctWord = gameWords[currentQuestionIndex].word.toLowerCase();
  lastStudentAnswer = input.value.trim();

  // Allow some flexibility (exact match or close match)
  const isCorrect = answer === correctWord ||
                    levenshteinDistance(answer, correctWord) <= 1;

  input.disabled = true;
  input.classList.add(isCorrect ? 'correct' : 'incorrect');
  
  if (!isCorrect) {
    // Show correct answer
    const container = document.querySelector('.type-answer-container');
    container.innerHTML += `<div style="color: var(--success); margin-top: 12px; font-size: 1.1rem;">Correct answer: <strong>${gameWords[currentQuestionIndex].word}</strong></div>`;
  }
  
  processAnswer(isCorrect);
}

function processAnswer(isCorrect) {
  if (answerProcessed) return; // guard: only process once per question
  answerProcessed = true;

  clearInterval(timerInterval);

  const timeSpent = (Date.now() - questionStartTime) / 1000;
  const timeLimit = sessionData.timeLimit;

  if (isCorrect) {
    correctAnswers++;
    // Score based on speed: faster = more points
    const timeBonus = Math.max(0, Math.floor((1 - timeSpent / timeLimit) * 50));
    const questionScore = 100 + timeBonus;
    score += questionScore;

    showScorePopup(`+${questionScore}`);
  }

  // Update score display
  document.getElementById('currentScore').textContent = score;

  // Sync score to Firebase in real-time so teacher leaderboard updates live
  if (currentSession && currentUser) {
    db.collection('classroom_sessions').doc(currentSession)
      .collection('players').doc(currentUser.uid).update({
        score: score,
        correctAnswers: correctAnswers
      }).catch(err => console.warn('Live score sync failed:', err));

    // Store per-question answer for teacher's review page
    const word = gameWords[currentQuestionIndex];
    db.collection('classroom_sessions').doc(currentSession)
      .collection('players').doc(currentUser.uid)
      .collection('answers').doc(String(currentQuestionIndex))
      .set({
        questionIndex: currentQuestionIndex,
        word: word.word,
        definition: word.definition || '',
        questionType: lastQuestionType,
        studentAnswer: lastStudentAnswer,
        isCorrect: isCorrect,
        timeSpent: timeSpent
      }).catch(err => console.warn('Answer sync failed:', err));
  }

  // Next question after delay — longer for wrong answers so students can read the correct answer
  const delay = isCorrect ? 1500 : 3500;
  nextQuestionTimeout = setTimeout(() => {
    nextQuestionTimeout = null;
    currentQuestionIndex++;
    showQuestion();
  }, delay);
}

function showScorePopup(text) {
  const popup = document.createElement('div');
  popup.textContent = text;
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 3rem;
    font-weight: 700;
    color: var(--success);
    text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
    animation: scorePopup 1s ease forwards;
    z-index: 1000;
    pointer-events: none;
  `;
  document.body.appendChild(popup);
  
  setTimeout(() => popup.remove(), 1000);
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes scorePopup {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
    100% { opacity: 0; transform: translate(-50%, -100%) scale(1); }
  }
`;
document.head.appendChild(style);

// ============================================
// TIMER
// ============================================

function startTimer(seconds) {
  clearInterval(timerInterval); // prevent stacking intervals across questions
  let timeLeft = seconds;
  const timerEl = document.getElementById('gameTimer');

  updateTimerDisplay(timeLeft, seconds);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay(timeLeft, seconds);
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timeUp();
    }
  }, 1000);
}

function updateTimerDisplay(timeLeft, total) {
  const timerEl = document.getElementById('gameTimer');
  timerEl.textContent = timeLeft + 's';
  
  timerEl.classList.remove('warning', 'danger');
  if (timeLeft <= 5) {
    timerEl.classList.add('danger');
  } else if (timeLeft <= 10) {
    timerEl.classList.add('warning');
  }
}

function timeUp() {
  if (answerProcessed) return; // already answered before timer expired

  lastStudentAnswer = '(time up)';

  // Auto-submit with wrong answer
  const input = document.getElementById('typeAnswerInput');
  if (input) {
    input.disabled = true;
    input.classList.add('incorrect');
    // Show correct answer for type questions on timeout
    const container = document.querySelector('.type-answer-container');
    if (container) {
      container.innerHTML += `<div style="color: var(--success); margin-top: 12px; font-size: 1.1rem;">Correct answer: <strong>${gameWords[currentQuestionIndex].word}</strong></div>`;
    }
  }

  document.querySelectorAll('.option-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.correct === 'true') {
      b.classList.add('correct');
    }
  });

  processAnswer(false);
}

// ============================================
// FINISH GAME
// ============================================

async function finishGame() {
  clearInterval(timerInterval);
  if (nextQuestionTimeout) { clearTimeout(nextQuestionTimeout); nextQuestionTimeout = null; }
  gameActive = false;
  
  // Update player score in Firebase
  try {
    await db.collection('classroom_sessions').doc(currentSession)
      .collection('players').doc(currentUser.uid).update({
        score: score,
        correctAnswers: correctAnswers,
        status: 'finished',
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch (error) {
    console.error('Error saving score:', error);
  }
  
  // Show waiting for results or results
  if (sessionData.status === 'finished') {
    showResults();
  } else {
    showWaitingForResults();
  }
}

function showWaitingForResults() {
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('waitingResultsScreen').style.display = 'block';
  
  document.getElementById('yourScore').textContent = score;
  document.getElementById('yourCorrect').textContent = `${correctAnswers}/${gameWords.length}`;
}

function endGame() {
  showResults();
}

async function showResults() {
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('waitingResultsScreen').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'block';
  
  // Celebration!
  createConfetti();
  
  // Get all players
  const playersSnapshot = await db.collection('classroom_sessions').doc(currentSession)
    .collection('players')
    .orderBy('score', 'desc')
    .get();
  
  const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const myRank = players.findIndex(p => p.id === currentUser.uid) + 1;
  const myData = players.find(p => p.id === currentUser.uid);
  
  // Show result card
  document.getElementById('resultRank').innerHTML = `You placed <span>#${myRank}</span>`;
  document.getElementById('resultScore').textContent = `${myData?.score || score} points`;
  document.getElementById('resultCorrect').textContent = myData?.correctAnswers || correctAnswers;
  document.getElementById('resultTotal').textContent = gameWords.length;
  document.getElementById('resultAccuracy').textContent = Math.round(((myData?.correctAnswers || correctAnswers) / gameWords.length) * 100) + '%';
  
  // Show leaderboard
  const leaderboardHtml = players.map((player, index) => `
    <div class="leaderboard-item ${player.id === currentUser.uid ? 'current-user' : ''}">
      <div class="leaderboard-rank">${index + 1}</div>
      <div class="leaderboard-player">
        <div class="leaderboard-avatar">${getInitials(player.name)}</div>
        <div>
          <div class="leaderboard-name">${escapeHtml(player.name)} ${player.id === currentUser.uid ? '(You)' : ''}</div>
          <div class="leaderboard-details">${player.correctAnswers || 0}/${gameWords.length} correct</div>
        </div>
      </div>
      <div class="leaderboard-score">${player.score || 0}</div>
    </div>
  `).join('');
  
  document.getElementById('resultsLeaderboard').innerHTML = leaderboardHtml;
}

// ============================================
// UTILITIES
// ============================================

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => errorEl.style.display = 'none', 3000);
  } else {
    AppDialog.alert(message);
  }
}

async function updatePlayerStatus(status) {
  try {
    await db.collection('classroom_sessions').doc(currentSession)
      .collection('players').doc(currentUser.uid).update({ status });
  } catch (e) {
    console.log('Could not update status');
  }
}

function leaveSession() {
  if (sessionListener) sessionListener();
  clearInterval(timerInterval);
  if (nextQuestionTimeout) { clearTimeout(nextQuestionTimeout); nextQuestionTimeout = null; }
  gameActive = false;
  answerProcessed = false;
  currentSession = null;
  sessionData = null;
  
  document.getElementById('waitingScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('waitingResultsScreen').style.display = 'none';
  document.getElementById('joinScreen').style.display = 'block';
  
  document.getElementById('sessionCodeInput').value = '';
}

function playAgain() {
  leaveSession();
}

function logout() {
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
}

// Format code input and init
document.addEventListener('DOMContentLoaded', () => {
  const codeInput = document.getElementById('sessionCodeInput');
  if (codeInput) {
    codeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    });
  }
  
  // Init particles
  initParticles();

  // ── Auto-fill the join code from a QR-scanned URL ─────────
  // The teacher's lobby QR encodes a URL like:
  //   classroom-student.html?code=A1B2C3
  // When a student scans it, the page opens with the code in the
  // query string. Pre-fill the input so they can just tap "Join"
  // without typing the 6-character code by hand. We don't auto-
  // submit — students should still see the code and tap Join,
  // which avoids surprise behavior if a stale link is bookmarked.
  try {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = (params.get('code') || '').trim().toUpperCase();
    if (codeFromUrl && /^[A-Z0-9]{4,8}$/.test(codeFromUrl)) {
      const input = document.getElementById('sessionCodeInput');
      if (input) {
        input.value = codeFromUrl;
        // Subtle hint: focus the Join button so Enter / a tap
        // immediately submits without an extra interaction.
        const joinBtn = document.querySelector('#joinScreen .btn.btn-primary');
        if (joinBtn) joinBtn.focus();
      }
    }
  } catch (_) { /* URLSearchParams not supported — ignore */ }

  // Note: bgMusic 'ended' listener and initial volume are set in the IIFE
  // above (line ~166). Duplicating them here caused two playRandomTrack()
  // calls to fire at every track boundary (one respecting `musicPlaying`,
  // one ignoring it) → overlapping songs. Handled in one place now.
});
