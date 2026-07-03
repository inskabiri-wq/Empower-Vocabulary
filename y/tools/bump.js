#!/usr/bin/env node
/* ============================================================
   bump.js - cache-version helper for Lingualab.
   ------------------------------------------------------------
   The app caches assets two ways, so a code change can look
   un-deployed until caches refresh. This tool bumps both:

     1. Assets referenced with a ?v=N query in the HTML
        (e.g. grammar.js?v=30). Bumping N makes browsers refetch
        that one file.
     2. service-worker.js has CACHE_VERSION='vN'. Bumping it once
        purges the whole precache on the next activation, which
        covers every asset that has NO ?v= query.

   Usage:
     node y/tools/bump.js --check            read-only: list versions, flag drift
     node y/tools/bump.js grammar.js ui.js   bump ?v= for named files + CACHE_VERSION
     node y/tools/bump.js --sw               bump only CACHE_VERSION
     node y/tools/bump.js                     same as --check (safe default)

   Names are matched by file name (path prefix ignored), with a
   boundary so "config.js" never matches "activity-config.js".
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var Y = path.resolve(__dirname, '..');               // the y/ directory
var SW = path.join(Y, 'service-worker.js');
var SKIP_DIRS = ['node_modules', '.git', '.tmp'];
var SKIP_PATH = path.join('tools', 'demos');

function walkHtml(dir, out) {
  var entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    if (SKIP_DIRS.indexOf(e.name) !== -1) return;
    var p = path.join(dir, e.name);
    if (e.isDirectory()) { if (p.indexOf(SKIP_PATH) !== -1) return; walkHtml(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  });
  return out;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Every "<boundary>name?v=N" reference across all html files.
function collectRefs(htmlFiles) {
  var re = /([/"'=])([\w.\-]+?)\?v=(\d+)/g;
  var refs = [];
  htmlFiles.forEach(function (f) {
    var s = fs.readFileSync(f, 'utf8'), m;
    while ((m = re.exec(s)) !== null) refs.push({ name: m[2], v: parseInt(m[3], 10), file: f });
  });
  return refs;
}

function byName(refs) {
  var map = {};
  refs.forEach(function (r) { (map[r.name] = map[r.name] || {}); (map[r.name][r.v] = (map[r.name][r.v] || 0) + 1); });
  return map;
}

function readSwVersion() {
  var s = fs.readFileSync(SW, 'utf8');
  var m = s.match(/CACHE_VERSION\s*=\s*['"]v(\d+)['"]/);
  return m ? parseInt(m[1], 10) : null;
}

function bumpSw() {
  var s = fs.readFileSync(SW, 'utf8');
  var m = s.match(/CACHE_VERSION\s*=\s*['"]v(\d+)['"]/);
  if (!m) { console.log('  ! CACHE_VERSION not found in service-worker.js'); return; }
  var oldN = parseInt(m[1], 10), newN = oldN + 1;
  s = s.replace(/(CACHE_VERSION\s*=\s*['"])v\d+(['"])/, '$1v' + newN + '$2');
  fs.writeFileSync(SW, s);
  console.log('  service-worker CACHE_VERSION  v' + oldN + ' -> v' + newN);
}

function bumpAsset(name, htmlFiles) {
  var re = new RegExp('([/"\'=])' + esc(name) + '\\?v=(\\d+)', 'g');
  var max = -1, hits = 0;
  htmlFiles.forEach(function (f) {
    var s = fs.readFileSync(f, 'utf8'), m;
    while ((m = re.exec(s)) !== null) { hits++; max = Math.max(max, parseInt(m[2], 10)); }
  });
  if (hits === 0) {
    console.log('  ? ' + name + '  has NO ?v= query - relying on the CACHE_VERSION bump instead');
    return;
  }
  var newV = max + 1, changed = 0;
  htmlFiles.forEach(function (f) {
    var s = fs.readFileSync(f, 'utf8');
    var out = s.replace(new RegExp('([/"\'=])' + esc(name) + '\\?v=\\d+', 'g'), '$1' + name + '?v=' + newV);
    if (out !== s) { fs.writeFileSync(f, out); changed++; }
  });
  console.log('  ' + name + '  ?v -> ' + newV + '  (' + hits + ' ref(s) in ' + changed + ' file(s))');
}

function check(htmlFiles) {
  var map = byName(collectRefs(htmlFiles));
  var names = Object.keys(map).sort();
  console.log('Versioned assets (' + names.length + '):');
  var drift = 0;
  names.forEach(function (n) {
    var vers = Object.keys(map[n]).map(Number).sort(function (a, b) { return a - b; });
    var flag = vers.length > 1 ? '   <-- DRIFT: referenced with ' + vers.length + ' different versions' : '';
    if (vers.length > 1) drift++;
    console.log('  ' + n + '  v=' + vers.join(',') + flag);
  });
  console.log('service-worker CACHE_VERSION: v' + readSwVersion());
  console.log(drift ? ('\nFAIL: ' + drift + ' asset(s) have inconsistent versions across HTML.') : '\nOK: all versions consistent.');
  return drift === 0;
}

function main() {
  var args = process.argv.slice(2);
  var htmlFiles = walkHtml(Y, []);
  if (args.length === 0 || args.indexOf('--check') !== -1) { process.exit(check(htmlFiles) ? 0 : 1); }
  if (args.length === 1 && args[0] === '--sw') { console.log('Bumping service worker only:'); bumpSw(); return; }
  var names = args.filter(function (a) { return a.indexOf('--') !== 0; });
  console.log('Bumping ' + names.length + ' asset(s) + service worker:');
  names.forEach(function (n) { bumpAsset(path.basename(n), htmlFiles); });
  bumpSw();
  console.log('\nDone. Re-run `node y/tools/bump.js --check` to confirm no drift.');
}

main();
