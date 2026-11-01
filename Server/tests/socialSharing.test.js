import { ApolloServer } from '@apollo/server';
import express from 'express';
import { connect, clearDatabase, closeDatabase } from './db.js';
import schema from '../src/graphql/schema.js';
import socialShareRoutes from '../src/routes/socialShareRoutes.js';
import { getSocialShare, getPublicQuote, shareWebOrigin } from '../src/services/socialShareService.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Quote from '../src/models/quote.js';
import User from '../src/models/user.js';
import Session from '../src/models/session.js';

let user, book, chapter, quote, api, httpServer, baseUrl;
const originalClientUrl = process.env.CLIENT_URL;
beforeAll(async () => {
  process.env.CLIENT_URL = 'https://betik.example';
  await connect();
  api = new ApolloServer({ schema, plugins: [{ async requestDidStart() { return { async executionDidStart() { return { willResolveField() { return () => {}; } }; } }; } }] });
  await api.start();
  const app = express(); app.use('/share', socialShareRoutes);
  await new Promise(resolve => { httpServer = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});
afterAll(async () => {
  httpServer.closeAllConnections(); await new Promise(resolve => httpServer.close(resolve));
  await api.stop(); await closeDatabase();
  if (originalClientUrl === undefined) delete process.env.CLIENT_URL; else process.env.CLIENT_URL = originalClientUrl;
});
beforeEach(async () => {
  user = await User.create({ username: 'writer', fullName: 'Yazar Adı', email: 'writer@example.test', password: 'test', bio: 'Herkese açık biyografi' });
  book = await Book.create({ title: 'Paylaşılabilir Kitap', description: 'Kitabın tanıtım metni.', authorId: user._id, status: 'WRITING' });
  chapter = await Chapter.create({ bookId: book._id, authorId: user._id, title: 'Yeni Bölüm', content: 'Bölümün tamamı önizleme meta verisine konulmamalı.' });
  quote = await Quote.create({ bookId: book._id, chapterId: chapter._id, userId: user._id, text: 'Paylaşmaya değer bir cümle.', normalizedText: 'paylasmaya deger bir cumle' });
});
afterEach(clearDatabase);

test('book/chapter links are stable and chapter previews exclude the manuscript', async () => {
  const sharedBook = await getSocialShare('BOOK', book.id);
  expect(sharedBook.path).toBe('/kitap/paylasilabilir-kitap-writer');
  const sharedChapter = await getSocialShare('CHAPTER', chapter.id);
  expect(sharedChapter.path).toBe('/kitap/paylasilabilir-kitap-writer/bolum/yeni-bolum');
  expect(sharedChapter.title).toContain(chapter.title);
  expect(JSON.stringify(sharedChapter)).not.toContain(chapter.content);
  expect(sharedChapter.imagePath).toBe('/social-share/chapter.jpg');
});

test('drafts, deleted chapters and inactive authors cannot generate public metadata', async () => {
  await Book.updateOne({ _id: book._id }, { status: 'DRAFT' });
  await expect(getSocialShare('BOOK', book.id)).rejects.toThrow('herkese açık');
  await expect(getSocialShare('CHAPTER', chapter.id)).rejects.toThrow('herkese açık');
  await Book.updateOne({ _id: book._id }, { status: 'WRITING' });
  await Chapter.updateOne({ _id: chapter._id }, { isDeleted: true });
  await expect(getSocialShare('CHAPTER', chapter.id)).rejects.toThrow();
  await User.updateOne({ _id: user._id }, { isActive: false });
  await expect(getSocialShare('BOOK', book.id)).rejects.toThrow();
});

test('printed books need catalog approval even when their generic status is published', async () => {
  const printed = await Book.create({ title: 'Basılı Kitap', kind: 'PRINTED', status: 'PUBLISHED', publicationStatus: 'PENDING' });
  await expect(getSocialShare('BOOK', printed.id)).rejects.toThrow();
  await Book.updateOne({ _id: printed._id }, { publicationStatus: 'APPROVED' });
  expect((await getSocialShare('BOOK', printed.id)).title).toBe(printed.title);
});

test('quote permalinks resolve directly and spoiler text never appears in social metadata', async () => {
  expect((await getSocialShare('QUOTE', quote.id)).path).toBe(`/quotes/${quote.id}`);
  await Quote.updateOne({ _id: quote._id }, { isSpoiler: true });
  const item = await getSocialShare('QUOTE', quote.id);
  expect(item.description).toContain('spoiler');
  expect(item.description).not.toContain(quote.text);
  const response = await api.executeOperation({ query: 'query($id:ID!){getQuoteById(id:$id){id text isSpoiler user{username} book{title}}}', variables: { id: quote.id } }, { contextValue: {} });
  expect(response.body.singleResult.errors).toBeUndefined();
  expect(response.body.singleResult.data.getQuoteById.id).toBe(quote.id);
});

test('private quote authors and removed source books remain private after links were created', async () => {
  await User.updateOne({ _id: user._id }, { 'privacySettings.isProfilePublic': false });
  await expect(getPublicQuote(quote.id)).rejects.toThrow();
  const response = await api.executeOperation({ query: 'query($id:ID!){getQuoteById(id:$id){id text}}', variables: { id: quote.id } }, { contextValue: {} });
  expect(response.body.singleResult.data.getQuoteById).toBeNull();
  await User.updateOne({ _id: user._id }, { 'privacySettings.isProfilePublic': true });
  await Book.updateOne({ _id: book._id }, { isDeleted: true });
  await expect(getSocialShare('QUOTE', quote.id)).rejects.toThrow();
});

test('private profile links do not export names or biographies', async () => {
  const publicProfile = await getSocialShare('PROFILE', user.id);
  expect(publicProfile.title).toContain(user.fullName);
  await User.updateOne({ _id: user._id }, { 'privacySettings.isProfilePublic': false, bio: 'Gizli bilgiler' });
  const privateProfile = await getSocialShare('PROFILE', user.id);
  expect(privateProfile.path).toBe('/yazar/writer');
  expect(JSON.stringify(privateProfile)).not.toContain(user.fullName);
  expect(JSON.stringify(privateProfile)).not.toContain('Gizli bilgiler');
});

test('only active open sessions can be shared', async () => {
  const session = await Session.create({ title: 'Birlikte okuyalım', createdBy: user._id, type: 'OPEN' });
  expect((await getSocialShare('SESSION', session.id)).path).toBe('/oturum/birlikte-okuyalim');
  await Session.updateOne({ _id: session._id }, { type: 'FOLLOWERS_ONLY' });
  await expect(getSocialShare('SESSION', session.id)).rejects.toThrow();
  await Session.updateOne({ _id: session._id }, { type: 'PRIVATE' });
  await expect(getSocialShare('SESSION', session.id)).rejects.toThrow();
});

test('WhatsApp preview HTML is server rendered, escaped and points at the correct resource', async () => {
  await Book.updateOne({ _id: book._id }, { title: '</title><script>alert(1)</script>' });
  const response = await fetch(`${baseUrl}/share/book/${book.id}`);
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('property="og:title"');
  expect(html).toContain(`property="og:url" content="${baseUrl}/share/book/title-script-alert-1-script-writer?webOrigin=https%3A%2F%2Fbetik.example"`);
  expect(html).toContain('https://betik.example/social-share/link-preview.jpg');
  expect(html).toContain('https://betik.example/kitap/title-script-alert-1-script-writer');
  expect(html).not.toContain('</title><script>alert(1)</script>');
  expect(response.headers.get('content-security-policy')).toContain("script-src 'nonce-");
  expect(response.headers.get('cache-control')).toBe('no-store');
});

test('preview routes recheck privacy and never redirect to arbitrary origins', async () => {
  expect((await fetch(`${baseUrl}/share/book/${book.id}?webOrigin=https://evil.example`)).status).toBe(404);
  expect(() => shareWebOrigin('https://evil.example')).toThrow();
  const local = await fetch(`${baseUrl}/share/book/${book.id}?webOrigin=http://localhost:3000`);
  expect(await local.text()).toContain('http://localhost:3000/kitap/paylasilabilir-kitap-writer');
  await Book.updateOne({ _id: book._id }, { status: 'DRAFT' });
  const unavailable = await fetch(`${baseUrl}/share/book/${book.id}`);
  expect(unavailable.status).toBe(404);
  expect(await unavailable.text()).not.toContain(book.title);
});

test('Apollo can observe sharing resolver promises repeatedly without reexecuting database queries', async () => {
  const response = await api.executeOperation({ query: 'query($id:ID!){getSocialShare(type:BOOK,id:$id){title path webOrigin imagePath}}', variables: { id: book.id } }, { contextValue: {} });
  expect(response.body.singleResult.errors).toBeUndefined();
  expect(response.body.singleResult.data.getSocialShare.path).toBe('/kitap/paylasilabilir-kitap-writer');
});

test('readable preview URLs resolve books, chapters, profiles and sessions while old ID links stay valid', async () => {
  const session = await Session.create({ title: 'Kitap Sohbeti', createdBy: user.id, type: 'OPEN' });
  for (const [type, id] of [['BOOK', book.id], ['CHAPTER', chapter.id], ['PROFILE', user.id], ['SESSION', session.id]]) {
    const item = await getSocialShare(type, id);
    expect(await getSocialShare(type, item.shareKey)).toMatchObject({ id, path: item.path });
    const response = await fetch(`${baseUrl}/share/${type.toLowerCase()}/${encodeURIComponent(item.shareKey)}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`https://betik.example${item.path}`);
  }
  await User.updateOne({ _id: user.id }, { username: '0123456789abcdef01234567' });
  expect((await getSocialShare('PROFILE', '0123456789abcdef01234567')).id).toBe(user.id);
});
