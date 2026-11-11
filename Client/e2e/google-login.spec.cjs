const { test, expect } = require('@playwright/test');

const user = { id: '000000000000000000000001', username: 'google-reader', fullName: 'Google Test Okuru', email: 'reader@example.test', role: 'USER' };
const profile = {
  __typename: 'User', ...user, followStatus: 'NONE', canViewProfile: true, canViewLibrary: true, canViewFollowList: true,
  canMessage: false, isSearchIndexable: true, weeklyWritingWords: 0, privacySettings: null, notificationSettings: null,
  authorSettings: null, usersBooks: [], savedBooks: [], bio: '', profilePicture: '', followers: [], following: [],
};
const token = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, userId: user.id })).toString('base64url')}.fixture`;

async function mockApplication(page, viewer = user) {
  const calls = [], unexpected = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname !== '127.0.0.1' || url.port !== '5001') return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const { operationName, query } = request.postDataJSON();
    const operation = operationName || query.match(/(?:query|mutation)\s+(\w+)/)?.[1];
    calls.push(operation);
    const responses = {
      Me: { me: { __typename: 'User', ...viewer } }, GetUserById: { getUserById: { ...profile, ...viewer } },
      GetProfileSavedBooks: { getUserById: { __typename: 'User', id: user.id, savedBooks: [] } },
      GetQuotesByUser: { getQuotesByUser: [] }, GetFollowedBooks: { getFollowedBooks: [] },
      GetUserScore: { getUserScore: null }, GetUserBadges: { getUserBadges: [] },
      GetUnreadNotificationCount: { getUnreadNotificationCount: 0 }, GetUnreadMessageCount: { getUnreadMessageCount: 0 },
      GetCommunityConfig: { getCommunityConfig: { email: '', phone: '', socials: {} } },
      Logout: { logout: { code: 200, message: 'Logged out' } },
    };
    if (!responses[operation]) unexpected.push(operation);
    return route.fulfill({ headers, json: { data: responses[operation] || {} } });
  });
  return { calls, unexpected };
}

test('personal profile plane fits the left gutter and disappears when there is no room', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const viewer = { ...user, username: 'kolelkaa' };
  await mockApplication(page, viewer);
  await page.addInitScript(({ viewer, token }) => {
    localStorage.setItem('token', token); localStorage.setItem('userId', viewer.id); localStorage.setItem('user', JSON.stringify(viewer));
  }, { viewer, token });
  await page.goto('/profile');
  const plane = page.locator('.personal-fox-slot--profile-flight img');
  await expect(plane).toBeVisible();
  await expect.poll(() => plane.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  const image = await plane.boundingBox();
  const card = await page.locator('.profile-header-card').boundingBox();
  expect(image.x).toBeGreaterThanOrEqual(0);
  expect(image.x + image.width).toBeLessThan(card.x);
  expect(image.width).toBeGreaterThan(180);
  const peek = page.locator('.personal-fox-slot--profile-peek');
  await expect(peek).toBeVisible();
  await expect(page.locator('.profile-header-card h2 .personal-fox-image')).toHaveCount(0);
  const peekingBox = await peek.boundingBox();
  expect(peekingBox.x + peekingBox.width).toBeGreaterThan(card.x + card.width);
  await page.screenshot({ path: testInfo.outputPath('profile-gutter-plane.png'), fullPage: true });
  await page.setViewportSize({ width: 393, height: 852 });
  await expect(plane).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Google callback keeps the session through profile loading, focus and a full reload', async ({ page }) => {
  const app = await mockApplication(page);
  await page.goto('/login');
  // The lazy login route can mount after navigation finishes on a cold CI runner.
  await expect(page.getByRole('heading', { name: "Betik'e Giriş", exact: true })).toBeVisible();
  const nonce = await page.evaluate(() => JSON.parse(sessionStorage.getItem('betik:google-login-nonce')).nonce);
  expect(nonce).toMatch(/^[a-f0-9]{64}$/);
  const callback = new URLSearchParams({ token, user: JSON.stringify(user), nonce });
  await page.goto(`/auth/callback#${callback}`);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: user.fullName, exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => app.calls.filter(name => name === 'Me').length).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(token);
  await page.reload();
  await expect(page.getByRole('heading', { name: user.fullName, exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole('button', { name: 'Dijital Kitaplık' }).click();
  await expect.poll(() => app.calls.includes('GetProfileSavedBooks')).toBe(true);
  expect(app.calls).not.toContain('Logout');
  expect(app.unexpected).toEqual([]);
});
