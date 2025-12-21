import { get } from "mongoose";
import { authenticateUser } from "../../../utils/auth.js";

export const commentQueries = {
    getCommentsByBookId: async (_, { bookId }, { Comment }) => {
        try {
            const comments = await Comment.find({ bookId }).populate('userId', 'username');
            return comments;
        } catch (error) {
            throw new Error("Error fetching comments: " + error.message);
        }
    },

    getCommentById: async (_, { id }, { Comment }) => {
        try {
            const comment = await Comment.findById(id).populate('userId', 'username');
            if (!comment) {
                throw new Error("Comment not found");
            }
            return comment;
        } catch (error) {
            throw new Error("Error fetching comment: " + error.message);
        }
    },

    getCommentsByUserId: async (_, { userId }, { Comment }) => {
        try {
            const comments = await Comment.find({ userId }).populate('userId', 'username');
            return comments;
        } catch (error) {
            throw new Error("Error fetching comments by user: " + error.message);
        }
    },

    getAllComments: async (_, __, { Comment }) => {
        try {
            const comments = await Comment.find().populate('userId', 'username');
            return comments;
        } catch (error) {
            throw new Error("Error fetching all comments: " + error.message);
        }
    }
};