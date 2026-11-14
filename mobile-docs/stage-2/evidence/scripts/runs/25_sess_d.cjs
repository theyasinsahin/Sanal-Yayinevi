const { start, SB } = require('../lib.cjs');
const one = t => t.replace(/\n+/g, ' | ');
const U = '/oturum/stage2-acik-oturum';
(async () => {
  const A = await start({ role: 'author', tag: 'sess-author' }), R = await start({ role: 'reader', tag: 'sess-reader' }), G = await start({ role: 'guest', tag: 'sess-guest' }); const a = A.page, r = R.page, g = G.page;
  await A.go(U); await R.go(U);
  await R.step('like entry (author sees live?)', async () => { R.clear(); await r.locator('.entry-card-like-btn').first().click(); await r.waitForTimeout(1500); return { muts: R.muts(), authorSees: await a.locator('.entry-card-like-btn').first().innerText(), order: await r.locator('.entry-card-content').allInnerTexts() }; });
  await R.step('delete controls', async () => r.locator('.entry-card').evaluateAll(c => c.map(e => e.querySelector('.entry-card-name').innerText + ':' + [...e.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.innerText).join(','))));
  await A.step('author controls on entries', async () => a.locator('.entry-card').evaluateAll(c => c.map(e => e.querySelector('.entry-card-name').innerText + ':' + [...e.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.innerText).join(','))));
  await R.step('reader deletes own', async () => { R.clear(); await r.locator('.entry-card').filter({ hasText: 'Okurdan yanıt' }).locator('button').last().click(); await r.waitForTimeout(1200); return { dialogs: R.dialogs(), muts: R.muts(), authorCount: await a.locator('.entry-card').count() }; });
  await R.step('ctrl+enter posts', async () => { const ta = r.locator('main textarea').first(); await ta.fill('Ctrl+Enter ile'); R.clear(); await ta.press('Control+Enter'); await r.waitForTimeout(900); return R.muts().length; });
  await R.step('entry deep link', async () => { const id = await r.locator('.entry-card').first().getAttribute('id'); await R.go(U + '#' + id); return { id, active: await r.evaluate(() => document.activeElement?.id), cls: await r.locator('#' + id).getAttribute('class') }; });
  await R.step('share session', async () => { await r.getByRole('button', { name: 'Oturumu paylaş' }).click(); await r.waitForTimeout(600); const link = await r.evaluate(() => [...document.querySelectorAll('input[readonly]')].map(e => e.value).join(',')); await r.keyboard.press('Escape'); return link; });
  await G.step('guest session view', async () => { await G.go(U); await G.shot('sessions/detail_guest'); return one(await G.text('main', 500)).slice(-260) + ' ## ' + await G.ui('main', 12); });
  await G.step('legacy /sessions/:id', async () => G.go('/sessions/6af85c71fbba96dbf14e505e'));
  await A.step('cover edit', async () => { await A.clickText('KAPAK FOTOĞRAFINI DÜZENLE', 'main'); await a.waitForTimeout(500); const m = (await A.modal()).slice(0, 250); const fc = a.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null); await a.locator('[class*=modal i] [class*=upload i], [class*=modal i] label, [class*=modal i] button').filter({ hasText: /yükle|seç/i }).first().click().catch(() => {}); const ch = await fc; if (ch) { await ch.setFiles(SB + '/data/test.png'); await a.waitForTimeout(1500); } await A.shot('sessions/cover_edit'); A.clear(); await A.clickText('Kaydet', 'body').catch(() => {}); await a.waitForTimeout(1200); return { m, chooser: !!ch, muts: A.muts(), toasts: await A.toasts() }; });
  // private session
  await A.go('/sessions'); await A.clickText('OTURUM AÇ', 'main'); await a.waitForTimeout(400);
  await A.step('create private', async () => { await a.getByPlaceholder('Oturum konusu...').fill('Stage2 Özel Oturum'); await A.clickText('Özel', '.sessions-modal'); await a.waitForTimeout(300); const extra = one(await a.locator('.sessions-modal').innerText()).slice(-260); const code = a.locator('.sessions-modal input').filter({ hasNot: a.locator('[placeholder="Oturum konusu..."]') }); console.log('  private modal inputs:', await a.locator('.sessions-modal input').evaluateAll(x => x.map(i => i.placeholder + '/' + i.type + '/' + i.maxLength))); return extra; });
  await A.shot('sessions/create_private');
  await A.end(); await R.end(); await G.end();
})();
