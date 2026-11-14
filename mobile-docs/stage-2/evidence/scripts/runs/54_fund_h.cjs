const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const B = '/kitap/stage2-deneme-romani-cag-isik-dev-author';
(async () => {
  const D = await start({ role: 'admin', tag: 'fund-admin' }); const d = D.page;
  await D.go('/admin/print-funding', 1500);
  await D.step('open campaign', async () => { await d.locator('main input[type=checkbox]').last().check(); D.clear(); await D.clickText('ONAYLI SANDBOX KAMPANYASINI AÇ', 'main'); await d.waitForTimeout(2500); return { dialogs: D.dialogs(), muts: D.muts().map(m => m.slice(0, 250)), toast: (await D.toasts()).slice(0, 1) }; });
  await D.step('campaign tab', async () => { await D.clickText('KAMPANYA VE ÜRETİM', 'main'); await d.waitForTimeout(1500); await D.shot('admin/print_funding_campaigns', { full: true }); const t = one(await D.text('main', 2500)); return t.slice(130, 1300) + ' ## ' + (await d.locator('main button, main select').evaluateAll(x => x.map(e => (e.innerText || '').trim().replace(/\n/g, '/').slice(0, 45) + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 700); });
  await D.end();
  const R = await start({ role: 'reader', tag: 'fund-reader' }); const r = R.page;
  await R.step('book detail funding panel', async () => { const hrefs = await (async () => { await R.go('/feed'); return r.locator('main a[href^="/kitap/"]').evaluateAll(a => [...new Set(a.map(x => x.getAttribute('href')))]); })(); const h = hrefs.find(x => x.includes('stage2')) ; await R.go(h, 1500); await R.shot('funding/detail_campaign_card', { full: true }); const t = one(await R.text('main', 3500)); const i = t.search(/kampanya|Destek/i); return { h, panel: t.slice(t.indexOf('Hikaye Özeti') > 0 ? t.indexOf('Eser hakkında') : 0).slice(0, 100) + ' … ' + t.slice(t.indexOf('basılmasını') - 60).slice(0, 900) }; });
  await R.step('feed card + filters with campaign', async () => { await R.go('/feed'); await R.clickText('Desteği açık kitaplar', 'main'); await r.waitForTimeout(1200); await R.shot('discovery/feed_open_campaign'); const t = one(await R.text('main', 3000)); return t.slice(t.indexOf('listeleniyor') - 10).slice(0, 400); });
  await R.end();
})();
