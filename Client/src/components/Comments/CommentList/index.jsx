import React, { useMemo } from 'react';
import CommentItem from '../CommentItem';
import { Typography } from '../../UI/Typography';

const CommentList = ({ comments, currentUserId, bookId }) => {

  // --- FLAT LIST -> TREE CONVERSION ---
  const rootComments = useMemo(() => {
    if (!comments || comments.length === 0) return [];

    // 1. Referansları tutmak için bir Map oluştur
    const commentMap = {};
    // Gelen veriyi bozmamak için kopyala ve map'e at
    comments.forEach(c => {
      // Backend 'replies' dizisini boş gönderse bile biz frontend'de dolduracağız
      commentMap[c.id] = { ...c, replies: [] };
    });

    const roots = [];

    // 2. İlişkileri kur
    comments.forEach(c => {
      // Bu yorumun bir babası var mı?
      // Not: Backend parentId'yi string mi yoksa obje mi dönüyor?
      // Eğer populate edilmediyse string ID döner.
      const parentId = typeof c.parentId === 'object' ? c.parentId?.id : c.parentId;

      if (parentId && commentMap[parentId]) {
        // Varsa, babasının replies dizisine kendini ekle
        commentMap[parentId].replies.push(commentMap[c.id]);
      } else {
        // Yoksa, bu bir ana yorumdur (Root)
        roots.push(commentMap[c.id]);
      }
    });

    // 3. Ana yorumları tarihe göre sırala (Yeniden eskiye)
    return roots.sort((a, b) => new Date(b.date) - new Date(a.date));

  }, [comments]);


  return (
    <div className="comment-list">
      {rootComments.length === 0 ? (
        <div className="text-center py-4">
           <Typography variant="body" color="muted" style={{ fontStyle: 'italic' }}>
             Henüz yorum yapılmamış. İlk yorumu sen yap!
           </Typography>
        </div>
      ) : (
        rootComments.map(comment => (
          <CommentItem 
            key={comment.id} 
            comment={comment} // Artık içinde replies dolu olan objeyi gönderiyoruz
            currentUserId={currentUserId}
            bookId={bookId}
            // isReply göndermiyoruz, çünkü bunlar ana kök yorumlar
          />
        ))
      )}
    </div>
  );
};

export default CommentList;