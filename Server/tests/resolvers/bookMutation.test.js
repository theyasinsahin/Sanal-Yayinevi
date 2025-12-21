import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama (ESM İçin Özel Yöntem) ---
// Standart jest.mock yerine 'unstable_mockModule' kullanıyoruz.
// Bu, "require is not defined" hatasını çözer.
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
// Mock tanımlandıktan SONRA modülleri 'await import' ile almalıyız.
// Aksi takdirde mock işlemi gerçekleşmeden orijinal dosya yüklenir.

// 1. Mocklanan Auth fonksiyonunu al
const { authenticateUser } = await import('../../src/utils/auth.js');

// 2. Test edeceğimiz Resolver dosyasını al (Default export olduğu için .default ile alıyoruz)
const bookMutationsModule = await import('../../src/GraphQL/Resolvers/Mutations/Book.js');
const bookMutations = bookMutationsModule.default;

// --- Diğer Importlar (Statik kalabilir) ---
import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Comment from '../../src/models/comment.js';
import Chapter from '../../src/models/chapter.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Book Resolvers', () => {
    
    let mockUser;
    let context;

    beforeEach(async () => {
        // Kullanıcı oluştur
        mockUser = await User.create({
            username: 'testuser',
            fullName: 'Test Kullanıcısı', 
            email: 'test@test.com',
            password: 'hashedpassword',
            role: 'USER',
            usersBooks: [],
            savedBooks: []
        });

        context = {
            Book,
            User,
            Comment,
            Chapter,
            req: { headers: { authorization: 'Bearer fake_token' } }
        };

        // Mock davranışını ayarla
        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. CREATE BOOK TESTLERİ
    // ---------------------------------------------------------
    describe('createBook', () => {
        it('should create a book successfully', async () => {
            const args = {
                title: 'My New Book',
                genre: 'Fantasy',
                description: 'A great story',
                tags: ['magic'],
                imageUrl: 'http://image.com/1.jpg'
            };

            const res = await bookMutations.createBook(null, args, context);

            expect(res.title).toBe(args.title);
            expect(res.authorId.toString()).toBe(mockUser._id.toString());

            const dbBook = await Book.findById(res._id);
            expect(dbBook).toBeDefined();
            expect(dbBook.title).toBe(args.title);

            const updatedUser = await User.findById(mockUser._id);
            const isBookInList = updatedUser.usersBooks.some(id => id.toString() === res._id.toString());
            expect(isBookInList).toBe(true);
        });

        it('should fail if required fields are missing', async () => {
            const args = { genre: 'Fantasy' }; 

            await expect(bookMutations.createBook(null, args, context))
                .rejects
                .toThrow("Failed to create book");
        });
    });

    // ---------------------------------------------------------
    // 2. UPDATE BOOK TESTLERİ
    // ---------------------------------------------------------
    describe('updateBook', () => {
        it('should update a book if user is owner', async () => {
            const book = await Book.create({
                title: 'Old Title',
                genre: 'Drama',
                authorId: mockUser._id
            });

            const args = {
                bookId: book._id,
                title: 'New Title'
            };

            const res = await bookMutations.updateBook(null, args, context);

            expect(res.title).toBe('New Title');
            expect(res.genre).toBe('Drama');
        });

        it('should fail if user is not authorized', async () => {
            const otherUser = await User.create({ 
                username: 'other', 
                fullName: 'Diğer Kullanıcı',
                email: 'other@test.com',
                password: '123' 
            });
            
            const book = await Book.create({
                title: 'Others Book',
                authorId: otherUser._id
            });

            const args = { bookId: book._id, title: 'Hacked Title' };

            // Yetkisiz güncelleme denemesi
            await expect(bookMutations.updateBook(null, args, context))
                .rejects
                .toThrow("You are not authorized to update this book");
        });
    });

    // ---------------------------------------------------------
    // 3. DELETE BOOK TESTLERİ
    // ---------------------------------------------------------
    describe('deleteBook', () => {
        it('should delete book and clean up references', async () => {
            const book = await Book.create({
                title: 'Book to Delete',
                authorId: mockUser._id,
                comments: [],
                chapters: []
            });

            const comment = await Comment.create({ content: 'Nice', bookId: book._id, userId: mockUser._id });
            const chapter = await Chapter.create({ title: 'Ch1', bookId: book._id, authorId: mockUser._id });

            book.comments.push(comment._id);
            book.chapters.push(chapter._id);
            await book.save();

            mockUser.usersBooks.push(book._id);
            await mockUser.save();

            const res = await bookMutations.deleteBook(null, { id: book._id }, context);

            expect(res.message).toBe("Book deleted successfully");

            const deletedBook = await Book.findById(book._id);
            expect(deletedBook).toBeNull();

            const deletedComment = await Comment.findById(comment._id);
            expect(deletedComment).toBeNull();

            const deletedChapter = await Chapter.findById(chapter._id);
            expect(deletedChapter).toBeNull();

            const updatedUser = await User.findById(mockUser._id);
            const isBookInList = updatedUser.usersBooks.some(id => id.toString() === book._id.toString());
            expect(isBookInList).toBe(false);
        });

        it('should allow ADMIN to delete any book', async () => {
            const adminUser = await User.create({ 
                username: 'admin', 
                fullName: 'Admin Bey', 
                email: 'admin@test.com', 
                role: 'ADMIN',
                password: '123'
            });
            
            const book = await Book.create({ title: 'User Book', authorId: mockUser._id });

            // Mock'u Admin kullanıcısı dönecek şekilde güncelle
            authenticateUser.mockResolvedValue(adminUser);

            const res = await bookMutations.deleteBook(null, { id: book._id }, context);
            
            expect(res.code).toBe(200);
            const deletedBook = await Book.findById(book._id);
            expect(deletedBook).toBeNull();
        });
    });

    // ---------------------------------------------------------
    // 4. INCREMENT VIEWS TESTLERİ
    // ---------------------------------------------------------
    describe('incrementBookViews', () => {
        it('should increment view count', async () => {
            const book = await Book.create({ title: 'View Test', authorId: mockUser._id, stats: { views: 0 } });

            const res = await bookMutations.incrementBookViews(null, { id: book._id }, context);

            expect(res.stats.views).toBe(1);

            const res2 = await bookMutations.incrementBookViews(null, { id: book._id }, context);
            expect(res2.stats.views).toBe(2);
        });
    });

    // ---------------------------------------------------------
    // 5. LIKE BOOK TESTLERİ
    // ---------------------------------------------------------
    describe('likeBook', () => {
        it('should toggle like status', async () => {
            const book = await Book.create({ 
                title: 'Like Test', 
                authorId: mockUser._id, 
                stats: { likes: 0 },
                likedBy: [] 
            });

            // 1. Like
            const resLike = await bookMutations.likeBook(null, { bookId: book._id }, context);
            
            expect(resLike.stats.likes).toBe(1);
            expect(resLike.likedBy.map(id => id.toString())).toContain(mockUser._id.toString());

            // 2. Unlike
            const resUnlike = await bookMutations.likeBook(null, { bookId: book._id }, context);
            
            expect(resUnlike.stats.likes).toBe(0);
            expect(resUnlike.likedBy.map(id => id.toString())).not.toContain(mockUser._id.toString());
        });
    });

});