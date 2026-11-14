const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const D = await start({ role: 'admin', tag: 'fund-admin' }); const d = D.page;
  await D.go('/admin/print-funding', 1500);
  await d.locator('main select').first().selectOption({ label: 'Onayla' }); await d.waitForTimeout(500);
  await D.shot('admin/print_application_approve_form', { full: true });
  await D.step('approve form', async () => { const t = one(await D.text('main', 4000)); return t.slice(t.indexOf('Yönetici kararı')).slice(0, 1500); });
  await D.step('fields', async () => d.evaluate(() => { const sec = [...document.querySelectorAll('main *')].find(e => e.children.length === 0 && e.innerText === 'Yönetici kararı'); let root = sec; for (let i = 0; i < 4; i++) root = root.parentElement; return [...root.querySelectorAll('input,select,textarea')].map(e => { const lab = e.closest('label')?.innerText || document.querySelector('label[for="' + e.id + '"]')?.innerText || e.getAttribute('aria-label') || e.name || ''; return e.tagName.toLowerCase() + '(' + (e.type || '') + ')' + (e.required ? '*' : '') + ' ' + lab.replace(/\n/g, '/').slice(0, 50) + ' =' + String(e.value).slice(0, 20) + (e.min ? ' min' + e.min : '') + (e.max ? ' max' + e.max : '') + (e.tagName === 'SELECT' ? ' {' + [...e.options].map(o => o.text).join(',').slice(0, 80) + '}' : ''); }).join(' ; '); }));
  await D.end();
})();
