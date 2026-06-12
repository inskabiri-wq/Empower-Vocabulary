/* Student Dashboard - Inflection Engine & Pattern Detection */

// ============================================
// INFLECTION ENGINE
// ============================================

/**
 * Generate all possible inflected forms of a word
 * Handles: -s, -es, -ed, -ing, -er, -est, -ly
 * Includes consonant doubling, y→i changes, silent-e drops
 */
function getWordForms(word, pos) {
  const forms = new Set([word, word.toLowerCase()]);
  
  // Don't inflect multi-word phrases here (handled separately)
  if (word.includes(' ')) return Array.from(forms);
  
  const lowerWord = word.toLowerCase();
  
  // Check for irregular verbs first
  const irregulars = getIrregularForms(lowerWord);
  if (irregulars) {
    irregulars.forEach(f => forms.add(f));
    return Array.from(forms);
  }
  
  // Regular inflection rules
  const lastChar = lowerWord.slice(-1);
  const lastTwo = lowerWord.slice(-2);
  const lastThree = lowerWord.slice(-3);
  
  // Check if word ends in consonant-vowel-consonant (CVC)
  const vowels = 'aeiou';
  const isCVC = lowerWord.length >= 3 &&
    !vowels.includes(lowerWord.slice(-1)) &&
    vowels.includes(lowerWord.slice(-2, -1)) &&
    !vowels.includes(lowerWord.slice(-3, -2));
  
  // Exception: don't double w, x, y
  const noDoubleEndings = ['w', 'x', 'y'];
  const shouldDouble = isCVC && !noDoubleEndings.includes(lastChar);
  
  // Words ending in 'e'
  if (lastChar === 'e') {
    forms.add(lowerWord + 's');           // hope → hopes
    forms.add(lowerWord + 'd');           // hope → hoped
    forms.add(lowerWord.slice(0, -1) + 'ing'); // hope → hoping
    forms.add(lowerWord + 'r');           // nice → nicer
    forms.add(lowerWord + 'st');          // nice → nicest
    forms.add(lowerWord + 'ly');          // nice → nicely
  }
  // Words ending in consonant + y
  else if (lastChar === 'y' && !vowels.includes(lowerWord.slice(-2, -1))) {
    forms.add(lowerWord.slice(0, -1) + 'ies');  // try → tries
    forms.add(lowerWord.slice(0, -1) + 'ied');  // try → tried
    forms.add(lowerWord + 'ing');               // try → trying (keep y)
    forms.add(lowerWord.slice(0, -1) + 'ier');  // happy → happier
    forms.add(lowerWord.slice(0, -1) + 'iest'); // happy → happiest
    forms.add(lowerWord.slice(0, -1) + 'ily');  // happy → happily
  }
  // Words ending in s, sh, ch, x, z (add -es)
  else if (['s', 'x', 'z'].includes(lastChar) || ['sh', 'ch'].includes(lastTwo)) {
    forms.add(lowerWord + 'es');          // watch → watches
    forms.add(lowerWord + 'ed');          // watch → watched
    forms.add(lowerWord + 'ing');         // watch → watching
  }
  // Words ending in 'ic' (add -ally for adverb)
  else if (lastTwo === 'ic') {
    forms.add(lowerWord + 's');
    forms.add(lowerWord + 'ally');        // basic → basically
  }
  // CVC pattern - double final consonant
  else if (shouldDouble) {
    forms.add(lowerWord + 's');
    forms.add(lowerWord + lastChar + 'ed');   // stop → stopped, admit → admitted
    forms.add(lowerWord + lastChar + 'ing');  // stop → stopping, admit → admitting
    forms.add(lowerWord + lastChar + 'er');   // big → bigger
    forms.add(lowerWord + lastChar + 'est');  // big → biggest
    // Also add non-doubled versions as fallback
    forms.add(lowerWord + 'ed');
    forms.add(lowerWord + 'ing');
  }
  // Default regular patterns
  else {
    forms.add(lowerWord + 's');
    forms.add(lowerWord + 'ed');
    forms.add(lowerWord + 'ing');
    forms.add(lowerWord + 'er');
    forms.add(lowerWord + 'est');
    forms.add(lowerWord + 'ly');
  }
  
  return Array.from(forms);
}

/**
 * Common irregular verb forms (module-level so it can be used for reverse lookup)
 */
