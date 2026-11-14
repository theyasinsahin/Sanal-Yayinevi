const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
(async () => {
  const A = await start({ role: 'author', tag: 'fund' }); const a = A.page;
  await A.go('/print/' + BID, 1500);
  await A.step('submit for review', async () => { A.clear(); await A.clickText('BAŞVURUYU İNCELEMEYE GÖNDER', 'main'); await a.waitForTimeout(1800); return { dialogs: A.dialogs(), muts: A.muts().map(m => m.slice(0, 200)), t: one(await A.text('main', 900)).slice(180, 700) }; });
  await A.end();
  const D = await start({ role: 'admin', tag: 'fund-admin' }); const d = D.page;
  await D.go('/admin/print-funding', 1500); await D.shot('admin/print_funding_overview', { full: true });
  await D.step('admin print funding', async () => one(await D.text('main', 3000)).slice(0, 2200));
  await D.step('admin ui', async () => (await d.locator('main button, main a, main select, main input, main textarea, main summary').evaluateAll(x => x.map(e => e.tagName.toLowerCase() + ':' + (e.innerText || e.name || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().replace(/\n/g, '/').slice(0, 40) + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1500));
  await D.end();
})();
