import CompactNumber from '../../components/UI/CompactNumber';
import UserProfileLink from '../../components/UI/UserProfileLink';
import MentionInput from '../../components/Mentions/MentionInput';
import MentionText from '../../components/Mentions/MentionText';
import useContentTarget from '../../hooks/useContentTarget';
import { profilePath } from '../../utils/publicPaths';
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import {
  useGetSession,
  useGetSessionEntries,
  useNewSessionEntrySubscription,
  useAddSessionEntry,
  useDeleteSessionEntry,
  useToggleSessionEntryLike,
  useCloseSession,
} from '../../hooks/useSessions';
import './SessionDetail.css';
import SocialShareButton from '../../components/Sharing/SocialShareButton';
import SessionCover from '../../components/Sessions/SessionCover';
import SessionCoverEditor from '../../components/Sessions/SessionCoverEditor';

import { useLazyQuery, useQuery } from '@apollo/client';
import { VERIFY_SESSION_ACCESS_CODE, GET_SESSION_ENTRY } from '../../graphql/queries/session';


const SESSION_TYPE_LABEL = {
  OPEN: 'Herkese Açık',
  FOLLOWERS_ONLY: 'Takipçilere Özel',
  PRIVATE: 'Özel',
};

const SESSION_TYPE_VARIANT = {
  OPEN: 'success',
  FOLLOWERS_ONLY: 'warning',
  PRIVATE: 'neutral',
};

const AccessCodeGate = ({ sessionId, onSuccess }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const [verifyCode, { loading }] = useLazyQuery(VERIFY_SESSION_ACCESS_CODE);

  const handleSubmit = async () => {
    if (code.trim().length < 4) {
      setError('Erişim kodu en az 4 karakter olmalıdır.');
      return;
    }

    try {
      const { data } = await verifyCode({
        variables: { sessionId, accessCode: code.trim() },
      });

      if (data?.verifySessionAccessCode) {
        onSuccess(code.trim()); // ✅ Kod doğruysa üst bileşene ilet
      } else {
        setError('Erişim kodu hatalı.');         // ❌ Yanlış kod
      }
    } catch (err) {
      setError(err.message || 'Bir hata oluştu.');
    }
  };

  return (
    <div className="session-access-gate">
      <div className="session-access-gate-inner">
        <div className="session-access-icon">🔒</div>
        <Typography variant="h5" weight="bold">Özel Oturum</Typography>
        <Typography variant="body" color="muted">
          Bu oturuma katılmak için erişim kodu gereklidir.
        </Typography>
        <input
          className="session-access-input"
          type="password"
          placeholder="Erişim kodu..."
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        {error && (
          <Typography variant="caption" color="danger">{error}</Typography>
        )}
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Doğrulanıyor...' : 'Katıl'}
        </Button>
      </div>
    </div>
  );
};

