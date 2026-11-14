const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
const btns = async (r) => (await r.locator('main button').evaluateAll(x => x.map(e => e.innerText.trim() + (e.disabled ? '[dis]' : '')).filter(Boolean))).join(' | ');
const card = async (R) => { const t = one(await R.text('main', 4000)); const i = t.indexOf('Ön sipariş:'); return t.slice(Math.max(0, i - 260), i + 420); };
(async () => {
  const R = await start({ role: 'reader', tag: 'checkout' }); const r = R.page;
  await R.go('/donate/' + BID, 1500);
  await R.step('resume pending after reload', async () => ({ card: await card(R), btns: await btns(r) }));
  await R.step('simulate failure', async () => { R.clear(); await R.clickText('BAŞARISIZ ÖDEME DENE', 'main'); await r.waitForTimeout(2500); await R.shot('funding/payment_failed'); return { muts: R.muts().map(m => m.slice(0, 160)), http: R.events.filter(e => e.t === 'http').map(e => e.m), card: await card(R), btns: await btns(r) }; });
  await R.step('new reservation + success', async () => { if (!(await r.locator('main button').filter({ hasText: 'BAŞARILI' }).count())) { await R.go('/donate/' + BID, 1200); await R.clickText('₺100,00', 'main'); await r.locator('main input[type=checkbox]').check(); await R.clickText('TEST ÖDEME REZERVASYONU OLUŞTUR', 'main'); await r.waitForTimeout(2500); } R.clear(); await R.clickText('TEST ÖDEMESİNİ BAŞARILI SONUÇLANDIR', 'main'); await r.waitForTimeout(3000); await R.shot('funding/payment_success', { full: true }); return { muts: R.muts().map(m => m.slice(0, 160)), card: await card(R), btns: await btns(r), top: one(await R.text('main', 500)).slice(150, 420) }; });
  await R.step('preorder 1 book', async () => { await R.go('/donate/' + BID, 1200); await r.locator('main input[type=number]').fill('1'); await R.clickText('İLAVE DESTEK YOK', 'main'); await r.waitForTimeout(400); const t = one(await R.text('main', 3500)); const extra = t.slice(t.indexOf('Sepet |')).slice(0, 900); const fields = await r.locator('main input, main select, main textarea').evaluateAll(x => x.map(e => (e.closest('label')?.innerText || e.name || e.placeholder || '').replace(/\n/g, '/').slice(0, 30) + '(' + e.type + ')' + (e.required ? '*' : ''))); await R.shot('funding/checkout_preorder', { full: true }); return { extra, fields }; });
  await R.end();
})();
