import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'node:fs';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import BookClaim from '../src/models/bookClaim.js';
import User from '../src/models/user.js';
import Chapter from '../src/models/chapter.js';
import Comment from '../src/models/comment.js';
import Genre from '../src/models/genre.js';
import Notification from '../src/models/notification.js';
import * as printed from '../src/services/printedBookService.js';
import * as books from '../src/services/bookService.js';
import * as quotes from '../src/services/quoteService.js';
import * as comments from '../src/services/commentService.js';
import chapters from '../src/graphql/resolvers/chapter.js';
import bookResolvers from '../src/graphql/resolvers/book.js';
import { canEditBookContent, normalizeIsbn } from '../src/utils/printedBooks.js';

const input = { isbn: '9780140328721', title: 'Basılı Eser', printedAuthor: 'Kitabın Yazarı', publisher: 'Bir Yayınevi', publicationYear: 2020, pageCount: 200, description: 'Bu eser fiziksel olarak basılmış bir kitabın tanıtımıdır.', publicationEvidenceUrl: 'https://example.test/catalog/book', purchaseUrl: 'https://example.test/buy' };
let user, other, admin;
beforeAll(async () => { await connect(); await Promise.all([Book.init(), BookClaim.init(), Notification.init()]); });
afterAll(closeDatabase);
beforeEach(async () => {
  [user, other, admin] = await User.create([
    { username: 'submitter', email: 'first@example.test', fullName: 'First', password: 'test' },
    { username: 'author', email: 'author@example.test', fullName: 'Author', password: 'test' },
    { username: 'admin', email: 'admin@example.test', fullName: 'Admin', password: 'test', role: 'ADMIN' },
  ]);
});
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
const approved = async () => {
  const book = await printed.submitPrintedBook(input, user);
  return printed.reviewPrintedBook({ bookId: book._id, approve: true }, admin);
};
const context = actor => ({ user: actor, Book, User, Chapter, Comment, Genre });

const clientDocument = (file, name) => readFileSync(new URL(`../../Client/src/graphql/${file}`, import.meta.url), 'utf8').split(`export const ${name} = gql\``)[1].split('`;')[0];
const clientBookQuery = clientDocument('queries/book.js', 'GET_BOOK_BY_ID').replace('${PRINTED_BOOK_FIELDS}', clientDocument('printedBooks.js', 'PRINTED_BOOK_FIELDS'));
const clientReviewQuery = clientDocument('printedBooks.js', 'GET_PRINTED_REVIEWS');
// Apollo's field instrumentation observes resolver results as well as GraphQL
// execution. A raw Mongoose Query cannot safely be observed twice.
const fieldInstrumentation = {
  async requestDidStart() {
    return { async executionDidStart() { return { willResolveField() { return () => {}; } }; } };
  },
};
async function apolloQuery(query, actor, variables) {
  const server = new ApolloServer({ schema, plugins: [fieldInstrumentation] });
  await server.start();
  try {
    const response = await server.executeOperation({ query, variables }, { contextValue: context(actor) });
    expect(response.body.kind).toBe('single');
    expect(response.body.singleResult.errors).toBeUndefined();
    return response.body.singleResult.data;
  } finally { await server.stop(); }
}

test('the full client book query opens legacy and newly created digital books through Apollo', async () => {
  const legacy = await Book.create({ title: 'Legacy book', authorId: user._id, description: 'Legacy description', status: 'WRITING' });
  await Book.collection.updateOne({ _id: legacy._id }, { $unset: { kind: 1 } });
  const genre = await Genre.create({ name: 'Roman', slug: 'roman' });
  const created = await books.createBook({ title: 'New digital book', description: 'New description', genreId: genre.id, imageUrl: '' }, user._id);
  for (const book of [legacy, created]) {
    const result = await apolloQuery(clientBookQuery, user, { id: book.id });
    expect(result.getBookById).toMatchObject({ id: book.id, title: book.title, kind: 'DIGITAL', myClaim: null });
  }
});

