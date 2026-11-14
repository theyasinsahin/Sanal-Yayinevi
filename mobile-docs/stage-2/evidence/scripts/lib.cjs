const path = require('path'), fs = require('fs'), zlib = require('zlib');
const SB = path.resolve(__dirname, '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(SB, 'pw-browsers');
const { chromium } = require(path.join(SB, 'app/Client/node_modules/@playwright/test'));
const SHOTS = '/Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/stage-2/screenshots';
const BASE = 'http://localhost:3055', API = 'http://localhost:5055';
const VP = { desktop: { viewport: { width: 1440, height: 900 } },
  tablet: { viewport: { width: 834, height: 1112 }, hasTouch: true },
  mobile: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const EMAILS = { admin: 'admin@betik-dev.invalid', author: 'author@betik-dev.invalid', reader: 'reader@betik-dev.invalid', publisher: 'publisher@betik-dev.invalid' };
// 64x96 solid PNG served for mocked Cloudinary images
function png(w = 240, h = 360, rgb = [176, 94, 52]) {
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, (_, x) => Buffer.from(rgb.map((v, i) => Math.max(0, v - Math.floor(x / 4) * (i === 1 ? 1 : 0))))))]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = png();
let uploadN = 0;
async function start({ role = 'guest', vp = 'desktop', tag = 'run', extra = {} } = {}) {
  const browser = await chromium.launch();
  const statePath = path.join(SB, 'data/state', role + '.json');
  const ctx = await browser.newContext({ ...VP[vp], locale: 'tr-TR', timezoneId: 'Europe/Istanbul', ...(role !== 'guest' && fs.existsSync(statePath) ? { storageState: statePath } : {}), ...extra });
  const events = [];
  const ev = (o) => { events.push(o); };
  // Mocked third parties: nothing leaves the machine for uploads.
  await ctx.route('https://api.cloudinary.com/**', r => { uploadN++; ev({ t: 'cloudinary-upload-mocked', url: r.request().url() }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: `https://res.cloudinary.com/betik-sandbox-mock/image/upload/v1/sandbox/img_${Date.now()}_${uploadN}.png`, public_id: 'sandbox/img' }) }); });
  await ctx.route('https://res.cloudinary.com/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  const page = await ctx.newPage(); page.setDefaultTimeout(6000);
  wire(page, ev);
  const s = { browser, ctx, page, events, role, vp, tag,
    async go(p, wait = 900) { await page.goto(p.startsWith('http') ? p : BASE + p, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(wait); return page.url().replace(BASE, ''); },
    async shot(name, opts = {}) { const f = path.join(SHOTS, `${name}__${vp}.png`); fs.mkdirSync(path.dirname(f), { recursive: true }); await page.screenshot({ path: f, fullPage: !!opts.full, animations: 'disabled', ...(opts.clip ? { clip: opts.clip } : {}) }).catch(e => console.log('SHOT FAIL', name, e.message.split('\n')[0])); return f; },
    async text(sel = 'body', max = 2500) { let t; if (sel === 'body') t = await page.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('nav,footer,header.navbar,[class*=navbar i],[class*=footer i],[class*=mobile-menu i],script,style').forEach(e => e.remove()); document.body.appendChild(c); c.style.position='absolute'; const x = c.innerText; c.remove(); return x; }); else t = await page.locator(sel).first().innerText().catch(() => '(none)'); return t.replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').slice(0, max); },
    async ui(sel = 'main', max = 80) { return page.evaluate(([sel, max]) => { const root = document.querySelector(sel) || document.body; const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }; const out = []; for (const e of root.querySelectorAll('a,button,input,select,textarea,[role=button],[role=tab],[role=menuitem],[contenteditable=true]')) { if (!vis(e)) continue; const tag = e.tagName.toLowerCase(); const lab = (e.getAttribute('aria-label') || e.innerText || e.getAttribute('placeholder') || e.getAttribute('title') || e.getAttribute('name') || '').trim().replace(/\s+/g, ' ').slice(0, 50); out.push(tag + (e.type && tag !== 'a' ? ':' + e.type : '') + (e.disabled ? '[dis]' : '') + (tag === 'a' ? '(' + (e.getAttribute('href') || '') .slice(0, 40) + ')' : '') + ' "' + lab + '"'); if (out.length >= max) break; } return out.join(' | '); }, [sel, max]); },
    toasts() { return page.evaluate(() => [...document.querySelectorAll('[class*=toast i],[class*=Toast],[role=alert],[class*=snackbar i]')].map(e => e.innerText.trim()).filter(Boolean)); },
    muts() { return events.filter(e => e.t === 'gql' && e.vars).map(e => e.op + ' ' + e.vars + (e.err ? ' !! ' + e.err : '')); },
    dialogs() { return events.filter(e => e.t === 'dialog').map(e => e.m); },
    gql() { return events.filter(e => e.t === 'gql').map(e => e.op + (e.err ? ' !! ' + e.err : '')); },
    errs() { return events.filter(e => ['console', 'pageerror', 'http', 'reqfail'].includes(e.t)).map(e => e.t + ': ' + (e.m || '').slice(0, 220)); },
    async step(name, fn) { try { const r = await fn(); if (r !== undefined) console.log('• ' + name + ':', typeof r === 'string' ? r : JSON.stringify(r)); } catch (e) { console.log('✗ ' + name + ': ' + String(e.message).split('\n')[0].slice(0, 160)); } },
    async modal() { return page.evaluate(() => [...document.querySelectorAll('[class*=modal i],[role=dialog],[role=menu],[class*=dropdown i],[class*=popover i],[class*=popup i]')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim().replace(/\n+/g, ' / ').slice(0, 500)).filter(Boolean).join(' || ')); },
    async clickText(text, scope = 'body', nth = 0) { const ok = await page.evaluate(([text, scope, nth]) => { const up = t => (t || '').toLocaleUpperCase('tr').replace(/\s+/g, ' ').trim(); const root = document.querySelector(scope) || document.body; const els = [...root.querySelectorAll('button,a,[role=button],[role=tab],summary,label')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && up(e.innerText || e.getAttribute('aria-label')).includes(up(text)); }); els.sort((a, b) => a.innerText.length - b.innerText.length); const el = els[nth]; if (!el) return false; el.setAttribute('data-pw-target', '1'); return true; }, [text, scope, nth]); if (!ok) throw new Error('clickText: not found: ' + text); const l = page.locator('[data-pw-target="1"]').first(); await l.click(); await page.evaluate(() => document.querySelectorAll('[data-pw-target]').forEach(e => e.removeAttribute('data-pw-target'))).catch(() => {}); },
    ws() { return events.filter(e => e.t === 'ws').map(e => e.m); },
    clear() { events.length = 0; },
    async login(as = role) { await s.go('/login'); await page.locator('input[type=email], input[name=email]').first().fill(EMAILS[as] || as.email); await page.locator('input[type=password]').first().fill(as.password || process.env.DEV_SEED_PASSWORD); await page.locator('button[type=submit]').first().click(); await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(800); await ctx.storageState({ path: path.join(SB, 'data/state', (as.name || as) + '.json') }); return page.url().replace(BASE, ''); },
    async save() { if (role !== 'guest') await ctx.storageState({ path: statePath }); },
    async end() { fs.appendFileSync(path.join(SB, 'logs/events.jsonl'), events.map(e => JSON.stringify({ tag, role, vp, ...e })).join('\n') + '\n'); await browser.close(); },
  };
  return s;
}
function wire(page, ev) {
  page.on('console', m => { if (m.type() === 'error') ev({ t: 'console', m: m.text() }); });
  page.on('pageerror', e => ev({ t: 'pageerror', m: String(e.message) }));
  page.on('requestfailed', r => { if (!/sockjs|hot-update|\/ws$/.test(r.url())) ev({ t: 'reqfail', m: r.url() + ' ' + (r.failure()?.errorText || '') }); });
  page.on('dialog', async d => { ev({ t: 'dialog', m: d.type() + ': ' + d.message() }); if (page.__dismiss) await d.dismiss().catch(()=>{}); else await d.accept().catch(()=>{}); });
  page.on('websocket', ws => { if (!ws.url().includes('5055')) return; ev({ t: 'ws', m: 'open ' + ws.url() }); ws.on('framesent', f => ev({ t: 'ws', m: '> ' + String(f.payload).slice(0, 160) })); ws.on('framereceived', f => ev({ t: 'ws', m: '< ' + String(f.payload).slice(0, 300) })); ws.on('close', () => ev({ t: 'ws', m: 'close' })); ws.on('socketerror', e => ev({ t: 'ws', m: 'error ' + e })); });
  page.on('response', async r => {
    const u = r.url();
    if (u.startsWith(API) && r.request().method() === 'POST' && !u.includes('/api/')) {
      let op = '?', vars; try { const b = r.request().postDataJSON(); op = b.operationName || (b.query || '').slice(0, 40); if (/(^|\n|\})\s*mutation\b/.test(b.query || '')) vars = JSON.stringify(b.variables || {}).replace(/"password":"[^"]*"/g, '"password":"***"').slice(0, 1500); } catch {}
      let err; try { const j = await r.json(); if (j.errors) err = j.errors.map(e => (e.extensions?.code || '') + ':' + e.message).join(';'); } catch {}
      ev({ t: 'gql', op, s: r.status(), at: Date.now(), ...(vars ? { vars } : {}), ...(err ? { err } : {}) });
    } else if (r.status() >= 400 && !u.includes('hot-update')) ev({ t: 'http', m: r.status() + ' ' + u });
  });
}
module.exports = { start, SB, BASE, API, SHOTS, EMAILS, PNG, wire };
