import React from 'react';
import CommentItem from './CommentItem';

const CommentList = ({ comments, currentUserId, bookId }) => {
  // Yorumları yeniden eskiye sırala
  // (Eğer comments null gelirse patlamaması için '|| []' ekledik)
  const sortedComments = comments ? [...comments].reverse() : [];

  return (
    <div className="comment-list">
      {sortedComments.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: '10px' }}>
          Henüz yorum yapılmamış. İlk yorumu sen yap!
        </p>
      ) : (
        sortedComments.map(comment => (
          <CommentItem 
            key={comment.id} 
            comment={comment} // DİKKAT: Direkt objeyi gönderiyoruz (ID değil)
            currentUserId={currentUserId}
            bookId={bookId}
          />
        ))
      )}
    </div>
  );
};

export default CommentList;