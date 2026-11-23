import 'package:html/dom.dart' as dom;

import 'rich_text.dart';

/// HTML ⇄ Quill Delta conversion for chapter content.
///
/// The backend stores chapters as the HTML that Quill 1.3.7 (react-quill 2)
/// writes on the website. The native editor (`flutter_quill`) works on a
/// Delta, so both directions are implemented here, in pure Dart, with the
/// Delta kept as plain JSON ops (`[{insert, attributes}]`).
///
/// Goals, in order:
/// 1. HTML written by the web editor's toolbar (paragraphs, H1/H2, bold,
///    italic, underline, strike, blockquote, ordered/bullet lists, links,
///    base64 images, empty lines) survives `html → delta → html`
///    **byte for byte**.
/// 2. Everything else the sanitiser allows (H3–H6, sub/sup, inline code,
///    code blocks, colours, sizes, alignment, indents, `<hr>`) is mapped to
///    an editable equivalent and written back as valid Quill-flavoured HTML.
/// 3. Whatever cannot be represented is reported in
///    [HtmlToDelta.warnings]; nothing is dropped silently. The editor shows
///    the warning before the first save (see `chapter_editor.dart`).

typedef DeltaOp = Map<String, dynamic>;

const String dividerEmbedKey = 'divider';

class HtmlToDelta {
  HtmlToDelta(this.ops, this.warnings);

  /// Always ends with a newline op, as `flutter_quill` requires.
  final List<DeltaOp> ops;

  /// Human-readable (Turkish) notes about constructs that will not be
  /// written back exactly as they were.
  final Set<String> warnings;
}

// ---------------------------------------------------------------------------
// HTML → Delta
// ---------------------------------------------------------------------------

const _blockTags = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'div', 'ul', 'ol', 'li', 'hr'};
final _softWhitespace = RegExp(r'[\t\n\r]+');

HtmlToDelta htmlToDelta(String? html) {
  final builder = _DeltaBuilder();
  // The server has already sanitised stored content and keeps the inline
  // styles Quill uses (colour, background, alignment, size), so the tree is
  // parsed as-is instead of going through the stricter reader sanitiser.
  final fragment = parseHtmlFragment(html ?? '');
  builder.blocks(fragment.nodes, const {}, 0);
  builder.finish();
  return HtmlToDelta(builder.ops, builder.warnings);
}

class _DeltaBuilder {
  final List<DeltaOp> ops = [];
  final Set<String> warnings = {};
  bool _lineOpen = false;

  void text(String value, Map<String, dynamic> attributes) {
    if (value.isEmpty) return;
    _lineOpen = true;
    if (ops.isNotEmpty) {
      final last = ops.last;
      final lastInsert = last['insert'];
      if (lastInsert is String && !lastInsert.endsWith('\n') && _sameAttributes(last['attributes'], attributes)) {
        last['insert'] = lastInsert + value;
        return;
      }
    }
    ops.add({'insert': value, if (attributes.isNotEmpty) 'attributes': Map<String, dynamic>.from(attributes)});
  }

  void embed(Map<String, dynamic> value, Map<String, dynamic> attributes) {
    _lineOpen = true;
    ops.add({'insert': value, if (attributes.isNotEmpty) 'attributes': Map<String, dynamic>.from(attributes)});
  }

  void newline(Map<String, dynamic> blockAttributes) {
    _lineOpen = false;
    if (ops.isNotEmpty) {
      final last = ops.last;
      final lastInsert = last['insert'];
      if (lastInsert is String &&
          lastInsert.isNotEmpty &&
          lastInsert.replaceAll('\n', '').isEmpty &&
          _sameAttributes(last['attributes'], blockAttributes)) {
        last['insert'] = '$lastInsert\n';
        return;
      }
    }
    ops.add({'insert': '\n', if (blockAttributes.isNotEmpty) 'attributes': Map<String, dynamic>.from(blockAttributes)});
  }

  void finish() {
    if (_lineOpen) newline(const {});
    if (ops.isEmpty) newline(const {});
  }