test('the actual Apollo admin review query loads submitters, claimants and related books', async () => {
  const pending = await printed.submitPrintedBook({ ...input, isbn: '' }, user);
  const publicBook = await approved();
  await printed.requestBookClaim({ bookId: publicBook.id, evidence: 'Bu kitabın yazarlık ve yayın haklarını belgeleyen açıklama.' }, other);
  const data = await apolloQuery(clientReviewQuery, admin);
  expect(data.getPrintedBookReviews[0]).toMatchObject({ id: pending.id, submittedBy: { id: user.id } });
  expect(data.getBookClaimReviews[0]).toMatchObject({ claimant: { id: other.id }, book: { id: publicBook.id } });
});

test('Apollo resolves private submission and claim fields once while preserving access control', async () => {
  const pending = await printed.submitPrintedBook({ ...input, isbn: '' }, user);
  for (const viewer of [user, admin]) {
    const data = await apolloQuery(clientBookQuery, viewer, { id: pending.id });
    expect(data.getBookById).toMatchObject({ id: pending.id, myClaim: null, publicationEvidenceUrl: input.publicationEvidenceUrl });
  }
  const book = await approved();
  const claim = await printed.requestBookClaim({ bookId: book.id, evidence: 'Bu kitabın dijital yayın haklarının sahibiyim.' }, other);
  const ownerView = await apolloQuery(clientBookQuery, other, { id: book.id });
  expect(ownerView.getBookById.myClaim).toMatchObject({ id: claim.id, status: 'PENDING' });
  const visitorView = await apolloQuery(clientBookQuery, null, { id: book.id });
  expect(visitorView.getBookById).toMatchObject({ myClaim: null, publicationEvidenceUrl: null });
});

test('ISBN checksums are validated and ISBN-10/13 resolve to the same unique edition', () => {
  expect(normalizeIsbn('0-14-032872-6')).toBe('9780140328721');
  expect(normalizeIsbn('978 0 14032872 1')).toBe('9780140328721');
  expect(normalizeIsbn('080442957X')).toBe('9780804429573');
  expect(() => normalizeIsbn('9780140328722')).toThrow();
  expect(() => normalizeIsbn('abcdefghij')).toThrow();
});

test('submissions are private, do not grant authorship and are absent from all public lists', async () => {
  const book = await printed.submitPrintedBook(input, user);
  expect(book.authorId).toBeUndefined();
  expect(book.chapters).toHaveLength(0);
  expect(await books.findBookById(book._id)).toBeNull();
  expect(await books.findBookById(book._id, { viewer: other })).toBeNull();
  expect((await books.findBookById(book._id, { viewer: user })).id).toBe(book.id);
  expect(await books.findAllBooks()).toHaveLength(0);
  expect(await books.searchBooksInDb('Basılı')).toHaveLength(0);
  expect((await printed.getPrintedBooks({})).total).toBe(0);
  expect(await Notification.countDocuments({ userId: admin._id, type: 'BOOK_REVIEW' })).toBe(1);
  await expect(printed.getBookReviews(user)).rejects.toThrow('yönetici');
  await expect(printed.reviewPrintedBook({ bookId: book._id, approve: true }, user)).rejects.toThrow('yönetici');
});

test('approval lists an edition without a Betik author and hides applicant evidence from visitors', async () => {
  const book = await approved();
  const response = await graphql({ schema, source: `query($id:ID!){getBookById(id:$id){id authorId author{id} kind canEditContent publicationEvidenceUrl submittedBy{id} reviewNote} getPrintedBooks{total books{id}}}`, variableValues: { id: book.id }, contextValue: context(other) });
  expect(response.errors).toBeUndefined();
  expect(response.data.getBookById).toMatchObject({ authorId: null, author: null, kind: 'PRINTED', canEditContent: false, publicationEvidenceUrl: null, submittedBy: null, reviewNote: null });
  expect(response.data.getPrintedBooks.total).toBe(1);
  expect((await printed.getPrintedBooks({ search: '0140328726' })).total).toBe(1);
  expect((await printed.getPrintedBooks({ search: '[' })).total).toBe(0);
  expect(await books.findAllBooks()).toHaveLength(0);
  await expect(chapters.Mutation.createChapter(null, { bookId: book.id, title: 'Unauthorized', content: 'text' }, context(user))).rejects.toThrow('yazar yetkisi');
  await expect(bookResolvers.Mutation.updateBookStatus(null, { bookId: book.id, status: 'WRITING' }, context(user))).rejects.toThrow('fonlama');
  await expect(bookResolvers.Mutation.updateBook(null, { bookId: book.id, title: 'Changed' }, context(admin))).rejects.toThrow('künye');
});

