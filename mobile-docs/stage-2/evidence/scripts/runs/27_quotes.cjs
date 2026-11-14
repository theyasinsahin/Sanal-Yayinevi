const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const P = await start({ role: 'publisher', tag: 'quotes-pub' }); const p = P.page;
  await P.step('followers-only body', async () => { await P.go('/oturum/stage2-takipci-oturumu'); return one(await P.text('body', 300)); });
  await P.go('/quotes'); await P.shot('quotes/feed_one_quote');
  await P.step('feed', async () => one(await P.text('main', 500)) + ' ## ' + await P.ui('main', 25));
  await P.step('card html', async () => p.evaluate(() => (document.querySelector('[class*=quote-card i]')?.outerHTML || 'none').replace(/<svg.*?<\/svg>/gs, '<svg/>').slice(0, 1300)));
  const btn = (re) => p.locator('[class*=quote-card i] button').filter({ hasText: re });
  await P.step('like', async () => { P.clear(); await p.locator('[class*=quote-card i] button[aria-label*=eğen i], [class*=quote-card i] [class*=like i]').first().click(); await p.waitForTimeout(800); return P.muts(); });
  await P.step('repost', async () => { P.clear(); await p.locator('[class*=quote-card i] button[aria-label*=epost i], [class*=quote-card i] [class*=repost i]').first().click(); await p.waitForTimeout(900); const m = await P.modal(); return { muts: P.muts(), modal: m.slice(0, 200), toasts: await P.toasts() }; });
  await P.step('open comments/detail', async () => { P.clear(); await p.locator('[class*=quote-card i] button[aria-label*=orum i], [class*=quote-card i] [class*=comment i]').first().click(); await p.waitForTimeout(1000); await P.shot('quotes/card_comments'); return { url: p.url().slice(21), ops: [...new Set(P.gql())], text: one(await P.text('main', 500)) }; });
  await P.step('add quote comment', async () => { const i = p.locator('main textarea, main input[type=text]').last(); await i.fill('Güzel alıntı @dev_reader'); P.clear(); await i.press('Enter'); await p.waitForTimeout(700); if (!P.muts().length) await p.locator('main button').filter({ hasText: /gönder/i }).last().click(); await p.waitForTimeout(900); return { muts: P.muts(), text: one(await P.text('main', 600)).slice(-250) }; });
  await P.step('search', async () => { await P.go('/quotes'); const s = p.locator('main input').first(); const ph = await s.getAttribute('placeholder'); await s.fill('yorum'); P.clear(); await p.waitForTimeout(1300); const n1 = await p.locator('[class*=quote-card i]').count(); await s.fill('qqqqzz'); await p.waitForTimeout(1300); return { ph, ops: P.gql(), found: n1, none: one(await P.text('main', 300)).slice(-120) }; });
  await P.step('sort tabs', async () => { await p.locator('main input').first().fill(''); P.clear(); await P.clickText('En Yeni', 'main'); await p.waitForTimeout(800); return P.gql(); });
  await P.end();
})();
