import { parseContentToPages } from './index';

// jsdom has no layout engine; provide the plain-text behavior used by this
// browser algorithm without pretending to measure rendered page geometry.
let originalInnerText;
beforeAll(() => {
  originalInnerText = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText');
  Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; }, set(value) { this.textContent = value; } });
});
afterAll(() => {
  if (originalInnerText) Object.defineProperty(HTMLElement.prototype, 'innerText', originalInnerText);
  else delete HTMLElement.prototype.innerText;
});
const text = content => { const element = document.createElement('div'); element.innerHTML = content; return element.textContent; };

test.each([null, undefined, ''])('missing manuscripts have no pages: %s', input => {
  expect(parseContentToPages(input, 'Title')).toEqual([]);
});
test('short chapters preserve HTML and chapter-start metadata', () => {
  expect(parseContentToPages('<h2>Heading</h2><p>A <em>short</em> paragraph.</p>', 'Title')).toEqual([{ content: '<h2>Heading</h2><p>A <em>short</em> paragraph.</p>', title: 'Title', isChapterStart: true }]);
});
test('plain text manuscripts are wrapped into a paragraph', () => {
  const pages = parseContentToPages('Plain manuscript', 'Title');
  expect(pages).toHaveLength(1);
  expect(text(pages[0].content)).toBe('Plain manuscript');
});
test('paragraphs that fit a page are kept intact when the previous page is full', () => {
  const first = 'a'.repeat(1100), second = 'b'.repeat(200);
  const pages = parseContentToPages(`<p>${first}</p><p>${second}</p>`, 'Chapter');
  expect(pages.map(page => text(page.content))).toEqual([first, second]);
  expect(pages.map(page => page.isChapterStart)).toEqual([true, false]);
});
test('exact page boundaries do not produce a trailing empty page', () => {
  expect(parseContentToPages(`<p>${'a'.repeat(1200)}</p>`, 'Chapter')).toHaveLength(1);
});
test('large paragraphs split across pages without losing or reordering manuscript words', () => {
  const words = Array.from({ length: 650 }, (_, i) => `word${i}`);
  const pages = parseContentToPages(`<p class="manuscript">${words.join(' ')}</p>`, 'Long chapter');
  expect(pages.length).toBeGreaterThan(1);
  expect(pages.flatMap(page => text(page.content).trim().split(/\s+/))).toEqual(words);
  expect(pages.every(page => page.content.includes('class="manuscript"'))).toBe(true);
  expect(pages.filter(page => page.isChapterStart)).toHaveLength(1);
});
