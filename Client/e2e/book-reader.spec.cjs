const { test, expect } = require('@playwright/test');

const user = { id: 'reader', username: 'okur', fullName: 'Test Okur', email: 'reader@example.test', role: 'USER' };
const chapters = ['Birinci', 'İkinci', 'Üçüncü'].map((name, index) => ({
  __typename: 'Chapter', id: `chapter-${index}`, title: `${name} bölüm`,
  content: `<p>${name} bölümde anlatılan bu hikâye, okurların beğendiği satırları seçerek saklayabilmesini anlatır. Bir kelimeye basılı tutup seçimi genişleterek alıntı kaydedebilirsiniz.</p>`,
  pageCount: 1, wordCount: 30, isHidden: false, canReadContent: true, accessStatus: 'READABLE',
}));
const book = {
  __typename: 'Book', id: 'book', publicPath: '/kitap/test-kitabi', title: 'Bir Okuma Yolculuğu',
  kind: 'DIGITAL', status: 'WRITING', publicationStatus: null, authorId: 'author',
  author: { __typename: 'User', id: 'author', username: 'yazar', fullName: 'Test Yazar' },
  format: null, genres: [], classificationTags: [], narrativeFeatures: [], targetAudience: null, contentWarnings: [], classificationStatus: 'COMPLETE', chapters,
};

