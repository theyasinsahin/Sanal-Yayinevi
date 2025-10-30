import { authenticateUser } from "../../../utils/auth.js";
export default {
    createBook: async (_, { title, genre, description, tags }, { Book, User, req }) => {
    const user = await authenticateUser(req, User);
        try {
            const newBook = new Book({
            title,
            genre,
            description,
            authorId: user._id,
            tags: tags || [],
            });

            const savedBook = await newBook.save();

            user.usersBooks.push(savedBook._id);
            
            await user.save();

            return savedBook;
        } catch (error) {
            console.error("Error creating book:", error);
            throw new Error("Failed to create book");
        }
    },

    deleteBook: async (_, { id }, { Book, req, Comment, Chapter }) => {
        //const user = await authenticateUser(req, Book);
        try {
            const book = await Book.findById(id);
            if (!book) {
                throw new Error("Book not found");
            }
            /*if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("You are not authorized to delete this book");
            }*/

            // Yorumları sil
            if (book.comments && book.comments.length > 0) {
                await Comment.deleteMany({ _id: { $in: book.comments } });
            }

            // Bölümleri sil
            if (book.chapters && book.chapters.length > 0) {
                await Chapter.deleteMany({ _id: { $in: book.chapters } });
            }

            await Book.findByIdAndDelete(id);
            return {
                code: 200,
                message: "Book deleted successfully",
            };
        } catch (error) {
            console.error("Error deleting book:", error);
            return {
                code: 500,
                message: "Failed to delete book",
            };
        }
    },
    updateBook: async (_, { bookId, title, genre, description }, { User, Book, req }) => {
        const user = await authenticateUser(req, User);
        try {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error("Book not found");
            }
            if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("You are not authorized to update this book");
            }

            // Update the book fields
            book.title = title || book.title;
            book.genre = genre || book.genre;
            book.description = description || book.description;

            const updatedBook = await book.save();
            return updatedBook;
        } catch (error) {
            console.error("Error updating book:", error);
            throw new Error("Failed to update book");
        }
    },

    incrementBookViews: async (_, { id }, { Book }) => {
        try {
            const book = await Book.findById(id);
            if (!book) {
                throw new Error("Book not found");
            }
            book.stats.likes = (book.stats.likes || 0) + 1; // <-- GÜNCELLENDİ
            const updatedBook = await book.save();
            return updatedBook;
        } catch (error) {
            console.error("Error incrementing book views:", error);
            throw new Error("Failed to increment book views");
        }
    },

    likeBook: async (_, { bookId }, { Book, User, BookLike, req }) => {
        try {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error("Book not found");
            }

            const user = await authenticateUser(req, User);
            if (!user) {
                throw new Error("User not found");
            }
            const userId = user._id;

            // Check if the user has already liked the book
            const existingLike = await BookLike.findOne({ userId, bookId });
            if (existingLike) {
                throw new Error("You have already liked this book");
            }

            // 2. Yeni beğeni kaydını oluştur
            await BookLike.create({ userId, bookId });

            book.stats.likes += 1; // Increment likes count

            const updatedBook = await book.save();
            return updatedBook;
        } catch (error) {
            console.error("Error liking book:", error);
            throw new Error("Failed to like book");
        }
    },
}