export const chapterWordCount = content => String(content || '').replace(/<[^>]*>/g, ' ').replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, ' ').trim().split(/\s+/u).filter(Boolean).length;
