const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const ctl = async (d) => (await d.locator('main button, main select, main input, main textarea').evaluateAll(x => x.map(e => e.tagName.toLowerCase()[0] + ':' + (e.closest('label')?.innerText || e.innerText || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().replace(/\n/g, '/').slice(0, 38) + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1300);
(async () => {
  const D = await start({ role: 'admin', tag: 'admin-fund' }); const d = D.page;
  await D.go('/admin/print-funding', 1200);
  await D.step('payments tab', async () => { await D.clickText('ÖDEME, İADE VE TESLİMAT', 'main'); await d.waitForTimeout(1500); await D.shot('admin/print_funding_payments', { full: true }); return one(await D.text('main', 2600)).slice(130, 1500) + ' ## ' + await ctl(d); });
  await D.step('refund captured payment', async () => { const ta = d.locator('main textarea').first(); if (await ta.count()) await ta.fill('Stage 2 iade testi'); D.clear(); await D.clickText('İADE', 'main'); await d.waitForTimeout(2500); return { dialogs: D.dialogs(), muts: D.muts().map(m => m.slice(0, 200)), err: D.gql().filter(g => g.includes('!!')), t: one(await D.text('main', 1500)).slice(250, 800) }; });
  await D.step('tariffs tab', async () => { await D.clickText('FİYAT TARİFELERİ', 'main'); await d.waitForTimeout(1200); await D.shot('admin/print_funding_tariffs', { full: true }); return one(await D.text('main', 1500)).slice(130, 900); });
  await D.step('maintenance run', async () => { await D.clickText('KAMPANYA VE ÜRETİM', 'main'); await d.waitForTimeout(1000); D.clear(); await D.clickText('UZLAŞTIRMA VE İADE İŞLERİNİ ŞİMDİ ÇALIŞTIR', 'main'); await d.waitForTimeout(2500); return { dialogs: D.dialogs(), muts: D.muts().map(m => m.slice(0, 120)), toast: (await D.toasts()).slice(0, 1), msg: one(await D.text('main', 600)).slice(130, 330) }; });
  await D.end();
  const R = await start({ role: 'reader', tag: 'refund-view' });
  await R.step('reader history after refund', async () => { await R.go('/funding-history', 1500); await R.shot('funding/history_after_refund', { full: true }); return one(await R.text('main', 1200)).slice(150, 700); });
  await R.end();
})();
