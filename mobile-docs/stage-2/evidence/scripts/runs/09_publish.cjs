const { start, SB } = require('../lib.cjs');
(async () => {
  const s = await start({ role: 'author', tag: 'publish' }); const p = s.page; const ed = p.locator('.ql-editor');
  await s.go('/profile'); await s.shot('profile/own_author', { full: true });
  await s.step('profile text', async () => (await s.text('main', 1500)).replace(/\n/g, ' | '));
  await s.step('profile ui', async () => s.ui('main', 60));
  const href = await p.locator('a[href^="/dashboard/"]').evaluateAll(a => a.map(x => x.getAttribute('href')));
  console.log('dash links', href);
  const newDash = '/dashboard/6af85920fbba96dbf14e42be';
  await s.go(newDash);
  await s.step('publish with no chapters', async () => { s.clear(); const b = p.getByRole('button', { name: /Yayınla/ }); const dis = await b.isDisabled(); if (!dis) { await b.click(); await p.waitForTimeout(800); } return { disabled: dis, dialogs: s.dialogs(), muts: s.muts(), toasts: await s.toasts() }; });
  await s.step('add chapter & write', async () => { await p.getByPlaceholder('Yeni Bölüm...').fill('Birinci Bölüm'); await p.getByRole('button', { name: /ekle/i }).click(); await p.waitForTimeout(1200); await p.getByText('Birinci Bölüm', { exact: true }).first().click(); await p.waitForTimeout(600); await ed.click(); for (let i = 1; i <= 12; i++) { await p.keyboard.insertText(`Paragraf ${i}. ` + 'Gece boyunca yağan yağmur sabaha karşı dindi ve şehir yeniden nefes aldı. '.repeat(4)); await p.keyboard.press('Enter'); } await p.waitForTimeout(2500); return (await s.text('main', 300)).replace(/\n/g, ' | '); });
  await s.step('publish dismiss', async () => { p.__dismiss = true; s.clear(); await p.getByRole('button', { name: /Yayınla/ }).click(); await p.waitForTimeout(800); p.__dismiss = false; return { dialogs: s.dialogs(), muts: s.muts() }; });
  await s.step('publish accept', async () => { s.clear(); await p.getByRole('button', { name: /Yayınla/ }).click(); await p.waitForTimeout(1800); await s.shot('writing/after_publish'); return { dialogs: s.dialogs(), muts: s.muts(), toasts: await s.toasts(), bar: (await p.locator('.dashboard-publish-bar').innerText()).replace(/\n/g, ' | ') }; });
  await s.step('complete writing', async () => { s.clear(); await p.getByRole('button', { name: /Yazımı Tamamla/ }).click(); await p.waitForTimeout(1800); await s.shot('writing/after_complete'); return { dialogs: s.dialogs(), muts: s.muts(), toasts: await s.toasts(), bar: (await p.locator('.dashboard-publish-bar').innerText()).replace(/\n/g, ' | ') }; });
  await s.step('bar buttons after complete', async () => s.ui('.dashboard-publish-bar', 20));
  await s.step('score', async () => p.evaluate(async () => { const r = await fetch('http://localhost:5055/', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ query: '{ __type(name:"Query"){ fields{ name } } }' }) }); const j = await r.json(); return j.data.__type.fields.map(f => f.name).filter(n => /score|badge|notif/i.test(n)); }));
  await s.end();
})();
