const { start, SB } = require('../lib.cjs'); const fs = require('fs');
const one = t => t.replace(/\n+/g, ' | ');
const mails = () => { const d = SB + '/data/mail'; return fs.readdirSync(d).sort().map(f => JSON.parse(fs.readFileSync(d + '/' + f))); };
const PW2 = '<disposable-password>', PW3 = '<disposable-password>';
(async () => {
  let S = await start({ role: 'guest', tag: 'account' }); let s = S.page; console.log('login', await S.login({ email: 'stage2user@betik-dev.invalid', password: PW2, name: 'stage2' }));
  const openTab = async (t) => { await S.go('/profile'); await S.clickText('AYARLAR', 'main'); await s.waitForTimeout(400); if (t) { await S.clickText(t, 'main'); await s.waitForTimeout(500); } };
  const relog = async (email, pw) => { await S.end(); S = await start({ role: 'guest', tag: 'account' }); s = S.page; console.log('  relogin ->', await S.login({ email, password: pw, name: 'stage2' })); };
  // click the first non-nav button that follows the given input in document order
  const btnAfter = async (id) => { await s.evaluate((id) => { const inp = document.getElementById(id); const all = [...document.querySelectorAll('main button:not(.settings-nav-btn)')]; const b = all.find(x => inp.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING && x.type !== 'button' || (inp.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING && !/göster/i.test(x.innerText))); b.setAttribute('data-go', '1'); }, id); const b = s.locator('[data-go="1"]'); const lab = (await b.innerText()) + (await b.isDisabled() ? ' [dis]' : ''); await b.click({ timeout: 3000 }).catch(() => {}); await s.evaluate(() => document.querySelectorAll('[data-go]').forEach(e => e.removeAttribute('data-go'))); return lab; };
  await openTab();
  await S.step('main buttons', async () => s.locator('main button:not(.settings-nav-btn)').evaluateAll(a => a.map(e => e.innerText + (e.disabled ? '[dis]' : '')).slice(-6)));
  await S.step('change email wrong pw', async () => { await s.locator('#emailForm-newEmail').fill('stage2new@betik-dev.invalid'); await s.locator('#emailForm-currentPassword').fill('yanlis-sifre'); S.clear(); const lab = await btnAfter('emailForm-currentPassword'); await s.waitForTimeout(1500); return { lab, gql: S.gql().filter(x => /mail/i.test(x)), toast: (await S.toasts()).slice(0, 1) }; });
  await S.step('change email ok', async () => { await s.locator('#emailForm-currentPassword').fill(PW2); S.clear(); await btnAfter('emailForm-currentPassword'); await s.waitForTimeout(3000); return { gql: S.gql().filter(x => /mail/i.test(x) || x.includes('!!')), toast: (await S.toasts()).slice(0, 1), url: s.url().slice(21), m: mails().slice(-2).map(x => x.to + ' | ' + x.subject) }; });
  await S.step('session after email change', async () => S.go('/profile', 1200));
  if (s.url().includes('/login')) await relog('stage2new@betik-dev.invalid', PW2);
  await openTab();
  await S.step('change password mismatch', async () => { await s.locator('#passForm-currentPassword').fill(PW2); await s.locator('#passForm-newPassword').fill(PW3); await s.locator('#passForm-confirmPassword').fill('farkli-Sifre!1'); S.clear(); const lab = await btnAfter('passForm-confirmPassword'); await s.waitForTimeout(900); return { lab, gql: S.gql().filter(x => /assw/i.test(x)), toast: (await S.toasts()).slice(0, 1) }; });
  await S.step('change password ok', async () => { await s.locator('#passForm-confirmPassword').fill(PW3); S.clear(); await btnAfter('passForm-confirmPassword'); await s.waitForTimeout(2500); return { gql: S.gql().filter(x => /assw/i.test(x) || x.includes('!!')), toast: (await S.toasts()).slice(0, 1), url: s.url().slice(21) }; });
  await S.step('session after pw change', async () => S.go('/profile', 1200));
  if (s.url().includes('/login')) await relog('stage2new@betik-dev.invalid', PW3);
  await openTab('HESABI SİL');
  await S.step('deactivate click', async () => { s.__dismiss = true; await s.locator('main .btn').filter({ hasText: 'DEVRE DIŞI BIRAK' }).click(); await s.waitForTimeout(800); await S.shot('settings/deactivate_confirm'); const d1 = S.dialogs(); s.__dismiss = false; const t = one(await S.text('main', 4000)); return { d1, zone: t.slice(t.indexOf('Tehlikeli')).slice(0, 600), inputs: await s.locator('main input').evaluateAll(a => a.map(e => e.type + ':' + (e.placeholder || e.getAttribute('aria-label') || e.id))), btns: await s.locator('main button:not(.settings-nav-btn)').allInnerTexts() }; });
  await S.end();
})();
