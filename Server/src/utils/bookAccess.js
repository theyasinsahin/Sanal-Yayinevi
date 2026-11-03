export function canReadBook(book, viewer) {
  if (!book || book.isDeleted) return false;
  const userId = viewer?._id || viewer?.id;
  const privileged = viewer && viewer.isActive !== false && !viewer.isDeleted && (viewer.role === 'ADMIN' || String(book.authorId?._id || book.authorId) === String(userId));
  if (book.kind === 'PRINTED') return book.publicationStatus === 'APPROVED' || Boolean(privileged) || Boolean(userId && String(book.submittedBy) === String(userId));
  return (book.digitalStatus ? book.digitalStatus !== 'DRAFT' : book.status !== 'DRAFT') || Boolean(privileged);
}
