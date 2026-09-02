import Genre from '../models/genre.js';

/**
 * Tüm türleri getirir.
 * @param {boolean} includeInactive - Pasif türler de getirilsin mi?
 */
  export const getAllGenres = async (includeInactive = false) => {
    const filter = includeInactive ? {} : { isActive: true };
    return await Genre.find(filter).sort({ name: 1 });
  };

/**
 * Slug'a göre aktif bir türü getirir.
 * @param {string} slug - Türün URL dostu ismi
 */
export const getGenreBySlug = async (slug) => {
  const genre = await Genre.findOne({ slug, isActive: true });
  if (!genre) {
    throw new Error("Kategori bulunamadı veya pasif durumda.");
  }
  return genre;
};

/**
 * Yeni bir tür oluşturur.
 * @param {Object} genreData - Oluşturulacak türün verileri
 */
export const createGenre = async (genreData) => {
  const existingGenre = await Genre.findOne({ slug: genreData.slug });
  if (existingGenre) {
    throw new Error("Bu slug (URL kısaltması) zaten kullanımda.");
  }

  const newGenre = new Genre({
    ...genreData,
    isActive: true
  });

  return await newGenre.save();
};

/**
 * Mevcut bir türü günceller.
 * @param {string} id - Güncellenecek türün ID'si
 * @param {Object} updates - Güncellenecek alanlar
 */
export const updateGenre = async (id, updates) => {
  const updatedGenre = await Genre.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!updatedGenre) {
    throw new Error("Güncellenecek tür bulunamadı.");
  }
  return updatedGenre;
};

/**
 * Bir türü yazılımsal olarak siler (Soft Delete).
 * @param {string} id - Silinecek türün ID'si
 */
export const deleteGenre = async (id) => {
  const deletedGenre = await Genre.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true }
  );

  if (!deletedGenre) {
    throw new Error("Silinecek tür bulunamadı.");
  }
  return deletedGenre;
};