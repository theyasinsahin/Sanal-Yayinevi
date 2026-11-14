const { start } = require('../lib.cjs');
(async () => {
  const s = await start({ role: 'author', tag: 'author-a' });
  let u = await s.go('/profile'); console.log('PROFILE', u, '\n', await s.text(), '\nUI:', await s.ui('body', 70), '\nERR', s.errs().join(';'), [...new Set(s.gql())].join(','));
  await s.shot('profile/own_author_error_state');
  // nav dropdown
  const dom = await s.page.evaluate(() => document.body.innerHTML.length + ' main:' + !!document.querySelector('main') + ' classes:' + [...new Set([...document.querySelectorAll('body > div > *, body > div > div > *')].map(e => e.tagName + '.' + e.className))].slice(0, 15).join(' , '));
  console.log('DOM', dom);
  s.clear(); u = await s.go('/dashboard/000000000000000000000201'); console.log('\nDASH', u, '\n', await s.text(), '\nUI:', await s.ui('body', 90), '\nERR', s.errs().join(';'), [...new Set(s.gql())].join(','));
  await s.shot('writing/dashboard_seed_story', { full: true });
  s.clear(); u = await s.go('/create-book'); console.log('\nCREATE', u, '\n', await s.text(), '\nUI:', await s.ui('body', 90), '\nERR', s.errs().join(';'), [...new Set(s.gql())].join(','));
  await s.shot('writing/create_book_empty', { full: true });
  await s.end();
})();
