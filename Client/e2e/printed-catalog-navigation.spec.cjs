const { test, expect } = require('@playwright/test');

async function mockCatalog(page) {
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname !== '127.0.0.1' || url.port !== '5001') return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const { operationName, variables = {} } = request.postDataJSON();
    let data = {};
    if (operationName === 'GetPrintedBooks') {
      const current = variables.page || 1;
      if (current === 2) await new Promise(resolve => setTimeout(resolve, 350));
      data = { getPrintedBooks: { total: 13, page: current, totalPages: 2,
        books: Array.from({ length: current === 1 ? 12 : 1 }, (_, index) => ({
          __typename: 'Book', id: `printed-${current}-${index}`, publicPath: `/kitap/printed-${current}-${index}`,
          title: `Sayfa ${current} Kitap ${index + 1}`, printedAuthor: 'Deneme Yazarı', publisher: 'Yayınevi',
          publicationYear: 2026, isbn: '', imageUrl: '', pageCount: 200, description: 'Kitap tanıtımı.',
          format: null, genres: [], classificationTags: [], narrativeFeatures: [], targetAudience: null,
          contentWarnings: [], classificationStatus: 'COMPLETE',
        })),
      } };
    } else if (operationName === 'GetClassificationOptions') {
      data = { getClassificationOptions: { formats: [], genres: [], narrativeFeatures: [], targetAudiences: [], contentWarnings: [] } };
    } else if (operationName === 'SearchClassificationTags') {
      data = { searchClassificationTags: [] };
    } else if (operationName === 'GetCommunityConfig') {
      data = { getCommunityConfig: { email: '', phone: '', socials: {} } };
    }
    return route.fulfill({ headers, json: { data } });
  });
}

test('side arrows preserve scroll and layout on the shorter final page', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await mockCatalog(page);
  await page.goto('/printed-books?page=1&search=roman&keep=value');
  const firstBook = page.getByRole('link', { name: 'Sayfa 1 Kitap 1 — Deneme Yazarı', exact: true });
  await expect(firstBook).toBeVisible();
  const previous = page.getByRole('button', { name: 'Önceki kitaplar' });
  const next = page.getByRole('button', { name: 'Sonraki kitaplar' });
  await expect(previous).toBeDisabled();
  await page.evaluate(() => document.fonts.ready);
  const grid = page.locator('#printed-book-list');
  await grid.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const height = await grid.evaluate(element => element.getBoundingClientRect().height);
  await grid.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 120, behavior: 'instant' }));
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.catalogScrollCalls = [];
    const original = window.scrollTo.bind(window);
    window.scrollTo = (...args) => { window.catalogScrollCalls.push(args); original(...args); };
  });
  await page.screenshot({ path: testInfo.outputPath('catalog-first-page.png'), animations: 'disabled' });
  await next.click();
  await expect(firstBook).toBeAttached();
  await expect(next).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Sayfa 2 Kitap 1 — Deneme Yazarı' })).toBeAttached();
  await expect(previous).toBeEnabled();
  await expect(next).toBeDisabled();
  await expect(page).toHaveURL(/page=2&search=roman&keep=value/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
  expect(await grid.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(height, 0);
  expect(await page.evaluate(() => window.catalogScrollCalls)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const left = await previous.boundingBox(), right = await next.boundingBox(), middle = await grid.boundingBox();
  expect(left.x + left.width).toBeLessThanOrEqual(middle.x);
  expect(right.x).toBeGreaterThanOrEqual(middle.x + middle.width);
  await page.screenshot({ path: testInfo.outputPath('catalog-last-page.png'), animations: 'disabled' });
  await previous.focus();
  await page.keyboard.press('Enter');
  await expect(firstBook).toBeAttached();
  await expect(next).toBeEnabled();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  expect(await page.evaluate(() => window.catalogScrollCalls)).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await grid.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});
