export default {
  getBookById: async (_, { id }, { Book }) => {
    return await Book.findById(id);
  },

  getBooksByAuthor: async (_, { authorId }, { Book }) => {
    // authorId alanına göre filtrele
    return await Book.find({ authorId });
  },

  getBooksByGenre: async (_, { genre }, { Book }) => {
    return await Book.find({ genre });
  },

  getAllBooks: async (_, __, { Book }) => {
    return await Book.find();
  },

  searchBooks: async (_, { query }, { Book, User }) => {
    try {
        // 1. fullName'e göre kullanıcıları bul
        const matchingUsers = await User.find({
        fullName: { $regex: query, $options: "i" }
        }).select('_id');

        const matchingUserIds = matchingUsers.map(user => user._id);

        // 2. Kitaplarda title, description veya authorId eşleşmelerini ara
        const books = await Book.find({
        $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
            { authorId: { $in: matchingUserIds } } // authorId eşleşiyor mu?
        ]
        });

        return books;
    } catch (error) {
        console.error("Error searching books:", error);
        throw new Error("Failed to search books");
    }
  },

};
