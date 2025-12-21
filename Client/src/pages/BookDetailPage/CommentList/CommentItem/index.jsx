import React, { useState } from 'react';
import { AccountCircle, FavoriteBorder, Favorite, Delete, Reply } from '@mui/icons-material'; // Reply ikonu eklendi
import { useMutation } from '@apollo/client';

import { DELETE_COMMENT_MUTATION, TOGGLE_COMMENT_LIKE_MUTATION, REPLY_TO_COMMENT_MUTATION } from '../../../../graphql/mutations/comment';
import { GET_BOOK_BY_ID } from '../../../../graphql/queries/book';

// Recursive (Kendi kendini çağıran) yapı için component'i forwardRef veya direkt kullanabiliriz.
// Ama 1 seviye derinlik için direkt children render etmek daha kolaydır.

const CommentItem = ({ comment, currentUserId, bookId, isReply = false }) => {
  
  // State: Yanıtla inputunu göster/gizle
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");

  // --- MUTATIONLAR ---
  const [deleteComment] = useMutation(DELETE_COMMENT_MUTATION, {
    refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId } }],
    onError: (err) => console.error("Silme hatası:", err)
  });

  const [toggleLike] = useMutation(TOGGLE_COMMENT_LIKE_MUTATION);

  const [replyToComment, { loading: replyLoading }] = useMutation(REPLY_TO_COMMENT_MUTATION, {
    refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId } }],
    onCompleted: () => {
      setShowReplyInput(false);
      setReplyText("");
    },
    onError: (err) => alert("Yanıt gönderilemedi: " + err.message)
  });

  // --- HANDLERS ---
  const handleDelete = () => {
    if (window.confirm("Silmek istediğinize emin misiniz?")) {
      deleteComment({ variables: { id: comment.id } });
    }
  };

  const handleLike = () => {
    if (!currentUserId) return alert("Giriş yapmalısınız.");
    toggleLike({ variables: { commentId: comment.id } });
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    await replyToComment({
      variables: {
        bookId,
        content: replyText,
        parentCommentId: comment.id // Kime yanıt veriyorsak onun ID'si
      }
    });
  };

  // --- VERİ HAZIRLAMA ---
  const author = comment.userId;
  const username = author?.username || "Bilinmeyen";
  
  const dateStr = comment.date 
    ? new Date(Number(comment.date) || comment.date).toLocaleDateString() 
    : '';

  const isMyComment = currentUserId && author?.id === currentUserId;
  const likedBy = comment.likedBy || [];
  const isLiked = currentUserId && likedBy.includes(currentUserId);

  return (
    <div className={`comment-item ${isReply ? 'reply-item' : ''}`} style={{ marginLeft: isReply ? '40px' : '0', marginTop: '10px' }}>
      
      {/* --- HEADER --- */}
      <div className="comment-header">
        <div style={{display:'flex', alignItems:'center'}}>
            {author?.profilePicture ? (
                <img src={author.profilePicture} alt="avatar" style={{width: isReply ? 25 : 30, height: isReply ? 25 : 30, borderRadius:'50%', marginRight:10}}/>
            ) : (
                <AccountCircle className="user-avatar" style={{ fontSize: isReply ? 25 : 30 }} />
            )}
            
            <div className="user-info">
              <span className="username" style={{ fontSize: isReply ? '0.9rem' : '1rem' }}>{username}</span>
              <span className="comment-date" style={{ fontSize: '0.75rem' }}>{dateStr}</span>
            </div>
        </div>
        
        {isMyComment && (
            <button onClick={handleDelete} className="delete-comment-btn" style={{background:'none', border:'none', cursor:'pointer', color:'#d32f2f', marginLeft: 'auto'}}>
                <Delete fontSize="small" />
            </button>
        )}
      </div>
      
      {/* --- CONTENT --- */}
      <p className="comment-text" style={{ fontSize: isReply ? '0.9rem' : '1rem' }}>{comment.content}</p>
      
      {/* --- ACTIONS --- */}
      <div className="comment-actions" style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
        {/* Beğen Butonu */}
        <button className="action-button" onClick={handleLike} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', color: isLiked ? '#e91e63' : 'inherit' }}>
          {isLiked ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
          <span>{likedBy.length || 0}</span>
        </button>

        {/* Yanıtla Butonu */}
        <button 
          className="action-button" 
          onClick={() => setShowReplyInput(!showReplyInput)}
          style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}
        >
          <Reply fontSize="small" />
          <span>Yanıtla</span>
        </button>
      </div>

      {/* --- YANIT INPUT ALANI --- */}
      {showReplyInput && (
        <div className="reply-input-container" style={{ marginTop: '10px', marginLeft: '20px' }}>
          <textarea 
            placeholder={`@${username} kullanıcısına yanıt ver...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
            <button 
                onClick={handleReplySubmit} 
                disabled={replyLoading}
                style={{ padding: '5px 15px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                {replyLoading ? "..." : "Gönder"}
            </button>
          </div>
        </div>
      )}

      {/* --- ALT YANITLAR (REPLIES) --- */}
      {/* Eğer bu bir ana yorumsa (isReply false ise) ve replies varsa onları render et */}
      {!isReply && comment.replies && comment.replies.length > 0 && (
        <div className="replies-list" style={{ borderLeft: '2px solid #eee', paddingLeft: '10px' }}>
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              currentUserId={currentUserId} 
              bookId={bookId}
              isReply={true} // <-- Kritik nokta: Bunların reply olduğunu belirtiyoruz
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;