const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
(async () => {
  const A = await start({ role: 'author', tag: 'fund' }); const a = A.page;
  console.log('URL', await A.go('/print/' + BID, 1500)); await A.shot('funding/print_application_start', { full: true });
  await A.step('application page', async () => one(await A.text('main', 2600)));
  await A.step('application ui', async () => (await a.locator('main input, main select, main textarea, main button').evaluateAll(x => x.map(e => e.tagName.toLowerCase() + ':' + (e.name || e.id || e.getAttribute('aria-label') || e.innerText || e.type).slice(0, 40) + (e.type && e.tagName === 'INPUT' ? '(' + e.type + ')' : '') + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1800));
  await A.step('ops', async () => [...new Set(A.gql())].join(','));
  await A.end();
})();
