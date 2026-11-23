import 'dart:async';

import 'package:flutter_quill/flutter_quill.dart' as quill;
import 'package:material_ui/material_ui.dart';

import '../../core/richtext/quill_html.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';
import 'image_upload.dart';
import 'quill_bridge.dart';

/// Native rich-text editor for one chapter (F-WRITE-05).
///
/// `flutter_quill` edits a Delta; the stored format is Quill-flavoured
/// HTML. Content is converted on load ([htmlToDelta]) and after every
/// change ([deltaToHtml]); see `core/richtext/quill_html.dart` for the
/// compatibility guarantees and their tests.
///
/// If the stored HTML contains something the editor cannot write back
/// unchanged, the chapter opens **read-only** with an explanation and the
/// author decides whether to edit it here.
class ChapterEditor extends StatefulWidget {
  const ChapterEditor({super.key, required this.initialHtml, required this.onChanged, this.readOnly = false});

  final String initialHtml;

  /// Called with the new HTML after a user edit (never for the initial
  /// load, so opening a chapter does not rewrite it).
  final ValueChanged<String> onChanged;
  final bool readOnly;

  @override
  State<ChapterEditor> createState() => ChapterEditorState();
}

class ChapterEditorState extends State<ChapterEditor> {
  late final quill.QuillController _controller;
  final _focus = FocusNode();
  final _scroll = ScrollController();
  StreamSubscription<dynamic>? _changes;
  late final Set<String> _warnings;
  late bool _acceptedLossy;
  String _lastHtml = '';

  @override
  void initState() {
    super.initState();
    final converted = htmlToDelta(widget.initialHtml);
    _warnings = {
      ...converted.warnings,
      if (converted.warnings.isEmpty && !roundTripsCleanly(widget.initialHtml))
        'Bu bölümde mobil düzenleyicinin birebir koruyamadığı biçimler var.',
    };
    _acceptedLossy = _warnings.isEmpty;
    _controller = quill.QuillController(
      document: quill.Document.fromJson(converted.ops),
      selection: const TextSelection.collapsed(offset: 0),
      readOnly: widget.readOnly || !_acceptedLossy,
    );
    _lastHtml = deltaToHtml(_controller.document.toDelta().toJson());
    _changes = _controller.document.changes.listen((_) {
      final html = deltaToHtml(_controller.document.toDelta().toJson());
      if (html == _lastHtml) return;
      _lastHtml = html;
      widget.onChanged(html);
    });
    _controller.addListener(_onController);
  }

  @override
  void didUpdateWidget(covariant ChapterEditor oldWidget) {
    super.didUpdateWidget(oldWidget);
    _controller.readOnly = widget.readOnly || !_acceptedLossy;
  }

