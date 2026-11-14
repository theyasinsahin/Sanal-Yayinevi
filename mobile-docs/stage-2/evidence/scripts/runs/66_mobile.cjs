const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  for (const vp of ['mobile', 'tablet']) {
    const R = await start({ role: 'reader', vp, tag: 'resp-' + vp }); const r = R.page;
    const over = async () => r.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const out = {};
    for (const [p, n] of [['/', 'discovery/landing_member'], ['/feed', 'discovery/feed_member'], ['/kitap/stage2-deneme-romani-cag-isik-dev-author', 'books/detail_campaign'], ['/kitap/docker-ornek-hikaye-dev-author/oku', 'reader/reader'], ['/profile', 'profile/own'], ['/messages', 'messaging/list'], ['/messages/6af85b27fbba96dbf14e4bd2', 'messaging/chat'], ['/quotes', 'quotes/feed'], ['/sessions', 'sessions/list'], ['/oturum/stage2-ozel-oturum', 'sessions/detail'], ['/leaderboard', 'score/leaderboard_data'], ['/printed-books', 'printed/catalogue'], ['/donate/6af85920fbba96dbf14e42be', 'funding/checkout'], ['/funding-history', 'funding/history'], ['/authors', 'discovery/authors']]) { await R.go(p, 900); await R.shot(n); const o = await over(); if (o.sw > o.cw + 2) out[p] = 'h-overflow ' + o.sw + '>' + o.cw; }
    console.log(vp, 'overflow:', JSON.stringify(out));
    if (vp === 'mobile') {
      await R.go('/feed');
      await R.step('hamburger menu', async () => { const b = r.locator('nav.navigation-bar button').filter({ has: r.locator('svg') }).last(); const lab = await r.locator('nav.navigation-bar button').evaluateAll(a => a.filter(e => e.getBoundingClientRect().width > 0).map(e => e.getAttribute('aria-label') || e.innerText.trim())); await r.locator('nav.navigation-bar button[aria-label*=enü i], nav.navigation-bar button[aria-label*=menu i]').first().click(); await r.waitForTimeout(600); await R.shot('nav/mobile_menu_member'); const items = await r.locator('[class*=mobile-menu i] a, [class*=mobile-nav i] a, [class*=mobile-menu i] button, [class*=mobile-nav i] button').evaluateAll(a => a.filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim().replace(/\n/g, ' '))); return { lab, items }; });
      await R.step('reader mobile chrome', async () => { await R.go('/kitap/docker-ornek-hikaye-dev-author/oku', 900); const vis = await r.evaluate(() => ({ sidebar: (() => { const s = document.querySelector('.chapters-sidebar'); const b = s.getBoundingClientRect(); return Math.round(b.left) + ',' + Math.round(b.width) + ' ' + getComputedStyle(s).transform.slice(0, 30); })(), nav: !!document.querySelector('nav.navigation-bar')?.getBoundingClientRect().height, ctrl: [...document.querySelectorAll('.reader-controls button')].map(b => b.getAttribute('aria-label') || b.innerText.trim()) })); await r.locator('.reader-controls button').first().click(); await r.waitForTimeout(500); await R.shot('reader/reader_sidebar_open'); return vis; });
      await R.step('dashboard mobile (author-only layout, as reader view)', async () => { await R.go('/dashboard/000000000000000000000201', 1200); await R.shot('writing/dashboard_mobile'); return (await R.ui('body', 14)).slice(0, 420); });
      await R.step('leaderboard text', async () => { await R.go('/leaderboard', 900); return one(await R.text('main', 500)); });
    }
    await R.end();
  }
})();
