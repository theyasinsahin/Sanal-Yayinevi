import { cleanRichText } from './richText';

export function hasChapterContent(content) {
  const container = document.createElement('div');
  container.innerHTML = cleanRichText(content);
  return Boolean(container.textContent.replace(/[\s\u200B-\u200D\uFEFF]/gu, ''));
}
