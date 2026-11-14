const { start, SB } = require('../lib.cjs');
const B = '/kitap/docker-ornek-hikaye-dev-author';
(async () => {
  const s = await start({ role: 'reader', tag: 'reader-c' }); const p = s.page;
  await s.go(B + '/oku'); const paras = p.locator('.paragraph-block');
  await s.step('bookmark persisted after reload', async () => p.locator('.paragraph-block.has-bookmark').count());
  await s.step('bookmark remove', async () => { s.clear(); await p.locator('.paragraph-block.has-bookmark .paragraph-bookmark-btn').click(); await p.waitForTimeout(800); return { muts: s.muts(), left: await p.locator('.paragraph-block.has-bookmark').count() }; });
  await paras.nth(1).locator('.paragraph-comment-trigger').click(); await p.waitForTimeout(800);
  await s.step('pc empty text', async () => { return { empty: await p.locator('.pcpanel-empty').innerText().catch(() => null), sendDisabled: await p.locator('.pcpanel-send').isDisabled() }; });
  await s.step('pc add', async () => { await p.locator('.pcpanel-input').fill('Paragraf yorumu deneme 1 @dev_author'); s.clear(); await p.locator('.pcpanel-send').click(); await p.waitForTimeout(1000); await s.shot('reader/paragraph_comment_added'); return { muts: s.muts(), panel: (await p.locator('.pcpanel').innerText()).replace(/\n/g, ' | '), trigger: await paras.nth(1).locator('.paragraph-comment-trigger').getAttribute('title') }; });
  await s.step('pc enter key', async () => { await p.locator('.pcpanel-input').fill('İkinci yorum (Enter)'); s.clear(); await p.locator('.pcpanel-input').press('Enter'); await p.waitForTimeout(900); return { muts: s.muts().length, tag: await p.locator('.pcpanel-input').evaluate(e => e.tagName + ' max=' + e.maxLength) }; });
  await s.step('pc delete', async () => { s.clear(); await p.locator('.pcpanel-delete').first().click(); await p.waitForTimeout(900); return { dialogs: s.dialogs(), muts: s.muts(), count: await p.locator('.pcpanel-comment').count() }; });
  await p.locator('.pcpanel-close').click();
  // quote by selection
  const selectIn = async (idx, from, to) => { await p.evaluate(([idx, from, to]) => { const el = document.querySelectorAll('.paragraph-content')[idx]; const tn = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode(); const r = document.createRange(); r.setStart(tn, from); r.setEnd(tn, Math.min(to, tn.length)); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); }, [idx, from, to]); await p.waitForTimeout(700); };
  await s.step('select short (5 chars)', async () => { await selectIn(0, 0, 5); return { popup: await p.locator('.quote-popup').count() }; });
  await s.step('select valid', async () => { s.clear(); await selectIn(1, 0, 40); await s.shot('reader/quote_popup'); return { popup: (await p.locator('.quote-popup').innerText().catch(() => 'none')).replace(/\n/g, ' | '), gql: s.gql(), ui: await s.ui('.quote-popup', 20) }; });
  await s.step('quote save with note', async () => { await p.locator('.quote-note-input').fill('Not: deneme'); s.clear(); await p.locator('.quote-popup-btn.primary').click(); await p.waitForTimeout(1200); await s.shot('reader/quote_saved'); return { muts: s.muts(), popup: (await p.locator('.quote-popup').innerText().catch(() => 'closed')).replace(/\n/g, ' | '), toasts: await s.toasts() }; });
  await p.keyboard.press('Escape'); await p.mouse.click(700, 300); await p.waitForTimeout(400);
  await s.step('same selection again (duplicate)', async () => { s.clear(); await selectIn(1, 0, 40); return { popup: (await p.locator('.quote-popup').innerText().catch(() => 'none')).replace(/\n/g, ' | '), gql: s.gql() }; });
  await s.shot('reader/quote_duplicate');
  await p.mouse.click(700, 300); await p.waitForTimeout(300);
  await s.step('copy protection', async () => p.evaluate(() => { const el = document.querySelector('.paragraph-content'); const cs = getComputedStyle(el); const e1 = new ClipboardEvent('copy', { bubbles: true, cancelable: true }); const r1 = el.dispatchEvent(e1); const e2 = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); const r2 = el.dispatchEvent(e2); return { userSelect: cs.userSelect, copyPrevented: !r1, contextMenuPrevented: !r2 }; }));
  await s.step('share chapter', async () => { await p.getByRole('button', { name: 'Bölümü paylaş' }).click(); await p.waitForTimeout(600); const m = await s.modal(); const link = await p.evaluate(() => [...document.querySelectorAll('[class*=share i] input, [class*=share i] a')].map(e => e.value || e.href).join(' , ')); await p.keyboard.press('Escape'); return { m: m.slice(0, 200), link }; });
  await s.end();
})();