  /// Handles a list of sibling nodes at block level. Consecutive inline
  /// nodes (text outside any block, a bare `<img>`…) form an implicit
  /// paragraph.
  void blocks(List<dom.Node> nodes, Map<String, dynamic> inherited, int indent) {
    for (final node in nodes) {
      if (node is dom.Text) {
        if (node.data.trim().isEmpty) continue;
        warnings.add('Paragraf dışında kalan metin ayrı bir paragrafa alındı.');
        inline(node, const {}, pre: false);
        continue;
      }
      if (node is! dom.Element) continue;
      final tag = node.localName ?? '';
      if (!_blockTags.contains(tag)) {
        if (tag == 'br') {
          if (_lineOpen) {
            newline(inherited);
          } else {
            newline(inherited);
          }
          continue;
        }
        if (tag != 'img') warnings.add('Paragraf dışında kalan metin ayrı bir paragrafa alındı.');
        inline(node, const {}, pre: false);
        continue;
      }
      if (_lineOpen) newline(inherited);
      switch (tag) {
        case 'hr':
          embed({dividerEmbedKey: 'hr'}, const {});
          newline(const {});
        case 'ul' || 'ol':
          _list(node, tag == 'ol' ? 'ordered' : 'bullet', indent);
        case 'li':
          // A list item without a list parent.
          warnings.add('Liste dışındaki madde paragrafa çevrildi.');
          _line(node, {...inherited, ..._blockAttributes(node)});
        case 'pre':
          _codeBlock(node);
        case 'div':
          if (_hasBlockChildren(node)) {
            warnings.add('İç içe bloklar düz paragraflara açıldı.');
            blocks(node.nodes, inherited, indent);
          } else {
            warnings.add('<div> blokları paragrafa çevrildi.');
            _line(node, {...inherited, ..._blockAttributes(node)});
          }
        case 'blockquote':
          if (_hasBlockChildren(node)) {
            warnings.add('İç içe bloklar düz paragraflara açıldı.');
            blocks(node.nodes, {...inherited, 'blockquote': true}, indent);
          } else {
            _line(node, {...inherited, 'blockquote': true, ..._blockAttributes(node)});
          }
        default:
          final attributes = {...inherited, ..._blockAttributes(node)};
          if (tag.length == 2 && tag.startsWith('h')) attributes['header'] = int.parse(tag.substring(1));
          _line(node, attributes);
      }
    }
  }

  bool _hasBlockChildren(dom.Element element) => element.nodes.any((child) => child is dom.Element && _blockTags.contains(child.localName));

  void _line(dom.Element element, Map<String, dynamic> blockAttributes) {
    final children = element.nodes;
    for (var i = 0; i < children.length; i++) {
      final child = children[i];
      if (child is dom.Element && child.localName == 'br') {
        // A trailing <br> is Quill's placeholder for an empty line.
        if (i == children.length - 1) continue;
        warnings.add('Paragraf içindeki satır sonları ayrı paragraflara bölündü.');
        newline(blockAttributes);
        continue;
      }
      inline(child, const {}, pre: false);
    }
    newline(blockAttributes);
  }

  void _list(dom.Element list, String type, int indent) {
    for (final child in list.nodes) {
      if (child is! dom.Element) continue;
      final tag = child.localName;
      if (tag == 'ul' || tag == 'ol') {
        warnings.add('İç içe listeler girintili maddelere çevrildi.');
        _list(child, tag == 'ol' ? 'ordered' : 'bullet', indent + 1);
        continue;
      }
      final classIndent = _classIndent(child);
      final attributes = <String, dynamic>{'list': type, ..._blockAttributes(child)};
      final total = indent + (classIndent ?? 0);
      if (total > 0) {
        attributes['indent'] = total;
      } else {
        attributes.remove('indent');
      }
      final nested = <dom.Element>[];
      final own = <dom.Node>[];
      for (final node in child.nodes) {
        if (node is dom.Element && (node.localName == 'ul' || node.localName == 'ol')) {
          nested.add(node);
        } else {
          own.add(node);
        }
      }
      for (var i = 0; i < own.length; i++) {
        final node = own[i];
        if (node is dom.Element && node.localName == 'br') {
          if (i == own.length - 1) continue;
          newline(attributes);
          continue;
        }
        if (node is dom.Element && _blockTags.contains(node.localName)) {
          warnings.add('Liste maddesi içindeki bloklar düz metne açıldı.');
          for (final inner in node.nodes) {
            inline(inner, const {}, pre: false);
          }
          continue;
        }
        inline(node, const {}, pre: false);
      }
      newline(attributes);
      for (final inner in nested) {
        warnings.add('İç içe listeler girintili maddelere çevrildi.');
        _list(inner, inner.localName == 'ol' ? 'ordered' : 'bullet', total + 1);
      }
    }
  }

