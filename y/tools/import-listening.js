#!/usr/bin/env node
/**
 * tools/import-listening.js
 *
 * Turn one FSMEPT listening exam (mp3 + Whisper SRT + questions .docx +
 * answer-key .docx) into the exam object that student/js/listening-exam.js
 * expects, and print it.
 *
 *   node tools/import-listening.js --exam=forger
 *   node tools/import-listening.js --exam=usa --json
 *
 * WHAT MAKES THIS FIDDLY, and why the parsing is shaped the way it is:
 *
 * 1. The two answer keys are in DIFFERENT formats. Exam 1 lists bare letters
 *    (a, b, d, ...). Exam 4 marks the correct option by making it BOLD and
 *    otherwise repeats the question paper verbatim. Both are auto-detected.
 *
 * 2. In exam 4 the numbered INSTRUCTION headers collide with the numbered
 *    QUESTIONS - both look like "3. ...". The discriminator is structural: a
 *    real question is immediately followed by option lines. An instruction is
 *    not. Numbering alone would silently produce phantom questions.
 *
 * 3. The .txt transcripts use two different header styles, "[Speaker 1] (0:03
 *    - 1:25)" and a bare "(0:00 - 0:15)". Missing the second form leaves the
 *    digits in the text as words.
 *
 * Nothing is written to the app by this tool - it prints, you paste. Every
 * count is asserted first, and it exits non-zero rather than emit a half-built
 * exam.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { docxRichLines } = require('./docx-text.js');

const SRC = 'Audiio Files/Listening';

const EXAMS = {
  forger: {
    id: 'fsmept-forger',
    title: 'FSMEPT Listening 1 - The Forger',
    audio: 'student/audio/listening-forger.mp3',
    srt: SRC + '/forger.srt',
    questions: SRC + '/FSMEPT LISTENING 1 The Forger.docx',
    key: SRC + '/FSMEPT LISTENING 1 Answer Key.docx',
    txt: SRC + '/The Forger.txt'
  },
  museum: {
    id: 'fsmept-museum',
    title: 'FSMEPT Listening 5 - Museum of Science and Technology',
    audio: 'student/audio/listening-museum.mp3',
    srt: SRC + '/museum.srt',
    questions: SRC + '/FSMEPT LISTENING 5 Museum of Science and Tech.docx',
    key: SRC + '/FSMEPT LISTENING 5 Answer Key.docx',
    txt: SRC + '/Museum of science and technology.txt'
  },
  newsmedia: {
    id: 'fsmept-news-media',
    title: 'FSMEPT Listening 2 - News Media',
    audio: 'student/audio/listening-news-media.mp3',
    srt: SRC + '/News Media (1).srt',
    questions: SRC + '/FSMEPT LISTENING 2 News Media.docx',
    key: SRC + '/FSMEPT LISTENING 2 Answer Key.docx'
  },
  slang: {
    id: 'fsmept-slang',
    title: 'FSMEPT Listening 3 - What is up with Slang?',
    audio: 'student/audio/listening-slang.mp3',
    srt: SRC + '/Slang.srt',
    questions: SRC + '/FSMEPT LISTENING 3 Slang.docx',
    key: SRC + '/FSMEPT LISTENING 3 Answer Key.docx'
  },
  usa: {
    id: 'fsmept-best-places',
    title: 'FSMEPT Listening 4 - The Best Places to Live in the US',
    audio: 'student/audio/listening-best-places.mp3',
    srt: SRC + '/listening-exam-2USA.srt',
    questions: SRC + '/FSMEPT LISTENING 4 Best places in the US.docx',
    key: SRC + '/FSMEPT LISTENING 4 Answer Key.docx',
    txt: SRC + '/The Best Places to Live in the US.txt'
  }
};

// ─── SRT ─────────────────────────────────────────────────────────────────────
function parseTs(s) {
  const m = s.match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : null;
}

function parseSrt(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const cues = [];
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.split('\n').map(l => l.trimEnd()).filter(l => l.length);
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->').map(s => s.trim());
    const start = parseTs(a), end = parseTs(b);
    if (start == null || end == null) continue;
    const t = lines.slice(ti + 1).join(' ').replace(/\s+/g, ' ').trim();
    if (t) cues.push({ start, end, text: t });
  }
  return cues;
}

// ─── questions .docx ─────────────────────────────────────────────────────────
const isOption = t => /^[a-dA-D][.)]\s+/.test(t);
const optionLetter = t => t.trim()[0].toLowerCase();
const stripOption = t => t.replace(/^[a-dA-D][.)]\s+/, '').trim();
const isNumbered = t => /^\d+[.)]\s+/.test(t);
const stripNumber = t => t.replace(/^\d+[.)]\s+/, '').trim();

const TF_INSTRUCTION = /mark the sentences|true or false|circle t \(true\)/i;
const GAP_INSTRUCTION = /complete the sentences|with 1-2 words|fill in the blank/i;

// Part B options are not always lettered. Exam 2 lists the question and then
// its options as bare lines with no "a." at all, so the lettered parser found
// nothing. When that happens the layout is still perfectly regular - N blocks
// of (1 question + k options) - and the answer key says how many questions
// there should be, which is enough to recover the grouping SAFELY: the line
// count must divide exactly, and every answer letter must fall inside the
// resulting option count. If either check fails we refuse rather than guess.
function groupUnlettered(lines, expectedQuestions, letters) {
  if (!expectedQuestions || lines.length % expectedQuestions !== 0) return null;
  const block = lines.length / expectedQuestions;
  const optionCount = block - 1;
  if (optionCount < 2) return null;
  const maxLetter = letters.reduce((m, l) => Math.max(m, 'abcdefgh'.indexOf(l)), -1);
  if (maxLetter < 0 || maxLetter >= optionCount) return null;   // key disagrees

  const out = [];
  for (let i = 0; i < lines.length; i += block) {
    out.push({
      text: stripNumber(lines[i]),
      letters: 'abcdefgh'.slice(0, optionCount).split(''),
      options: lines.slice(i + 1, i + block).map(stripOption)
    });
  }
  return out;
}

const partHeaderText = t => t.replace(/^PART\s*[AB]\s*[:.-]?\s*/i, '').trim();

