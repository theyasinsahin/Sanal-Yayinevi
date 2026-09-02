import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

import { useLazyQuery } from '@apollo/client';
import { VERIFY_SESSION_ACCESS_CODE } from '../../graphql/queries/session'; // query'i ekleyeceksin


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
    <article className={`entry-card${isOwn ? ' entry-card--own' : ''}`}>

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
          <span className="entry-card-name">
            {entry.user?.fullName ?? entry.user?.username ?? 'Kullanıcı'}
            {isOwn && <span className="entry-card-own-tag">Sen</span>}
          </span>
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
        {entry.content}
      </div>

      {/* Alt aksiyonlar */}
      <div className="entry-card-footer">
        <button
          className={`entry-card-like-btn${isLiked ? ' entry-card-like-btn--liked' : ''}`}
          onClick={() => onLike(entry.id)}
        >
          <span className="entry-card-like-icon">♥</span>
          <span>{entry.likeCount ?? 0}</span>
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
    await onSend(content);
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
      <textarea
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

const SessionDetail = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const currentUserId = currentUser?.id ?? currentUser?._id;

  const [accessCode, setAccessCode] = useState(null);
  const [accessError, setAccessError] = useState('');

  // Bir oturum her açıldığında (ilk girişte veya başka bir oturuma
  // geçildiğinde) sayfayı en üste al. sessionId'ye bağladık çünkü
  // route değişse bile bu component yeniden mount olmayabilir —
  // kullanıcı bir oturumdan diğerine geçtiğinde de aynı davranış
  // uygulansın istiyoruz.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sessionId]);

const { session, loading: sessionLoading, error: sessionError } = useGetSession(sessionId);
  const { entries, loading: entriesLoading } = useGetSessionEntries(sessionId);
  const { addEntry, loading: sending }        = useAddSessionEntry(sessionId);
  const { deleteEntry }                       = useDeleteSessionEntry(sessionId);
  const { toggleLike }                        = useToggleSessionEntryLike();
  const { closeSession }                      = useCloseSession();

  useNewSessionEntrySubscription(sessionId);

  const handleSend = async (content) => {
    try {
      await addEntry(content, accessCode);
      setAccessError('');
    } catch (err) {
      if (err.message?.includes('kodu')) {
        setAccessCode(null);
        setAccessError(err.message);
      } else {
        // Önceden bu dal boştu — hata sessizce yutuluyordu, kullanıcı
        // hiçbir şey görmüyordu. Artık her zaman bir uyarı gösteriyoruz.
        showToast(err.message || 'Yazı gönderilemedi.', 'error');
      }
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
      await toggleLike(entryId);
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
              <p className="session-detail-description">{session.description}</p>
            )}

            <div className="session-detail-hero-footer">
              {/* DÜZELTME: /users/ (çoğul) route App.js'te tanımlı değil,
                  gerçek route /user/:userId (tekil) — eskisi tıklanınca
                  404 sayfasına düşerdi. */}
              <Link className="session-detail-author" to={`/user/${session.createdBy?.id}`}>
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
                  {session.participantCount} katılımcı
                </span>
                <span className="session-detail-author-sep">·</span>
                <span className="session-detail-participant-count">
                  {entries.length} yazı
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

            {[...entries].reverse().map((entry, i) => (
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