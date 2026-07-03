#!/usr/bin/env node
'use strict';
/* ============================================================
   preflight.js - the end-of-change safety checklist, one command.
   ------------------------------------------------------------
   Runs, in order, and prints PASS/FAIL per section (exit 1 on any
   failure):
     1. syntax-check every real .js on disk (in-process, fast);
     2. grammar-content sanity (y/tools/grammar-sanity.js);
     3. cache-version drift (y/tools/bump.js --check);
     4. data JSON parses (datasets, gateway, overrides);
     5. em-dash scan of the files you changed (pass them as args).

   Usage:
     node y/tools/preflight.js
     node y/tools/preflight.js student/js/games.js student/css/grammar.css
   (Pass the files you touched so section 5 can check them; the rest
    run globally regardless.)
   ============================================================ */
var cp = require('child_process'), fs = require('fs'), path = require('path'), vm = require('vm');
var emdash = require('./emdash-scan.js');
var Y = path.resolve(__dirname, '..');
var ROOT = path.resolve(Y, '..');

var results = [];
function section(name, ok, detail) { results.push({ name: name, ok: ok, detail: detail || '' }); }

function listJs(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (['node_modules', '.git', '.tmp'].indexOf(e.name) !== -1) return;
    var p = path.join(dir, e.name);
    if (e.isDirectory()) { if (p.indexOf(path.join('tools', 'demos')) !== -1) return; listJs(p, out); }
    else if (e.name.endsWith('.js') && !/\.min\.js$/.test(e.name) && p.indexOf(path.sep + 'vendor' + path.sep) === -1) out.push(p);
  });
  return out;
}

function jsCheck() {
  var files = listJs(Y, []);
  var bad = [];
  files.forEach(function (f) {
    try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); }
    catch (e) { bad.push(path.relative(ROOT, f) + ': ' + e.message.split('\n')[0]); }
  });
  section('syntax: node parse (' + files.length + ' js)', bad.length === 0, bad.join('\n        '));
}

function grammarSanity() {
  try {
    var out = cp.execSync('node "' + path.join(Y, 'tools', 'grammar-sanity.js') + '"', { cwd: ROOT, stdio: 'pipe' }).toString();
    section('grammar-content sanity', /PASS/.test(out), /PASS/.test(out) ? '' : out.split('\n').slice(-2).join(' '));
  } catch (e) { section('grammar-content sanity', false, String((e.stdout || '') + (e.stderr || '')).split('\n').slice(-3).join(' ')); }
}

function versionDrift() {
  try { cp.execSync('node "' + path.join(Y, 'tools', 'bump.js') + '" --check', { cwd: ROOT, stdio: 'pipe' }); section('cache-version drift', true, ''); }
  catch (e) { section('cache-version drift', false, String(e.stdout || '').split('\n').filter(function (l) { return /DRIFT|FAIL/.test(l); }).join(' ')); }
}

function dataJson() {
  var files = ['datasets.json', 'gateway_dataset.json', 'student/js/multipleChoiceOverrides.json'];
  var bad = [];
  files.forEach(function (rel) {
    var p = path.join(Y, rel); if (!fs.existsSync(p)) return;
    try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { bad.push(rel + ': ' + e.message); }
  });
  section('data JSON parses', bad.length === 0, bad.join('\n        '));
}

function emdashChanged(changed) {
  if (!changed.length) { section('em-dash (changed files)', true, 'skipped - pass changed files as args'); return; }
  var hits = [];
  changed.forEach(function (f) {
    var abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    if (!fs.existsSync(abs)) abs = path.join(Y, f);
    emdash.scan(abs).forEach(function (h) { hits.push(f + ':' + h.line + '  ' + h.text); });
  });
  section('em-dash (changed files)', hits.length === 0, hits.join('\n        '));
}

function main() {
  var changed = process.argv.slice(2).filter(function (a) { return a.indexOf('--') !== 0; });
  jsCheck(); grammarSanity(); versionDrift(); dataJson(); emdashChanged(changed);
  console.log('Lingualab preflight');
  console.log('===================');
  var allOk = true;
  results.forEach(function (r) {
    console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name);
    if (!r.ok && r.detail) console.log('        ' + r.detail);
    if (!r.ok) allOk = false;
  });
  console.log('===================');
  console.log(allOk ? 'ALL PASS' : 'FAILED - fix the above before you deploy');
  process.exit(allOk ? 0 : 1);
}
main();
