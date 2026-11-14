const { start } = require('../lib.cjs');
(async () => {
  const G = await start({ role: 'guest', tag: 'verify' });
  const o = {}; for (const p of ['/dashboard/000000000000000000000201', '/print/6af85920fbba96dbf14e42be', '/book-reader/000000000000000000000201', '/forgot-password', '/donate/6af85920fbba96dbf14e42be', '/messages/abc']) o[p] = await G.go(p, 700);
  console.log(JSON.stringify(o)); await G.end();
  const D = await start({ role: 'admin', tag: 'verify' }); console.log('admin /publisher ->', await D.go('/publisher', 900)); await D.end();
})();