async function mockReader(page, { draft = false, username = user.username, paragraphMention = false, guest = false } = {}) {
  const sessionUser = { ...user, ...(draft ? { id: 'author' } : {}), username };
  if (!guest) await page.addInitScript(user => {
    localStorage.setItem('token', `fixture.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`);
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('userId', user.id);
  }, sessionUser);
  const quotes = [], unexpected = [];
  let currentBook = { ...book, author: { ...book.author, profilePicture: '' },
    description: 'Bir okuma yolculuğunun hikâyesi.', imageUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="%23d9ddcd"/></svg>',
    pageCount: 3, publishDate: null, printedAuthor: null, publisher: null, publicationYear: null, isbn: null,
    purchaseUrl: null, publicationEvidenceUrl: null, reviewNote: null, canEditContent: true, submittedBy: null, myClaim: null,
    commentCount: 0, fundingSummary: null, currentFunding: 0, fundingTarget: 0, backerCount: 0,
    stats: { __typename: 'BookStats', views: 0, likes: 0, shares: 0 }, likedBy: [], tags: [], comments: [],
    digitalStatus: draft ? 'DRAFT' : 'PUBLISHED', writingStatus: 'WRITING', status: draft ? 'DRAFT' : 'WRITING',
    chapters: chapters.map(chapter => ({ ...chapter, createdAt: '2026-11-01T12:00:00.000Z' })),
  };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' && url.port === '3100') return route.continue();
    if (url.hostname !== '127.0.0.1' || url.port !== '5001') return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const payload = request.postDataJSON(), variables = payload.variables || {};
    const operation = payload.operationName || payload.query.match(/(?:mutation|query)\s+(\w+)/)?.[1];
    const authenticated = !guest || Boolean(request.headers().authorization);
    const accessibleChapters = currentBook.chapters.map((chapter, index) => ({ ...chapter,
      accessStatus: authenticated || !index ? 'READABLE' : 'REGISTRATION_REQUIRED',
      canReadContent: authenticated || !index,
      content: authenticated || !index ? chapter.content : '',
    }));
    const readerBook = { ...currentBook, chapters: accessibleChapters };
    const registrationToken = `fixture.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`;
    const resolvedChapter = variables.chapter || (paragraphMention ? 'chapter-1' : null);
    const responses = {
      Me: { me: authenticated ? { __typename: 'User', ...sessionUser } : null },
      ResolvePublicRoute: { resolvePublicRoute: { __typename: 'PublicRoute', id: 'book', path: resolvedChapter ? '/kitap/test-kitabi/bolum/ikinci-bolum' : '/kitap/test-kitabi', chapterId: resolvedChapter ? 'chapter-1' : null } },
      GetBookReaderData: { getBookById: readerBook },
      GetBookDetail: { getBookById: currentBook }, GetBookById: { getBookById: currentBook },
      GetBookViewer: { getUserById: { __typename: 'User', ...sessionUser, savedBooks: [] } },
      GetCommentsByBookId: { getCommentsByBookId: [] }, IsFollowingBook: { isFollowingBook: false },
      PrintOverview: { printPaymentMode: 'DISABLED', printOverview: null },
      GetCommunityConfig: { getCommunityConfig: { email: '', phone: '', socials: {} } },
      GetReadingChapter: { getReadingChapter: accessibleChapters.find(chapter => chapter.id === variables.chapterId) },
      SendRegistrationCode: { sendRegistrationCode: { __typename: 'Status', code: 200, message: 'Kod gönderildi.' } },
      RegisterAndLogin: { registerAndLogin: { __typename: 'RegistrationPayload', code: 200, message: 'Kayıt tamamlandı.', token: registrationToken, user: { __typename: 'User', ...sessionUser } } },
      IncrementBookViews: { incrementBookViews: { __typename: 'Book', id: 'book', publicPath: book.publicPath, stats: { __typename: 'BookStats', views: 1 } } },
      GetBookmark: { getBookmark: null }, GetReadingProgress: { getReadingProgress: null },
      SaveReadingProgress: { saveReadingProgress: { id: 'progress', lastChapterId: variables.chapterId, completedChapters: variables.completedChapterIds, isCompleted: false, lastReadAt: new Date().toISOString() } },
      GetParagraphCommentCounts: { getParagraphCommentCounts: [] }, CheckQuoteExists: { checkQuoteExists: { exists: false, quote: null } },
      GetParagraphComments: { getParagraphComments: paragraphMention ? [{ __typename: 'ParagraphComment', id: 'target-comment', content: 'Merhaba @okur', paragraphIndex: 0, likedBy: [], createdAt: String(Date.now()), user: { __typename: 'User', ...sessionUser, profilePicture: '' } }] : [] },
      GetUnreadNotificationCount: { getUnreadNotificationCount: 0 }, GetUnreadMessageCount: { getUnreadMessageCount: 0 },
      StartReadingSession: { startReadingSession: { sessionId: 'synthetic-session' } },
      ReportReadingTime: { reportReadingTime: { earnedPoints: 0, totalReadingMinutes: 0 } },
    };
    if (operation === 'UpdateBookStatus') {
      currentBook = { ...currentBook, status: variables.status,
        digitalStatus: variables.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        writingStatus: variables.status === 'COMPLETED' ? 'COMPLETED' : currentBook.writingStatus || 'WRITING', printConfig: null };
      return route.fulfill({ headers, json: { data: { updateBookStatus: currentBook } } });
    }
    if (operation === 'CreateQuote') {
      quotes.push(variables);
      return route.fulfill({ headers, json: { data: { createQuote: { __typename: 'Quote', id: 'quote', ...variables, createdAt: new Date().toISOString() } } } });
    }
    if (!responses[operation]) unexpected.push(operation);
    return route.fulfill({ headers, json: { data: responses[operation] || {} } });
  });
  return { quotes, unexpected };
}

