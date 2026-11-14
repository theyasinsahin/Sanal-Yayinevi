const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const R = await start({ role: 'reader', tag: 'privacy' }), P = await start({ role: 'publisher', tag: 'privacy-pub' }); const r = R.page, p = P.page;
  await R.go('/profile'); await R.clickText('AYARLAR', 'main'); await r.waitForTimeout(500); await R.clickText('GİZLİLİK', 'main'); await r.waitForTimeout(500);
  const tog = async (sel) => { R.clear(); await r.locator(sel).evaluate(e => e.click()); await r.waitForTimeout(900); return R.muts(); };
  await R.step('state', async () => r.locator('main input').evaluateAll(a => a.map(e => (e.getAttribute('aria-label') || e.name + ':' + e.value) + '=' + e.checked)));
  await R.step('profile → private', async () => tog('input[aria-label="Herkese Açık Profil"]'));
  await R.step('follow list hidden', async () => tog('input[aria-label="Takip Listesini Göster"]'));
  await R.step('library hidden', async () => tog('input[aria-label="Kitaplığı Göster"]'));
  await R.step('messages → Kimse', async () => tog('input[name=allowMessages] >> nth=2'));
  await P.step('publisher views private profile', async () => { const u = await P.go('/yazar/dev_reader'); await P.shot('profile/private_profile_as_non_follower'); return { u, t: one(await P.text('main', 400)), ui: (await P.ui('main', 15)).slice(0, 260) }; });
  await P.step('publisher message attempt', async () => { if (!(await p.locator('main button').filter({ hasText: /MESAJ/i }).count())) return 'no message button'; P.clear(); await P.clickText('MESAJ GÖNDER', 'main'); await p.waitForTimeout(1200); const inp = p.getByPlaceholder('Mesaj yaz...'); if (await inp.count()) { await inp.fill('test'); await inp.press('Enter'); await p.waitForTimeout(900); } return { url: p.url().slice(21), toasts: await P.toasts(), errs: P.gql().filter(g => g.includes('!!')), t: one(await P.text('main', 300)).slice(-150) }; });
  await P.step('mention search private user', async () => { await P.go('/kitap/docker-ornek-hikaye-dev-author'); const ta = p.getByPlaceholder('Yorumunuzu buraya yazın...'); await ta.click(); await ta.pressSequentially('@dev_r', { delay: 60 }); await p.waitForTimeout(1200); return one(await p.locator('.mention-options').innerText().catch(() => 'no options')); });
  await R.step('revert', async () => { await tog('input[aria-label="Herkese Açık Profil"]'); await tog('input[aria-label="Takip Listesini Göster"]'); await tog('input[aria-label="Kitaplığı Göster"]'); await tog('input[name=allowMessages] >> nth=0'); await R.clickText('BİLDİRİMLER', 'main'); await r.waitForTimeout(400); const m = await tog('input[aria-label="Kitaba Beğeni"]'); await tog('input[aria-label="Kitaba Beğeni"]'); return m; });
  await R.end(); await P.end();
})();
