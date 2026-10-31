const { test, expect } = require('@playwright/test');

const bookId = '000000000000000000000001';
const user = { id: 'browser-reader', username: 'browser-reader', fullName: 'Browser Reader', email: 'reader@example.test', role: 'USER' };

async function mockApplication(page, authenticated = true) {
  // Only synthetic credentials are used, and every API request is intercepted.
  if (authenticated) await page.addInitScript(user => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('token', `fixture.${payload}.fixture`);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
  }, user);
  const failures = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname === '127.0.0.1' && url.port === '5001') {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const operation = request.postDataJSON()?.operationName;
      const responses = {
        Me: { me: { __typename: 'User', id: user.id, email: user.email } },
        GetUnreadNotificationCount: { getUnreadNotificationCount: 0 },
        GetUnreadMessageCount: { getUnreadMessageCount: 0 },
        GetCommunityConfig: { getCommunityConfig: { email: '', phone: '', socials: { instagram: '', x: '', linkedin: '', tiktok: '' } } },
        PrintOverview: { printPaymentMode: 'SANDBOX', printOverview: { bookId, digitalStatus: 'PUBLISHED', writingStatus: 'COMPLETED', interestCount: 0, interested: false, campaign: null } },
        MyFundingHistory: { printPaymentMode: 'SANDBOX', myFundingPayments: [] },
      };
      if (!responses[operation]) failures.push(operation || request.url());
      return route.fulfill({ headers, json: { data: responses[operation] || {} } });
    }
    return route.abort();
  });
  return failures;
}

async function expectBelowNavbar(page, heading) {
  await expect(heading).toBeVisible();
  const navbar = page.locator('.navigation-bar');
  await expect(navbar).toBeVisible();
  const navigationBox = await navbar.boundingBox(), headingBox = await heading.boundingBox();
  expect(headingBox.y).toBeGreaterThanOrEqual(navigationBox.y + navigationBox.height + 16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('support title and back navigation remain below the fixed navbar', async ({ page }) => {
  const unexpected = await mockApplication(page);
  await page.goto(`/donate/${bookId}`);
  await expectBelowNavbar(page, page.getByRole('heading', { name: 'Destek ve kitap ön siparişi' }));
  const back = page.getByRole('link', { name: '← Kitaba dön', exact: true });
  await expect(back).toHaveAttribute('href', `/book-detail/${bookId}`);
  await expect(back).toHaveClass(/print-link/);
  expect(unexpected).toEqual([]);
});

test('support history uses a styled link and remains visible after navigation and browser back', async ({ page }) => {
  const unexpected = await mockApplication(page);
  await page.goto(`/donate/${bookId}`);
  const history = page.getByRole('link', { name: 'Desteklerim ve ön siparişlerim →', exact: true });
  await expect(history).toHaveClass(/print-link/);
  await history.click();
  await expect(page).toHaveURL(/\/funding-history$/);
  await expectBelowNavbar(page, page.getByRole('heading', { name: 'Desteklerim ve ön siparişlerim', exact: true }));
  await page.goBack();
  await expectBelowNavbar(page, page.getByRole('heading', { name: 'Destek ve kitap ön siparişi' }));
  expect(unexpected).toEqual([]);
});

test('protected support routes redirect a guest to login without showing checkout content', async ({ page }) => {
  await mockApplication(page, false);
  await page.goto(`/donate/${bookId}`);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Destek ve kitap ön siparişi' })).toHaveCount(0);
});
