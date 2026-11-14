const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const P = await start({ role: 'publisher', tag: 'quotes-pub' }); const p = P.page;
  await P.go('/quotes'); const act = p.locator('.quote-card .quote-card-action-btn');
  await P.step('repost', async () => { P.clear(); await act.nth(1).click(); await p.waitForTimeout(900); return { muts: P.muts(), modal: (await P.modal()).slice(0, 200), toasts: await P.toasts(), cls: await act.nth(1).getAttribute('class') }; });
  await P.step('undo repost', async () => { P.clear(); await act.nth(1).click(); await p.waitForTimeout(900); return { muts: P.muts(), dialogs: P.dialogs() }; });
  await P.step('repost again', async () => { await act.nth(1).click(); await p.waitForTimeout(700); return (await P.text('main', 400)).replace(/\n+/g, ' | ').slice(-200); });
  await P.step('comments', async () => { P.clear(); await act.nth(0).click(); await p.waitForTimeout(1000); await P.shot('quotes/card_comments'); return { url: p.url().slice(21), ops: [...new Set(P.gql())], ui: await P.ui('main', 30) }; });
  await P.step('add quote comment', async () => { const i = p.locator('.quote-card textarea, .quote-card input[type=text], [class*=quote-comment i] textarea, [class*=quote-comment i] input').last(); await i.fill('Güzel alıntı @dev_reader'); P.clear(); await i.press('Enter'); await p.waitForTimeout(800); if (!P.muts().length) { await p.locator('[class*=quote i] button').filter({ hasText: /gönder/i }).last().click(); await p.waitForTimeout(900); } return { muts: P.muts(), text: one(await P.text('main', 700)).slice(-260) }; });
  await P.step('quote detail', async () => { const u = await P.go('/quotes/6af859bafbba96dbf14e4599'); await P.shot('quotes/detail'); return { u, text: one(await P.text('main', 500)), ui: await P.ui('main', 25) }; });
  await P.step('share quote', async () => { await p.getByRole('button', { name: 'Alıntıyı paylaş' }).first().click(); await p.waitForTimeout(600); await P.shot('share/quote_share_dialog'); const link = await p.evaluate(() => [...document.querySelectorAll('input[readonly]')].map(e => e.value).join(',')); const m = (await P.modal()).slice(0, 260); await p.keyboard.press('Escape'); return { link, m }; });
  await P.step('invalid quote id', async () => { await P.go('/quotes/000000000000000000000999'); return one(await P.text('main', 200)); });
  await P.end();
  const R = await start({ role: 'reader', tag: 'quotes-reader' }); const r = R.page;
  await R.step('owner card controls', async () => { await R.go('/quotes'); return await R.ui('.quote-card', 20); });
  await R.step('profile quotes tab', async () => { await R.go('/profile'); await R.clickText('ALINTILAR', 'main'); await r.waitForTimeout(900); await R.shot('profile/quotes_tab'); return one(await R.text('main', 900)).slice(250, 800); });
  await R.end();
})();
