// src/components/Quote/QuoteCard/index.jsx
import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { 
  Favorite, FavoriteBorder, FormatQuote, Person, 
  Repeat, ChatBubbleOutline, Delete, Send
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { 
  TOGGLE_QUOTE_LIKE_MUTATION, 
  REPOST_QUOTE_MUTATION,
  ADD_QUOTE_COMMENT_MUTATION,
  DELETE_QUOTE_COMMENT_MUTATION,
  UNREPOST_QUOTE_MUTATION
} from '../../../graphql/mutations/quote';
import { GET_QUOTE_COMMENTS } from '../../../graphql/queries/quote';
import { useAuth } from '../../../context/AuthContext';
import './QuoteCard.css';

import ShareModal from '../../Messaging/ShareModal';
import { IosShare } from '@mui/icons-material';

// useAuth zaten import edilmiş, değişiklik yok

const QuoteCard = ({ quote }) => {
  const { user } = useAuth();

  // --- Like state ---
  const isLikedFromServer = user ? (quote.likedBy || []).includes(user.id) : false;
  const [optimisticLiked, setOptimisticLiked] = useState(null);
  const [optimisticCount, setOptimisticCount] = useState(null);
  const isLiked = optimisticLiked !== null ? optimisticLiked : isLikedFromServer;
  const likeCount = optimisticCount !== null ? optimisticCount : (quote.likedBy?.length || 0);

  // --- Repost state ---
  const alreadyReposted = user ? (quote.repostedBy || []).includes(user.id) : false;
  const [showRepostInput, setShowRepostInput] = useState(false);
  const [repostComment, setRepostComment] = useState('');
  const [repostDone, setRepostDone] = useState(alreadyReposted);

  // --- Yorum state ---
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const [shareOpen, setShareOpen] = useState(false);

  // QuoteCard'da state ekle:
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  // Mevcut repost state'lerinin yanına ekle
  const [optimisticRepostCount, setOptimisticRepostCount] = useState(null);
  const repostCount = optimisticRepostCount !== null 
    ? optimisticRepostCount 
    : (quote.repostedBy?.length || 0);

  // isSpoiler kontrolü:
  const showSpoiler = quote.isSpoiler && !spoilerRevealed;

  // --- Mutations ---
  const [toggleLike] = useMutation(TOGGLE_QUOTE_LIKE_MUTATION);
  const [repostQuote, { loading: reposting }] = useMutation(REPOST_QUOTE_MUTATION);
  const [addComment, { loading: commenting }] = useMutation(ADD_QUOTE_COMMENT_MUTATION);
  const [deleteComment] = useMutation(DELETE_QUOTE_COMMENT_MUTATION);
  const [unrepostQuote] = useMutation(UNREPOST_QUOTE_MUTATION);

  // --- Yorumları çek (sadece açıkken) ---
  const { data: commentsData, refetch: refetchComments } = useQuery(GET_QUOTE_COMMENTS, {
    variables: { quoteId: quote.id },
    skip: !showComments,
  });
  const comments = commentsData?.getQuoteComments || [];

  // --- Handlers ---
  const handleLike = async () => {
    if (!user) return;
    const currentLiked = optimisticLiked !== null ? optimisticLiked : isLikedFromServer;
    const currentCount = optimisticCount !== null ? optimisticCount : (quote.likedBy?.length || 0);
    setOptimisticLiked(!currentLiked);
    setOptimisticCount(currentLiked ? currentCount - 1 : currentCount + 1);
    try {
      await toggleLike({ variables: { id: quote.id } });
    } catch {
      setOptimisticLiked(currentLiked);
      setOptimisticCount(currentCount);
    }
  };

  const handleRepost = async () => {
    if (!user) return;

    const originalId = quote.isRepost ? quote.originalQuote?.id : quote.id;

    if (repostDone) {
      // --- Unrepost ---
      setOptimisticRepostCount((quote.repostedBy?.length || 0) - 1);
      setRepostDone(false);
      try {
        await unrepostQuote({ variables: { originalQuoteId: originalId } });
      } catch (err) {
        setOptimisticRepostCount(null);
        setRepostDone(true);
        console.error(err.message);
      }
    } else {
      // --- Repost ---
      setOptimisticRepostCount((quote.repostedBy?.length || 0) + 1);
      setRepostDone(true);
      setShowRepostInput(false);
      setRepostComment('');
      try {
        await repostQuote({
          variables: {
            originalQuoteId: originalId,
            repostComment: repostComment.trim() || null,
            isSpoiler: quote.isSpoiler || false,
          },
        });
      } catch (err) {
        setOptimisticRepostCount(null);
        setRepostDone(false);
        console.error(err.message);
      }
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;
    try {
      await addComment({ variables: { quoteId: quote.id, content: commentText.trim() } });
      setCommentText('');
      refetchComments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment({ variables: { id: commentId } });
      refetchComments();
    } catch (err) {
      console.error(err);
    }
  };

  const timeAgo = (dateValue) => {
    if (!dateValue) return '...';
    let timestamp = dateValue.seconds ? dateValue.seconds * 1000 : Number(dateValue);
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    if (isNaN(diff)) return '';
    const totalSeconds = Math.max(0, Math.floor(diff / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalSeconds / 3600);
    const days = Math.floor(totalSeconds / 86400);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins}dk önce`;
    if (hours < 24) return `${hours}sa önce`;
    return `${days}g önce`;
  };

  // Repost ise orijinal alıntıyı göster
  const displayQuote = quote.isRepost && quote.originalQuote ? quote.originalQuote : quote;
  const displayUser = quote.user;

  return (
    <div className="quote-card">

      {/* Repost header — bu kişi repostladı */}
      {quote.isRepost && (
        <div className="quote-card-repost-header">
          <Repeat fontSize="small" />
          <Link to={`/user/${displayUser?.id}`} className="quote-card-repost-user">
            @{displayUser?.username}
          </Link>
          <span>repostladı</span>
        </div>
      )}

      {/* Repost yorumu */}
      {quote.isRepost && quote.repostComment && (
        <p className="quote-card-repost-comment">"{quote.repostComment}"</p>
      )}

      {/* Alıntı Metni */}
<div className="quote-card-text-wrapper">
  <FormatQuote className="quote-card-icon open" />
  
  <div className={`quote-text-container ${showSpoiler ? 'is-spoiler' : ''}`}>
    <blockquote className="quote-card-text">{displayQuote.text}</blockquote>
    
    {showSpoiler && (
      <div className="spoiler-overlay" onClick={() => setSpoilerRevealed(true)}>
        <span className="spoiler-icon">⚠️</span>
        <span className="spoiler-label">Spoiler içeriyor</span>
        <span className="spoiler-hint">Görmek için tıkla</span>
      </div>
    )}
  </div>

  <FormatQuote className="quote-card-icon close" />
</div>

      {/* Not (orijinal alıntının notu) */}
      {displayQuote.note && (
        <p className="quote-card-note">"{displayQuote.note}"</p>
      )}

      {/* Repost ise orijinal kullanıcıyı göster */}
      {quote.isRepost && quote.originalQuote?.user && (
        <div className="quote-card-original-user">
          <span>Orijinal alıntı:</span>
          <Link to={`/user/${quote.originalQuote.user.id}`}>
            @{quote.originalQuote.user.username}
          </Link>
        </div>
      )}

      {/* Kaynak */}
      {displayQuote.book && (
        <Link to={`/book-detail/${displayQuote.book.id}`} className="quote-card-source">
          {displayQuote.book.imageUrl && (
            <img src={displayQuote.book.imageUrl} alt={displayQuote.book.title} className="quote-card-book-cover" />
          )}
          <div className="quote-card-source-info">
            <span className="quote-card-book-title">{displayQuote.book.title}</span>
            {displayQuote.chapterTitle && (
              <span className="quote-card-chapter">{displayQuote.chapterTitle}</span>
            )}
          </div>
        </Link>
      )}

      {/* Footer */}
      <div className="quote-card-footer">
        <Link to={`/user/${displayUser?.id}`} className="quote-card-user">
          {displayUser?.profilePicture ? (
            <img src={displayUser.profilePicture} alt={displayUser.username} className="quote-card-avatar" />
          ) : (
            <div className="quote-card-avatar-placeholder"><Person fontSize="small" /></div>
          )}
          <span>@{displayUser?.username}</span>
        </Link>

        <div className="quote-card-actions">
          <span className="quote-card-time">{timeAgo(quote.createdAt)}</span>

          {/* Yorum */}
          <button
            className="quote-card-action-btn"
            onClick={() => setShowComments(!showComments)}
          >
            <ChatBubbleOutline fontSize="small" />
            <span>{quote.commentCount || 0}</span>
          </button>

          {/* Repost */}
          {user && !quote.isRepost && (
            <button
              className={`quote-card-action-btn ${repostDone ? 'reposted' : ''}`}
              onClick={() => repostDone ? handleRepost() : setShowRepostInput(!showRepostInput)}
              title={repostDone ? 'Repostu geri al' : 'Repostla'}
            >
              <Repeat fontSize="small" />
              <span>{repostCount}</span>
            </button>
          )}

          {/* Beğeni */}
          <button
            className={`quote-card-like-btn ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            {isLiked ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
            <span>{likeCount}</span>
          </button>

          {/* Paylaş, sadece giriş yapılmışsa */}
          {user && (
            <button
              className="quote-card-action-btn"
              title="Arkadaşa gönder"
              onClick={() => setShareOpen(true)}
            >
              <IosShare fontSize="small" />
            </button>
          )}
        </div>
      </div>

      {/* Repost input */}
      {showRepostInput && !repostDone && (
        <div className="quote-card-repost-input">
          <textarea
            className="quote-card-textarea"
            placeholder="Repost yorumu ekle... (opsiyonel)"
            value={repostComment}
            onChange={(e) => setRepostComment(e.target.value)}
            rows={2}
          />
          <div className="quote-card-repost-actions">
            <button 
              className="quote-card-cancel-btn"
              onClick={() => { setShowRepostInput(false); setRepostComment(''); }}
            >
              İptal
            </button>
            <button
              className="quote-card-repost-btn"
              onClick={handleRepost}
              disabled={reposting}
            >
              <Repeat fontSize="small" />
              {reposting ? 'Repostlanıyor...' : 'Repostla'}
            </button>
          </div>
        </div>
      )}

      {/* Yorumlar */}
      {showComments && (
        <div className="quote-card-comments">
          
          {/* Yorum input */}
          {user && (
            <div className="quote-card-comment-input">
              <input
                placeholder="Yorum yaz..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                className="quote-card-comment-field"
              />
              <button
                className="quote-card-comment-send"
                onClick={handleAddComment}
                disabled={commenting || !commentText.trim()}
              >
                <Send fontSize="small" />
              </button>
            </div>
          )}

          {/* Yorum listesi */}
          {comments.length === 0 ? (
            <p className="quote-card-no-comments">Henüz yorum yok.</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="quote-card-comment-item">
                <div className="quote-card-comment-header">
                  {comment.user?.profilePicture ? (
                    <img src={comment.user.profilePicture} alt="" className="quote-card-comment-avatar" />
                  ) : (
                    <div className="quote-card-comment-avatar-placeholder"><Person fontSize="inherit" /></div>
                  )}
                  <Link to={`/user/${comment.user?.id}`} className="quote-card-comment-username">
                    @{comment.user?.username}
                  </Link>
                  <span className="quote-card-comment-time">{timeAgo(comment.createdAt)}</span>
                  {user?.id === comment.user?.id && (
                    <button
                      className="quote-card-comment-delete"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Delete fontSize="inherit" />
                    </button>
                  )}
                </div>
                <p className="quote-card-comment-content">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ShareModal */}
      {shareOpen && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          type="QUOTE"
          attachedQuoteId={displayQuote.id}
          attachedQuote={displayQuote}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
};

export default QuoteCard;