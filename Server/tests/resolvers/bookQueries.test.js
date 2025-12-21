import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama ---
// Queries içinde auth kullanılmasa bile, yapısal bütünlük için ve 
// searchBooks içinde User modeline ihtiyaç duyulduğu için mockluyoruz.
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
const { authenticateUser } = await import('../../src/utils/auth.js');

// Query Resolver dosyasını import ediyoruz. 
// NOT: Dosya yolunun doğru olduğundan emin ol. (Queries/Book.js varsayıldı)
const bookQueriesModule = await import('../../src/GraphQL/Resolvers/Queries/Book.js');
const bookQueries = bookQueriesModule.default;

// Statik Importlar
import { connect, clearDatabase, closeDatabase } from '../db.js';
import Book from '../../src/models/book.js';
import User from '../../src/models/user.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('Book Queries', () => {
    
    let context;
    let mockUser;

    beforeEach(async () => {
        // Test verisi oluştururken kullanmak için bir user
        mockUser = await User.create({
            username: 'queryuser',
            fullName: 'Query Tester',
            email: 'query@test.com',
            password: '123',
            role: 'USER'
        });

        // Context: Resolver'ların ihtiyaç duyduğu modeller
        context = {
            Book,
            User,
            req: { headers: {} } // Querylerde auth header şart değil ama boş obje dursun
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. GET ALL BOOKS
    // ---------------------------------------------------------
    describe('getAllBooks', () => {
        it('should return all books', async () => {
            // 3 tane kitap oluşturuyoruz
            await Book.create([
                { title: 'Book 1', authorId: mockUser._id, fullName: 'Tester' },
                { title: 'Book 2', authorId: mockUser._id, fullName: 'Tester' },
                { title: 'Book 3', authorId: mockUser._id, fullName: 'Tester' }
            ]);

            const res = await bookQueries.getAllBooks(null, {}, context);

            expect(res).toHaveLength(3);
            expect(res[0].title).toBeDefined();
        });
    });

    // ---------------------------------------------------------
    // 2. GET BOOK BY ID
    // ---------------------------------------------------------
    describe('getBookById', () => {
        it('should return the correct book by id', async () => {
            const book = await Book.create({
                title: 'Target Book',
                authorId: mockUser._id
            });

            const res = await bookQueries.getBookById(null, { id: book._id }, context);

            expect(res).toBeDefined();
            expect(res.title).toBe('Target Book');
            expect(res._id.toString()).toBe(book._id.toString());
        });

        it('should return null if book not found', async () => {
            // Rastgele bir ID (mongoose valid ID formatında ama db'de yok)
            const fakeId = mockUser._id; // User ID'si Book tablosunda olmaz
            const res = await bookQueries.getBookById(null, { id: fakeId }, context);
            
            expect(res).toBeNull();
        });
    });

    // ---------------------------------------------------------
    // 3. GET BOOKS BY AUTHOR ID
    // ---------------------------------------------------------
    describe('getBooksByAuthorId', () => {
        it('should return books belonging to a specific author', async () => {
            // İkinci bir yazar oluştur
            const otherUser = await User.create({
                username: 'other', 
                fullName: 'Other', 
                email: 'other@test.com', 
                password: '123' 
            });

            // MockUser için 2 kitap, OtherUser için 1 kitap oluştur
            await Book.create({ title: 'User Book 1', authorId: mockUser._id });
            await Book.create({ title: 'User Book 2', authorId: mockUser._id });
            await Book.create({ title: 'Other Book', authorId: otherUser._id });

            // Sadece mockUser'ın kitaplarını iste
            const res = await bookQueries.getBooksByAuthorId(null, { authorId: mockUser._id }, context);

            expect(res).toHaveLength(2);
            res.forEach(book => {
                expect(book.authorId.toString()).toBe(mockUser._id.toString());
            });
        });
    });

    // ---------------------------------------------------------
    // 4. GET BOOKS BY GENRE
    // ---------------------------------------------------------
    describe('getBooksByGenre', () => {
        it('should return books filtered by genre', async () => {
            await Book.create({ title: 'Fantasy 1', genre: 'Fantasy', authorId: mockUser._id });
            await Book.create({ title: 'Sci-Fi 1', genre: 'Sci-Fi', authorId: mockUser._id });
            await Book.create({ title: 'Fantasy 2', genre: 'Fantasy', authorId: mockUser._id });

            const res = await bookQueries.getBooksByGenre(null, { genre: 'Fantasy' }, context);

            expect(res).toHaveLength(2);
            expect(res[0].genre).toBe('Fantasy');
            expect(res[1].genre).toBe('Fantasy');
        });
    });

    // ---------------------------------------------------------
    // 5. GET BOOK BY TITLE
    // ---------------------------------------------------------
    describe('getBookByTitle', () => {
        it('should return a single book by exact title', async () => {
            await Book.create({ title: 'Unique Title', authorId: mockUser._id });
            await Book.create({ title: 'Another Title', authorId: mockUser._id });

            const res = await bookQueries.getBookByTitle(null, { title: 'Unique Title' }, context);

            expect(res).toBeDefined();
            expect(res.title).toBe('Unique Title');
        });
    });

    // ---------------------------------------------------------
    // 6. SEARCH BOOKS (En Kapsamlı Test)
    // ---------------------------------------------------------
    describe('searchBooks', () => {
        it('should search books by title, description OR author fullName', async () => {
            // SENARYO HAZIRLIĞI:
            
            // 1. Yazar İsmine Göre Arama İçin: İsmi "Orhan Pamuk" olan bir yazar
            const famousAuthor = await User.create({
                username: 'orhan',
                fullName: 'Orhan Pamuk',
                email: 'orhan@test.com',
                password: '123'
            });

            // Kitaplar Oluşturuyoruz:
            // A. Başlığında "Harry" geçen kitap
            await Book.create({ 
                title: 'Harry Potter', 
                description: 'Magic school', 
                authorId: mockUser._id 
            });

            // B. Açıklamasında "Detective" geçen kitap
            await Book.create({ 
                title: 'Sherlock Holmes', 
                description: 'Best Detective story', 
                authorId: mockUser._id 
            });

            // C. Yazarı "Orhan Pamuk" olan kitap (Başlık/Açıklama alakasız)
            await Book.create({ 
                title: 'Masumiyet Müzesi', 
                description: 'Ask romani', 
                authorId: famousAuthor._id 
            });

            // TEST 1: Başlık Araması ("Harry")
            const searchTitle = await bookQueries.searchBooks(null, { query: 'Harry' }, context);
            expect(searchTitle).toHaveLength(1);
            expect(searchTitle[0].title).toBe('Harry Potter');

            // TEST 2: Açıklama Araması ("Detective")
            const searchDesc = await bookQueries.searchBooks(null, { query: 'Detective' }, context);
            expect(searchDesc).toHaveLength(1);
            expect(searchDesc[0].title).toBe('Sherlock Holmes');

            // TEST 3: Yazar İsmi Araması ("Pamuk")
            // Resolver içinde User.find çalışıp authorId'leri bulup Book'ta arayacak
            const searchAuthor = await bookQueries.searchBooks(null, { query: 'Pamuk' }, context);
            expect(searchAuthor).toHaveLength(1);
            expect(searchAuthor[0].title).toBe('Masumiyet Müzesi');
        });

        it('should return empty array if no match found', async () => {
            await Book.create({ title: 'Test', authorId: mockUser._id });
            
            const res = await bookQueries.searchBooks(null, { query: 'NonExistentXYZ' }, context);
            
            expect(res).toHaveLength(0);
        });
    });

});