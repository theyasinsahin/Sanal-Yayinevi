const { start, SB } = require('../lib.cjs');
const B = '/kitap/docker-ornek-hikaye-dev-author';
(async () => {
  const s = await start({ role: 'reader', tag: 'comments' }); const p = s.page; await s.go(B);
  const ta = p.getByPlaceholder('Yorumunuzu buraya yazın...');
  await s.step('print interest', async () => { s.clear(); await p.locator('button:has-text("Basılmasını İstiyorum"), button:has-text("BASILMASINI İSTİYORUM")').first().click(); await p.waitForTimeout(900); const t = await s.text('main', 3000); return { muts: s.muts(), panel: t.slice(t.indexOf('Bu kitabın basılmasını'), t.indexOf('Yorumlar')).replace(/\n/g, ' | ') }; });
  await s.step('empty comment', async () => { s.clear(); const b = p.getByRole('button', { name: 'GÖNDER' }); const dis = await b.isDisabled(); if (!dis) await b.click(); await p.waitForTimeout(500); return { dis, muts: s.muts().length, toasts: await s.toasts() }; });
  await s.step('mention autocomplete', async () => { await ta.click(); await ta.pressSequentially('Harika bir kitap @dev', { delay: 60 }); await p.waitForTimeout(1200); await s.shot('comments/mention_autocomplete'); const sug = await p.evaluate(() => [...document.querySelectorAll('[class*=mention i]')].filter(e => e.getBoundingClientRect().width).map(e => e.className + ':' + e.innerText.replace(/\n/g, '/').slice(0, 150)).join(' || ')); return { sug, ops: [...new Set(s.gql())].filter(o => /search|mention|user/i.test(o)) }; });
  await s.step('pick mention', async () => { await p.locator('[class*=mention i] [role=option], [class*=mention-item i], [class*=mention-suggestion i]').filter({ hasText: 'dev_author' }).first().click(); await p.waitForTimeout(300); return await ta.inputValue(); });
  await s.step('send comment', async () => { s.clear(); await p.getByRole('button', { name: 'GÖNDER' }).click(); await p.waitForTimeout(1200); const t = await s.text('main', 4000); return { muts: s.muts(), toasts: await s.toasts(), section: t.slice(t.indexOf('Yorumlar')).replace(/\n/g, ' | ').slice(0, 400) }; });
  await s.step('comment ui', async () => p.evaluate(() => { const c = document.querySelector('[class*=comment-item i], [class*=comment-card i], [class*=comment i] li, .comment'); return c ? c.outerHTML.replace(/<svg.*?<\/svg>/gs, '<svg/>').slice(0, 1200) : 'no comment el: ' + [...new Set([...document.querySelectorAll('[class*=comment i]')].map(e => e.className))].join(' , '); }));
  await s.end();
})();
