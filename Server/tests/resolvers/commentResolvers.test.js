import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

const { authenticateUser } = await import('../../src/utils/auth.js');
const commentResolversModule = await import('../../src/graphql/resolvers/comment.js');
const commentResolvers = commentResolversModule.default; // { Query, Mutation, Comment }

import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Comment from '../../src/models/comment.js';

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Comment Resolvers', () => {
    let context, mockUser, mockBook;

    beforeEach(async () => {
        mockUser = await User.create({ username: 'commUser', fullName: 'Co', email: 'co@t.com', password: '123' });
        mockBook = await Book.create({ title: 'Book', authorId: mockUser._id });
        
        context = { Comment, Book, User, req: { headers: { authorization: 'Bearer token' } } };
        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => jest.clearAllMocks());

    describe('QUERIES', () => {
        it('getCommentsByBookId should return comments', async () => {
            await Comment.create({ bookId: mockBook._id, userId: mockUser._id, content: 'C1' });
            const res = await commentResolvers.Query.getCommentsByBookId(null, { bookId: mockBook._id }, context);
            expect(res).toHaveLength(1);
        });
    });

    describe('MUTATIONS', () => {
        it('createComment should create comment', async () => {
            const res = await commentResolvers.Mutation.createComment(null, { bookId: mockBook._id, content: 'Hi' }, context);
            expect(res.content).toBe('Hi');
            expect(res.userId.toString()).toBe(mockUser._id.toString());
        });

        it('replyToComment should handle nested logic', async () => {
            // Ana Yorum
            const parent = await Comment.create({ bookId: mockBook._id, userId: mockUser._id, content: 'Root' });
            // Yanıt
            const res = await commentResolvers.Mutation.replyToComment(null, { bookId: mockBook._id, content: 'Reply', parentCommentId: parent._id }, context);
            
            expect(res.parentId.toString()).toBe(parent._id.toString());
            
            const updatedParent = await Comment.findById(parent._id);
            expect(updatedParent.replies).toContainEqual(res._id);
        });
    });

    describe('FIELD RESOLVERS', () => {
        it('should resolve userId (User Object) for a comment', async () => {
            // Resolver: Comment.userId(parentComment)
            // Parent comment veritabanından gelen ham veridir (userId: ObjectId)
            const parentComment = { userId: mockUser._id }; 
            
            const res = await commentResolvers.Comment.userId(parentComment, {}, context);
            expect(res.username).toBe('commUser');
        });
    });
});