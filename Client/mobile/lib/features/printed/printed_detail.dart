import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/mentions.dart';
import '../../core/widgets/ui.dart';
import '../book/classification_fields.dart';
import '../book/comments.dart';
import '../funding/funding_shared.dart' show Notice, PanelCard;
import '../quotes/quote_card.dart';

/// Detail layout of a `PRINTED` catalogue book (F-PRINTED-04…07,
/// F-QUOTE-09).
class PrintedBookDetail extends StatelessWidget {
  const PrintedBookDetail({super.key, required this.book, required this.isAdmin, required this.onChanged});
  final Book book;
  final bool isAdmin;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final me = context.services.auth.userId;
    final approved = book.publicationStatus == 'APPROVED';
    final canClassify = me != null && (book.authorId == me || isAdmin || (!approved && book.submittedById == me));
    Widget meta(String title, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(title, style: sans(size: 13, color: BetikColors.ashGray)),
          ),
          Expanded(
            child: Text(value, style: sans(size: 13.5, weight: FontWeight.w600)),
          ),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            BookCover(book.imageUrl, width: 120),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const TagChip('Basılı eser'),
                  const SizedBox(height: 6),
                  Text(book.title, style: serif(size: 22, weight: FontWeight.w700, height: 1.25)),
                  Text(
                    book.printedAuthor ?? '',
                    style: serif(size: 15, style: FontStyle.italic, color: BetikColors.graphite),
                  ),
                  const SizedBox(height: 8),
                  meta('Yayınevi', book.publisher ?? ''),
                  meta('Basım yılı', '${book.publicationYear ?? ''}'),
                  meta('Sayfa', '${book.pageCount}'),
                  meta('ISBN', (book.isbn ?? '').isEmpty ? 'Belirtilmedi' : book.isbn!),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (approved && (book.purchaseUrl ?? '').isNotEmpty)
          FilledButton(onPressed: () => openExternal(context, book.purchaseUrl!), child: const Text('SATIN ALMA SAYFASI ↗')),
        if (approved && book.chapters.isNotEmpty)
          TextButton(onPressed: () => context.push('/reader/${book.id}'), child: const Text('Yazarın paylaştığı bölümleri oku')),
        if (book.canEditContent)
          TextButton(onPressed: () => context.push('/dashboard/${book.id}'), child: const Text('Bölüm ekle / düzenle')),
        if (book.author != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: GestureDetector(
              onTap: () => context.push('/user/${book.author!.id}'),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: 'Betik\'te onaylanan yazar: ',
                      style: sans(size: 13, color: BetikColors.ashGray),
                    ),
                    TextSpan(
                      text: book.author!.displayName,
                      style: sans(size: 13, weight: FontWeight.w700).copyWith(decoration: TextDecoration.underline),
                    ),
                  ],
                ),
              ),
            ),
          ),
        const SizedBox(height: 10),
        ClassificationSummary(book.classification),
        if (canClassify) ...[const SizedBox(height: 8), ClassificationEditor(book: book, onSaved: onChanged)],
        const SizedBox(height: 12),
        if (approved) PrintedReadingEditor(bookId: book.id, bookTitle: book.title),
        if (!approved)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Notice(
              book.publicationStatus == 'PENDING'
                  ? 'Bu istek Betik incelemesinde. Henüz herkese açık katalogda yer almıyor.'
                  : 'İsteğiniz için düzenleme gerekiyor. ${book.reviewNote ?? ''} Bilgileri düzelterek basılı kitaplar sayfasından yeniden istek gönderebilirsiniz.',
            ),
          ),
        PanelCard(
          title: 'Kitap hakkında',
          children: [Text(book.description, style: serif(size: 15, height: 1.6))],
        ),
        if (approved && me != null && book.authorId == null) _ClaimForm(book: book, onChanged: onChanged),
        if (approved) ...[
          CommentsSection(bookId: book.id, bookTitle: book.title, title: 'Okur yorumları'),
          const OrnamentDivider(),
          _PrintedQuotes(book: book),
        ],
      ],
    );
  }
}

