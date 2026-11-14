const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
(async () => {
  const S = await start({ role: 'guest', tag: 'account' }); const s = S.page; console.log('login', await S.login({ email: 'stage2user@betik-dev.invalid', password: '<disposable-password>', name: 'stage2' }));
  await S.go('/profile'); await S.clickText('AYARLAR', 'main'); await s.waitForTimeout(500);
  await S.step('inputs', async () => s.locator('main input, main form button, main .settings-actions button').evaluateAll(a => a.map(e => e.tagName + '[' + ['type', 'name', 'id', 'placeholder', 'aria-label', 'autocomplete'].map(k => e.getAttribute(k) ? k + '=' + e.getAttribute(k) : '').filter(Boolean).join(' ') + ']' + (e.innerText || '') + (e.disabled ? ' DIS' : '')).join(' ; ')));
  await S.clickText('HESABI SİL', 'main'); await s.waitForTimeout(500);
  await S.step('danger buttons', async () => s.locator('main button').evaluateAll(a => a.map(e => e.className + ':' + e.innerText).slice(-4)));
  await S.step('click deactivate', async () => { s.__dismiss = true; await s.locator('main button').filter({ hasText: /devre dışı/i }).last().click(); await s.waitForTimeout(800); await S.shot('settings/deactivate_confirm'); return { dialogs: S.dialogs(), body: one(await s.evaluate(() => document.body.innerText.slice(-500))) }; });
  await S.end();
})();
