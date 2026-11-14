const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const R = await start({ role: 'reader', tag: 'settings' }); const r = R.page;
  await R.go('/profile');
  await R.step('edit profile', async () => { await R.clickText('DÜZENLE', 'main'); await r.waitForTimeout(700); await R.shot('profile/edit_mode'); const u = await R.ui('main', 30); return one(await R.text('main', 400)) + ' ## ' + u.slice(0, 700) + ' ## inputs: ' + await r.locator('main input, main textarea').evaluateAll(a => a.map(e => (e.name || e.placeholder || e.type) + '=' + String(e.value).slice(0, 20) + (e.maxLength > 0 ? ' max' + e.maxLength : '')).join(' | ')); });
  await R.step('save profile', async () => { const ins = r.locator('main input[type=text]'); await ins.first().fill('Docker Reader Düzenlendi'); const bio = r.locator('main textarea').first(); if (await bio.count()) await bio.fill('Stage 2 biyografi ✍️'); R.clear(); await R.clickText('KAYDET', 'main'); await r.waitForTimeout(1200); return { muts: R.muts(), toasts: await R.toasts(), head: one(await R.text('main', 200)) }; });
  await R.clickText('AYARLAR', 'main'); await r.waitForTimeout(600);
  for (const tab of ['GİZLİLİK', 'BİLDİRİMLER', 'YAZAR', 'GÖRÜNÜM', 'HESABI SİL']) await R.step('tab ' + tab, async () => { await R.clickText(tab, 'main'); await r.waitForTimeout(700); await R.shot('settings/' + tab.toLowerCase().replace(/[^a-z]/g, '_')); const t = one(await R.text('main', 4000)); const u = await R.ui('main', 90); return t.slice(t.indexOf('HESABI SİL') + 11, t.indexOf('HESABI SİL') + 900) + ' ## ' + u.slice(u.lastIndexOf('"HESABI SİL"') + 13); });
  await R.end();
})();
