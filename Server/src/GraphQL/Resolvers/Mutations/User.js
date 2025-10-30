import { authenticateUser } from "../../../utils/auth.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env",
});

export default {
    register: async (_, { username, fullName, email, password }, {User}) => {
        const existingUserByEmail = await User.findOne({ email });
        if (existingUserByEmail) {
            return {
            code: 400,
            message: 'User already exists with this email',
            };
        }

        const existingUserByUsername = await User.findOne({ username });
        if (existingUserByUsername) {
            return {
            code: 400,
            message: 'User already exists with this username',
            };
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = new User({ username, fullName, email, password: hashedPassword });
            await user.save();

            return {
            code: 200,
            message: 'User registered successfully',
            };
        } catch (error) {
            console.error('Register error:', error);
            return {
            code: 500,
            message: 'Internal server error during registration',
            };
        }
    },

    login: async (_, { email, password }, {User}) => {
        const user = await User.findOne({ email });
        if (!user) throw new Error("User not found");

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) throw new Error("Invalid credentials");

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        return {
            token,
            user
        };
    },
    deleteUserById: async (_, { id }, { User, Book, Comment, Chapter }) => {
        const user = await User.findById(id);
        if (!user) throw new Error("User not found");

        // 1. Kullanıcının kitaplarını bul
        const userBooks = await Book.find({ _id: { $in: user.userBooks } });

        // 2. Her kitap için ilgili yorum ve bölümleri sil
        for (const book of userBooks) {
            // Eğer kitaplarda comment/chapters dizisi varsa:
            if (book.comments && book.comments.length > 0) {
                await Comment.deleteMany({ _id: { $in: book.comments } });
            }

            if (book.chapters && book.chapters.length > 0) {
                await Chapter.deleteMany({ _id: { $in: book.chapters } });
            }
        }

        // 3. Kitapları sil
        await Book.deleteMany({ _id: { $in: user.userBooks } });

        // 4. Diğer kullanıcıların "followers" listesinden sil
        await User.updateMany({ followers: id }, { $pull: { followers: id } });

        // 5. Diğer kullanıcıların "following" listesinden sil
        await User.updateMany({ following: id }, { $pull: { following: id } });

        // 6. Kullanıcının kendisini sil
        await User.findByIdAndDelete(id);

        return { code: 200, message: "User deleted successfully" };
    },

    followUser: async (_, { followId }, {req, User}) => {
        const user = await authenticateUser(req, User);

        const followUser = await User.findById(followId);
        
        if (!user || !followUser) {
            throw new Error("User not found");
        }
        if (user.following.includes(followId)) {
            throw new Error("You are already following this user");
        }
        if(user == followUser) {
            throw new Error("You cannot follow yourself");
        }
        
        user.following.push(followId);
        followUser.followers.push(user._id);
        await user.save();
        await followUser.save();
        return {
            code: 200,
            message: "User followed successfully",
        };
    },
    updateProfile: async (_, { username, fullName, bio, profilePicture }, { req, User }) => {
        const user = await authenticateUser(req, User);

        if (!user) {
            throw new Error("User not found");
        }

        if (username) user.username = username;
        if (fullName) user.fullName = fullName;
        if (bio) user.bio = bio;
        if (profilePicture) user.profilePicture = profilePicture;

        await user.save();
        
        return user;
    }
};