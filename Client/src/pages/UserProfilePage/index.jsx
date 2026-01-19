import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Person, Email, Link, Book, People, PersonAdd, PersonRemove } from '@mui/icons-material';
import BookGrid from '../../components/Books/BookGrid';
import '../MyProfilePage/ProfilePage.css'; 

import { useQuery, useMutation } from '@apollo/client';

import { GET_USER_BY_ID } from '../../graphql/queries/user'; 
import { TOGGLE_FOLLOW_MUTATION } from '../../graphql/mutations/user';

const UserProfilePage = () => {
  const { userId } = useParams(); 
  const currentUserId = localStorage.getItem('userId');

  // --- STATE ---
  // Varsayılan false, veri gelince useEffect ile güncellenecek
  const [isFollowing, setIsFollowing] = useState(false);

  // 1. QUERY
  const { data, loading, error } = useQuery(GET_USER_BY_ID, {
    variables: { id: userId },
    skip: !userId,
    fetchPolicy: "network-only" // Cache kullanma, her seferinde taze veri al
  });

  // 2. MUTATION
  const [toggleFollow, { loading: toggleLoading }] = useMutation(TOGGLE_FOLLOW_MUTATION, {
    // İşlem bitince veriyi yenile
    refetchQueries: [{ query: GET_USER_BY_ID, variables: { id: userId } }],
    awaitRefetchQueries: true, 
    onError: (err) => {
        alert("İşlem başarısız: " + err.message);
        // Hata olursa (Optimistic update'i geri al)
        setIsFollowing(prev => !prev); 
    }
  });

  const user = data?.getUserById;

  // --- KRİTİK DÜZELTME: useEffect Kontrolü ---
  // Sunucudan yeni veri (user) geldiğinde bu kod çalışır ve butonun durumunu netleştirir.
  useEffect(() => {
    if (user && user.followers && currentUserId) {
        
        // Debug için konsola yazdırıyoruz (Sorun devam ederse F12'den bakabilirsin)
        // console.log("Gelen Takipçiler:", user.followers);

        const status = user.followers.some(follower => {
            // SENARYO A: Follower direkt bir ID stringi ise (populate edilmemişse)
            if (typeof follower === 'string') {
                return follower === currentUserId;
            }
            
            // SENARYO B: Follower bir obje ise (populate edilmişse)
            if (typeof follower === 'object' && follower !== null) {
                const fId = follower.id || follower._id;
                return fId?.toString() === currentUserId.toString();
            }

            return false;
        });

        // Sadece durum gerçekten farklıysa state'i güncelle (Sonsuz döngüyü önler)
        setIsFollowing(status);
    }
  }, [user, currentUserId]); // user değiştiğinde (refetch olunca) burası tekrar çalışır

  // Sayfa başa sarma
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (loading) return <div className="profile-container"><p>Profil yükleniyor...</p></div>;
  if (error) return <div className="profile-container"><p>Hata: {error.message}</p></div>;
  if (!user) return <div className="profile-container"><p>Kullanıcı bulunamadı.</p></div>;

  const targetUserId = user.id || user._id;
  const isMe = currentUserId === targetUserId?.toString();

  const handleFollowToggle = () => {
    if (!currentUserId) return alert("Takip etmek için giriş yapmalısınız.");
    
    // Onay mekanizması
    if (isFollowing) {
        if(!window.confirm(`${user.username} kişisini takipten çıkarmak istiyor musunuz?`)) {
            return;
        }
    }

    // 1. OPTIMISTIC UPDATE: Sunucuyu beklemeden butonu anında değiştir
    setIsFollowing(!isFollowing);

    // 2. Mutation'ı çalıştır
    toggleFollow({ variables: { followId: targetUserId } });
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        
        <div className="avatar-container">
            <div className="avatar">
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={user.username} className="user-avatar-img" />
              ) : (
                <Person style={{ fontSize: '4rem' }} />
              )}
            </div>
        </div>

        <div className="profile-info">
            <h1 className="full-name">{user.fullName}</h1>
            <h2 className="user-name">@{user.username}</h2>
            <p className="user-bio">{user.bio || "Henüz bir biyografi eklenmemiş."}</p>
            
            {!isMe && (
                <button 
                    className={`follow-btn ${isFollowing ? 'following' : ''}`} 
                    onClick={handleFollowToggle}
                    disabled={toggleLoading}
                >
                    {isFollowing ? (
                        <>
                           <PersonRemove fontSize="small" /> Takibi Bırak
                        </>
                    ) : (
                        <>
                           <PersonAdd fontSize="small" /> Takip Et
                        </>
                    )}
                </button>
            )}

        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <Book className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{user.usersBooks?.length || 0}</span>
            <span className="stat-label">Yayınlanan</span>
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
              <a href={user.website} target="_blank" rel="noreferrer">{user.website}</a>
            </div>
          )}
        </div>
      </div>

      <div className="info-section">
        <h2 className="section-title">Yayınlanan Kitaplar</h2>
        {user.usersBooks?.length > 0 ? (
          <BookGrid books={user.usersBooks} />
        ) : (
          <p className="empty-message">Bu kullanıcı henüz kitap yayınlamamış.</p>
        )}
      </div>

    </div>
  );
};

export default UserProfilePage;