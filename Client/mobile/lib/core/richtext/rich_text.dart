import 'dart:convert';

import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;

/// Port of the website's `cleanRichText` (`Client/src/utils/richText.js`,
/// DOMPurify with a fixed configuration) plus a browser-compatible HTML
/// serialiser.
///
/// Both matter for data compatibility, not only for safety:
/// * the reader's paragraph index is computed on the *sanitised* tree;
/// * the page count is computed from `outerHTML` / `innerHTML` / text lengths
///   of the sanitised tree.

const Set<String> allowedTags = {
  'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'blockquote', //
  'h1', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'pre', 'code', 'a', 'img', 'sub', 'sup', 'hr',
};

const Set<String> _allowedAttributes = {'class', 'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height'};

/// DOMPurify's `URI_SAFE_ATTRIBUTES` ∩ our allow-list. Every other allowed
/// attribute must itself match the URI pattern, which is why `target`,
/// `rel`, `width` and `height` never survive (observed in Stage 2 as B-07:
/// links lose `target="_blank"` in the reader).
const Set<String> _uriSafeAttributes = {'class', 'title', 'alt'};

/// Elements whose content is dropped together with the element
/// (DOMPurify `FORBID_CONTENTS`). Any other disallowed element is unwrapped.
const Set<String> _forbidContents = {
  'annotation-xml', 'audio', 'colgroup', 'desc', 'foreignobject', 'head', 'iframe', 'math', 'mi', 'mn', 'mo', //
  'ms', 'mtext', 'noembed', 'noframes', 'noscript', 'plaintext', 'script', 'style', 'svg', 'template', 'thead',
  'title', 'video', 'xmp',
};

const Set<String> voidElements = {'br', 'img', 'hr'};

final RegExp _safeUri = RegExp(r'^(?:(?:https?|mailto):|\/(?!\/)|#)', caseSensitive: false);
final RegExp _rasterDataUri = RegExp(r'^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$', caseSensitive: false);

/// Maximum base64 length of one embedded image (client and server agree).
const int maxEmbeddedImageBase64Length = 450000;

/// `data:image/(png|jpeg|webp);base64,…` of at most 450,000 base64 chars
/// whose bytes really start with the matching file signature.
bool isSafeRasterDataUri(String value) {
  final match = _rasterDataUri.firstMatch(value);
  if (match == null || match.group(2)!.length > maxEmbeddedImageBase64Length) return false;
  try {
    // Only the header is needed; decode a prefix that is a multiple of 4.
    final payload = match.group(2)!;
    final prefix = payload.length >= 16 ? payload.substring(0, 16) : base64.normalize(payload);
    final header = base64.decode(prefix);
    bool startsWith(List<int> signature) {
      if (header.length < signature.length) return false;
      for (var i = 0; i < signature.length; i++) {
        if (header[i] != signature[i]) return false;
      }
      return true;
    }

    switch (match.group(1)!.toLowerCase()) {
      case 'png':
        return startsWith(const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      case 'jpeg':
        return startsWith(const [0xFF, 0xD8, 0xFF]);
      default:
        return startsWith(const [0x52, 0x49, 0x46, 0x46]) &&
            header.length >= 12 &&
            header[8] == 0x57 &&
            header[9] == 0x45 &&
            header[10] == 0x42 &&
            header[11] == 0x50;
    }
  } catch (_) {
    return false;
  }
}

bool isSafeUri(String value) => _safeUri.hasMatch(value);

/// Parses [html] the way a browser parses `innerHTML` of a `<div>`.
dom.DocumentFragment parseHtmlFragment(String html) => html_parser.parseFragment(html, container: 'div');

/// Sanitises [value] and returns the cleaned tree.
dom.DocumentFragment sanitizeToFragment(String? value) {
  final fragment = parseHtmlFragment(value ?? '');
  _sanitizeChildren(fragment);
  return fragment;
}

/// Sanitised HTML string (what `cleanRichText` returns on the web).
String cleanRichText(String? value) => serializeChildren(sanitizeToFragment(value));

void _sanitizeChildren(dom.Node parent) {
  var index = 0;
  while (index < parent.nodes.length) {
    final node = parent.nodes[index];
    if (node is dom.Text) {
      index++;
      continue;
    }
    if (node is! dom.Element) {
      node.remove(); // comments, processing instructions
      continue;
    }
    final tag = node.localName ?? '';
    if (!allowedTags.contains(tag)) {
      if (_forbidContents.contains(tag)) {
        node.remove();
      } else {
        // KEEP_CONTENT: hoist the children into the parent, then re-examine
        // them at the same position.
        final children = node.nodes.toList();
        node.remove();
        for (var i = 0; i < children.length; i++) {
          parent.nodes.insert(index + i, children[i]);
        }
      }
      continue;
    }
    _sanitizeAttributes(node, tag);
    _sanitizeChildren(node);
    index++;
  }
}

void _sanitizeAttributes(dom.Element element, String tag) {
  for (final key in element.attributes.keys.toList()) {
    final name = key is String ? key.toLowerCase() : '$key'.toLowerCase();
    final value = element.attributes[key] ?? '';
    var keep = key is String && _allowedAttributes.contains(name);
    if (keep && (name == 'href' || name == 'src')) {
      keep = isSafeUri(value) || (tag == 'img' && name == 'src' && isSafeRasterDataUri(value));
    } else if (keep && !_uriSafeAttributes.contains(name)) {
      keep = value.isEmpty || isSafeUri(value.replaceAll(RegExp(r'[\u0000-   ᠎ -  　]'), ''));
    }
    if (!keep) element.attributes.remove(key);
  }
  if (tag == 'a') element.attributes['rel'] = 'noopener noreferrer';
}

String escapeHtmlText(String text) =>
    text.replaceAll('&', '&amp;').replaceAll(' ', '&nbsp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

String escapeHtmlAttribute(String value) =>
    value.replaceAll('&', '&amp;').replaceAll(' ', '&nbsp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/// `element.outerHTML` as a browser produces it (HTML fragment
/// serialisation algorithm): no self-closing syntax, void elements without
/// an end tag, text escaped for `& < >` and no-break space.
String serializeNode(dom.Node node) {
  final buffer = StringBuffer();
  _serialize(node, buffer);
  return buffer.toString();
}

/// `element.innerHTML`.
String serializeChildren(dom.Node node) {
  final buffer = StringBuffer();
  for (final child in node.nodes) {
    _serialize(child, buffer);
  }
  return buffer.toString();
}

void _serialize(dom.Node node, StringBuffer out) {
  if (node is dom.Text) {
    out.write(escapeHtmlText(node.data));
    return;
  }
  if (node is! dom.Element) return;
  final tag = node.localName ?? '';
  out.write('<$tag');
  node.attributes.forEach((key, value) {
    out.write(' $key="${escapeHtmlAttribute(value)}"');
  });
  out.write('>');
  if (voidElements.contains(tag)) return;
  for (final child in node.nodes) {
    _serialize(child, out);
  }
  out.write('</$tag>');
}

/// `textContent` of the sanitised content with every kind of whitespace and
/// zero-width character removed is non-empty — the website's
/// `hasChapterContent`, which gates the publish button.
bool hasChapterContent(String? content) {
  final text = sanitizeToFragment(content).text ?? '';
  return text.replaceAll(RegExp(r'[\s​-‍﻿]', unicode: true), '').isNotEmpty;
}

/// Plain text of a chapter (used for previews and local word counts).
String plainTextOf(String? content) => sanitizeToFragment(content).text ?? '';
