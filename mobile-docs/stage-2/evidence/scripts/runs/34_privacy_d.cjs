const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const R = await start({ role: 'reader', tag: 'privacy' }), P = await start({ role: 'publisher', tag: 'privacy-pub' }); const r = R.page, p = P.page;
  await R.go('/profile'); await R.clickText('AYARLAR', 'main'); await r.waitForTimeout(500); await R.clickText('GİZLİLİK', 'main'); await r.waitForTimeout(500);
  const tog = async (sel, wait = 4000) => { R.clear(); const t0 = Date.now(); await r.locator(sel).evaluate(e => e.click()); await r.waitForTimeout(wait); const m = R.events.filter(e => e.vars); return m.map(e => (e.at - t0) + 'ms ' + e.op + ' ' + e.vars.slice(0, 260)); };
  await R.step('profile → private', async () => ({ m: await tog('input[aria-label="Herkese Açık Profil"]'), toasts: (await R.toasts()).slice(0, 1), state: await r.locator('main input').evaluateAll(a => a.map(e => e.checked ? 1 : 0).join('')) }));
  await R.step('follow list + library hidden + messages none', async () => { const a = await tog('input[aria-label="Takip Listesini Göster"]', 2500); const b = await tog('input[aria-label="Kitaplığı Göster"]', 2500); const c = await tog('input[name=allowMessages] >> nth=2', 2500); return { a: a.length, b: b.length, c }; });
  await P.step('publisher views private profile', async () => { const u = await P.go('/yazar/dev_reader'); await P.shot('profile/private_profile_as_non_follower'); return { u, t: one(await P.text('main', 500)), ui: (await P.ui('main', 15)).slice(0, 200) }; });
  await P.step('publisher message attempt', async () => { await P.go('/messages/6af85dd5fbba96dbf14e58ee'); const inp = p.getByPlaceholder('Mesaj yaz...'); P.clear(); if (await inp.count()) { await inp.fill('gizlilik testi'); await inp.press('Enter'); await p.waitForTimeout(1000); } return { has: await inp.count(), toasts: await P.toasts(), errs: P.gql().filter(g => g.includes('!!')), t: one(await P.text('main', 400)).slice(-160) }; });
  await P.step('mention search private user', async () => { await P.go('/kitap/docker-ornek-hikaye-dev-author'); const ta = p.getByPlaceholder('Yorumunuzu buraya yazın...'); await ta.click(); await ta.pressSequentially('@dev_r', { delay: 60 }); await p.waitForTimeout(1200); return one(await p.locator('.mention-options').innerText().catch(() => 'no options')); });
  await R.step('revert', async () => { await tog('input[aria-label="Herkese Açık Profil"]', 2500); await tog('input[aria-label="Takip Listesini Göster"]', 2500); await tog('input[aria-label="Kitaplığı Göster"]', 2500); await tog('input[name=allowMessages] >> nth=0', 2500); return r.locator('main input').evaluateAll(a => a.map(e => e.checked ? 1 : 0).join('')); });
  await R.end(); await P.end();
})();
