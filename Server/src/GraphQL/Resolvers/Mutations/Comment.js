import { authenticateUser } from "../../../utils/auth.js";

export default{
    createComment: async (_, { bookId, content }, { Comment, req, User, Book }) => {
        const user = await authenticateUser(req, User);
        if (!user) {
            throw new Error("Unauthorized");
        }
        if (!bookId || !content) {
            throw new Error("Book ID and content are required");
        }
        const book = await Book.findById(bookId);
        if (!book) {
            throw new Error("Book not found");
        }
        
        
        try {
            const newComment = new Comment({
                userId: user.id,
                bookId,
                content,
                likes: 0,
                replies: []
            });
            await newComment.save();
            await Book.findByIdAndUpdate(
                bookId,
                { $push: { comments: newComment._id } }
            );
            return newComment;
        } catch (error) {
            throw new Error("Error creating comment: " + error.message);
        }
    },

    deleteComment: async (_, { id }, { Comment, req, User }) => {
        const user = await authenticateUser(req, User);
        if (!user) {
            throw new Error("Unauthorized");
        }
        
        const comment = await Comment.findById(id);
        if (!comment) {
            throw new Error("Comment not found");
        }
        
        if (comment.userId.toString() !== user.id && user.role !== 'ADMIN') {
            throw new Error("You are not authorized to delete this comment");
        }
        
        try {
            await Comment.deleteOne({ _id: id });
            return { code: 200, message: "Comment deleted successfully" };
        } catch (error) {
            throw new Error("Error deleting comment: " + error.message);
        }
    }
}