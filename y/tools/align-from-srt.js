#!/usr/bin/env node
/**
 * tools/align-from-srt.js
 *
 * Re-time EXAM_TRANSCRIPT segments in student/js/listening-exam.js against a
 * Whisper-generated SRT file. The transcript TEXT is kept as-is (your cleaned
 * version wins); only the `start` and `end` numbers are updated to match what
 * Whisper actually heard.
 *
 * USAGE
 * -----
 *   1. Run WhisperDesktop (or any Whisper) on student/audio/listening-exam-1.mp3.
 *      Save the SRT output to: student/audio/listening-exam-1.srt
 *   2. From the y/ directory:   node tools/align-from-srt.js
 *   3. Review tools/exam-transcript.aligned.js — it contains the new
 *      EXAM_TRANSCRIPT array plus a diagnostic report showing per-segment
 *      start deltas and a confidence score.
 *   4. If the diffs look sane, paste the new array over the old one in
 *      student/js/listening-exam.js (replace the contents between
 *      `const EXAM_TRANSCRIPT = [` and the matching `];`).
 *
 * FLAGS
 * -----
 *   --srt=PATH        default: student/audio/listening-exam-1.srt
 *   --srt2=PATH       optional: a supplementary SRT for a trimmed copy of the
 *                     audio. Whisper sometimes dies mid-file; if you re-run it
 *                     on a trimmed copy, pass that SRT here with --srt2Offset
 *                     so its timestamps get shifted back into the original
 *                     audio's timeline and merged into the cue stream.
 *   --srt2Offset=SEC  seconds to add to --srt2 timestamps (= the start offset
 *                     you used when trimming). Default: 0.
 *   --source=PATH     default: student/js/listening-exam.js
 *   --out=PATH        default: tools/exam-transcript.aligned.js
 *   --verbose         print per-segment similarity scores while running
 *
 * The script never modifies the source file. It only writes --out.
 */

const fs = require('fs');
const path = require('path');

// ─── argv ─────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const SRT_PATH     = args.srt    || 'student/audio/listening-exam-1.srt';
const SRT2_PATH    = args.srt2   || 'student/audio/listening-exam-1-part2.srt';
const SRT2_OFFSET  = args.srt2Offset != null ? parseFloat(args.srt2Offset) : 800;
const SRC_PATH     = args.source || 'student/js/listening-exam.js';
const OUT_PATH     = args.out    || 'tools/exam-transcript.aligned.js';
const VERBOSE      = !!args.verbose;

// ─── SRT parser ───────────────────────────────────────────────────────────────
function parseSrt(text) {
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trimEnd()).filter(l => l.length);
    if (lines.length < 2) continue;
    const timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx < 0) continue;
    const [startStr, endStr] = lines[timeLineIdx].split('-->').map(s => s.trim());
    const start = parseTs(startStr);
    const end   = parseTs(endStr);
    if (start == null || end == null) continue;
    const t = lines.slice(timeLineIdx + 1).join(' ').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    cues.push({ start, end, text: t });
  }
  return cues;
}

function parseTs(s) {
  // HH:MM:SS,mmm  or  HH:MM:SS.mmm
  const m = s.match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
}

// ─── EXAM_TRANSCRIPT extractor ───────────────────────────────────────────────
// Find `const EXAM_TRANSCRIPT = [...]` in the source, then evaluate the array
// literal in a sandboxed Function. Safer than a whole-file eval.
function extractTranscript(sourceText) {
  const startIdx = sourceText.indexOf('const EXAM_TRANSCRIPT');
  if (startIdx < 0) throw new Error('EXAM_TRANSCRIPT not found in source');
  const arrStart = sourceText.indexOf('[', startIdx);
  if (arrStart < 0) throw new Error('EXAM_TRANSCRIPT array literal not found');

  // Walk the JS, respecting strings/comments, until the [ is balanced.
  let depth = 0, inString = false, stringCh = null, inLineComment = false, inBlockComment = false;
  for (let i = arrStart; i < sourceText.length; i++) {
    const c = sourceText[i], next = sourceText[i + 1];
    if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    if (inString) {
      if (c === '\\') { i++; continue; }
      if (c === stringCh) { inString = false; stringCh = null; }
      continue;
    }
    if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = true; stringCh = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        const arrText = sourceText.slice(arrStart, i + 1);
        // eslint-disable-next-line no-new-func
        const arr = new Function('return ' + arrText)();
        return { arr, arrText, arrStart, arrEnd: i + 1 };
      }
    }
  }
  throw new Error('EXAM_TRANSCRIPT array: unbalanced brackets');
}

