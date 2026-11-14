const { start, SB } = require('../lib.cjs');
const D = '/dashboard/000000000000000000000201';
(async () => {
  const s = await start({ role: 'author', tag: 'dash-b' }); const p = s.page;
  await s.go(D); await p.getByText('Biçim Testi', { exact: true }).click(); await p.waitForTimeout(800);
  const menu = () => p.locator('summary[aria-label="Bölüm işlemleri"]').click();
  await s.step('hide chapter', async () => { await menu(); s.clear(); await p.getByRole('button', { name: 'Okuyuculardan gizle' }).click(); await p.waitForTimeout(900); await menu().catch(() => {}); const lab = await p.locator('.editor-chapter-actions-menu').innerText(); return { muts: s.muts(), menuNow: lab, list: (await s.text('main', 600)).match(/Biçim Testi[^\n]*/g), toasts: await s.toasts() }; });
  await s.step('show chapter', async () => { s.clear(); await p.locator('.editor-chapter-actions-menu button').first().click(); await p.waitForTimeout(900); return { muts: s.muts(), toasts: await s.toasts() }; });
  await s.step('share chapter', async () => { await menu().catch(() => {}); if (!(await p.getByRole('button', { name: 'Bölümü paylaş' }).isVisible())) await menu(); await p.getByRole('button', { name: 'Bölümü paylaş' }).click(); await p.waitForTimeout(700); await s.shot('share/chapter_share_dialog_dashboard'); const m = await s.modal(); await p.keyboard.press('Escape'); await p.waitForTimeout(300); return { modal: m, closedByEsc: !(await s.modal()).includes('Paylaş') }; });
  await s.step('close share', async () => { const c = p.locator('[class*=modal i] button[aria-label*=kapat i], [class*=share i] button[aria-label*=kapat i]').first(); if (await c.isVisible().catch(() => false)) await c.click(); });
  await s.step('add hidden chapter + delete', async () => { await p.getByPlaceholder('Yeni Bölüm...').fill('Silinecek Bölüm'); await p.locator('input[type=checkbox]').first().check(); s.clear(); await p.getByRole('button', { name: /ekle/i }).click(); await p.waitForTimeout(1200); const created = s.muts(); p.__dismiss = true; s.clear(); await p.getByRole('button', { name: 'Silinecek Bölüm bölümünü sil' }).click(); await p.waitForTimeout(700); const dismissed = { dialogs: s.dialogs(), muts: s.muts().length }; p.__dismiss = false; s.clear(); await p.getByRole('button', { name: 'Silinecek Bölüm bölümünü sil' }).click(); await p.waitForTimeout(1200); return { created, dismissed, accepted: { dialogs: s.dialogs(), muts: s.muts() }, toasts: await s.toasts(), stillListed: await p.getByText('Silinecek Bölüm').count() }; });
  await s.step('classification edit', async () => { await p.getByRole('button', { name: /sınıflandırmayı düzenle/i }).click(); await p.waitForTimeout(800); await s.shot('writing/classification_editor', { full: true }); return (await s.text('main', 1500)); });
  await s.step('classification ui', async () => s.ui('main', 60));
  await s.end();
})();
