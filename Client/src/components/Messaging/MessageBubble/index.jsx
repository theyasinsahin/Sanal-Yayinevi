import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '../../UI/Typography';
import { useDeleteMessage } from '../../../hooks/useMessages';
import './MessageBubble.css';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('tr-TR', {
    hour:   '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now  = new Date();
  const diff = now - date;
  const day  = 86400000;
  if (diff < day) {
    return 'Bugün';
  }
  if (diff < day * 2) {
    return 'Dün';
  }
  return date.toLocaleDateString('tr-TR');
};

// --- Alt bileşenler ---

const BookAttachment = ({ book }) => {
  const navigate = useNavigate();
  if (!book) return null;

  return (
    <div
      className="bubble-book-card"
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/book-detail/${book.id}`);
      }}
    >
      {book.imageUrl && (
        <img
          src={book.imageUrl}
          alt={book.title}
          className="bubble-book-cover"
        />
      )}
      <div className="bubble-book-info">
        <span className="bubble-book-label">Kitap</span>
        <Typography variant="caption" weight="medium">
          {book.title}
        </Typography>
        {book.author && (
          <Typography variant="caption" color="muted">
            {book.author.fullName ?? book.author.username}
          </Typography>
        )}
        <span className="bubble-book-link">Kitaba git →</span>
      </div>
    </div>
  );
};

const QuoteAttachment = ({ quote }) => {
  const navigate = useNavigate();
  if (!quote) return null;

  return (
    <div
      className="bubble-quote-card"
      onClick={(e) => {
        e.stopPropagation();
        if (quote.book?.id) navigate(`/book-detail/${quote.book.id}`);
      }}
    >
      <span className="bubble-quote-label">Alıntı</span>
      <p className="bubble-quote-text">
        "{quote.text?.slice(0, 200)}{quote.text?.length > 200 ? '...' : ''}"
      </p>
      {(quote.book?.title || quote.chapterTitle) && (
        <span className="bubble-quote-source">
          {quote.book?.title}
          {quote.chapterTitle ? ` · ${quote.chapterTitle}` : ''}
        </span>
      )}
    </div>
  );
};

// --- Ana bileşen ---

const MessageBubble = ({
  message,
  isOwn,
  editingValue,
  onEditValueChange,
  onEditStart,
  onEditCancel,
  onEditSave,
  conversationId,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const { deleteMessage, deleting } = useDeleteMessage(conversationId);

  const handleDelete = async () => {
    setMenuOpen(false);
    try {
      await deleteMessage(message.id);
    } catch (err) {
      console.error('Silme başarısız:', err);
    }
  };

  // Dışarı tıklanınca menüyü kapat
  const handleBubbleBlur = () => {
    setTimeout(() => setMenuOpen(false), 150);
  };

  const hasAttachment = message.type === 'BOOK' || message.type === 'QUOTE';
  const hasText       = message.content?.trim().length > 0;

  return (
    <div className={`bubble-row${isOwn ? ' bubble-row--own' : ' bubble-row--other'}`}>

      {/* Karşı taraf avatarı */}
      {!isOwn && (
        <div className="bubble-avatar">
          {message.sender?.profilePicture ? (
            <img src={message.sender.profilePicture} alt={message.sender.fullName} />
          ) : (
            <span>
              {(message.sender?.fullName ?? message.sender?.username ?? '?')
                .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          )}
        </div>
      )}

      {/* Balon + aksiyonlar */}
      <div className="bubble-wrapper" onBlur={handleBubbleBlur}>

        {/* Üç nokta menüsü — sadece kendi mesajlarında */}
        {isOwn && (
          <div className="bubble-menu-wrapper">
            <button
              className="bubble-menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Mesaj seçenekleri"
            >
              ···
            </button>
            {menuOpen && (
              <div className="bubble-menu" ref={menuRef}>
                <button
                  className="bubble-menu-delete"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Siliniyor...' : 'Sil'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Balon */}
        <div className={`bubble${isOwn ? ' bubble--own' : ' bubble--other'}`}>

          {/* Ek: kitap veya alıntı */}
          {message.type === 'BOOK'  && <BookAttachment  book={message.attachedBook}   />}
          {message.type === 'QUOTE' && <QuoteAttachment quote={message.attachedQuote} />}

          {/* Metin — düzenleme modunda input, değilse normal */}
          {
            hasText && (
              <p className={`bubble-text${hasAttachment ? ' bubble-text--with-attachment' : ''}`}>
                {message.content}
              </p>
            
          )}

          {/* Saat */}
          <span className={`bubble-time${isOwn ? ' bubble-time--own' : ''}`}>
            {formatTime(message.createdAt)}
          </span>

          {/* Gün */}
          <span className={`bubble-time${isOwn ? ' bubble-time--own' : ''}`}>
            {formatDate(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;