function parseQuestions(file) {
  const lines = docxRichLines(file).map(l => l.text);
  const partA = [], partB = [], rawB = [];
  let part = null;
  // Part A is true/false in three of the five papers and gap-fill in the
  // fourth. The instruction line says which, so read it rather than assume.
  let aType = 'truefalse';
  let aInstruction = '', bInstruction = '';

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (/^PART\s*A\b/i.test(t)) {
      part = 'A';
      if (GAP_INSTRUCTION.test(t)) aType = 'fillblank';
      if (partHeaderText(t)) aInstruction = partHeaderText(t);
      continue;
    }
    if (/^PART\s*B\b/i.test(t)) {
      part = 'B';
      if (partHeaderText(t)) bInstruction = partHeaderText(t);
      continue;
    }
    // NOT EVERY PAPER HAS "PART A". Exam 5 is a title, the true/false
    // instruction, then six statements - no part headers at all. Requiring the
    // header collected zero questions and the answer-key assertion then refused
    // the whole import, which is the right failure but the wrong cause. Treat
    // the true/false instruction itself as the start of a true/false section.
    if (part === null && TF_INSTRUCTION.test(t)) { part = 'A'; continue; }

    if (part === 'A') {
      // Everything under PART A that is not the instruction line is a statement.
      if (TF_INSTRUCTION.test(t)) { aInstruction = aInstruction || t; continue; }
      if (GAP_INSTRUCTION.test(t)) { aType = 'fillblank'; aInstruction = aInstruction || t; continue; }
      // A numbered line with options below it means the paper has moved on to
      // multiple choice without announcing a PART B.
      if (isNumbered(t) && isOption(lines[i + 1] || '')) { part = 'B'; i--; continue; }
      partA.push(t);
    } else if (part === 'B') {
      rawB.push(t);
      if (!isNumbered(t)) continue;
      // STRUCTURAL test, not numeric: a question is followed by options. The
      // instruction headers in exam 4 are numbered too and would otherwise be
      // imported as questions with no answers.
      const opts = [];
      let j = i + 1;
      while (j < lines.length && isOption(lines[j])) { opts.push(lines[j]); j++; }
      if (opts.length < 2) continue;                     // an instruction, skip
      partB.push({
        text: stripNumber(t),
        letters: opts.map(optionLetter),
        options: opts.map(stripOption)
      });
      i = j - 1;
    }
  }
  return { partA, partB, rawB, aType, aInstruction, bInstruction };
}