// Tek bir yazı kartı — forum stili
const EntryCard = ({ entry, isOwn, onDelete, onLike, currentUserId, index }) => {
  const targetRef = useContentTarget(`entry-${entry.id}`);
  const [showMenu, setShowMenu] = useState(false);
  const isLiked = entry.likedBy?.includes(currentUserId);
  const menuRef = useRef(null);

  // Menü dışına tıklayınca kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const formattedDate = new Date(entry.createdAt).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article id={`entry-${entry.id}`} ref={targetRef} tabIndex={-1} className={`entry-card${isOwn ? ' entry-card--own' : ''}`}>

      {/* Yazar bilgisi */}
      <div className="entry-card-author">
        <div className="entry-card-avatar">
          {entry.user?.profilePicture ? (
            <img src={entry.user.profilePicture} alt="" />
          ) : (
            <span>
              {(entry.user?.fullName || entry.user?.username || '?')
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
        </div>
        <div className="entry-card-author-info">
          <UserProfileLink user={entry.user} className="entry-card-name">
            {entry.user?.fullName ?? entry.user?.username ?? 'Kullanıcı'}
            {isOwn && <span className="entry-card-own-tag">Sen</span>}
          </UserProfileLink>
          <span className="entry-card-date">{formattedDate}</span>
        </div>

        {isOwn && (
          <div className="entry-card-menu-wrapper" ref={menuRef}>
            <button
              className="entry-card-menu-btn"
              onClick={() => setShowMenu((v) => !v)}
              aria-label="Seçenekler"
            >
              ···
            </button>
            {showMenu && (
              <div className="entry-card-menu-dropdown">
                <button
                  className="entry-card-menu-item entry-card-menu-item--danger"
                  onClick={() => { onDelete(entry.id); setShowMenu(false); }}
                >
                  Yazıyı Sil
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Yazı içeriği */}
      <div className="entry-card-content">
        <MentionText>{entry.content}</MentionText>
      </div>

      {/* Alt aksiyonlar */}
      <div className="entry-card-footer">
        <button
          className={`entry-card-like-btn${isLiked ? ' entry-card-like-btn--liked' : ''}`}
          aria-label="Yazıyı beğen"
          aria-pressed={Boolean(isLiked)}
          onClick={() => onLike(entry.id)}
        >
          <span className="entry-card-like-icon">♥</span>
          <CompactNumber value={entry.likeCount} label="beğeni" />
        </button>
      </div>

    </article>
  );
};

// Yazı gönderme alanı
const EntryComposer = ({ onSend, sending, disabled }) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = async () => {
    const content = value.trim();
    if (!content || sending) return;
    const sent = await onSend(content);
    if (sent === false) return;
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Textarea otomatik yükseklik
  const handleChange = (e) => {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 320)}px`;
  };

  const handleKeyDown = (e) => {
    // Ctrl+Enter veya Cmd+Enter ile gönder
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="entry-composer">
      <MentionInput
        ref={textareaRef}
        className="entry-composer-input"
        placeholder="Düşüncelerini yaz..."
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={4}
        disabled={disabled || sending}
      />
      <div className="entry-composer-footer">
        <span className="entry-composer-hint">
          Göndermek için <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
        </span>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!value.trim() || sending || disabled}
        >
          {sending ? 'Gönderiliyor...' : 'Paylaş'}
        </Button>
      </div>
    </div>
  );
};

const SessionDetail = ({ resolvedId } = {}) => {
  const { hash } = useLocation();
  const params = useParams();
  const sessionId = resolvedId || params.sessionId;
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const currentUserId = currentUser?.id ?? currentUser?._id;

  const [accessCode, setAccessCode] = useState(null);
  const [accessError, setAccessError] = useState('');
  const [editingCover, setEditingCover] = useState(false);

  // Bir oturum her açıldığında (ilk girişte veya başka bir oturuma
  // geçildiğinde) sayfayı en üste al. sessionId'ye bağladık çünkü
  // route değişse bile bu component yeniden mount olmayabilir —
  // kullanıcı bir oturumdan diğerine geçtiğinde de aynı davranış
  // uygulansın istiyoruz.
  useEffect(() => {
    window.scrollTo(0, 0);
    setAccessCode(null);
  }, [sessionId]);

const { session, loading: sessionLoading, error: sessionError } = useGetSession(sessionId);
  const canReadEntries = Boolean(session && (session.type !== 'PRIVATE' || accessCode || String(session.createdBy?.id) === String(currentUserId)));
  const { entries, loading: entriesLoading, loadMore, hasMore } = useGetSessionEntries(sessionId, accessCode, canReadEntries);
  const targetEntryId = hash.match(/^#entry-([a-f\d]{24})$/i)?.[1];
  const { data: targetData, loading: targetLoading, error: targetError } = useQuery(GET_SESSION_ENTRY, {
    variables: { sessionId, entryId: targetEntryId, ...(accessCode ? { accessCode } : {}) },
    skip: !canReadEntries || !targetEntryId,
    fetchPolicy: 'network-only',
  });
  const targetEntry = targetData?.getSessionEntry;
  const visibleEntries = targetEntry && !entries.some(entry => entry.id === targetEntry.id) ? [...entries, targetEntry] : entries;
  const { addEntry, loading: sending }        = useAddSessionEntry(sessionId, accessCode);
  const { deleteEntry }                       = useDeleteSessionEntry(sessionId, accessCode);
  const { toggleLike }                        = useToggleSessionEntryLike();
  const { closeSession }                      = useCloseSession();

  useNewSessionEntrySubscription(sessionId, accessCode, canReadEntries);

  const handleSend = async (content) => {
    try {
      await addEntry(content, accessCode);
      setAccessError('');
      return true;
    } catch (err) {
      if (err.message?.includes('kodu')) {
        setAccessCode(null);
        setAccessError(err.message);
      } else {
        // Önceden bu dal boştu — hata sessizce yutuluyordu, kullanıcı
        // hiçbir şey görmüyordu. Artık her zaman bir uyarı gösteriyoruz.
        showToast(err.message || 'Yazı gönderilemedi.', 'error');
      }
      return false;
    }
  };

  // Beğeni — önceden doğrudan onLike={toggleLike} olarak geçiliyordu ve
  // hiç yakalanmayan (uncaught) bir hataydı; misafir kullanıcı beğenmeye
  // çalışınca kırmızı "Uncaught runtime errors" ekranına düşüyordu.
  const handleLikeEntry = async (entryId) => {
    if (!currentUser) {
      showToast('Beğenmek için giriş yapmalısınız.', 'warning');
      return;
    }
    try {
      await toggleLike(entryId, accessCode);
    } catch (err) {
      showToast(err.message || 'Beğeni işlemi başarısız oldu.', 'error');
    }
  };

  // Yazı silme — aynı şekilde yakalanmıyordu.
  const handleDeleteEntry = async (entryId) => {
    try {
      await deleteEntry(entryId);
      showToast('Yazı silindi.', 'success');
    } catch (err) {
      showToast(err.message || 'Yazı silinemedi.', 'error');
    }
  };

  const handleCloseSession = async () => {
    if (window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
      try {
        await closeSession(sessionId);
        navigate('/sessions');
      } catch (err) {
        showToast(err.message || 'Oturum kapatılamadı.', 'error');
      }
    }
  };

  // Erişim hatası
  if (sessionError) {
    return (
      <MainLayout>
        <Container maxWidth="3xl">
          <div className="session-detail-not-found">
            <Typography variant="h5" color="muted">
              Bu oturuma erişim yetkiniz yok.
            </Typography>
            <Button variant="outline" onClick={() => navigate('/sessions')}>
              Geri Dön
            </Button>
          </div>
        </Container>
      </MainLayout>
    );
  }

  // --- LOADING ---
  if (sessionLoading && !session) {
    return (
      <MainLayout>
        <div className="session-detail-loading">
          <Container maxWidth="3xl">
            <div className="session-detail-skeleton-header" />
            <div className="session-detail-skeleton-entries">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="entry-card-skeleton" />
              ))}
            </div>
          </Container>
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return (
      <MainLayout>
        <Container maxWidth="3xl">
          <div className="session-detail-not-found">
            <Typography variant="h5" color="muted">Oturum bulunamadı.</Typography>
            <Button variant="outline" onClick={() => navigate('/sessions')}>
              Geri Dön
            </Button>
          </div>
        </Container>
      </MainLayout>
    );
  }

  if (session.type === 'PRIVATE' && !accessCode) {
    return (
      <MainLayout>
        <AccessCodeGate
          sessionId={sessionId}
          onSuccess={(code) => { setAccessCode(code); setAccessError(''); }}
        />
        {accessError && (
          <div className="session-access-error">
            <Typography variant="caption" color="danger">{accessError}</Typography>
          </div>
        )}
      </MainLayout>
    );
  }

  const isCreator = session.createdBy?.id === currentUserId;

  return (
    <MainLayout>
      <div className="session-detail">
        <Container maxWidth="3xl">

          {/* GERİ */}
          <button
            className="session-detail-back"
            onClick={() => navigate('/sessions')}
          >
            ← Oturumlara Dön
          </button>

          {/* BAŞLIK BLOĞU */}
          <SessionCover key={session.id} src={session.coverImageUrl} title={session.title} className="session-detail-cover" eager />
          {(isCreator || currentUser?.role === 'ADMIN') && <div className="session-detail-cover-actions">
            <Button variant="outline" size="small" onClick={() => setEditingCover(previous => !previous)}>Kapak fotoğrafını düzenle</Button>
          </div>}
          {editingCover && (isCreator || currentUser?.role === 'ADMIN') && <SessionCoverEditor key={session.id} session={session} onClose={() => setEditingCover(false)} />}
          <div className="session-detail-hero">
            <div className="session-detail-hero-meta">
              <Badge variant={SESSION_TYPE_VARIANT[session.type]}>
                {SESSION_TYPE_LABEL[session.type]}
              </Badge>
              {!session.isActive && (
                <Badge variant="neutral">Kapalı</Badge>
              )}
              {session.tags?.map((tag) => (
                <span key={tag} className="session-detail-tag">#{tag}</span>
              ))}
            </div>

            <div className="session-detail-hero-title-row">
              <h1 className="session-detail-title">{session.title}</h1>
              {session.type === 'OPEN' && session.isActive && <SocialShareButton type="SESSION" id={session.id} label="Oturumu paylaş" />}
              {isCreator && session.isActive && (
                <Button
                  variant="danger"
                  size="small"
                  onClick={handleCloseSession}
                >
                  Oturumu Kapat
                </Button>
              )}
            </div>

            {session.description && (
              <p className="session-detail-description"><MentionText>{session.description}</MentionText></p>
            )}

            <div className="session-detail-hero-footer">
              <Link className="session-detail-author" to={profilePath(session.createdBy)}>
                <div className="session-detail-avatar">
                  {session.createdBy?.profilePicture ? (
                    <img src={session.createdBy.profilePicture} alt="" />
                  ) : (
                    <span>
                      {(session.createdBy?.fullName || session.createdBy?.username || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="session-detail-author-name">
                  {session.createdBy?.fullName ?? session.createdBy?.username}
                </span>
                <span className="session-detail-author-sep">·</span>
                <span className="session-detail-participant-count">
                  <CompactNumber value={session.participantCount} /> katılımcı
                </span>
                <span className="session-detail-author-sep">·</span>
                <span className="session-detail-participant-count">
                  <CompactNumber value={entries.length} /> yazı
                </span>
              </Link>
            </div>
          </div>

          <div className="session-detail-divider" />

          {/* YAZMA ALANI — aktifse üstte göster */}
          {session.isActive && (
            <EntryComposer
              onSend={handleSend}
              sending={sending}
              disabled={!currentUser}
            />
          )}

          {/* YAZILAR */}
          <div className="session-entries-list">

            {entriesLoading && entries.length === 0 && (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="entry-card-skeleton" />
                ))}
              </>
            )}

            {!entriesLoading && entries.length === 0 && (
              <div className="session-entries-empty">
                <Typography variant="body" color="muted">
                  Henüz yazı yok. İlk düşünceni paylaş!
                </Typography>
              </div>
            )}

            {targetEntryId && !targetLoading && (targetError || !targetEntry) && <p role="status">Etiketlendiğiniz ileti bulunamadı veya artık erişilebilir değil.</p>}
            {[...visibleEntries].reverse().map((entry, i) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                index={i}
                isOwn={entry.user?.id === currentUserId}
                currentUserId={currentUserId}
                onDelete={handleDeleteEntry}
                onLike={handleLikeEntry}
              />
            ))}
            {hasMore && <Button variant="outline" disabled={entriesLoading} onClick={loadMore}>Diğer iletileri yükle</Button>}
          </div>

          {/* KAPALI BANNER */}
          {!session.isActive && (
            <div className="session-closed-banner">
              <Typography variant="caption" color="muted">
                Bu oturum kapatılmıştır. Yeni yazı eklenemez.
              </Typography>
            </div>
          )}

        </Container>
      </div>
    </MainLayout>
  );
};

export default SessionDetail;
