const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const R = await start({ role: 'reader', tag: 'printed' }); const r = R.page;
  await R.go('/printed-books'); await R.clickText('BASILI KİTAP EKLE', 'main'); await r.waitForTimeout(600);
  await R.step('isbn lookup (invalid)', async () => { await r.locator('input[name=isbn]').fill('123'); R.clear(); await R.clickText('ISBN İLE BUL', 'main'); await r.waitForTimeout(1200); return { ops: R.gql(), toast: (await R.toasts()).slice(0, 1), msg: one(await R.text('main', 700)).match(/ISBN[^|]{10,}/g) }; });
  await R.step('submit', async () => { await r.locator('input[name=isbn]').fill(''); await r.locator('input[name=title]').fill('Stage2 Basılı Deneme'); await r.locator('input[name=printedAuthor]').fill('Docker author'); await r.locator('input[name=publisher]').fill('Deneme Yayınları'); await r.locator('input[name=publicationYear]').fill('2021'); await r.locator('input[name=pageCount]').fill('240'); await r.locator('main form select').first().selectOption({ label: 'Roman' }); await r.locator('main form input[type=checkbox]').first().check(); await r.locator('textarea[name=description]').fill('Stage 2 için basılı kitap ekleme isteği.'); await r.locator('input[name=publicationEvidenceUrl]').fill('https://example.org/kanit'); R.clear(); await r.locator('main form button[type=submit]').click(); await r.waitForTimeout(1800); await R.shot('printed/after_submit'); return { muts: R.muts().map(m => m.slice(0, 330)), toast: (await R.toasts()).slice(0, 1), t: one(await R.text('main', 900)).slice(150, 600) }; });
  await R.step('my submissions (profile?)', async () => { const links = await r.locator('main a, main button').evaluateAll(a => a.map(e => e.innerText.trim()).filter(t => /katkı|istek|başvuru/i.test(t))); return links; });
  await R.end();
  const D = await start({ role: 'admin', tag: 'printed-admin' }); const d = D.page;
  await D.go('/admin/printed-books'); await D.shot('admin/printed_review');
  await D.step('admin printed queue', async () => one(await D.text('main', 900)) + ' ## ' + (await D.ui('main', 40)).slice(0, 700));
  await D.end();
})();
