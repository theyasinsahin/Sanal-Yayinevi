export const filterBooks = (books, filters) => {
    return books.filter(book => {
      // Arama Filtresi
      const matchesSearch = book.title.toLowerCase().includes(
        filters.searchQuery.toLowerCase()
      );
  
      // Kategori Filtresi
      const matchesGenres = filters.genres.length === 0 || 
        filters.genres.includes(book.genre);
  
      return matchesSearch && matchesGenres;
    }).sort((a, b) => {
      // Sıralama Mantığı
      switch(filters.sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'popular':
          return b.stats.views - a.stats.views;
        default:
          return 0;
      }
    });  
};