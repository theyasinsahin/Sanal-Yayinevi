export const isChapterLocked = chapter => chapter?.canReadContent === false;
export function chapterLengthLabel(chapter) {
  const parts = [];
  if (Number.isInteger(chapter?.wordCount)) parts.push(`${chapter.wordCount.toLocaleString('tr-TR')} kelime`);
  if (chapter?.pageCount > 0) parts.push(`${chapter.pageCount.toLocaleString('tr-TR')} sayfa`);
  return parts.join(' · ') || 'Uzunluk bilgisi hazırlanıyor';
}
