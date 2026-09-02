import React, { useState } from 'react';
import { Typography } from '../../UI/Typography';
import { useGetConversations } from '../../../hooks/useMessages';
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
  const { conversations, loading, error } = useGetConversations();

  // currentUser'ı kendi auth yapına göre değiştir
  // Redux kullanmıyorsan context veya localStorage'dan alabilirsin
  const { user } = useAuth();
  const currentUser = user?.user || user; // AuthContext'te user nesnesi farklı yapıda olabilir, buna göre uyarlayın
  const currentUserId = currentUser?.id ?? currentUser?._id;

  const filtered = conversations.filter((conv) => {
    if (!search.trim()) return true;
    const other = getOtherParticipant(conv, currentUserId);
    const q = search.toLowerCase();
    return (
      other?.fullName?.toLowerCase().includes(q) ||
      other?.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="conv-list">

      {/* Başlık */}
      <div className="conv-list-header">
        <Typography variant="h6" weight="bold">Mesajlar</Typography>
      </div>

      {/* Arama */}
      <div className="conv-list-search">
        <Input
          placeholder="Ara..."
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

        {!loading && !error && filtered.length === 0 && (
          <div className="conv-list-empty">
            <Typography variant="caption" color="muted">
              {search ? 'Sonuç bulunamadı.' : 'Henüz hiç konuşman yok.'}
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
            <div
              key={conv.id}
              className={`conv-item${isActive ? ' conv-item--active' : ''}`}
              onClick={() => onSelect(conv.id)}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;