const IRREGULAR_VERBS = {
    'be': ['be', 'am', 'is', 'are', 'was', 'were', 'being', 'been'],
    'have': ['have', 'has', 'had', 'having'],
    'do': ['do', 'does', 'did', 'doing', 'done'],
    'go': ['go', 'goes', 'went', 'going', 'gone'],
    'get': ['get', 'gets', 'got', 'getting', 'gotten'],
    'make': ['make', 'makes', 'made', 'making'],
    'take': ['take', 'takes', 'took', 'taking', 'taken'],
    'come': ['come', 'comes', 'came', 'coming'],
    'see': ['see', 'sees', 'saw', 'seeing', 'seen'],
    'know': ['know', 'knows', 'knew', 'knowing', 'known'],
    'think': ['think', 'thinks', 'thought', 'thinking'],
    'give': ['give', 'gives', 'gave', 'giving', 'given'],
    'find': ['find', 'finds', 'found', 'finding'],
    'tell': ['tell', 'tells', 'told', 'telling'],
    'say': ['say', 'says', 'said', 'saying'],
    'feel': ['feel', 'feels', 'felt', 'feeling'],
    'become': ['become', 'becomes', 'became', 'becoming'],
    'leave': ['leave', 'leaves', 'left', 'leaving'],
    'put': ['put', 'puts', 'putting'],
    'bring': ['bring', 'brings', 'brought', 'bringing'],
    'begin': ['begin', 'begins', 'began', 'beginning', 'begun'],
    'keep': ['keep', 'keeps', 'kept', 'keeping'],
    'hold': ['hold', 'holds', 'held', 'holding'],
    'write': ['write', 'writes', 'wrote', 'writing', 'written'],
    'stand': ['stand', 'stands', 'stood', 'standing'],
    'hear': ['hear', 'hears', 'heard', 'hearing'],
    'let': ['let', 'lets', 'letting'],
    'mean': ['mean', 'means', 'meant', 'meaning'],
    'set': ['set', 'sets', 'setting'],
    'meet': ['meet', 'meets', 'met', 'meeting'],
    'run': ['run', 'runs', 'ran', 'running'],
    'pay': ['pay', 'pays', 'paid', 'paying'],
    'sit': ['sit', 'sits', 'sat', 'sitting'],
    'speak': ['speak', 'speaks', 'spoke', 'speaking', 'spoken'],
    'lie': ['lie', 'lies', 'lay', 'lying', 'lain', 'lied'],
    'lead': ['lead', 'leads', 'led', 'leading'],
    'read': ['read', 'reads', 'reading'],
    'grow': ['grow', 'grows', 'grew', 'growing', 'grown'],
    'lose': ['lose', 'loses', 'lost', 'losing'],
    'fall': ['fall', 'falls', 'fell', 'falling', 'fallen'],
    'send': ['send', 'sends', 'sent', 'sending'],
    'build': ['build', 'builds', 'built', 'building'],
    'understand': ['understand', 'understands', 'understood', 'understanding'],
    'draw': ['draw', 'draws', 'drew', 'drawing', 'drawn'],
    'break': ['break', 'breaks', 'broke', 'breaking', 'broken'],
    'spend': ['spend', 'spends', 'spent', 'spending'],
    'cut': ['cut', 'cuts', 'cutting'],
    'catch': ['catch', 'catches', 'caught', 'catching'],
    'drive': ['drive', 'drives', 'drove', 'driving', 'driven'],
    'buy': ['buy', 'buys', 'bought', 'buying'],
    'wear': ['wear', 'wears', 'wore', 'wearing', 'worn'],
    'choose': ['choose', 'chooses', 'chose', 'choosing', 'chosen'],
    'seek': ['seek', 'seeks', 'sought', 'seeking'],
    'throw': ['throw', 'throws', 'threw', 'throwing', 'thrown'],
    'deal': ['deal', 'deals', 'dealt', 'dealing'],
    'win': ['win', 'wins', 'won', 'winning'],
    'teach': ['teach', 'teaches', 'taught', 'teaching'],
    'forget': ['forget', 'forgets', 'forgot', 'forgetting', 'forgotten'],
    'sell': ['sell', 'sells', 'sold', 'selling'],
    'hit': ['hit', 'hits', 'hitting'],
    'shut': ['shut', 'shuts', 'shutting'],
    'eat': ['eat', 'eats', 'ate', 'eating', 'eaten'],
    'drink': ['drink', 'drinks', 'drank', 'drinking', 'drunk'],
    'swim': ['swim', 'swims', 'swam', 'swimming', 'swum'],
    'sing': ['sing', 'sings', 'sang', 'singing', 'sung'],
    'ring': ['ring', 'rings', 'rang', 'ringing', 'rung'],
    'wake': ['wake', 'wakes', 'woke', 'waking', 'woken'],
    'fly': ['fly', 'flies', 'flew', 'flying', 'flown'],
    'sleep': ['sleep', 'sleeps', 'slept', 'sleeping'],
    'fight': ['fight', 'fights', 'fought', 'fighting'],
    'hide': ['hide', 'hides', 'hid', 'hiding', 'hidden'],
    'rise': ['rise', 'rises', 'rose', 'rising', 'risen'],
    'beat': ['beat', 'beats', 'beating', 'beaten'],
    'blow': ['blow', 'blows', 'blew', 'blowing', 'blown'],
    'shine': ['shine', 'shines', 'shone', 'shining'],
    'bite': ['bite', 'bites', 'bit', 'biting', 'bitten'],
    'hang': ['hang', 'hangs', 'hung', 'hanging'],
    'lend': ['lend', 'lends', 'lent', 'lending'],
    'bend': ['bend', 'bends', 'bent', 'bending'],
    'dig': ['dig', 'digs', 'dug', 'digging'],
    'stick': ['stick', 'sticks', 'stuck', 'sticking'],
    'shake': ['shake', 'shakes', 'shook', 'shaking', 'shaken'],
    'spread': ['spread', 'spreads', 'spreading'],
    'split': ['split', 'splits', 'splitting'],
    'quit': ['quit', 'quits', 'quitting'],
    'cost': ['cost', 'costs', 'costing'],
    'hurt': ['hurt', 'hurts', 'hurting']
};

