const { start, SB } = require('../lib.cjs');
const D = '/dashboard/000000000000000000000201';
(async () => {
  const s = await start({ role: 'author', tag: 'dash' }); const p = s.page; const ed = p.locator('.ql-editor');
  await s.go(D); await p.getByText('Biçim Testi', { exact: true }).click(); await p.waitForTimeout(800);
  console.log('HEADER HTML:', await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /KAYDET/i.test(b.innerText)); return b.parentElement.outerHTML.replace(/<svg.*?<\/svg>/gs, '<svg/>').slice(0, 900); }));
  await s.step('more menu', async () => { await p.locator('button[aria-label*="Bölüm" i], button[title*="Bölüm" i], .chapter-actions button, button:has-text("⋯"), button:has-text("...")').first().click(); await p.waitForTimeout(400); await s.shot('editor/chapter_more_menu'); return await s.modal(); });
  await s.end();
})();