test('comments and page-numbered quotes work without chapters after publication', async () => {
  const pending = await printed.submitPrintedBook(input, user);
  await expect(comments.createComment({ bookId: pending.id, userId: other._id, content: 'Yorum' })).rejects.toThrow('yayımlanmadı');
  await expect(quotes.createQuote(other._id, { bookId: pending.id, text: 'Paylaşılacak kısa bir alıntı', pageNumber: 5 })).rejects.toThrow('kataloğa');
  await printed.reviewPrintedBook({ bookId: pending.id, approve: true }, admin);
  const comment = await comments.createComment({ bookId: pending.id, userId: other._id, content: 'Kitabı beğendim.' });
  expect(comment.content).toBe('Kitabı beğendim.');
  const quote = await quotes.createQuote(other._id, { bookId: pending.id, text: 'Kitaptan paylaşılacak kısa bir alıntı.', pageNumber: 15 });
  expect(quote.chapterId).toBeUndefined();
  expect(quote.pageNumber).toBe(15);
  await expect(quotes.createQuote(other._id, { bookId: pending.id, text: 'Sayfa numarası hatalı alıntı', pageNumber: 201 })).rejects.toThrow('sayfa');
  await expect(quotes.createQuote(other._id, { bookId: pending.id, text: 'Çok uzun '.repeat(150), pageNumber: 1 })).rejects.toThrow('1000');
});

