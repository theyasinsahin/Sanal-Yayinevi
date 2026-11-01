import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import User from '../src/models/user.js';
import Session from '../src/models/session.js';
import { bookPath, chapterPath, profilePath, sessionPath, slugify, resolvePublicRoute } from '../src/services/publicUrlService.js';

let user, book, api;
beforeAll(async () => {
  await connect(); await Promise.all([Book.init(), Chapter.init(), Session.init()]);
  api = new ApolloServer({ schema, plugins: [{ async requestDidStart() { return { async executionDidStart() { return { willResolveField() { return () => {}; } }; } }; } }] });
  await api.start();
});
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  user = await User.create({ username: 'deniz', fullName: 'Deniz', email: 'deniz@example.test', password: 'test' });
  book = await Book.create({ title: 'İçimizdeki Çığlık: Özgürlük!', authorId: user._id, status: 'WRITING' });
});

test('existing books acquire readable Turkish slugs without changing their edit timestamp', async () => {
  expect(slugify('İĞÜŞÖÇ ı & güzel')).toBe('igusoc-i-guzel');
  const before = book.updatedAt;
  expect(await bookPath(book)).toBe('/kitap/icimizdeki-ciglik-ozgurluk-deniz');
  const saved = await Book.findById(book.id);
  expect(saved.updatedAt).toEqual(before);
  expect(await resolvePublicRoute({ type: 'BOOK', reference: saved.urlSlug })).toMatchObject({ id: book.id, path: '/kitap/icimizdeki-ciglik-ozgurluk-deniz' });
});

test('concurrent requests for one book and duplicate titles produce unique stable links', async () => {
  const books = await Book.create(Array.from({ length: 4 }, () => ({ title: book.title, authorId: user._id })));
  const sameBook = await Promise.all(Array.from({ length: 8 }, () => bookPath(book)));
  expect(new Set(sameBook).size).toBe(1);
  const paths = await Promise.all(books.map(bookPath));
  expect(new Set([...paths, sameBook[0]]).size).toBe(5);
  await Book.updateOne({ _id: book.id }, { title: 'Yeni isim' });
  await User.updateOne({ _id: user.id }, { username: 'yeni-ad' });
  expect(await bookPath(await Book.findById(book.id))).toBe(sameBook[0]);
});

test('profiles resolve usernames including ID-looking usernames, and retain old ID links', async () => {
  expect(profilePath(user)).toBe('/yazar/deniz');
  expect(await resolvePublicRoute({ type: 'PROFILE', reference: 'deniz' })).toMatchObject({ id: user.id });
  expect(await resolvePublicRoute({ type: 'PROFILE', reference: user.id, legacy: true })).toMatchObject({ id: user.id, path: '/yazar/deniz' });
  await User.updateOne({ _id: user.id }, { username: '0123456789abcdef01234567' });
  expect(await resolvePublicRoute({ type: 'PROFILE', reference: '0123456789abcdef01234567' })).toMatchObject({ id: user.id });
  await User.updateOne({ _id: user.id }, { isActive: false });
  expect(await resolvePublicRoute({ type: 'PROFILE', reference: user.id, legacy: true })).toBeNull();
});

test('chapter URLs open the requested chapter and reject missing or unrelated chapters', async () => {
  const chapter = await Chapter.create({ bookId: book.id, authorId: user.id, title: 'İlk Bölüm' });
  const path = await chapterPath(chapter);
  expect(path).toBe('/kitap/icimizdeki-ciglik-ozgurluk-deniz/bolum/ilk-bolum');
  const route = { type: 'BOOK', reference: 'icimizdeki-ciglik-ozgurluk-deniz', chapter: 'ilk-bolum' };
  expect(await resolvePublicRoute(route)).toMatchObject({ id: book.id, chapterId: chapter.id, path });
  expect(await resolvePublicRoute({ type: 'BOOK', reference: book.id, chapter: chapter.id, legacy: true })).toMatchObject({ path });
  expect(await resolvePublicRoute({ ...route, chapter: 'yok' })).toBeNull();
  await Chapter.updateOne({ _id: chapter.id }, { isDeleted: true });
  expect(await resolvePublicRoute(route)).toBeNull();
});

test('printed moderation, deleted books and inactive authors remain enforced for both URL forms', async () => {
  const printed = await Book.create({ title: 'Basılı Eser', printedAuthor: 'Yazar Adı', kind: 'PRINTED', publicationStatus: 'PENDING', submittedBy: user.id });
  const path = await bookPath(printed);
  expect(path).toBe('/kitap/basili-eser-yazar-adi');
  const args = { type: 'BOOK', reference: path.split('/').pop() };
  expect(await resolvePublicRoute(args)).toBeNull();
  expect(await resolvePublicRoute(args, user)).toMatchObject({ id: printed.id });
  await Book.updateOne({ _id: printed.id }, { publicationStatus: 'APPROVED' });
  expect(await resolvePublicRoute(args)).toMatchObject({ id: printed.id });
  await Book.updateOne({ _id: printed.id }, { isDeleted: true });
  expect(await resolvePublicRoute(args)).toBeNull();
  await User.updateOne({ _id: user.id }, { isActive: false });
  expect(await resolvePublicRoute({ type: 'BOOK', reference: book.id, legacy: true })).toBeNull();
});

test('session names have permanent links without bypassing follower access', async () => {
  const session = await Session.create({ title: 'Birlikte Okuyalım', createdBy: user.id, type: 'OPEN' });
  expect(await sessionPath(session)).toBe('/oturum/birlikte-okuyalim');
  expect(await resolvePublicRoute({ type: 'SESSION', reference: 'birlikte-okuyalim' })).toMatchObject({ id: session.id });
  await Session.updateOne({ _id: session.id }, { type: 'FOLLOWERS_ONLY' });
  await expect(resolvePublicRoute({ type: 'SESSION', reference: 'birlikte-okuyalim' })).rejects.toThrow('takipçiler');
  expect(await resolvePublicRoute({ type: 'SESSION', reference: session.id, legacy: true }, user)).toMatchObject({ id: session.id });
});

test('actual Apollo execution resolves URL fields and lookups without executing queries twice', async () => {
  const result = await api.executeOperation({ query: 'query($id:ID!){getBookById(id:$id){id publicPath author{username publicPath} chapters{id publicPath}}}', variables: { id: book.id } }, { contextValue: { user, User, Chapter } });
  expect(result.body.singleResult.errors).toBeUndefined();
  expect(result.body.singleResult.data.getBookById).toMatchObject({ publicPath: '/kitap/icimizdeki-ciglik-ozgurluk-deniz', author: { publicPath: '/yazar/deniz' } });
  const lookup = await api.executeOperation({ query: '{resolvePublicRoute(type:BOOK,reference:"icimizdeki-ciglik-ozgurluk-deniz"){id path}}' }, { contextValue: {} });
  expect(lookup.body.singleResult.errors).toBeUndefined();
  expect(lookup.body.singleResult.data.resolvePublicRoute.id).toBe(book.id);
  expect(await resolvePublicRoute({ type: 'BOOK', reference: 'invalid', legacy: true })).toBeNull();
});
