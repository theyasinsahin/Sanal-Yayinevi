const { test, expect } = require('@playwright/test');
const { buildSchema, graphqlSync } = require('graphql');

// Execute the real selection set: returning extra JSON fields here would mask
// missing role selections in the session query, unlike a GraphQL server.
const sessionSchema = buildSchema('type User { id: ID!, email: String!, role: String! } type Query { me: User }');

const user = { id: 'test-publisher', username: 'publisher', fullName: 'Test Yayınevi', role: 'PUBLISHER' };
const book = { id: '000000000000000000000001', urlSlug: 'yeni-roman', title: 'Yeni Roman', imageUrl: '', authorName: 'İpek Yazar', writingStatus: 'COMPLETED', publishDate: '2026-11-01T12:00:00.000Z', campaign: {
  id: 'test-campaign', state: 'ACTIVE', environment: 'SANDBOX', targetMinor: 100000, acceptedMinor: 12345, supporterCount: 3, endsAt: '2099-12-01T12:00:00.000Z', updatedAt: '2026-11-01T12:00:00.000Z',
} };

async function mockApplication(page, role = 'PUBLISHER') {
  await page.addInitScript(user => {
    localStorage.setItem('token', `fixture.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`);
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('userId', user.id);
  }, { ...user, role });
  let support = 12345;
  const calls = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname === '127.0.0.1' && url.port === '5001') {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const operation = request.postDataJSON()?.operationName;
      if (operation === 'Me') return route.fulfill({ headers, json: graphqlSync({
        schema: sessionSchema, source: request.postDataJSON().query,
        rootValue: { me: { id: user.id, email: 'publisher@example.test', role } },
      }) });
      if (operation === 'PublisherCatalog') {
        const variables = request.postDataJSON().variables; calls.push(variables);
        return route.fulfill({ headers, json: { data: { publisherCatalog: {
          total: 1, page: variables.page, totalPages: 1, refreshedAt: new Date().toISOString(), items: [{ ...book, campaign: { ...book.campaign, acceptedMinor: support } }],
        } } } });
      }
      const responses = {
        GetUnreadNotificationCount: { getUnreadNotificationCount: 0 }, GetUnreadMessageCount: { getUnreadMessageCount: 0 },
        GetCommunityConfig: { getCommunityConfig: { email: '', phone: '', socials: {} } },
      };
      return route.fulfill({ headers, json: { data: responses[operation] || {} } });
    }
    return route.abort();
  });
  return { calls, setSupport: value => { support = value; } };
}

test('publisher portal stays usable on desktop and mobile, with search, filters and fresh totals', async ({ page }, testInfo) => {
  const app = await mockApplication(page);
  await page.goto('/publisher');
  const heading = page.getByRole('heading', { name: 'Yayınevi Portalı', exact: true });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('link', { name: 'Yeni Roman' })).toBeVisible();
  const navigationBox = await page.locator('.navigation-bar').boundingBox(), headingBox = await heading.boundingBox();
  expect(headingBox.y).toBeGreaterThanOrEqual(navigationBox.y + navigationBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel('Kitap veya yazar ara').fill('İpek');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  await expect.poll(() => app.calls.at(-1).search).toBe('İpek');
  await page.getByLabel('Destek durumu').selectOption('ACTIVE');
  await expect.poll(() => app.calls.at(-1).funding).toBe('ACTIVE');
  app.setSupport(50000);
  await expect(page.getByRole('button', { name: 'Yenile' })).toBeEnabled();
  await page.getByRole('button', { name: 'Yenile' }).click();
  await expect(page.getByText(/500,00/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('publisher-portal.png'), fullPage: true });
});

test('members cannot open publisher content', async ({ page }) => {
  const app = await mockApplication(page, 'USER');
  await page.goto('/publisher');
  await expect(page).toHaveURL('http://127.0.0.1:3100/');
  await expect(page.getByRole('heading', { name: 'Yayınevi Portalı', exact: true })).toHaveCount(0);
  expect(app.calls).toHaveLength(0);
});

test('admin keeps portal navigation and route access after session revalidation', async ({ page }, testInfo) => {
  await mockApplication(page, 'ADMIN');
  await page.goto('/publisher');
  await expect(page.getByRole('link', { name: 'Yeni Roman' })).toBeVisible();
  const validation = page.waitForResponse(response => {
    const request = response.request();
    return request.method() === 'POST' && request.postDataJSON()?.operationName === 'Me';
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await validation;
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('user')).role)).toBe('ADMIN');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Menüyü Aç/Kapat' }).click();
  const menu = page.locator(testInfo.project.name === 'mobile' ? '.mobile-menu-drawer' : '.desktop-menu');
  await expect(menu.getByRole('link', { name: 'Yayınevi Portalı', exact: true })).toBeVisible();
  await page.goto('/publisher');
  await expect(page.getByRole('link', { name: 'Yeni Roman' })).toBeVisible();
  await expect(page).toHaveURL(/\/publisher$/);
});
