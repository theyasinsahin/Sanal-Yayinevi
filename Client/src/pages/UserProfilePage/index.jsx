// UserProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { People, Book, Paid, Email, Link, Chat } from '@mui/icons-material';
import ArticleGrid from '../../components/BookGrid';
import { sampleBooks } from '../../Data/sampleBooks';
import './UserProfilePage.css';


const UserProfilePage = () => {
  
  const [isFollowing, setIsFollowing] = useState(false);


      const mockUser = {
        id: 1,
        name: 'Can Demir',
        bio: 'Bilim kurgu yazarı ve teknoloji meraklısı',
        avatar: '/images/avatars/can-demir.jpg',
        stats: {
          books: 6,
          followers: 3560,
          following: 124,
          donations: 23450
        },
        contact: {
          email: 'can@yaziyolu.com',
          website: 'https://candemir.tech'
        },
        social: {
          twitter: '@candmir',
          medium: '@candemir'
        },
        isFollowing: false,
        books: [1,2,3],
      };

      const [user, setUser] = useState(mockUser);

    const books = sampleBooks.filter(book => user.books.includes(book.id));
  
  const handleFollow = async () => {
    // API çağrısı
    setIsFollowing(!isFollowing);
  };

  if (!user) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="user-profile-container">
      {/* Profil Üst Bilgisi */}
      <div className="profile-header">
        <div className="avatar-section">
          <img src={user.avatar} alt={user.name} className="user-avatar" />
          <button 
            className={`follow-button ${isFollowing ? 'following' : ''}`}
            onClick={handleFollow}
          >
            {isFollowing ? 'Takibi Bırak' : 'Takip Et'}
          </button>
        </div>

        <div className="profile-info">
          <h1 className="full-name">{user.fullName}</h1>
          <p className="user-bio">{user.bio}</p>
          
          <div className="social-links">
            {user.social.twitter && (
              <a href={`https://twitter.com/${user.social.twitter}`} className="social-link">
                <img src="/icons/twitter.svg" alt="Twitter" />
              </a>
            )}
            {user.social.medium && (
              <a href={`https://medium.com/${user.social.medium}`} className="social-link">
                <img src="/icons/medium.svg" alt="Medium" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="stats-grid">
        <div className="stat-card">
          <Book className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.stats.books}</span>
            <span className="stat-label">Yayınlanan Kitap</span>
          </div>
        </div>
        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.stats.followers.toLocaleString()}</span>
            <span className="stat-label">Takipçi</span>
          </div>
        </div>
        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.stats.following.toLocaleString()}</span>
            <span className="stat-label">Takip Edilen</span>
          </div>
        </div>
        <div className="stat-card">
          <Paid className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">₺{user.stats.donations.toLocaleString()}</span>
            <span className="stat-label">Toplanan Bağış</span>
          </div>
        </div>
      </div>

      {/* İletişim ve Detaylar */}
      <div className="details-section">
        <div className="contact-info">
          <h3><Email /> İletişim</h3>
          <div className="info-item">
            <span>Email:</span>
            <a href={`mailto:${user.contact.email}`}>{user.contact.email}</a>
          </div>
          <div className="info-item">
            <span>Website:</span>
            <a href={user.contact.website} target="_blank" rel="noreferrer">
              {user.contact.website}
            </a>
          </div>
        </div>

        <div className="interaction-buttons">
          <button className="message-button">
            <Chat /> Mesaj Gönder
          </button>
        </div>
      </div>

      {/* Kitaplar */}
      <div className="section">
        <h2 className="section-title">
          <Book /> Kitapları
        </h2>
        <ArticleGrid articles={books} />
      </div>

      
    </div>
  );
};

export default UserProfilePage;