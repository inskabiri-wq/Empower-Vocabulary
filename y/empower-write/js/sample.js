/* ============================================================
   EMPOWER WRITE - seeded sample
   A realistic B1 student essay + three worked corrections
   (light / medium / deep), authored as if returned by the API.
   No scores. Estimates (CEFR / IELTS / TOEFL / rubric) are
   SUGGESTIONS only. Quotes are exact substrings of the essay
   (the app locates them; offsets are computed at render time).
   ============================================================ */
(function () {
  'use strict';

  const TASK = "Some universities require their students to wear a uniform. Do you agree that university students should wear uniforms? Write an essay (about 200 words) giving your opinion with reasons.";

  const ESSAY =
"In todays world, many universities is discussing about if students must wear a uniform or not. In my opinion i think uniforms is not a good idea for university students.\n\n" +
"First of all, university students are adult. They are not childs like in primary school. So they should have the right to choose what they wear. Wearing uniform make them feel like they are still in high school and this is a bad thing for their motivation.\n\n" +
"Secondly, uniforms are very expensive. Many student don't have enough money and buying a uniform is a big problem for they budget. The money can be use for books and other important stuff.\n\n" +
"In other hand, some people say that uniforms make everybody equal and there is no difference between rich and poor. This is a good point but i think students can learn to respect each other without wearing the same clothes.\n\n" +
"To conclude, i believe that university is a place for freedom and uniforms is not necessary. Students must be free to express theirself.";

  // Shared estimates (suggestions only) + language profiles.
  const CEFR = "A2 to B1";
  const ESTIMATES = { ielts: "5.0", toefl: "46-59", rubric: "12-14 / 20" };
  const VOCAB = {
    cefr: "A2",
    distribution: [
      { band: "A1", count: 64 }, { band: "A2", count: 17 },
      { band: "B1", count: 6 }, { band: "B2", count: 1 }, { band: "C1", count: 0 }
    ],
    note: "Mostly very common A1 to A2 words. Few topic-specific words, and some repetition (good, bad, thing, stuff)."
  };
  const GRAMMAR = {
    cefr: "A2",
    features: [
      { feature: "Present simple", count: 8, cefr: "A1", examples: ["students are", "they wear", "uniforms are very expensive"] },
      { feature: "Modal verbs (must, should, can)", count: 4, cefr: "A2", examples: ["must wear", "should have", "can learn", "must be free"] },
      { feature: "Quantifiers (many)", count: 2, cefr: "A2", examples: ["many universities", "many student"] },
      { feature: "Linkers (and, but, so)", count: 5, cefr: "A1", examples: ["First of all", "Secondly", "but", "So", "To conclude"] },
      { feature: "Passive voice (attempted)", count: 1, cefr: "B1", examples: ["can be use for books"] },
      { feature: "Gerund as subject", count: 1, cefr: "B1", examples: ["Wearing uniform make..."] }
    ],
    note: "Control is solid at A1 to A2. The B1 attempts (passive, gerund subject) are not yet accurate."
  };

  // ── LIGHT - triage ──────────────────────────────────────
  const LIGHT = {
    level: 'light', rubric: 'essay',
    cefr: CEFR, estimates: ESTIMATES,
    overall: "Clear opinion and an easy-to-follow structure, well done. Before anything else, fix a handful of subject-verb agreement slips and irregular plurals: those are the errors a reader notices first. Everything else can wait for the next pass.",
    criteria: {
      CC: { verdict: 'Clear', note: 'Intro, two reasons, a counter-point and a conclusion are all present.' },
      TA: { verdict: 'On task', note: 'You answer the question and take a clear side.' },
      GR: { verdict: 'Needs attention', note: 'Repeated subject-verb agreement and plural errors (4 marked below).' },
      VO: { verdict: 'Okay', note: 'Understandable; a few words repeat.' }
    },
    annotations: [
      { criterion: 'GR', severity: 'fix', quote: 'many universities is discussing about', text: 'Subject-verb agreement: a plural subject takes "are".', suggestion: 'many universities are discussing' },
      { criterion: 'CC', severity: 'strength', quote: 'First of all', text: 'Good signposting; these linking phrases guide the reader through your reasons.' },
      { criterion: 'GR', severity: 'fix', quote: 'They are not childs', text: 'Irregular plural.', suggestion: 'They are not children' },
      { criterion: 'GR', severity: 'fix', quote: 'uniforms is not necessary', text: 'Subject-verb agreement.', suggestion: 'uniforms are not necessary' },
      { criterion: 'GR', severity: 'fix', quote: 'express theirself', text: 'Reflexive pronoun (plural).', suggestion: 'express themselves' }
    ]
  };

  // ── MEDIUM - full correction pass + plan ────────────────
  const MEDIUM = {
    level: 'medium', rubric: 'essay',
    cefr: CEFR, estimates: ESTIMATES, vocabProfile: VOCAB, grammarProfile: GRAMMAR,
    overall: "A solid B1 essay with a clear position and good signposting. The ideas are relevant but a little thin: each reason would be stronger with one concrete example. The main work is accuracy: subject-verb agreement, plurals and a couple of fixed phrases. Fix the marks below and sharpen the vocabulary, and this becomes a confident piece.",
    overallSimple: "Good essay. Your idea is clear and easy to read. The big problem is small grammar: the verb must match the subject (universities ARE, students ARE, uniforms ARE). Also give one example for each reason, and use better words than 'good', 'bad', and 'thing'. Fix these and it will be much stronger.",
    criteria: {
      CC: { verdict: 'Good', note: 'Clear intro, body and conclusion with useful linkers (First of all, Secondly, To conclude). Note "In other hand" should be "On the other hand".', noteSimple: "Good plan: a start, middle and end, with linking words. Change 'In other hand' to 'On the other hand'." },
      TA: { verdict: 'Satisfactory', note: 'You answer the task and take a side, but the reasons are stated more than developed. Add an example to each.', noteSimple: 'You answer the question. Now add one example for each reason.' },
      GR: { verdict: 'Needs improvement', note: 'Frequent subject-verb agreement and plural errors, plus one passive form. Meaning still comes through.', noteSimple: "Watch the verb with the subject, and the plural 's'. The meaning is still clear." },
      VO: { verdict: 'Satisfactory', note: 'Understandable but repetitive (good, bad, thing). Reach for more precise words.', noteSimple: "Clear words, but some repeat. Use stronger words than 'good' and 'bad'." }
    },
    annotations: [
      { criterion: 'GR', severity: 'fix', quote: 'many universities is discussing about', text: 'Subject-verb agreement, and "discuss" takes no preposition.', suggestion: 'many universities are discussing', simple: "Use 'are' for more than one, and drop 'about'.", simpleSuggestion: 'many universities are discussing' },
      { criterion: 'CC', severity: 'tip', quote: 'In my opinion i think', text: '"In my opinion" and "I think" say the same thing; keep one. Also capitalise "I".', suggestion: 'In my opinion,', simple: "Say it once. And write 'I' with a big letter.", simpleSuggestion: 'In my opinion,' },
      { criterion: 'GR', severity: 'fix', quote: 'uniforms is not a good idea', text: 'Subject-verb agreement.', suggestion: 'uniforms are not a good idea', simple: "Use 'are' for more than one.", simpleSuggestion: 'uniforms are not a good idea' },
      { criterion: 'CC', severity: 'strength', quote: 'First of all', text: 'Good signposting; it tells the reader a reason is coming.', simple: 'Nice. This phrase helps the reader follow you.' },
      { criterion: 'GR', severity: 'fix', quote: 'university students are adult', text: 'Number agreement: a plural subject needs a plural noun.', suggestion: 'university students are adults', simple: "More than one = 'adults'.", simpleSuggestion: 'university students are adults' },
      { criterion: 'GR', severity: 'fix', quote: 'They are not childs', text: 'Irregular plural.', suggestion: 'They are not children', simple: "The word is 'children', not 'childs'.", simpleSuggestion: 'They are not children' },
      { criterion: 'GR', severity: 'fix', quote: 'Wearing uniform make them feel', text: 'Missing article, and a gerund subject is singular, so "makes".', suggestion: 'Wearing a uniform makes them feel', simple: "Add 'a'. And use 'makes'.", simpleSuggestion: 'Wearing a uniform makes them feel' },
      { criterion: 'VO', severity: 'tip', quote: 'a bad thing', text: '"bad thing" is vague; name the effect.', suggestion: 'demotivating / harmful to their motivation', simple: 'Say what is bad.', simpleSuggestion: 'it lowers their motivation' },
      { criterion: 'GR', severity: 'fix', quote: "Many student don't have", text: 'Plural noun after "many".', suggestion: "Many students don't have", simple: "After 'many', add 's': students.", simpleSuggestion: "Many students don't have" },
      { criterion: 'GR', severity: 'fix', quote: 'for they budget', text: 'Use the possessive pronoun.', suggestion: 'for their budget', simple: "Use 'their', not 'they'.", simpleSuggestion: 'for their budget' },
      { criterion: 'GR', severity: 'fix', quote: 'The money can be use for', text: 'Passive voice needs the past participle.', suggestion: 'The money can be used for', simple: "Use 'used', not 'use'.", simpleSuggestion: 'The money can be used for' },
      { criterion: 'VO', severity: 'fix', quote: 'In other hand', text: 'Fixed phrase.', suggestion: 'On the other hand', simple: "The phrase is 'On the other hand'.", simpleSuggestion: 'On the other hand' },
      { criterion: 'VO', severity: 'tip', quote: 'a good point', text: '"good point" is weak; name it.', suggestion: 'a fair / valid argument', simple: "Use a stronger word than 'good'.", simpleSuggestion: 'a fair point' },
      { criterion: 'GR', severity: 'fix', quote: 'express theirself', text: 'Reflexive pronoun (plural).', suggestion: 'express themselves', simple: "The word is 'themselves'.", simpleSuggestion: 'express themselves' }
    ],
    plan: [
      'Re-read each sentence and check the subject agrees with the verb (universities are, students are, uniforms are).',
      'Add one concrete example to each reason: a real cost, a motivation effect.',
      'Replace vague words (good, bad, thing) with precise ones.',
      'Learn the fixed phrase "On the other hand".'
    ],
    planSimple: [
      "Check the verb matches the subject: use 'are' for more than one.",
      'Give one example for each reason.',
      "Use better words than 'good', 'bad', 'thing'.",
      "Learn the phrase 'On the other hand'."
    ]
  };

  // ── DEEP - minute, top-to-bottom + rewrites ─────────────
  const DEEP = {
    level: 'deep', rubric: 'essay',
    cefr: CEFR, estimates: ESTIMATES, vocabProfile: VOCAB, grammarProfile: GRAMMAR,
    overall: "This is a well-organised B1 response that takes a clear stance and even acknowledges the opposing view, a real strength at this level. To move up, the priorities are, in order: first, grammatical accuracy, where subject-verb agreement and plural and possessive forms slip repeatedly; second, development, since each reason is asserted rather than proven; and third, lexical precision, replacing all-purpose words (good, bad, thing, stuff) with topic-specific vocabulary. Work through the inline marks, study the model rewrites, then redraft using the plan.",
    criteria: {
      CC: { verdict: 'Good', note: 'A genuine intro, body and conclusion shape with consistent signposting (First of all, Secondly, To conclude) and a counter-argument paragraph. Two things hold it back: the thesis doubles up ("In my opinion I think"), and one linker is wrong ("In other hand").' },
      TA: { verdict: 'Satisfactory', note: 'The task is fully addressed and the position never wavers. However, every reason stops at assertion: cost, motivation and equality are named but not evidenced. One concrete example per paragraph would lift this from "tells me" to "shows me".' },
      GR: { verdict: 'Needs improvement', note: 'The recurring pattern is agreement: plural subjects with singular verbs (universities is, uniforms is), a singular noun for a plural subject (students are adult), a gerund subject taking a plural verb (Wearing ... make), a possessive error (they budget), and a passive without the participle (can be use). None block meaning, but together they read as carelessness.' },
      VO: { verdict: 'Satisfactory', note: 'Range is adequate for the topic but leans on empty words: good, bad, thing, stuff, important. Each is a chance to be specific (a sensible policy, demotivating, financial burden, learning materials). Register dips with "stuff", which is too informal for an essay.' }
    },
    annotations: [
      { criterion: 'GR', severity: 'tip', quote: 'In todays world', text: 'Missing apostrophe ("today’s"), and the phrase is a cliche.', suggestion: 'These days, / Today,' },
      { criterion: 'GR', severity: 'fix', quote: 'many universities is discussing about', text: 'Subject-verb agreement, and "discuss" is transitive, so no "about".', suggestion: 'many universities are discussing' },
      { criterion: 'CC', severity: 'tip', quote: 'In my opinion i think', text: 'Redundant doubling of the opinion phrase, and "I" must be capitalised.', suggestion: 'In my opinion,' },
      { criterion: 'GR', severity: 'fix', quote: 'uniforms is not a good idea', text: 'Subject-verb agreement (plural subject).', suggestion: 'uniforms are not a sensible idea' },
      { criterion: 'CC', severity: 'strength', quote: 'First of all', text: 'Clear signpost opening the first reason; keep this habit.' },
      { criterion: 'TA', severity: 'tip', quote: 'university students are adult', text: 'Good reason; now develop it. Why does being an adult earn the right to choose?', suggestion: 'university students are adults, so they can be trusted to...' },
      { criterion: 'GR', severity: 'fix', quote: 'They are not childs', text: 'Irregular plural.', suggestion: 'They are not children' },
      { criterion: 'GR', severity: 'fix', quote: 'Wearing uniform make them feel', text: 'Missing article; a gerund subject is singular, so "makes".', suggestion: 'Wearing a uniform makes them feel' },
      { criterion: 'VO', severity: 'tip', quote: 'a bad thing', text: 'Vague; state the effect precisely.', suggestion: 'demotivating' },
      { criterion: 'GR', severity: 'fix', quote: "Many student don't have", text: 'Plural noun after "many".', suggestion: "Many students don't have" },
      { criterion: 'GR', severity: 'fix', quote: 'for they budget', text: 'Use the possessive pronoun.', suggestion: 'for their budget' },
      { criterion: 'GR', severity: 'fix', quote: 'The money can be use for', text: 'Passive voice needs the past participle.', suggestion: 'The money could be used for' },
      { criterion: 'VO', severity: 'tip', quote: 'important stuff', text: '"stuff" is too informal for an essay.', suggestion: 'learning materials / essentials' },
      { criterion: 'VO', severity: 'fix', quote: 'In other hand', text: 'Fixed contrast phrase.', suggestion: 'On the other hand' },
      { criterion: 'VO', severity: 'tip', quote: 'a good point', text: 'Name the concession instead of labelling it "good".', suggestion: 'a fair argument' },
      { criterion: 'GR', severity: 'fix', quote: 'uniforms is not necessary', text: 'Subject-verb agreement.', suggestion: 'uniforms are not necessary' },
      { criterion: 'GR', severity: 'fix', quote: 'express theirself', text: 'Reflexive pronoun (plural).', suggestion: 'express themselves' }
    ],
    rewrites: [
      { before: 'In todays world, many universities is discussing about if students must wear a uniform or not.',
        after:  'These days, many universities are debating whether their students should wear a uniform.',
        why: 'Fixes the missing apostrophe and the subject-verb agreement, drops the wordy "about if ... or not", and upgrades "discussing" to the more precise "debating whether".' },
      { before: 'Wearing uniform make them feel like they are still in high school and this is a bad thing for their motivation.',
        after:  'Wearing a uniform can make adults feel like high-school students again, which lowers their motivation.',
        why: 'Adds the missing article, corrects the verb, and replaces "a bad thing" with a clear cause and effect.' },
      { before: 'In other hand, some people say that uniforms make everybody equal and there is no difference between rich and poor.',
        after:  'On the other hand, some people argue that uniforms put everyone on an equal footing, erasing the visible gap between rich and poor.',
        why: 'Corrects the fixed phrase and lifts "say" and "make everybody equal" into more academic language.' }
    ],
    plan: [
      'Proof-read once for one thing only: does each subject agree with its verb? (universities are, students are, uniforms are).',
      'Add a concrete example or consequence to every reason: cost figures, a motivation effect, an equality scenario.',
      'Swap every all-purpose word (good, bad, thing, stuff) for a specific one.',
      'Fix the two cohesion issues: trim "In my opinion I think", correct "On the other hand".',
      'Redraft, then read the essay aloud; your ear will catch the remaining slips.'
    ]
  };

  const S1 = {
    id: 'uniforms', label: 'Uniforms (B1 · essay)',
    task: TASK, essay: ESSAY, rubric: 'essay',
    // Text-Inspector-style profiles (essay-level; shared across depths).
    lemmas: [
      { lemma: 'a', pos: 'det', cefr: 'A1', count: 7 },
      { lemma: 'be', pos: 'aux', cefr: 'A1', count: 7 },
      { lemma: 'be', pos: 'verb', cefr: 'A1', count: 7 },
      { lemma: 'uniform', pos: 'noun', cefr: 'A2', count: 7, sentences: ['students must wear a uniform or not', 'Wearing uniform make them feel...', 'uniforms is not necessary'] },
      { lemma: 'and', pos: 'conj', cefr: 'A1', count: 6 },
      { lemma: 'student', pos: 'noun', cefr: 'A1', count: 6, sentences: ['for university students', 'university students are adult', "Many student don't have enough money"] },
      { lemma: 'in', pos: 'prep', cefr: 'A1', count: 5 },
      { lemma: 'not', pos: 'adv', cefr: 'A1', count: 5 },
      { lemma: 'they', pos: 'pron', cefr: 'A1', count: 5 },
      { lemma: 'for', pos: 'prep', cefr: 'A1', count: 4 },
      { lemma: 'university', pos: 'noun', cefr: 'A1', count: 4, sentences: ['for university students', 'university is a place for freedom'] },
      { lemma: 'wear', pos: 'verb', cefr: 'A1', count: 3, sentences: ['students must wear a uniform', 'choose what they wear'] },
      { lemma: 'this', pos: 'det', cefr: 'A1', count: 3 },
      { lemma: 'have', pos: 'verb', cefr: 'A1', count: 3 },
      { lemma: 'think', pos: 'verb', cefr: 'A1', count: 2, sentences: ['In my opinion i think', 'i think students can learn'] },
      { lemma: 'good', pos: 'adj', cefr: 'A1', count: 2, sentences: ['not a good idea', 'This is a good point'] },
      { lemma: 'idea', pos: 'noun', cefr: 'A1', count: 2 },
      { lemma: 'money', pos: 'noun', cefr: 'A1', count: 2, sentences: ['enough money', 'The money can be use for books'] },
      { lemma: 'expensive', pos: 'adj', cefr: 'A2', count: 1, sentences: ['uniforms are very expensive'] },
      { lemma: 'right', pos: 'noun', cefr: 'A2', count: 1, sentences: ['the right to choose'] },
      { lemma: 'respect', pos: 'verb', cefr: 'A2', count: 1, sentences: ['respect each other'] },
      { lemma: 'equal', pos: 'adj', cefr: 'A2', count: 1, sentences: ['make everybody equal'] },
      { lemma: 'budget', pos: 'noun', cefr: 'B1', count: 1, sentences: ['a big problem for they budget'] },
      { lemma: 'freedom', pos: 'noun', cefr: 'B1', count: 1, sentences: ['university is a place for freedom'] },
      { lemma: 'express', pos: 'verb', cefr: 'B1', count: 1, sentences: ['free to express theirself'] },
      { lemma: 'motivation', pos: 'noun', cefr: 'B2', count: 1, sentences: ['a bad thing for their motivation'] }
    ],
    verbForms: [
      { form: 'present simple', with: 'do', cefr: 'A1.0', count: 7 },
      { form: 'present simple', with: 'is', cefr: 'A1.0', count: 6 },
      { form: 'infinitive', with: 'to do', cefr: 'A1.0', count: 4 },
      { form: 'present simple', with: 'are', cefr: 'A1.0', count: 4 },
      { form: 'gerund simple', with: 'doing', cefr: 'A2.0', count: 2, sentences: ['Wearing uniform make them feel', 'buying a uniform is a big problem'] },
      { form: 'infinitive', with: 'can do', cefr: 'A1.5', count: 2, sentences: ['students can learn to respect', 'The money can be use for books'] },
      { form: 'infinitive', with: 'must do', cefr: 'A1.5', count: 2, sentences: ['students must wear a uniform', 'Students must be free'] },
      { form: 'infinitive', with: 'should do', cefr: 'A1.5', count: 1, sentences: ['they should have the right'] },
      { form: 'infinitive', with: 'do', cefr: 'A1.0', count: 1 },
      { form: 'present continuous', with: 'is doing', cefr: 'A1.5', count: 1, sentences: ['many universities is discussing about'] }
    ],
    clauses: [
      { clause: 'noun clause', with: '(that)', cefr: 'B1', count: 4, sentences: ['i think uniforms is not a good idea', 'i think students can learn to respect', 'say that uniforms make everybody equal', 'i believe that university is a place'] },
      { clause: 'noun clause', with: 'that', cefr: 'B1', count: 2, sentences: ['some people say that uniforms make everybody equal', 'i believe that university is a place for freedom'] },
      { clause: 'adverbial clause', with: 'like', cefr: 'B1', count: 1, sentences: ['feel like they are still in high school'] },
      { clause: 'compound sentence', with: 'and', cefr: 'A1', count: 1, sentences: ["don't have enough money and buying a uniform is a big problem"] },
      { clause: 'compound sentence', with: 'but', cefr: 'A1', count: 1, sentences: ['This is a good point but i think students can learn'] },
      { clause: 'noun clause', with: 'what', cefr: 'B2', count: 1, sentences: ['choose what they wear'] }
    ],
    corrections: { light: LIGHT, medium: MEDIUM, deep: DEEP }
  };

  // ============================================================
  // SAMPLE 2 · Social media (B2 · essay). Subtler errors, more
  // strengths/tips, higher estimates.
  // ============================================================
  const TASK2 = "Some people believe social media does more harm than good. To what extent do you agree? Write an essay (about 220 words).";
  const ESSAY2 =
"It is often argued that social media has done more harm than good, however i believe the reality is more nuanced. While there are clearly risks, the benefits should not be underestimated.\n\n" +
"On one hand, social media can damage mental health. Constantly comparing ourselves to others may lead to anxiety, and the spread of misinformation is another serious concern. Teenagers are specially vulnerable to these effects.\n\n" +
"On the other hand, these platforms have transformed the way we communicate. They allow people to maintain relationships across long distances, and they give a voice to groups who were previously ignored. For many small businesses, social media is also a cheap and powerful marketing tool.\n\n" +
"In conclusion, although social media certainly has its drawbacks, with responsible use it can be a force for good. The key is education: teaching users to think critically about what they see.";
  const CEFR2 = "B2", EST2 = { ielts: "6.5", toefl: "79-93", rubric: "16-17 / 20" };
  const VOCAB2 = { cefr: "B1-B2", distribution: [{ band: "A1", count: 40 }, { band: "A2", count: 28 }, { band: "B1", count: 16 }, { band: "B2", count: 9 }, { band: "C1", count: 2 }],
    note: "A good spread into B1 and B2 (underestimated, misinformation, nuanced). Strong for this level." };
  const GRAMMAR2 = { cefr: "B2", features: [
      { feature: "Linking adverbials", count: 4, cefr: "B1", examples: ["however i believe", "On the other hand", "In conclusion"] },
      { feature: "Relative clauses", count: 2, cefr: "B1", examples: ["groups who were previously ignored", "what they see"] },
      { feature: "Passive voice", count: 2, cefr: "B1", examples: ["should not be underestimated", "were previously ignored"] },
      { feature: "Modals of possibility (may, can)", count: 3, cefr: "A2", examples: ["may lead to anxiety", "can damage", "can be a force"] },
      { feature: "Present perfect", count: 2, cefr: "B1", examples: ["has done", "have transformed"] }
    ], note: "Confident B1-B2 structures: passives, relative clauses, present perfect." };
  const S2 = {
    id: 'socialmedia', label: 'Social media (B2 · essay)', task: TASK2, essay: ESSAY2, rubric: 'essay',
    lemmas: [
      { lemma: 'be', pos: 'verb', cefr: 'A1', count: 8 },
      { lemma: 'social', pos: 'adj', cefr: 'A2', count: 6, sentences: ['social media has done more harm than good', 'social media can damage mental health'] },
      { lemma: 'media', pos: 'noun', cefr: 'B1', count: 6 },
      { lemma: 'they', pos: 'pron', cefr: 'A1', count: 3 },
      { lemma: 'people', pos: 'noun', cefr: 'A1', count: 2 },
      { lemma: 'argue', pos: 'verb', cefr: 'B1', count: 1, sentences: ['It is often argued that social media has done more harm'] },
      { lemma: 'harm', pos: 'noun', cefr: 'B1', count: 1, sentences: ['more harm than good'] },
      { lemma: 'believe', pos: 'verb', cefr: 'A1', count: 1, sentences: ['i believe the reality is more nuanced'] },
      { lemma: 'reality', pos: 'noun', cefr: 'B1', count: 1 },
      { lemma: 'nuanced', pos: 'adj', cefr: 'C1', count: 1, sentences: ['the reality is more nuanced'] },
      { lemma: 'risk', pos: 'noun', cefr: 'A2', count: 1, sentences: ['there are clearly risks'] },
      { lemma: 'benefit', pos: 'noun', cefr: 'B1', count: 1, sentences: ['the benefits should not be underestimated'] },
      { lemma: 'underestimate', pos: 'verb', cefr: 'B2', count: 1, sentences: ['the benefits should not be underestimated'] },
      { lemma: 'damage', pos: 'verb', cefr: 'B1', count: 1, sentences: ['social media can damage mental health'] },
      { lemma: 'mental', pos: 'adj', cefr: 'B1', count: 1, sentences: ['damage mental health'] },
      { lemma: 'health', pos: 'noun', cefr: 'A2', count: 1 },
      { lemma: 'compare', pos: 'verb', cefr: 'A2', count: 1, sentences: ['comparing ourselves to others'] },
      { lemma: 'anxiety', pos: 'noun', cefr: 'B2', count: 1, sentences: ['may lead to anxiety'] },
      { lemma: 'misinformation', pos: 'noun', cefr: 'C1', count: 1, sentences: ['the spread of misinformation'] },
      { lemma: 'teenager', pos: 'noun', cefr: 'A2', count: 1, sentences: ['Teenagers are specially vulnerable'] },
      { lemma: 'vulnerable', pos: 'adj', cefr: 'B2', count: 1, sentences: ['Teenagers are specially vulnerable'] },
      { lemma: 'platform', pos: 'noun', cefr: 'B1', count: 1, sentences: ['these platforms have transformed the way we communicate'] },
      { lemma: 'transform', pos: 'verb', cefr: 'B2', count: 1, sentences: ['have transformed the way we communicate'] },
      { lemma: 'communicate', pos: 'verb', cefr: 'A2', count: 1 },
      { lemma: 'relationship', pos: 'noun', cefr: 'B1', count: 1, sentences: ['maintain relationships across long distances'] },
      { lemma: 'ignore', pos: 'verb', cefr: 'B1', count: 1, sentences: ['groups who were previously ignored'] },
      { lemma: 'business', pos: 'noun', cefr: 'A2', count: 1, sentences: ['For many small businesses'] },
      { lemma: 'marketing', pos: 'noun', cefr: 'B1', count: 1, sentences: ['a cheap and powerful marketing tool'] },
      { lemma: 'drawback', pos: 'noun', cefr: 'B2', count: 1, sentences: ['social media certainly has its drawbacks'] },
      { lemma: 'education', pos: 'noun', cefr: 'A2', count: 1, sentences: ['The key is education'] },
      { lemma: 'critically', pos: 'adv', cefr: 'B2', count: 1, sentences: ['think critically about what they see'] }
    ],
    verbForms: [
      { form: 'present simple', with: 'is', cefr: 'A1.0', count: 4 },
      { form: 'present simple', with: 'are', cefr: 'A1.0', count: 3 },
      { form: 'present perfect', with: 'has done', cefr: 'B1.1', count: 1, sentences: ['social media has done more harm than good'] },
      { form: 'present perfect', with: 'have transformed', cefr: 'B1.1', count: 1, sentences: ['these platforms have transformed the way'] },
      { form: 'modal', with: 'can', cefr: 'A2.0', count: 2, sentences: ['social media can damage mental health', 'it can be a force for good'] },
      { form: 'modal', with: 'may', cefr: 'B1.0', count: 1, sentences: ['may lead to anxiety'] },
      { form: 'passive', with: 'be underestimated', cefr: 'B1.2', count: 1, sentences: ['the benefits should not be underestimated'] },
      { form: 'passive', with: 'were ignored', cefr: 'B1.2', count: 1, sentences: ['groups who were previously ignored'] },
      { form: 'gerund simple', with: 'comparing', cefr: 'A2.0', count: 1, sentences: ['Constantly comparing ourselves to others'] },
      { form: 'infinitive', with: 'to maintain', cefr: 'A1.0', count: 1, sentences: ['allow people to maintain relationships'] }
    ],
    clauses: [
      { clause: 'noun clause', with: 'that', cefr: 'B1', count: 2, sentences: ['It is often argued that social media has done more harm', 'i believe (that) the reality is more nuanced'] },
      { clause: 'relative clause', with: 'who', cefr: 'B1', count: 1, sentences: ['groups who were previously ignored'] },
      { clause: 'adverbial clause', with: 'while', cefr: 'B1', count: 1, sentences: ['While there are clearly risks'] },
      { clause: 'adverbial clause', with: 'although', cefr: 'B2', count: 1, sentences: ['although social media certainly has its drawbacks'] },
      { clause: 'noun clause', with: 'what', cefr: 'B2', count: 1, sentences: ['think critically about what they see'] }
    ],
    corrections: {
      light: { level: 'light', rubric: 'essay', cefr: CEFR2, estimates: EST2,
        overall: "A strong, balanced B2 essay with sophisticated phrasing. Two quick fixes stand out: a comma splice in the opening and one wrong word. Sort those and it reads very well.",
        criteria: { CC: { verdict: 'Strong', note: 'Clear four-part structure with good signposting.' }, TA: { verdict: 'Good', note: 'Balanced and fully on task.' }, GR: { verdict: 'Good', note: 'Mostly accurate; watch comma splices.' }, VO: { verdict: 'Strong', note: 'Wide, mostly precise range.' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'It is often argued that', text: 'A strong academic opener that frames the debate.' },
          { criterion: 'GR', severity: 'fix', quote: 'however i believe', text: "Comma splice: 'however' cannot join two sentences with a comma. Also capitalise I.", suggestion: 'good. However, I believe' },
          { criterion: 'VO', severity: 'fix', quote: 'specially vulnerable', text: "Wrong word: use 'especially' (particularly).", suggestion: 'especially vulnerable' }
        ] },
      medium: { level: 'medium', rubric: 'essay', cefr: CEFR2, estimates: EST2, vocabProfile: VOCAB2, grammarProfile: GRAMMAR2,
        overall: "A confident, well-balanced B2 essay: clear structure, genuine counter-argument, and some idiomatic phrasing. The main work is punctuation (comma splices where adverbs join sentences) and a couple of word choices. Add one concrete example per body paragraph to push toward C1.",
        criteria: { CC: { verdict: 'Strong', note: 'Four-part structure with consistent signposting. Watch comma splices where adverbs like "however" join two sentences.' }, TA: { verdict: 'Good', note: 'Balanced and fully on task; each side is explained. Add one concrete example to move from explanation to evidence.' }, GR: { verdict: 'Good', note: 'Largely accurate at B2 (passives, relative clauses). The recurring slip is the comma splice, plus a lowercase I.' }, VO: { verdict: 'Strong', note: 'Wide, mostly precise range. A couple of clichés and one confusable word ("specially").' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'It is often argued that', text: 'A strong academic opener that frames the debate impersonally.' },
          { criterion: 'GR', severity: 'fix', quote: 'however i believe', text: "Comma splice: a comma cannot join two sentences. Use a full stop or semicolon, and capitalise I.", suggestion: 'good. However, I believe' },
          { criterion: 'VO', severity: 'tip', quote: 'On one hand', text: "The usual phrase is 'On the one hand' (with 'the').", suggestion: 'On the one hand' },
          { criterion: 'VO', severity: 'fix', quote: 'specially vulnerable', text: "Wrong word: 'specially' = for a special purpose; here you need 'especially'.", suggestion: 'especially vulnerable' },
          { criterion: 'CC', severity: 'strength', quote: 'On the other hand', text: 'Good contrast signpost that balances the argument.' },
          { criterion: 'VO', severity: 'strength', quote: 'give a voice to groups who were previously ignored', text: 'Precise, idiomatic phrasing; this is genuine B2 expression.' },
          { criterion: 'TA', severity: 'tip', quote: 'a cheap and powerful marketing tool', text: 'Good point; one quick example (a local shop, an influencer) would prove it.' },
          { criterion: 'CC', severity: 'strength', quote: 'In conclusion', text: 'Clear conclusion that restates your balanced position.' }
        ],
        plan: ['Fix the comma splices: when "however"/"therefore" start a new idea, start a new sentence.', 'Add one concrete example to each body paragraph (a study, a person, a business).', 'Replace mild clichés with sharper phrasing.', 'Keep the strong signposting and the counter-argument; that structure is working.'] },
      deep: { level: 'deep', rubric: 'essay', cefr: CEFR2, estimates: EST2, vocabProfile: VOCAB2, grammarProfile: GRAMMAR2,
        overall: "This is an accomplished B2 response: it frames the question impersonally, develops both sides, and reaches a qualified conclusion. The grammar is largely accurate, so the path to C1 runs through three things: eliminate the comma splices that recur when adverbs link clauses; replace a few near-clichés with precise phrasing; and evidence each claim with a concrete example rather than a general statement.",
        criteria: { CC: { verdict: 'Strong', note: 'A genuine intro, two-sided body, and qualified conclusion with consistent signposting. The only structural weakness is punctuation at clause boundaries (comma splices).' }, TA: { verdict: 'Good', note: 'Fully addressed and balanced. Every claim is explained but few are evidenced; one concrete example per paragraph would lift the score.' }, GR: { verdict: 'Good', note: 'Confident control of passives, relative clauses and present perfect. The systematic issue is joining two independent clauses with a comma.' }, VO: { verdict: 'Strong', note: 'Range reaches B2-C1 ("underestimated", "give a voice to"). Two near-clichés ("force for good") and one confusable ("specially") are the only slips.' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'It is often argued that', text: 'Impersonal academic opener; exactly right for an argument essay.' },
          { criterion: 'GR', severity: 'fix', quote: 'however i believe', text: "Comma splice + lowercase I. Use a semicolon or full stop before 'however'.", suggestion: 'good; however, I believe' },
          { criterion: 'VO', severity: 'strength', quote: 'more nuanced', text: 'Sophisticated, precise word choice.' },
          { criterion: 'VO', severity: 'tip', quote: 'On one hand', text: "Standard form is 'On the one hand'.", suggestion: 'On the one hand' },
          { criterion: 'VO', severity: 'fix', quote: 'specially vulnerable', text: "'Especially' (= particularly) is the word you want here.", suggestion: 'especially vulnerable' },
          { criterion: 'CC', severity: 'strength', quote: 'On the other hand', text: 'Balances the two sides cleanly.' },
          { criterion: 'VO', severity: 'strength', quote: 'give a voice to groups who were previously ignored', text: 'Idiomatic and precise; strong B2 expression.' },
          { criterion: 'TA', severity: 'tip', quote: 'a cheap and powerful marketing tool', text: 'Develop with a concrete case to evidence the claim.' },
          { criterion: 'VO', severity: 'tip', quote: 'a force for good', text: 'Slightly clichéd; consider "a positive influence".' },
          { criterion: 'CC', severity: 'strength', quote: 'The key is education', text: 'Strong final sentence that pinpoints the solution.' }
        ],
        rewrites: [
          { before: 'It is often argued that social media has done more harm than good, however i believe the reality is more nuanced.',
            after: 'It is often argued that social media has done more harm than good; however, I believe the reality is more nuanced.',
            why: 'Replaces the comma splice with a semicolon and capitalises I, keeping your strong opener intact.' },
          { before: 'Teenagers are specially vulnerable to these effects.',
            after: 'Teenagers are especially vulnerable to these effects.',
            why: "'Especially' means 'particularly'; 'specially' means 'for a special purpose'." }
        ],
        plan: ['Hunt for comma splices: an adverb like "however" or "therefore" needs a full stop or semicolon before it.', 'Evidence every claim with one concrete example.', 'Swap near-clichés ("a force for good") for precise phrasing.', 'Keep the impersonal openers and two-sided structure.', 'Proof-read for the stray lowercase "i".'] }
    }
  };

  // ============================================================
  // SAMPLE 3 · Daily routine (A2 · short paragraph). Uses the
  // SHORT rubric labels (Task Achievement / Grammatical Accuracy).
  // ============================================================
  const TASK3 = "Write a short paragraph (about 60 words) about your daily routine.";
  const ESSAY3 =
"My name is Ali and i am student. Every day i wake up at seven o'clock and i eat breakfast with my family. After that i go to the university by bus. I have four lessons in the morning. In the afternoon i study in the library and i meet my friends. In the evening i watch tv and go to sleep at eleven.";
  const CEFR3 = "A2", EST3 = { rubric: "14-15 / 20" };
  const VOCAB3 = { cefr: "A1", distribution: [{ band: "A1", count: 38 }, { band: "A2", count: 6 }, { band: "B1", count: 1 }, { band: "B2", count: 0 }, { band: "C1", count: 0 }],
    note: "Very common A1 words, which is appropriate at this level." };
  const GRAMMAR3 = { cefr: "A1", features: [
      { feature: "Present simple", count: 7, cefr: "A1", examples: ["i wake up", "i eat breakfast", "i go", "I have"] },
      { feature: "Linkers (and, after that)", count: 4, cefr: "A1", examples: ["and", "After that", "and i meet"] },
      { feature: "Time phrases", count: 4, cefr: "A2", examples: ["Every day", "at seven o'clock", "In the afternoon", "In the evening"] }
    ], note: "Solid present simple and time phrases at A1-A2." };
  const S3 = {
    id: 'routine', label: 'Daily routine (A2 · short)', task: TASK3, essay: ESSAY3, rubric: 'short',
    lemmas: [
      { lemma: 'I', pos: 'pron', cefr: 'A1', count: 8, sentences: ["i wake up at seven o'clock", 'i go to the university by bus', 'i meet my friends'] },
      { lemma: 'and', pos: 'conj', cefr: 'A1', count: 5 },
      { lemma: 'the', pos: 'det', cefr: 'A1', count: 3 },
      { lemma: 'in', pos: 'prep', cefr: 'A1', count: 3 },
      { lemma: 'my', pos: 'det', cefr: 'A1', count: 2 },
      { lemma: 'name', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'student', pos: 'noun', cefr: 'A1', count: 1, sentences: ['i am student'] },
      { lemma: 'day', pos: 'noun', cefr: 'A1', count: 1, sentences: ['Every day i wake up'] },
      { lemma: 'wake', pos: 'verb', cefr: 'A1', count: 1, sentences: ["i wake up at seven o'clock"] },
      { lemma: 'breakfast', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'family', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'university', pos: 'noun', cefr: 'A1', count: 1, sentences: ['i go to the university by bus'] },
      { lemma: 'bus', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'lesson', pos: 'noun', cefr: 'A1', count: 1, sentences: ['I have four lessons in the morning'] },
      { lemma: 'morning', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'afternoon', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'study', pos: 'verb', cefr: 'A1', count: 1, sentences: ['i study in the library'] },
      { lemma: 'library', pos: 'noun', cefr: 'A2', count: 1, sentences: ['i study in the library'] },
      { lemma: 'meet', pos: 'verb', cefr: 'A1', count: 1, sentences: ['i meet my friends'] },
      { lemma: 'friend', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'evening', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'watch', pos: 'verb', cefr: 'A1', count: 1, sentences: ['i watch tv'] },
      { lemma: 'sleep', pos: 'verb', cefr: 'A1', count: 1, sentences: ['go to sleep at eleven'] }
    ],
    verbForms: [
      { form: 'present simple', with: 'go', cefr: 'A1.0', count: 2, sentences: ['i go to the university by bus', 'go to sleep at eleven'] },
      { form: 'present simple', with: 'wake up', cefr: 'A1.0', count: 1, sentences: ["i wake up at seven o'clock"] },
      { form: 'present simple', with: 'eat', cefr: 'A1.0', count: 1, sentences: ['i eat breakfast with my family'] },
      { form: 'present simple', with: 'have', cefr: 'A1.0', count: 1, sentences: ['I have four lessons'] },
      { form: 'present simple', with: 'study', cefr: 'A1.0', count: 1 },
      { form: 'present simple', with: 'meet', cefr: 'A1.0', count: 1 },
      { form: 'present simple', with: 'watch', cefr: 'A1.0', count: 1 },
      { form: 'present simple', with: 'am', cefr: 'A1.0', count: 1, sentences: ['i am student'] }
    ],
    clauses: [
      { clause: 'compound sentence', with: 'and', cefr: 'A1', count: 5, sentences: ["i wake up at seven o'clock and i eat breakfast", 'i study in the library and i meet my friends', 'i watch tv and go to sleep at eleven'] },
      { clause: 'simple sentence', with: '(none)', cefr: 'A1', count: 3, sentences: ['I have four lessons in the morning', 'After that i go to the university by bus'] }
    ],
    corrections: {
      light: { level: 'light', rubric: 'short', cefr: CEFR3, estimates: EST3,
        overall: "A clear, complete paragraph in good time order. Two things to fix first: always write 'I' with a capital letter, and add 'a' before a singular word like 'student'.",
        criteria: { CC: { verdict: 'Good', note: 'Clear time order from morning to evening.' }, TA: { verdict: 'Good', note: 'Answers the task and is the right length.' }, GR: { verdict: 'Needs work', note: 'Capital I and missing articles.' }, VO: { verdict: 'Okay', note: 'Simple, correct everyday words.' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'Every day', text: 'A nice time phrase to open your routine.' },
          { criterion: 'GR', severity: 'fix', quote: 'i am student', text: "Add 'a' and use a capital I.", suggestion: 'I am a student', simple: "Write 'I am a student'." },
          { criterion: 'GR', severity: 'fix', quote: 'i wake up', text: "Always write 'I' with a capital letter.", suggestion: 'I wake up', simple: "Use a big 'I'." }
        ] },
      medium: { level: 'medium', rubric: 'short', cefr: CEFR3, estimates: EST3, vocabProfile: VOCAB3, grammarProfile: GRAMMAR3,
        overallSimple: "Good paragraph! It is clear and in good order. Two easy fixes: write 'I' with a big letter, and use 'a' before one thing (a student). Then it is great.",
        overall: "A clear, well-ordered paragraph that fully answers the task. The ideas flow from morning to evening with good time phrases. The main things to fix are basic accuracy: a capital 'I' every time, an article before a singular noun, and capital 'TV'. Try a few shorter sentences so not every idea uses 'and'.",
        criteria: { CC: { verdict: 'Good', note: 'Clear time order (Every day, After that, In the afternoon, In the evening). Some sentences rely on "and".' }, TA: { verdict: 'Good', note: 'Fully answers the task and is the right length.' }, GR: { verdict: 'Needs work', note: 'The main issues are the lowercase "i" and a missing article before "student".' }, VO: { verdict: 'Okay', note: 'Simple, correct everyday words with a little repetition.' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'Every day', text: 'A nice time phrase to open your routine.' },
          { criterion: 'GR', severity: 'fix', quote: 'i am student', text: "Add 'a' and use a capital I.", suggestion: 'I am a student', simple: "Write 'I am a student'." },
          { criterion: 'GR', severity: 'fix', quote: 'i wake up', text: "Always write 'I' with a capital letter.", suggestion: 'I wake up', simple: "Use a big 'I'." },
          { criterion: 'TA', severity: 'strength', quote: 'I have four lessons', text: 'Good, clear detail that answers the task well.' },
          { criterion: 'GR', severity: 'tip', quote: 'watch tv', text: "Capitalise 'TV'.", suggestion: 'watch TV', simple: "Write 'TV' with big letters." },
          { criterion: 'CC', severity: 'tip', quote: 'and i meet my friends', text: 'Many sentences use "and". Try a short sentence sometimes.', simple: 'Use short sentences too, not only "and".' }
        ],
        plan: ['Write "I" with a capital letter every time.', 'Use "a" before one thing (a student, a bus).', 'Write "TV" with capital letters.', 'Try some short sentences, not only "and".'] },
      deep: { level: 'deep', rubric: 'short', cefr: CEFR3, estimates: EST3, vocabProfile: VOCAB3, grammarProfile: GRAMMAR3,
        overall: "This is a complete, well-sequenced A2 paragraph: it answers the task, keeps a clear morning-to-evening order, and uses correct present simple throughout. To improve, focus on three small but frequent points of accuracy, the capital 'I', articles before singular nouns, and the capitalisation of 'TV', and then add a little sentence variety so the writing does not rely on 'and'.",
        criteria: { CC: { verdict: 'Good', note: 'Logical time order with clear sequencers. A few sentences chain with "and"; mixing in shorter sentences would vary the rhythm.' }, TA: { verdict: 'Good', note: 'Fully on task and the expected length, with concrete details (seven o\'clock, four lessons).' }, GR: { verdict: 'Needs work', note: 'Present simple is correct throughout. The repeated issues are the lowercase "i" and the missing article in "i am student".' }, VO: { verdict: 'Okay', note: 'Accurate everyday vocabulary; a little repetition of "and" and "i".' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'Every day', text: 'A good opening time phrase.' },
          { criterion: 'GR', severity: 'fix', quote: 'i am student', text: "Add the article 'a' and a capital I.", suggestion: 'I am a student' },
          { criterion: 'GR', severity: 'fix', quote: 'i wake up', text: "Capital I every time you write it.", suggestion: 'I wake up' },
          { criterion: 'GR', severity: 'tip', quote: 'i go to the university', text: "We usually say 'go to university' (no 'the') in general.", suggestion: 'I go to university' },
          { criterion: 'TA', severity: 'strength', quote: 'I have four lessons', text: 'Clear, specific detail.' },
          { criterion: 'GR', severity: 'tip', quote: 'watch tv', text: "Capitalise 'TV'.", suggestion: 'watch TV' },
          { criterion: 'CC', severity: 'tip', quote: 'and i meet my friends', text: 'Vary the sentences; not every idea needs "and".' }
        ],
        rewrites: [
          { before: 'My name is Ali and i am student.', after: 'My name is Ali and I am a student.', why: "Capital 'I' and the article 'a' before a singular role." }
        ],
        plan: ['Capital "I" everywhere.', 'Add "a/an" before singular nouns.', 'Capitalise "TV".', 'Drop "the" in "go to university".', 'Use a short sentence now and then for variety.'] }
    }
  };

  // ============================================================
  // SAMPLE 4 · Online learning (B1 · academic paragraph). Uses the
  // ACADEMIC rubric (topic sentence / supporting / concluding).
  // ============================================================
  const TASK4 = "Write an academic paragraph (about 120 words): What are the advantages of online learning?";
  const ESSAY4 =
"Online learning has several important advantages for university students. First, it offers flexibility, because students can study at any time and any place that is convenient for them. Secondly, it is often cheaper than traditional education, students do not need to pay for transport or accommodation. In addition, online courses give access to a wide range of materials, such as videos and articles, which students can watch again when they need. However, online learning also requires strong self-discipline. In conclusion, despite some challenges, online learning is a flexible and affordable option that benefits many learners.";
  const CEFR4 = "B1", EST4 = { ielts: "5.5", toefl: "60-78", rubric: "15-16 / 20" };
  const VOCAB4 = { cefr: "B1", distribution: [{ band: "A1", count: 42 }, { band: "A2", count: 22 }, { band: "B1", count: 12 }, { band: "B2", count: 3 }, { band: "C1", count: 0 }],
    note: "Good academic vocabulary at B1 (flexibility, accommodation, affordable)." };
  const GRAMMAR4 = { cefr: "B1", features: [
      { feature: "Linking adverbials", count: 5, cefr: "B1", examples: ["First,", "Secondly,", "In addition", "However,", "In conclusion"] },
      { feature: "Relative clauses", count: 2, cefr: "B1", examples: ["place that is convenient", "materials ... which students can watch"] },
      { feature: "Modal (can)", count: 2, cefr: "A2", examples: ["students can study", "students can watch"] },
      { feature: "Present simple", count: 4, cefr: "A1", examples: ["it offers", "courses give", "learning requires"] }
    ], note: "B1 connectors and relative clauses are used well." };
  const S4 = {
    id: 'onlinelearning', label: 'Online learning (B1 · academic)', task: TASK4, essay: ESSAY4, rubric: 'academic',
    lemmas: [
      { lemma: 'online', pos: 'adj', cefr: 'A2', count: 4, sentences: ['Online learning has several important advantages', 'online courses give access'] },
      { lemma: 'learning', pos: 'noun', cefr: 'A2', count: 4 },
      { lemma: 'student', pos: 'noun', cefr: 'A1', count: 3, sentences: ['advantages for university students', 'students can study at any time'] },
      { lemma: 'advantage', pos: 'noun', cefr: 'A2', count: 1, sentences: ['several important advantages'] },
      { lemma: 'important', pos: 'adj', cefr: 'A1', count: 1 },
      { lemma: 'university', pos: 'noun', cefr: 'A1', count: 1 },
      { lemma: 'flexibility', pos: 'noun', cefr: 'B2', count: 1, sentences: ['it offers flexibility'] },
      { lemma: 'study', pos: 'verb', cefr: 'A1', count: 1, sentences: ['students can study at any time and any place'] },
      { lemma: 'convenient', pos: 'adj', cefr: 'B1', count: 1, sentences: ['any place that is convenient for them'] },
      { lemma: 'cheap', pos: 'adj', cefr: 'A1', count: 1, sentences: ['it is often cheaper than traditional education'] },
      { lemma: 'traditional', pos: 'adj', cefr: 'B1', count: 1, sentences: ['cheaper than traditional education'] },
      { lemma: 'education', pos: 'noun', cefr: 'A2', count: 1 },
      { lemma: 'transport', pos: 'noun', cefr: 'A2', count: 1, sentences: ['pay for transport or accommodation'] },
      { lemma: 'accommodation', pos: 'noun', cefr: 'B1', count: 1, sentences: ['transport or accommodation'] },
      { lemma: 'course', pos: 'noun', cefr: 'A2', count: 1, sentences: ['online courses give access'] },
      { lemma: 'access', pos: 'noun', cefr: 'B1', count: 1, sentences: ['give access to a wide range of materials'] },
      { lemma: 'range', pos: 'noun', cefr: 'B1', count: 1, sentences: ['a wide range of materials'] },
      { lemma: 'material', pos: 'noun', cefr: 'B1', count: 1, sentences: ['a wide range of materials, such as videos and articles'] },
      { lemma: 'article', pos: 'noun', cefr: 'A2', count: 1 },
      { lemma: 'require', pos: 'verb', cefr: 'B1', count: 1, sentences: ['online learning also requires strong self-discipline'] },
      { lemma: 'self-discipline', pos: 'noun', cefr: 'B2', count: 1, sentences: ['requires strong self-discipline'] },
      { lemma: 'challenge', pos: 'noun', cefr: 'B1', count: 1, sentences: ['despite some challenges'] },
      { lemma: 'affordable', pos: 'adj', cefr: 'B1', count: 1, sentences: ['a flexible and affordable option'] },
      { lemma: 'benefit', pos: 'verb', cefr: 'B1', count: 1, sentences: ['benefits many learners'] },
      { lemma: 'learner', pos: 'noun', cefr: 'A2', count: 1 }
    ],
    verbForms: [
      { form: 'present simple', with: 'is', cefr: 'A1.0', count: 3 },
      { form: 'present simple', with: 'has', cefr: 'A1.0', count: 1, sentences: ['Online learning has several important advantages'] },
      { form: 'present simple', with: 'offers', cefr: 'A1.0', count: 1, sentences: ['it offers flexibility'] },
      { form: 'present simple', with: 'give', cefr: 'A1.0', count: 1, sentences: ['online courses give access'] },
      { form: 'present simple', with: 'requires', cefr: 'A1.0', count: 1, sentences: ['online learning also requires strong self-discipline'] },
      { form: 'modal', with: 'can study', cefr: 'A2.0', count: 1, sentences: ['students can study at any time'] },
      { form: 'modal', with: 'can watch', cefr: 'A2.0', count: 1, sentences: ['which students can watch again'] },
      { form: 'infinitive', with: 'to pay', cefr: 'A1.0', count: 1, sentences: ['students do not need to pay for transport'] }
    ],
    clauses: [
      { clause: 'adverbial clause', with: 'because', cefr: 'B1', count: 1, sentences: ['because students can study at any time and any place'] },
      { clause: 'relative clause', with: 'that', cefr: 'B1', count: 1, sentences: ['any place that is convenient for them'] },
      { clause: 'relative clause', with: 'which', cefr: 'B1', count: 1, sentences: ['materials ... which students can watch again'] },
      { clause: 'adverbial clause', with: 'when', cefr: 'B1', count: 1, sentences: ['watch again when they need'] },
      { clause: 'compound sentence', with: '(comma splice)', cefr: 'A1', count: 1, sentences: ['cheaper than traditional education, students do not need to pay'] }
    ],
    corrections: {
      light: { level: 'light', rubric: 'academic', cefr: CEFR4, estimates: EST4,
        overall: "A well-built academic paragraph with a clear topic sentence and good connectors. The main things to fix are a comma splice and one incomplete phrase.",
        criteria: { CC: { verdict: 'Strong', note: 'Topic sentence, ordered support, and a conclusion are all present.' }, TA: { verdict: 'Good', note: 'Relevant, well-developed reasons.' }, GR: { verdict: 'Satisfactory', note: 'A comma splice and one incomplete clause.' }, VO: { verdict: 'Good', note: 'Appropriate academic vocabulary.' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'Online learning has several important advantages', text: 'Excellent topic sentence: it states the main idea clearly.' },
          { criterion: 'GR', severity: 'fix', quote: 'traditional education, students do not need', text: 'Comma splice: two sentences joined by a comma. Use a full stop or "because".', suggestion: 'traditional education, because students do not need' },
          { criterion: 'GR', severity: 'fix', quote: 'when they need', text: 'Incomplete: add "to".', suggestion: 'when they need to' }
        ] },
      medium: { level: 'medium', rubric: 'academic', cefr: CEFR4, estimates: EST4, vocabProfile: VOCAB4, grammarProfile: GRAMMAR4,
        overall: "A strong B1 academic paragraph: a clear topic sentence, ordered supporting sentences with good connectors, a concession, and a concluding sentence. The two things to fix are a comma splice and one incomplete clause. Developing the drawback ('self-discipline') with a short example would make it even fuller.",
        criteria: { CC: { verdict: 'Strong', note: 'Model paragraph shape: topic sentence, ordered support (First, Secondly, In addition), a concession, and a conclusion.' }, TA: { verdict: 'Good', note: 'Relevant and well developed. The drawback is mentioned but not developed; one example would complete it.' }, GR: { verdict: 'Satisfactory', note: 'Mostly accurate; the recurring issues are the comma splice and an incomplete clause.' }, VO: { verdict: 'Good', note: 'Appropriate academic vocabulary (flexibility, accommodation, affordable).' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'Online learning has several important advantages', text: 'Excellent topic sentence stating the main idea.' },
          { criterion: 'CC', severity: 'strength', quote: 'it offers flexibility', text: 'Good first supporting point, with a reason ("because...").' },
          { criterion: 'GR', severity: 'fix', quote: 'traditional education, students do not need', text: 'Comma splice: join the ideas with "because" or use a full stop.', suggestion: 'traditional education, because students do not need' },
          { criterion: 'CC', severity: 'strength', quote: 'In addition', text: 'Good linker introducing a third point.' },
          { criterion: 'GR', severity: 'fix', quote: 'when they need', text: 'Incomplete clause: add "to" or an object.', suggestion: 'when they need to' },
          { criterion: 'TA', severity: 'tip', quote: 'However, online learning also requires strong self-discipline', text: 'Good balance (a drawback). Develop it with one example to strengthen the paragraph.' },
          { criterion: 'CC', severity: 'strength', quote: 'In conclusion', text: 'Clear concluding sentence that sums up the main idea.' }
        ],
        plan: ['Fix the comma splice: use "because" or a full stop, not a comma, between two sentences.', 'Complete "when they need to".', 'Add one short example to the self-discipline point.', 'Keep the strong topic and concluding sentences.'] },
      deep: { level: 'deep', rubric: 'academic', cefr: CEFR4, estimates: EST4, vocabProfile: VOCAB4, grammarProfile: GRAMMAR4,
        overall: "An effective B1 academic paragraph that does almost everything the genre asks: it opens with a clear topic sentence, orders its support with connectors, concedes a drawback, and closes with a restatement. Accuracy is the main area to develop, specifically the comma splice between two independent clauses and one incomplete relative clause. Developing the concession with a concrete example would raise the content score.",
        criteria: { CC: { verdict: 'Strong', note: 'A model academic paragraph: topic sentence, ordered supporting sentences (First, Secondly, In addition), a concession with "However", and a concluding sentence. Cohesion is a real strength.' }, TA: { verdict: 'Good', note: 'Relevant and well-developed reasons. The drawback (self-discipline) is named but not developed; one example would complete the content.' }, GR: { verdict: 'Satisfactory', note: 'Generally accurate B1, including relative clauses. The systematic issue is the comma splice; there is also one incomplete clause ("when they need").' }, VO: { verdict: 'Good', note: 'Appropriate academic range (flexibility, accommodation, affordable, materials). Precise adjectives in the conclusion.' } },
        annotations: [
          { criterion: 'CC', severity: 'strength', quote: 'Online learning has several important advantages', text: 'Textbook topic sentence: clear main idea.' },
          { criterion: 'CC', severity: 'strength', quote: 'it offers flexibility', text: 'First supporting point with a reason.' },
          { criterion: 'GR', severity: 'fix', quote: 'traditional education, students do not need', text: 'Comma splice: two independent clauses cannot be joined by a comma.', suggestion: 'traditional education, because students do not need' },
          { criterion: 'CC', severity: 'strength', quote: 'In addition', text: 'Connector that introduces the third advantage.' },
          { criterion: 'VO', severity: 'strength', quote: 'a wide range of materials', text: 'Good academic collocation.' },
          { criterion: 'GR', severity: 'fix', quote: 'when they need', text: 'Incomplete: "need" requires "to" or an object here.', suggestion: 'when they need to' },
          { criterion: 'TA', severity: 'tip', quote: 'However, online learning also requires strong self-discipline', text: 'Strong concession; develop it with one example (a student who falls behind).' },
          { criterion: 'VO', severity: 'strength', quote: 'a flexible and affordable option', text: 'Precise, well-chosen adjectives in the conclusion.' },
          { criterion: 'CC', severity: 'strength', quote: 'In conclusion', text: 'Concluding sentence that restates the main idea.' }
        ],
        rewrites: [
          { before: 'Secondly, it is often cheaper than traditional education, students do not need to pay for transport or accommodation.',
            after: 'Secondly, it is often cheaper than traditional education, because students do not need to pay for transport or accommodation.',
            why: 'Adds "because" to join the two ideas correctly and removes the comma splice.' },
          { before: 'In addition, online courses give access to a wide range of materials, such as videos and articles, which students can watch again when they need.',
            after: 'In addition, online courses give access to a wide range of materials, such as videos and articles, which students can watch again whenever they need to.',
            why: 'Completes the clause with "to" and sharpens "when" to "whenever".' }
        ],
        plan: ['Replace the comma splice with "because" or a full stop.', 'Complete "when they need to".', 'Develop the self-discipline drawback with one concrete example.', 'Keep the clear topic and concluding sentences.', 'Proof-read once for clause boundaries.'] }
    }
  };

  // ============================================================
  // SAMPLE 5 · Communication & teamwork vs academic qualifications
  // (B1+ to B2 · agree/disagree essay). The user's "NO. 7" essay.
  // ============================================================
  const TASK5 = "Some people believe that having strong communication and teamwork skills is more important for career success than having high academic qualifications. Do you agree or disagree?";

  const ESSAY5 =
"It is certainly true that strong communication and teamwork skills are one of the important factors which can help humans to succeed in their career. Today, workers must try their best to collaborate with each other in teams that come with positive aspects. Although having academic qualifications is not inconsequential, powerful communication and teamwork are far more significant.\n\n" +
"The first crucial factor to which I can refer is that high communication and teamwork skills help teams to solve problems and duties in the best possible way. By leveraging these skills, teams have high possibility to benefit from any resources for doing their jobs, which increases team performance. This leads to achieving their goals faster in shorter periods. For example, a study in an economic science journal in 2020 showed that companies with high levels of team collaboration have more merits for their goals ahead of schedule.\n\n" +
"Another point worth mentioning is that teams who have high teamwork have fewer probability of making mistakes that comes with positive aspects for companies. By group work, teams can work and focus on their tasks with more sensitivity that reduce their error rates. This can increase the group succeed percentage. A vivid example of this is when teams who work with high accuracy have fewer wasted products.\n\n" +
"To draw conclusion what has been mentioned above, I strongly agree that although having high academic qualifications is not unimportant, having high communication and teamwork skills are more advantageous.";

  const CEFR5 = "B1+ to B2";
  const ESTIMATES5 = { ielts: "6.0 to 6.5", toefl: "72-94", rubric: "14-16 / 20" };
  const VOCAB5 = {
    cefr: "B1",
    distribution: [
      { band: "A1", count: 118 }, { band: "A2", count: 22 },
      { band: "B1", count: 14 }, { band: "B2", count: 6 }, { band: "C1", count: 1 }
    ],
    note: "Good range for the topic, with some B1 to B2 words (collaborate, resources, performance, leveraging, inconsequential, advantageous). The recurring slip is collocation: strong words with the wrong partner (high skills, powerful communication)."
  };
  const GRAMMAR5 = {
    cefr: "B1",
    features: [
      { feature: "Present simple", count: 14, cefr: "A1", examples: ["skills help teams", "teams can work"] },
      { feature: "Modal verbs (can, must)", count: 4, cefr: "A2", examples: ["workers must try", "teams can work", "can increase"] },
      { feature: "Relative clauses (which / that / who)", count: 6, cefr: "B1", examples: ["factors which can help", "teams who have high teamwork", "that reduce their error rates"] },
      { feature: "Gerund as subject", count: 3, cefr: "B1", examples: ["having academic qualifications is", "having ... skills are"] },
      { feature: "Comparatives (far more / more ... than)", count: 2, cefr: "B1", examples: ["far more significant", "more advantageous"] },
      { feature: "Signposting linkers", count: 5, cefr: "B1", examples: ["The first crucial factor", "Another point worth mentioning", "For example", "To draw conclusion"] }
    ],
    note: "Range reaches B1 (relative clauses, gerund subjects, comparatives) but accuracy lags: agreement slips on gerund subjects and relative clauses."
  };

  const LIGHT5 = {
    level: 'light', rubric: 'essay',
    cefr: CEFR5, estimates: ESTIMATES5,
    overall: "Confident, well-structured essay with a clear position. Before anything else, fix the one collocation that repeats ('high' / 'powerful' skills should be 'strong' skills) and a couple of subject-verb agreement slips: those are what a reader notices first.",
    criteria: {
      CC: { verdict: 'Clear', note: 'Intro, two reasons with examples, and a conclusion are all present.' },
      TA: { verdict: 'On task', note: 'You answer the question and take a clear side.' },
      GR: { verdict: 'Needs attention', note: 'Subject-verb agreement and a word-form error (marked below).' },
      VO: { verdict: 'Okay', note: 'One collocation repeats: skills are "strong", not "high".' }
    },
    annotations: [
      { criterion: 'CC', severity: 'strength', quote: 'The first crucial factor', text: 'Good signposting; it tells the reader a reason is coming.' },
      { criterion: 'VO', severity: 'fix', quote: 'high communication and teamwork skills help', text: 'Collocation: skills are "strong", not "high". This repeats, so fix it everywhere.', suggestion: 'strong communication and teamwork skills help' },
      { criterion: 'GR', severity: 'fix', quote: 'the group succeed percentage', text: 'Word form: the noun is "success", not "succeed".', suggestion: "the group's success rate" },
      { criterion: 'GR', severity: 'fix', quote: 'having high communication and teamwork skills are more advantageous', text: 'Agreement: the subject "having ... skills" is singular, so "is".', suggestion: 'having strong communication and teamwork skills is more advantageous' },
      { criterion: 'GR', severity: 'fix', quote: 'To draw conclusion what has been mentioned above', text: 'Missing article and preposition.', suggestion: 'To conclude,' }
    ]
  };

  const MEDIUM5 = {
    level: 'medium', rubric: 'essay',
    cefr: CEFR5, estimates: ESTIMATES5, vocabProfile: VOCAB5, grammarProfile: GRAMMAR5,
    overall: "A well-organised, confident opinion essay: you take a clear position and hold it from start to finish, with proper paragraphs, signposting and an example. What holds it back is wording, not ideas. One collocation repeats ('high' / 'powerful' + skills, which should be 'strong' or 'effective'), a few subject-verb agreements slip, and some phrases are vague. Fix the marks below and this steps up toward a confident B2.",
    overallSimple: "Good, clear essay with a strong plan. The main problem is small wording. Skills are 'strong', not 'high'. Make the verb match the subject ('having skills IS'). And cut empty phrases like 'that come with positive aspects'. Fix these and it will be much better.",
    criteria: {
      CC: { verdict: 'Good', note: 'Clear intro, two body reasons with topic sentences and examples, and a conclusion. Watch the vague filler ("that come with positive aspects" appears twice) and some redundancy ("faster in shorter periods").', noteSimple: 'Good plan: intro, two reasons, conclusion. Remove empty phrases and repeated ideas.' },
      TA: { verdict: 'Satisfactory', note: 'You answer the task, hold a clear position and note the other view. But the two reasons are very similar, and the essay is about teams while the prompt is about an individual career. Make the reasons distinct and link back to the person.', noteSimple: "You answer the question. Make your two reasons different, and connect team skills to one person's career." },
      GR: { verdict: 'Needs improvement', note: 'Recurring subject-verb agreement (skills are one of; mistakes that comes; having skills are), a word form (succeed for success), countability (fewer probability), and a missing article and preposition in the conclusion.', noteSimple: 'Watch the verb with the subject, and word forms ("success", not "succeed").' },
      VO: { verdict: 'Satisfactory', note: 'Ambitious words (leveraging, collaborate, inconsequential), but the collocation "high / powerful + skills" repeats and should be "strong / effective". A few words are imprecise (sensitivity, merits).', noteSimple: 'Some strong words. But say "strong skills", not "high skills".' }
    },
    annotations: [
      { criterion: 'GR', severity: 'fix', quote: 'skills are one of the important factors', text: 'Agreement / "one of": after "one of" use "among", or rephrase.', suggestion: 'are among the most important factors', simple: 'Use "among the most important factors".', simpleSuggestion: 'are among the most important factors' },
      { criterion: 'VO', severity: 'fix', quote: 'help humans to succeed', text: '"humans" sounds biological here; use "people".', suggestion: 'help people to succeed', simple: 'Use "people", not "humans".', simpleSuggestion: 'help people to succeed' },
      { criterion: 'CC', severity: 'tip', quote: 'in teams that come with positive aspects', text: 'This phrase is vague; say what the benefit is, or cut it.', suggestion: 'in teams, which brings real benefits', simple: 'Say what is good about teams, or remove this.', simpleSuggestion: 'in teams' },
      { criterion: 'TA', severity: 'strength', quote: 'Although having academic qualifications is not inconsequential', text: 'You acknowledge the other side before disagreeing, which strengthens an opinion essay.', simple: 'Good. You mention the other opinion, then give yours.' },
      { criterion: 'VO', severity: 'fix', quote: 'powerful communication and teamwork are far more significant', text: 'Collocation: communication is "strong" or "effective", not "powerful".', suggestion: 'strong communication and teamwork skills are far more significant', simple: 'Use "strong", not "powerful".', simpleSuggestion: 'strong communication and teamwork skills are far more significant' },
      { criterion: 'CC', severity: 'strength', quote: 'The first crucial factor', text: 'Good signposting; it signals a new reason.', simple: 'Nice. This helps the reader follow you.' },
      { criterion: 'VO', severity: 'fix', quote: 'high communication and teamwork skills help', text: 'Collocation: skills are "strong" or "good", not "high". This pattern repeats, so fix it everywhere.', suggestion: 'strong communication and teamwork skills help', simple: 'Skills are "strong", not "high".', simpleSuggestion: 'strong communication and teamwork skills help' },
      { criterion: 'VO', severity: 'fix', quote: 'solve problems and duties', text: 'Word partner: you solve problems but carry out duties.', suggestion: 'solve problems and carry out their duties', simple: 'You "carry out" duties, not "solve" them.', simpleSuggestion: 'solve problems and carry out their duties' },
      { criterion: 'GR', severity: 'fix', quote: 'have high possibility to benefit from any resources', text: '"possibility to + verb" is not correct; use "more likely to". "any" is vague.', suggestion: 'are more likely to make good use of the available resources', simple: 'Use "are more likely to".', simpleSuggestion: 'are more likely to use the available resources' },
      { criterion: 'CC', severity: 'tip', quote: 'achieving their goals faster in shorter periods', text: 'Redundant: "faster" already means "in shorter periods".', suggestion: 'achieving their goals more quickly', simple: '"Faster" already means "in less time". Keep one.', simpleSuggestion: 'achieving their goals more quickly' },
      { criterion: 'TA', severity: 'strength', quote: 'a study in an economic science journal in 2020', text: 'A specific example. Evidence like this makes your point convincing.', simple: 'Good. A real example makes your reason stronger.' },
      { criterion: 'VO', severity: 'fix', quote: 'have more merits for their goals ahead of schedule', text: 'Unclear: "merits" is the wrong word here.', suggestion: 'are more likely to reach their goals ahead of schedule', simple: 'Say "are more likely to reach their goals".', simpleSuggestion: 'are more likely to reach their goals ahead of schedule' },
      { criterion: 'CC', severity: 'strength', quote: 'Another point worth mentioning', text: 'Clear linking into your second reason.', simple: 'Good. This shows a new point is starting.' },
      { criterion: 'GR', severity: 'fix', quote: 'have fewer probability of making mistakes that comes', text: '"probability" is uncountable, so "less" / "a lower"; and "mistakes that come" (plural).', suggestion: 'are less likely to make mistakes', simple: 'Use "are less likely to make mistakes".', simpleSuggestion: 'are less likely to make mistakes' },
      { criterion: 'GR', severity: 'fix', quote: 'with more sensitivity that reduce their error rates', text: 'Word choice ("care" / "attention") and agreement ("which reduces").', suggestion: 'with more care, which reduces their error rate', simple: 'Use "care", and "which reduces".', simpleSuggestion: 'with more care, which reduces their error rate' },
      { criterion: 'GR', severity: 'fix', quote: 'the group succeed percentage', text: 'Word form: "succeed" is a verb; the noun is "success". "percentage" is better as "rate".', suggestion: "the group's success rate", simple: 'Use "success", not "succeed".', simpleSuggestion: "the group's success rate" },
      { criterion: 'GR', severity: 'fix', quote: 'To draw conclusion what has been mentioned above', text: 'Missing article and preposition.', suggestion: 'To conclude,', simple: 'Just write "To conclude,".', simpleSuggestion: 'To conclude,' },
      { criterion: 'GR', severity: 'fix', quote: 'having high communication and teamwork skills are more advantageous', text: 'Agreement: the subject "having ... skills" is singular, so "is".', suggestion: 'having strong communication and teamwork skills is more advantageous', simple: 'Use "is", not "are". Also "strong", not "high".', simpleSuggestion: 'having strong communication and teamwork skills is more advantageous' }
    ],
    plan: [
      'Fix the one collocation that repeats: change every "high" / "powerful" + skills / communication to "strong" or "effective".',
      'Check agreement on gerund subjects and relative clauses: "having skills IS", "mistakes that COME", "which REDUCES".',
      'Cut vague filler ("that come with positive aspects") and say what the benefit actually is.',
      'Make your two reasons clearly different, and connect team skills back to the individual career the prompt asks about.'
    ],
    planSimple: [
      'Change "high skills" to "strong skills" everywhere.',
      'Match the verb to the subject ("having skills is").',
      'Remove empty phrases; say the real benefit.',
      'Make your two reasons different from each other.'
    ]
  };

  const DEEP5 = {
    level: 'deep', rubric: 'essay',
    cefr: CEFR5, estimates: ESTIMATES5, vocabProfile: VOCAB5, grammarProfile: GRAMMAR5,
    overall: "A well-organised B1+ response that takes a clear stance and even concedes the opposing view, which is a real strength. To push toward a confident B2, the priorities are, in order: first, lexical collocation, since 'high' and 'powerful' are repeatedly paired with 'skills' and 'communication' where 'strong' or 'effective' is needed; second, grammatical accuracy, where subject-verb agreement slips on gerund subjects and relative clauses; and third, development, since the two reasons overlap and stay at the level of assertion. Work through the inline marks, study the model rewrites, then redraft using the plan.",
    overallSimple: "Strong, clear essay. Three things to improve: say 'strong skills' (not 'high'); make the verb match the subject ('having skills is'); and make your two reasons more different. Use the model sentences below to see how.",
    criteria: {
      CC: { verdict: 'Good', note: 'Real intro, two-body and conclusion shape with consistent signposting (The first crucial factor, Another point, For example, To draw conclusion) and a concession. Two things hold it back: vague filler ("that come with positive aspects", used twice) and redundancy ("faster in shorter periods", "work and focus").', noteSimple: 'Good plan and linking words. Remove empty and repeated phrases.' },
      TA: { verdict: 'Satisfactory', note: 'The task is addressed and the position never wavers, with a fair concession. But the two reasons are essentially the same idea (teams perform better / make fewer mistakes), and the argument lives at "teams" while the prompt asks about an individual career. Differentiate the reasons and tie them to personal success.', noteSimple: "You answer well. Make the two reasons different, and link to one person's career." },
      GR: { verdict: 'Needs improvement', note: 'The recurring pattern is agreement: "skills are one of", "mistakes that comes", "having skills are", and "that reduce". Add a word-form error ("the group succeed percentage"), a countability error ("fewer probability"), and a missing article and preposition ("To draw conclusion what"). None block meaning, but together they read as carelessness.', noteSimple: 'The same small mistake repeats: the verb must match the subject. Also "success", not "succeed".' },
      VO: { verdict: 'Satisfactory', note: 'Range is good for the topic (leveraging, collaborate, inconsequential, advantageous), but collocation lets it down: "high communication skills", "powerful communication", "high teamwork", "solve duties", "with more sensitivity", "more merits". Each is a chance to choose the natural partner word.', noteSimple: 'Good words, but choose the right partner: "strong skills", "carry out duties", "more care".' }
    },
    annotations: MEDIUM5.annotations,
    rewrites: [
      { before: 'It is certainly true that strong communication and teamwork skills are one of the important factors which can help humans to succeed in their career.',
        after:  'It is certainly true that strong communication and teamwork skills are among the most important factors in a successful career.',
        why: 'Fixes the "one of" agreement, trims the wordy relative clause, and replaces "humans" with the idea of a successful career.' },
      { before: 'The first crucial factor to which I can refer is that high communication and teamwork skills help teams to solve problems and duties in the best possible way.',
        after:  'The first key reason is that strong communication and teamwork skills help teams solve problems and carry out their duties as effectively as possible.',
        why: 'Lightens the heavy opener, fixes the "high skills" collocation, and corrects "solve duties" to "carry out duties".' },
      { before: 'Another point worth mentioning is that teams who have high teamwork have fewer probability of making mistakes that comes with positive aspects for companies.',
        after:  'A second reason is that teams which work well together are less likely to make mistakes, which benefits the company.',
        why: 'Fixes the countability ("less likely"), the agreement, and removes the vague "comes with positive aspects".' },
      { before: 'To draw conclusion what has been mentioned above, I strongly agree that although having high academic qualifications is not unimportant, having high communication and teamwork skills are more advantageous.',
        after:  'To conclude, although strong academic qualifications are not unimportant, I firmly believe that strong communication and teamwork skills are more valuable.',
        why: 'Corrects the opener, fixes the gerund-subject agreement ("is"), and replaces "high ... skills" with "strong ... skills".' }
    ],
    plan: [
      'Hunt one pattern first: change every "high" / "powerful" + skills / communication to "strong" or "effective".',
      'Check agreement on gerund subjects and relative clauses (having skills IS; mistakes that COME; which REDUCES).',
      'Replace vague phrases (that come with positive aspects; more merits; with more sensitivity) with concrete words.',
      'Make the two body reasons genuinely different, and tie team skills back to the individual career.',
      'Redraft, then read it aloud to catch the remaining agreement slips.'
    ]
  };

  const S5 = {
    id: 'teamwork', label: 'Teamwork vs qualifications (B1+ · essay)',
    task: TASK5, essay: ESSAY5, rubric: 'essay',
    lemmas: [
      { lemma: 'team', pos: 'noun', cefr: 'A1', count: 9, sentences: ['help teams to solve problems', 'teams have high possibility', 'teams who have high teamwork'] },
      { lemma: 'skill', pos: 'noun', cefr: 'A2', count: 6, sentences: ['communication and teamwork skills', 'By leveraging these skills'] },
      { lemma: 'high', pos: 'adj', cefr: 'A1', count: 5, sentences: ['high communication and teamwork skills', 'high levels of team collaboration', 'high accuracy'] },
      { lemma: 'have', pos: 'verb', cefr: 'A1', count: 5 },
      { lemma: 'communication', pos: 'noun', cefr: 'B1', count: 4, sentences: ['strong communication and teamwork skills', 'powerful communication and teamwork'] },
      { lemma: 'goal', pos: 'noun', cefr: 'A2', count: 3, sentences: ['achieving their goals faster', 'for their goals ahead of schedule'] },
      { lemma: 'collaborate', pos: 'verb', cefr: 'B1', count: 1, sentences: ['collaborate with each other'] },
      { lemma: 'collaboration', pos: 'noun', cefr: 'B1', count: 1, sentences: ['high levels of team collaboration'] },
      { lemma: 'resource', pos: 'noun', cefr: 'B1', count: 1, sentences: ['benefit from any resources'] },
      { lemma: 'performance', pos: 'noun', cefr: 'B1', count: 1, sentences: ['increases team performance'] },
      { lemma: 'accuracy', pos: 'noun', cefr: 'B1', count: 1, sentences: ['teams who work with high accuracy'] },
      { lemma: 'leverage', pos: 'verb', cefr: 'B2', count: 1, sentences: ['By leveraging these skills'] },
      { lemma: 'significant', pos: 'adj', cefr: 'B2', count: 1, sentences: ['far more significant'] },
      { lemma: 'advantageous', pos: 'adj', cefr: 'B2', count: 1, sentences: ['are more advantageous'] },
      { lemma: 'inconsequential', pos: 'adj', cefr: 'C1', count: 1, sentences: ['is not inconsequential'] }
    ],
    verbForms: [
      { form: 'present simple', with: 'do', cefr: 'A1.0', count: 10 },
      { form: 'present simple', with: 'is / are', cefr: 'A1.0', count: 7 },
      { form: 'infinitive', with: 'to do', cefr: 'A1.0', count: 5, sentences: ['help teams to solve problems', 'try their best to collaborate'] },
      { form: 'gerund simple', with: 'doing', cefr: 'A2.0', count: 4, sentences: ['By leveraging these skills', 'having academic qualifications'] },
      { form: 'modal', with: 'can / must do', cefr: 'A1.5', count: 4, sentences: ['workers must try', 'teams can work'] },
      { form: 'comparative', with: 'more ... than', cefr: 'B1.0', count: 2, sentences: ['far more significant', 'more advantageous'] }
    ],
    clauses: [
      { clause: 'relative clause', with: 'which / that', cefr: 'B1', count: 4, sentences: ['factors which can help', 'increases team performance', 'that reduce their error rates'] },
      { clause: 'relative clause', with: 'who', cefr: 'B1', count: 2, sentences: ['teams who have high teamwork', 'teams who work with high accuracy'] },
      { clause: 'noun clause', with: 'that', cefr: 'B1', count: 3, sentences: ['is that high communication and teamwork skills help', 'showed that companies with high levels'] },
      { clause: 'adverbial clause', with: 'although', cefr: 'B1', count: 1, sentences: ['Although having academic qualifications is not inconsequential'] },
      { clause: 'noun clause', with: 'what', cefr: 'B2', count: 1, sentences: ['what has been mentioned above'] }
    ],
    corrections: { light: LIGHT5, medium: MEDIUM5, deep: DEEP5 }
  };

  window.CORRECTOR_SAMPLES = [S1, S2, S3, S4, S5];
  window.CORRECTOR_SAMPLE = S1;   // back-compat default
})();