// ─── answer key .docx ────────────────────────────────────────────────────────
// Returns what the key CONTAINS. It deliberately asserts nothing: the Part B
// grouping for an unlettered paper is recovered from the number of answers
// found here, so the counts cannot be checked until after that has run. The
// assertions live in build() instead, where both halves are known.
function parseKey(file, aType) {
  const lines = docxRichLines(file);
  const aAnswers = [], letters = [];
  let part = null;

  for (const { text, bold } of lines) {
    if (/^ANSWER KEY/i.test(text)) continue;
    if (/^PART\s*A\b/i.test(text)) { part = 'A'; continue; }
    if (/^PART\s*B\b/i.test(text)) { part = 'B'; continue; }

    // Part A of a gap-fill paper is free text ("declining", "70%",
    // "up to date / current"), so it cannot be recognised by shape the way a
    // bare T or F can - anything under the Part A heading is an answer.
    if (part === 'A' && aType === 'fillblank') { aAnswers.push(text); continue; }

    // Part A: bare T / F on their own line.
    if (/^[TF]$/i.test(text)) { aAnswers.push(text.toUpperCase()); continue; }

    // Part B, format 1: a bare letter on its own line.
    if (/^[a-dA-D]$/.test(text)) { letters.push(text.toLowerCase()); continue; }
    // Part B, format 2: the key repeats the paper and BOLDS the right option.
    if (bold && isOption(text)) { letters.push(optionLetter(text)); continue; }
  }

  return { a: aAnswers, letters };
}

