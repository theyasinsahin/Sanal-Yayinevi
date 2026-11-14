const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const ctl = async (d, sel = 'main') => (await d.locator(sel + ' button, ' + sel + ' select, ' + sel + ' input, ' + sel + ' textarea, ' + sel + ' a').evaluateAll(x => x.map(e => e.tagName.toLowerCase()[0] + ':' + (e.closest('label')?.innerText || e.innerText || e.getAttribute('aria-label') || e.placeholder || e.name || e.type || '').trim().replace(/\n/g, '/').slice(0, 32) + (e.disabled ? '[dis]' : '')).join(' | ')));
(async () => {
  const D = await start({ role: 'admin', tag: 'admin' }); const d = D.page;
  await D.go('/admin/data/Comment', 1500); await D.shot('admin/data_comments', { full: true });
  await D.step('comment records', async () => { const t = one(await D.text('main', 3000)); return { url: d.url().slice(21), t: t.slice(t.indexOf('Kayıtlar')).slice(0, 900) }; });
  await D.step('controls', async () => { const c = await ctl(d); return c.slice(c.indexOf('Kayıt ara') - 5).slice(0, 700); });
  await D.step('open first record', async () => { await D.clickText('Düzenle', 'main').catch(() => D.clickText('İncele', 'main')).catch(() => d.locator('main table tbody tr').first().click()); await d.waitForTimeout(1200); await D.shot('admin/record_editor', { full: true }); const t = one(await D.text('main', 4000)); const i = t.search(/gerekçe|Gerekçe/); return { url: d.url().slice(21), modal: (await D.modal()).slice(0, 700), around: t.slice(Math.max(0, i - 700), i + 300) }; });
  await D.step('editor controls', async () => { const c = await ctl(d, (await d.locator('[class*=modal i]').count()) ? '[class*=modal i]' : 'main'); return c.slice(-900); });
  await D.end();
})();
