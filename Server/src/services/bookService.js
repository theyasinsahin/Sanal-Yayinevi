import Book from '../models/book.js';
import User from '../models/user.js';

export const findBookById = async (id) => {
  return await Book.findById(id);
};

export const findAllBooks = async () => {
    return await Book.find({ 
        status: { $in: ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'] } 
    }).sort({ createdAt: -1 });};

export const findBooksByAuthorId = async (authorId, {User})   => {
    if (User && User.id === authorId) {
        return await Book.find({ authorId: authorId }).sort({ createdAt: -1 });
    }
    
    // Başkası bakıyorsa DRAFT'ları gizle
    return await Book.find({ 
        authorId: authorId,
        status: { $ne: 'DRAFT' } // Not Equal to DRAFT
    }).sort({ createdAt: -1 });};

export const findBooksByGenre = async (genre) => {
  return await Book.find({ genre });
};

export const findBookByTitle = async (title) => {
  return await Book.findOne({ title });
};

// Karmaşık Arama Mantığı Service'e Taşındı
export const searchBooksInDb = async (query) => {
  // 1. Yazarları bul
  const matchingUsers = await User.find({
    fullName: { $regex: query, $options: "i" }
  }).select('_id');
  
  const matchingUserIds = matchingUsers.map(u => u._id);

  // 2. Kitaplarda (Başlık, Açıklama veya Yazar) ara
  return await Book.find({
    $or: [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { authorId: { $in: matchingUserIds } }
    ]
  });
};

// CREATE
export const createBook = async (bookData, userId) => {
    const newBook = new Book({
        ...bookData,
        authorId: userId
    });
    const savedBook = await newBook.save();
    
    // Yazarın kitap listesine ekle
    await User.findByIdAndUpdate(userId, { $push: { usersBooks: savedBook._id } });
    
    return savedBook;
};

// TOGGLE LIKE
export const toggleLike = async (bookId, userId) => {
    const book = await Book.findById(bookId);
    if (book.likedBy.includes(userId)) {
        book.likedBy.pull(userId);
        book.stats.likes = Math.max(0, book.stats.likes - 1);
    } else {
        book.likedBy.push(userId);
        book.stats.likes += 1;
    }
    return await book.save();
};

// INCREMENT VIEW
export const incrementViews = async (bookId) => {
    return await Book.findByIdAndUpdate(bookId, { $inc: { "stats.views": 1 } }, { new: true });
};

export const findBooksByIds = async (bookIds) => {
    // Eğer liste boşsa veritabanına gitme, boş dizi dön
    if (!bookIds || bookIds.length === 0) return [];
    
    return await Book.find({ _id: { $in: bookIds } });
};