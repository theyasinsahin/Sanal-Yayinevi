import * as ChapterService from '../../services/chapterService.js';
import * as UserService from '../../services/userService.js';
import * as BookService from '../../services/bookService.js';
import { authenticateUser } from '../../utils/auth.js';

export default {
  Query: {
    getChaptersByBookId: async (_, { bookId }) => {
      return ChapterService.findChaptersByBookId(bookId);
    },

    getChapterById: async (_, { id }) => {
      const chapter = await ChapterService.findChapterById(id);
      if (!chapter) throw new Error("Chapter not found");
      return chapter;
    },

    getAllChapters: async () => {
      return ChapterService.findAllChapters();
    },

    getChaptersByAuthorId: async (_, { authorId }) => {
      return ChapterService.findChaptersByAuthorId(authorId);
    }
  },

    Mutation: {
        createChapter: async (_, { bookId, title, content, pageCount }, { req, User }) => {
            const user = await authenticateUser(req, User);
            if (!user) throw new Error("Giriş yapmalısınız.");

            // Yetki Kontrolü
            const book = await BookService.findBookById(bookId);
            if (!book) throw new Error("Kitap bulunamadı.");
            
            if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("Yetkiniz yok.");
            }

            return ChapterService.createChapter({
                bookId,
                title,
                content,
                pageCount: pageCount || 0,
                authorId: user._id
            });
        },

        updateChapter: async (_, { chapterId, title, content, pageCount }, { req, User }) => {
            const user = await authenticateUser(req, User);
            if (!user) throw new Error("Giriş yapmalısınız.");

            const chapter = await ChapterService.findChapterById(chapterId);
            if (!chapter) throw new Error("Bölüm bulunamadı.");
            
            // Bölümün sahibini (kitap üzerinden) kontrol et
            const book = await BookService.findBookById(chapter.bookId);
            if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("Yetkiniz yok.");
            }

            return ChapterService.updateChapter(chapterId, {
                ...(title && { title }),
                ...(content && { content }),
                ...(pageCount !== undefined && { pageCount })
            });
        },

        deleteChapter: async (_, { id }, { req, User }) => {
            const user = await authenticateUser(req, User);
            if (!user) throw new Error("Giriş yapmalısınız.");

            const chapter = await ChapterService.findChapterById(id);
            if (!chapter) throw new Error("Bölüm bulunamadı.");

            // Yetki kontrolü (Bölüm yazarı = Kullanıcı mı?)
            if (chapter.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("Yetkiniz yok.");
            }

            return ChapterService.deleteChapter(id);
        }
    },

  // FIELD RESOLVERS
  Chapter: {
    // chapter.authorId: ID! olarak tanımlı TypeDef'te.
    // Eğer TypeDef'i "author: User" yaparsan aşağıdaki kodu kullanırsın.
    // Şimdilik sadece ID döndüğü için özel bir resolver'a gerek yok aslında.
    // Ancak ileride User objesi dönmek istersen yapı şöyle olmalı:
    /*
    author: async (parent) => {
        return UserService.findUserById(parent.authorId);
    }
    */
  }
};