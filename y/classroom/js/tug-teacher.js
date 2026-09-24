/* ============================================================
   TUG OF WAR - Teacher (host) controller
   ------------------------------------------------------------
   Class splits into RED and BLUE. Every correct answer is one
   pull on the rope; the projector shows the rope live. First
   team to lead by `targetLead` pulls wins, or the leader when
   the timer runs out.

   Same trust model as The Heist: the teacher's tab is the
   referee (detects the win, flips status to finished). The
   question list is built ONCE here from the real banks
   (datasets.json vocabulary / GRAMMAR_PRACTICE grammar via
   minigame-core builders) and stored on the session doc -
   students never load the banks.

   /tug_sessions/{code}
     { code, status: lobby|playing|finished, hostUid, hostName,
       mode, level, unit, durationSec, targetLead, questions[],
       winner, createdAt, startedAt, endedAt }
     /players/{uid} { uid, name, avatar, team, score, answered, joinedAt }
   ============================================================ */
(function () {
  'use strict';

  // Firebase is started by js/firebase-init.js, which reads the project
  // from js/tenant.js. This file used to name one university directly, which would
  // have pointed every deployment at that same project.
  if (!firebase.apps.length) {
    throw new Error('tug-teacher: js/tenant.js + js/firebase-init.js must load first.');
  }
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
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3'
  ]);

  let currentUser = null;
  let sessionCode = null;
  let settings = null;
  let vocabulary = null;
  let unsubPlayers = null;
  let unsubSession = null;
  let timerInterval = null;
  let gameInFlight = false;
  let lastPlayers = [];
  let winFired = false;

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
      // The inline form on classroom-teacher.html is the only launcher.
      window.location.replace('classroom-teacher.html');
      return;
    }
    settings = {
      qsrc: ['grammar', 'mixed'].indexOf(params.get('qsrc')) >= 0 ? params.get('qsrc') : 'vocab',
      level: params.get('lvl') || '',
      unit: params.get('unit') || 'all',
      durationMin: parseInt(params.get('dur') || '8', 10),
      targetLead: parseInt(params.get('lead') || '15', 10)
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
    // Build the shared question list from the real banks.
    const count = 40;
    let questions = [];
    if (settings.qsrc === 'grammar') {
      questions = MG.grammarMCQs(settings.level, settings.unit, count);
    } else if (settings.qsrc === 'mixed') {
      questions = MG.mixedMCQs(vocabulary, settings.level, settings.unit, count);
    } else {
      questions = MG.vocabMCQs(vocabulary, settings.level, settings.unit, count);
    }
    if (!questions.length) { MG.toast('No questions found for that level/unit.', 'fail'); return; }

    let code = MG.genCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('tug_sessions').doc(code).get();
      if (!exists.exists) break;
      code = MG.genCode();
    }
    const session = {
      code,
      status: 'lobby',
      hostUid: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email || 'Teacher',
      mode: settings.qsrc,
      level: settings.level,
      unit: String(settings.unit),
      durationSec: Math.max(60, settings.durationMin * 60),
      targetLead: Math.max(3, settings.targetLead),
      questions,
      winner: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt: null
    };
    try {
      await db.collection('tug_sessions').doc(code).set(session);
      sessionCode = code;
      enterLobby(code);
    } catch (e) {
      console.error('createSession', e);
      MG.toast('Could not create the room: ' + e.message, 'fail');
    }
  }

  function enterLobby(code) {
    setView('lobby');
    document.getElementById('roomCode').textContent = code;
    const url = MG.joinUrl('classroom-tug-student.html', code);
    const link = document.getElementById('joinUrl');
    if (link) { link.textContent = url; link.href = url; }
    const qr = document.getElementById('qrImg');
    if (qr) qr.src = MG.qrSrc(url, 240);
    document.getElementById('lobbyMeta').textContent =
      (settings.qsrc === 'grammar' ? 'Grammar' : settings.qsrc === 'mixed' ? 'Vocabulary + grammar' : 'Vocabulary') +
      ' · ' + settings.level + ' · ' + (settings.unit === 'all' ? 'All units' : ('Unit ' + String(settings.unit).replace(/^Unit\s+/i, ''))) +
      ' · ' + settings.durationMin + ' min · first to lead by ' + settings.targetLead;

    // Re-entering the lobby (a second create, or a retry after a failed one)
    // would otherwise strand the previous roster listener. Null on the first
    // run, so this is a no-op then.
    if (unsubPlayers) unsubPlayers();
    unsubPlayers = db.collection('tug_sessions').doc(code).collection('players')
      .orderBy('joinedAt', 'asc')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        lastPlayers = players;
        renderRoster(players);
      });
  }

  var _lastRoster = 0;
  function renderRoster(players) {
    // A student arrived. Throttled: a full cohort joining would otherwise
    // fire a cue per arrival. Guarded on GROWTH so a snapshot caused by a
    // score change stays silent.
    if (players.length > _lastRoster) MG.sfx('join', { throttle: 400 });
    _lastRoster = players.length;
    const el = document.getElementById('roster');
    const count = document.getElementById('rosterCount');
    if (count) count.textContent = players.length;
    if (!players.length) {
      el.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px; grid-column: 1/-1;">Waiting for students to join...</p>';
    } else {
      el.innerHTML = players.map(p => `
        <div class="player-card ${p.team === 'red' ? 'tug-red' : 'tug-blue'}">
          <div class="player-avatar">${MG.escHtml(p.avatar || '💪')}</div>
          <div class="player-name">${MG.escHtml(p.name)}</div>
          <div class="player-status">${p.team === 'red' ? '🔴 Red team' : '🔵 Blue team'}</div>
        </div>`).join('');
    }
    const red = players.filter(p => p.team === 'red').length;
    const blue = players.length - red;
    const btn = document.getElementById('startBtn');
    const ok = red >= 1 && blue >= 1;
    btn.disabled = !ok;
    btn.textContent = ok
      ? `▶️ Start (🔴 ${red} vs 🔵 ${blue})`
      : '▶️ Need at least 1 player on each team';
  }

  async function startGame() {
    if (!sessionCode) return;
    try {
      await db.collection('tug_sessions').doc(sessionCode).update({
        status: 'playing',
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      gameInFlight = true;
      enterLive();
    } catch (e) { MG.toast('Could not start: ' + e.message, 'fail'); }
  }

  function teamTotals(players) {
    let red = 0, blue = 0;
    players.forEach(p => {
      if (p.team === 'red') red += p.score || 0; else blue += p.score || 0;
    });
    return { red, blue };
  }

  function enterLive() {
    setView('live');
    const liveCode = document.getElementById('liveCode');
    if (liveCode) liveCode.textContent = sessionCode;
    const qr = document.getElementById('liveQrImg');
    if (qr) qr.src = MG.qrSrc(MG.joinUrl('classroom-tug-student.html', sessionCode), 120, 2);

    unsubSession = db.collection('tug_sessions').doc(sessionCode).onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      if (d.status === 'finished') { showResults(); return; }
      const startedAt = d.startedAt && d.startedAt.toMillis ? d.startedAt.toMillis() : null;
      if (startedAt && !timerInterval) startTimer(startedAt, d.durationSec);
    });

    // Release the lobby listener before attaching the in-game one. Without
    // this both stayed live for the whole game, so every player write was
    // delivered and billed twice. Same shape as trust-teacher.js:475.
    if (unsubPlayers) unsubPlayers();
    unsubPlayers = db.collection('tug_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        lastPlayers = players;
        renderLive(players);
        // Referee: win by reaching the target lead.
        const t = teamTotals(players);
        const lead = t.red - t.blue;
        if (!winFired && Math.abs(lead) >= (settings.targetLead || 15)) {
          winFired = true;
          endGame(lead > 0 ? 'red' : 'blue').catch(() => {});
        }
      });
  }

  function renderLive(players) {
    const t = teamTotals(players);
    document.getElementById('redScore').textContent = t.red;
    document.getElementById('blueScore').textContent = t.blue;
    const lead = t.red - t.blue;
    const target = settings.targetLead || 15;
    // Red pulls the knot LEFT. 50% is the centre; each goal sits 45%
    // away, so position = 50 - lead/target * 45, clamped near the goals.
    const pos = Math.max(5, Math.min(95, 50 - (lead / target) * 45));
    document.getElementById('tugKnot').style.left = pos + '%';
    document.getElementById('leadNote').textContent =
      lead === 0 ? 'All tied - pull!'
        : (lead > 0 ? `🔴 Red leads by ${lead}` : `🔵 Blue leads by ${-lead}`) + ` (first to ${target} wins)`;

    // Top contributors, both teams mixed.
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    document.getElementById('liveBoard').innerHTML = sorted.slice(0, 12).map((p, i) => `
      <div class="leaderboard-item">
        <div class="leaderboard-rank">${i + 1}</div>
        <div class="leaderboard-player"><div class="leaderboard-name">${p.team === 'red' ? '🔴' : '🔵'} ${MG.escHtml(p.name)}</div></div>
        <div class="leaderboard-score">${p.score || 0}</div>
      </div>`).join('');
  }

  function startTimer(startedAtMs, durationSec) {
    const endMs = startedAtMs + durationSec * 1000;
    const el = document.getElementById('timer');
    const tick = () => {
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      el.textContent = `${m}:${s}`;
      el.classList.toggle('warning', remaining <= 60 && remaining > 15);
      el.classList.toggle('crit', remaining <= 15);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        if (!winFired) {
          winFired = true;
          const t = teamTotals(lastPlayers);
          endGame(t.red === t.blue ? 'draw' : (t.red > t.blue ? 'red' : 'blue')).catch(() => {});
        }
      }
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  async function endGame(winner) {
    if (!sessionCode) return;
    try {
      await db.collection('tug_sessions').doc(sessionCode).update({
        status: 'finished',
        winner: winner || 'draw',
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.error('endGame', e); }
  }

  async function showResults() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    gameInFlight = false;
    setView('results');
    try {
      const sref = db.collection('tug_sessions').doc(sessionCode);
      const [playersSnap, sessSnap] = await Promise.all([
        sref.collection('players').orderBy('score', 'desc').get(),
        sref.get()
      ]);
      const players = playersSnap.docs.map(d => d.data());
      const s = sessSnap.exists ? sessSnap.data() : {};
      const t = teamTotals(players);
      const winner = s.winner || (t.red === t.blue ? 'draw' : (t.red > t.blue ? 'red' : 'blue'));
      const outcome = winner === 'draw'
        ? `Draw ${t.red}-${t.blue}`
        : `${winner === 'red' ? 'Red' : 'Blue'} team wins ${winner === 'red' ? t.red + '-' + t.blue : t.blue + '-' + t.red}`;

      document.getElementById('resultBanner').innerHTML = winner === 'draw'
        ? `🤝 It's a draw! 🔴 ${t.red} - ${t.blue} 🔵`
        : `${winner === 'red' ? '🔴 RED' : '🔵 BLUE'} TEAM WINS! &nbsp; 🔴 ${t.red} - ${t.blue} 🔵`;

      if (window.saveGameReport) {
        window.saveGameReport(db, {
          game: 'tug',
          mode: s.mode || 'vocab',
          code: sessionCode,
          teacherId: s.hostUid || '',
          teacherName: s.hostName || '',
          level: s.level || '',
          unit: s.unit === 'all' ? 'All units' : String(s.unit || ''),
          outcome,
          players: players.map(p => ({ name: (p.team === 'red' ? '[R] ' : '[B] ') + (p.name || ''), score: p.score || 0 }))
        });
      }

      renderPodium(players);
      document.getElementById('perPlayerBody').innerHTML = players.map((p, i) => {
        const answered = p.answered || 0;
        const acc = answered ? Math.round(((p.score || 0) / answered) * 100) : 0;
        return `<div class="leaderboard-item">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="leaderboard-player"><div class="leaderboard-name">${p.team === 'red' ? '🔴' : '🔵'} ${MG.escHtml(p.name)}</div></div>
          <div class="leaderboard-details" style="margin-right: 12px;">${p.score || 0} / ${answered} correct${answered ? ' · ' + acc + '%' : ''}</div>
          <div class="leaderboard-score">${p.score || 0}</div>
        </div>`;
      }).join('');

      const dl = document.getElementById('downloadResultsBtn');
      if (dl) dl.onclick = () => {
        const rows = [['Rank', 'Name', 'Team', 'Pulls (correct)', 'Answered', 'Accuracy %', 'Outcome']];
        players.forEach((p, i) => {
          const answered = p.answered || 0;
          rows.push([i + 1, p.name || '', p.team || '', p.score || 0, answered,
            answered ? Math.round(((p.score || 0) / answered) * 100) : 0, outcome]);
        });
        MG.downloadCsv(rows, `tug-${sessionCode}-${new Date().toISOString().slice(0, 10)}.csv`);
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
        <div class="podium-name" style="font-weight: 600; margin-top: 6px;">${p.team === 'red' ? '🔴' : '🔵'} ${MG.escHtml(p.name)}</div>
        <div class="podium-score" style="color: var(--accent-primary); font-weight: 700; margin-top: 4px;">${p.score || 0} pulls</div>
      </div>`).join('');
  }

  function cleanup() {
    if (unsubPlayers) { unsubPlayers(); unsubPlayers = null; }
    if (unsubSession) { unsubSession(); unsubSession = null; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('endBtn').addEventListener('click', async () => {
      const ok = await MG.ask('End the game?', 'The leading team wins and everyone moves to the results screen.', 'End game');
      if (ok) {
        winFired = true;
        const t = teamTotals(lastPlayers);
        endGame(t.red === t.blue ? 'draw' : (t.red > t.blue ? 'red' : 'blue'));
      }
    });
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });
    function confirmLeave(e, label) {
      if (!gameInFlight) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      MG.ask('Leave the game?', `A game is in progress. Leaving to ${label} stops the referee - end the game first?`, 'Leave anyway')
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
