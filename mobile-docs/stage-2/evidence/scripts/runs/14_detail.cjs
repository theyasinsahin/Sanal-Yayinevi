const { start, SB } = require('../lib.cjs');
const B = '/kitap/docker-ornek-hikaye-dev-author';
const short = u => u.replace('http://localhost:3055', '');
(async () => {
  // guest: gate + hidden chapter
  let s = await start({ role: 'guest', tag: 'detail-guest' }); let p = s.page;
  await s.go(B); await s.step('guest detail ui', async () => s.ui('main', 40));
  await s.step('guest like click', async () => { s.clear(); await p.locator('main button').filter({ hasText: /^$/ }).first().click(); await p.waitForTimeout(900); return { url: short(p.url()), toasts: await s.toasts(), modal: (await s.modal()).slice(0, 300), muts: s.muts() }; });
  await s.shot('auth/guest_action_prompt');
  await s.go(B); await s.step('guest comment box', async () => { const t = await s.text('main', 3000); return t.slice(t.indexOf('Yorumlar')).replace(/\n/g, ' | ').slice(0, 300); });
  await s.step('guest reader', async () => { const u = await s.go(B + '/oku'); await s.shot('reader/guest_gate'); return { u, text: (await s.text('body', 900)).replace(/\n/g, ' | ') }; });
  await s.step('guest reader next', async () => { const b = p.locator('.chapter-navigation button').last(); const t = await b.innerText(); s.clear(); await b.click(); await p.waitForTimeout(1200); await s.shot('reader/guest_gate_after_next'); return { t, url: short(p.url()), text: (await s.text('.reading-area', 500)).replace(/\n/g, ' | '), modal: await s.modal() }; });
  await s.step('guest hidden chapter url', async () => { const u = await s.go('/kitap/docker-ornek-hikaye-dev-author/bolum/gizli-ornek-bolum'); return { u, text: (await s.text('.reading-area, main', 300)).replace(/\n/g, ' | ') }; });
  await s.step('guest select text', async () => { await s.go(B + '/oku'); await p.evaluate(() => { const el = document.querySelector('.paragraph-content'); const tn = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(); const r = document.createRange(); r.setStart(tn, 0); r.setEnd(tn, 30); getSelection().removeAllRanges(); getSelection().addRange(r); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); }); await p.waitForTimeout(700); return { popup: (await p.locator('.quote-popup').innerText().catch(() => 'none')).replace(/\n/g, ' | ') }; });
  await s.end();
  // reader: detail interactions
  s = await start({ role: 'reader', tag: 'detail-reader' }); p = s.page; await s.go(B);
  await s.step('icon buttons', async () => p.locator('main button').evaluateAll(a => a.map(b => (b.getAttribute('aria-label') || b.title || b.innerText || b.className).trim().slice(0, 40))));
  const act = async (name, loc) => s.step(name, async () => { s.clear(); await loc.click(); await p.waitForTimeout(900); return { muts: s.muts().map(m => m.slice(0, 150)), toasts: await s.toasts() }; });
  const icon = i => p.locator('main button').filter({ hasText: /^$/ }).nth(i);
  await act('like', icon(0)); await act('unlike', icon(0)); await act('like again', icon(0));
  await act('save', icon(1));
  await act('follow book', p.getByRole('button', { name: /Kitabı Takip Et/ }));
  await s.step('follow label now', async () => p.locator('main button').evaluateAll(a => a.map(b => b.innerText.trim()).filter(t => /takip/i.test(t))));
  await act('print interest', p.getByRole('button', { name: /BASILMASINI İSTİYORUM/i }));
  await s.step('interest panel', async () => { const t = await s.text('main', 3000); return t.slice(t.indexOf('Bu kitabın basılmasını'), t.indexOf('Yorumlar')).replace(/\n/g, ' | '); });
  await s.shot('books/detail_after_interactions', { full: true });
  await s.step('support button', async () => { await p.getByRole('button', { name: 'DESTEK OL' }).click(); await p.waitForTimeout(1500); await s.shot('funding/donate_no_campaign'); return { url: short(p.url()), text: (await s.text('main', 600)).replace(/\n/g, ' | ') }; });
  await s.go(B);
  await s.step('share book', async () => { await p.getByRole('button', { name: 'Kitabı paylaş' }).click(); await p.waitForTimeout(700); await s.shot('share/book_share_dialog'); const link = await p.evaluate(() => [...document.querySelectorAll('input[readonly]')].map(e => e.value).join(',')); s.clear(); await p.getByText('Bağlantıyı kopyala').click().catch(() => {}); await p.waitForTimeout(500); const t = await s.toasts(); const m = await s.modal(); return { link, toasts: t, afterCopy: m.slice(0, 250) }; });
  await s.end();
})();