function getIrregularForms(word) {
  return IRREGULAR_VERBS[word] || null;
}

/**
 * Parallel lookup keyed by grammatical slot name instead of array position.
 *
 * Why this exists: `IRREGULAR_VERBS` above stores forms as plain arrays, but
 * the arrays have inconsistent lengths — `['put', 'puts', 'putting']` has 3
 * slots while `['take', 'takes', 'took', 'taking', 'taken']` has 5. The
 * distractor-inflection logic used to do `correctIrr.indexOf(matched)` on
 * one verb, then `distractorIrr[sameIndex]` on another — producing garbage
 * when the two verbs had different slot layouts (e.g. past of "take" is
 * slot 2, but slot 2 of "put" is gerund → "putting" rendered as a past
 * tense).
 *
 * This keyed map resolves forms by their grammatical role, so cross-verb
 * lookups are always apples-to-apples. Missing roles default sensibly
 * (past == base for "put/cut/hit"-type verbs, ppt == past for "have/make"-
 * type verbs).
 *
 * IMPORTANT: this map is ADDITIVE. It does not replace IRREGULAR_VERBS and
 * none of the existing consumers (getWordForms, getBaseFromIngForm,
 * getIrregularForms) read from it. Only distractor inflection in games.js
 * uses it. Keep both in sync when adding new verbs.
 */
