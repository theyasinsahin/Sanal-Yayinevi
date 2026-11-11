import * as ChapterService from '../../services/chapterService.js';
import { getLoaders } from '../loaders.js';
import { chapterAccessStatus, registrationGateEnabled } from '../../utils/chapterAccess.js';
import { chapterWordCount } from '../../utils/chapterLength.js';
import * as BookService from '../../services/bookService.js';
import * as BookFollowService from '../../services/bookFollowService.js';
import { assertContentAccess } from '../../utils/printedBooks.js';
import { cleanRichText } from '../../security/richText.js';
import { canReadBook } from '../../utils/bookAccess.js';

async function visibleChapters(chapters, context = {}) {
  const books = await getLoaders(context).books.loadMany(chapters.map(chapter => chapter.bookId));
  return chapters.filter((chapter, index) => canReadBook(books[index], context.user));
}


export default {
  Query: {
    getChaptersByBookId: async (_, { bookId }, context) => {
      return visibleChapters(await ChapterService.findChaptersByBookId(bookId), context);
    },

    getChapterById: async (_, { id }, context) => {
      const chapter = await ChapterService.findChapterById(id);
      if (!chapter) throw new Error("Bölüm bulunamadı.");
      return (await visibleChapters([chapter], context))[0] || null;
    },

    getAllChapters: async (_, args, context) => {
      return visibleChapters(await ChapterService.findAllChapters(args), context);
    },

    getChaptersByAuthorId: async (_, { authorId }, context) => {
      return visibleChapters(await ChapterService.findChaptersByAuthorId(authorId), context);
    }
  },

    Mutation: {
        createChapter: async (_, { bookId, title, content, pageCount, isHidden }, { user }) => {
  if (!user) throw new Error("Giriş yapmalısınız.");

  const book = await BookService.findBookById(bookId);
  if (!book) throw new Error("Kitap bulunamadı.");
  
  assertContentAccess(book, user);
  if (String(book.authorId) !== user._id.toString() && user.role !== 'ADMIN') {
    throw new Error("Yetkiniz yok.");
  }

  const chapter = await ChapterService.createChapter({
    bookId,
    title,
    content,
    pageCount: pageCount || 0,
    isHidden: isHidden === true,
    authorId: user._id
  });

  // Takipçilere bildirim gönder — await etmiyoruz, kullanıcıyı bekletmesin
  BookFollowService.notifyBookFollowers(bookId, title, book.title, chapter.id)
    .catch(err => console.error('Bildirim gönderilemedi:', err));

  return chapter;
},

        updateChapter: async (_, { chapterId, title, content, pageCount, isHidden }, { user }) => {
            if (!user) throw new Error("Giriş yapmalısınız.");

            const chapter = await ChapterService.findChapterById(chapterId);
            if (!chapter) throw new Error("Bölüm bulunamadı.");
            
            // Bölümün sahibini (kitap üzerinden) kontrol et
            const book = await BookService.findBookById(chapter.bookId);
            assertContentAccess(book, user);
            if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("Yetkiniz yok.");
            }

            return ChapterService.updateChapter(chapterId, {
                ...(title && { title }),
                ...(typeof content === 'string' && { content }),
                ...(pageCount !== undefined && { pageCount }),
                ...(isHidden != null && { isHidden })
            });
        },

        deleteChapter: async (_, { id }, { user }) => {
            if (!user) throw new Error("Giriş yapmalısınız.");

            const chapter = await ChapterService.findChapterById(id);
            if (!chapter) throw new Error("Bölüm bulunamadı.");

            // Yetki kontrolü (Bölüm yazarı = Kullanıcı mı?)
            assertContentAccess(await BookService.findBookById(chapter.bookId), user);
            if (chapter.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("Yetkiniz yok.");
            }

            return ChapterService.deleteChapter(id);
        }
    },

  // FIELD RESOLVERS
  Chapter: {
    isHidden: chapter => chapter.isHidden === true,
    accessStatus: chapterStatus,
    canReadContent: chapterReadable,
    content: async (chapter, args, context) => await chapterReadable(chapter, args, context) ? cleanRichText(chapter.content) : '',
    wordCount: chapter => Number.isInteger(chapter.wordCount) ? chapter.wordCount : typeof chapter.content === 'string' ? chapterWordCount(chapter.content) : null,
  }
};

async function chapterReadable(chapter, _, context) {
  return await chapterStatus(chapter, _, context) === 'READABLE';
}

async function chapterStatus(chapter, _, context) {
  const loaders = getLoaders(context);
  const [book, inactive, first] = await Promise.all([loaders.books.load(chapter.bookId), loaders.inactiveIds(),
    !context.user && registrationGateEnabled() ? loaders.firstOpenChapters.load(chapter.bookId) : null]);
  if (inactive.some(id => String(id) === String(book?.authorId) || String(id) === String(chapter.authorId))) return 'UNAVAILABLE';
  return chapterAccessStatus(chapter, book, context.user, first);
}
