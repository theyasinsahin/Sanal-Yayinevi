const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const R = await start({ role: 'reader', tag: 'nonowner' }); const r = R.page;
  await R.go('/dashboard/000000000000000000000201', 1500); await R.shot('writing/dashboard_as_non_owner');
  await R.step('non-owner dashboard', async () => { const t = one(await R.text('body', 700)); await r.getByText('Örnek bölüm 1', { exact: true }).first().click(); await r.waitForTimeout(800); const ed = r.locator('.ql-editor'); const editable = await ed.getAttribute('contenteditable').catch(() => null); let save = null; if (editable === 'true') { await ed.click(); await r.keyboard.type(' [non-owner]'); R.clear(); await r.waitForTimeout(2600); save = { gql: R.gql().filter(g => /Chapter/.test(g)), badge: (one(await R.text('body', 900)).match(/KAYDED[^|]*/g) || []).slice(0, 2) }; } return { t: t.slice(0, 330), hiddenListed: t.includes('Gizli'), editable, save }; });
  await R.step('non-owner add chapter', async () => { await r.getByPlaceholder('Yeni Bölüm...').fill('Yetkisiz bölüm'); R.clear(); await R.clickText('EKLE', 'body'); await r.waitForTimeout(1200); return { gql: R.gql().filter(g => /Chapter/.test(g)), toast: (await R.toasts()).slice(0, 1) }; });
  await R.step('non-owner draft dashboard', async () => { const u = await R.go('/dashboard/000000000000000000000202', 1500); return { u, t: one(await R.text('body', 220)), err: R.gql().filter(g => g.includes('!!')).slice(0, 2) }; });
  await R.step('non-owner print page', async () => { await R.go('/print/6af85920fbba96dbf14e42be', 1500); const t = one(await R.text('main', 1500)); return { t: t.slice(180, 620), err: R.gql().filter(g => g.includes('!!')).slice(0, 2) }; });
  await R.step('draft book detail url as reader', async () => { const u = await R.go('/book-detail/000000000000000000000202', 1200); return { u, t: one(await R.text('main', 150)) }; });
  await R.end();
})();
