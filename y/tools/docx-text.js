#!/usr/bin/env node
/**
 * tools/docx-text.js
 *
 * Print the plain text of a .docx, one line per paragraph.
 *
 * WHY THIS EXISTS
 * The FSMEPT listening exams arrive as Word files - questions in one .docx and
 * the answer key in another, ten files for five exams - and there is no docx
 * reader in this project's dependencies. A .docx is just a ZIP holding
 * word/document.xml, and node ships zlib, so the whole thing is a small ZIP
 * reader plus a tag strip. No new dependency, no PowerShell round trip, and it
 * runs the same way every time.
 *
 * USAGE
 *   node tools/docx-text.js "path/to/file.docx"
 *   node tools/docx-text.js "path/to/file.docx" --json     (array of lines)
 *
 * Tables are flattened: each cell becomes its own line, in document order,
 * which is what the answer keys need since they are mostly 2-column tables.
 */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

// ─── Minimal ZIP reader ──────────────────────────────────────────────────────
// Walks the local file headers rather than the central directory: simpler, and
// a .docx written by Word always stores entries before the directory.
function readZipEntry(buf, wanted) {
  let off = 0;
  while (off + 30 <= buf.length) {
    if (buf.readUInt32LE(off) !== 0x04034b50) break;      // local file header
    const method   = buf.readUInt16LE(off + 8);
    const flags    = buf.readUInt16LE(off + 6);
    let compSize   = buf.readUInt32LE(off + 18);
    const nameLen  = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name     = buf.slice(off + 30, off + 30 + nameLen).toString('utf8');
    const dataAt   = off + 30 + nameLen + extraLen;

    // Bit 3 means the sizes live in a trailing data descriptor, not here. Word
    // does not normally do this, but bail loudly rather than return nonsense.
    if (flags & 0x08 && compSize === 0) {
      throw new Error('zip entry "' + name + '" uses a data descriptor; unsupported');
    }
    if (name === wanted) {
      const raw = buf.slice(dataAt, dataAt + compSize);
      if (method === 0) return raw;                        // stored
      if (method === 8) return zlib.inflateRawSync(raw);   // deflate
      throw new Error('unsupported compression method ' + method + ' for ' + name);
    }
    off = dataAt + compSize;
  }
  return null;
}

// ─── document.xml -> lines ───────────────────────────────────────────────────
function unescapeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(+d); })
          .replace(/&amp;/g, '&');                         // last, or it double-decodes
}

// Returns [{ text, bold }] - see the note on bold inside.
function docxRichLines(file) {
  const buf = fs.readFileSync(file);
  const xml = readZipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('no word/document.xml in ' + file);
  const text = xml.toString('utf8');

  const lines = [];
  // Split on paragraph starts. <w:p> and <w:p ...> both, hence the [ >].
  for (const para of text.split(/<w:p[ >]/).slice(1)) {
    let out = '';
    // Walk runs in order so tabs and breaks keep their place in the line.
    for (const m of para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
      out += (m[1] !== undefined) ? unescapeXml(m[1]) : '\t';
    }
    out = out.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
    if (!out) continue;
    // BOLD MATTERS. In the FSMEPT answer keys the correct multiple-choice
    // option is not written out anywhere - it is simply the option that is
    // bold. Strip formatting and the answer key extracts to exactly the same
    // text as the question paper, which is how it first appeared here.
    // <w:b w:val="0"/> means explicitly NOT bold, so it must not count.
    const bold = /<w:b\/>|<w:b w:val="(?:1|true|on)"\s*\/>/.test(para);
    lines.push({ text: out, bold: bold });
  }
  return lines;
}

function docxLines(file) {
  return docxRichLines(file).map(l => l.text);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node tools/docx-text.js <file.docx> [--json] [--marks]');
    process.exit(1);
  }
  try {
    if (args.includes('--marks')) {
      // Show which lines are bold. The answer keys carry the correct option
      // ONLY as bold, so this is how you read one.
      docxRichLines(file).forEach(l => console.log((l.bold ? '[B] ' : '    ') + l.text));
    } else if (args.includes('--json')) {
      console.log(JSON.stringify(docxRichLines(file), null, 1));
    } else {
      docxLines(file).forEach(l => console.log(l));
    }
  } catch (e) {
    console.error('docx-text: ' + e.message);
    process.exit(1);
  }
}

module.exports = { docxLines, docxRichLines };
