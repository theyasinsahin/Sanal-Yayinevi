// components/CommentItem.jsx
import React from 'react';
import { AccountCircle, FavoriteBorder, Reply } from '@mui/icons-material';

const CommentItem = ({ comment }) => {
  return (
    <div className="comment-item">
      <div className="comment-header">
        <AccountCircle className="user-avatar" />
        <div className="user-info">
          <span className="username">{comment.user}</span>
          <span className="comment-date">{comment.date}</span>
        </div>
      </div>
      
      <p className="comment-text">{comment.text}</p>
      
      <div className="comment-actions">
        <button className="action-button">
          <FavoriteBorder fontSize="small" />
          <span>{comment.likes || 0}</span>
        </button>
        <button className="action-button">
          <Reply fontSize="small" />
          Yanıtla
        </button>
      </div>
      
      {comment.replies && (
        <div className="replies-container">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;