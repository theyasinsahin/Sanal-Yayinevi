import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { AccountCircle, FavoriteBorder, Favorite, Delete, Reply } from '@mui/icons-material';

// --- LOGIC ---
import { DELETE_COMMENT_MUTATION, TOGGLE_COMMENT_LIKE_MUTATION, REPLY_TO_COMMENT_MUTATION } from '../../../graphql/mutations/comment';
import { GET_BOOK_BY_ID } from '../../../graphql/queries/book';
import { GET_COMMENTS_BY_BOOK_ID } from '../../../graphql/queries/comment';

// --- UI KIT ---
import { Button } from '../../UI/Button';
import { Typography } from '../../UI/Typography';
import { Input } from '../../UI/Input';

import './CommentItem.css';

const CommentItem = ({ comment, currentUserId, bookId, isReply = false }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");

  const refetchOptions = [{ query: GET_COMMENTS_BY_BOOK_ID, variables: { bookId } }];

  // Mutations (Hata yönetimi üst bileşendeki gibi yapılabilir, şimdilik alert)
  const [deleteComment] = useMutation(DELETE_COMMENT_MUTATION, {
    refetchQueries: refetchOptions
  });

  const [toggleLike] = useMutation(TOGGLE_COMMENT_LIKE_MUTATION);

  const [replyToComment, { loading: replyLoading }] = useMutation(REPLY_TO_COMMENT_MUTATION, {
    refetchQueries: refetchOptions,
    onCompleted: () => {
      setShowReplyInput(false);
      setReplyText("");
    }
  });

  // Handlers
  const handleDelete = () => {
    if (window.confirm("Silmek istediğinize emin misiniz?")) {
      deleteComment({ variables: { id: comment.id } });
    }
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    await replyToComment({
      variables: { bookId, content: replyText, parentCommentId: comment.id }
    });
  };

  // Variables
  const author = comment.userId;
  const username = author?.username || "Bilinmeyen";
  const profilePic = author?.profilePicture;
  const dateStr = comment.date ? new Date(comment.date).toLocaleDateString() : '';
  const isMyComment = currentUserId && author?.id === currentUserId;
  const isLiked = currentUserId && (comment.likedBy || []).includes(currentUserId);

  return (
    <div className={`comment-item ${isReply ? 'is-reply' : ''}`}>
      
      {/* Header */}
      <div className="comment-header">
        <div className="user-group">
           <div className="avatar-wrapper">
             {profilePic ? (
               <img 
                 src={profilePic} 
                 alt={username} 
                 className="avatar-image" // Class ismi değişti
                 loading="lazy"
                 onError={(e) => {
                   // Resim yüklenmezse resmi gizle, fallback ikonu göster
                   e.target.style.display = 'none'; 
                   e.target.parentElement.nextSibling.style.display = 'block'; 
                 }}
               />
             ) : (
               <AccountCircle className="avatar-fallback-icon" />
             )}
             
             {/* Resim patlarsa veya yoksa arkada bu ikon gözüksün diye buraya da koyabiliriz 
                 ama yukarıdaki ternary mantığı zaten bunu yönetiyor. */}
           </div>
           
           {/* Eğer resim yoksa fallback olarak gösterilecek ikon (JSX yapına göre) */}
           {!profilePic && <AccountCircle className="avatar-fallback-icon" style={{display: 'none'}} />}



           <div className="user-meta">
             <span className="username">{username}</span>
             <span className="date">{dateStr}</span>
           </div>
        </div>
        
        {isMyComment && (
          <button onClick={handleDelete} className="delete-icon-btn">
             <Delete fontSize="small" />
          </button>
        )}
      </div>

      {/* Content */}
      <Typography variant="body" className="comment-content">
        {comment.content}
      </Typography>

      {/* Actions */}
      <div className="comment-actions">
         <button onClick={() => toggleLike({ variables: { commentId: comment.id } })} className={`action-link ${isLiked ? 'liked' : ''}`}>
            {isLiked ? <Favorite fontSize="inherit"/> : <FavoriteBorder fontSize="inherit"/>}
            <span>{comment.likedBy?.length || 0}</span>
         </button>

         <button onClick={() => setShowReplyInput(!showReplyInput)} className="action-link">
            <Reply fontSize="inherit"/>
            <span>Yanıtla</span>
         </button>
      </div>

      {/* Reply Input */}
      {showReplyInput && (
        <div className="reply-form">
          <Input 
             placeholder={`@${username} kullanıcısına yanıt ver...`}
             value={replyText}
             onChange={(e) => setReplyText(e.target.value)}
             className="mb-2"
          />
          <div className="flex justify-end">
             <Button size="small" variant="dark" onClick={handleReplySubmit} isLoading={replyLoading}>
               Gönder
             </Button>
          </div>
        </div>
      )}

      {/* Replies (Recursive) */}
      {!isReply && comment.replies && comment.replies.length > 0 && (
        
        /* BURASI ÇOK ÖNEMLİ: CSS'teki dikey çizgi bu div'e bağlı */
        <div className="replies-wrapper">
          
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              currentUserId={currentUserId} 
              bookId={bookId}
              isReply={true} // Bu prop, avatarın küçülmesini tetikler
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;