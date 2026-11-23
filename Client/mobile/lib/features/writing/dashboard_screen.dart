import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/richtext/page_count.dart';
import '../../core/richtext/rich_text.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';
import '../book/book_detail_screen.dart' show updateBookStatusMutation;
import '../book/classification_fields.dart';
import '../share/share_sheet.dart';
import '../shell/shell.dart';
import 'chapter_autosave.dart';
import 'chapter_editor.dart';

const _dashboardQuery =
    '''
query GetBookById(\$id: ID!) {
  getBookById(id: \$id) {
    publicPath id title description imageUrl kind status digitalStatus writingStatus authorId canEditContent pageCount
    author { id username fullName profilePicture }
    $classificationFields
    chapters { id title content isHidden canReadContent accessStatus wordCount createdAt pageCount }
  }
}''';

const _updateChapterMutation = r'''
mutation UpdateChapter($chapterId: ID!, $content: String, $pageCount: Int) {
  updateChapter(chapterId: $chapterId, content: $content, pageCount: $pageCount) { id pageCount wordCount }
}''';

/// Yazı masası (F-WRITE-04…10).
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.bookId});
  final String bookId;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with WidgetsBindingObserver {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _newChapter = TextEditingController();
  late final AppServices _services = context.services;
  late final ChapterAutosave _autosave = ChapterAutosave(save: _saveChapter);

  Book? _book;
  Object? _error;
  bool _loading = true;
  bool _busy = false;
  bool _createHidden = false;
  String? _newChapterError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _autosave.addListener(_onAutosave);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autosave.removeListener(_onAutosave);
    // Last chance to store pending text (the pop guard has usually flushed).
    unawaited(_autosave.flush().catchError((Object _) {}).whenComplete(_autosave.dispose));
    _newChapter.dispose();
    super.dispose();
  }

  void _onAutosave() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Leaving the app or coming back (possibly online again): flush.
    if (state == AppLifecycleState.paused || state == AppLifecycleState.resumed) {
      unawaited(_autosave.flush().catchError((Object _) {}));
    }
  }

  Future<void> _load() async {
    try {
      final data = await _services.api.run(_dashboardQuery, variables: {'id': widget.bookId});
      final raw = jsonMap(data['getBookById']);
      if (!mounted) return;
      final book = raw == null ? null : Book.fromJson(raw);
      setState(() {
        _book = book;
        _loading = false;
        _error = raw == null ? ApiException(ApiErrorKind.notFound, 'Kitap bulunamadı.') : null;
      });
      if (book != null) {
        _autosave.load([
          for (final chapter in book.chapters)
            ChapterDraft(
              id: chapter.id,
              title: chapter.title,
              content: chapter.content,
              isHidden: chapter.isHidden,
              pageCount: chapter.pageCount,
              wordCount: chapter.wordCount,
            ),
        ]);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    }
  }

  /// The page count is a client-computed contract value: the exact port of
  /// the website's splitter is applied to the HTML that is being saved.
  Future<void> _saveChapter(ChapterDraft draft, String content) async {
    final data = await _services.api.run(
      _updateChapterMutation,
      variables: {'chapterId': draft.id, 'content': content, 'pageCount': computePageCount(content)},
    );
    final saved = jsonMap(data['updateChapter']);
    if (saved != null) {
      draft.pageCount = jsonInt(saved['pageCount'], draft.pageCount);
      if (saved['wordCount'] is num) draft.wordCount = jsonInt(saved['wordCount']);
    }
  }

  /// Every action first stores pending text; while it runs the editor is
  /// read-only (web `runAfterSaving`).
  Future<void> _runAfterSaving(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await _autosave.flush();
      await action();
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addChapter() async {
    final title = _newChapter.text.trim();
    if (title.isEmpty) {
      // The website ignores an empty title silently (Stage 2 B-12).
      setState(() => _newChapterError = 'Bölüm başlığı zorunludur.');
      return;
    }
    setState(() => _newChapterError = null);
    await _runAfterSaving(() async {
      final data = await _services.api.run(
        r'''mutation CreateChapter($bookId: ID!, $title: String!, $content: String!, $pageCount: Int, $isHidden: Boolean) {
          createChapter(bookId: $bookId, title: $title, content: $content, pageCount: $pageCount, isHidden: $isHidden) { id title }
        }''',
        variables: {'bookId': widget.bookId, 'title': title, 'content': '', 'pageCount': 0, 'isHidden': _createHidden},
      );
      _newChapter.clear();
      await _load();
      final id = jsonMap(data['createChapter'])?['id'];
      // Open the new chapter right away (the website leaves it unselected).
      if (id is String) _autosave.select(id);
      if (mounted && (_scaffoldKey.currentState?.isDrawerOpen ?? false)) Navigator.of(context).pop();
    });
  }

  Future<void> _deleteChapter(ChapterDraft chapter) async {
    if (!await confirm(context, 'Bu bölümü silmek istediğinize emin misiniz?', confirmLabel: 'Sil', destructive: true)) return;
    await _runAfterSaving(() async {
      await _services.api.run(
        r'mutation DeleteChapter($id: ID!) { deleteChapter(id: $id) { code message } }',
        variables: {'id': chapter.id},
      );
      _autosave.remove(chapter.id);
      if (mounted) showToast(context, 'Bölüm silindi', type: ToastType.success);
      await _load();
    });
  }

  Future<void> _setHidden(ChapterDraft chapter, bool hidden) => _runAfterSaving(() async {
    await _services.api.run(
      r'mutation SetChapterVisibility($chapterId: ID!, $isHidden: Boolean) { updateChapter(chapterId: $chapterId, isHidden: $isHidden) { id isHidden } }',
      variables: {'chapterId': chapter.id, 'isHidden': hidden},
    );
    await _load();
  });

  Future<void> _setStatus(String status, String question) async {
    if (!await confirm(context, question)) return;
    await _runAfterSaving(() async {
      await _services.api.run(updateBookStatusMutation, variables: {'bookId': widget.bookId, 'status': status});
      _services.invalidateData();
      await _load();
    });
  }

  Future<void> _manualSave() async {
    try {
      await _autosave.flush();
      if (mounted) showToast(context, 'Kaydedildi!', type: ToastType.success);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  /// Leaving with unsaved text: save first; if that fails ask.
  Future<bool> _confirmLeave() async {
    if (!_autosave.hasUnsaved) return true;
    try {
      await _autosave.flush();
      return true;
    } catch (_) {
      if (!mounted) return true;
      return confirm(
        context,
        'Değişiklikler kaydedilemedi. Kaydetmeden ayrılmak istiyor musunuz?',
        confirmLabel: 'Ayrıl',
        destructive: true,
      );
    }
  }

  Future<void> _leave(VoidCallback navigate) async {
    if (await _confirmLeave() && mounted) navigate();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const PageScaffold(
        title: 'Yazı Masası',
        body: LoadingView(label: 'Kitap yükleniyor…'),
      );
    }
    final book = _book;
    final me = _services.auth.user;
    if (book == null) {
      // Another author's draft resolves to null; the website stays on
      // "Kitap yükleniyor…" forever (Stage 2 B-04).
      return PageScaffold(
        title: 'Yazı Masası',
        body: ErrorView(
          title: _error is ApiException && (_error as ApiException).kind == ApiErrorKind.notFound
              ? 'Kitap bulunamadı'
              : 'Kitap yüklenemedi',
          message: errorMessage(_error ?? ''),
          onRetry: () {
            setState(() => _loading = true);
            _load();
          },
        ),
      );
    }
    final isAuthor = me != null && book.authorId == me.id;
    final allowed = book.isPrinted ? (book.canEditContent || (me?.isAdmin ?? false)) : (isAuthor || (me?.isAdmin ?? false));
    if (!allowed) {
      // The website opens the full authoring interface for any member and
      // lets every save fail (Stage 2 B-03). The app does not expose it.
      return PageScaffold(
        title: 'Yazı Masası',
        body: EmptyView(
          icon: Icons.lock_outline,
          title: book.isPrinted
              ? 'Bu kitaba içerik eklemek için yazar hak talebinizin onaylanması gerekir.'
              : 'Bu kitabın yazı masasına erişim yetkiniz yok.',
          action: OutlinedButton(onPressed: () => context.pushReplacement('/book/${book.id}'), child: const Text('KİTABA DÖN')),
        ),
      );
    }

    final selected = _autosave.selected;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave(() => Navigator.of(context).pop());
      },
      child: Scaffold(
        key: _scaffoldKey,
        resizeToAvoidBottomInset: true,
        appBar: AppBar(
          leading: IconButton(tooltip: 'Bölümler', icon: const Icon(Icons.menu), onPressed: () => _scaffoldKey.currentState?.openDrawer()),
          title: Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: Center(child: _SaveBadge(_autosave.status)),
            ),
          ],
        ),
        drawer: _drawer(book),
        body: SafeArea(
          top: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!book.isPrinted) _publishBar(book, isAuthor),
              if (selected == null)
                Expanded(
                  child: EmptyView(
                    title: 'HOŞGELDİNİZ',
                    subtitle: 'Düzenlemek için bir bölüm seçin veya yeni bir bölüm oluşturun.',
                    action: OutlinedButton(
                      onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                      child: Text('BÖLÜMLER (${_autosave.chapters.length})'),
                    ),
                  ),
                )
              else ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 6, 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${selected.title}${selected.isHidden ? ' · Gizli' : ''}',
                          style: serif(size: 17, weight: FontWeight.w700),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      PopupMenuButton<String>(
                        tooltip: 'Bölüm işlemleri',
                        onSelected: (value) {
                          if (value == 'hide') _setHidden(selected, !selected.isHidden);
                          if (value == 'share') {
                            _runAfterSaving(() async {
                              if (mounted) await showShareSheet(context, type: 'CHAPTER', id: selected.id);
                            });
                          }
                        },
                        itemBuilder: (_) => [
                          PopupMenuItem(value: 'hide', child: Text(selected.isHidden ? 'Okuyuculara aç' : 'Okuyuculardan gizle')),
                          if (!book.isDraft && !selected.isHidden) const PopupMenuItem(value: 'share', child: Text('Bölümü paylaş')),
                        ],
                      ),
                      FilledButton(onPressed: _busy ? null : _manualSave, child: const Text('KAYDET')),
                      const SizedBox(width: 6),
                    ],
                  ),
                ),
                Expanded(
                  child: ChapterEditor(
                    key: ValueKey(selected.id),
                    initialHtml: selected.content,
                    readOnly: _busy,
                    onChanged: _autosave.edit,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _publishBar(Book book, bool isAuthor) {
    final hasText = _autosave.chapters.any((chapter) => hasChapterContent(chapter.content));
    final headline = book.isDraft ? 'Taslak' : (book.isCompleted ? 'Kitabınızın yazımı tamamlandı' : 'Kitabınız okuyuculara açık');
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      decoration: const BoxDecoration(
        color: BetikColors.infoBg,
        border: Border(bottom: BorderSide(color: BetikColors.borderMedium)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            headline,
            style: sans(size: 13.5, weight: FontWeight.w700, color: BetikColors.info),
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              if (book.isDraft)
                OutlinedButton(
                  onPressed: hasText && !_busy ? () => _setStatus('WRITING', 'Kitap herkese görünür olacak. Onaylıyor musunuz?') : null,
                  child: const Text('YAYINLA (GÖRÜNÜR YAP)'),
                )
              else ...[
                OutlinedButton(
                  onPressed: _busy ? null : () => _setStatus('DRAFT', 'Kitap yayından kaldırılıp taslağa çekilecek. Onaylıyor musunuz?'),
                  child: const Text('TASLAĞA ÇEK'),
                ),
                if (!book.isCompleted)
                  OutlinedButton(
                    onPressed: _busy ? null : () => _setStatus('COMPLETED', 'Kitabın yazım aşamasını bitirdiniz mi?'),
                    child: const Text('YAZIMI TAMAMLA'),
                  )
                else if (isAuthor)
                  OutlinedButton(
                    onPressed: () => _leave(() => context.push('/print/${book.id}')),
                    child: const Text('DESTEK FONU İÇİN BAŞVUR / BAŞVURUMU GÖR'),
                  ),
              ],
            ],
          ),
          if (book.isDraft && !hasText)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text('Yayınlamak için en az bir bölüme metin ekleyin.', style: sans(size: 12.5, color: BetikColors.graphite)),
            ),
        ],
      ),
    );
  }

  Widget _drawer(Book book) => Drawer(
    width: 330,
    child: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              BookCover(book.imageUrl, width: 64),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(book.title, style: serif(size: 17, weight: FontWeight.w700)),
                    Text('${_autosave.chapters.length} Bölüm', style: sans(size: 13, color: BetikColors.ashGray)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClassificationEditor(book: book, onSaved: _load),
          const SizedBox(height: 6),
          OutlinedButton.icon(
            onPressed: () => _leave(() {
              Navigator.of(context).pop();
              context.push('/reader/${book.id}');
            }),
            icon: const Icon(Icons.auto_stories, size: 18),
            label: const Text('OKUYUCU MODU'),
          ),
          const SizedBox(height: 6),
          OutlinedButton.icon(
            onPressed: () => _leave(() => context.go('/profile')),
            icon: const Icon(Icons.person_outline, size: 18),
            label: const Text('PROFİLE DÖN'),
          ),
          const Divider(height: 28),
          TextField(
            controller: _newChapter,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(hintText: 'Yeni bölüm başlığı', errorText: _newChapterError),
            onSubmitted: (_) => _addChapter(),
          ),
          CheckboxListTile(
            value: _createHidden,
            onChanged: (value) => setState(() => _createHidden = value ?? false),
            title: const Text('Yeni bölümü gizli oluştur'),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            dense: true,
          ),
          FilledButton(onPressed: _busy ? null : _addChapter, child: const Text('EKLE')),
          const SizedBox(height: 12),
          for (final chapter in _autosave.chapters)
            ListTile(
              contentPadding: EdgeInsets.zero,
              selected: chapter.id == _autosave.selectedId,
              selectedTileColor: BetikColors.infoBg,
              title: Text('${chapter.title}${chapter.isHidden ? ' · Gizli' : ''}'),
              subtitle: chapter.wordCount == null ? null : Text('${chapter.wordCount} kelime · ${chapter.pageCount} sayfa'),
              onTap: () => _runAfterSaving(() async {
                _autosave.select(chapter.id);
                if (mounted) Navigator.of(context).pop();
              }),
              trailing: IconButton(
                tooltip: 'Bölümü sil',
                icon: const Icon(Icons.delete_outline, color: BetikColors.danger, size: 20),
                onPressed: _busy ? null : () => _deleteChapter(chapter),
              ),
            ),
        ],
      ),
    ),
  );
}

class _SaveBadge extends StatelessWidget {
  const _SaveBadge(this.status);
  final AutosaveStatus status;

  @override
  Widget build(BuildContext context) {
    final (text, color) = switch (status) {
      AutosaveStatus.saved => ('KAYDEDİLDİ', BetikColors.success),
      AutosaveStatus.saving => ('KAYDEDİLİYOR…', BetikColors.graphite),
      AutosaveStatus.pending => ('OTOMATİK KAYIT BEKLENİYOR…', BetikColors.graphite),
      AutosaveStatus.error => ('KAYDEDİLEMEDİ — KAYDET İLE TEKRAR DENEYİN.', BetikColors.danger),
    };
    return Container(
      constraints: const BoxConstraints(maxWidth: 150),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        border: Border.all(color: color),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: sans(size: 9.5, weight: FontWeight.w700, color: color),
        textAlign: TextAlign.center,
      ),
    );
  }
}
