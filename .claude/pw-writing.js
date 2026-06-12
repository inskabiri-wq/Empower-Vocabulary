const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8099';

(async () => {
  const out = [];
  const ok = (l, c, x) => out.push((c ? 'PASS' : 'FAIL') + '  ' + l + (x ? '  — ' + x : ''));
  const browser = await chromium.launch({ headless: true });

  // Load the two dashboards (they redirect to login w/o auth, but the
  // <head>/early scripts still execute). We instead load a tiny probe
  // page that pulls in the bank + engine directly, so we can exercise
  // them without auth.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // Probe: load bank + engine, then drive the core logic headlessly.
  await page.setContent('<!doctype html><html><head></head><body><div id="essay"></div></body></html>');
  await page.addScriptTag({ url: BASE + '/assignments/js/writing-comment-bank.js' });
  await page.addScriptTag({ url: BASE + '/assignments/js/writing-annotations.js' });
  await page.waitForTimeout(300);

  // 1. Bank present + 240 essay comments
  const bankCheck = await page.evaluate(() => {
    const b = window.WRITING_COMMENT_BANK;
    if (!b) return { ok: false };
    let total = 0;
    ['CC','TA','GR','VO'].forEach(c => { for (let s=0;s<=5;s++) total += (b.essay[c][s]||[]).length; });
    return { ok: true, total, sample: b.get('essay','GR',2)[0], label: b.label('essay','CC') };
  });
  ok('comment bank loaded', bankCheck.ok);
  ok('essay bank has 240 comments', bankCheck.total === 240, 'got ' + bankCheck.total);
  ok('bank.label maps CC→Organization', bankCheck.label === 'Organization', bankCheck.label);

  // 2. Engine present
  const engineOk = await page.evaluate(() => !!(window.WritingAnnotations && WritingAnnotations.render && WritingAnnotations.getSelection && WritingAnnotations.openComposer));
  ok('annotation engine loaded', engineOk);

  // 3. render() highlights an annotation by anchor (offset + quote)
  const renderCheck = await page.evaluate(() => {
    const el = document.getElementById('essay');
    const text = 'The quick brown fox jumps over the lazy dog.';
    const anns = [{ id:'x1', criterion:'GR', score:2, text:'verb tense', quote:'jumps', start:16, end:21 }];
    const res = WritingAnnotations.render(el, text, anns, { mode:'student', rubric:'essay' });
    const mark = el.querySelector('mark.wa-hl');
    return { placed: res.placed.length, detached: res.detached.length, markText: mark ? mark.textContent : null };
  });
  ok('render anchors a highlight on the quote', renderCheck.placed === 1 && renderCheck.markText === 'jumps', JSON.stringify(renderCheck));

  // 4. re-anchor by quote search when offsets drift
  const reanchor = await page.evaluate(() => {
    const el = document.getElementById('essay');
    const text = 'PREFIX ADDED. The quick brown fox jumps over the lazy dog.';
    const anns = [{ id:'x1', criterion:'GR', score:2, text:'verb tense', quote:'jumps', start:16, end:21 }];
    const res = WritingAnnotations.render(el, text, anns, { mode:'student', rubric:'essay' });
    const mark = el.querySelector('mark.wa-hl');
    return { placed: res.placed.length, markText: mark ? mark.textContent : null };
  });
  ok('render re-anchors when text shifts (quote search)', reanchor.placed === 1 && reanchor.markText === 'jumps', JSON.stringify(reanchor));

  // 5. detached when quote is gone
  const detached = await page.evaluate(() => {
    const el = document.getElementById('essay');
    const text = 'Completely different essay text now.';
    const anns = [{ id:'x1', criterion:'GR', score:2, text:'verb tense', quote:'jumps', start:16, end:21 }];
    const res = WritingAnnotations.render(el, text, anns, { mode:'student', rubric:'essay' });
    return { placed: res.placed.length, detached: res.detached.length };
  });
  ok('render detaches a comment whose quote is gone', detached.placed === 0 && detached.detached === 1, JSON.stringify(detached));

  ok('no page/console errors', errors.length === 0, errors.slice(0,3).join(' | ') || 'clean');

  await browser.close();
  console.log('\n========= WRITING FEEDBACK v2 E2E =========\n');
  out.forEach(l => console.log('  ' + l));
  const fails = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n========= ' + (out.length - fails) + ' PASS / ' + fails + ' FAIL =========\n');
})();
