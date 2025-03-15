// ProfilePage.jsx
import React, { useState } from 'react';
import { Edit, Person, Email, Link, Book, Paid, People } from '@mui/icons-material';
import ArticleGrid from '../../components/ArticleGrid';
import './ProfilePage.css';
import { sampleBooks } from '../../Data/sampleBooks';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: 'Eylül Kaya',
    bio: 'Fantastik edebiyat tutkunu ve yeni nesil yazar',
    email: 'eylul@yaziyolu.com',
    website: 'https://eylulkaya.com',
    stats: {
      books: 4,
      followers: 2450,
      donations: 12500
    },
    social: {
      twitter: '@eylulkaya',
      instagram: 'eylul.kaya'
    },
    books:[1,2,3],
  });

  const books = sampleBooks.filter(book => userData.books.includes(book.id));

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="profile-container">
      {/* Profil Header */}
      <div className="profile-header">
        <div className="avatar-container">
          <div className="avatar">
            <Person fontSize="inherit" />
          </div>
          <button 
            className="edit-button"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit fontSize="small" />
          </button>
        </div>
        
        <div className="profile-info">
          {isEditing ? (
            <input
              type="text"
              name="name"
              value={userData.name}
              onChange={handleInputChange}
              className="edit-input"
            />
          ) : (
            <h1 className="user-name">{userData.name}</h1>
          )}
          
          {isEditing ? (
            <textarea
              name="bio"
              value={userData.bio}
              onChange={handleInputChange}
              className="edit-bio"
            />
          ) : (
            <p className="user-bio">{userData.bio}</p>
          )}
        </div>
      </div>

      {/* İstatistikler */}
      <div className="stats-grid">
        <div className="stat-card">
          <Book className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{userData.stats.books}</span>
            <span className="stat-label">Yayınlanan Kitap</span>
          </div>
        </div>
        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{userData.stats.followers}</span>
            <span className="stat-label">Takipçi</span>
          </div>
        </div>
        <div className="stat-card">
          <Paid className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">₺{userData.stats.donations.toLocaleString()}</span>
            <span className="stat-label">Toplam Bağış</span>
          </div>
        </div>
      </div>

      {/* İletişim Bilgileri */}
      <div className="info-section">
        <h2 className="section-title">İletişim Bilgileri</h2>
        <div className="info-grid">
          <div className="info-item">
            <Email className="info-icon" />
            <span>{userData.email}</span>
          </div>
          <div className="info-item">
            <Link className="info-icon" />
            <a href={userData.website} target="_blank" rel="noreferrer">
              {userData.website}
            </a>
          </div>
        </div>
      </div>

      {/* Kitaplar */}
      <div className="info-section">
        <h2 className="section-title">Kitapları</h2>
        <ArticleGrid articles={books} />
      </div>
    </div>
  );
};

export default ProfilePage;