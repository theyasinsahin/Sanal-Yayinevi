import React from 'react';
import './FeaturedArticles.css';
import BookCard from '../../../components/BookCard'
import { sampleBooks } from '../../../Data/sampleBooks';

import { Link } from 'react-router-dom';

const FeaturedArticles = () => {
 
  return (
    <section className="featured-articles">
      <div className="section-header">
        <h2 className="section-title">Öne Çıkan Yazılar</h2>
        <Link to='/feed' className="secondary-cta">Tümünü Gör</Link>
      </div>
      
      <div className="articles-grid">
      {sampleBooks.slice(0, Math.min(3, sampleBooks.length)).map(article => (
        <BookCard
          id={article.id}
          title={article.title}
          author={article.author}
          excerpt={article.excerpt}
          currentAmount={article.currentAmount}
          goal={article.goal}
          imageUrl={article.imageUrl}
          pageCount={article.pageCount}
          genre={article.genre}
          stats={article.stats}
        />
      ))}

      </div>
    </section>
  );
};

export default FeaturedArticles;