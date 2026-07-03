#!/usr/bin/env node
/*
 * grammar-sanity.js  -  ALL-UNITS sanity / sandbox check for the grammar bank.
 *
 * Loads y/student/js/skills/grammar-content.js exactly the way the browser does
 * (it sets window.GRAMMAR_PRACTICE) and audits EVERY level -> EVERY unit ->
 * EVERY question against three families of rules:
 *
 *   1. STRUCTURE   one blank, 4 distinct options, a valid answer index, a hint.
 *   2. GIVE-AWAY   the hint must NOT hand over the answer. A hint is a GIVEAWAY
 *                  when it contains the answer phrase but NONE of the wrong
 *                  options (so there is nothing to choose between - it just
 *                  tells you). A hint that lists the answer AND a distractor is
 *                  a teaching paradigm (e.g. "I am, he/she/it is...") and is OK.
 *                  A hint that contains a distractor but not the answer can
 *                  mislead and is reported too.
 *   3. SEMANTICS   curated "this can't mean anything" patterns: a child who is a
 *                  nurse, a car in the kitchen, people in a box, being ill "last
 *                  year", an adjective glued to a noun it can't describe, and the
 *                  old "... in the city / of the year" superlative templates.
 *
 * Exit code is 0 only when every unit passes every check (so it can gate a
 * deploy). Run:  node y/tools/grammar-sanity.js  [--samples]
 */
'use strict';
var path = require('path');
var REPO = path.resolve(__dirname, '..', '..');
var CONTENT = path.join(REPO, 'y', 'student', 'js', 'skills', 'grammar-content.js');
var SHOW_SAMPLES = process.argv.indexOf('--samples') !== -1;

// ---- load the bank the same way index.html does (global window) -------------
global.window = {};
global.document = { addEventListener: function () {} };
require(CONTENT);
var GP = global.window.GRAMMAR_PRACTICE;
if (!GP || !GP.byLevel) { console.error('FAIL: window.GRAMMAR_PRACTICE.byLevel not found'); process.exit(2); }

// ---- helpers ----------------------------------------------------------------
function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hasPhrase(hay, needle) {
  if (!hay || !needle) return false;
  needle = String(needle).trim();
  if (!needle) return false;
  // word-ish boundary so "is" does not match "this"; phrases match literally
  var re = new RegExp('(^|[^A-Za-z])' + esc(needle) + '([^A-Za-z]|$)', 'i');
  return re.test(' ' + hay + ' ');
}

// Curated "this sentence cannot mean anything" patterns. Each returns true when
// the FILLED sentence (answer substituted into the blank) is nonsense.
var SEMANTIC = [
  ['child+profession', /\b(child|children|baby|babies|kid|kids)\b[^.?!]*\b(doctor|nurse|engineer|driver|lawyer|pilot|manager)s?\b/i],
  ['living-thing-in-container', /\b(people|person|boy|boys|girl|girls|man|men|woman|women|child|children|baby)\b[^.?!]*\bin the (box|drawer|cup|bottle|fridge|pocket)\b/i],
  ['vehicle-indoors', /\b(car|cars|bus|buses|truck|lorry|train|plane)\b[^.?!]*\bin the (kitchen|bedroom|room|drawer|box)\b/i],
  ['window-outdoors', /\bwindows?\b[^.?!]*\b(in the garden|outside)\b/i],
  ['transient-state+long-time', /\b(tired|ill|hungry|angry|busy|nervous|sad|afraid|thirsty|sleepy)\b[^.?!]*\b(last year|last month|last summer|in \d{4}|years ago)\b/i],
  ['abstract+demonstrative-article', /\b(this|that|it) (is|was) an? (hour|idea|email|answer|day|exam)\b/i],
  ['drink-nonliquid', /\bdrink(s|ing)?\b[^.?!]*\b(homework|book|books|money|bread|meat|rice|car)\b/i],
  ['eat-nonfood', /\beat(s|ing|en)?\b[^.?!]*\b(homework|money|water|coffee|tea|music|traffic)\b/i],
  ['old-superlative-template', /\bthe (most )?[a-z]+ [a-z]+ (in the (city|world|shop|area|country|house|school|park|sea|village|showroom|museum|street|garage|pool|class|group|family|stage)|in town|of the (year|week|month|day)|on the (island|website|stage)|from here|near us|of all|of (my|the) life|i have read|i know|for me|in life)\b/i],
  ['adj-noun-mismatch', null] // handled procedurally below
];

