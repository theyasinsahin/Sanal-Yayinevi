import { useGetOrCreateConversation } from '../../hooks/useMessages';

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Person, Email, Link as LinkIcon, 
  Book, Bookmark, 
  Edit, Save, Cancel, Close,
  PersonAdd, PersonRemove, Logout,
  Verified, TrendingUp, Star, Chat, Settings
} from '@mui/icons-material';

import { useAuth } from '../../context/AuthContext';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { UPDATE_USER_MUTATION, TOGGLE_FOLLOW_MUTATION } from '../../graphql/mutations/user';
import { GET_USER_SCORE, GET_USER_BADGES } from '../../graphql/queries/score';
import { GET_FOLLOWED_BOOKS } from '../../graphql/queries/bookFollow';


import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Textarea } from '../../components/UI/Textarea';
import { Toast } from '../../components/UI/Toast';
import BookCarousel from '../../components/Books/BookCarousel';
import ImageUpload from '../../components/ImageUpload';

import { FormatQuote } from '@mui/icons-material';
import { GET_QUOTES_BY_USER } from '../../graphql/queries/quote';
import QuoteCard from '../../components/Quote/QuoteCard';
import UserSettings from '../../components/Settings/UserSettings';

import './UserProfile.css';

const UserProfile = () => {
  const [optimisticFollowing, setOptimisticFollowing] = useState(null);
  const [optimisticFollowerCount, setOptimisticFollowerCount] = useState(null);

  const { userId } = useParams();
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '', username: '', bio: '', profilePicture: '', website: ''
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [activeTab, setActiveTab] = useState('published');
  
  // YENİ: Takipçi/Takip Edilen Modalı için State
  const [followModal, setFollowModal] = useState({ show: false, type: 'followers' });

  // Determine target user
  const targetId = userId || authUser?.id;
  const isMe = authUser && targetId === authUser.id;

  // Queries
  const { data, loading, error, refetch } = useQuery(GET_USER_BY_ID, {
    variables: { id: targetId },
    skip: !targetId,
    fetchPolicy: 'network-only'
  });

  const { data: quotesData } = useQuery(GET_QUOTES_BY_USER, {
    variables: { userId: targetId },
    skip: !targetId,
  });
  const userQuotes = quotesData?.getQuotesByUser || [];

  const profile = data?.getUserById;

  const { data: scoreData } = useQuery(GET_USER_SCORE, {
    variables: { userId: targetId },
    skip: !targetId,
  });

  const { data: badgeData } = useQuery(GET_USER_BADGES, {
    variables: { userId: targetId },
    skip: !targetId,
  });

  const userScore = scoreData?.getUserScore;
  const userBadges = badgeData?.getUserBadges || [];

  const { data: followedBooksData } = useQuery(GET_FOLLOWED_BOOKS, {
  skip: !isMe,
});
const followedBooks = followedBooksData?.getFollowedBooks || [];

  // Mutations
  const [updateUser, { loading: updating }] = useMutation(UPDATE_USER_MUTATION, {
    onCompleted: () => {
      setIsEditing(false);
      showToast('Profile updated successfully', 'success');
      refetch();
    },
    onError: (err) => showToast(err.message, 'error')
  });

  const [toggleFollow, { loading: followLoading }] = useMutation(TOGGLE_FOLLOW_MUTATION, {
    onError: (err) => showToast(err.message, 'error')
  });

  // Hooks
  const { getOrCreateConversation, loading: convLoading } = useGetOrCreateConversation();

  // Effects
  useEffect(() => {
    if (isEditing && profile) {
      setEditForm({
        fullName: profile.fullName || '',
        username: profile.username || '',
        bio: profile.bio || '',
        profilePicture: profile.profilePicture || '',
        website: profile.website || ''
      });
    }
  }, [isEditing, profile]);

  // HAYALET HESAP KONTROLÜ
  useEffect(() => {
    if (!loading && !profile && isMe) {
      showToast("Oturumunuz geçersiz. Lütfen tekrar giriş yapın.", "error");
      logout();
      navigate('/login');
    }
  }, [loading, profile, isMe, logout, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handlers
  const showToast = (message, type = 'info') => 
    setToast({ show: true, message, type });

  const handleFollowToggle = async () => {
    if (!authUser) {
      showToast("Mesaj göndermek için giriş yapmalısınız.", 'warning');
      return;
    }

    const currentlyFollowing = optimisticFollowing !== null ? optimisticFollowing : isFollowing;
    const currentCount = optimisticFollowerCount !== null 
      ? optimisticFollowerCount 
      : (profile?.followers?.length || 0);

    setOptimisticFollowing(!currentlyFollowing);
    setOptimisticFollowerCount(currentlyFollowing ? currentCount - 1 : currentCount + 1);

    try {
      await toggleFollow({ variables: { followId: targetId } });
    } catch (err) {
      setOptimisticFollowing(currentlyFollowing);
      setOptimisticFollowerCount(currentCount);
      showToast("İşlem başarısız", 'error');
    }
  };

  const handleMessageClick = async () => {
    if (!authUser) {
      showToast('Mesaj göndermek için giriş yapmalısınız.', 'warning');
      return;
    }
    try {
      const conversation = await getOrCreateConversation(targetId);
      if (conversation?.id) {
        navigate(`/messages/${conversation.id}`);
      }
    } catch (err) {
      showToast('Konuşma başlatılamadı.', 'error');
    }
  };

  const handleSave = async () => {
    if (!editForm.username.trim()) {
      showToast("Username required", 'error');
      return;
    }
    await updateUser({ variables: { ...editForm } });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isFollowingFromServer = profile?.followers?.some(f => {
    const fId = typeof f === 'object' ? f.id : f;
    return fId === authUser?.id;
  });

  const isFollowing = optimisticFollowing !== null ? optimisticFollowing : isFollowingFromServer;
  const followerCount = optimisticFollowerCount !== null 
    ? optimisticFollowerCount 
    : (profile?.followers?.length || 0);

  const totalViews = profile?.usersBooks?.reduce((sum, book) => 
    sum + (book.stats?.views || 0), 0) || 0;
  const totalLikes = profile?.usersBooks?.reduce((sum, book) => 
    sum + (book.stats?.likes || 0), 0) || 0;

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const publishedBooks = profile?.usersBooks?.filter(b => b.status !== 'DRAFT') || [];
  const draftBooks = profile?.usersBooks?.filter(b => b.status === 'DRAFT') || [];
  
  // YENİ: Modal Yardımcı Fonksiyonları
  const openModal = (type) => setFollowModal({ show: true, type });
  const closeModal = () => setFollowModal({ show: false, type: 'followers' });

  if (loading) return <MainLayout><div className="loading-state"><div className="loading-spinner"></div></div></MainLayout>;

  if (error || !profile) {
    return (
      <MainLayout>
        <div className="error-state" style={{ textAlign: 'center', padding: '100px 20px' }}>
          <Typography variant="h3" weight="bold">Kullanıcı Bulunamadı</Typography>
          <Typography variant="body" color="muted" className="mt-2 mb-4">
            Aradığınız profil silinmiş veya hiç var olmamış olabilir.
          </Typography>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <Button variant="primary" onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
            {isMe && <Button variant="outline" onClick={handleLogout} icon={<Logout />}>Çıkış Yap</Button>}
          </div>
        </div>
      </MainLayout>
    );
  }
  return (
    <MainLayout>
      <div className="profile-page">
        <Container maxWidth="5xl">
          
          <div className="profile-header-card">
            
            <div className="header-left">
              <div className="avatar-wrapper-lg">
                {isEditing ? (
                  <ImageUpload 
                    currentImage={editForm.profilePicture}
                    onUploadSuccess={(url) => setEditForm(prev => ({...prev, profilePicture: url}))}
                  />
                ) : profile.profilePicture ? (
                  <img src={profile.profilePicture} alt={profile.username} className="avatar-img-lg" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.style.display = 'none'; 
                    }}/>
                ) : (
                  <div className="avatar-placeholder-wrapper"><Person className="avatar-placeholder" /></div>
                )}
              </div>
              
              {!isEditing && profile.isVerified && (
                <div className="verified-badge">
                  <Verified style={{ fontSize: '1rem' }} /><span>Verified</span>
                </div>
              )}
            </div>

            <div className="header-center">
              {isEditing ? (
                <div className="edit-form-grid">
                   <Input label="Full Name" value={editForm.fullName} onChange={(e) => setEditForm({...editForm, fullName: e.target.value})} />
                   <Input label="Username" value={editForm.username} onChange={(e) => setEditForm({...editForm, username: e.target.value})} required />
                   <Textarea label="Bio" value={editForm.bio} onChange={(e) => setEditForm({...editForm, bio: e.target.value})} rows={3} />
                   <div className="edit-actions">
                     <Button variant="primary" onClick={handleSave} isLoading={updating} icon={<Save fontSize="small"/>}>Save</Button>
                     <Button variant="outline" onClick={() => setIsEditing(false)} icon={<Cancel fontSize="small"/>}>Cancel</Button>
                   </div>
                </div>
              ) : (
                <>
                  <div className="name-section">
                    <Typography variant="h2" weight="bold">{profile.fullName}</Typography>
                    <Typography variant="body" color="muted" className="username-text">@{profile.username}</Typography>
                  </div>
                  
                  {profile.bio && (
                    <Typography variant="body" className="bio-text">{profile.bio}</Typography>
                  )}

                  {userBadges.length > 0 && (
                    <div className="profile-badges">
                      {userBadges.map(ub => (
                        <span key={ub.id} className="profile-badge" data-tooltip={`${ub.badge.name}: ${ub.badge.description}`}>
                          {ub.badge.icon}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="contact-info">
                    <div className="contact-item"><Email fontSize="small" /><span>{profile.email}</span></div>
                  </div>

                  <div className="profile-stats-row">
                    <div className="stat-item-profile">
                      {/* DÜZELTME: Başkasının profilinde taslaklar carousel'de
                          gösterilmiyor (publishedBooks), ama sayaç tüm
                          kitapları (taslaklar dahil) sayıyordu — bu da
                          "3 Books" yazıp yalnızca 2 kitap göstermeye
                          sebep oluyordu. Artık sayaç, ziyaretçiye göre
                          gerçekten görünen kitap sayısını yansıtıyor. */}
                      <span className="stat-value">
                        {isMe ? (profile.usersBooks?.length || 0) : publishedBooks.length}
                      </span>
                      <span className="stat-label">Books</span>
                    </div>
                    <div className="stat-divider"></div>
                    
                    {/* YENİ: Tıklanabilir Followers */}
                    <div className="stat-item-profile clickable" onClick={() => openModal('followers')}>
                      <span className="stat-value">{formatNumber(followerCount)}</span>
                      <span className="stat-label">Followers</span>
                    </div>
                    <div className="stat-divider"></div>

                    {/* YENİ: Tıklanabilir Following */}
                    <div className="stat-item-profile clickable" onClick={() => openModal('following')}>
                      <span className="stat-value">{formatNumber(profile.following?.length || 0)}</span>
                      <span className="stat-label">Following</span>
                    </div>
                    <div className="stat-divider"></div>
                    
                    <div className="stat-item-profile">
                      <span className="stat-value">⭐ {userScore?.totalPoints || 0}</span>
                      <span className="stat-label">Puan</span>
                    </div>
                    
                    {isMe && (
                      <>
                        <div className="stat-divider"></div>
                        <div className="stat-item-profile">
                          <span className="stat-value">{profile.savedBooks?.length || 0}</span>
                          <span className="stat-label">Saved</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="mini-stats-row">
                     <span><TrendingUp fontSize="small"/> {formatNumber(totalViews)} views</span>
                     <span>&bull;</span>
                     <span><Star fontSize="small"/> {formatNumber(totalLikes)} likes</span>
                  </div>
                </>
              )}
            </div>

            <div className="header-right">
              {isMe ? (
                !isEditing && (
                  <div className="my-actions">
                    <Button variant="outline" onClick={() => setIsEditing(true)} icon={<Edit fontSize="small"/>}>Edit</Button>
                    <Button variant="outline" onClick={handleLogout} icon={<Logout fontSize="small"/>}>Logout</Button>
                  </div>
                )
              ) : (
                <div className="other-actions">
                  <Button
                    variant={isFollowing ? 'outline' : 'primary'}
                    onClick={handleFollowToggle}
                    isLoading={followLoading}
                    icon={isFollowing ? <PersonRemove /> : <PersonAdd />}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleMessageClick}
                    isLoading={convLoading}
                    icon={<Chat fontSize="small" />}
                  >
                    Mesaj Gönder
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* DÜZELTME: Tab çubuğu artık ziyaretçiler için de gösteriliyor
              (sadece isMe değil), ama sekmeler filtreleniyor. Kaydedilenler,
              Taslaklar, Takip ve Ayarlar profil sahibine özel kalıyor —
              Takip özellikle GET_FOLLOWED_BOOKS sorgusu bir userId parametresi
              almadığı için (her zaman giriş yapmış kullanıcıyı baz alıyor),
              backend değişmeden ziyaretçiye açılamaz. Alıntılar ise
              GET_QUOTES_BY_USER zaten targetId ile sorgulandığı için
              herkese güvenle açılabiliyor. */}
          <div className="tabs-wrapper">
            <button className={`tab-btn ${activeTab === 'published' ? 'active' : ''}`} onClick={() => setActiveTab('published')}>
              <Book /><span>Yayınlananlar</span>
            </button>

            {isMe && (
              <button className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
                <Bookmark /><span>Kitaplık</span>
              </button>
            )}

            {isMe && (
              <button className={`tab-btn ${activeTab === 'drafts' ? 'active' : ''}`} onClick={() => setActiveTab('drafts')}>
                <Edit /><span>Taslaklar</span>
                {draftBooks?.length > 0 && (
                  <span className="draft-count-badge">{draftBooks.length}</span>
                )}
              </button>
            )}

            <button className={`tab-btn ${activeTab === 'quotes' ? 'active' : ''}`} onClick={() => setActiveTab('quotes')}>
              <FormatQuote /><span>Alıntılar</span>
              {userQuotes.length > 0 && (
                <span className="draft-count-badge">{userQuotes.length}</span>
              )}
            </button>

            {isMe && (
              <button 
                className={`tab-btn ${activeTab === 'followed' ? 'active' : ''}`} 
                onClick={() => setActiveTab('followed')}
              >
                <span>Takip</span>
                {followedBooks.length > 0 && (
                  <span className="draft-count-badge">{followedBooks.length}</span>
                )}
              </button>
            )}

            {isMe && (
              <button
                className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings fontSize="small" />
                <span>Ayarlar</span>
              </button>
            )}
          </div>

          <div className="books-section">
            {activeTab === 'published' && (
              <BookCarousel books={publishedBooks} loading={loading} />
            )}
            {isMe && activeTab === 'saved' && (
              <BookCarousel books={profile.savedBooks} loading={loading} />
            )}
            {isMe && activeTab === 'drafts' && (
              <BookCarousel books={draftBooks} loading={loading} />
            )}
            {activeTab === 'quotes' && (
              <div className="quotes-tab-grid">
                {userQuotes.length === 0 ? (
                  <Typography variant="body" color="muted">Henüz alıntı yok.</Typography>
                ) : (
                  userQuotes.map(q => <QuoteCard key={q.id} quote={q} />)
                )}
              </div>
            )}
            {isMe && activeTab === 'followed' && (
              <BookCarousel books={followedBooks} loading={false} />
            )}

            {isMe && activeTab === 'settings' && (
              <UserSettings
                profile={profile}
                onUpdate={() => refetch()}
                showToast={showToast}
              />
            )}
          </div>

        </Container>
      </div>

      {/* YENİ: Takipçiler / Takip Edilenler Modalı */}
      {followModal.show && (
        <div className="follow-modal-overlay" onClick={closeModal}>
          <div className="follow-modal-content" onClick={e => e.stopPropagation()}>
            <div className="follow-modal-header">
              <Typography variant="h5" weight="bold">
                {followModal.type === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
              </Typography>
              <button className="close-modal-btn" onClick={closeModal}><Close /></button>
            </div>
            
            <div className="follow-modal-list">
              {(() => {
                const listData = followModal.type === 'followers' ? profile.followers : profile.following;
                
                if (!listData || listData.length === 0) {
                  return (
                    <div className="follow-modal-empty">
                      <Typography color="muted">Burada henüz kimse yok.</Typography>
                    </div>
                  );
                }

                return listData.map((user) => {
                  // Eger API sadece ID dönüyorsa listeleme kisitli olur, ideal olan obje donmesidir.
                  const uid = typeof user === 'object' ? user.id : user;
                  const uName = typeof user === 'object' ? user.fullName : 'Kullanıcı';
                  const uUsername = typeof user === 'object' ? user.username : uid;
                  const uPic = typeof user === 'object' ? user.profilePicture : null;

                  return (
                    <div 
                      key={uid} 
                      className="follow-user-item" 
                      onClick={() => {
                        closeModal();
                        navigate(`/user/${uid}`);
                      }}
                    >
                      <div className="follow-user-avatar">
                        {uPic ? (
                          <img src={uPic} alt={uUsername} referrerPolicy="no-referrer" />
                        ) : (
                          <Person />
                        )}
                      </div>
                      <div className="follow-user-info">
                        <span className="follow-user-name">{uName}</span>
                        <span className="follow-user-username">@{uUsername}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({...toast, show: false})} />
    </MainLayout>
  );
};

export default UserProfile;