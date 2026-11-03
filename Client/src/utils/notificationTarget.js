export function notificationTarget(notification, user) {
  const { type } = notification;
  const meta = notification.meta || {};
  const segment = value => typeof value === 'string' && value ? encodeURIComponent(value) : null;
  const bookId = segment(meta.bookId);
  const chapterId = segment(meta.chapterId);
  const userId = segment(meta.userId || meta.requesterId);
  switch (type) {
    case 'POINTS_EARNED': return null;
    case 'BOOK_REVIEW': return user?.role === 'ADMIN' ? '/admin/printed-books' : bookId ? `/book-detail/${bookId}` : '/printed-books';
    case 'NEW_CHAPTER': return bookId ? `/book-reader/${bookId}${chapterId ? `?chapter=${chapterId}` : ''}` : null;
    case 'BOOK_LIKED':
    case 'COMMENT_RECEIVED': return bookId ? `/book-detail/${bookId}${type === 'COMMENT_RECEIVED' ? '#comments' : ''}` : null;
    case 'QUOTE_LIKED': return segment(meta.quoteId) ? `/quotes/${segment(meta.quoteId)}` : null;
    case 'SESSION_MENTION':
    case 'SESSION_REPLY': return segment(meta.sessionId) ? `/sessions/${segment(meta.sessionId)}` : null;
    case 'FOLLOW_REQUEST':
    case 'FOLLOW_REQUEST_ACCEPTED':
    case 'NEW_FOLLOWER': return userId ? `/user/${userId}` : null;
    case 'BADGE_EARNED': return '/profile';
    case 'PRINT_UPDATE': return bookId ? (meta.authorId === user?.id ? `/print/${bookId}` : `/book-detail/${bookId}`) : user?.role === 'ADMIN' ? '/admin/print-funding' : '/funding-history';
    case 'FUNDING_RECEIVED': return bookId ? `/print/${bookId}` : '/funding-history';
    default: return null;
  }
}
