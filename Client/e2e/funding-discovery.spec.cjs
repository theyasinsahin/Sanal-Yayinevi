const { test, expect } = require('@playwright/test');

const funding = (id, acceptedMinor, targetMinor, goalReached = false) => ({
  __typename: 'BookFundingSummary', id, state: goalReached ? 'SUCCEEDED' : 'ACTIVE', environment: 'SANDBOX',
  acceptedMinor, targetMinor, remainingMinor: targetMinor - acceptedMinor, progressPercent: acceptedMinor * 100 / targetMinor,
  isOpen: !goalReached, goalReached, endsAt: '2099-01-01T00:00:00.000Z',
});
const book = (id, title, summary) => ({
  __typename: 'Book', id, publicPath: `/kitap/${id}`, title, description: 'Okurların desteğiyle basıma hazırlanan bir eser.', imageUrl: '', pageCount: 30,
  publishDate: '2026-11-01T12:00:00.000Z', status: 'COMPLETED', kind: 'DIGITAL', printedAuthor: '', publisher: '', publicationYear: null, isbn: null,
  author: { __typename: 'User', id: `author-${id}`, username: 'ipek', fullName: 'İpek Yazar', profilePicture: '' },
  format: null, genres: [], classificationTags: [], narrativeFeatures: [], targetAudience: null, contentWarnings: [], classificationStatus: 'NEEDS_REVIEW',
  stats: { __typename: 'BookStats', likes: 2, views: 20 }, commentCount: 0, currentFunding: 999999, fundingTarget: 999999, backerCount: 0, fundingSummary: summary,
});
const near = book('near', 'Hedefe Yakın Roman', funding('near-campaign', 9000, 10000));
const far = book('far', 'Yeni Destek Romanı', funding('far-campaign', 10000, 20000));
const completed = book('completed', 'Tamamlanan Roman', funding('completed-campaign', 100000, 100000, true));

async function mockCatalog(page) {
  const calls = [], unexpected = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname === '127.0.0.1' && url.port === '5001') {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const operation = request.postDataJSON()?.operationName;
      if (operation === 'GetBookFeed') {
        const variables = request.postDataJSON().variables; calls.push(variables);
        const books = variables.funding === 'FUNDED' ? [completed] : variables.funding === 'ACTIVE' ? [near, far] : [far, completed, near];
        return route.fulfill({ headers, json: { data: { getBookFeed: { __typename: 'BookFeedPage', books: variables.search ? [] : books, hasNextPage: false, endCursor: null } } } });
      }
      const responses = {
        GetClassificationOptions: { getClassificationOptions: { formats: [], genres: [], narrativeFeatures: [], targetAudiences: [], contentWarnings: [] } },
        GetAllGenres: { getAllGenres: [] },
        GetCommunityConfig: { getCommunityConfig: { email: '', phone: '', socials: {} } },
      };
      if (!responses[operation]) unexpected.push(operation);
      return route.fulfill({ headers, json: { data: responses[operation] || {} } });
    }
    return route.abort();
  });
  return { calls, unexpected };
}

test('discovery cards show support amounts and the closest/funded lists remain separate', async ({ page }, testInfo) => {
  const app = await mockCatalog(page);
  await page.goto('/feed');
  await expect(page.getByText('Hedefe Yakın Roman', { exact: true })).toBeVisible();
  const nearCard = page.locator('.book-card').filter({ hasText: 'Hedefe Yakın Roman' });
  await expect(nearCard.getByRole('progressbar', { name: 'Desteğe açık' })).toHaveAttribute('value', '90');
  await expect(nearCard.getByText('90,00 TL', { exact: true })).toBeVisible();
  await expect(nearCard.getByText(/100,00 TL hedef/)).toBeVisible();
  await expect(nearCard.getByText('Tamamlanma: %90')).toBeVisible();
  await page.getByRole('radio', { name: 'Hedefe en yakın', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Hedefe en yakın kitaplar' })).toBeVisible();
  await expect.poll(() => app.calls.at(-1).sort).toBe('CLOSEST_TO_TARGET');
  expect(app.calls.at(-1).funding).toBe('ACTIVE');
  await expect(page.locator('.book-card .book-title')).toHaveText(['Hedefe Yakın Roman', 'Yeni Destek Romanı']);
  await expect(page.getByText('Tamamlanan Roman', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('closest-support.png'), fullPage: true });
  await page.getByRole('radio', { name: 'Hedefini tamamlayan kitaplar', exact: true }).check();
  await expect(page.getByRole('heading', { name: 'Hedefini tamamlayan kitaplar' })).toBeVisible();
  await expect(page.locator('.book-card .book-title')).toHaveText(['Tamamlanan Roman']);
  await expect(page.getByRole('progressbar', { name: 'Hedef tamamlandı' })).toHaveAttribute('value', '100');
  expect(app.calls.at(-1).sort).toBe('NEWEST');
  expect(app.calls.at(-1).funding).toBe('FUNDED');
  expect(app.unexpected).toEqual([]);
});

test('funded discovery supports search and a useful empty result', async ({ page }) => {
  const app = await mockCatalog(page);
  await page.goto('/feed');
  await page.getByText('Hedefe Yakın Roman', { exact: true }).waitFor();
  await page.getByRole('radio', { name: 'Hedefini tamamlayan kitaplar', exact: true }).check();
  await page.getByText('Tamamlanan Roman', { exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Kitap, yazar veya alıntı ara', exact: true }).fill('Bulunmayan');
  await expect(page.getByText('Aramanızla eşleşen kitap bulunamadı.')).toBeVisible();
  expect(app.calls.at(-1)).toMatchObject({ funding: 'FUNDED', search: 'Bulunmayan' });
  expect(app.unexpected).toEqual([]);
});
