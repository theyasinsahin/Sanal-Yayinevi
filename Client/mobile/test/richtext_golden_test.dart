import 'dart:convert';
import 'dart:io';

import 'package:betik/core/richtext/page_count.dart';
import 'package:betik/core/richtext/paragraphs.dart';
import 'package:betik/core/richtext/quill_html.dart';
import 'package:betik/core/richtext/rich_text.dart';
import 'package:flutter_test/flutter_test.dart';

/// Compares the Dart ports with outputs recorded from the website's own
/// JavaScript (DOMPurify config, htmlPageSplitter, ParagraphRenderer rule,
/// Quill 1.3.7). Regenerate with
/// `mobile-docs/stage-3/evidence/generate_web_golden.cjs`.
void main() {
  final golden = jsonDecode(File('test/fixtures/web_golden.json').readAsStringSync()) as Map<String, dynamic>;
  final htmlCases = (golden['html'] as Map).cast<String, dynamic>();
  final deltaCases = (golden['delta'] as Map).cast<String, dynamic>();

  group('sanitiser matches DOMPurify configuration', () {
    htmlCases.forEach((name, data) {
      test(name, () => expect(cleanRichText(data['input'] as String), data['clean']));
    });
  });

  group('page count matches htmlPageSplitter', () {
    htmlCases.forEach((name, data) {
      test(name, () {
        final input = data['input'] as String;
        expect(computePageCount(input), data['pageCount'], reason: 'page count');
        // jsdom has no `innerText` setter, so the recorded fragment of the
        // tag-less case is empty there; only its count is comparable.
        if (name != 'plainText') {
          expect(splitIntoPages(input), (data['pages'] as List).cast<String>(), reason: 'page fragments');
        }
      });
    });
  });

  group('paragraph index matches ParagraphRenderer', () {
    htmlCases.forEach((name, data) {
      test(name, () {
        final indices = segmentChapter(data['input'] as String).map((segment) => segment.paragraphIndex).toList();
        expect(indices, data['paragraphIndices']);
      });
    });
  });

  group('deltaToHtml matches Quill 1.3.7', () {
    deltaCases.forEach((name, data) {
      test(name, () => expect(deltaToHtml(data['ops'] as List), data['html']));
    });
  });

  group('Quill HTML survives html → delta → html byte for byte', () {
    const toolbarCases = [
      'simple', 'emptyLine', 'formats', 'nested', 'headings', 'quote', 'lists', 'link', 'image', 'entities', //
      'mixedTopLevel', 'indentAlign', 'long43', 'oneHugeParagraph', 'hugeWithMarkup',
    ];
    for (final name in toolbarCases) {
      test(name, () {
        // These inputs are in the exact form Quill writes (the group above
        // proves that form against Quill itself).
        final quillHtml = htmlCases[name]['input'] as String;
        final converted = htmlToDelta(quillHtml);
        expect(deltaToHtml(converted.ops), quillHtml);
        expect(converted.warnings, isEmpty);
        expect(roundTripsCleanly(quillHtml), isTrue);
      });
    }
  });

  group('htmlToDelta agrees with Quill clipboard conversion', () {
    // Inline cases only: under jsdom Quill's clipboard cannot detect block
    // elements (no layout), so its recorded deltas flatten blocks to <p>.
    for (final name in const ['simple', 'emptyLine', 'formats', 'nested', 'link', 'image']) {
      test(name, () {
        final expected = htmlCases[name]['quillDelta'] as List;
        // Compare through HTML: op splitting may differ, the document may not.
        expect(deltaToHtml(htmlToDelta(htmlCases[name]['input'] as String).ops), deltaToHtml(expected));
      });
    }
  });
}
