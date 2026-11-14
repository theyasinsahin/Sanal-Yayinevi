const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const A = await start({ role: 'author', tag: 'sess-author' }), R = await start({ role: 'reader', tag: 'sess-reader' }); const a = A.page, r = R.page;
  await A.go('/sessions'); await A.clickText('OTURUM AÇ', 'main'); await a.waitForTimeout(500);
  await A.step('create empty', async () => { A.clear(); await A.clickText('OTURUM OLUŞTUR', '.sessions-modal'); await a.waitForTimeout(600); return { muts: A.muts().length, msg: one(await a.locator('.sessions-modal').innerText()).match(/zorunlu[^|]*|gerekli[^|]*|en az[^|]*/gi), toasts: await A.toasts() }; });
  await A.step('create public', async () => { await a.getByPlaceholder('Oturum konusu...').fill('Stage2 Açık Oturum'); await a.getByPlaceholder('Kısa bir açıklama ekleyin...').fill('Canlı güncelleme testi için açık oturum.'); await a.getByPlaceholder('Etiket yazıp ekle...').fill('deneme'); await A.clickText('EKLE', '.sessions-modal'); A.clear(); await A.clickText('OTURUM OLUŞTUR', '.sessions-modal'); await a.waitForTimeout(1500); await A.shot('sessions/list_with_session'); return { muts: A.muts(), url: a.url().slice(21), text: one(await A.text('main', 400)) }; });
  await A.step('open session', async () => { if (!a.url().includes('/oturum/')) { await a.locator('.session-card').first().click(); await a.waitForTimeout(1500); } await A.shot('sessions/detail_author'); return { url: a.url().slice(21), text: one(await A.text('main', 500)), ui: await A.ui('main', 30), ws: A.ws().filter(w => /subscribe/.test(w)).map(w => (w.match(/operationName":"(\w+)/) || [])[1]) }; });
  const url = a.url().slice(21);
  await R.go(url);
  await R.step('reader view', async () => ({ ui: await R.ui('main', 20) }));
  await A.step('post entry', async () => { const ta = a.locator('main textarea').first(); await ta.fill('İlk gönderi: merhaba @dev_reader'); A.clear(); await a.locator('main button').filter({ hasText: /gönder|paylaş/i }).last().click(); await a.waitForTimeout(1000); return { muts: A.muts(), max: await ta.getAttribute('maxlength') }; });
  await R.step('reader sees entry live', async () => { for (let i = 0; i < 10; i++) { if ((await R.text('main', 1500)).includes('İlk gönderi')) return { afterSec: i }; await r.waitForTimeout(1000); } return 'no'; });
  await R.step('reader posts + likes', async () => { const ta = r.locator('main textarea').first(); await ta.fill('Okurdan yanıt.'); R.clear(); await r.locator('main button').filter({ hasText: /gönder|paylaş/i }).last().click(); await r.waitForTimeout(900); const html = await r.evaluate(() => { const e = [...document.querySelectorAll('[class*=entry i]')].find(x => x.innerText.includes('İlk gönderi') && x.querySelector('button')); return e ? e.outerHTML.replace(/<svg.*?<\/svg>/gs, '<svg/>').slice(0, 900) : 'none'; }); return { muts: R.muts(), html }; });
  await R.shot('sessions/detail_reader_entries');
  await A.end(); await R.end();
  console.log('SESSION_URL', url);
})();
