const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const P = await start({ role: 'publisher', tag: 'quotes-pub' }); const p = P.page;
  await P.go('/quotes'); const act = p.locator('.quote-card .quote-card-action-btn');
  await P.step('repost w/ comment', async () => { await act.nth(1).click(); await p.getByPlaceholder(/Yeniden paylaşım yorumu/).fill('Katılıyorum'); P.clear(); await P.clickText('Yeniden Paylaş', '.quote-card', 0); await p.waitForTimeout(1000); return { muts: P.muts(), text: one(await P.text('main', 600)).slice(-300) }; });
  await P.step('undo repost', async () => { P.clear(); await act.nth(1).click(); await p.waitForTimeout(900); return { muts: P.muts(), dialogs: P.dialogs(), form: await p.getByPlaceholder(/Yeniden paylaşım yorumu/).count() }; });
  await P.step('quote comment', async () => { await act.nth(0).click(); await p.waitForTimeout(600); const i = p.getByPlaceholder('Yorum yaz...'); await i.fill('Güzel alıntı'); P.clear(); await i.press('Enter'); await p.waitForTimeout(1000); await P.shot('quotes/card_comments'); return { muts: P.muts(), text: one(await P.text('main', 700)).slice(-200), del: await p.locator('.quote-card [aria-label*=sil i], .quote-card [class*=delete i]').count() }; });
  await P.end();
  const R = await start({ role: 'reader', tag: 'settings' }); const r = R.page;
  await R.go('/profile');
  await R.step('reader notifs (repost/like)', async () => { await r.getByRole('button', { name: 'Bildirimler' }).first().click(); await r.waitForTimeout(800); const t = one((await r.locator('.notif-list').innerText()).slice(0, 330)); await r.locator('.notif-overlay').click({ position: { x: 5, y: 500 } }); return t; });
  await R.step('edit profile modal', async () => { await R.clickText('DÜZENLE', 'main'); await r.waitForTimeout(700); await R.shot('profile/edit_modal'); return (await R.modal()).slice(0, 500) + ' ## ' + await r.evaluate(() => [...document.querySelectorAll('[class*=modal i] input, [class*=modal i] textarea, [class*=modal i] button')].map(e => e.tagName + ':' + (e.name || e.placeholder || e.innerText || e.type).slice(0, 30) + (e.maxLength > 0 ? ' max' + e.maxLength : '')).join(' | ')); });
  await R.step('save profile', async () => { const bio = r.locator('[class*=modal i] textarea').first(); if (await bio.count()) await bio.fill('Stage 2 biyografi ✍️'); const name = r.locator('[class*=modal i] input[type=text]').first(); await name.fill('Docker Reader Düzenlendi'); R.clear(); await R.clickText('Kaydet', '[class*=modal i]'); await r.waitForTimeout(1200); return { muts: R.muts(), toasts: await R.toasts(), head: one(await R.text('main', 150)) }; });
  await R.step('settings tab', async () => { await R.clickText('AYARLAR', 'main'); await r.waitForTimeout(900); await R.shot('settings/overview', { full: true }); const t = one(await R.text('main', 3500)); return t.slice(t.indexOf('AYARLAR') + 8); });
  await R.step('settings ui', async () => { const u = await R.ui('main', 90); return u.slice(u.indexOf('AYARLAR')); });
  await R.end();
})();
