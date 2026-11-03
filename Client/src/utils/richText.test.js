/* eslint-disable testing-library/no-node-access -- Sanitizer tests inspect actual DOM attributes, without React components. */
import { cleanRichText } from './richText';
import { parseContentToPages } from './htmlPageSplitter';

test.each([
  '<p onclick="alert(1)">ok</p><img src=x onerror=alert(2)>',
  '<svg><textarea><img src=x onerror=alert(1)>',
  '<a href="jav&#x61;script:alert(1)">x</a>',
  '<img src="data:image/svg+xml;base64,PHN2Zy8+">',
  '<img src="data:image/png;base64,PHN2Zy8+">',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
])('render sanitization rejects hostile content %s', html => {
  const container = document.createElement('div'); container.innerHTML = cleanRichText(html);
  expect(container.querySelector('script, svg, math, [onclick], [onerror]')).toBeNull();
  expect(cleanRichText(html)).not.toMatch(/javascript:|src="data:image/i);
});

test('legitimate editor formatting, links and raster image embeds survive', () => {
  const clean = cleanRichText('<h2>Başlık</h2><p class="ql-align-center"><strong>Türkçe metin</strong><a href="https://example.test/" target="_blank">Bağlantı</a><img src="data:image/png;base64,iVBORw0KGgo="></p>');
  expect(clean).toContain('<strong>Türkçe metin</strong>');
  expect(clean).toContain('ql-align-center'); expect(clean).toContain('noopener noreferrer');
  expect(clean).toContain('data:image/png;base64,iVBORw0KGgo=');
});

test('page splitting cannot reintroduce hostile markup from attribute quotes', () => {
  const pages = parseContentToPages('<p class="ql-align-center" title="&quot; onmouseover=&quot;alert(1)">' + 'long text '.repeat(1000) + '</p>');
  for (const page of pages) {
    const container = document.createElement('div'); container.innerHTML = page.content;
    expect(container.querySelector('[onmouseover]')).toBeNull();
  }
});
