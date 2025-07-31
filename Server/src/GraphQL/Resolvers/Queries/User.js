import jwt from 'jsonwebtoken';

export default {
    getUserById: async (_, { id }, { User }) => {
        return await User.findById(id).select('-password');
    },

    getUserByUsername: async (_, { username }, { User }) => {
        return await User.findOne({ username }).select('-password');
    },

    getUserByEmail: async (_, { email }, { User }) => {
        return await User.findOne({ email }).select('-password');
    },

    getAllUsers: async (_, __, { User }) => {
        return await User.find().select('-password');
    },

    getFollowingByUser: async (_, { id }, { User }) => {
        const user = await User.findById(id); // populate kullanma
        if (!user) {
            throw new Error("User not found");
        }
        return user.following.map(followingId => followingId.toString());
    },

    getFollowersByUser: async (_, { id }, { User }) => {
        console.log("UserId: ", id);
        const user = await User.findById(id);
        if (!user) {
            throw new Error("User not found");
        }
        return user.followers.map(followerId => followerId.toString());
    },

    me: async (_, __, { req, User },) => {

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new Error("Not authenticated");
        }

        const token = authHeader.replace("Bearer ", "");

        let decoded;
        try {
            decoded = jwt.verify(token, "SECRET_KEY");
        } catch (err) {
            throw new Error("Invalid or expired token");
        }

        if (!decoded?.userId) {
            throw new Error("Invalid token payload");
        }

        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            throw new Error("User not found");
        }

        return user;
    }

}