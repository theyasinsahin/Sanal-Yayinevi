import 'package:html/dom.dart' as dom;

import 'rich_text.dart';

/// Exact port of `parseContentToPages` from
/// `Client/src/utils/htmlPageSplitter/index.js`.
///
/// The website sends `pageCount = parseContentToPages(html, title).length`
/// with every chapter save; the server sums the chapter values into
/// `Book.pageCount`, which feeds the reading-time estimate on cards and the
/// page-number validation of printed-book quotes. A chapter saved from the
/// app must therefore produce the same number as the same HTML saved from
/// the web.
///
/// The algorithm is **not** `ceil(textLength / 1200)`: pages are filled with
/// whole top-level blocks, so 19,966 characters in 43 paragraphs give 20
/// pages (Stage 2 S-11). Its quirks are reproduced on purpose:
/// * only *element* children count; top-level text nodes are ignored unless
///   there is no element at all;
/// * an oversized block is split on whitespace of its **innerHTML** (markup
///   and entities count towards the limit);
/// * after a page break inside an oversized block `currentLength` restarts
///   at the word length while the pending fragment is counted again.
const int maxCharsPerPage = 1200;

final RegExp _whitespace = RegExp(r'\s+');

/// Number of pages of [htmlContent]; this is the value for
/// `createChapter` / `updateChapter(pageCount:)`.
int computePageCount(String? htmlContent) => splitIntoPages(htmlContent).length;

/// The page HTML fragments (kept for tests against the JavaScript original).
List<String> splitIntoPages(String? htmlContent) {
  if (htmlContent == null || htmlContent.isEmpty) return const [];

  final container = sanitizeToFragment(htmlContent);
  final children = container.nodes.whereType<dom.Element>().toList();

  // Plain text without any tag: wrap it in one <p>. `p.innerText = text`
  // turns line breaks into <br> elements.
  if (children.isEmpty && htmlContent.trim().isNotEmpty) {
    final p = dom.Element.tag('p');
    final lines = htmlContent.split(RegExp(r'\r\n|\r|\n'));
    for (var i = 0; i < lines.length; i++) {
      if (i > 0) p.append(dom.Element.tag('br'));
      if (lines[i].isNotEmpty) p.append(dom.Text(lines[i]));
    }
    children.add(p);
  }

  final pages = <String>[];
  var currentPageContent = '';
  var currentLength = 0;

  void pushPage() {
    if (currentPageContent.trim().isNotEmpty) {
      pages.add(currentPageContent);
      currentPageContent = '';
      currentLength = 0;
    }
  }

  for (final node in children) {
    final nodeHtml = serializeNode(node);
    final nodeTextLength = node.text.length;

    // 1: the block fits on the current page.
    if (currentLength + nodeTextLength <= maxCharsPerPage) {
      currentPageContent += nodeHtml;
      currentLength += nodeTextLength;
      continue;
    }

    // 2a: something is already on the page and the block fits on a page of
    // its own → start a new page.
    if (currentLength > 0 && nodeTextLength <= maxCharsPerPage) {
      pushPage();
      currentPageContent += nodeHtml;
      currentLength += nodeTextLength;
      continue;
    }

    // 3: the block alone is longer than a page → split it word by word.
    final tagName = node.localName ?? 'p';
    final attributes = node.attributes.entries.map((entry) => '${entry.key}="${_escapeChunkAttribute(entry.value)}"').join(' ');
    final openingTag = '<$tagName $attributes>';
    final closingTag = '</$tagName>';
    final words = serializeChildren(node).split(_whitespace);

    var tempParagraph = '';
    for (final word in words) {
      final wordLength = word.length + 1;
      if (currentLength + tempParagraph.length + wordLength > maxCharsPerPage) {
        currentPageContent += '$openingTag$tempParagraph$closingTag';
        pushPage();
        tempParagraph = '$word ';
        currentLength = wordLength;
      } else {
        tempParagraph += '$word ';
      }
    }
    if (tempParagraph.trim().isNotEmpty) {
      currentPageContent += '$openingTag$tempParagraph$closingTag';
      currentLength += tempParagraph.length;
    }
  }

  pushPage();
  return pages;
}

String _escapeChunkAttribute(String value) => value.replaceAllMapped(
  RegExp('[&<>"\']'),
  (match) => const {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[match.group(0)]!,
);