const IRREGULAR_FORMS_KEYED = {
    'be':         { base:'be',         third:'is',          past:'was',        gerund:'being',         ppt:'been' },
    'have':       { base:'have',       third:'has',         past:'had',        gerund:'having',        ppt:'had' },
    'do':         { base:'do',         third:'does',        past:'did',        gerund:'doing',         ppt:'done' },
    'go':         { base:'go',         third:'goes',        past:'went',       gerund:'going',         ppt:'gone' },
    'get':        { base:'get',        third:'gets',        past:'got',        gerund:'getting',       ppt:'gotten' },
    'make':       { base:'make',       third:'makes',       past:'made',       gerund:'making',        ppt:'made' },
    'take':       { base:'take',       third:'takes',       past:'took',       gerund:'taking',        ppt:'taken' },
    'come':       { base:'come',       third:'comes',       past:'came',       gerund:'coming',        ppt:'come' },
    'see':        { base:'see',        third:'sees',        past:'saw',        gerund:'seeing',        ppt:'seen' },
    'know':       { base:'know',       third:'knows',       past:'knew',       gerund:'knowing',       ppt:'known' },
    'think':      { base:'think',      third:'thinks',      past:'thought',    gerund:'thinking',      ppt:'thought' },
    'give':       { base:'give',       third:'gives',       past:'gave',       gerund:'giving',        ppt:'given' },
    'find':       { base:'find',       third:'finds',       past:'found',      gerund:'finding',       ppt:'found' },
    'tell':       { base:'tell',       third:'tells',       past:'told',       gerund:'telling',       ppt:'told' },
    'say':        { base:'say',        third:'says',        past:'said',       gerund:'saying',        ppt:'said' },
    'feel':       { base:'feel',       third:'feels',       past:'felt',       gerund:'feeling',       ppt:'felt' },
    'become':     { base:'become',     third:'becomes',     past:'became',     gerund:'becoming',      ppt:'become' },
    'leave':      { base:'leave',      third:'leaves',      past:'left',       gerund:'leaving',       ppt:'left' },
    'put':        { base:'put',        third:'puts',        past:'put',        gerund:'putting',       ppt:'put' },
    'bring':      { base:'bring',      third:'brings',      past:'brought',    gerund:'bringing',      ppt:'brought' },
    'begin':      { base:'begin',      third:'begins',      past:'began',      gerund:'beginning',     ppt:'begun' },
    'keep':       { base:'keep',       third:'keeps',       past:'kept',       gerund:'keeping',       ppt:'kept' },
    'hold':       { base:'hold',       third:'holds',       past:'held',       gerund:'holding',       ppt:'held' },
    'write':      { base:'write',      third:'writes',      past:'wrote',      gerund:'writing',       ppt:'written' },
    'stand':      { base:'stand',      third:'stands',      past:'stood',      gerund:'standing',      ppt:'stood' },
    'hear':       { base:'hear',       third:'hears',       past:'heard',      gerund:'hearing',       ppt:'heard' },
    'let':        { base:'let',        third:'lets',        past:'let',        gerund:'letting',       ppt:'let' },
    'mean':       { base:'mean',       third:'means',       past:'meant',      gerund:'meaning',       ppt:'meant' },
    'set':        { base:'set',        third:'sets',        past:'set',        gerund:'setting',       ppt:'set' },
    'meet':       { base:'meet',       third:'meets',       past:'met',        gerund:'meeting',       ppt:'met' },
    'run':        { base:'run',        third:'runs',        past:'ran',        gerund:'running',       ppt:'run' },
    'pay':        { base:'pay',        third:'pays',        past:'paid',       gerund:'paying',        ppt:'paid' },
    'sit':        { base:'sit',        third:'sits',        past:'sat',        gerund:'sitting',       ppt:'sat' },
    'speak':      { base:'speak',      third:'speaks',      past:'spoke',      gerund:'speaking',      ppt:'spoken' },
    'lie':        { base:'lie',        third:'lies',        past:'lay',        gerund:'lying',         ppt:'lain' },
    'lead':       { base:'lead',       third:'leads',       past:'led',        gerund:'leading',       ppt:'led' },
    'read':       { base:'read',       third:'reads',       past:'read',       gerund:'reading',       ppt:'read' },
    'grow':       { base:'grow',       third:'grows',       past:'grew',       gerund:'growing',       ppt:'grown' },
    'lose':       { base:'lose',       third:'loses',       past:'lost',       gerund:'losing',        ppt:'lost' },
    'fall':       { base:'fall',       third:'falls',       past:'fell',       gerund:'falling',       ppt:'fallen' },
    'send':       { base:'send',       third:'sends',       past:'sent',       gerund:'sending',       ppt:'sent' },
    'build':      { base:'build',      third:'builds',      past:'built',      gerund:'building',      ppt:'built' },
    'understand': { base:'understand', third:'understands', past:'understood', gerund:'understanding', ppt:'understood' },
    'draw':       { base:'draw',       third:'draws',       past:'drew',       gerund:'drawing',       ppt:'drawn' },
    'break':      { base:'break',      third:'breaks',      past:'broke',      gerund:'breaking',      ppt:'broken' },
    'spend':      { base:'spend',      third:'spends',      past:'spent',      gerund:'spending',      ppt:'spent' },
    'cut':        { base:'cut',        third:'cuts',        past:'cut',        gerund:'cutting',       ppt:'cut' },
    'catch':      { base:'catch',      third:'catches',     past:'caught',     gerund:'catching',      ppt:'caught' },
    'drive':      { base:'drive',      third:'drives',      past:'drove',      gerund:'driving',       ppt:'driven' },
    'buy':        { base:'buy',        third:'buys',        past:'bought',     gerund:'buying',        ppt:'bought' },
    'wear':       { base:'wear',       third:'wears',       past:'wore',       gerund:'wearing',       ppt:'worn' },
    'choose':     { base:'choose',     third:'chooses',     past:'chose',      gerund:'choosing',      ppt:'chosen' },
    'seek':       { base:'seek',       third:'seeks',       past:'sought',     gerund:'seeking',       ppt:'sought' },
    'throw':      { base:'throw',      third:'throws',      past:'threw',      gerund:'throwing',      ppt:'thrown' },
    'deal':       { base:'deal',       third:'deals',       past:'dealt',      gerund:'dealing',       ppt:'dealt' },
    'win':        { base:'win',        third:'wins',        past:'won',        gerund:'winning',       ppt:'won' },
    'teach':      { base:'teach',      third:'teaches',     past:'taught',     gerund:'teaching',      ppt:'taught' },
    'forget':     { base:'forget',     third:'forgets',     past:'forgot',     gerund:'forgetting',    ppt:'forgotten' },
    'sell':       { base:'sell',       third:'sells',       past:'sold',       gerund:'selling',       ppt:'sold' },
    'hit':        { base:'hit',        third:'hits',        past:'hit',        gerund:'hitting',       ppt:'hit' },
    'shut':       { base:'shut',       third:'shuts',       past:'shut',       gerund:'shutting',      ppt:'shut' },
    'eat':        { base:'eat',        third:'eats',        past:'ate',        gerund:'eating',        ppt:'eaten' },
    'drink':      { base:'drink',      third:'drinks',      past:'drank',      gerund:'drinking',      ppt:'drunk' },
    'swim':       { base:'swim',       third:'swims',       past:'swam',       gerund:'swimming',      ppt:'swum' },
    'sing':       { base:'sing',       third:'sings',       past:'sang',       gerund:'singing',       ppt:'sung' },
    'ring':       { base:'ring',       third:'rings',       past:'rang',       gerund:'ringing',       ppt:'rung' },
    'wake':       { base:'wake',       third:'wakes',       past:'woke',       gerund:'waking',        ppt:'woken' },
    'fly':        { base:'fly',        third:'flies',       past:'flew',       gerund:'flying',        ppt:'flown' },
    'sleep':      { base:'sleep',      third:'sleeps',      past:'slept',      gerund:'sleeping',      ppt:'slept' },
    'fight':      { base:'fight',      third:'fights',      past:'fought',     gerund:'fighting',      ppt:'fought' },
    'hide':       { base:'hide',       third:'hides',       past:'hid',        gerund:'hiding',        ppt:'hidden' },
    'rise':       { base:'rise',       third:'rises',       past:'rose',       gerund:'rising',        ppt:'risen' },
    'beat':       { base:'beat',       third:'beats',       past:'beat',       gerund:'beating',       ppt:'beaten' },
    'blow':       { base:'blow',       third:'blows',       past:'blew',       gerund:'blowing',       ppt:'blown' },
    'shine':      { base:'shine',      third:'shines',      past:'shone',      gerund:'shining',       ppt:'shone' },
    'bite':       { base:'bite',       third:'bites',       past:'bit',        gerund:'biting',        ppt:'bitten' },
    'hang':       { base:'hang',       third:'hangs',       past:'hung',       gerund:'hanging',       ppt:'hung' },
    'lend':       { base:'lend',       third:'lends',       past:'lent',       gerund:'lending',       ppt:'lent' },
    'bend':       { base:'bend',       third:'bends',       past:'bent',       gerund:'bending',       ppt:'bent' },
    'dig':        { base:'dig',        third:'digs',        past:'dug',        gerund:'digging',       ppt:'dug' },
    'stick':      { base:'stick',      third:'sticks',      past:'stuck',      gerund:'sticking',      ppt:'stuck' },
    'shake':      { base:'shake',      third:'shakes',      past:'shook',      gerund:'shaking',       ppt:'shaken' },
    'spread':     { base:'spread',     third:'spreads',     past:'spread',     gerund:'spreading',     ppt:'spread' },
    'split':      { base:'split',      third:'splits',      past:'split',      gerund:'splitting',     ppt:'split' },
    'quit':       { base:'quit',       third:'quits',       past:'quit',       gerund:'quitting',      ppt:'quit' },
    'cost':       { base:'cost',       third:'costs',       past:'cost',       gerund:'costing',       ppt:'cost' },
    'hurt':       { base:'hurt',       third:'hurts',       past:'hurt',       gerund:'hurting',       ppt:'hurt' }
};