// Adjective -> nouns it can sensibly modify. Used to catch "difficult restaurant",
// "happy exam", "fast film" no matter which generator produced them.
var ADJ_OK = {
  difficult: ['exam', 'question', 'task', 'course', 'job', 'test', 'subject', 'lesson', 'problem'],
  easy: ['exam', 'question', 'task', 'course', 'job', 'test', 'subject', 'lesson', 'recipe', 'problem'],
  happy: ['child', 'student', 'family', 'team', 'customer', 'person', 'boy', 'girl', 'man', 'woman', 'baby'],
  fast: ['car', 'train', 'runner', 'computer', 'plane', 'swimmer', 'bus', 'horse'],
  slow: ['car', 'train', 'computer', 'lift', 'bus', 'internet'],
  tall: ['building', 'tree', 'tower', 'player', 'man', 'boy', 'woman', 'girl', 'person'],
  young: ['student', 'player', 'child', 'brother', 'team', 'sister', 'man', 'woman', 'singer'],
  comfortable: ['chair', 'bed', 'sofa', 'seat', 'hotel', 'room', 'car'],
  dangerous: ['sport', 'road', 'animal', 'job', 'area', 'street', 'route'],
  delicious: ['meal', 'cake', 'dish', 'soup', 'food', 'dinner', 'lunch']
};
var ADJ_WORDS = Object.keys(ADJ_OK);
// Only ATTRIBUTIVE adjectives ("a difficult restaurant") can be mismatched.
// Predicative ("was happy yesterday") and adverbial ("run fast") uses are fine,
// so we only flag when an NP opener (article/quantifier/intensifier) sits right
// before the adjective. This keeps "most difficult restaurant" but drops the
// "happy yesterday" / "fast years" false positives.
var NP_OPEN = ['a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'more', 'most', 'very', 'really', 'quite', 'so', 'too', 'no', 'one', 'two', 'three', 'some', 'any', 'each', 'every', 'another'];
// words that can follow an adjective but are NOT the head noun (so not a mismatch)
var NOUN_STOP = ['than', 'one', 'ones', 'here', 'there', 'now', 'today', 'yesterday', 'tomorrow', 'enough', 'too', 'and', 'or', 'but', 'this', 'that', 'these', 'those', 'very', 'more', 'most', 'as', 'for', 'to', 'in', 'at', 'on'];
function adjNounMismatch(sent) {
  var low = ' ' + sent.toLowerCase() + ' ';
  for (var i = 0; i < ADJ_WORDS.length; i++) {
    var adj = ADJ_WORDS[i];
    var re = new RegExp('([a-z]+)\\s+' + adj + '\\s+([a-z]+)', 'g'), m;
    while ((m = re.exec(low))) {
      if (NP_OPEN.indexOf(m[1]) === -1) continue;      // not attributive -> skip
      var nounPl = m[2], noun = nounPl.replace(/s$/, '');
      if (NOUN_STOP.indexOf(nounPl) !== -1) continue;  // "more difficult than" -> than is not a noun
      var ok = ADJ_OK[adj];
      if (ok.indexOf(noun) === -1 && ok.indexOf(nounPl) === -1) return adj + '+' + nounPl + ' (' + m[1] + ' ' + adj + ' ' + nounPl + ')';
    }
  }
  return null;
}

function filled(q) {
  var ans = q.options[q.answer];
  return String(q.stem).replace(/_{2,}/, ans);
}

// Text-quality glitches that read wrong even when the grammar point is right:
// a word printed twice, a space before punctuation, a capital pronoun stranded
// mid-sentence, a misspelled -ing, or a wrong third-person -s.
function textGlitch(sent) {
  var m;
  if ((m = sent.match(/\b([A-Za-z]+)\s+\1\b/i))) return 'doubled word "' + m[1] + '"';
  if (/\s[.?!,;:]/.test(sent)) return 'space before punctuation';
  if (/,\s+(He|She|We|They|It|You)\b/.test(sent)) return 'capital pronoun mid-sentence';
  if ((m = sent.match(/\b[a-z]*[bcdfghjklmnpqrstvwz]eing\b/i)) && !/\b(be|see|agree|flee|free|guarantee|referee)ing$/i.test(m[0])) return 'misspelled -ing "' + m[0] + '"';
  if ((m = sent.match(/\b[a-z]*(?:sh|ch|ss|x)s\b/i))) return 'bad third-person -s "' + m[0] + '"';
  return null;
}

// ---- ambiguity ("more than one correct answer") heuristic ------------------
// A lightweight grammar check: when the stem has no time/aspect anchor, two
// options can both be grammatically valid, so the MCQ has more than one answer.
// Review-only (heuristics misjudge), but it surfaces the exact pattern reviewers
// keep finding: present vs past be, will vs won't, simple vs perfect passive, and
// the base/past of one verb both offered.
var TIME_ANCHOR = /\b(yesterday|ago|last\s+(night|week|month|year|summer)|earlier today|tonight|tomorrow|next\s+(week|month|year)|this\s+(time|weekend|morning|afternoon|evening)|right now|now|today|every\s+day|usually|always|often|sometimes|rarely|never|at the moment|just|already|ever|since|for\s+(an?\s+\w+|\w+\s+(hours|days|weeks|months|years|ages))|in\s+\d{4}|when\b|while\b|by the time|all\s+(day|morning|evening|night|winter)|before the|after we|on\s+[A-Z]\w+day|at\s+(nine|noon|eight|\d)|in\s+ten\s+minutes|this morning)\b/i;
function numberOf(subj) {
  var w = String(subj).toLowerCase().replace(/[^a-z' ]/g, '').trim().split(' ').pop();
  if (w === 'i') return 'I';
  if (['we', 'you', 'they', 'parents', 'children', 'students', 'people', 'women', 'men', 'friends', 'boys', 'girls', 'guests', 'workers', 'staff', 'tickets', 'keys', 'windows', 'reports', 'letters', 'cars', 'books', 'walls', 'files', 'orders', 'roads', 'novels', 'matches', 'systems', 'contracts', 'cases', 'buildings', 'bills', 'rooms', 'cats', 'dogs', 'cups', 'plants', 'sofas', 'tables', 'chairs', 'pens', 'clocks', 'phones', 'sisters'].indexOf(w) !== -1) return 'PL';
  if (/[^aeiou]s$/.test(w) && !/(bus|glass|class|address|business|gas)$/.test(w)) return 'PL';
  return 'S3';
}
var BEPRES = { I: 'am', S3: 'is', PL: 'are' }, BEPAST = { I: 'was', S3: 'was', PL: 'were' };
function ambiguityFlag(q) {
  var stem = String(q.stem);
  if (TIME_ANCHOR.test(stem)) return null;
  if (stem.indexOf(' -> ') !== -1) return null;        // a "quote -> reported" conversion forces the shift
  var ans = (q.answer != null && q.options[q.answer] != null) ? String(q.options[q.answer]) : '';
  if (/^to\s/i.test(ans)) return null;                 // infinitive answer: base/past distractors are not alternatives
  var forcedPast = /\bwish(es)?\b|\bwould\b|\bif\b/i.test(stem);   // wish / would / if force the unreal past
  var bi = stem.indexOf('____'); if (bi < 0) return null;
  var subj = stem.slice(0, bi).trim().split(/[,;:]| if | when | while | so | that | because /i).pop().trim();
  var num = numberOf(subj);
  var opts = q.options.map(function (o) { return String(o); });
  if (opts.indexOf('will') !== -1 && (opts.indexOf("won't") !== -1 || opts.indexOf('will not') !== -1)) return 'will + won\'t both valid';
  if ((opts.indexOf('has been') !== -1 && opts.indexOf('was') !== -1) || (opts.indexOf('have been') !== -1 && opts.indexOf('were') !== -1)) return 'perfect+simple passive both valid';
  if (forcedPast) return null;                         // an unreal-past clause: only the past form is right
  if (opts.indexOf(BEPRES[num]) !== -1 && opts.indexOf(BEPAST[num]) !== -1 && BEPRES[num] !== BEPAST[num]) return 'be present+past both valid (' + BEPRES[num] + '/' + BEPAST[num] + ')';
  for (var i = 0; i < opts.length; i++) for (var j = 0; j < opts.length; j++) {
    if (i !== j && /^[a-z]{3,}$/.test(opts[i]) && opts[j] === opts[i] + 'ed' && (ans === opts[i] || ans === opts[j])) return 'base+past of one verb (' + opts[i] + '/' + opts[j] + ')';
  }
  return null;
}

// ---- run --------------------------------------------------------------------
var levels = Object.keys(GP.byLevel);
var grand = { q: 0, struct: 0, giveaway: 0, distractorHint: 0, semantic: 0, ambig: 0, units: 0, badUnits: 0 };
var report = [];

levels.forEach(function (lvl) {
  var topics = GP.byLevel[lvl] || [];
  topics.forEach(function (t) {
    grand.units++;
    var u = { lvl: lvl, id: t.id, n: t.questions.length, struct: [], giveaway: [], distractorHint: [], semantic: [], ambig: [] };
    t.questions.forEach(function (q) {
      grand.q++;
      // 1. structure
      if (typeof q.stem !== 'string' || (q.stem.match(/_{2,}/g) || []).length !== 1) u.struct.push('blank:' + q.stem);
      else if (!Array.isArray(q.options) || q.options.length !== 4) u.struct.push('opts:' + q.stem);
      else if (new Set(q.options).size !== 4) u.struct.push('dup:' + q.stem);
      else if (q.answer == null || q.answer < 0 || q.answer > 3 || q.options[q.answer] == null) u.struct.push('ans:' + q.stem);
      else if (!q.hint) u.struct.push('hint-missing:' + q.stem);

      // 2. give-away (only when structure is sane)
      if (Array.isArray(q.options) && q.options.length === 4 && q.hint && q.answer != null && q.options[q.answer] != null) {
        var ansText = q.options[q.answer];
        var distr = q.options.filter(function (_, i) { return i !== q.answer; });
        var ansIn = hasPhrase(q.hint, ansText);
        var distrIn = distr.filter(function (d) { return hasPhrase(q.hint, d); });
        if (ansIn && distrIn.length === 0) u.giveaway.push(q.stem + '  ==> ans "' + ansText + '" | hint: ' + q.hint);
        else if (!ansIn && distrIn.length > 0) u.distractorHint.push(q.stem + '  ==> only wrong opt in hint: ' + distrIn.join(',') + ' | hint: ' + q.hint);
      }

      // 3. semantics (on the filled sentence)
      if (Array.isArray(q.options) && q.options[q.answer] != null) {
        var sent = filled(q);
        for (var i = 0; i < SEMANTIC.length; i++) {
          if (SEMANTIC[i][1] && SEMANTIC[i][1].test(sent)) { u.semantic.push(SEMANTIC[i][0] + ': ' + sent); break; }
        }
        var mm = adjNounMismatch(sent);
        if (mm) u.semantic.push('adj-noun-mismatch ' + mm + ': ' + sent);
        var tg = textGlitch(sent);
        if (tg) u.semantic.push(tg + ': ' + sent);
      }

      // 4. ambiguity ("more than one correct answer") - review only
      if (Array.isArray(q.options) && q.options.length === 4) {
        var af = ambiguityFlag(q);
        if (af) u.ambig.push(af + ': ' + filled(q));
      }
    });
    grand.struct += u.struct.length; grand.giveaway += u.giveaway.length;
    grand.distractorHint += u.distractorHint.length; grand.semantic += u.semantic.length; grand.ambig += u.ambig.length;
    if (u.struct.length || u.giveaway.length || u.semantic.length) grand.badUnits++;
    report.push(u);
  });
});

// ---- print ------------------------------------------------------------------
function head(s) { return '\n' + s + '\n' + '-'.repeat(s.length); }
console.log(head('GRAMMAR SANITY - ' + levels.length + ' levels, ' + grand.units + ' units, ' + grand.q + ' questions'));
report.forEach(function (u) {
  var bad = u.struct.length + u.giveaway.length + u.semantic.length;
  var flag = bad ? 'FAIL' : 'ok  ';
  var extra = (u.distractorHint.length ? ' (+' + u.distractorHint.length + ' distractor-in-hint)' : '') +
    (u.ambig.length ? ' (+' + u.ambig.length + ' ambiguous?)' : '');
  console.log(flag + '  ' + (u.lvl + '/' + u.id).padEnd(34) + ' n=' + String(u.n).padStart(4) +
    '  struct=' + u.struct.length + ' giveaway=' + u.giveaway.length + ' semantic=' + u.semantic.length + extra);
  if (SHOW_SAMPLES) {
    u.struct.slice(0, 3).forEach(function (x) { console.log('        STRUCT   ' + x); });
    u.giveaway.slice(0, 4).forEach(function (x) { console.log('        GIVEAWAY ' + x); });
    u.semantic.slice(0, 6).forEach(function (x) { console.log('        SEMANTIC ' + x); });
    u.ambig.slice(0, 6).forEach(function (x) { console.log('        AMBIG?   ' + x); });
  }
});
console.log(head('TOTALS'));
console.log('questions          ' + grand.q);
console.log('units              ' + grand.units + ' (' + grand.badUnits + ' failing)');
console.log('structure issues   ' + grand.struct);
console.log('hint give-aways    ' + grand.giveaway);
console.log('semantic nonsense  ' + grand.semantic);
console.log('distractor-in-hint ' + grand.distractorHint + '  (review-only, not a hard fail)');
console.log('ambiguous?         ' + grand.ambig + '  (review-only heuristic: maybe >1 correct answer)');
var hardFail = grand.struct + grand.giveaway + grand.semantic;
console.log('\n' + (hardFail === 0 ? 'PASS - every unit is clean' : 'FAIL - ' + hardFail + ' hard issues across ' + grand.badUnits + ' units'));
process.exit(hardFail === 0 ? 0 : 1);
