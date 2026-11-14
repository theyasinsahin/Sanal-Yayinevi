const { start, SB } = require('../lib.cjs');
(async () => {
  const A = await start({ role: 'author', tag: 'msg-author' }), R = await start({ role: 'reader', tag: 'msg-reader' }); const a = A.page, r = R.page;
  await A.go('/messages/6af85b27fbba96dbf14e4bd2', 1500); await R.go('/messages/6af85b27fbba96dbf14e4bd2', 1500);
  const chat = async pg => (await pg.locator('.chat-messages').innerText()).replace(/\n+/g, ' | ').slice(-160);
  await A.step('author view', async () => ({ chat: await chat(a), ui: await A.ui('main', 20) }));
  await A.step('author sends', async () => { const inp = a.getByPlaceholder('Mesaj yaz...'); await inp.fill('Selam! Yanıt.'); A.clear(); await inp.press('Enter'); await a.waitForTimeout(800); return A.muts().map(m => m.slice(0, 100)); });
  await R.step('reader live (chat open)', async () => { for (let i = 0; i < 10; i++) { if ((await chat(r)).includes('Selam! Yanıt.')) return { afterSec: i, readOps: R.gql().filter(o => /Read/.test(o)).length }; await r.waitForTimeout(1000); } return 'no'; });
  await R.shot('messaging/chat_reader');
  await A.step('author deletes; reader sees?', async () => { await a.locator('.bubble-row--own .bubble-menu-btn').last().click({ force: true }); await A.clickText('Sil', '.chat-messages'); await r.waitForTimeout(4000); return { author: await chat(a), reader: await chat(r) }; });
  await R.step('reader after reload', async () => { await R.go('/messages/6af85b27fbba96dbf14e4bd2', 1200); return await chat(r); });
  await R.step('whitespace', async () => { const inp = r.getByPlaceholder('Mesaj yaz...'); await inp.fill('   '); return { dis: await r.getByRole('button', { name: 'Gönder' }).isDisabled() }; });
  await R.step('recipient search', async () => { const sInp = r.getByPlaceholder(/kişiyi ara/); await sInp.fill('pub'); R.clear(); await r.waitForTimeout(1300); await R.shot('messaging/recipient_search'); return { ops: R.gql(), list: (await r.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 300) }; });
  await R.step('start conv with publisher', async () => { R.clear(); await r.locator('main button').filter({ hasText: 'Docker publisher' }).first().click(); await r.waitForTimeout(1200); return { url: r.url().slice(21), ops: R.gql(), muts: R.muts() }; });
  await R.go('/yazar/dev_author');
  await R.step('followers modal', async () => { await r.locator('main').getByText(/TAKİPÇİLER|Takipçiler/).first().click(); await r.waitForTimeout(900); await R.shot('profile/followers_modal'); return (await R.modal()).slice(0, 300) || (await R.text('main', 300)).replace(/\n/g, ' | '); });
  await A.end(); await R.end();
})();