/**
 * Given an irregular verb's base form and a specific surface form, return
 * which grammatical slot the surface form occupies. Returns null if the
 * verb isn't irregular or the form doesn't match any slot.
 *
 * e.g. classifyIrregularSlot('take', 'took') → 'past'
 *      classifyIrregularSlot('put',  'putting') → 'gerund'
 */
function classifyIrregularSlot(baseVerb, surfaceForm) {
  const keyed = IRREGULAR_FORMS_KEYED[String(baseVerb).toLowerCase()];
  if (!keyed) return null;
  const target = String(surfaceForm).toLowerCase();
  for (const slot of ['base', 'third', 'past', 'ppt', 'gerund']) {
    if (keyed[slot] === target) return slot;
  }
  return null;
}

/**
 * Given an irregular verb's base form and a desired slot name, return the
 * surface form. Falls back gracefully when the slot doesn't exist: past
 * defaults to base (put/cut/hit-type), ppt defaults to past (have/make-
 * type), third always falls back to base+s, gerund is expected to exist.
 *
 * Returns null if the verb isn't in the keyed map.
 */
function getIrregularSlot(baseVerb, slot) {
  const keyed = IRREGULAR_FORMS_KEYED[String(baseVerb).toLowerCase()];
  if (!keyed) return null;
  if (keyed[slot]) return keyed[slot];
  // Fallbacks — match English morphology defaults.
  if (slot === 'ppt')   return keyed.past || keyed.base;
  if (slot === 'past')  return keyed.base;
  if (slot === 'third') return keyed.base + 's';
  return keyed.base || null;
}

