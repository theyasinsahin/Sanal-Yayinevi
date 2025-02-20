import React from 'react';
import Masonry from 'react-masonry-css';
import ArticleCardExtended from '../ArticleCardExtended';
import './ArticleGrid.css';

const ArticleGrid = ({ articles }) => {
  const breakpointColumns = {
    default: 3,
    1100: 2,
    700: 1
  };

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className="masonry-grid"
      columnClassName="masonry-column"
    >
      {articles.map(article => (
        <ArticleCardExtended 
          key={article.id} 
          article={article} 
        />
      ))}
    </Masonry>
  );
};

export default ArticleGrid;