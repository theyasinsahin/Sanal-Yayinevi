const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

// Exercise the real production bundle at the deployed website origin. Network
// requests are fulfilled locally; no Google account, live API or database is used.
const build = path.resolve(__dirname, '../build');
const origin = 'https://sanal-yayinevi-pi.vercel.app';
const expected = `${origin}/auth/google/callback`;
const sdk = `window.google={accounts:{id:{initialize(options){window.__googleCallbackUnderTest=options.login_uri},renderButton(container){const frame=document.createElement('iframe');frame.src='https://accounts.google.com/gsi/button';container.append(frame)},cancel(){},disableAutoSelect(){}}}};`;

(async () => {
  assert.ok(fs.existsSync(path.join(build, 'index.html')), 'Run npm run build first.');
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'accounts.google.com' && url.pathname === '/gsi/client') {
        return route.fulfill({ contentType: 'application/javascript', body: sdk });
      }
      if (url.hostname === 'accounts.google.com' && url.pathname === '/gsi/button') {
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><button>Google</button>' });
      }
      if (url.origin === origin) {
        const file = ['/login', '/register'].includes(url.pathname) ? path.join(build, 'index.html') : path.resolve(build, `.${decodeURIComponent(url.pathname)}`);
        if (!file.startsWith(`${build}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.abort();
        const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
        return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
      }
      if (url.hostname === 'sanal-yayinevi.onrender.com') {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { getCommunityConfig: { email: '', phone: '', socials: {} } } }) });
      }
      return route.abort();
    });
    for (const pathname of ['/login', '/register']) {
      const page = await context.newPage();
      const googleRequest = page.waitForRequest(request => {
        const url = new URL(request.url());
        return url.hostname === 'accounts.google.com' && url.pathname === '/gsi/button';
      });
      await page.goto(`${origin}${pathname}`);
      await page.waitForFunction(() => Boolean(window.__googleCallbackUnderTest));
      const actual = await page.evaluate(() => window.__googleCallbackUnderTest);
      assert.equal(actual, expected, `${pathname} must send Google POSTs to the website proxy.`);
      const headers = await (await googleRequest).allHeaders();
      assert.equal(headers.referer, `${origin}/`, `${pathname} must provide only the origin for Google verification.`);
      process.stdout.write(`${pathname}: ${actual}\n`);
      await page.close();
    }
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
