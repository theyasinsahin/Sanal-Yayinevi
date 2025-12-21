import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama ---
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
const { authenticateUser } = await import('../../src/utils/auth.js');

// Chapter Mutation dosyasını import ediyoruz
// NOT: Dosya yolunu projendeki gerçek yola göre ayarla
const chapterMutationsModule = await import('../../src/GraphQL/Resolvers/Mutations/Chapter.js');
const chapterMutations = chapterMutationsModule.default;

// Statik Importlar
import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Chapter from '../../src/models/chapter.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Chapter Mutations', () => {
    
    let mockUser;
    let mockBook;
    let context;

    beforeEach(async () => {
        // 1. Kullanıcı Oluştur
        mockUser = await User.create({
            username: 'chapterUser',
            fullName: 'Chapter Tester',
            email: 'chapter@test.com',
            password: '123',
            role: 'USER'
        });

        // 2. Kullanıcıya ait bir Kitap Oluştur
        mockBook = await Book.create({
            title: 'Test Book',
            genre: 'Test',
            authorId: mockUser._id,
            chapters: [],
            pageCount: 0
        });

        // 3. Context Hazırla
        context = {
            Book,
            User,
            Chapter,
            req: { headers: { authorization: 'Bearer fake_token' } }
        };

        // 4. Auth Mockla
        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. CREATE CHAPTER TESTLERİ
    // ---------------------------------------------------------
    describe('createChapter', () => {
        it('should create a chapter and update book page count', async () => {
            const args = {
                bookId: mockBook._id,
                title: 'Chapter 1',
                content: 'Content goes here...',
                pageCount: 15
            };

            const res = await chapterMutations.createChapter(null, args, context);

            // A. Chapter Oluştu mu?
            expect(res.title).toBe(args.title);
            expect(res.bookId.toString()).toBe(mockBook._id.toString());
            expect(res.authorId.toString()).toBe(mockUser._id.toString()); // authorId kontrolü

            // B. Kitap Güncellendi mi? (Chapters Array)
            const updatedBook = await Book.findById(mockBook._id);
            expect(updatedBook.chapters).toContainEqual(res._id);

            // C. Sayfa Sayısı Güncellendi mi? (updateBookTotalPageCount testi)
            expect(updatedBook.pageCount).toBe(15);
        });

        it('should fail if user is not the author of the book', async () => {
            // Başka bir kullanıcı oluştur
            const otherUser = await User.create({
                username: 'other', 
                fullName: 'Other', 
                email: 'other@test.com', 
                password: '123'
            });

            // Auth mockunu değiştir
            authenticateUser.mockResolvedValue(otherUser);

            const args = {
                bookId: mockBook._id,
                title: 'Hacked Chapter',
                pageCount: 10
            };

            await expect(chapterMutations.createChapter(null, args, context))
                .rejects
                .toThrow("Bu kitaba bölüm ekleme yetkiniz yok.");
        });

        it('should fail if book does not exist', async () => {
            // Rastgele (User ID formatında ama kitap olmayan) bir ID
            const fakeId = mockUser._id; 

            const args = {
                bookId: fakeId,
                title: 'Ghost Chapter'
            };

            await expect(chapterMutations.createChapter(null, args, context))
                .rejects
                .toThrow("Kitap bulunamadı.");
        });
    });

    // ---------------------------------------------------------
    // 2. UPDATE CHAPTER TESTLERİ
    // ---------------------------------------------------------
    describe('updateChapter', () => {
        it('should update chapter and recalculate total page count', async () => {
            // Önce bir bölüm oluşturalım (10 sayfa)
            const chapter = await Chapter.create({
                bookId: mockBook._id,
                title: 'Old Title',
                content: 'Old Content',
                pageCount: 10,
                authorId: mockUser._id
            });
            // Kitabı da başlangıç durumuna getirelim (manuel olarak simüle ediyoruz)
            mockBook.chapters.push(chapter._id);
            mockBook.pageCount = 10;
            await mockBook.save();

            // GÜNCELLEME İŞLEMİ (Sayfayı 10'dan 25'e çıkarıyoruz)
            const args = {
                chapterId: chapter._id,
                title: 'New Title',
                pageCount: 25
            };

            const res = await chapterMutations.updateChapter(null, args, context);

            // A. Chapter güncellendi mi?
            expect(res.title).toBe('New Title');
            expect(res.pageCount).toBe(25);

            // B. Kitabın toplam sayfa sayısı güncellendi mi?
            const updatedBook = await Book.findById(mockBook._id);
            expect(updatedBook.pageCount).toBe(25);
        });

        it('should fail if user is not authorized (checked via Book)', async () => {
             // Bölüm oluştur
             const chapter = await Chapter.create({
                bookId: mockBook._id,
                title: 'Test',
                authorId: mockUser._id
            });

            // Başka kullanıcı
            const otherUser = await User.create({ username: 'hacker', fullName: 'Hacker', email: 'h@h.com', password: '123' });
            authenticateUser.mockResolvedValue(otherUser);

            const args = { chapterId: chapter._id, title: 'Hacked' };

            await expect(chapterMutations.updateChapter(null, args, context))
                .rejects
                .toThrow("You are not authorized to update this chapter");
        });
    });

    // ---------------------------------------------------------
    // 3. DELETE CHAPTER TESTLERİ
    // ---------------------------------------------------------
    describe('deleteChapter', () => {
        it('should delete chapter and remove reference from book', async () => {
            const chapter = await Chapter.create({
                bookId: mockBook._id,
                title: 'To Delete',
                authorId: mockUser._id
            });

            mockBook.chapters.push(chapter._id);
            await mockBook.save();

            const res = await chapterMutations.deleteChapter(null, { id: chapter._id }, context);

            expect(res.message).toBe("Chapter deleted successfully");

            // A. Chapter silindi mi?
            const deletedChapter = await Chapter.findById(chapter._id);
            expect(deletedChapter).toBeNull();

            // B. Kitaptan silindi mi?
            const updatedBook = await Book.findById(mockBook._id);
            const isChapterInList = updatedBook.chapters.some(id => id.toString() === chapter._id.toString());
            expect(isChapterInList).toBe(false);
        });

        it('should fail if user is not authorized', async () => {
            const chapter = await Chapter.create({
                bookId: mockBook._id,
                title: 'Test',
                authorId: mockUser._id
            });

            const otherUser = await User.create({ username: 'other2', fullName: 'Other', email: 'o2@t.com', password: '123' });
            authenticateUser.mockResolvedValue(otherUser);

            await expect(chapterMutations.deleteChapter(null, { id: chapter._id }, context))
                .rejects
                .toThrow("You are not authorized to delete this chapter");
        });
    });

});