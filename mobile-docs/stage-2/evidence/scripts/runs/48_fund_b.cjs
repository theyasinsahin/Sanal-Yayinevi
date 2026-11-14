const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const BID = '6af85920fbba96dbf14e42be';
(async () => {
  const A = await start({ role: 'author', tag: 'fund' }); const a = A.page;
  await A.go('/print/' + BID, 1500);
  await A.step('fill + save', async () => { const nums = a.locator('main input[type=number]'); const defaults = await nums.evaluateAll(x => x.map(e => e.value + '[' + e.min + '-' + e.max + ']')); await nums.nth(0).fill('100'); await a.locator('main select').nth(4).selectOption({ index: 1 }); await a.locator('main input[type=file]').setInputFiles(SB + '/data/pdf/cover.pdf'); for (const i of [0, 1, 2]) await a.locator('main input[type=checkbox]').nth(i).check(); await a.waitForTimeout(500); A.clear(); await A.clickText('BASIM SÜRÜMÜNÜ SABİTLE', 'main'); await a.waitForTimeout(3500); await A.shot('funding/print_application_saved', { full: true }); return { defaults, muts: A.muts().map(m => m.slice(0, 400)), http: A.events.filter(e => e.t === 'http').map(e => e.m), toast: (await A.toasts()).slice(0, 1) }; });
  await A.step('after save', async () => one(await A.text('main', 2500)).slice(0, 1600));
  await A.step('buttons', async () => a.locator('main button, main a').evaluateAll(x => x.map(e => e.innerText.trim() + (e.disabled ? '[dis]' : '')).filter(Boolean)));
  await A.end();
})();
