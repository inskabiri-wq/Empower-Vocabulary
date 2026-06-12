/* ============================================================
   EXAM REGISTRY — single source of truth for every assignable
   skill, organized as:

     skill  →  level  →  [ exam, exam, … ]

   Each exam carries metadata (title, subtitle, source file,
   passage index, time limit) AND an `available` flag so admins
   can flip an exam off without deleting its record (handy for
   exams that are mid-rewrite or seasonally retired).

   Adding new content later:
     1. Drop the JSON / audio under y/student/data/...
     2. Add a row to the right `levels` array below.
     3. (No JS changes elsewhere — reading-exam.js,
        listening-exam.js, and the teacher's exam picker all
        derive their data from this catalog.)

   We KEEP this file in sync manually (no filesystem scan at
   runtime) because Firebase Hosting doesn't expose directory
   listings and bundling a manifest is overkill for the current
   handful of exams. Phase G refactor — Reading is no longer
   hardcoded as one entry; each passage is its own assignable
   item, level-grouped.
   ============================================================ */

(function () {
  'use strict';

  // ── The catalog ────────────────────────────────────────────
  // SHAPE: SKILLS_CATALOG[skillId] = { name, levels: { [level]: [exam, ...] } }
  //
  // Exam fields (all optional except id + title):
  //   id              — unique within the skill ("b2-r1", "sample-fsmept")
  //   title           — shown in dropdowns and on cards
  //   subtitle        — secondary line for context
  //   file            — source data path (used by the runner)
  //   passageIndex    — for shared-file exams (one JSON, multiple passages)
  //   audio           — audio asset path (listening only)
  //   timeLimitMin    — soft timer suggestion for timed mode
  //   available       — false → hidden from teacher picker,
  //                     can't be assigned. Default: true.
  //
  // Adding a level: just add a new key like 'A1': [].
  // Adding an exam: append to the right level's array.
  const SKILLS_CATALOG = {
    reading: {
      name: 'Reading',
      levels: {
        'A1':  [
          { id: 'a1-r1',  title: 'A1 Reading 1 — A Television Presenter',   subtitle: 'One passage · Gaps, short-answer',                                  file: 'student/data/readings/A1/exam-1.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r2',  title: 'A1 Reading 2 — At The Movies: Bollywood', subtitle: 'One passage · Gaps, headings, MCQ',                                 file: 'student/data/readings/A1/exam-2.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r3',  title: 'A1 Reading 3 — Life Above Ground',        subtitle: 'One passage · Gaps, MCQ, headings, vocabulary',                     file: 'student/data/readings/A1/exam-3.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r4',  title: 'A1 Reading 4 — People in Big Cities',     subtitle: 'One passage · Gaps, MCQ, reference, fill-in',                       file: 'student/data/readings/A1/exam-4.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r5',  title: 'A1 Reading 5 — My Day',                   subtitle: 'One passage · True/False, MCQ, writing',                            file: 'student/data/readings/A1/exam-5.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          // (R6 — San Francisco — skipped: its main task is "match the
          //  words with the pictures" which the engine has no image
          //  renderer for. Drop it rather than ship a half-broken exam.)
          { id: 'a1-r7',  title: 'A1 Reading 7 — Sydney',                   subtitle: 'One passage · Headings, MCQ, reference, writing',                   file: 'student/data/readings/A1/exam-7.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r8',  title: 'A1 Reading 8 — Are You a Good Liar?',     subtitle: 'One passage · Synonyms, headings, MCQ, vocab, reference, T/F',      file: 'student/data/readings/A1/exam-8.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r9',  title: 'A1 Reading 9 — Immigrant Stories',        subtitle: 'One passage · Word forms, fill-in, MCQ, vocab, reference, T/F',     file: 'student/data/readings/A1/exam-9.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r10', title: 'A1 Reading 10 — Pablo Picasso',           subtitle: 'One passage · Headings, ordering, MCQ, vocab, sentence-insert, T/F', file: 'student/data/readings/A1/exam-10.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a1-r11', title: 'A1 Reading 11 — Elle MacPherson',         subtitle: 'One passage · Short-answer, ordering, MCQ, vocab, T/F',             file: 'student/data/readings/A1/exam-11.json', passageIndex: 0, timeLimitMin: 20, available: true }
        ],
        'A2':  [
          { id: 'a2-r1',  title: 'A2 Reading 1 — The Lies People Tell',     subtitle: 'One passage · Fill-in, headings, MCQ, vocabulary',                 file: 'student/data/readings/A2/exam-1.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a2-r2',  title: 'A2 Reading 2 — Immigrant Stories',        subtitle: 'One passage · Sentence-insert, matching, MCQ',                     file: 'student/data/readings/A2/exam-2.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a2-r3',  title: 'A2 Reading 3 — Slow Food',                subtitle: 'One passage · Sentence-insert, MCQ, vocab matching',               file: 'student/data/readings/A2/exam-3.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a2-r4',  title: 'A2 Reading 4 — Types of Families',        subtitle: 'One passage · Sentence-insert, matching, MCQ',                     file: 'student/data/readings/A2/exam-4.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a2-r5',  title: 'A2 Reading 5 — Garlic',                   subtitle: 'One passage · Headings, MCQ, vocab, reference',                    file: 'student/data/readings/A2/exam-5.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a2-r6',  title: 'A2 Reading 6 — Super Couples',            subtitle: 'One passage · MCQ, vocab, reference',                              file: 'student/data/readings/A2/exam-6.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          // (R7 — was provided as a legacy .doc file we couldn't parse; skipped.)
          // (R8 / R9 — Lies People Tell / Immigrant Stories duplicate the
          //  passages and tasks already covered by A1 R8 / A1 R9. Skipped
          //  to avoid identical-exam confusion in the picker.)
          { id: 'a2-r10', title: 'A2 Reading 10 — Pablo Picasso',           subtitle: 'One passage · Headings, ordering, sentence-insert, MCQ, vocab',    file: 'student/data/readings/A2/exam-10.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a2-r11', title: 'A2 Reading 11 — Slow Food (Scanning)',    subtitle: 'One passage · Short-answer scanning, T/F, vocabulary, reference',  file: 'student/data/readings/A2/exam-11.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'a2-r12', title: 'A2 Reading 12 — Hidden Talents',          subtitle: 'One passage · Headings, sentence-insert, MCQ, vocab',              file: 'student/data/readings/A2/exam-12.json', passageIndex: 0, timeLimitMin: 20, available: true }
        ],
        'B1':  [
          { id: 'b1-r1',  title: 'B1 Reading 1 — Making a Difference',                       subtitle: 'One passage · Sentence-insert, MCQ, vocabulary',                       file: 'student/data/readings/B1/exam-1.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r2',  title: 'B1 Reading 2 — I Love Me',                                 subtitle: 'One passage · Sentence-insert, MCQ, vocabulary, reference',            file: 'student/data/readings/B1/exam-2.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r3',  title: 'B1 Reading 3 — Who Owns English?',                         subtitle: 'One passage · Sentence-insert, headings, MCQ, reference, vocab',       file: 'student/data/readings/B1/exam-3.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r4',  title: 'B1 Reading 4 — 100 Places to Visit Before You Die',        subtitle: 'One passage · MCQ, sentence-insert, reference, vocabulary',            file: 'student/data/readings/B1/exam-4.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r5',  title: 'B1 Reading 5 — Happiness is in the Shoes You Wear',        subtitle: 'One passage · Reading comprehension MCQ',                              file: 'student/data/readings/B1/exam-5.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r6',  title: 'B1 Reading 6 — Travel Blogs',                              subtitle: 'One passage · MCQ, vocab, reference',                                  file: 'student/data/readings/B1/exam-6.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r7',  title: 'B1 Reading 7 — Unusual Accommodation',                     subtitle: 'One passage · Headings, MCQ, reference, vocabulary',                   file: 'student/data/readings/B1/exam-7.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r8',  title: 'B1 Reading 8 — Childhood Obesity Fueled by Marketing',     subtitle: 'One passage · Headings, MCQ, vocabulary',                              file: 'student/data/readings/B1/exam-8.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r9',  title: 'B1 Reading 9 — What is the Story Behind the Bed?',         subtitle: 'One passage · Sentence-insert, MCQ, vocab, reference',                 file: 'student/data/readings/B1/exam-9.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r10', title: 'B1 Reading 10 — I Just Cannot Sleep',                      subtitle: 'One passage · True/False, MCQ, vocab, reference',                      file: 'student/data/readings/B1/exam-10.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r11', title: 'B1 Reading 11 — How to Be Successful in an Interview',     subtitle: 'One passage · Vocabulary, sentence-insert, MCQ, fill-in',              file: 'student/data/readings/B1/exam-11.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r12', title: 'B1 Reading 12 — Stress in the Workplace',                  subtitle: 'One passage · Headings, True/False, MCQ, vocab, reference',            file: 'student/data/readings/B1/exam-12.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b1-r13', title: 'B1 Reading 13 — Changing Life Styles',                     subtitle: 'One passage · Main idea, sentence-insert, MCQ, vocab, reference',       file: 'student/data/readings/B1/exam-13.json', passageIndex: 0, timeLimitMin: 20, available: true }
        ],
        // 'B1+' intentionally omitted: no readings authored at that
        // level yet, and teachers were seeing it as a stray empty
        // section in the picker. Restore the key when content lands.
        'B2':  [
          {
            id: 'b2-r1',
            title: 'B2 Reading 1 — Is a University Degree Necessary?',
            subtitle: 'One passage · Headings, gaps, MCQ, vocabulary',
            file: 'student/data/readings/B2/exam-1.json',
            passageIndex: 0,
            timeLimitMin: 20,
            available: true
          },
          {
            id: 'b2-r2',
            title: 'B2 Reading 2 — Brand Stretching',
            subtitle: 'One passage · MCQ, vocabulary in context',
            file: 'student/data/readings/B2/exam-1.json',
            passageIndex: 1,
            timeLimitMin: 20,
            available: true
          },
          {
            id: 'b2-r3',
            title: 'B2 Reading 3 — Getting the Picture from DNA',
            subtitle: 'One passage · MCQ, vocabulary, pronoun reference',
            file: 'student/data/readings/B2/exam-1.json',
            passageIndex: 2,
            timeLimitMin: 20,
            available: true
          },
          {
            // Standalone file (one passage, generated via the
            // tools/convert-readings.js pipeline from
            // _raw/B2/exam-4.txt). All future readings should follow
            // this one-file-per-reading pattern — the bundled
            // exam-1.json is legacy.
            id: 'b2-r4',
            title: 'B2 Reading 4 — Homeschooling: A Better Way to Learn?',
            subtitle: 'One passage · Gaps, MCQ, vocabulary, reference, writing',
            file: 'student/data/readings/B2/exam-4.json',
            passageIndex: 0,
            timeLimitMin: 20,
            available: true
          },
          { id: 'b2-r5',  title: 'B2 Reading 5 — Language Development',                    subtitle: 'One passage · MCQ, reference, writing',                 file: 'student/data/readings/B2/exam-5.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r6',  title: "B2 Reading 6 — The Sky's the Limit",                    subtitle: 'One passage · Headings, MCQ, reference, writing',       file: 'student/data/readings/B2/exam-6.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r7',  title: 'B2 Reading 7 — What does it take to be successful?',    subtitle: 'One passage · Headings, MCQ, reference, fill-in, writing', file: 'student/data/readings/B2/exam-7.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r8',  title: 'B2 Reading 8 — Students of the Internet Age',           subtitle: 'One passage · MCQ, True/False',                          file: 'student/data/readings/B2/exam-8.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r9',  title: 'B2 Reading 9 — The Actual Cause of Obesity',            subtitle: 'One passage · MCQ, gap-fill, short-answer',              file: 'student/data/readings/B2/exam-9.json',  passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r10', title: 'B2 Reading 10 — The Cyber School',                      subtitle: 'One passage · Gaps, MCQ, short-answer',                  file: 'student/data/readings/B2/exam-10.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r11', title: 'B2 Reading 11 — How Advertising Uses Psychology',       subtitle: 'One passage · Headings, MCQ, True/False',                file: 'student/data/readings/B2/exam-11.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r12', title: 'B2 Reading 12 — In Defense of Advertising',             subtitle: 'One passage · Gaps, True/False',                         file: 'student/data/readings/B2/exam-12.json', passageIndex: 0, timeLimitMin: 20, available: true },
          { id: 'b2-r13', title: 'B2 Reading 13 — Why Do People Buy?',                    subtitle: 'One passage · MCQ, short-answer, headings',              file: 'student/data/readings/B2/exam-13.json', passageIndex: 0, timeLimitMin: 20, available: true }
        ]
      }
    },

    listening: {
      name: 'Listening',
      levels: {
        'B1': [
          {
            id: 'sample-fsmept',
            title: 'FSMEPT Listening 1',
            subtitle: 'Interview · Conversation · Podcast',
            audio: 'student/audio/listening-exam-1.mp3',
            timeLimitMin: 30,
            available: true
          }
        ]
      }
    }
  };

  // ── Public API ─────────────────────────────────────────────
  // The shape kept intentionally backwards-compatible — old
  // `forSkill()` and `find()` calls still work. New helpers
  // give callers level-aware access.

  /** Flatten a skill's exams across all levels into a single array,
   *  each exam decorated with its `level` for display. Used by the
   *  existing teacher dropdown until it migrates to grouped rendering. */
  function forSkill(skillId) {
    const skill = SKILLS_CATALOG[skillId];
    if (!skill) return [];
    const out = [];
    Object.keys(skill.levels).forEach(level => {
      (skill.levels[level] || []).forEach(e => {
        out.push(Object.assign({ level }, e));
      });
    });
    return out;
  }

  /** Just the level keys ('A2', 'B1', 'B2', …) for a skill, in
   *  the insertion order of the catalog. */
  function levelsFor(skillId) {
    const skill = SKILLS_CATALOG[skillId];
    return skill ? Object.keys(skill.levels) : [];
  }

  /** Exams for a single (skill, level), each annotated with `level`. */
  function examsForLevel(skillId, level) {
    const skill = SKILLS_CATALOG[skillId];
    if (!skill) return [];
    return (skill.levels[level] || []).map(e => Object.assign({ level }, e));
  }

  /** Find by (skill, examId). Returns the exam record (with level)
   *  or null. */
  function findExam(skillId, examId) {
    return forSkill(skillId).find(e => e.id === examId) || null;
  }

  /** Is the exam currently available to assign? false → admin
   *  toggled it off, teacher picker should disable / hide it. */
  function isAvailable(skillId, examId) {
    const e = findExam(skillId, examId);
    return !!(e && e.available !== false);
  }

  /** All registered skills (for future "skill picker" tooling). */
  function skills() { return Object.keys(SKILLS_CATALOG); }

  /** Whole catalog (read-only snapshot) — useful for the admin
   *  registry tab if we ever build one. */
  function snapshot() {
    return JSON.parse(JSON.stringify(SKILLS_CATALOG));
  }

  window.EXAM_REGISTRY = {
    forSkill,
    levelsFor,
    examsForLevel,
    find:        findExam,
    isAvailable,
    skills,
    snapshot,
    // Legacy aliases — kept so old call sites don't break.
    reading:   () => forSkill('reading'),
    listening: () => forSkill('listening')
  };
})();
