export const filterBooks = (books, filters) => {
    // 1. Orijinal listeyi kopyala (mutasyon olmaması için)
    let filtered = [...books];
  
    // --- YENİ: ARAMA FİLTRESİ ---
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const query = filters.searchQuery.toLowerCase();
  
      filtered = filtered.filter((book) => {
        // A. Kitap Başlığı Kontrolü
        const titleMatch = book.title?.toLowerCase().includes(query);
  
        // B. Yazar Kontrolü (Username veya FullName)
        // book.author objesi populate edilmiş olmalı!
        const authorMatch = 
            book.author?.username?.toLowerCase().includes(query) || 
            book.author?.fullName?.toLowerCase().includes(query);
  
        // C. Etiket (Tags) Kontrolü
        // book.tags bir dizi (array) olmalı
        const tagMatch = book.tags?.some(tag => tag.toLowerCase().includes(query));
  
        // Herhangi biri eşleşiyorsa kitabı listede tut
        return titleMatch || authorMatch || tagMatch;
      });
    }
  
    // --- MEVCUT: KATEGORİ FİLTRESİ ---
    if (filters.genre && filters.genre !== 'Tümü') {
      filtered = filtered.filter((book) => book.genre === filters.genre);
    }
  
    // --- MEVCUT: SIRALAMA (SORT) ---
    if (filters.sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (filters.sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (filters.sortBy === 'popular') {
        // Beğeni veya görüntülenmeye göre sıralama örneği
        filtered.sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0));
    }
  
    return filtered;
  };