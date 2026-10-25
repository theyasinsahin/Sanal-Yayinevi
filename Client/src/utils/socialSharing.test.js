import { canShareImage, copyShareText, loadShareFile, publicWebOrigin, shareLinks } from './socialSharing';

const item = { type: 'CHAPTER', id: 'chapter-id', title: 'Yeni Bölüm — Kitap', description: 'Bölümü Betik’te oku.', path: '/book-reader/book-id?chapter=chapter-id', imagePath: '/social-share/chapter.jpg', webOrigin: 'https://betik.example' };
afterEach(() => jest.restoreAllMocks());

test('links contain the exact chapter and messaging shares include a clickable URL', () => {
  const links = shareLinks(item, 'https://betik.example', 'https://api.betik.example/graphql');
  expect(links.directUrl).toBe('https://betik.example/book-reader/book-id?chapter=chapter-id');
  expect(links.url).toBe('https://api.betik.example/share/chapter/chapter-id?webOrigin=https%3A%2F%2Fbetik.example');
  expect(new URL(links.whatsapp).searchParams.get('text')).toContain(links.url);
  expect(new URL(links.telegram).searchParams.get('url')).toBe(links.url);
  expect(new URL(links.x).searchParams.get('url')).toBe(links.url);
});

test('new book, chapter, profile and session shares use readable preview addresses', () => {
  for (const [type, path, key] of [
    ['BOOK', '/kitap/roman-deniz', 'roman-deniz'],
    ['CHAPTER', '/kitap/roman-deniz/bolum/ilk-bolum', 'ilk-bolum'],
    ['PROFILE', '/yazar/deniz', 'deniz'],
    ['SESSION', '/oturum/kitap-sohbeti', 'kitap-sohbeti'],
  ]) {
    const links = shareLinks({ ...item, type, path }, item.webOrigin, 'https://api.betik.example');
    expect(links.directUrl).toBe(`https://betik.example${path}`);
    expect(new URL(links.url).pathname).toBe(`/share/${type.toLowerCase()}/${key}`);
    expect(new URL(links.whatsapp).searchParams.get('text')).toContain(links.url);
  }
});

test('development stays local and native app origins use the configured public site', () => {
  expect(publicWebOrigin('https://betik.example', 'http://localhost:3000', 'https://native.example')).toBe('http://localhost:3000');
  expect(publicWebOrigin('https://betik.example', 'https://custom.example', undefined)).toBe('https://custom.example');
  expect(publicWebOrigin('https://betik.example', 'http://localhost', undefined)).toBe('https://betik.example');
  expect(publicWebOrigin('https://betik.example', 'capacitor://localhost', 'https://native.example')).toBe('https://native.example');
  expect(publicWebOrigin('https://betik.example', 'null', undefined)).toBe('https://betik.example');
});

test('static photographs are shared without drawing or composing an image', async () => {
  const blob = new Blob(['original-photo-bytes'], { type: 'image/jpeg' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => blob });
  const links = shareLinks(item, item.webOrigin);
  const file = await loadShareFile(item, links);
  expect(file.size).toBe(blob.size);
  expect(file.type).toBe('image/jpeg');
  expect(file.name).toBe('betik-chapter-chapter-id.jpg');
  expect(fetch).toHaveBeenCalledWith(links.imageUrl, expect.objectContaining({ credentials: 'omit' }));
});

test('a missing custom design falls back to the common photo even if the SPA returns HTML', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['html'], { type: 'text/html' }) }).mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) });
  const links = shareLinks(item, item.webOrigin);
  expect((await loadShareFile(item, links)).type).toBe('image/jpeg');
  expect(fetch.mock.calls[1][0]).toBe(links.fallbackImageUrl);
});

test('denied clipboard access does not report a false success', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
  document.execCommand = jest.fn().mockReturnValue(false);
  await expect(copyShareText('caption and link')).rejects.toThrow('seçip kopyalayabilirsiniz');
  expect(document.querySelector('[data-social-share-copy]')).not.toBeInTheDocument();
});

test('image sharing is capability checked and unsupported targets remain optional', () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: jest.fn() });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: jest.fn().mockReturnValue(false) });
  expect(canShareImage(new File(['image'], 'image.jpg', { type: 'image/jpeg' }), 'link')).toBe(false);
  navigator.canShare.mockImplementation(() => { throw new Error('unsupported'); });
  expect(canShareImage(new File([], 'image.jpg'), 'link')).toBe(false);
});
