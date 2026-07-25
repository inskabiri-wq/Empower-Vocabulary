/* ============================================================
   TUG OF WAR - Student client
   ------------------------------------------------------------
   Join with the 5-char code (QR pre-fills it), get auto-assigned
   to the smaller team, then answer a continuous stream of MCQs.
   Every correct answer = one pull for your team. The questions
   ride in the session doc (built by the host from the real
   banks) - this page never loads datasets/grammar itself.
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
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3'
  ]);

  let myUid = null;
  let myName = '';
  let myAvatar = '💪';
  let myTeam = '';
  let sessionCode = null;
  let session = null;
  let myPlayer = null;
  let allPlayers = [];
  let queue = [];
  let qIndex = 0;
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

    const sref = db.collection('tug_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { MG.toast('Game not found - check the code', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { MG.toast('That game has ended', 'fail'); return; }

    sessionCode = code;
    myName = name;
    myAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    // Team assignment: join the smaller team (random on a tie).
    try {
      const snap = await sref.collection('players').get();
      let red = 0, blue = 0;
      snap.docs.forEach(d => {
        const p = d.data();
        if (d.id === myUid) return;
        if (p.team === 'red') red++; else blue++;
      });
      myTeam = red < blue ? 'red' : red > blue ? 'blue' : (Math.random() < 0.5 ? 'red' : 'blue');
    } catch (_) { myTeam = Math.random() < 0.5 ? 'red' : 'blue'; }

    try {
      await sref.collection('players').doc(myUid).set({
        uid: myUid, name: myName, avatar: myAvatar, team: myTeam,
        score: 0, answered: 0,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { MG.toast('Could not join: ' + e.message, 'fail'); return; }

    document.getElementById('teamPill').innerHTML =
      `<span class="tug-team-pill ${myTeam}">${myTeam === 'red' ? '🔴 RED team' : '🔵 BLUE team'}</span>`;
    setView('wait');
    subscribe();
    if (session.status === 'playing') enterPlay();
  }

  function subscribe() {
    const sref = db.collection('tug_sessions').doc(sessionCode);
    unsubs.push(sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) { MG.toast('The game was cancelled', 'fail'); setView('join'); return; }
      session = d;
      if (d.status === 'playing') enterPlay();
      if (d.status === 'finished') enterDone();
    }));
    unsubs.push(sref.collection('players').onSnapshot(snap => {
      allPlayers = snap.docs.map(d => d.data());
      const me = allPlayers.find(p => p.uid === myUid);
      if (me) myPlayer = me;
      renderTeamBar();
    }));
  }

  function renderTeamBar() {
    const bar = document.getElementById('teamBar');
    if (!bar) return;
    let red = 0, blue = 0;
    allPlayers.forEach(p => { if (p.team === 'red') red += p.score || 0; else blue += p.score || 0; });
    const lead = red - blue;
    const target = (session && session.targetLead) || 15;
    const pos = Math.max(5, Math.min(95, 50 - (lead / target) * 45));
    const knot = document.getElementById('miniKnot');
    if (knot) knot.style.left = pos + '%';
    document.getElementById('miniRed').textContent = red;
    document.getElementById('miniBlue').textContent = blue;
    document.getElementById('myScore').textContent = (myPlayer && myPlayer.score) || 0;
  }

  function enterPlay() {
    const playEl = document.getElementById('view-play');
    if (playEl.style.display !== 'none') return;
    setView('play');
    queue = MG.shuffle(session.questions || []);
    qIndex = 0;
    nextQuestion();
  }

  function nextQuestion() {
    if (!queue.length) return;
    if (qIndex >= queue.length) { queue = MG.shuffle(queue); qIndex = 0; }
    const q = queue[qIndex++];
    document.getElementById('stem').textContent = q.stem;
    const box = document.getElementById('opts');
    // Reshuffle the options per player so neighbours can't copy letters.
    const opts = MG.shuffle(q.options.map((t, i) => ({ t, ok: i === q.answer })));
    box.innerHTML = opts.map(o =>
      `<button type="button" class="mg-opt" data-ok="${o.ok ? '1' : '0'}">${MG.escHtml(o.t)}</button>`).join('');
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'mg-feedback';
    box.querySelectorAll('.mg-opt').forEach(btn => {
      btn.addEventListener('click', () => onAnswer(btn, q));
    });
  }

  async function onAnswer(btn, q) {
    document.querySelectorAll('#opts .mg-opt').forEach(b => b.disabled = true);
    const ok = btn.dataset.ok === '1';
    btn.classList.add(ok ? 'correct' : 'wrong');
    const fb = document.getElementById('feedback');
    if (ok) {
      fb.className = 'mg-feedback ok';
      fb.textContent = '💪 PULL! +1 for ' + (myTeam === 'red' ? 'Red' : 'Blue');
    } else {
      fb.className = 'mg-feedback no';
      fb.textContent = 'Correct answer: ' + q.options[q.answer];
    }
    try {
      await db.collection('tug_sessions').doc(sessionCode).collection('players').doc(myUid).update({
        score: firebase.firestore.FieldValue.increment(ok ? 1 : 0),
        answered: firebase.firestore.FieldValue.increment(1)
      });
    } catch (e) { console.error('score update', e); }
    setTimeout(nextQuestion, ok ? 900 : 1500);
  }

  function enterDone() {
    setView('done');
    let red = 0, blue = 0;
    allPlayers.forEach(p => { if (p.team === 'red') red += p.score || 0; else blue += p.score || 0; });
    const winner = (session && session.winner) || (red === blue ? 'draw' : red > blue ? 'red' : 'blue');
    const iWon = winner !== 'draw' && winner === myTeam;
    document.getElementById('doneBanner').textContent =
      winner === 'draw' ? `🤝 Draw! ${red}-${blue}`
        : (iWon ? '🎉 YOUR TEAM WINS!' : '😤 The other team won this one.') +
          ` 🔴 ${red} - ${blue} 🔵`;
    document.getElementById('doneMine').textContent =
      `You pulled ${((myPlayer && myPlayer.score) || 0)} times (${(myPlayer && myPlayer.answered) || 0} answers).`;
    const sorted = [...allPlayers].sort((a, b) => (b.score || 0) - (a.score || 0));
    document.getElementById('doneList').innerHTML = sorted.slice(0, 10).map((p, i) => `
      <div class="leaderboard-item ${p.uid === myUid ? 'current-user' : ''}">
        <div class="leaderboard-rank">${i + 1}</div>
        <div class="leaderboard-player"><div class="leaderboard-name">${p.team === 'red' ? '🔴' : '🔵'} ${MG.escHtml(p.name)}</div></div>
        <div class="leaderboard-score">${p.score || 0}</div>
      </div>`).join('');
    unsubs.forEach(u => { try { u(); } catch (_) {} });
    unsubs = [];
  }

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) document.getElementById('codeInput').value = code.toUpperCase();
    document.getElementById('joinBtn').addEventListener('click', joinRoom);
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
