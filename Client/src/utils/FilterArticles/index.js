export const filterArticles = (articles, filters) => {
    return articles.filter(article => {
      // Arama Filtresi
      const matchesSearch = article.title.toLowerCase().includes(
        filters.searchQuery.toLowerCase()
      ) || article.author.toLowerCase().includes(
        filters.searchQuery.toLowerCase()
      );
  
      // Kategori Filtresi
      const matchesCategory = filters.categories.length === 0 || 
        filters.categories.includes(article.genreId);
  
      // Bağış Aralığı Filtresi
      const [min, max] = filters.donationRange;
      const matchesDonation = article.goal >= min && 
        article.goal <= max;
  
      return matchesSearch && matchesCategory && matchesDonation;
    }).sort((a, b) => {
      // Sıralama Mantığı
      switch(filters.sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'popular':
          return b.stats.views - a.stats.views;
        case 'closest':
          return (a.goal / a.currentAmount) - (b.goal / b.currentAmount);
        case 'most-funded':
          return b.currentAmount - a.currentAmount;
        default:
          return 0;
      }
    });  
};