test('ISBN uniqueness is enforced across concurrent submissions and equivalent formats', async () => {
  const results = await Promise.allSettled([printed.submitPrintedBook(input, user), printed.submitPrintedBook({ ...input, isbn: '0140328726' }, other)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(await Book.countDocuments({ isbn: input.isbn })).toBe(1);
});

test('manual submissions remain possible, invalid identifiers and unsafe links are rejected', async () => {
  await expect(printed.submitPrintedBook(input, null)).rejects.toThrow('Giriş');
  await expect(printed.submitPrintedBook({ ...input, isbn: '123' }, user)).rejects.toThrow('ISBN');
  await expect(printed.submitPrintedBook({ ...input, purchaseUrl: 'javascript:alert(1)' }, user)).rejects.toThrow('https');
  await expect(printed.submitPrintedBook({ ...input, pageCount: 0 }, user)).rejects.toThrow('Sayfa');
  const book = await printed.submitPrintedBook({ ...input, isbn: '' }, user);
  expect(book.isbn).toBeUndefined();
  expect(book.publicationStatus).toBe('PENDING');
});

test('rejected applicants see a reason and may resubmit their ISBN without bypassing review', async () => {
  const book = await printed.submitPrintedBook(input, user);
  await expect(printed.reviewPrintedBook({ bookId: book.id, approve: false }, admin)).rejects.toThrow('Ret gerekçesi');
  await printed.reviewPrintedBook({ bookId: book.id, approve: false, note: 'Künye bağlantısı eksik.' }, admin);
  const again = await printed.submitPrintedBook({ ...input, description: 'Düzeltilen başvuru için yeni bir tanıtım metni.' }, user);
  expect(again.id).toBe(book.id);
  expect(again.publicationStatus).toBe('PENDING');
  expect(again.reviewNote).toBe('');
});

test('a claim grants no rights until admin approval; approval enables writing and preserves print pagination', async () => {
  const book = await approved();
  const claim = await printed.requestBookClaim({ bookId: book.id, evidence: 'Bu kitabın yazarıyım ve dijital yayın hakları bana aittir.' }, other);
  expect(canEditBookContent(await Book.findById(book.id), other)).toBe(false);
  await expect(printed.reviewBookClaim({ claimId: claim.id, approve: true }, user)).rejects.toThrow('yönetici');
  await printed.reviewBookClaim({ claimId: claim.id, approve: true }, admin);
  const ownerBook = await Book.findById(book.id);
  expect(canEditBookContent(ownerBook, other)).toBe(true);
  expect(canEditBookContent(ownerBook, user)).toBe(false);
  const chapter = await chapters.Mutation.createChapter(null, { bookId: book.id, title: 'Önsöz', content: 'Yazar tarafından paylaşılan bölüm', pageCount: 1 }, context(other));
  expect(chapter.authorId.toString()).toBe(other.id);
  expect((await Book.findById(book.id)).pageCount).toBe(200);
  const readerQuote = await quotes.createQuote(user._id, { bookId: book.id, chapterId: chapter.id, text: 'Yazarın dijital bölümünden yapılan bir alıntı.' });
  expect(String(readerQuote.chapterId)).toBe(chapter.id);
  await expect(chapters.Mutation.updateChapter(null, { chapterId: chapter.id, content: 'Yetkisiz' }, context(user))).rejects.toThrow();
  await expect(bookResolvers.Mutation.deleteBook(null, { id: book.id }, context(other))).rejects.toThrow('yönetici');
  expect((await User.findById(other.id)).usersBooks.map(String)).toContain(book.id);
});

test('duplicate claims are blocked and competing approvals cannot grant two writers', async () => {
  const book = await approved();
  const first = await printed.requestBookClaim({ bookId: book.id, evidence: 'İlk yazarlık ve yayın hakkı başvurusunun açıklaması.' }, user);
  await expect(printed.requestBookClaim({ bookId: book.id, evidence: 'Tekrar gönderilen hak talebi açıklaması.' }, user)).rejects.toThrow('bekleyen');
  const second = await printed.requestBookClaim({ bookId: book.id, evidence: 'İkinci yazarlık ve yayın hakkı başvurusunun açıklaması.' }, other);
  const results = await Promise.allSettled([printed.reviewBookClaim({ claimId: first.id, approve: true }, admin), printed.reviewBookClaim({ claimId: second.id, approve: true }, admin)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(await BookClaim.countDocuments({ bookId: book.id, status: 'APPROVED' })).toBe(1);
  expect(await BookClaim.countDocuments({ bookId: book.id, status: 'REJECTED' })).toBe(1);
  const winner = String((await Book.findById(book.id)).authorId);
  expect([user.id, other.id]).toContain(winner);
});

test('rejected claims can be retried and evidence stays private to the claimant/admin', async () => {
  const book = await approved();
  const claim = await printed.requestBookClaim({ bookId: book.id, evidence: 'Yazarlık ve hak sahipliğini destekleyen özel açıklama.' }, other);
  const response = await graphql({ schema, source: `query($id:ID!){getBookById(id:$id){myClaim{id evidence}}}`, variableValues: { id: book.id }, contextValue: context(user) });
  expect(response.data.getBookById.myClaim).toBeNull();
  await printed.reviewBookClaim({ claimId: claim.id, approve: false, note: 'Yayın hakkı bilgisi yetersiz.' }, admin);
  const retry = await printed.requestBookClaim({ bookId: book.id, evidence: 'Dijital yayın hakkını destekleyen yeni açıklama.' }, other);
  expect(retry.status).toBe('PENDING');
});

test('ISBN lookup is optional and provider failure preserves manual entry', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ title: 'Exact edition', publishers: ['Press'], publish_date: 'May 2020', number_of_pages: 200, covers: [42] }) });
  const result = await printed.lookupPrintedBook(input.isbn, user);
  expect(result).toMatchObject({ found: true, title: 'Exact edition', publicationYear: 2020, pageCount: 200 });
  expect(fetchMock.mock.calls[0][0]).toBe('https://openlibrary.org/isbn/9780140328721.json');
  fetchMock.mockRejectedValueOnce(new Error('timeout'));
  expect(await printed.lookupPrintedBook(input.isbn, user)).toEqual({ isbn: input.isbn, found: false });
});
