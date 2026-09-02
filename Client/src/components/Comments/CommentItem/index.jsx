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

  // Optimistic UI state
  const [optimisticLiked, setOptimisticLiked] = useState(null);     // null = sunucudan gelen değeri kullan
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(null);

  const refetchOptions = [{ query: GET_COMMENTS_BY_BOOK_ID, variables: { bookId } }];

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

  const handleLike = async () => {
    if (!currentUserId) return;

    const currentlyLiked = optimisticLiked !== null ? optimisticLiked : isLikedFromServer;
    const currentCount = optimisticLikeCount !== null ? optimisticLikeCount : (comment.likedBy?.length || 0);

    // Optimistic: UI'ı anında güncelle
    setOptimisticLiked(!currentlyLiked);
    setOptimisticLikeCount(currentlyLiked ? currentCount - 1 : currentCount + 1);

    try {
      await toggleLike({ variables: { commentId: comment.id } });
    } catch (err) {
      // Hata gelirse geri al
      setOptimisticLiked(currentlyLiked);
      setOptimisticLikeCount(currentCount);
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

  // Sunucudan gelen gerçek değer
  const isLikedFromServer = currentUserId ? (comment.likedBy || []).includes(currentUserId) : false;

  // Optimistic varsa onu, yoksa sunucudan geleni kullan
  const isLiked = optimisticLiked !== null ? optimisticLiked : isLikedFromServer;
  const likeCount = optimisticLikeCount !== null ? optimisticLikeCount : (comment.likedBy?.length || 0);

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
                className="avatar-image"
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none'; 
                  e.target.parentElement.nextSibling.style.display = 'block'; 
                }}
              />
            ) : (
              <AccountCircle className="avatar-fallback-icon" />
            )}
          </div>
          
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
        <button onClick={handleLike} className={`action-link ${isLiked ? 'liked' : ''}`}>
          {isLiked ? <Favorite fontSize="inherit"/> : <FavoriteBorder fontSize="inherit"/>}
          <span>{likeCount}</span>
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
        <div className="replies-wrapper">
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              currentUserId={currentUserId} 
              bookId={bookId}
              isReply={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;