const { start, SB } = require('../lib.cjs');
const B = '/kitap/docker-ornek-hikaye-dev-author';
const short = u => u.replace('http://localhost:3055', '');
(async () => {
  const s = await start({ role: 'author', tag: 'notif' }); const p = s.page; await s.go(B);
  await s.step('author detail extras', async () => s.ui('main', 40));
  await s.step('bell badge', async () => p.locator('nav button[aria-label*=ildirim i], nav [class*=notification i]').first().innerText());
  await s.step('open bell', async () => { s.clear(); await p.getByRole('button', { name: 'Bildirimler' }).first().click(); await p.waitForTimeout(1000); await s.shot('notifications/panel_author'); const cls = await p.evaluate(() => [...new Set([...document.querySelectorAll('[class*=notif i]')].map(e => String(e.className)))].join(' , ').slice(0, 600)); return { panel: (await p.locator('[class*=notification-panel i], [class*=notification-dropdown i], [class*=notif i][class*=panel i], [class*=notif i][class*=menu i]').first().innerText().catch(() => '?')).replace(/\n/g, ' | ').slice(0, 900), ops: s.gql(), cls }; });
  await s.step('click first notification', async () => { s.clear(); const it = p.locator('[class*=notification-item i]').first(); const txt = (await it.innerText()).replace(/\n/g, ' / '); await it.click(); await p.waitForTimeout(1500); return { txt, url: short(p.url()), muts: s.muts(), focused: await p.evaluate(() => document.activeElement?.id || document.activeElement?.className) }; });
  await s.go(B);
  await s.step('reply to comment', async () => { await p.locator('.comment-item .action-link').nth(1).click(); await p.waitForTimeout(400); await s.shot('comments/reply_box'); const box = p.locator('.comment-item textarea, [class*=reply i] textarea').first(); await box.fill('Teşekkürler! @dev_reader'); s.clear(); await p.locator('[class*=reply i] button, .comment-item button').filter({ hasText: /gönder|yanıtla/i }).last().click(); await p.waitForTimeout(1200); const t = await s.text('main', 5000); return { muts: s.muts(), section: t.slice(t.indexOf('Yorumlar')).replace(/\n/g, ' | ').slice(0, 500) }; });
  await s.step('like comment', async () => { s.clear(); await p.locator('.comment-item .action-link').first().click(); await p.waitForTimeout(800); return { muts: s.muts(), cls: await p.locator('.comment-item .action-link').first().getAttribute('class') }; });
  await s.step('author delete others comment?', async () => p.locator('.comment-item').evaluateAll(a => a.map(c => c.querySelector('.username')?.innerText + ' del=' + !!c.querySelector(':scope > .comment-header .delete-icon-btn'))));
  await s.shot('comments/thread_with_reply');
  await s.step('delete own reply', async () => { s.clear(); const del = p.locator('.comment-item').filter({ hasText: 'Teşekkürler' }).last().locator('.delete-icon-btn').last(); await del.click(); await p.waitForTimeout(1000); return { dialogs: s.dialogs(), muts: s.muts(), toasts: await s.toasts() }; });
  await s.end();
})();
