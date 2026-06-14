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
  var THRESHOLD = 60;
  var PROG_KEY  = 'gr_prog_v1';

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
  function getProg(level, unit, game) { return loadProg()[pkey(level, unit, game)] || { best: 0, done: false }; }
  function recordProg(level, unit, game, pct) {
    var p = loadProg(), k = pkey(level, unit, game), prev = p[k] || { best: 0, done: false };
    p[k] = { best: Math.max(prev.best, pct), done: prev.done || pct >= THRESHOLD };
    saveProg(p);
  }

  // Topics in a (level, unit), optionally limited to the assignment's topics.
  function unitTopics(level, unit) {
    var asg = state.assignment;
    return (DATA.byLevel[level] || []).filter(function (t) {
      return unitOf(t) === unit && (!asg || asg.topicIds.indexOf(t.id) !== -1);
    });
  }
  function poolFor(level, unit, game) {
    var out = [];
    var unitsList = (unit === 'all') ? unitsAt(level) : [unit];
    unitsList.forEach(function (u) {
      unitTopics(level, u).forEach(function (t) {
        (t.questions || []).forEach(function (q) {
          q.ht = t.title; // grammar-point hint shown in the fill game
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
    var gamesDone = 0, gamesTotal = 0, totalQ = 0, mastered = 0, best = 0, accSum = 0, accCount = 0;
    var cards = units.map(function (u) {
      var topics = unitTopics(level, u);
      var n = topics.reduce(function (s, t) { return s + (t.questions || []).length; }, 0);
      totalQ += n;
      var doneCount = 0;
      var rows = GAMES.map(function (g) {
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
      gamesDone += doneCount; gamesTotal += GAMES.length;
      if (doneCount === GAMES.length) mastered++;
      var pct = Math.round(doneCount / GAMES.length * 100);
      var color = doneCount === GAMES.length ? '#10b981' : (pct > 0 ? '#3b82f6' : '#334155');
      var statusClass = doneCount === GAMES.length ? 'qc-complete' : (doneCount > 0 ? 'qc-active' : 'qc-new');
      var statusLabel = doneCount === GAMES.length ? '🏆 Mastered' : (doneCount > 0 ? '📖 In Progress' : '🆕 Not Started');
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
            '<div class="qc-quest-progress">' + doneCount + '/' + GAMES.length + ' games</div>' +
          '</div>' +
        '</div>' +
        '<div class="qc-challenges">' + rows + '</div>' +
      '</div>';
    }).join('');

    return { cards: cards, units: units, gamesDone: gamesDone, gamesTotal: gamesTotal, totalQ: totalQ, mastered: mastered, best: best, accuracy: accCount ? Math.round(accSum / accCount) : 0 };
  }

  // ── Menu: vocab layout (games in the centre; level/unit + map on the right) ──
  function renderMenu() {
    var b = body(); if (!b) return;
    syncGrammarHeader();
    state.view = 'menu';
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

    var xpBlock = '<div class="gr-xp"><div class="gr-xp-top">' +
      '<div class="gr-xp-pill">Level ' + glvl + ' · ' + rank + '</div>' +
      '<div class="gr-xp-num">' + xpIn + ' / 100 XP</div></div>' +
      '<div class="gr-xp-bar"><div class="gr-xp-fill" style="width:' + xpIn + '%"></div></div>' +
      '<div class="gr-xp-miles"><span class="hit">0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>';

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
      statCard('sessions', GR_SVG.pad, info.gamesDone + '/' + info.gamesTotal, 'Games') + '</div>';

    var unitLabel = state.selectedUnit === 'all' ? 'all units' : ('Unit ' + state.selectedUnit);
    var unitDesc;
    if (state.selectedUnit === 'all') { unitDesc = 'All ' + info.units.length + ' units &middot; every ' + esc(level) + ' topic.'; }
    else { var _ut = unitTopics(level, state.selectedUnit).map(function (t) { return t.title; }); unitDesc = '<strong>Unit ' + state.selectedUnit + ':</strong> ' + esc(_ut.join(', ')); }
    var gameCards = '<div class="gr-section-title"><span>🎮</span> Choose a game &middot; ' + esc(unitLabel) + '</div>' +
      '<div class="gr-unit-desc">' + unitDesc + '</div>' +
      '<div class="gr-game-grid">' + GAMES.map(function (g) {
        return '<button type="button" class="gr-game-card" data-game="' + g.id + '"><div class="gr-game-badge">' + g.icon + '</div><h3>' + esc(g.name) + '</h3><p>' + esc(g.desc) + '</p></button>';
      }).join('') + '</div>';

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
  function openMap() {
    var level = state.assignment ? state.assignment.level : state.level;
    var info = buildUnitCards(level);
    var old = document.getElementById('grMapModal'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'grMapModal'; ov.className = 'gr-map-modal';
    ov.innerHTML = '<div class="gr-map-sheet"><div class="gr-map-head"><h3>🗺️ Grammar Map &middot; ' + esc(level) + '</h3><button type="button" class="gr-map-close" id="grMapClose" aria-label="Close">&times;</button></div>' +
      '<div class="qc-grid learning-map-container">' + (info.cards || '<div class="gr-empty">No units yet.</div>') + '</div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.querySelector('#grMapClose').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };
    ov.querySelectorAll('.qc-challenge').forEach(function (el) {
      el.onclick = function () { close(); startGame(parseInt(el.getAttribute('data-unit'), 10), el.getAttribute('data-game')); };
    });
  }

  // ── Start a unit's game ────────────────────────────────────
  function startGame(unit, game) {
    var level = state.assignment ? state.assignment.level : state.level;
    var pool = poolFor(level, unit, game);
    if (!pool.length) { if (typeof AppDialog !== 'undefined') AppDialog.alert('This unit has no items for that game yet.'); return; }
    state.level = level; state.unit = unit; state.label = (unit === 'all') ? (level + ' · all units') : ('Unit ' + unit); state.game = game;
    state.pool = shuffle(pool).slice(0, 12); state.idx = 0; state.score = 0; state.answered = false; state.answers = []; state.view = 'game';
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

  function renderChoice(q) {
    var b = body();
    var opts = q.options.map(function (o, i) { return '<button type="button" class="gr-opt" data-i="' + i + '">' + esc(o) + '</button>'; }).join('');
    b.innerHTML = '<div class="gr-drill">' + gameTop() +
      '<div class="gr-q-topic">' + esc(state.label) + ' · Multiple Choice</div>' +
      '<div class="gr-stem">' + esc(q.stem) + '</div>' +
      '<div class="gr-opts">' + opts + '</div><div id="grTail"></div></div>';
    wireBack();
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
      '<div class="gr-fill-hint">Hint: <span class="gr-hint-word">' + esc(q.ht || state.label || 'Grammar') + '</span></div>' +
      '<div class="gr-drill-foot"><button type="button" class="gr-next" id="grCheck">Check</button></div><div id="grTail"></div></div>';
    wireBack();
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

  function renderUnscramble(q) {
    var b = body();
    var words = sentenceOf(q).split(/\s+/).filter(Boolean);
    var order = shuffle(words.map(function (w, i) { return i; }));
    if (words.length > 1 && order.every(function (v, i) { return v === i; })) order.reverse();
    var bank = order.map(function (origIdx, pos) { return '<button type="button" class="gr-token" data-pos="' + pos + '" data-w="' + esc(words[origIdx]) + '">' + esc(words[origIdx]) + '</button>'; }).join('');
    b.innerHTML = '<div class="gr-drill">' + gameTop() +
      '<div class="gr-q-topic">' + esc(state.label) + ' · Unscramble</div>' +
      '<div class="gr-stem" style="font-size:1em;color:var(--text-secondary,#b4b4c8);">Tap the words in the right order:</div>' +
      '<div class="gr-answer" id="grAns"><span class="gr-answer-hint">your sentence appears here</span></div>' +
      '<div class="gr-bank" id="grBank">' + bank + '</div>' +
      '<div class="gr-drill-foot"><button type="button" class="gr-next" id="grCheck">Check</button></div><div id="grTail"></div></div>';
    wireBack();
    var ans = document.getElementById('grAns');
    function refreshHint() { var hint = ans.querySelector('.gr-answer-hint'); if (hint) hint.style.display = ans.querySelector('.gr-answer-token') ? 'none' : ''; }
    document.getElementById('grBank').querySelectorAll('.gr-token').forEach(function (tok) {
      tok.onclick = function () {
        if (state.answered || tok.classList.contains('placed')) return;
        tok.classList.add('placed');
        var at = document.createElement('button');
        at.type = 'button'; at.className = 'gr-answer-token'; at.textContent = tok.getAttribute('data-w');
        at.onclick = function () { if (state.answered) return; tok.classList.remove('placed'); at.remove(); refreshHint(); };
        ans.appendChild(at); refreshHint();
      };
    });
    document.getElementById('grCheck').onclick = function () {
      if (state.answered) return;
      var built = Array.from(ans.querySelectorAll('.gr-answer-token')).map(function (t) { return t.textContent; }).join(' ');
      if (!norm(built)) return;
      state.answered = true;
      var ok = norm(built) === norm(sentenceOf(q));
      if (ok) state.score++;
      state.answers.push({ q: q.stem, picked: built, correct: sentenceOf(q), ok: ok });
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
        .then(function () { console.log('[grammar] session saved →', doc.activity, doc.percentage + '%'); })
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
    state.assignment = { id: assignment.id, title: assignment.title, level: lvl, topicIds: ids, _recorded: false };
    state.level = lvl; state.view = 'menu'; state.game = null; state.unit = null; state.pool = []; state.idx = 0; state.score = 0; state.answered = false;
    if (typeof showScreen === 'function') showScreen('grammarScreen');
    renderMenu();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
