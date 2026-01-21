import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Person, Email, Link as LinkIcon, 
  Book, People, Bookmark, 
  Edit, Save, Cancel, 
  PersonAdd, PersonRemove, Logout 
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
  const { userId } = useParams(); // URL'den gelen ID (opsiyonel)
  const { user: authUser, logout } = useAuth(); // Giriş yapmış kullanıcı
  const navigate = useNavigate();

  // --- STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '', username: '', bio: '', profilePicture: '', website: ''
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // 1. HANGİ KULLANICI GÖSTERİLECEK?
  // Eğer URL'de ID varsa onu kullan, yoksa authUser'ı kullan.
  const targetId = userId || authUser?.id;

  // 2. KENDİ PROFİLİ Mİ?
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
      showToast('Profil güncellendi', 'success');
      refetch();
    },
    onError: (err) => showToast(err.message, 'error')
  });

  const [toggleFollow, { loading: followLoading }] = useMutation(TOGGLE_FOLLOW_MUTATION, {
    refetchQueries: [{ query: GET_USER_BY_ID, variables: { id: targetId } }],
    onError: (err) => showToast(err.message, 'error')
  });

  // --- EFFECTS ---
  // Edit modu açıldığında formu doldur
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

  // Sayfa yüklendiğinde en üste git
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // --- HANDLERS ---
  const showToast = (message, type = 'info') => setToast({ show: true, message, type });

  const handleFollowToggle = async () => {
    if (!authUser) return showToast("Giriş yapmalısınız", 'warning');
    await toggleFollow({ variables: { followId: targetId } });
  };

  const handleSave = async () => {
    await updateUser({
      variables: { ...editForm }
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isFollowing = profile?.followers?.some(f => {
      const fId = typeof f === 'object' ? f.id : f;
      return fId === authUser?.id;
  });

  // --- RENDER CHECKS ---
  if (!targetId) return <div className="p-10 text-center">Giriş yapın veya bir kullanıcı seçin.</div>;
  if (loading) return <MainLayout><div className="p-10 text-center">Yükleniyor...</div></MainLayout>;
  if (error) return <MainLayout><div className="p-10 text-center text-red-500">Hata: {error.message}</div></MainLayout>;
  if (!profile) return <MainLayout><div className="p-10 text-center">Kullanıcı bulunamadı.</div></MainLayout>;

  return (
    <MainLayout>
      <div className="profile-page">
        <Container maxWidth="5xl">
          
          {/* --- HEADER --- */}
          <div className="profile-header-card">
            
            {/* Sol: Avatar */}
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
                     <Person className="avatar-placeholder" />
                   )
                )}
              </div>
            </div>

            {/* Orta: Bilgiler & Form */}
            <div className="header-center">
               {isEditing ? (
                 <div className="edit-form-grid">
                    <Input 
                      name="fullName" 
                      placeholder="Ad Soyad" 
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                    />
                    <Input 
                      name="username" 
                      placeholder="Kullanıcı Adı" 
                      value={editForm.username}
                      onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                    />
                    <Input 
                      name="website" 
                      placeholder="Website (Opsiyonel)" 
                      value={editForm.website}
                      onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                    />
                    <Textarea 
                      name="bio"
                      placeholder="Biyografi..."
                      value={editForm.bio}
                      onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                      rows={3}
                    />
                    <div className="edit-actions">
                       <Button variant="primary" size="small" onClick={handleSave} isLoading={updating} icon={<Save fontSize="small"/>}>
                         Kaydet
                       </Button>
                       <Button variant="ghost" size="small" onClick={() => setIsEditing(false)} icon={<Cancel fontSize="small"/>}>
                         İptal
                       </Button>
                    </div>
                 </div>
               ) : (
                 <>
                   <div className="name-section">
                     <Typography variant="h3" weight="bold">{profile.fullName}</Typography>
                     <Typography variant="body" color="muted">@{profile.username}</Typography>
                   </div>
                   
                   <Typography variant="body" className="bio-text">
                     {profile.bio || "Henüz bir biyografi eklenmemiş."}
                   </Typography>

                   <div className="contact-info">
                      <div className="contact-item">
                        <Email fontSize="small" className="text-gray-400"/>
                        <span>{profile.email}</span>
                      </div>
                      {profile.website && (
                        <div className="contact-item">
                          <LinkIcon fontSize="small" className="text-gray-400"/>
                          <a href={profile.website} target="_blank" rel="noreferrer" className="link-hover">
                            {profile.website}
                          </a>
                        </div>
                      )}
                   </div>
                 </>
               )}
            </div>

            {/* Sağ: Butonlar */}
            <div className="header-right">
              {isMe ? (
                 !isEditing && (
                   <div className="my-actions">
                     <Button variant="outline" size="small" onClick={() => setIsEditing(true)} icon={<Edit fontSize="small"/>}>
                       Düzenle
                     </Button>
                     <Button variant="danger" size="small" onClick={handleLogout} icon={<Logout fontSize="small"/>}>
                       Çıkış
                     </Button>
                   </div>
                 )
              ) : (
                 <Button 
                   variant={isFollowing ? 'outline' : 'primary'} 
                   onClick={handleFollowToggle}
                   isLoading={followLoading}
                   icon={isFollowing ? <PersonRemove/> : <PersonAdd/>}
                 >
                   {isFollowing ? 'Takibi Bırak' : 'Takip Et'}
                 </Button>
              )}
            </div>
          </div>

          {/* --- İSTATİSTİKLER --- */}
          <div className="stats-bar">
             <div className="stat-box">
                <Book className="stat-icon"/>
                <div>
                  <span className="stat-num">{profile.usersBooks?.length || 0}</span>
                  <span className="stat-lbl">Kitap</span>
                </div>
             </div>
             <div className="stat-box">
                <People className="stat-icon"/>
                <div>
                  <span className="stat-num">{profile.followers?.length || 0}</span>
                  <span className="stat-lbl">Takipçi</span>
                </div>
             </div>
             <div className="stat-box">
                <People className="stat-icon"/>
                <div>
                  <span className="stat-num">{profile.following?.length || 0}</span>
                  <span className="stat-lbl">Takip</span>
                </div>
             </div>
             {isMe && (
               <div className="stat-box">
                  <Bookmark className="stat-icon"/>
                  <div>
                    <span className="stat-num">{profile.savedBooks?.length || 0}</span>
                    <span className="stat-lbl">Kaydedilen</span>
                  </div>
               </div>
             )}
          </div>

          {/* --- KİTAPLAR --- */}
          <div className="books-section">
             <Typography variant="h2" weight="bold" className="mb-4 border-b pb-2">
               Yayınlanan Kitaplar
             </Typography>
             {profile.usersBooks?.length > 0 ? (
                <BookGrid books={profile.usersBooks} />
             ) : (
                <div className="empty-box">Bu kullanıcı henüz kitap yayınlamamış.</div>
             )}
          </div>

          {isMe && (
            <div className="books-section" style={{marginTop:'2em'}}>
               <Typography variant="h2" weight="bold" className="mb-4 border-b pb-2">
                 Kaydedilen Kitaplar
               </Typography>
               {profile.savedBooks?.length > 0 ? (
                  <BookGrid books={profile.savedBooks} />
               ) : (
                  <div className="empty-box">Henüz kaydedilen bir kitap yok.</div>
               )}
            </div>
          )}

        </Container>
      </div>
      <Toast 
        isVisible={toast.show} message={toast.message} type={toast.type} 
        onClose={() => setToast({...toast, show: false})}
      />
    </MainLayout>
  );
};

export default UserProfile;