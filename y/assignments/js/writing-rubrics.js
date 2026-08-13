/* ============================================================
   EXAM WRITING RUBRICS - registry
   ------------------------------------------------------------
   One place that describes every writing rubric the app can mark
   against. The corrector, the Cloud Function prompt/schema and
   the teacher assignment form all read from here, so adding an
   exam is a data change - no engine edits.

   IMPORTANT - ORIGINAL WORDING:
   Every criterion name, "what it measures" line and band anchor
   below is written FOR THIS APP. Official band descriptors
   (IELTS, ETS/TOEFL/GRE, CELPIP, PTE) are copyrighted and are
   deliberately NOT reproduced. These are our own plain-English
   equivalents, aligned to the public shape of each exam.

   SHAPE
     id         unique key, stored on assignments + AI calls
     exam       family, used to group the dropdown
     task       which task within the exam
     label      what the teacher sees
     criteria   [{ key, label, what }]  1..n - the ENGINE IS
                CRITERIA-COUNT AGNOSTIC (holistic = one entry)
     scale      { min, max, step, name } the exam's own score scale
     anchors    { high, mid, low } plain-English band anchors
     wordTarget suggested length
     timeMin    exam time allowance
     guidance   one line the AI prompt uses to frame the task

   The three CLASSROOM rubrics (essay / academic / short) are NOT
   here - they live in writing-comment-bank.js with their comment
   banks, and keep the original fixed CC/TA/GR/VO criteria.

   LOADED TWICE: as a browser script (sets window.WRITING_RUBRICS)
   and as a CommonJS module inside functions/. The copy at
   functions/writing-rubrics.js must stay identical - check it with
   `node y/tools/rubric-sync.js` (--fix copies it over).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WRITING_RUBRICS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RUBRICS = {

    /* ---------------- IELTS ---------------- */
    'ielts-gt-t1': {
      exam: 'IELTS', task: 'General Training - Task 1 (letter)',
      label: 'IELTS GT Task 1 - Letter',
      scale: { min: 0, max: 9, step: 0.5, name: 'IELTS band' },
      wordTarget: '150+ words', timeMin: 20,
      guidance: 'A letter written for a real purpose (asking, complaining, thanking, applying). Tone must match the reader, and every bullet in the prompt must be covered.',
      criteria: [
        { key: 'TA', label: 'Task Achievement', what: 'Covers every bullet point, keeps the right purpose, and holds a tone that suits the reader.' },
        { key: 'CC', label: 'Coherence and Cohesion', what: 'Clear paragraphing and linking so the letter reads in a logical order.' },
        { key: 'LR', label: 'Lexical Resource', what: 'Range and precision of vocabulary, including natural letter phrasing.' },
        { key: 'GRA', label: 'Grammatical Range and Accuracy', what: 'Variety of structures and how often errors interrupt the reader.' }
      ],
      anchors: {
        high: 'All bullets fully developed, tone consistent, wide and precise language, errors rare.',
        mid: 'All bullets covered but unevenly; tone mostly right; language adequate; errors noticeable but meaning holds.',
        low: 'Bullets missed or thin, tone inconsistent, limited vocabulary, errors that slow the reader down.'
      }
    },

    'ielts-ac-t1': {
      exam: 'IELTS', task: 'Academic - Task 1 (report)',
      label: 'IELTS Academic Task 1 - Chart/Process report',
      scale: { min: 0, max: 9, step: 0.5, name: 'IELTS band' },
      wordTarget: '150+ words', timeMin: 20,
      guidance: 'An objective report of visual data (graph, table, map or process). No opinions: select the key features and compare them.',
      criteria: [
        { key: 'TA', label: 'Task Achievement', what: 'Gives an overview and reports the key features accurately, with figures used to support.' },
        { key: 'CC', label: 'Coherence and Cohesion', what: 'Logical grouping of data and clear signposting between trends.' },
        { key: 'LR', label: 'Lexical Resource', what: 'Range and accuracy of data-describing language (trend, comparison, proportion).' },
        { key: 'GRA', label: 'Grammatical Range and Accuracy', what: 'Comparative and tense control across varied structures.' }
      ],
      anchors: {
        high: 'Clear overview, well-chosen key features, accurate figures, varied trend language, errors rare.',
        mid: 'Overview present but partial; some features described without comparison; repetitive trend language.',
        low: 'No real overview, mechanical listing of every number, or personal opinion added; frequent errors.'
      }
    },

    'ielts-t2': {
      exam: 'IELTS', task: 'Task 2 (essay)',
      label: 'IELTS Task 2 - Essay',
      scale: { min: 0, max: 9, step: 0.5, name: 'IELTS band' },
      wordTarget: '250+ words', timeMin: 40,
      guidance: 'A discursive essay answering the exact question asked (agree/disagree, discuss both views, problem/solution, two-part question). A clear position must be held throughout.',
      criteria: [
        { key: 'TR', label: 'Task Response', what: 'Answers every part of the question, holds a clear position and develops ideas with support.' },
        { key: 'CC', label: 'Coherence and Cohesion', what: 'Paragraphing, progression of argument and linking that never confuses the reader.' },
        { key: 'LR', label: 'Lexical Resource', what: 'Range, precision and collocation, including topic-specific vocabulary.' },
        { key: 'GRA', label: 'Grammatical Range and Accuracy', what: 'Complex structures used flexibly with control of punctuation.' }
      ],
      anchors: {
        high: 'Fully answers every part, position clear from start to finish, ideas extended with relevant examples, flexible language.',
        mid: 'Answers the question but some parts thin or a position that drifts; ideas asserted more than developed.',
        low: 'Off-topic, memorised chunks, no clear position, or too short to develop anything.'
      }
    },

    /* ---------------- GRE (holistic) ---------------- */
    'gre-issue': {
      exam: 'GRE', task: 'Analyze an Issue',
      label: 'GRE - Analyze an Issue',
      scale: { min: 0, max: 6, step: 0.5, name: 'GRE score' },
      wordTarget: '500-600 words', timeMin: 30,
      guidance: 'Take and defend a position on a general claim, considering the ways the claim may or may not hold. A single holistic judgement of the whole response.',
      criteria: [
        { key: 'HOL', label: 'Overall analytical writing', what: 'One holistic judgement: the clarity of the position, the strength and logic of the reasoning and examples, the organisation, and the fluency and accuracy of the language.' }
      ],
      anchors: {
        high: 'Insightful position, compelling and well-chosen support, tight logical control, skilful sentence variety.',
        mid: 'Competent position with adequate but generic support; reasoning sound yet undeveloped; occasional lapses.',
        low: 'Unclear or shifting position, little or irrelevant support, disorganised, errors that block meaning.'
      }
    },

    'gre-argument': {
      exam: 'GRE', task: 'Analyze an Argument',
      label: 'GRE - Analyze an Argument',
      scale: { min: 0, max: 6, step: 0.5, name: 'GRE score' },
      wordTarget: '500-600 words', timeMin: 30,
      guidance: 'Critique the LOGIC of a given argument. Do not give your own opinion on the topic: identify assumptions and what evidence would strengthen or weaken it.',
      criteria: [
        { key: 'HOL', label: 'Overall analytical writing', what: 'One holistic judgement: how well the response identifies the unstated assumptions, examines the evidence, explains what would make the argument stronger or weaker, and expresses this clearly.' }
      ],
      anchors: {
        high: 'Identifies the key assumptions precisely, explains why each matters, cogent and well-organised critique.',
        mid: 'Finds some assumptions but explains them thinly, or drifts toward personal opinion on the topic.',
        low: 'States agreement/disagreement instead of analysing the logic, or misreads the argument.'
      }
    },

    /* ---------------- TOEFL (holistic) ---------------- */
    'toefl-independent': {
      exam: 'TOEFL', task: 'Independent writing',
      label: 'TOEFL - Independent essay',
      scale: { min: 0, max: 5, step: 1, name: 'TOEFL writing score' },
      wordTarget: '300+ words', timeMin: 30,
      guidance: 'An opinion essay from personal knowledge and experience. Judged as a whole for development, organisation and language use.',
      criteria: [
        { key: 'HOL', label: 'Overall writing quality', what: 'One holistic judgement: how well the essay addresses the task, develops ideas with reasons and examples, stays organised and unified, and uses language accurately and idiomatically.' }
      ],
      anchors: {
        high: 'Well developed with specific reasons and examples, unified and coherent, minor errors only.',
        mid: 'Addresses the task with somewhat developed ideas; connections occasionally unclear; noticeable errors.',
        low: 'Underdeveloped, repetitive, poorly organised, or errors frequent enough to obscure meaning.'
      }
    },

    'toefl-integrated': {
      exam: 'TOEFL', task: 'Integrated writing',
      label: 'TOEFL - Integrated (read + listen)',
      scale: { min: 0, max: 5, step: 1, name: 'TOEFL writing score' },
      wordTarget: '150-225 words', timeMin: 20,
      guidance: 'Summarise the lecture points and explain how they relate to (usually challenge) the reading. Accuracy of the source content matters more than personal opinion - opinions do not belong here.',
      criteria: [
        { key: 'HOL', label: 'Overall writing quality', what: 'One holistic judgement: how accurately and completely the response reports the important lecture points, how clearly it connects them to the reading, and how well the language conveys this.' }
      ],
      anchors: {
        high: 'All key lecture points accurate and clearly tied to the matching reading points; well organised.',
        mid: 'Most points present but one vague, omitted or imprecisely linked to the reading.',
        low: 'Misrepresents the sources, copies the reading, omits the lecture, or adds personal opinion.'
      }
    },

    /* ---------------- CELPIP ---------------- */
    'celpip-t1': {
      exam: 'CELPIP', task: 'Task 1 - Writing an Email',
      label: 'CELPIP Task 1 - Email',
      scale: { min: 1, max: 12, step: 1, name: 'CELPIP level' },
      wordTarget: '150-200 words', timeMin: 27,
      guidance: 'An email for a stated purpose and reader. Every point in the prompt must be handled, with tone matched to the relationship.',
      criteria: [
        { key: 'CON', label: 'Content and Coherence', what: 'Ideas are relevant, complete and ordered so the reader follows without effort.' },
        { key: 'VOC', label: 'Vocabulary', what: 'Word choice is precise and natural for the situation, not repetitive or misused.' },
        { key: 'RDB', label: 'Readability', what: 'Grammar, spelling, punctuation and layout let the message be read smoothly.' },
        { key: 'TSK', label: 'Task Fulfilment', what: 'Purpose, tone and register match the reader and the situation given.' }
      ],
      anchors: {
        high: 'All points fully covered, tone consistently right, precise vocabulary, very few errors.',
        mid: 'All points touched but some thin; tone slips once or twice; errors visible but not blocking.',
        low: 'Points missing, tone wrong for the reader, limited vocabulary, errors that force re-reading.'
      }
    },

    'celpip-t2': {
      exam: 'CELPIP', task: 'Task 2 - Responding to Survey Questions',
      label: 'CELPIP Task 2 - Survey response',
      scale: { min: 1, max: 12, step: 1, name: 'CELPIP level' },
      wordTarget: '150-200 words', timeMin: 27,
      guidance: 'Choose one of the given options and justify it. A clear choice plus concrete reasons matters more than covering both options.',
      criteria: [
        { key: 'CON', label: 'Content and Coherence', what: 'A clear choice supported by developed, relevant reasons in a logical order.' },
        { key: 'VOC', label: 'Vocabulary', what: 'Precise, varied word choice suited to a survey response.' },
        { key: 'RDB', label: 'Readability', what: 'Grammar, spelling and punctuation that keep the response easy to read.' },
        { key: 'TSK', label: 'Task Fulfilment', what: 'Answers the survey question asked, with an appropriate register.' }
      ],
      anchors: {
        high: 'Definite choice, well-developed concrete reasons, natural vocabulary, minimal errors.',
        mid: 'Choice made but reasons generic or unevenly developed; some repetition; some errors.',
        low: 'No clear choice, or reasons asserted without support; frequent errors.'
      }
    },

    /* ---------------- PTE ---------------- */
    'pte-essay': {
      exam: 'PTE Academic', task: 'Write Essay',
      label: 'PTE - Write Essay',
      scale: { min: 0, max: 15, step: 1, name: 'PTE essay points' },
      wordTarget: '200-300 words (hard limit)', timeMin: 20,
      guidance: 'A short argumentative essay scored by machine on separate traits. Length outside 200-300 words scores zero on form, so word count is critical.',
      criteria: [
        { key: 'CONT', label: 'Content', what: 'Deals with the prompt properly: relevant ideas, on topic, nothing invented outside the question.' },
        { key: 'FORM', label: 'Form', what: 'Length is within 200-300 words and written as a single continuous essay (no lists, no all-caps).' },
        { key: 'DSC', label: 'Development, Structure and Coherence', what: 'A clear introduction, developed body and conclusion, with logical progression.' },
        { key: 'GRAM', label: 'Grammar', what: 'Correct and controlled sentence structure.' },
        { key: 'RANGE', label: 'General Linguistic Range', what: 'Ability to express ideas with flexible, varied phrasing rather than one repeated pattern.' },
        { key: 'VOCAB', label: 'Vocabulary Range', what: 'Breadth and appropriacy of word choice.' },
        { key: 'SPELL', label: 'Spelling', what: 'Consistent, correct spelling in one variety of English.' }
      ],
      anchors: {
        high: 'On-topic and well developed, within the word limit, varied structures and vocabulary, spelling clean.',
        mid: 'Adequate ideas and structure; some repetition of phrasing; a few grammar or spelling slips.',
        low: 'Off topic, outside the word limit, list-like or repetitive, frequent grammar and spelling errors.'
      }
    },

    'pte-swt': {
      exam: 'PTE Academic', task: 'Summarize Written Text',
      label: 'PTE - Summarize Written Text',
      scale: { min: 0, max: 7, step: 1, name: 'PTE SWT points' },
      wordTarget: 'ONE sentence, 5-75 words', timeMin: 10,
      guidance: 'Condense a passage into ONE single sentence of 5-75 words. More than one sentence, or breaking the word range, scores zero on form regardless of quality.',
      criteria: [
        { key: 'CONT', label: 'Content', what: 'Captures the main idea and the essential supporting points of the passage, with nothing invented.' },
        { key: 'FORM', label: 'Form', what: 'Exactly one sentence between 5 and 75 words, correctly capitalised and punctuated.' },
        { key: 'GRAM', label: 'Grammar', what: 'The single sentence is grammatically correct, however long it runs.' },
        { key: 'VOCAB', label: 'Vocabulary', what: 'Appropriate word choice, ideally paraphrased rather than copied wholesale.' }
      ],
      anchors: {
        high: 'One well-formed sentence capturing the main idea plus key support, paraphrased, error free.',
        mid: 'One sentence but misses a key point, or leans heavily on copied wording.',
        low: 'More than one sentence, outside the word range, or misses the main idea.'
      }
    }
  };

  // Stable display order (grouped by exam family).
  var ORDER = [
    'ielts-gt-t1', 'ielts-ac-t1', 'ielts-t2',
    'gre-issue', 'gre-argument',
    'toefl-independent', 'toefl-integrated',
    'celpip-t1', 'celpip-t2',
    'pte-essay', 'pte-swt'
  ];

  // The three classroom rubrics keep the original fixed four criteria
  // (their labels + comment banks live in writing-comment-bank.js).
  var CLASSIC = ['CC', 'TA', 'GR', 'VO'];

  // One colour per criterion key, app-wide. Families share a hue so the
  // highlight colours keep meaning across every rubric:
  //   green = content/task   violet = organisation/structure
  //   sky   = grammar        amber  = vocabulary
  var COLORS = {
    CC: '#34d399', TA: '#a78bfa', GR: '#38bdf8', VO: '#fbbf24',
    TR: '#a78bfa', LR: '#fbbf24', GRA: '#38bdf8',
    HOL: '#6366f1',
    CON: '#34d399', VOC: '#fbbf24', RDB: '#38bdf8', TSK: '#a78bfa',
    CONT: '#a78bfa', FORM: '#f472b6', DSC: '#34d399',
    GRAM: '#38bdf8', RANGE: '#22d3ee', VOCAB: '#fbbf24', SPELL: '#fb7185'
  };

  return {
    all: RUBRICS,
    order: ORDER,
    CLASSIC: CLASSIC,
    COLORS: COLORS,
    isExam: function (id) { return !!RUBRICS[id]; },
    get: function (id) { return RUBRICS[id] || null; },
    // Criterion keys for a rubric - THE source of truth for the AI schema
    // and every "by criterion" loop. Unknown / classroom ids fall back to
    // the original four, so nothing that predates exam rubrics changes.
    keys: function (id) {
      var r = RUBRICS[id];
      if (!r) return CLASSIC.slice();
      return r.criteria.map(function (c) { return c.key; });
    },
    // null (not the key) when the rubric is not an exam one, so callers
    // know to fall back to the comment bank's classroom labels.
    label: function (id, critKey) {
      var r = RUBRICS[id];
      if (!r) return null;
      for (var i = 0; i < r.criteria.length; i++) if (r.criteria[i].key === critKey) return r.criteria[i].label;
      return critKey;
    },
    color: function (critKey) { return COLORS[critKey] || '#a78bfa'; },
    // Toolbar hint line: "IELTS band 0-9 · 250+ words · 40 min".
    summary: function (id) {
      var r = RUBRICS[id];
      if (!r) return '';
      var bits = [r.scale.name + ' ' + r.scale.min + '-' + r.scale.max];
      if (r.wordTarget) bits.push(r.wordTarget);
      if (r.timeMin) bits.push(r.timeMin + ' min');
      return bits.join(' · ');
    },
    // Grouped [{exam, items:[{id,label}]}] for building the dropdown.
    grouped: function () {
      var out = [], seen = {};
      ORDER.forEach(function (id) {
        var r = RUBRICS[id]; if (!r) return;
        if (!seen[r.exam]) { seen[r.exam] = { exam: r.exam, items: [] }; out.push(seen[r.exam]); }
        seen[r.exam].items.push({ id: id, label: r.label });
      });
      return out;
    }
  };
});
