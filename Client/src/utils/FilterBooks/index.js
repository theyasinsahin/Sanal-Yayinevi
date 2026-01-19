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

  // --- 2. KATEGORİ FİLTRESİ (GENRE) ---
  if (filters.genre && filters.genre !== 'Tümü') {
    // book.genre veritabanında "slug" olarak mı yoksa "Display Name" olarak mı tutuluyor?
    // Buradaki eşleşmenin birebir olduğundan emin ol.
    filtered = filtered.filter((book) => book.genre === filters.genre);
  }

  // --- 3. SIRALAMA (SORT) ---
  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        // Tarihe göre yeniden eskiye
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'oldest':
        // Tarihe göre eskiden yeniye
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'popular':
        // Eğer likeCount veya viewCount varsa ona göre sırala
        // (Yoksa newest gibi davranır)
        filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        break;
      default:
        break;
    }
  }

  return filtered;
};