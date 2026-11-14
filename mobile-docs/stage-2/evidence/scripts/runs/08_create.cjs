const { start, SB } = require('../lib.cjs');
(async () => {
  const s = await start({ role: 'author', tag: 'create' }); const p = s.page;
  await s.go('/create-book');
  await s.step('form options', async () => p.evaluate(() => [...document.querySelectorAll('main select')].map(sel => [...sel.options].map(o => o.text).join(',')).join(' ## ')));
  await s.step('fill basics', async () => { await p.getByPlaceholder('Örn: Sefiller').fill('Stage2 Deneme Romanı: Çağ & Işık'); await p.locator('main select').first().selectOption({ label: 'Roman' }).catch(async () => p.locator('main select').first().selectOption({ index: 1 })); await p.locator('textarea').fill('Stage 2 için oluşturulan deneme kitabı. Özel karakter: <i>&</i>.'); });
  await s.step('genre picker', async () => { await p.getByText('Kurgu ve Hikâyeler').click(); await p.waitForTimeout(400); const t = await s.text('main', 2500); return t.slice(t.indexOf('Tür ve konular'), t.indexOf('Etiketler')).replace(/\n/g, ' | '); });
  await s.step('pick 4 genres (max 3)', async () => { const boxes = p.locator('main input[type=checkbox]'); const n = await boxes.count(); const picked = []; for (let i = 0; i < Math.min(n, 4); i++) { const b = boxes.nth(i); if (await b.isDisabled()) { picked.push('disabled@' + i); continue; } await b.check(); picked.push(i); } const t = await s.text('main', 3000); return { n, picked, counter: t.match(/Tür ve konular \* \(\d\/3\)/), dis: await p.locator('main input[type=checkbox]:disabled').count() }; });
  await s.step('tags', async () => { const tag = p.getByPlaceholder(/Etiket ara/); await tag.fill('deneme-etiketi'); await p.waitForTimeout(700); const sug = await s.modal(); await p.getByRole('button', { name: 'EKLE', exact: true }).click(); await p.waitForTimeout(300); await tag.fill('İkinci Etiket!'); await p.keyboard.press('Enter'); await p.waitForTimeout(300); const t = await s.text('main', 3000); return { sug, tagsArea: t.slice(t.indexOf('Etiketler'), t.indexOf('Anlatım')).replace(/\n/g, ' | ').slice(0, 300), url: p.url() }; });
  await s.step('cover upload flow', async () => { const fc = p.waitForEvent('filechooser'); await p.getByText('Kapak Yükle').click(); const ch = await fc; console.log('  accept=', await ch.element().getAttribute('accept')); await ch.setFiles(SB + '/data/test.png'); await p.waitForTimeout(1200); await s.shot('writing/cover_crop_modal'); const m = await s.modal(); return m; });
  await s.step('crop confirm', async () => { const b = p.locator('[class*=modal i] button, [class*=crop i] button'); console.log('  crop buttons:', await b.allInnerTexts()); await b.filter({ hasText: /kırp|kaydet|onayla|yükle|tamam/i }).last().click(); await p.waitForTimeout(2500); return { ev: s.events.filter(e => e.t.startsWith('cloud')).length, toasts: await s.toasts(), img: await p.locator('main img').evaluateAll(a => a.map(i => i.src.slice(0, 90))) }; });
  await s.shot('writing/create_book_filled', { full: true });
  await s.step('submit', async () => { s.clear(); await p.getByRole('button', { name: /taslak olarak kaydet/i }).click(); await p.waitForTimeout(2500); return { url: p.url(), muts: s.muts(), toasts: await s.toasts(), errs: s.errs() }; });
  await s.shot('writing/after_create_book');
  await s.step('landing after create', async () => s.text('main', 700));
  await s.end();
})();
