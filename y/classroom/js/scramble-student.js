/* ============================================================
   SENTENCE SCRAMBLE - Student client
   ------------------------------------------------------------
   Synchronized rounds: the session doc carries the scrambled
   sentence; every phone shows the same one at the same time.
   Tap word chips to build the sentence (duplicate words are
   tracked by position, not text), then Submit. Correct =
   100 pts + 2 per second left on the clock.
   ============================================================ */
(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyDmTTictWJmxVxj9frqSODPUjOgpRPPNzU",
    authDomain: "empower-vocabulary-practice.firebaseapp.com",
    projectId: "empower-vocabulary-practice",
    storageBucket: "empower-vocabulary-practice.firebasestorage.app",
    messagingSenderId: "136270199832",
    appId: "1:136270199832:web:174222066ef1cbdc8f576d"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // LOCAL TESTING ONLY: same emulator opt-in as the other classroom pages
  // (localhost + localStorage.useEmulators='1'). See tools/README-emulator-e2e.md.
  try {
    if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
        localStorage.getItem('useEmulators') === '1') {
      auth.useEmulator('http://127.0.0.1:9099');
      db.useEmulator('127.0.0.1', 8080);
      console.warn('[emulator] connected to LOCAL Auth (9099) + Firestore (8080)');
    }
  } catch (e) { /* never block app boot */ }

  MG.setupMusic([
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
  ]);

  let myUid = null;
  let myName = '';
  let myAvatar = '🔀';
  let sessionCode = null;
  let session = null;
  let myScore = 0;
  let renderedRound = -1;    // which roundIndex the board currently shows
  let submittedRound = -1;   // which roundIndex I already submitted
  let builtIdx = [];         // indices into round.words, in tap order
  let countdownInt = null;
  let unsubs = [];

  const AVATARS = ['🦊', '🐯', '🐼', '🐧', '🦁', '🐸', '🐙', '🦉', '🐢', '🐝', '🐳', '🦄', '🐺', '🐰', '🦝'];

  function setView(id) {
    ['join', 'wait', 'play', 'done'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }

  async function ensureAuth() {
    if (auth.currentUser) { myUid = auth.currentUser.uid; return; }
    try {
      const cred = await auth.signInAnonymously();
      myUid = cred.user.uid;
    } catch (e) {
      console.error('anon auth', e);
      MG.toast(e && e.code === 'auth/operation-not-allowed'
        ? 'Anonymous sign-in is disabled. Ask your teacher.'
        : 'Could not sign you in: ' + (e.message || e), 'fail');
    }
  }

  async function joinRoom() {
    await ensureAuth();
    if (!myUid) return;
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    const name = document.getElementById('nameInput').value.trim().slice(0, 24);
    if (!code) { MG.toast('Enter the game code', 'fail'); return; }
    if (!name) { MG.toast('Enter your name', 'fail'); return; }

    const sref = db.collection('scramble_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { MG.toast('Game not found - check the code', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { MG.toast('That game has ended', 'fail'); return; }

    sessionCode = code;
    myName = name;
    myAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    try {
      await sref.collection('players').doc(myUid).set({
        uid: myUid, name: myName, avatar: myAvatar,
        score: 0, correct: 0, answered: 0, lastRound: -1, lastOk: false,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { MG.toast('Could not join: ' + e.message, 'fail'); return; }

    setView('wait');
    subscribe();
    if (session.status === 'playing') enterPlay();
  }

  function subscribe() {
    const sref = db.collection('scramble_sessions').doc(sessionCode);
    unsubs.push(sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) { MG.toast('The game was cancelled', 'fail'); setView('join'); return; }
      session = d;
      if (d.status === 'playing') enterPlay();
      if (d.status === 'finished') enterDone();
    }));
  }

  function enterPlay() {
    setView('play');
    const idx = session.roundIndex == null ? -1 : session.roundIndex;
    if (idx >= 0 && idx !== renderedRound) renderRound(idx);
  }

  function roundEndMs() {
    const startMs = session.roundStartAt && session.roundStartAt.toMillis
      ? session.roundStartAt.toMillis() : Date.now();
    return startMs + (session.roundSec || 40) * 1000;
  }

  function renderRound(idx) {
    renderedRound = idx;
    builtIdx = [];
    const round = session.rounds[idx];
    document.getElementById('roundLabel').textContent = `Sentence ${idx + 1} of ${session.rounds.length}`;
    document.getElementById('roundResult').innerHTML = '';
    document.getElementById('submitBtn').style.display = '';
    document.getElementById('submitBtn').disabled = false;
    renderChips(round);
    startCountdown();
  }

  function startCountdown() {
    if (countdownInt) { clearInterval(countdownInt); countdownInt = null; }
    const el = document.getElementById('countdown');
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((roundEndMs() - Date.now()) / 1000));
      el.textContent = remaining + 's';
      el.classList.toggle('warning', remaining <= 10 && remaining > 5);
      el.classList.toggle('crit', remaining <= 5);
      if (remaining <= 0 && countdownInt) { clearInterval(countdownInt); countdownInt = null; }
    };
    tick();
    countdownInt = setInterval(tick, 500);
  }

  // Chips are tracked by POSITION (data-idx), so sentences with the
  // same word twice stay buildable.
  function renderChips(round) {
    const line = document.getElementById('answerLine');
    const pool = document.getElementById('chipPool');
    line.innerHTML = builtIdx.map(i =>
      `<button type="button" class="scr-chip" data-idx="${i}">${MG.escHtml(round.words[i])}</button>`).join('') ||
      '<span style="color: var(--text-muted); padding: 4px 6px;">Tap the words below in the right order...</span>';
    pool.innerHTML = round.words.map((w, i) =>
      builtIdx.indexOf(i) === -1
        ? `<button type="button" class="scr-chip" data-idx="${i}">${MG.escHtml(w)}</button>`
        : '').join('');
    pool.querySelectorAll('.scr-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (submittedRound >= renderedRound) return;
        builtIdx.push(parseInt(chip.dataset.idx, 10));
        renderChips(round);
      });
    });
    line.querySelectorAll('.scr-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (submittedRound >= renderedRound) return;
        builtIdx = builtIdx.filter(i => i !== parseInt(chip.dataset.idx, 10));
        renderChips(round);
      });
    });
  }

  async function submit() {
    const idx = renderedRound;
    if (idx < 0 || submittedRound >= idx) return;
    const round = session.rounds[idx];
    if (builtIdx.length !== round.words.length) {
      MG.toast('Use every word first.', 'fail');
      return;
    }
    submittedRound = idx;
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').style.display = 'none';

    const built = builtIdx.map(i => round.words[i]).join(' ');
    const ok = built === round.answer;
    const secondsLeft = Math.max(0, Math.ceil((roundEndMs() - Date.now()) / 1000));
    const points = ok ? 100 + secondsLeft * 2 : 0;
    myScore += points;
    document.getElementById('myScore').textContent = myScore;

    const res = document.getElementById('roundResult');
    res.innerHTML = ok
      ? `<div class="scr-result-ok">✅ Correct! +${points}</div>`
      : `<div class="scr-result-no">❌ Not quite.</div><div style="color: var(--text-secondary); margin-top: 6px;">Correct: "${MG.escHtml(round.answer)}"</div>`;

    try {
      await db.collection('scramble_sessions').doc(sessionCode).collection('players').doc(myUid).update({
        score: firebase.firestore.FieldValue.increment(points),
        correct: firebase.firestore.FieldValue.increment(ok ? 1 : 0),
        answered: firebase.firestore.FieldValue.increment(1),
        lastRound: idx,
        lastOk: ok
      });
    } catch (e) { console.error('submit update', e); }
  }

  async function enterDone() {
    setView('done');
    if (countdownInt) { clearInterval(countdownInt); countdownInt = null; }
    try {
      const snap = await db.collection('scramble_sessions').doc(sessionCode)
        .collection('players').orderBy('score', 'desc').get();
      const players = snap.docs.map(d => d.data());
      const mine = players.findIndex(p => p.uid === myUid);
      const me = mine >= 0 ? players[mine] : null;
      document.getElementById('doneRank').textContent = mine >= 0 ? `#${mine + 1} of ${players.length}` : '-';
      document.getElementById('doneScore').textContent = ((me && me.score) || myScore) + ' pts';
      document.getElementById('doneStats').textContent =
        me ? `${me.correct || 0} of ${me.answered || 0} sentences correct` : '';
      document.getElementById('doneList').innerHTML = players.slice(0, 10).map((p, i) => `
        <div class="leaderboard-item ${p.uid === myUid ? 'current-user' : ''}">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(p.name)}</div></div>
          <div class="leaderboard-score">${p.score || 0}</div>
        </div>`).join('');
    } catch (e) { console.error('done', e); }
    unsubs.forEach(u => { try { u(); } catch (_) {} });
    unsubs = [];
  }

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) document.getElementById('codeInput').value = code.toUpperCase();
    document.getElementById('joinBtn').addEventListener('click', joinRoom);
    document.getElementById('submitBtn').addEventListener('click', submit);
  });

  window.refreshGuardShouldProtect = () => !!(session && session.status === 'playing');
  window.addEventListener('beforeunload', e => {
    if (session && session.status === 'playing'
        && document.getElementById('view-play')
        && document.getElementById('view-play').style.display !== 'none') {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
})();
