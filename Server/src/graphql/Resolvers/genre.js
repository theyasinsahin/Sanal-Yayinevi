import * as genreService from '../../services/genreService.js';

export default {
  Query: {
    getAllGenres: async (_, { includeInactive }) => {
      try {
        return await genreService.getAllGenres(includeInactive);
      } catch (error) {
        throw new Error("Türler getirilirken bir hata oluştu: " + error.message);
      }
    },

    getGenreBySlug: async (_, { slug }) => {
      try {
        return await genreService.getGenreBySlug(slug);
      } catch (error) {
        throw new Error(error.message);
      }
    }
  },

  Mutation: {
    createGenre: async (_, args, context) => {
      // Yetki Kontrolü: İş mantığından (Service) ayırıp burada yapıyoruz
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error("Bu işlem için yönetici yetkisi gerekmektedir.");
      }

      try {
        return await genreService.createGenre(args);
      } catch (error) {
        throw new Error("Tür oluşturulamadı: " + error.message);
      }
    },

    updateGenre: async (_, { id, ...updates }, context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error("Bu işlem için yönetici yetkisi gerekmektedir.");
      }

      try {
        return await genreService.updateGenre(id, updates);
      } catch (error) {
        throw new Error("Tür güncellenemedi: " + error.message);
      }
    },

    deleteGenre: async (_, { id }, context) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error("Bu işlem için yönetici yetkisi gerekmektedir.");
      }

      try {
        return await genreService.deleteGenre(id);
      } catch (error) {
        throw new Error("Tür silinemedi: " + error.message);
      }
    }
  }
};