  @override
  void dispose() {
    _changes?.cancel();
    _controller.removeListener(_onController);
    _controller.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onController() {
    if (mounted) setState(() {});
  }

  bool _isOn(quill.Attribute<dynamic> attribute) => _controller.getSelectionStyle().attributes[attribute.key]?.value == attribute.value;

  void _toggle(quill.Attribute<dynamic> attribute) =>
      _controller.formatSelection(_isOn(attribute) ? quill.Attribute.clone(attribute, null) : attribute);

  int get _header {
    final value = _controller.getSelectionStyle().attributes[quill.Attribute.header.key]?.value;
    return value is int ? value : 0;
  }

  void _setHeader(int level) =>
      _controller.formatSelection(level == 0 ? quill.Attribute.clone(quill.Attribute.header, null) : quill.HeaderAttribute(level: level));

  /// "Clean": removes the inline formats of the selection.
  void _clearFormat() {
    for (final attribute in _controller.getSelectionStyle().attributes.values.toList()) {
      if (attribute.scope == quill.AttributeScope.inline) {
        _controller.formatSelection(quill.Attribute.clone(attribute, null));
      }
    }
  }

  Future<void> _link() async {
    final selection = _controller.selection;
    final current = _controller.getSelectionStyle().attributes[quill.Attribute.link.key]?.value;
    final field = TextEditingController(text: current is String ? current : 'https://');
    final url = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Bağlantı'),
        content: TextField(
          controller: field,
          autofocus: true,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(hintText: 'https://'),
        ),
        actions: [
          if (current != null) TextButton(onPressed: () => Navigator.of(context).pop(''), child: const Text('Kaldır')),
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.of(context).pop(field.text.trim()), child: const Text('UYGULA')),
        ],
      ),
    );
    field.dispose();
    if (url == null || !mounted) return;
    if (url.isEmpty) {
      _controller.formatSelection(quill.Attribute.clone(quill.Attribute.link, null));
      return;
    }
    // Same schemes the sanitiser keeps.
    if (!RegExp(r'^(https?:|mailto:)', caseSensitive: false).hasMatch(url)) {
      showToast(context, 'Bağlantı http://, https:// veya mailto: ile başlamalıdır.', type: ToastType.error);
      return;
    }
    if (selection.isCollapsed) {
      _controller.replaceText(selection.baseOffset, 0, url, TextSelection.collapsed(offset: selection.baseOffset + url.length));
      _controller.formatText(selection.baseOffset, url.length, quill.LinkAttribute(url));
    } else {
      _controller.formatSelection(quill.LinkAttribute(url));
    }
  }

  Future<void> _image() async {
    try {
      final picked = await pickImageBytes();
      if (picked == null) return;
      final dataUri = await prepareEmbeddedImage(picked);
      if (!mounted) return;
      final selection = _controller.selection;
      final index = selection.baseOffset < 0 ? _controller.document.length - 1 : selection.baseOffset;
      final length = selection.isValid ? selection.extentOffset - selection.baseOffset : 0;
      _controller.replaceText(index, length < 0 ? 0 : length, quill.BlockEmbed.image(dataUri), TextSelection.collapsed(offset: index + 1));
    } on ImageProblem catch (problem) {
      if (mounted) showToast(context, problem.message, type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editable = !widget.readOnly && _acceptedLossy;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!_acceptedLossy)
          Container(
            margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: BetikColors.sepiaLight,
              border: Border.all(color: BetikColors.rust),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Bu bölüm salt okunur açıldı', style: sans(size: 14, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                  'Bölüm web düzenleyicisinin yazmadığı biçimler içeriyor. Burada düzenleyip kaydederseniz şunlar değişir:',
                  style: sans(size: 13, height: 1.4),
                ),
                for (final warning in _warnings) Text('• $warning', style: sans(size: 13, height: 1.4)),
                const SizedBox(height: 6),
                OutlinedButton(
                  onPressed: widget.readOnly
                      ? null
                      : () => setState(() {
                          _acceptedLossy = true;
                          _controller.readOnly = false;
                        }),
                  child: const Text('YİNE DE BURADA DÜZENLE'),
                ),
              ],
            ),
          ),
        if (editable) _toolbar(),
        Expanded(
          child: QuillSurface(
            child: DefaultTextStyle(
              style: serif(size: 17, height: 1.7),
              child: quill.QuillEditor(
                controller: _controller,
                focusNode: _focus,
                scrollController: _scroll,
                config: quill.QuillEditorConfig(
                  placeholder: 'Hikayenizi buraya yazın...',
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                  scrollable: true,
                  expands: true,
                  embedBuilders: const [_ImageEmbedBuilder(), _DividerEmbedBuilder()],
                  customStyles: _editorStyles,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _toolbar() {
    Widget button(IconData icon, String tooltip, VoidCallback onPressed, {bool active = false}) => IconButton(
      tooltip: tooltip,
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(
        backgroundColor: active ? BetikColors.inkBlack : null,
        foregroundColor: active ? BetikColors.paperWhite : BetikColors.inkBlack,
      ),
      icon: Icon(icon, size: 21),
      onPressed: onPressed,
    );
    return Container(
      decoration: const BoxDecoration(
        color: BetikColors.paperWhite,
        border: Border(
          bottom: BorderSide(color: BetikColors.borderMedium),
          top: BorderSide(color: BetikColors.borderMedium),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        child: Row(
          children: [
            PopupMenuButton<int>(
              tooltip: 'Başlık düzeyi',
              initialValue: _header,
              onSelected: _setHeader,
              itemBuilder: (_) => const [
                PopupMenuItem(value: 0, child: Text('Normal')),
                PopupMenuItem(value: 1, child: Text('Başlık 1')),
                PopupMenuItem(value: 2, child: Text('Başlık 2')),
              ],
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: Row(
                  children: [
                    Text(_header == 0 ? 'Normal' : 'Başlık $_header', style: sans(size: 13, weight: FontWeight.w600)),
                    const Icon(Icons.arrow_drop_down, size: 18),
                  ],
                ),
              ),
            ),
            button(Icons.format_bold, 'Kalın', () => _toggle(quill.Attribute.bold), active: _isOn(quill.Attribute.bold)),
            button(Icons.format_italic, 'İtalik', () => _toggle(quill.Attribute.italic), active: _isOn(quill.Attribute.italic)),
            button(
              Icons.format_underline,
              'Altı çizili',
              () => _toggle(quill.Attribute.underline),
              active: _isOn(quill.Attribute.underline),
            ),
            button(
              Icons.format_strikethrough,
              'Üstü çizili',
              () => _toggle(quill.Attribute.strikeThrough),
              active: _isOn(quill.Attribute.strikeThrough),
            ),
            button(
              Icons.format_quote,
              'Alıntı bloğu',
              () => _toggle(quill.Attribute.blockQuote),
              active: _isOn(quill.Attribute.blockQuote),
            ),
            button(Icons.format_list_numbered, 'Numaralı liste', () => _toggle(quill.Attribute.ol), active: _isOn(quill.Attribute.ol)),
            button(
              Icons.format_list_bulleted,
              'Madde işaretli liste',
              () => _toggle(quill.Attribute.ul),
              active: _isOn(quill.Attribute.ul),
            ),
            button(Icons.link, 'Bağlantı', _link, active: _controller.getSelectionStyle().attributes.containsKey(quill.Attribute.link.key)),
            button(Icons.image_outlined, 'Görsel ekle', _image),
            button(Icons.format_clear, 'Biçimi temizle', _clearFormat),
            const SizedBox(width: 6),
            button(Icons.undo, 'Geri al', () => _controller.hasUndo ? _controller.undo() : null),
            button(Icons.redo, 'Yinele', () => _controller.hasRedo ? _controller.redo() : null),
          ],
        ),
      ),
    );
  }
}

/// Reading-like typography in the editor: the same serif, line height and
/// paragraph rhythm as the reader.
final quill.DefaultStyles _editorStyles = () {
  quill.DefaultTextBlockStyle block(TextStyle style, double top, double bottom) => quill.DefaultTextBlockStyle(
    style,
    quill.HorizontalSpacing.zero,
    quill.VerticalSpacing(top, bottom),
    quill.VerticalSpacing.zero,
    null,
  );
  final body = serif(size: 17, height: 1.7, color: BetikColors.charcoal);
  return quill.DefaultStyles(
    paragraph: block(body, 0, 10),
    h1: block(serif(size: 28, weight: FontWeight.w700, height: 1.3), 14, 8),
    h2: block(serif(size: 23, weight: FontWeight.w700, height: 1.3), 12, 6),
    h3: block(serif(size: 20, weight: FontWeight.w700, height: 1.35), 10, 6),
    placeHolder: block(serif(size: 17, height: 1.7, color: BetikColors.silverGray, style: FontStyle.italic), 0, 0),
    link: const TextStyle(color: BetikColors.rust, decoration: TextDecoration.underline),
  );
}();

class _ImageEmbedBuilder extends quill.EmbedBuilder {
  const _ImageEmbedBuilder();

  @override
  String get key => 'image';

  @override
  Widget build(BuildContext context, quill.EmbedContext embedContext) {
    final source = '${embedContext.node.value.data}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: NetImage(
        source,
        fit: BoxFit.contain,
        placeholder: Container(
          height: 100,
          color: BetikColors.agedPaper,
          alignment: Alignment.center,
          child: const Icon(Icons.image_not_supported_outlined, color: BetikColors.ashGray),
        ),
      ),
    );
  }
}

class _DividerEmbedBuilder extends quill.EmbedBuilder {
  const _DividerEmbedBuilder();

  @override
  String get key => dividerEmbedKey;

  @override
  Widget build(BuildContext context, quill.EmbedContext embedContext) =>
      const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider());
}
