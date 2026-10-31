import Genre from '../models/genre.js';

/**
 * Tüm türleri getirir.
 * @param {boolean} includeInactive - Pasif türler de getirilsin mi?
 */
export const getAllGenres = async (includeInactive = false) => {
    const filter = includeInactive ? {} : { isActive: true };
    return await Genre.find({ ...filter, classificationVersion: 1 }).sort({ name: 1 });
  };

/**
 * Slug'a göre aktif bir türü getirir.
 * @param {string} slug - Türün URL dostu ismi
 */
export const getGenreBySlug = async (slug) => {
  const genre = await Genre.findOne({ slug, isActive: true, classificationVersion: 1 });
  if (!genre) {
    throw new Error("Kategori bulunamadı veya pasif durumda.");
  }
  return genre;
};
