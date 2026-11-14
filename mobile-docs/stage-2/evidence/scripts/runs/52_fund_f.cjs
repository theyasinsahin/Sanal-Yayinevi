const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const dumpUi = async (d) => (await d.locator('main button, main select, main input, main textarea, main summary').evaluateAll(x => x.map(e => e.tagName.toLowerCase() + ':' + (e.closest('label')?.innerText || e.innerText || e.name || e.getAttribute('aria-label') || e.placeholder || e.type || '').trim().replace(/\n/g, '/').slice(0, 40) + (e.value && e.tagName !== 'BUTTON' ? '=' + String(e.value).slice(0, 14) : '') + (e.required ? '*' : '') + (e.disabled ? '[dis]' : '')).join(' | '))).slice(0, 1800);
(async () => {
  const D = await start({ role: 'admin', tag: 'fund-admin' }); const d = D.page;
  await D.go('/admin/print-funding', 1500);
  await D.step('approve', async () => {
    await d.locator('main select').first().selectOption({ label: 'Onayla' }); await d.waitForTimeout(500);
    // fill every required control inside the decision block in DOM order
    const vals = ['TEKLIF-001', '3000', '500', '200', '400', '100', '300', '0', '30', '5', '2', '4', '1', '3', '5'];
    const info = await d.evaluate((vals) => { const set = (el, v) => { const p = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const sel = [...document.querySelectorAll('main select')].find(s => [...s.options].some(o => o.text === 'Onayla')); let root = sel; while (root && root.querySelectorAll('input[type=file]').length < 2) root = root.parentElement;
      const ta = root.querySelector('textarea'); set(ta, 'Stage 2 sandbox onayı.'); const texts = [...root.querySelectorAll('input')].filter(e => e.type === 'text'); texts.forEach((t, i) => set(t, vals[i] ?? '0')); const num = root.querySelector('input[type=number]'); set(num, '120'); [...root.querySelectorAll('input[type=file]')].forEach((f, i) => f.setAttribute('data-file', String(i))); const cb = [...root.querySelectorAll('input[type=checkbox]')].pop(); if (!cb.checked) cb.click(); return { texts: texts.length }; }, vals);
    await d.locator('[data-file="0"]').setInputFiles(SB + '/data/pdf/layout.pdf'); await d.locator('[data-file="1"]').setInputFiles(SB + '/data/pdf/quote.pdf'); await d.waitForTimeout(600);
    const sum = one(await D.text('main', 4000)).match(/Doğrulanmış hedef[^|]*/); D.clear(); await D.clickText('KARARI KAYDET', 'main'); await d.waitForTimeout(3500);
    return { info, sum, muts: D.muts().map(m => m.slice(0, 600)), toast: (await D.toasts()).slice(0, 1), invalid: await d.locator('main :invalid').count(), t: one(await D.text('main', 600)).slice(150, 420) }; });
  await D.step('campaign tab', async () => { await D.clickText('KAMPANYA VE ÜRETİM', 'main'); await d.waitForTimeout(1500); await D.shot('admin/print_funding_campaigns', { full: true }); return one(await D.text('main', 2500)).slice(130, 1500) + ' ## ' + await dumpUi(d); });
  await D.end();
})();