  void _codeBlock(dom.Element pre) {
    var content = pre.text;
    if (content.endsWith('\n')) content = content.substring(0, content.length - 1);
    for (final line in content.split('\n')) {
      text(line, const {});
      newline(const {'code-block': true});
    }
  }

  void inline(dom.Node node, Map<String, dynamic> attributes, {required bool pre}) {
    if (node is dom.Text) {
      text(pre ? node.data : node.data.replaceAll(_softWhitespace, ' '), attributes);
      return;
    }
    if (node is! dom.Element) return;
    final tag = node.localName ?? '';
    final next = Map<String, dynamic>.from(attributes);
    switch (tag) {
      case 'strong' || 'b':
        next['bold'] = true;
      case 'em' || 'i':
        next['italic'] = true;
      case 'u':
        next['underline'] = true;
      case 's' || 'strike' || 'del':
        next['strike'] = true;
      case 'sub':
        next['script'] = 'sub';
      case 'sup':
        next['script'] = 'super';
      case 'code':
        next['code'] = true;
      case 'a':
        final href = node.attributes['href'];
        if (href != null && href.isNotEmpty) next['link'] = href;
      case 'img':
        final src = node.attributes['src'];
        if (src == null || src.isEmpty) {
          warnings.add('Kaynağı olmayan bir görsel atlandı.');
          return;
        }
        final alt = node.attributes['alt'];
        embed({'image': src}, {...attributes, if (alt != null && alt.isNotEmpty) 'alt': alt});
        return;
      case 'br':
        newline(const {});
        return;
      case 'span':
        break;
      default:
        if (!_blockTags.contains(tag)) warnings.add('<$tag> etiketi düz metne çevrildi.');
    }
    for (final name in _classNames(node)) {
      if (name.startsWith('ql-size-')) next['size'] = name.substring('ql-size-'.length);
      if (name.startsWith('ql-font-')) next['font'] = name.substring('ql-font-'.length);
    }
    final style = _parseStyle(node.attributes['style']);
    if (style['color'] != null) next['color'] = style['color'];
    if (style['background-color'] != null) next['background'] = style['background-color'];
    for (final child in node.nodes) {
      inline(child, next, pre: pre);
    }
  }
}

Iterable<String> _classNames(dom.Element element) =>
    (element.attributes['class'] ?? '').split(RegExp(r'\s+')).where((name) => name.isNotEmpty);

int? _classIndent(dom.Element element) {
  for (final name in _classNames(element)) {
    if (name.startsWith('ql-indent-')) return int.tryParse(name.substring('ql-indent-'.length));
  }
  return null;
}

Map<String, dynamic> _blockAttributes(dom.Element element) {
  final attributes = <String, dynamic>{};
  for (final name in _classNames(element)) {
    if (name.startsWith('ql-align-')) attributes['align'] = name.substring('ql-align-'.length);
    if (name == 'ql-direction-rtl') attributes['direction'] = 'rtl';
    if (name.startsWith('ql-indent-')) {
      final value = int.tryParse(name.substring('ql-indent-'.length));
      if (value != null && value > 0) attributes['indent'] = value;
    }
  }
  final align = _parseStyle(element.attributes['style'])['text-align'];
  if (align != null && const {'center', 'right', 'justify'}.contains(align)) attributes['align'] = align;
  return attributes;
}

Map<String, String> _parseStyle(String? style) {
  final result = <String, String>{};
  if (style == null) return result;
  for (final declaration in style.split(';')) {
    final index = declaration.indexOf(':');
    if (index <= 0) continue;
    final value = declaration.substring(index + 1).trim();
    if (value.isNotEmpty) result[declaration.substring(0, index).trim().toLowerCase()] = value;
  }
  return result;
}

