import 'package:html/dom.dart' as dom;

import 'rich_text.dart';

/// One top-level node of a chapter as the reader shows it.
class ChapterSegment {
  const ChapterSegment(this.node, this.paragraphIndex);

  final dom.Node node;

  /// Zero-based ordinal among the top-level `<p>` elements, or null for
  /// every other top-level node (headings, lists, quotes, images outside a
  /// paragraph, stray text).
  final int? paragraphIndex;

  bool get isParagraph => paragraphIndex != null;
}

/// Splits chapter HTML exactly like the website's `ParagraphRenderer`
/// (`Client/src/components/ParagraphComment/ParagraphRenderer/index.jsx`):
///
/// ```js
/// const nodes = Array.from(doc.body.childNodes);
/// let paragraphIndex = 0;
/// nodes.map(node => node.nodeName === 'P' ? {index: paragraphIndex++} : {type: 'other'})
/// ```
///
/// **Bookmarks and paragraph comments store this index**, so it is a data
/// contract: only top-level `<p>` nodes are counted, in document order,
/// after sanitising. Headings, `<blockquote>`, `<ol>`/`<ul>` and text nodes
/// are rendered but carry no index and no bookmark/comment controls.
///
/// (Stage 2 summarised this as "every top-level element"; the source code is
/// the authority — see `technical_decisions.md` D-07.)
List<ChapterSegment> segmentChapter(String? content) {
  if (content == null || content.isEmpty) return const [];
  final fragment = sanitizeToFragment(content);
  final segments = <ChapterSegment>[];
  var paragraphIndex = 0;
  for (final node in fragment.nodes) {
    if (node is dom.Element && node.localName == 'p') {
      segments.add(ChapterSegment(node, paragraphIndex++));
    } else {
      segments.add(ChapterSegment(node, null));
    }
  }
  return segments;
}

/// Number of addressable paragraphs in [content].
int paragraphCount(String? content) => segmentChapter(content).where((segment) => segment.isParagraph).length;
