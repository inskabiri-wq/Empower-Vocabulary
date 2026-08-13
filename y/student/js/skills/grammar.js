/* ============================================================
   SKILL - Grammar (Quest-Board practice, vocab-style)
   Mirrors the vocabulary Learning Map / Quest Board:
     level tabs -> one card per coursebook UNIT (Unit 1, Unit 2 ...)
     with a progress donut, the unit's grammar topics listed, and
     the games (Multiple Choice / Fill in the Blank / Unscramble)
     as challenge rows. Pick a unit's game -> practise that unit's
     pooled questions -> progress (donut + check) persists in
     localStorage. Reuses the global .qc-* / .level-tab classes.
     Assignment mode scopes to the assigned topics and completes via
     markAssignmentCompleted(id, 100).
   Content: window.GRAMMAR_PRACTICE (units parsed from topic blurbs).
   ============================================================ */
(function () {
  'use strict';

  var DATA = null;
  var state = { level: null, view: 'menu', game: null, unit: null, selectedUnit: 'all', label: '', pool: [], idx: 0, score: 0, answered: false, assignment: null };

  var GAMES = [
    { id: 'choice',     icon: '🎯', name: 'Multiple Choice', desc: 'Pick the correct form' },
    { id: 'fill',       icon: '📝', name: 'Fill in the Blank', desc: 'Type the missing word' },
    { id: 'unscramble', icon: '🧩', name: 'Unscramble', desc: 'Put the words in order' }
  ];
  // Admin can deactivate individual grammar games (settings/featureToggles.gmode_*).
  // A deactivated game vanishes from the picker, the Quest Board challenge rows,
  // and the per-unit progress math. A missing key means ACTIVE. Keyed gmode_* so
  // it never collides with the vocabulary mode_* toggles.
  function gameOn(id) { var ft = window.featureToggles || {}; return ft['gmode_' + id] !== false; }
  function activeGames() { return GAMES.filter(function (g) { return gameOn(g.id); }); }
  var THRESHOLD = 60;
  var PROG_KEY  = 'gr_prog_v1';

  // Cross-device progress, read from the student's Firestore sessions (the same
  // place the grammar games already write to and the teacher dashboard reads).
  // Grammar used to track the map from localStorage ONLY, so the Quest Board
  // "caught nothing" when the play lived in Firestore / on another device. We
  // now load it once and MERGE with localStorage. Keyed by level|u<unit>|game.
  var grRemote = null;   // { 'A2|u3|choice': {best, done}, ... }
  var grStats  = null;   // overall { accuracy, best, challengesDone, totalQ, games }
  var grLoaded = false, grLoading = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function body() { return document.getElementById('grammarBody'); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function correctText(q) { return q.options[q.answer]; }
  // Full sentence with the blank filled. Parenthetical cues like "(open)"
  // are part of the QUESTION, not the sentence, so strip them here: the
  // unscramble word bank must never contain "(open)" as a token.
  function sentenceOf(q) { return String(q.stem).replace(/_{2,}/, correctText(q)).replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim(); }
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function unitOf(t) { var m = String(t.blurb || '').match(/Units?\s+(\d+)/i); return m ? parseInt(m[1], 10) : 0; }

  function loadProg() { try { return JSON.parse(localStorage.getItem(PROG_KEY) || '{}'); } catch (_) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (_) {} }
  function pkey(level, unit, game) { return level + '|u' + unit + '|' + game; }
  // Merge localStorage (this device) with the Firestore-backed remote cache.
  // A specific unit's progress ALSO counts the "all units" play for that game:
  // when you practise "all units", you do see that unit's questions, so its
  // donut should light up too (this is the "all A2 shows no map progress" fix).
  function progAt(key) {
    var p = loadProg();
    var local = p[key] || { best: 0, done: false };
    var remote = (grRemote && grRemote[key]) || { best: 0, done: false };
    return { best: Math.max(local.best || 0, remote.best || 0), done: !!(local.done || remote.done) };
  }
  function getProg(level, unit, game) {
    var a = progAt(pkey(level, unit, game));
    if (unit === 'all') return a;
    var b = progAt(pkey(level, 'all', game));   // credit "all units" play to this unit
    return { best: Math.max(a.best, b.best), done: a.done || b.done };
  }
  function recordProg(level, unit, game, pct) {
    var p = loadProg(), k = pkey(level, unit, game), prev = p[k] || { best: 0, done: false };
    p[k] = { best: Math.max(prev.best, pct), done: prev.done || pct >= THRESHOLD };
    saveProg(p);
    // Mirror into the in-memory remote cache so the map + header react instantly
    // (exact figures refresh from Firestore on the next load).
    if (grRemote) {
      var rprev = grRemote[k] || { best: 0, done: false }, wasDone = rprev.done;
      grRemote[k] = { best: Math.max(rprev.best || 0, pct), done: rprev.done || pct >= THRESHOLD };
      if (grStats) {
        grStats.best = Math.max(grStats.best || 0, pct);
        if (!wasDone && pct >= THRESHOLD) grStats.challengesDone = (grStats.challengesDone || 0) + 1;
      }
    }
  }

  // Build the remote cache + overall stats from a list of session docs.
  function buildRemote(list) {
    var remote = {}, accSum = 0, accCnt = 0, best = 0, doneCh = {}, totalQ = 0, games = 0;
    (list || []).forEach(function (s) {
      var act = String(s.activity || '');
      if (s.skill !== 'grammar' && act.indexOf('grammar-') !== 0) return;
      var game = act.indexOf('grammar-') === 0 ? act.slice(8) : (s.game || '');
      var lvl = s.level || '', unit = (s.unit == null ? 'all' : String(s.unit)), pct = Number(s.percentage || 0);
      games++; accSum += pct; accCnt++; if (pct > best) best = pct;
      totalQ += Number(s.totalQuestions || s.total || 0);
      var k = pkey(lvl, unit, game), prev = remote[k] || { best: 0, done: false };
      remote[k] = { best: Math.max(prev.best, pct), done: prev.done || pct >= THRESHOLD };
      if (pct >= THRESHOLD) doneCh[k] = true;
    });
    grRemote = remote;
    grStats = { accuracy: accCnt ? Math.round(accSum / accCnt) : 0, best: best,
      challengesDone: Object.keys(doneCh).length, totalQ: totalQ, games: games };
    grLoaded = true;
  }

  // Load grammar sessions from Firestore once, then run `after` (re-render).
  function ensureGrammarProgress(after) {
    if (grLoaded) { if (after) after(); return; }
    if (grLoading) return;   // a load is already in flight; its callback re-renders
    grLoading = true;
    function finish() { grLoading = false; if (after) after(); }
    try {
      if (typeof auth === 'undefined' || !auth.currentUser || typeof db === 'undefined') { buildRemote([]); finish(); return; }
      db.collection('sessions').where('userId', '==', auth.currentUser.uid).get()
        .then(function (snap) { buildRemote(snap.docs.map(function (d) { return d.data(); })); })
        .catch(function () { buildRemote([]); })
        .then(finish);
    } catch (e) { buildRemote([]); finish(); }
  }

  // Topics in a (level, unit), optionally limited to the assignment's topics.
  function unitTopics(level, unit) {
    var asg = state.assignment;
    return (DATA.byLevel[level] || []).filter(function (t) {
      // In free practice, drop topics an admin hid (Content controls). In an
      // assignment we use the assigned topic list, so a hidden-but-assigned
      // topic still appears.
      var hiddenInPractice = !asg && typeof window.isPracticeHidden === 'function' && window.isPracticeHidden('grammar', t.id);
      return unitOf(t) === unit && (!asg || asg.topicIds.indexOf(t.id) !== -1) && !hiddenInPractice;
    });
  }
  function poolFor(level, unit, game) {
    var out = [];
    var unitsList = (unit === 'all') ? unitsAt(level) : [unit];
    unitsList.forEach(function (u) {
      unitTopics(level, u).forEach(function (t) {
        (t.questions || []).forEach(function (q) {
          q.ht = t.title; // grammar-point hint shown in the fill game
          q._tid = t.id;  // topic id, so the fill clue can skip non-verb topics
          var blanks = (String(q.stem).match(/_{2,}/g) || []).length;
          if (game === 'unscramble') { if (blanks === 1 && sentenceOf(q).split(/\s+/).length <= 9) out.push(q); }
          else if (game === 'fill') { if (blanks === 1 && correctText(q).split(/\s+/).length === 1) out.push(q); }
          else out.push(q);
        });
      });
    });
    return out;
  }
  // Unit numbers present at this level (assignment-filtered), sorted.
  function unitsAt(level) {
    var asg = state.assignment, seen = {};
    (DATA.byLevel[level] || []).forEach(function (t) {
      if (asg && asg.topicIds.indexOf(t.id) === -1) return;
      seen[unitOf(t)] = true;
    });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  // The live profile avatar (the same one the vocab dashboard shows) so the
  // grammar screen mirrors it instead of a static book.
  function liveAvatar() { var el = document.getElementById('avatarDisplayEmoji'); return (el && (el.textContent || '').trim()) || '📘'; }
  // Copy the live profile (avatar / name / level / XP) into the grammar header
  // chip so it matches the vocab dashboard header.
  function syncGrammarHeader() {
    var pairs = [['avatarDisplayEmoji', 'grAvatarEmoji'], ['profileName', 'grProfileName'], ['profileXPLevel', 'grProfileLevel'], ['profileXP', 'grProfileXP']];
    pairs.forEach(function (p) { var s = document.getElementById(p[0]), d = document.getElementById(p[1]); if (s && d && (s.textContent || '').trim()) d.textContent = s.textContent; });
  }

  function init() {
    DATA = window.GRAMMAR_PRACTICE || null;
    if (!body()) return;
    if (!DATA || !DATA.levels || !DATA.levels.length) { body().innerHTML = '<div class="gr-empty">Grammar content is not loaded yet.</div>'; return; }
    if (!state.level) state.level = DATA.levels[0];
    renderMenu();
  }

  // ── Build the unit cards (the "map") + level stats ─────────
  function buildUnitCards(level) {
    var units = unitsAt(level);
    var games = activeGames();
    var gpu = games.length || 1;   // games-per-unit, guarded against /0 if all are off
    var gamesDone = 0, gamesTotal = 0, totalQ = 0, mastered = 0, best = 0, accSum = 0, accCount = 0;
    var cards = units.map(function (u) {
      var topics = unitTopics(level, u);
      var n = topics.reduce(function (s, t) { return s + (t.questions || []).length; }, 0);
      totalQ += n;
      var doneCount = 0;
      var rows = games.map(function (g) {
        var pr = getProg(level, u, g.id);
        if (pr.done) doneCount++;
        if (pr.best > 0) { accSum += pr.best; accCount++; if (pr.best > best) best = pr.best; }
        return '<div class="qc-challenge ' + (pr.done ? 'done' : '') + '" data-unit="' + u + '" data-game="' + g.id + '">' +
          '<span class="qc-challenge-icon">' + g.icon + '</span>' +
          '<span class="qc-challenge-name">' + esc(g.name) + '</span>' +
          '<span class="qc-challenge-score">' + (pr.best > 0 ? pr.best + '%' : '·') + '</span>' +
          '<span class="qc-challenge-check">' + (pr.done ? '✅' : '⬜') + '</span>' +
        '</div>';
      }).join('');
      gamesDone += doneCount; gamesTotal += games.length;
      if (games.length && doneCount === games.length) mastered++;
      var pct = Math.round(doneCount / gpu * 100);
      var color = (games.length && doneCount === games.length) ? '#10b981' : (pct > 0 ? '#3b82f6' : '#334155');
      var statusClass = (games.length && doneCount === games.length) ? 'qc-complete' : (doneCount > 0 ? 'qc-active' : 'qc-new');
      var statusLabel = (games.length && doneCount === games.length) ? '🏆 Mastered' : (doneCount > 0 ? '📖 In Progress' : '🆕 Not Started');
      var topicLine = topics.map(function (t) { return t.title; }).join(' · ');
      var radius = 32, circ = 2 * Math.PI * radius, offset = circ - pct / 100 * circ;
      return '<div class="qc-card ' + statusClass + '">' +
        '<div class="qc-card-header">' +
          '<div class="qc-donut"><svg width="76" height="76" viewBox="0 0 76 76">' +
            '<circle cx="38" cy="38" r="' + radius + '" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/>' +
            '<circle cx="38" cy="38" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="6" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" transform="rotate(-90 38 38)" style="transition:stroke-dashoffset .6s ease;"/>' +
          '</svg><div class="qc-donut-label">' + pct + '%</div></div>' +
          '<div class="qc-unit-info">' +
            '<div class="qc-unit-name">Unit ' + u + '</div>' +
            '<div class="qc-unit-words">' + n + ' questions</div>' +
            '<div class="qc-unit-topics">' + esc(topicLine) + '</div>' +
            '<div class="qc-unit-status">' + statusLabel + '</div>' +
            '<div class="qc-quest-progress">' + doneCount + '/' + games.length + ' games</div>' +
          '</div>' +
        '</div>' +
        '<div class="qc-challenges">' + rows + '</div>' +
      '</div>';
    }).join('');

    // Prefer the Firestore-backed aggregate (grStats) for the headline numbers
    // so they reflect ALL grammar play (including "all units" sessions), not
    // just the per-unit cards. Falls back to the per-unit loop when no remote.
    var localBest = best, localAcc = accCount ? Math.round(accSum / accCount) : 0;
    return { cards: cards, units: units, gamesDone: gamesDone, gamesTotal: gamesTotal, totalQ: totalQ, mastered: mastered,
      best: Math.max(localBest, (grStats && grStats.best) || 0),
      accuracy: (grStats && grStats.games) ? grStats.accuracy : localAcc,
      challengesDone: (grStats && grStats.games) ? grStats.challengesDone : gamesDone };
  }

  // ── Menu: vocab layout (games in the centre; level/unit + map on the right) ──
  function renderMenu() {
    var b = body(); if (!b) return;
    syncGrammarHeader();
    state.view = 'menu';
    // First view: pull cross-device progress from Firestore, then re-render so
    // the donuts + headline stats reflect real play (mirrors the vocab map).
    if (!grLoaded && !grLoading) ensureGrammarProgress(function () { if (state.view === 'menu') renderMenu(); });
    var asg = state.assignment;
    var level = asg ? asg.level : state.level;
    var info = buildUnitCards(level);

    // Assignment mode: banner + the assigned units (pick a unit's game).
    if (asg) {
      b.innerHTML = '<div class="gr-asg-banner"><strong>📌 ' + esc(asg.title || (asg.level + ' grammar assignment')) + '</strong><div>Finish a game in any assigned unit to complete this assignment.</div></div>' +
        '<div class="qc-grid learning-map-container">' + (info.cards || '<div class="gr-empty">No units yet.</div>') + '</div>';
      b.querySelectorAll('.qc-challenge').forEach(function (el) { el.onclick = function () { startGame(parseInt(el.getAttribute('data-unit'), 10), el.getAttribute('data-game')); }; });
      return;
    }

    var prog = loadProg(), allDone = 0; Object.keys(prog).forEach(function (k) { if (prog[k] && prog[k].done) allDone++; });
    var xp = allDone * 25, glvl = Math.floor(xp / 100) + 1, xpIn = xp % 100;
    var RANKS = ['Beginner', 'Learner', 'Rising Star', 'Scholar', 'Expert', 'Master', 'Grandmaster'];
    var rank = RANKS[Math.min(glvl - 1, RANKS.length - 1)];

    var welcome = '<div class="gr-welcome"><div class="gr-welcome-text">' +
      '<h2>Grammar Quest</h2>' +
      '<p>You have mastered <strong>' + info.mastered + '</strong> of <strong>' + info.units.length + '</strong> units at <strong>' + esc(level) + '</strong>. Keep going!</p>' +
      '</div><div class="gr-welcome-ava">' + esc(liveAvatar()) + '</div></div>';

    // Vocabulary's XP block, class for class (.dash-xp-block / .xp-bar-*  /
    // .xp-milestone), not a grammar-shaped copy of it. The old .gr-xp markup
    // drifted: a 10px flat track instead of a 9px --dash-elevated one, a fill
    // with no shine animation and no top sheen, and a grey "X / 100 XP" where
    // vocabulary shows amber. The milestone pips light up from the real XP
    // rather than always marking 0 as hit.
    var xpMiles = [0, 25, 50, 75, 100].map(function (m) {
      return '<span class="xp-milestone' + (xpIn >= m ? ' hit' : '') + '" data-xp="' + m + '">' + m + '</span>';
    }).join('');
    var xpBlock = '<div class="dash-xp-block">' +
      '<div class="dash-xp-top">' +
        '<div class="xp-badge-pill">Level ' + glvl + ' · ' + esc(rank) + '</div>' +
        '<div class="xp-num">' + xpIn + ' / 100 XP</div>' +
      '</div>' +
      '<div class="xp-bar-container">' +
        '<div class="xp-bar-fill" style="width:' + xpIn + '%"></div>' +
        '<div class="xp-bar-glow"></div>' +
      '</div>' +
      '<div class="xp-milestones">' + xpMiles + '</div>' +
    '</div>';

    var GR_SVG = {
      trophy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>',
      star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      target: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#22c55e"/></svg>',
      book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      pad: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
    };
    function statCard(accent, svg, val, lbl) { return '<div class="gr-stat" data-accent="' + accent + '"><div class="gr-stat-ic">' + svg + '</div><div class="gr-stat-val">' + val + '</div><div class="gr-stat-lbl">' + lbl + '</div></div>'; }
    var stats = '<div class="gr-stats">' +
      statCard('best', GR_SVG.trophy, info.mastered, 'Mastered') + statCard('streak', GR_SVG.star, info.best + '%', 'Best') +
      statCard('accuracy', GR_SVG.target, info.accuracy + '%', 'Accuracy') + statCard('words', GR_SVG.book, info.totalQ, 'Questions') +
      statCard('sessions', GR_SVG.pad, info.challengesDone, 'Challenges') + '</div>';

    var unitLabel = state.selectedUnit === 'all' ? 'all units' : ('Unit ' + state.selectedUnit);
    var unitDesc;
    if (state.selectedUnit === 'all') { unitDesc = 'All ' + info.units.length + ' units &middot; every ' + esc(level) + ' topic.'; }
    else { var _ut = unitTopics(level, state.selectedUnit).map(function (t) { return t.title; }); unitDesc = '<strong>Unit ' + state.selectedUnit + ':</strong> ' + esc(_ut.join(', ')); }
    var grGames = activeGames();
    var grGameGrid = grGames.length
      ? grGames.map(function (g) {
          return '<button type="button" class="gr-game-card" data-game="' + g.id + '"><div class="gr-game-badge">' + g.icon + '</div><h3>' + esc(g.name) + '</h3><p>' + esc(g.desc) + '</p></button>';
        }).join('')
      : '<div class="gr-empty">No grammar games are active right now.</div>';
    var gameCards = '<div class="gr-section-title"><span>🎮</span> Choose a game &middot; ' + esc(unitLabel) + '</div>' +
      '<div class="gr-unit-desc">' + unitDesc + '</div>' +
      '<div class="gr-game-grid">' + grGameGrid + '</div>';

    var levelPills = DATA.levels.map(function (lv) { return '<button type="button" class="gr-pill' + (lv === level ? ' active' : '') + '" data-lv="' + esc(lv) + '">' + esc(lv) + '</button>'; }).join('');
    var unitPills = '<button type="button" class="gr-pill gr-pill-u' + (state.selectedUnit === 'all' ? ' active' : '') + '" data-unit="all">All</button>' +
      info.units.map(function (u) { return '<button type="button" class="gr-pill gr-pill-u' + (String(state.selectedUnit) === String(u) ? ' active' : '') + '" data-unit="' + u + '">U' + u + '</button>'; }).join('');
    var side = '<div class="gr-side">' +
      '<div class="gr-side-card"><div class="gr-side-title">📚 Level</div><div class="gr-level-pills">' + levelPills + '</div></div>' +
      '<div class="gr-side-card"><div class="gr-side-title">📖 Unit</div><div class="gr-level-pills gr-unit-pills">' + unitPills + '</div>' +
        '<div class="gr-count"><div class="gr-count-num">' + info.totalQ + '</div><div class="gr-count-lbl">questions at ' + esc(level) + '</div></div></div>' +
      '<button type="button" class="map-btn-gamified" id="grMapBtn"><span class="map-btn-icon">🗺️</span><span class="map-btn-text">Explore Grammar Map</span><span class="map-btn-arrow">→</span></button>' +
    '</div>';

    b.innerHTML = '<div class="gr-dash"><div class="gr-main">' + welcome + xpBlock + stats + gameCards + '</div>' + side + '</div>';
    b.querySelectorAll('.gr-pill[data-lv]').forEach(function (el) { el.onclick = function () { state.level = el.getAttribute('data-lv'); state.selectedUnit = 'all'; renderMenu(); }; });
    b.querySelectorAll('.gr-pill[data-unit]').forEach(function (el) { el.onclick = function () { var u = el.getAttribute('data-unit'); state.selectedUnit = (u === 'all') ? 'all' : parseInt(u, 10); renderMenu(); }; });
    b.querySelectorAll('.gr-game-card').forEach(function (el) { el.onclick = function () { startGame(state.selectedUnit, el.getAttribute('data-game')); }; });
    var mb = document.getElementById('grMapBtn'); if (mb) mb.onclick = openMap;
  }

  // ── Map modal: the unit Quest Board (donuts + per-unit games) ──
  // Built from the SAME chrome as vocabulary's Quest Board: .modal-overlay >
  // .modal-content.learning-map-modal, with the shared .level-tabs row. It used
  // to be a bespoke .gr-map-modal / .gr-map-sheet pair, which is why it had no
  // level tabs at all and why its cards came out a different shape - a 900px
  // sheet with 18px padding gives 423x305 cards, vocabulary's 810px sheet with
  // 36/44px padding gives 350x297. Same box now, so the same card.
  function openMap() {
    var browseLevel = state.assignment ? state.assignment.level : state.level;
    var old = document.getElementById('grMapModal'); if (old) old.remove();

    var ov = document.createElement('div');
    ov.id = 'grMapModal';
    ov.className = 'modal-overlay active';
    ov.innerHTML =
      '<div class="modal-content learning-map-modal">' +
        '<button type="button" class="modal-close-btn" id="grMapClose" aria-label="Close">&times;</button>' +
        '<h2 class="modal-title">🗺️ Grammar Quest Board</h2>' +
        '<p class="qc-board-sub">Complete challenges to master each unit</p>' +
        '<div class="level-tabs" id="grMapTabs"></div>' +
        '<div class="learning-map-container" id="grMapContainer"></div>' +
      '</div>';
    document.body.appendChild(ov);

    var tabs = ov.querySelector('#grMapTabs');
    var box  = ov.querySelector('#grMapContainer');

    function paint(level) {
      browseLevel = level;
      tabs.innerHTML = (DATA.levels || []).map(function (lv) {
        return '<button type="button" class="level-tab' + (lv === level ? ' active' : '') + '"'
          + ' data-level="' + esc(lv) + '">' + esc(lv) + '</button>';
      }).join('');
      tabs.querySelectorAll('.level-tab').forEach(function (t) {
        t.onclick = function () { paint(t.getAttribute('data-level')); };
      });

      var info = buildUnitCards(level);
      box.innerHTML = '<div class="qc-grid">'
        + (info.cards || '<div class="gr-empty">No units yet for ' + esc(level) + '.</div>')
        + '</div>';
      box.querySelectorAll('.qc-challenge').forEach(function (el) {
        el.onclick = function () {
          // Browsing the map does not change the menu's level (vocabulary works
          // the same way), but STARTING a drill from another level must.
          state.level = level;
          state.selectedUnit = 'all';
          close();
          startGame(parseInt(el.getAttribute('data-unit'), 10), el.getAttribute('data-game'));
        };
      });
    }

    function close() { ov.remove(); }
    ov.querySelector('#grMapClose').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };
    paint(browseLevel);
  }

  // ── Start a unit's game ────────────────────────────────────
  function startGame(unit, game) {
    var level = state.assignment ? state.assignment.level : state.level;
    var pool = poolFor(level, unit, game);
    if (!pool.length) { if (typeof AppDialog !== 'undefined') AppDialog.alert('This unit has no items for that game yet.'); return; }
    state.level = level; state.unit = unit; state.label = (unit === 'all') ? (level + ' · all units') : ('Unit ' + unit); state.game = game;
    // Questions per drill: an assignment may override; else the admin's
    // global setting (Content controls); else 12. (content-controls-student.js)
    var qCount = (state.assignment && state.assignment.questionCount > 0)
      ? state.assignment.questionCount
      : ((typeof window.grammarQuestionCount === 'function') ? window.grammarQuestionCount(12) : 12);
    state.pool = shuffle(pool).slice(0, qCount); state.idx = 0; state.score = 0; state.answered = false; state.answers = []; state.view = 'game';
    renderQ();
  }

  function gameTop() {
    return '<div class="gr-drill-top">' +
      '<button type="button" class="gr-back" id="grBack">&#8592; Back</button>' +
      '<div class="gr-progress">' + (state.idx + 1) + ' / ' + state.pool.length + '</div>' +
    '</div>';
  }
  function wireBack() { var bk = document.getElementById('grBack'); if (bk) bk.onclick = renderMenu; }
  function footFeedback(ok, explain) {
    var last = state.idx >= state.pool.length - 1;
    return '<div class="gr-feedback ' + (ok ? 'ok' : 'no') + '"><strong>' + (ok ? 'Correct' : 'Not quite') + '.</strong> ' + esc(explain || '') + '</div>' +
      '<div class="gr-drill-foot"><button type="button" class="gr-next" id="grNext">' + (last ? 'See result' : 'Next') + ' <span class="chev">&#8250;</span></button></div>';
  }
  function wireNext() { var n = document.getElementById('grNext'); if (n) n.onclick = function () { state.idx++; renderQ(); }; }

  function renderQ() {
    var q = state.pool[state.idx];
    if (!q) { renderResult(); return; }
    state.answered = false;
    if (state.game === 'fill') return renderFill(q);
    if (state.game === 'unscramble') return renderUnscramble(q);
    return renderChoice(q);
  }

  // Hints are hidden behind a button so the question is real practice; the
  // student reveals the rule only if they choose to.
  function hintBlock(h) {
    if (!h) return '';
    return '<div class="gr-hint-wrap">' +
      '<button type="button" class="gr-hint-btn" id="grHintBtn" style="display:inline-block; background:transparent; border:1px solid rgba(127,127,127,0.35); color:inherit; opacity:0.85; border-radius:999px; padding:3px 12px; font-size:0.82em; cursor:pointer; margin:4px 0;">Show hint</button>' +
      '<div class="gr-fill-hint" id="grHint" style="display:none;">Hint: <span class="gr-hint-word">' + esc(h) + '</span></div>' +
      '</div>';
  }
  function wireHint(b) {
    var btn = b.querySelector('#grHintBtn'); if (!btn) return;
    btn.onclick = function () {
      var hd = b.querySelector('#grHint'); if (!hd) return;
      var open = hd.style.display !== 'none';
      hd.style.display = open ? 'none' : '';
      btn.textContent = open ? 'Show hint' : 'Hide hint';
    };
  }
  // Fill in the Blank gives no options, so the typed answer can be unguessable
  // ("which verb?"). The hint gives TWO things and never the word itself:
  //   1. the grammar rule, and
  //   2. a meaning clue for the verb (a definition, so the student still thinks).
  // The clue only shows when the answer is a known lexical verb; otherwise just
  // the rule. The glosses never contain the verb they describe.
  var GR_IRREG = { went: 'go', gone: 'go', ate: 'eat', eaten: 'eat', bought: 'buy', saw: 'see', seen: 'see', made: 'make', took: 'take', taken: 'take', wrote: 'write', written: 'write', drank: 'drink', drunk: 'drink', gave: 'give', given: 'give', found: 'find', left: 'leave', met: 'meet', spoke: 'speak', spoken: 'speak', broke: 'break', broken: 'break', knew: 'know', known: 'know', lost: 'lose', began: 'begin', begun: 'begin', forgot: 'forget', forgotten: 'forget', drove: 'drive', driven: 'drive', flew: 'fly', flown: 'fly', swam: 'swim', sang: 'sing', ran: 'run', rode: 'ride', told: 'tell', sent: 'send', built: 'build', paid: 'pay', sold: 'sell', kept: 'keep', felt: 'feel', caught: 'catch', taught: 'teach', got: 'get', understood: 'understand', said: 'say', worn: 'wear', grown: 'grow', stolen: 'steal', lying: 'lie', won: 'win' };
  var GR_AUX = 'is are am was were be been being has have had will would shall should can could may might must do does did to not'.split(' ').reduce(function (o, w) { o[w] = 1; return o; }, {});
  var GR_GLOSS = {
    go: 'move or travel to a place', live: 'have your home somewhere', play: 'take part in a game or sport', watch: 'look at something for a while',
    study: 'learn about a subject', work: 'do your job', read: 'look at words and understand them', drink: 'take liquid into your mouth',
    speak: 'use your voice to say a language', start: 'make something begin', teach: 'help other people learn', drive: 'control a car',
    cook: 'prepare food with heat', walk: 'move slowly on your feet', like: 'enjoy or be fond of', eat: 'put food in your mouth',
    buy: 'get something with money', see: 'notice with your eyes', make: 'create or build something', take: 'pick up or carry away',
    write: 'put words on paper', give: 'hand something to a person', find: 'discover where something is', leave: 'go away from a place',
    meet: 'come together with someone', visit: 'go to see a place or person', swim: 'move through water', sing: 'make music with your voice',
    dance: 'move your body to music', ride: 'sit on and control a bike or horse', run: 'move quickly on your feet', listen: 'pay attention to a sound',
    clean: 'make something tidy and free of dirt', paint: 'put colour on a surface', shop: 'buy things in stores', win: 'come first or beat the others',
    call: 'phone or shout to someone', help: 'make things easier for someone', stay: 'remain in one place', catch: 'grab a moving thing',
    book: 'reserve a place in advance', pass: 'succeed in an exam', finish: 'bring something to an end', arrive: 'reach a place',
    close: 'shut something', open: 'make something no longer shut', build: 'put up a structure', lose: 'stop having something',
    forget: 'fail to remember', begin: 'make something start', sell: 'give something for money', pay: 'give money for something',
    send: 'make something go to someone', tell: 'give information in words', keep: 'continue to have', feel: 'sense an emotion or touch',
    know: 'have facts in your mind', break: 'make something come apart', plan: 'decide in advance what to do', travel: 'make a journey',
    wait: 'stay until something happens', train: 'practise for a sport or skill', save: 'keep money, or rescue', ask: 'put a question to someone',
    practise: 'do something often to get better', join: 'become a member of a group', move: 'change place or change home', learn: 'get knowledge or a skill',
    fly: 'travel through the air', wear: 'have clothes on your body', get: 'obtain or receive', answer: 'reply to a question',
    remember: 'keep something in your mind', return: 'come or go back', repair: 'fix something broken', check: 'look to make sure',
    sign: 'write your name on something', print: 'make words on paper with a machine', try: 'make an effort', use: 'put to work for a purpose',
    relax: 'rest and become calm', sleep: 'rest with your eyes closed at night', reach: 'arrive at or stretch to', invite: 'ask someone to come',
    own: 'have as your property', want: 'wish to have', avoid: 'keep away from', cheat: 'break the rules to win',
    accept: 'agree to take or receive', understand: 'know the meaning of', succeed: 'do well and reach a goal', prepare: 'get ready',
    warn: 'tell of a danger', discover: 'find for the first time', revise: 'study again before a test', invest: 'put money in for the future',
    earn: 'get money by working', fix: 'repair, or attach firmly', stop: 'no longer move or continue', mend: 'repair something',
    translate: 'change words into another language', service: 'check and repair a machine', copy: 'make the same again', type: 'write with a keyboard',
    audit: 'check accounts officially', analyse: 'examine something in detail', tailor: 'adjust clothes to fit a person', review: 'look over and judge',
    redecorate: 'paint and refit a room', redesign: 'plan the look of something again', landscape: 'shape a garden or grounds', notice: 'become aware of something',
    lock: 'close firmly with a key', grow: 'get bigger, or raise plants', test: 'check that something works', water: 'pour water on plants',
    turn: 'move to face another way', serve: 'give food or help to people', steal: 'take without permission', cancel: 'call off something planned',
    plant: 'put into the ground to grow', depart: 'leave, especially a vehicle', retire: 'stop working for good', film: 'record moving pictures',
    attend: 'go to an event', present: 'show or give something formally', settle: 'pay what is owed, or come to rest', fail: 'not succeed',
    cycle: 'ride a bicycle', say: 'speak words aloud', lie: 'rest flat on a surface', deliver: 'take goods to a place', record: 'store sound or video'
  };
  // Every base a word could reduce to. We try the raw word first (so a base
  // verb that ends in -ing like "sing" is not mangled), then each inflection
  // rule, offering BOTH the plain strip AND the de-doubled / e-restored form,
  // so "called"->call, "passed"->pass, "stopped"->stop, "liked"->like and
  // "driving"->drive all resolve. grLemma keeps the first candidate we gloss.
  function grCandidates(w) {
    var c = [w];
    if (GR_IRREG[w]) c.push(GR_IRREG[w]);
    if (/ies$/.test(w)) c.push(w.slice(0, -3) + 'y');
    if (/(ches|shes|sses|xes|zes|oes)$/.test(w)) c.push(w.slice(0, -2));
    if (/s$/.test(w)) c.push(w.slice(0, -1));
    if (/ied$/.test(w)) c.push(w.slice(0, -3) + 'y');
    if (/ed$/.test(w)) { var e = w.slice(0, -2); c.push(e, e + 'e'); if (/(.)\1$/.test(e)) c.push(e.slice(0, -1)); }
    if (/ing$/.test(w)) { var g = w.slice(0, -3); c.push(g, g + 'e'); if (/(.)\1$/.test(g)) c.push(g.slice(0, -1)); }
    return c;
  }
  function grLemma(ans) {
    var full = String(ans == null ? '' : ans).toLowerCase();
    if (/\bgoing to\b/.test(full) || /\bused to\b/.test(full) || /\buse to\b/.test(full)) return '';  // future / habit markers, not a literal verb
    var p = full.trim().split(/\s+/);
    var skip = { to: 1, not: 1, up: 1, out: 1, off: 1, 'in': 1, on: 1, back: 1, down: 1, here: 1, there: 1, now: 1, him: 1, her: 1, me: 1, us: 1, them: 1, you: 1, it: 1, well: 1, hard: 1, home: 1, early: 1, late: 1 };
    var i = p.length - 1; while (i > 0 && skip[p[i]]) i--;
    var w = p[i]; if (!w || GR_AUX[w]) return '';
    var cands = grCandidates(w);
    for (var k = 0; k < cands.length; k++) { if (GR_GLOSS[cands[k]]) return cands[k]; }
    return '';
  }
  // Topics whose fill answer is NOT a lexical verb (plural noun, comparative,
  // possessive, quantifier, article...). A "the verb means" clue would be wrong
  // or irrelevant there, so we show only the grammar rule. Matched on q._tid.
  var GR_NONVERB_TID = /plural|comparativ|superlativ|possessiv|adv-frequency|few-little|so-such|article|a-an|some-any|much-many|quantif|demonstrat/i;
  function fillHintBlock(q) {
    var parts = [];
    if (q.hint) parts.push('<b>Grammar:</b> ' + esc(q.hint));
    var lm = (q._tid && GR_NONVERB_TID.test(q._tid)) ? '' : grLemma(correctText(q));
    if (lm && GR_GLOSS[lm]) parts.push('<b>Clue:</b> the verb means "' + esc(GR_GLOSS[lm]) + '"');
    // First letter of the answer - the meaning clue alone was too vague, so this
    // narrows it down without handing over the whole word.
    var ans = String(correctText(q) == null ? '' : correctText(q)).trim();
    if (ans) parts.push('<b>Starts with:</b> "' + esc(ans.charAt(0).toLowerCase()) + '"');
    if (!parts.length) parts.push('Think about which form fits the sentence.');
    return '<div class="gr-hint-wrap">' +
      '<button type="button" class="gr-hint-btn" id="grHintBtn" style="display:inline-block; background:transparent; border:1px solid rgba(127,127,127,0.35); color:inherit; opacity:0.85; border-radius:999px; padding:3px 12px; font-size:0.82em; cursor:pointer; margin:4px 0;">Show hint</button>' +
      '<div class="gr-fill-hint" id="grHint" style="display:none; line-height:1.6;">' + parts.join('<br>') + '</div></div>';
  }

  function renderChoice(q) {
    var b = body();
    var opts = q.options.map(function (o, i) { return '<button type="button" class="gr-opt" data-i="' + i + '">' + esc(o) + '</button>'; }).join('');
    b.innerHTML = '<div class="gr-drill">' + gameTop() +
      '<div class="gr-q-topic">' + esc(state.label) + ' · Multiple Choice</div>' +
      '<div class="gr-stem">' + esc(q.stem) + '</div>' +
      hintBlock(q.hint) +
      '<div class="gr-opts">' + opts + '</div><div id="grTail"></div></div>';
    wireBack(); wireHint(b);
    b.querySelectorAll('.gr-opt').forEach(function (el) {
      el.onclick = function () {
        if (state.answered) return; state.answered = true;
        var i = parseInt(el.getAttribute('data-i'), 10);
        b.querySelectorAll('.gr-opt').forEach(function (o, idx) { o.disabled = true; if (idx === q.answer) o.classList.add('is-correct'); else if (idx === i) o.classList.add('is-wrong'); });
        if (i === q.answer) state.score++;
        state.answers.push({ q: q.stem, picked: q.options[i], correct: correctText(q), ok: i === q.answer });
        document.getElementById('grTail').innerHTML = footFeedback(i === q.answer, q.explain); wireNext();
      };
    });
  }

  function renderFill(q) {
    var b = body();
    var shown = esc(q.stem).replace(/_{2,}/, '<span class="gr-blank"></span>');
    b.innerHTML = '<div class="gr-drill">' + gameTop() +
      '<div class="gr-q-topic">' + esc(state.label) + ' · Fill in the Blank</div>' +
      '<div class="gr-stem">' + shown + '</div>' +
      '<input type="text" class="gr-fill-input" id="grFill" placeholder="Type the missing word" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      fillHintBlock(q) +
      '<div class="gr-drill-foot"><button type="button" class="gr-next" id="grCheck">Check</button></div><div id="grTail"></div></div>';
    wireBack(); wireHint(b);
    var input = document.getElementById('grFill'); if (input) input.focus();
    function submit() {
      if (state.answered) return; var val = input.value; if (!norm(val)) return;
      state.answered = true;
      var ok = norm(val) === norm(correctText(q));
      input.disabled = true; input.classList.add(ok ? 'gr-fill-ok' : 'gr-fill-no');
      if (ok) state.score++;
      state.answers.push({ q: q.stem, picked: val, correct: correctText(q), ok: ok });
      var ex = (q.explain || '') + (ok ? '' : ' Answer: "' + correctText(q) + '".');
      var ch = document.getElementById('grCheck'); if (ch) ch.style.display = 'none';
      document.getElementById('grTail').innerHTML = footFeedback(ok, ex); wireNext();
    }
    document.getElementById('grCheck').onclick = submit;
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  // Word Order tokenizer (mirrors the vocabulary Word Order mode): lowercase
  // every word and split any trailing sentence punctuation into its OWN token.
  // This removes the two give-aways: the capital first letter (now every bank
  // token is lower-case) and the period stuck to the final word (now a separate
  // floating token). The first word is re-capitalised only for display.
  function isPunctTok(t) { return /^[.,!?;:]+$/.test(t); }
  function orderTokens(sentence) {
    var out = [];
    String(sentence).split(/\s+/).filter(Boolean).forEach(function (w) {
      var m = w.match(/^(.+?)([.,!?;:]+)$/);
      if (m) { out.push(m[1].toLowerCase()); out.push(m[2]); }
      else { out.push(w.toLowerCase()); }
    });
    return out;
  }
  // Display helper: capitalise the first real word in the answer row, leave the
  // rest lower-case, never touch punctuation. Comparison stays lower-case.
  function recaseAnswer(ans) {
    var first = false;
    ans.querySelectorAll('.gr-answer-token').forEach(function (el) {
      var w = (el.getAttribute('data-w') || '').toLowerCase();
      if (isPunctTok(w)) { el.textContent = w; return; }
      if (!first) { el.textContent = w.charAt(0).toUpperCase() + w.slice(1); first = true; }
      else { el.textContent = w; }
    });
  }
  // Render the student's token list back as a natural sentence (for the review).
  function naturalJoin(toks) {
    var s = '';
    toks.forEach(function (t, i) {
      if (isPunctTok(t)) { s += t; }
      else { var w = (i === 0) ? t.charAt(0).toUpperCase() + t.slice(1) : t; s += (s ? ' ' : '') + w; }
    });
    return s;
  }

  function renderUnscramble(q) {
    var b = body();
    var toks = orderTokens(sentenceOf(q));
    var order = shuffle(toks.map(function (w, i) { return i; }));
    if (toks.length > 1 && order.every(function (v, i) { return v === i; })) order.reverse();
    var bank = order.map(function (origIdx, pos) {
      var t = toks[origIdx];
      return '<button type="button" class="gr-token' + (isPunctTok(t) ? ' gr-token-punct' : '') + '" data-pos="' + pos + '" data-w="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    b.innerHTML = '<div class="gr-drill">' + gameTop() +
      '<div class="gr-q-topic">' + esc(state.label) + ' · Unscramble</div>' +
      '<div class="gr-stem" style="font-size:1em;color:var(--text-secondary,#b4b4c8);">Tap the words in the right order:</div>' +
      hintBlock(q.hint) +
      '<div class="gr-answer" id="grAns"><span class="gr-answer-hint">your sentence appears here</span></div>' +
      '<div class="gr-bank" id="grBank">' + bank + '</div>' +
      '<div class="gr-drill-foot"><button type="button" class="gr-next" id="grCheck">Check</button></div><div id="grTail"></div></div>';
    wireBack(); wireHint(b);
    var ans = document.getElementById('grAns');
    function refreshHint() { var hint = ans.querySelector('.gr-answer-hint'); if (hint) hint.style.display = ans.querySelector('.gr-answer-token') ? 'none' : ''; }
    document.getElementById('grBank').querySelectorAll('.gr-token').forEach(function (tok) {
      tok.onclick = function () {
        if (state.answered || tok.classList.contains('placed')) return;
        tok.classList.add('placed');
        var at = document.createElement('button');
        at.type = 'button'; at.className = 'gr-answer-token';
        at.setAttribute('data-w', tok.getAttribute('data-w'));
        at.onclick = function () { if (state.answered) return; tok.classList.remove('placed'); at.remove(); recaseAnswer(ans); refreshHint(); };
        ans.appendChild(at); recaseAnswer(ans); refreshHint();
      };
    });
    document.getElementById('grCheck').onclick = function () {
      if (state.answered) return;
      var builtToks = Array.prototype.map.call(ans.querySelectorAll('.gr-answer-token'), function (t) { return (t.getAttribute('data-w') || '').toLowerCase(); });
      if (!builtToks.length) return;
      state.answered = true;
      var ok = builtToks.join(' ') === toks.join(' ');
      if (ok) state.score++;
      state.answers.push({ q: q.stem, picked: naturalJoin(builtToks), correct: sentenceOf(q), ok: ok });
      var ex = (q.explain || '') + (ok ? '' : ' Correct: "' + sentenceOf(q) + '".');
      document.getElementById('grCheck').style.display = 'none';
      document.getElementById('grTail').innerHTML = footFeedback(ok, ex); wireNext();
    };
  }

  // Record this game's result (with per-question detail) to Firestore so the
  // teacher can see what was practised + which items were missed. Cross-device.
  // Wrapped so a write failure can NEVER break the game.
  function logGrammarAttempt(pct, total) {
    try {
      if (typeof db === 'undefined' || typeof auth === 'undefined' || !auth.currentUser) return;
      if (window.isDemoUser) return;                       // keep teacher analytics clean (matches vocab)
      var u = auth.currentUser;
      var doc = {
        userId: u.uid,
        userName: (u.displayName || u.email || 'Student'),
        activity: 'grammar-' + state.game,                 // grammar-choice / grammar-fill / grammar-unscramble
        skill: 'grammar',
        level: state.level || '',
        unit: (state.unit == null ? 'all' : String(state.unit)),
        score: Number(state.score || 0),
        total: Number(total || 0),
        percentage: Number(pct || 0),
        correctAnswers: Number(state.score || 0),
        totalQuestions: Number(total || 0),
        grammarDetails: (state.answers || []).slice(0, 20), // per-question detail (q / picked / correct / ok)
        assignmentId: (state.assignment && state.assignment.id) || null,
        createdAt: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
      };
      var scope = (typeof studentScopeFields === 'function') ? studentScopeFields() : null;
      if (scope) { for (var k in scope) { if (Object.prototype.hasOwnProperty.call(scope, k)) doc[k] = scope[k]; } }
      db.collection('sessions').add(doc)                   // same collection the teacher dashboard reads
        .then(function () { console.log('[grammar] session saved ->', doc.activity, doc.percentage + '%'); })
        .catch(function (e) { console.warn('[grammar] session write REJECTED:', e && e.code, e && e.message); });
    } catch (e) { console.warn('[grammar] session log failed (non-fatal):', e); }
  }

  function renderResult() {
    var b = body(); var total = state.pool.length;
    var pct = total ? Math.round(state.score / total * 100) : 0;
    recordProg(state.level, state.unit, state.game, pct);
    logGrammarAttempt(pct, total);

    var asgBanner = '';
    if (state.assignment && !state.assignment._recorded) {
      state.assignment._recorded = true;
      if (typeof markAssignmentCompleted === 'function') {
        try {
          // Pass the per-question detail (already built during play) so the
          // teacher can see which rules/items the student missed (QA #4).
          var grItems = (state.answers || []).map(function (a) {
            return { q: a.q, a: a.picked, correct: a.correct, ok: !!a.ok };
          });
          markAssignmentCompleted(state.assignment.id, 100, { skill: 'grammar', items: grItems });
        } catch (e) { console.warn('[grammar] completion failed', e); }
      }
      asgBanner = '<div class="gr-asg-banner done"><strong>✅ Assignment done!</strong><div>You practised the assigned grammar. It is now marked complete.</div></div>';
    }
    b.innerHTML = asgBanner +
      '<div class="gr-result">' +
        '<div class="gr-result-score">' + state.score + ' / ' + total + '</div>' +
        '<div class="gr-result-msg">' + esc(resultMsg(state.score, total)) + (pct >= THRESHOLD ? ' &#10003; Challenge complete!' : '') + '</div>' +
        '<div class="gr-result-actions">' +
          '<button type="button" class="gr-next" id="grAgain">Play again</button>' +
          '<button type="button" class="gr-back" id="grMap">&#8592; Back to menu</button>' +
        '</div>' +
      '</div>';
    document.getElementById('grAgain').onclick = function () { startGame(state.unit, state.game); };
    document.getElementById('grMap').onclick = renderMenu;
  }

  function resultMsg(s, t) {
    var p = t ? s / t : 0;
    if (p >= 1)   return 'Perfect.';
    if (p >= 0.7) return 'Well done.';
    if (p >= 0.4) return 'Good effort. Read the explanations and try again.';
    return 'Keep going. Read each explanation, then retry.';
  }

  function renderGrammarScreen() {
    if (!DATA) { init(); return; }
    state.assignment = null; state.level = DATA.levels[0]; state.selectedUnit = 'all';
    state.view = 'menu'; state.game = null; state.unit = null; state.pool = []; state.idx = 0; state.score = 0; state.answered = false;
    renderMenu();
  }
  window.renderGrammarScreen = renderGrammarScreen;
  window.resetGrammar = renderGrammarScreen;

  window.startGrammarAssignment = function (assignment) {
    if (!DATA) DATA = window.GRAMMAR_PRACTICE || null;
    if (!DATA || !assignment) return;
    var lvl = (assignment.level && DATA.byLevel[assignment.level]) ? assignment.level : DATA.levels[0];
    var allIds = (DATA.byLevel[lvl] || []).map(function (t) { return t.id; });
    var ids = (Array.isArray(assignment.topics) && assignment.topics.length) ? assignment.topics.filter(function (id) { return allIds.indexOf(id) !== -1; }) : allIds;
    if (!ids.length) ids = allIds;
    var qc = (typeof assignment.questionCount === 'number' && assignment.questionCount > 0) ? assignment.questionCount : null;
    state.assignment = { id: assignment.id, title: assignment.title, level: lvl, topicIds: ids, questionCount: qc, _recorded: false };
    state.level = lvl; state.view = 'menu'; state.game = null; state.unit = null; state.pool = []; state.idx = 0; state.score = 0; state.answered = false;
    if (typeof showScreen === 'function') showScreen('grammarScreen');
    renderMenu();
  };

  // If the admin's feature toggles land while the grammar menu is already open,
  // re-render so a just-deactivated game disappears (and the map reflects it).
  document.addEventListener('feature-toggles-ready', function () {
    if (DATA && state.view === 'menu' && body()) { try { renderMenu(); } catch (_) {} }
  });

  document.addEventListener('DOMContentLoaded', init);
})();
