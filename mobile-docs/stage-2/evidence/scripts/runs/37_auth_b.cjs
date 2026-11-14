const { start, SB } = require('../lib.cjs'); const fs = require('fs');
const one = t => t.replace(/\n+/g, ' | ');
const mail = () => { const d = SB + '/data/mail'; const f = fs.readdirSync(d).sort().pop(); return f ? JSON.parse(fs.readFileSync(d + '/' + f)) : null; };
const PW = '<disposable-password>', PW2 = '<disposable-password>', PW3 = '<disposable-password>';
(async () => {
  const G = await start({ role: 'guest', tag: 'auth-b' }); const g = G.page;
  await G.go('/sifremi-unuttum');
  await G.step('forgot unknown email', async () => { await g.locator('main input[type=email]').fill('yok@betik-dev.invalid'); G.clear(); await g.locator('main button[type=submit]').click(); await g.waitForTimeout(1500); return { gql: G.gql(), t: one(await G.text('main', 400)) }; });
  await G.go('/sifremi-unuttum');
  await G.step('forgot known', async () => { await g.locator('main input[type=email]').fill('stage2user@betik-dev.invalid'); G.clear(); await g.locator('main button[type=submit]').click(); await g.waitForTimeout(2500); await G.shot('auth/forgot_sent'); const m = mail(); return { gql: G.gql(), t: one(await G.text('main', 400)), mail: { to: m.to, subject: m.subject, link: ((m.text || '').match(/http\S+reset-password\/\S+/) || [''])[0].replace(/reset-password\/.*/, 'reset-password/<token>') } }; });
  const link = (mail().text.match(/http\S+reset-password\/\S+/) || [''])[0];
  await G.step('reset invalid token', async () => { await G.go('/reset-password/deadbeef'); const t = one(await G.text('main', 300)); const ins = await g.locator('main input').count(); if (ins) { await g.locator('main input[type=password]').first().fill(PW2); if (ins > 1) await g.locator('main input[type=password]').nth(1).fill(PW2); G.clear(); await g.locator('main button[type=submit]').click(); await g.waitForTimeout(1200); } return { t, gql: G.gql(), after: one(await G.text('main', 300)).slice(-150) }; });
  await G.step('reset mismatch + ok', async () => { await G.go(link.replace('http://localhost:3055', '')); const pw = g.locator('main input[type=password]'); const n = await pw.count(); await pw.first().fill(PW2); let mism = null; if (n > 1) { await pw.nth(1).fill('farkli'); G.clear(); await g.locator('main button[type=submit]').click(); await g.waitForTimeout(700); mism = { ops: G.gql().length, t: one(await G.text('main', 400)).slice(-160) }; await pw.nth(1).fill(PW2); } G.clear(); await g.locator('main button[type=submit]').click(); await g.waitForTimeout(2500); await G.shot('auth/reset_done'); return { n, mism, gql: G.gql(), url: g.url().slice(21), t: one(await G.text('main', 300)) }; });
  await G.step('reuse reset link', async () => { await G.go(link.replace('http://localhost:3055', '')); const pw = g.locator('main input[type=password]'); if (await pw.count()) { await pw.first().fill(PW3); if (await pw.count() > 1) await pw.nth(1).fill(PW3); G.clear(); await g.locator('main button[type=submit]').click(); await g.waitForTimeout(1500); } return { gql: G.gql(), t: one(await G.text('main', 300)).slice(-170) }; });
  await G.end();
  // old session (pre-reset) still valid?
  const O = await start({ role: 'stage2', tag: 'auth-old' }); const o = O.page;
  await O.step('old session after password reset', async () => { const u = await O.go('/profile', 1500); return { u, errs: O.gql().filter(x => x.includes('!!')).slice(0, 2), toasts: (await O.toasts()).slice(0, 1) }; });
  await O.end();
  const N = await start({ role: 'guest', tag: 'auth-new' });
  await N.step('login with new password', async () => { const u = await N.login({ email: 'stage2user@betik-dev.invalid', password: PW2, name: 'stage2' }); return u; });
  await N.end();
})();
