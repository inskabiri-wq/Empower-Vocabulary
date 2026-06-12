/* ============================================================
   THE HEIST — Student client
   ----------------------------------------------------------------
   Flow:
     1. Land on page (optionally with ?code= prefilled)
     2. Type room code + name → join
     3. Pick a password from the pack's word list (lobby)
     4. Wait for host to start
     5. PLAY:
        • LEFT panel: stream of vocab MCQs, +N coins per correct
        • RIGHT panel: live list of other players' vaults; click
          one to attempt a hack
     6. When the host ends → see final standing

   Trust model: the host is the referee. We write our own balance
   when we answer a question correctly (optimistic, client-side
   check is fine for a classroom). For HACKS the client deducts
   the fee optimistically and writes a `pending` hack request;
   the host's tab resolves the rest authoritatively.
   ============================================================ */

(function () {
  'use strict';

  // ── Firebase ───────────────────────────────────────────────
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
  const db   = firebase.firestore();

  // ── Background music ───────────────────────────────────────
  // Same track list / wiring as the Vocab Race classroom. Exposed on
  // window because the music-control buttons in the HTML use inline
  // onclick — and the rest of this file lives inside an IIFE.
  // Heist-flavoured track set — different SoundHelix songs from the
  // ones the Vocab Race / Trust classrooms use, so each game has its
  // own sonic personality. Picked for tempo + minor-key tension that
  // matches "vault-cracking heist movie".
  const musicTracks = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',   // dark electronic
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',   // brooding bass
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',  // tense crescendo
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',  // pulsing rhythm
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'   // chase beat
  ];
  let musicPlaying = false;
  let currentTrackIndex = -1;

  function playRandomTrack() {
    const audio = document.getElementById('bgMusic');
    if (!audio) return;
    let idx = Math.floor(Math.random() * musicTracks.length);
    if (idx === currentTrackIndex) idx = (idx + 1) % musicTracks.length;
    currentTrackIndex = idx;
    audio.src = musicTracks[idx];
    audio.load();
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  }
  window.toggleMusic = function () {
    const audio = document.getElementById('bgMusic');
    const btn   = document.getElementById('musicBtn');
    if (!audio || !btn) return;
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
  };
  window.nextTrack = function () { if (musicPlaying) playRandomTrack(); };
  window.setVolume = function (val) {
    const audio = document.getElementById('bgMusic');
    if (audio) audio.volume = (Number(val) || 0) / 100;
  };

  // ── State ──────────────────────────────────────────────────
  let user            = null;
  let myUid           = null;
  let myName          = '';
  let myAvatar        = '🦊';
  let sessionCode     = null;
  let session         = null;       // session doc data, live-updated
  let packData        = null;       // resolved hint-pack object (with hints)
  let myPlayer        = null;       // my player doc data, live-updated
  let allPlayers      = [];
  let myEarnQueue     = [];         // shuffled list of question items
  let earnIndex       = 0;
  let lastHackResolvedAt = 0;       // for toast filtering
  let unsubs          = [];

  // Avatars to pick from for guest joins (signed-in users still
  // get a randomized one for now — keeps things simple in v1).
  const AVATARS = ['🦊','🐯','🐼','🐧','🦁','🐸','🐙','🦉','🐢','🐝','🐳','🦄','🐺','🐰','🦝'];
  function randomAvatar() { return AVATARS[Math.floor(Math.random() * AVATARS.length)]; }

  // ── Helpers ────────────────────────────────────────────────
  function escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function setView(id) {
    ['join', 'password', 'wait', 'play', 'done'].forEach(v => {
      const el = document.getElementById('view-' + v);
      if (el) el.style.display = (v === id) ? '' : 'none';
    });
  }
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'heist-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Auth: anonymous sign-in is fine for v1 ─────────────────
  // Heist lets students join without an FSM account so visitors can
  // try a demo round and so younger classes don't need email logins.
  // If the project hasn't enabled Anonymous Auth in Firebase Console
  // (Authentication → Sign-in method → Anonymous → Enable) the call
  // throws `auth/operation-not-allowed` — surface a clear message
  // instead of a generic toast so the teacher knows where to look.
  async function ensureAuth() {
    if (auth.currentUser) { user = auth.currentUser; myUid = user.uid; return; }
    try {
      const cred = await auth.signInAnonymously();
      user = cred.user;
      myUid = user.uid;
    } catch (e) {
      console.error('anon auth', e);
      if (e && e.code === 'auth/operation-not-allowed') {
        toast('Anonymous sign-in is disabled. Ask your teacher to enable it in Firebase Console.', 'fail');
      } else {
        toast('Could not sign you in: ' + (e.message || e), 'fail');
      }
    }
  }

  // ── Step 1: Join ───────────────────────────────────────────
  async function joinRoom() {
    await ensureAuth();
    if (!myUid) return;

    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    const name = document.getElementById('nameInput').value.trim().slice(0, 24);
    if (!code) { toast('Enter a room code', 'fail'); return; }
    if (!name) { toast('Enter your name', 'fail'); return; }

    sessionCode = code;
    myName = name;
    myAvatar = randomAvatar();

    // Pull session
    const sref = db.collection('heist_sessions').doc(code);
    const sdoc = await sref.get();
    if (!sdoc.exists) { toast('Room not found', 'fail'); return; }
    session = sdoc.data();
    if (session.status === 'finished') { toast('That game has ended', 'fail'); return; }

    // Load the hint pack from local JSON for the hints + earn questions
    try {
      const r = await fetch('classroom/data/heist-packs.json', { cache: 'no-store' });
      const j = await r.json();
      packData = (j.packs || []).find(p => p.id === session.packId);
      if (!packData) { toast('Pack missing on this device', 'fail'); return; }
    } catch (e) {
      console.error('pack load', e);
      toast('Could not load the question pack', 'fail');
      return;
    }

    // Create / update my player doc. `passwordSet` flips to true
    // once I choose a password in the next step.
    try {
      await sref.collection('players').doc(myUid).set({
        uid: myUid,
        name: myName,
        avatar: myAvatar,
        balance: 0,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        passwordSet: false,
        questionsAnswered: 0,
        questionsCorrect: 0,
        hacksAttempted: 0,
        hacksSuccessful: 0,
        timesHacked: 0,
        stolenTotal: 0
      }, { merge: true });
    } catch (e) {
      console.error('join', e);
      toast('Could not join: ' + e.message, 'fail');
      return;
    }

    subscribeSession();
    subscribePlayer();
    subscribePlayers();
    renderPasswordPicker();
    setView('password');
  }

  // ── Step 2: Password picker ────────────────────────────────
  function renderPasswordPicker() {
    const grid = document.getElementById('pwGrid');
    const choices = session.passwordChoices || [];
    grid.innerHTML = choices.map(w =>
      `<button type="button" class="pw-opt" data-word="${escHtml(w)}">${escHtml(w)}</button>`
    ).join('');
    grid.querySelectorAll('.pw-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.pw-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  }
  async function confirmPassword() {
    const selected = document.querySelector('#pwGrid .pw-opt.selected');
    if (!selected) { toast('Pick a password word first', 'fail'); return; }
    const word = selected.dataset.word;
    // Find the matching Taboo hint from our local pack data.
    const packEntry = (packData.words || []).find(w => w.word === word);
    const vaultHint = packEntry ? packEntry.tabooHint : '';
    try {
      const sref = db.collection('heist_sessions').doc(sessionCode);
      // Write the actual password into the restricted subcollection
      // (read-protected by Firestore rules — only owner + host).
      await sref.collection('passwords').doc(myUid).set({ word });
      // Publish the HINT to the player's public doc so attackers can see
      // it. The hint evokes the word without naming it (Taboo style),
      // so revealing it doesn't reveal the password.
      //
      // KNOWN v1 LIMITATION: the full heist-packs.json (including the
      // hint↔word mapping) is fetched by every client, so a determined
      // student could open devtools and read the JSON to reverse the
      // hint. Hardening v1.1: load only public fields (word/def/example)
      // on the student side, and let the host write vaultHints via a
      // /passwords listener. For a real classroom this is good enough —
      // teacher is present and cheating is visible.
      await sref.collection('players').doc(myUid).update({
        passwordSet: true,
        vaultHint: vaultHint
      });
      // Late-join branch: if the host already pressed Start while we
      // were picking, skip the "Waiting…" screen and jump straight
      // into play. enterPlay() now relies on myPlayer.passwordSet,
      // but the local copy of myPlayer may be a tick stale — we
      // know we just set it, so trust ourselves and pass through.
      if (session && session.status === 'playing') {
        if (!myPlayer) myPlayer = {};
        myPlayer.passwordSet = true;
        enterPlay();
      } else {
        setView('wait');
      }
    } catch (e) {
      console.error('pw save', e);
      toast('Could not save password: ' + e.message, 'fail');
    }
  }

  // ── Subscriptions ──────────────────────────────────────────
  function subscribeSession() {
    const sref = db.collection('heist_sessions').doc(sessionCode);
    const u = sref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      session = d;
      // Status guard: if the game is already 'playing' (late joiner),
      // DO NOT auto-bump them to the play view — they still need to
      // pick a password first. enterPlay() guards on passwordSet so
      // it's a no-op until the player has locked their vault. Once
      // confirmPassword() flips passwordSet=true, that same player-doc
      // subscription fires and triggers enterPlay() the right way.
      if (d.status === 'playing') enterPlay();
      if (d.status === 'finished') enterDone();
    });
    unsubs.push(u);
  }
  function subscribePlayer() {
    const ref = db.collection('heist_sessions').doc(sessionCode).collection('players').doc(myUid);
    const u = ref.onSnapshot(doc => {
      const d = doc.data();
      if (!d) return;
      const prevBal = myPlayer ? (myPlayer.balance || 0) : null;
      myPlayer = d;
      updateCoins();
      // If our balance changed mid-play and it wasn't an answer we just
      // gave, flash a toast (someone hacked us or we just got the steal).
      if (prevBal !== null && d.balance !== prevBal) {
        // We surface "you were hacked" via the /hacks listener below;
        // here we just keep the coin badge fresh.
      }
    });
    unsubs.push(u);
  }
  function subscribePlayers() {
    const ref = db.collection('heist_sessions').doc(sessionCode).collection('players')
      .orderBy('balance', 'desc');
    const u = ref.onSnapshot(snap => {
      allPlayers = snap.docs.map(d => d.data());
      renderVaultList();
    });
    unsubs.push(u);
  }
  // Listen to /hacks involving me — show toasts for results.
  function subscribeMyHacks() {
    const ref = db.collection('heist_sessions').doc(sessionCode).collection('hacks');
    // attacker side: my resolved attempts
    const u1 = ref.where('attackerUid', '==', myUid).where('status', '==', 'resolved')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added' && ch.type !== 'modified') return;
          const d = ch.doc.data();
          if (!d.resolvedAt) return;
          const t = d.resolvedAt.toMillis ? d.resolvedAt.toMillis() : 0;
          if (t <= lastHackResolvedAt) return;
          lastHackResolvedAt = t;
          if (d.success) {
            toast(`✅ Cracked ${d.targetName}! Stole 💸${d.amountStolen}`, 'success');
            // Big win — coin shower raining into the balance chip +
            // a green edge flash + a floating "+💸N".
            coinShower(18);
            screenFlash('gain');
            floatCoinLabel(d.amountStolen || 0, 'gain');
          } else {
            toast(`❌ Wrong password. Lost 💸${d.feeBurned}.`, 'fail');
            // Lost the fee — small red loss label.
            floatCoinLabel(d.feeBurned || 0, 'loss');
          }
        });
      });
    // target side: someone tried (or succeeded) against me
    const u2 = ref.where('targetUid', '==', myUid).where('status', '==', 'resolved')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added' && ch.type !== 'modified') return;
          const d = ch.doc.data();
          if (!d.resolvedAt) return;
          if (d.success) {
            toast(`🚨 ${d.attackerName} hacked you and took 💸${d.amountStolen}`, 'attack');
            // Got robbed — coins burst away from the balance chip +
            // a red edge flash + a floating "−💸N".
            coinBurst(document.getElementById('coinsBadge'), 8);
            screenFlash('loss');
            floatCoinLabel(d.amountStolen || 0, 'loss');
          } else {
            toast(`🔒 ${d.attackerName} tried to crack your vault.`, 'attack');
          }
        });
      });
    unsubs.push(u1, u2);
  }

  // Listen to MY OWN password doc (owner-readable per rules) so the player
  // always knows their current vault word, and is told when it ROTATES
  // after being cracked. Without this the password silently changes and
  // the player has no idea what it is now.
  let _myPwWord = null;
  function subscribeMyPassword() {
    const ref = db.collection('heist_sessions').doc(sessionCode).collection('passwords').doc(myUid);
    const u = ref.onSnapshot(doc => {
      const d = doc.data();
      if (!d || !d.word) return;
      const word = d.word;
      const wEl = document.getElementById('myVaultWord');
      const bar = document.getElementById('myVaultBar');
      if (wEl) wEl.textContent = word;
      if (bar) bar.style.display = '';
      if (_myPwWord !== null && word !== _myPwWord) {
        toast('🔑 Your vault was cracked and re-locked! New password: ' + word, 'attack');
        if (typeof screenFlash === 'function') screenFlash('loss');
      }
      _myPwWord = word;
    }, err => { console.warn('password sub failed (non-fatal):', err); });
    unsubs.push(u);
  }

  // ── Enter play view ────────────────────────────────────────
  function enterPlay() {
    if (document.getElementById('view-play').style.display !== 'none') return;
    // Late-join guard: don't yank a student into play view if they
    // haven't picked a password yet. The player-doc subscription will
    // re-call enterPlay() the moment confirmPassword() writes
    // passwordSet=true, AND we also call it directly from confirmPassword
    // below so there's no race against the snapshot timing.
    if (!myPlayer || !myPlayer.passwordSet) return;
    setView('play');
    // Build a shuffled earn queue from the teacher's chosen source:
    //   vocab   -> pack word definitions
    //   grammar -> grammar bank (level + unit)
    //   mixed   -> both shuffled together
    // Grammar falls back to the pack if the bank is missing, so the game
    // can never stall.
    let queue = [];
    if (session.questionSource === 'grammar' || session.questionSource === 'mixed') {
      queue = buildGrammarEarnQueue();
      // Mixed: cap the grammar share to the pack size so the blend is
      // roughly half vocabulary, half grammar (not 900 vs 20).
      if (session.questionSource === 'mixed') queue = queue.slice(0, Math.max(packData.words.length, 20));
    }
    if (session.questionSource !== 'grammar' || !queue.length) {
      queue = queue.concat(packData.words);
    }
    myEarnQueue = shuffleInPlace(queue);
    earnIndex = 0;
    nextEarnQuestion();
    subscribeMyHacks();
    subscribeMyPassword();
  }
  // Spinning 💸 glyph is provided by the .heist-coins::before pseudo —
  // we only render the numeric balance here. Trigger the bump animation
  // whenever the value changes so a successful crack feels rewarding.
  let _lastShownBalance = null;
  function updateCoins() {
    const el = document.getElementById('coinsBadge');
    if (!el || !myPlayer) return;
    const bal = myPlayer.balance || 0;
    el.textContent = String(bal);
    if (_lastShownBalance !== null && _lastShownBalance !== bal) {
      // Re-trigger the bump by toggling the class.
      el.classList.remove('bump');
      // Force a reflow so the animation actually restarts.
      void el.offsetWidth;
      el.classList.add('bump');
      setTimeout(() => el.classList.remove('bump'), 500);
    }
    _lastShownBalance = bal;
  }

  // ── Money FX ───────────────────────────────────────────────
  // Lightweight DOM-particle effects so coin events FEEL like money
  // is moving. Respects prefers-reduced-motion (skips particles,
  // keeps the floating label so the info is still conveyed).
  const _reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function _coinChipCenter() {
    const chip = document.getElementById('coinsBadge');
    if (!chip) return { x: window.innerWidth - 70, y: 56 };
    const r = chip.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Floating "+💸N" / "−💸N" that drifts up from a point and fades.
  function floatCoinLabel(amount, kind, originEl) {
    const el = document.createElement('div');
    el.className = 'coin-float ' + (kind === 'loss' ? 'loss' : 'gain');
    el.textContent = (kind === 'loss' ? '−' : '+') + '💸' + Math.abs(amount);
    let x, y;
    if (originEl && originEl.getBoundingClientRect) {
      const r = originEl.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top;
    } else {
      const c = _coinChipCenter(); x = c.x; y = c.y + 18;
    }
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // Burst of gold 💸 coins scattering from an origin element.
  function coinBurst(originEl, count) {
    if (_reduceMotion) return;
    const r = originEl && originEl.getBoundingClientRect
      ? originEl.getBoundingClientRect() : null;
    const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const cy = r ? r.top  + r.height / 2 : window.innerHeight / 2;
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-particle';
      coin.textContent = '💸';
      coin.style.left = cx + 'px';
      coin.style.top  = cy + 'px';
      const angle = Math.random() * Math.PI * 2;
      const dist  = 55 + Math.random() * 75;
      coin.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      coin.style.setProperty('--dy', (Math.sin(angle) * dist - 30) + 'px');
      coin.style.animationDelay = (Math.random() * 0.12) + 's';
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1200);
    }
  }

  // Heist win — a shower of coins raining toward the balance chip.
  function coinShower(count) {
    if (_reduceMotion) return;
    const target = _coinChipCenter();
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-rain';
      coin.textContent = '💸';
      const startX = Math.random() * window.innerWidth;
      const startY = -30 - Math.random() * 120;
      coin.style.left = startX + 'px';
      coin.style.top  = startY + 'px';
      coin.style.setProperty('--tx', (target.x - startX) + 'px');
      coin.style.setProperty('--ty', (target.y - startY) + 'px');
      coin.style.animationDelay = (Math.random() * 0.35) + 's';
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1700);
    }
  }

  // Brief full-screen edge flash — green for a win, red for a loss.
  function screenFlash(kind) {
    if (_reduceMotion) return;
    const fl = document.createElement('div');
    fl.className = 'money-flash ' + (kind === 'loss' ? 'loss' : 'gain');
    document.body.appendChild(fl);
    setTimeout(() => fl.remove(), 700);
  }

  // ── Earn panel ─────────────────────────────────────────────
  // Grammar earn queue: built from the generated grammar bank
  // (grammar-content.js is loaded on the heist student page). Each item
  // carries its own 4 options, so no pack distractors are needed.
  function buildGrammarEarnQueue() {
    const GP = window.GRAMMAR_PRACTICE;
    const topics = (GP && GP.byLevel && GP.byLevel[session.grammarLevel]) || [];
    const unitOf = t => { const m = String(t.blurb || '').match(/Units?\s+(\d+)/i); return m ? parseInt(m[1], 10) : 0; };
    let list = topics;
    if (session.grammarUnit && session.grammarUnit !== 'all') {
      list = topics.filter(t => unitOf(t) === parseInt(session.grammarUnit, 10));
    }
    const out = [];
    list.forEach(t => (t.questions || []).forEach(q => out.push({
      gq: true, stem: q.stem, options: q.options, answer: q.answer, explain: q.explain || ''
    })));
    return shuffleInPlace(out);
  }

  function nextEarnQuestion() {
    if (!myEarnQueue.length) return;
    // Loop the queue indefinitely so the student never runs out.
    if (earnIndex >= myEarnQueue.length) {
      shuffleInPlace(myEarnQueue);
      earnIndex = 0;
    }
    const item = myEarnQueue[earnIndex++];
    const stem = document.getElementById('earnStem');
    const optBox = document.getElementById('earnOpts');

    let opts;
    if (item.gq) {
      // Grammar question: the sentence (blank highlighted) + its own options.
      stem.innerHTML = escHtml(item.stem).replace(/_{2,}/,
        '<span style="display:inline-block;min-width:56px;border-bottom:3px solid var(--heist-gold-2,#f5c842);vertical-align:bottom;"></span>');
      opts = shuffleInPlace(item.options.map((t, i) => ({ def: t, isCorrect: i === item.answer })));
    } else {
      // Vocab question: pick 3 distractor definitions from OTHER pack words.
      const others = packData.words.filter(w => w.word !== item.word);
      shuffleInPlace(others);
      const distractors = others.slice(0, 3).map(w => w.def);
      opts = shuffleInPlace([item.def, ...distractors]).map(def => ({
        def, isCorrect: def === item.def
      }));
      stem.innerHTML = `What does <strong style="color:var(--heist-cyan);">${escHtml(item.word)}</strong> mean?`;
    }

    optBox.innerHTML = opts.map(o => `
      <button type="button" class="earn-opt" data-correct="${o.isCorrect ? '1' : '0'}">${escHtml(o.def)}</button>
    `).join('');
    document.getElementById('earnFeedback').innerHTML = '';
    optBox.querySelectorAll('.earn-opt').forEach(btn => {
      btn.addEventListener('click', () => onAnswer(btn, item));
    });
  }
  async function onAnswer(btn, item) {
    // lock further clicks
    document.querySelectorAll('#earnOpts .earn-opt').forEach(b => b.disabled = true);
    const isRight = btn.dataset.correct === '1';
    btn.classList.add(isRight ? 'correct' : 'wrong');
    const fb = document.getElementById('earnFeedback');
    if (isRight) {
      fb.className = 'earn-feedback ok';
      fb.textContent = `+ 💸${session.questionReward} coins`;
      // Money FX — a little burst of coins from the answer button +
      // a floating "+💸N" so earning feels rewarding.
      coinBurst(btn, 6);
      floatCoinLabel(session.questionReward, 'gain', btn);
      try {
        await db.collection('heist_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          balance: firebase.firestore.FieldValue.increment(session.questionReward),
          questionsAnswered: firebase.firestore.FieldValue.increment(1),
          questionsCorrect: firebase.firestore.FieldValue.increment(1)
        });
      } catch (e) { console.error('balance update', e); }
    } else {
      fb.className = 'earn-feedback no';
      fb.textContent = `Correct answer: ${item.gq ? item.options[item.answer] : item.def}`;
      try {
        await db.collection('heist_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          questionsAnswered: firebase.firestore.FieldValue.increment(1)
        });
      } catch (e) { console.error('balance update', e); }
    }
    setTimeout(nextEarnQuestion, 1200);
  }

  // ── Heist panel — vault list ───────────────────────────────
  function renderVaultList() {
    const el = document.getElementById('vaultList');
    if (!el) return;
    el.innerHTML = allPlayers.map(p => {
      const me = p.uid === myUid;
      return `
        <div class="vault ${me ? 'me' : ''}" data-uid="${escHtml(p.uid)}">
          <div class="ava">${escHtml(p.avatar || '🦊')}</div>
          <div class="meta">
            <div class="name">${escHtml(p.name)}</div>
            <div class="bal">💸 ${p.balance || 0}</div>
          </div>
          ${me ? '' : `<div class="crack-cost">Crack 💸${session.heistFee}</div>`}
        </div>`;
    }).join('');
    el.querySelectorAll('.vault:not(.me)').forEach(v => {
      v.addEventListener('click', () => openHeistModal(v.dataset.uid));
    });
  }

  // ── Heist modal — pick the guess word ──────────────────────
  function openHeistModal(targetUid) {
    if (!myPlayer || (myPlayer.balance || 0) < (session.heistFee || 0)) {
      toast(`Need at least 💸${session.heistFee} to attempt a hack.`, 'fail');
      return;
    }
    const target = allPlayers.find(p => p.uid === targetUid);
    if (!target) return;
    // Pick the Taboo hint for that target — we don't know their password,
    // but we DO know that whatever it is, it's one of the pack's words.
    // The hint shown is... random? No — it must match the target's word.
    // Since we can't read their password, we can't know which hint to show.
    //
    // SOLUTION: every student set a password that is ONE of the pack words.
    // When they joined, the host (in v1.5) could write a public targetHintId
    // to their player doc so attackers can read which hint to display.
    // For v1: students show all hints they could be — no, that gives it
    // away. We need a deterministic hint per target.
    //
    // FIX for v1: when the student saves their password (confirmPassword
    // step), we also write the matching tabooHint to their PLAYER doc as
    // `vaultHint`. The actual password stays in the restricted subcoll;
    // only the hint is public. Attackers see the hint, must match it to
    // the right word from the pack list.
    const hint = target.vaultHint || 'hint unavailable';

    // Build a guess grid with all pack words.
    const choices = session.passwordChoices || [];
    const bg = document.createElement('div');
    bg.className = 'heist-modal-bg';
    bg.innerHTML = `
      <div class="heist-modal" role="dialog" aria-modal="true">
        <button type="button" class="heist-modal-close" id="closeHack" aria-label="Close">←</button>
        <h3>Crack ${escHtml(target.name)}'s vault</h3>
        <div class="target">
          <div class="ava">${escHtml(target.avatar || '🦊')}</div>
          <div>
            <div style="font-weight:700;">${escHtml(target.name)}</div>
            <div style="color:var(--heist-gold-2); font-size:0.9em;">💸 ${target.balance || 0} in vault</div>
          </div>
        </div>
        <div class="hint">${escHtml(hint)}</div>
        <div class="cost-note">Costs 💸${session.heistFee}. If you crack it you steal half. If you miss, you lose the fee.</div>
        <div class="pw-grid">
          ${choices.map(w => `<button type="button" class="pw-opt" data-word="${escHtml(w)}">${escHtml(w)}</button>`).join('')}
        </div>
        <div class="heist-modal-actions">
          <button type="button" class="heist-btn" id="cancelHack">← Back</button>
          <button type="button" class="heist-btn primary" id="confirmHack" disabled>Crack vault (💸${session.heistFee})</button>
        </div>
      </div>`;
    document.body.appendChild(bg);

    // Close affordances: top-right back arrow, bottom cancel button,
    // backdrop click, and Esc key all map to "abandon hack".
    const closeModal = () => { try { bg.remove(); } catch (_) {} };
    bg.querySelector('#closeHack').addEventListener('click', closeModal);
    bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(); });
    const onEsc = (e) => {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onEsc); }
    };
    document.addEventListener('keydown', onEsc);

    let chosenWord = null;
    bg.querySelectorAll('.pw-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        bg.querySelectorAll('.pw-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        chosenWord = btn.dataset.word;
        bg.querySelector('#confirmHack').disabled = false;
      });
    });
    bg.querySelector('#cancelHack').addEventListener('click', closeModal);
    bg.querySelector('#confirmHack').addEventListener('click', async () => {
      if (!chosenWord) return;
      bg.querySelector('#confirmHack').disabled = true;
      bg.querySelector('#confirmHack').textContent = 'Cracking…';
      try {
        // Optimistic fee deduction so the student feels the cost
        // immediately. The referee won't deduct again.
        await db.collection('heist_sessions').doc(sessionCode).collection('players').doc(myUid).update({
          balance: firebase.firestore.FieldValue.increment(-session.heistFee)
        });
        // Submit the hack request — host's tab will resolve it.
        await db.collection('heist_sessions').doc(sessionCode).collection('hacks').add({
          attackerUid: myUid,
          attackerName: myName,
          targetUid: target.uid,
          targetName: target.name,
          guess: chosenWord,
          feeBurned: session.heistFee,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        bg.remove();
      } catch (e) {
        console.error('hack submit', e);
        toast('Could not submit hack: ' + e.message, 'fail');
        bg.remove();
      }
    });
  }

  // ── Done view ──────────────────────────────────────────────
  function enterDone() {
    setView('done');
    const sorted = [...allPlayers].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    const mine = sorted.findIndex(p => p.uid === myUid);
    const myRank = mine >= 0 ? (mine + 1) : '-';
    document.getElementById('finalRank').textContent = `#${myRank} of ${sorted.length}`;
    document.getElementById('finalCoins').textContent = `💸 ${myPlayer?.balance || 0}`;
    const list = document.getElementById('finalList');
    list.innerHTML = sorted.slice(0, 10).map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
      return `<div class="heist-player${p.uid === myUid ? ' me' : ''}" style="margin-bottom:6px;">
         <div class="ava">${escHtml(p.avatar || '🦊')}</div>
         <div class="name">${medal} ${escHtml(p.name)}</div>
         <div class="final-coin">💸 ${p.balance || 0}</div>
       </div>`;
    }).join('');
    unsubs.forEach(u => { try { u(); } catch (_) {} });
    unsubs = [];
  }

  // ── Wire DOM ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Music init — match the Vocab Race classroom behaviour.
    const audio = document.getElementById('bgMusic');
    if (audio) {
      audio.volume = 0.3;
      audio.loop = false;
      audio.addEventListener('ended', () => { if (musicPlaying) playRandomTrack(); });
    }

    // Prefill code from ?code=XXXX in the URL
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (code) document.getElementById('codeInput').value = code.toUpperCase();

    document.getElementById('joinBtn').addEventListener('click', joinRoom);
    document.getElementById('pwConfirmBtn').addEventListener('click', confirmPassword);
  });

  // refresh-guard.js predicate — themed double-confirm on F5 / Ctrl+R
  // active while the game is live (post-lobby, pre-done).
  window.refreshGuardShouldProtect = () => {
    if (!session) return false;
    if (session.status === 'playing' || session.status === 'password') return true;
    return false;
  };

  // beforeunload guard — if a student tries to close the tab or hit
  // browser-back while a game is in progress (status === 'playing'),
  // browsers will show their generic "Leave site?" dialog so they
  // can't accidentally trash their vault by swiping back. Only kicks
  // in during play; not on the join/password/wait/done screens.
  window.addEventListener('beforeunload', (e) => {
    if (session && session.status === 'playing'
        && document.getElementById('view-play')
        && document.getElementById('view-play').style.display !== 'none') {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
})();
