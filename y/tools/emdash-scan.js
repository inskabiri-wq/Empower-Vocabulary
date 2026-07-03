'use strict';
/* ============================================================
   emdash-scan.js - shared em/en-dash detector for Lingualab.
   ------------------------------------------------------------
   The house rule is: NO em dashes (use hyphens). This finds
   em (U+2014), en (U+2013) and horizontal-bar (U+2015) dashes
   in code that would ship, while ignoring the two legitimate
   places they appear so it does not nag:
     - inside comments (line comments and block comments, including
       multi-line box-drawing diagrams);
     - inside a regex character class that must keep the dash to
       match punctuation.
   For .md / .txt / .json the whole file is content, so nothing
   is skipped there.

   Used by preflight.js (batch) and emdash-hook.js (per write).
   ============================================================ */
var fs = require('fs');
var DASH = /[–—―]/;

function scan(file) {
  var content;
  try { content = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  var isDoc = /\.(md|markdown|txt|json)$/i.test(file);
  var lines = content.split(/\r?\n/);
  var out = [];
  var inBlock = false;
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var test = raw;
    if (!isDoc) {
      if (inBlock) { if (raw.indexOf('*/') !== -1) inBlock = false; continue; }
      var t = raw.replace(/^\s+/, '');
      if (t.indexOf('/*') === 0) { if (raw.indexOf('*/') === -1) inBlock = true; continue; }
      if (t.indexOf('//') === 0 || t.indexOf('*') === 0) continue;   // whole-line comment
      test = raw.replace(/\[[^\]\n]*\]/g, '');                        // drop regex char classes
    }
    if (DASH.test(test)) out.push({ line: i + 1, text: raw.trim().slice(0, 120) });
  }
  return out;
}

module.exports = { scan: scan };

// CLI: `node emdash-scan.js <file...>` - prints offenders, exit 1 if any.
if (require.main === module) {
  var files = process.argv.slice(2);
  var total = 0;
  files.forEach(function (f) {
    scan(f).forEach(function (h) { total++; console.error('EM-DASH ' + f + ':' + h.line + '  ' + h.text); });
  });
  if (total) { console.error('\n' + total + ' em/en dash(es) in shippable text. Use hyphens.'); process.exit(1); }
  console.log('em-dash scan clean (' + files.length + ' file(s))');
  process.exit(0);
}