// ─── build ───────────────────────────────────────────────────────────────────
function build(key, opts) {
  const cfg = EXAMS[key];
  if (!cfg) throw new Error('unknown exam "' + key + '". known: ' + Object.keys(EXAMS).join(', '));

  // An exam with no playable audio fails silently in the browser - the player
  // just never starts - so catch it here instead. This is not theoretical:
  // papers 2 and 3 arrived as .wma, which no browser can decode, and Whisper
  // read them happily because it brings its own decoder. Pass --no-audio-check
  // to validate a parse before the conversion has been done.
  if (!opts || opts.checkAudio !== false) {
    const abs = path.resolve(__dirname, '..', cfg.audio);
    if (!fs.existsSync(abs)) {
      throw new Error('audio not found: ' + cfg.audio +
                      '\n  convert the source recording to mp3 and put it there first');
    }
  }

  const cues = parseSrt(cfg.srt);
  if (!cues.length) throw new Error('no cues parsed from ' + cfg.srt);

  const q = parseQuestions(cfg.questions);
  const a = parseKey(cfg.key, q.aType);

  // Papers 2 and 3 print the Part B options with no "a." in front of them, so
  // the lettered parser finds nothing. Recover the grouping from the shape of
  // the section, cross-checked against the key. groupUnlettered refuses if the
  // lines do not divide evenly or the key uses a letter that would fall outside
  // the resulting options, so a wrong guess cannot get through silently.
  if (!q.partB.length && q.rawB.length) {
    const grouped = groupUnlettered(q.rawB, a.letters.length, a.letters);
    if (grouped) q.partB = grouped;
  }

  // A key that half-parsed is worse than none: it would silently mark real
  // student answers against the wrong letters.
  if (a.a.length !== q.partA.length) {
    throw new Error('answer key: found ' + a.a.length + ' Part A answers (' + q.aType +
                    ') for ' + q.partA.length + ' Part A questions');
  }
  if (a.letters.length !== q.partB.length) {
    throw new Error('answer key: found ' + a.letters.length + ' letter answers for ' +
                    q.partB.length + ' Part B questions');
  }

  // Every Part B answer letter must actually be one of that question's options.
  q.partB.forEach((item, i) => {
    if (item.letters.indexOf(a.letters[i]) === -1) {
      throw new Error('Q' + (i + 1) + ': answer "' + a.letters[i] +
                      '" is not among its options (' + item.letters.join(',') + ')');
    }
  });

  const transcript = cues.map(c => ({
    start: +c.start.toFixed(1),
    end: +c.end.toFixed(1),
    text: c.text,
    section: 1
  }));

  // Only sections that actually have questions. Exam 5 is true/false only, and
  // an empty "Part B" would render as a bare heading with nothing under it.
  const sections = [];
  if (q.partA.length) sections.push(
    {
      title: 'Part A',
      instruction: q.aInstruction ||
        (q.aType === 'fillblank' ? 'Complete the sentences.' : 'Mark the sentences True or False.'),
      points: q.partA.length + ' x 1 = ' + q.partA.length + ' pts',
      type: q.aType,
      questions: q.partA.map((text, i) => ({
        id: 'a' + (i + 1),
        // Normalise the blank. The papers use runs of fifteen and seventeen
        // underscores and the app's own sample exam uses ten; keeping one form
        // in the data means the question text reads the same everywhere.
        text: q.aType === 'fillblank' ? text.replace(/_{3,}/g, '__________') : text,
        answer: a.a[i]
      }))
    });
  if (q.partB.length) sections.push(
    {
      title: 'Part B',
      instruction: q.bInstruction || 'Choose the correct option.',
      points: q.partB.length + ' x 1 = ' + q.partB.length + ' pts',
      type: 'mcq',
      questions: q.partB.map((item, i) => ({
        id: 'b' + (i + 1), text: item.text, options: item.options, answer: a.letters[i]
      }))
    });
  if (!sections.length) throw new Error('no questions parsed at all');

  return {
    exam: { id: cfg.id, title: cfg.title, audio: cfg.audio, transcript: transcript, sections: sections },
    stats: {
      cues: cues.length,
      durationSec: +cues[cues.length - 1].end.toFixed(1),
      partA: q.partA.length,
      partAType: q.aType,
      partB: q.partB.length,
      optionCounts: [...new Set(q.partB.map(x => x.options.length))].join('/')
    }
  };
}

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).map(s => {
    const m = s.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [s, true];
  }));
  const which = args.exam;
  if (!which) {
    console.error('usage: node tools/import-listening.js --exam=<' + Object.keys(EXAMS).join('|') + '> [--json]');
    process.exit(1);
  }
  try {
    const { exam, stats } = build(which, { checkAudio: !args['no-audio-check'] });
    if (args.json) {
      console.log(JSON.stringify(exam, null, 2));
    } else {
      console.error('cues=' + stats.cues + '  duration=' + stats.durationSec + 's  ' +
                    'PartA=' + stats.partA + ' (' + stats.partAType + ')' +
                    '  PartB=' + stats.partB +
                    '  options/question=' + stats.optionCounts);
      console.log(JSON.stringify(exam, null, 2));
    }
  } catch (e) {
    console.error('import-listening: ' + e.message);
    process.exit(1);
  }
}

module.exports = { build, EXAMS };
