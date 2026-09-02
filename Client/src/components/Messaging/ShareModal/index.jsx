import React, { useState } from 'react';
import { useGetConversations, useGetOrCreateConversation, useSendMessage } from '../../../hooks/useMessages';
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';
import './ShareModal.css';

const getInitials = (user) => {
  if (!user) return '?';
  const name = user.fullName || user.username || '';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const getOtherParticipant = (conversation, currentUserId) => {
  return conversation.participants?.find((p) => p.id !== currentUserId) ?? null;
};

const ShareModal = ({ isOpen, onClose, type, attachedBookId, attachedBook, attachedQuoteId, attachedQuote, currentUserId }) => {
  console.log('ShareModal props:', { isOpen, type, attachedBookId, attachedBook, attachedQuoteId, attachedQuote });
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [message, setMessage]           = useState('');
  const [sent, setSent]                 = useState(false);

  const { conversations, loading: convsLoading } = useGetConversations();
  const { getOrCreateConversation, loading: convCreating } = useGetOrCreateConversation();
  const { sendMessage, sending } = useSendMessage();

  if (!isOpen) return null;

  const filtered = conversations.filter((conv) => {
    const other = getOtherParticipant(conv, currentUserId);
    if (!other) return false;
    const q = searchQuery.toLowerCase();
    return (
      other.fullName?.toLowerCase().includes(q) ||
      other.username?.toLowerCase().includes(q)
    );
  });

  const handleSend = async () => {
    if (!selectedConvId) return;
    try {
      await sendMessage({
        conversationId: selectedConvId,
        content:        message.trim(),
        type,
        attachedBookId:  attachedBookId  ?? null,
        attachedQuoteId: attachedQuoteId ?? null,
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSelectedConvId(null);
        setMessage('');
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Paylaşım başarısız:', err);
    }
  };

  // Listede olmayan bir kullanıcıyla yeni konuşma başlat
  const handleSelectNew = async (recipientId) => {
    const conv = await getOrCreateConversation(recipientId);
    if (conv) setSelectedConvId(conv.id);
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>

        {/* Başlık */}
        <div className="share-modal-header">
          <Typography variant="h6" weight="bold">
            {type === 'BOOK' ? 'Kitabı paylaş' : 'Alıntıyı paylaş'}
          </Typography>
          <button className="share-modal-close" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>

        {/* Önizleme kartı */}
        <div className="share-preview">
          {type === 'BOOK' && attachedBook && (
            <div className="share-preview-book">
              {attachedBook.imageUrl && (
                <img src={attachedBook.imageUrl} alt={attachedBook.title} className="share-preview-cover" />
              )}
              <div>
                <Typography variant="caption" weight="medium">{attachedBook.title}</Typography>
                <Typography variant="caption" color="muted">
                  {attachedBook.author?.fullName ?? attachedBook.author?.username}
                </Typography>
              </div>
            </div>
          )}
          {type === 'QUOTE' && attachedQuote && (
            <div className="share-preview-quote">
              <Typography variant="caption" color="muted" style={{ fontStyle: 'italic' }}>
                "{attachedQuote.text?.slice(0, 120)}{attachedQuote.text?.length > 120 ? '...' : ''}"
              </Typography>
              <Typography variant="caption" color="muted">
                — {attachedQuote.book?.title}
              </Typography>
            </div>
          )}
        </div>

        {/* Arama */}
        <div className="share-modal-search">
          <input
            type="text"
            placeholder="Kişi ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Konuşma listesi */}
        <div className="share-modal-list">
          {convsLoading ? (
            <div className="share-modal-empty">
              <Typography variant="caption" color="muted">Yükleniyor...</Typography>
            </div>
          ) : filtered.length === 0 ? (
            <div className="share-modal-empty">
              <Typography variant="caption" color="muted">Sonuç bulunamadı.</Typography>
            </div>
          ) : (
            filtered.map((conv) => {
              const other    = getOtherParticipant(conv, currentUserId);
              const isSelected = selectedConvId === conv.id;
              return (
                <div
                  key={conv.id}
                  className={`share-modal-item${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedConvId(isSelected ? null : conv.id)}
                >
                  <div className="share-modal-avatar">
                    {other?.profilePicture ? (
                      <img src={other.profilePicture} alt={other.fullName} />
                    ) : (
                      <span>{getInitials(other)}</span>
                    )}
                  </div>
                  <div className="share-modal-item-info">
                    <Typography variant="caption" weight="medium">
                      {other?.fullName ?? other?.username}
                    </Typography>
                    <Typography variant="caption" color="muted">
                      @{other?.username}
                    </Typography>
                  </div>
                  {isSelected && (
                    <div className="share-modal-check">✓</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Mesaj input */}
        {selectedConvId && (
          <div className="share-modal-message">
            <input
              type="text"
              placeholder="Bir mesaj ekle... (isteğe bağlı)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
        )}

        {/* Gönder */}
        <div className="share-modal-footer">
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!selectedConvId || sending || sent}
          >
            {sent ? 'Gönderildi ✓' : sending ? 'Gönderiliyor...' : 'Gönder'}
          </Button>
        </div>

      </div>
    </div>
  );
};

export default ShareModal;