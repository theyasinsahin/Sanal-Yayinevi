import { jest } from '@jest/globals';

// --- ADIM 1: Mock Tanımlama ---

// 1. Auth Mock
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

// 2. Bcrypt Mock (Şifreleme işlemleri testleri yavaşlatmasın diye)
jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        hash: jest.fn().mockResolvedValue('hashed_password_123'),
        compare: jest.fn().mockResolvedValue(true) // Her zaman şifre doğruymuş gibi davran
    }
}));

// 3. JWT Mock (Token üretimi)
jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        sign: jest.fn().mockReturnValue('fake_jwt_token')
    }
}));

// --- ADIM 2: Modülleri Dinamik Olarak Çağırma ---
const { authenticateUser } = await import('../../src/utils/auth.js');
const bcrypt = (await import('bcryptjs')).default;
const jwt = (await import('jsonwebtoken')).default;

// User Mutation dosyasını import ediyoruz
const userMutationsModule = await import('../../src/GraphQL/Resolvers/Mutations/User.js');
const userMutations = userMutationsModule.default;

// Statik Importlar
import { connect, clearDatabase, closeDatabase } from '../db.js';
import User from '../../src/models/user.js';
import Book from '../../src/models/book.js';
import Comment from '../../src/models/comment.js';
import Chapter from '../../src/models/chapter.js';

