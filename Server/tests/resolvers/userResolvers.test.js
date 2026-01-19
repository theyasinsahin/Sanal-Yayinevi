import { jest } from '@jest/globals';

// --- MOCKS ---
jest.unstable_mockModule('../../src/utils/auth.js', () => ({
    authenticateUser: jest.fn()
}));

jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        hash: jest.fn().mockResolvedValue('hashed_password_123'),
        compare: jest.fn().mockResolvedValue(true)
    }
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        sign: jest.fn().mockReturnValue('fake_jwt_token')
    }
}));

// --- IMPORTS ---
const { authenticateUser } = await import('../../src/utils/auth.js');
const bcrypt = (await import('bcryptjs')).default;
const jwt = (await import('jsonwebtoken')).default;

// Resolver Import
const userResolversModule = await import('../../src/graphql/resolvers/user.js');
const userResolvers = userResolversModule.default; 

import { connect, clearDatabase, closeDatabase } from '../db.js';
import User from '../../src/models/user.js';
import Book from '../../src/models/book.js';
import Comment from '../../src/models/comment.js';
import Chapter from '../../src/models/chapter.js';
import Transaction from '../../src/models/transaction.js';

// --- SETUP ---
beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe('User Resolvers (Queries & Mutations)', () => {
    
    let context;
    let mockUser;

    beforeEach(async () => {
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

        context = {
            User, Book, Comment, Chapter, Transaction,
            req: { headers: { authorization: 'Bearer fake_token' } }
        };

        authenticateUser.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // =========================================================
    // 1. QUERIES
    // =========================================================
    describe('QUERIES', () => {
        it('getUserById should return user', async () => {
            const res = await userResolvers.Query.getUserById(null, { id: mockUser._id }, context);
            expect(res.username).toBe('mainUser');
        });

        it('me should return authenticated user', async () => {
            const res = await userResolvers.Query.me(null, {}, context);
            expect(res.email).toBe('main@test.com');
        });
    });

    // =========================================================
    // 2. MUTATIONS
    // =========================================================
    describe('MUTATIONS', () => {
        it('register should create a new user', async () => {
            const args = {
                username: 'newuser', fullName: 'New User', email: 'new@test.com', password: '123'
            };
            const res = await userResolvers.Mutation.register(null, args, context);
            expect(res.code).toBe(200);
            
            const dbUser = await User.findOne({ email: 'new@test.com' });
            expect(dbUser).toBeDefined();
        });

        it('login should return token', async () => {
            const args = { email: 'main@test.com', password: '123' };
            const res = await userResolvers.Mutation.login(null, args, context);
            expect(res.token).toBe('fake_jwt_token');
        });

        it('toggleFollowUser should update lists', async () => {
            const target = await User.create({ username: 'target', fullName: 'T', email: 't@t.com', password: '123' });
            
            await userResolvers.Mutation.toggleFollowUser(null, { followId: target._id }, context);
            
            const updatedMe = await User.findById(mockUser._id);
            expect(updatedMe.following).toContainEqual(target._id);
        });
    });

    // =========================================================
    // 3. FIELD RESOLVERS
    // =========================================================
    describe('FIELD RESOLVERS', () => {
        it('should resolve donations for a user', async () => {
            // DÜZELTME BURADA YAPILDI: paymentProviderId EKLENDİ
            await Transaction.create({
                userId: mockUser._id,
                bookId: mockUser._id, // Fake ID
                amount: 50,
                currency: 'TRY',
                status: 'SUCCESS',
                paymentProviderId: 'pi_fake_123456' // <-- BU ALAN EKSİKTİ
            });

            // Resolver'ı manuel çağır: User.donations(parent)
            const res = await userResolvers.User.donations(mockUser, {}, context);
            
            expect(res).toHaveLength(1);
            expect(res[0].amount).toBe(50);
        });

        it('should resolve savedBooks', async () => {
             const book = await Book.create({ title: 'Saved Book', authorId: mockUser._id });
             mockUser.savedBooks.push(book._id);
             
             // Field resolver testi
             const res = await userResolvers.User.savedBooks(mockUser, {}, context);
             
             expect(res).toHaveLength(1);
        });
    });
});