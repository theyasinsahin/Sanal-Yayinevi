export const genreName = value => String(value || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
