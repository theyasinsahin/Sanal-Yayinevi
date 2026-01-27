import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Person, Email, Link as LinkIcon, 
  Book, People, Bookmark, 
  Edit, Save, Cancel, 
  PersonAdd, PersonRemove, Logout,
  Verified,
  TrendingUp,
  Star
} from '@mui/icons-material';

// --- CONTEXT & UTILS ---
import { useAuth } from '../../context/AuthContext';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { UPDATE_USER_MUTATION, TOGGLE_FOLLOW_MUTATION } from '../../graphql/mutations/user';

// --- UI KIT ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Textarea } from '../../components/UI/Textarea';
import { Badge } from '../../components/UI/Badge';
import { Toast } from '../../components/UI/Toast';

// --- COMPONENTS ---
import BookGrid from '../../components/Books/BookGrid';
import ImageUpload from '../../components/ImageUpload';

import './UserProfile.css';

const UserProfile = () => {
  const { userId } = useParams();
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  // --- STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '', username: '', bio: '', profilePicture: '', website: ''
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [activeTab, setActiveTab] = useState('published'); // 'published' | 'saved'

  // Determine which user to show
  const targetId = userId || authUser?.id;
  const isMe = authUser && targetId === authUser.id;

  // --- QUERIES ---
  const { data, loading, error, refetch } = useQuery(GET_USER_BY_ID, {
    variables: { id: targetId },
    skip: !targetId,
    fetchPolicy: 'network-only'
  });

  const profile = data?.getUserById;

  // --- MUTATIONS ---
  const [updateUser, { loading: updating }] = useMutation(UPDATE_USER_MUTATION, {
    onCompleted: () => {
      setIsEditing(false);
      showToast('Profile updated successfully!', 'success');
      refetch();
    },
    onError: (err) => showToast(err.message, 'error')
  });

  const [toggleFollow, { loading: followLoading }] = useMutation(TOGGLE_FOLLOW_MUTATION, {
    refetchQueries: [{ query: GET_USER_BY_ID, variables: { id: targetId } }],
    onCompleted: () => {
      showToast(isFollowing ? 'Unfollowed successfully' : 'Following now!', 'success');
    },
    onError: (err) => showToast(err.message, 'error')
  });

  // --- EFFECTS ---
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

  // --- HANDLERS ---
  const showToast = (message, type = 'info') => 
    setToast({ show: true, message, type });

  const handleFollowToggle = async () => {
    if (!authUser) {
      showToast("Please log in to follow users", 'warning');
      return;
    }
    await toggleFollow({ variables: { followId: targetId } });
  };

  const handleSave = async () => {
    if (!editForm.username.trim()) {
      showToast("Username is required", 'error');
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

  // Calculate total stats
  const totalViews = profile?.usersBooks?.reduce((sum, book) => 
    sum + (book.stats?.views || 0), 0) || 0;
  const totalLikes = profile?.usersBooks?.reduce((sum, book) => 
    sum + (book.stats?.likes || 0), 0) || 0;

  // Format numbers
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // --- RENDER CHECKS ---
  if (!targetId) {
    return (
      <MainLayout>
        <div className="error-state">
          <Person style={{ fontSize: '4rem' }} />
          <Typography variant="h3">Please log in or select a user</Typography>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <Typography variant="body" color="muted">Loading profile...</Typography>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="error-state">
          <Typography variant="h3" color="danger">Error loading profile</Typography>
          <Typography variant="body" color="muted">{error.message}</Typography>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="error-state">
          <Typography variant="h3">User not found</Typography>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="profile-page">
        
        {/* Background decorative elements */}
        <div className="profile-bg-orb profile-bg-orb-1"></div>
        <div className="profile-bg-orb profile-bg-orb-2"></div>

        <Container maxWidth="5xl">
          
          {/* HEADER SECTION */}
          <div className="profile-header-card">
            
            {/* Avatar Section */}
            <div className="header-left">
              <div className="avatar-wrapper-lg">
                {isEditing ? (
                  <ImageUpload 
                    currentImage={editForm.profilePicture}
                    onUploadSuccess={(url) => setEditForm(prev => ({...prev, profilePicture: url}))}
                  />
                ) : (
                  profile.profilePicture ? (
                    <img src={profile.profilePicture} alt={profile.username} className="avatar-img-lg" />
                  ) : (
                    <div className="avatar-placeholder-wrapper">
                      <Person className="avatar-placeholder" />
                    </div>
                  )
                )}
              </div>
              
              {/* Verified Badge */}
              {!isEditing && profile.isVerified && (
                <div className="verified-badge">
                  <Verified style={{ fontSize: '1rem' }} />
                  <span>Verified</span>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="header-center">
              {isEditing ? (
                <div className="edit-form-grid">
                  <Input 
                    name="fullName" 
                    label="Full Name"
                    placeholder="Enter your full name" 
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                  />
                  <Input 
                    name="username" 
                    label="Username"
                    placeholder="Choose a username" 
                    value={editForm.username}
                    onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                    required
                  />
                  <Input 
                    name="website" 
                    label="Website"
                    placeholder="https://yourwebsite.com" 
                    value={editForm.website}
                    onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                  />
                  <Textarea 
                    name="bio"
                    label="Bio"
                    placeholder="Tell us about yourself..."
                    value={editForm.bio}
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                    rows={4}
                  />
                  <div className="edit-actions">
                    <Button 
                      variant="primary" 
                      size="medium" 
                      onClick={handleSave} 
                      isLoading={updating} 
                      icon={<Save fontSize="small"/>}
                    >
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      size="medium" 
                      onClick={() => setIsEditing(false)} 
                      icon={<Cancel fontSize="small"/>}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="name-section">
                    <div className="name-row">
                      <Typography variant="h2" weight="bold">
                        {profile.fullName}
                      </Typography>
                    </div>
                    <Typography variant="body" color="muted" className="username-text">
                      @{profile.username}
                    </Typography>
                  </div>
                  
                  {profile.bio && (
                    <Typography variant="body" className="bio-text">
                      {profile.bio}
                    </Typography>
                  )}

                  <div className="contact-info">
                    <div className="contact-item">
                      <Email fontSize="small" />
                      <span>{profile.email}</span>
                    </div>
                    {profile.website && (
                      <div className="contact-item">
                        <LinkIcon fontSize="small" />
                        <a 
                          href={profile.website} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="link-hover"
                        >
                          {profile.website.replace(/^https?:\/\//i, '')}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Mini stats under bio */}
                  <div className="mini-stats">
                    <div className="mini-stat">
                      <TrendingUp style={{ fontSize: '1rem' }} />
                      <span>{formatNumber(totalViews)} views</span>
                    </div>
                    <div className="mini-stat">
                      <Star style={{ fontSize: '1rem' }} />
                      <span>{formatNumber(totalLikes)} likes</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="header-right">
              {isMe ? (
                !isEditing && (
                  <div className="my-actions">
                    <Button 
                      variant="primary" 
                      size="medium" 
                      onClick={() => setIsEditing(true)} 
                      icon={<Edit fontSize="small"/>}
                    >
                      Edit Profile
                    </Button>
                    <Button 
                      variant="outline" 
                      size="medium" 
                      onClick={handleLogout} 
                      icon={<Logout fontSize="small"/>}
                    >
                      Logout
                    </Button>
                  </div>
                )
              ) : (
                <Button 
                  variant={isFollowing ? 'outline' : 'primary'} 
                  size="large"
                  onClick={handleFollowToggle}
                  isLoading={followLoading}
                  icon={isFollowing ? <PersonRemove/> : <PersonAdd/>}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </Button>
              )}
            </div>
          </div>

          {/* STATISTICS BAR */}
          <div className="stats-bar">
            <div className="stat-box">
              <div className="stat-icon-wrapper">
                <Book className="stat-icon" />
              </div>
              <div className="stat-content">
                <span className="stat-num">{profile.usersBooks?.length || 0}</span>
                <span className="stat-lbl">Books</span>
              </div>
            </div>
            
            <div className="stat-box">
              <div className="stat-icon-wrapper">
                <People className="stat-icon" />
              </div>
              <div className="stat-content">
                <span className="stat-num">{formatNumber(profile.followers?.length || 0)}</span>
                <span className="stat-lbl">Followers</span>
              </div>
            </div>
            
            <div className="stat-box">
              <div className="stat-icon-wrapper">
                <People className="stat-icon" />
              </div>
              <div className="stat-content">
                <span className="stat-num">{formatNumber(profile.following?.length || 0)}</span>
                <span className="stat-lbl">Following</span>
              </div>
            </div>
            
            {isMe && (
              <div className="stat-box">
                <div className="stat-icon-wrapper bookmark">
                  <Bookmark className="stat-icon" />
                </div>
                <div className="stat-content">
                  <span className="stat-num">{profile.savedBooks?.length || 0}</span>
                  <span className="stat-lbl">Saved</span>
                </div>
              </div>
            )}
          </div>

          {/* TABS SECTION (if user owns profile) */}
          {isMe && (
            <div className="tabs-wrapper">
              <button 
                className={`tab-btn ${activeTab === 'published' ? 'active' : ''}`}
                onClick={() => setActiveTab('published')}
              >
                <Book style={{ fontSize: '1.25rem' }} />
                Published Books
              </button>
              <button 
                className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => setActiveTab('saved')}
              >
                <Bookmark style={{ fontSize: '1.25rem' }} />
                Saved Books
              </button>
            </div>
          )}

          {/* BOOKS SECTION */}
          <div className="books-section">
            {!isMe || activeTab === 'published' ? (
              <>
                {!isMe && (
                  <Typography variant="h2" weight="bold" className="section-title">
                    Published Books
                  </Typography>
                )}
                {profile.usersBooks?.length > 0 ? (
                  <BookGrid books={profile.usersBooks} />
                ) : (
                  <div className="empty-state">
                    <Book style={{ fontSize: '3rem' }} />
                    <Typography variant="h4" color="muted">
                      No books published yet
                    </Typography>
                    <Typography variant="body" color="muted">
                      {isMe ? "Start writing your first book!" : "This user hasn't published any books yet."}
                    </Typography>
                  </div>
                )}
              </>
            ) : (
              <>
                {profile.savedBooks?.length > 0 ? (
                  <BookGrid books={profile.savedBooks} />
                ) : (
                  <div className="empty-state">
                    <Bookmark style={{ fontSize: '3rem' }} />
                    <Typography variant="h4" color="muted">
                      No saved books yet
                    </Typography>
                    <Typography variant="body" color="muted">
                      Save books to read them later!
                    </Typography>
                  </div>
                )}
              </>
            )}
          </div>

        </Container>
      </div>

      <Toast 
        isVisible={toast.show} 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({...toast, show: false})}
      />
    </MainLayout>
  );
};

export default UserProfile;