/* ============================================================
   SENTENCE SCRAMBLE - Teacher (host) controller
   ------------------------------------------------------------
   Synchronized rounds: everyone gets the SAME example sentence
   from datasets.json (verbatim - the bank's own sentences, 4-10
   words), word-scrambled. Students rebuild it on their phones;
   faster correct answers score more. The host advances rounds
   (auto on timer / all-submitted, or manually).

   Join flow is IDENTICAL to the other classroom games: 5-char
   code + qrserver QR in the lobby.

   /scramble_sessions/{code}
     { code, status: lobby|playing|finished, hostUid, hostName,
       level, unit, roundSec, rounds[{words[],answer,word}],
       roundIndex, roundStartAt, createdAt, startedAt, endedAt }
     /players/{uid} { uid, name, avatar, score, correct,
                      answered, lastRound, lastOk, joinedAt }
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

  let currentUser = null;
  let sessionCode = null;
  let settings = null;
  let vocabulary = null;
  let sessionData = null;
  let unsubPlayers = null;
  let unsubSession = null;
  let timerInterval = null;
  let gameInFlight = false;
  let advancing = false;
  let lastPlayers = [];

  function setView(id) {
    document.documentElement.removeAttribute('data-mg-view');
    ['auto-creating', 'lobby', 'live', 'results'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }

  // Boot ONCE. onAuthStateChanged can fire again on token refresh, and by
  // then history.replaceState has stripped ?auto=1 - re-running the handler
  // would bounce the host back to the hub mid-game.
  let booted = false;
  auth.onAuthStateChanged(async user => {
    if (!user) { if (!booted) window.location.replace('index.html'); return; }
    if (booted) return;
    booted = true;
    currentUser = user;
    try {
      const doc = await db.collection('users').doc(user.uid).get();
      const role = doc.exists ? (doc.data().role || 'student') : 'student';
      if (role !== 'teacher' && role !== 'admin') {
        document.body.innerHTML = '<div style="padding:40px; text-align:center; color:#f1f5f9; font-family:sans-serif;">Teachers only.</div>';
        return;
      }
    } catch (e) { console.error('role check failed', e); }
    const nameEl = document.getElementById('teacherName');
    if (nameEl) nameEl.textContent = user.displayName || user.email || 'Teacher';

    const params = new URLSearchParams(location.search);
    if (params.get('auto') !== '1') {
      window.location.replace('classroom-teacher.html');
      return;
    }
    settings = {
      level: params.get('lvl') || '',
      unit: params.get('unit') || 'all',
      roundCount: Math.max(3, Math.min(20, parseInt(params.get('rounds') || '10', 10))),
      roundSec: Math.max(15, Math.min(120, parseInt(params.get('sec') || '40', 10)))
    };
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
    setView('auto-creating');
    try {
      const r = await fetch('datasets.json');
      vocabulary = await r.json();
    } catch (e) { console.warn('vocab load', e); }
    await createSession();
    if (!sessionCode) {
      MG.toast('Could not create the game - go back and try again.', 'fail');
      setTimeout(() => window.location.replace('classroom-teacher.html'), 2500);
    }
  });

  async function createSession() {
    const rounds = MG.scrambleRounds(vocabulary, settings.level, settings.unit, settings.roundCount);
    if (rounds.length < 3) { MG.toast('Not enough usable sentences at that level/unit.', 'fail'); return; }

    let code = MG.genCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('scramble_sessions').doc(code).get();
      if (!exists.exists) break;
      code = MG.genCode();
    }
    const session = {
      code,
      status: 'lobby',
      hostUid: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email || 'Teacher',
      level: settings.level,
      unit: settings.unit,
      roundSec: settings.roundSec,
      rounds,
      roundIndex: -1,
      roundStartAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt: null
    };
    try {
      await db.collection('scramble_sessions').doc(code).set(session);
      sessionCode = code;
      sessionData = session;
      enterLobby(code);
    } catch (e) {
      console.error('createSession', e);
      MG.toast('Could not create the room: ' + e.message, 'fail');
    }
  }

  function enterLobby(code) {
    setView('lobby');
    document.getElementById('roomCode').textContent = code;
    const url = MG.joinUrl('classroom-scramble-student.html', code);
    const link = document.getElementById('joinUrl');
    if (link) { link.textContent = url; link.href = url; }
    const qr = document.getElementById('qrImg');
    if (qr) qr.src = MG.qrSrc(url, 240);
    document.getElementById('lobbyMeta').textContent =
      settings.level + ' · ' + (settings.unit === 'all' ? 'All units' : settings.unit) +
      ' · ' + sessionData.rounds.length + ' sentences · ' + settings.roundSec + 's each';

    unsubPlayers = db.collection('scramble_sessions').doc(code).collection('players')
      .orderBy('joinedAt', 'asc')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        lastPlayers = players;
        renderRoster(players);
      });
  }

  function renderRoster(players) {
    const el = document.getElementById('roster');
    const count = document.getElementById('rosterCount');
    if (count) count.textContent = players.length;
    if (!players.length) {
      el.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px; grid-column: 1/-1;">Waiting for students to join...</p>';
    } else {
      el.innerHTML = players.map(p => `
        <div class="player-card">
          <div class="player-avatar">${MG.escHtml(p.avatar || '🔀')}</div>
          <div class="player-name">${MG.escHtml(p.name)}</div>
          <div class="player-status ready">✓ Ready</div>
        </div>`).join('');
    }
    const btn = document.getElementById('startBtn');
    btn.disabled = players.length < 1;
    btn.textContent = players.length < 1 ? '▶️ Waiting for players...' : `▶️ Start (${players.length} players)`;
  }

  async function startGame() {
    if (!sessionCode) return;
    try {
      await db.collection('scramble_sessions').doc(sessionCode).update({
        status: 'playing',
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
        roundIndex: 0,
        roundStartAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      gameInFlight = true;
      enterLive();
    } catch (e) { MG.toast('Could not start: ' + e.message, 'fail'); }
  }

  function enterLive() {
    setView('live');
    const liveCode = document.getElementById('liveCode');
    if (liveCode) liveCode.textContent = sessionCode;
    const qr = document.getElementById('liveQrImg');
    if (qr) qr.src = MG.qrSrc(MG.joinUrl('classroom-scramble-student.html', sessionCode), 120, 2);

    unsubSession = db.collection('scramble_sessions').doc(sessionCode).onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      sessionData = d;
      if (d.status === 'finished') { showResults(); return; }
      renderRound(d);
      resetRoundTimer(d);
    });

    unsubPlayers = db.collection('scramble_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        lastPlayers = players;
        renderLiveBoard(players);
        // Everyone answered this round -> advance early (small grace so
        // the last student sees their own feedback).
        const idx = sessionData ? sessionData.roundIndex : -1;
        if (idx >= 0 && players.length > 0 && players.every(p => (p.lastRound == null ? -1 : p.lastRound) >= idx)) {
          scheduleAdvance(1500);
        }
      });
  }

  function renderRound(d) {
    const idx = d.roundIndex == null ? -1 : d.roundIndex;
    const total = (d.rounds || []).length;
    const round = idx >= 0 ? d.rounds[idx] : null;
    document.getElementById('roundCount').textContent = idx < 0 ? 'Ready' : `Sentence ${idx + 1} of ${total}`;
    document.getElementById('roundAnswer').textContent = round ? round.answer : '';
    document.getElementById('roundWordChip').textContent = round ? ('key word: ' + round.word) : '';
    const btn = document.getElementById('nextRoundBtn');
    if (btn) btn.textContent = idx + 1 >= total ? '🏁 Finish after this one' : '⏭️ Next sentence';
  }

  function renderLiveBoard(players) {
    const idx = sessionData ? (sessionData.roundIndex == null ? -1 : sessionData.roundIndex) : -1;
    const submitted = players.filter(p => (p.lastRound == null ? -1 : p.lastRound) >= idx).length;
    document.getElementById('submitNote').textContent =
      idx < 0 ? '' : `${submitted} / ${players.length} submitted this sentence`;
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    document.getElementById('liveBoard').innerHTML = sorted.slice(0, 12).map((p, i) => {
      const done = (p.lastRound == null ? -1 : p.lastRound) >= idx;
      return `<div class="leaderboard-item">
        <div class="leaderboard-rank">${i + 1}</div>
        <div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(p.name)}</div></div>
        <div class="leaderboard-details" style="margin-right: 12px;">${done ? (p.lastOk ? '✅' : '❌') : '✏️'}</div>
        <div class="leaderboard-score">${p.score || 0}</div>
      </div>`;
    }).join('');
  }

  let advanceTimeout = null;
  function scheduleAdvance(delayMs) {
    if (advancing || advanceTimeout) return;
    advanceTimeout = setTimeout(() => { advanceTimeout = null; advanceRound(); }, delayMs);
  }

  function resetRoundTimer(d) {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    const idx = d.roundIndex == null ? -1 : d.roundIndex;
    if (idx < 0 || d.status !== 'playing') return;
    const startMs = d.roundStartAt && d.roundStartAt.toMillis ? d.roundStartAt.toMillis() : Date.now();
    const endMs = startMs + (d.roundSec || 40) * 1000;
    const el = document.getElementById('timer');
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      el.textContent = remaining + 's';
      el.classList.toggle('warning', remaining <= 10 && remaining > 5);
      el.classList.toggle('crit', remaining <= 5);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        scheduleAdvance(1200);
      }
    };
    tick();
    timerInterval = setInterval(tick, 500);
  }

  async function advanceRound() {
    if (advancing || !sessionData) return;
    advancing = true;
    try {
      const idx = sessionData.roundIndex == null ? -1 : sessionData.roundIndex;
      if (idx + 1 >= (sessionData.rounds || []).length) {
        await endGame();
      } else {
        await db.collection('scramble_sessions').doc(sessionCode).update({
          roundIndex: idx + 1,
          roundStartAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) { console.error('advanceRound', e); }
    advancing = false;
  }

  async function endGame() {
    if (!sessionCode) return;
    try {
      await db.collection('scramble_sessions').doc(sessionCode).update({
        status: 'finished',
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.error('endGame', e); }
  }

  async function showResults() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
    gameInFlight = false;
    setView('results');
    try {
      const sref = db.collection('scramble_sessions').doc(sessionCode);
      const [playersSnap, sessSnap] = await Promise.all([
        sref.collection('players').orderBy('score', 'desc').get(),
        sref.get()
      ]);
      const players = playersSnap.docs.map(d => d.data());
      const s = sessSnap.exists ? sessSnap.data() : {};

      if (window.saveGameReport) {
        window.saveGameReport(db, {
          game: 'scramble',
          mode: 'sentences',
          code: sessionCode,
          teacherId: s.hostUid || '',
          teacherName: s.hostName || '',
          level: s.level || '',
          unit: s.unit === 'all' ? 'All units' : String(s.unit || ''),
          wordCount: (s.rounds || []).length,
          players: players.map(p => ({ name: p.name || '', score: p.score || 0 }))
        });
      }

      renderPodium(players);
      document.getElementById('perPlayerBody').innerHTML = players.map((p, i) => {
        const answered = p.answered || 0;
        const acc = answered ? Math.round(((p.correct || 0) / answered) * 100) : 0;
        return `<div class="leaderboard-item">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(p.name)}</div></div>
          <div class="leaderboard-details" style="margin-right: 12px;">${p.correct || 0} / ${answered} correct${answered ? ' · ' + acc + '%' : ''}</div>
          <div class="leaderboard-score">${p.score || 0}</div>
        </div>`;
      }).join('');

      // Sentence review for the class discussion.
      document.getElementById('sentenceReview').innerHTML = (s.rounds || []).map((r, i) =>
        `<div class="leaderboard-item"><div class="leaderboard-rank">${i + 1}</div><div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(r.answer)}</div></div><div class="leaderboard-details">${MG.escHtml(r.word)}</div></div>`
      ).join('');

      const dl = document.getElementById('downloadResultsBtn');
      if (dl) dl.onclick = () => {
        const rows = [['Rank', 'Name', 'Score', 'Correct', 'Answered', 'Accuracy %']];
        players.forEach((p, i) => {
          const answered = p.answered || 0;
          rows.push([i + 1, p.name || '', p.score || 0, p.correct || 0, answered,
            answered ? Math.round(((p.correct || 0) / answered) * 100) : 0]);
        });
        MG.downloadCsv(rows, `scramble-${sessionCode}-${new Date().toISOString().slice(0, 10)}.csv`);
      };
    } catch (e) { console.error('showResults', e); }
    cleanup();
  }

  // Same podium component as the Vocab Race results (CSS handles order).
  function renderPodium(players) {
    const positions = ['first', 'second', 'third'];
    const medals = ['🥇', '🥈', '🥉'];
    document.getElementById('podium').innerHTML = players.slice(0, 3).map((p, i) => `
      <div class="podium-place ${positions[i]}">
        <div class="podium-rank" style="font-size: 2rem;">${medals[i]}</div>
        <div class="podium-name" style="font-weight: 600; margin-top: 6px;">${MG.escHtml(p.name)}</div>
        <div class="podium-score" style="color: var(--accent-primary); font-weight: 700; margin-top: 4px;">${p.score || 0} pts</div>
      </div>`).join('');
  }

  function cleanup() {
    if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
    if (unsubSession) { unsubSession(); unsubSession = null; }
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('nextRoundBtn').addEventListener('click', () => {
      if (advanceTimeout) { clearTimeout(advanceTimeout); advanceTimeout = null; }
      advanceRound();
    });
    document.getElementById('endBtn').addEventListener('click', async () => {
      const ok = await MG.ask('End the game?', 'Everyone moves to the results screen. This cannot be undone.', 'End game');
      if (ok) endGame();
    });
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });
    function confirmLeave(e, label) {
      if (!gameInFlight) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      MG.ask('Leave the game?', `A game is in progress. Leaving to ${label} stops the round timer - end the game first?`, 'Leave anyway')
        .then(ok => { if (ok) window.location.href = href; });
    }
    const b1 = document.getElementById('backToClassroom');
    const b2 = document.getElementById('backToDashboard');
    if (b1) b1.addEventListener('click', e => confirmLeave(e, 'Classroom Mode'));
    if (b2) b2.addEventListener('click', e => confirmLeave(e, 'the dashboard'));
  });

  window.addEventListener('beforeunload', e => {
    cleanup();
    if (gameInFlight) { e.preventDefault(); e.returnValue = ''; return ''; }
  });
})();
