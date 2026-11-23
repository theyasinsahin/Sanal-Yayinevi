import 'package:flutter/gestures.dart';
import 'package:html/dom.dart' as dom;
import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';

/// Renders one sanitised top-level chapter node as native widgets
/// (F-READ-13). Supports the whole allow-list of the web sanitiser:
/// `p br div span strong b em i u s strike blockquote h1–h4 ol ul li pre
/// code a img sub sup hr` and the Quill classes `ql-align-*`,
/// `ql-indent-1..8`, `ql-size-small|large|huge`, `ql-font-serif|monospace`,
/// `ql-direction-rtl`, `ql-syntax`.
///
/// Inline `style` attributes are not honoured: the website's reader strips
/// them too (`cleanRichText` does not allow `style`).
class HtmlBlock extends StatefulWidget {
  const HtmlBlock(this.node, {super.key, required this.fontSize});
  final dom.Node node;
  final double fontSize;

  @override
  State<HtmlBlock> createState() => _HtmlBlockState();
}

class _HtmlBlockState extends State<HtmlBlock> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  void _disposeRecognizers() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
  }

  TextStyle get _base => serif(size: widget.fontSize, height: 1.75, color: BetikColors.charcoal);

  @override
  Widget build(BuildContext context) {
    _disposeRecognizers();
    return _block(widget.node, _base);
  }

  Set<String> _classes(dom.Element element) =>
      (element.attributes['class'] ?? '').split(RegExp(r'\s+')).where((name) => name.isNotEmpty).toSet();

  TextAlign _align(Set<String> classes) {
    if (classes.contains('ql-align-center')) return TextAlign.center;
    if (classes.contains('ql-align-right')) return TextAlign.right;
    if (classes.contains('ql-align-justify')) return TextAlign.justify;
    return TextAlign.start;
  }

  double _indent(Set<String> classes) {
    for (final name in classes) {
      if (name.startsWith('ql-indent-')) {
        final level = int.tryParse(name.substring('ql-indent-'.length)) ?? 0;
        return level.clamp(0, 8) * 24.0;
      }
    }
    return 0;
  }

  Widget _block(dom.Node node, TextStyle style) {
    if (node is dom.Text) {
      if (node.data.trim().isEmpty) return const SizedBox.shrink();
      return Text.rich(TextSpan(text: node.data, style: style));
    }
    if (node is! dom.Element) return const SizedBox.shrink();
    final tag = node.localName ?? '';
    final classes = _classes(node);
    final direction = classes.contains('ql-direction-rtl') ? TextDirection.rtl : null;

    Widget textBlock(TextStyle textStyle, {EdgeInsets padding = EdgeInsets.zero}) {
      final onlyImages =
          node.nodes.isNotEmpty &&
          node.nodes.every(
            (child) => (child is dom.Element && child.localName == 'img') || (child is dom.Text && child.data.trim().isEmpty),
          );
      if (onlyImages) {
        return Padding(
          padding: padding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [for (final child in node.nodes.whereType<dom.Element>()) _image(child)],
          ),
        );
      }
      return Padding(
        padding: padding.add(EdgeInsets.only(left: _indent(classes))),
        child: SizedBox(
          width: double.infinity,
          child: Text.rich(
            TextSpan(style: textStyle, children: _inline(node.nodes, textStyle)),
            textAlign: _align(classes),
            textDirection: direction,
          ),
        ),
      );
    }

    switch (tag) {
      case 'p' || 'div':
        if (tag == 'div' && node.nodes.any((child) => child is dom.Element && _isBlock(child.localName))) {
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [for (final child in node.nodes) _block(child, style)]);
        }
        return textBlock(style);
      case 'h1':
        return textBlock(
          serif(size: widget.fontSize * 1.7, weight: FontWeight.w700, height: 1.3),
          padding: const EdgeInsets.only(top: 10, bottom: 6),
        );
      case 'h2':
        return textBlock(
          serif(size: widget.fontSize * 1.4, weight: FontWeight.w700, height: 1.3),
          padding: const EdgeInsets.only(top: 10, bottom: 6),
        );
      case 'h3':
        return textBlock(
          serif(size: widget.fontSize * 1.2, weight: FontWeight.w700, height: 1.35),
          padding: const EdgeInsets.only(top: 8, bottom: 4),
        );
      case 'h4':
        return textBlock(
          serif(size: widget.fontSize * 1.05, weight: FontWeight.w700, height: 1.4),
          padding: const EdgeInsets.only(top: 8, bottom: 4),
        );
      case 'blockquote':
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.fromLTRB(14, 4, 8, 4),
          decoration: const BoxDecoration(
            border: Border(left: BorderSide(color: BetikColors.sepiaDark, width: 4)),
          ),
          child: node.nodes.any((child) => child is dom.Element && _isBlock(child.localName))
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [for (final child in node.nodes) _block(child, style.copyWith(fontStyle: FontStyle.italic))],
                )
              : textBlock(style.copyWith(fontStyle: FontStyle.italic, color: BetikColors.graphite)),
        );
      case 'ul' || 'ol':
        return _list(node, style, ordered: tag == 'ol');
      case 'pre':
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFF23241F), borderRadius: BorderRadius.circular(6)),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Text(
              node.text,
              style: TextStyle(fontFamily: 'monospace', fontSize: widget.fontSize * 0.85, color: const Color(0xFFF8F8F2), height: 1.5),
            ),
          ),
        );
      case 'hr':
        return const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider());
      case 'img':
        return _image(node);
      case 'br':
        return SizedBox(height: widget.fontSize);
      case 'li':
        return textBlock(style);
      default:
        // Inline element at the top level (rare, legacy content).
        return Text.rich(TextSpan(style: style, children: _inline([node], style)));
    }
  }

  bool _isBlock(String? tag) => const {'p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'pre', 'hr', 'li'}.contains(tag);

  Widget _list(dom.Element list, TextStyle style, {required bool ordered}) {
    final items = list.nodes.whereType<dom.Element>().where((child) => child.localName == 'li').toList();
    // Quill numbers each indent level separately.
    final counters = <int, int>{};
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final item in items)
            () {
              final classes = _classes(item);
              final indent = _indent(classes);
              final level = (indent / 24).round();
              counters.removeWhere((key, _) => key > level);
              final number = counters.update(level, (value) => value + 1, ifAbsent: () => 1);
              final nested = item.nodes
                  .whereType<dom.Element>()
                  .where((child) => child.localName == 'ul' || child.localName == 'ol')
                  .toList();
              final own = item.nodes.where((child) => !nested.contains(child)).toList();
              return Padding(
                padding: EdgeInsets.only(left: 6 + indent, bottom: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 28, child: Text(ordered ? '$number.' : '•', style: style)),
                        Expanded(
                          child: Text.rich(
                            TextSpan(style: style, children: _inline(own, style)),
                            textAlign: _align(classes),
                          ),
                        ),
                      ],
                    ),
                    for (final inner in nested)
                      Padding(
                        padding: const EdgeInsets.only(left: 18),
                        child: _list(inner, style, ordered: inner.localName == 'ol'),
                      ),
                  ],
                ),
              );
            }(),
        ],
      ),
    );
  }

  Widget _image(dom.Element element) {
    final src = element.attributes['src'] ?? '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: NetImage(
          src,
          fit: BoxFit.contain,
          placeholder: Container(
            height: 120,
            color: BetikColors.agedPaper,
            alignment: Alignment.center,
            child: const Icon(Icons.image_not_supported_outlined, color: BetikColors.ashGray),
          ),
        ),
      ),
    );
  }

  List<InlineSpan> _inline(List<dom.Node> nodes, TextStyle style) {
    final spans = <InlineSpan>[];
    for (var i = 0; i < nodes.length; i++) {
      final node = nodes[i];
      if (node is dom.Text) {
        spans.add(TextSpan(text: node.data, style: style));
        continue;
      }
      if (node is! dom.Element) continue;
      final tag = node.localName ?? '';
      var next = style;
      switch (tag) {
        case 'br':
          // A trailing <br> is Quill's placeholder for an empty line.
          spans.add(TextSpan(text: i == nodes.length - 1 && nodes.length == 1 ? ' ' : '\n', style: style));
          continue;
        case 'img':
          spans.add(WidgetSpan(child: _image(node)));
          continue;
        case 'strong' || 'b':
          next = style.copyWith(fontWeight: FontWeight.w700, fontVariations: const [FontVariation.weight(700)]);
        case 'em' || 'i':
          next = style.copyWith(fontStyle: FontStyle.italic);
        case 'u':
          next = style.copyWith(decoration: _decoration(style, TextDecoration.underline));
        case 's' || 'strike':
          next = style.copyWith(decoration: _decoration(style, TextDecoration.lineThrough));
        case 'code':
          next = style.copyWith(fontFamily: 'monospace', backgroundColor: BetikColors.agedPaper, fontSize: (style.fontSize ?? 16) * 0.9);
        case 'sub':
          next = style.copyWith(fontSize: (style.fontSize ?? 16) * 0.75, fontFeatures: const [FontFeature.subscripts()]);
        case 'sup':
          next = style.copyWith(fontSize: (style.fontSize ?? 16) * 0.75, fontFeatures: const [FontFeature.superscripts()]);
        case 'a':
          final href = node.attributes['href'] ?? '';
          // The website shows editor links in the browser's default blue and
          // opens them in the same tab (Stage 2 B-07); here they follow the
          // product palette and open in the system browser.
          next = style.copyWith(color: BetikColors.rust, decoration: _decoration(style, TextDecoration.underline));
          final recognizer = TapGestureRecognizer()..onTap = () => openExternal(context, href);
          _recognizers.add(recognizer);
          spans.add(TextSpan(style: next, recognizer: recognizer, children: _inline(node.nodes, next)));
          continue;
      }
      final classes = _classes(node);
      final size = style.fontSize ?? 16;
      if (classes.contains('ql-size-small')) next = next.copyWith(fontSize: size * 0.75);
      if (classes.contains('ql-size-large')) next = next.copyWith(fontSize: size * 1.5);
      if (classes.contains('ql-size-huge')) next = next.copyWith(fontSize: size * 2.5);
      if (classes.contains('ql-font-monospace')) next = next.copyWith(fontFamily: 'monospace');
      if (classes.contains('ql-font-serif')) next = next.copyWith(fontFamily: BetikFonts.serif);
      spans.add(TextSpan(style: next, children: _inline(node.nodes, next)));
    }
    return spans;
  }

  TextDecoration _decoration(TextStyle style, TextDecoration added) =>
      style.decoration == null || style.decoration == TextDecoration.none ? added : TextDecoration.combine([style.decoration!, added]);
}
