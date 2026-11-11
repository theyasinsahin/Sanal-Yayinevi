const { test, expect } = require('@playwright/test');

const user = { __typename: 'User', id: 'writer', username: 'yazar', fullName: 'Test Yazar', email: 'writer@example.test', role: 'USER', profilePicture: '' };
const recipient = { __typename: 'MentionUser', id: 'reader', username: 'okur.test', fullName: 'Test Okur', profilePicture: '' };
const targetId = '0123456789abcdef01234567';
const entry = { __typename: 'SessionEntry', id: targetId, sessionId: 'room', content: 'Bu ileti içinde @yazar etiketlendi.', likedBy: [], likeCount: 0, createdAt: '2026-11-01T12:00:00.000Z', user };
const session = { __typename: 'Session', id: 'room', publicPath: '/oturum/kitap-sohbeti', title: 'Kitap sohbeti', description: 'Birlikte okuyalım.', coverImageUrl: '', type: 'OPEN', isActive: true, tags: [], participantCount: 1, createdAt: entry.createdAt, updatedAt: entry.createdAt, createdBy: user };

async function mockSession(page) {
  await page.addInitScript(user => {
    localStorage.setItem('token', `fixture.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`);
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('userId', user.id);
  }, user);
  const sent = [], unexpected = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname !== '127.0.0.1' || url.port !== '5001') return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const payload = request.postDataJSON(), operation = payload.operationName;
    const responses = {
      ResolvePublicRoute: { resolvePublicRoute: { __typename: 'PublicRoute', id: 'room', path: session.publicPath, chapterId: null } },
      Me: { me: user }, GetSession: { getSession: session }, GetSessionEntries: { getSessionEntries: [] },
      SearchMentionUsers: { searchMentionUsers: [recipient] }, GetSessionEntry: { getSessionEntry: entry },
      GetUnreadNotificationCount: { getUnreadNotificationCount: 1 }, GetUnreadMessageCount: { getUnreadMessageCount: 0 },
      GetCommunityConfig: { getCommunityConfig: { email: '', phone: '', socials: {} } },
      GetIncomingFollowRequests: { getIncomingFollowRequests: { total: 0, items: [] } },
      MarkNotificationsRead: { markNotificationsRead: true },
      GetNotifications: { getNotifications: [{ __typename: 'Notification', id: 'notice', type: 'SESSION_MENTION',
        meta: { sessionId: 'room', entryId: targetId }, title: 'Etiketlendin', message: 'Kitap sohbetinde etiketlendin.', icon: '@', isRead: false, createdAt: String(Date.now()) }] },
    };
    if (operation === 'AddSessionEntry') {
      sent.push(payload.variables);
      return route.fulfill({ headers, json: { data: { addSessionEntry: { ...entry, id: 'submitted', content: payload.variables.content } } } });
    }
    if (!responses[operation]) unexpected.push(operation);
    return route.fulfill({ headers, json: { data: responses[operation] || {} } });
  });
  return { sent, unexpected };
}

test('mention suggestions work with touch and keyboard, and notifications focus an entry outside the first page', async ({ page }, testInfo) => {
  const app = await mockSession(page);
  await page.goto('/sessions/room');
  await expect(page.getByRole('heading', { name: session.title, exact: true })).toBeVisible();
  const input = page.getByPlaceholder('Düşüncelerini yaz...');
  await input.fill('Merhaba @ok');
  const option = page.getByRole('option', { name: /@okur.test/ });
  await expect(option).toBeVisible();
  const bounds = await option.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({ path: testInfo.outputPath('mention-picker.png'), fullPage: true });
  if (testInfo.project.name === 'mobile') await option.tap();
  else await input.press('Enter');
  await expect(input).toHaveValue('Merhaba @okur.test ');
  expect(app.sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Paylaş', exact: true }).click();
  await expect(page.locator('#entry-submitted')).toContainText('Merhaba @okur.test');
  expect(app.sent[0]).toEqual({ sessionId: 'room', content: 'Merhaba @okur.test' });
  await expect(page.locator('#entry-submitted').getByRole('link', { name: '@okur.test' })).toHaveAttribute('href', '/yazar/okur.test');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Menüyü Aç/Kapat' }).click();
  const menu = page.locator(testInfo.project.name === 'mobile' ? '.mobile-menu-drawer' : '.desktop-menu');
  await menu.getByRole('button', { name: 'Bildirimler', exact: true }).click();
  await page.getByRole('link', { name: /Etiketlendin Kitap sohbetinde/ }).click();
  const target = page.locator(`#entry-${targetId}`);
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  if (testInfo.project.name === 'mobile') await expect(page.locator('.mobile-menu-drawer')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(app.unexpected).toEqual([]);
});
