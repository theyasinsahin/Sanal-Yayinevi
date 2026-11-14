const { start } = require('../lib.cjs');
const D = '/dashboard/000000000000000000000201';
(async () => {
  const s = await start({ role: 'author', tag: 'editor' }); const p = s.page;
  await s.go(D);
  // add chapter: empty title first
  await p.getByRole('button', { name: 'EKLE' }).click(); await p.waitForTimeout(600);
  console.log('EMPTY ADD ->', s.muts().join('|') || 'no mutation', 'toasts', await s.toasts());
  await p.getByPlaceholder('Yeni Bölüm...').fill('Biçim Testi'); s.clear();
  await p.getByRole('button', { name: 'EKLE' }).click(); await p.waitForTimeout(1500);
  console.log('ADD ->', s.muts().join('|'), 'toasts', await s.toasts(), '\nLIST:', await s.text('.main-content, body', 400));
  const ed = p.locator('.ql-editor'); await ed.click();
  const title = await p.locator('h1,h2,h3').allInnerTexts(); console.log('HEADS', title.join(' / '));
  console.log('TOOLBAR', await p.evaluate(() => [...document.querySelectorAll('.ql-toolbar button, .ql-toolbar select, .ql-toolbar .ql-picker')].map(e => e.className + (e.value ? '=' + e.value : '')).join(' ; ')));
  console.log('HEADER OPTS', await p.evaluate(() => [...document.querySelectorAll('.ql-toolbar select option, .ql-picker-item')].map(e => e.getAttribute('data-value') || e.value || 'normal').join(',')));
  const t0 = Date.now(); s.clear();
  await p.keyboard.type('Düz paragraf bir.'); 
  const waitSave = async () => { for (let i = 0; i < 80; i++) { if (s.events.some(e => e.t === 'gql' && e.vars)) return Date.now(); await p.waitForTimeout(100); } return 0; };
  const t1 = await waitSave(); console.log('AUTOSAVE after ms:', t1 - t0, 'badge:', await p.locator('[class*=status i],[class*=badge i],[class*=save i]').allInnerTexts().catch(() => []));
  console.log('MUT', s.muts().join('\n'));
  // formats
  const fmt = async (cls, text) => { await p.keyboard.press('Enter'); await p.locator('.ql-toolbar .' + cls).first().click(); await p.keyboard.type(text); await p.locator('.ql-toolbar .' + cls).first().click().catch(() => {}); };
  await fmt('ql-bold', 'kalın'); await fmt('ql-italic', 'italik'); await fmt('ql-underline', 'altı çizili'); await fmt('ql-strike', 'üstü çizili');
  await p.keyboard.press('Enter'); await p.locator('.ql-toolbar .ql-blockquote').click(); await p.keyboard.type('alıntı bloğu'); await p.keyboard.press('Enter'); await p.locator('.ql-toolbar .ql-blockquote').click();
  await p.locator('.ql-toolbar .ql-list[value=ordered]').click(); await p.keyboard.type('sıralı 1'); await p.keyboard.press('Enter'); await p.keyboard.type('sıralı 2'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.locator('.ql-toolbar .ql-list[value=bullet]').click(); await p.keyboard.type('madde 1'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  // headers via picker
  for (const v of ['1', '2', '3']) { const pick = p.locator('.ql-toolbar .ql-header'); await pick.locator('.ql-picker-label').click().catch(() => {}); const it = p.locator(`.ql-picker-item[data-value="${v}"]`); if (await it.count()) { await it.click(); await p.keyboard.type('Başlık ' + v); await p.keyboard.press('Enter'); } }
  await p.keyboard.type('Özel karakterler: <b>değil</b> & "tırnak" İıŞşĞğÜüÖöÇç 😀'); 
  // link
  await p.keyboard.press('Enter'); await p.keyboard.type('bağlantı'); await p.keyboard.press('Shift+Home'); await p.locator('.ql-toolbar .ql-link').click(); await p.waitForTimeout(300);
  const tip = p.locator('.ql-tooltip input'); if (await tip.isVisible().catch(() => false)) { await tip.fill('https://example.org/x'); await p.keyboard.press('Enter'); console.log('LINK tooltip used'); }
  await p.keyboard.press('End');
  await s.shot('editor/formats_applied');
  s.clear(); await p.waitForTimeout(2600);
  console.log('HTML:', await ed.evaluate(e => e.innerHTML));
  console.log('SAVE MUT:', s.muts().map(m => m.slice(0, 1500)).join('\n'));
  // keyboard shortcut save
  await p.keyboard.type(' x'); s.clear(); await p.keyboard.press('Meta+s'); await p.waitForTimeout(500); console.log('CMD+S ->', s.muts().length ? 'saved immediately' : 'no immediate save'); await p.keyboard.press('Control+s'); await p.waitForTimeout(500); console.log('CTRL+S ->', s.muts().length);
  await p.waitForTimeout(2000);
  // image button
  s.clear(); await p.locator('.ql-toolbar .ql-image').click(); await p.waitForTimeout(800);
  console.log('IMAGE CLICK UI:', await p.evaluate(() => [...document.querySelectorAll('[class*=modal i],[role=dialog],input[type=file]')].map(e => e.tagName + '.' + String(e.className).slice(0, 60) + ':' + (e.innerText || '').slice(0, 200)).join(' || ')));
  await s.shot('editor/image_button_clicked');
  // more menu
  await p.keyboard.press('Escape');
  const more = p.locator('button', { hasText: '⋯' }).or(p.locator('button[aria-label*=seçenek i], button[aria-label*=menü i], button[aria-haspopup]')).first();
  console.log('MORE count', await more.count()); 
  await s.end();
})();
