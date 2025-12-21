import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama ---
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
const { authenticateUser } = await import('../../src/utils/auth.js');

// User Query dosyasını import ediyoruz
const userQueriesModule = await import('../../src/GraphQL/Resolvers/Queries/User.js');
const userQueries = userQueriesModule.default;

// Statik Importlar
import { connect, clearDatabase, closeDatabase } from '../db.js';
import User from '../../src/models/user.js';
import Book from '../../src/models/book.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('User Queries', () => {
    
    let context;
    let mockUser;
    let otherUser;

    beforeEach(async () => {
        // 1. Ana Kullanıcı
        mockUser = await User.create({
            username: 'mainUser',
            fullName: 'Main User',
            email: 'main@test.com',
            password: 'hashedpassword',
            usersBooks: [],
            savedBooks: [],
            following: [],
            followers: []
        });

        // 2. İkinci Kullanıcı
        otherUser = await User.create({
            username: 'otherUser',
            fullName: 'Other User',
            email: 'other@test.com',
            password: 'hashedpassword',
            usersBooks: [],
            savedBooks: [],
            following: [],
            followers: []
        });

        // 3. Context
        context = {
            User,
            req: { headers: { authorization: 'Bearer fake_token' } }
        };

        // Auth Mock
        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. TEMEL KULLANICI SORGULARI
    // ---------------------------------------------------------
    describe('Basic User Getters', () => {
        
        it('getUserById should return user without password', async () => {
            const res = await userQueries.getUserById(null, { id: mockUser._id }, context);
            
            expect(res).toBeDefined();
            expect(res.username).toBe('mainUser');
            expect(res._id.toString()).toBe(mockUser._id.toString());
            expect(res.password).toBeUndefined();
        });

        it('getUserByUsername should return correct user', async () => {
            const res = await userQueries.getUserByUsername(null, { username: 'mainUser' }, context);
            expect(res.email).toBe('main@test.com');
        });

        it('getUserByEmail should return correct user', async () => {
            const res = await userQueries.getUserByEmail(null, { email: 'main@test.com' }, context);
            expect(res.username).toBe('mainUser');
        });

        it('getAllUsers should return all users', async () => {
            const res = await userQueries.getAllUsers(null, {}, context);
            expect(res).toHaveLength(2);
        });
    });

    // ---------------------------------------------------------
    // 2. TAKİP SİSTEMİ SORGULARI
    // ---------------------------------------------------------
    describe('Follow System Queries', () => {
        
        it('getFollowingByUserId should return list of followed user IDs', async () => {
            mockUser.following.push(otherUser._id);
            await mockUser.save();

            const res = await userQueries.getFollowingByUserId(null, { id: mockUser._id }, context);

            expect(res).toHaveLength(1);
            expect(res[0]).toBe(otherUser._id.toString());
        });

        it('getFollowersByUserId should return list of follower IDs', async () => {
            mockUser.followers.push(otherUser._id);
            await mockUser.save();

            const res = await userQueries.getFollowersByUserId(null, { id: mockUser._id }, context);

            expect(res).toHaveLength(1);
            expect(res[0]).toBe(otherUser._id.toString());
        });

        it('should throw error if user not found', async () => {
            const fakeId = otherUser._id; 
            await User.findByIdAndDelete(fakeId);

            await expect(userQueries.getFollowersByUserId(null, { id: fakeId }, context))
                .rejects.toThrow("User not found");
        });
    });

    // ---------------------------------------------------------
    // 3. ME (AUTHENTICATED USER) SORGUSU
    // ---------------------------------------------------------
    describe('me', () => {
        it('should return the authenticated user', async () => {
            const res = await userQueries.me(null, {}, context);
            
            expect(res).toBeDefined();
            expect(res.username).toBe('mainUser');
        });

        it('should throw error if not authenticated', async () => {
            authenticateUser.mockResolvedValue(null);

            await expect(userQueries.me(null, {}, context))
                .rejects.toThrow("User not found");
        });
    });

    // ---------------------------------------------------------
    // 4. POPULATE SORGULARI
    // ---------------------------------------------------------
    describe('Populated Data Queries', () => {
        
        let testBook;

        beforeEach(async () => {
            testBook = await Book.create({
                title: 'Test Book',
                authorId: otherUser._id
            });
        });

        it('getFavouriteBooksByUserId should return populated savedBooks', async () => {
            mockUser.savedBooks.push(testBook._id);
            await mockUser.save();

            const res = await userQueries.getFavouriteBooksByUserId(null, { id: mockUser._id }, context);

            expect(res).toHaveLength(1);
            expect(res[0].title).toBe('Test Book');
        });

        it('getUsersBooksByUserId should return populated usersBooks', async () => {
            // DİKKAT: Alan adı 'usersBooks'
            mockUser.usersBooks.push(testBook._id);
            await mockUser.save();

            const res = await userQueries.getUsersBooksByUserId(null, { id: mockUser._id }, context);

            expect(res).toHaveLength(1);
            expect(res[0].title).toBe('Test Book');
        });

        // NOT: favouriteAuthors alanı modelde olmadığı için hata veriyordu.
        // O testi kaldırdık. Eğer modeline eklersen testi geri getirebilirsin.
    });

});