const { start, SB } = require('../lib.cjs');
const short = u => u.replace('http://localhost:3055', '');
(async () => {
  const A = await start({ role: 'author', tag: 'fm-author' }), R = await start({ role: 'reader', tag: 'fm-reader' }); const a = A.page, r = R.page;
  await A.go('/feed'); await R.go('/yazar/dev_author');
  const followBtns = async () => (await r.locator('main button').allInnerTexts()).filter(t => /TAK|İST|STE/i.test(t));
  await R.step('send follow request', async () => { R.clear(); await R.clickText('TAKİP İSTEĞİ GÖNDER', 'main'); await r.waitForTimeout(1000); return { muts: R.muts(), btns: await followBtns(), toasts: await R.toasts() }; });
  await R.step('cancel request', async () => { R.clear(); const b = (await followBtns())[0]; await R.clickText(b, 'main'); await r.waitForTimeout(1000); return { clicked: b, dialogs: R.dialogs(), muts: R.muts(), btns: await followBtns() }; });
  await R.step('send again', async () => { await R.clickText('TAKİP İSTEĞİ GÖNDER', 'main'); await r.waitForTimeout(800); return await followBtns(); });
  await A.step('author bell live badge (wait up to 20s, no reload)', async () => { for (let i = 0; i < 20; i++) { const t = await a.locator('.notif-bell-wrapper').first().innerText(); if (t.trim()) return { badge: t.trim(), afterSec: i }; await a.waitForTimeout(1000); } return 'no badge in 20s'; });
  await A.step('requests in panel', async () => { await a.getByRole('button', { name: 'Bildirimler' }).first().click(); await a.waitForTimeout(1000); await A.shot('notifications/follow_request_in_panel'); const t = (await a.locator('.notif-dropdown').innerText()).replace(/\n/g, ' | '); return t.slice(0, 350); });
  await A.step('accept', async () => { A.clear(); await A.clickText('Kabul', '.notif-dropdown').catch(async () => A.clickText('Onayla', '.notif-dropdown')); await a.waitForTimeout(1000); return { muts: A.muts(), panel: (await a.locator('.notif-dropdown').innerText()).replace(/\n/g, ' | ').slice(0, 200) }; });
  await R.step('reader state without reload (10s)', async () => { await r.waitForTimeout(10000); return await followBtns(); });
  await R.step('reader after reload', async () => { await R.go('/yazar/dev_author'); return { btns: await followBtns(), head: (await R.text('main', 160)).replace(/\n/g, ' | ') }; });
  await R.step('reader notifications', async () => { await r.getByRole('button', { name: 'Bildirimler' }).first().click(); await r.waitForTimeout(900); const t = (await r.locator('.notif-dropdown').innerText()).replace(/\n/g, ' | ').slice(0, 500); await r.locator('.notif-overlay').click({ position: { x: 5, y: 500 } }); return t; });
  await R.step('followers list modal', async () => { await R.clickText('TAKİPÇİLER', 'main'); await r.waitForTimeout(900); await R.shot('profile/followers_modal'); const m = await R.modal(); await r.keyboard.press('Escape'); return m.slice(0, 300); });
  // messaging realtime
  await A.go('/messages'); await A.shot('messaging/list_author');
  await A.step('author conv list', async () => (await A.text('main', 400)).replace(/\n/g, ' | '));
  await R.go('/messages'); await r.locator('main button').filter({ hasText: 'Docker author' }).first().click(); await r.waitForTimeout(800);
  await R.step('send message', async () => { const inp = r.getByPlaceholder('Mesaj yaz...'); await inp.fill('Merhaba, bu bir test mesajı 👋'); R.clear(); await inp.press('Enter'); await r.waitForTimeout(1000); return { muts: R.muts(), inputAfter: await inp.inputValue(), max: await inp.getAttribute('maxlength') }; });
  await A.step('author receives live (no reload)', async () => { for (let i = 0; i < 15; i++) { const t = await A.text('main', 600); if (t.includes('test mesajı')) return { afterSec: i, list: t.replace(/\n/g, ' | ').slice(0, 250), navBadge: await a.locator('nav a[href="/messages"]').first().innerText() }; await a.waitForTimeout(1000); } return 'not received in 15s'; });
  await A.step('author opens chat & replies', async () => { await a.locator('main button').filter({ hasText: 'Docker reader' }).first().click(); await a.waitForTimeout(900); const inp = a.getByPlaceholder('Mesaj yaz...'); await inp.fill('Selam! Yanıt.'); A.clear(); await a.locator('main button[type=submit]').click(); await a.waitForTimeout(900); await A.shot('messaging/chat_author'); return { muts: A.muts().map(m => m.slice(0, 120)), url: short(a.url()) }; });
  await R.step('reader receives live', async () => { for (let i = 0; i < 15; i++) { const t = await R.text('main', 900); if (t.includes('Selam! Yanıt.')) return { afterSec: i }; await r.waitForTimeout(1000); } return 'not received in 15s'; });
  await R.shot('messaging/chat_reader');
  await R.step('message bubble html', async () => r.evaluate(() => { const b = [...document.querySelectorAll('[class*=message i]')].filter(e => e.innerText.includes('test mesajı')).pop(); return b ? b.outerHTML.replace(/<svg.*?<\/svg>/gs, '<svg/>').slice(0, 700) : 'none'; }));
  await A.end(); await R.end();
})();
