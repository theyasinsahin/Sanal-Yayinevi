import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Typography } from '../../UI/Typography';
import { Input } from '../../UI/Input';
import MessageBubble from '../MessageBubble';
import {
  useGetMessages,
  useSendMessage,
  useNewMessageSubscription,
  useMarkAsRead,
  useGetConversations,
} from '../../../hooks/useMessages';
import './ChatWindow.css';

const getOtherParticipant = (conversation, currentUserId) => {
  return conversation?.participants?.find((p) => p.id !== currentUserId) ?? null;
};

const getInitials = (user) => {
  if (!user) return '?';
  const name = user.fullName || user.username || '';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const ChatWindow = ({ conversationId, onBack }) => {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? currentUser?._id;
  const navigate = useNavigate();

  const [inputValue, setInputValue]     = useState('');
  const [editingId, setEditingId]       = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const messagesContainerRef = useRef(null);
  const inputRef             = useRef(null);
  const prevMessageCountRef  = useRef(0);
  const prevConversationId   = useRef(null);

  const { messages, loading, error, loadOlderMessages, hasMore } = useGetMessages(conversationId);
  const { sendMessage, sending } = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { conversations } = useGetConversations();

  useNewMessageSubscription(conversationId);

  const conversation = conversations.find((c) => c.id === conversationId);
  const otherUser    = getOtherParticipant(conversation, currentUserId);

  // Okundu işaretle
  useEffect(() => {
    if (conversationId) markAsRead(conversationId);
  }, [conversationId]);

  // Scroll mantığı:
  // - Farklı bir konuşmaya geçilince → scroll yok (kullanıcı en üstten okusun)
  // - Aynı konuşmada yeni mesaj gelince → en alta scroll
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount    = prevMessageCountRef.current;
    const isNewConversation = prevConversationId.current !== conversationId;

    if (!isNewConversation && currentCount > prevCount) {
      // Yeni mesaj geldi, en alta kaydır
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }

    prevMessageCountRef.current  = currentCount;
    prevConversationId.current   = conversationId;
  }, [messages, conversationId]);

  // --- MESAJ GÖNDER ---
  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content) return;
    setInputValue('');
    try {
      await sendMessage({ conversationId, content, type: 'TEXT' });
    } catch (err) {
      console.error('Mesaj gönderilemedi:', err);
      setInputValue(content);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- YÜKLENİYOR ---
  if (loading && messages.length === 0) {
    return (
      <div className="chat-window">
        <div className="chat-header">
          <div className="chat-header-skeleton-avatar" />
          <div className="chat-header-skeleton-name" />
        </div>
        <div className="chat-messages">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`chat-bubble-skeleton${i % 2 === 0 ? ' chat-bubble-skeleton--in' : ' chat-bubble-skeleton--out'}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-window chat-window--error">
        <Typography variant="body" color="muted">Mesajlar yüklenemedi.</Typography>
      </div>
    );
  }

  return (
    <div className="chat-window">

      {/* HEADER */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={onBack} aria-label="Geri">
          ←
        </button>

        <div
          className="chat-header-user"
          onClick={() => otherUser && navigate(`/profile/${otherUser.username}`)}
          style={{ cursor: otherUser ? 'pointer' : 'default' }}
        >
          <div className="chat-header-avatar">
            {otherUser?.profilePicture ? (
              <img src={otherUser.profilePicture} alt={otherUser.fullName} />
            ) : (
              <span>{getInitials(otherUser)}</span>
            )}
          </div>
          <div>
            <Typography variant="caption" weight="medium">
              {otherUser?.fullName ?? otherUser?.username ?? 'Yükleniyor...'}
            </Typography>
            {otherUser?.username && (
              <Typography variant="caption" color="muted">
                @{otherUser.username}
              </Typography>
            )}
          </div>
        </div>
      </div>

      {/* MESAJLAR */}
      <div className="chat-messages" ref={messagesContainerRef}>

        {hasMore && (
          <div className="chat-load-more">
            <button onClick={loadOlderMessages} disabled={loading}>
              {loading ? 'Yükleniyor...' : 'Daha eski mesajlar'}
            </button>
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="chat-no-messages">
            <Typography variant="caption" color="muted">
              Henüz mesaj yok. Bir şeyler yaz!
            </Typography>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender?.id === currentUserId}
            conversationId={conversationId}
          />
        ))}
      </div>

      {/* INPUT */}
      <div className="chat-input-area">
        <Input
          ref={inputRef}
          className="chat-input"
          placeholder="Mesaj yaz..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || sending}
          aria-label="Gönder"
        >
          ↑
        </button>
      </div>

    </div>
  );
};

export default ChatWindow;