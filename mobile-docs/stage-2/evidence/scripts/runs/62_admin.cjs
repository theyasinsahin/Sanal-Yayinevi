const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const D = await start({ role: 'admin', tag: 'admin' }); const d = D.page;
  for (const [p, n, len] of [['/admin', 'overview', 1100], ['/admin/users', 'users', 500], ['/admin/books', 'books', 500], ['/admin/transactions', 'transactions', 400], ['/admin/genres', 'genres', 400], ['/admin/data', 'data', 900], ['/admin/schemas', 'schemas', 600]])
    await D.step(p, async () => { const u = await D.go(p, 1200); await D.shot('admin/' + n, { full: n === 'overview' }); return u + ' :: ' + one(await D.text('main', len + 200)).slice(0, len) + ' ## ops ' + [...new Set(D.gql())].filter(o => /admin/i.test(o)).join(','); });
  await D.step('admin nav', async () => (await d.locator('aside a, [class*=admin i] nav a, [class*=sidebar i] a').evaluateAll(a => a.map(x => x.innerText.trim() + '→' + x.getAttribute('href')))).join(' | '));
  await D.step('top nav for admin', async () => (await d.locator('nav.navigation-bar a').evaluateAll(a => [...new Set(a.map(x => x.innerText.trim() + '→' + x.getAttribute('href')))])).join(' | '));
  await D.end();
})();
