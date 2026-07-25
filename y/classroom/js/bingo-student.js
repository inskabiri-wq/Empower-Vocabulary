/* ============================================================
   VOCAB BINGO - Student client
   ------------------------------------------------------------
   Join with the 5-char code (QR pre-fills it). On join, a random
   4x4 card is dealt from the session's word pool and saved on
   the player doc. The clue (definition, or gapped sentence at
   A2) shows ONLY on the teacher's projector - the student's job
   is to find the matching word on their card and tap it.

   Tap rules: the tapped word must already have been CALLED
   (word is in calls[0..callIndex]). A wrong tap locks the card
   for 3 seconds so nobody can spam-tap every cell. Marking a
   called word = +10 pts; completing a row/column/diagonal =
   BINGO (+50 pts, timestamped so the host announces order).
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

  let myUid = null;
  let myName = '';
  let myAvatar = '🎱';
  let sessionCode = null;
  let session = null;
  let myCard = [];
  let myMarked = [];
  let myScore = 0;
  let bingoDone = false;
  let lockedUntil = 0;
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

    const sref = db.collection('bingo_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { MG.toast('Game not found - check the code', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { MG.toast('That game has ended', 'fail'); return; }

    sessionCode = code;
    myName = name;
    myAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    // Rejoin-safe: keep an existing card if this uid already dealt one
    // (refresh mid-game must not shuffle the card).
    try {
      const mine = await sref.collection('players').doc(myUid).get();
      if (mine.exists && Array.isArray(mine.data().card) && mine.data().card.length === 16) {
        const d = mine.data();
        myCard = d.card;
        myMarked = Array.isArray(d.marked) ? d.marked : [];
        myScore = d.score || 0;
        bingoDone = !!d.bingoAt;
      }
    } catch (_) {}
    if (myCard.length !== 16) {
      myCard = MG.sample((session.pool || []).map(p => p.word), 16);
      myMarked = [];
      myScore = 0;
      bingoDone = false;
    }
    if (myCard.length !== 16) { MG.toast('This game has no card pool - ask your teacher.', 'fail'); return; }

    try {
      await sref.collection('players').doc(myUid).set({
        uid: myUid, name: myName, avatar: myAvatar,
        card: myCard, marked: myMarked, score: myScore,
        bingoAt: bingoDone ? firebase.firestore.FieldValue.serverTimestamp() : null,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) { MG.toast('Could not join: ' + e.message, 'fail'); return; }

    setView('wait');
    subscribe();
    if (session.status === 'playing') enterPlay();
  }

  function subscribe() {
    const sref = db.collection('bingo_sessions').doc(sessionCode);
    unsubs.push(sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) { MG.toast('The game was cancelled', 'fail'); setView('join'); return; }
      session = d;
      if (d.status === 'playing') { enterPlay(); renderStatusLine(); }
      if (d.status === 'finished') enterDone();
    }));
  }

  function calledWords() {
    const idx = session.callIndex == null ? -1 : session.callIndex;
    return (session.calls || []).slice(0, idx + 1);
  }

  function enterPlay() {
    const playEl = document.getElementById('view-play');
    if (playEl.style.display !== 'none') return;
    setView('play');
    renderCard();
    renderStatusLine();
  }

  function renderStatusLine() {
    const el = document.getElementById('statusLine');
    if (!el || !session) return;
    const idx = session.callIndex == null ? -1 : session.callIndex;
    el.textContent = idx < 0
      ? 'Watch the board - the first clue is coming.'
      : `Clue ${idx + 1} is on the board. Find the word on your card!`;
    document.getElementById('myScore').textContent = myScore;
  }

  function renderCard() {
    const grid = document.getElementById('bingoGrid');
    grid.innerHTML = myCard.map(w => `
      <button type="button" class="bingo-cell ${myMarked.indexOf(w) !== -1 ? 'marked' : ''}" data-word="${MG.escHtml(w)}">
        ${MG.escHtml(w)}
      </button>`).join('');
    grid.querySelectorAll('.bingo-cell').forEach(cell => {
      cell.addEventListener('click', () => onTap(cell));
    });
  }

  // Row/column/diagonal check on the 4x4 card.
  function hasBingo() {
    const m = myCard.map(w => myMarked.indexOf(w) !== -1);
    const at = (r, c) => m[r * 4 + c];
    for (let r = 0; r < 4; r++) if (at(r, 0) && at(r, 1) && at(r, 2) && at(r, 3)) return true;
    for (let c = 0; c < 4; c++) if (at(0, c) && at(1, c) && at(2, c) && at(3, c)) return true;
    if (at(0, 0) && at(1, 1) && at(2, 2) && at(3, 3)) return true;
    if (at(0, 3) && at(1, 2) && at(2, 1) && at(3, 0)) return true;
    return false;
  }

  async function onTap(cell) {
    if (!session || session.status !== 'playing') return;
    if (Date.now() < lockedUntil) return;
    const word = cell.dataset.word;
    if (myMarked.indexOf(word) !== -1) return;

    if (calledWords().indexOf(word) === -1) {
      // Not called (yet) - shake + 3s lockout so spamming never pays.
      lockedUntil = Date.now() + 3000;
      cell.classList.add('shake');
      setTimeout(() => cell.classList.remove('shake'), 450);
      const fb = document.getElementById('cardFeedback');
      fb.className = 'mg-feedback no';
      fb.textContent = 'That word has not been called - card locked for 3s.';
      setTimeout(() => { if (Date.now() >= lockedUntil) fb.textContent = ''; }, 3100);
      return;
    }

    myMarked.push(word);
    myScore += 10;
    cell.classList.add('marked');
    const fb = document.getElementById('cardFeedback');
    fb.className = 'mg-feedback ok';
    fb.textContent = '✓ ' + word + ' (+10)';
    document.getElementById('myScore').textContent = myScore;

    const update = {
      marked: firebase.firestore.FieldValue.arrayUnion(word),
      score: firebase.firestore.FieldValue.increment(10)
    };
    if (!bingoDone && hasBingo()) {
      bingoDone = true;
      myScore += 50;
      update.score = firebase.firestore.FieldValue.increment(60);
      update.bingoAt = firebase.firestore.FieldValue.serverTimestamp();
      document.getElementById('myScore').textContent = myScore;
      fb.textContent = '🎉 BINGO! +50 - keep marking for points until the teacher ends the game.';
      const banner = document.getElementById('myBingoBanner');
      if (banner) banner.style.display = '';
    }
    try {
      await db.collection('bingo_sessions').doc(sessionCode).collection('players').doc(myUid).update(update);
    } catch (e) { console.error('mark update', e); }
  }

  async function enterDone() {
    setView('done');
    try {
      const snap = await db.collection('bingo_sessions').doc(sessionCode)
        .collection('players').orderBy('score', 'desc').get();
      const players = snap.docs.map(d => d.data());
      const mine = players.findIndex(p => p.uid === myUid);
      document.getElementById('doneRank').textContent = mine >= 0 ? `#${mine + 1} of ${players.length}` : '-';
      document.getElementById('doneScore').textContent = myScore + ' pts' + (bingoDone ? ' · 🎉 BINGO' : '');
      document.getElementById('doneList').innerHTML = players.slice(0, 10).map((p, i) => `
        <div class="leaderboard-item ${p.uid === myUid ? 'current-user' : ''}">
          <div class="leaderboard-rank">${i + 1}</div>
          <div class="leaderboard-player"><div class="leaderboard-name">${p.bingoAt ? '🎉 ' : ''}${MG.escHtml(p.name)}</div></div>
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
