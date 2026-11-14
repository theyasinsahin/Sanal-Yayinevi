const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const U = '/kitap/stage2-basili-deneme-docker-author';
(async () => {
  const D = await start({ role: 'admin', tag: 'printed-admin' }); const d = D.page;
  await D.go('/admin/printed-books');
  await D.step('approve', async () => { D.clear(); await D.clickText('ONAYLA', 'main'); await d.waitForTimeout(1200); return { dialogs: D.dialogs(), muts: D.muts().map(m => m.slice(0, 160)), toast: (await D.toasts()).slice(0, 1) }; });
  const R = await start({ role: 'reader', tag: 'printed' }); const r = R.page;
  await R.step('catalogue after approve', async () => { await R.go('/printed-books'); const t = one(await R.text('main', 700)); const href = await r.locator('main a[href^="/kitap/"]').evaluateAll(a => a.map(x => x.getAttribute('href'))); return { t: t.slice(150, 420), href }; });
  const href = (await r.locator('main a[href^="/kitap/"]').evaluateAll(a => a.map(x => x.getAttribute('href')))).find(h => h.includes('stage2')) || U;
  await R.step('printed detail', async () => { await R.go(href); await R.shot('printed/detail_member', { full: true }); return one(await R.text('main', 1600)).slice(0, 1300) + ' ## ' + (await R.ui('main', 40)).slice(0, 900); });
  await R.step('reader notifs', async () => { await r.getByRole('button', { name: 'Bildirimler' }).first().click(); await r.waitForTimeout(800); const t = one((await r.locator('.notif-list').innerText()).slice(0, 160)); await r.locator('.notif-overlay').click({ position: { x: 5, y: 500 } }); return t; });
  await D.end(); await R.end();
  console.log('HREF', href);
})();
