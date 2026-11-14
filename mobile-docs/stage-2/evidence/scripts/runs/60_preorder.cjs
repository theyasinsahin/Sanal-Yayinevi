const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
const btns = async (r) => (await r.locator('main button').evaluateAll(x => x.map(e => e.innerText.trim() + (e.disabled ? '[dis]' : '')).filter(Boolean))).join(' | ');
(async () => {
  const R = await start({ role: 'reader', tag: 'preorder' }); const r = R.page;
  await R.go('/donate/' + BID, 1500);
  await R.step('state on open', async () => ({ btns: await btns(r), ls: await r.evaluate(() => Object.keys(localStorage).filter(k => /print|checkout|fund|idem/i.test(k)).map(k => k + '=' + localStorage.getItem(k).slice(0, 80))), inputs: await r.locator('main input').evaluateAll(x => x.map(e => e.type + (e.disabled ? '[dis]' : ''))) }));
  await R.step('reset cart', async () => { if (await r.locator('main button').filter({ hasText: 'YENİ SEPET' }).count()) { await R.clickText('YENİ SEPET HAZIRLA', 'main'); await r.waitForTimeout(700); } return btns(r); });
  await R.step('fill preorder', async () => { await r.locator('main input[type=number]').fill('1', { timeout: 3000 }); await R.clickText('İLAVE DESTEK YOK', 'main'); await r.waitForTimeout(500); const info = await r.evaluate(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; const ins = [...document.querySelectorAll('main input')].filter(e => e.type === 'text' || e.type === 'tel'); const vals = ['Deneme Okur', '05321234567', 'İstanbul', 'Kadıköy', '34710', 'Deneme Mahallesi, Örnek Sokak No: 1 Daire: 2']; const tgt = ins.slice(-vals.length); tgt.forEach((e, i) => set(e, vals[i])); document.querySelectorAll('main input[type=checkbox]').forEach(c => { if (!c.checked) c.click(); }); return ins.map(e => e.type + ':' + (e.closest('label')?.innerText || '').slice(0, 14)); }); R.clear(); await R.clickText('TEST ÖDEME REZERVASYONU OLUŞTUR', 'main'); await r.waitForTimeout(2500); return { info, m: R.muts().map(x => x.replace(/:"[^"]{3,}"/g, ':"…"').slice(0, 330)), err: R.gql().filter(g => g.includes('!!')), btns: await btns(r) }; });
  await R.step('cancel', async () => { R.clear(); await R.clickText('ÖDEMEYİ İPTAL ET', 'main'); await r.waitForTimeout(2200); const t = one(await R.text('main', 4000)); const i = t.lastIndexOf('Ön sipariş:'); return { muts: R.muts().map(m => m.slice(0, 110)), card: t.slice(i - 160, i + 200), btns: await btns(r) }; });
  await R.end();
})();
