'use strict';
/* ============================================================
   emdash-hook.js - PostToolUse guard (wired in .claude settings).
   ------------------------------------------------------------
   Claude Code pipes the tool call as JSON on stdin after every
   Edit/Write/MultiEdit. We pull the file path, scan it with
   emdash-scan, and if a shippable em/en dash slipped in we exit 2
   so the message is fed back and can be fixed immediately.
   Only app files (js/css/html under y/) are checked, to stay quiet.
   ============================================================ */
var emdash = require('./emdash-scan.js');

var chunks = [];
process.stdin.on('data', function (d) { chunks.push(d); });
process.stdin.on('end', function () {
  var fp = '';
  try { fp = ((JSON.parse(chunks.join('')) || {}).tool_input || {}).file_path || ''; } catch (e) { /* no input */ }
  if (!fp || !/\.(js|css|html)$/i.test(fp) || fp.replace(/\\/g, '/').indexOf('/y/') === -1) process.exit(0);

  var hits = emdash.scan(fp);
  if (!hits.length) process.exit(0);

  console.error('em-dash guard: ' + hits.length + ' em/en dash(es) in ' + fp + ' (house rule: use hyphens).');
  hits.slice(0, 8).forEach(function (h) { console.error('  L' + h.line + ': ' + h.text); });
  console.error('Replace them with hyphens. If they are pre-existing and out of scope, note that and move on.');
  process.exit(2);
});