/**
 * Given a word in -ing form, return the base (infinitive) form.
 * e.g. "getting" → "get", "being" → "be", "camping" → "camp"
 * Returns the original word unchanged if it's not in -ing form.
 */
function getBaseFromIngForm(word) {
  const lower = word.toLowerCase();
  if (!lower.endsWith('ing')) return lower;

  // Reverse-lookup irregular verbs
  for (const [base, forms] of Object.entries(IRREGULAR_VERBS)) {
    if (forms.includes(lower)) return base;
  }

  // Regular de-inflection: strip "-ing"
  const stem = lower.slice(0, -3);
  if (stem.length === 0) return lower;

  // Doubled-consonant pattern: "running" → "runn" → "run"
  if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
    return stem.slice(0, -1);
  }

  // Silent-e pattern: "promising" → "promis" → try "promise"
  // Words like promise→promising, hope→hoping, make→making drop the 'e' before adding '-ing'.
  // Skip when silent-e would produce a non-word:
  //   - 'y' stems (3+ chars): "bullying"→"bully" not "bullye", "carrying"→"carry" not "carrye"
  //   - 'o' stems: "outgoing"→"outgo" not "outgoe", "easygoing"→"easygo" not "easygoe"
  //     (English doesn't form -oe verbs that drop the e before -ing)
  const stemLast = stem.slice(-1);
  const skipSilentE =
    (stemLast === 'y' && stem.length >= 3) ||
    stemLast === 'o';
  if (!skipSilentE) {
    const withE = stem + 'e';
    const eForms = getWordForms(withE);
    if (eForms.includes(lower)) return withE;
  }

  // Default: return stem (e.g. "camping" → "camp", "cooking" → "cook")
  return stem;
}

// ============================================
// SMART PATTERN DETECTION
// ============================================

/**
 * Build a regex pattern to find word in sentence
 * Handles: inflections, phrasal verbs, collocations
 */
