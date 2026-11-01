export const profilePath = user => user?.publicPath || (user?.username
  ? `/yazar/${encodeURIComponent(user.username)}` : `/user/${user?.id || ''}`);
export const bookPath = book => book?.publicPath || `/book-detail/${book?.id || ''}`;
export const readerPath = book => book?.publicPath ? `${book.publicPath}/oku` : `/book-reader/${book?.id || ''}`;
export const sessionPath = session => session?.publicPath || `/sessions/${session?.id || ''}`;
