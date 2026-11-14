const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const dumpUi = async (d) => (await d.locator('main button, main select, main input, main textarea, main summary').evaluateAll(x => x.map(e => e.tagName.toLowerCase() + ':' + (e.innerText || e.name || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().replace(/\n/g, '/').slice(0, 40) + (e.value && e.tagName !== 'BUTTON' ? '=' + String(e.value).slice(0, 14) : '') + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1500);
(async () => {
  const D = await start({ role: 'admin', tag: 'fund-admin' }); const d = D.page;
  await D.go('/admin/print-funding', 1500);
  await D.step('approve without reason', async () => { await d.locator('main select').first().selectOption({ label: 'Onayla' }); D.clear(); await D.clickText('KARARI KAYDET', 'main'); await d.waitForTimeout(1200); return { muts: D.muts().map(m => m.slice(0, 200)), toast: (await D.toasts()).slice(0, 1), invalid: await d.locator('main :invalid').count() }; });
  await D.step('approve with reason', async () => { if (await d.locator('main textarea').count()) { await d.locator('main textarea').first().fill('Stage 2 sandbox onayı.'); D.clear(); await D.clickText('KARARI KAYDET', 'main'); await d.waitForTimeout(1500); } return { muts: D.muts().map(m => m.slice(0, 220)), toast: (await D.toasts()).slice(0, 1), t: one(await D.text('main', 700)).slice(150, 500) }; });
  await D.step('campaign tab', async () => { await D.clickText('KAMPANYA VE ÜRETİM', 'main'); await d.waitForTimeout(1200); await D.shot('admin/print_funding_campaigns', { full: true }); return one(await D.text('main', 2200)).slice(130, 1700) + ' ## ' + await dumpUi(d); });
  await D.end();
})();
