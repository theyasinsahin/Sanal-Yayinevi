// Generates golden fixtures by executing the website's ORIGINAL code:
//   - Client/src/utils/richText.js           (DOMPurify configuration)
//   - Client/src/utils/htmlPageSplitter      (page count)
//   - ParagraphRenderer's segmentation rule  (paragraph index)
//   - Quill 1.3.7                             (HTML <-> Delta)
// Usage: node generate_web_golden.cjs <Client dir with node_modules> <repo Client/src> <output.json>
const fs = require('fs');
const path = require('path');
const [, , modulesRoot, srcRoot, outFile] = process.argv;
const req = name => require(path.join(modulesRoot, 'node_modules', name));
const { JSDOM } = req('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="editor"></div></body></html>', { pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document; global.navigator = window.navigator;
global.Node = window.Node; global.MutationObserver = window.MutationObserver; global.DOMParser = window.DOMParser;
global.HTMLElement = window.HTMLElement; global.Element = window.Element; global.Text = window.Text;
global.getComputedStyle = window.getComputedStyle; global.atob = window.atob;
window.document.getSelection = () => ({ getRangeAt() {}, removeAllRanges() {}, addRange() {}, rangeCount: 0 });
window.document.execCommand = () => false;

const createDOMPurify = req('dompurify');
const DOMPurify = (createDOMPurify.default || createDOMPurify)(window);

// --- original sanitiser -----------------------------------------------------
let richSource = fs.readFileSync(path.join(srcRoot, 'utils/richText.js'), 'utf8')
  .replace(/^import .*$/m, '').replace(/export function/g, 'function');
const cleanRichText = new Function('DOMPurify', 'atob', `${richSource}; return cleanRichText;`)(DOMPurify, window.atob);

// --- original page splitter ---------------------------------------------------
let splitSource = fs.readFileSync(path.join(srcRoot, 'utils/htmlPageSplitter/index.js'), 'utf8')
  .replace(/^import .*$/m, '').replace(/export const/g, 'const');
const parseContentToPages = new Function('cleanRichText', 'document', `${splitSource}; return parseContentToPages;`)(cleanRichText, window.document);

// --- paragraph segmentation (rule copied from ParagraphRenderer `segments`) ---
function segments(content) {
  const doc = new window.DOMParser().parseFromString(cleanRichText(content), 'text/html');
  let paragraphIndex = 0;
  return Array.from(doc.body.childNodes).map(node => node.nodeName === 'P' ? paragraphIndex++ : null);
}

// --- Quill ------------------------------------------------------------------
const Quill = req('quill');
const quill = new Quill(window.document.getElementById('editor'));
const toHtml = delta => { quill.setContents(delta); return quill.root.innerHTML; };
const toDelta = html => quill.clipboard.convert(html).ops;

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const lorem = n => Array.from({ length: n }, (_, i) => `kelime${i % 17}`).join(' ');
const long = (count, words) => Array.from({ length: count }, (_, i) => `<p>${i}. ${lorem(words)}</p>`).join('');

const htmlCases = {
  empty: '',
  plainText: 'etiketsiz düz metin\nikinci satır',
  simple: '<p>Merhaba dünya</p>',
  emptyLine: '<p>Bir</p><p><br></p><p>İki</p>',
  formats: '<p><strong>kalın</strong> <em>italik</em> <u>altı çizili</u> <s>üstü çizili</s></p>',
  nested: '<p><strong><em><u>hepsi</u></em></strong> ve <strong>kalın <em>iç italik</em></strong></p>',
  headings: '<h1>Başlık 1</h1><h2>Başlık 2</h2><p>metin</p>',
  quote: '<blockquote>Alıntı satırı</blockquote><p>sonra</p>',
  lists: '<ol><li>bir</li><li>iki</li></ol><ul><li>madde</li><li><strong>kalın</strong> madde</li></ul>',
  link: '<p>Bir <a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer" target="_blank">bağlantı</a> var</p>',
  image: `<p><img src="${png}"></p><p>görselden sonra</p>`,
  entities: '<p>Özel: &lt;b&gt;değil&lt;/b&gt; &amp; "tırnak" İıŞşĞğ 😀</p>',
  mixedTopLevel: '<h2>Başlık</h2><p>p0</p><blockquote>q</blockquote><p>p1</p><ul><li>a</li></ul><p>p2</p>',
  unsafe: '<p onclick="x()">a<script>alert(1)</script><span style="color:red" class="ql-size-large">b</span><a href="javascript:x" target="_blank" title="t">c</a></p><table><tr><td>hücre</td></tr></table>',
  indentAlign: '<p class="ql-align-center">orta</p><p class="ql-indent-2">girinti</p><ul><li class="ql-indent-1">iç madde</li></ul>',
  long43: long(43, 60),
  oneHugeParagraph: `<p>${lorem(900)}</p>`,
  hugeWithMarkup: `<p>${Array.from({ length: 300 }, (_, i) => `<strong>w${i}</strong> <a href="https://example.com/${i}" rel="noopener noreferrer" target="_blank">l${i}</a>`).join(' ')}</p>`,
  shortThenHuge: `<p>${lorem(40)}</p><p>${lorem(500)}</p><p>${lorem(30)}</p>`,
  exactly1200: `<p>${'a'.repeat(1200)}</p><p>b</p>`,
  noSpaces: `<p>${'x'.repeat(3000)}</p>`,
};

const deltaCases = {
  plain: [{ insert: 'Merhaba\n' }],
  emptyLines: [{ insert: 'Bir\n\nİki\n' }],
  inline: [{ insert: 'kalın', attributes: { bold: true } }, { insert: ' ' }, { insert: 'italik', attributes: { italic: true } }, { insert: ' ' }, { insert: 'alt', attributes: { underline: true } }, { insert: ' ' }, { insert: 'üst', attributes: { strike: true } }, { insert: '\n' }],
  combined: [{ insert: 'hepsi', attributes: { bold: true, italic: true, underline: true, strike: true } }, { insert: ' düz ' }, { insert: 'ki', attributes: { bold: true } }, { insert: 'bi', attributes: { bold: true, italic: true } }, { insert: '\n' }],
  linkBold: [{ insert: 'git ', attributes: { bold: true } }, { insert: 'buraya', attributes: { bold: true, link: 'https://example.com/?a=1&b=2' } }, { insert: '\n' }],
  headers: [{ insert: 'B1' }, { insert: '\n', attributes: { header: 1 } }, { insert: 'B2' }, { insert: '\n', attributes: { header: 2 } }, { insert: 'p\n' }],
  quote: [{ insert: 'alıntı' }, { insert: '\n', attributes: { blockquote: true } }],
  lists: [{ insert: 'bir' }, { insert: '\n', attributes: { list: 'ordered' } }, { insert: 'iki' }, { insert: '\n', attributes: { list: 'ordered' } }, { insert: 'madde' }, { insert: '\n', attributes: { list: 'bullet' } }, { insert: 'son\n' }],
  image: [{ insert: { image: png } }, { insert: '\nsonra\n' }],
  escapes: [{ insert: '<b>değil</b> & "tırnak" 😀\n' }],
  indentAlign: [{ insert: 'orta' }, { insert: '\n', attributes: { align: 'center' } }, { insert: 'iç' }, { insert: '\n', attributes: { list: 'bullet', indent: 1 } }, { insert: 'ikisi' }, { insert: '\n', attributes: { align: 'right', indent: 2 } }],
};

const out = { generatedWith: { quill: req('quill/package.json').version, dompurify: req('dompurify/package.json').version }, html: {}, delta: {} };
for (const [name, html] of Object.entries(htmlCases)) {
  out.html[name] = {
    input: html,
    clean: cleanRichText(html),
    pageCount: parseContentToPages(html, 'Bölüm').length,
    pages: parseContentToPages(html, 'Bölüm').map(page => page.content),
    paragraphIndices: segments(html),
    quillDelta: toDelta(html),
    quillHtml: toHtml(toDelta(html)),
  };
}
for (const [name, ops] of Object.entries(deltaCases)) out.delta[name] = { ops, html: toHtml(ops) };
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log('html cases', Object.keys(out.html).length, 'delta cases', Object.keys(out.delta).length);
for (const [n, c] of Object.entries(out.html)) console.log(n.padEnd(18), 'pages', c.pageCount, 'p-idx', JSON.stringify(c.paragraphIndices).slice(0, 40));
