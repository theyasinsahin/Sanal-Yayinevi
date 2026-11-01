import UserProfileLink from '../../components/UI/UserProfileLink';
import { sessionPath } from '../../utils/publicPaths';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Badge } from '../../components/UI/Badge';
import { Textarea } from '../../components/UI/Textarea';
import { useGetSessions, useCreateSession } from '../../hooks/useSessions';
import './SessionsPage.css';
import SessionCover from '../../components/Sessions/SessionCover';
import SessionCoverField from '../../components/Sessions/SessionCoverField';
import SocialShareButton from '../../components/Sharing/SocialShareButton';
import SessionAccessRequest from '../../components/Sessions/SessionAccessRequest';
import useSessionCreationAccess from '../../hooks/useSessionCreationAccess';

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

export const CreateSessionModal = ({ onClose, onCreate, creating = false }) => {
  const [form, setForm] = useState({
    title: '',
    coverImageUrl: '',
    description: '',
    type: 'OPEN',
    accessCode: '',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Başlık zorunludur.';
    if (form.type === 'PRIVATE' && form.accessCode.trim().length < 4) {
      errs.accessCode = 'Erişim kodu en az 4 karakter olmalıdır.';
    }
    return errs;
  };

  const handleSubmit = async () => {
    if (creating || uploading) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    const input = {
      title: form.title.trim(),
      coverImageUrl: form.coverImageUrl,
      description: form.description.trim(),
      type: form.type,
      tags: form.tags,
      ...(form.type === 'PRIVATE' && { accessCode: form.accessCode.trim() }),
    };
    try { await onCreate(input); onClose(); }
    catch (failure) { setErrors(previous => ({ ...previous, submit: failure.message })); }
  };

  return (
    <div className="sessions-modal-overlay" onClick={() => { if (!creating) onClose(); }}>
      <div className="sessions-modal" role="dialog" aria-modal="true" aria-labelledby="create-session-title" onClick={(e) => e.stopPropagation()}>

        <div className="sessions-modal-header">
          <Typography variant="h5" weight="bold" id="create-session-title">Yeni Oturum Aç</Typography>
          <button className="sessions-modal-close" disabled={creating} onClick={onClose}>✕</button>
        </div>

        <div className="sessions-modal-body">
          <SessionCoverField value={form.coverImageUrl} onChange={coverImageUrl => setForm(previous => ({ ...previous, coverImageUrl }))} onLoadingChange={setUploading} disabled={creating || uploading} />
          <Input
            label="Başlık"
            name="title"
            placeholder="Oturum konusu..."
            value={form.title}
            onChange={handleChange}
            error={errors.title}
          />

          <div className="sessions-field">
            <label className="sessions-label">Açıklama</label>
            <Textarea
              name="description"
              placeholder="Kısa bir açıklama ekleyin..."
              value={form.description}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className="sessions-field">
            <label className="sessions-label">Oturum Tipi</label>
            <div className="sessions-type-selector">
              {['OPEN', 'FOLLOWERS_ONLY', 'PRIVATE'].map((type) => (
                <button
                  key={type}
                  className={`sessions-type-btn${form.type === type ? ' sessions-type-btn--active' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, type }))}
                  type="button"
                >
                  {SESSION_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'PRIVATE' && (
            <Input
              label="Erişim Kodu"
              name="accessCode"
              placeholder="En az 4 karakter..."
              value={form.accessCode}
              onChange={handleChange}
              error={errors.accessCode}
            />
          )}

          <div className="sessions-field">
            <label className="sessions-label">Etiketler</label>
            <div className="sessions-tag-input-row">
              <Input
                name="tagInput"
                placeholder="Etiket yazıp ekle..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button variant="secondary" size="small" onClick={handleAddTag}>
                Ekle
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="sessions-tags">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="primary">
                    {tag}
                    <span
                      className="sessions-tag-remove"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ✕
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sessions-modal-footer">
          {errors.submit && <p className="ui-notice" role="alert">{errors.submit}</p>}
          <Button variant="ghost" disabled={creating} onClick={onClose}>İptal</Button>
          <Button variant="primary" disabled={uploading} isLoading={creating} onClick={handleSubmit}>Oturum Oluştur</Button>
        </div>

      </div>
    </div>
  );
};

export const SessionCard = ({ session }) => (
  <article className="session-card">
    <Link className="session-card-main" to={sessionPath(session)}>
      <SessionCover src={session.coverImageUrl} title={session.title} className="session-card-cover" />
      <div className="session-card-body">
        <div className="session-card-header">
          <div className="session-card-meta">
            <Badge variant={SESSION_TYPE_VARIANT[session.type]}>
              {SESSION_TYPE_LABEL[session.type]}
            </Badge>
            {!session.isActive && (
              <Badge variant="neutral">Kapalı</Badge>
            )}
          </div>
          <Typography variant="caption" color="muted">
            {new Date(session.createdAt).toLocaleDateString('tr-TR')}
          </Typography>
        </div>

        <Typography variant="h6" weight="bold" className="session-card-title">
          {session.title}
        </Typography>

        {session.description && (
          <Typography variant="caption" color="muted" className="session-card-desc">
            {session.description}
          </Typography>
        )}

        {session.tags?.length > 0 && (
          <div className="session-card-tags">
            {session.tags.map((tag) => (
              <span key={tag} className="session-card-tag">#{tag}</span>
            ))}
          </div>
        )}

      </div>
    </Link>
    <div className="session-card-footer">
      <div className="session-card-footer-meta">
        <div className="session-card-author">
          <div className="session-card-avatar">
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
          <Typography variant="caption" color="muted">
            <UserProfileLink user={session.createdBy}>{session.createdBy?.fullName ?? session.createdBy?.username}</UserProfileLink>
          </Typography>
        </div>
        <Typography variant="caption" color="muted">
          {session.participantCount} katılımcı
        </Typography>
      </div>
      {session.type === 'OPEN' && session.isActive && <div className="session-card-actions"><SocialShareButton type="SESSION" id={session.id} label="Oturumu paylaş" /></div>}
    </div>
  </article>
);

const SessionsPage = () => {
  const { user } = useAuth();
  const accessState = useSessionCreationAccess();
  const canCreate = Boolean(user && accessState.access?.status === 'APPROVED' && !accessState.error);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const { sessions, loading, error, loadMore, hasMore } = useGetSessions();
  const { createSession, loading: creating } = useCreateSession();
  useEffect(() => { setShowModal(false); }, [user?.id, canCreate]);

  const filtered = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <MainLayout>
      <div className="sessions-page">
        <Container maxWidth="4xl">

          <div className="sessions-page-header">
            <div>
              <Typography variant="h3" weight="bold">Yazı Oturumları</Typography>
              <Typography variant="body" color="muted">
                Bir konuya katıl, düşüncelerini paylaş.
              </Typography>
            </div>
            {canCreate ? (
              <Button variant="primary" onClick={() => setShowModal(true)}>
                + Oturum Aç
              </Button>
            ) : (
              <SessionAccessRequest key={user?.id || 'guest'} user={user} {...accessState} />
            )}
          </div>

          <div className="sessions-search-wrapper">
            <Input
              name="search"
              placeholder="Başlık, açıklama veya etiket ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading && sessions.length === 0 && (
            <div className="sessions-skeleton-list">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="session-card-skeleton" />
              ))}
            </div>
          )}

          {error && (
            <Typography variant="body" color="muted">
              Oturumlar yüklenemedi.
            </Typography>
          )}

          {!loading && filtered.length === 0 && (
            <div className="sessions-empty">
              <Typography variant="h5" color="muted">Henüz oturum yok</Typography>
              <Typography variant="body" color="muted">
                {search.trim()
                  ? 'Aramanıza uygun oturum bulunamadı.'
                  : 'İlk oturumu sen aç!'}
              </Typography>
            </div>
          )}

          <div className="sessions-grid">
            {filtered.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
              />
            ))}
          </div>

          {hasMore && (
            <div className="sessions-load-more">
              <Button variant="outline" onClick={loadMore} disabled={loading}>
                Daha Fazla
              </Button>
            </div>
          )}

        </Container>
      </div>

      {showModal && canCreate && (
        <CreateSessionModal
          onClose={() => setShowModal(false)}
          onCreate={createSession}
          creating={creating}
        />
      )}
    </MainLayout>
  );
};

export default SessionsPage;
