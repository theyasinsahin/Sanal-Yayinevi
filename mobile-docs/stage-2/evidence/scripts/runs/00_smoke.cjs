const { start } = require('../lib.cjs');
(async () => {
  for (const role of ['admin', 'author', 'reader', 'publisher']) {
    const s = await start({ role: 'guest', tag: 'smoke' });
    const url = await s.login(role);
    const user = await s.page.evaluate(() => { const u = JSON.parse(localStorage.getItem('user') || 'null'); return u && { username: u.username, role: u.role, keys: Object.keys(u) }; });
    console.log(role, '->', url, JSON.stringify(user), s.gql().join(','), s.errs().join(' ; '));
    await s.end();
  }
})();
