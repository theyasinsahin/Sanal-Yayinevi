export function notificationTarget(notification, user) {
  const { type } = notification;
  const meta = notification.meta || {};
  const segment = value => typeof value === 'string' && value ? encodeURIComponent(value) : null;
  const bookId = segment(meta.bookId);
  const chapterId = segment(meta.chapterId);
  const userId = segment(meta.userId || meta.requesterId);
  const commentId = segment(meta.commentId);
  const entryId = segment(meta.entryId);
  const sessionId = segment(meta.sessionId);
  const quoteId = segment(meta.quoteId);
  switch (type) {
    case 'POINTS_EARNED': return null;
    case 'BOOK_REVIEW': return user?.role === 'ADMIN' ? '/admin/printed-books' : bookId ? `/book-detail/${bookId}` : '/printed-books';
    case 'NEW_CHAPTER': return bookId ? `/book-reader/${bookId}${chapterId ? `?chapter=${chapterId}` : ''}` : null;
    case 'BOOK_LIKED': return bookId ? `/book-detail/${bookId}` : null;
    case 'COMMENT_RECEIVED':
    case 'COMMENT_MENTION': return bookId ? `/book-detail/${bookId}${commentId ? `#comment-${commentId}` : '#comments'}` : null;
    case 'PARAGRAPH_MENTION': return bookId && chapterId && Number.isInteger(meta.paragraphIndex) && meta.paragraphIndex >= 0
      ? `/book-reader/${bookId}?chapter=${chapterId}&paragraph=${meta.paragraphIndex}${commentId ? `#paragraph-comment-${commentId}` : ''}` : null;
    case 'QUOTE_MENTION': return quoteId ? `/quotes/${quoteId}${commentId ? `#quote-comment-${commentId}` : ''}` : null;
    case 'QUOTE_LIKED': return quoteId ? `/quotes/${quoteId}` : null;
    case 'SESSION_MENTION':
    case 'SESSION_REPLY': return sessionId ? `/sessions/${sessionId}${entryId ? `#entry-${entryId}` : ''}` : null;
    case 'FOLLOW_REQUEST':
    case 'FOLLOW_REQUEST_ACCEPTED':
    case 'NEW_FOLLOWER': return userId ? `/user/${userId}` : null;
    case 'BADGE_EARNED': return '/profile';
    case 'PRINT_UPDATE': return bookId ? (meta.authorId === user?.id ? `/print/${bookId}` : `/book-detail/${bookId}`) : user?.role === 'ADMIN' ? '/admin/print-funding' : '/funding-history';
    case 'FUNDING_RECEIVED': return bookId ? `/print/${bookId}` : '/funding-history';
    default: return null;
  }
}
