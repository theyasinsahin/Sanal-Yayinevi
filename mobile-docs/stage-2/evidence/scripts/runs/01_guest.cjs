const { start } = require('../lib.cjs');
const routes = [['/', 'discovery/landing'], ['/feed', 'discovery/feed'], ['/authors', 'discovery/authors'], ['/printed-books', 'printed/catalogue'], ['/about', 'community/about'], ['/contact', 'community/contact'], ['/terms', 'community/terms'], ['/privacy', 'community/privacy'], ['/newsletter', 'community/newsletter'], ['/quotes', 'quotes/feed'], ['/leaderboard', 'score/leaderboard'], ['/sessions', 'sessions/list'], ['/login', 'auth/login'], ['/register', 'auth/register'], ['/sifremi-unuttum', 'auth/forgot'], ['/olmayan-sayfa', 'nav/notfound'],
  ['/profile', 'guards/profile'], ['/create-book', 'guards/create-book'], ['/messages', 'guards/messages'], ['/admin', 'guards/admin'], ['/publisher', 'guards/publisher'], ['/funding-history', 'guards/funding-history'], ['/payment/failure', 'funding/legacy-failure'], ['/payment/success', 'guards/payment-success']];
(async () => {
  for (const vp of ['desktop', 'mobile']) {
    const s = await start({ role: 'guest', vp, tag: 'guest' });
    for (const [r, name] of routes) {
      s.clear(); const url = await s.go(r);
      await s.shot(name + '_guest', { full: vp === 'desktop' && !name.startsWith('guards') });
      if (vp === 'desktop') { console.log('\n=== ' + r + ' -> ' + url + ' | gql: ' + [...new Set(s.gql())].join(',')); console.log(await s.text('body', name.match(/terms|privacy/) ? 500 : 1300)); }
      const e = s.errs(); if (e.length) console.log('ERRS[' + vp + '] ' + r + ': ' + [...new Set(e)].join(' ; ').slice(0, 500));
    }
    await s.end();
  }
})();
