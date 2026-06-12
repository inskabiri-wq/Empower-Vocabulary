const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8099';

(async () => {
  const out = [];
  const ok = (label, cond, extra) => out.push((cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  — ' + extra : ''));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // 1. AppDialog is defined
  const hasAPI = await page.evaluate(() => !!(window.AppDialog && AppDialog.confirm && AppDialog.alert && AppDialog.prompt));
  ok('AppDialog API present (alert/confirm/prompt)', hasAPI);

  // 2. confirm() renders the themed overlay with title + 2 buttons
  const confirmShape = await page.evaluate(async () => {
    const p = AppDialog.confirm('Body text here', { title: 'Delete this?', okLabel: 'Delete', danger: true });
    await new Promise(r => setTimeout(r, 250));
    const ov = document.querySelector('.appdlg-overlay');
    const card = ov && ov.querySelector('.appdlg-card');
    const title = card && card.querySelector('.appdlg-title');
    const btns = card ? card.querySelectorAll('.appdlg-btn').length : 0;
    const okBtn = card && card.querySelector('.appdlg-btn.ok');
    const danger = okBtn && okBtn.classList.contains('danger');
    const res = { rendered: !!card, title: title ? title.textContent : '', btns, danger };
    // dismiss it (click cancel) so the promise resolves
    const cancel = card && card.querySelector('[data-r="cancel"]'); if (cancel) cancel.click();
    await p;
    return res;
  });
  ok('confirm renders themed card', confirmShape.rendered, 'title="' + confirmShape.title + '"');
  ok('confirm has 2 buttons', confirmShape.btns === 2, 'btns=' + confirmShape.btns);
  ok('danger variant applies', confirmShape.danger === true);

  // 3. confirm resolves the boolean correctly (OK -> true)
  const resolvesTrue = await page.evaluate(async () => {
    const p = AppDialog.confirm('x', { title: 't' });
    await new Promise(r => setTimeout(r, 200));
    const okb = document.querySelector('.appdlg-overlay .appdlg-btn.ok'); if (okb) okb.click();
    return await p;
  });
  ok('confirm OK resolves true', resolvesTrue === true);

  // 4. prompt returns typed value
  const promptVal = await page.evaluate(async () => {
    const p = AppDialog.prompt('Name?', { value: '' });
    await new Promise(r => setTimeout(r, 200));
    const inp = document.querySelector('.appdlg-overlay .appdlg-input'); if (inp) inp.value = 'Maya';
    const okb = document.querySelector('.appdlg-overlay .appdlg-btn.ok'); if (okb) okb.click();
    return await p;
  });
  ok('prompt returns typed value', promptVal === 'Maya', 'got="' + promptVal + '"');

  // 5. only one overlay at a time after dismiss (no leak)
  const leftover = await page.evaluate(() => { return new Promise(r => setTimeout(() => r(document.querySelectorAll('.appdlg-overlay').length), 400)); });
  ok('no leftover overlay after dismiss', leftover === 0, 'count=' + leftover);

  // 6. checkbox accent-color = brand indigo (brand.css global rule)
  const accent = await page.evaluate(() => {
    const cb = document.createElement('input'); cb.type = 'checkbox';
    document.body.appendChild(cb);
    const c = getComputedStyle(cb).accentColor;
    cb.remove();
    return c;
  });
  // indigo #6366f1 = rgb(99, 102, 241)
  ok('checkbox accent-color is brand indigo', /99,\s*102,\s*241/.test(accent), accent);

  await browser.close();
  console.log('\n================ DIALOGS + CHECKBOXES E2E ================\n');
  out.forEach(l => console.log('  ' + l));
  console.log('\n  page errors: ' + (errs.length ? errs.join(' | ') : 'CLEAN'));
  const fails = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n================ ' + (out.length - fails) + ' PASS / ' + fails + ' FAIL ================\n');
})();
