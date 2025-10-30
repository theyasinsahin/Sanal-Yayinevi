import mongoose from 'mongoose';
import {authenticateUser} from '../../../utils/auth.js';
export default{
    createChapter: async (_, { bookId, title, content }, { Chapter, Book, User, req }) => {
        try {
        const user = await authenticateUser(req, User);
        if (!user) {
            throw new Error("Unauthorized");
        }

        const book = await Book.findById(bookId);
        if (!book) {
            throw new Error("Book not found");
        }

        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
            throw new Error("You are not authorized to add a chapter to this book");
        }

        const newChapter = new Chapter({
            title,
            content,
            bookId: book._id,
            authorId: user._id,
        });


        const savedChapter = await newChapter.save();
        if (!savedChapter) {
            throw new Error("Chapter save failed");
        }

        book.chapters.push(savedChapter._id);
        await book.save();

        return savedChapter;
    } catch (error) {
        console.error("Error creating chapter:", error);
        throw new Error("Failed to create chapter");
    }
    },

    updateChapter: async (_, { chapterId, title, content }, { Chapter, User, req }) => {
        try {
            const user = await authenticateUser(req, User);
            if (!user) {
                throw new Error("Unauthorized");
            }

            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new Error("Chapter not found");
            }

            if (chapter.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("You are not authorized to update this chapter");
            }

            if (title) chapter.title = title;
            if (content) chapter.content = content;

            const updatedChapter = await chapter.save();
            return updatedChapter;
        } catch (error) {
            console.error("Error updating chapter:", error);
            throw new Error("Failed to update chapter");
        }
    },

    deleteChapter: async (_, { id }, { Chapter, Book, User, req }) => {
        try {
            const user = await authenticateUser(req, User);
            if (!user) {
                throw new Error("Unauthorized");
            }

            const chapter = await Chapter.findById(id);
            if (!chapter) {
                throw new Error("Chapter not found");
            }

            if (chapter.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("You are not authorized to delete this chapter");
            }

            const book = await Book.findById(chapter.bookId);
            if (book) {
                book.chapters.pull(chapter._id);
                await book.save();
            }

            await Chapter.deleteOne({ _id: id });
            return { code: 200, message: "Chapter deleted successfully" };
        } catch (error) {
            console.error("Error deleting chapter:", error);
            throw new Error("Failed to delete chapter");
        }
    }

}