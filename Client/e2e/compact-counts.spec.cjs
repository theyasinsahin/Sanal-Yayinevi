const { test, expect } = require('@playwright/test');

const author = { __typename: 'User', id: 'author', username: 'sayac-yazari', fullName: 'Sayaç Yazarı', profilePicture: '' };
const values = [999, 1000, 21530, 999949, 999950, 2147483647];
const books = values.map((value, index) => ({
  __typename: 'Book', id: `book-${index}`, publicPath: `/kitap/sayac-${index}`, title: `Sayaç Kitabı ${index}`,
  description: 'Sayaçların dar alanlardaki görünümü.', imageUrl: '', pageCount: 30, publishDate: null,
  status: 'WRITING', kind: 'DIGITAL', printedAuthor: null, publisher: null, publicationYear: null, isbn: null,
  author, authorId: author.id, format: null, genres: [], classificationTags: [], narrativeFeatures: [],
  targetAudience: null, contentWarnings: [], classificationStatus: 'COMPLETE',
  stats: { __typename: 'BookStats', views: value, likes: value, shares: 0 }, commentCount: value,
  fundingSummary: null, currentFunding: 0, fundingTarget: 0, backerCount: 0, likedBy: [], tags: [], chapters: [],
  purchaseUrl: null, publicationEvidenceUrl: null, reviewNote: null, canEditContent: false, submittedBy: null, myClaim: null,
}));

async function mockCounts(page) {
  const unexpected = [];
  const follower = { ...author, id: 'follower', username: 'okur' };
  const profile = { ...author, email: '', role: 'USER', bio: '', usersBooks: books,
    followers: Array(21530).fill(follower), following: Array(1000).fill(follower),
    followStatus: 'NONE', canViewProfile: true, canViewLibrary: true, canViewFollowList: true, canMessage: false,
    isSearchIndexable: true, weeklyWritingWords: 0, privacySettings: null, notificationSettings: null, authorSettings: null };
  const quote = { __typename: 'Quote', id: 'quote', text: 'Sayaçlar büyüdüğünde de okunabilir olmalı.', note: '', visibility: 'PUBLIC',
    chapterTitle: '', chapterIndex: 0, pageNumber: null, likedBy: Array(21530).fill('reader'), isRepost: false,
    repostComment: '', repostedBy: [], createdAt: '2026-11-01T12:00:00.000Z', isSpoiler: false, user: author, book: books[2],
    originalQuote: null, commentCount: 999949 };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname !== '127.0.0.1' || url.port !== '5001') return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const { operationName, variables = {} } = request.postDataJSON();
    const responses = {
      ResolvePublicRoute: { resolvePublicRoute: { id: variables.type === 'PROFILE' ? author.id : 'book-2',
        path: variables.type === 'PROFILE' ? '/yazar/sayac-yazari' : '/kitap/sayac-2', chapterId: null } },
      GetUserById: { getUserById: profile }, GetQuotesByUser: { getQuotesByUser: [quote] },
      GetUserScore: { getUserScore: { id: 'score', totalPoints: 2147483647, dailyPoints: 0, weeklyPoints: 0, monthlyPoints: 0, stats: null } },
      GetUserBadges: { getUserBadges: [] }, GetBookDetail: { getBookById: books[2] },
      GetCommentsByBookId: { getCommentsByBookId: [] }, GetQuotesByBook: { getQuotesByBook: [] },
      GetBookBackers: { getBookBackers: [] },
      PrintOverview: { printPaymentMode: 'DISABLED', printOverview: null },
      GetCommunityConfig: { getCommunityConfig: { email: '', phone: '', socials: {} } },
    };
    if (!responses[operationName]) unexpected.push(operationName);
    return route.fulfill({ headers, json: { data: responses[operationName] || {} } });
  });
  return unexpected;
}

// Check local clipping and overlap as well as page overflow: cards hide overflow.
async function expectMetricsToFit(page, selector) {
  const violations = await page.locator(selector).evaluateAll(rows => rows.flatMap(row => {
    const bounds = row.getBoundingClientRect();
    const items = [...row.children].filter(child => getComputedStyle(child).display !== 'none');
    const rectangles = items.map(item => item.getBoundingClientRect());
    const overflow = rectangles.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
    const overlap = rectangles.some((rect, index) => rectangles.slice(index + 1).some(other =>
      rect.left < other.right - 1 && rect.right > other.left + 1 && rect.top < other.bottom - 1 && rect.bottom > other.top + 1));
    return overflow || overlap ? [{ selector: row.className, overflow, overlap }] : [];
  }));
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [320, 393, 768, 1440]) {
  test(`large profile, card, quote and book counters fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const unexpected = await mockCounts(page);
    await page.goto('/yazar/sayac-yazari');
    await expect(page.locator('.profile-stats-row [title="21.530"]')).toBeVisible();
    await expect(page.locator('.profile-stats-row [title="2.147.483.647"]')).toContainText('2,1');
    await expectMetricsToFit(page, '.profile-stats-row, .mini-stats-row');

    // Test the actual BookCard at each supported container size, independent of viewport.
    await expect(page.locator('.book-card')).toHaveCount(values.length);
    for (const cardWidth of [160, 230, 280]) {
      await page.locator('.carousel-item').evaluateAll((items, size) => items.forEach(item => {
        item.style.flex = `0 0 ${size}px`; item.style.width = `${size}px`;
      }), cardWidth);
      await expectMetricsToFit(page, '.card-stats');
    }
    await page.screenshot({ path: testInfo.outputPath(`profile-${width}.png`), fullPage: true });

    await page.getByRole('button', { name: /Alıntılar/ }).click();
    await expect(page.locator('.quote-card').getByRole('button', { name: '21.530 beğeni' })).toBeVisible();
    await expectMetricsToFit(page, '.quote-card-actions');

    await page.goto('/kitap/sayac-2');
    await expect(page.locator('.meta-info-card [title="21.530 beğeni"]')).toBeVisible();
    await expectMetricsToFit(page, '.meta-row');
    expect(unexpected).toEqual([]);
  });
}
