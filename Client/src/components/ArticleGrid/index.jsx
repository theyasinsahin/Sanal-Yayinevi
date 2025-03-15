import React from 'react';

import './ArticleGrid.css';
import BookCard from '../BookCard'; 


const ArticleGrid = ({ articles }) => {


  return (
    <div className="article-grid">
      {articles.map(article => (
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
  );
};

export default ArticleGrid;