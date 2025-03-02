import React from 'react';
import './FeaturedArticles.css';
import ArticleCard from './ArticleCard';

import { Link } from 'react-router-dom';

const FeaturedArticles = () => {
  // Mock data
  const articles = [
    {
        id: 1,
        title: "Kayıp Şehirin İzinde",
        author: "Eylül Kaya",
        excerpt: "Antik bir uygarlığın sırları peşinde koşan arkeologların...",
        currentAmount: 12500,
        goal: 20000,
        imageUrl: "./images/books/yuzyillik-yalnizlik.png",
        pageCount: 245,
        genre: "Arkeolojik Macera"
    },
    {
        id: 2,
        title: "Yapay Zeka ve Etik",
        author: "Can Demir",
        excerpt: "Teknolojinin insanlık üzerindeki etik sonuçlarını...",
        currentAmount: 34200,
        goal: 40000,
        imageUrl: "/images/covers/2.jpg",
        pageCount: 180,
        genre: "Bilim Felsefesi"
    },
    {
      id: 3,
      title: "Mars Kolonisi Günlükleri",
      author: "Zeynep Aksoy",
      excerpt: "2115 yılında Kızıl Gezegen'de yaşamın ilk yılları...",
      currentAmount: 8750,
      goal: 30000,
      imageUrl: "/images/covers/3.jpg",
      pageCount: 320,
      genre: "Bilim-Kurgu"
    }
  ];

  return (
    <section className="featured-articles">
      <div className="section-header">
        <h2 className="section-title">Öne Çıkan Yazılar</h2>
        <Link to='/feed' className="see-all-button">Tümünü Gör</Link>
      </div>
      
      <div className="articles-grid">
        {articles.map(article => (
          <ArticleCard
            key={article.id}
            title={article.title}
            author={article.author}
            excerpt={article.excerpt}
            currentAmount={article.currentAmount}
            goal={article.goal}
            imageUrl={article.imageUrl}
            pageCount={article.pageCount}
            genre={article.genre}
          />
        ))}
      </div>
    </section>
  );
};

export default FeaturedArticles;