function buildWordPattern(wordData) {
  const word = wordData.word;
  const sentence = wordData.ex;
  
  // If exAnswer is provided, use it directly (manual override)
  if (wordData.exAnswer) {
    return escapeRegex(wordData.exAnswer);
  }
  
  // Check if it's a separable phrasal verb
  if (wordData.separable && wordData.particle) {
    return buildSeparablePhrasalPattern(word, wordData.particle);
  }
  
  // Check if it's a phrasal verb (verb + particle)
  if (word.includes(' ')) {
    return buildPhrasalPattern(word, sentence);
  }
  
  // Single word - use inflection engine
  return buildInflectedPattern(word);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build pattern for separable phrasal verbs
 * e.g., "turn on" can be "turn on", "turn the TV on", "turned it on"
 */
function buildSeparablePhrasalPattern(word, particle) {
  const parts = word.split(' ');
  const verb = parts[0];
  const verbForms = getWordForms(verb).map(escapeRegex).join('|');
  const escapedParticle = escapeRegex(particle);
  
  // Match: "turn on" OR "turn [anything] on" (max 5 words in between)
  return `(?:(?:${verbForms})\\s+${escapedParticle}|(?:${verbForms})\\s+(?:\\S+\\s+){0,5}${escapedParticle})`;
}

/**
 * Build pattern for phrasal verbs and collocations
 * e.g., "do my homework" → matches "do/does/did/doing" + "my/your/his/her/their" + "homework"
 * e.g., "make a difference" → matches "make/makes/made a big difference" (adjectives in between)
 */
function buildPhrasalPattern(phrase, sentence) {
  const words = phrase.split(' ');
  
  // Check if it's a verb + possessive + noun pattern (collocation)
  const possessives = ['my', 'your', 'his', 'her', 'its', 'our', 'their', "one's"];
  const hasPossessive = words.some(w => possessives.includes(w.toLowerCase()));
  
  if (hasPossessive) {
    return buildCollocationPattern(words, sentence);
  }
  
  // Regular phrasal verb / collocation - inflect the first word
  // Allow optional adjectives between article (a/an/the) and noun
  const firstWord = words[0];
  const firstForms = getWordForms(firstWord).map(escapeRegex).join('|');

  const buildParts = (w, i) => {
    if (i === 0) return `(?:${firstForms})`;
    if (['a', 'an', 'the'].includes(w.toLowerCase())) {
      return `${escapeRegex(w)}(?:\\s+\\w+)?`;  // article + optional adjective
    }
    return escapeRegex(w);
  };

  // Build strict pattern (words adjacent)
  const strictPattern = words.map(buildParts).join('\\s+');

  // If the strict pattern matches the sentence, use it
  if (!sentence || new RegExp(strictPattern, 'gi').test(sentence)) {
    return strictPattern;
  }

  // Strict pattern failed: the phrase appears with words inserted between its parts
  // (e.g. "put into words" → "put my feelings into words")
  // Allow up to 5 intervening words between each part of the phrase
  return words.map(buildParts).join('(?:\\s+\\S+){0,5}\\s+');
}

/**
 * Build pattern for collocations with possessives
 * e.g., "do my homework" → "do/does/did my/your/his homework"
 */
function buildCollocationPattern(words, sentence) {
  const possessives = ['my', 'your', 'his', 'her', 'its', 'our', 'their', "one's"];
  const possessivePattern = possessives.join('|');
  
  const patternParts = words.map((w, i) => {
    if (possessives.includes(w.toLowerCase()) || w === "one's") {
      // Allow optional adjective after possessive
      return `(?:${possessivePattern})(?:\\s+\\w+)?`;
    }
    if (i === 0) {
      // First word is likely the verb - inflect it
      return `(?:${getWordForms(w).map(escapeRegex).join('|')})`;
    }
    return escapeRegex(w);
  });
  
  return patternParts.join('\\s+');
}

/**
 * Build pattern for single words using inflection
 */
function buildInflectedPattern(word) {
  const forms = getWordForms(word);
  const sortedForms = forms.sort((a, b) => b.length - a.length); // Longest first
  return `\\b(?:${sortedForms.map(escapeRegex).join('|')})\\b`;
}

/**
 * Find the actual word form used in the sentence
 */
function findWordInSentence(wordData) {
  const pattern = buildWordPattern(wordData);
  const regex = new RegExp(pattern, 'gi');
  const match = regex.exec(wordData.ex);
  
  if (match) {
    return match[0];
  }
  
  // Fallback: return base word
  return wordData.word;
}