test('guest chapter navigation can be dismissed without changing the current chapter', async ({ page }) => {
  const app = await mockReader(page, { guest: true });
  await page.goto('/book-reader/book');
  await expect(page.getByRole('heading', { name: 'Birinci bölüm', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tamamla ve Devam Et' }).click();
  const dialog = page.getByRole('dialog', { name: 'Hikâyeye devam et' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Ücretsiz hesap oluştur' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Şimdilik geri dön' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Birinci bölüm', exact: true })).toBeVisible();
  expect(app.unexpected).toEqual([]);
});

test('a direct locked chapter returns to that chapter after verified registration and automatic login', async ({ page }) => {
  const app = await mockReader(page, { guest: true });
  await page.goto('/book-reader/book?chapter=chapter-1');
  await expect(page.getByRole('heading', { name: 'Hikâyeye devam et' })).toBeVisible();
  await expect(page.locator('.paragraph-renderer')).toHaveCount(0);
  await page.getByRole('link', { name: 'Ücretsiz hesap oluştur' }).click();
  await expect(page).toHaveURL(/\/register\?returnTo=/);
  await page.getByLabel('Tam Adınız').fill('Test Okur');
  await page.getByLabel('Kullanıcı Adı').fill('okur');
  await page.getByLabel(/^E-Posta/).fill('reader@example.test');
  await page.getByLabel(/^Şifre/).fill('Correct!123');
  await page.getByRole('checkbox', { name: /Kullanım Koşulları/ }).check();
  await page.getByRole('button', { name: 'Doğrulama Kodu Gönder' }).click();
  await page.getByLabel(/^Doğrulama Kodu/).fill('123456');
  await page.getByRole('button', { name: 'Kayıt İşlemini Tamamla' }).click();
  await expect(page).toHaveURL(/\/kitap\/test-kitabi\/oku\?chapter=chapter-1/);
  await expect(page.getByRole('heading', { name: 'İkinci bölüm', exact: true })).toBeVisible();
  await expect(page.locator('.paragraph-renderer')).toContainText('İkinci bölümde anlatılan');
  await expect(page.getByRole('heading', { name: 'Hikâyeye devam et' })).toHaveCount(0);
  expect(app.unexpected).toEqual([]);
});

test('paragraph mention links open the correct chapter, expand its comments and focus the tagged comment', async ({ page }) => {
  const app = await mockReader(page, { paragraphMention: true });
  await page.goto('/book-reader/book?chapter=chapter-1&paragraph=0#paragraph-comment-target-comment');
  await expect(page.getByRole('heading', { name: 'İkinci bölüm', exact: true })).toBeVisible();
  const target = page.locator('#paragraph-comment-target-comment');
  await expect(target).toHaveText('Merhaba @okur');
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  expect(app.unexpected).toEqual([]);
});

async function selectContent(page, selector) {
  await page.locator(selector).first().evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    // Uses a real DOM selection and the event native touch selection emits; no mouse event.
    document.dispatchEvent(new Event('selectionchange'));
  });
}

test('reader fits the viewport, explains quotes and saves touch-selected text', async ({ page }, testInfo) => {
  const app = await mockReader(page);
  await page.goto('/kitap/test-kitabi/oku');
  await expect(page.getByRole('heading', { name: 'Birinci bölüm', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Alıntı ekleme ipucu' })).toContainText('basılı tutup');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const content = await page.locator('.paragraph-renderer').boundingBox();
  expect(content.width).toBeGreaterThan(testInfo.project.name === 'mobile' ? 300 : 400);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Bölümler (3)' }).click();
    const menu = page.getByRole('dialog', { name: 'Kitap bölümleri' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: /^Bölüm 2 İkinci bölüm/ }).click();
    await expect(menu).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'İkinci bölüm', exact: true })).toBeVisible();
  }
  await selectContent(page, '.paragraph-content p');
  const dialog = page.getByRole('dialog', { name: 'Alıntı kaydet' });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  const navbar = await page.locator('.navigation-bar').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(bounds.y).toBeGreaterThanOrEqual(navbar.y + navbar.height);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  await dialog.getByLabel('Alıntı görünürlüğü').selectOption('PRIVATE');
  await dialog.getByLabel('Alıntı notu').fill('Mobilde saklanan bir not.');
  await page.screenshot({ path: testInfo.outputPath('reader-quote.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Özel olarak kaydet' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Özel alıntı kaydedildi!');
  expect(app.quotes[0]).toMatchObject({ bookId: 'book', chapterId: testInfo.project.name === 'mobile' ? 'chapter-1' : 'chapter-0', visibility: 'PRIVATE', note: 'Mobilde saklanan bir not.' });
  expect(app.unexpected).toEqual([]);
});

test('draft publication is visible in the editor and author detail actions fit side by side', async ({ page }, testInfo) => {
  const app = await mockReader(page, { draft: true });
  await page.goto('/dashboard/book');
  await expect(page.locator('.dashboard-publish-bar').getByRole('button', { name: 'Yayınla (Görünür Yap)' })).toBeVisible();
  await page.goto('/kitap/test-kitabi');
  const publish = page.getByRole('button', { name: 'Yayınla (Görünür Yap)' });
  await expect(publish).toBeVisible();
  const actions = page.locator('.admin-actions');
  await actions.scrollIntoViewIfNeeded();
  const buttons = await actions.locator('button').all();
  const bounds = await Promise.all(buttons.map(button => button.boundingBox()));
  expect(bounds).toHaveLength(3);
  expect(Math.max(...bounds.map(box => box.y)) - Math.min(...bounds.map(box => box.y))).toBeLessThan(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('author-detail-actions.png'), fullPage: true });
  page.once('dialog', dialog => dialog.accept());
  await publish.click();
  await expect(page.getByText('Kitabınız yayınlandı ve okuyuculara açıldı.')).toBeVisible();
  await expect(publish).toHaveCount(0);
  expect(app.unexpected).toEqual([]);
});

test('chapter reading remains navigable and records quotes for the current chapter', async ({ page }, testInfo) => {
  const app = await mockReader(page);
  await page.goto('/kitap/test-kitabi/oku');
  await expect(page.getByRole('heading', { name: 'Birinci bölüm', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kitap görünümü' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tamamla ve Devam Et' }).click();
  await expect(page.getByRole('heading', { name: 'İkinci bölüm', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await selectContent(page, '.paragraph-content');
  const dialog = page.getByRole('dialog', { name: 'Alıntı kaydet' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect.poll(() => app.quotes.length).toBe(1);
  expect(app.quotes[0]).toMatchObject({ chapterId: 'chapter-1', chapterTitle: 'İkinci bölüm', chapterIndex: 1 });
  await dialog.getByRole('button', { name: 'Alıntı penceresini kapat' }).click();
  await page.getByRole('button', { name: 'Tamamla ve Devam Et' }).click();
  await expect(page.getByRole('heading', { name: 'Üçüncü bölüm', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reader-chapters.png'), fullPage: true });
  expect(app.unexpected).toEqual([]);
});

test('publication controls stay visible through publishing, completion and returning to draft', async ({ page }, testInfo) => {
  const app = await mockReader(page, { draft: true });
  await page.goto('/dashboard/book');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Yayınla (Görünür Yap)' }).click();
  const controls = page.getByRole('region', { name: 'Yayın yönetimi' });
  await expect(controls.getByRole('button', { name: 'Taslağa Çek' })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Yazımı Tamamla' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await controls.getByRole('button', { name: 'Yazımı Tamamla' }).click();
  await expect(controls.getByRole('button', { name: /Destek Fonu İçin Başvur/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard-publication-controls.png'), fullPage: true });
  await page.goto('/kitap/test-kitabi');
  await expect(controls.getByRole('link', { name: /Destek Fonu İçin Başvur/ })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await controls.getByRole('button', { name: 'Taslağa Çek' }).click();
  await expect(page.getByRole('button', { name: 'Yayınla (Görünür Yap)' })).toBeVisible();
  expect(app.unexpected).toEqual([]);
});

test('the editor reserves most of the viewport for text and keeps secondary actions in a compact menu', async ({ page }, testInfo) => {
  const app = await mockReader(page, { draft: true });
  await page.goto('/dashboard/book');
  const publish = page.getByRole('button', { name: 'Yayınla (Görünür Yap)' });
  await expect(publish).toBeVisible();
  const buttonBox = await publish.boundingBox();
  expect(buttonBox.height).toBeLessThanOrEqual(44);
  expect(buttonBox.width).toBeLessThan(240);
  const availableText = await page.locator('.dashboard-container').evaluate(dashboard => {
    const editor = dashboard.querySelector('.ql-editor').getBoundingClientRect();
    const wrapper = dashboard.querySelector('.quill-wrapper').getBoundingClientRect();
    const bounds = dashboard.getBoundingClientRect();
    return (Math.min(editor.bottom, wrapper.bottom, bounds.bottom) - Math.max(editor.top, wrapper.top, bounds.top)) / bounds.height;
  });
  expect(availableText).toBeGreaterThan(.6);
  const editorTop = (await page.locator('.quill-wrapper').boundingBox()).y;
  await expect(page.getByRole('button', { name: 'Okuyuculardan gizle' })).toBeHidden();
  await page.getByLabel('Bölüm işlemleri').click();
  await expect(page.getByRole('button', { name: 'Okuyuculardan gizle' })).toBeVisible();
  expect((await page.locator('.quill-wrapper').boundingBox()).y).toBe(editorTop);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Okuyuculardan gizle' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('compact-writing-layout.png'), fullPage: true });
  if (testInfo.project.name === 'mobile') {
    await page.setViewportSize({ width: 393, height: 420 });
    await expect(page.locator('.dashboard-container')).toHaveClass(/dashboard-short-viewport/);
    await page.locator('.ql-editor').scrollIntoViewIfNeeded();
    await page.locator('.ql-editor').focus();
    expect(await page.locator('.dashboard-main').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('short-writing-viewport.png'), fullPage: true });
  }
  expect(app.unexpected).toEqual([]);
});

test('personal foxes follow kolelkaa across pages without obstructing writing or reading', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await mockReader(page, { draft: true, username: 'kolelkaa' });
  for (const path of ['/about', '/privacy', '/contact', '/dashboard/book', '/kitap/test-kitabi', '/kitap/test-kitabi/oku', '/not-a-page']) {
    await page.goto(path);
    const fox = page.locator('.personal-fox-anchor:not(.personal-fox-anchor--farewell) .personal-fox-image');
    await expect(fox).toBeVisible();
    await expect.poll(() => fox.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await fox.evaluate(image => getComputedStyle(image.parentElement).pointerEvents)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (path === '/about') {
      const farewell = page.locator('.personal-fox-anchor--farewell .personal-fox-image');
      await farewell.scrollIntoViewIfNeeded();
      await expect.poll(() => farewell.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (path === '/about' || path === '/dashboard/book' || path.endsWith('/oku')) {
      await page.screenshot({ path: testInfo.outputPath(`fox-${path === '/about' ? 'postcard' : path.endsWith('/oku') ? 'reader' : 'writer'}.png`), fullPage: true });
    }
    if (path === '/dashboard/book') {
      const image = await fox.boundingBox();
      const editor = await page.locator('.quill-wrapper').boundingBox();
      expect(image.y + image.height).toBeLessThanOrEqual(editor.y);
      expect(image.height).toBeLessThanOrEqual(38); // 34px artwork plus its small decorative rotation.
      await page.getByLabel('Bölüm işlemleri').click();
      await expect(page.getByRole('button', { name: 'Okuyuculardan gizle' })).toBeVisible();
    }
  }
  await page.evaluate(() => { localStorage.clear(); window.dispatchEvent(new Event('betik:auth-session-changed')); });
  await expect(page.locator('.personal-fox-image')).toHaveCount(0);
  await expect(page.locator('.personal-fox-anchor')).toHaveCount(0);
});

for (const username of ['okur', 'Kolelkaa']) {
  test(`personal foxes load no images for signed-in ${username} or a guest`, async ({ page }) => {
    const foxRequests = [];
    page.on('request', request => { if (request.url().includes('/images/fox/')) foxRequests.push(request.url()); });
    await mockReader(page, { username });
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'Her hikâye bir okurla büyür' })).toBeVisible();
    await expect(page.locator('.personal-fox-image')).toHaveCount(0);
    await expect(page.locator('.personal-fox-anchor')).toHaveCount(0);
    await page.evaluate(() => { localStorage.clear(); window.dispatchEvent(new Event('betik:auth-session-changed')); });
    await expect(page.locator('.personal-fox-image')).toHaveCount(0);
    expect(foxRequests).toEqual([]);
  });
}
