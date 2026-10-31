import { profilePath, bookPath, readerPath, sessionPath } from './publicPaths';
import { genreName } from './genreDisplay';
import { filterBooks } from './FilterBooks';
import { isChapterLocked, chapterLengthLabel } from './chapterVisibility';
import { validatePassword } from './PasswordValidation';

test('canonical paths take priority and legacy IDs remain navigable', () => {
  expect(profilePath({ id: 'u', publicPath: '/yazar/real' })).toBe('/yazar/real');
  expect(profilePath({ username: 'a/b c' })).toBe('/yazar/a%2Fb%20c');
  expect(profilePath({ id: 'u' })).toBe('/user/u');
  expect(bookPath({ id: 'b' })).toBe('/book-detail/b');
  expect(bookPath({ publicPath: '/kitap/roman' })).toBe('/kitap/roman');
  expect(readerPath({ publicPath: '/kitap/roman' })).toBe('/kitap/roman/oku');
  expect(readerPath({ id: 'b' })).toBe('/book-reader/b');
  expect(sessionPath({ publicPath: '/oturum/reading' })).toBe('/oturum/reading');
  expect(sessionPath({ id: 's' })).toBe('/sessions/s');
});
test.each([[null, ''], ['', ''], ['📚  Bilim   Kurgu  ', 'Bilim Kurgu'], ['Şiir', 'Şiir']])('genre labels normalize legacy decoration: %s', (input, expected) => {
  expect(genreName(input)).toBe(expected);
});
test('chapter lock state follows server authorization rather than guessing from isHidden', () => {
  expect(isChapterLocked({ isHidden: true, canReadContent: true })).toBe(false);
  expect(isChapterLocked({ canReadContent: false })).toBe(true);
  expect(isChapterLocked(null)).toBe(false);
  expect(chapterLengthLabel({ wordCount: 1250, pageCount: 4 })).toBe('1.250 kelime · 4 sayfa');
  expect(chapterLengthLabel({ wordCount: 0 })).toBe('0 kelime');
  expect(chapterLengthLabel({ pageCount: 2 })).toBe('2 sayfa');
  expect(chapterLengthLabel(null)).toBe('Uzunluk bilgisi hazırlanıyor');
});

const books = [
  { id: 'old', title: 'Forest', author: { username: 'Ada', fullName: 'Ada Writer' }, publishDate: '2025-01-01', updatedAt: '2026-01-01', likedBy: ['u'], format: { slug: 'roman' }, genres: [{ slug: 'gizem' }], classificationTags: [{ slug: 'doga' }], narrativeFeatures: [{ slug: 'seri' }], targetAudience: { slug: 'yetiskin' } },
  { id: 'new', title: 'Ocean', author: { username: 'Deniz', fullName: 'Other Name' }, publishDate: '2026-01-01', updatedAt: '2025-01-01', likedBy: ['u', 'v'], format: { slug: 'siir' }, genres: [{ slug: 'ask' }] },
  { id: 'empty', publishDate: '2024-01-01', updatedAt: '2024-01-01' },
];
const ids = value => value.map(book => book.id);
test('search matches title, username, or full name without mutating the input list', () => {
  for (const search of [' forest ', 'ADA', 'writer']) expect(ids(filterBooks(books, { search }))).toEqual(['old']);
  expect(filterBooks(undefined, {})).toEqual([]);
  expect(ids(filterBooks(books, { search: '   ' }))).toEqual(['old', 'new', 'empty']);
  expect(ids(filterBooks(books, { search: 'unmatched' }))).toEqual([]);
  expect(ids(books)).toEqual(['old', 'new', 'empty']);
});
test.each([['formats', 'roman'], ['genres', 'gizem'], ['tags', 'doga'], ['features', 'seri'], ['audiences', 'yetiskin']])('classification %s filters safely when other books lack metadata', (key, slug) => {
  expect(ids(filterBooks(books, { classification: { [key]: [slug] } }))).toEqual(['old']);
});
test('selected terms use OR within an axis and AND across axes', () => {
  expect(ids(filterBooks(books, { classification: { genres: ['gizem', 'ask'] } }))).toEqual(['old', 'new']);
  expect(filterBooks(books, { classification: { genres: ['gizem'], formats: ['siir'] } })).toEqual([]);
});
test.each([['newest', ['new', 'old', 'empty']], ['oldest', ['empty', 'old', 'new']], ['popular', ['new', 'old', 'empty']], ['lastUpdated', ['old', 'new', 'empty']], ['unknown', ['old', 'new', 'empty']]])('sorting by %s preserves the original order for future searches', (sortBy, expected) => {
  expect(ids(filterBooks(books, { sortBy }))).toEqual(expected);
  expect(ids(books)).toEqual(['old', 'new', 'empty']);
});
test.each([['Aa1!abcd', []], ['aa1!abcd', ['uppercase']], ['AA1!ABCD', ['lowercase']], ['Aaa!abcd', ['number']], ['Aa12abcd', ['special']], ['Aa1!', ['length']]])('password validation reports the missing requirements: %s', (password, missing) => {
  const result = validatePassword(password);
  expect(result.results.filter(rule => !rule.passed).map(rule => rule.id)).toEqual(missing);
  expect(result.isValid).toBe(missing.length === 0);
});
