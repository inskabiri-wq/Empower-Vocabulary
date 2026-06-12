const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8099';
const PROBE = 'E:/vocab-trainer/y/__pwa_probe.html';

function writeProbe(marker) {
  fs.writeFileSync(PROBE,
    '<!doctype html><html><head><meta charset="utf-8"><title>probe</title>' +
    '<link rel="manifest" href="/manifest.json"></head>' +
    '<body><h1 id="m">' + marker + '</h1>' +
    '<script src="/pwa-register.js"></script></body></html>', 'utf8');
}

(async () => {
  const results = [];
  const ok = (label, cond, extra) => results.push((cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  — ' + extra : ''));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ── 1. manifest loads + valid ──
  let manifestOk = false, manifestName = '';
  try {
    const r = await page.request.get(BASE + '/manifest.json');
    const j = await r.json();
    manifestName = j.name;
    manifestOk = r.ok() && j.name === 'Empower Lab' && Array.isArray(j.icons) && j.icons.length >= 2;
  } catch (e) {}
  ok('manifest.json loads + valid', manifestOk, 'name="' + manifestName + '"');

  // ── 2. SW registers + activates on index.html ──
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  // Wait for the SW to take control.
  let controlled = false;
  for (let i = 0; i < 30; i++) {
    controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
    if (controlled) break;
    await page.waitForTimeout(300);
  }
  ok('service worker registers + controls the page', controlled);

  // ── 3. cache populated with the shell ──
  const cacheInfo = await page.evaluate(async () => {
    const keys = await caches.keys();
    let entries = [];
    for (const k of keys) {
      const c = await caches.open(k);
      const reqs = await c.keys();
      entries = entries.concat(reqs.map(r => r.url));
    }
    return { keys, entries };
  });
  ok('versioned cache exists', cacheInfo.keys.some(k => k.indexOf('empower-shell-') === 0), cacheInfo.keys.join(','));
  ok('shell cached (index.html present)', cacheInfo.entries.some(u => u.indexOf('/index.html') !== -1));

  // ── 4. NO cross-origin entries cached (firebase/google never touched) ──
  const crossOrigin = cacheInfo.entries.filter(u => u.indexOf(BASE) !== 0);
  ok('no cross-origin (firebase/google) entries cached', crossOrigin.length === 0,
     crossOrigin.length ? crossOrigin.slice(0,3).join(' | ') : 'clean');

  // ── 5. UPDATE test (network-first HTML never goes stale) ──
  // Probe page: cache VERSION_A, change file to VERSION_B, reload online,
  // expect VERSION_B (proves the SW serves fresh HTML, not stale cache).
  writeProbe('VERSION_A');
  await page.goto(BASE + '/__pwa_probe.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const a = await page.locator('#m').innerText();
  writeProbe('VERSION_B');
  await page.goto(BASE + '/__pwa_probe.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const b = await page.locator('#m').innerText();
  ok('HTML is network-first (fresh after change, no stale cache)', a === 'VERSION_A' && b === 'VERSION_B', a + ' -> ' + b);

  // ── 6. OFFLINE fallback (cached shell serves when network is down) ──
  await ctx.setOffline(true);
  let offlineWorks = false, offlineText = '';
  try {
    await page.goto(BASE + '/__pwa_probe.html', { waitUntil: 'load', timeout: 8000 });
    offlineText = await page.locator('#m').innerText();
    offlineWorks = offlineText.length > 0;
  } catch (e) { offlineText = 'nav-failed: ' + e.message; }
  ok('offline: cached page still loads', offlineWorks, offlineText);
  await ctx.setOffline(false);

  await browser.close();
  try { fs.unlinkSync(PROBE); } catch (_) {}

  console.log('\n================ PWA E2E ================\n');
  results.forEach(r => console.log('  ' + r));
  const fails = results.filter(r => r.indexOf('FAIL') === 0).length;
  console.log('\n================ ' + (results.length - fails) + ' PASS / ' + fails + ' FAIL ================\n');
})();
