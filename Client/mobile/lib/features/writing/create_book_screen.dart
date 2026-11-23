import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';
import '../book/classification_fields.dart';
import '../discovery/feed_screen.dart';
import '../funding/funding_shared.dart' show Notice;
import '../shell/shell.dart';
import 'image_upload.dart';

/// Kitap Oluştur (F-WRITE-01): cover (required, 2:3), title, classification,
/// description → `createBook` → a DRAFT → writing dashboard.
class CreateBookScreen extends StatefulWidget {
  const CreateBookScreen({super.key});
  @override
  State<CreateBookScreen> createState() => _CreateBookScreenState();
}

class _CreateBookScreenState extends State<CreateBookScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _classification = ClassificationValue();
  final _coverKey = GlobalKey();
  final _titleKey = GlobalKey();
  final _classificationKey = GlobalKey();
  final _descriptionKey = GlobalKey();
  final _scroll = ScrollController();
  String _imageUrl = '';
  List<(String, GlobalKey)> _errors = const [];
  String? _serverError;

  @override
  void dispose() {
    _scroll.dispose();
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  /// Problems in the website's order: cover, title, classification,
  /// description. Each one scrolls to its field when tapped.
  List<(String, GlobalKey)> _validate() => [
    if (_imageUrl.isEmpty) ('Kapak resmi yüklemek zorunludur.', _coverKey),
    if (_title.text.trim().isEmpty) ('Kitap başlığı zorunludur.', _titleKey),
    for (final message in _classification.validate()) (message, _classificationKey),
    if (_description.text.trim().isEmpty) ('Açıklama zorunludur.', _descriptionKey),
  ];

  Future<void> _submit() async {
    final errors = _validate();
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) {
      showToast(context, errors.map((error) => error.$1).join('\n'), type: ToastType.error);
      // The button is at the bottom of the form, the summary at the top:
      // bring the summary (and its jump links) into view.
      if (_scroll.hasClients) unawaited(_scroll.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut));
      return;
    }
    try {
      final data = await context.services.api.run(
        r'''mutation CreateBook($title: String!, $classification: ClassificationInput!, $description: String!, $imageUrl: String!) {
          createBook(title: $title, classification: $classification, description: $description, imageUrl: $imageUrl) { id title }
        }''',
        variables: {
          'title': _title.text.trim(),
          'classification': _classification.toInput(),
          'description': _description.text.trim(),
          'imageUrl': _imageUrl,
        },
      );
      final id = jsonMap(data['createBook'])?['id'];
      if (!mounted || id is! String) return;
      context.services.invalidateData();
      context.pushReplacement('/dashboard/$id');
    } on ApiException catch (error) {
      if (mounted) setState(() => _serverError = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uploadEnabled = context.services.config.imageUploadEnabled;
    return PageScaffold(
      title: 'Kitap Oluştur',
      body: ListView(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text('Yeni Kitap', style: serif(size: 24, weight: FontWeight.w700)),
          Text(
            'Kitabınız taslak olarak kaydedilir; hazır olduğunuzda yayınlarsınız.',
            style: serif(size: 14, style: FontStyle.italic, color: BetikColors.ashGray),
          ),
          const SizedBox(height: 16),
          if (!uploadEnabled)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Notice(
                'Bu derlemede görsel yükleme yapılandırılmadığı için kapak eklenemiyor; kapak zorunlu olduğundan kitap oluşturulamaz.',
                error: true,
              ),
            ),
          if (_errors.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFDF2F2),
                border: Border.all(color: BetikColors.danger),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Lütfen şu alanları düzeltin:',
                    style: sans(size: 13.5, weight: FontWeight.w700, color: BetikColors.danger),
                  ),
                  for (final (message, key) in _errors)
                    InkWell(
                      onTap: () {
                        final target = key.currentContext;
                        if (target != null) Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 250), alignment: 0.1);
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Text(
                          '• $message',
                          style: sans(size: 13, color: BetikColors.danger).copyWith(decoration: TextDecoration.underline),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          if (_serverError != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Notice(_serverError!, error: true)),
          LabeledField(
            key: _coverKey,
            label: 'Kapak Resmi',
            required: true,
            child: ImageUploadField(
              label: 'Kapak Yükle',
              currentImage: _imageUrl,
              aspectRatio: 2 / 3,
              onUploaded: (url) => setState(() => _imageUrl = url),
            ),
          ),
          LabeledField(
            key: _titleKey,
            label: 'Kitap Başlığı',
            required: true,
            child: TextField(controller: _title, textCapitalization: TextCapitalization.sentences),
          ),
          Loader<ClassificationOptions>(
            key: _classificationKey,
            load: () => loadClassificationOptions(context.services.api),
            builder: (context, options, _) => options.formats.isEmpty
                // A database without classification terms cannot create books
                // (Stage 2 D-02); say so instead of showing an empty select.
                ? const Notice('Eser biçimleri henüz tanımlanmamış. Lütfen daha sonra tekrar deneyin.', error: true)
                : ClassificationFields(value: _classification, options: options, onChanged: () => setState(() {})),
          ),
          LabeledField(
            key: _descriptionKey,
            label: 'Açıklama',
            required: true,
            child: TextField(controller: _description, minLines: 4, maxLines: 12, textCapitalization: TextCapitalization.sentences),
          ),
          BusyButton(onPressed: _submit, label: 'Taslak Olarak Kaydet'),
        ],
      ),
    );
  }
}
