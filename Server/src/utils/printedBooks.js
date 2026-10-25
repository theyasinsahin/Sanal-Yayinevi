export const isPrintedBook = book => book?.kind === 'PRINTED';
export const visiblePrintedFilter = { $or: [{ kind: { $ne: 'PRINTED' } }, { publicationStatus: 'APPROVED' }] };
export const digitalBookFilter = { kind: { $ne: 'PRINTED' } };

export function canEditBookContent(book, user) {
  if (!book || !user) return false;
  if (isPrintedBook(book) && (book.publicationStatus !== 'APPROVED' || !book.authorId)) return false;
  return user.role === 'ADMIN' || String(book.authorId) === String(user._id || user.id);
}

export function assertContentAccess(book, user) {
  if (!canEditBookContent(book, user)) throw new Error('Bu kitaba içerik eklemek için onaylanmış yazar yetkisi gerekir.');
}

export function normalizeIsbn(value) {
  const isbn = String(value || '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    if ([...isbn].reduce((sum, digit, index) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0) % 11 !== 0) throw new Error('ISBN kontrol basamağı geçersiz.');
    const prefix = '978' + isbn.slice(0, 9);
    const sum = [...prefix].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return prefix + ((10 - sum % 10) % 10);
  }
  if (!/^97[89]\d{10}$/.test(isbn) || [...isbn].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 !== 0) {
    throw new Error('Geçerli bir ISBN-10 veya ISBN-13 girin.');
  }
  return isbn;
}