// --- "Okudum ve değerlendirdim" ---------------------------------------------

const _readingFields = 'id userId rating review readAt updatedAt';

class PrintedReadingEditor extends StatefulWidget {
  const PrintedReadingEditor({super.key, required this.bookId, required this.bookTitle});
  final String bookId;
  final String bookTitle;

  @override
  State<PrintedReadingEditor> createState() => _PrintedReadingEditorState();
}

class _PrintedReadingEditorState extends State<PrintedReadingEditor> {
  final _review = TextEditingController();
  int? _rating;
  bool _exists = false;
  bool _loaded = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _review.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!context.services.auth.isSignedIn) {
      setState(() => _loaded = true);
      return;
    }
    try {
      final data = await context.services.api.run(
        'query MyPrintedReading(\$bookId: ID!) { myPrintedBookReading(bookId: \$bookId) { $_readingFields } }',
        variables: {'bookId': widget.bookId},
      );
      final reading = jsonMap(data['myPrintedBookReading']);
      if (!mounted) return;
      setState(() {
        _exists = reading != null;
        _rating = reading == null ? null : jsonInt(reading['rating']);
        _review.text = jsonString(reading?['review']);
        _loaded = true;
      });
    } on ApiException {
      if (mounted) setState(() => _loaded = true);
    }
  }

  Future<void> _save() async {
    if (!requireMember(context, 'printed-reading', bookTitle: widget.bookTitle)) return;
    if (_rating == null) return setState(() => _error = 'Lütfen 1–5 arasında bir puan seçin.');
    setState(() => _error = null);
    try {
      await context.services.api.run(
        'mutation SavePrintedReading(\$bookId: ID!, \$rating: Int!, \$review: String) { savePrintedBookReading(bookId: \$bookId, rating: \$rating, review: \$review) { $_readingFields } }',
        variables: {'bookId': widget.bookId, 'rating': _rating, 'review': _review.text.trim()},
      );
      if (!mounted) return;
      setState(() => _exists = true);
      showToast(context, 'Değerlendirmeniz kaydedildi.', type: ToastType.success);
      context.services.invalidateData();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _remove() async {
    try {
      await context.services.api.run(
        r'mutation RemovePrintedReading($bookId: ID!) { removePrintedBookReading(bookId: $bookId) }',
        variables: {'bookId': widget.bookId},
      );
      if (!mounted) return;
      setState(() {
        _exists = false;
        _rating = null;
        _review.clear();
      });
      showToast(context, 'Okuduklarınızdan kaldırıldı.', type: ToastType.success);
      context.services.invalidateData();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) return const SizedBox.shrink();
    return PanelCard(
      title: 'Okudum ve değerlendirdim',
      children: [
        Row(
          children: [
            for (var star = 1; star <= 5; star++)
              IconButton(
                tooltip: '$star puan',
                visualDensity: VisualDensity.compact,
                icon: Icon((_rating ?? 0) >= star ? Icons.star : Icons.star_border, color: const Color(0xFFD97706), size: 30),
                onPressed: () => setState(() => _rating = star),
              ),
          ],
        ),
        if (_error != null) Text(_error!, style: sans(size: 13, color: BetikColors.danger)),
        const SizedBox(height: 6),
        TextField(
          controller: _review,
          minLines: 2,
          maxLines: 6,
          maxLength: 3000,
          decoration: const InputDecoration(hintText: 'Değerlendirmeniz (isteğe bağlı)'),
        ),
        BusyButton(onPressed: _save, label: _exists ? 'Değerlendirmeyi güncelle' : 'Okudum, kitaplığıma ekle'),
        if (_exists) TextButton(onPressed: _remove, child: const Text('Okuduklarımdan kaldır')),
      ],
    );
  }
}

// --- Author claim -------------------------------------------------------------

class _ClaimForm extends StatefulWidget {
  const _ClaimForm({required this.book, required this.onChanged});
  final Book book;
  final VoidCallback onChanged;

  @override
  State<_ClaimForm> createState() => _ClaimFormState();
}

class _ClaimFormState extends State<_ClaimForm> {
  final _evidence = TextEditingController();
  final _url = TextEditingController();
  bool _submitted = false;
  String? _error;

  @override
  void dispose() {
    _evidence.dispose();
    _url.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final evidence = _evidence.text.trim();
    final url = _url.text.trim();
    if (evidence.length < 20 || evidence.length > 3000) {
      return setState(() => _error = 'Hak talebi açıklaması 20–3000 karakter olmalıdır.');
    }
    if (url.isNotEmpty && !url.startsWith('https://')) {
      return setState(() => _error = 'Destekleyici bağlantı https:// ile başlamalıdır.');
    }
    setState(() => _error = null);
    try {
      await context.services.api.run(
        r'mutation RequestBookClaim($bookId: ID!, $evidence: String!, $evidenceUrl: String) { requestBookClaim(bookId: $bookId, evidence: $evidence, evidenceUrl: $evidenceUrl) { id status reviewNote } }',
        variables: {'bookId': widget.book.id, 'evidence': evidence, 'evidenceUrl': url},
      );
      if (!mounted) return;
      setState(() => _submitted = true);
      widget.onChanged();
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final claim = widget.book.myClaim;
    if (claim?['status'] == 'PENDING' || (_submitted && claim == null)) {
      return PanelCard(
        children: [
          const Text('Yazar hak talebiniz inceleniyor. Onaydan sonra bölüm ekleyebilirsiniz.'),
          TextButton(onPressed: widget.onChanged, child: const Text('Durumu yenile')),
        ],
      );
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PaperCard(
        padding: EdgeInsets.zero,
        child: ExpansionTile(
          title: Text('Bu kitabın yazarı mısınız? Hak talebinde bulunun', style: sans(size: 14, weight: FontWeight.w600)),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (jsonString(claim?['reviewNote']).isNotEmpty)
              Padding(padding: const EdgeInsets.only(bottom: 8), child: Notice('Önceki talebiniz: ${claim!['reviewNote']}')),
            Text(
              'ISBN veya kitabı eklemiş olmak yazarlık yetkisi vermez. Yazarlığınızı ve dijital yayın yetkinizi destekleyen bilgileri Betik yönetimiyle paylaşın.',
              style: sans(size: 13, height: 1.45),
            ),
            const SizedBox(height: 10),
            LabeledField(
              label: 'Hak talebi açıklaması',
              required: true,
              child: TextField(controller: _evidence, minLines: 3, maxLines: 8, maxLength: 3000),
            ),
            LabeledField(
              label: 'Destekleyici bağlantı (isteğe bağlı)',
              hint: 'Bu bilgiler yalnızca siz ve Betik yönetimi tarafından görülebilir.',
              child: TextField(
                controller: _url,
                keyboardType: TextInputType.url,
                autocorrect: false,
                decoration: const InputDecoration(hintText: 'https://…'),
              ),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Notice(_error!, error: true)),
            BusyButton(onPressed: _submit, label: 'Hak talebini gönder'),
          ],
        ),
      ),
    );
  }
}

// --- Quotes from a printed book --------------------------------------------

class _PrintedQuotes extends StatefulWidget {
  const _PrintedQuotes({required this.book});
  final Book book;

  @override
  State<_PrintedQuotes> createState() => _PrintedQuotesState();
}

class _PrintedQuotesState extends State<_PrintedQuotes> {
  final _loader = GlobalKey<LoaderState<List<Quote>>>();
  final _text = TextEditingController();
  final _page = TextEditingController();
  final _note = TextEditingController();
  bool _spoiler = false;
  String _visibility = 'PUBLIC';
  String? _error;
  bool _sent = false;

  @override
  void dispose() {
    _text.dispose();
    _page.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _text.text.trim();
    final page = int.tryParse(_page.text.trim());
    setState(() {
      _error = null;
      _sent = false;
    });
    if (text.length < 10 || text.length > 1000) return setState(() => _error = 'Alıntı 10–1000 karakter olmalıdır.');
    if (page == null || page < 1 || page > widget.book.pageCount) {
      return setState(() => _error = 'Sayfa numarası 1 ile ${widget.book.pageCount} arasında olmalıdır.');
    }
    if (!requireMember(context, 'quote', bookTitle: widget.book.title, draft: text)) return;
    final api = context.services.api;
    try {
      // The duplicate error text (`QUOTE_EXISTS:`) is masked in production,
      // so the duplicate is detected with the dedicated query first.
      final check = await api.run(
        r'query CheckQuoteExists($text: String!, $bookId: ID!, $visibility: QuoteVisibility) { checkQuoteExists(text: $text, bookId: $bookId, visibility: $visibility) { exists } }',
        variables: {'text': text, 'bookId': widget.book.id, 'visibility': _visibility},
      );
      if (jsonMap(check['checkQuoteExists'])?['exists'] == true) {
        if (mounted) setState(() => _error = 'Bu alıntı seçtiğiniz görünürlükle zaten kaydedilmiş.');
        return;
      }
      await api.run(
        r'mutation CreatePrintedQuote($bookId: ID!, $text: String!, $pageNumber: Int!, $note: String, $isSpoiler: Boolean, $visibility: QuoteVisibility) { createQuote(bookId: $bookId, text: $text, pageNumber: $pageNumber, note: $note, isSpoiler: $isSpoiler, visibility: $visibility) { id } }',
        variables: {
          'bookId': widget.book.id,
          'text': text,
          'pageNumber': page,
          'note': _note.text.trim(),
          'isSpoiler': _spoiler,
          'visibility': _visibility,
        },
      );
      if (!mounted) return;
      _text.clear();
      _page.clear();
      _note.clear();
      setState(() {
        _spoiler = false;
        _sent = true;
      });
      await _loader.currentState?.reload(silent: true);
    } on ApiException catch (error) {
      if (mounted) {
        setState(
          () => _error = error.message.contains('QUOTE_EXISTS:') ? 'Bu alıntı seçtiğiniz görünürlükle zaten kaydedilmiş.' : error.message,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Kitaptan alıntılar', style: serif(size: 20, weight: FontWeight.w700)),
      const SizedBox(height: 10),
      LabeledField(
        label: 'Kısa alıntı',
        required: true,
        child: TextField(controller: _text, minLines: 2, maxLines: 6, maxLength: 1000),
      ),
      LabeledField(
        label: 'Sayfa numarası',
        required: true,
        child: TextField(controller: _page, keyboardType: TextInputType.number),
      ),
      LabeledField(
        label: 'Not (isteğe bağlı)',
        child: MentionField(controller: _note, maxLength: 1000),
      ),
      CheckboxListTile(
        value: _spoiler,
        onChanged: (value) => setState(() => _spoiler = value ?? false),
        title: const Text('Sürprizbozan içeriyor'),
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        dense: true,
      ),
      SegmentedButton<String>(
        showSelectedIcon: false,
        segments: const [
          ButtonSegment(value: 'PUBLIC', label: Text('Herkese açık')),
          ButtonSegment(value: 'PRIVATE', label: Text('Sadece ben')),
        ],
        selected: {_visibility},
        onSelectionChanged: (selection) => setState(() => _visibility = selection.first),
      ),
      const SizedBox(height: 8),
      if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Notice(_error!, error: true)),
      if (_sent) const Padding(padding: EdgeInsets.only(bottom: 8), child: Notice('Alıntınız kaydedildi.')),
      BusyButton(onPressed: _submit, label: 'Alıntıyı paylaş'),
      const SizedBox(height: 14),
      Loader<List<Quote>>(
        key: _loader,
        load: () async {
          final data = await context.services.api.run(
            'query GetQuotesByBook(\$bookId: ID!) { getQuotesByBook(bookId: \$bookId) { $quoteFields } }',
            variables: {'bookId': widget.book.id},
          );
          return jsonList(data['getQuotesByBook']).map(Quote.fromJson).toList();
        },
        builder: (context, quotes, _) => quotes.isEmpty
            ? const EmptyView(title: 'Bu kitaptan henüz alıntı paylaşılmadı.')
            : Column(
                children: [
                  for (final quote in quotes)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: QuoteCard(quote, key: ValueKey(quote.id)),
                    ),
                ],
              ),
      ),
    ],
  );
}

// --- "Okuduğum Basılı Kitaplar" shelf (profile tab) -------------------------

class PrintedReadingLibrary extends StatefulWidget {
  const PrintedReadingLibrary({super.key, required this.userId, required this.isOwner});
  final String userId;
  final bool isOwner;

  @override
  State<PrintedReadingLibrary> createState() => _PrintedReadingLibraryState();
}

class _PrintedReadingLibraryState extends State<PrintedReadingLibrary> {
  int _page = 1;

  Future<Json> _load() async {
    final data = await context.services.api.run(
      '''query GetPrintedReadings(\$userId: ID!, \$page: Int!) {
        getPrintedReadings(userId: \$userId, page: \$page) {
          total page totalPages canView
          items { $_readingFields book { id publicPath title imageUrl kind publicationStatus printedAuthor publisher } }
        }
      }''',
      variables: {'userId': widget.userId, 'page': _page},
    );
    return Map<String, dynamic>.from(data['getPrintedReadings'] as Map);
  }

  @override
  Widget build(BuildContext context) => Loader<Json>(
    key: ValueKey(_page),
    load: _load,
    refreshOn: context.services.dataEpoch,
    builder: (context, data, loader) {
      if (data['canView'] == false) return const EmptyView(title: 'Bu kullanıcının kitaplığı gizli.');
      final items = jsonList(data['items']);
      if (items.isEmpty) return const EmptyView(title: 'Henüz okunan basılı kitap eklenmemiş.');
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${jsonInt(data['total'])} basılı kitap okundu', style: sans(size: 13, color: BetikColors.ashGray)),
          const SizedBox(height: 8),
          for (final item in items)
            () {
              final book = jsonMap(item['book']) ?? const {};
              final rating = jsonInt(item['rating']);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: PaperCard(
                  onTap: () => context.push('/book/${book['id']}'),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      BookCover(jsonString(book['imageUrl']), width: 60),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(jsonString(book['title']), style: serif(size: 15, weight: FontWeight.w700)),
                            Text(jsonString(book['printedAuthor']), style: sans(size: 12.5, color: BetikColors.ashGray)),
                            Text('${'★' * rating}${'☆' * (5 - rating)}', style: sans(size: 16, color: const Color(0xFFD97706))),
                            if (jsonString(item['review']).isNotEmpty)
                              Text(
                                jsonString(item['review']),
                                style: serif(size: 13.5, height: 1.45),
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                              ),
                            Text(formatDate(parseApiDate(item['readAt'])), style: sans(size: 12, color: BetikColors.ashGray)),
                            if (widget.isOwner)
                              Wrap(
                                children: [
                                  TextButton(
                                    onPressed: () => context.push('/book/${book['id']}'),
                                    child: const Text('Değerlendirmeyi düzenle'),
                                  ),
                                  TextButton(
                                    onPressed: () async {
                                      try {
                                        await context.services.api.run(
                                          r'mutation RemovePrintedReading($bookId: ID!) { removePrintedBookReading(bookId: $bookId) }',
                                          variables: {'bookId': book['id']},
                                        );
                                        await loader.reload(silent: true);
                                      } catch (error) {
                                        if (context.mounted) showError(context, error);
                                      }
                                    },
                                    child: const Text('Kitaplığımdan kaldır'),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }(),
          if (jsonInt(data['totalPages'], 1) > 1)
            PagerBar(page: _page, totalPages: jsonInt(data['totalPages'], 1), onPage: (page) => setState(() => _page = page)),
        ],
      );
    },
  );
}