// --- Test Kurulumları ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('User Mutations', () => {
    
    let context;
    let mockUser;

    beforeEach(async () => {
        // Testlerde kullanmak üzere standart bir kullanıcı
        mockUser = await User.create({
            username: 'mainUser',
            fullName: 'Main User',
            email: 'main@test.com',
            password: 'hashed_password_123',
            usersBooks: [],
            savedBooks: [],
            following: [],
            followers: []
        });

        // Context Hazırla (Resolver'ların ihtiyaç duyduğu modeller)
        context = {
            User,
            Book,
            Comment,
            Chapter,
            req: { headers: { authorization: 'Bearer fake_token' } }
        };

        // Auth her zaman bu kullanıcıyı döndürsün (Giriş yapılmış gibi)
        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ---------------------------------------------------------
    // 1. REGISTER TESTLERİ
    // ---------------------------------------------------------
    describe('register', () => {
        it('should register a new user successfully', async () => {
            const args = {
                username: 'newuser',
                fullName: 'New User',
                email: 'new@test.com',
                password: 'password123'
            };

            const res = await userMutations.register(null, args, context);

            // Return değerini kontrol et
            expect(res.code).toBe(200);
            expect(res.message).toBe('User registered successfully');

            // Veritabanını kontrol et
            const dbUser = await User.findOne({ email: 'new@test.com' });
            expect(dbUser).toBeDefined();
            expect(dbUser.password).toBe('hashed_password_123'); // Mocklanan bcrypt değeri
        });

        it('should return error if email already exists', async () => {
            const args = {
                username: 'other',
                fullName: 'Other',
                email: 'main@test.com', // Zaten var olan email
                password: '123'
            };

            const res = await userMutations.register(null, args, context);

            expect(res.code).toBe(400);
            expect(res.message).toBe('User already exists with this email');
        });

        it('should return error if username already exists', async () => {
            const args = {
                username: 'mainUser', // Zaten var olan username
                fullName: 'Other',
                email: 'other@test.com',
                password: '123'
            };

            const res = await userMutations.register(null, args, context);

            expect(res.code).toBe(400);
            expect(res.message).toBe('User already exists with this username');
        });
    });

    // ---------------------------------------------------------
    // 2. LOGIN TESTLERİ
    // ---------------------------------------------------------
    describe('login', () => {
        it('should login successfully with correct credentials', async () => {
            // bcrypt.compare mock'u her zaman true dönüyor
            const args = { email: 'main@test.com', password: 'password123' };

            const res = await userMutations.login(null, args, context);

            expect(res.token).toBe('fake_jwt_token');
            expect(res.user.email).toBe('main@test.com');
            expect(jwt.sign).toHaveBeenCalled(); // Token üretildi mi?
        });

        it('should throw error if user not found', async () => {
            const args = { email: 'wrong@test.com', password: '123' };

            await expect(userMutations.login(null, args, context))
                .rejects
                .toThrow("User not found");
        });

        it('should throw error if password is invalid', async () => {
            // bcrypt.compare'in false dönmesini sağla
            bcrypt.compare.mockResolvedValueOnce(false);

            const args = { email: 'main@test.com', password: 'wrongpassword' };

            await expect(userMutations.login(null, args, context))
                .rejects
                .toThrow("Invalid credentials");
        });
    });

    // ---------------------------------------------------------
    // 3. DELETE USER BY ID TESTLERİ (Cascade Delete)
    // ---------------------------------------------------------
    describe('deleteUserById', () => {
        it('should delete user and all associated data (books, comments, chapters, follows)', async () => {
            // A. Veri Hazırlığı
            // 1. Silinecek Kullanıcı (targetUser)
            const targetUser = await User.create({
                username: 'target',
                fullName: 'Target',
                email: 'target@test.com',
                password: '123',
                usersBooks: [],
                followers: [],
                following: []
            });

            // 2. TargetUser'a ait Kitap
            const book = await Book.create({ title: 'T Book', authorId: targetUser._id, comments: [], chapters: [] });
            targetUser.usersBooks.push(book._id);

            // 3. Kitaba ait Bölüm ve Yorum
            const chapter = await Chapter.create({ title: 'Ch1', bookId: book._id, authorId: targetUser._id });
            const comment = await Comment.create({ content: 'Cm1', bookId: book._id, userId: targetUser._id });
            
            book.chapters.push(chapter._id);
            book.comments.push(comment._id);
            await book.save();

            // 4. Takipçi ilişkisi (MockUser, TargetUser'ı takip ediyor)
            mockUser.following.push(targetUser._id);
            await mockUser.save();
            targetUser.followers.push(mockUser._id);
            await targetUser.save();

            // B. SİLME İŞLEMİ
            const res = await userMutations.deleteUserById(null, { id: targetUser._id }, context);

            expect(res.code).toBe(200);

            // C. KONTROLLER
            // Kullanıcı silindi mi?
            expect(await User.findById(targetUser._id)).toBeNull();

            // Kitap silindi mi?
            expect(await Book.findById(book._id)).toBeNull();

            // Bölüm silindi mi?
            expect(await Chapter.findById(chapter._id)).toBeNull();

            // Yorum silindi mi?
            expect(await Comment.findById(comment._id)).toBeNull();

            // MockUser'ın following listesinden silindi mi?
            const updatedMockUser = await User.findById(mockUser._id);
            expect(updatedMockUser.following).not.toContainEqual(targetUser._id);
        });
    });

    // ---------------------------------------------------------
    // 4. TOGGLE FOLLOW USER TESTLERİ
    // ---------------------------------------------------------
    describe('toggleFollowUser', () => {
        it('should follow a user if not already following', async () => {
            const targetUser = await User.create({ username: 'target', fullName: 'T', email: 't@t.com', password: '123' });

            // Takip Et
            const res = await userMutations.toggleFollowUser(null, { followId: targetUser._id }, context);

            expect(res.message).toBe("User followed successfully");

            // MockUser'ın following listesi
            const updatedMe = await User.findById(mockUser._id);
            expect(updatedMe.following).toContainEqual(targetUser._id);

            // TargetUser'ın followers listesi
            const updatedTarget = await User.findById(targetUser._id);
            expect(updatedTarget.followers).toContainEqual(mockUser._id);
        });

        it('should unfollow a user if already following', async () => {
            const targetUser = await User.create({ username: 'target', fullName: 'T', email: 't@t.com', password: '123' });
            
            // Manuel olarak takip ettir
            mockUser.following.push(targetUser._id);
            await mockUser.save();
            targetUser.followers.push(mockUser._id);
            await targetUser.save();

            // Takipten Çık
            const res = await userMutations.toggleFollowUser(null, { followId: targetUser._id }, context);

            expect(res.message).toBe("User unfollowed successfully");

            const updatedMe = await User.findById(mockUser._id);
            expect(updatedMe.following).not.toContainEqual(targetUser._id);
        });

        it('should fail if trying to follow self', async () => {
            await expect(userMutations.toggleFollowUser(null, { followId: mockUser._id }, context))
                .rejects
                .toThrow("You cannot follow yourself");
        });
    });

    // ---------------------------------------------------------
    // 5. UPDATE PROFILE TESTLERİ
    // ---------------------------------------------------------
    describe('updateProfile', () => {
        it('should update user profile fields', async () => {
            const args = {
                fullName: 'Updated Name',
                bio: 'New Bio'
            };

            const res = await userMutations.updateProfile(null, args, context);

            expect(res.fullName).toBe('Updated Name');
            expect(res.bio).toBe('New Bio');
            expect(res.username).toBe('mainUser'); // Değişmemeli
        });
    });

    // ---------------------------------------------------------
    // 6. TOGGLE SAVE BOOK TESTLERİ
    // ---------------------------------------------------------
    describe('toggleSaveBook', () => {
        it('should save a book if not saved', async () => {
            const book = await Book.create({ title: 'Test Book', authorId: mockUser._id });

            const res = await userMutations.toggleSaveBook(null, { bookId: book._id }, context);

            // return değeri User objesi
            expect(res.savedBooks).toContainEqual(book._id);
        });

        it('should unsave a book if already saved', async () => {
            const book = await Book.create({ title: 'Test Book', authorId: mockUser._id });
            
            // Önce kaydet
            mockUser.savedBooks.push(book._id);
            await mockUser.save();

            const res = await userMutations.toggleSaveBook(null, { bookId: book._id }, context);

            expect(res.savedBooks).not.toContainEqual(book._id);
        });
    });

});