bool _sameAttributes(Object? a, Object? b) {
  final left = a is Map ? a : const {};
  final right = b is Map ? b : const {};
  if (left.length != right.length) return false;
  for (final key in left.keys) {
    if (!right.containsKey(key) || '${right[key]}' != '${left[key]}') return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Delta → HTML
// ---------------------------------------------------------------------------

class _Run {
  _Run.text(this.text, this.attributes) : embed = null;
  _Run.embed(this.embed, this.attributes) : text = null;
  final String? text;
  final Map<String, dynamic>? embed;
  final Map<String, dynamic> attributes;
}

class _Line {
  _Line(this.runs, this.attributes);
  final List<_Run> runs;
  final Map<String, dynamic> attributes;

  String? get list {
    final value = attributes['list'];
    if (value == 'ordered') return 'ordered';
    if (value == 'bullet' || value == 'checked' || value == 'unchecked') return 'bullet';
    return null;
  }

  bool get isCode => attributes['code-block'] == true || attributes['code-block'] is String;
  bool get isDivider => runs.length == 1 && runs.first.embed?.containsKey(dividerEmbedKey) == true;
}

List<_Line> _linesOf(List<dynamic> ops) {
  final lines = <_Line>[];
  var runs = <_Run>[];
  for (final raw in ops) {
    if (raw is! Map) continue;
    final insert = raw['insert'];
    final attributes = raw['attributes'] is Map ? Map<String, dynamic>.from(raw['attributes'] as Map) : <String, dynamic>{};
    if (insert is Map) {
      runs.add(_Run.embed(Map<String, dynamic>.from(insert), attributes));
      continue;
    }
    if (insert is! String) continue;
    final parts = insert.split('\n');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].isNotEmpty) runs.add(_Run.text(parts[i], attributes));
      if (i < parts.length - 1) {
        // Block formats live on the newline; an op that mixes text and a
        // newline (plain paragraphs) carries inline attributes only.
        lines.add(_Line(runs, parts.every((part) => part.isEmpty) ? attributes : const {}));
        runs = <_Run>[];
      }
    }
  }
  if (runs.isNotEmpty) lines.add(_Line(runs, const {}));
  return lines;
}

/// Serialises Delta [ops] to the HTML Quill 1.3.7 would keep in
/// `quill.root.innerHTML` for the same document.
String deltaToHtml(List<dynamic> ops) {
  final lines = _linesOf(ops);
  final out = StringBuffer();
  var index = 0;
  while (index < lines.length) {
    final line = lines[index];
    final list = line.list;
    if (list != null) {
      final tag = list == 'ordered' ? 'ol' : 'ul';
      out.write('<$tag>');
      while (index < lines.length && lines[index].list == list) {
        final item = lines[index];
        out.write('<li${_classAttribute(item.attributes)}>${_inlineHtml(item.runs)}</li>');
        index++;
      }
      out.write('</$tag>');
      continue;
    }
    if (line.isCode) {
      out.write('<pre class="ql-syntax" spellcheck="false">');
      while (index < lines.length && lines[index].isCode) {
        out.write(escapeHtmlText(lines[index].runs.map((run) => run.text ?? '').join()));
        out.write('\n');
        index++;
      }
      out.write('</pre>');
      continue;
    }
    if (line.isDivider) {
      out.write('<hr>');
      index++;
      continue;
    }
    final header = line.attributes['header'];
    final tag = header is int && header >= 1 && header <= 6
        ? 'h$header'
        : line.attributes['blockquote'] == true
        ? 'blockquote'
        : 'p';
    out.write('<$tag${_classAttribute(line.attributes)}>${_inlineHtml(line.runs)}</$tag>');
    index++;
  }
  return out.toString();
}

String _classAttribute(Map<String, dynamic> attributes) {
  final classes = <String>[];
  final align = attributes['align'];
  if (align is String && const {'center', 'right', 'justify'}.contains(align)) classes.add('ql-align-$align');
  if (attributes['direction'] == 'rtl') classes.add('ql-direction-rtl');
  final indent = attributes['indent'];
  if (indent is int && indent > 0) classes.add('ql-indent-${indent > 8 ? 8 : indent}');
  return classes.isEmpty ? '' : ' class="${classes.join(' ')}"';
}

