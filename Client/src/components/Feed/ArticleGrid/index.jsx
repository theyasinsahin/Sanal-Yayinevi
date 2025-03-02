import React from 'react';
import ArticleCardExtended from '../ArticleCardExtended';
import './ArticleGrid.css';

const ArticleGrid = ({ articles }) => {
  return (
    <div className="article-grid">
      {articles.map(article => (
        <ArticleCardExtended 
          key={article.id} 
          article={article} 
        />
      ))}
    </div>
  );
};

export default ArticleGrid;