// ─── similarity ───────────────────────────────────────────────────────────────
function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a), sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

// How many contiguous N-grams of `target` appear inside `joined`? This rewards
// the right phrase ordering — jaccard alone would happily match a bag of words.
function phraseOverlap(joined, target, n = 4) {
  if (!target.length || !joined.length) return 0;
  if (target.length < n) {
    const pad = ' ' + joined.join(' ') + ' ';
    return pad.includes(' ' + target.join(' ') + ' ') ? 1 : jaccard(joined, target);
  }
  const hay = ' ' + joined.join(' ') + ' ';
  let hits = 0, total = 0;
  for (let i = 0; i + n <= target.length; i++) {
    total++;
    if (hay.includes(' ' + target.slice(i, i + n).join(' ') + ' ')) hits++;
  }
  return total ? hits / total : 0;
}

// Detect cues that are REPEATS of an earlier cue — i.e. the start of a second
// playback of the same recording. A cue is a repeat if its first 6 tokens
// exactly match the first 6 tokens of some earlier cue.
function detectRepeatStarts(srtCues) {
  const NGRAM = 6;
  const seenHeads = new Map();  // "w1 w2 ... w6" → earliest time seen
  const repeats = [];
  for (const cue of srtCues) {
    const toks = tokenize(cue.text);
    if (toks.length < NGRAM) continue;
    const head = toks.slice(0, NGRAM).join(' ');
    if (seenHeads.has(head)) {
      repeats.push({ head, firstTime: seenHeads.get(head), repeatTime: cue.start });
    } else {
      seenHeads.set(head, cue.start);
    }
  }
  return repeats;
}

// ─── aligner ──────────────────────────────────────────────────────────────────
// Section-aware word-level alignment. For each section in the target (intro,
// 1, 2, 3 in a listening exam), find the SRT's first-playback window — the
// range of time from the section's content start up to the cue where that
// content starts being repeated. Then run Needleman-Wunsch DP on just that
// window, anchored by a positional prior from teacher's original times.
//
// This handles:
//   - Whisper hallucinations during silence (gap_srt is cheap — we skip them)
//   - Double-played recordings (second playback is outside the per-section
//     SRT window, so DP simply can't reach it)
//   - Minor misspellings (per-word mismatch is only mildly penalised)
function align(srtCues, targets) {
  // 1. Flatten SRT → word stream with linearly-interpolated per-word times
  const srtWords = [];  // [{w, t, cueIdx}]
  for (let c = 0; c < srtCues.length; c++) {
    const cue = srtCues[c];
    const toks = tokenize(cue.text);
    if (!toks.length) continue;
    const dur = Math.max(0.1, cue.end - cue.start);
    for (let k = 0; k < toks.length; k++) {
      const t = cue.start + ((k + 0.5) / toks.length) * dur;
      srtWords.push({ w: toks[k], t, cueIdx: c });
    }
  }

  // 2. Detect second-playback boundaries. Each entry tells us a time at which
  //    a recording started repeating.
  const repeats = detectRepeatStarts(srtCues);
  if (repeats.length > 0) {
    console.log(`  Detected ${repeats.length} repeat marker(s):`);
    for (const r of repeats) {
      console.log(`    first play at ${r.firstTime.toFixed(1)}s, repeats at ${r.repeatTime.toFixed(1)}s ("${r.head}…")`);
    }
  }

  // 3. Group targets by section (preserving original index), so we can align
  //    each section against just its own first-playback window.
  const sectionGroups = [];   // [{key, targets: [], origIdx: []}]
  const sectionByKey = new Map();
  for (let i = 0; i < targets.length; i++) {
    const key = String(targets[i].section ?? 'default');
    if (!sectionByKey.has(key)) {
      const g = { key, targets: [], origIdx: [] };
      sectionByKey.set(key, g);
      sectionGroups.push(g);
    }
    const g = sectionByKey.get(key);
    g.targets.push(targets[i]);
    g.origIdx.push(i);
  }

  // 4. For each section, pick the SRT word window.
  //    Start: 30s before the section's earliest teacher-start.
  //    End:   the earliest repeat-boundary that lies AFTER the section's
  //           teacher-start, or teacher-max + generous slack if no repeat.
  //    This cleanly excludes the second playback.
  const out = new Array(targets.length);
  for (const g of sectionGroups) {
    const tMin = Math.min(...g.targets.map(t => t.start));
    const tMax = Math.max(...g.targets.map(t => t.end));
    const windowStart = Math.max(0, tMin - 30);

    // Find the first repeat boundary past tMin — that's where the section's
    // second playback begins. If none found (e.g. Whisper died before the
    // repeat), fall back to teacher_max + 60.
    let windowEnd = tMax + 60;
    for (const r of repeats) {
      if (r.repeatTime > tMin + 30 && r.repeatTime < windowEnd) {
        windowEnd = r.repeatTime;
      }
    }

    console.log(`  Section "${g.key}": teacher ${tMin}-${tMax}, window ${windowStart.toFixed(1)}-${windowEnd.toFixed(1)} (${g.targets.length} targets)`);

    const subSrtWords = srtWords.filter(w => w.t >= windowStart && w.t <= windowEnd);
    if (subSrtWords.length === 0) {
      // No SRT content in this section's window — mark every target failed.
      for (let k = 0; k < g.targets.length; k++) {
        out[g.origIdx[k]] = {
          ...g.targets[k],
          _oldStart: g.targets[k].start,
          _oldEnd:   g.targets[k].end,
          _aligned:  false,
          _score:    0,
          _matched:  0,
          _total:    tokenize(g.targets[k].text).length,
        };
      }
      continue;
    }

    const subResults = alignDP(subSrtWords, g.targets);
    for (let k = 0; k < g.targets.length; k++) {
      out[g.origIdx[k]] = subResults[k];
    }
  }
  return out;
}

