import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

const { authenticateUser } = await import('../../src/utils/auth.js');
const bookResolversModule = await import('../../src/graphql/resolvers/book.js');
const bookResolvers = bookResolversModule.default; // { Query, Mutation, Book }

import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Comment from '../../src/models/comment.js';
import Chapter from '../../src/models/chapter.js';

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Book Resolvers', () => {
    
    let context;
    let mockUser;

    beforeEach(async () => {
        mockUser = await User.create({
            username: 'bookTester',
            fullName: 'Book Tester',
            email: 'book@test.com',
            password: '123',
            role: 'USER'
        });

        context = {
            Book, User, Comment, Chapter,
            req: { headers: { authorization: 'Bearer token' } }
        };

        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => jest.clearAllMocks());

    // --- QUERIES ---
    describe('QUERIES', () => {
        it('getAllBooks should return books', async () => {
            await Book.create({ title: 'B1', authorId: mockUser._id });
            const res = await bookResolvers.Query.getAllBooks(null, {}, context);
            expect(res).toHaveLength(1);
        });

        it('searchBooks should find by title', async () => {
            await Book.create({ title: 'Harry Potter', authorId: mockUser._id });
            const res = await bookResolvers.Query.searchBooks(null, { query: 'Harry' }, context);
            expect(res).toHaveLength(1);
            expect(res[0].title).toBe('Harry Potter');
        });
    });

    // --- MUTATIONS ---
    describe('MUTATIONS', () => {
        it('createBook should create book', async () => {
            const args = { title: 'New Book', genre: 'Sci-Fi', description: 'Desc', imageUrl: 'img.jpg' };
            const res = await bookResolvers.Mutation.createBook(null, args, context);
            
            expect(res.title).toBe('New Book');
            expect(res.authorId.toString()).toBe(mockUser._id.toString());
        });

        it('likeBook should toggle likes', async () => {
            const book = await Book.create({ title: 'Like Test', authorId: mockUser._id, stats: { likes: 0 }, likedBy: [] });
            
            // Like
            const res = await bookResolvers.Mutation.likeBook(null, { bookId: book._id }, context);
            expect(res.stats.likes).toBe(1);
        });
    });

    // --- FIELD RESOLVERS (KRİTİK: Index.js'den buraya taşınanlar) ---
    describe('FIELD RESOLVERS', () => {
        it('should resolve comments for a book', async () => {
            const book = await Book.create({ title: 'Commented Book', authorId: mockUser._id });
            // Yorum oluştur (Book modelindeki array'e eklemeye gerek yok, resolver DB'den çeker)
            await Comment.create({ bookId: book._id, userId: mockUser._id, content: 'Nice' });
            await Comment.create({ bookId: book._id, userId: mockUser._id, content: 'Bad' });

            // Resolver'ı çağır: Book.comments(parentBook)
            const res = await bookResolvers.Book.comments(book, {}, { Comment });
            expect(res).toHaveLength(2);
        });

        it('should resolve commentCount', async () => {
            const book = await Book.create({ title: 'Count Book', authorId: mockUser._id });
            await Comment.create({ bookId: book._id, userId: mockUser._id, content: '1' });
            
            const res = await bookResolvers.Book.commentCount(book, {}, { Comment });
            expect(res).toBe(1);
        });

        it('should resolve chapters', async () => {
            const book = await Book.create({ title: 'Chapter Book', authorId: mockUser._id });
            await Chapter.create({ bookId: book._id, title: 'Ch1', authorId: mockUser._id });

            const res = await bookResolvers.Book.chapters(book, {}, { Chapter });
            expect(res).toHaveLength(1);
            expect(res[0].title).toBe('Ch1');
        });
    });
});