import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama ---
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
const { authenticateUser } = await import('../../src/utils/auth.js');

// Chapter Query dosyasını import ediyoruz
const chapterQueriesModule = await import('../../src/GraphQL/Resolvers/Queries/Chapter.js');
const chapterQueries = chapterQueriesModule.default;

// Statik Importlar
import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';
import Chapter from '../../src/models/chapter.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Chapter Queries', () => {
    
    let context;
    let mockUser;
    let mockBook;

    beforeEach(async () => {
        // 1. Kullanıcı Oluştur
        mockUser = await User.create({
            username: 'chapquery',
            fullName: 'Chapter Query Tester',
            email: 'cq@test.com',
            password: '123',
            role: 'USER'
        });

        // 2. Kitap Oluştur
        mockBook = await Book.create({
            title: 'Test Book',
            genre: 'Test',
            authorId: mockUser._id
        });

        // 3. Context Hazırla
        context = {
            Chapter,
            Book, 
            User, 
            req: { headers: {} }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. GET ALL CHAPTERS
    // ---------------------------------------------------------
    describe('getAllChapters', () => {
        it('should return all chapters with populated author', async () => {
            await Chapter.create({ 
                title: 'Ch 1', 
                bookId: mockBook._id, 
                authorId: mockUser._id,
                content: '...' 
            });
            await Chapter.create({ 
                title: 'Ch 2', 
                bookId: mockBook._id, 
                authorId: mockUser._id,
                content: '...' 
            });

            const res = await chapterQueries.getAllChapters(null, {}, context);

            expect(res).toHaveLength(2);
            expect(res[0].title).toBeDefined();
            
            // Populate Kontrolü
            expect(res[0].authorId._id.toString()).toBe(mockUser._id.toString());
            expect(res[0].authorId.username).toBe('chapquery');
        });
    });

    // ---------------------------------------------------------
    // 2. GET CHAPTER BY ID
    // ---------------------------------------------------------
    describe('getChapterById', () => {
        it('should return correct chapter by id', async () => {
            const chapter = await Chapter.create({ 
                title: 'Target Chapter', 
                bookId: mockBook._id, 
                authorId: mockUser._id,
                content: 'Content' 
            });

            const res = await chapterQueries.getChapterById(null, { id: chapter._id }, context);

            expect(res).toBeDefined();
            expect(res.title).toBe('Target Chapter');
            expect(res.authorId.username).toBe('chapquery'); 
        });

        it('should throw error if chapter not found', async () => {
            const fakeId = mockUser._id; 
            
            await expect(chapterQueries.getChapterById(null, { id: fakeId }, context))
                .rejects
                .toThrow("Chapter not found");
        });
    });

    // ---------------------------------------------------------
    // 3. GET CHAPTERS BY BOOK ID
    // ---------------------------------------------------------
    describe('getChaptersByBookId', () => {
        it('should return only chapters belonging to specific book', async () => {
            const otherBook = await Book.create({ title: 'Other Book', authorId: mockUser._id });

            await Chapter.create({ title: 'MB Ch1', bookId: mockBook._id, authorId: mockUser._id });
            await Chapter.create({ title: 'MB Ch2', bookId: mockBook._id, authorId: mockUser._id });
            await Chapter.create({ title: 'OB Ch1', bookId: otherBook._id, authorId: mockUser._id });

            const res = await chapterQueries.getChaptersByBookId(null, { bookId: mockBook._id }, context);

            expect(res).toHaveLength(2);
            res.forEach(ch => {
                expect(ch.bookId.toString()).toBe(mockBook._id.toString());
            });
        });
    });

    // ---------------------------------------------------------
    // 4. GET CHAPTERS BY AUTHOR ID
    // ---------------------------------------------------------
    describe('getChaptersByAuthorId', () => {
        it('should return chapters written by specific author', async () => {
            // --- DÜZELTME BURADA: fullName eklendi ---
            const otherUser = await User.create({ 
                username: 'other', 
                fullName: 'Other User', // <-- EKSİK OLAN KISIM BURASIYDI
                email: 'o@t.com', 
                password: '123' 
            });

            // MockUser için 1 bölüm
            await Chapter.create({ title: 'User Ch', bookId: mockBook._id, authorId: mockUser._id });
            
            // OtherUser için 1 bölüm
            await Chapter.create({ title: 'Other Ch', bookId: mockBook._id, authorId: otherUser._id });

            const res = await chapterQueries.getChaptersByAuthorId(null, { authorId: mockUser._id }, context);

            expect(res).toHaveLength(1);
            expect(res[0].title).toBe('User Ch');
            expect(res[0].authorId.username).toBe('chapquery');
        });
    });

});