const { start, SB } = require('../lib.cjs');
const D = '/dashboard/000000000000000000000201';
(async () => {
  const s = await start({ role: 'author', tag: 'editor-b' }); const p = s.page;
  await s.go(D);
  await p.getByText('Biçim Testi', { exact: true }).click(); await p.waitForTimeout(800);
  const ed = p.locator('.ql-editor'); console.log('EMPTY CHAPTER placeholder:', await ed.getAttribute('data-placeholder'), '| html:', await ed.innerHTML());
  await s.shot('editor/empty_chapter');
  await ed.click(); await p.keyboard.type('Özel: <b>değil</b> & "tırnak" İıŞşĞğ 😀'); await p.keyboard.press('Enter');
  await p.keyboard.type('bağlantı'); await p.keyboard.press('Shift+Home'); await p.locator('.ql-toolbar .ql-link').click(); await p.waitForTimeout(300);
  console.log('LINK TOOLTIP:', await p.locator('.ql-tooltip').innerText().catch(() => 'none'), await p.locator('.ql-tooltip').getAttribute('class'));
  await p.locator('.ql-tooltip input').fill('https://example.org/x'); await p.keyboard.press('Enter'); await ed.click(); await p.keyboard.press('Meta+End'); await p.keyboard.press('Enter');
  // image via quill file input
  const fc = p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null); await p.locator('.ql-toolbar .ql-image').click(); const ch = await fc;
  if (ch) { await ch.setFiles(SB + '/data/test.png'); await p.waitForTimeout(1500); } console.log('FILECHOOSER', !!ch, 'accept:', ch && await ch.element().getAttribute('accept'));
  console.log('AFTER IMAGE UI:', await p.evaluate(() => [...document.querySelectorAll('[class*=modal i],[role=dialog]')].map(e => String(e.className).slice(0, 60) + ':' + (e.innerText || '').slice(0, 200)).join(' || ') || 'no modal'), 'toasts', await s.toasts());
  s.clear(); await p.waitForTimeout(2500);
  const html = await ed.innerHTML(); console.log('HTML:', html.replace(/data:image[^"]{60,}/g, m => m.slice(0, 50) + '…(' + m.length + ' chars)'));
  console.log('MUT:', s.muts().map(m => m.replace(/data:image[^"\\]{60,}/g, x => x.slice(0, 40) + '…(' + x.length + ')')).join('\n'), s.errs().join(';'));
  await s.shot('editor/link_image');
  // paste rich html
  await p.keyboard.press('Meta+End'); await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/html', '<p style="color:red;font-size:30px">renkli <span style="background:yellow">yapıştırma</span></p><table><tr><td>hücre</td></tr></table><h3>h3</h3><script>alert(1)</script><p class="ql-align-center">orta</p>'); dt.setData('text/plain', 'renkli'); document.querySelector('.ql-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await p.waitForTimeout(2500); console.log('AFTER PASTE:', (await ed.innerHTML()).replace(/data:image[^"]{60,}/g, 'data:…').slice(-400));
  // long content
  const para = 'Uzun bölüm paragrafı; okuma konumu ve sayfa hesabı için yeterince uzun bir metin. '.repeat(6);
  await p.evaluate((para) => { const dt = new DataTransfer(); dt.setData('text/plain', Array.from({ length: 60 }, (_, i) => (i + 1) + '. ' + para).join('\n')); document.querySelector('.ql-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, para);
  s.clear(); await p.waitForTimeout(3000);
  const m = s.events.filter(e => e.vars).pop(); const len = (await ed.innerText()).length; console.log('LONG: text chars', len, 'pageCount sent:', m && (m.vars.match(/"pageCount":(\d+)/) || [])[1] || (m ? 'vars truncated' : 'no save'), m && m.err);
  const pc = await p.evaluate(async () => 0);
  // unsaved leave: type and immediately click another chapter
  await p.keyboard.type('SON'); s.clear(); await p.getByText('Örnek bölüm 1', { exact: true }).click(); await p.waitForTimeout(1200);
  console.log('SWITCH WITH UNSAVED -> dialogs:', s.dialogs(), 'muts:', s.muts().map(m => m.slice(0, 60)), 'now editing:', (await ed.innerText()).slice(0, 40));
  // type and navigate away via PROFİLE DÖN immediately
  await ed.click(); await p.keyboard.type(' ek'); s.clear(); await p.getByRole('button', { name: 'PROFİLE DÖN' }).click(); await p.waitForTimeout(2500);
  console.log('LEAVE WITH UNSAVED -> url', p.url(), 'dialogs:', s.dialogs(), 'muts:', s.muts().map(m => m.slice(0, 80)));
  await s.go(D);
  // more menu
  await p.getByText('Biçim Testi', { exact: true }).click(); await p.waitForTimeout(600);
  await p.locator('button', { hasText: '⋯' }).first().click().catch(async () => { await p.locator('.chapter-menu-button, [aria-haspopup]').first().click(); }); await p.waitForTimeout(400);
  console.log('MORE MENU:', await p.evaluate(() => [...document.querySelectorAll('[role=menu],[class*=menu i],[class*=dropdown i]')].map(e => e.innerText.trim()).filter(Boolean).join(' || ')));
  await s.shot('editor/chapter_more_menu');
  await s.end();
})();
