const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const P = await start({ role: 'publisher', tag: 'onboard' });
  await P.step('for-you without prefs (onboarding)', async () => { await P.go('/feed?tab=for-you', 1500); await P.shot('discovery/genre_onboarding'); const t = one(await P.text('main', 3000)); return t.slice(t.indexOf('Senin için')).slice(0, 500); });
  await P.end();
  const R = await start({ role: 'reader', tag: 'printed' }); const r = R.page;
  await R.go('/printed-books'); await R.shot('printed/catalogue_member');
  await R.step('catalogue', async () => one(await R.text('main', 600)) + ' ## ' + await R.ui('main', 25));
  await R.step('filters expand', async () => { await R.clickText('Eser biçimi, tür ve diğer filtreler', 'main'); await r.waitForTimeout(500); return one(await R.text('main', 900)).slice(250, 700); });
  await R.step('search none', async () => { const i = r.locator('main input').first(); await i.fill('zzzqqq'); R.clear(); await i.press('Enter'); await r.waitForTimeout(1300); const t = one(await R.text('main', 900)).slice(-200); await i.fill(''); await i.press('Enter'); await r.waitForTimeout(900); return { ops: R.gql(), t }; });
  await R.step('open add form', async () => { await R.clickText('Kitap ekle', 'main').catch(() => R.clickText('ekle', 'main')); await r.waitForTimeout(800); await R.shot('printed/submit_form', { full: true }); return one(await R.text('main', 1500)).slice(0, 1100) + ' ## ' + (await r.locator('main form input, main form textarea, main form select, [class*=modal i] input, [class*=modal i] textarea, [class*=modal i] select').evaluateAll(a => a.map(e => (e.name || e.id || e.placeholder) + ':' + e.type + (e.required ? '*' : '')).join(' | '))); });
  await R.end();
})();
