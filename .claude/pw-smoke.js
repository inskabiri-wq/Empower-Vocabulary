const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8099';

const PAGES = [
  'index.html',
  'teacher-dashboard.html',
  'student-dashboard.html',
  'classroom-teacher.html',
  'classroom-student.html',
  'classroom-heist-teacher.html',
  'classroom-heist-student.html',
  'classroom-trust-teacher.html',
  'classroom-trust-student.html',
  'classroom-reading-teacher.html',
  'classroom-reading-student.html',
  'classroom-listening-teacher.html',
  'classroom-listening-student.html',
  'writing-exam.html',
  'reset-password.html',
  '404.html',
];

function isNoise(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('favicon')) return true;
  if (t.includes('manifest')) return true;
  if (t.includes('quirks mode')) return true;
  if (t.includes('permissions policy') || t.includes('permissions-policy')) return true;
  if (t.includes('preload')) return true;
  if (t.includes('firestore') && t.includes('permission')) return true; // expected w/o auth
  if (t.includes('firebase') && t.includes('permission')) return true;
  if (t.includes('missing or insufficient permissions')) return true;   // expected w/o auth
  if (t.indexOf('net::err_') !== -1) return true; // remote firebase endpoints w/o auth
  if (t.includes('failed to load resource') && (t.includes('google') || t.includes('firestore') || t.includes('identitytoolkit'))) return true;
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const path of PAGES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedAssets = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!isNoise(text)) consoleErrors.push(text);
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.indexOf(BASE) === 0 && /\.(js|css)(\?|$)/.test(url)) {
        failedAssets.push(url.replace(BASE, '') + ' :: ' + ((req.failure() && req.failure().errorText) || 'failed'));
      }
    });

    let landedUrl = '';
    let ok = true;
    try {
      const resp = await page.goto(BASE + '/' + path, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1800);
      landedUrl = page.url().replace(BASE + '/', '');
      if (resp && resp.status() >= 400 && path !== '404.html') ok = false;
    } catch (e) {
      pageErrors.push('NAVIGATION: ' + e.message);
      ok = false;
    }

    const redirected = landedUrl && landedUrl !== path && landedUrl.indexOf(path) !== 0;
    const clean = pageErrors.length === 0 && consoleErrors.length === 0 && failedAssets.length === 0 && ok;
    results.push({ path, landedUrl, redirected, clean, pageErrors, consoleErrors, failedAssets });
    await ctx.close();
  }

  await browser.close();

  console.log('\n================ PAGE-LOAD SMOKE ================\n');
  let pass = 0, fail = 0;
  for (const r of results) {
    const status = r.clean ? 'PASS' : 'FAIL';
    if (r.clean) pass++; else fail++;
    const redir = r.redirected ? ('  (-> redirected to ' + r.landedUrl + ')') : '';
    console.log('[' + status + '] ' + r.path + redir);
    r.pageErrors.forEach(function (e) { console.log('        x EXCEPTION: ' + e); });
    r.consoleErrors.forEach(function (e) { console.log('        x CONSOLE:   ' + e); });
    r.failedAssets.forEach(function (e) { console.log('        x ASSET:     ' + e); });
  }
  console.log('\n================ ' + pass + ' PASS / ' + fail + ' FAIL ================\n');
})();
