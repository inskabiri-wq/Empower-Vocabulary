/* ============================================================
   GRAMMAR PRACTICE - content (auto-generated question banks)
   A2 follows the coursebook scope (Units 1-11) and the Azar
   "Basic English Grammar" progression.
   Each UNIT carries ~100+ varied questions, built at load time
   from grammar templates + word pools (different subjects,
   verbs, objects) so every game round feels fresh.
   Every multiple-choice question is padded to 4 options.
   B1 / B1+ / B2 are still scaffold samples (expand later).
   ============================================================ */
(function () {
  'use strict';

  // ── tiny helpers ──────────────────────────────────────────
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

  // Build one MCQ. options[answer] is guaranteed to be `correct`.
  function mk(stem, correct, distractors, explain) {
    var ds = uniq(distractors.filter(function (d) { return d !== correct; }));
    var opts = shuffle(uniq([correct].concat(ds)));
    return { stem: stem, options: opts, answer: opts.indexOf(correct), explain: explain };
  }
  // Pad every question to 4 options using the topic's own answer vocabulary
  // (keeps distractors same-family). Only tops up when a question has < 4.
  function padTo4(questions) {
    var pool = {}; questions.forEach(function (q) { q.options.forEach(function (o) { pool[o] = 1; }); });
    pool = Object.keys(pool);
    questions.forEach(function (q) {
      if (q.options.length >= 4 || pool.length < 4) return;
      var correct = q.options[q.answer], have = q.options.slice(), guard = 0;
      while (have.length < 4 && guard++ < 60) {
        var c = pool[Math.floor(Math.random() * pool.length)];
        if (have.indexOf(c) < 0) have.push(c);
      }
      q.options = shuffle(have); q.answer = q.options.indexOf(correct);
    });
  }
  // Dedupe by stem, cap to n (shuffled so the surviving set varies), pad to 4.
  function build(list, n) {
    var seen = {}, out = [];
    list = shuffle(list);
    for (var i = 0; i < list.length && out.length < n; i++) {
      var s = list[i].stem;
      if (seen[s]) continue;
      seen[s] = 1; out.push(list[i]);
    }
    padTo4(out);
    return out;
  }

  // ── subject-verb agreement ────────────────────────────────
  var PLURAL_WORDS = ['you', 'we', 'they', 'my parents', 'the students', 'my friends', 'the children',
    'tom and anna', 'the boys', 'the girls', 'my neighbours', 'the shops', 'the books', 'the cars',
    'your friends', 'the teachers', 'the workers', 'the people', 'your parents'];
  function isPlural(w) { return PLURAL_WORDS.indexOf(String(w).toLowerCase()) >= 0; }
  function beOf(w) { var lw = String(w).toLowerCase(); if (lw === 'i') return 'am'; return isPlural(w) ? 'are' : 'is'; }
  function bePastOf(w) { return isPlural(w) ? 'were' : 'was'; }
  function doOf(w) { return beOf(w) === 'is' ? 'does' : 'do'; }
  function haveOf(w) { return beOf(w) === 'is' ? 'has' : 'have'; }
  function qsubj(w) {
    var p = { 'He': 'he', 'She': 'she', 'It': 'it', 'You': 'you', 'We': 'we', 'They': 'they', 'I': 'I' };
    if (p[w]) return p[w];
    if (/^(My|The|Her|His|Their|Our|Your)\b/.test(w)) return w.charAt(0).toLowerCase() + w.slice(1); // mid-sentence: "My sister" -> "my sister"
    return w; // proper names (Tom, Anna) stay capitalised
  }
  // Lowercase a subject for mid-question position, protecting proper nouns.
  function lcFirst(s) {
    if (/^(English|Turkish|French|Penicillin)\b/.test(s)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  // ── pools ─────────────────────────────────────────────────
  var SING3 = ['He', 'She', 'Tom', 'Anna', 'My brother', 'My sister', 'The teacher', 'The doctor', 'Her father', 'The boy', 'The girl', 'My friend'];
  var BASE_SUBJ = ['I', 'You', 'We', 'They', 'My parents', 'The students', 'My friends', 'The children'];
  var SUBJ_ALL = ['I', 'You', 'We', 'They', 'He', 'She', 'Tom', 'Anna', 'My brother', 'My sister', 'The students', 'My friends', 'The teacher', 'The children'];

  // verb table: b base, s -s form, ing, ed past, pp participle, o object/complement
  var V = [
    { b: 'work', s: 'works', ing: 'working', ed: 'worked', pp: 'worked', o: 'in a bank' },
    { b: 'play', s: 'plays', ing: 'playing', ed: 'played', pp: 'played', o: 'tennis' },
    { b: 'watch', s: 'watches', ing: 'watching', ed: 'watched', pp: 'watched', o: 'TV' },
    { b: 'study', s: 'studies', ing: 'studying', ed: 'studied', pp: 'studied', o: 'English' },
    { b: 'go', s: 'goes', ing: 'going', ed: 'went', pp: 'gone', o: 'to school' },
    { b: 'eat', s: 'eats', ing: 'eating', ed: 'ate', pp: 'eaten', o: 'breakfast' },
    { b: 'read', s: 'reads', ing: 'reading', ed: 'read', pp: 'read', o: 'a book' },
    { b: 'write', s: 'writes', ing: 'writing', ed: 'wrote', pp: 'written', o: 'a letter' },
    { b: 'drink', s: 'drinks', ing: 'drinking', ed: 'drank', pp: 'drunk', o: 'coffee' },
    { b: 'speak', s: 'speaks', ing: 'speaking', ed: 'spoke', pp: 'spoken', o: 'French' },
    { b: 'live', s: 'lives', ing: 'living', ed: 'lived', pp: 'lived', o: 'in London' },
    { b: 'drive', s: 'drives', ing: 'driving', ed: 'drove', pp: 'driven', o: 'a car' },
    { b: 'open', s: 'opens', ing: 'opening', ed: 'opened', pp: 'opened', o: 'the door' },
    { b: 'clean', s: 'cleans', ing: 'cleaning', ed: 'cleaned', pp: 'cleaned', o: 'the kitchen' },
    { b: 'cook', s: 'cooks', ing: 'cooking', ed: 'cooked', pp: 'cooked', o: 'dinner' },
    { b: 'wash', s: 'washes', ing: 'washing', ed: 'washed', pp: 'washed', o: 'the dishes' },
    { b: 'finish', s: 'finishes', ing: 'finishing', ed: 'finished', pp: 'finished', o: 'the work' },
    { b: 'start', s: 'starts', ing: 'starting', ed: 'started', pp: 'started', o: 'the lesson' },
    { b: 'buy', s: 'buys', ing: 'buying', ed: 'bought', pp: 'bought', o: 'some bread' },
    { b: 'make', s: 'makes', ing: 'making', ed: 'made', pp: 'made', o: 'a cake' },
    { b: 'do', s: 'does', ing: 'doing', ed: 'did', pp: 'done', o: 'the homework' },
    { b: 'help', s: 'helps', ing: 'helping', ed: 'helped', pp: 'helped', o: 'a friend' },
    { b: 'visit', s: 'visits', ing: 'visiting', ed: 'visited', pp: 'visited', o: 'a museum' },
    { b: 'listen', s: 'listens', ing: 'listening', ed: 'listened', pp: 'listened', o: 'to music' },
    { b: 'walk', s: 'walks', ing: 'walking', ed: 'walked', pp: 'walked', o: 'to work' },
    { b: 'wait', s: 'waits', ing: 'waiting', ed: 'waited', pp: 'waited', o: 'for the bus' },
    { b: 'see', s: 'sees', ing: 'seeing', ed: 'saw', pp: 'seen', o: 'a film' },
    { b: 'take', s: 'takes', ing: 'taking', ed: 'took', pp: 'taken', o: 'the bus' },
    { b: 'give', s: 'gives', ing: 'giving', ed: 'gave', pp: 'given', o: 'a present' },
    { b: 'know', s: 'knows', ing: 'knowing', ed: 'knew', pp: 'known', o: 'the answer', stative: true }
  ];
  var VACT = V.filter(function (v) { return !v.stative; });
  var VIRR = V.filter(function (v) { return v.ed !== v.pp; });
  // Verbs that sound natural with a DURATION (for continuous tenses):
  // "has been waiting since 9am" yes, "has been opening the door" no.
  var VDUR = V.filter(function (v) { return ['work', 'play', 'watch', 'study', 'read', 'write', 'drink', 'live', 'drive', 'clean', 'cook', 'wait', 'listen'].indexOf(v.b) >= 0; });

  var ADJ = [
    { a: 'fast', c: 'faster', s: 'fastest', t: 'er' }, { a: 'tall', c: 'taller', s: 'tallest', t: 'er' },
    { a: 'cheap', c: 'cheaper', s: 'cheapest', t: 'er' }, { a: 'small', c: 'smaller', s: 'smallest', t: 'er' },
    { a: 'old', c: 'older', s: 'oldest', t: 'er' }, { a: 'young', c: 'younger', s: 'youngest', t: 'er' },
    { a: 'cold', c: 'colder', s: 'coldest', t: 'er' }, { a: 'clean', c: 'cleaner', s: 'cleanest', t: 'er' },
    { a: 'short', c: 'shorter', s: 'shortest', t: 'er' }, { a: 'long', c: 'longer', s: 'longest', t: 'er' },
    { a: 'big', c: 'bigger', s: 'biggest', t: 'double' }, { a: 'hot', c: 'hotter', s: 'hottest', t: 'double' },
    { a: 'thin', c: 'thinner', s: 'thinnest', t: 'double' }, { a: 'sad', c: 'sadder', s: 'saddest', t: 'double' },
    { a: 'happy', c: 'happier', s: 'happiest', t: 'y' }, { a: 'easy', c: 'easier', s: 'easiest', t: 'y' },
    { a: 'heavy', c: 'heavier', s: 'heaviest', t: 'y' }, { a: 'busy', c: 'busier', s: 'busiest', t: 'y' },
    { a: 'early', c: 'earlier', s: 'earliest', t: 'y' }, { a: 'dirty', c: 'dirtier', s: 'dirtiest', t: 'y' },
    { a: 'large', c: 'larger', s: 'largest', t: 'e' }, { a: 'nice', c: 'nicer', s: 'nicest', t: 'e' },
    { a: 'safe', c: 'safer', s: 'safest', t: 'e' }, { a: 'late', c: 'later', s: 'latest', t: 'e' },
    { a: 'expensive', c: 'more expensive', s: 'most expensive', t: 'long' },
    { a: 'interesting', c: 'more interesting', s: 'most interesting', t: 'long' },
    { a: 'beautiful', c: 'more beautiful', s: 'most beautiful', t: 'long' },
    { a: 'difficult', c: 'more difficult', s: 'most difficult', t: 'long' },
    { a: 'important', c: 'more important', s: 'most important', t: 'long' },
    { a: 'famous', c: 'more famous', s: 'most famous', t: 'long' },
    { a: 'modern', c: 'more modern', s: 'most modern', t: 'long' },
    { a: 'good', c: 'better', s: 'best', t: 'irr' }, { a: 'bad', c: 'worse', s: 'worst', t: 'irr' },
    { a: 'far', c: 'further', s: 'furthest', t: 'irr' }
  ];

  // ── generators (each MCQ aims for 4 options) ──────────────

  // ── VALIDATED generators (typed pools + lint = VOLUME without wrong English) ──
  // The OLD generators produced wrong carriers ("We are a teacher") because their
  // pools were untyped. Here pools are TYPED: plural subjects only get plural
  // nouns, singular only singular, "I" only "am", etc. So agreement is always
  // correct. Every question carries a `hint`, and lintQ drops any structurally
  // bad item. Assembly caps each topic at ~104. PILOT: a2-be only for now.
  function lintQ(q) {
    if (!q || typeof q.stem !== 'string') return false;
    if ((q.stem.match(/_{2,}/g) || []).length !== 1) return false;
    if (!Array.isArray(q.options) || q.options.length !== 4) return false;
    if (new Set(q.options).size !== 4) return false;
    if (q.answer < 0 || q.answer >= 4 || q.options[q.answer] == null) return false;
    return true;
  }
  function buildValidated(list, n) { return build(list.filter(lintQ), n); }
  function withHint(q, hint) { q.hint = hint; return q; }

  // Adjective -> [comparative, superlative, NOUNS it can sensibly describe].
  // Pairing each adjective only with compatible nouns prevents silly carriers
  // like "this exam is happier" or "the fastest film".
  var ADJN = [
    ['big', 'bigger', 'the biggest', ['house', 'car', 'city', 'room', 'garden']],
    ['small', 'smaller', 'the smallest', ['flat', 'car', 'room', 'box', 'phone']],
    ['fast', 'faster', 'the fastest', ['car', 'train', 'runner', 'computer', 'plane']],
    ['slow', 'slower', 'the slowest', ['car', 'train', 'computer', 'lift', 'bus']],
    ['cheap', 'cheaper', 'the cheapest', ['phone', 'ticket', 'hotel', 'meal', 'flight']],
    ['expensive', 'more expensive', 'the most expensive', ['phone', 'watch', 'hotel', 'meal', 'car']],
    ['old', 'older', 'the oldest', ['building', 'car', 'tree', 'town', 'bridge']],
    ['young', 'younger', 'the youngest', ['student', 'player', 'child', 'brother', 'team']],
    ['happy', 'happier', 'the happiest', ['child', 'student', 'family', 'team', 'customer']],
    ['easy', 'easier', 'the easiest', ['exam', 'question', 'task', 'lesson', 'recipe']],
    ['difficult', 'more difficult', 'the most difficult', ['exam', 'question', 'task', 'course', 'job']],
    ['tall', 'taller', 'the tallest', ['building', 'tree', 'tower', 'player', 'man']],
    ['hot', 'hotter', 'the hottest', ['day', 'soup', 'country', 'summer', 'curry']],
    ['cold', 'colder', 'the coldest', ['day', 'water', 'winter', 'room', 'drink']],
    ['interesting', 'more interesting', 'the most interesting', ['book', 'film', 'story', 'lesson', 'talk']],
    ['comfortable', 'more comfortable', 'the most comfortable', ['chair', 'bed', 'sofa', 'seat', 'hotel']],
    ['important', 'more important', 'the most important', ['meeting', 'decision', 'message', 'exam', 'rule']],
    ['heavy', 'heavier', 'the heaviest', ['box', 'bag', 'suitcase', 'table', 'rock']],
    ['safe', 'safer', 'the safest', ['car', 'city', 'area', 'route', 'neighbourhood']],
    ['popular', 'more popular', 'the most popular', ['singer', 'film', 'sport', 'app', 'dish']],
    ['dangerous', 'more dangerous', 'the most dangerous', ['sport', 'road', 'animal', 'job', 'area']],
    ['good', 'better', 'the best', ['idea', 'plan', 'film', 'restaurant', 'team']],
    ['bad', 'worse', 'the worst', ['weather', 'traffic', 'film', 'result', 'day']]
  ];
  function compDist(a) {
    if (a[1].indexOf('more ') === 0) return [a[0], a[0] + 'r', 'most ' + a[0]];
    if (a[0] === 'good') return ['good', 'gooder', 'best'];
    if (a[0] === 'bad') return ['bad', 'badder', 'worst'];
    return [a[0], 'more ' + a[0], 'most ' + a[0]];
  }
  function supDist(a) {
    if (a[2].indexOf('the most ') === 0) { var b = a[2].replace('the most ', ''); return ['the ' + b, 'the ' + a[1], 'most ' + b]; }
    if (a[0] === 'good') return ['the goodest', 'the better', 'the most good'];
    if (a[0] === 'bad') return ['the baddest', 'the worse', 'the most bad'];
    return ['the most ' + a[0], 'the ' + a[1], 'most ' + a[0]];
  }

  var VALID = {
    'a2-be': function () {
      var out = [];
      var ADJ = ['tired', 'happy', 'busy', 'ready', 'late', 'hungry', 'here', 'at home', 'from Italy', 'at school', 'in the garden', 'very young', 'really kind', 'at work', 'from Spain', 'cold', 'angry', 'afraid'];
      var SNOUN = ['a teacher', 'a student', 'a doctor', 'an engineer', 'a nurse', 'a good friend', 'a singer', 'a driver', 'a tourist'];
      var PNOUN = ['teachers', 'students', 'doctors', 'engineers', 'nurses', 'good friends', 'singers', 'drivers', 'tourists'];
      var SING = ['She', 'He', 'My brother', 'My sister', 'Tom', 'Anna', 'My cousin', 'My father', 'My mother', 'My friend', 'My neighbour'];
      var PLUR = ['They', 'We', 'You', 'My parents', 'The students', 'My friends', 'The women', 'Tom and Anna'];
      var H = 'Match the verb to the subject: I, one person or thing, or more than one?';
      function be(subj, comp, ans, ex) {
        out.push(withHint(mk(subj + ' ____ ' + comp + '.', ans, ['am', 'is', 'are', 'be'].filter(function (x) { return x !== ans; }), ex), H));
      }
      ADJ.concat(SNOUN).forEach(function (c) { be('I', c, 'am', 'I -> am.'); });
      SING.forEach(function (s) { ADJ.concat(SNOUN).forEach(function (c) { be(s, c, 'is', 'he/she/it -> is.'); }); });
      PLUR.forEach(function (s) { ADJ.concat(PNOUN).forEach(function (c) { if (s.indexOf(c) !== -1) return; be(s, c, 'are', 'you/we/they -> are.'); }); });
      return out;
    },

    'a2-be-questions': function () {
      var out = [], H = 'A question: which form matches the subject that comes right after the gap?';
      var ADJ = ['ready', 'tired', 'happy', 'busy', 'late', 'hungry', 'at home', 'at school', 'from Italy', 'here', 'angry', 'cold', 'at work', 'afraid'];
      var SN = ['a doctor', 'a student', 'a teacher', 'a nurse', 'a tourist', 'an engineer'];
      var PN = ['doctors', 'students', 'teachers', 'nurses', 'tourists', 'engineers'];
      var SQ = ['she', 'he', 'Tom', 'Anna', 'your brother', 'your cousin', 'your father', 'your sister', 'your friend'];
      var PQ = ['they', 'we', 'you', 'your friends', 'the students', 'your parents'];
      function q(subj, comp, ans, ex) { out.push(withHint(mk('____ ' + subj + ' ' + comp + '?', ans, ['Am', 'Is', 'Are', 'Be'].filter(function (x) { return x !== ans; }), ex), H)); }
      ADJ.concat(SN).forEach(function (c) { SQ.forEach(function (s) { q(s, c, 'Is', 'he/she/it -> Is.'); }); });
      ADJ.concat(PN).forEach(function (c) { PQ.forEach(function (s) { if (s.indexOf(c) !== -1) return; q(s, c, 'Are', 'you/we/they -> Are.'); }); });
      ADJ.concat(SN).forEach(function (c) { q('I', c, 'Am', 'I -> Am.'); });
      return out;
    },

    'a2-was-were': function () {
      var out = [], H = 'This happened in the past. One person or thing, or more than one?';
      // Sensible (complement, time) pairs: a transient state (tired/ill) takes a
      // short anchor; a place/event can take a longer one. Avoids "ill last year".
      var COMBO = [
        ['tired', 'last night'], ['happy', 'yesterday'], ['busy', 'earlier today'], ['ill', 'last week'],
        ['angry', 'a moment ago'], ['late', 'earlier today'], ['hungry', 'an hour ago'], ['nervous', 'before the exam'],
        ['at home', 'yesterday'], ['at school', 'last week'], ['on holiday', 'last year'], ['in London', 'last summer'],
        ['at the party', 'last night'], ['abroad', 'last year'], ['at the cinema', 'yesterday'], ['here', 'a moment ago']];
      var SING = ['She', 'He', 'My brother', 'Tom', 'Anna', 'The teacher', 'My sister', 'My friend', 'I'];
      var PLUR = ['They', 'We', 'You', 'My parents', 'The students', 'My friends'];
      SING.forEach(function (s) { COMBO.forEach(function (c) { out.push(withHint(mk(s + ' ____ ' + c[0] + ' ' + c[1] + '.', 'was', ['were', 'is', 'are'], s === 'I' ? 'I -> was.' : 'he/she/it -> was.'), H)); }); });
      PLUR.forEach(function (s) { COMBO.forEach(function (c) { out.push(withHint(mk(s + ' ____ ' + c[0] + ' ' + c[1] + '.', 'were', ['was', 'is', 'are'], 'you/we/they -> were.'), H)); }); });
      return out;
    },

    'a2-there-is-are': function () {
      var out = [], H = 'Look at the noun after the gap: one thing, or more than one?';
      // Each noun group only goes with places that make sense for it, so we never
      // get "some people in the box" or "a clock in the garden".
      var SMALL = ['on the table', 'in the box', 'on the floor', 'in the drawer', 'on the shelf'];
      var INSIDE = ['in the room', 'in the kitchen', 'near the door', 'by the window'];
      var AROUND = ['in the room', 'in the garden', 'near the door', 'in the kitchen', 'outside'];
      var OBJ = [['a book', 'three books'], ['a pen', 'six pens'], ['a key', 'a few keys'], ['a phone', 'two phones'], ['a cup', 'some cups'], ['a clock', 'two clocks']];
      var FURN = [['a chair', 'two chairs'], ['a table', 'two tables'], ['a sofa', 'three sofas'], ['a plant', 'some plants']];
      var LIVE = [['a cat', 'some cats'], ['a dog', 'two dogs'], ['a boy', 'two boys'], ['a child', 'some children']];
      function isThere(n, p) {
        out.push(withHint(mk('____ ' + n[0] + ' ' + p + '.', 'There is', ['There are', 'It is', 'There be'], 'singular noun -> there is.'), H));
        out.push(withHint(mk('____ ' + n[1] + ' ' + p + '.', 'There are', ['There is', 'They are', 'There be'], 'plural noun -> there are.'), H));
      }
      OBJ.forEach(function (n) { SMALL.forEach(function (p) { isThere(n, p); }); });
      FURN.forEach(function (n) { INSIDE.forEach(function (p) { isThere(n, p); }); });
      LIVE.forEach(function (n) { AROUND.forEach(function (p) { isThere(n, p); }); });
      return out;
    },

    'a2-a-an': function () {
      var out = [], H = 'Say the next word out loud: what SOUND does it start with?';
      var A_N = ['car', 'book', 'dog', 'table', 'pen', 'banana', 'phone', 'cat', 'house', 'bag', 'sandwich', 'cup', 'window', 'ticket', 'big dog', 'new car', 'good camera'];
      var AN_N = ['apple', 'orange', 'egg', 'umbrella', 'animal', 'old car', 'open window', 'empty box', 'onion', 'ice cream', 'electric car', 'English book', 'old phone', 'expensive camera'];
      var T = ['It is ____ %.', 'That is ____ %.', 'This is ____ %.', 'I can see ____ %.'];
      A_N.forEach(function (n) { T.forEach(function (t) { out.push(withHint(mk(t.replace('%', n), 'a', ['an', 'every', 'each'], 'consonant sound -> a.'), H)); }); });
      AN_N.forEach(function (n) { T.forEach(function (t) { out.push(withHint(mk(t.replace('%', n), 'an', ['a', 'every', 'each'], 'vowel sound -> an.'), H)); }); });
      return out;
    },

    'a2-present-simple': function () {
      var out = [], H = 'Who does the action? Match the verb ending to the subject.';
      // [3rd-singular, base, -ing, object]  (vetted, no runtime conjugation)
      var V = [['goes', 'go', 'going', 'to work'], ['lives', 'live', 'living', 'in London'], ['plays', 'play', 'playing', 'tennis'],
        ['watches', 'watch', 'watching', 'TV'], ['studies', 'study', 'studying', 'English'], ['works', 'work', 'working', 'in an office'],
        ['reads', 'read', 'reading', 'the news'], ['drinks', 'drink', 'drinking', 'coffee'], ['speaks', 'speak', 'speaking', 'French'],
        ['starts', 'start', 'starting', 'at nine'], ['teaches', 'teach', 'teaching', 'maths'], ['drives', 'drive', 'driving', 'a taxi'],
        ['cooks', 'cook', 'cooking', 'dinner'], ['walks', 'walk', 'walking', 'to school'], ['likes', 'like', 'liking', 'music']];
      var SING = ['She', 'He', 'My brother', 'Tom', 'Anna', 'The teacher', 'My sister', 'My father'];
      var PLUR = ['I', 'You', 'We', 'They', 'My parents', 'My friends', 'The students'];
      V.forEach(function (v) {
        SING.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v[3] + '.', v[0], [v[1], v[2], 'to ' + v[1]], 'he/she/it adds -s.'), H)); });
        PLUR.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v[3] + '.', v[1], [v[0], v[2], 'to ' + v[1]], 'I/you/we/they use the base verb.'), H)); });
      });
      return out;
    },

    'a2-past-simple': function () {
      var out = [], H = 'Find the time word: when did it happen? Careful, this verb may not follow the usual pattern.';
      // [past, base, -ing, wrong-regular, object]
      var V = [['went', 'go', 'going', 'goed', 'to Ankara'], ['played', 'play', 'playing', 'plaid', 'tennis'],
        ['ate', 'eat', 'eating', 'eated', 'a sandwich'], ['watched', 'watch', 'watching', 'wached', 'a film'],
        ['bought', 'buy', 'buying', 'buyed', 'a car'], ['saw', 'see', 'seeing', 'seed', 'a bird'],
        ['made', 'make', 'making', 'maked', 'a cake'], ['took', 'take', 'taking', 'taked', 'a photo'],
        ['wrote', 'write', 'writing', 'writed', 'a letter'], ['drank', 'drink', 'drinking', 'drinked', 'some water'],
        ['gave', 'give', 'giving', 'gived', 'a present'], ['found', 'find', 'finding', 'finded', 'a key'],
        ['left', 'leave', 'leaving', 'leaved', 'early'], ['met', 'meet', 'meeting', 'meeted', 'a friend'],
        ['cooked', 'cook', 'cooking', 'cookd', 'dinner'], ['visited', 'visit', 'visiting', 'visitted', 'a museum']];
      var SUBJ = ['She', 'He', 'They', 'We', 'I', 'My brother', 'Tom', 'My friends'];
      V.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v[4] + ' yesterday.', v[0], [v[1], v[2], v[3]], 'past simple of "' + v[1] + '" is "' + v[0] + '".'), H)); }); });
      return out;
    },

    'a2-plurals': function () {
      var out = [], H = 'How many are there? Careful: this noun may not follow the usual pattern.';
      // [singular, plural, [two wrong forms]] - the singular goes in the STEM so
      // each carrier is unique (the plural is the blank).
      var N = [['box', 'boxes', ['boxs', 'boxies']], ['knife', 'knives', ['knifes', 'knifs']], ['child', 'children', ['childs', 'childrens']],
        ['tomato', 'tomatoes', ['tomatos', 'tomatoe']], ['baby', 'babies', ['babys', 'babyes']], ['city', 'cities', ['citys', 'cityes']],
        ['man', 'men', ['mans', 'mens']], ['woman', 'women', ['womans', 'womens']], ['foot', 'feet', ['foots', 'feets']],
        ['tooth', 'teeth', ['tooths', 'toothes']], ['leaf', 'leaves', ['leafs', 'leafes']], ['person', 'people', ['persons', 'peoples']],
        ['bus', 'buses', ['buss', 'busies']], ['dish', 'dishes', ['dishs', 'dishies']], ['watch', 'watches', ['watchs', 'watchies']],
        ['party', 'parties', ['partys', 'partyes']], ['potato', 'potatoes', ['potatos', 'potatoe']], ['glass', 'glasses', ['glasss', 'glassies']]];
      var T = ['One %s, two ____.', 'I can see one %s and several ____.', 'Is it one %s or two ____?', 'First one %s, then many ____.', 'Count them: one %s and lots of ____.', 'There is one %s here and other ____ there.'];
      N.forEach(function (n) { T.forEach(function (t) { out.push(withHint(mk(t.replace('%s', n[0]), n[1], [n[2][0], n[2][1], n[0]], 'the plural of "' + n[0] + '" is "' + n[1] + '".'), H)); }); });
      return out;
    },

    'a2-possessives': function () {
      var out = [], H = "Who does it belong to? Match the owner shown in the brackets.";
      var NOUN = ['book', 'car', 'bag', 'house', 'pen', 'phone', 'jacket', 'dog'];
      var PA = [['I', 'my'], ['you', 'your'], ['he', 'his'], ['she', 'her'], ['we', 'our'], ['they', 'their']];
      function others(ans) { return ['my', 'your', 'his', 'her', 'our', 'their'].filter(function (x) { return x !== ans; }).slice(0, 3); }
      PA.forEach(function (p) { NOUN.forEach(function (n) { out.push(withHint(mk('This is ____ ' + n + '. (' + p[0] + ')', p[1], others(p[1]), p[0] + ' -> ' + p[1] + '.'), H)); }); });
      var NAMES = ['Tom', 'Anna', 'John', 'Maria', 'my sister', 'the teacher'];
      NAMES.forEach(function (nm) { NOUN.forEach(function (n) { out.push(withHint(mk('This is ____ ' + n + '. (' + nm + ')', nm + "'s", [nm + 's', nm, 'of ' + nm], "add 's to a name to show possession."), H)); }); });
      return out;
    },

    'a2-present-simple-q': function () {
      var out = [], H = 'Look at who the question asks about, then pick the matching helper.';
      var VO = ['like coffee', 'play tennis', 'speak English', 'live near here', 'work hard', 'go to school', 'watch TV', 'eat meat', 'study at home', 'drink tea'];
      var SQ = ['she', 'he', 'Tom', 'your brother', 'the teacher', 'your sister'];
      var PQ = ['they', 'we', 'you', 'your friends', 'your parents', 'the students'];
      VO.forEach(function (v) {
        SQ.forEach(function (s) { out.push(withHint(mk('____ ' + s + ' ' + v + '?', 'Does', ['Do', 'Is', 'Are'], 'he/she/it question: Does + base verb.'), H)); });
        PQ.forEach(function (s) { out.push(withHint(mk('____ ' + s + ' ' + v + '?', 'Do', ['Does', 'Is', 'Are'], 'you/we/they question: Do + base verb.'), H)); });
      });
      return out;
    },

    'a2-have-got': function () {
      var out = [], H = 'Match the helper to the subject: one person or thing, or more than one?';
      var OBJ = ['a new phone', 'two sisters', 'a car', 'a big house', 'a dog', 'a bike', 'long hair', 'a good job', 'a brother', 'a cat'];
      var SING = ['She', 'He', 'My brother', 'Tom', 'My sister', 'The teacher'];
      var PLUR = ['I', 'You', 'We', 'They', 'My parents', 'My friends'];
      SING.forEach(function (s) { OBJ.forEach(function (o) { out.push(withHint(mk(s + ' ____ ' + o + '.', 'has got', ['have got', 'got', 'has'], 'he/she/it -> has got.'), H)); }); });
      PLUR.forEach(function (s) { OBJ.forEach(function (o) { out.push(withHint(mk(s + ' ____ ' + o + '.', 'have got', ['has got', 'got', 'have'], 'I/you/we/they -> have got.'), H)); }); });
      return out;
    },

    'a2-some-any': function () {
      var out = [], H = 'Read the whole sentence: positive, negative, or a question? That decides it.';
      var UNC = ['milk', 'water', 'bread', 'money', 'sugar', 'rice', 'cheese', 'coffee', 'time', 'juice'];
      var CNT = ['apples', 'books', 'eggs', 'lemons', 'pens', 'chairs', 'oranges', 'biscuits', 'stamps', 'tomatoes'];
      UNC.forEach(function (n) {
        out.push(withHint(mk('We have ____ ' + n + '.', 'some', ['any', 'a', 'the'], 'some in positive sentences.'), H));
        out.push(withHint(mk('Is there ____ ' + n + '?', 'any', ['some', 'a', 'the'], 'any in questions.'), H));
        out.push(withHint(mk("There isn't ____ " + n + '.', 'any', ['some', 'a', 'the'], 'any in negatives.'), H));
      });
      CNT.forEach(function (n) {
        out.push(withHint(mk('We have ____ ' + n + '.', 'some', ['any', 'a', 'the'], 'some in positive sentences.'), H));
        out.push(withHint(mk('Are there ____ ' + n + '?', 'any', ['some', 'a', 'the'], 'any in questions.'), H));
        out.push(withHint(mk("We don't have ____ " + n + '.', 'any', ['some', 'a', 'the'], 'any in negatives.'), H));
      });
      return out;
    },

    'a2-much-many': function () {
      var out = [], H = 'Look at the noun after the gap: can you count it, one by one?';
      var UNC = ['water', 'money', 'time', 'sugar', 'rice', 'milk', 'bread', 'homework', 'traffic', 'coffee'];
      var CNT = ['books', 'people', 'friends', 'cars', 'apples', 'students', 'chairs', 'eggs', 'questions', 'shops'];
      UNC.forEach(function (n) {
        out.push(withHint(mk('How ____ ' + n + ' is there?', 'much', ['many', 'a few', 'lots'], 'much + uncountable.'), H));
        out.push(withHint(mk("There isn't ____ " + n + '.', 'much', ['many', 'a few', 'lots'], 'much + uncountable (negative).'), H));
        out.push(withHint(mk('Is there ____ ' + n + '?', 'much', ['many', 'a few', 'lots'], 'much + uncountable.'), H));
      });
      CNT.forEach(function (n) {
        out.push(withHint(mk('How ____ ' + n + ' are there?', 'many', ['much', 'a little', 'lots'], 'many + countable plural.'), H));
        out.push(withHint(mk("There aren't ____ " + n + '.', 'many', ['much', 'a little', 'lots'], 'many + countable plural.'), H));
        out.push(withHint(mk('Are there ____ ' + n + '?', 'many', ['much', 'a little', 'lots'], 'many + countable plural.'), H));
      });
      return out;
    },

    'a2-like-ing': function () {
      var out = [], H = 'Look at the verb before the gap: which form usually follows a liking or hating verb?';
      var ING = [['listening', 'listen', 'to music'], ['playing', 'play', 'football'], ['cooking', 'cook', 'dinner'],
        ['reading', 'read', 'books'], ['swimming', 'swim', 'in the sea'], ['watching', 'watch', 'films'],
        ['dancing', 'dance', 'at parties'], ['shopping', 'shop', 'at weekends'], ['running', 'run', 'in the park'], ['painting', 'paint', 'pictures']];
      var SING = [['She', 'likes'], ['He', 'loves'], ['Tom', 'hates'], ['My sister', 'enjoys']];
      var PLUR = [['I', 'like'], ['You', 'love'], ['We', 'hate'], ['They', 'enjoy']];
      function row(subj, verb, g) { out.push(withHint(mk(subj + ' ' + verb + ' ____ ' + g[2] + '.', g[0], [g[1], 'to ' + g[1], g[1] + 's'], verb + ' + -ing.'), H)); }
      SING.forEach(function (sv) { ING.forEach(function (g) { row(sv[0], sv[1], g); }); });
      PLUR.forEach(function (sv) { ING.forEach(function (g) { row(sv[0], sv[1], g); }); });
      return out;
    },

    'a2-past-simple-q': function () {
      var out = [], H = 'The helper word already shows the past time. What happens to the main verb after it?';
      var VO = ['see the match', 'finish the work', 'go home early', 'eat breakfast', 'buy a ticket', 'call you', 'visit them', 'watch the film', 'clean the room', 'pass the exam'];
      var SQ = ['she', 'he', 'they', 'we', 'you', 'Tom', 'your brother', 'the students'];
      var SN = ['She', 'He', 'They', 'We', 'Tom', 'My friends', 'I', 'You'];
      VO.forEach(function (v) { SQ.forEach(function (s) { out.push(withHint(mk('____ ' + s + ' ' + v + '?', 'Did', ['Do', 'Does', 'Was'], 'past question: Did + base verb.'), H)); }); });
      VO.forEach(function (v) { SN.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v + '.', "didn't", ["doesn't", "wasn't", "don't"], 'past negative: did not + base verb.'), H)); }); });
      return out;
    },

    'a2-can-could': function () {
      var out = [], H = 'Look at the word right before the gap: what verb form has to follow a word like that?';
      var V = ['swim', 'drive', 'cook', 'sing', 'dance', 'play the piano', 'speak French', 'ride a bike', 'run fast', 'ski'];
      var SUBJ = ['I', 'She', 'He', 'We', 'They', 'Tom', 'My sister', 'You'];
      V.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v + ' very well.', 'can', ['could to', 'cans', 'to can'], 'can + base verb (present ability).'), H)); }); });
      V.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v + ' years ago.', 'could', ['can', 'cans', 'could to'], 'could for past ability.'), H)); }); });
      V.forEach(function (v) { out.push(withHint(mk('____ you ' + v + ' with me?', 'Can', ['Do', 'Are', 'Should to'], 'Can for requests and offers.'), H)); });
      return out;
    },

    'a2-have-to': function () {
      var out = [], H = 'Who has the obligation? Match the helper to the subject.';
      var V = ['wake up early', 'wear a uniform', 'study tonight', 'work on Saturday', 'finish the report', 'pay the bill', 'take an exam', 'clean the room', 'call the doctor', 'catch the bus'];
      var SING = ['She', 'He', 'Tom', 'My brother', 'The student'];
      var PLUR = ['I', 'You', 'We', 'They', 'My parents'];
      V.forEach(function (v) {
        SING.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v + '.', 'has to', ['have to', 'haves to', 'to have'], 'he/she/it: has to.'), H)); });
        PLUR.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v + '.', 'have to', ['has to', 'to have', 'having to'], 'I/you/we/they: have to.'), H)); });
      });
      return out;
    },

    'a2-present-continuous': function () {
      var out = [], H = 'Find the time signal (now, Look!): the action happens as we speak. Match it to the subject.';
      var V = [['reading', 'read', 'a book'], ['playing', 'play', 'football'], ['cooking', 'cook', 'dinner'], ['watching', 'watch', 'TV'],
        ['writing', 'write', 'a letter'], ['eating', 'eat', 'lunch'], ['studying', 'study', 'English'], ['listening', 'listen', 'to music'],
        ['cleaning', 'clean', 'the room'], ['drinking', 'drink', 'coffee']];
      var SING = ['She', 'He', 'Tom', 'My sister'];
      var PLUR = ['They', 'We', 'You', 'My friends'];
      V.forEach(function (g) {
        SING.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + g[2] + ' now.', 'is ' + g[0], [g[1] + 's', g[1], 'is ' + g[1]], 'he/she/it: is + verb-ing.'), H)); });
        PLUR.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + g[2] + ' now.', 'are ' + g[0], [g[1] + 's', g[1], 'is ' + g[0]], 'you/we/they: are + verb-ing.'), H)); });
        out.push(withHint(mk('I ____ ' + g[2] + ' now.', 'am ' + g[0], [g[1] + 's', g[1], 'am ' + g[1]], 'I: am + verb-ing.'), H));
      });
      return out;
    },

    'a2-present-perfect': function () {
      var out = [], H = 'Words like "just", "never" and "ever" point to experience up to now. Which option shows that?';
      var PP = ['finished the work', 'eaten lunch', 'seen that film', 'lost the keys', 'just arrived', 'already left', 'done the homework', 'been to Paris', 'broken a window', 'found the answer'];
      var SING = ['She', 'He', 'Tom', 'My brother', 'The teacher'];
      var PLUR = ['I', 'You', 'We', 'They', 'My friends'];
      PP.forEach(function (p) {
        SING.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + p + '.', 'has', ['have', 'is', 'did'], 'he/she/it: has + past participle.'), H)); });
        PLUR.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + p + '.', 'have', ['has', 'are', 'did'], 'I/you/we/they: have + past participle.'), H)); });
      });
      return out;
    },

    'a2-question-words': function () {
      var out = [], H = 'Read the answer part of the exchange: a thing, a place, a time, a person, a reason, or a way?';
      function qw(stem, ans, ex) { out.push(withHint(mk(stem, ans, ['What', 'Where', 'When', 'Who', 'Why', 'How'].filter(function (x) { return x !== ans; }).slice(0, 3), ex), H)); }
      ['name', 'job', 'address', 'phone number', 'favourite colour', 'surname', 'nationality', 'hobby', 'favourite food', 'plan'].forEach(function (x) { qw('____ is your ' + x + '?', 'What', 'asks about a thing.'); });
      ['bank', 'station', 'hospital', 'library', 'school', 'post office', 'bus stop', 'supermarket', 'cinema', 'pharmacy'].forEach(function (x) { qw('____ is the ' + x + '?', 'Where', 'asks about a place.'); });
      ['film', 'class', 'match', 'party', 'meeting', 'train', 'lesson', 'concert', 'exam', 'show'].forEach(function (x) { qw('____ does the ' + x + ' start?', 'When', 'asks about a time.'); });
      ['woman', 'man', 'boy', 'girl', 'teacher', 'singer', 'actor', 'doctor', 'player', 'writer'].forEach(function (x) { qw('____ is that ' + x + '?', 'Who', 'asks about a person.'); });
      ['sad', 'late', 'tired', 'angry', 'happy', 'busy', 'worried', 'nervous', 'here', 'quiet'].forEach(function (x) { qw('____ are you ' + x + '?', 'Why', 'asks for a reason.'); });
      ['____ old are you?', '____ do you go to work?', '____ far is the school?', '____ much is this?', '____ are you today?', '____ many books do you have?'].forEach(function (s) { qw(s, 'How', 'asks about manner or degree.'); });
      return out;
    },

    'a2-adv-frequency': function () {
      var out = [], H = 'Where does a word like "always" sit? It depends on which kind of verb the sentence has.';
      var ADV = ['always', 'usually', 'often', 'sometimes', 'rarely', 'never'];
      var V = [['drinks', 'drink', 'coffee'], ['eats', 'eat', 'meat'], ['plays', 'play', 'tennis'], ['watches', 'watch', 'TV'], ['reads', 'read', 'books'], ['walks', 'walk', 'to school']];
      var SUBJ = ['She', 'He', 'Tom', 'My sister'];
      V.forEach(function (g) { SUBJ.forEach(function (s) { ADV.forEach(function (a) { out.push(withHint(mk(s + ' ____ ' + g[2] + '.', a + ' ' + g[0], [g[0] + ' ' + a, a + ' ' + g[1], g[1] + ' ' + a], 'adverb before the main verb; he/she/it adds -s.'), H)); }); }); });
      var ADJ = ['late', 'tired', 'happy', 'busy', 'here'];
      ['He', 'She', 'Tom', 'My sister'].forEach(function (s) { ADJ.forEach(function (c) { ['always', 'usually', 'often', 'never', 'rarely'].forEach(function (a) { out.push(withHint(mk(s + ' ____ ' + c + '.', 'is ' + a, [a + ' is', 'are ' + a, a], 'with "be", the adverb goes after it (is always late).'), H)); }); }); });
      return out;
    },

    'a2-simple-vs-continuous': function () {
      var out = [], H = 'Find the time expression: a routine (every day, usually) or happening as we speak (now, Look!)?';
      var V = [['walks', 'walk', 'is walking', 'to work'], ['has', 'have', 'is having', 'breakfast'], ['plays', 'play', 'is playing', 'tennis'], ['reads', 'read', 'is reading', 'a book'],
        ['watches', 'watch', 'is watching', 'TV'], ['drinks', 'drink', 'is drinking', 'coffee'], ['studies', 'study', 'is studying', 'English'], ['cooks', 'cook', 'is cooking', 'dinner']];
      var SING = ['She', 'He', 'Tom', 'My sister'];
      V.forEach(function (g) {
        SING.forEach(function (s) {
          out.push(withHint(mk(s + ' ____ ' + g[3] + ' every day.', g[0], [g[2], g[1], 'is ' + g[1]], 'routine (every day) -> present simple.'), H));
          out.push(withHint(mk('Look! ' + s + ' ____ ' + g[3] + ' now.', g[2], [g[0], g[1], 'is ' + g[1]], 'now (Look!) -> present continuous.'), H));
          out.push(withHint(mk(s + ' usually ____ ' + g[3] + '.', g[0], [g[2], g[1], 'is ' + g[1]], 'usually -> present simple.'), H));
          out.push(withHint(mk(s + ' ____ ' + g[3] + ' at the moment.', g[2], [g[0], g[1], 'is ' + g[1]], 'at the moment -> present continuous.'), H));
        });
      });
      return out;
    },

    'a2-comparatives': function () {
      var out = [], H = 'Two things are compared. Count the syllables of the adjective before you choose.';
      ADJN.forEach(function (a) { a[3].forEach(function (n) { out.push(withHint(mk('This ' + n + ' is ____ than that one. (' + a[0] + ')', a[1], compDist(a), 'the comparative of "' + a[0] + '".'), H)); }); });
      return out;
    },

    'a2-superlatives': function () {
      var out = [], H = 'One thing beats ALL the others here. Count the syllables of the adjective before you choose.';
      ADJN.forEach(function (a) { a[3].forEach(function (n) { out.push(withHint(mk('It is ____ ' + n + ' here. (' + a[0] + ')', a[2], supDist(a), 'the superlative of "' + a[0] + '".'), H)); }); });
      return out;
    },

    'a2-pp-vs-past': function () {
      var out = [], H = 'Find the time signal: a finished time (yesterday, ago) or experience up to now (ever, never, just, before)?';
      var V = [['saw', 'see', 'seen', 'a film'], ['went', 'go', 'gone', 'to London'], ['ate', 'eat', 'eaten', 'sushi'], ['did', 'do', 'done', 'the work'],
        ['wrote', 'write', 'written', 'a letter'], ['took', 'take', 'taken', 'photos'], ['met', 'meet', 'met', 'her'], ['bought', 'buy', 'bought', 'a car']];
      var SUBJ = ['I', 'She', 'He', 'We', 'They', 'Tom'];
      V.forEach(function (g) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + g[3] + ' yesterday.', g[0], [g[1], 'have ' + g[2], 'did ' + g[1]], 'finished time (yesterday) -> past simple.'), H)); }); });
      V.forEach(function (g) {
        out.push(withHint(mk('I have ____ ' + g[3] + ' before.', g[2], [g[1], 'to ' + g[1], g[1] + 's'], 'experience (before) -> present perfect: have + past participle.'), H));
        out.push(withHint(mk('She has never ____ ' + g[3] + '.', g[2], [g[1], 'to ' + g[1], g[1] + 's'], 'never -> present perfect: has + past participle.'), H));
        out.push(withHint(mk('We have just ____ ' + g[3] + '.', g[2], [g[1], 'to ' + g[1], g[1] + 's'], 'just -> present perfect.'), H));
        out.push(withHint(mk('They have already ____ ' + g[3] + '.', g[2], [g[1], 'to ' + g[1], g[1] + 's'], 'already -> present perfect.'), H));
      });
      return out;
    },

    'b1-present-cont': function () {
      var out = [], H = 'A fact or routine, or something happening right now? Find the word in the sentence that tells you.';
      var V = [['works', 'work', 'is working', 'in a bank'], ['goes', 'go', 'is going', 'to the gym'], ['speaks', 'speak', 'is speaking', 'to a client'], ['plays', 'play', 'is playing', 'the guitar'],
        ['studies', 'study', 'is studying', 'for an exam'], ['lives', 'live', 'is living', 'with friends'], ['drinks', 'drink', 'is drinking', 'coffee'], ['watches', 'watch', 'is watching', 'a film']];
      var SING = ['She', 'He', 'Tom', 'My brother'];
      V.forEach(function (g) {
        SING.forEach(function (s) {
          out.push(withHint(mk(s + ' usually ____ ' + g[3] + '.', g[0], [g[2], g[1], 'is ' + g[1]], 'routine -> present simple.'), H));
          out.push(withHint(mk('Look! ' + s + ' ____ ' + g[3] + ' right now.', g[2], [g[0], g[1], 'is ' + g[1]], 'now -> present continuous.'), H));
        });
      });
      return out;
    },

    'b1-question-forms': function () {
      var out = [], H = 'Look at the time words and the other verbs in the sentence: which helper fits that time?';
      ['like coffee', 'play the guitar', 'work in London', 'speak Italian'].forEach(function (v) {
        ['she', 'he', 'your sister'].forEach(function (s) { out.push(withHint(mk('____ ' + s + ' ' + v + '?', 'Does', ['Do', 'Is', 'Did'], 'present simple (he/she/it): Does + base verb.'), H)); });
        ['they', 'we', 'you'].forEach(function (s) { out.push(withHint(mk('____ ' + s + ' ' + v + '?', 'Do', ['Does', 'Are', 'Did'], 'present simple (you/we/they): Do + base verb.'), H)); });
      });
      ['arrive late', 'see the film', 'call you', 'win the game'].forEach(function (v) { ['she', 'they', 'you', 'he'].forEach(function (s) { out.push(withHint(mk('____ ' + s + ' ' + v + ' yesterday?', 'Did', ['Do', 'Does', 'Was'], 'past simple question: Did + base verb.'), H)); }); });
      ['working', 'sleeping', 'cooking', 'waiting'].forEach(function (v) { out.push(withHint(mk('____ she ' + v + ' now?', 'Is', ['Are', 'Does', 'Did'], 'continuous (he/she/it): Is + -ing.'), H)); out.push(withHint(mk('____ they ' + v + ' now?', 'Are', ['Is', 'Do', 'Did'], 'continuous (you/we/they): Are + -ing.'), H)); });
      ['lived here', 'known him', 'worked there'].forEach(function (v) { out.push(withHint(mk('How long ____ she ' + v + '?', 'has', ['have', 'did', 'is'], 'present perfect (he/she/it): has + past participle.'), H)); out.push(withHint(mk('How long ____ you ' + v + '?', 'have', ['has', 'did', 'are'], 'present perfect (you/we/they): have + past participle.'), H)); });
      return out;
    },

    'b1-past-continuous': function () {
      var out = [], H = 'The action was in the middle of happening at a past moment. Match the helper to the subject.';
      var V = [['watching', 'watch', 'TV'], ['playing', 'play', 'football'], ['cooking', 'cook', 'dinner'], ['reading', 'read', 'a book'], ['working', 'work', 'late'],
        ['sleeping', 'sleep', ''], ['studying', 'study', 'English'], ['waiting', 'wait', 'for the bus'], ['driving', 'drive', 'home'], ['running', 'run', 'in the park']];
      var SING = ['She', 'He', 'Tom', 'I', 'My brother'];
      var PLUR = ['They', 'We', 'You', 'My friends'];
      V.forEach(function (g) {
        var obj = g[2] ? ' ' + g[2] : '';
        SING.forEach(function (s) { out.push(withHint(mk(s + ' ____' + obj + ' when the phone rang.', 'was ' + g[0], ['were ' + g[0], 'is ' + g[0], g[1]], 'I/he/she/it: was + -ing.'), H)); });
        PLUR.forEach(function (s) { out.push(withHint(mk(s + ' ____' + obj + ' when the phone rang.', 'were ' + g[0], ['was ' + g[0], 'are ' + g[0], g[1]], 'you/we/they: were + -ing.'), H)); });
      });
      return out;
    },

    'b1-used-to': function () {
      var out = [], H = 'True before, not now. Careful: check whether a helper word already sits earlier in the sentence.';
      var V = ['play tennis', 'live in a village', 'go to that school', 'eat meat', 'work nights', 'collect stamps', 'have long hair', 'wear glasses', 'study Latin', 'walk to work'];
      var SUBJ = ['I', 'She', 'He', 'We', 'They', 'Tom', 'My father'];
      V.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + v + '.', 'used to', ['use to', 'used', 'am used to'], 'used to + base verb for a past habit.'), H)); }); });
      V.forEach(function (v) { ['I', 'She', 'We', 'They'].forEach(function (s) { out.push(withHint(mk(s + " didn't ____ " + v + '.', 'use to', ['used to', 'uses to', 'using to'], "negative: didn't use to + base verb."), 'A helper word already sits before the gap. Look closely at the ending of the main verb that follows it.')); }); });
      return out;
    },

    'b1-present-perfect': function () {
      var out = [], H = 'Words like "just", "never" and "ever" point to experience up to now. Which option shows that?';
      var PP = ['just finished', 'already eaten', 'never been to Japan', 'lost the keys', 'seen that play', 'done the report', 'met the manager', 'broken the printer', 'read that book', 'arrived late'];
      var SING = ['She', 'He', 'Tom', 'My boss', 'The teacher'];
      var PLUR = ['I', 'You', 'We', 'They', 'My colleagues'];
      PP.forEach(function (p) { SING.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + p + '.', 'has', ['have', 'is', 'did'], 'he/she/it: has + past participle.'), H)); }); PLUR.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + p + '.', 'have', ['has', 'are', 'did'], 'I/you/we/they: have + past participle.'), H)); }); });
      return out;
    },

    'b1-pp-vs-past': function () {
      var out = [], H = 'Find the time signal: a finished time (last week, ago) or experience up to now (just, never, already)?';
      var V = [['saw', 'see', 'seen', 'the report'], ['went', 'go', 'gone', 'to Berlin'], ['wrote', 'write', 'written', 'the email'], ['made', 'make', 'made', 'a mistake'],
        ['took', 'take', 'taken', 'the train'], ['gave', 'give', 'given', 'a talk'], ['lost', 'lose', 'lost', 'the file'], ['found', 'find', 'found', 'the solution']];
      var SUBJ = ['I', 'She', 'He', 'We', 'They'];
      V.forEach(function (g) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + g[3] + ' last week.', g[0], [g[1], 'have ' + g[2], 'did ' + g[1]], 'finished time -> past simple.'), H)); }); });
      V.forEach(function (g) {
        out.push(withHint(mk('I have just ____ ' + g[3] + '.', g[2], [g[1], 'to ' + g[1], g[1] + 's'], 'just -> present perfect.'), H));
        out.push(withHint(mk('She has never ____ ' + g[3] + '.', g[2], [g[1], 'to ' + g[1], g[1] + 's'], 'never -> present perfect.'), H));
        out.push(withHint(mk('We have already ____ ' + g[3] + '.', g[2], [g[1], 'to ' + g[1], g[1] + 's'], 'already -> present perfect.'), H));
      });
      return out;
    },

    'b1-quantifiers': function () {
      var out = [], H = 'Look at the noun after the gap: can you count it, one by one?';
      var UNC = ['time', 'money', 'information', 'work', 'traffic', 'noise', 'luggage', 'furniture', 'progress', 'rain'];
      var CNT = ['people', 'colleagues', 'emails', 'meetings', 'options', 'reasons', 'mistakes', 'customers', 'shops', 'reviews'];
      UNC.forEach(function (n) {
        out.push(withHint(mk('How ____ ' + n + ' is there?', 'much', ['many', 'a few', 'fewer'], 'much + uncountable.'), H));
        out.push(withHint(mk("There isn't ____ " + n + '.', 'much', ['many', 'a few', 'fewer'], 'much + uncountable (negative).'), H));
        out.push(withHint(mk("We don't have ____ " + n + '.', 'much', ['many', 'a few', 'fewer'], 'much + uncountable.'), H));
      });
      CNT.forEach(function (n) {
        out.push(withHint(mk('How ____ ' + n + ' are there?', 'many', ['much', 'a little', 'less'], 'many + countable plural.'), H));
        out.push(withHint(mk("There aren't ____ " + n + '.', 'many', ['much', 'a little', 'less'], 'many + countable plural.'), H));
        out.push(withHint(mk("We don't have ____ " + n + '.', 'many', ['much', 'a little', 'less'], 'many + countable plural.'), H));
      });
      return out;
    },

    'b1-comparatives': function () {
      var out = [], H = 'Two things are compared. Count the syllables of the adjective before you choose.';
      ADJN.forEach(function (a) { a[3].forEach(function (n) { out.push(withHint(mk('This ' + n + ' is ____ than the other one. (' + a[0] + ')', a[1], compDist(a), 'the comparative of "' + a[0] + '".'), H)); }); });
      return out;
    },

    'b1-gerund-infinitive': function () {
      var out = [], H = 'Look at the exact verb before the gap: each verb takes its own pattern.';
      var ACT = [['swimming', 'to swim', 'swim', 'in the sea'], ['cooking', 'to cook', 'cook', 'Italian food'], ['travelling', 'to travel', 'travel', 'around Europe'], ['reading', 'to read', 'read', 'long novels'], ['studying', 'to study', 'study', 'for exams'],
        ['driving', 'to drive', 'drive', 'to work'], ['painting', 'to paint', 'paint', 'pictures'], ['dancing', 'to dance', 'dance', 'the tango'], ['running', 'to run', 'run', 'marathons'], ['singing', 'to sing', 'sing', 'pop songs']];
      var SV_ING = [['I', 'enjoy'], ['She', 'enjoys'], ['They', 'avoid'], ['He', 'keeps'], ['We', 'miss'], ['I', "don't mind"]];
      var SV_INF = [['I', 'want'], ['She', 'wants'], ['They', 'decided'], ['He', 'hopes'], ['We', 'agreed'], ['I', 'plan']];
      SV_ING.forEach(function (sv) { ACT.forEach(function (a) { out.push(withHint(mk(sv[0] + ' ' + sv[1] + ' ____ ' + a[3] + '.', a[0], [a[1], a[2], a[2] + 's'], '"' + sv[1] + '" takes -ing.'), H)); }); });
      SV_INF.forEach(function (sv) { ACT.forEach(function (a) { out.push(withHint(mk(sv[0] + ' ' + sv[1] + ' ____ ' + a[3] + '.', a[1], [a[0], a[2], a[2] + 's'], '"' + sv[1] + '" takes to + base verb.'), H)); }); });
      return out;
    },

    'b1-passive-present': function () {
      var out = [], H = 'The subject does not do this action, someone else does. Singular or plural subject?';
      var SING = [['English', 'spoken', 'speak', 'here'], ['The office', 'cleaned', 'clean', 'every evening'], ['Rice', 'grown', 'grow', 'in many countries'], ['This car', 'made', 'make', 'in Japan'],
        ['The bill', 'paid', 'pay', 'at the end'], ['The shop', 'closed', 'close', 'on Sundays'], ['Breakfast', 'served', 'serve', 'at eight'], ['The museum', 'visited', 'visit', 'by tourists'],
        ['This song', 'played', 'play', 'on the radio'], ['The report', 'written', 'write', 'in English'], ['The garden', 'watered', 'water', 'every day'], ['Coffee', 'grown', 'grow', 'in Brazil']];
      var PLUR = [['These phones', 'made', 'make', 'in China'], ['The emails', 'sent', 'send', 'automatically'], ['The tickets', 'sold', 'sell', 'online'], ['The rooms', 'cleaned', 'clean', 'daily'],
        ['Many languages', 'spoken', 'speak', 'in India'], ['The bins', 'emptied', 'empty', 'on Mondays'], ['The doors', 'locked', 'lock', 'at night'], ['Wages', 'paid', 'pay', 'monthly'],
        ['The streets', 'cleaned', 'clean', 'at dawn'], ['These products', 'tested', 'test', 'carefully'], ['The forms', 'checked', 'check', 'by staff'], ['The lights', 'turned off', 'turn off', 'at midnight']];
      SING.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[3] + '.', 'is ' + s[1], [s[2] + 's', 'are ' + s[1], s[2]], 'singular subject: is + past participle.'), H)); });
      PLUR.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[3] + '.', 'are ' + s[1], [s[2], 'is ' + s[1], s[2] + 's'], 'plural subject: are + past participle.'), H)); });
      return out;
    },

    'b1-passive-past': function () {
      var out = [], H = 'The subject did not do this action, and it happened in the past. Singular or plural subject?';
      var SING = [['The bridge', 'built', 'build', 'in 1990'], ['America', 'discovered', 'discover', 'in 1492'], ['The letter', 'written', 'write', 'last week'], ['The window', 'broken', 'break', 'yesterday'],
        ['The cake', 'eaten', 'eat', 'quickly'], ['The painting', 'stolen', 'steal', 'at night'], ['The match', 'cancelled', 'cancel', 'because of rain'], ['The car', 'repaired', 'repair', 'yesterday'],
        ['The house', 'sold', 'sell', 'last month'], ['The film', 'made', 'make', 'in 2010']];
      var PLUR = [['The windows', 'cleaned', 'clean', 'yesterday'], ['The letters', 'sent', 'send', 'last week'], ['The trees', 'planted', 'plant', 'in spring'], ['The keys', 'found', 'find', 'this morning'],
        ['The rooms', 'painted', 'paint', 'last year'], ['The guests', 'invited', 'invite', 'by email'], ['The photos', 'taken', 'take', 'at the party'], ['The tickets', 'booked', 'book', 'online'],
        ['The walls', 'painted', 'paint', 'white'], ['The prizes', 'given', 'give', 'to the winners']];
      SING.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[3] + '.', 'was ' + s[1], [s[2], 'were ' + s[1], s[2] + 's'], 'singular subject: was + past participle.'), H)); });
      PLUR.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[3] + '.', 'were ' + s[1], [s[2], 'was ' + s[1], s[2] + 's'], 'plural subject: were + past participle.'), H)); });
      return out;
    },

    'b1-future-will-going': function () {
      var out = [];
      var Hg = 'This plan was decided BEFORE now. Which option matches both the subject and that idea?';
      var Hw = 'Decided at this very moment, or a prediction? Let the timing of the decision guide you.';
      var ACT = ['start a new job', 'buy a house', 'study abroad', 'learn to drive', 'visit Rome', 'open a small cafe', 'run a marathon', 'paint the kitchen', 'plant a garden', 'write a novel'];
      var SING = ['My sister', 'My brother', 'Tom', 'Anna', 'She', 'He', 'The manager'];
      var PLUR = ['We', 'They', 'My parents', 'You', 'The students'];
      SING.forEach(function (s) { ACT.forEach(function (a) { out.push(withHint(mk(s + ' ____ ' + a + ' next year.', 'is going to', ['are going to', 'am going to', 'will going to'], 'singular subject: is going to + base verb.'), Hg)); }); });
      PLUR.forEach(function (s) { ACT.forEach(function (a) { out.push(withHint(mk(s + ' ____ ' + a + ' next year.', 'are going to', ['is going to', 'am going to', 'will going to'], 'plural subject: are going to + base verb.'), Hg)); }); });
      ACT.forEach(function (a) { out.push(withHint(mk('I ____ ' + a + ' next year.', 'am going to', ['is going to', 'are going to', 'will going to'], 'I: am going to + base verb.'), Hg)); });
      var SPON = [['The phone is ringing.', 'answer it'], ['That bag looks heavy.', 'carry it for you'], ['It is cold in here.', 'close the window'], ['You look tired.', 'make you a coffee'], ['Wait a second.', 'get my coat'], ['It is late.', 'call a taxi'], ['Leave it to me.', 'fix it'], ['Do not worry.', 'help you']];
      SPON.forEach(function (p) { out.push(withHint(mk(p[0] + ' I ____ ' + p[1] + '.', 'will', ['will to', 'am going', 'going to'], 'instant decision: will + base verb.'), Hw)); });
      return out;
    },

    'b1-future-plans': function () {
      var out = [], H = 'A plan comes next in the sentence. Match the helper word to the subject, and notice whether the sentence asks a question.';
      var ACT = ['travel around Asia', 'change jobs', 'rent a flat', 'take driving lessons', 'join a gym', 'see the doctor', 'sell the old car', 'visit the grandparents', 'redecorate the house', 'apply to university'];
      var SING = ['She', 'He', 'Tom', 'My sister'];
      var PLUR = ['We', 'They', 'My parents', 'The boys'];
      SING.forEach(function (s) { ACT.forEach(function (a) { out.push(withHint(mk(s + ' ____ going to ' + a + ' soon.', 'is', ['are', 'am', 'be'], 'singular subject: is.'), H)); }); });
      PLUR.forEach(function (s) { ACT.forEach(function (a) { out.push(withHint(mk(s + ' ____ going to ' + a + ' soon.', 'are', ['is', 'am', 'be'], 'plural subject: are.'), H)); }); });
      var SQ = ['she', 'he', 'Tom', 'your sister'];
      SQ.forEach(function (s) { ACT.slice(0, 6).forEach(function (a) { out.push(withHint(mk('____ ' + s + ' going to ' + a + '?', 'Is', ['Are', 'Am', 'Does'], 'question, singular subject: Is first.'), H)); }); });
      return out;
    },

    'b1-modals-obligation': function () {
      var out = [], H = 'Read the meaning first: an obligation, a ban, or simply no need?';
      var OBL = ['stop at a red light', 'wear a helmet', 'show some ID', 'pay the entrance fee', 'book a table first', 'renew the permit', 'follow the safety rules', 'sign the form', 'arrive on time', 'keep the receipt'];
      var SING = ['A driver', 'Every visitor', 'She', 'My brother', 'Each student'];
      var PLUR = ['Drivers', 'Visitors', 'We', 'They', 'The staff'];
      SING.forEach(function (s) { OBL.forEach(function (a) { out.push(withHint(mk(s + ' ____ ' + a + '. It is the rule.', 'has to', ['have to', 'having to', 'has'], 'singular subject + obligation: has to.'), H)); }); });
      PLUR.forEach(function (s) { OBL.forEach(function (a) { out.push(withHint(mk(s + ' ____ ' + a + '. It is the rule.', 'have to', ['has to', 'having to', 'have'], 'plural subject + obligation: have to.'), H)); }); });
      var PRO = ['park here', 'use phones in the exam', 'feed the animals', 'touch the paintings', 'walk on the grass', 'smoke inside'];
      PRO.forEach(function (a) { out.push(withHint(mk('You ____ ' + a + '. It is forbidden.', "mustn't", ["don't have to", 'must', 'should'], "a forbidden action: mustn't."), H)); });
      var NO = ['pay, it is free', 'come early, there is time', 'bring food, we have plenty', 'wear a tie, it is casual', 'rush, we are not late', 'book, there is space'];
      NO.forEach(function (a) { out.push(withHint(mk('You ____ ' + a + '.', "don't have to", ["mustn't", 'have to', 'should'], "no obligation: don't have to."), H)); });
      return out;
    },

    'b1-modals-possibility': function () {
      var out = [], H = 'Ability now, ability in the past, or just a possibility? Then check the verb form that follows.';
      var ABIL = ['speak four languages', 'play the violin', 'drive a lorry', 'fix a computer', 'cook Thai food', 'run ten kilometres', 'read music', 'solve hard puzzles', 'ride a horse', 'paint portraits'];
      var SUBJ = ['She', 'He', 'Tom', 'My friend', 'My sister', 'The new student'];
      ABIL.forEach(function (a) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + a + '.', 'can', ['can to', 'cans', 'is can'], 'ability: can + base verb.'), H)); }); });
      var POSS = [['It', 'rain this afternoon'], ['She', 'be at home'], ['He', 'know the answer'], ['They', 'arrive late'], ['The trip', 'cost a lot'], ['The meeting', 'take all day'], ['This plan', 'work well'], ['The shop', 'be closed']];
      POSS.forEach(function (p) { out.push(withHint(mk(p[0] + ' ____ ' + p[1] + '.', 'might', ['might to', 'mights', 'may to'], 'possibility: might + base verb.'), H)); });
      var QS = ['she', 'he', 'your friend', 'your sister'];
      ABIL.slice(0, 6).forEach(function (a) { QS.forEach(function (s) { out.push(withHint(mk('____ ' + s + ' ' + a + '?', 'Can', ['Cans', 'Does can', 'Is'], 'ability question: Can + subject + base verb.'), H)); }); });
      return out;
    },

    'b1-conditional-1': function () {
      var out = [], H = 'A real future situation. Which half of the sentence holds the gap: the "if" half or the result half?';
      var IFV = [['hard', 'study', 'studies'], ['every day', 'train', 'trains'], ['some money', 'save', 'saves'], ['politely', 'ask', 'asks'], ['early', 'leave', 'leaves'], ['a lot', 'practise', 'practises'], ['hard', 'work', 'works'], ['a little', 'help', 'helps']];
      var RES2 = ['you will pass', 'the team will win'];
      var PSUBJ = ['you', 'they', 'we'];
      PSUBJ.forEach(function (s) { IFV.forEach(function (v) { RES2.forEach(function (r) { out.push(withHint(mk('If ' + s + ' ____ ' + v[0] + ', ' + r + '.', v[1], [v[2], 'will ' + v[1], 'to ' + v[1]], 'after "if": present simple base verb.'), H)); }); }); });
      var SSUBJ = ['she', 'he', 'my brother', 'the teacher'];
      SSUBJ.forEach(function (s) { IFV.forEach(function (v) { out.push(withHint(mk('If ' + s + ' ____ ' + v[0] + ', the result will be good.', v[2], [v[1], 'will ' + v[1], 'to ' + v[1]], 'after "if", he/she: add -s.'), H)); }); });
      var RESV = [['the prize', 'win'], ['you back', 'call'], ['the team', 'help'], ['at home', 'stay'], ['the train', 'catch'], ['the room', 'book']];
      var CONDS = ['If you practise', 'If they hurry', 'If we are lucky', 'If she asks'];
      CONDS.forEach(function (c) { RESV.forEach(function (rv) { out.push(withHint(mk(c + ', we ____ ' + rv[0] + '.', 'will ' + rv[1], [rv[1], 'will to ' + rv[1], 'are ' + rv[1]], 'result clause: will + base verb.'), H)); }); });
      return out;
    },

    'b1-conditional-2': function () {
      var out = [], H = 'Is the situation real or imaginary? And which half of the sentence holds the gap?';
      var IFV = [['more time', 'had', 'have'], ['the lottery', 'won', 'win'], ['the answer', 'knew', 'know'], ['nearer', 'lived', 'live'], ['Chinese', 'spoke', 'speak'], ['a car', 'owned', 'own'], ['better', 'felt', 'feel'], ['the truth', 'told', 'tell']];
      var SUBJ = ['I', 'you', 'she', 'we', 'they'];
      SUBJ.forEach(function (s) { IFV.forEach(function (v) { out.push(withHint(mk('If ' + s + ' ____ ' + v[0] + ', things would be different.', v[1], [v[2], 'would ' + v[2], 'have ' + v[1]], 'after "if": past simple form.'), H)); }); });
      var RESV = [['a new house', 'buy'], ['around the world', 'travel'], ['a sports car', 'drive'], ['the truth', 'tell'], ['more friends', 'make'], ['the job', 'take']];
      var CONDS = ['If I were rich', 'If she had time', 'If we lived here', 'If they tried harder'];
      CONDS.forEach(function (c) { RESV.forEach(function (rv) { out.push(withHint(mk(c + ', I ____ ' + rv[0] + '.', 'would ' + rv[1], [rv[1], 'will ' + rv[1], 'would to ' + rv[1]], 'result clause: would + base verb.'), H)); }); });
      return out;
    },

    'b1-too-enough': function () {
      var out = [], H = 'More than needed, or just the right amount? Also look at WHERE the gap sits in the sentence.';
      var TOO = [['This coffee', 'hot', 'drink'], ['The box', 'heavy', 'carry'], ['The water', 'cold', 'swim in'], ['The room', 'dark', 'read in'], ['This ticket', 'expensive', 'buy'], ['The shop', 'far', 'walk to'], ['The street', 'noisy', 'sleep in'], ['The shelf', 'high', 'reach'], ['The soup', 'salty', 'eat'], ['This shirt', 'small', 'wear'], ['The hill', 'steep', 'climb'], ['The film', 'long', 'finish']];
      TOO.forEach(function (t) { out.push(withHint(mk(t[0] + ' is ____ ' + t[1] + ' to ' + t[2] + '.', 'too', ['enough', 'very', 'so'], 'an excess goes before the adjective.'), H)); });
      var ENA = [['tall', 'reach the shelf'], ['old', 'drive'], ['strong', 'lift it'], ['warm', 'go outside'], ['fit', 'run a race'], ['good', 'pass the test'], ['fast', 'win the race'], ['ready', 'start now']];
      ENA.forEach(function (e) { out.push(withHint(mk("She isn't " + e[0] + ' ____ to ' + e[1] + '.', 'enough', ['too', 'very', 'much'], 'a sufficient amount goes after the adjective.'), H)); });
      var ENN = ['chairs', 'time', 'money', 'room', 'food', 'tickets', 'cups', 'space'];
      ENN.forEach(function (n) { out.push(withHint(mk("We don't have ____ " + n + ' for everyone.', 'enough', ['too', 'so', 'such'], 'a sufficient amount goes before the noun.'), H)); });
      return out;
    },

    'b1-a-few-little': function () {
      var out = [], H = 'Look at the noun after the gap: can you count it, one by one?';
      var UNC = ['money', 'time', 'milk', 'sugar', 'water', 'bread', 'salt', 'coffee', 'rice', 'help', 'juice', 'cheese'];
      var CNT = ['biscuits', 'friends', 'books', 'apples', 'chairs', 'coins', 'ideas', 'shops', 'eggs', 'photos', 'songs', 'cards'];
      var UF = ['We still have ____ %.', 'I saved ____ %.', 'There is ____ % left.', 'Can you give me ____ %?'];
      var CF = ['We still have ____ %.', 'I bought ____ %.', 'There are ____ % left.', 'She knows ____ %.'];
      UNC.forEach(function (n) { UF.forEach(function (f) { out.push(withHint(mk(f.replace('%', n), 'a little', ['a few', 'many', 'few'], 'uncountable noun: a little.'), H)); }); });
      CNT.forEach(function (n) { CF.forEach(function (f) { out.push(withHint(mk(f.replace('%', n), 'a few', ['a little', 'much', 'little'], 'countable plural: a few.'), H)); }); });
      return out;
    },

    'b1-relative-clauses': function () {
      var out = [], H = 'The missing word points back to something: a person, a thing, a place, or an owner?';
      var PERSON = ['the man', 'the woman', 'the teacher', 'the doctor', 'the player', 'the artist', 'the neighbour', 'the writer'];
      var PVERB = ['lives next door', 'won the prize', 'helped us', 'teaches maths', 'wrote the book', 'fixed the car', 'called you', 'works here'];
      PERSON.forEach(function (p, i) { out.push(withHint(mk("That's " + p + ' ____ ' + PVERB[i % PVERB.length] + '.', 'who', ['which', 'whose', 'where'], 'refers to a person: who.'), H)); });
      var THING = ['the book', 'the car', 'the film', 'the phone', 'the house', 'the bag', 'the painting', 'the song'];
      var TVERB = ['won the award', 'broke down', 'made me cry', 'rang loudly', 'looked lovely', 'went missing', 'sold quickly', 'topped the charts'];
      THING.forEach(function (t, i) { out.push(withHint(mk('This is ' + t + ' ____ ' + TVERB[i % TVERB.length] + '.', 'which', ['who', 'whose', 'where'], 'refers to a thing: which.'), H)); });
      var PLACE = ['the house', 'the city', 'the hotel', 'the school', 'the village', 'the cafe', 'the beach', 'the office'];
      var PLV = ['I was born', 'we first met', 'they got married', 'I grew up', 'she was raised', 'we used to meet', 'he proposed', 'I started work'];
      PLACE.forEach(function (p, i) { out.push(withHint(mk("That's " + p + ' ____ ' + PLV[i % PLV.length] + '.', 'where', ['which', 'who', 'whose'], 'refers to a place: where.'), H)); });
      var POSS = ['the woman', 'the man', 'the boy', 'the artist', 'the family', 'the author', 'the student', 'the singer'];
      var POV = ['car was stolen', 'dog ran away', 'bike was new', 'work sold out', 'house was sold', 'book won a prize', 'bag was lost', 'song went viral'];
      POSS.forEach(function (p, i) { out.push(withHint(mk('She knows ' + p + ' ____ ' + POV[i % POV.length] + '.', 'whose', ['who', 'which', 'where'], 'refers to a possession: whose.'), H)); });
      var OBJ = [['the book', 'I read'], ['the film', 'we watched'], ['the meal', 'she cooked'], ['the song', 'they played'], ['the car', 'he bought'], ['the house', 'we visited']];
      OBJ.forEach(function (o) { out.push(withHint(mk('This is ' + o[0] + ' ____ ' + o[1] + ' last week.', 'that', ['who', 'whose', 'where'], 'a thing as object: that.'), H)); });
      return out;
    },

    'b1p-present-perfect': function () {
      var out = [], H = 'The sentence links the past to now. Match the helper to the subject.';
      var V = [['written', 'write', 'wrote'], ['eaten', 'eat', 'ate'], ['seen', 'see', 'saw'], ['taken', 'take', 'took'], ['broken', 'break', 'broke'], ['spoken', 'speak', 'spoke'], ['given', 'give', 'gave'], ['known', 'know', 'knew'], ['driven', 'drive', 'drove'], ['chosen', 'choose', 'chose']];
      var OBJ = ['a letter', 'the cake', 'that film', 'some photos', 'the window', 'to the boss', 'a speech', 'the answer', 'the new car', 'a book'];
      V.forEach(function (v, i) { out.push(withHint(mk('She has ____ ' + OBJ[i] + '.', v[0], [v[1], v[2], v[1] + 'ing'], 'after the helper, use the past participle (the third form).'), H)); });
      var PP = ['lived here for years', 'known us since school', 'just arrived', 'already left', 'never been abroad', 'lost the keys', 'finished the report', 'seen the results', 'done the homework', 'paid the bill'];
      var SING = ['She', 'He', 'Tom', 'My sister', 'The manager'];
      var PLUR = ['We', 'They', 'My parents', 'You', 'The students'];
      SING.forEach(function (s) { PP.forEach(function (p) { out.push(withHint(mk(s + ' ____ ' + p + '.', 'has', ['have', 'is', 'did'], 'singular subject: has + past participle.'), H)); }); });
      PLUR.forEach(function (s) { PP.forEach(function (p) { out.push(withHint(mk(s + ' ____ ' + p + '.', 'have', ['has', 'are', 'did'], 'I/you/we/they: have + past participle.'), H)); }); });
      return out;
    },

    'b1p-pres-perf-cont': function () {
      var out = [], H = 'It started in the past and is STILL going on (look for "for" or "since"). Which option shows that?';
      var ING = ['working hard', 'studying English', 'waiting for you', 'running', 'cooking dinner', 'reading all day', 'playing tennis', 'cleaning the house', 'driving since dawn', 'training for weeks'];
      var SING = ['She', 'He', 'Tom', 'My sister', 'The team captain'];
      var PLUR = ['We', 'They', 'My parents', 'You', 'The workers'];
      SING.forEach(function (s) { ING.forEach(function (g) { out.push(withHint(mk(s + ' ____ ' + g + '.', 'has been', ['have been', 'is been', 'has being'], 'singular subject: has been + -ing.'), H)); }); });
      PLUR.forEach(function (s) { ING.forEach(function (g) { out.push(withHint(mk(s + ' ____ ' + g + '.', 'have been', ['has been', 'are been', 'have being'], 'I/you/we/they: have been + -ing.'), H)); }); });
      var SQ = ['you', 'they', 'we'];
      SQ.forEach(function (s) { ING.slice(0, 4).forEach(function (g) { out.push(withHint(mk('How long ____ ' + s + ' been ' + g.split(' ')[0] + '?', 'have', ['has', 'are', 'did'], 'I/you/we/they question: have + subject.'), H)); }); });
      return out;
    },

    'b1p-past-perfect': function () {
      var out = [], H = 'There are TWO past events here. Which one happened first? The earlier one needs a special form.';
      var V = [['gone', 'go', 'went'], ['begun', 'begin', 'began'], ['left', 'leave', 'leaving'], ['stopped', 'stop', 'stopping'], ['forgotten', 'forget', 'forgot'], ['eaten', 'eat', 'ate'], ['lost', 'lose', 'losing'], ['finished', 'finish', 'finishing'], ['arrived', 'arrive', 'arriving'], ['closed', 'close', 'closing']];
      var SUBJ = ['the train', 'the film', 'everyone', 'the rain', 'she', 'the guests', 'he', 'the meeting', 'the bus', 'the shop'];
      var LEAD = ['By the time we got there, ', 'When I arrived, ', 'After we sat down, ', 'By eight that evening, '];
      V.forEach(function (v, i) { LEAD.forEach(function (c) { out.push(withHint(mk(c + SUBJ[i] + ' ____.', 'had ' + v[0], ['has ' + v[0], v[2], 'was ' + v[1]], 'earlier past action: had + past participle.'), H)); }); });
      return out;
    },

    'b1p-past-continuous': function () {
      var out = [], H = 'The action was in the middle of happening at that past moment. Match the helper to the subject.';
      var ING = [['cooking', 'dinner'], ['watching', 'TV'], ['reading', 'a book'], ['driving', 'home'], ['working', 'late'], ['studying', ''], ['playing', 'outside'], ['having', 'lunch'], ['painting', 'the wall'], ['sleeping', '']];
      var SING = ['She', 'He', 'Tom', 'My brother', 'The teacher'];
      var PLUR = ['We', 'They', 'The children', 'My parents', 'You'];
      var WHEN = ['when the phone rang', 'when I arrived', 'at nine last night', 'when it started to rain', 'all evening'];
      SING.forEach(function (s) { ING.forEach(function (g) { var obj = g[1] ? ' ' + g[1] : ''; out.push(withHint(mk(s + ' ____' + obj + ' ' + WHEN[(s.length + g[0].length) % WHEN.length] + '.', 'was ' + g[0], ['were ' + g[0], 'is ' + g[0], 'are ' + g[0]], 'singular subject: was + -ing.'), H)); }); });
      PLUR.forEach(function (s) { ING.forEach(function (g) { var obj = g[1] ? ' ' + g[1] : ''; out.push(withHint(mk(s + ' ____' + obj + ' ' + WHEN[(s.length + g[0].length) % WHEN.length] + '.', 'were ' + g[0], ['was ' + g[0], 'is ' + g[0], 'are ' + g[0]], 'plural subject: were + -ing.'), H)); }); });
      return out;
    },

    'b1p-future-continuous': function () {
      var out = [], H = 'At that future time the action will be in the middle of happening. Which option shows an ongoing action?';
      var ING = [['lying on a beach', 'lie'], ['having dinner', 'have'], ['flying to Rome', 'fly'], ['working from home', 'work'], ['driving north', 'drive'], ['studying for exams', 'study'], ['watching the final', 'watch'], ['waiting at the gate', 'wait'], ['running the shop', 'run'], ['sleeping', 'sleep']];
      var SUBJ = ['I', 'She', 'He', 'We', 'They'];
      var LEAD = ['This time tomorrow, ', 'At 8pm, ', 'This time next week, ', 'Tonight at nine, '];
      ING.forEach(function (g) { SUBJ.forEach(function (s) { var ing = g[0].split(' ')[0], rest = g[0].split(' ').slice(1).join(' '), tail = rest ? ' ' + rest : '', subj = (s === 'I') ? 'I' : s.toLowerCase(); out.push(withHint(mk(LEAD[(g[0].length) % LEAD.length] + subj + ' ____' + tail + '.', 'will be ' + ing, ['will ' + g[1], 'is ' + ing, 'will be ' + g[1]], 'future in progress: will be + -ing.'), H)); }); });
      return out;
    },

    'b1p-future': function () {
      var out = [], H = 'Is this a fixed timetable (train, class, flight) or a decision or prediction made right now?';
      var TT = [['train', 'leaves', 'leave'], ['film', 'starts', 'start'], ['meeting', 'begins', 'begin'], ['shop', 'opens', 'open'], ['bus', 'arrives', 'arrive'], ['concert', 'finishes', 'finish'], ['flight', 'departs', 'depart'], ['lesson', 'ends', 'end']];
      var TIME = ['at nine', 'at noon', 'at half past six', 'in ten minutes', 'tomorrow morning', 'on Monday'];
      TT.forEach(function (t) { TIME.forEach(function (tm) { out.push(withHint(mk('The ' + t[0] + ' ____ ' + tm + '.', t[1], [t[2], 'will ' + t[1], 'is ' + t[2]], 'timetable: present simple, he/she/it adds -s.'), H)); }); });
      var PRED = [['rain', 'I think it'], ['be fine', 'I am sure she'], ['win', 'I bet they'], ['help', 'Do not worry, we'], ['call back', 'OK, I'], ['work', 'I hope this'], ['arrive soon', 'Maybe they'], ['like it', 'I think you']];
      PRED.forEach(function (p) { out.push(withHint(mk(p[1] + ' ____ ' + p[0] + '.', 'will', ['will to', 'going to', 'are going'], 'prediction or instant decision: will + base verb.'), H)); });
      return out;
    },

    'b1p-deduction': function () {
      var out = [], H = 'How sure does the evidence make you: certain it is true, certain it is impossible, or only possible?';
      var IT = [
        ['The lights are on, so someone ____ be home.', 'must', ["can't", 'might', 'is']],
        ['He just ate a big meal, he ____ be hungry.', "can't", ['must', 'might', 'is']],
        ['I am not sure where she is; she ____ be at work.', 'might', ['must', "can't", 'is']],
        ['She has not slept all night, she ____ be exhausted.', 'must', ["can't", 'might', 'is']],
        ['That ____ be John; John is much taller.', "can't", ['must', 'might', 'is']],
        ['Nobody is answering; they ____ be out.', 'might', ['must', "can't", 'are']],
        ['He is wearing a uniform, so he ____ be a guard.', 'must', ["can't", 'might', 'is']],
        ['The shop is dark, it ____ be open.', "can't", ['must', 'might', 'is']],
        ['Her car is gone, so she ____ be at home.', "can't", ['must', 'might', 'is']],
        ['I can hear music, so someone ____ be in.', 'must', ["can't", 'might', 'is']],
        ['Perhaps the keys ____ be in the drawer.', 'might', ['must', "can't", 'are']],
        ['He is yawning, so he ____ be tired.', 'must', ["can't", 'might', 'is']],
        ['She lives abroad, so that ____ be her at the door.', "can't", ['must', 'might', 'is']],
        ['The phone is ringing; it ____ be your mother.', 'might', ['must', "can't", 'is']],
        ['They have three cars, they ____ be poor.', "can't", ['must', 'might', 'are']],
        ['The ground is dry, so it ____ be raining.', "can't", ['must', 'might', 'is']]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'present deduction: modal + be.'), H)); });
      return out;
    },

    'b1p-past-modals': function () {
      var out = [], H = 'You are judging a PAST event: how sure are you, or was it a mistake?';
      var IT = [
        ['You ____ told me earlier; I had no idea.', 'should have', ['should', 'must have', 'should had']],
        ['The grass is wet, so it ____ rained in the night.', 'must have', ['must', "can't have", 'must had']],
        ['She was abroad then, so she ____ seen you here.', "can't have", ['must have', "can't", "can't had"]],
        ['We ____ booked sooner; now it is full.', 'should have', ['should', 'must have', 'should had']],
        ['He passed easily, so he ____ studied hard.', 'must have', ['must', "can't have", 'must had']],
        ['You ____ left without saying goodbye; that was rude.', "shouldn't have", ['should have', "shouldn't", "shouldn't had"]],
        ['The door is open, so someone ____ forgotten to lock it.', 'must have', ['must', "can't have", 'must had']],
        ['I ____ taken a coat; I was freezing.', 'should have', ['should', 'must have', 'should had']],
        ['They had no map, so they ____ found it easily.', "can't have", ['must have', "can't", "can't had"]],
        ['You ____ warned us about the ice.', 'should have', ['should', 'must have', 'should had']],
        ['Her bag is here, so she ____ gone far.', "can't have", ['must have', "can't", "can't had"]],
        ['He looks guilty; he ____ broken it.', 'must have', ['must', "can't have", 'must had']],
        ['We ____ checked the time; we missed the train.', 'should have', ['should', 'must have', 'should had']],
        ['The cake is gone, so the children ____ eaten it.', 'must have', ['must', "can't have", 'must had']]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'past modal: modal + have + past participle.'), H)); });
      return out;
    },

    'b1p-conditional-3': function () {
      var out = [], H = 'The sentence imagines a different PAST. Which half holds the gap: the "if" half or the result half?';
      var IFV = [['studied', 'study', 'for it'], ['left', 'leave', 'earlier'], ['known', 'know', 'the truth'], ['asked', 'ask', 'for help'], ['trained', 'train', 'all winter'], ['saved', 'save', 'the file'], ['listened', 'listen', 'to me'], ['called', 'call', 'ahead']];
      var SUBJ = ['I', 'you', 'she', 'we', 'they'];
      var RES = [', it would have helped.', ', the result would have changed.', ', things would have turned out better.', ', we would have been ready.', ', you would have known.'];
      SUBJ.forEach(function (s) { IFV.forEach(function (v, i) { out.push(withHint(mk('If ' + s + ' ____ ' + v[2] + RES[i % RES.length], 'had ' + v[0], [v[0], 'has ' + v[0], 'would have ' + v[0]], 'after "if": had + past participle.'), H)); }); });
      var RESV = [['passed', 'pass', 'the exam'], ['caught', 'catch', 'the train'], ['won', 'win', 'the match'], ['helped', 'help', 'the team'], ['arrived', 'arrive', 'on time'], ['saved', 'save', 'some money']];
      var CONDS = ['If you had studied', 'If we had hurried', 'If she had asked', 'If they had trained'];
      CONDS.forEach(function (c) { RESV.forEach(function (rv) { out.push(withHint(mk(c + ', you ____ ' + rv[2] + '.', 'would have ' + rv[0], [rv[0], 'would ' + rv[1], 'had ' + rv[0]], 'result clause: would have + past participle.'), H)); }); });
      return out;
    },

    'b1p-wish': function () {
      var out = [], H = 'Is the wish about NOW, or about something already over and done?';
      var NOW = [['knew how to swim', 'know'], ['had more money', 'have'], ['lived nearer', 'live'], ['spoke Italian', 'speak'], ['owned a car', 'own'], ['felt better', 'feel'], ['understood maths', 'understand'], ['had more time', 'have']];
      var SUBJ = ['I', 'she', 'he', 'we', 'they'];
      SUBJ.forEach(function (s) { NOW.forEach(function (v) { out.push(withHint(mk((s === 'I' ? 'I' : s.charAt(0).toUpperCase() + s.slice(1)) + ' wish' + (s === 'I' || s === 'we' || s === 'they' ? '' : 'es') + ' ' + s + ' ____ ' + v[0].split(' ').slice(1).join(' ') + '.', v[0].split(' ')[0], [v[1], 'will ' + v[1], 'have ' + v[1]], 'wish about now: past simple.'), H)); }); });
      var PAST = [['studied harder', 'study'], ['gone to the party', 'go'], ['taken the job', 'take'], ['said sorry', 'say'], ['listened', 'listen'], ['booked earlier', 'book'], ['saved more', 'save'], ['called you', 'call']];
      PAST.forEach(function (v) { var rest = v[0].split(' ').slice(1).join(' '), tail = rest ? ' ' + rest : ''; out.push(withHint(mk('I wish I ____' + tail + '.', 'had ' + v[0].split(' ')[0], [v[0].split(' ')[0], 'have ' + v[0].split(' ')[0], 'would ' + v[1]], 'wish about the past: had + past participle.'), H)); });
      return out;
    },

    'b1p-passive-perfect': function () {
      var out = [], H = 'The subject does not do the action, and the result matters now. Match the helper to the subject.';
      var SING = [['The report', 'finished'], ['The car', 'repaired'], ['The room', 'booked'], ['The letter', 'sent'], ['The bridge', 'rebuilt'], ['The film', 'released'], ['The painting', 'sold'], ['The decision', 'made'], ['The website', 'updated'], ['The window', 'cleaned']];
      var PLUR = [['The reports', 'finished'], ['The cars', 'repaired'], ['The rooms', 'booked'], ['The letters', 'sent'], ['The prizes', 'given'], ['The photos', 'printed'], ['The tickets', 'sold'], ['The walls', 'painted'], ['The files', 'updated'], ['The windows', 'cleaned']];
      SING.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[1] + '.', 'has been', ['have been', 'is been', 'has being'], 'singular subject: has been + past participle.'), H)); });
      PLUR.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[1] + '.', 'have been', ['has been', 'are been', 'have being'], 'plural subject: have been + past participle.'), H)); });
      return out;
    },

    'b1p-causative': function () {
      var out = [], H = 'Who really does this job? Not the subject. Check the word order such an arrangement needs.';
      var IT = [['my car', 'repaired', 'repair'], ['my hair', 'cut', 'cut'], ['the photos', 'printed', 'print'], ['the house', 'painted', 'paint'], ['my suit', 'cleaned', 'clean'], ['the documents', 'translated', 'translate'], ['my phone', 'fixed', 'fix'], ['the report', 'typed', 'type'], ['my watch', 'mended', 'mend'], ['the carpet', 'cleaned', 'clean'], ['the keys', 'copied', 'copy'], ['the boiler', 'serviced', 'service']];
      var LEAD = ['I had ', 'She had ', 'We had ', 'They got ', 'He got '];
      IT.forEach(function (v) { LEAD.forEach(function (l) { out.push(withHint(mk(l + v[0] + ' ____ last week.', v[1], [v[2], v[2] + 'ing', 'to ' + v[2]], 'causative: the object is followed by the past participle.'), H)); }); });
      return out;
    },

    'b1p-reported': function () {
      var out = [], H = 'You are reporting words said earlier: what usually happens to the time of the verb?';
      var IT = [
        ["'I am tired,' she said. -> She said she ____ tired.", 'was', ['is', 'are', 'will be']],
        ["'I am working late,' he said. -> He said he ____ working late.", 'was', ['is', 'has been', 'will be']],
        ["'We will help you,' they said. -> They said they ____ help us.", 'would', ['will', 'are', 'have']],
        ["'I can swim well,' she said. -> She told me she ____ swim well.", 'could', ['can', 'will', 'is']],
        ["'I have finished the work,' he said. -> He said he ____ finished the work.", 'had', ['has', 'have', 'will']],
        ["'We are at home,' they said. -> They said they ____ at home.", 'were', ['are', 'is', 'will be']],
        ["'I will call later,' she said. -> She said she ____ call later.", 'would', ['will', 'is', 'has']],
        ["'I have lost it,' he explained. -> He explained that he ____ lost it.", 'had', ['has', 'have', 'will']],
        ["'The shop is closed,' she said. -> She said the shop ____ closed.", 'was', ['is', 'are', 'has']],
        ["'I have never been to Spain,' Tom said. -> Tom said he ____ never been to Spain.", 'had', ['has', 'have', 'did']],
        ["'We are studying hard,' they said. -> They said they ____ studying hard.", 'were', ['are', 'is', 'have']],
        ["'I will bring the books,' she said. -> She said she ____ bring the books.", 'would', ['will', 'is', 'has']],
        ["'I can play the guitar,' he said. -> He said he ____ play the guitar.", 'could', ['can', 'will', 'does']],
        ["'I am very busy this week,' she said. -> She said she ____ very busy that week.", 'was', ['is', 'are', 'will be']]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'reported speech: shift the tense back one step.'), H)); });
      return out;
    },

    'b1p-reported-q': function () {
      var out = [], H = 'Say the original question aloud, then report it: what changes about the word order?';
      var IT = [
        ["'Where do you work?' -> She asked where I ____.", 'worked', ['work', 'do work', 'did work']],
        ["'Are you ready?' -> He asked ____ I was ready.", 'if', ['that', 'what', 'is']],
        ["'What time does the film start?' -> They asked what time the film ____.", 'started', ['does start', 'start', 'will start']],
        ["'Why are you late?' -> She wanted to know why I ____ late.", 'was', ['am', 'is', 'will be']],
        ["'Can you help?' -> He asked ____ I could help.", 'whether', ['that', 'what', 'do']],
        ["'How long have you lived there?' -> She asked how long I ____ there.", 'had lived', ['have lived', 'live', 'do live']],
        ["'Where is the station?' -> They asked where the station ____.", 'was', ['is', 'are', 'does']],
        ["'Is the shop open?' -> He asked ____ the shop was open.", 'if', ['that', 'what', 'is']],
        ["'What do you want for dinner?' -> She asked what I ____ for dinner.", 'wanted', ['want', 'do want', 'will want']],
        ["'Who broke the window?' -> He asked who ____ the window.", 'had broken', ['has broken', 'break', 'did break']],
        ["'Do you need any help?' -> She asked ____ I needed any help.", 'whether', ['that', 'what', 'do']],
        ["'When does the train leave?' -> They asked when the train ____.", 'left', ['does leave', 'leave', 'will leave']]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'reported question: statement order, joining word for yes-no.'), H)); });
      return out;
    },

    'b1p-relative': function () {
      var out = [], H = 'The missing word points back to something: a person, a thing, a place, a time, or an owner?';
      var ITEMS = [
        ['person', "That's the man ____ helped me.", 'who', ['which', 'where', 'when']],
        ['thing', 'This is the phone ____ broke.', 'which', ['who', 'where', 'when']],
        ['place', 'This is the town ____ I was born.', 'where', ['which', 'who', 'when']],
        ['time', 'Friday is the day ____ we leave.', 'when', ['where', 'which', 'who']],
        ['poss', "She's the artist ____ work won.", 'whose', ['who', 'which', 'where']]];
      var PERSON = ['helped me', 'lives next door', 'won the race', 'wrote the book', 'teaches us', 'called you', 'fixed the car', 'works here'];
      var THING = ['broke down', 'won the award', 'rang loudly', 'went missing', 'sold out fast', 'made a noise', 'fell off', 'arrived late'];
      var PLACE = ['I was born', 'we first met', 'they got married', 'I grew up', 'we used to live', 'she works now', 'the bus stops', 'we had lunch'];
      var TIME = ['we leave', 'the shops close', 'the show begins', 'we arrived', 'it happened', 'they met', 'the year ends', 'school starts'];
      var POSS = ['work won a prize', 'car was stolen', 'dog ran away', 'house was sold', 'book became famous', 'idea changed things', 'team lost', 'song went viral'];
      PERSON.forEach(function (p) { out.push(withHint(mk("That's the person ____ " + p + '.', 'who', ['which', 'where', 'whose'], 'a person: who.'), H)); });
      THING.forEach(function (p) { out.push(withHint(mk('This is the thing ____ ' + p + '.', 'which', ['who', 'where', 'whose'], 'a thing: which.'), H)); });
      PLACE.forEach(function (p) { out.push(withHint(mk("That's the place ____ " + p + '.', 'where', ['which', 'who', 'whose'], 'a place: where.'), H)); });
      TIME.forEach(function (p) { out.push(withHint(mk("Monday is the day ____ " + p + '.', 'when', ['where', 'which', 'who'], 'a time: when.'), H)); });
      POSS.forEach(function (p) { out.push(withHint(mk('She is the writer ____ ' + p + '.', 'whose', ['who', 'which', 'where'], 'a possession: whose.'), H)); });
      return out;
    },

    'b1p-relative-nd': function () {
      var out = [], H = 'The part between commas adds EXTRA information: is it about a person or a thing? One common little word is not allowed there.';
      var PERSON = ['is a doctor', 'lives in Rome', 'loves jazz', 'speaks five languages', 'runs marathons', 'paints well', 'studies law', 'teaches yoga'];
      var THING = ['I read last week', 'we bought in Paris', 'cost a fortune', 'won an award', 'sits by the lake', 'opened in May', 'closed early', 'looks amazing'];
      var SUBJP = ['My sister', 'My uncle', 'Our teacher', 'My neighbour', 'The author', 'My boss', 'Her cousin', 'The doctor'];
      var SUBJT = ['This book', 'That house', 'The new cafe', 'Her painting', 'The old bridge', 'This phone', 'The museum', 'That film'];
      PERSON.forEach(function (p, i) { out.push(withHint(mk(SUBJP[i] + ', ____ ' + p + ', is well known.', 'who', ['that', 'which', 'what'], 'a person, non-defining: who.'), H)); });
      THING.forEach(function (p, i) { out.push(withHint(mk(SUBJT[i] + ', ____ ' + p + ', is famous now.', 'which', ['that', 'who', 'what'], 'a thing, non-defining: which.'), H)); });
      var POSS = ['My friend', 'The artist', 'Our neighbour', 'The writer', 'My colleague', 'Her brother'];
      var POSSV = ['car was stolen', 'work sold out', 'dog won a prize', 'novel topped the list', 'idea saved us', 'team came first'];
      POSS.forEach(function (p, i) { out.push(withHint(mk(p + ', ____ ' + POSSV[i] + ', was very happy.', 'whose', ['who', 'which', 'that'], 'a possession, non-defining: whose.'), H)); });
      return out;
    },

    'b1p-gerund-infinitive': function () {
      var out = [], H = 'Look at the exact word before the gap: what does THAT word demand after it?';
      var GV = [['enjoy', 'listening to music', 'listen'], ['finish', 'reading the book', 'read'], ['avoid', 'making mistakes', 'make'], ['suggest', 'taking a break', 'take'], ['keep', 'trying hard', 'try'], ['practise', 'speaking English', 'speak'], ['mind', 'waiting here', 'wait'], ['miss', 'seeing friends', 'see']];
      var IV = [['decide', 'leave early', 'leave'], ['hope', 'win the prize', 'win'], ['promise', 'call back', 'call'], ['offer', 'help us', 'help'], ['agree', 'pay the bill', 'pay'], ['manage', 'arrive on time', 'arrive'], ['refuse', 'give up', 'give'], ['plan', 'travel abroad', 'travel']];
      var PV = [['good at', 'playing chess', 'play'], ['interested in', 'learning Italian', 'learn'], ['tired of', 'waiting around', 'wait'], ['keen on', 'cooking', 'cook'], ['afraid of', 'flying', 'fly'], ['fond of', 'reading', 'read'], ['capable of', 'winning', 'win'], ['bad at', 'lying', 'lie']];
      var SUBJ = ['I', 'She', 'We', 'They'];
      function es(v) { return /(s|sh|ch|x|z|o)$/.test(v) ? v + 'es' : v + 's'; }
      function tail(p) { var r = p.split(' ').slice(1).join(' '); return r ? ' ' + r : ''; }
      GV.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ' + (s === 'She' ? es(v[0]) : v[0]) + ' ____' + tail(v[1]) + '.', v[1].split(' ')[0], ['to ' + v[2], v[2], v[2] + 's'], 'this verb takes the -ing form.'), H)); }); });
      IV.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ' + (s === 'She' ? es(v[0]) : v[0]) + ' ____' + tail(v[1]) + '.', 'to ' + v[2], [v[2] + 'ing', v[2], v[2] + 's'], 'this verb takes to + the base verb.'), H)); }); });
      PV.forEach(function (v) { out.push(withHint(mk('She is ' + v[0] + ' ____' + tail(v[1]) + '.', v[1].split(' ')[0], ['to ' + v[2], v[2], v[2] + 's'], 'after a preposition: the -ing form.'), H)); });
      return out;
    },

    'b1p-verb-object': function () {
      var out = [], H = 'Read the pattern: verb, then a person or thing, then the gap. What completes this order?';
      var V = ['want', 'ask', 'tell', 'expect', 'advise', 'remind', 'encourage', 'persuade', 'invite', 'allow'];
      var OB = [['you', 'help me', 'help'], ['him', 'wait outside', 'wait'], ['us', 'arrive early', 'arrive'], ['her', 'join the club', 'join'], ['them', 'be quiet', 'be'], ['the team', 'train harder', 'train'], ['me', 'call back', 'call'], ['the staff', 'stay late', 'stay']];
      var SUBJ = ['I', 'She', 'We', 'They', 'The teacher'];
      OB.forEach(function (o) { V.slice(0, 6).forEach(function (vb) { out.push(withHint(mk(SUBJ[(o[0].length + vb.length) % SUBJ.length] + ' ' + vb + (SUBJ[(o[0].length + vb.length) % SUBJ.length] === 'She' || SUBJ[(o[0].length + vb.length) % SUBJ.length] === 'The teacher' ? 's' : '') + ' ' + o[0] + ' ____ ' + o[1].split(' ').slice(1).join(' ') + '.', 'to ' + o[2], [o[2], o[2] + 'ing', o[2] + 'ed'], 'object + to + base verb.'), H)); }); });
      return out;
    },

    'b2-pres-perf-cont': function () {
      var out = [], H = 'It began in the past and continues now (look for "for" or "since"). Which option shows the action still running?';
      var ING = [['working', 'on the report'], ['studying', 'for the test'], ['waiting', 'in the queue'], ['training', 'for the race'], ['living', 'in Madrid'], ['learning', 'the guitar'], ['painting', 'the flat'], ['saving', 'for a car'], ['running', 'the project'], ['teaching', 'online']];
      var SING = ['She', 'He', 'My colleague', 'The author', 'Tom'];
      var PLUR = ['We', 'They', 'My parents', 'The students', 'You'];
      SING.forEach(function (s) { ING.forEach(function (g) { out.push(withHint(mk(s + ' ____ ' + g[0] + ' ' + g[1] + ' for months.', 'has been', ['have been', 'is been', 'has being'], 'singular subject: has been + -ing.'), H)); }); });
      PLUR.forEach(function (s) { ING.forEach(function (g) { out.push(withHint(mk(s + ' ____ ' + g[0] + ' ' + g[1] + ' for months.', 'have been', ['has been', 'are been', 'have being'], 'I/you/we/they: have been + -ing.'), H)); }); });
      return out;
    },

    'b2-past-perf-cont': function () {
      var out = [], H = 'Look at the order of events: this activity ran for some time, then another past event happened. Which option shows the earlier, ongoing action?';
      var ITEMS = [['waiting', 'for an hour'], ['working', 'since dawn'], ['driving', 'all night'], ['studying', 'for weeks'], ['reading', 'for hours'], ['running', 'for miles'], ['arguing', 'for ages'], ['cooking', 'all morning'], ['travelling', 'for months'], ['practising', 'since June']];
      var SUBJ = ['She', 'They', 'He', 'We', 'The team'];
      ITEMS.forEach(function (g) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ____ ' + g[0] + ' ' + g[1] + ' when it happened.', 'had been', ['has been', 'had being', 'was being'], 'earlier ongoing past: had been + -ing.'), H)); }); });
      return out;
    },

    'b2-future-perfect': function () {
      var out = [], H = 'By that future time the action will already be FINISHED. Which option shows completion?';
      var V = [['finished', 'finish', 'the course'], ['left', 'leave', 'the office'], ['saved', 'save', 'enough'], ['written', 'write', 'the book'], ['built', 'build', 'the house'], ['paid', 'pay', 'the loan'], ['learned', 'learn', 'to drive'], ['retired', 'retire', 'from work'], ['sold', 'sell', 'the flat'], ['arrived', 'arrive', 'home']];
      var SUBJ = ['I', 'She', 'He', 'We', 'They', 'Tom'];
      V.forEach(function (v) { SUBJ.forEach(function (s) { var subj = (s === 'I' || s === 'Tom') ? s : s.toLowerCase(); out.push(withHint(mk('By next year, ' + subj + ' ____ ' + v[2] + '.', 'will have ' + v[0], ['will has ' + v[0], 'will have ' + v[1], 'has ' + v[0]], 'completed before a future point: will have + past participle.'), H)); }); });
      return out;
    },

    'b2-future-continuous': function () {
      var out = [], H = 'At that exact future moment the action will be in the middle of happening.';
      var V = [['flying', 'fly', 'to Tokyo'], ['presenting', 'present', 'the plan'], ['driving', 'drive', 'to work'], ['studying', 'study', 'abroad'], ['working', 'work', 'from home'], ['relaxing', 'relax', 'at the spa'], ['attending', 'attend', 'the meeting'], ['running', 'run', 'the stall'], ['filming', 'film', 'on location'], ['waiting', 'wait', 'at arrivals']];
      var SUBJ = ['I', 'She', 'He', 'We', 'They', 'The crew'];
      V.forEach(function (v) { SUBJ.forEach(function (s) { var subj = (s === 'I') ? 'I' : s.toLowerCase(); out.push(withHint(mk('This time tomorrow, ' + subj + ' ____ ' + v[2] + '.', 'will be ' + v[0], ['will ' + v[1], 'is ' + v[0], 'will be ' + v[1]], 'in progress at a future time: will be + -ing.'), H)); }); });
      return out;
    },

    'b2-conditional-3': function () {
      var out = [], H = 'The sentence imagines a different PAST. Which half holds the gap: the "if" half or the result half?';
      var IFV = [['invested', 'invest', 'sooner'], ['revised', 'revise', 'more'], ['booked', 'book', 'in advance'], ['warned', 'warn', 'us'], ['checked', 'check', 'the map'], ['accepted', 'accept', 'the offer'], ['noticed', 'notice', 'the sign'], ['prepared', 'prepare', 'better']];
      var SUBJ = ['I', 'you', 'she', 'we', 'they'];
      SUBJ.forEach(function (s) { IFV.forEach(function (v) { out.push(withHint(mk('If ' + s + ' ____ ' + v[2] + ', the result would have changed.', 'had ' + v[0], [v[0], 'has ' + v[0], 'would have ' + v[0]], 'after "if": had + past participle.'), H)); }); });
      var RESV = [['succeeded', 'succeed', 'easily'], ['avoided', 'avoid', 'the delay'], ['saved', 'save', 'a fortune'], ['won', 'win', 'the contract'], ['passed', 'pass', 'first time'], ['finished', 'finish', 'on time']];
      var CONDS = ['If we had planned', 'If she had tried', 'If they had listened', 'If you had hurried'];
      CONDS.forEach(function (c) { RESV.forEach(function (rv) { out.push(withHint(mk(c + ', we ____ ' + rv[2] + '.', 'would have ' + rv[0], [rv[0], 'would ' + rv[1], 'had ' + rv[0]], 'result clause: would have + past participle.'), H)); }); });
      return out;
    },

    'b2-mixed-conditional': function () {
      var out = [], H = 'Two times in one sentence: an imagined past and a result NOW. Which time does your gap belong to?';
      var IFV = [['studied', 'study', 'medicine'], ['taken', 'take', 'the job'], ['saved', 'save', 'money'], ['moved', 'move', 'abroad'], ['learned', 'learn', 'to code'], ['invested', 'invest', 'early'], ['listened', 'listen', 'to advice'], ['trained', 'train', 'harder']];
      var SUBJ = ['I', 'you', 'she', 'we', 'they'];
      SUBJ.forEach(function (s) { IFV.forEach(function (v) { out.push(withHint(mk('If ' + s + ' ____ ' + v[2] + ', life would be different now.', 'had ' + v[0], [v[0], 'has ' + v[0], 'would have ' + v[0]], 'unreal past condition: had + past participle.'), H)); }); });
      var RESNOW = [['be', 'a doctor now'], ['be', 'richer today'], ['live', 'in Spain now'], ['have', 'a better job now'], ['speak', 'the language now'], ['own', 'a house now'], ['feel', 'happier now'], ['know', 'the answer now']];
      var CONDS = ['If I had studied harder', 'If she had taken that job', 'If we had saved more', 'If they had moved sooner'];
      RESNOW.forEach(function (r) { CONDS.forEach(function (c) { out.push(withHint(mk(c + ', I ____ ' + r[1] + '.', 'would ' + r[0], ['would have ' + r[0], 'will ' + r[0], 'am ' + r[0]], 'present result: would + base verb.'), H)); }); });
      return out;
    },

    'b2-wish-present': function () {
      var out = [], H = 'The wish is about the situation NOW. Think about how wishes step back in time, then choose.';
      var V = [['knew', 'know', 'the answer'], ['had', 'have', 'more time'], ['lived', 'live', 'closer'], ['spoke', 'speak', 'French'], ['understood', 'understand', 'physics'], ['owned', 'own', 'a flat'], ['earned', 'earn', 'more'], ['remembered', 'remember', 'her name']];
      var WISH = [['I', 'wish', 'I'], ['She', 'wishes', 'she'], ['He', 'wishes', 'he'], ['We', 'wish', 'we'], ['They', 'wish', 'they']];
      WISH.forEach(function (w) { V.forEach(function (v) { out.push(withHint(mk(w[0] + ' ' + w[1] + ' ' + w[2] + ' ____ ' + v[2] + '.', v[0], [v[1], 'will ' + v[1], 'have ' + v[1]], 'wish about now: past simple.'), H)); }); });
      return out;
    },

    'b2-wish-past': function () {
      var out = [], H = 'The regret is about something already over. How far back must the verb step?';
      var V = [['studied', 'study', 'harder'], ['gone', 'go', 'to university'], ['taken', 'take', 'the chance'], ['said', 'say', 'sorry'], ['listened', 'listen', 'to advice'], ['saved', 'save', 'the file'], ['booked', 'book', 'earlier'], ['called', 'call', 'sooner']];
      var WISH = [['I', 'wish', 'I'], ['She', 'wishes', 'she'], ['He', 'wishes', 'he'], ['We', 'wish', 'we'], ['They', 'wish', 'they']];
      WISH.forEach(function (w) { V.forEach(function (v) { out.push(withHint(mk(w[0] + ' ' + w[1] + ' ' + w[2] + ' ____ ' + v[2] + '.', 'had ' + v[0], [v[0], 'have ' + v[0], 'would ' + v[1]], 'wish about the past: past perfect.'), H)); }); });
      return out;
    },

    'b2-modal-passive': function () {
      var out = [], H = 'The subject does not perform the action, and a modal sits in front. What has to come after that modal?';
      var V = [['The work', 'done', 'do', 'today'], ['The form', 'signed', 'sign', 'in ink'], ['The fee', 'paid', 'pay', 'in advance'], ['The food', 'kept', 'keep', 'cold'], ['The badge', 'worn', 'wear', 'at all times'], ['The report', 'sent', 'send', 'by email'], ['The floor', 'cleaned', 'clean', 'daily'], ['The data', 'checked', 'check', 'twice'], ['The book', 'returned', 'return', 'on time'], ['The bill', 'settled', 'settle', 'today']];
      var MOD = ['must', 'should', 'can', 'will'];
      V.forEach(function (v) { MOD.forEach(function (m) { out.push(withHint(mk(v[0] + ' ' + m + ' ____ ' + v[3] + '.', 'be ' + v[1], ['be ' + v[2], 'been ' + v[1], v[2]], 'modal passive: be + past participle.'), H)); }); });
      return out;
    },

    'b2-passive-perfect': function () {
      var out = [], H = 'The subject does not do the action, and the result matters now. Match the helper to the subject.';
      var SING = [['The contract', 'signed'], ['The building', 'completed'], ['The novel', 'translated'], ['The bill', 'paid'], ['The road', 'closed'], ['The match', 'postponed'], ['The system', 'upgraded'], ['The order', 'shipped'], ['The wall', 'repainted'], ['The case', 'solved']];
      var PLUR = [['The contracts', 'signed'], ['The buildings', 'completed'], ['The novels', 'translated'], ['The bills', 'paid'], ['The roads', 'closed'], ['The matches', 'postponed'], ['The systems', 'upgraded'], ['The orders', 'shipped'], ['The walls', 'repainted'], ['The cases', 'solved']];
      SING.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[1] + '.', 'has been', ['have been', 'is been', 'has being'], 'singular subject: has been + past participle.'), H)); });
      PLUR.forEach(function (s) { out.push(withHint(mk(s[0] + ' ____ ' + s[1] + '.', 'have been', ['has been', 'are been', 'have being'], 'plural subject: have been + past participle.'), H)); });
      return out;
    },

    'b2-deduction-past': function () {
      var out = [], H = 'You are judging a past event: how certain are you? Pick the option whose certainty matches.';
      var IT = [
        ['The streets are wet, so it ____ rained.', 'must have', ["can't have", 'might have', 'must had']],
        ['He knew every detail, so he ____ been there.', 'must have', ["can't have", 'might have', 'must had']],
        ['She was abroad, so she ____ seen the show.', "can't have", ['must have', 'might have', "can't had"]],
        ['I am not certain, but they ____ left early.', 'might have', ['must have', "can't have", 'might had']],
        ['The cake is gone, so someone ____ eaten it.', 'must have', ["can't have", 'might have', 'must had']],
        ['He had no key, so he ____ locked the door.', "can't have", ['must have', 'might have', "can't had"]],
        ['Her coat is dry, so she ____ walked here.', "can't have", ['must have', 'might have', "can't had"]],
        ['Perhaps the parcel ____ arrived yesterday.', 'might have', ['must have', "can't have", 'might had']],
        ['The lights were off, so they ____ been asleep.', 'must have', ["can't have", 'might have', 'must had']],
        ['It was warm there, so it ____ snowed.', "can't have", ['must have', 'might have', "can't had"]],
        ['Maybe she ____ forgotten the meeting.', 'might have', ['must have', "can't have", 'might had']],
        ['He looked amazed, so he ____ expected the news.', "can't have", ['must have', 'might have', "can't had"]]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'past deduction: modal + have + past participle.'), H)); });
      return out;
    },

    'b2-past-modals': function () {
      var out = [], H = 'Regret, criticism, or a guess about the past? Match the meaning first.';
      var IT = [
        ['You ____ asked first; it was not yours to take.', 'should have', ['should', 'must have', 'should had']],
        ['They look exhausted; they ____ slept badly.', 'must have', ['must', "can't have", 'must had']],
        ['He was in class, so he ____ made that call.', "can't have", ['must have', "can't", "can't had"]],
        ['We ____ brought an umbrella; we got soaked.', 'should have', ['should', 'must have', 'should had']],
        ['She finished first, so she ____ practised a lot.', 'must have', ['must', "can't have", 'must had']],
        ['You ____ shouted; everyone heard you.', "shouldn't have", ['should have', "shouldn't", "shouldn't had"]],
        ['The keys are inside, so I ____ dropped them here.', "can't have", ['must have', "can't", "can't had"]],
        ['I ____ saved a copy; now the file is gone.', 'should have', ['should', 'must have', 'should had']],
        ['He passed without studying, so he ____ been lucky.', 'must have', ['must', "can't have", 'must had']],
        ['You ____ told them the truth from the start.', 'should have', ['should', 'must have', 'should had']],
        ['She speaks perfect Greek, so she ____ lived there.', 'must have', ['must', "can't have", 'must had']],
        ['We ____ left so late; we missed the start.', "shouldn't have", ['should have', "shouldn't", "shouldn't had"]]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'past modal: modal + have + past participle.'), H)); });
      return out;
    },

    'b2-be-used-to': function () {
      var out = [], H = 'A past habit, or being accustomed to something? Check what follows the gap in the sentence.';
      var V = [['getting', 'get', 'up early'], ['working', 'work', 'long hours'], ['living', 'live', 'alone'], ['driving', 'drive', 'on the left'], ['eating', 'eat', 'late'], ['speaking', 'speak', 'English all day'], ['paying', 'pay', 'by card'], ['waiting', 'wait', 'in traffic'], ['studying', 'study', 'at night'], ['travelling', 'travel', 'for work']];
      var LEAD = ['I am used to ', 'She is used to ', 'They are getting used to ', 'He is not used to ', 'We are used to '];
      V.forEach(function (v) { LEAD.forEach(function (l) { out.push(withHint(mk(l + '____ ' + v[2] + '.', v[0], ['to ' + v[1], v[1], v[1] + 's'], 'be/get used to + the -ing form.'), H)); }); });
      return out;
    },

    'b2-causative': function () {
      var out = [], H = 'Who really does this job? Not the subject. Check the word order such an arrangement needs.';
      var IT = [['the office', 'redecorated', 'redecorate'], ['the contract', 'reviewed', 'review'], ['the logo', 'redesigned', 'redesign'], ['the engine', 'checked', 'check'], ['the suit', 'tailored', 'tailor'], ['the data', 'analysed', 'analyse'], ['the roof', 'repaired', 'repair'], ['the speech', 'translated', 'translate'], ['the garden', 'landscaped', 'landscape'], ['the accounts', 'audited', 'audit']];
      var LEAD = ['The firm had ', 'She got ', 'We had ', 'They got ', 'He had '];
      IT.forEach(function (v) { LEAD.forEach(function (l) { out.push(withHint(mk(l + v[0] + ' ____ last month.', v[1], [v[2], v[2] + 'ing', 'to ' + v[2]], 'causative: the object is followed by the past participle.'), H)); }); });
      return out;
    },

    'b2-reporting-verbs': function () {
      var out = [], H = 'Look at the reporting verb itself: every reporting verb has its own fixed pattern.';
      var SUBJ = ['She', 'He', 'They', 'Tom'];
      var ING = [['suggested', 'taking a taxi', 'take'], ['admitted', 'breaking it', 'break'], ['denied', 'taking the money', 'take'], ['recommended', 'booking early', 'book'], ['mentioned', 'meeting her', 'meet']];
      var TO = [['offered', 'help us', 'help'], ['promised', 'call back', 'call'], ['agreed', 'pay the bill', 'pay'], ['refused', 'answer', 'answer'], ['decided', 'wait', 'wait']];
      var PREP = [['apologised for', 'being late', 'be'], ['accused him of', 'cheating', 'cheat'], ['insisted on', 'paying', 'pay'], ['thanked us for', 'helping', 'help'], ['congratulated her on', 'winning', 'win']];
      function tail(p) { var r = p.split(' ').slice(1).join(' '); return r ? ' ' + r : ''; }
      ING.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ' + v[0] + ' ____' + tail(v[1]) + '.', v[1].split(' ')[0], ['to ' + v[2], v[2], v[2] + 's'], 'this verb takes the -ing form.'), H)); }); });
      TO.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ' + v[0] + ' ____' + tail(v[1]) + '.', 'to ' + v[2], [v[2] + 'ing', v[2], v[2] + 'ed'], 'this verb takes to + the base verb.'), H)); }); });
      PREP.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ' + v[0] + ' ____' + tail(v[1]) + '.', v[1].split(' ')[0], ['to ' + v[2], v[2], v[2] + 's'], 'a preposition takes the -ing form.'), H)); }); });
      return out;
    },

    'b2-reported-speech': function () {
      var out = [], H = 'You are reporting words said earlier: what usually happens to the time of the verb?';
      var IT = [
        ["'I am feeling ill,' she said. -> She said she ____ feeling ill.", 'was', ['is', 'are', 'will be']],
        ["'I have already eaten,' he told us. -> He told us he ____ already eaten.", 'had', ['has', 'have', 'will']],
        ["'We will arrive by six,' they said. -> They said they ____ arrive by six.", 'would', ['will', 'are', 'have']],
        ["'I do not agree,' she explained. -> She explained that she ____ not agree.", 'did', ['does', 'is', 'will']],
        ["'I have been waiting for ages,' he said. -> He said he ____ been waiting for ages.", 'had', ['has', 'have', 'is']],
        ["'Prices have risen,' she mentioned. -> She mentioned that prices ____ risen.", 'had', ['have', 'has', 'will']],
        ["'We have seen nothing,' they claimed. -> They claimed they ____ seen nothing.", 'had', ['have', 'has', 'did']],
        ["'I have broken the vase,' he admitted. -> He admitted he ____ broken the vase.", 'had', ['has', 'have', 'was']],
        ["'The train has been delayed,' she said. -> She said the train ____ been delayed.", 'had', ['has', 'have', 'is']],
        ["'I will call the next day,' he noted. -> He noted that he ____ call the next day.", 'would', ['will', 'is', 'has']],
        ["'I am working there,' she said. -> She said she ____ working there then.", 'was', ['is', 'has', 'will be']],
        ["'We will help if needed,' they said. -> They said they ____ help if needed.", 'would', ['will', 'are', 'have']]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'reported speech: shift the tense back.'), H)); });
      return out;
    },

    'b2-ger-inf-meaning': function () {
      var out = [], H = 'With this verb the two forms mean different things: looking BACK at something done, or FORWARD to a task?';
      var IT = [
        ['Remember ____ the door when you leave later.', 'to lock', ['locking', 'lock', 'locked']],
        ['I clearly remember ____ the door this morning.', 'locking', ['to lock', 'lock', 'locked']],
        ['He stopped ____ because his legs hurt.', 'walking', ['to walk', 'walk', 'walked']],
        ['On the way, we stopped ____ some petrol.', 'to get', ['getting', 'get', 'got']],
        ['She forgot ____ the email, so it never arrived.', 'to send', ['sending', 'send', 'sent']],
        ['I will never forget ____ the Alps for the first time.', 'seeing', ['to see', 'see', 'saw']],
        ['We regret ____ you that the trip is full.', 'to tell', ['telling', 'tell', 'told']],
        ['He regrets ____ school so young.', 'leaving', ['to leave', 'leave', 'left']],
        ['We tried ____ the window, but it was stuck.', 'to open', ['opening', 'open', 'opened']],
        ['If you are tired, try ____ some water.', 'drinking', ['to drink', 'drink', 'drank']],
        ['She went on ____ for another hour without a break.', 'working', ['to work', 'work', 'worked']],
        ['After the intro, he went on ____ the results.', 'to present', ['presenting', 'present', 'presented']]];
      IT.forEach(function (q) { out.push(withHint(mk(q[0], q[1], q[2], 'meaning depends on -ing (looking back) vs to + base (looking forward).'), H)); });
      return out;
    },

    'b2-so-such-unless': function () {
      var out = [], H = 'What follows the gap: a describing word, a whole noun phrase, or a condition?';
      var SO = ['cold', 'tired', 'late', 'expensive', 'loud', 'busy', 'quickly', 'well'];
      SO.forEach(function (a) { out.push(withHint(mk('It was ____ ' + a + ' that we noticed at once.', 'so', ['such', 'such a', 'very much'], 'so + adjective or adverb.'), H)); });
      var SUCH = ['a cold day', 'a long film', 'nice people', 'a good meal', 'bad weather', 'a kind man', 'heavy traffic', 'a loud noise'];
      SUCH.forEach(function (n) { out.push(withHint(mk('It was ____ ' + n + ' that we remembered it.', 'such', ['so', 'very', 'too'], 'such + a noun phrase.'), H)); });
      var UNL = [['I will be on time', 'the train is delayed'], ['We will eat outside', 'it rains'], ['She will pass', 'she stops revising'], ['The shop stays open', 'it is a holiday'], ['We will walk', 'it gets too dark'], ['He will help', 'he is too busy'], ['They will win', 'they get injured'], ['I will call you', 'I forget']];
      UNL.forEach(function (c) { out.push(withHint(mk(c[0] + ' ____ ' + c[1] + '.', 'unless', ['so', 'such', 'very'], 'unless means "if not".'), H)); });
      return out;
    },

    'b2-gerund-review': function () {
      var out = [], H = 'The word right before the gap decides everything. What is that word, and what does it demand?';
      var GV = [['avoid', 'making errors', 'make'], ['consider', 'moving abroad', 'move'], ['imagine', 'living there', 'live'], ['delay', 'paying the bill', 'pay'], ['risk', 'losing it all', 'lose'], ['practise', 'speaking daily', 'speak']];
      var IV = [['afford', 'buy a car', 'buy'], ['arrange', 'meet later', 'meet'], ['fail', 'reach the top', 'reach'], ['hesitate', 'ask for help', 'ask'], ['tend', 'arrive late', 'arrive'], ['threaten', 'leave the firm', 'leave']];
      var PV = [['capable of', 'winning', 'win'], ['fond of', 'reading', 'read'], ['afraid of', 'failing', 'fail'], ['good at', 'cooking', 'cook'], ['interested in', 'learning', 'learn'], ['keen on', 'cycling', 'cycle'], ['tired of', 'waiting', 'wait'], ['used to', 'driving here', 'drive']];
      var SUBJ = ['I', 'She', 'We', 'They'];
      function tail(p) { var r = p.split(' ').slice(1).join(' '); return r ? ' ' + r : ''; }
      GV.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ' + (s === 'She' ? v[0] + 's' : v[0]) + ' ____' + tail(v[1]) + '.', v[1].split(' ')[0], ['to ' + v[2], v[2], v[2] + 's'], 'this verb takes the -ing form.'), H)); }); });
      IV.forEach(function (v) { SUBJ.forEach(function (s) { out.push(withHint(mk(s + ' ' + (s === 'She' ? v[0] + 's' : v[0]) + ' ____' + tail(v[1]) + '.', 'to ' + v[2], [v[2] + 'ing', v[2], v[2] + 's'], 'this verb takes to + the base verb.'), H)); }); });
      PV.forEach(function (v) { out.push(withHint(mk('She is ' + v[0] + ' ____' + tail(v[1]) + '.', v[1].split(' ')[0], ['to ' + v[2], v[2], v[2] + 's'], 'after a preposition: the -ing form.'), H)); });
      return out;
    }
  };

  // ── FIXED, hand-authored question banks ──────────────────────
  // Replaces the template GENERATORS (which produced wrong carriers like
  // "We are a teacher" and mismatched explanations). When a topic id has a
  // FIXED entry, assembly uses it instead of the generator. Authored level by
  // level; un-converted topics still fall back to their generator. mk() shuffles
  // options + sets the answer index; build() dedupes + pads to 4.

  // ── A2 topic skeleton (id, title, blurb=Unit, generator, cap) ─
  var A2_SPEC = [
    { id: 'a2-be', title: 'be: am / is / are', blurb: 'Unit 1 · positive and negative' },
    { id: 'a2-be-questions', title: 'be: questions', blurb: 'Unit 1 · questions and short answers' },
    { id: 'a2-a-an', title: 'a / an', blurb: 'Unit 1 · indefinite article' },
    { id: 'a2-plurals', title: 'Plural nouns', blurb: 'Unit 1 · regular and irregular' },
    { id: 'a2-possessives', title: "Possessives (my / 's)", blurb: 'Units 1 and 5 · possessive adjectives and ’s' },
    { id: 'a2-question-words', title: 'Question words', blurb: 'Unit 1 · what / where / when / who' },
    { id: 'a2-present-simple', title: 'Present Simple', blurb: 'Unit 2 · positive and negative' },
    { id: 'a2-present-simple-q', title: 'Present Simple: questions', blurb: 'Unit 2 · do / does' },
    { id: 'a2-adv-frequency', title: 'Adverbs of frequency', blurb: 'Unit 3 · always, usually, never' },
    { id: 'a2-have-got', title: 'have got', blurb: 'Unit 3 · possession' },
    { id: 'a2-some-any', title: 'some / any', blurb: 'Unit 4 · countable and uncountable' },
    { id: 'a2-much-many', title: 'much / many', blurb: 'Unit 4 · quantifiers' },
    { id: 'a2-there-is-are', title: 'there is / there are', blurb: 'Unit 5 · places' },
    { id: 'a2-was-were', title: 'was / were', blurb: 'Unit 6 · past of be' },
    { id: 'a2-past-simple', title: 'Past Simple', blurb: 'Unit 7 · positive (regular and irregular)' },
    { id: 'a2-past-simple-q', title: 'Past Simple: questions', blurb: 'Unit 7 · negative and questions' },
    { id: 'a2-like-ing', title: 'like / love / hate + -ing', blurb: 'Unit 7 · verb + -ing' },
    { id: 'a2-can-could', title: 'can / could (ability)', blurb: 'Unit 8 · ability now and past' },
    { id: 'a2-have-to', title: "have to / don't have to", blurb: 'Unit 8 · obligation' },
    { id: 'a2-present-continuous', title: 'Present Continuous', blurb: 'Unit 9 · happening now' },
    { id: 'a2-simple-vs-continuous', title: 'Present Simple or Continuous', blurb: 'Unit 9 · routine vs now' },
    { id: 'a2-comparatives', title: 'Comparative Adjectives', blurb: 'Unit 10 · -er / more ... than' },
    { id: 'a2-superlatives', title: 'Superlative Adjectives', blurb: 'Unit 10 · the -est / the most' },
    { id: 'a2-present-perfect', title: 'Present Perfect', blurb: 'Unit 11 · have / has + past participle' },
    { id: 'a2-pp-vs-past', title: 'Present Perfect or Past Simple', blurb: 'Unit 11 · finished time or not' }
  ];

  var A2 = A2_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: VALID[t.id] ? buildValidated(VALID[t.id](), 104) : [] };
  });

  // ── B1 generators (reuse the A2 engine: mk / build / pools) ──

  // ── B1 unit skeleton (reuses some A2 generators for shared points) ──
  var B1_SPEC = [
    { id: 'b1-present-cont', title: 'Present Simple or Continuous', blurb: 'Unit 1 · routine vs now' },
    { id: 'b1-question-forms', title: 'Question forms', blurb: 'Unit 1 · do / does + question words' },
    { id: 'b1-past-continuous', title: 'Past Continuous', blurb: 'Unit 2 · was / were + -ing' },
    { id: 'b1-used-to', title: 'used to', blurb: 'Unit 2 · past habits' },
    { id: 'b1-present-perfect', title: 'Present Perfect', blurb: 'Unit 3 · have / has + past participle' },
    { id: 'b1-pp-vs-past', title: 'Present Perfect or Past Simple', blurb: 'Unit 3 · finished time or not' },
    { id: 'b1-future-will-going', title: 'will / won\'t', blurb: 'Unit 4 · predictions and decisions' },
    { id: 'b1-future-plans', title: 'going to', blurb: 'Unit 4 · plans and intentions' },
    { id: 'b1-modals-obligation', title: 'must / have to / should', blurb: 'Unit 5 · obligation and advice' },
    { id: 'b1-modals-possibility', title: 'might / can', blurb: 'Unit 5 · possibility and ability' },
    { id: 'b1-conditional-1', title: 'First Conditional', blurb: 'Unit 6 · if + present, will' },
    { id: 'b1-conditional-2', title: 'Second Conditional', blurb: 'Unit 6 · if + past, would' },
    { id: 'b1-comparatives', title: 'Comparatives', blurb: 'Unit 7 · -er / more ... than' },
    { id: 'b1-too-enough', title: 'too / enough', blurb: 'Unit 7 · degree' },
    { id: 'b1-quantifiers', title: 'much / many', blurb: 'Unit 8 · quantifiers' },
    { id: 'b1-a-few-little', title: 'a few / a little', blurb: 'Unit 8 · countable and uncountable' },
    { id: 'b1-passive-present', title: 'Present Passive', blurb: 'Unit 9 · is / are + past participle' },
    { id: 'b1-passive-past', title: 'Past Passive', blurb: 'Unit 9 · was / were + past participle' },
    { id: 'b1-relative-clauses', title: 'Relative Clauses', blurb: 'Unit 10 · who / which / where / whose' },
    { id: 'b1-gerund-infinitive', title: 'Gerund or Infinitive', blurb: 'Unit 10 · verb + -ing / to' }
  ];
  var B1 = B1_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: VALID[t.id] ? buildValidated(VALID[t.id](), 104) : [] };
  });

  // ── B1+ generators (reuse engine; upper-intermediate points) ──

  // ── B1+ unit skeleton (reuses some A2/B1 generators for review) ──
  var B1PLUS_SPEC = [
    { id: 'b1p-pres-perf-cont', title: 'Present Perfect Continuous', blurb: 'Unit 1 · have been + -ing' },
    { id: 'b1p-present-perfect', title: 'Present Perfect', blurb: 'Unit 1 · have / has + past participle' },
    { id: 'b1p-past-perfect', title: 'Past Perfect', blurb: 'Unit 2 · had + past participle' },
    { id: 'b1p-past-continuous', title: 'Past Continuous', blurb: 'Unit 2 · was / were + -ing' },
    { id: 'b1p-future-continuous', title: 'Future Continuous', blurb: 'Unit 3 · will be + -ing' },
    { id: 'b1p-future', title: 'Future: will', blurb: 'Unit 3 · predictions and decisions' },
    { id: 'b1p-deduction', title: 'Modals of Deduction', blurb: "Unit 4 · must / can't / might be" },
    { id: 'b1p-past-modals', title: 'Past Modals', blurb: 'Unit 4 · should have / must have' },
    { id: 'b1p-conditional-3', title: 'Third Conditional', blurb: 'Unit 5 · if + past perfect, would have' },
    { id: 'b1p-wish', title: 'wish / if only', blurb: 'Unit 5 · unreal present' },
    { id: 'b1p-passive-perfect', title: 'Present Perfect Passive', blurb: 'Unit 6 · has / have been + past participle' },
    { id: 'b1p-causative', title: 'Causative have', blurb: 'Unit 6 · have something done' },
    { id: 'b1p-reported', title: 'Reported Speech', blurb: 'Unit 7 · statements' },
    { id: 'b1p-reported-q', title: 'Reported Questions', blurb: 'Unit 7 · questions' },
    { id: 'b1p-relative', title: 'Relative Clauses', blurb: 'Unit 8 · who / which / where / whose' },
    { id: 'b1p-relative-nd', title: 'Non-defining Relatives', blurb: 'Unit 8 · with commas' },
    { id: 'b1p-gerund-infinitive', title: 'Gerund or Infinitive', blurb: 'Unit 9 · verb + -ing / to' },
    { id: 'b1p-verb-object', title: 'Verb + Object + to', blurb: 'Unit 9 · want someone to do' }
  ];
  var B1PLUS = B1PLUS_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: VALID[t.id] ? buildValidated(VALID[t.id](), 104) : [] };
  });

  // ── B2 generators (advanced points; reuse engine + pools) ──

  // ── B2 unit skeleton (new points + targeted review) ────────
  var B2_SPEC = [
    { id: 'b2-pres-perf-cont', title: 'Present Perfect Continuous', blurb: 'Unit 1 · have been + -ing' },
    { id: 'b2-past-perf-cont', title: 'Past Perfect Continuous', blurb: 'Unit 1 · had been + -ing' },
    { id: 'b2-future-perfect', title: 'Future Perfect', blurb: 'Unit 2 · will have + past participle' },
    { id: 'b2-future-continuous', title: 'Future Continuous', blurb: 'Unit 2 · will be + -ing' },
    { id: 'b2-conditional-3', title: 'Third Conditional', blurb: 'Unit 3 · if + past perfect, would have' },
    { id: 'b2-mixed-conditional', title: 'Mixed Conditionals', blurb: 'Unit 3 · past condition, present result' },
    { id: 'b2-wish-past', title: 'wish + past perfect', blurb: 'Unit 4 · regrets about the past' },
    { id: 'b2-wish-present', title: 'wish / if only', blurb: 'Unit 4 · unreal present' },
    { id: 'b2-modal-passive', title: 'Modal Passives', blurb: 'Unit 5 · must / can / should + be done' },
    { id: 'b2-passive-perfect', title: 'Perfect Passive', blurb: 'Unit 5 · has / have been + done' },
    { id: 'b2-deduction-past', title: 'Past Deduction', blurb: "Unit 6 · must / can't / might have done" },
    { id: 'b2-past-modals', title: 'Past Modals', blurb: 'Unit 6 · should have / must have' },
    { id: 'b2-be-used-to', title: 'used to vs be used to', blurb: 'Unit 7 · habits and adaptation' },
    { id: 'b2-causative', title: 'Causative have', blurb: 'Unit 7 · have something done' },
    { id: 'b2-reporting-verbs', title: 'Reporting Verbs', blurb: 'Unit 8 · offer / deny / suggest / admit' },
    { id: 'b2-reported-speech', title: 'Reported Speech', blurb: 'Unit 8 · tense backshift' },
    { id: 'b2-ger-inf-meaning', title: 'stop / remember / try + -ing or to', blurb: 'Unit 9 · meaning changes' },
    { id: 'b2-so-such-unless', title: 'so / such + unless / in case', blurb: 'Unit 9 · emphasis and condition' },
    { id: 'b2-gerund-review', title: 'Gerund or Infinitive: review', blurb: 'Unit 9 · verb + -ing / to' }
  ];
  var B2 = B2_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: VALID[t.id] ? buildValidated(VALID[t.id](), 104) : [] };
  });

  window.GRAMMAR_PRACTICE = {
    levels: ['A2', 'B1', 'B1+', 'B2', 'C1'],
    byLevel: { 'A2': A2, 'B1': B1, 'B1+': B1PLUS, 'B2': B2 }
  };
})();
