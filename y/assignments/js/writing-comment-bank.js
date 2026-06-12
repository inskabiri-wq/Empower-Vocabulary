/* ============================================================
   WRITING COMMENT BANK
   ------------------------------------------------------------
   Pre-written feedback comments, organized by:
       rubric  →  criterion  →  score (0–5)  →  [10 comments]

   Used by the teacher grading view (writing-annotations.js): the
   teacher selects text on a student's essay, picks a criterion +
   score, and these comments appear to choose / mix / edit.

   Criterion keys are the SAME four the grading system already
   stores (TA / CC / GR / VO), but each rubric RELABELS them to
   match its own PDF:
       CC = Organization
       TA = Content / Task Achievement
       GR = Language / Grammatical Accuracy
       VO = Word Choice / Vocabulary

   Score bands (0–5):
       0 No Attempt · 1 Poor · 2 Needs Improvement
       3 Satisfactory · 4 Good · 5 Excellent

   PHASE 1: only the ESSAY rubric bank is filled (240 comments).
   `academic` and `short` are declared empty and get filled once
   the essay flow is confirmed. A missing/empty bank degrades
   gracefully — the teacher just types their own comment.
   ============================================================ */
(function () {
  'use strict';

  const BANDS = ['No Attempt', 'Poor', 'Needs Improvement', 'Satisfactory', 'Good', 'Excellent'];

  // Per-rubric criterion labels (display names). Internal keys stay
  // TA/CC/GR/VO so nothing in the existing grading/storage changes.
  const RUBRIC_META = {
    essay: {
      label: 'Essay (Int / Upper-Int / Pre-Adv)',
      criteria: { CC: 'Organization', TA: 'Content', GR: 'Language Accuracy', VO: 'Word Choice' }
    },
    academic: {
      label: 'Academic paragraph (Pre-Int / Int)',
      criteria: { CC: 'Organization', TA: 'Content', GR: 'Language Accuracy', VO: 'Word Choice' }
    },
    short: {
      label: 'Short paragraph (Elementary / Pre-Int)',
      criteria: { CC: 'Organization', TA: 'Task Achievement', GR: 'Grammatical Accuracy', VO: 'Word Choice' }
    }
  };

  // ── ESSAY rubric bank ──────────────────────────────────────
  const essay = {
    // CC = Organization
    CC: {
      5: [
        "Excellent organization — every idea connects smoothly and the essay flows from start to finish.",
        "Your introduction, body paragraphs, and conclusion are all clear, complete, and well balanced.",
        "The thesis statement is sharp and guides the whole essay effectively.",
        "Every paragraph opens with a clear topic sentence — very easy to follow.",
        "You use a strong range of target connectors to link ideas naturally.",
        "The order of ideas is logical throughout; nothing feels out of place.",
        "Beautifully structured — the reader always knows where the argument is going.",
        "Cohesion is excellent: each paragraph leads naturally into the next.",
        "A model of clear academic structure — intro sets up, body develops, conclusion closes.",
        "Outstanding flow; your linking words are varied and used accurately."
      ],
      4: [
        "Good organization — most ideas connect well and the essay reads smoothly.",
        "Clear introduction, body, and conclusion, with only minor lapses in flow.",
        "Your thesis statement is present and mostly clear.",
        "Most paragraphs have clear topic sentences.",
        "You use many target connectors well; just a few more would tighten the links.",
        "The overall structure is solid; a couple of transitions could be smoother.",
        "Ideas are mostly well ordered and easy to follow.",
        "Strong paragraphing — each one focuses on a single idea.",
        "Good flow overall, with one or two places where the connection could be clearer.",
        "The argument is well structured; refine the weakest transition to reach excellent."
      ],
      3: [
        "Satisfactory organization — some ideas connect, but the flow is uneven in places.",
        "Your intro, body, and conclusion are present but only somewhat clear or complete.",
        "The thesis statement is weak or overly general; the essay still shows its main purpose.",
        "Some paragraphs have clear topic sentences, but others are missing one.",
        "You use some target connectors, though not always consistently.",
        "Some events/ideas are ordered logically; others jump around.",
        "The structure is recognisable but needs tighter links between paragraphs.",
        "Add a clearer topic sentence to each paragraph to guide the reader.",
        "Work on connecting your ideas so the essay flows as one piece.",
        "A clearer thesis would pull the whole essay together."
      ],
      2: [
        "Organization needs improvement — only a few ideas are connected.",
        "The introduction, body, or conclusion is incomplete.",
        "The thesis statement is vague, unclear, or missing.",
        "Few paragraphs have topic sentences, and those that do are vague or underdeveloped.",
        "Very few target connectors are used, so ideas feel separate.",
        "The order of ideas is hard to follow in several places.",
        "Try planning your paragraphs before writing so each has one clear idea.",
        "Add linking words (however, therefore, for example) to join your ideas.",
        "Give your essay a clear beginning, middle, and end.",
        "Start each paragraph with a sentence that tells the reader its main point."
      ],
      1: [
        "Organization is poor — ideas are mostly disconnected.",
        "Introduction, body, and conclusion are largely missing.",
        "The thesis statement is absent or extremely unclear.",
        "Topic sentences are mostly missing.",
        "Linking words are largely absent, so the text is hard to follow.",
        "There is little or no logical order to the ideas.",
        "Begin by planning three parts: an intro, a middle, and a conclusion.",
        "Each paragraph needs a clear first sentence stating its idea.",
        "Practise using basic connectors to join your sentences.",
        "Group related ideas into paragraphs rather than one long block."
      ],
      0: [
        "No organization is shown — ideas are random or missing.",
        "There are no paragraphs and no order of events.",
        "No thesis statement is present.",
        "No topic sentences are used.",
        "No linking words connect the ideas.",
        "The text is off-topic.",
        "Please structure your writing into an introduction, body, and conclusion.",
        "Start with a plan: what is your main idea, and what supports it?",
        "Organise your points into separate paragraphs.",
        "Re-attempt the task with a clear beginning, middle, and end."
      ]
    },
    // TA = Content
    TA: {
      5: [
        "Excellent content — your ideas are fully developed, elaborated, and entirely relevant.",
        "All of your content directly supports the topic.",
        "There's no unnecessary repetition; the writing stays focused throughout.",
        "Your ideas are interesting and genuinely engaging to read.",
        "You answer the task completely and go beyond the minimum.",
        "Every example clearly strengthens your argument.",
        "The depth of development here is impressive for this level.",
        "You explore the topic from more than one angle — well done.",
        "Strong, well-supported reasoning from start to finish.",
        "A complete, thoughtful response that fully addresses the prompt."
      ],
      4: [
        "Good content — most of your ideas are well developed and relevant.",
        "Most of your content supports the topic clearly.",
        "Minor repetition appears but doesn't distract from the quality.",
        "You address the task well; a little more detail in one area would lift it further.",
        "Your examples mostly support your points effectively.",
        "Solid development of ideas — add one more supporting detail to deepen it.",
        "The response is mostly complete and on-topic.",
        "Good engagement with the prompt; expand your weakest point.",
        "Most paragraphs develop their idea fully.",
        "A strong response — push one idea further to reach excellent."
      ],
      3: [
        "Satisfactory content — some ideas are developed and partly relevant.",
        "Some of your content supports the topic; some drifts away from it.",
        "Occasional repetition slightly affects clarity or variety.",
        "You address the task, but several ideas need more development.",
        "Add specific examples to support your general statements.",
        "Some points are clear, but others are left underexplained.",
        "Keep each paragraph focused on the topic to avoid drifting.",
        "Develop your ideas with reasons and examples, not just statements.",
        "The response is partially complete — a few ideas feel unfinished.",
        "Good start; explain *why* and *how* to develop your points."
      ],
      2: [
        "Content needs improvement — few ideas are developed.",
        "Your content is limited or only partly relevant to the topic.",
        "Repetition is noticeable and affects development.",
        "Several ideas are mentioned but not explained.",
        "Add examples and reasons to support each point.",
        "Stay closer to the topic — some content drifts off task.",
        "Try to write more about each idea instead of listing them.",
        "Plan two or three clear points and develop each one.",
        "The response is incomplete; some parts of the task are missing.",
        "Explain your ideas fully so the reader understands your meaning."
      ],
      1: [
        "Content is poor — very few ideas are developed.",
        "Most of the content is irrelevant to the topic.",
        "Frequent repetition makes the writing unclear or monotonous.",
        "The task is barely addressed.",
        "Focus on the question and write directly about it.",
        "Add real examples to support your ideas.",
        "Each point needs at least one supporting sentence.",
        "Re-read the prompt and make sure every sentence relates to it.",
        "Develop your ideas — one sentence per idea is not enough.",
        "Plan your main points before you write."
      ],
      0: [
        "No content supports the topic.",
        "The text is off-topic, missing, or incomprehensible.",
        "The task has not been addressed.",
        "No relevant ideas are present.",
        "Please write a response that answers the prompt directly.",
        "Start by noting two or three ideas linked to the question.",
        "The writing does not relate to the task given.",
        "Re-attempt the task, keeping every sentence on topic.",
        "There is not enough content to assess.",
        "Read the prompt carefully and write about exactly what it asks."
      ]
    },
    // GR = Language Accuracy
    GR: {
      5: [
        "Excellent grammar — level-appropriate structures used accurately and consistently.",
        "Great variety in sentence length and type.",
        "Punctuation and capitalization are correct throughout.",
        "All sentences are complete; any errors are tiny and don't affect meaning.",
        "Your control of complex sentences is impressive for this level.",
        "Verb tenses are accurate and consistent across the whole essay.",
        "Subject–verb agreement is correct everywhere.",
        "Very polished writing — almost error-free.",
        "You handle a wide range of structures with confidence.",
        "Clean, accurate grammar that lets your ideas shine."
      ],
      4: [
        "Good grammar — mostly accurate, with only very minor mistakes that don't affect meaning.",
        "You use many different sentence lengths and types.",
        "Very few punctuation or capitalization errors.",
        "Most sentences are complete and your meaning is clear.",
        "A few small slips with tense/agreement — easy to fix.",
        "Strong control overall; proofread to catch the last few errors.",
        "Good range of structures; watch one recurring small mistake.",
        "Mostly accurate — meaning is never in doubt.",
        "Solid grammar; vary one or two repeated sentence patterns to lift it.",
        "Nearly there — a careful re-read would reach excellent."
      ],
      3: [
        "Satisfactory grammar — some noticeable mistakes, but meaning is mostly clear.",
        "Several sentence lengths and types are used.",
        "Some punctuation or capitalization errors appear.",
        "A few sentences are incomplete, though the text is mostly understandable.",
        "Check your verb tenses — they shift in places.",
        "Watch subject–verb agreement (he go → he goes).",
        "Some run-on or fragment sentences need fixing.",
        "Capitalize the start of every sentence and proper nouns.",
        "Proofread for the small errors that add up.",
        "Good effort; focus on completing every sentence."
      ],
      2: [
        "Grammar needs improvement — frequent mistakes in sentence structure.",
        "There's little variety in sentence length or type.",
        "Multiple punctuation and capitalization errors.",
        "Few complete sentences; meaning is sometimes unclear.",
        "Subject–verb agreement is often incorrect.",
        "Verb tenses are inconsistent and need attention.",
        "Try writing shorter, complete sentences first, then build up.",
        "Review basic punctuation: full stops, commas, and capitals.",
        "Read your work aloud to catch incomplete sentences.",
        "Practise one tense at a time until it's secure."
      ],
      1: [
        "Grammar is poor — mistakes hinder understanding.",
        "Sentence length and type variety is very limited.",
        "Many punctuation and capitalization errors.",
        "Most sentences are incomplete; meaning is often unclear.",
        "Subject–verb agreement is rarely correct.",
        "Focus on writing one complete, correct sentence at a time.",
        "Review where sentences begin and end.",
        "Practise the present simple and past simple tenses.",
        "Use a capital letter to start every sentence.",
        "Build accuracy with short sentences before attempting longer ones."
      ],
      0: [
        "No correct sentence structures are present.",
        "Subject–verb agreement, punctuation, and capitalization are all incorrect.",
        "The text is incomprehensible.",
        "Grammar errors prevent any communication of meaning.",
        "There is no sentence variety.",
        "Please write simple, complete sentences and check each one.",
        "Start with the basics: a subject, a verb, and a full stop.",
        "Re-attempt using short, clear sentences.",
        "Review how to form a basic English sentence.",
        "There is not enough accurate language to assess."
      ]
    },
    // VO = Word Choice
    VO: {
      5: [
        "Excellent vocabulary — outstanding range that strongly supports the topic.",
        "Your words are varied, precise, and used accurately.",
        "Spelling is correct; any errors are tiny and don't affect meaning.",
        "You use topic-specific vocabulary confidently and naturally.",
        "Word choice adds real colour and precision to your writing.",
        "Impressive lexical range for this level.",
        "You avoid repetition by using strong synonyms.",
        "Every word earns its place — very economical and precise.",
        "Sophisticated, accurate vocabulary throughout.",
        "Your collocations and phrasing sound natural and fluent."
      ],
      4: [
        "Good vocabulary — a strong range that supports the topic.",
        "Your words are mostly varied and accurate.",
        "Most words are spelled correctly; minor errors don't affect meaning.",
        "Good use of topic vocabulary; reach for one or two more precise words.",
        "Word choice is effective, with only occasional repetition.",
        "Solid range; replace the weakest repeated word with a synonym.",
        "Mostly precise — a few word choices could be sharper.",
        "Good control of vocabulary; proofread spelling to lift it.",
        "Strong lexical variety; one more topic-specific term would help.",
        "Nearly excellent — vary one repeated word to get there."
      ],
      3: [
        "Satisfactory vocabulary — partially supports the topic; some words are repetitive or inexact.",
        "Your words are sometimes varied; there are some word-choice errors.",
        "Several spelling errors appear, though meaning is mostly clear.",
        "Try using more topic-specific vocabulary.",
        "Replace repeated everyday words (good, nice, big) with stronger ones.",
        "Some word choices don't quite fit the meaning you intend.",
        "Build a list of topic words before writing.",
        "Check spelling of the words you use most often.",
        "Aim for more precise verbs and nouns.",
        "Good base vocabulary; widen your range with synonyms."
      ],
      2: [
        "Vocabulary needs improvement — very limited and often repetitive.",
        "Few words are varied or precise; there are many word-choice errors.",
        "Frequent spelling errors make the meaning sometimes unclear.",
        "Many words are inappropriate for the topic.",
        "Learn and use a small set of key topic words.",
        "Try not to repeat the same word in every sentence.",
        "Use a dictionary to check word meaning and spelling.",
        "Practise common collocations (make a decision, take a break).",
        "Replace very general words with more specific ones.",
        "Build vocabulary by reading short texts on the topic."
      ],
      1: [
        "Vocabulary is poor — extremely limited and repetitive.",
        "Words are often inaccurate or inappropriate.",
        "Many spelling or word-choice errors make meaning hard to follow.",
        "The same few words are used over and over.",
        "Focus on learning the most common words for this topic.",
        "Check spelling carefully before submitting.",
        "Use simple, correct words you know well.",
        "Keep a vocabulary notebook and review it.",
        "Build from basic, accurate vocabulary upward.",
        "Read more to grow the range of words you can use."
      ],
      0: [
        "Vocabulary is missing, inappropriate, or incomprehensible.",
        "Words are mostly incorrect or absent; the text cannot be understood.",
        "There is not enough usable vocabulary to assess.",
        "Word choice does not communicate meaning.",
        "Please use simple, correct words to express your ideas.",
        "Start with basic topic words you already know.",
        "Re-attempt using clear, everyday vocabulary.",
        "Spelling and word choice prevent understanding.",
        "Learn a few key words for the topic and use them.",
        "Build a short list of correct words before rewriting."
      ]
    }
  };

  // ── SHORT-PARAGRAPH rubric bank (Elementary / Pre-Int) ─────
  // Criteria: CC=Organization, TA=Task Achievement, GR=Grammatical
  // Accuracy, VO=Word Choice. Written from the short-paragraph rubric
  // descriptors (simpler language, paragraph-length expectations).
  const short = {
    CC: {
      5: [
        "Excellent — all your ideas connect and the paragraph flows well.",
        "Your sentences are coherent and easy to follow from start to finish.",
        "Great use of linkers (and, but, then, because) to join ideas.",
        "The order of your ideas is clear and logical.",
        "Everything fits together — a well-organized paragraph.",
        "Smooth flow throughout; one idea leads naturally to the next.",
        "You connected every idea clearly. Well done.",
        "Clear, organized writing with good linking words.",
        "Your paragraph reads as one connected piece.",
        "Ideas are fully linked — very easy to read."
      ],
      4: [
        "Good — most of your ideas connect and the paragraph mostly flows.",
        "Flow is mostly clear; you use many linkers well.",
        "Just a few minor places where ideas could connect better.",
        "Most sentences follow each other logically.",
        "Nearly there — link the one or two ideas that feel separate.",
        "Good organization; add a linker between your last two ideas.",
        "Mostly coherent — a small jump in the middle to smooth out.",
        "Strong order of ideas with only minor gaps.",
        "Good use of connectors; one more would tighten it.",
        "Well organized overall; polish the weakest link to reach excellent."
      ],
      3: [
        "Some of your ideas connect, but the flow is uneven.",
        "You order some ideas, but others jump around.",
        "You use some linkers, though not always consistently.",
        "Add linking words so your ideas join more smoothly.",
        "Put your ideas in a clearer order.",
        "Some sentences feel separate — connect them with and/but/because.",
        "The paragraph is understandable but needs tighter links.",
        "Group related ideas together so they flow.",
        "Use a linker at the start of your next idea.",
        "Good start; work on connecting each sentence to the next."
      ],
      2: [
        "Few of your ideas connect to each other.",
        "The order of your ideas is unclear.",
        "Very few linkers are used, so ideas feel separate.",
        "Try to join your sentences with simple linkers (and, but, then).",
        "Put your ideas in order before you write.",
        "Connections between ideas are often unclear.",
        "Each sentence stands alone — link them together.",
        "Plan the order of your ideas first.",
        "Add words like 'because' and 'so' to connect ideas.",
        "Practise joining two short sentences into one."
      ],
      1: [
        "Your ideas are mostly disconnected.",
        "There is no clear order to your ideas.",
        "Linkers are almost completely missing, so the text is hard to follow.",
        "Start by writing your ideas in a simple order.",
        "Use 'and', 'but', and 'then' to join sentences.",
        "Each idea needs to connect to the one before it.",
        "Plan two or three ideas and put them in order.",
        "The paragraph is difficult to follow — connect your ideas.",
        "Try writing short, linked sentences.",
        "Group your sentences so they belong together."
      ],
      0: [
        "Your ideas are random or missing.",
        "There is no order to the writing.",
        "No linkers are used to connect ideas.",
        "The writing is off-topic.",
        "Please write your ideas in a clear order.",
        "Start with one idea, then add a connected one.",
        "Use simple linking words to join sentences.",
        "Re-attempt the task with connected ideas.",
        "Organise your sentences into one paragraph about the topic.",
        "Plan what to write before you begin."
      ]
    },
    TA: {
      5: [
        "Excellent — a fully developed response that completely addresses the task.",
        "All of your content supports the task.",
        "Your paragraph is the expected length.",
        "You answered the question fully and clearly.",
        "Every sentence is relevant to the topic.",
        "Complete and focused — exactly what the task asked for.",
        "You developed your idea fully with good detail.",
        "Strong, on-task response from start to finish.",
        "No off-topic content — well done staying focused.",
        "A complete answer of the right length."
      ],
      4: [
        "Good — a mostly complete response.",
        "Most of your content is relevant and supportive.",
        "Your paragraph is within or very close to the expected length.",
        "You address the task well; add one more detail to finish it.",
        "Most sentences support the topic.",
        "Nearly complete — develop your last idea a little more.",
        "Good focus on the task with only minor gaps.",
        "Add one supporting sentence to make it fully complete.",
        "Mostly on-task; trim the one sentence that drifts.",
        "A solid response — a little more detail would lift it."
      ],
      3: [
        "Partially complete — some content addresses the task.",
        "There is some repetition or minor off-topic content.",
        "Your paragraph is shorter than expected.",
        "Add more detail to fully answer the task.",
        "Some sentences support the topic; others drift away.",
        "Develop your ideas with examples or reasons.",
        "Write a little more to reach the expected length.",
        "Keep every sentence about the topic.",
        "Good start; explain your idea more fully.",
        "Avoid repeating the same idea."
      ],
      2: [
        "Limited response — very little content is relevant.",
        "Your paragraph is noticeably shorter than expected.",
        "Most of the writing does not yet address the task.",
        "Write more about the topic.",
        "Add examples and reasons to support your idea.",
        "Focus on what the task asks and write about it.",
        "Develop at least one clear idea about the topic.",
        "Much of the content is off-task — stay on topic.",
        "Plan your idea before writing, then add detail.",
        "Try to write a full paragraph about the topic."
      ],
      1: [
        "Barely addressed — most ideas are irrelevant.",
        "Your text is far below the expected length.",
        "Very little relates to the task.",
        "Read the task again and write directly about it.",
        "Write more sentences about the topic.",
        "Add at least one relevant idea with detail.",
        "Most of this is off-topic — focus on the question.",
        "Start with one idea that answers the task.",
        "Develop your writing with reasons or examples.",
        "Build a full paragraph on the given topic."
      ],
      0: [
        "The task has not been addressed.",
        "The content is off-topic, missing, or hard to understand.",
        "The text is entirely absent.",
        "Please write a paragraph that answers the task.",
        "Read the topic and write about exactly that.",
        "Start with one sentence about the task.",
        "There is not enough relevant content to assess.",
        "Re-attempt the task, staying on topic.",
        "Write your ideas about the given subject.",
        "Make sure your writing matches the task."
      ]
    },
    GR: {
      5: [
        "Excellent — you use level-appropriate structures correctly and consistently.",
        "Subject–verb agreement is correct throughout.",
        "Punctuation and capitalization are accurate.",
        "Any errors are very minor and meaning is always clear.",
        "Very clean, accurate sentences.",
        "You control your grammar confidently.",
        "All sentences are complete and correct.",
        "Great accuracy for this level.",
        "Tenses are used correctly throughout.",
        "Almost error-free — well done."
      ],
      4: [
        "Good — mostly correct sentence structures.",
        "Subject–verb agreement is mostly correct.",
        "Only minor punctuation or capitalization errors.",
        "Minor errors, but meaning stays clear.",
        "Proofread to catch the last few small mistakes.",
        "Strong control; watch one repeated error.",
        "Most sentences are complete and accurate.",
        "A careful re-read would make this excellent.",
        "Good grammar; check your capital letters.",
        "Nearly there — fix a couple of small slips."
      ],
      3: [
        "Occasional errors in sentence structure.",
        "Some subject–verb agreement errors (he go → he goes).",
        "Some punctuation or capitalization errors.",
        "Noticeable errors, but the text is mostly understandable.",
        "Check that each sentence is complete.",
        "Watch your verb tenses.",
        "Capitalize the first word of every sentence.",
        "Proofread for small mistakes before submitting.",
        "Read your work aloud to find errors.",
        "Good effort; focus on subject–verb agreement."
      ],
      2: [
        "Frequent errors in sentence structure.",
        "Subject–verb agreement is often incorrect.",
        "Many punctuation and capitalization errors.",
        "Meaning is sometimes unclear because of errors.",
        "Write short, complete sentences first.",
        "Review where sentences start and end.",
        "Practise the present and past simple tenses.",
        "Use capital letters and full stops correctly.",
        "Check each sentence has a subject and a verb.",
        "Read aloud to catch mistakes."
      ],
      1: [
        "Sentences are frequently incomplete or incorrect.",
        "Subject–verb agreement is rarely correct.",
        "Frequent punctuation and capitalization errors.",
        "Major errors make the text difficult to understand.",
        "Focus on writing one correct sentence at a time.",
        "Every sentence needs a subject and a verb.",
        "Start sentences with a capital letter, end with a full stop.",
        "Practise simple sentences before longer ones.",
        "Review basic sentence structure.",
        "Build accuracy step by step."
      ],
      0: [
        "No correct sentence structures are used.",
        "Subject–verb agreement, punctuation, and capitalization are all incorrect.",
        "The text is incomprehensible.",
        "Grammar errors prevent understanding.",
        "Please write simple, complete sentences.",
        "Start with: subject + verb + full stop.",
        "Review how to build a basic sentence.",
        "Re-attempt using short, clear sentences.",
        "There is not enough accurate language to assess.",
        "Practise one correct sentence at a time."
      ]
    },
    VO: {
      5: [
        "Excellent — a wide vocabulary range, fluent and flexible.",
        "You use the target words accurately.",
        "Spelling is mostly correct with very few errors.",
        "Strong, precise word choice.",
        "Great variety of vocabulary for this level.",
        "You avoid repetition with good word choices.",
        "Topic words are used naturally and correctly.",
        "Confident, accurate vocabulary throughout.",
        "Words are well chosen and clearly spelled.",
        "Excellent control of vocabulary."
      ],
      4: [
        "Good — adequate vocabulary for the task.",
        "Some target words are used accurately.",
        "Only minor spelling errors; meaning is usually clear.",
        "Try one or two more topic-specific words.",
        "Good word choice with a little repetition.",
        "Replace the weakest repeated word with a synonym.",
        "Mostly accurate; proofread your spelling.",
        "Solid vocabulary; reach for one stronger word.",
        "Good range; one more target word would help.",
        "Nearly excellent — vary a repeated word."
      ],
      3: [
        "Limited vocabulary.",
        "Some errors in spelling or word choice.",
        "Meaning is mostly clear.",
        "Try to use more topic words.",
        "Replace simple words (good, nice) with stronger ones.",
        "Check the spelling of your common words.",
        "Some words don't quite fit — choose more carefully.",
        "Build a list of topic words before writing.",
        "Aim for more precise words.",
        "Good base; widen your vocabulary with synonyms."
      ],
      2: [
        "Very limited vocabulary.",
        "Repetition or incorrect target words.",
        "Spelling errors sometimes make meaning unclear.",
        "Learn a few key words for the topic.",
        "Try not to repeat the same word.",
        "Use a dictionary to check spelling.",
        "Replace general words with specific ones.",
        "Practise the target vocabulary.",
        "Read short texts to grow your word range.",
        "Choose words that fit the topic."
      ],
      1: [
        "Vocabulary is mostly incorrect or missing.",
        "Spelling is mostly incorrect.",
        "The text is hard to understand.",
        "Focus on a few correct, simple words.",
        "Check spelling carefully.",
        "Use words you know well and spell correctly.",
        "Keep a vocabulary notebook.",
        "Learn the key words for this topic.",
        "Build from basic, correct vocabulary.",
        "Read more to grow your vocabulary."
      ],
      0: [
        "Vocabulary is insufficient or incorrect.",
        "Spelling is incomprehensible.",
        "Meaning cannot be understood.",
        "Please use simple, correct words.",
        "Start with basic topic words you know.",
        "Re-attempt using clear, everyday words.",
        "Word choice does not communicate meaning.",
        "Learn a few key words and use them.",
        "Spell your words carefully.",
        "Build a short list of correct words first."
      ]
    }
  };

  // ── ACADEMIC-PARAGRAPH rubric bank (Pre-Int / Int) ─────────
  // Criteria: CC=Organization, TA=Content, GR=Language Accuracy,
  // VO=Word Choice. Paragraph-level (topic sentence / supporting
  // sentences / concluding sentence / linkers) — between the short
  // paragraph and the multi-paragraph essay.
  const academic = {
    CC: {
      5: [
        "Excellent — a clear topic sentence, well-developed supporting sentences, and a strong concluding sentence.",
        "All ideas connect smoothly with effective linkers.",
        "The paragraph flows logically from start to finish.",
        "Your topic sentence clearly states the main idea.",
        "Supporting sentences are in a logical order.",
        "A well-structured academic paragraph.",
        "Excellent cohesion — every sentence links to the next.",
        "Clear beginning, middle, and end within the paragraph.",
        "Strong, varied connectors used accurately.",
        "Beautifully organized for this level."
      ],
      4: [
        "Good — clear topic sentence and mostly logical supporting sentences.",
        "Most ideas connect well with many linkers.",
        "Only minor lapses in the flow.",
        "Your concluding sentence is present and mostly effective.",
        "Most sentences follow a logical order.",
        "Good structure; smooth one transition to improve it.",
        "Mostly cohesive — link the one idea that feels separate.",
        "Good topic sentence; tighten the ending.",
        "Strong organization with small gaps.",
        "Add one connector to reach excellent."
      ],
      3: [
        "Satisfactory — a topic sentence is present but could be clearer.",
        "Some supporting sentences connect; others jump around.",
        "Some linkers are used, but not consistently.",
        "Your concluding sentence is weak or missing.",
        "Put your supporting sentences in a clearer order.",
        "Add linkers to join your ideas.",
        "The paragraph is understandable but needs tighter links.",
        "Make your topic sentence state the main idea clearly.",
        "End with a sentence that sums up your idea.",
        "Connect each supporting sentence to the topic."
      ],
      2: [
        "Organization needs improvement — the topic sentence is unclear or missing.",
        "Few supporting sentences connect to each other.",
        "Few linkers are used, so ideas feel separate.",
        "There is no clear concluding sentence.",
        "Start with a clear topic sentence stating your main idea.",
        "Add supporting sentences in a logical order.",
        "Use linkers (however, for example, also) to join ideas.",
        "End your paragraph with a concluding sentence.",
        "Plan your paragraph before writing.",
        "Each sentence should support the topic sentence."
      ],
      1: [
        "Poor organization — ideas are mostly disconnected.",
        "There is no clear topic or concluding sentence.",
        "Linkers are largely absent, so the paragraph is hard to follow.",
        "Supporting sentences are not in order.",
        "Begin with a topic sentence that states your main idea.",
        "Add two or three supporting sentences.",
        "Use simple linkers to connect your ideas.",
        "Finish with a concluding sentence.",
        "Plan the order of your sentences first.",
        "Group your sentences into one focused paragraph."
      ],
      0: [
        "No organization — ideas are random or missing.",
        "There is no topic sentence, order, or linkers.",
        "The writing is off-topic.",
        "Please write a paragraph with a topic sentence, supporting sentences, and a conclusion.",
        "Start by stating your main idea in one sentence.",
        "Add sentences that support that idea, in order.",
        "Use linkers to join your ideas.",
        "Re-attempt with a clear paragraph structure.",
        "Plan your main idea and supporting points first.",
        "Organise your sentences around one topic."
      ]
    },
    TA: {
      5: [
        "Excellent — your ideas are fully developed and entirely relevant.",
        "All content supports the topic of the paragraph.",
        "No unnecessary repetition; the writing stays focused.",
        "Your idea is explained with strong detail and examples.",
        "Every sentence adds something to the topic.",
        "A complete, well-developed paragraph.",
        "You support your main idea convincingly.",
        "Interesting and fully on-topic.",
        "Good depth of development for this level.",
        "Thorough and relevant from start to finish."
      ],
      4: [
        "Good — most ideas are well developed and relevant.",
        "Most content supports the topic.",
        "Minor repetition appears but doesn't distract.",
        "Add one more supporting detail to fully develop it.",
        "Most sentences are relevant and clear.",
        "Solid development; expand your weakest point.",
        "Mostly complete — one idea needs more detail.",
        "Good support for your main idea.",
        "On-topic with only small gaps.",
        "A strong paragraph — push one idea further."
      ],
      3: [
        "Satisfactory — some ideas are developed and partly relevant.",
        "Some content supports the topic; some drifts.",
        "Occasional repetition affects clarity.",
        "Develop your ideas with reasons and examples.",
        "Some points need more explanation.",
        "Keep every sentence on the topic.",
        "Add detail to support your main idea.",
        "Good start; explain why and how.",
        "A few ideas feel unfinished.",
        "Support your topic sentence more fully."
      ],
      2: [
        "Content needs improvement — few ideas are developed.",
        "Content is limited or only partly relevant.",
        "Repetition is noticeable.",
        "Add examples and reasons for each point.",
        "Stay closer to the topic.",
        "Write more about each idea.",
        "Develop one clear idea fully.",
        "Some content is off-topic.",
        "Plan your supporting points before writing.",
        "Explain your idea so the reader understands."
      ],
      1: [
        "Poor — very few ideas are developed.",
        "Most content is irrelevant.",
        "Frequent repetition makes it unclear.",
        "The topic is barely addressed.",
        "Write directly about the topic.",
        "Add real examples to support your idea.",
        "Each point needs a supporting sentence.",
        "Re-read the topic and stay on it.",
        "Develop your idea with more than one sentence.",
        "Plan your main point before writing."
      ],
      0: [
        "No content supports the topic.",
        "The text is off-topic, missing, or incomprehensible.",
        "The task has not been addressed.",
        "Please write a paragraph about the topic.",
        "Note two or three ideas linked to the topic first.",
        "The writing does not relate to the task.",
        "Re-attempt, keeping every sentence on topic.",
        "There is not enough content to assess.",
        "Read the topic and write about exactly that.",
        "Support one clear main idea."
      ]
    },
    GR: {
      5: [
        "Excellent — level-appropriate grammar used accurately and consistently.",
        "Good variety in sentence length and type.",
        "Correct punctuation and capitalization.",
        "All sentences complete; any errors are tiny.",
        "Subject–verb agreement is correct throughout.",
        "Tenses are accurate and consistent.",
        "Very clean, accurate writing.",
        "Strong control of sentence structure.",
        "Almost error-free for this level.",
        "Accurate grammar that lets your ideas shine."
      ],
      4: [
        "Good — mostly accurate, with only minor mistakes.",
        "Several sentence lengths and types.",
        "Very few punctuation or capitalization errors.",
        "Most sentences are complete and clear.",
        "A few small tense/agreement slips to fix.",
        "Strong control; proofread for the last errors.",
        "Watch one recurring small mistake.",
        "Mostly accurate — meaning is never unclear.",
        "Vary one repeated sentence pattern.",
        "A careful re-read would make this excellent."
      ],
      3: [
        "Satisfactory — some noticeable mistakes, but meaning is mostly clear.",
        "Some punctuation or capitalization errors.",
        "Some sentences are incomplete.",
        "Check your verb tenses for consistency.",
        "Watch subject–verb agreement.",
        "Fix run-on or fragment sentences.",
        "Capitalize sentence beginnings and proper nouns.",
        "Proofread for the small errors that add up.",
        "Some sentence structures need attention.",
        "Good effort; complete every sentence."
      ],
      2: [
        "Needs improvement — frequent grammar mistakes.",
        "Little variety in sentence length or type.",
        "Multiple punctuation and capitalization errors.",
        "Subject–verb agreement is often incorrect.",
        "Some sentences are incomplete; meaning sometimes unclear.",
        "Write shorter, complete sentences first.",
        "Review basic punctuation and capitals.",
        "Practise one tense until it's secure.",
        "Read aloud to catch incomplete sentences.",
        "Check each sentence has a subject and a verb."
      ],
      1: [
        "Poor — grammar mistakes hinder understanding.",
        "Very limited sentence variety.",
        "Many punctuation and capitalization errors.",
        "Most sentences are incomplete; meaning often unclear.",
        "Subject–verb agreement is rarely correct.",
        "Focus on one correct sentence at a time.",
        "Review where sentences begin and end.",
        "Practise the present and past simple tenses.",
        "Start each sentence with a capital letter.",
        "Build accuracy with short sentences."
      ],
      0: [
        "No correct sentence structures.",
        "Agreement, punctuation, and capitalization are all incorrect.",
        "Grammar errors prevent communication.",
        "The text is incomprehensible.",
        "Please write simple, complete sentences.",
        "Start with subject + verb + full stop.",
        "Review how to build a basic sentence.",
        "Re-attempt using short, clear sentences.",
        "There is not enough accurate language to assess.",
        "Practise one correct sentence at a time."
      ]
    },
    VO: {
      5: [
        "Excellent — a strong vocabulary range that supports the topic.",
        "Words are varied, precise, and accurate.",
        "Spelling is correct; any errors are tiny.",
        "You use topic vocabulary confidently.",
        "Precise word choice adds clarity.",
        "Good lexical range for this level.",
        "You avoid repetition with synonyms.",
        "Accurate, well-chosen vocabulary throughout.",
        "Natural phrasing and collocations.",
        "Strong, accurate word choice."
      ],
      4: [
        "Good — a solid vocabulary range supporting the topic.",
        "Words are mostly varied and accurate.",
        "Most words spelled correctly; minor errors only.",
        "Reach for one or two more precise words.",
        "Effective word choice with little repetition.",
        "Replace the weakest repeated word with a synonym.",
        "Mostly precise; proofread spelling.",
        "One more topic-specific term would help.",
        "Strong range with small gaps.",
        "Vary one repeated word to reach excellent."
      ],
      3: [
        "Satisfactory — vocabulary partly supports the topic; some words repetitive or inexact.",
        "Some word-choice errors appear.",
        "Several spelling errors, but meaning mostly clear.",
        "Use more topic-specific vocabulary.",
        "Replace everyday words with stronger ones.",
        "Some words don't quite fit your meaning.",
        "Build a topic word list before writing.",
        "Check spelling of your most-used words.",
        "Aim for more precise verbs and nouns.",
        "Widen your range with synonyms."
      ],
      2: [
        "Needs improvement — vocabulary is very limited and repetitive.",
        "Many word-choice errors.",
        "Frequent spelling errors make meaning unclear.",
        "Many words are inappropriate for the topic.",
        "Learn a small set of key topic words.",
        "Avoid repeating the same word.",
        "Use a dictionary for meaning and spelling.",
        "Replace general words with specific ones.",
        "Practise common collocations.",
        "Read short texts on the topic to build vocabulary."
      ],
      1: [
        "Poor — extremely limited and repetitive vocabulary.",
        "Words are often inaccurate or inappropriate.",
        "Many spelling errors make meaning hard to follow.",
        "The same few words repeat.",
        "Learn the most common words for this topic.",
        "Check spelling carefully.",
        "Use simple, correct words you know.",
        "Keep a vocabulary notebook.",
        "Build from basic, accurate vocabulary.",
        "Read more to grow your range."
      ],
      0: [
        "Vocabulary is missing, inappropriate, or incomprehensible.",
        "Words are mostly incorrect or absent.",
        "Meaning cannot be understood.",
        "Please use simple, correct words.",
        "Start with basic topic words you know.",
        "Re-attempt using clear, everyday vocabulary.",
        "Word choice does not communicate meaning.",
        "Learn a few key words and use them.",
        "Spell your words carefully.",
        "Build a short list of correct words first."
      ]
    }
  };

  window.WRITING_COMMENT_BANK = {
    bands: BANDS,
    rubricMeta: RUBRIC_META,
    essay: essay,
    academic: academic,
    short: short,
    // Helper: comments for a (rubric, criterion, score). Falls back to
    // the essay bank if the chosen rubric isn't filled yet, so the
    // teacher always sees *something* useful in Phase 1.
    get: function (rubric, criterion, score) {
      const r = (this[rubric] && Object.keys(this[rubric]).length) ? this[rubric] : null;
      const src = r || this.essay;
      const byCrit = src[criterion];
      if (!byCrit) return [];
      return byCrit[score] || [];
    },
    // Helper: display label for a criterion under a rubric.
    label: function (rubric, criterion) {
      const m = RUBRIC_META[rubric] || RUBRIC_META.essay;
      return (m.criteria && m.criteria[criterion]) || criterion;
    }
  };
})();
