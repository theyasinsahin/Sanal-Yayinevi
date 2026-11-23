import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';
import '../book/book_card.dart';
import '../book/classification_fields.dart';
import '../discovery/feed_screen.dart';
import '../funding/funding_shared.dart' show Notice;
import '../shell/shell.dart';

const _printedBooksQuery =
    '''
query GetPrintedBooks(\$page: Int, \$search: String, \$classification: ClassificationFilter) {
  getPrintedBooks(page: \$page, search: \$search, classification: \$classification) {
    total page totalPages
    books { $classificationFields publicPath id title kind printedAuthor publisher publicationYear isbn imageUrl pageCount description }
  }
}''';

/// Basılı Kitaplar (F-PRINTED-01/02/03): server-paged catalogue (12 per
/// page), search, collapsible classification filters, submission form and
/// the member's own submissions.
class PrintedBooksScreen extends StatefulWidget {
  const PrintedBooksScreen({super.key});
  @override
  State<PrintedBooksScreen> createState() => _PrintedBooksScreenState();
}

class _PrintedBooksScreenState extends State<PrintedBooksScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  int _page = 1;
  String _query = '';
  ClassificationFilterValue _filter = const ClassificationFilterValue();
  bool _showFilters = false;
  bool _showForm = false;
  int _version = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<Json> _load() async {
    final classification = _filter.toInput();
    final data = await context.services.api.run(
      _printedBooksQuery,
      variables: {'page': _page, 'search': _query, if (classification != null) 'classification': classification},
    );
    return Map<String, dynamic>.from(data['getPrintedBooks'] as Map);
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<AuthController>().isSignedIn;
    return PageScaffold(
      title: 'Basılı Kitaplar',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text('Basılı Kitaplar', style: serif(size: 24, weight: FontWeight.w700)),
          Text(
            'Raflardaki eserleri keşfedin, okuduklarınızı değerlendirin.',
            style: serif(size: 14, style: FontStyle.italic, color: BetikColors.ashGray),
          ),
          const SizedBox(height: 12),
          if (signedIn)
            OutlinedButton.icon(
              onPressed: () => setState(() => _showForm = !_showForm),
              icon: Icon(_showForm ? Icons.close : Icons.add, size: 18),
              label: Text(_showForm ? 'FORMU KAPAT' : 'BASILI KİTAP EKLE'),
            )
          else
            TextButton(
              onPressed: () => context.push('/login?returnTo=${Uri.encodeComponent('/printed-books')}'),
              child: const Text('Kitap eklemek için giriş yapın'),
            ),
          if (_showForm && signedIn)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: PrintedBookSubmissionForm(onSubmitted: () => setState(() => _version++)),
            ),
          if (signedIn) _MySubmissions(key: ValueKey('subs-$_version')),
          const SizedBox(height: 12),
          TextField(
            controller: _search,
            maxLength: 150,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              hintText: 'Kitap, yazar, yayınevi veya ISBN ara',
              counterText: '',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), () {
                setState(() {
                  _query = value.trim();
                  _page = 1;
                });
              });
            },
          ),
          TextButton.icon(
            onPressed: () => setState(() => _showFilters = !_showFilters),
            icon: Icon(_showFilters ? Icons.expand_less : Icons.tune, size: 18),
            label: Text(_showFilters ? 'Filtreleri gizle' : 'Filtrele${_filter.isEmpty ? '' : ' (seçili)'}'),
          ),
          if (_showFilters)
            PaperCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ClassificationFilterPanel(
                    value: _filter,
                    onChanged: (value) => setState(() {
                      _filter = value;
                      _page = 1;
                    }),
                  ),
                  if (!_filter.isEmpty)
                    TextButton(
                      onPressed: () => setState(() {
                        _filter = const ClassificationFilterValue();
                        _page = 1;
                      }),
                      child: const Text('Filtreleri temizle'),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Loader<Json>(
            key: ValueKey('$_page|$_query|${_filter.toInput()}|$_version'),
            load: _load,
            loadingLabel: 'Basılı kitaplar yükleniyor…',
            errorBuilder: (context, error, retry) =>
                ErrorView(title: 'Basılı kitaplar yüklenemedi', message: errorMessage(error), onRetry: retry, retryLabel: 'Tekrar dene'),
            builder: (context, data, _) {
              final books = jsonList(data['books']).map(Book.fromJson).toList();
              if (books.isEmpty) {
                return EmptyView(
                  icon: Icons.menu_book_outlined,
                  title: _query.isNotEmpty || !_filter.isEmpty
                      ? 'Aramanıza uygun bir eser bulunamadı'
                      : 'Raflarımız ilk eserlerini bekliyor',
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('${jsonInt(data['total'])} basılı eser', style: sans(size: 13, color: BetikColors.ashGray)),
                  const SizedBox(height: 10),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final columns = constraints.maxWidth >= 700 ? 5 : (constraints.maxWidth >= 480 ? 4 : 3);
                      final width = (constraints.maxWidth - (columns - 1) * 12) / columns;
                      return Wrap(spacing: 12, runSpacing: 16, children: [for (final book in books) BookTile(book, width: width)]);
                    },
                  ),
                  PagerBar(
                    page: jsonInt(data['page'], 1),
                    totalPages: jsonInt(data['totalPages'], 1),
                    onPage: (page) => setState(() => _page = page),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MySubmissions extends StatelessWidget {
  const _MySubmissions({super.key});

  static const _labels = {'PENDING': 'İncelemede', 'APPROVED': 'Onaylandı', 'REJECTED': 'Düzenleme gerekiyor'};

  @override
  Widget build(BuildContext context) => Loader<List<Json>>(
    load: () async {
      final data = await context.services.api.run(
        'query GetMyPrintedSubmissions { getMyPrintedSubmissions { publicPath id title publicationStatus reviewNote } }',
      );
      return jsonList(data['getMyPrintedSubmissions']);
    },
    errorBuilder: (_, _, _) => const SizedBox.shrink(),
    builder: (context, submissions, _) => submissions.isEmpty
        ? const SizedBox.shrink()
        : ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text('Basılı Kitap Katkılarım (${submissions.length})', style: sans(size: 14, weight: FontWeight.w700)),
            children: [
              for (final book in submissions)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(jsonString(book['title'])),
                  subtitle: jsonString(book['reviewNote']).isEmpty ? null : Text(jsonString(book['reviewNote'])),
                  trailing: Text(trailingLabel(book['publicationStatus']), style: label(size: 11)),
                  onTap: () => context.push('/book/${book['id']}'),
                ),
            ],
          ),
  );

  static String trailingLabel(Object? status) => _labels[status] ?? '$status';
}

/// Submission form (F-PRINTED-02). Limits mirror the server: title ≤200,
/// author 2–300, publisher 2–200, year 1400…current, pages 1–50000,
/// description 20–5000, HTTPS URLs, evidence URL required.
class PrintedBookSubmissionForm extends StatefulWidget {
  const PrintedBookSubmissionForm({super.key, required this.onSubmitted});
  final VoidCallback onSubmitted;

  @override
  State<PrintedBookSubmissionForm> createState() => _PrintedBookSubmissionFormState();
}

class _PrintedBookSubmissionFormState extends State<PrintedBookSubmissionForm> {
  final _isbn = TextEditingController();
  final _title = TextEditingController();
  final _author = TextEditingController();
  final _publisher = TextEditingController();
  final _year = TextEditingController();
  final _pages = TextEditingController();
  final _image = TextEditingController();
  final _description = TextEditingController();
  final _purchase = TextEditingController();
  final _evidence = TextEditingController();
  final _classification = ClassificationValue();
  List<String> _errors = const [];
  String? _success;

  @override
  void dispose() {
    for (final controller in [_isbn, _title, _author, _publisher, _year, _pages, _image, _description, _purchase, _evidence]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _lookup() async {
    final isbn = _isbn.text.trim();
    if (isbn.isEmpty) return;
    try {
      final data = await context.services.api.run(
        r'query LookupPrintedBook($isbn: String!) { lookupPrintedBook(isbn: $isbn) { isbn found title printedAuthor publisher publicationYear pageCount imageUrl } }',
        variables: {'isbn': isbn},
      );
      final result = jsonMap(data['lookupPrintedBook']) ?? const {};
      if (!mounted) return;
      if (result['found'] != true) {
        showToast(context, 'Bu ISBN için kayıt bulunamadı. Bilgileri elle girebilirsiniz.');
        return;
      }
      setState(() {
        _isbn.text = jsonString(result['isbn'], isbn);
        if (result['title'] != null) _title.text = jsonString(result['title']);
        if (result['printedAuthor'] != null) _author.text = jsonString(result['printedAuthor']);
        if (result['publisher'] != null) _publisher.text = jsonString(result['publisher']);
        if (result['publicationYear'] != null) _year.text = '${result['publicationYear']}';
        if (result['pageCount'] != null) _pages.text = '${result['pageCount']}';
        if (result['imageUrl'] != null) _image.text = jsonString(result['imageUrl']);
      });
      showToast(context, 'Kitap bilgileri dolduruldu.', type: ToastType.success);
    } catch (error) {
      // The website shows a raw JavaScript error here (Stage 2 B-01); the
      // app shows the server's message, e.g. the invalid-ISBN text.
      if (mounted) showError(context, error);
    }
  }

  bool _https(String value) => value.startsWith('https://') && Uri.tryParse(value)?.host.isNotEmpty == true;

  List<String> _validate() {
    final year = int.tryParse(_year.text.trim());
    final pages = int.tryParse(_pages.text.trim());
    final title = _title.text.trim();
    final author = _author.text.trim();
    final publisher = _publisher.text.trim();
    final description = _description.text.trim();
    return [
      if (title.isEmpty || title.length > 200) 'Kitap adı zorunludur (en fazla 200 karakter).',
      if (author.length < 2 || author.length > 300) 'Yazar adı 2–300 karakter olmalıdır.',
      if (publisher.length < 2 || publisher.length > 200) 'Yayınevi 2–200 karakter olmalıdır.',
      if (year == null || year < 1400 || year > DateTime.now().year) 'Basım yılı 1400 ile ${DateTime.now().year} arasında olmalıdır.',
      if (pages == null || pages < 1 || pages > 50000) 'Sayfa sayısı 1–50000 arasında olmalıdır.',
      if (_image.text.trim().isNotEmpty && !_https(_image.text.trim())) 'Kapak görseli bağlantısı https:// ile başlamalıdır.',
      ..._classification.validate(),
      if (description.length < 20 || description.length > 5000) 'Açıklama 20–5000 karakter olmalıdır.',
      if (_purchase.text.trim().isNotEmpty && !_https(_purchase.text.trim())) 'Satın alma bağlantısı https:// ile başlamalıdır.',
      if (!_https(_evidence.text.trim())) 'Yayın kanıtı bağlantısı zorunludur ve https:// ile başlamalıdır.',
    ];
  }

  Future<void> _submit() async {
    final errors = _validate();
    setState(() {
      _errors = errors;
      _success = null;
    });
    if (errors.isNotEmpty) return;
    String? optional(TextEditingController controller) => controller.text.trim().isEmpty ? null : controller.text.trim();
    try {
      await context.services.api.run(
        r'mutation SubmitPrintedBook($input: PrintedBookInput!) { submitPrintedBook(input: $input) { publicPath id title publicationStatus } }',
        variables: {
          'input': {
            'classification': _classification.toInput(),
            'isbn': optional(_isbn),
            'title': _title.text.trim(),
            'printedAuthor': _author.text.trim(),
            'publisher': _publisher.text.trim(),
            'publicationYear': int.parse(_year.text.trim()),
            'pageCount': int.parse(_pages.text.trim()),
            'description': _description.text.trim(),
            'imageUrl': optional(_image),
            'purchaseUrl': optional(_purchase),
            'publicationEvidenceUrl': _evidence.text.trim(),
          },
        },
      );
      if (!mounted) return;
      for (final controller in [_isbn, _title, _author, _publisher, _year, _pages, _image, _description, _purchase, _evidence]) {
        controller.clear();
      }
      setState(() => _success = 'İsteğiniz Betik\'e iletildi. Onaydan sonra kitabınız burada listelenecek.');
      widget.onSubmitted();
    } on ApiException catch (error) {
      if (mounted) setState(() => _errors = [error.message]);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget field(
      String label,
      TextEditingController controller, {
      bool required = false,
      TextInputType? keyboard,
      int maxLines = 1,
      int? maxLength,
      String? hint,
    }) => LabeledField(
      label: label,
      required: required,
      hint: hint,
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        minLines: maxLines > 1 ? 3 : 1,
        maxLines: maxLines,
        maxLength: maxLength,
        autocorrect: keyboard != TextInputType.url,
        decoration: const InputDecoration(counterText: ''),
      ),
    );
    return PaperCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Basılı kitap ekle', style: serif(size: 18, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            'Kitabı eklemek yazarlık yetkisi vermez; istekler Betik yönetimi tarafından incelenir.',
            style: sans(size: 12.5, color: BetikColors.ashGray),
          ),
          const SizedBox(height: 12),
          if (_success != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Notice(_success!)),
          LabeledField(
            label: 'ISBN',
            child: Row(
              children: [
                Expanded(
                  child: TextField(controller: _isbn, keyboardType: TextInputType.text, autocorrect: false),
                ),
                const SizedBox(width: 8),
                BusyButton(outlined: true, onPressed: _lookup, label: 'ISBN ile bul'),
              ],
            ),
          ),
          field('Kitap adı', _title, required: true, maxLength: 200),
          field('Yazar', _author, required: true, maxLength: 300),
          field('Yayınevi', _publisher, required: true, maxLength: 200),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: field('Basım yılı', _year, required: true, keyboard: TextInputType.number)),
              const SizedBox(width: 10),
              Expanded(child: field('Sayfa sayısı', _pages, required: true, keyboard: TextInputType.number)),
            ],
          ),
          field('Kapak görseli bağlantısı', _image, keyboard: TextInputType.url, hint: 'İsteğe bağlı, https://'),
          Loader<ClassificationOptions>(
            load: () => loadClassificationOptions(context.services.api),
            builder: (context, options, _) =>
                ClassificationFields(value: _classification, options: options, onChanged: () => setState(() {})),
          ),
          field('Açıklama', _description, required: true, maxLines: 8, maxLength: 5000),
          field('Satın alma bağlantısı', _purchase, keyboard: TextInputType.url, hint: 'İsteğe bağlı'),
          field(
            'Yayın kanıtı bağlantısı',
            _evidence,
            required: true,
            keyboard: TextInputType.url,
            hint: 'Yayınevi, kitapçı veya kütüphane kaydı bağlantısı',
          ),
          for (final error in _errors)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text('• $error', style: sans(size: 13, color: BetikColors.danger)),
            ),
          const SizedBox(height: 8),
          BusyButton(onPressed: _submit, label: 'İnceleme isteği gönder'),
        ],
      ),
    );
  }
}
