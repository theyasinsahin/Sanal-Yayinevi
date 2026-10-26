import { getBookFeed } from '../../services/bookCatalogService.js';
import { findBookById } from '../../services/bookService.js';
import Chapter from '../../models/chapter.js';
import { inactiveUserIds } from '../../utils/activeUsers.js';

export default { Query: {
  getBookFeed: async (_, args) => getBookFeed(args),
  getReadingChapter: async (_, { bookId, chapterId }, { user }) => {
    const book = await findBookById(bookId, { viewer: user });
    if (!book || (book.status === 'DRAFT' && String(book.authorId) !== String(user?._id) && user?.role !== 'ADMIN')) return null;
    return Chapter.findOne({ _id: chapterId, bookId, isDeleted: false, authorId: { $nin: await inactiveUserIds() } }).exec();
  },
} };
