import React, { useState, useEffect } from 'react';
import { Edit, Person, Email, Link, Book, People, Bookmark, Save, Cancel } from '@mui/icons-material';
import BookGrid from '../../components/BookGrid';
import './ProfilePage.css';
import { useQuery, useMutation } from '@apollo/client';
import { ME_QUERY, UPDATE_USER_MUTATION } from './graphql';
import ImageUpload from '../../components/ImageUpload';

const MyProfilePage = () => {
  const { data, loading, error } = useQuery(ME_QUERY);
  const [updateProfile, { loading: updating }] = useMutation(UPDATE_USER_MUTATION);

  const [isEditing, setIsEditing] = useState(false);
  
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    bio: '',
    profilePicture: ''
  });

  useEffect(() => {
    if (data?.me && !isEditing) {
      setEditForm({
        fullName: data.me.fullName || '',
        username: data.me.username || '',
        bio: data.me.bio || '',
        profilePicture: data.me.profilePicture || ''
      });
    }
  }, [data, isEditing]);

  const handleEditClick = () => {
    if (data?.me) {
      setEditForm({
        fullName: data.me.fullName,
        username: data.me.username,
        bio: data.me.bio,
        profilePicture: data.me.profilePicture
      });
    }
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (url) => {
    setEditForm((prev) => ({ ...prev, profilePicture: url }));
  };

  const handleSave = async () => {
    try {
      await updateProfile({
        variables: {
          username: editForm.username,
          fullName: editForm.fullName,
          bio: editForm.bio,
          profilePicture: editForm.profilePicture
        },
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Update failed:", err.message);
      alert("Profil güncellenirken hata oluştu: " + err.message);
    }
  };

  if (loading) return <div className="profile-container">Yükleniyor...</div>;
  if (error) return <div className="profile-container">Hata: {error.message}</div>;
  
  const user = data?.me;
  if (!user) return null;

  return (
    <div className="profile-container">
      {/* Profil Header */}
      <div className="profile-header">
        
        {/* --- AVATAR KISMI --- */}
        <div className="avatar-container">
          {isEditing ? (
            // Düzenleme modunda ImageUpload bileşeni görünür
            <div className="avatar-edit-wrapper">
               <ImageUpload 
                  onUploadSuccess={handleImageUpload} 
                  currentImage={editForm.profilePicture}
                  label="Değiştir"
               />
            </div>
          ) : (
            // Normal görünümde Avatar
            <div className="avatar">
              {user.profilePicture ? (
                <img 
                  src={user.profilePicture} 
                  alt={user.username} 
                  className="user-avatar-img" // CSS'te bu sınıfı tanımladık
                />
              ) : (
                <Person style={{ fontSize: '4rem' }} />
              )}
            </div>
          )}

          {/* Edit / Cancel Butonları */}
          {!isEditing ? (
            <button className="edit-button" onClick={handleEditClick} title="Düzenle">
              <Edit fontSize="small" />
            </button>
          ) : (
            <button className="edit-button cancel" onClick={handleCancelClick} title="İptal">
              <Cancel fontSize="small" />
            </button>
          )}
        </div>

        {/* --- KULLANICI BİLGİLERİ --- */}
        <div className="profile-info">
          {isEditing ? (
            /* DÜZENLEME MODU */
            <div className="edit-form-group">
              <input
                type="text"
                name="fullName"
                placeholder="Ad Soyad"
                value={editForm.fullName}
                onChange={handleInputChange}
                className="edit-input"
              />
              <input
                type="text"
                name="username"
                placeholder="Kullanıcı Adı"
                value={editForm.username}
                onChange={handleInputChange}
                className="edit-input"
              />
              <textarea
                name="bio"
                placeholder="Biyografi"
                value={editForm.bio}
                onChange={handleInputChange}
                className="edit-bio"
              />
              <button 
                className="save-button" 
                onClick={handleSave} 
                disabled={updating}
              >
                {updating ? "Kaydediliyor..." : <><Save fontSize="small" style={{marginRight:5}}/> Kaydet</>}
              </button>
            </div>
          ) : (
            /* GÖRÜNTÜLEME MODU */
            <>
              <h1 className="full-name">{user.fullName}</h1>
              <h2 className="user-name">@{user.username}</h2>
              <p className="user-bio">{user.bio || "Henüz bir biyografi eklenmemiş."}</p>
            </>
          )}
        </div>

        <div className='logout-button-container'>
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            window.location.href = '/login';
          }}>
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* --- İSTATİSTİKLER --- */}
      <div className="stats-grid">
        <div className="stat-card">
          <Book className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.usersBooks?.length || 0}</span>
            <span className="stat-label">Yayınlanan</span>
          </div>
        </div>
        
        <div className="stat-card">
          <Bookmark className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.savedBooks?.length || 0}</span>
            <span className="stat-label">Kaydedilen</span>
          </div>
        </div>

        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.followers?.length || 0}</span>
            <span className="stat-label">Takipçiler</span>
          </div>
        </div>
        
        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.following?.length || 0}</span>
            <span className="stat-label">Takip Edilen</span>
          </div>
        </div>
      </div>

      {/* --- İLETİŞİM --- */}
      <div className="info-section">
        <h2 className="section-title">İletişim Bilgileri</h2>
        <div className="info-grid">
          <div className="info-item">
            <Email className="info-icon" />
            <span>{user.email}</span>
          </div>
          {user.website && (
            <div className="info-item">
              <Link className="info-icon" />
              <a href={user.website} target="_blank" rel="noreferrer">
                {user.website}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* --- KİTAP LİSTELERİ --- */}
      <div className="info-section">
        <h2 className="section-title">Yayınlanan Kitaplar</h2>
        {user.usersBooks?.length > 0 ? (
          <BookGrid books={user.usersBooks} />
        ) : (
          <p className="empty-message">Henüz yayınlanmış bir kitap yok.</p>
        )}
      </div>

      <div className="info-section">
        <h2 className="section-title">Kaydedilen Kitaplar</h2>
        {user.savedBooks?.length > 0 ? (
          <BookGrid books={user.savedBooks} />
        ) : (
          <p className="empty-message">Henüz kaydedilen bir kitap yok.</p>
        )}
      </div>

    </div>
  );
};

export default MyProfilePage;