const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
const dumpUi = async (d) => (await d.locator('main button, main select, main input, main textarea').evaluateAll(x => x.map(e => e.tagName.toLowerCase() + ':' + (e.closest('label')?.innerText || e.innerText || e.name || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().replace(/\n/g, '/').slice(0, 40) + (e.type && e.tagName === 'INPUT' ? '(' + e.type + ')' : '') + (e.value && e.tagName !== 'BUTTON' ? '=' + String(e.value).slice(0, 12) : '') + (e.required ? '*' : '') + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1700);
(async () => {
  const R = await start({ role: 'reader', tag: 'checkout' }); const r = R.page;
  await R.go('/book-detail/' + BID, 1500); await R.shot('funding/detail_campaign_card', { full: true });
  await R.step('detail funding panel', async () => { const t = one(await R.text('main', 3500)); const i = t.indexOf('Eser hakkında'); const j = t.indexOf('Yorumlar'); return { url: r.url().slice(21), panel: t.slice(t.indexOf('İçerik uyarıları'), j).slice(0, 900), top: t.slice(0, 260) }; });
  console.log('URL', await R.go('/donate/' + BID, 1500)); await R.shot('funding/checkout', { full: true });
  await R.step('checkout page', async () => one(await R.text('main', 2500)).slice(0, 1700));
  await R.step('checkout ui', async () => dumpUi(r));
  await R.end();
})();
