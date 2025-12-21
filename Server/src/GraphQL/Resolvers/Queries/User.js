import jwt from 'jsonwebtoken';
import { authenticateUser } from '../../../utils/auth.js';
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

    getFollowingByUserId: async (_, { id }, { User }) => {
        const user = await User.findById(id); // populate kullanma
        if (!user) {
            throw new Error("User not found");
        }
        return user.following.map(followingId => followingId.toString());
    },

    getFollowersByUserId: async (_, { id }, { User }) => {
        const user = await User.findById(id);
        if (!user) {
            throw new Error("User not found");
        }
        return user.followers.map(followerId => followerId.toString());
    },

    me: async (_, __, { req, User },) => {

        const user = await authenticateUser(req, User);

        if (!user) {
            throw new Error("User not found");
        }

        return user;
    },

    getFavouriteBooksByUserId: async (_, { id }, { User }) => {
        const user = await User.findById(id).populate('savedBooks');
        if (!user) {
            throw new Error("User not found");
        }
        return user.savedBooks;
    },

    getUsersBooksByUserId: async (_, { id }, { User }) => {
        const user = await User.findById(id).populate('usersBooks');
        if (!user) {
            throw new Error("User not found");
        }
        return user.usersBooks;
    },

}