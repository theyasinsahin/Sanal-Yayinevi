export const filterBooks = (books, filters) => {
  // Eğer kitap listesi boşsa direkt boş dizi dön
  if (!books) return [];

  let filtered = [...books];

  // --- 1. ARAMA FİLTRESİ (SEARCH) ---
  if (filters.search && filters.search.trim() !== '') {
    const searchTerm = filters.search.toLowerCase().trim();

    filtered = filtered.filter((book) => {
      // 1. Kitap Başlığı Kontrolü
      const titleMatch = book.title?.toLowerCase().includes(searchTerm);
      
      // 2. Yazar Kontrolü (Artık book.author bir obje!)
      // Yazarın kullanıcı adı VEYA tam adı eşleşiyor mu?
      // Optional chaining (?.) kullanarak null hatasını önlüyoruz.
      const authorUserMatch = book.author?.username?.toLowerCase().includes(searchTerm);
      const authorNameMatch = book.author?.fullName?.toLowerCase().includes(searchTerm);

      // Başlıkta VEYA Yazar Kullanıcı Adında VEYA Yazar Tam Adında geçiyorsa getir
      return titleMatch || authorUserMatch || authorNameMatch;
    });
  }

  for (const [key, field] of [['formats', 'format'], ['genres', 'genres'], ['tags', 'classificationTags'], ['features', 'narrativeFeatures'], ['audiences', 'targetAudience']]) {
    const selected = filters.classification?.[key] || [];
    if (selected.length) filtered = filtered.filter(book => {
      const terms = Array.isArray(book[field]) ? book[field] : [book[field]].filter(Boolean);
      return terms.some(term => selected.includes(term.slug));
    });
  }

  // --- 3. SIRALAMA (SORT) ---
 if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        // Tarihe göre yeniden eskiye (createdAt alanı şemada mevcut)
        filtered.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
        break;
      case 'lastUpdated':
        // Tarihe göre yeniden eskiye (updatedAt alanı şemada mevcut)
        filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        break;
      case 'oldest':
        // Tarihe göre eskiden yeniye
        filtered.sort((a, b) => new Date(a.publishDate) - new Date(b.publishDate));
        break;
      case 'popular':
        // Düzeltme: likeCount yerine likedBy dizisinin uzunluğuna (length) bakıyoruz.
        // Array null/undefined gelirse hata vermemesi için kontrol ekliyoruz.
        filtered.sort((a, b) => {
            const countA = a.likedBy ? a.likedBy.length : 0;
            const countB = b.likedBy ? b.likedBy.length : 0;
            return countB - countA; // Çoktan aza sıralama
        });
        break;
      default:
        break;
    }
}

  return filtered;
};