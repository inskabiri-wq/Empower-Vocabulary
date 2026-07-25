/* ============================================================
   VOCAB BINGO - Teacher (host) controller
   ------------------------------------------------------------
   The host picks a level + unit; a pool of words is sampled from
   datasets.json (verbatim - never invented). Every student gets
   a random 4x4 card of pool words. The HOST screen (projector)
   calls one clue at a time: the word's DEFINITION at B1 and up,
   or its example sentence with the word gapped out at A2 (the
   difficulty rule). Students find and tap the matching word on
   their card. Lines win.

   Join flow is IDENTICAL to the other classroom games: 5-char
   code + qrserver QR in the lobby; students land on
   classroom-bingo-student.html?code=... or type the code on the
   universal join page.

   /bingo_sessions/{code}
     { code, status: lobby|playing|finished, hostUid, hostName,
       level, unit, callFormat: def|gap, pool[{word,def,ex,gap}],
       calls[word...], callIndex, autoAdvanceSec,
       createdAt, startedAt, endedAt }
     /players/{uid} { uid, name, avatar, card[16], marked[],
                      score, bingoAt, joinedAt }
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
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'
  ]);

  let currentUser = null;
  let sessionCode = null;
  let settings = null;
  let vocabulary = null;
  let sessionData = null;
  let unsubPlayers = null;
  let unsubSession = null;
  let autoAdvanceInt = null;
  let gameInFlight = false;
  let bingoOrder = [];      // [{name, at}] in bingo order, for the banner

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
      poolSize: Math.max(20, Math.min(40, parseInt(params.get('pool') || '24', 10))),
      autoAdvanceSec: parseInt(params.get('adv') || '0', 10)   // 0 = manual "Next clue"
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
    // Pool: at A2 only gappable words qualify (the clue IS the gapped
    // sentence); at B1+ any word with a definition works.
    const base = MG.vocabPool(vocabulary, settings.level, settings.unit);
    const callFormat = settings.level === 'A2' ? 'gap' : 'def';
    const usable = callFormat === 'gap' ? MG.gappable(base) : base;
    if (usable.length < 16) { MG.toast('Not enough words at that level/unit for bingo (need 16+).', 'fail'); return; }
    const pool = MG.sample(usable, settings.poolSize).map(w => ({
      word: w.word,
      def: w.def,
      ex: w.ex || '',
      gap: callFormat === 'gap' ? MG.gapSentence(w) : ''
    }));

    let code = MG.genCode();
    for (let i = 0; i < 5; i++) {
      const exists = await db.collection('bingo_sessions').doc(code).get();
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
      callFormat,
      pool,
      calls: MG.shuffle(pool.map(p => p.word)),
      callIndex: -1,
      autoAdvanceSec: settings.autoAdvanceSec,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: null,
      endedAt: null
    };
    try {
      await db.collection('bingo_sessions').doc(code).set(session);
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
    const url = MG.joinUrl('classroom-bingo-student.html', code);
    const link = document.getElementById('joinUrl');
    if (link) { link.textContent = url; link.href = url; }
    const qr = document.getElementById('qrImg');
    if (qr) qr.src = MG.qrSrc(url, 240);
    document.getElementById('lobbyMeta').textContent =
      settings.level + ' · ' + (settings.unit === 'all' ? 'All units' : settings.unit) +
      ' · ' + settings.poolSize + '-word pool · 4x4 cards · ' +
      (sessionData.callFormat === 'gap' ? 'clues are gapped sentences' : 'clues are definitions') +
      (settings.autoAdvanceSec ? ' · auto clue every ' + settings.autoAdvanceSec + 's' : ' · you control the clue pace');

    unsubPlayers = db.collection('bingo_sessions').doc(code).collection('players')
      .orderBy('joinedAt', 'asc')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
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
          <div class="player-avatar">${MG.escHtml(p.avatar || '🎱')}</div>
          <div class="player-name">${MG.escHtml(p.name)}</div>
          <div class="player-status ready">✓ Card ready</div>
        </div>`).join('');
    }
    const btn = document.getElementById('startBtn');
    btn.disabled = players.length < 1;
    btn.textContent = players.length < 1 ? '▶️ Waiting for players...' : `▶️ Start Bingo (${players.length} players)`;
  }

  async function startGame() {
    if (!sessionCode) return;
    try {
      await db.collection('bingo_sessions').doc(sessionCode).update({
        status: 'playing',
        startedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      gameInFlight = true;
      enterLive();
      await nextCall();  // put the first clue up immediately
      if (settings.autoAdvanceSec > 0) {
        autoAdvanceInt = setInterval(() => { nextCall().catch(() => {}); }, settings.autoAdvanceSec * 1000);
      }
    } catch (e) { MG.toast('Could not start: ' + e.message, 'fail'); }
  }

  function enterLive() {
    setView('live');
    const liveCode = document.getElementById('liveCode');
    if (liveCode) liveCode.textContent = sessionCode;
    const qr = document.getElementById('liveQrImg');
    if (qr) qr.src = MG.qrSrc(MG.joinUrl('classroom-bingo-student.html', sessionCode), 120, 2);

    unsubSession = db.collection('bingo_sessions').doc(sessionCode).onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      sessionData = d;
      if (d.status === 'finished') { showResults(); return; }
      renderCall(d);
    });

    unsubPlayers = db.collection('bingo_sessions').doc(sessionCode).collection('players')
      .onSnapshot(snap => {
        const players = snap.docs.map(d => d.data());
        renderLiveBoard(players);
        trackBingos(players);
      });
  }

  async function nextCall() {
    if (!sessionData) return;
    const next = (sessionData.callIndex == null ? -1 : sessionData.callIndex) + 1;
    if (next >= (sessionData.calls || []).length) {
      MG.toast('All clues have been called - end the game when ready.', 'success');
      if (autoAdvanceInt) { clearInterval(autoAdvanceInt); autoAdvanceInt = null; }
      return;
    }
    try {
      await db.collection('bingo_sessions').doc(sessionCode).update({ callIndex: next });
    } catch (e) { console.error('nextCall', e); }
  }

  function clueFor(word) {
    const entry = (sessionData.pool || []).find(p => p.word === word);
    if (!entry) return '';
    return sessionData.callFormat === 'gap'
      ? 'Complete the sentence:\n"' + (entry.gap || '') + '"'
      : entry.def;
  }

  function renderCall(d) {
    const idx = d.callIndex == null ? -1 : d.callIndex;
    const total = (d.calls || []).length;
    document.getElementById('callCount').textContent =
      idx < 0 ? 'Ready' : `Clue ${idx + 1} of ${total}`;
    document.getElementById('callText').textContent =
      idx < 0 ? 'Press "Next clue" to call the first one.' : clueFor(d.calls[idx]);
    // History: every PAST call is revealed word-first (the current clue
    // stays word-hidden so students still have to find it).
    const hist = document.getElementById('callHistory');
    if (hist) {
      hist.innerHTML = (d.calls || []).slice(0, Math.max(0, idx)).map(w =>
        `<span class="bingo-hist-chip">${MG.escHtml(w)}</span>`).join('');
    }
    const btn = document.getElementById('nextCallBtn');
    if (btn) {
      btn.disabled = idx + 1 >= total;
      btn.textContent = idx + 1 >= total ? 'All clues called' : (idx < 0 ? '📢 First clue' : '📢 Next clue');
    }
  }

  function renderLiveBoard(players) {
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    document.getElementById('liveBoard').innerHTML = sorted.map((p, i) => `
      <div class="leaderboard-item">
        <div class="leaderboard-rank">${i + 1}</div>
        <div class="leaderboard-player"><div class="leaderboard-name">${p.bingoAt ? '🎉 ' : ''}${MG.escHtml(p.name)}</div></div>
        <div class="leaderboard-details" style="margin-right: 12px;">${(p.marked || []).length} marked</div>
        <div class="leaderboard-score">${p.score || 0}</div>
      </div>`).join('');
  }

  function trackBingos(players) {
    players.forEach(p => {
      if (p.bingoAt && !bingoOrder.some(b => b.uid === p.uid)) {
        bingoOrder.push({ uid: p.uid, name: p.name, at: p.bingoAt });
        MG.toast('🎉 BINGO! ' + p.name, 'success');
        const banner = document.getElementById('bingoBanner');
        if (banner) {
          banner.style.display = '';
          banner.textContent = '🎉 BINGO: ' + bingoOrder.map(b => b.name).join(' → ');
        }
      }
    });
  }

  async function endGame() {
    if (!sessionCode) return;
    if (autoAdvanceInt) { clearInterval(autoAdvanceInt); autoAdvanceInt = null; }
    try {
      await db.collection('bingo_sessions').doc(sessionCode).update({
        status: 'finished',
        endedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { console.error('endGame', e); }
  }

  async function showResults() {
    gameInFlight = false;
    if (autoAdvanceInt) { clearInterval(autoAdvanceInt); autoAdvanceInt = null; }
    setView('results');
    try {
      const sref = db.collection('bingo_sessions').doc(sessionCode);
      const [playersSnap, sessSnap] = await Promise.all([
        sref.collection('players').orderBy('score', 'desc').get(),
        sref.get()
      ]);
      const players = playersSnap.docs.map(d => d.data());
      const s = sessSnap.exists ? sessSnap.data() : {};
      const winners = players.filter(p => p.bingoAt)
        .sort((a, b) => (a.bingoAt.seconds || 0) - (b.bingoAt.seconds || 0));
      const outcome = winners.length
        ? 'Bingo: ' + winners.map(w => w.name).join(', ')
        : 'No bingo reached';

      document.getElementById('resultBanner').textContent =
        winners.length ? '🎉 ' + outcome : 'Game over - ' + outcome;

      if (window.saveGameReport) {
        window.saveGameReport(db, {
          game: 'bingo',
          mode: s.callFormat === 'gap' ? 'gap-sentences' : 'definitions',
          code: sessionCode,
          teacherId: s.hostUid || '',
          teacherName: s.hostName || '',
          level: s.level || '',
          unit: s.unit === 'all' ? 'All units' : String(s.unit || ''),
          outcome,
          players: players.map(p => ({ name: p.name || '', score: p.score || 0 }))
        });
      }

      renderPodium(players);
      document.getElementById('perPlayerBody').innerHTML = players.map((p, i) => `
        <div class="leaderboard-item">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="leaderboard-player"><div class="leaderboard-name">${MG.escHtml(p.name)}${p.bingoAt ? ' 🎉' : ''}</div></div>
          <div class="leaderboard-details" style="margin-right: 12px;">${(p.marked || []).length} / 16 marked${p.bingoAt ? ' · BINGO' : ''}</div>
          <div class="leaderboard-score">${p.score || 0}</div>
        </div>`).join('');

      // Full answer key for the class discussion.
      document.getElementById('answerKey').innerHTML = (s.calls || [])
        .slice(0, (s.callIndex == null ? 0 : s.callIndex) + 1)
        .map(w => {
          const entry = (s.pool || []).find(p => p.word === w) || {};
          return `<div class="leaderboard-item"><div class="leaderboard-rank" style="width: auto; min-width: 120px; color: var(--accent-primary);">${MG.escHtml(w)}</div><div class="leaderboard-details">${MG.escHtml(entry.def || '')}</div></div>`;
        }).join('');

      const dl = document.getElementById('downloadResultsBtn');
      if (dl) dl.onclick = () => {
        const rows = [['Rank', 'Name', 'Score', 'Marked', 'Bingo', 'Outcome']];
        players.forEach((p, i) => rows.push([
          i + 1, p.name || '', p.score || 0, (p.marked || []).length,
          p.bingoAt ? 'yes' : 'no', outcome
        ]));
        MG.downloadCsv(rows, `bingo-${sessionCode}-${new Date().toISOString().slice(0, 10)}.csv`);
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
    if (autoAdvanceInt) { clearInterval(autoAdvanceInt); autoAdvanceInt = null; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('nextCallBtn').addEventListener('click', () => nextCall());
    document.getElementById('endBtn').addEventListener('click', async () => {
      const ok = await MG.ask('End the bingo?', 'Everyone moves to the results screen. This cannot be undone.', 'End game');
      if (ok) endGame();
    });
    document.getElementById('newGameBtn').addEventListener('click', () => {
      window.location.href = 'classroom-teacher.html';
    });
    function confirmLeave(e, label) {
      if (!gameInFlight) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      MG.ask('Leave the game?', `A game is in progress. Leaving to ${label} stops the clue caller - end the game first?`, 'Leave anyway')
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
