const { start, SB } = require('../lib.cjs');
const D = '/dashboard/000000000000000000000201';
(async () => {
  const s = await start({ role: 'author', tag: 'editor-c' }); const p = s.page; const ed = p.locator('.ql-editor');
  await s.go(D); await p.getByText('Biçim Testi', { exact: true }).click(); await p.waitForTimeout(800);
  await s.step('long content', async () => { await ed.click(); await p.keyboard.press('Meta+ArrowDown'); const para = 'Uzun bölüm paragrafı; okuma konumu ve sayfa hesabı için yeterince uzun bir metin. '.repeat(6);
    for (let i = 0; i < 40; i++) { await p.keyboard.insertText((i + 1) + '. ' + para); await p.keyboard.press('Enter'); }
    s.clear(); await p.waitForTimeout(3500); const m = s.events.filter(e => e.vars).pop(); const len = (await ed.innerText()).length;
    return { chars: len, paras: await ed.locator('> *').count(), saved: !!m, err: m && m.err }; });
  await s.step('pageCount in DB via reader query', async () => p.evaluate(async () => { const r = await fetch('http://localhost:5055/', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ query: '{ getBookById(id:"000000000000000000000201"){ pageCount chapters{ title pageCount isHidden } } }' }) }); return (await r.json()); }));
  await s.step('unsaved leave via profile link', async () => { await ed.click(); await p.keyboard.type(' ek'); s.clear(); await p.getByText(/profile dön/i).click(); await p.waitForTimeout(2500); return { url: p.url(), dialogs: s.dialogs(), muts: s.muts().map(m => m.slice(0, 50)) }; });
  await s.step('unsaved + reload (beforeunload)', async () => { await s.go(D); await ed.click(); await p.keyboard.type('Z'); s.clear(); await p.reload(); await p.waitForTimeout(1500); return { dialogs: s.dialogs(), text: (await ed.innerText()).slice(0, 30) }; });
  await s.step('offline autosave failure', async () => { await ed.click(); await s.ctx.setOffline(true); await p.keyboard.type('OFF'); await p.waitForTimeout(3500); const badge = await p.locator('.main-content, body').first().innerText(); await s.shot('editor/autosave_offline'); const st = badge.match(/KAYDED[^\n]*|Kaydedil[^\n]*|KAYDET[^\n]*|Bağlantı[^\n]*|hata[^\n]*/gi); await s.ctx.setOffline(false); await p.waitForTimeout(12000); const after = (await p.locator('body').innerText()).match(/KAYDED[^\n]*|Kaydedil[^\n]*|Bağlantı[^\n]*/gi); return { offline: st, backOnline: after, toasts: await s.toasts() }; });
  await s.step('more menu', async () => { await p.getByText('Biçim Testi', { exact: true }).click(); await p.waitForTimeout(700); await p.locator('button:has-text("⋯"), button[aria-haspopup], button[aria-label*="işlem" i], button[aria-label*="seçenek" i]').first().click(); await p.waitForTimeout(400); await s.shot('editor/chapter_more_menu'); return await s.modal() || await s.ui('main', 60); });
  await s.end();
})();
