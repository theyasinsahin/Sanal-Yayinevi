import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Person, Email, Link as LinkIcon, 
  Book, Bookmark, 
  Edit, Save, Cancel, 
  PersonAdd, PersonRemove, Logout,
  Verified, TrendingUp, Star
} from '@mui/icons-material';

import { useAuth } from '../../context/AuthContext';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { UPDATE_USER_MUTATION, TOGGLE_FOLLOW_MUTATION } from '../../graphql/mutations/user';

import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Textarea } from '../../components/UI/Textarea';
import { Toast } from '../../components/UI/Toast';
import BookGrid from '../../components/Books/BookGrid';
import ImageUpload from '../../components/ImageUpload';

import './UserProfile.css';

const UserProfile = () => {
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

  // Determine target user
  const targetId = userId || authUser?.id;
  const isMe = authUser && targetId === authUser.id;

  // Queries
  const { data, loading, error, refetch } = useQuery(GET_USER_BY_ID, {
    variables: { id: targetId },
    skip: !targetId,
    fetchPolicy: 'network-only'
  });

  const profile = data?.getUserById;

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
    refetchQueries: [{ query: GET_USER_BY_ID, variables: { id: targetId } }],
    onError: (err) => showToast(err.message, 'error')
  });

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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handlers
  const showToast = (message, type = 'info') => 
    setToast({ show: true, message, type });

  const handleFollowToggle = async () => {
    if (!authUser) {
      showToast("Please log in to follow", 'warning');
      return;
    }
    await toggleFollow({ variables: { followId: targetId } });
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

  const isFollowing = profile?.followers?.some(f => {
    const fId = typeof f === 'object' ? f.id : f;
    return fId === authUser?.id;
  });

  // Calculate stats
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

  if (loading) return <MainLayout><div className="loading-state"><div className="loading-spinner"></div></div></MainLayout>;
  if (error || !profile) return <MainLayout><div className="error-state"><Typography variant="h3">User not found</Typography></div></MainLayout>;

  return (
    <MainLayout>
      <div className="profile-page">
        <Container maxWidth="5xl">
          
          {/* HEADER CARD (İstatistikler Artık Burada) */}
          <div className="profile-header-card">
            
            {/* Avatar - Sol Taraf */}
            <div className="header-left">
              <div className="avatar-wrapper-lg">
                {isEditing ? (
                  <ImageUpload 
                    currentImage={editForm.profilePicture}
                    onUploadSuccess={(url) => setEditForm(prev => ({...prev, profilePicture: url}))}
                  />
                ) : profile.profilePicture ? (
                  <img src={profile.profilePicture} alt={profile.username} className="avatar-img-lg" />
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

            {/* Info - Orta Taraf */}
            <div className="header-center">
              {isEditing ? (
                /* ... Edit Form (Değişmedi, aynı kalabilir) ... */
                <div className="edit-form-grid">
                   {/* Form inputları buraya gelecek (kod kısalığı için özet geçtim) */}
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

                  {/* Contact Info */}
                  <div className="contact-info">
                    {/* Email ve Website buraya */}
                    <div className="contact-item"><Email fontSize="small" /><span>{profile.email}</span></div>
                  </div>

                  {/* YENİ YERLEŞİM: İSTATİSTİKLER BURADA (SADE VE BASİT) */}
                  <div className="profile-stats-row">
                    <div className="stat-item">
                      <span className="stat-value">{profile.usersBooks?.length || 0}</span>
                      <span className="stat-label">Books</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                      <span className="stat-value">{formatNumber(profile.followers?.length || 0)}</span>
                      <span className="stat-label">Followers</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat-item">
                      <span className="stat-value">{formatNumber(profile.following?.length || 0)}</span>
                      <span className="stat-label">Following</span>
                    </div>
                    
                    {/* Sadece bana özel istatistik */}
                    {isMe && (
                      <>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                          <span className="stat-value">{profile.savedBooks?.length || 0}</span>
                          <span className="stat-label">Saved</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Ekstra detaylar (Views/Likes) - Opsiyonel olarak daha küçük alt satırda */}
                  <div className="mini-stats-row">
                     <span><TrendingUp fontSize="small"/> {formatNumber(totalViews)} views</span>
                     <span>&bull;</span>
                     <span><Star fontSize="small"/> {formatNumber(totalLikes)} likes</span>
                  </div>

                </>
              )}
            </div>

            {/* Actions - Sağ Taraf */}
            <div className="header-right">
              {isMe ? (
                !isEditing && (
                  <div className="my-actions">
                    <Button variant="outline" onClick={() => setIsEditing(true)} icon={<Edit fontSize="small"/>}>Edit</Button>
                    <Button variant="outline" onClick={handleLogout} icon={<Logout fontSize="small"/>}>Logout</Button>
                  </div>
                )
              ) : (
                <Button 
                  variant={isFollowing ? 'outline' : 'primary'} 
                  onClick={handleFollowToggle}
                  isLoading={followLoading}
                  icon={isFollowing ? <PersonRemove/> : <PersonAdd/>}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </Button>
              )}
            </div>
          </div>

          {/* TABS (Aynı) */}
          {isMe && (
            <div className="tabs-wrapper">
              <button className={`tab-btn ${activeTab === 'published' ? 'active' : ''}`} onClick={() => setActiveTab('published')}>
                <Book /><span>Published</span>
              </button>
              <button className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
                <Bookmark /><span>Saved</span>
              </button>
            </div>
          )}

          {/* BOOKS SECTION (Aynı) */}
          <div className="books-section">
            {!isMe || activeTab === 'published' ? (
              <BookGrid books={profile.usersBooks} />
            ) : (
              <BookGrid books={profile.savedBooks} />
            )}
          </div>

        </Container>
      </div>
      <Toast isVisible={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({...toast, show: false})} />
    </MainLayout>
  );
};

export default UserProfile;