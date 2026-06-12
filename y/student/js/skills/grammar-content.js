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
  var G = {};

  G.be = function () {
    var out = [], SUB = ['I', 'You', 'We', 'They', 'He', 'She', 'Tom', 'Anna', 'My brother', 'The teacher', 'My parents', 'The students', 'My sister', 'The dog'];
    var COMP = ['a student', 'from Italy', 'at home', 'very tired', 'happy today', 'a teacher', 'really busy', 'ready now', 'late again', 'in the garden', 'hungry', 'from Spain', 'a good friend', 'here'];
    SUB.forEach(function (s) { COMP.forEach(function (c) { out.push(mk(s + ' ____ ' + c + '.', beOf(s), ['am', 'is', 'are', 'be'], 'I -> am; he/she/it -> is; you/we/they -> are.')); }); });
    return out;
  };
  G.beQ = function () {
    var out = [], SUB = ['I', 'you', 'we', 'they', 'he', 'she', 'Tom', 'your friends', 'the children', 'your sister', 'the food', 'the shops', 'the students', 'your teacher'];
    var COMP = ['ready?', 'at home?', 'tired?', 'a doctor?', 'from Brazil?', 'happy now?', 'here?', 'late?', 'open?', 'hungry?', 'busy today?', 'at work?', 'American?', 'OK?'];
    SUB.forEach(function (s) { COMP.forEach(function (c) { out.push(mk('____ ' + s + ' ' + c, cap(beOf(s)), ['Am', 'Is', 'Are', 'Be'], 'Am with I, Is with he/she/it, Are with you/we/they.')); }); });
    return out;
  };
  G.aan = function () {
    var out = [];
    var A = ['dog', 'car', 'book', 'pen', 'house', 'cat', 'banana', 'teacher', 'boy', 'girl', 'phone', 'table', 'sandwich', 'bottle', 'student', 'university', 'European city', 'one-way street', 'user', 'useful book'];
    var AN = ['orange', 'apple', 'egg', 'hour', 'umbrella', 'idea', 'elephant', 'old car', 'honest man', 'animal', 'aunt', 'engineer', 'artist', 'island', 'interesting film', 'easy question', 'English book', 'open window', 'angry dog', 'expensive bag'];
    var FR = ['It is ____ %.', 'This is ____ %.', 'That is ____ %.', 'Here is ____ %.', 'I have ____ %.', 'There is ____ % over there.', 'Look at ____ %.', 'It was ____ %.'];
    A.forEach(function (n) { FR.forEach(function (f) { out.push(mk(f.replace('%', n), 'a', ['an', 'two', 'these'], 'Use a before a consonant sound, an before a vowel sound.')); }); });
    AN.forEach(function (n) { FR.forEach(function (f) { out.push(mk(f.replace('%', n), 'an', ['a', 'two', 'these'], 'Use an before a vowel sound, a before a consonant sound.')); }); });
    return out;
  };
  G.plurals = function () {
    var out = [];
    var N = [{ s: 'book', p: 'books' }, { s: 'car', p: 'cars' }, { s: 'pen', p: 'pens' }, { s: 'table', p: 'tables' }, { s: 'dog', p: 'dogs' }, { s: 'house', p: 'houses' }, { s: 'apple', p: 'apples' }, { s: 'girl', p: 'girls' }, { s: 'boy', p: 'boys' }, { s: 'day', p: 'days' }, { s: 'key', p: 'keys' }, { s: 'chair', p: 'chairs' },
      { s: 'box', p: 'boxes' }, { s: 'bus', p: 'buses' }, { s: 'glass', p: 'glasses' }, { s: 'watch', p: 'watches' }, { s: 'dish', p: 'dishes' }, { s: 'class', p: 'classes' }, { s: 'brush', p: 'brushes' }, { s: 'tomato', p: 'tomatoes' }, { s: 'potato', p: 'potatoes' }, { s: 'sandwich', p: 'sandwiches' },
      { s: 'baby', p: 'babies' }, { s: 'city', p: 'cities' }, { s: 'country', p: 'countries' }, { s: 'family', p: 'families' }, { s: 'party', p: 'parties' }, { s: 'story', p: 'stories' }, { s: 'lady', p: 'ladies' }, { s: 'dictionary', p: 'dictionaries' },
      { s: 'child', p: 'children' }, { s: 'man', p: 'men' }, { s: 'woman', p: 'women' }, { s: 'foot', p: 'feet' }, { s: 'tooth', p: 'teeth' }, { s: 'mouse', p: 'mice' }];
    var FR = ['one %s, two ____.', 'one %s, many ____.', 'I have one %s and she has three ____.', 'There is one %s and four ____ here.'];
    function distr(n) { return uniq([n.s + 's', n.s + 'es', n.s + 'ies', n.s].filter(function (x) { return x !== n.p; })).slice(0, 3); }
    N.forEach(function (n) { FR.forEach(function (f) { out.push(mk(f.replace('%s', n.s), n.p, distr(n), 'Most add -s; after -s/x/ch/sh add -es; consonant+y -> -ies; some are irregular.')); }); });
    return out;
  };
  G.poss = function () {
    var out = [];
    // Distractors stay in the SAME person (her / hers / she), so no second
    // person's pronoun can also fit the sentence.
    var ADJP = [
      ["This is Anna. That is ____ bag.", "her", ["she", "hers", "herself"]],
      ["This is Tom. That is ____ coat.", "his", ["him", "he", "himself"]],
      ["I have a dog. ____ name is Rex.", "Its", ["It's", "It", "Itself"]],
      ["We have a new car. ____ colour is red.", "Its", ["It's", "It", "Itself"]],
      ["Don't forget ____ keys, please.", "your", ["you", "yours", "you're"]],
      ["They love ____ new house.", "their", ["theirs", "them", "they're"]],
      ["I can't find ____ phone. It was in my pocket.", "my", ["mine", "me", "I"]],
      ["He is washing ____ own car.", "his", ["him", "he", "himself"]],
      ["She is reading ____ favourite book again.", "her", ["hers", "she", "herself"]],
      ["We are doing ____ homework together.", "our", ["ours", "us", "we"]],
      ["The cat is sleeping in ____ basket.", "its", ["it's", "it", "itself"]],
      ["You and Sam forgot ____ tickets at home.", "your", ["yours", "you", "you're"]],
      ["My parents sold ____ old house and moved.", "their", ["theirs", "them", "they're"]],
      ["I really like ____ new haircut. The barber did a great job.", "my", ["mine", "me", "I"]]
    ];
    ADJP.forEach(function (a) { out.push(mk(a[0], a[1], a[2], 'Possessive adjectives go before a noun: my, your, his, her, its, our, their.')); });
    var OWN = ['Anna', 'Tom', 'Sam', 'my sister', 'the teacher', 'my friend', 'the doctor', 'Mary', 'my brother', 'the boy'];
    var TH = ['book', 'car', 'bag', 'house', 'idea', 'phone', 'dog', 'office', 'desk', 'coat'];
    OWN.forEach(function (o) { TH.forEach(function (t) { out.push(mk('This ' + t + ' belongs to ' + o + '. It is ____ ' + t + '.', o + "'s", [o + 's', o + "s'", o], "Add 's to a person to show possession: Tom's car.")); }); });
    return out;
  };
  G.qw = function () {
    var out = [], WORDS = ['What', 'Where', 'When', 'Who', 'Why', 'How'];
    // Each question carries its short answer, so only ONE question word fits.
    var BY = {
      'What': ['____ is your name? Maria.', '____ is your favourite colour? Blue.', '____ do you want for dinner? Pasta, please.', '____ does she do at weekends? She plays tennis.', '____ is the time? Half past two.', '____ is your phone number? 555 0192.', '____ is in the box? Some old books.', '____ are you reading? A history book.'],
      'Where': ['____ do you live? In Istanbul.', '____ is the station? Next to the bank.', '____ are my keys? On the table.', '____ does he work? In a hospital.', '____ are you going? To the library.', '____ is the nearest bank? On King Street.', '____ did you buy that? At the market.'],
      'When': ['____ is your birthday? In May.', '____ does the film start? At eight.', '____ do you get up? At seven o\'clock.', '____ is the meeting? On Monday.', '____ did they arrive? Two hours ago.', '____ does the shop close? At nine in the evening.'],
      'Who': ['____ is that woman? My aunt.', '____ is your teacher? Mr Lee.', '____ wants an ice cream? I do!', '____ are those people? Our new neighbours.', '____ made this cake? My grandmother.', '____ is calling you? My brother.'],
      'Why': ['____ are you sad? Because I lost my keys.', '____ is the baby crying? Because she is hungry.', '____ did you leave early? Because I was tired.', '____ are they angry? Because the bus was late.'],
      'How': ['____ old are you? Nineteen.', '____ are you today? Fine, thanks.', '____ do you spell it? B-O-O-K.', '____ much is this? Ten lira.']
    };
    Object.keys(BY).forEach(function (w) { BY[w].forEach(function (stem) { out.push(mk(stem, w, shuffle(WORDS.filter(function (x) { return x !== w; })).slice(0, 3), 'what (thing), where (place), when (time), who (person), why (reason), how (manner).')); }); });
    return out;
  };

  G.presSimple = function () {
    var out = [], ROUT = ['every day', 'every morning', 'on Mondays', 'every weekend', 'twice a week', 'after class'];
    SING3.forEach(function (s) { V.forEach(function (v) { out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(ROUT) + '.', v.s, [v.b, v.ing, 'to ' + v.b], 'he/she/it adds -s in the present simple.')); }); });
    BASE_SUBJ.forEach(function (s) { V.forEach(function (v) { out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(ROUT) + '.', v.b, [v.s, v.ing, 'to ' + v.b], 'I/you/we/they use the base form (no -s).')); }); });
    SING3.slice(0, 8).forEach(function (s) { V.slice(0, 12).forEach(function (v) { out.push(mk(s + " ____ usually " + v.b + ' ' + v.o + '.', "doesn't", ["don't", "isn't", "aren't"], "he/she/it negative: doesn't + base verb.")); }); });
    BASE_SUBJ.slice(0, 6).forEach(function (s) { V.slice(0, 12).forEach(function (v) { out.push(mk(s + " ____ usually " + v.b + ' ' + v.o + '.', "don't", ["doesn't", "isn't", "aren't"], "I/you/we/they negative: don't + base verb.")); }); });
    return out;
  };
  G.presSimpleQ = function () {
    var out = [], SUBJ_Q = ['you', 'we', 'they', 'he', 'she', 'Tom', 'your friends', 'the students', 'your sister', 'the teacher'];
    var WH = ['Where', 'When', 'Why', 'How often', 'What time'];
    SUBJ_Q.forEach(function (s) { V.forEach(function (v) { var d = cap(doOf(s)); out.push(mk('____ ' + s + ' ' + v.b + ' ' + v.o + ' ' + pick(['every day', 'every morning', 'on Sundays', 'every week']) + '?', d, d === 'Do' ? ['Does', 'Are', 'Is'] : ['Do', 'Is', 'Are'], 'Do with you/we/they, Does with he/she/it; the main verb stays in the base form.')); }); });
    SUBJ_Q.forEach(function (s) { V.slice(0, 12).forEach(function (v) { var d = doOf(s); out.push(mk(pick(WH) + ' ____ ' + s + ' ' + v.b + '?', d, d === 'do' ? ['does', 'is', 'are'] : ['do', 'are', 'is'], 'Question word + do/does + subject + base verb.')); }); });
    return out;
  };

  G.freq = function () {
    var out = [], ADV = ['always', 'usually', 'often', 'sometimes', 'never', 'rarely'];
    SING3.forEach(function (s) { V.slice(0, 12).forEach(function (v) { ADV.forEach(function (a) { out.push(mk(s + ' ____ ' + v.o + '.', a + ' ' + v.s, [v.s + ' ' + a, 'is ' + a + ' ' + v.s, a + ' ' + v.b], 'Frequency adverbs go before the main verb.')); }); }); });
    BASE_SUBJ.forEach(function (s) { V.slice(0, 12).forEach(function (v) { ADV.forEach(function (a) { out.push(mk(s + ' ____ ' + v.o + '.', a + ' ' + v.b, [v.b + ' ' + a, 'are ' + a + ' ' + v.b, a + ' ' + v.s], 'Frequency adverbs go before the main verb.')); }); }); });
    var BES = [['He', 'is'], ['She', 'is'], ['Tom', 'is'], ['I', 'am'], ['They', 'are'], ['We', 'are'], ['You', 'are'], ['My friends', 'are']];
    var COMP = ['late', 'tired', 'happy', 'busy', 'at home', 'friendly', 'quiet', 'early'];
    BES.forEach(function (p) { COMP.forEach(function (c) { ADV.forEach(function (a) { out.push(mk(p[0] + ' ____ ' + c + '.', p[1] + ' ' + a, [a + ' ' + p[1], a, p[1]], 'With be, the adverb goes after it: is never late.')); }); }); });
    return out;
  };
  G.haveGot = function () {
    var out = [], NOUN = ['a new bike', 'two sisters', 'a big house', 'brown eyes', 'a headache', 'long hair', 'a dog', 'three children', 'a fast car', 'blue eyes', 'a brother', 'many friends', 'a sister', 'a cat', 'short hair', 'a bike', 'a problem', 'a good idea'];
    SUBJ_ALL.forEach(function (s) { NOUN.forEach(function (n) { var h = haveOf(s); out.push(mk(s + ' ____ got ' + n + '.', h, [h === 'have' ? 'has' : 'have', beOf(s), doOf(s)], 'I/you/we/they have got; he/she/it has got.')); }); });
    ['you', 'he', 'she', 'they', 'Tom', 'your sister', 'the children'].forEach(function (s) { NOUN.slice(0, 8).forEach(function (n) { var h = cap(haveOf(s)); out.push(mk('____ ' + s + ' got ' + n + '?', h, [h === 'Have' ? 'Has' : 'Have', 'Do', 'Are'], 'Questions: Have/Has + subject + got ...?')); }); });
    var NEG = ['any brothers', 'any sisters', 'any pets', 'any money', 'any free time', 'a garden', 'any children', 'any homework'];
    SUBJ_ALL.slice(0, 10).forEach(function (s) { NEG.forEach(function (n) { var neg = (haveOf(s) === 'have' ? "haven't" : "hasn't"); out.push(mk(s + ' ____ got ' + n + '.', neg, [neg === "haven't" ? "hasn't" : "haven't", "don't", "isn't"], "Negative: haven't got / hasn't got.")); }); });
    return out;
  };

  G.someAny = function () {
    var out = [];
    var UNC = ['water', 'money', 'milk', 'bread', 'rice', 'sugar', 'coffee', 'cheese', 'time', 'homework', 'music', 'butter', 'juice', 'soup'];
    var PLU = ['eggs', 'apples', 'books', 'friends', 'chairs', 'oranges', 'problems', 'ideas', 'shops', 'cars', 'flowers', 'stamps', 'letters', 'biscuits'];
    function sa(stem, correct) { out.push(mk(stem, correct, correct === 'some' ? ['any', 'a', 'an'] : ['some', 'a', 'an'], 'some in positives and offers; any in negatives and questions.')); }
    UNC.forEach(function (n) { sa('There is ____ ' + n + ' in the fridge.', 'some'); sa("There isn't ____ " + n + ' left.', 'any'); sa('Is there ____ ' + n + ' in the cup?', 'any'); sa('I would like ____ ' + n + ', please.', 'some'); });
    PLU.forEach(function (n) { sa('There are ____ ' + n + ' on the table.', 'some'); sa("There aren't ____ " + n + ' here.', 'any'); sa('Are there ____ ' + n + ' in the box?', 'any'); sa('I have ____ ' + n + ' for you.', 'some'); });
    return out;
  };
  G.muchMany = function () {
    var out = [];
    var UNC = ['water', 'money', 'milk', 'time', 'sugar', 'coffee', 'rice', 'bread', 'homework', 'information', 'cheese', 'salt'];
    var PLU = ['books', 'friends', 'people', 'cars', 'eggs', 'apples', 'students', 'chairs', 'shops', 'ideas', 'problems', 'photos'];
    UNC.forEach(function (n) { out.push(mk('How ____ ' + n + ' do you need?', 'much', ['many', 'a few', 'several'], 'much + uncountable noun.')); out.push(mk("There isn't ____ " + n + ' left.', 'much', ['many', 'a few', 'several'], 'much in negatives with uncountable nouns.')); out.push(mk("We don't have ____ " + n + '.', 'much', ['many', 'a few', 'several'], 'much + uncountable noun in negatives.')); });
    PLU.forEach(function (n) { out.push(mk('How ____ ' + n + ' do you have?', 'many', ['much', 'a little', 'a bit of'], 'many + plural countable noun.')); out.push(mk("There aren't ____ " + n + ' here.', 'many', ['much', 'a little', 'a bit of'], 'many + plural countable noun.')); out.push(mk("We don't have ____ " + n + '.', 'many', ['much', 'a little', 'a bit of'], 'many + plural countable noun in negatives.')); });
    return out;
  };

  G.there = function () {
    var out = [];
    // Curated noun + place pairs (no random cross-products, so no
    // "four men in the fridge"). Every stem carries a TIME EXPRESSION,
    // because the options mix present (is/are) and past (was/were):
    // the time word tells the student which tense is needed.
    var NOW = ['right now', 'now', 'today', 'at the moment'];
    var THEN = ['yesterday', 'last night', 'this morning', 'last week'];
    var SINGP = [
      ['a library', 'on the campus'], ['a cafe', 'near the university'], ['a printer', 'in the computer room'],
      ['a whiteboard', 'in the classroom'], ['a dictionary', 'on the shelf'], ['a bus stop', 'in front of the building'],
      ['a clock', 'on the wall'], ['an exam', 'in room 12'], ['a meeting', 'in the main hall'],
      ['a cat', 'in the garden'], ['a phone', 'on the desk'], ['a parking area', 'behind the campus'],
      ['a lesson', 'in the lab'], ['a notebook', 'in my bag'], ['a question', 'on the last page'], ['a concert', 'at the student club']
    ];
    var PLUP = [
      ['twenty students', 'in the lecture hall'], ['some books', 'on the table'], ['two teachers', 'in the office'],
      ['many cars', 'in the car park'], ['five computers', 'in the lab'], ['some chairs', 'in the corridor'],
      ['three windows', 'in the classroom'], ['some flowers', 'in the garden'], ['ten questions', 'on the exam'],
      ['some apples', 'in the fridge'], ['many people', 'at the conference'], ['six desks', 'in the study room'],
      ['some posters', 'on the wall'], ['two cafes', 'near the library'], ['some announcements', 'on the board'], ['many visitors', 'at the open day']
    ];
    // Events / temporary things work naturally in BOTH tenses.
    var SINGT = [['a meeting', 'in the main hall'], ['an exam', 'in room 12'], ['a lesson', 'in the lab'], ['a concert', 'at the student club'], ['a party', 'at the dormitory'], ['a film night', 'at the club'], ['a bus', 'at the stop'], ['a queue', 'at the cafeteria']];
    var PLUT = [['twenty students', 'in the lecture hall'], ['many people', 'at the conference'], ['some visitors', 'in the office'], ['two exams', 'on the timetable'], ['many questions', 'in the test'], ['some problems', 'with the printer'], ['three buses', 'at the stop'], ['many guests', 'at the ceremony']];
    // Permanent things: test SINGULAR vs PLURAL only (options stay in the
    // present, so no time word is needed and no second answer is possible).
    SINGP.forEach(function (n) { out.push(mk('____ ' + n[0] + ' ' + n[1] + '.', 'There is', ['There are', 'There am', 'There be'], 'Singular noun -> there is.')); });
    PLUP.forEach(function (n) { out.push(mk('____ ' + n[0] + ' ' + n[1] + '.', 'There are', ['There is', 'There am', 'There be'], 'Plural noun -> there are.')); });
    SINGP.forEach(function (n) { out.push(mk('____ ' + n[0] + ' ' + n[1] + '?', 'Is there', ['Are there', 'Am there', 'Be there'], 'Singular question -> Is there ...?')); });
    PLUP.forEach(function (n) { out.push(mk('____ ' + n[0] + ' ' + n[1] + '?', 'Are there', ['Is there', 'Am there', 'Be there'], 'Plural question -> Are there ...?')); });
    SINGP.forEach(function (n) { out.push(mk('There ____ ' + n[0] + ' ' + n[1] + '.', 'is', ['are', 'am', 'be'], 'Singular noun -> is.')); });
    PLUP.forEach(function (n) { out.push(mk('There ____ ' + n[0] + ' ' + n[1] + '.', 'are', ['is', 'am', 'be'], 'Plural noun -> are.')); });
    // Events / temporary things: test PRESENT vs PAST. The time expression
    // (right now / last night) tells the student which tense is needed.
    SINGT.forEach(function (n) { out.push(mk('There ____ ' + n[0] + ' ' + n[1] + ' ' + pick(NOW) + '.', 'is', ['was', 'are', 'were'], 'Present time word (now / today) -> is.')); });
    PLUT.forEach(function (n) { out.push(mk('There ____ ' + n[0] + ' ' + n[1] + ' ' + pick(NOW) + '.', 'are', ['were', 'is', 'was'], 'Present time word (now / today) -> are.')); });
    SINGT.forEach(function (n) { THEN.forEach(function (t) { out.push(mk('There ____ ' + n[0] + ' ' + n[1] + ' ' + t + '.', 'was', ['is', 'were', 'are'], 'Past time word (yesterday / last night) -> was.')); }); });
    PLUT.forEach(function (n) { THEN.forEach(function (t) { out.push(mk('There ____ ' + n[0] + ' ' + n[1] + ' ' + t + '.', 'were', ['are', 'was', 'is'], 'Past time word (yesterday / last night) -> were.')); }); });
    return out;
  };

  G.wasWere = function () {
    var out = [];
    // People get people-complements, things get thing-complements (so never
    // "the students were delicious"), and EVERY stem carries a past time
    // expression, because is/are sit in the distractors.
    var PEOPLE = ['I', 'He', 'She', 'Tom', 'Anna', 'My brother', 'My sister', 'The teacher', 'You', 'We', 'They', 'My parents', 'The children', 'My friends', 'The students'];
    var PCOMP = ['at home yesterday', 'very tired last night', 'late for class this morning', 'at the party on Saturday', 'busy last week', 'at school yesterday', 'in London last week', 'happy yesterday', 'in the library this morning', 'ill last week', 'at the meeting yesterday', 'early this morning'];
    var THINGS = [
      ['The weather', 'sunny yesterday'], ['The weather', 'cold last night'], ['The film', 'really good last night'],
      ['The film', 'interesting last week'], ['The shops', 'open yesterday'], ['The shops', 'closed on Sunday'],
      ['The food', 'delicious at the party'], ['The exam', 'difficult last week'], ['The bus', 'late this morning'],
      ['The lessons', 'interesting yesterday'], ['The questions', 'easy on the test last week'], ['The cafeteria', 'crowded yesterday'],
      ['The classroom', 'empty this morning'], ['The lecture', 'long yesterday'], ['The books', 'cheap last year'], ['The tickets', 'expensive last month']
    ];
    PEOPLE.forEach(function (s) { PCOMP.forEach(function (c) { var w = bePastOf(s); out.push(mk(s + ' ____ ' + c + '.', w, [w === 'was' ? 'were' : 'was', 'is', 'are'], 'Past time word -> was/were. was with I/he/she/it; were with you/we/they.')); }); });
    THINGS.forEach(function (p) { var w = bePastOf(p[0]); out.push(mk(p[0] + ' ____ ' + p[1] + '.', w, [w === 'was' ? 'were' : 'was', 'is', 'are'], 'Past time word -> was/were.')); });
    PEOPLE.slice(0, 10).forEach(function (s) { PCOMP.slice(0, 8).forEach(function (c) { var n = bePastOf(s) === 'was' ? "wasn't" : "weren't"; out.push(mk(s + ' ____ ' + c + '.', n, [n === "wasn't" ? "weren't" : "wasn't", "isn't", "aren't"], "Negative past of be: wasn't / weren't.")); }); });
    var QPEOPLE = [['he', 'Was'], ['she', 'Was'], ['Tom', 'Was'], ['Anna', 'Was'], ['your brother', 'Was'], ['you', 'Were'], ['they', 'Were'], ['the children', 'Were'], ['your parents', 'Were'], ['your friends', 'Were']];
    var QCOMP = ['tired last night', 'at home yesterday', 'late this morning', 'at the party on Saturday', 'busy last week', 'here yesterday', 'OK yesterday', 'at work yesterday'];
    QPEOPLE.forEach(function (p) { QCOMP.forEach(function (c) { out.push(mk('____ ' + p[0] + ' ' + c + '?', p[1], [p[1] === 'Was' ? 'Were' : 'Was', 'Is', 'Are'], 'Past be question: Was/Were + subject ...?')); }); });
    var QTHINGS = [['the film', 'good last night', 'Was'], ['the weather', 'nice yesterday', 'Was'], ['the shops', 'open yesterday', 'Were'], ['the exam', 'difficult last week', 'Was'], ['the questions', 'easy on the test last week', 'Were'], ['the bus', 'late this morning', 'Was']];
    QTHINGS.forEach(function (p) { out.push(mk('____ ' + p[0] + ' ' + p[1] + '?', p[2], [p[2] === 'Was' ? 'Were' : 'Was', 'Is', 'Are'], 'Past be question: Was/Were + subject ...?')); });
    return out;
  };

  G.past = function () {
    var out = [], SUB = ['I', 'You', 'He', 'She', 'We', 'They', 'Tom', 'My brother', 'The students', 'My friend'];
    var TIME = ['yesterday', 'last night', 'last week', 'two days ago', 'last weekend', 'in 2019', 'last summer', 'last Monday', 'an hour ago', 'last year'];
    SUB.forEach(function (s) { V.forEach(function (v) { out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(TIME) + '.', v.ed, [v.b, v.s, v.ing], 'Past simple: regular verbs add -ed; irregular verbs change form.')); }); });
    return out;
  };
  G.pastQ = function () {
    var out = [], SUB = ['I', 'You', 'He', 'She', 'We', 'They', 'Tom', 'My brother', 'The students', 'My friend'];
    SUB.forEach(function (s) { V.slice(0, 12).forEach(function (v) { out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + ' ' + pick(['yesterday', 'last week', 'last night']) + '.', "didn't", ["don't", "doesn't", "wasn't"], "Past negative: didn't + base verb.")); }); });
    SUB.forEach(function (s) { V.slice(0, 12).forEach(function (v) { out.push(mk('____ ' + qsubj(s) + ' ' + v.b + ' ' + v.o + ' ' + pick(['yesterday', 'last week', 'last night']) + '?', 'Did', ['Do', 'Does', 'Were'], 'Past time word -> Did + subject + base verb.')); }); });
    ['Where', 'When', 'Why', 'What time'].forEach(function (wh) { V.slice(0, 8).forEach(function (v) { out.push(mk(wh + ' ____ ' + pick(['you', 'he', 'she', 'they']) + ' ' + v.b + ' ' + v.o + ' ' + pick(['yesterday', 'last week', 'last night']) + '?', 'did', ['do', 'does', 'was'], 'Past time word -> question word + did + subject + base verb.')); }); });
    return out;
  };
  G.likeIng = function () {
    var out = [], FEEL = [['I', 'love'], ['You', 'love'], ['We', 'love'], ['They', 'love'], ['He', 'loves'], ['She', 'loves'], ['Tom', 'loves'], ['I', 'like'], ['She', 'likes'], ['He', 'hates'], ['They', 'enjoy'], ['She', 'enjoys'], ['We', 'prefer'], ['She', 'prefers']];
    FEEL.forEach(function (p) { V.forEach(function (v) { out.push(mk(p[0] + ' ' + p[1] + ' ____ (' + v.b + ') ' + v.o + '.', v.ing, [v.b, v.s, v.ed], 'After like / love / hate / enjoy use verb + -ing.')); }); });
    return out;
  };

  G.can = function () {
    var out = [];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) { out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + '.', 'can', ['cans', 'can to', 'is can'], 'Ability: can + base verb (no -s, no to).')); }); });
    SUBJ_ALL.slice(0, 8).forEach(function (s) { V.slice(0, 10).forEach(function (v) { out.push(mk(s + " ____ " + v.b + ' ' + v.o + '.', "can't", ["doesn't can", "not can", "don't can"], "Negative ability: can't + base verb.")); }); });
    ['you', 'he', 'she', 'they', 'Tom', 'your sister'].forEach(function (s) { V.slice(0, 10).forEach(function (v) { out.push(mk('____ ' + s + ' ' + v.b + ' ' + v.o + '?', 'Can', ['Do', 'Does', 'Are'], 'Question: Can + subject + base verb?')); }); });
    SUBJ_ALL.slice(0, 10).forEach(function (s) { V.slice(0, 8).forEach(function (v) { out.push(mk('In the past, ' + qsubj(s) + ' ____ ' + v.b + ' ' + v.o + '.', 'could', ['can', 'cans', 'could to'], 'Past ability: could + base verb.')); }); });
    return out;
  };
  G.haveTo = function () {
    var out = [];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) { var h = haveOf(s) + ' to'; out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + '.', h, [h === 'have to' ? 'has to' : 'have to', 'having to', 'to have'], 'Obligation: have to (I/you/we/they), has to (he/she/it) + base verb.')); }); });
    SUBJ_ALL.slice(0, 8).forEach(function (s) { V.slice(0, 8).forEach(function (v) { var n = (haveOf(s) === 'have' ? "don't" : "doesn't") + ' have to'; out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + '.', n, [n === "don't have to" ? "doesn't have to" : "don't have to", "haven't to", "not have to"], "No obligation: don't / doesn't have to.")); }); });
    ['you', 'he', 'she', 'they', 'Tom'].forEach(function (s) { V.slice(0, 8).forEach(function (v) { var d = cap(doOf(s)); out.push(mk('____ ' + s + ' have to ' + v.b + ' ' + v.o + '?', d, [d === 'Do' ? 'Does' : 'Do', 'Have', 'Are'], 'Question: Do/Does + subject + have to + base verb?')); }); });
    return out;
  };

  G.presCont = function () {
    var out = [], NOW = ['now', 'at the moment', 'right now', 'today'];
    SUBJ_ALL.forEach(function (s) { VACT.slice(0, 16).forEach(function (v) { var be = beOf(s); out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(NOW) + '.', be + ' ' + v.ing, [v.s, v.b, be + ' ' + v.b], 'Happening now: am/is/are + verb-ing.')); }); });
    return out;
  };
  G.simpleVsCont = function () {
    var out = [], ROUT = ['every day', 'every morning', 'on Mondays', 'twice a week', 'every weekend'], NOWM = ['now', 'at the moment', 'right now', 'today', 'at present'];
    SING3.forEach(function (s) { VACT.slice(0, 12).forEach(function (v) { out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(ROUT) + '.', v.s, [beOf(s) + ' ' + v.ing, v.ing, v.b], 'A routine (every day) uses the present simple.')); }); });
    BASE_SUBJ.forEach(function (s) { VACT.slice(0, 12).forEach(function (v) { out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(ROUT) + '.', v.b, [beOf(s) + ' ' + v.ing, v.ing, v.s], 'A routine uses the present simple.')); }); });
    SUBJ_ALL.forEach(function (s) { VACT.slice(0, 12).forEach(function (v) { out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(NOWM) + '.', beOf(s) + ' ' + v.ing, [v.s, v.b, v.ing], 'Happening now uses the present continuous.')); }); });
    return out;
  };

  G.comp = function () {
    var out = [], byKey = {}; ADJ.forEach(function (a) { byKey[a.a] = a; });
    var ITEMS = [
      ['A train', 'a bus', 'fast'], ['A plane', 'a car', 'fast'], ['A cheetah', 'a cat', 'fast'],
      ['A giraffe', 'a horse', 'tall'], ['This tower', 'that house', 'tall'], ['My brother', 'my sister', 'tall'],
      ['A bike', 'a car', 'cheap'], ['A bus ticket', 'a train ticket', 'cheap'],
      ['A mouse', 'a cat', 'small'], ['My village', 'this city', 'small'],
      ['My grandfather', 'my father', 'old'], ['This castle', 'that house', 'old'],
      ['My sister', 'my brother', 'young'], ['Anna', 'Tom', 'young'],
      ['Winter', 'autumn', 'cold'], ['The North', 'the South', 'cold'],
      ['My room', 'your room', 'clean'], ['This street', 'that street', 'clean'],
      ['This film', 'that film', 'short'], ['My hair', 'your hair', 'short'],
      ['The Nile', 'the Thames', 'long'], ['This road', 'that road', 'long'],
      ['An elephant', 'a dog', 'big'], ['Russia', 'France', 'big'],
      ['Summer', 'spring', 'hot'], ['Tea', 'juice', 'hot'],
      ['This phone', 'that laptop', 'thin'], ['A pencil', 'a pen', 'thin'],
      ['This song', 'that song', 'sad'],
      ['Today', 'yesterday', 'happy'], ['She', 'her brother', 'happy'],
      ['This test', 'that test', 'easy'], ['Art', 'maths', 'easy'],
      ['My bag', 'your bag', 'heavy'], ['Gold', 'plastic', 'heavy'],
      ['Monday', 'Sunday', 'busy'], ['The city', 'the village', 'busy'],
      ['The first train', 'the second train', 'early'],
      ['The kitchen', 'the bedroom', 'dirty'],
      ['Asia', 'Europe', 'large'], ['A lake', 'a pond', 'large'],
      ['This hotel', 'that hotel', 'nice'],
      ['A plane', 'a motorbike', 'safe'], ['This area', 'that area', 'safe'],
      ['The last bus', 'the first bus', 'late'],
      ['A diamond', 'a stone', 'expensive'], ['A car', 'a bike', 'expensive'], ['Gold', 'silver', 'expensive'],
      ['This book', 'that one', 'interesting'], ['History', 'geography', 'interesting'],
      ['This painting', 'that one', 'beautiful'], ['The sunset', 'the sunrise', 'beautiful'],
      ['Chinese', 'Spanish', 'difficult'], ['This exam', 'the last one', 'difficult'],
      ['Health', 'money', 'important'], ['Family', 'work', 'important'],
      ['This actor', 'that one', 'famous'], ['London', 'my town', 'famous'],
      ['This phone', 'that one', 'modern'], ['The new café', 'the old one', 'modern'],
      ['This restaurant', 'that one', 'good'], ['My team', 'your team', 'good'],
      ['The traffic today', 'the traffic yesterday', 'bad'],
      ['The station', 'the shop', 'far'], ['Australia', 'France', 'far']
    ];
    ITEMS.forEach(function (it) { var a = byKey[it[2]]; if (!a) return; var d = a.t === 'long' ? [a.a, a.a + 'er', a.s] : [a.a, a.s, 'more ' + a.a]; out.push(mk(it[0] + ' is ____ (' + a.a + ') than ' + it[1] + '.', a.c, d, 'Comparative: short adj + -er; long adj -> more ...; then than.')); });
    return out;
  };
  G.superl = function () {
    var out = [], byKey = {}; ADJ.forEach(function (a) { byKey[a.a] = a; });
    var ITEMS = [
      ['The Nile', 'long', 'river in the world'], ['Russia', 'large', 'country in the world'],
      ['This', 'cheap', 'phone in the shop'], ['He', 'tall', 'boy in the class'],
      ['She', 'young', 'student in the group'], ['It', 'old', 'building in the city'],
      ['Today', 'hot', 'day of the year'], ['This', 'expensive', 'car in the garage'],
      ['That', 'interesting', 'book I have read'], ['This', 'beautiful', 'beach on the island'],
      ['Maths', 'difficult', 'subject for me'], ['Health', 'important', 'thing in life'],
      ['He', 'famous', 'singer in the country'], ['This', 'modern', 'flat in the area'],
      ['This', 'good', 'restaurant in town'], ['That', 'bad', 'film of the year'],
      ['The library', 'far', 'building from here'], ['January', 'cold', 'month of the year'],
      ['This', 'small', 'room in the house'], ['He', 'fast', 'runner in the team'],
      ['This', 'clean', 'classroom in the school'], ['This', 'short', 'day of the year'],
      ['The whale', 'big', 'animal in the sea'], ['This', 'heavy', 'box in the room'],
      ['Monday', 'busy', 'day of the week'], ['She', 'happy', 'person I know'],
      ['This', 'easy', 'question on the test'], ['This', 'nice', 'hotel in the city'],
      ['This', 'dirty', 'street in the town'], ['Anna', 'young', 'child in the family'],
      ['This', 'thin', 'laptop in the shop'], ['That', 'sad', 'story in the book'],
      ['Mr Lee', 'good', 'teacher in the school'], ['This', 'large', 'lake in the country'],
      ['Everest', 'tall', 'mountain in the area'], ['This', 'long', 'bridge in the city'],
      ['That', 'cheap', 'ticket on the website'], ['This', 'old', 'tree in the park'],
      ['He', 'old', 'man in the village'], ['This', 'expensive', 'watch in the shop'],
      ['She', 'beautiful', 'singer on the stage'], ['This', 'difficult', 'exam of the year'],
      ['This', 'important', 'meeting of the month'], ['That', 'famous', 'painting in the museum'],
      ['This', 'modern', 'car in the showroom'], ['This', 'good', 'idea of all'],
      ['That', 'bad', 'day of my life'], ['The sun', 'hot', 'star near us'],
      ['This', 'small', 'box on the shelf'], ['He', 'fast', 'swimmer in the pool'],
      ['This', 'clean', 'beach in the country'], ['That', 'interesting', 'film at the cinema'],
      ['This', 'nice', 'garden in the street']
    ];
    ITEMS.forEach(function (it) { var a = byKey[it[1]]; if (!a) return; var d = a.t === 'long' ? [a.a, a.c, a.a + 'est'] : [a.a, a.c, 'most ' + a.a]; out.push(mk(it[0] + ' is the ____ (' + a.a + ') ' + it[2] + '.', a.s, d, 'Superlative: the + short adj + -est; the most + long adj.')); });
    return out;
  };

  G.pp = function () {
    var out = [];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) { var h = haveOf(s); out.push(mk(s + ' ____ ' + pick(['already', 'just']) + ' ' + v.pp + ' ' + v.o + '.', h, [h === 'have' ? 'has' : 'have', 'is', 'do'], 'already / just -> present perfect: have/has + past participle.')); }); });
    SUBJ_ALL.slice(0, 10).forEach(function (s) { V.slice(0, 14).filter(function (v) { return v.pp !== v.b; }).forEach(function (v) { var h = haveOf(s); out.push(mk(s + ' ' + h + ' ' + pick(['already', 'just']) + ' ____ (' + v.b + ') ' + v.o + '.', v.pp, [v.b, v.ed, v.s], 'have/has + past participle (gone, seen, eaten ...).')); }); });
    ['you', 'they', 'we'].forEach(function (s) { V.slice(0, 10).forEach(function (v) { out.push(mk('____ ' + s + ' ever ' + v.pp + ' ' + v.o + '?', 'Have', ['Has', 'Did', 'Do'], 'Question: Have/Has + subject + (ever) + past participle?')); }); });
    return out;
  };
  G.ppVsPast = function () {
    var out = [], FIN = ['yesterday', 'last week', 'in 2010', 'two days ago', 'last year', 'last night', 'an hour ago', 'last summer'];
    SUBJ_ALL.forEach(function (s) {
      VIRR.forEach(function (v) {
        out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(FIN) + '.', v.ed, [haveOf(s) + ' ' + v.pp, v.pp, v.b], 'Finished time (yesterday, last week) -> past simple.'));
      });
    });
    // 'since ...' requires the present perfect (past simple is wrong with
    // since), so the contrast has exactly one right answer.
    var DUR = [
      { b: 'work', s: 'works', ing: 'working', ed: 'worked', pp: 'worked', o: 'in a bank' },
      { b: 'live', s: 'lives', ing: 'living', ed: 'lived', pp: 'lived', o: 'in London' },
      { b: 'study', s: 'studies', ing: 'studying', ed: 'studied', pp: 'studied', o: 'English' },
      { b: 'play', s: 'plays', ing: 'playing', ed: 'played', pp: 'played', o: 'tennis' },
      { b: 'teach', s: 'teaches', ing: 'teaching', ed: 'taught', pp: 'taught', o: 'at this university' }
    ];
    var SINCE = ['since 2019', 'since last September', 'since Monday', 'since January', 'since high school'];
    SUBJ_ALL.forEach(function (s) {
      var h = haveOf(s);
      DUR.forEach(function (v) {
        out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(SINCE) + '.', h + ' ' + v.pp, [v.ed, v.s, v.ing], "'since' -> present perfect: have/has + past participle."));
      });
    });
    return out;
  };

  // ── A2 topic skeleton (id, title, blurb=Unit, generator, cap) ─
  var A2_SPEC = [
    { id: 'a2-be', title: 'be: am / is / are', blurb: 'Unit 1 · positive and negative', gen: G.be, cap: 18 },
    { id: 'a2-be-questions', title: 'be: questions', blurb: 'Unit 1 · questions and short answers', gen: G.beQ, cap: 18 },
    { id: 'a2-a-an', title: 'a / an', blurb: 'Unit 1 · indefinite article', gen: G.aan, cap: 18 },
    { id: 'a2-plurals', title: 'Plural nouns', blurb: 'Unit 1 · regular and irregular', gen: G.plurals, cap: 18 },
    { id: 'a2-possessives', title: "Possessives (my / 's)", blurb: 'Units 1 and 5 · possessive adjectives and ’s', gen: G.poss, cap: 18 },
    { id: 'a2-question-words', title: 'Question words', blurb: 'Unit 1 · what / where / when / who', gen: G.qw, cap: 18 },
    { id: 'a2-present-simple', title: 'Present Simple', blurb: 'Unit 2 · positive and negative', gen: G.presSimple, cap: 52 },
    { id: 'a2-present-simple-q', title: 'Present Simple: questions', blurb: 'Unit 2 · do / does', gen: G.presSimpleQ, cap: 52 },
    { id: 'a2-adv-frequency', title: 'Adverbs of frequency', blurb: 'Unit 3 · always, usually, never', gen: G.freq, cap: 52 },
    { id: 'a2-have-got', title: 'have got', blurb: 'Unit 3 · possession', gen: G.haveGot, cap: 52 },
    { id: 'a2-some-any', title: 'some / any', blurb: 'Unit 4 · countable and uncountable', gen: G.someAny, cap: 52 },
    { id: 'a2-much-many', title: 'much / many', blurb: 'Unit 4 · quantifiers', gen: G.muchMany, cap: 52 },
    { id: 'a2-there-is-are', title: 'there is / there are', blurb: 'Unit 5 · places', gen: G.there, cap: 104 },
    { id: 'a2-was-were', title: 'was / were', blurb: 'Unit 6 · past of be', gen: G.wasWere, cap: 104 },
    { id: 'a2-past-simple', title: 'Past Simple', blurb: 'Unit 7 · positive (regular and irregular)', gen: G.past, cap: 35 },
    { id: 'a2-past-simple-q', title: 'Past Simple: questions', blurb: 'Unit 7 · negative and questions', gen: G.pastQ, cap: 35 },
    { id: 'a2-like-ing', title: 'like / love / hate + -ing', blurb: 'Unit 7 · verb + -ing', gen: G.likeIng, cap: 35 },
    { id: 'a2-can-could', title: 'can / could (ability)', blurb: 'Unit 8 · ability now and past', gen: G.can, cap: 52 },
    { id: 'a2-have-to', title: "have to / don't have to", blurb: 'Unit 8 · obligation', gen: G.haveTo, cap: 52 },
    { id: 'a2-present-continuous', title: 'Present Continuous', blurb: 'Unit 9 · happening now', gen: G.presCont, cap: 52 },
    { id: 'a2-simple-vs-continuous', title: 'Present Simple or Continuous', blurb: 'Unit 9 · routine vs now', gen: G.simpleVsCont, cap: 52 },
    { id: 'a2-comparatives', title: 'Comparative Adjectives', blurb: 'Unit 10 · -er / more ... than', gen: G.comp, cap: 52 },
    { id: 'a2-superlatives', title: 'Superlative Adjectives', blurb: 'Unit 10 · the -est / the most', gen: G.superl, cap: 52 },
    { id: 'a2-present-perfect', title: 'Present Perfect', blurb: 'Unit 11 · have / has + past participle', gen: G.pp, cap: 52 },
    { id: 'a2-pp-vs-past', title: 'Present Perfect or Past Simple', blurb: 'Unit 11 · finished time or not', gen: G.ppVsPast, cap: 52 }
  ];

  var A2 = A2_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: build(t.gen(), t.cap) };
  });

  // ── B1 generators (reuse the A2 engine: mk / build / pools) ──
  G.b1PastCont = function () {
    var out = [], TIME = ['at 8 last night', 'this time yesterday', 'all morning', 'when you called', 'at midnight', 'all day yesterday'];
    SUBJ_ALL.forEach(function (s) { VDUR.forEach(function (v) { var w = bePastOf(s), x = w === 'was' ? 'were' : 'was'; out.push(mk(s + ' ____ (' + v.b + ') ' + v.o + ' ' + pick(TIME) + '.', w + ' ' + v.ing, [x + ' ' + v.ing, v.b, v.s], 'Past continuous: was/were + verb-ing for an action in progress.')); }); });
    var INT = ['the phone rang', 'it started to rain', 'I arrived', 'the lights went out', 'he came in'];
    SUBJ_ALL.slice(0, 10).forEach(function (s) { VACT.slice(0, 10).forEach(function (v) { var w = bePastOf(s), x = w === 'was' ? 'were' : 'was'; out.push(mk('While ' + qsubj(s) + ' ____ (' + v.b + ') ' + v.o + ', ' + pick(INT) + '.', w + ' ' + v.ing, [x + ' ' + v.ing, v.b, v.s], 'The longer action uses the past continuous: was/were + verb-ing.')); }); });
    return out;
  };
  G.b1UsedTo = function () {
    var out = [], OBJ = ['live in London', 'play football', 'go to school here', 'have long hair', 'work in a shop', 'eat meat', 'watch a lot of TV', 'study French', 'smoke', 'get up early'];
    SUBJ_ALL.forEach(function (s) { OBJ.forEach(function (o) { out.push(mk(s + ' ____ ' + o + ', but not any more.', 'used to', ['use to', 'used', 'am used to'], 'Past habit: used to + base verb.')); }); });
    var DOES = { I: 'I do now', You: 'you do now', He: 'he does now', She: 'she does now', They: 'they do now', We: 'we do now' };
    ['I', 'You', 'He', 'She', 'They', 'We'].forEach(function (s) { OBJ.slice(0, 8).forEach(function (o) { out.push(mk(s + ' ____ ' + o + ', but ' + DOES[s] + '.', "didn't use to", ["didn't used to", "don't use to", "wasn't used to"], "Negative past habit: didn't use to + base verb.")); }); });
    return out;
  };
  G.b1FutureWillGoing = function () {
    var out = [];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) {
      out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + ' tomorrow.', 'will', ['wills', 'am will', 'going'], 'Future prediction/decision: will + base verb.'));
      out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + ' next week.', "won't", ["willn't", "doesn't", "not will"], "Negative future: won't + base verb."));
    }); });
    return out;
  };
  G.b1FuturePlans = function () {
    var out = [], FUT = ['tomorrow', 'next weekend', 'after class', 'tonight', 'next summer'];
    SUBJ_ALL.forEach(function (s) { VACT.slice(0, 14).forEach(function (v) { var be = beOf(s); out.push(mk(s + ' ____ going to ' + v.b + ' ' + v.o + ' ' + pick(FUT) + '.', be, [be === 'is' ? 'are' : 'is', 'be', 'will'], 'Plans/intentions: am/is/are + going to + base verb.')); }); });
    return out;
  };
  G.b1ModalsOblig = function () {
    var out = [];
    // Real rules and real advice (no "it is a rule: she must drink coffee").
    var MUST = ['Students ____ arrive on time.', 'You ____ bring your ID card to the exam.', 'Drivers ____ stop at a red light.', 'Visitors ____ sign in at reception.', 'Players ____ follow the rules.', 'You ____ wear a seatbelt in the car.', 'Passengers ____ keep their tickets.', 'You ____ switch off your phone in the library.', 'Members ____ show their cards at the door.', 'Students ____ hand in homework on Friday.', 'You ____ be quiet in the reading room.', 'Everyone ____ leave the building during a fire alarm.'];
    var SHOULD = ['You look tired. You ____ go to bed early.', 'It is cold outside. You ____ wear a coat.', 'He has an exam tomorrow. He ____ study tonight.', 'She has a headache. She ____ take a break.', 'We are lost. We ____ ask for directions.', 'Your phone is very old. You ____ buy a new one.', 'They are always late. They ____ leave home earlier.', 'It might rain. You ____ take an umbrella.', 'He is very stressed. He ____ relax more.', 'You cough a lot. You ____ see a doctor.', 'The exam is difficult. You ____ start studying early.', 'Her English is good. She ____ try the next level.'];
    MUST.forEach(function (st) { out.push(mk(st, 'must', ['musts', 'must to', 'has'], 'Strong obligation / a rule: must + base verb.')); });
    SHOULD.forEach(function (st) { out.push(mk(st, 'should', ['shoulds', 'should to', 'musts'], 'Advice: should + base verb.')); });
    SUBJ_ALL.forEach(function (s) { V.slice(0, 8).forEach(function (v) { var h = haveOf(s) + ' to'; out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + ' every day.', h, [h === 'have to' ? 'has to' : 'have to', 'must to', 'having to'], 'Obligation: have to / has to + base verb.')); }); });
    return out;
  };
  G.b1ModalsPoss = function () {
    var out = [];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) {
      out.push(mk('Maybe ' + qsubj(s) + ' ____ ' + v.b + ' ' + v.o + ' later.', 'might', ['mights', 'might to', 'is might'], 'Possibility: might + base verb (= maybe).'));
      out.push(mk(s + ' ____ ' + v.b + ' ' + v.o + ' very well.', 'can', ['cans', 'can to', 'is can'], 'Ability: can + base verb.'));
    }); });
    return out;
  };
  G.b1Cond1 = function () {
    var out = [], IFCL = [['it rains', 'we', 'stay at home'], ['you study hard', 'you', 'pass the exam'], ['she calls', 'I', 'answer'], ['they win', 'they', 'celebrate'], ['I have time', 'I', 'help you'], ['he is late', 'we', 'start without him'], ['we hurry', 'we', 'catch the bus'], ['it gets cold', 'I', 'wear a coat'], ['they ask', 'we', 'tell them'], ['you heat water', 'it', 'boil']];
    IFCL.forEach(function (c) { out.push(mk('If ' + c[0] + ', ' + c[1] + ' ____ ' + c[2] + '.', 'will', ['would', 'will to', 'is going'], 'First conditional result: will + base verb.')); });
    SING3.slice(0, 8).forEach(function (s) { V.slice(0, 10).forEach(function (v) { out.push(mk('If ' + qsubj(s) + ' ____ (' + v.b + ') ' + v.o + ', I will be happy.', v.s, ['will ' + v.b, v.ed, v.ing], "After 'if', use the present simple.")); }); });
    BASE_SUBJ.slice(0, 6).forEach(function (s) { V.slice(0, 8).forEach(function (v) { out.push(mk('If ' + qsubj(s) + ' ____ (' + v.b + ') ' + v.o + ', we will win.', v.b, ['will ' + v.b, v.ed, v.ing], "After 'if', use the present simple.")); }); });
    return out;
  };
  G.b1Cond2 = function () {
    var out = [], ITEMS = [['I had a million dollars', 'I', 'travel the world'], ['she knew the answer', 'she', 'tell us'], ['we lived by the sea', 'we', 'swim every day'], ['you studied more', 'you', 'pass'], ['they had more time', 'they', 'visit us'], ['I won the lottery', 'I', 'buy a house'], ['he spoke French', 'he', 'get the job'], ['we had a car', 'we', 'drive there']];
    ITEMS.forEach(function (c) { out.push(mk('If ' + c[0] + ', ' + c[1] + ' ____ ' + c[2] + '.', 'would', ['will', 'would to', 'had'], 'Second conditional result: would + base verb.')); });
    SING3.slice(0, 8).forEach(function (s) { V.slice(0, 10).forEach(function (v) { out.push(mk('If ' + qsubj(s) + ' ____ (' + v.b + ') ' + v.o + ', it would be great.', v.ed, [v.s, v.b, 'would ' + v.b], "Second conditional 'if' clause uses the past simple.")); }); });
    ['I', 'he', 'she', 'it'].forEach(function (s) { ['rich', 'taller', 'here', 'ready', 'free', 'younger'].forEach(function (c) { out.push(mk('If ' + s + ' ____ ' + c + ', life would be easier.', 'were', ['be', 'is', 'would be'], "In the second conditional we usually use 'were' for all subjects.")); }); });
    return out;
  };
  G.b1TooEnough = function () {
    var out = [], ADJ2 = ['hot', 'cold', 'expensive', 'difficult', 'small', 'big', 'heavy', 'loud', 'busy', 'tired', 'young', 'dark'];
    ADJ2.forEach(function (a) {
      out.push(mk('It is ____ ' + a + ' for me.', 'too', ['enough', 'too much', 'very much'], 'too + adjective = more than necessary.'));
      out.push(mk('It is ____ ' + a + ' to use.', 'too', ['enough', 'too much', 'so'], 'too + adjective + to ...'));
      out.push(mk('It is ' + a + ' ____ for me.', 'enough', ['too', 'too much', 'very'], 'adjective + enough = as much as necessary.'));
    });
    ['water', 'money', 'time', 'sugar', 'noise', 'traffic'].forEach(function (n) { out.push(mk('There is ____ ' + n + '.', 'too much', ['too many', 'enough of', 'too'], 'too much + uncountable noun.')); });
    ['people', 'cars', 'books', 'mistakes', 'rules'].forEach(function (n) { out.push(mk('There are ____ ' + n + '.', 'too many', ['too much', 'enough of', 'too'], 'too many + plural countable noun.')); });
    ['time', 'money', 'chairs', 'water', 'tickets', 'space', 'food', 'sleep'].forEach(function (n) { out.push(mk("We don't have ____ " + n + '.', 'enough', ['too', 'so', 'very'], 'enough + noun = as much as is needed.')); });
    return out;
  };
  G.b1AFewLittle = function () {
    var out = [], UNC = ['water', 'money', 'time', 'sugar', 'milk', 'bread', 'information', 'coffee', 'salt', 'help'];
    var PLU = ['friends', 'books', 'apples', 'people', 'ideas', 'eggs', 'cars', 'students', 'questions', 'days'];
    UNC.forEach(function (n) { out.push(mk('I have ____ ' + n + ', not much.', 'a little', ['a few', 'many', 'a number of'], 'a little + uncountable noun (a small amount).')); out.push(mk('How ____ ' + n + ' do you need?', 'much', ['many', 'a few', 'several'], 'much + uncountable noun.')); out.push(mk('There is only ____ ' + n + ' left.', 'a little', ['a few', 'many', 'several'], 'a little + uncountable noun.')); });
    PLU.forEach(function (n) { out.push(mk('I have ____ ' + n + ', not many.', 'a few', ['a little', 'much', 'an amount of'], 'a few + plural countable noun (a small number).')); out.push(mk('How ____ ' + n + ' do you have?', 'many', ['much', 'a little', 'a bit of'], 'many + plural countable noun.')); out.push(mk('There are only ____ ' + n + ' left.', 'a few', ['a little', 'much', 'a bit of'], 'a few + plural countable noun.')); });
    return out;
  };
  G.b1PassivePres = function () {
    var out = [];
    // Curated subject + participle + tail (no "the letter is eaten").
    var SING = [
      ['English', 'spoken', 'all over the world'], ['Rice', 'grown', 'in Asia'], ['The classroom', 'cleaned', 'every evening'],
      ['Breakfast', 'served', 'at seven'], ['The homework', 'checked', 'every week'], ['This room', 'used', 'for meetings'],
      ['Coffee', 'made', 'fresh every morning'], ['The door', 'locked', 'at night'], ['The exam', 'written', 'in pencil'],
      ['The rubbish', 'collected', 'on Mondays'], ['The bill', 'paid', 'online'], ['Turkish', 'spoken', 'in this office'],
      ['The bread', 'baked', 'every morning'], ['Attendance', 'taken', 'in every lesson'], ['The grass', 'cut', 'once a week'], ['Lunch', 'eaten', 'at noon here']
    ];
    var PLU = [
      ['The emails', 'sent', 'every morning'], ['The dishes', 'washed', 'after dinner'], ['The rooms', 'cleaned', 'daily'],
      ['Many languages', 'spoken', 'in this city'], ['The tickets', 'sold', 'online'], ['The exams', 'marked', 'by two teachers'],
      ['The windows', 'opened', 'every morning'], ['Photos', 'taken', 'at every ceremony'], ['The grades', 'given', 'at the end of term'],
      ['These computers', 'used', 'by the students'], ['The lessons', 'taught', 'in English'], ['The doors', 'locked', 'at midnight'],
      ['The books', 'kept', 'in the library'], ['The results', 'announced', 'every Friday'], ['Mistakes', 'corrected', 'in red'], ['The bills', 'paid', 'monthly']
    ];
    SING.forEach(function (p) { out.push(mk(p[0] + ' ____ ' + p[1] + ' ' + p[2] + '.', 'is', ['are', 'be', 'does'], 'Present passive (singular): is + past participle.')); });
    PLU.forEach(function (p) { out.push(mk(p[0] + ' ____ ' + p[1] + ' ' + p[2] + '.', 'are', ['is', 'be', 'do'], 'Present passive (plural): are + past participle.')); });
    SING.forEach(function (p) { out.push(mk('____ ' + lcFirst(p[0]) + ' ' + p[1] + ' ' + p[2] + '?', 'Is', ['Are', 'Does', 'Do'], 'Present passive question (singular): Is + subject + past participle?')); });
    PLU.forEach(function (p) { out.push(mk('____ ' + lcFirst(p[0]) + ' ' + p[1] + ' ' + p[2] + '?', 'Are', ['Is', 'Do', 'Does'], 'Present passive question (plural): Are + subject + past participle?')); });
    return out;
  };
  G.b1PassivePast = function () {
    var out = [];
    var SING = [
      ['The bridge', 'built', 'in 1990'], ['This house', 'built', 'a hundred years ago'], ['The telephone', 'invented', 'in 1876'],
      ['Penicillin', 'discovered', 'in 1928'], ['This book', 'written', 'in the 19th century'], ['The painting', 'painted', 'in Italy in 1503'],
      ['The letter', 'sent', 'last Monday'], ['The window', 'broken', 'during the storm'], ['My bike', 'stolen', 'last week'],
      ['The museum', 'opened', 'in 1955'], ['The house', 'sold', 'last month'], ['This building', 'designed', 'by a famous architect in 1910'],
      ['The film', 'made', 'in 2005'], ['The wallet', 'found', 'near the station yesterday'], ['The prize', 'given', 'to the best student last term'], ['The road', 'repaired', 'last summer']
    ];
    var PLU = [
      ['The pyramids', 'built', 'thousands of years ago'], ['These letters', 'written', 'by my grandfather years ago'], ['The photos', 'taken', 'at the ceremony last year'],
      ['The tickets', 'sold', 'in one day last month'], ['The windows', 'broken', 'during the storm'], ['The paintings', 'stolen', 'from the museum in 2003'],
      ['The results', 'announced', 'yesterday'], ['The invitations', 'sent', 'last week'], ['These houses', 'designed', 'in the 1960s'],
      ['The keys', 'found', 'under the desk yesterday'], ['The prizes', 'given', 'at the end of last year'], ['The roads', 'repaired', 'last summer']
    ];
    SING.forEach(function (p) { out.push(mk(p[0] + ' ____ ' + p[1] + ' ' + p[2] + '.', 'was', ['were', 'is', 'did'], 'Past passive (singular): was + past participle.')); });
    PLU.forEach(function (p) { out.push(mk(p[0] + ' ____ ' + p[1] + ' ' + p[2] + '.', 'were', ['was', 'are', 'did'], 'Past passive (plural): were + past participle.')); });
    SING.forEach(function (p) { out.push(mk('____ ' + lcFirst(p[0]) + ' ' + p[1] + ' ' + p[2] + '?', 'Was', ['Were', 'Did', 'Is'], 'Past passive question (singular): Was + subject + past participle?')); });
    PLU.forEach(function (p) { out.push(mk('____ ' + lcFirst(p[0]) + ' ' + p[1] + ' ' + p[2] + '?', 'Were', ['Was', 'Did', 'Are'], 'Past passive question (plural): Were + subject + past participle?')); });
    return out;
  };
  G.b1Relative = function () {
    var out = [], PN = ['man', 'woman', 'girl', 'boy', 'teacher', 'doctor', 'student', 'artist', 'singer', 'player', 'friend', 'neighbour'];
    var TN = ['book', 'film', 'car', 'phone', 'house', 'song', 'shop', 'bag', 'watch', 'idea', 'photo', 'machine'];
    var PL = ['city', 'town', 'shop', 'hotel', 'office', 'school', 'park', 'street', 'country', 'room'];
    PN.forEach(function (n) { out.push(mk('The ' + n + ' ____ lives next door is nice.', 'who', ['which', 'where', 'whose'], "who / that for people.")); out.push(mk('I met a ' + n + ' ____ knew you.', 'who', ['which', 'where', 'whose'], "who / that for people.")); out.push(mk('She is the ' + n + ' ____ bag was stolen.', 'whose', ['who', 'which', 'where'], "whose shows possession.")); });
    TN.forEach(function (n) { out.push(mk('The ' + n + ' ____ I bought is great.', 'which', ['who', 'where', 'whose'], "which / that for things.")); out.push(mk('This is the ' + n + ' ____ won an award.', 'which', ['who', 'where', 'whose'], "which / that for things.")); });
    PL.forEach(function (n) { out.push(mk('This is the ' + n + ' ____ I work.', 'where', ['which', 'who', 'when'], "where for places.")); });
    return out;
  };
  G.b1GerundInf = function () {
    var out = [];
    var ING = ['I enjoy', 'She finished', 'They keep', 'He avoids', "We don't mind", 'I love', 'Do you like', 'She suggested', 'I miss', 'He gave up'];
    var TO = ['I want', 'She decided', 'They hope', 'He plans', 'We need', 'I would like', 'She promised', 'They agreed', 'He learned', 'I offered'];
    ING.forEach(function (p) { VACT.slice(0, 12).forEach(function (v) { out.push(mk(p + ' ____ (' + v.b + ') ' + v.o + '.', v.ing, [v.b, 'to ' + v.b, v.s], 'After enjoy / finish / keep / mind / like use verb + -ing.')); }); });
    TO.forEach(function (p) { VACT.slice(0, 12).forEach(function (v) { out.push(mk(p + ' ____ (' + v.b + ') ' + v.o + '.', 'to ' + v.b, [v.ing, v.b, v.s], 'After want / decide / hope / plan / need use to + base verb.')); }); });
    return out;
  };

  // ── B1 unit skeleton (reuses some A2 generators for shared points) ──
  var B1_SPEC = [
    { id: 'b1-present-cont', title: 'Present Simple or Continuous', blurb: 'Unit 1 · routine vs now', gen: G.simpleVsCont, cap: 52 },
    { id: 'b1-question-forms', title: 'Question forms', blurb: 'Unit 1 · do / does + question words', gen: G.presSimpleQ, cap: 52 },
    { id: 'b1-past-continuous', title: 'Past Continuous', blurb: 'Unit 2 · was / were + -ing', gen: G.b1PastCont, cap: 52 },
    { id: 'b1-used-to', title: 'used to', blurb: 'Unit 2 · past habits', gen: G.b1UsedTo, cap: 52 },
    { id: 'b1-present-perfect', title: 'Present Perfect', blurb: 'Unit 3 · have / has + past participle', gen: G.pp, cap: 52 },
    { id: 'b1-pp-vs-past', title: 'Present Perfect or Past Simple', blurb: 'Unit 3 · finished time or not', gen: G.ppVsPast, cap: 52 },
    { id: 'b1-future-will-going', title: 'will / won\'t', blurb: 'Unit 4 · predictions and decisions', gen: G.b1FutureWillGoing, cap: 52 },
    { id: 'b1-future-plans', title: 'going to', blurb: 'Unit 4 · plans and intentions', gen: G.b1FuturePlans, cap: 52 },
    { id: 'b1-modals-obligation', title: 'must / have to / should', blurb: 'Unit 5 · obligation and advice', gen: G.b1ModalsOblig, cap: 52 },
    { id: 'b1-modals-possibility', title: 'might / can', blurb: 'Unit 5 · possibility and ability', gen: G.b1ModalsPoss, cap: 52 },
    { id: 'b1-conditional-1', title: 'First Conditional', blurb: 'Unit 6 · if + present, will', gen: G.b1Cond1, cap: 52 },
    { id: 'b1-conditional-2', title: 'Second Conditional', blurb: 'Unit 6 · if + past, would', gen: G.b1Cond2, cap: 52 },
    { id: 'b1-comparatives', title: 'Comparatives', blurb: 'Unit 7 · -er / more ... than', gen: G.comp, cap: 52 },
    { id: 'b1-too-enough', title: 'too / enough', blurb: 'Unit 7 · degree', gen: G.b1TooEnough, cap: 52 },
    { id: 'b1-quantifiers', title: 'much / many', blurb: 'Unit 8 · quantifiers', gen: G.muchMany, cap: 52 },
    { id: 'b1-a-few-little', title: 'a few / a little', blurb: 'Unit 8 · countable and uncountable', gen: G.b1AFewLittle, cap: 52 },
    { id: 'b1-passive-present', title: 'Present Passive', blurb: 'Unit 9 · is / are + past participle', gen: G.b1PassivePres, cap: 52 },
    { id: 'b1-passive-past', title: 'Past Passive', blurb: 'Unit 9 · was / were + past participle', gen: G.b1PassivePast, cap: 52 },
    { id: 'b1-relative-clauses', title: 'Relative Clauses', blurb: 'Unit 10 · who / which / where / whose', gen: G.b1Relative, cap: 52 },
    { id: 'b1-gerund-infinitive', title: 'Gerund or Infinitive', blurb: 'Unit 10 · verb + -ing / to', gen: G.b1GerundInf, cap: 52 }
  ];
  var B1 = B1_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: build(t.gen(), t.cap) };
  });

  // ── B1+ generators (reuse engine; upper-intermediate points) ──
  G.b1pPresPerfCont = function () {
    var out = [], DUR = ['for two hours', 'all day', 'since this morning', 'for a long time', 'lately', 'since 9am'];
    SUBJ_ALL.forEach(function (s) { VDUR.forEach(function (v) { var h = haveOf(s);
      out.push(mk(s + ' ' + h + ' ____ ' + v.ing + ' ' + v.o + ' ' + pick(DUR) + '.', 'been', ['being', 'be', 'was'], 'Present perfect continuous: have/has + been + verb-ing.'));
      out.push(mk(s + ' ____ been ' + v.ing + ' ' + v.o + '.', h, [h === 'have' ? 'has' : 'have', 'is', 'are'], 'Present perfect continuous: have/has + been + -ing.'));
    }); });
    return out;
  };
  G.b1pPastPerfect = function () {
    var out = [];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 16).forEach(function (v) {
      out.push(mk('When I arrived, ' + qsubj(s) + ' ____ already ' + v.pp + ' ' + v.o + '.', 'had', ['has', 'was', 'have'], 'Past perfect: had + past participle (the earlier action).'));
      out.push(mk(s + ' ____ never ' + v.pp + ' ' + v.o + ' before that day.', 'had', ['has', 'was', 'did'], 'Past perfect: had + past participle.'));
    }); });
    return out;
  };
  G.b1pFutureCont = function () {
    var out = [], TIME = ['this time tomorrow', 'at 8 tonight', 'all day tomorrow', 'next week'];
    SUBJ_ALL.forEach(function (s) { VDUR.forEach(function (v) {
      out.push(mk(s + ' will ____ ' + v.ing + ' ' + v.o + ' ' + pick(TIME) + '.', 'be', ['being', 'is', 'been'], 'Future continuous: will + be + verb-ing.'));
      out.push(mk('At 8 tonight ' + qsubj(s) + ' will be ____ (' + v.b + ') ' + v.o + '.', v.ing, [v.b, 'to ' + v.b, v.s], 'Future continuous: will be + verb-ing.'));
    }); });
    return out;
  };
  G.b1pDeduction = function () {
    var out = [];
    // Coherent evidence -> conclusion pairs (no arbitrary cross-product).
    var MUST = [['The lights are on', 'they', 'at home'], ['I can hear voices inside', 'someone', 'in there'], ['Her coat is on the chair', 'she', 'here somewhere'], ['The car is in the drive', 'they', 'home'], ['He keeps yawning', 'he', 'tired'], ['She is smiling a lot', 'she', 'happy'], ['He has eaten three plates', 'he', 'hungry'], ['You have worked all day', 'you', 'exhausted'], ['The ground is wet', 'it', 'raining'], ['They have a huge house', 'they', 'rich'], ['She knows everything about it', 'she', 'an expert'], ['He is shivering', 'he', 'cold']];
    var CANT = [['He is in Spain right now', 'that', 'him at the door'], ['She is only six', 'she', 'the driver'], ['They left two hours ago', 'they', 'still here'], ['It is the middle of the night', 'the shops', 'open'], ['He earns very little', 'he', 'the owner'], ['She never eats meat', 'this', 'her plate'], ['I posted it myself', 'the letter', 'lost'], ['He is a complete beginner', 'he', 'the champion'], ['It costs almost nothing', 'it', 'expensive'], ['The test was very easy', 'that', 'why he failed']];
    var MIGHT = [['The sky is grey', 'it', 'about to rain'], ['He is not answering his phone', 'he', 'busy'], ['I have not met him yet', 'he', 'friendly'], ['Nobody is certain', 'we', 'wrong'], ['She did not tell me', 'they', 'coming'], ['The forecast is unclear', 'it', 'sunny later'], ['I have not checked yet', 'it', 'correct'], ['There is no sign of them', 'they', 'late'], ['It is hard to say', 'this', 'the place'], ['No one has confirmed it', 'the news', 'true']];
    MUST.forEach(function (p) { out.push(mk(p[0] + ', so ' + p[1] + ' ____ be ' + p[2] + '.', 'must', ["can't", 'might', 'should'], 'Sure it is true -> must be.')); });
    CANT.forEach(function (p) { out.push(mk(p[0] + ', so ' + p[1] + " ____ be " + p[2] + '.', "can't", ['must', 'might', 'should'], "Sure it is not -> can't be.")); });
    MIGHT.forEach(function (p) { out.push(mk(p[0] + ', so ' + p[1] + ' ____ be ' + p[2] + '.', 'might', ['must', "can't", 'should'], 'Not sure -> might be.')); });
    return out;
  };
  G.b1pPastModals = function () {
    var out = [];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 12).forEach(function (v) {
      out.push(mk(s + ' ____ ' + v.pp + ' ' + v.o + '. It was a bad idea.', "shouldn't have", ['should have', "didn't have to", 'must have'], "Criticism of a past action: shouldn't have + past participle."));
      out.push(mk('Looking back, ' + qsubj(s) + ' ____ ' + v.pp + ' ' + v.o + '.', 'should have', ["shouldn't have", 'must have', 'could of'], 'Past regret / advice: should have + past participle.'));
    }); });
    var MUST = ['The ground is wet. It ____ rained.', 'He looks happy. He ____ passed.', 'They are not here. They ____ left.', 'The plate is empty. She ____ eaten.', 'The window is broken. Someone ____ broken it.'];
    MUST.forEach(function (st) { out.push(mk(st, 'must have', ["can't have", 'should have', 'might of'], 'must have + past participle = a sure conclusion about the past.')); });
    return out;
  };
  G.b1pCond3 = function () {
    var out = [], ITEMS = [['I had known', 'I', 'told you'], ['she had studied', 'she', 'passed'], ['we had left earlier', 'we', 'caught the train'], ['you had asked', 'I', 'helped'], ['they had invited us', 'we', 'come'], ['he had driven', 'he', 'arrived sooner'], ['it had not rained', 'we', 'gone out'], ['I had seen it', 'I', 'told you']];
    ITEMS.forEach(function (c) { out.push(mk('If ' + c[0] + ', ' + c[1] + ' would ____ ' + c[2] + '.', 'have', ['has', 'had', 'of'], 'Third conditional result: would have + past participle.')); });
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) { out.push(mk('If ' + qsubj(s) + ' ____ ' + v.pp + ' ' + v.o + ', things would have been different.', 'had', ['has', 'would have', 'did'], "Third conditional 'if' clause: had + past participle.")); }); });
    return out;
  };
  G.b1pWish = function () {
    var out = [], ADJ2 = ['rich', 'taller', 'here', 'younger', 'ready', 'famous', 'free', 'better'];
    var WISHERS = [['I', 'wish', 'I'], ['She', 'wishes', 'she'], ['He', 'wishes', 'he'], ['We', 'wish', 'we'], ['They', 'wish', 'they'], ['I', 'wish', 'he'], ['I', 'wish', 'they'], ['She', 'wishes', 'I']];
    WISHERS.forEach(function (w) { ADJ2.forEach(function (a) { out.push(mk(w[0] + ' ' + w[1] + ' ' + w[2] + ' ____ ' + a + '.', 'were', ['be', 'is', 'am'], 'wish + were for an unreal present situation.')); }); });
    WISHERS.forEach(function (w) { V.slice(0, 10).forEach(function (v) { out.push(mk(w[0] + ' ' + w[1] + ' ' + w[2] + ' ____ (' + v.b + ') ' + v.o + '.', v.ed, [v.s, v.b, 'will ' + v.b], 'wish + past simple for an unreal present.')); }); });
    return out;
  };
  G.b1pPassivePerf = function () {
    var out = [];
    // Curated subject + participle pairs (no "the car has been written").
    var SING = [
      ['The work', 'finished'], ['The report', 'written'], ['The room', 'cleaned'], ['The car', 'repaired'],
      ['The letter', 'sent'], ['The house', 'sold'], ['The window', 'broken'], ['The wall', 'painted'],
      ['The project', 'completed'], ['The decision', 'made'], ['The money', 'found'], ['The homework', 'checked'],
      ['The meeting room', 'booked'], ['The exam', 'marked'], ['The package', 'delivered'], ['The problem', 'solved']
    ];
    var PLU = [
      ['The emails', 'sent'], ['The reports', 'written'], ['The rooms', 'cleaned'], ['The cars', 'repaired'],
      ['The tickets', 'sold'], ['The windows', 'broken'], ['The walls', 'painted'], ['The projects', 'completed'],
      ['The keys', 'found'], ['The exams', 'marked'], ['The packages', 'delivered'], ['The problems', 'solved'],
      ['The invitations', 'printed'], ['The results', 'announced']
    ];
    SING.forEach(function (p) { out.push(mk(p[0] + ' ____ just been ' + p[1] + '.', 'has', ['have', 'is', 'was'], 'Present perfect passive (singular): has + been + past participle.')); });
    PLU.forEach(function (p) { out.push(mk(p[0] + ' ____ just been ' + p[1] + '.', 'have', ['has', 'are', 'were'], 'Present perfect passive (plural): have + been + past participle.')); });
    SING.forEach(function (p) { out.push(mk(p[0] + ' has ____ ' + p[1] + ' already.', 'been', ['being', 'be', 'is'], 'Present perfect passive: has/have + been + past participle.')); });
    PLU.forEach(function (p) { out.push(mk(p[0] + ' have ____ ' + p[1] + ' already.', 'been', ['being', 'be', 'are'], 'Present perfect passive: has/have + been + past participle.')); });
    return out;
  };
  G.b1pCausative = function () {
    var out = [];
    // % is replaced with the right possessive for the subject (his hair,
    // not "Tom has my hair cut").
    var THING = [['% car', 'repaired'], ['% hair', 'cut'], ['% house', 'painted'], ['% photo', 'taken'], ['% watch', 'fixed'], ['% documents', 'translated'], ['% suit', 'cleaned'], ['% windows', 'cleaned'], ['% eyes', 'tested'], ['% roof', 'repaired']];
    var POSS = { I: 'my', You: 'your', We: 'our', They: 'their', He: 'his', She: 'her', Tom: 'his', Anna: 'her' };
    ['I', 'You', 'We', 'They'].forEach(function (s) { THING.forEach(function (t) { out.push(mk(s + ' ____ ' + t[0].replace('%', POSS[s]) + ' ' + t[1] + ' yesterday.', 'had', ['have', 'has', 'did'], 'Causative (past): had + something + past participle.')); }); });
    // Present options stay in the present (has/have/does/is), so "every
    // month" cannot also be read as past habit.
    ['He', 'She', 'Tom', 'Anna'].forEach(function (s) { THING.forEach(function (t) { out.push(mk(s + ' ____ ' + t[0].replace('%', POSS[s]) + ' ' + t[1] + ' every month.', 'has', ['have', 'does', 'is'], 'Causative (he/she): has + something + past participle.')); }); });
    return out;
  };
  G.b1pReported = function () {
    var out = [], ITEMS = [
      ["Direct: 'I am tired.' -> He said he ____ tired.", 'was', ['is', 'will be', 'has been']],
      ["Direct: 'I work here.' -> She said she ____ there.", 'worked', ['works', 'work', 'is working']],
      ["Direct: 'I have finished.' -> He said he ____ finished.", 'had', ['has', 'have', 'was']],
      ["Direct: 'I will call.' -> She said she ____ call.", 'would', ['will', 'will have', 'shall']],
      ["Direct: 'I can swim.' -> He said he ____ swim.", 'could', ['can', 'will', 'is able to']],
      ["Direct: 'I am working.' -> He said he ____ working.", 'was', ['is', 'will be', 'has been']],
      ["Direct: 'I live in Rome.' -> She said she ____ in Rome.", 'lived', ['lives', 'live', 'is living']]
    ];
    ITEMS.forEach(function (q) { out.push(mk(q[0], q[1], q[2], 'In reported speech the tense usually shifts back one step.')); });
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) { out.push(mk('He said ' + qsubj(s) + ' ____ (' + v.b + ') ' + v.o + ' every day.', v.ed, [v.s, v.b, 'will ' + v.b], 'Reported speech: present simple shifts back to past simple.')); }); });
    return out;
  };
  G.b1pReportedQ = function () {
    var out = [], ITEMS = [
      ["Direct: 'Where do you live?' -> He asked where I ____.", 'lived', ['live', 'do live', 'am living']],
      ["Direct: 'What is your name?' -> She asked what my name ____.", 'was', ['is', 'will be', 'has been']],
      ["Direct: 'Are you ready?' -> He asked ____ I was ready.", 'if', ['that', 'do', 'what']],
      ["Direct: 'Do you like it?' -> She asked if I ____ it.", 'liked', ['like', 'do like', 'am liking']],
      ["Direct: 'Can you swim?' -> He asked if I ____ swim.", 'could', ['can', 'will', 'am able to']],
      ["Direct: 'Have you finished?' -> She asked if I ____ finished.", 'had', ['have', 'has', 'did']],
      ["Direct: 'When did you arrive?' -> She asked when I ____ arrived.", 'had', ['have', 'has', 'did']]
    ];
    ITEMS.forEach(function (q) { out.push(mk(q[0], q[1], q[2], 'Reported questions use statement word order and the tense shifts back.')); });
    SUBJ_ALL.forEach(function (s) { V.slice(0, 12).forEach(function (v) { out.push(mk('She asked where ' + qsubj(s) + ' ____ (' + v.b + ') ' + v.o + '.', v.ed, [v.s, v.b, 'does ' + v.b], 'Reported question: statement word order + the tense shifts back.')); }); });
    return out;
  };
  G.b1pVerbObj = function () {
    var out = [], VRB = ['want', 'wants', 'asked', 'told', 'expected', 'advised', 'allowed', 'persuaded', 'reminded', 'invited'];
    var OBJ = ['me', 'him', 'her', 'them', 'us', 'you', 'Tom', 'the students'];
    VRB.forEach(function (vb) { OBJ.forEach(function (o) { V.slice(0, 6).forEach(function (v) { out.push(mk('They ' + vb + ' ' + o + ' ____ (' + v.b + ') ' + v.o + '.', 'to ' + v.b, [v.b, v.ing, v.s], 'verb + object + to + base verb (want / ask / tell someone to do).')); }); }); });
    return out;
  };
  G.b1pRelativeND = function () {
    var out = [], PN = ['brother', 'sister', 'friend', 'teacher', 'boss', 'neighbour', 'cousin', 'uncle', 'aunt', 'father'];
    var TN = ['car', 'phone', 'house', 'laptop', 'watch', 'bike', 'camera', 'bag', 'flat', 'garden'];
    PN.forEach(function (n) {
      out.push(mk('My ' + n + ', ____ lives nearby, is very friendly.', 'who', ['which', 'that', 'whose'], 'Non-defining clause (with commas) for people: who, not that.'));
      out.push(mk('My ' + n + ', ____ I see often, is kind.', 'who', ['which', 'that', 'whose'], 'Non-defining clause for people: who.'));
      out.push(mk('My ' + n + ', ____ car is red, drives fast.', 'whose', ['who', 'which', 'that'], 'whose shows possession.'));
    });
    TN.forEach(function (n) {
      out.push(mk('My ' + n + ', ____ I bought recently, is great.', 'which', ['who', 'that', 'whose'], 'Non-defining clause (with commas) for things: which, not that.'));
      out.push(mk('Their ' + n + ', ____ is very old, still works.', 'which', ['who', 'that', 'whose'], 'Non-defining clause for things: which.'));
    });
    return out;
  };

  // ── B1+ unit skeleton (reuses some A2/B1 generators for review) ──
  var B1PLUS_SPEC = [
    { id: 'b1p-pres-perf-cont', title: 'Present Perfect Continuous', blurb: 'Unit 1 · have been + -ing', gen: G.b1pPresPerfCont, cap: 52 },
    { id: 'b1p-present-perfect', title: 'Present Perfect', blurb: 'Unit 1 · have / has + past participle', gen: G.pp, cap: 52 },
    { id: 'b1p-past-perfect', title: 'Past Perfect', blurb: 'Unit 2 · had + past participle', gen: G.b1pPastPerfect, cap: 52 },
    { id: 'b1p-past-continuous', title: 'Past Continuous', blurb: 'Unit 2 · was / were + -ing', gen: G.b1PastCont, cap: 52 },
    { id: 'b1p-future-continuous', title: 'Future Continuous', blurb: 'Unit 3 · will be + -ing', gen: G.b1pFutureCont, cap: 52 },
    { id: 'b1p-future', title: 'Future: will', blurb: 'Unit 3 · predictions and decisions', gen: G.b1FutureWillGoing, cap: 52 },
    { id: 'b1p-deduction', title: 'Modals of Deduction', blurb: "Unit 4 · must / can't / might be", gen: G.b1pDeduction, cap: 52 },
    { id: 'b1p-past-modals', title: 'Past Modals', blurb: 'Unit 4 · should have / must have', gen: G.b1pPastModals, cap: 72 },
    { id: 'b1p-conditional-3', title: 'Third Conditional', blurb: 'Unit 5 · if + past perfect, would have', gen: G.b1pCond3, cap: 52 },
    { id: 'b1p-wish', title: 'wish / if only', blurb: 'Unit 5 · unreal present', gen: G.b1pWish, cap: 52 },
    { id: 'b1p-passive-perfect', title: 'Present Perfect Passive', blurb: 'Unit 6 · has / have been + past participle', gen: G.b1pPassivePerf, cap: 52 },
    { id: 'b1p-causative', title: 'Causative have', blurb: 'Unit 6 · have something done', gen: G.b1pCausative, cap: 52 },
    { id: 'b1p-reported', title: 'Reported Speech', blurb: 'Unit 7 · statements', gen: G.b1pReported, cap: 52 },
    { id: 'b1p-reported-q', title: 'Reported Questions', blurb: 'Unit 7 · questions', gen: G.b1pReportedQ, cap: 52 },
    { id: 'b1p-relative', title: 'Relative Clauses', blurb: 'Unit 8 · who / which / where / whose', gen: G.b1Relative, cap: 52 },
    { id: 'b1p-relative-nd', title: 'Non-defining Relatives', blurb: 'Unit 8 · with commas', gen: G.b1pRelativeND, cap: 52 },
    { id: 'b1p-gerund-infinitive', title: 'Gerund or Infinitive', blurb: 'Unit 9 · verb + -ing / to', gen: G.b1GerundInf, cap: 52 },
    { id: 'b1p-verb-object', title: 'Verb + Object + to', blurb: 'Unit 9 · want someone to do', gen: G.b1pVerbObj, cap: 52 }
  ];
  var B1PLUS = B1PLUS_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: build(t.gen(), t.cap) };
  });

  // ── B2 generators (advanced points; reuse engine + pools) ──
  G.b2PastPerfCont = function () {
    var out = [], DUR = ['for two hours', 'all morning', 'for a long time', 'since dawn'];
    SUBJ_ALL.forEach(function (s) { VDUR.forEach(function (v) {
      out.push(mk('When I arrived, ' + qsubj(s) + ' had ____ ' + v.ing + ' ' + v.o + ' ' + pick(DUR) + '.', 'been', ['being', 'be', 'was'], 'Past perfect continuous: had + been + verb-ing for a longer earlier action.'));
      out.push(mk(s + ' ____ been ' + v.ing + ' ' + v.o + ' for hours when the phone rang.', 'had', ['has', 'have', 'was'], 'Past perfect continuous: had + been + verb-ing.'));
    }); });
    return out;
  };
  G.b2FuturePerf = function () {
    var out = [], BY = ['by Friday', 'by the end of the month', 'by 2030', 'by this time next year', 'by tomorrow evening'];
    SUBJ_ALL.forEach(function (s) { V.slice(0, 14).forEach(function (v) {
      out.push(mk(s + ' will ____ ' + v.pp + ' ' + v.o + ' ' + pick(BY) + '.', 'have', ['has', 'had', 'be'], 'Future perfect: will + have + past participle (finished before a future time).'));
      out.push(mk('By next year ' + qsubj(s) + ' will have ____ (' + v.b + ') ' + v.o + '.', v.pp, [v.b, v.ed === v.pp ? v.ing : v.ed, v.s], 'Future perfect: will have + past participle.'));
    }); });
    return out;
  };
  G.b2MixedCond = function () {
    // [if-clause(past perfect), base verb of the if-clause, subject, present result]
    var out = [], ITEMS = [
      ['I had studied medicine', 'study', 'I', 'a doctor now'], ['she had taken the job', 'take', 'she', 'in Paris now'],
      ['we had saved money', 'save', 'we', 'rich today'], ['he had learned English earlier', 'learn', 'he', 'fluent now'],
      ['they had caught the train', 'catch', 'they', 'here now'], ['you had slept well', 'sleep', 'you', 'less tired today'],
      ['I had listened to your advice', 'listen', 'I', 'in a better position now'], ['she had accepted the offer', 'accept', 'she', 'the manager today'],
      ['he had finished his degree', 'finish', 'he', 'an engineer now'], ['we had bought that flat', 'buy', 'we', 'homeowners today'],
      ['I had practised more', 'practise', 'I', 'on the team now'], ['they had booked earlier', 'book', 'they', 'on the plane now'],
      ['she had grown up abroad', 'grow', 'she', 'bilingual now'], ['you had kept the receipt', 'keep', 'you', 'able to return it now'],
      ['he had told the truth', 'tell', 'he', 'in less trouble now'], ['I had set an alarm', 'set', 'I', 'awake now'],
      ['we had planted the garden in spring', 'plant', 'we', 'eating our own vegetables now'], ['she had joined the course', 'join', 'she', 'certified today']
    ];
    ITEMS.forEach(function (c) {
      out.push(mk('If ' + c[0] + ', ' + c[2] + ' ____ be ' + c[3] + '.', 'would', ['will', 'would have', 'had'], 'Mixed conditional: past condition (if + past perfect) with a PRESENT result (would + base verb).'));
      out.push(mk('If ' + c[0] + ', ' + c[2] + ' would ____ ' + c[3] + '.', 'be', ['being', 'been', 'is'], 'The result is about NOW, so would + be.'));
      out.push(mk('If ' + c[2] + ' had ____ (' + c[1] + ') ' + c[0].replace(/^\w+ had \w+ ?/, '') + ', things would be different now.', c[0].split(' had ')[1].split(' ')[0], [c[1], c[1] + 's', c[1] + 'ing'], "The 'if' clause uses had + past participle."));
    });
    return out;
  };
  G.b2WishPast = function () {
    var out = [];
    var REG = [['I', 'wish', 'I'], ['She', 'wishes', 'she'], ['He', 'wishes', 'he'], ['We', 'wish', 'we'], ['They', 'wish', 'they'], ['I', 'wish', 'he'], ['She', 'wishes', 'I'], ['I', 'wish', 'they']];
    REG.forEach(function (w) { V.slice(0, 12).forEach(function (v) {
      out.push(mk(w[0] + ' ' + w[1] + ' ' + w[2] + ' ____ ' + v.pp + ' ' + v.o + ' yesterday.', 'had', ['has', 'have', 'would'], 'A regret about the PAST: wish + had + past participle.'));
    }); });
    return out;
  };
  G.b2ModalPassive = function () {
    var out = [];
    // [subject, participle, BASE verb (for the cue), tail]
    var PAIRS = [
      ['The form', 'completed', 'complete', 'in English'], ['The report', 'finished', 'finish', 'by Friday'],
      ['The rules', 'followed', 'follow', 'at all times'], ['This medicine', 'taken', 'take', 'twice a day'],
      ['The documents', 'signed', 'sign', 'before the deadline'], ['Phones', 'switched off', 'switch off', 'during the exam'],
      ['The room', 'booked', 'book', 'in advance'], ['The fee', 'paid', 'pay', 'online'],
      ['Helmets', 'worn', 'wear', 'on site'], ['The answers', 'written', 'write', 'in pencil'],
      ['The essay', 'submitted', 'submit', 'before midnight'], ['The lab coats', 'cleaned', 'clean', 'every week'],
      ['The equipment', 'checked', 'check', 'before each class'], ['The ID card', 'shown', 'show', 'at the gate'],
      ['The library books', 'returned', 'return', 'on time'], ['The seats', 'reserved', 'reserve', 'for guests'],
      ['The results', 'announced', 'announce', 'on Friday']
    ];
    PAIRS.forEach(function (p, i) {
      out.push(mk(p[0] + ' must ____ ' + p[1] + ' ' + p[3] + '.', 'be', ['been', 'being', 'to be'], 'Modal passive: modal + be + past participle.'));
      if (p[2].indexOf(' ') < 0) { // phrasal bases would inflect wrongly (switch offing)
        out.push(mk(p[0] + ' should be ____ (' + p[2] + ') ' + p[3] + '.', p[1], [p[2] + 'ing', 'to ' + p[2], p[2] + 's'], 'Modal passive: should + be + past participle.'));
      }
      if (i < 9) out.push(mk(p[0] + ' has to ____ ' + p[1] + ' ' + p[3] + '.', 'be', ['been', 'being', 'to be'], 'Modal passive: has to + be + past participle.'));
    });
    var CAN = [['Tickets', 'bought', 'online'], ['The museum', 'visited', 'for free on Mondays'], ['This word', 'used', 'in two ways'], ['The files', 'downloaded', 'from the website'], ['Lunch', 'ordered', 'at the desk'], ['The course', 'taken', 'in English or Turkish'], ['The hall', 'hired', 'for events'], ['Questions', 'asked', 'at the end'], ['The password', 'changed', 'in settings'], ['The slides', 'viewed', 'on any device']];
    CAN.forEach(function (p) { out.push(mk(p[0] + ' can ____ ' + p[1] + ' ' + p[2] + '.', 'be', ['been', 'being', 'to be'], 'Modal passive: can + be + past participle.')); });
    return out;
  };
  G.b2DeductionPast = function () {
    var out = [];
    var MUST = [['The ground is wet', 'it', 'rained last night'], ['He knows the whole story', 'he', 'read the report'], ['She speaks perfect French', 'she', 'lived in France'], ['The lights were on all night', 'someone', 'stayed late'], ['His desk is empty', 'he', 'left already'], ['The cake is gone', 'the children', 'eaten it'], ['They look exhausted', 'they', 'worked all night'], ['The window is broken', 'the storm', 'caused it'], ['Her bag is not here', 'she', 'gone home'], ['The grass is cut', 'the gardener', 'come this morning'], ['He answered every question', 'he', 'studied hard'], ['The plants are dead', 'everyone', 'forgotten to water them']];
    var CANT = [['He was with me all day', 'he', 'taken the keys'], ['She was abroad last week', 'she', 'attended the meeting'], ['The shop was closed', 'they', 'bought it there'], ['He cannot drive', 'he', 'driven the van'], ['The letter is unopened', 'she', 'read it'], ['They only met yesterday', 'they', 'known each other long'], ['The door was locked from inside', 'the thief', 'entered through it'], ['He is a vegetarian', 'he', 'ordered the steak'], ['She had no internet all week', 'she', 'seen the email'], ['The car was in the garage', 'he', 'driven to work'], ['The exam had not started yet', 'he', 'failed it'], ['I checked the list twice', 'I', 'missed her name']];
    var MIGHT = [['Nobody saw her leave', 'she', 'gone home early'], ['The phone is dead', 'he', 'forgotten to charge it'], ['The road was busy', 'they', 'taken a shortcut'], ['It is hard to say', 'the keys', 'fallen behind the desk'], ['There is no record', 'the email', 'gone to spam'], ['We are not sure', 'he', 'missed the bus']];
    MUST.forEach(function (p) { out.push(mk(p[0] + ', so ' + p[1] + ' ____ have ' + p[2] + '.', 'must', ["can't", 'might', 'should'], 'Sure about the past -> must have + past participle.')); });
    CANT.forEach(function (p) { out.push(mk(p[0] + ', so ' + p[1] + ' ____ have ' + p[2] + '.', "can't", ['must', 'might', 'should'], "Sure it did NOT happen -> can't have + past participle.")); });
    MIGHT.forEach(function (p) { out.push(mk(p[0] + ', so ' + p[1] + ' ____ have ' + p[2] + '.', 'might', ['must', "can't", 'should'], 'Not sure about the past -> might have + past participle.')); });
    // Second form: the HAVE slot ("must ____ rained" -> have).
    MUST.concat(CANT, MIGHT).forEach(function (p) {
      var modal = MUST.indexOf(p) >= 0 ? 'must' : (CANT.indexOf(p) >= 0 ? "can't" : 'might');
      out.push(mk(p[0] + ', so ' + p[1] + ' ' + modal + ' ____ ' + p[2] + '.', 'have', ['has', 'had', 'be'], 'Past deduction: modal + have + past participle.'));
    });
    return out;
  };
  G.b2BeUsedTo = function () {
    var out = [];
    // Contrast: used to + base (past habit) vs be used to + -ing (accustomed).
    var PASTHABIT = ['live in a village', 'play football', 'drink a lot of coffee', 'work in a bank', 'get up late'];
    PASTHABIT.forEach(function (p) {
      SUBJ_ALL.slice(0, 8).forEach(function (s) {
        out.push(mk('Years ago ' + qsubj(s) + ' ____ ' + p + ', but not any more.', 'used to', ['is used to', 'use to', 'was used to'], 'Past habit: used to + base verb.'));
      });
    });
    var ACCUSTOM = ['getting up early', 'working at night', 'driving in traffic', 'living alone', 'speaking English every day', 'eating spicy food'];
    ACCUSTOM.forEach(function (a) {
      SUBJ_ALL.slice(0, 8).forEach(function (s) {
        var be = beOf(s);
        out.push(mk('After two years here, ' + qsubj(s) + ' ____ used to ' + a + ' now.', be, [be === 'is' ? 'are' : 'is', 'used', 'did'], 'be used to + -ing = accustomed to it now.'));
      });
    });
    return out;
  };
  G.b2GerInfMeaning = function () {
    var out = [], ITEMS = [
      ["He stopped ____ (smoke) two years ago. He doesn't smoke now.", 'smoking', ['to smoke', 'smoke', 'smoked'], 'stop + -ing = quit the activity.'],
      ['She stopped ____ (buy) a coffee on the way, then drove on.', 'to buy', ['buying', 'buy', 'bought'], 'stop + to = pause in order to do something.'],
      ["I remember ____ (lock) the door this morning. I can picture it.", 'locking', ['to lock', 'lock', 'locked'], 'remember + -ing = a memory of a past action.'],
      ['Please remember ____ (lock) the door when you leave tonight.', 'to lock', ['locking', 'lock', 'locked'], 'remember + to = do not forget a duty.'],
      ["I'll never forget ____ (see) the sea for the first time years ago.", 'seeing', ['to see', 'see', 'saw'], 'forget + -ing = an unforgettable past experience.'],
      ["Don't forget ____ (send) the report before Friday.", 'to send', ['sending', 'send', 'sent'], 'forget + to = a duty not yet done.'],
      ['The room was hot, so he tried ____ (open) the window, but it was stuck.', 'to open', ['opening', 'open', 'opened'], 'try + to = attempt something difficult.'],
      ['If the file will not open, try ____ (restart) the computer.', 'restarting', ['to restart', 'restart', 'restarted'], 'try + -ing = experiment with a method.'],
      ['He went on ____ (talk) for an hour after the break.', 'talking', ['to talk', 'talk', 'talked'], 'go on + -ing = continue the same activity.'],
      ['After her degree she went on ____ (become) a judge.', 'to become', ['becoming', 'become', 'became'], 'go on + to = the next stage, a change.'],
      ['I regret ____ (tell) you that the flight is cancelled.', 'to tell', ['telling', 'tell', 'told'], 'regret + to = bad news now.'],
      ['She regrets ____ (sell) her old guitar last year.', 'selling', ['to sell', 'sell', 'sold'], 'regret + -ing = a past action she is sorry about.'],
      ['It started ____ (rain) during the match yesterday.', 'to rain', ['rain', 'rained', 'rains'], 'start + to / -ing are both fine; only this option is grammatical here.'],
      ['He means ____ (finish) the project by Friday.', 'to finish', ['finishing', 'finish', 'finished'], 'mean + to = intend to.'],
      ['Getting the visa means ____ (fill) in many forms.', 'filling', ['to fill', 'fill', 'filled'], 'mean + -ing = involves.'],
      ['She tried ____ (call) you twice last night, but no answer.', 'to call', ['calling', 'call', 'called'], 'try + to = attempted.'],
      ['She tried ____ (add) more salt, but the soup still tasted flat.', 'adding', ['to add', 'add', 'added'], 'try + -ing = experiment with a method.'],
      ['Remember ____ (bring) your ID to the exam tomorrow.', 'to bring', ['bringing', 'bring', 'brought'], 'remember + to = a duty.'],
      ['I remember ____ (meet) him at a conference years ago.', 'meeting', ['to meet', 'meet', 'met'], 'remember + -ing = a past memory.'],
      ['He stopped ____ (answer) a phone call, then continued walking.', 'to answer', ['answering', 'answer', 'answered'], 'stop + to = pause in order to do something.'],
      ['They stopped ____ (sell) printed maps years ago.', 'selling', ['to sell', 'sell', 'sold'], 'stop + -ing = quit the activity.'],
      ['I regret ____ (say) that your application was not successful.', 'to say', ['saying', 'say', 'said'], 'regret + to = bad news now.'],
      ['He regrets ____ (leave) school at sixteen.', 'leaving', ['to leave', 'leave', 'left'], 'regret + -ing = a past action he is sorry about.'],
      ["Don't forget ____ (turn) off the lights tonight.", 'to turn', ['turning', 'turn', 'turned'], 'forget + to = a duty not yet done.']
    ];
    ITEMS.forEach(function (q) { out.push(mk(q[0], q[1], q[2], q[3])); });
    return out;
  };
  G.b2ReportingVerbs = function () {
    var out = [], ITEMS = [
      ["'I'll help you,' she said. -> She ____ to help me.", 'offered', ['suggested', 'refused', 'denied'], 'offer + to + base verb.'],
      ["'I won't do it,' he said. -> He ____ to do it.", 'refused', ['offered', 'denied', 'admitted'], 'refuse + to + base verb.'],
      ["'Let's go to the cinema,' she said. -> She ____ going to the cinema.", 'suggested', ['offered', 'promised', 'agreed'], 'suggest + -ing.'],
      ["'I broke the window,' he said. -> He ____ breaking the window.", 'admitted', ['refused', 'offered', 'promised'], 'admit + -ing.'],
      ["'I didn't take the money,' she said. -> She ____ taking the money.", 'denied', ['admitted', 'suggested', 'agreed'], 'deny + -ing.'],
      ["'I'll definitely come,' he said. -> He ____ to come.", 'promised', ['denied', 'suggested', 'admitted'], 'promise + to + base verb.'],
      ["'You should see a doctor,' she said. -> She ____ me to see a doctor.", 'advised', ['suggested', 'denied', 'offered'], 'advise + object + to.'],
      ["'Don't touch it!' he said. -> He ____ me not to touch it.", 'warned', ['denied', 'suggested', 'admitted'], 'warn + object + (not) to.'],
      ["'Could you open the window?' she said. -> She ____ me to open the window.", 'asked', ['suggested', 'denied', 'admitted'], 'ask + object + to.'],
      ["'OK, I'll pay half,' he said. -> He ____ to pay half.", 'agreed', ['denied', 'warned', 'admitted'], 'agree + to + base verb.'],
      ["'I'm sorry I was late,' she said. -> She ____ for being late.", 'apologised', ['admitted', 'denied', 'promised'], 'apologise for + -ing.'],
      ["'Buy the tickets early,' he said. -> He ____ buying the tickets early.", 'recommended', ['refused', 'promised', 'offered'], 'recommend + -ing.']
    ];
    ITEMS.forEach(function (q) { out.push(mk(q[0], q[1], q[2], q[3])); });
    // Pattern drills: the verb is given, the student picks the right form.
    var LEMMA = { offered: 'offer', refused: 'refuse', promised: 'promise', agreed: 'agree', suggested: 'suggest', admitted: 'admit', denied: 'deny', recommended: 'recommend' };
    var TOV = ['offered', 'refused', 'promised', 'agreed'];
    var TOACT = [['help', 'us'], ['pay', 'half'], ['drive', 'me home'], ['wait', 'outside'], ['join', 'the team'], ['check', 'the figures'], ['carry', 'the boxes'], ['explain', 'the rules']];
    TOV.forEach(function (vb) { TOACT.forEach(function (a) {
      out.push(mk('He ' + vb + ' ____ (' + a[0] + ') ' + a[1] + '.', 'to ' + a[0], [a[0] + 'ing', a[0], a[0] + 'ed'], LEMMA[vb] + ' + to + base verb.'));
    }); });
    var INGV = ['suggested', 'admitted', 'denied', 'recommended'];
    var INGACT = [['take', 'taking', 'a taxi'], ['go', 'going', 'home early'], ['use', 'using', 'her phone in class'], ['copy', 'copying', 'the answers'], ['book', 'booking', 'the early train'], ['leave', 'leaving', 'the door open'], ['visit', 'visiting', 'the museum'], ['try', 'trying', 'the new cafe']];
    INGV.forEach(function (vb) { INGACT.forEach(function (a) {
      out.push(mk('She ' + vb + ' ____ (' + a[0] + ') ' + a[2] + '.', a[1], ['to ' + a[0], a[0], a[0] + 's'], LEMMA[vb] + ' + -ing.'));
    }); });
    return out;
  };
  G.b2SoSuch = function () {
    var out = [];
    var SO = [['The film was', 'boring', 'that we left early'], ['The test was', 'easy', 'that everyone passed'], ['He spoke', 'quickly', 'that nobody understood'], ['The coffee was', 'hot', 'that I could not drink it'], ['The room was', 'small', 'that we could not all fit'], ['She was', 'tired', 'that she fell asleep at dinner'], ['The music was', 'loud', 'that the neighbours complained'], ['The queue was', 'long', 'that we gave up'], ['The lecture was', 'long', 'that some students fell asleep'], ['The book was', 'good', 'that I read it twice'], ['It was', 'dark', 'that we could not see the path'], ['The bag was', 'heavy', 'that I could not lift it']];
    var SUCH = [['It was', 'a boring film', 'that we left early'], ['It was', 'an easy test', 'that everyone passed'], ['It was', 'a hot day', 'that we stayed inside'], ['It was', 'a small room', 'that we could not all fit'], ['He is', 'a good teacher', 'that his classes are always full'], ['It was', 'a long queue', 'that we gave up'], ['She made', 'a big mistake', 'that everyone noticed'], ['They had', 'a great time', 'that they did not want to leave'], ['It was', 'a difficult exam', 'that half the class failed'], ['He told', 'a funny story', 'that everyone laughed'], ['It was', 'an expensive hotel', 'that we stayed one night only'], ['She has', 'a busy schedule', 'that she rarely rests']];
    SO.forEach(function (p) { out.push(mk(p[0] + ' ____ ' + p[1] + ' ' + p[2] + '.', 'so', ['such', 'such a', 'very'], 'so + adjective/adverb (+ that).')); });
    SUCH.forEach(function (p) { out.push(mk(p[0] + ' ____ ' + p[1] + ' ' + p[2] + '.', 'such', ['so', 'so a', 'very'], 'such + (a/an) + adjective + noun (+ that).')); });
    return out;
  };
  G.b2Unless = function () {
    var out = [], ITEMS = [
      ["You'll miss the bus ____ you leave now.", 'unless', ['if', 'when', 'although'], "unless = if ... not."],
      ["We'll eat outside ____ it rains.", 'unless', ['if', 'because', 'although'], 'unless = if it does not rain.'],
      ['____ you study, you will fail the exam.', 'Unless', ['If', 'Although', 'Because'], 'Unless you study = if you do not study.'],
      ["He won't come ____ you invite him personally.", 'unless', ['if', 'although', 'so'], 'unless = if ... not.'],
      ['Take an umbrella ____ case it rains.', 'in', ['on', 'at', 'for'], 'in case + present = preparation for a possibility.'],
      ["I'll take my phone ____ case you need to call me.", 'in', ['on', 'at', 'for'], 'in case you need = because you might need.'],
      ["____ long as you finish the work, you can leave early.", 'As', ['So that', 'Even', 'Despite'], 'as long as = on condition that.'],
      ['You can borrow the car as ____ as you drive carefully.', 'long', ['far', 'soon', 'well'], 'as long as = provided that.'],
      ["Speak quietly ____ that the baby doesn't wake up.", 'so', ['in', 'unless', 'for'], 'so that + clause = purpose.'],
      ['He saved money ____ that he could travel next summer.', 'so', ['unless', 'despite', 'for'], 'so that = purpose.'],
      ["You won't improve ____ you practise every day.", 'unless', ['if', 'although', 'because'], 'unless = if ... not.'],
      ['Write it down ____ case you forget.', 'in', ['on', 'at', 'for'], 'in case = because you might.'],
      ['We left early so ____ we could find parking.', 'that', ['as', 'if', 'for'], 'so that + clause = purpose.'],
      ['You can stay ____ long as you keep quiet.', 'as', ['so', 'too', 'very'], 'as long as = on condition that.']
    ];
    ITEMS.forEach(function (q) { out.push(mk(q[0], q[1], q[2], q[3])); });
    return out;
  };
  G.b2Articles = function () {
    var out = [], ITEMS = [
      ['She plays ____ piano beautifully.', 'the', ['a', 'an', 'this'], 'the + musical instruments.'],
      ['He is in ____ hospital after the accident.', 'x', [], ''],
      ['____ Nile flows through Egypt.', 'The', ['A', 'An', 'This'], 'the + rivers.'],
      ['They crossed ____ Atlantic in five days.', 'the', ['a', 'an', 'this'], 'the + oceans and seas.'],
      ['We visited ____ Netherlands last spring.', 'the', ['a', 'an', 'this'], 'the + plural country names.'],
      ['____ rich should help the poor, people say.', 'The', ['A', 'An', 'This'], 'the + adjective = a group of people.'],
      ['Mount Everest is ____ highest mountain on Earth.', 'the', ['a', 'an', 'this'], 'the + superlatives.'],
      ['She was ____ first person to arrive this morning.', 'the', ['a', 'an', 'this'], 'the + ordinal numbers (first, second).'],
      ['He bought ____ umbrella because of the forecast.', 'an', ['a', 'the', 'these'], 'an + vowel sound, first mention.'],
      ['It was ____ honest answer, and I respected it.', 'an', ['a', 'the', 'these'], "an + silent h ('onest)."],
      ['She works as ____ engineer at a tech firm.', 'an', ['a', 'the', 'these'], 'an + vowel sound for jobs.'],
      ['What ____ beautiful day it is today!', 'a', ['an', 'the', 'this'], 'What + a + adjective + noun.'],
      ['They go to school by ____ bus every day.', 'x', [], '']
    ];
    ITEMS.forEach(function (q) { if (q[1] !== 'x') out.push(mk(q[0], q[1], q[2], q[3])); });
    return out;
  };

  // ── B2 unit skeleton (new points + targeted review) ────────
  var B2_SPEC = [
    { id: 'b2-pres-perf-cont', title: 'Present Perfect Continuous', blurb: 'Unit 1 · have been + -ing', gen: G.b1pPresPerfCont, cap: 52 },
    { id: 'b2-past-perf-cont', title: 'Past Perfect Continuous', blurb: 'Unit 1 · had been + -ing', gen: G.b2PastPerfCont, cap: 52 },
    { id: 'b2-future-perfect', title: 'Future Perfect', blurb: 'Unit 2 · will have + past participle', gen: G.b2FuturePerf, cap: 52 },
    { id: 'b2-future-continuous', title: 'Future Continuous', blurb: 'Unit 2 · will be + -ing', gen: G.b1pFutureCont, cap: 52 },
    { id: 'b2-conditional-3', title: 'Third Conditional', blurb: 'Unit 3 · if + past perfect, would have', gen: G.b1pCond3, cap: 52 },
    { id: 'b2-mixed-conditional', title: 'Mixed Conditionals', blurb: 'Unit 3 · past condition, present result', gen: G.b2MixedCond, cap: 52 },
    { id: 'b2-wish-past', title: 'wish + past perfect', blurb: 'Unit 4 · regrets about the past', gen: G.b2WishPast, cap: 52 },
    { id: 'b2-wish-present', title: 'wish / if only', blurb: 'Unit 4 · unreal present', gen: G.b1pWish, cap: 52 },
    { id: 'b2-modal-passive', title: 'Modal Passives', blurb: 'Unit 5 · must / can / should + be done', gen: G.b2ModalPassive, cap: 52 },
    { id: 'b2-passive-perfect', title: 'Perfect Passive', blurb: 'Unit 5 · has / have been + done', gen: G.b1pPassivePerf, cap: 52 },
    { id: 'b2-deduction-past', title: 'Past Deduction', blurb: "Unit 6 · must / can't / might have done", gen: G.b2DeductionPast, cap: 52 },
    { id: 'b2-past-modals', title: 'Past Modals', blurb: 'Unit 6 · should have / must have', gen: G.b1pPastModals, cap: 52 },
    { id: 'b2-be-used-to', title: 'used to vs be used to', blurb: 'Unit 7 · habits and adaptation', gen: G.b2BeUsedTo, cap: 52 },
    { id: 'b2-causative', title: 'Causative have', blurb: 'Unit 7 · have something done', gen: G.b1pCausative, cap: 52 },
    { id: 'b2-reporting-verbs', title: 'Reporting Verbs', blurb: 'Unit 8 · offer / deny / suggest / admit', gen: G.b2ReportingVerbs, cap: 52 },
    { id: 'b2-reported-speech', title: 'Reported Speech', blurb: 'Unit 8 · tense backshift', gen: G.b1pReported, cap: 52 },
    { id: 'b2-ger-inf-meaning', title: 'stop / remember / try + -ing or to', blurb: 'Unit 9 · meaning changes', gen: G.b2GerInfMeaning, cap: 52 },
    { id: 'b2-so-such-unless', title: 'so / such + unless / in case', blurb: 'Unit 9 · emphasis and condition', gen: function () { return G.b2SoSuch().concat(G.b2Unless(), G.b2Articles()); }, cap: 52 },
    { id: 'b2-gerund-review', title: 'Gerund or Infinitive: review', blurb: 'Unit 9 · verb + -ing / to', gen: G.b1GerundInf, cap: 31 }
  ];
  var B2 = B2_SPEC.map(function (t) {
    return { id: t.id, title: t.title, blurb: t.blurb, questions: build(t.gen(), t.cap) };
  });

  window.GRAMMAR_PRACTICE = {
    levels: ['A2', 'B1', 'B1+', 'B2'],
    byLevel: { 'A2': A2, 'B1': B1, 'B1+': B1PLUS, 'B2': B2 }
  };
})();
