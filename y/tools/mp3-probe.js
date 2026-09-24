#!/usr/bin/env node
/**
 * tools/mp3-probe.js
 *
 * Report the true duration, bitrate and channel count of an mp3 by walking its
 * MPEG frames. No ffmpeg, no dependencies.
 *
 *   node tools/mp3-probe.js student/audio/listening-forger.mp3
 *   node tools/mp3-probe.js --json y/some.mp3
 *
 * WHY THIS EXISTS
 * A listening exam is an mp3 plus an SRT whose timestamps were produced from
 * some other copy of that recording. If the two are not the same length, every
 * transcript line points at the wrong moment and the fault is invisible - the
 * audio plays, the transcript scrolls, it is simply wrong. Checking the file
 * SIZE catches nothing, because a re-encode at a different bitrate changes size
 * without changing duration, and a truncated file changes both.
 *
 * Walking frames rather than trusting a Xing header is deliberate: a header can
 * describe the source file rather than the one on disk, which is exactly what a
 * botched conversion produces.
 */
'use strict';
const fs = require('fs');

// [version][bitrateIndex] in kbps, Layer III only.
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1],   // MPEG 1
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1]        // MPEG 2 / 2.5
};
const SAMPLE_RATES = {
  3: [44100, 48000, 32000, -1],   // MPEG 1
  2: [22050, 24000, 16000, -1],   // MPEG 2
  0: [11025, 12000, 8000, -1]     // MPEG 2.5
};

function id3Size(buf) {
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return 0;
  // Syncsafe integer: seven significant bits per byte.
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) |
               ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  return 10 + size;
}

function probe(file) {
  const buf = fs.readFileSync(file);
  let pos = id3Size(buf);

  let frames = 0, totalSec = 0, bytesInFrames = 0;
  let sampleRate = 0, channels = 0, versionLabel = '', bitrates = new Set();
  let firstFrameAt = -1;

  while (pos + 4 <= buf.length) {
    // Frame sync: eleven set bits.
    if (buf[pos] !== 0xff || (buf[pos + 1] & 0xe0) !== 0xe0) { pos++; continue; }

    const verBits = (buf[pos + 1] >> 3) & 0x03;      // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layerBits = (buf[pos + 1] >> 1) & 0x03;    // 1 = Layer III
    const brIndex = (buf[pos + 2] >> 4) & 0x0f;
    const srIndex = (buf[pos + 2] >> 2) & 0x03;
    const padding = (buf[pos + 2] >> 1) & 0x01;
    const chMode = (buf[pos + 3] >> 6) & 0x03;       // 3 = mono

    if (verBits === 1 || layerBits !== 1 || brIndex === 0 || brIndex === 15 || srIndex === 3) {
      pos++; continue;                                // not a Layer III frame we can read
    }

    const isV1 = verBits === 3;
    const kbps = BITRATES[isV1 ? 1 : 2][brIndex];
    const sr = SAMPLE_RATES[verBits][srIndex];
    if (kbps <= 0 || sr <= 0) { pos++; continue; }

    const samplesPerFrame = isV1 ? 1152 : 576;
    const frameLen = Math.floor((samplesPerFrame / 8) * kbps * 1000 / sr) + padding;
    if (frameLen < 4) { pos++; continue; }

    if (firstFrameAt < 0) {
      firstFrameAt = pos;
      sampleRate = sr;
      channels = chMode === 3 ? 1 : 2;
      versionLabel = isV1 ? 'MPEG1' : (verBits === 2 ? 'MPEG2' : 'MPEG2.5');
    }

    frames++;
    bitrates.add(kbps);
    totalSec += samplesPerFrame / sr;
    bytesInFrames += frameLen;
    pos += frameLen;
  }

  const list = [...bitrates].sort((a, b) => a - b);
  return {
    file,
    bytes: buf.length,
    frames,
    seconds: +totalSec.toFixed(2),
    sampleRate,
    channels,
    version: versionLabel,
    vbr: list.length > 1,
    bitrateKbps: frames ? Math.round(bytesInFrames * 8 / totalSec / 1000) : 0,
    bitrateRange: list.length > 1 ? list[0] + '-' + list[list.length - 1] : String(list[0] || 0)
  };
}

function fmt(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m + 'm' + String(s).padStart(2, '0') + 's';
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const files = args.filter(a => !a.startsWith('--'));
  if (!files.length) {
    console.error('usage: node tools/mp3-probe.js [--json] <file.mp3> ...');
    process.exit(1);
  }
  const out = [];
  for (const f of files) {
    try {
      const r = probe(f);
      out.push(r);
      if (!json) {
        if (!r.frames) { console.log(f + '  NO MPEG FRAMES FOUND - not a usable mp3'); continue; }
        console.log(
          f.replace(/^.*[\\/]/, '').padEnd(34) +
          fmt(r.seconds).padStart(7) +
          '  ' + String(r.bitrateKbps).padStart(3) + 'kbps' +
          (r.vbr ? ' vbr(' + r.bitrateRange + ')' : ' cbr') +
          '  ' + (r.channels === 1 ? 'mono' : 'stereo') +
          '  ' + (r.sampleRate / 1000) + 'kHz' +
          '  ' + (r.bytes / 1048576).toFixed(1) + 'MB');
      }
    } catch (e) {
      console.error(f + ': ' + e.message);
      process.exitCode = 1;
    }
  }
  if (json) console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
}

module.exports = { probe };
