const { start, SB } = require('../lib.cjs');
const B = '/kitap/docker-ornek-hikaye-dev-author';
(async () => {
  const s = await start({ role: 'reader', tag: 'reader-a' }); const p = s.page;
  console.log('URL', await s.go(B)); await s.shot('books/detail_reader', { full: true });
  await s.step('detail text', async () => (await s.text('main', 1800)).replace(/\n/g, ' | '));
  await s.step('detail ui', async () => s.ui('main', 60));
  await s.step('gql', async () => [...new Set(s.gql())].join(',') + ' ERR ' + s.errs().map(e => e.slice(0, 120)).join(';'));
  console.log('legacy ->', await s.go('/book-detail/000000000000000000000201'));
  console.log('READER URL', await s.go(B + '/oku')); await s.shot('reader/open_first');
  await s.step('reader text', async () => (await s.text('body', 1500)).replace(/\n/g, ' | '));
  await s.step('reader ui', async () => s.ui('body', 70));
  await s.step('reader dom', async () => p.evaluate(() => { const c = document.querySelector('[class*=reader i]'); const seen = new Set(); document.querySelectorAll('[class*=reader i] *, [class*=chapter i]').forEach(e => String(e.className).split(/\s+/).forEach(k => k && seen.add(k))); return [...seen].slice(0, 120).join(' '); }));
  await s.step('gql', async () => [...new Set(s.gql())].join(',') + ' ERR ' + s.errs().map(e => e.slice(0, 120)).join(';'));
  await s.end();
})();
