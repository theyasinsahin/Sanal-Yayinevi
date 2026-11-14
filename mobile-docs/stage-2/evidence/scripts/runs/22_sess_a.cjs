const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const A = await start({ role: 'author', tag: 'sess-author' }); const a = A.page;
  await A.go('/sessions'); await A.step('sessions (author, no access)', async () => one(await A.text('main', 500)) + ' ## ' + await A.ui('main', 20));
  await A.step('request access', async () => { A.clear(); await A.clickText('başvur', 'main'); await a.waitForTimeout(900); await A.shot('sessions/access_request'); return { modal: (await A.modal()).slice(0, 500), muts: A.muts(), text: one(await A.text('main', 400)) }; });
  await A.step('fill request if form', async () => { const ta = a.locator('[class*=modal i] textarea, main textarea').first(); if (await ta.count()) { await ta.fill('Stage 2 testi için oturum açma izni talebi.'); A.clear(); await a.locator('[class*=modal i] button[type=submit], [class*=modal i] button').last().click(); await a.waitForTimeout(1000); } return { muts: A.muts(), toasts: await A.toasts(), text: one(await A.text('main', 400)) }; });
  await A.end();
  const D = await start({ role: 'admin', tag: 'sess-admin' }); const d = D.page;
  await D.go('/admin/session-access'); await D.shot('admin/session_access_queue');
  await D.step('admin queue', async () => one(await D.text('main', 700)) + ' ## ' + await D.ui('main', 30));
  await D.end();
})();
