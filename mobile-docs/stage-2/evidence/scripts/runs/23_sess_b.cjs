const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const A = await start({ role: 'author', tag: 'sess-author' }); const a = A.page;
  await A.go('/sessions');
  await A.step('empty reason submit', async () => { A.clear(); await a.locator('main button[type=submit]').first().click(); await a.waitForTimeout(600); return { muts: A.muts().length, invalid: await a.locator('main textarea:invalid').count(), toasts: await A.toasts() }; });
  await A.step('request', async () => { await a.locator('main textarea').first().fill('Stage 2 testi için oturum açma izni talebi.'); A.clear(); await a.locator('main button[type=submit]').first().click(); await a.waitForTimeout(1000); await A.shot('sessions/access_requested'); return { muts: A.muts(), toasts: await A.toasts(), text: one(await A.text('main', 350)) }; });
  const D = await start({ role: 'admin', tag: 'sess-admin' }); const d = D.page;
  await D.go('/admin/session-access'); await D.shot('admin/session_access_queue');
  await D.step('admin queue', async () => one(await D.text('main', 600)) + ' ## ' + await D.ui('main', 30));
  await D.step('approve', async () => { D.clear(); await D.clickText('Onayla', 'main').catch(() => D.clickText('İzin ver', 'main')); await d.waitForTimeout(1000); return { dialogs: D.dialogs(), modal: (await D.modal()).slice(0, 300), muts: D.muts(), toasts: await D.toasts(), text: one(await D.text('main', 300)) }; });
  await D.end();
  await A.go('/sessions');
  await A.step('after approval', async () => one(await A.text('main', 300)) + ' ## ' + await A.ui('main', 20));
  await A.step('author notif', async () => { await a.getByRole('button', { name: 'Bildirimler' }).first().click(); await a.waitForTimeout(800); const t = one((await a.locator('.notif-list').innerText()).slice(0, 200)); await a.locator('.notif-overlay').click({ position: { x: 5, y: 500 } }); return t; });
  await A.step('open create modal', async () => { await A.clickText('Oturum', 'main').catch(() => {}); await a.waitForTimeout(700); await A.shot('sessions/create_modal'); return one(await a.locator('.sessions-modal').innerText()) + ' ## ' + await A.ui('.sessions-modal', 30); });
  await A.end();
})();
