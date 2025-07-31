import { authenticateUser } from "../../../utils/auth.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

        const token = jwt.sign({ userId: user._id }, "SECRET_KEY", { expiresIn: '1d' });

        return {
            token,
            user
        };
    },
    deleteUserById: async (_, { id }, {User}) => {
        const user = await User.findByIdAndDelete(id);
        if (!user) throw new Error("User not found");
        
        // 2. Diğer kullanıcıların "followers" listesinden sil
        await User.updateMany(
            { followers: id },
            { $pull: { followers: id } }
        );

        // 3. Diğer kullanıcıların "following" listesinden sil
        await User.updateMany(
            { following: id },
            { $pull: { following: id } }
        );

        return { code: 200, message: "User deleted successfully" };
    },

    followUser: async (_, { followId }, {req, User}) => {
        const user = authenticateUser(req, User);

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
    updateProfile: async (_, { username, fullName, bio }, { req, User }) => {
        const user = await authenticateUser(req, User);

        if (!user) {
            throw new Error("User not found");
        }

        if (username) user.username = username;
        if (fullName) user.fullName = fullName;
        if (bio) user.bio = bio;

        await user.save();
        
        return user;
    }
};