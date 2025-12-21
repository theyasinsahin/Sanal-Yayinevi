import { authenticateUser } from "../../../utils/auth.js";
export default {
    createBook: async (_, { title, genre, description, tags, imageUrl }, { Book, User, req }) => {
    const user = await authenticateUser(req, User);
        try {
            const newBook = new Book({
            title,
            genre,
            description,
            authorId: user._id,
            tags: tags || [],
            imageUrl: imageUrl || '',
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

    deleteBook: async (_, { id }, { Book, req, Comment, Chapter, User }) => {
    const user = await authenticateUser(req, User);

    try {
        const book = await Book.findById(id);
        if (!book) {
            throw new Error("Book not found");
        }

        // Yetki Kontrolü
        // Not: user._id kullanmak Mongoose objeleri için daha güvenlidir.
        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
            throw new Error("You are not authorized to delete this book");
        }

        // --- TEMİZLİK İŞLEMLERİ ---

        // 1. Yorumları sil
        if (book.comments && book.comments.length > 0) {
            await Comment.deleteMany({ _id: { $in: book.comments } });
        }

        // 2. Bölümleri sil
        if (book.chapters && book.chapters.length > 0) {
            await Chapter.deleteMany({ _id: { $in: book.chapters } });
        }

        // 3. Yazardan kitabı sil
        await User.findByIdAndUpdate(book.authorId, { 
            $pull: { usersBooks: id } 
        });

        // 4. Başkaları kaydettiyse onlardan da sil
        await User.updateMany(
            { savedBooks: id },
            { $pull: { savedBooks: id } }
        );

        // 5. Kitabı sil
        await Book.findByIdAndDelete(id);

        return {
            code: 200,
            message: "Book deleted successfully",
        };

    } catch (error) {
        console.error("Error deleting book:", error);
        throw new Error(error.message);
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
            book.stats.views = (book.stats.views || 0) + 1; // <-- GÜNCELLENDİ
            const updatedBook = await book.save();
            return updatedBook;
        } catch (error) {
            console.error("Error incrementing book views:", error);
            throw new Error("Failed to increment book views");
        }
    },

    likeBook: async (_, { bookId }, { Book, User, req }) => {
    const user = await authenticateUser(req, User); 

    try {
        const book = await Book.findById(bookId);
        
        if (book.likedBy.includes(user.id)) {
            book.likedBy.pull(user.id); 
            book.stats.likes = Math.max(0, book.stats.likes - 1);
        } else {
            book.likedBy.push(user.id); 
            book.stats.likes += 1;    
        }

        await book.save();
        return book;
    } catch (err) {
        throw new Error(err);
    }
}
}