// src/components/ParagraphComment/ParagraphCommentPanel/index.jsx
import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Send, Delete, Person, Close } from '@mui/icons-material';
import { GET_PARAGRAPH_COMMENTS } from '../../../graphql/queries/paragraphComment';
import { 
  ADD_PARAGRAPH_COMMENT, 
  DELETE_PARAGRAPH_COMMENT 
} from '../../../graphql/mutations/paragraphComment';
import { useAuth } from '../../../context/AuthContext';
import './ParagraphCommentPanel.css';

const ParagraphCommentPanel = ({ bookId, chapterId, paragraphIndex, onClose }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');

  const { data, loading, refetch } = useQuery(GET_PARAGRAPH_COMMENTS, {
    variables: { chapterId, paragraphIndex },
  });

  const [addComment, { loading: adding }] = useMutation(ADD_PARAGRAPH_COMMENT);
  const [deleteComment] = useMutation(DELETE_PARAGRAPH_COMMENT);

  const comments = data?.getParagraphComments || [];

  const handleAdd = async () => {
    if (!content.trim()) return;
    await addComment({
      variables: { bookId, chapterId, paragraphIndex, content: content.trim() }
    });
    setContent('');
    refetch();
  };

  const handleDelete = async (id) => {
    await deleteComment({ variables: { id } });
    refetch();
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(Number(dateStr)).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins}dk`;
    if (hours < 24) return `${hours}sa`;
    return `${days}g`;
  };

  return (
    <div className="pcpanel" onTouchEnd={(e) => e.stopPropagation()}>
      <div className="pcpanel-header">
        <span className="pcpanel-title">
          Paragraf Yorumları
          {comments.length > 0 && (
            <span className="pcpanel-count">{comments.length}</span>
          )}
        </span>
        <button className="pcpanel-close" onClick={onClose}>
          <Close fontSize="small" />
        </button>
      </div>

      <div className="pcpanel-comments">
        {loading ? (
          <div className="pcpanel-loading">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="pcpanel-skeleton" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="pcpanel-empty">
            <span>💬</span>
            <p>Henüz yorum yok. İlk yorumu sen yap!</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="pcpanel-comment">
              <div className="pcpanel-comment-header">
                {comment.user?.profilePicture ? (
                  <img 
                    src={comment.user.profilePicture} 
                    alt="" 
                    className="pcpanel-avatar" 
                  />
                ) : (
                  <div className="pcpanel-avatar-placeholder">
                    <Person fontSize="inherit" />
                  </div>
                )}
                <div className="pcpanel-comment-meta">
                  <span className="pcpanel-username">@{comment.user?.username}</span>
                  <span className="pcpanel-time">{timeAgo(comment.createdAt)}</span>
                </div>
                {user?.id === comment.user?.id && (
                  <button 
                    className="pcpanel-delete"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Delete fontSize="inherit" />
                  </button>
                )}
              </div>
              <p className="pcpanel-comment-content">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="pcpanel-input-area">
        {user ? (
          <>
            <textarea
              className="pcpanel-input"
              placeholder="Yorumunuzu yazın..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd();
              }}
              rows={3}
            />
            <button
              className="pcpanel-send"
              onClick={handleAdd}
              disabled={adding || !content.trim()}
            >
              <Send fontSize="small" />
              {adding ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </>
        ) : (
          <p className="pcpanel-login-notice">
            Yorum yapmak için giriş yapmalısınız.
          </p>
        )}
      </div>
    </div>
  );
};

export default ParagraphCommentPanel;