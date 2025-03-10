// components/CommentList.jsx
import React from 'react';
import CommentItem from './CommentItem';

const CommentList = ({ comments }) => {
  return (
    <div className="comment-list">
      {comments.map(comment => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
};

export default CommentList;