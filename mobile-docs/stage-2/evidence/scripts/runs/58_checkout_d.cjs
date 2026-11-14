const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
const btns = async (r) => (await r.locator('main button').evaluateAll(x => x.map(e => e.innerText.trim() + (e.disabled ? '[dis]' : '')).filter(Boolean))).join(' | ');
const tail = async (R, key, n = 500) => { const t = one(await R.text('main', 5000)); const i = t.lastIndexOf(key); return i < 0 ? '(no ' + key + ')' : t.slice(i, i + n); };
(async () => {
  const R = await start({ role: 'reader', tag: 'checkout' }); const r = R.page;
  await R.go('/donate/' + BID, 1200);
  await R.step('preorder: invalid address', async () => { await r.locator('main input[type=number]').fill('1'); await R.clickText('İLAVE DESTEK YOK', 'main'); const dis = await r.locator('main button').filter({ hasText: 'REZERVASYONU' }).isDisabled(); const lab = (l) => r.locator('main label').filter({ hasText: l }).locator('input'); await lab('Alıcı adı').fill('Deneme Okur'); await lab('Telefon').fill('123'); await lab(/^İl$|İl\b/).first().fill('İstanbul'); await lab('İlçe').fill('Kadıköy'); await lab('Posta kodu').fill('34'); await lab('Açık adres').fill('Kısa'); for (const c of await r.locator('main input[type=checkbox]').all()) await c.check(); R.clear(); await R.clickText('TEST ÖDEME REZERVASYONU OLUŞTUR', 'main'); await r.waitForTimeout(1800); return { disabledBefore: dis, gql: R.gql(), toast: (await R.toasts()).slice(0, 1), msg: one(await R.text('main', 4000)).match(/geçer[^|]*|hatalı[^|]*|olmalı[^|]*/gi) }; });
  await R.step('preorder: valid + fail + cancel', async () => { const lab = (l) => r.locator('main label').filter({ hasText: l }).locator('input'); await lab('Telefon').fill('05321234567'); await lab('Posta kodu').fill('34710'); await lab('Açık adres').fill('Deneme Mahallesi, Örnek Sokak No: 1 Daire: 2'); R.clear(); await R.clickText('TEST ÖDEME REZERVASYONU OLUŞTUR', 'main'); await r.waitForTimeout(2500); const m1 = R.muts().map(m => m.replace(/"shipping":\{[^}]*\}/, '"shipping":{…}').slice(0, 260)); const b1 = await btns(r); R.clear(); await R.clickText('BAŞARISIZ ÖDEME DENE', 'main'); await r.waitForTimeout(2500); await R.shot('funding/payment_failed'); const failed = { muts: R.muts().map(m => m.slice(0, 120)), card: await tail(R, 'Ön sipariş:', 300), btns: await btns(r) }; return { m1, err: R.gql().filter(g => g.includes('!!')), b1, failed }; });
  await R.step('retry: new + cancel', async () => { if (await r.locator('main button').filter({ hasText: 'YENİ TEST' }).count()) { await R.clickText('YENİ TEST İŞLEMİ HAZIRLA', 'main'); await r.waitForTimeout(800); } return { btns: await btns(r), form: (await tail(R, 'Sepet |', 120)) }; });
  console.log('URL', await R.go('/funding-history', 1500)); await R.shot('funding/history', { full: true });
  await R.step('history', async () => one(await R.text('main', 2200)).slice(0, 1500));
  await R.step('history btns', async () => btns(r));
  await R.end();
})();