// Inner word-level DP — runs on a pre-filtered SRT word stream and a list of
// target segments. Returns one result object per target.
function alignDP(srtWords, targets) {
  // Flatten targets → word stream with expected time from teacher's priors
  const tgtWords = [];  // [{w, segIdx, expT}]
  for (let i = 0; i < targets.length; i++) {
    const toks = tokenize(targets[i].text);
    const dur  = Math.max(1, targets[i].end - targets[i].start);
    for (let k = 0; k < toks.length; k++) {
      const expT = targets[i].start + ((k + 0.5) / toks.length) * dur;
      tgtWords.push({ w: toks[k], segIdx: i, expT });
    }
  }

  const M = srtWords.length;
  const N = tgtWords.length;
  console.log(`  DP table: ${M} SRT words × ${N} target words = ${((M + 1) * (N + 1) * 5 / 1048576).toFixed(1)} MB`);

  // 3. Needleman-Wunsch.
  //    NOTE: proximity prior intentionally disabled (PROX=0). It was useful
  //    when aligning globally across double-playback SRT — pulled DP toward
  //    the teacher's expected time to avoid jumping to the 2nd playback. But
  //    now that each section is sectioned + windowed, DP literally CAN'T
  //    escape to the wrong playback, and the prior only hurts when the
  //    teacher's timestamps were off (which is half the reason we're here).
  //    Kept as tunable knobs in case we ever revert to global alignment.
  const MATCH     = 2.0;
  const MISMATCH  = -1.0;
  const GAP_SRT   = -0.05;
  const GAP_TGT   = -0.6;
  const GRACE     = 60;     // seconds of free drift around expected position
  const PROX      = 0;      // disabled — sectioning already anchors us
  const W = N + 1;

  const dp    = new Float32Array((M + 1) * W);
  const trace = new Uint8Array((M + 1) * W);  // 0=diag, 1=up(skip srt), 2=left(skip tgt)

  for (let i = 1; i <= M; i++) { dp[i * W] = i * GAP_SRT; trace[i * W] = 1; }
  for (let j = 1; j <= N; j++) { dp[j]      = j * GAP_TGT; trace[j]    = 2; }

  for (let i = 1; i <= M; i++) {
    const rowOff     = i * W;
    const prevRowOff = (i - 1) * W;
    const srtW       = srtWords[i - 1].w;
    const srtT       = srtWords[i - 1].t;
    for (let j = 1; j <= N; j++) {
      const sameWord   = srtW === tgtWords[j - 1].w;
      const drift      = Math.abs(srtT - tgtWords[j - 1].expT);
      const proxPen    = Math.max(0, drift - GRACE) * PROX;
      const diag       = dp[prevRowOff + (j - 1)] + (sameWord ? MATCH : MISMATCH) - proxPen;
      const up         = dp[prevRowOff + j]       + GAP_SRT;
      const left       = dp[rowOff     + (j - 1)] + GAP_TGT;
      let best = diag, op = 0;
      if (up > best)   { best = up;   op = 1; }
      if (left > best) { best = left; op = 2; }
      dp[rowOff + j] = best;
      trace[rowOff + j] = op;
    }
  }

  // 4. Traceback — for each target word, which SRT word (if any) it aligned to
  const tgtToSrt = new Int32Array(N).fill(-1);
  let i = M, j = N;
  while (i > 0 && j > 0) {
    const op = trace[i * W + j];
    if (op === 0) { tgtToSrt[j - 1] = i - 1; i--; j--; }
    else if (op === 1) { i--; }
    else { j--; }
  }

  // 5. Build per-segment results. For each target segment, collect the times
  //    of ALL matched words, then split into clusters separated by >30s gaps
  //    and keep only the densest one — this discards words that leaked into
  //    the second-playback of the recording.
  const out = targets.map(t => ({
    ...t,
    _oldStart: t.start,
    _oldEnd:   t.end,
    _aligned:  false,
    _score:    0,
    _matched:  0,
    _total:    0,
  }));
  const perSegTimes = out.map(() => []);  // matched SRT times per segment (exact matches only)

  for (let k = 0; k < N; k++) {
    const segIdx = tgtWords[k].segIdx;
    const seg = out[segIdx];
    seg._total++;
    const srtIdx = tgtToSrt[k];
    if (srtIdx < 0) continue;
    if (srtWords[srtIdx].w !== tgtWords[k].w) continue;  // mismatch — don't trust position
    seg._matched++;
    perSegTimes[segIdx].push(srtWords[srtIdx].t);
  }

  // Cluster-split each segment's matched times. A gap of GAP_SPLIT seconds
  // between consecutive matches marks a playback boundary. Listening exams
  // play each recording twice, so we may see two clusters per segment —
  // the first (earlier in time) is always the one we want.
  const GAP_SPLIT = 30;
  for (let idx = 0; idx < out.length; idx++) {
    const s = out[idx];
    s._score = s._total ? s._matched / s._total : 0;
    const times = perSegTimes[idx];
    if (times.length === 0) continue;

    times.sort((a, b) => a - b);
    const clusters = [[times[0]]];
    for (let k = 1; k < times.length; k++) {
      if (times[k] - times[k - 1] > GAP_SPLIT) clusters.push([]);
      clusters[clusters.length - 1].push(times[k]);
    }

    // Prefer the EARLIEST cluster that has enough support (first playback
    // always comes first). Fall back to the densest cluster if no early
    // cluster meets the threshold.
    const threshold = Math.max(3, Math.floor(s._total * 0.3));
    let best = null;
    for (const c of clusters) {
      if (c.length >= threshold) { best = c; break; }
    }
    if (!best) {
      best = clusters[0];
      for (const c of clusters) if (c.length > best.length) best = c;
    }

    s._aligned = true;
    s.start = Math.round(best[0] * 10) / 10;
    s.end   = Math.round(best[best.length - 1] * 10) / 10;
    s._matched = best.length;
    s._score   = s._total ? s._matched / s._total : 0;
  }

  if (VERBOSE) {
    for (let idx = 0; idx < out.length; idx++) {
      const s = out[idx];
      const dS = s._aligned ? (s.start - s._oldStart).toFixed(1) : 'n/a';
      console.log(`[${String(idx).padStart(2)}] matched ${s._matched}/${s._total} (${(s._score * 100).toFixed(0)}%)  start ${s._oldStart}→${s.start} Δ${dS}s`);
    }
  }
  return out;
}

