import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama ---
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
const { authenticateUser } = await import('../../src/utils/auth.js');

// Comment Mutation dosyasını import ediyoruz
// NOT: Dosya yolunun 'src/GraphQL/Resolvers/Mutations/Comment.js' olduğunu varsayıyorum.
const commentMutationsModule = await import('../../src/GraphQL/Resolvers/Mutations/Comment.js');
// Dosya 'export const commentMutations = { ... }' şeklinde olduğu için named export alıyoruz:
const commentMutations = commentMutationsModule.commentMutations; 

// Statik Importlar
import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Comment from '../../src/models/comment.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Comment Mutations', () => {
    
    let mockUser;
    let mockBook;
    let context;

    beforeEach(async () => {
        // 1. Kullanıcı Oluştur
        mockUser = await User.create({
            username: 'commentUser',
            fullName: 'Comment Tester',
            email: 'comment@test.com',
            password: '123',
            role: 'USER'
        });

        // 2. Kitap Oluştur
        mockBook = await Book.create({
            title: 'Comment Book',
            genre: 'Test',
            authorId: mockUser._id,
            comments: []
        });

        // 3. Context
        context = {
            Book,
            User,
            Comment,
            req: { headers: { authorization: 'Bearer fake_token' } }
        };

        // 4. Auth Mock
        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. CREATE COMMENT TESTLERİ
    // ---------------------------------------------------------
    describe('createComment', () => {
        it('should create a comment and add it to the book', async () => {
            const args = {
                bookId: mockBook._id,
                content: 'This is a great book!'
            };

            const res = await commentMutations.createComment(null, args, context);

            // A. Yorum oluştu mu?
            expect(res.content).toBe(args.content);
            expect(res.bookId.toString()).toBe(mockBook._id.toString());
            expect(res.userId.toString()).toBe(mockUser._id.toString());

            // B. Kitaba eklendi mi?
            const updatedBook = await Book.findById(mockBook._id);
            expect(updatedBook.comments).toContainEqual(res._id);
        });

        it('should fail if fields are missing', async () => {
            const args = { bookId: mockBook._id }; // Content eksik

            await expect(commentMutations.createComment(null, args, context))
                .rejects
                .toThrow("Missing fields");
        });
    });

    // ---------------------------------------------------------
    // 2. DELETE COMMENT TESTLERİ (Karmaşık Mantık)
    // ---------------------------------------------------------
    describe('deleteComment', () => {
        it('should delete a comment and remove it from book', async () => {
            // Yorum oluştur
            const comment = await Comment.create({
                userId: mockUser._id,
                bookId: mockBook._id,
                content: 'To delete',
                date: new Date().toISOString()
            });

            // Kitaba ekle
            mockBook.comments.push(comment._id);
            await mockBook.save();

            const res = await commentMutations.deleteComment(null, { id: comment._id }, context);

            expect(res.message).toContain("deleted successfully");

            // Yorum silindi mi?
            const deletedComment = await Comment.findById(comment._id);
            expect(deletedComment).toBeNull();

            // Kitaptan silindi mi?
            const updatedBook = await Book.findById(mockBook._id);
            const isCommentInBook = updatedBook.comments.some(id => id.toString() === comment._id.toString());
            expect(isCommentInBook).toBe(false);
        });

        it('should delete nested replies when parent is deleted', async () => {
            // 1. Ana Yorum
            const parentComment = await Comment.create({
                userId: mockUser._id,
                bookId: mockBook._id,
                content: 'Parent',
                replies: []
            });

            // 2. Yanıt (Reply)
            const replyComment = await Comment.create({
                userId: mockUser._id,
                bookId: mockBook._id,
                content: 'Reply',
                parentId: parentComment._id
            });

            // Ana yoruma yanıtı bağla
            parentComment.replies.push(replyComment._id);
            await parentComment.save();

            // SİLME İŞLEMİ (Ana yorumu siliyoruz)
            await commentMutations.deleteComment(null, { id: parentComment._id }, context);

            // KONTROL: Yanıt da silinmiş olmalı
            const deletedReply = await Comment.findById(replyComment._id);
            expect(deletedReply).toBeNull();
        });

        it('should fail if user is not authorized', async () => {
            const comment = await Comment.create({
                userId: mockUser._id,
                bookId: mockBook._id,
                content: 'Test'
            });

            // Başka kullanıcı
            const otherUser = await User.create({ username: 'other', fullName: 'Other', email: 'o@t.com', password: '123' });
            authenticateUser.mockResolvedValue(otherUser);

            await expect(commentMutations.deleteComment(null, { id: comment._id }, context))
                .rejects
                .toThrow("Action not allowed");
        });
    });

    // ---------------------------------------------------------
    // 3. TOGGLE LIKE TESTLERİ
    // ---------------------------------------------------------
    describe('toggleCommentLike', () => {
        it('should toggle like status', async () => {
            const comment = await Comment.create({
                userId: mockUser._id,
                bookId: mockBook._id,
                content: 'Like me',
                likedBy: []
            });

            // 1. Like
            const resLike = await commentMutations.toggleCommentLike(null, { commentId: comment._id }, context);
            expect(resLike.likedBy.map(id => id.toString())).toContain(mockUser._id.toString());

            // 2. Unlike
            const resUnlike = await commentMutations.toggleCommentLike(null, { commentId: comment._id }, context);
            expect(resUnlike.likedBy.map(id => id.toString())).not.toContain(mockUser._id.toString());
        });
    });

    // ---------------------------------------------------------
    // 4. REPLY TO COMMENT TESTLERİ (Populate ve Logic Testi)
    // ---------------------------------------------------------
    describe('replyToComment', () => {
        it('should reply to a root comment', async () => {
            const parentComment = await Comment.create({
                userId: mockUser._id,
                bookId: mockBook._id,
                content: 'Root Comment',
                replies: []
            });

            const args = {
                bookId: mockBook._id,
                content: 'This is a reply',
                parentCommentId: parentComment._id
            };

            const res = await commentMutations.replyToComment(null, args, context);

            // A. Yanıt oluştu mu?
            expect(res.content).toBe('This is a reply');
            expect(res.parentId.toString()).toBe(parentComment._id.toString());

            // B. Ana yoruma eklendi mi?
            const updatedParent = await Comment.findById(parentComment._id);
            expect(updatedParent.replies).toContainEqual(res._id);
        });

        it('should handle nested replies (replying to a reply)', async () => {
            // Senaryo: User1 yorum attı -> User2 ona cevap verdi -> User1, User2'ye cevap veriyor.
            
            // 1. Ana Yorum
            const rootComment = await Comment.create({
                userId: mockUser._id,
                bookId: mockBook._id,
                content: 'Root',
                replies: []
            });

            // 2. İlk Yanıt (Root'a bağlı)
            // populate('userId') çalışması için veritabanında gerçek bir kullanıcıya bağlı olması şart.
            const otherUser = await User.create({ username: 'replier', fullName: 'Replier', email: 'r@t.com', password: '123' });
            
            const firstReply = await Comment.create({
                userId: otherUser._id,
                bookId: mockBook._id,
                content: 'First Reply',
                parentId: rootComment._id
            });
            
            rootComment.replies.push(firstReply._id);
            await rootComment.save();

            // 3. İkinci Yanıt (İlk Yanıta cevap veriyoruz)
            const args = {
                bookId: mockBook._id,
                content: 'Thanks for replying',
                parentCommentId: firstReply._id // Hedef olarak yanıtı veriyoruz
            };

            const res = await commentMutations.replyToComment(null, args, context);

            // A. parentId ROOT olmalı (Zincirleme mantığı)
            expect(res.parentId.toString()).toBe(rootComment._id.toString());

            // B. İçerikte @username olmalı
            expect(res.content).toContain(`@${otherUser.username}`);
            expect(res.content).toContain('Thanks for replying');

            // C. Root yorumun replies dizisine eklenmeli (FirstReply'ın değil!)
            const updatedRoot = await Comment.findById(rootComment._id);
            expect(updatedRoot.replies).toContainEqual(res._id);
        });
    });

});