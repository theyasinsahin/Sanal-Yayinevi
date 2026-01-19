import React, { useState, useEffect } from 'react';
import { Edit, Person, Email, Link as LinkIcon, Book, People, Bookmark, Save, Cancel } from '@mui/icons-material';
import BookGrid from '../../components/Books/BookGrid';
import './ProfilePage.css'; // CSS dosyanın adı buysa
import { useQuery, useMutation } from '@apollo/client';
import { UPDATE_USER_MUTATION } from './graphql'; // Dosya yolunu kontrol et
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import ImageUpload from '../../components/ImageUpload';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

const MyProfilePage = () => {
  const navigate = useNavigate();

  // 1. AuthContext'ten verileri al
  const { user, loading: authLoading } = useAuth();

  // 2. ID Belirleme (Güvenli Yöntem)
  // LocalStorage'dan "undefined" veya "null" stringi gelirse onu null kabul et.
  const storedId = localStorage.getItem('userId');
  const safeStoredId = (storedId && storedId !== 'undefined' && storedId !== 'null') ? storedId : null;
  
  const userId = user?.id || safeStoredId;

  // 3. Sorgu
  const { data, loading, error } = useQuery(GET_USER_BY_ID, { 
    variables: { id: userId },
    skip: !userId, // ID yoksa sorgu atma
    fetchPolicy: 'network-only',
    onError: (err) => {
        console.log("Query Error Detayı:", err);
    }
  });

  const [updateProfile, { loading: updating }] = useMutation(UPDATE_USER_MUTATION);

  const [isEditing, setIsEditing] = useState(false);
  
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    bio: '',
    profilePicture: ''
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (data && data.getUserById && !isEditing) {
      const u = data.getUserById;
      setEditForm({
        fullName: u.fullName || '',
        username: u.username || '',
        bio: u.bio || '',
        profilePicture: u.profilePicture || ''
      });
    }
  }, [data, isEditing]);

  // --- KRİTİK DÜZELTME BURADA ---
  // 1. Önce AuthContext'in yüklenmesini bekle
  if (authLoading) {
      return <div className="profile-container" style={{textAlign:'center', marginTop: 50}}>Oturum kontrol ediliyor...</div>;
  }

  // 2. Auth bitti ama userId hala yoksa -> Login'e at
  if (!userId) {
      // Yönlendirme yan etkisi (side-effect) olduğu için render içinde setTimeout ile veya useEffect ile yapmak daha güvenlidir
      setTimeout(() => navigate('/login'), 0);
      return <div className="profile-container">Yönlendiriliyor...</div>;
  }

  // 3. Query Yükleniyor mu?
  if (loading) return <div className="profile-container" style={{textAlign:'center', marginTop: 50}}>Profil yükleniyor...</div>;

  // 4. Query Hatası Var mı?
  if (error) {
    console.error("Profil Yükleme Hatası:", error);
    return (
        <div className="p-10 text-center text-red-600 profile-container">
            <p className="font-bold text-lg">Profil bilgileri alınamadı.</p>
            <p className="text-sm text-gray-500 mt-2">{error.message}</p>
            
            <button 
                onClick={() => {
                    localStorage.clear();
                    window.location.href = '/login';
                }}
                className="mt-4 px-6 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
            >
                Çıkış Yap ve Tekrar Dene
            </button>
        </div>
    );
  }  

  const profile = data?.getUserById;

  // 5. Veri Yok mu?
  if (!profile) return <div className="profile-container" style={{textAlign:'center'}}>Kullanıcı verisi bulunamadı.</div>;

  // --- HANDLERS ---
  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    // İptal edince formu tekrar orijinal veriye döndür
    if (profile) {
        setEditForm({
            fullName: profile.fullName || '',
            username: profile.username || '',
            bio: profile.bio || '',
            profilePicture: profile.profilePicture || ''
        });
    }
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
        // Mutation sonrası query'yi yenile ki UI güncellensin
        refetchQueries: [{ query: GET_USER_BY_ID, variables: { id: userId } }]
      });
      setIsEditing(false);
      alert("Profil başarıyla güncellendi!");
    } catch (err) {
      console.error("Update failed:", err.message);
      alert("Hata: " + err.message);
    }
  };

  return (
    <div className="profile-container">
      {/* Profil Header */}
      <div className="profile-header">
        
        {/* --- AVATAR KISMI --- */}
        <div className="avatar-container">
          {isEditing ? (
            <div className="avatar-edit-wrapper">
               <ImageUpload 
                  onUploadSuccess={handleImageUpload} 
                  currentImage={editForm.profilePicture}
                  label="Değiştir"
               />
            </div>
          ) : (
            <div className="avatar">
              {profile.profilePicture ? (
                <img 
                  src={profile.profilePicture} 
                  alt={profile.username} 
                  className="user-avatar-img" 
                  onError={(e) => { e.target.style.display='none'; }} // Resim kırık ise gizle
                />
              ) : null}
              {/* Resim yoksa veya yüklenemezse ikon göster (Resim varsa üstüne binmemesi için CSS kontrolü gerekir ama burada JS ile hallettik) */}
              {(!profile.profilePicture) && <Person style={{ fontSize: '4rem', color: '#ccc' }} />}
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
                {updating ? "..." : <><Save fontSize="small" style={{marginRight:5}}/> Kaydet</>}
              </button>
            </div>
          ) : (
            /* GÖRÜNTÜLEME MODU */
            <>
              <h1 className="full-name">{profile.fullName}</h1>
              <h2 className="user-name">@{profile.username}</h2>
              <p className="user-bio">{profile.bio || "Henüz bir biyografi eklenmemiş."}</p>
            </>
          )}
        </div>

        <div className='logout-button-container'>
          <button className="logout-btn" onClick={() => {
            localStorage.clear();
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
            <span className="stat-value">{profile.usersBooks?.length || 0}</span>
            <span className="stat-label">Yayınlanan</span>
          </div>
        </div>
        
        <div className="stat-card">
          <Bookmark className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{profile.savedBooks?.length || 0}</span>
            <span className="stat-label">Kaydedilen</span>
          </div>
        </div>

        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{profile.followers?.length || 0}</span>
            <span className="stat-label">Takipçiler</span>
          </div>
        </div>
        
        <div className="stat-card">
          <People className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{profile.following?.length || 0}</span>
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
            <span>{profile.email}</span>
          </div>
          {profile.website && (
            <div className="info-item">
              <LinkIcon className="info-icon" />
              <a href={profile.website} target="_blank" rel="noreferrer">
                {profile.website}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* --- KİTAP LİSTELERİ --- */}
      <div className="info-section">
        <h2 className="section-title">Yayınlanan Kitaplar</h2>
        {profile.usersBooks?.length > 0 ? (
          <BookGrid books={profile.usersBooks} />
        ) : (
          <p className="empty-message">Henüz yayınlanmış bir kitap yok.</p>
        )}
      </div>

      <div className="info-section">
        <h2 className="section-title">Kaydedilen Kitaplar</h2>
        {profile.savedBooks?.length > 0 ? (
          <BookGrid books={profile.savedBooks} />
        ) : (
          <p className="empty-message">Henüz kaydedilen bir kitap yok.</p>
        )}
      </div>

    </div>
  );
};

export default MyProfilePage;