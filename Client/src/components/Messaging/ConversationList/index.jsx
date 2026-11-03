import React, { useEffect, useState } from 'react';
import { Typography } from '../../UI/Typography';
import { useGetConversations, useGetOrCreateConversation, useMessageRecipients } from '../../../hooks/useMessages';
import { useAuth } from '../../../context/AuthContext';
import './ConversationList.css';
import {Input} from '../../UI/Input';

const getInitials = (user) => {
  if (!user) return '?';
  const name = user.fullName || user.username || '';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const getOtherParticipant = (conversation, currentUserId) => {
  return conversation.participants?.find((p) => p.id !== currentUserId) ?? null;
};

const matchesSearch = (person, search) => {
  const normalize = value => (value || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i');
  const term = normalize(search.trim());
  return normalize(person?.fullName).includes(term) || normalize(person?.username).includes(term);
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now  = new Date();
  const diff = now - date;
  const day  = 86400000;

  if (diff < day && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < day * 2) return 'Dün';
  if (diff < day * 7) {
    return date.toLocaleDateString('tr-TR', { weekday: 'short' });
  }
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
};

const getLastMessagePreview = (lastMessage, currentUserId) => {
  if (!lastMessage) return '';
  const isOwn = lastMessage.sender?.id === currentUserId;
  const prefix = isOwn ? 'Sen: ' : '';

  if (lastMessage.type === 'BOOK')  return `${prefix}📖 Kitap paylaştı`;
  if (lastMessage.type === 'QUOTE') return `${prefix}💬 Alıntı paylaştı`;
  return `${prefix}${lastMessage.content}`;
};

const ConversationList = ({ activeConversationId, onSelect }) => {
  const [search, setSearch] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [startError, setStartError] = useState('');
  const [openingId, setOpeningId] = useState(null);
  useEffect(() => {
    const timer = setTimeout(() => setRecipientSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const { conversations, loading, error, refetch: refetchConversations } = useGetConversations();
  const { recipients, loading: recipientsLoading, error: recipientsError, hasMore, loadMore, refetch } = useMessageRecipients(recipientSearch);
  const { getOrCreateConversation, loading: starting } = useGetOrCreateConversation();

  const { user } = useAuth();
  const currentUser = user?.user || user; // AuthContext'te user nesnesi farklı yapıda olabilir, buna göre uyarlayın
  const currentUserId = currentUser?.id ?? currentUser?._id;

  const filtered = conversations.filter((conv) => {
    return matchesSearch(getOtherParticipant(conv, currentUserId), search);
  });
  const newRecipients = recipients.filter(person => matchesSearch(person, search) && !conversations.some(conv => getOtherParticipant(conv, currentUserId)?.id === person.id));
  const openRecipient = async person => {
    if (starting || openingId) return;
    setStartError(''); setOpeningId(person.id);
    try {
      const conversation = await getOrCreateConversation(person.id);
      if (!conversation) throw new Error('Konuşma açılamadı.');
      refetchConversations().catch(() => {});
      onSelect(conversation.id);
    } catch (err) { setStartError(err.message || 'Konuşma açılamadı. Tekrar deneyin.'); }
    finally { setOpeningId(null); }
  };

  return (
    <div className="conv-list">

      {/* Başlık */}
      <div className="conv-list-header">
        <Typography variant="h6" weight="bold">Mesajlar</Typography>
      </div>

      {/* Arama */}
      <div className="conv-list-search">
        <Input
          name="message-recipient-search"
          placeholder="Konuşmalarda ve takip ettiklerinde ara..."
          aria-label="Mesaj göndereceğin kişiyi ara"
          maxLength={120}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Liste */}
      <div className="conv-list-items">
        {loading && (
          <>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="conv-list-skeleton">
                <div className="conv-skeleton-avatar" />
                <div className="conv-skeleton-lines">
                  <div className="conv-skeleton-line conv-skeleton-line--name" />
                  <div className="conv-skeleton-line conv-skeleton-line--preview" />
                </div>
              </div>
            ))}
          </>
        )}

        {error && (
          <div className="conv-list-error">
            <Typography variant="caption" color="muted">
              Konuşmalar yüklenemedi.
            </Typography>
          </div>
        )}

        {!loading && !error && !recipientsLoading && recipientSearch === search.trim() && !recipientsError && filtered.length === 0 && newRecipients.length === 0 && (
          <div className="conv-list-empty">
            <Typography variant="caption" color="muted">
              {search ? 'Sonuç bulunamadı.' : 'Henüz konuşman veya mesaj kabul eden bir takibin yok.'}
            </Typography>
          </div>
        )}

        {!loading && filtered.map((conv) => {
          const other      = getOtherParticipant(conv, currentUserId);
          const isActive   = conv.id === activeConversationId;
          const hasUnread  = conv.unreadCount > 0;
          const preview    = getLastMessagePreview(conv.lastMessage, currentUserId);
          const timeStr    = formatTime(conv.lastMessage?.createdAt ?? conv.updatedAt);

          return (
            <button type="button"
              key={conv.id}
              className={`conv-item${isActive ? ' conv-item--active' : ''}`}
              onClick={() => onSelect(conv.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Avatar */}
              <div className="conv-item-avatar">
                {other?.profilePicture ? (
                  <img src={other.profilePicture} alt={other.fullName} />
                ) : (
                  <span>{getInitials(other)}</span>
                )}
                {/* Online göstergesi — ileride eklenebilir */}
              </div>

              {/* İçerik */}
              <div className="conv-item-content">
                <div className="conv-item-top">
                  <span className={`conv-item-name${hasUnread ? ' conv-item-name--unread' : ''}`}>
                    {other?.fullName ?? other?.username ?? 'Bilinmiyor'}
                  </span>
                  <span className="conv-item-time">{timeStr}</span>
                </div>
                <div className="conv-item-bottom">
                  <span className={`conv-item-preview${hasUnread ? ' conv-item-preview--unread' : ''}`}>
                    {preview || <span style={{ opacity: 0.4 }}>Henüz mesaj yok</span>}
                  </span>
                  {hasUnread && (
                    <span className="conv-item-badge">
                      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        <section aria-label="Mesaj kabul eden takip ettiklerin">
          <h3 className="conv-section-title">Takip ettiklerin</h3>
          {(recipientsLoading || recipientSearch !== search.trim()) && <p className="conv-list-feedback" role="status">Kişiler yükleniyor...</p>}
          {recipientsError && <p className="conv-list-feedback" role="alert">Kişiler yüklenemedi. <button type="button" className="ui-text-link" onClick={() => refetch().catch(() => {})}>Tekrar dene</button></p>}
          {startError && <p className="conv-list-feedback" role="alert">{startError}</p>}
          {newRecipients.map(person => <button type="button" className="conv-item" key={person.id}
            disabled={starting || Boolean(openingId)} onClick={() => openRecipient(person)}>
            <span className="conv-item-avatar">{person.profilePicture ? <img src={person.profilePicture} alt="" /> : getInitials(person)}</span>
            <span className="conv-item-content">
              <span className="conv-item-name">{person.fullName || person.username}</span>
              <span className="conv-item-preview">{openingId === person.id ? 'Konuşma açılıyor...' : `@${person.username} · Mesaj gönder`}</span>
            </span>
          </button>)}
          {hasMore && <button type="button" className="conv-load-more" disabled={recipientsLoading}
            onClick={() => loadMore().catch(() => setStartError('Diğer kişiler yüklenemedi. Tekrar deneyin.'))}>Daha fazla kişi göster</button>}
        </section>
      </div>
    </div>
  );
};

export default ConversationList;
