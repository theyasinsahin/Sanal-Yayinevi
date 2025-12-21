import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama ---
// Her ne kadar bu query dosyasında auth fonksiyonu kullanılmasa da
// dosyanın import kısmında auth.js çağrıldığı için mocklamak zorundayız.
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
const { authenticateUser } = await import('../../src/utils/auth.js');

// Comment Query dosyasını import ediyoruz
// NOT: Dosya yolunun 'src/GraphQL/Resolvers/Queries/Comment.js' olduğunu varsayıyorum.
const commentQueriesModule = await import('../../src/GraphQL/Resolvers/Queries/Comment.js');
// Named export olduğu için .commentQueries olarak alıyoruz
const commentQueries = commentQueriesModule.commentQueries;

// Statik Importlar
import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Comment from '../../src/models/comment.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Comment Queries', () => {
    
    let context;
    let mockUser;
    let mockBook;

    beforeEach(async () => {
        // 1. Kullanıcı Oluştur (fullName eklemeyi unutmuyoruz!)
        mockUser = await User.create({
            username: 'commQuery',
            fullName: 'Comment Query Tester',
            email: 'cq@test.com',
            password: '123',
            role: 'USER'
        });

        // 2. Kitap Oluştur
        mockBook = await Book.create({
            title: 'Comment Test Book',
            genre: 'Test',
            authorId: mockUser._id
        });

        // 3. Context Hazırla
        context = {
            Comment,
            // populate işlemi veritabanı seviyesinde olduğu için context'te User olması şart değil 
            // ama yine de standart yapıyı koruyalım.
            User, 
            req: { headers: {} }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. GET COMMENTS BY BOOK ID
    // ---------------------------------------------------------
    describe('getCommentsByBookId', () => {
        it('should return comments for a specific book with populated user', async () => {
            // A. MockBook için 2 yorum oluştur
            await Comment.create({ userId: mockUser._id, bookId: mockBook._id, content: 'Comment 1' });
            await Comment.create({ userId: mockUser._id, bookId: mockBook._id, content: 'Comment 2' });

            // B. Başka bir kitap için 1 yorum oluştur (Bu gelmemeli)
            const otherBook = await Book.create({ title: 'Other', authorId: mockUser._id });
            await Comment.create({ userId: mockUser._id, bookId: otherBook._id, content: 'Other Comment' });

            const res = await commentQueries.getCommentsByBookId(null, { bookId: mockBook._id }, context);

            // Kontroller
            expect(res).toHaveLength(2);
            expect(res[0].content).toBeDefined();
            
            // Populate Kontrolü: userId alanı obje olmalı ve içinde username barındırmalı
            expect(res[0].userId._id.toString()).toBe(mockUser._id.toString());
            expect(res[0].userId.username).toBe('commQuery');
        });
    });

    // ---------------------------------------------------------
    // 2. GET COMMENT BY ID
    // ---------------------------------------------------------
    describe('getCommentById', () => {
        it('should return a single comment by id', async () => {
            const comment = await Comment.create({ 
                userId: mockUser._id, 
                bookId: mockBook._id, 
                content: 'Target Comment' 
            });

            const res = await commentQueries.getCommentById(null, { id: comment._id }, context);

            expect(res).toBeDefined();
            expect(res.content).toBe('Target Comment');
            expect(res.userId.username).toBe('commQuery'); // Populate check
        });

        it('should throw error if comment not found', async () => {
            const fakeId = mockUser._id; // Rastgele ID
            
            await expect(commentQueries.getCommentById(null, { id: fakeId }, context))
                .rejects
                .toThrow("Comment not found");
        });
    });

    // ---------------------------------------------------------
    // 3. GET COMMENTS BY USER ID
    // ---------------------------------------------------------
    describe('getCommentsByUserId', () => {
        it('should return comments made by a specific user', async () => {
            // İkinci bir kullanıcı oluştur
            const otherUser = await User.create({ 
                username: 'other', 
                fullName: 'Other User', 
                email: 'o@t.com', 
                password: '123' 
            });

            // MockUser için 1 yorum
            await Comment.create({ userId: mockUser._id, bookId: mockBook._id, content: 'My Comment' });
            
            // OtherUser için 1 yorum
            await Comment.create({ userId: otherUser._id, bookId: mockBook._id, content: 'Their Comment' });

            const res = await commentQueries.getCommentsByUserId(null, { userId: mockUser._id }, context);

            expect(res).toHaveLength(1);
            expect(res[0].content).toBe('My Comment');
            expect(res[0].userId.username).toBe('commQuery');
        });
    });

    // ---------------------------------------------------------
    // 4. GET ALL COMMENTS
    // ---------------------------------------------------------
    describe('getAllComments', () => {
        it('should return all comments in the database', async () => {
            await Comment.create({ userId: mockUser._id, bookId: mockBook._id, content: 'C1' });
            await Comment.create({ userId: mockUser._id, bookId: mockBook._id, content: 'C2' });
            await Comment.create({ userId: mockUser._id, bookId: mockBook._id, content: 'C3' });

            const res = await commentQueries.getAllComments(null, {}, context);

            expect(res).toHaveLength(3);
            expect(res[0].userId.username).toBeDefined(); // Populate kontrolü
        });
    });

});