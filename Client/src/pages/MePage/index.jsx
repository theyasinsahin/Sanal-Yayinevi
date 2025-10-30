import React, { useState, useEffect } from 'react';
import { Edit, Person, Email, Link, Book, Paid, People } from '@mui/icons-material';
import ArticleGrid from '../../components/BookGrid';
import './ProfilePage.css';
import { useQuery, useMutation } from '@apollo/client';
import { ME_QUERY, UPDATE_USER_MUTATION } from './graphql';



const MePage = () => {
  const { data, loading, error } = useQuery(ME_QUERY);
  const [updateProfile] = useMutation(UPDATE_USER_MUTATION);

  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState(null);

  const handleSave = async () => {
    try {
      const { data: updatedData } = await updateProfile({
        variables: {
          username: userData.username,
          fullName: userData.fullName,
          bio: userData.bio,
        },
      });
      setUserData(prev => ({
        ...prev,
        ...updatedData.updateProfile,
      }));
      setIsEditing(false);
    } catch (err) {
      console.error("Update failed:", err.message);
    }
  };

  useEffect(() => {
    if (data && data.me) {
      setUserData(data.me);
    }
  }, [data]);

  if (loading) return <div className="profile-container">Yükleniyor...</div>;
  if (error) return <div className="profile-container">Hata: {error.message}</div>;
  if (!userData) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({
      ...prev,
      [name]: value,
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
          <button className="edit-button" onClick={() => setIsEditing(!isEditing)}>
            <Edit fontSize="small" />
          </button>
        </div>

        <div className="profile-info">
          {isEditing ? (
            <input
              type="text"
              name="fullName"
              value={userData.fullName}
              onChange={handleInputChange}
              className="edit-input"
            />
          ) : (
            <h1 className="full-name">{userData.fullName}</h1>
          )}

          {isEditing ? (
            <input
              type="text"
              name="username"
              value={userData.username}
              onChange={handleInputChange}
              className="edit-input"
            />
          ) : (
            <h1 className="user-name">@{userData.username}</h1>
          )}

          {isEditing ? (
            <div>
              <textarea
                name="bio"
                value={userData.bio}
                onChange={handleInputChange}
                className="edit-bio"
              />

              <button className="save-button" onClick={handleSave}>
                Kaydet
              </button>
            </div>
          ) : (
            <p className="user-bio">{userData.bio}</p>
          )}

        </div>

        <div className='logout-button'>
          <button onClick={() => {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }}>
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="stats-grid">
        <div className="stat-card">
          <Book className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{userData.usersBooks.length || 0}</span>
            <span className="stat-label">Yayınlanan Kitap</span>
          </div>
        </div>
        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{userData.followers?.length || 0}</span>
            <span className="stat-label">Takipçi</span>
          </div>
        </div>
        <div className="stat-card">
          <Paid className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">₺{(userData.donations || 0).toLocaleString()}</span>
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
          {userData.website && (
            <div className="info-item">
              <Link className="info-icon" />
              <a href={userData.website} target="_blank" rel="noreferrer">
                {userData.website}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Kitaplar */}
        
      <div className="info-section">
        <h2 className="section-title">Kitapları</h2>
        {userData.usersBooks?.length > 0 ? (
          <ArticleGrid bookIds={userData.usersBooks} />
        ) : (
          <p>Henüz kitap eklenmemiş.</p>
        )}
      </div>

    </div>
  );
};

export default MePage;
