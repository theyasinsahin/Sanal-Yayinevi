const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const dumpUi = async (d) => (await d.locator('main button, main select, main input, main textarea').evaluateAll(x => x.map(e => e.tagName.toLowerCase() + ':' + (e.closest('label')?.innerText || e.innerText || e.name || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().replace(/\n/g, '/').slice(0, 40) + (e.value && e.tagName !== 'BUTTON' ? '=' + String(e.value).slice(0, 16) : '') + (e.required ? '*' : '') + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1600);
(async () => {
  const D = await start({ role: 'admin', tag: 'fund-admin' }); const d = D.page;
  await D.go('/admin/print-funding', 1500);
  await D.step('approved card', async () => { const t = one(await D.text('main', 3000)); return t.slice(t.indexOf('Onaylandı')).slice(0, 900) + ' ## ' + await dumpUi(d); });
  await D.end();
})();
