import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

const { authenticateUser } = await import('../../src/utils/auth.js');
const chapterResolversModule = await import('../../src/graphql/resolvers/chapter.js');
const chapterResolvers = chapterResolversModule.default; // { Query, Mutation }

import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Chapter from '../../src/models/chapter.js';

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Chapter Resolvers', () => {
    let context, mockUser, mockBook;

    beforeEach(async () => {
        mockUser = await User.create({ username: 'chapUser', fullName: 'C', email: 'c@t.com', password: '123' });
        mockBook = await Book.create({ title: 'Test Book', authorId: mockUser._id, pageCount: 0 });
        
        context = { Chapter, Book, User, req: { headers: { authorization: 'Bearer token' } } };
        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => jest.clearAllMocks());

    describe('QUERIES', () => {
        it('getChaptersByBookId should return chapters', async () => {
            await Chapter.create({ bookId: mockBook._id, title: 'Ch1', authorId: mockUser._id });
            const res = await chapterResolvers.Query.getChaptersByBookId(null, { bookId: mockBook._id }, context);
            expect(res).toHaveLength(1);
        });
    });

    describe('MUTATIONS', () => {
        it('createChapter should add chapter and update book page count', async () => {
            const args = { bookId: mockBook._id, title: 'New Ch', content: '...', pageCount: 20 };
            const res = await chapterResolvers.Mutation.createChapter(null, args, context);

            expect(res.title).toBe('New Ch');
            
            const updatedBook = await Book.findById(mockBook._id);
            expect(updatedBook.pageCount).toBe(20);
            expect(updatedBook.chapters).toContainEqual(res._id);
        });

        it('deleteChapter should remove chapter and reference', async () => {
            const chapter = await Chapter.create({ bookId: mockBook._id, title: 'Del', authorId: mockUser._id });
            mockBook.chapters.push(chapter._id);
            await mockBook.save();

            await chapterResolvers.Mutation.deleteChapter(null, { id: chapter._id }, context);

            const check = await Chapter.findById(chapter._id);
            expect(check).toBeNull();
        });
    });
});