// ─── output formatting ────────────────────────────────────────────────────────
function formatArray(aligned) {
  const lines = aligned.map(s => {
    const sec = s.section == null ? '' : `, section: ${JSON.stringify(s.section)}`;
    return `  { start: ${String(s.start).padStart(6)}, end: ${String(s.end).padStart(6)}, text: ${JSON.stringify(s.text)}${sec} },`;
  });
  return 'const EXAM_TRANSCRIPT = [\n' + lines.join('\n') + '\n];';
}

function formatDiagnostics(aligned) {
  const rows = aligned.map((s, i) => {
    const oldS = s._oldStart, oldE = s._oldEnd;
    if (!s._aligned) {
      return `  ${String(i).padStart(2)} | FAILED — no target words aligned. Kept original ${oldS}-${oldE}.`;
    }
    const dS = (s.start - oldS).toFixed(1);
    const score = s._score.toFixed(2);
    const warn = s._score < 0.4 ? '  ⚠ LOW' : (s._score < 0.6 ? '  ⚠' : '');
    return `  ${String(i).padStart(2)} | old ${String(oldS).padStart(6)}→${String(oldE).padStart(6)}  new ${String(s.start).padStart(6)}→${String(s.end).padStart(6)}  Δstart ${String(dS).padStart(6)}s  matched ${String(s._matched).padStart(3)}/${String(s._total).padEnd(3)}  score=${score}${warn}`;
  });
  return 'Alignment report:\n' + rows.join('\n');
}

