const { start, SB } = require('../lib.cjs');
const B = '/kitap/docker-ornek-hikaye-dev-author';
const short = u => u.replace('http://localhost:3055', '');
(async () => {
  let s = await start({ role: 'author', tag: 'social-author' }); let p = s.page; await s.go(B);
  await s.step('reply', async () => { await p.locator('.comment-item .action-link').nth(1).click(); const box = p.locator('.reply-form input'); await box.pressSequentially('Teşekkürler!'); s.clear(); await p.locator('.reply-form button').click(); await p.waitForTimeout(1200); await s.shot('comments/thread_with_reply'); return { muts: s.muts(), items: await p.locator('.comment-item').evaluateAll(a => a.map(c => c.className + '|' + c.innerText.replace(/\n/g, ' ').slice(0, 70))) }; });
  await s.step('delete own reply', async () => { s.clear(); await p.locator('.comment-item').filter({ hasText: 'Teşekkürler' }).last().locator('.delete-icon-btn').last().click(); await p.waitForTimeout(1000); return { dialogs: s.dialogs(), muts: s.muts(), toasts: await s.toasts(), left: await p.locator('.comment-item').count() }; });
  await s.end();
  s = await start({ role: 'reader', tag: 'social-reader' }); p = s.page;
  console.log('URL', await s.go('/yazar/dev_author')); await s.shot('profile/other_author_as_reader', { full: true });
  await s.step('other profile text', async () => (await s.text('main', 1200)).replace(/\n/g, ' | '));
  await s.step('other profile ui', async () => s.ui('main', 40));
  await s.step('legacy /user/:id', async () => s.go('/user/000000000000000000000102'));
  await s.step('follow', async () => { s.clear(); await p.locator('main button').filter({ hasText: /takip et/i }).first().click(); await p.waitForTimeout(1000); return { muts: s.muts(), btns: await p.locator('main button').allInnerTexts().then(a => a.filter(t => /takip|istek/i.test(t))), toasts: await s.toasts(), counts: (await s.text('main', 300)).replace(/\n/g, ' | ') }; });
  await s.step('message from profile', async () => { s.clear(); await p.locator('main button, main a').filter({ hasText: /mesaj/i }).first().click(); await p.waitForTimeout(1500); await s.shot('messaging/chat_opened_from_profile'); return { url: short(p.url()), muts: s.muts(), ops: [...new Set(s.gql())], text: (await s.text('main', 500)).replace(/\n/g, ' | '), ui: await s.ui('main', 30) }; });
  await s.end();
})();