/// Wrapper elements of one run, outermost first. The nesting order is
/// Quill's `Inline.order` (`code`, `link`, `script`, `bold`, `italic`,
/// `strike`, `underline`, then the generic span).
List<String> _wrappers(Map<String, dynamic> a) {
  final chain = <String>[];
  if (a['code'] == true) chain.add('code');
  final link = a['link'];
  if (link is String && link.isNotEmpty) {
    chain.add('a href="${escapeHtmlAttribute(link)}" rel="noopener noreferrer" target="_blank"');
  }
  if (a['script'] == 'sub') chain.add('sub');
  if (a['script'] == 'super') chain.add('sup');
  if (a['bold'] == true) chain.add('strong');
  if (a['italic'] == true) chain.add('em');
  if (a['strike'] == true) chain.add('s');
  if (a['underline'] == true) chain.add('u');

  final classes = <String>[];
  final size = a['size'];
  if (size is String && const {'small', 'large', 'huge'}.contains(size)) classes.add('ql-size-$size');
  final font = a['font'];
  if (font is String && const {'serif', 'monospace'}.contains(font)) classes.add('ql-font-$font');
  final styles = <String>[];
  final color = a['color'];
  if (color is String && _safeCssColor.hasMatch(color)) styles.add('color: $color;');
  final background = a['background'];
  if (background is String && _safeCssColor.hasMatch(background)) styles.add('background-color: $background;');
  if (classes.isNotEmpty || styles.isNotEmpty) {
    chain.add(
      'span'
      '${classes.isEmpty ? '' : ' class="${classes.join(' ')}"'}'
      '${styles.isEmpty ? '' : ' style="${styles.join(' ')}"'}',
    );
  }
  return chain;
}

final RegExp _safeCssColor = RegExp(r'^(#[0-9a-fA-F]{3,8}|rgba?\([0-9., %]+\)|[a-zA-Z]{3,20})$');

String _inlineHtml(List<_Run> runs) {
  if (runs.isEmpty) return '<br>';
  final out = StringBuffer();
  final open = <String>[];

  void closeTo(int depth) {
    while (open.length > depth) {
      final wrapper = open.removeLast();
      final space = wrapper.indexOf(' ');
      out.write('</${space < 0 ? wrapper : wrapper.substring(0, space)}>');
    }
  }

  for (final run in runs) {
    final chain = _wrappers(run.attributes);
    // Adjacent runs share every wrapper of their common outer prefix, the
    // way Quill merges neighbouring blots of the same format.
    var common = 0;
    while (common < open.length && common < chain.length && open[common] == chain[common]) {
      common++;
    }
    closeTo(common);
    for (var i = common; i < chain.length; i++) {
      out.write('<${chain[i]}>');
      open.add(chain[i]);
    }
    final embed = run.embed;
    if (embed != null) {
      final image = embed['image'];
      if (image is String) {
        final alt = run.attributes['alt'];
        out.write(
          '<img src="${escapeHtmlAttribute(image)}"'
          '${alt is String && alt.isNotEmpty ? ' alt="${escapeHtmlAttribute(alt)}"' : ''}>',
        );
      }
    } else {
      out.write(escapeHtmlText(run.text ?? ''));
    }
  }
  closeTo(0);
  return out.toString();
}

// ---------------------------------------------------------------------------
// Round-trip check
// ---------------------------------------------------------------------------

/// Canonical form used to decide whether a save from the app would change
/// stored HTML in a way the author did not make: tag aliases are unified
/// and attributes the web sanitiser removes anyway are ignored.
String canonicalHtml(String? html) {
  final fragment = parseHtmlFragment(html ?? '');
  void visit(dom.Node node) {
    for (final child in node.nodes.toList()) {
      if (child is dom.Element) {
        final alias = const {'b': 'strong', 'i': 'em', 'strike': 's', 'del': 's'}[child.localName];
        dom.Element element = child;
        if (alias != null) {
          element = dom.Element.tag(alias);
          child.attributes.forEach((key, value) => element.attributes[key] = value);
          for (final grandchild in child.nodes.toList()) {
            element.append(grandchild);
          }
          child.replaceWith(element);
        }
        for (final name in const ['rel', 'target', 'spellcheck', 'width', 'height']) {
          element.attributes.remove(name);
        }
        if ((element.attributes['class'] ?? 'x').trim().isEmpty) element.attributes.remove('class');
        visit(element);
      } else if (child is dom.Text) {
        if (node is! dom.Element && child.data.trim().isEmpty) child.remove();
      } else {
        child.remove();
      }
    }
  }

  visit(fragment);
  return serializeChildren(fragment);
}

/// True when editing [html] in the app and saving without changes would
/// store equivalent HTML.
bool roundTripsCleanly(String? html) {
  if (html == null || html.trim().isEmpty) return true;
  return canonicalHtml(html) == canonicalHtml(deltaToHtml(htmlToDelta(html).ops));
}
