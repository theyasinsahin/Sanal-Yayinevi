const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
const dumpUi = async (d) => (await d.locator('main button, main select, main input, main textarea').evaluateAll(x => x.map(e => e.tagName.toLowerCase() + ':' + (e.closest('label')?.innerText || e.innerText || e.name || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().replace(/\n/g, '/').slice(0, 40) + (e.type && e.tagName === 'INPUT' ? '(' + e.type + ')' : '') + (e.required ? '*' : '') + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1500);
(async () => {
  const R = await start({ role: 'reader', tag: 'checkout' }); const r = R.page;
  await R.go('/donate/' + BID, 1500);
  await R.step('donation only 100', async () => { await R.clickText('₺100,00', 'main'); await r.waitForTimeout(300); const total = one(await R.text('main', 2500)).match(/Sepet toplamı[^|]*/); await r.locator('main input[type=checkbox]').check(); R.clear(); await R.clickText('TEST ÖDEME REZERVASYONU OLUŞTUR', 'main'); await r.waitForTimeout(2500); await R.shot('funding/payment_card_pending', { full: true }); return { total, muts: R.muts().map(m => m.slice(0, 300)), url: r.url().slice(21), toast: (await R.toasts()).slice(0, 1) }; });
  await R.step('after reservation', async () => { const t = one(await R.text('main', 3500)); return t.slice(t.indexOf('Sepet toplamı') > 0 ? t.indexOf('Sepet toplamı') : 600).slice(0, 1200); });
  await R.step('ui', async () => dumpUi(r));
  await R.end();
})();
