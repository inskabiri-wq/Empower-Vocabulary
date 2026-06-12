const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const out = [];

  // ── Test 1: login page renders usable controls ──
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const emails = await page.locator('input[type="email"], input#email, input[name="email"]').count();
    const pws    = await page.locator('input[type="password"]').count();
    const btns   = await page.locator('button, input[type="submit"]').count();
    const googleBtn = await page.locator('text=/google|sign in/i').count();
    out.push('LOGIN PAGE: email inputs=' + emails + ', password inputs=' + pws + ', buttons=' + btns + ', google/signin text=' + googleBtn);
    await ctx.close();
  }

  // ── Test 2: student join page renders + Firestore read works ──
  // Enter a bogus 4-char code and submit; expect a "not found" path
  // (proves real Firestore connectivity + the join error handling,
  //  read-only, writes nothing).
  for (const sp of ['classroom-trust-student.html', 'classroom-reading-student.html', 'classroom-listening-student.html', 'classroom-heist-student.html']) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + '/' + sp, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const codeInput = page.locator('#codeInput');
    const nameInput = page.locator('#nameInput');
    const hasJoinForm = (await codeInput.count()) > 0 && (await nameInput.count()) > 0;
    let toastSeen = false;
    if (hasJoinForm) {
      try {
        await codeInput.fill('ZZZZ');
        await nameInput.fill('E2E Bot');
        await page.locator('#joinBtn').click();
        // Wait for the themed toast ("Room not found") — Firestore read came back.
        await page.waitForTimeout(2500);
        const bodyText = (await page.locator('body').innerText()).toLowerCase();
        toastSeen = bodyText.includes('not found') || bodyText.includes('room') || (await page.locator('.trust-toast, .listening-toast, .heist-toast, .reading-toast').count()) > 0;
      } catch (e) { errs.push('JOIN: ' + e.message); }
    }
    out.push(sp + ': joinForm=' + hasJoinForm + ', badCodeHandled=' + toastSeen + ', pageErrors=' + errs.length + (errs.length ? (' [' + errs.join(' | ') + ']') : ''));
    await ctx.close();
  }

  await browser.close();
  console.log('\n================ INTERACTION CHECKS ================\n');
  out.forEach(l => console.log('  ' + l));
  console.log('\n===================================================\n');
})();