// ─── main ─────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(SRT_PATH)) {
    console.error(`\n✗ SRT file not found: ${SRT_PATH}`);
    console.error(`  Run WhisperDesktop on the audio file and save SRT to that path,`);
    console.error(`  or pass --srt=PATH to point at it elsewhere.\n`);
    process.exit(1);
  }
  if (!fs.existsSync(SRC_PATH)) {
    console.error(`\n✗ Source JS not found: ${SRC_PATH}\n`);
    process.exit(1);
  }

  const srtText = fs.readFileSync(SRT_PATH, 'utf8');
  const srcText = fs.readFileSync(SRC_PATH, 'utf8');

  let cues = parseSrt(srtText);
  // Drop [no audio]/[no speech] hallucination cues — these are garbage.
  cues = cues.filter(c => !/^\s*\[(no audio|no speech|silence|blank[_ ]audio)\]\s*$/i.test(c.text));
  console.log(`✓ Parsed ${cues.length} real SRT cues from ${SRT_PATH}`);
  if (cues.length === 0) {
    console.error('✗ No cues parsed. Is the file actually SRT format?');
    process.exit(1);
  }

  // Optional: merge a supplementary SRT (e.g. from a trimmed re-transcription
  // that covers the tail of the audio Whisper gave up on). Offset its cues by
  // SRT2_OFFSET so everything ends up in the original audio's timeline.
  if (fs.existsSync(SRT2_PATH)) {
    const srt2Text = fs.readFileSync(SRT2_PATH, 'utf8');
    let cues2 = parseSrt(srt2Text)
      .filter(c => !/^\s*\[(no audio|no speech|silence|blank[_ ]audio)\]\s*$/i.test(c.text))
      .map(c => ({ start: c.start + SRT2_OFFSET, end: c.end + SRT2_OFFSET, text: c.text }));
    console.log(`✓ Parsed ${cues2.length} real SRT cues from ${SRT2_PATH} (offset +${SRT2_OFFSET}s)`);

    // If srt2 covers time T and onward, drop srt1 cues from T onward — the
    // fresh transcription is more trustworthy than the dying VAD's last gasps.
    const cutoff = cues2.length ? cues2[0].start : Infinity;
    const dropped = cues.filter(c => c.start >= cutoff).length;
    cues = cues.filter(c => c.start < cutoff).concat(cues2);
    cues.sort((a, b) => a.start - b.start);
    console.log(`  Merged: dropped ${dropped} cues from ${SRT_PATH} past ${cutoff.toFixed(1)}s, total now ${cues.length}`);
  } else {
    console.log(`  (No ${SRT2_PATH} found — skipping supplementary SRT merge.)`);
  }

  const { arr: targets } = extractTranscript(srcText);
  console.log(`✓ Extracted ${targets.length} target segments from ${SRC_PATH}`);

  const aligned = align(cues, targets);
  const okCount  = aligned.filter(s => s._aligned).length;
  const lowCount = aligned.filter(s => s._aligned && s._score < 0.4).length;
  const medCount = aligned.filter(s => s._aligned && s._score >= 0.4 && s._score < 0.6).length;
  console.log(`✓ Aligned ${okCount}/${aligned.length} — ${lowCount} low (<0.4), ${medCount} medium (0.4–0.6), ${okCount - lowCount - medCount} good (≥0.6)`);

  const report = formatDiagnostics(aligned);
  const outText = [
    '// Generated by tools/align-from-srt.js — do not edit directly.',
    '// Copy the array below over the existing EXAM_TRANSCRIPT in student/js/listening-exam.js.',
    '//',
    '// ' + report.split('\n').join('\n// '),
    '',
    formatArray(aligned),
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, outText, 'utf8');

  console.log(`✓ Wrote ${OUT_PATH}\n`);
  console.log(report);
  if (lowCount > 0) {
    console.log(`\n⚠ ${lowCount} segment(s) scored below 0.4. Review those rows in the output file before pasting them into listening-exam.js.`);
  }
}

main();
