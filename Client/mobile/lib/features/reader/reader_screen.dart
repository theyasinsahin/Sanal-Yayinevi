import 'dart:async';

import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/richtext/paragraphs.dart';
import '../../core/richtext/rich_text.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../share/share_sheet.dart';
import 'html_view.dart';
import 'reader_progress.dart';
import 'reader_widgets.dart';
import 'reading_tracker.dart';

const _readerDataQuery =
    '''
query GetBookReaderData(\$id: ID!) {
  getBookById(id: \$id) {
    publicPath id kind status digitalStatus publicationStatus title authorId
    author { id username fullName }
    chapters { id title pageCount wordCount isHidden canReadContent accessStatus publicPath }
    $classificationFields
  }
}''';

const _readingChapterQuery = r'''
query GetReadingChapter($bookId: ID!, $chapterId: ID!) {
  getReadingChapter(bookId: $bookId, chapterId: $chapterId) { id title content isHidden canReadContent accessStatus wordCount pageCount }
}''';

const _bookmarkFields = 'id bookId chapterId chapterIndex paragraphIndex chapterTitle';

/// The notice that replaces copied reader text on the website
/// (`BookReader` copy handler); the app's "Kopyala" action copies the same
/// text instead of the selection.
String copyProtectionNotice({required String title, required String url}) =>
    'Kitap: $title\nLink: $url\n\n* Bu platformdaki kitap içeriklerinin doğrudan kopyalanması telif hakları gereği sınırlandırılmıştır. Lütfen alıntı yapma özelliğini kullanınız.';

/// Label of the primary button under a chapter (F-READ-03).
/// Label of the "next" button — the website's rule (`BookReader`), which
/// looks at the **current** chapter: a gated chapter offers sign-up, a
/// locked (hidden/unavailable) chapter still lets the reader move on, and a
/// readable one is completed on the way.
String nextButtonLabel({required Chapter current, required bool hasNext, required bool completed}) {
  if (current.registrationRequired) return 'Ücretsiz üyelikle oku';
  if (!current.canReadContent) return hasNext ? 'Sonraki Bölüm' : 'Okuyuculara kapalı';
  if (!hasNext) return completed ? '✦ Tamamlandı' : 'Tamamla';
  return completed ? 'Sonraki Bölüm' : 'Tamamla ve Devam Et';
}

/// Website: `disabled={isLastChapter && !registrationRequired && (locked || completed)}`.
bool nextButtonDisabled({required Chapter current, required bool hasNext, required bool completed}) =>
    !hasNext && !current.registrationRequired && (!current.canReadContent || completed);

class ReaderScreen extends StatefulWidget {
  const ReaderScreen({super.key, required this.bookId, this.chapterId, this.paragraph, this.focusCommentId});
  final String bookId;

  /// Chapter requested by a link (share link, notification).
  final String? chapterId;

  /// Paragraph whose comment panel opens automatically.
  final int? paragraph;
  final String? focusCommentId;

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> with WidgetsBindingObserver {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _scroll = ScrollController();
  final _scrollProgress = ValueNotifier<double>(0);
  final Map<int, GlobalKey> _paragraphKeys = {};

  late final AppServices _services = context.services;

  Book? _book;
  Object? _bookError;
  List<Chapter> _chapters = const [];
  Bookmark? _bookmark;
  int _index = 0;
  Set<String> _completed = {};
  bool _missingSharedChapter = false;
  bool _progressFallback = false;

  Chapter? _chapter;
  Object? _chapterError;
  bool _chapterLoading = false;
  List<ChapterSegment> _segments = const [];
  String _chapterPlainText = '';
  Map<int, int> _counts = {};
  int? _openPanel;
  int? _restoreParagraph;
  bool _showHelp = true;
  String _selectedText = '';

  ProgressWriter? _writer;
  ProgressSyncStatus _sync = ProgressSyncStatus.saved;
  Timer? _progressDebounce;

  ReadingTracker? _tracker;
  ReadingStatus _reading = ReadingStatus.inactive;
  Timer? _tickTimer;
  Timer? _reportTimer;
  bool _idleWarning = false;
  bool _foreground = true;
  int _chapterGeneration = 0;

  String? get _userId => _services.auth.userId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _services.auth.sessionEpoch.addListener(_onSessionChanged);
  }

  String _location = '';
  bool _disposed = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Router state is an inherited widget: it may not be read in initState.
    _location = GoRouterState.of(context).uri.toString();
    if (!_started) {
      _started = true;
      _loadBook(countView: true);
    }
  }

  @override
  void dispose() {
    // Callbacks from the final flushes below must not touch the widget.
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _services.auth.sessionEpoch.removeListener(_onSessionChanged);
    _progressDebounce?.cancel();
    // Leaving the reader: send what is still unsent.
    unawaited(_writer?.flush());
    _stopTracker();
    _scroll.dispose();
    _scrollProgress.dispose();
    super.dispose();
  }

  void _onSessionChanged() {
    _stopTracker();
    _loadBook();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final tracker = _tracker;
    if (state == AppLifecycleState.resumed) {
      _foreground = true;
      tracker?.tick(false);
      tracker?.activity();
      unawaited(tracker?.flush());
      // Back online or back in the app: retry a failed progress sync.
      unawaited(_writer?.flush());
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _foreground = false;
      tracker?.tick(false);
      unawaited(tracker?.flush(closing: true));
      unawaited(_writer?.flush());
    }
  }

  // --- Loading ----------------------------------------------------------

  Future<void> _loadBook({bool countView = false}) async {
    setState(() => _bookError = null);
    final api = _services.api;
    final location = _location;
    try {
      final data = await api.run(_readerDataQuery, variables: {'id': widget.bookId});
      final raw = jsonMap(data['getBookById']);
      if (raw == null) throw ApiException(ApiErrorKind.notFound, 'Kitap bulunamadı.');
      final book = Book.fromJson(raw);

      // One view per reader mount, like the website (no server de-dup).
      if (countView) {
        unawaited(
          api
              .run(
                r'mutation IncrementBookViews($id: ID!) { incrementBookViews(id: $id) { id stats { views } } }',
                variables: {'id': widget.bookId},
              )
              .then<void>((_) {}, onError: (Object _) {}),
        );
      }

      Bookmark? bookmark;
      Json? serverProgress;
      var fallback = false;
      final userId = _userId;
      if (userId != null) {
        // A guest who signed up from the reader keeps the progress made
        // before registering.
        final intent = _services.intents.consume('read', location);
        if (intent != null) await migrateGuestProgress(_services.local, widget.bookId, userId);
        try {
          final extra = await api.run(
            'query ReaderState(\$bookId: ID!) { getBookmark(bookId: \$bookId) { $_bookmarkFields } getReadingProgress(bookId: \$bookId) { id lastChapterId completedChapters lastReadAt isCompleted } }',
            variables: {'bookId': widget.bookId},
          );
          bookmark = Bookmark.maybe(extra['getBookmark']);
          serverProgress = jsonMap(extra['getReadingProgress']);
        } on ApiException {
          // The local record still gives a starting point; nothing is
          // written to the server until the state was read successfully or
          // the reader changes it.
          fallback = true;
        }
      }
      if (!mounted) return;
      final resolved = resolveReaderProgress(
        chapters: book.chapters,
        bookmark: bookmark,
        local: readLocalProgress(_services.local, widget.bookId, userId),
        server: serverProgress,
        requestedChapterId: widget.chapterId,
      );
      _writer = userId == null ? null : ProgressWriter(save: _saveProgress, onStatus: _onSyncStatus);
      setState(() {
        _book = book;
        _chapters = book.chapters;
        _bookmark = bookmark;
        _completed = resolved.completedChapterIds.toSet();
        _missingSharedChapter = resolved.missingSharedChapter;
        _progressFallback = fallback;
        final index = _chapters.indexWhere((chapter) => chapter.id == resolved.chapterId);
        _index = index < 0 ? 0 : index;
        _restoreParagraph = resolved.paragraphIndex;
        _openPanel = widget.paragraph != null && resolved.source == 'link' ? widget.paragraph : null;
      });
      if (!fallback) _persistProgress(dirty: false);
      await _loadChapter();
    } catch (error) {
      if (mounted) setState(() => _bookError = error);
    }
  }

  Future<void> _loadChapter() async {
    if (_chapters.isEmpty) return;
    final generation = ++_chapterGeneration;
    final target = _chapters[_index];
    _stopTracker();
    setState(() {
      _chapterLoading = true;
      _chapterError = null;
      _selectedText = '';
    });
    try {
      final data = await _services.api.run(_readingChapterQuery, variables: {'bookId': widget.bookId, 'chapterId': target.id});
      if (!mounted || generation != _chapterGeneration) return;
      final raw = jsonMap(data['getReadingChapter']);
      final chapter = raw == null
          ? Chapter(id: target.id, title: target.title, accessStatus: 'UNAVAILABLE', canReadContent: false)
          : Chapter.fromJson(raw);
      final segments = chapter.accessStatus == 'READABLE' ? segmentChapter(chapter.content) : const <ChapterSegment>[];
      _paragraphKeys
        ..clear()
        ..addEntries(segments.where((s) => s.isParagraph).map((s) => MapEntry(s.paragraphIndex!, GlobalKey())));
      setState(() {
        _chapter = chapter;
        _segments = segments;
        _chapterPlainText = plainTextOf(chapter.content);
        _counts = {};
        _chapterLoading = false;
      });
      _scrollProgress.value = 0;
      if (_scroll.hasClients) _scroll.jumpTo(0);
      unawaited(_loadCounts());
      _restoreScrollPosition();
      _startTrackerIfEligible();
    } catch (error) {
      if (!mounted || generation != _chapterGeneration) return;
      setState(() {
        _chapterError = error;
        _chapterLoading = false;
      });
    }
  }

  Future<void> _loadCounts() async {
    final chapter = _chapter;
    if (chapter == null || chapter.accessStatus != 'READABLE') return;
    try {
      final data = await _services.api.run(
        r'query GetParagraphCommentCounts($chapterId: ID!) { getParagraphCommentCounts(chapterId: $chapterId) { paragraphIndex count } }',
        variables: {'chapterId': chapter.id},
      );
      if (!mounted || _chapter?.id != chapter.id) return;
      setState(
        () => _counts = {
          for (final item in jsonList(data['getParagraphCommentCounts'])) jsonInt(item['paragraphIndex']): jsonInt(item['count']),
        },
      );
    } on ApiException {
      // Counts are decoration; the panels still load their own lists.
    }
  }

  /// Bookmark resume and notification links scroll to a paragraph; plain
  /// resume starts at the top of the chapter (the server stores no scroll
  /// offset).
  void _restoreScrollPosition() {
    final paragraphs = _paragraphKeys.length;
    final wanted = _restoreParagraph ?? _openPanel;
    if (wanted == null || paragraphs == 0) return;
    final index = wanted.clamp(0, paragraphs - 1);
    _restoreParagraph = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _paragraphKeys[index]?.currentContext;
      if (target != null) Scrollable.ensureVisible(target, alignment: 0.05);
    });
  }

  // --- Progress ---------------------------------------------------------

  void _onSyncStatus(ProgressSyncStatus status) {
    if (!_disposed && mounted && status != _sync) setState(() => _sync = status);
  }

  Future<void> _saveProgress(Json variables) async {
    final data = await _services.api.run(saveReadingProgressMutation, variables: variables).timeout(const Duration(seconds: 10));
    final progress = jsonMap(data['saveReadingProgress']);
    if (progress == null) throw ApiException(ApiErrorKind.server, 'İlerleme kaydedilemedi.');
    // Clear the pending flag only if nothing changed while the request ran.
    final local = readLocalProgress(_services.local, widget.bookId, _userId);
    final sent = (variables['completedChapterIds'] as List).join(',');
    if (local != null && local['lastChapterId'] == variables['chapterId'] && jsonIds(local['completedChapterIds']).join(',') == sent) {
      await writeLocalProgress(
        _services.local,
        widget.bookId,
        _userId,
        chapterId: variables['chapterId'] as String,
        completedChapterIds: jsonIds(local['completedChapterIds']),
        pending: false,
        now: parseApiDate(progress['lastReadAt']),
      );
    }
  }

  List<String> get _completedIds => [
    for (final chapter in _chapters)
      if (chapter.canReadContent && _completed.contains(chapter.id)) chapter.id,
  ];

  /// Every change goes to local storage first, then (debounced 250 ms) to
  /// the server. Guests keep the local record only.
  void _persistProgress({bool dirty = true}) {
    if (_chapters.isEmpty) return;
    if (dirty) _progressFallback = false;
    final chapterId = _chapters[_index].id;
    final completed = _completedIds;
    unawaited(
      writeLocalProgress(
        _services.local,
        widget.bookId,
        _userId,
        chapterId: chapterId,
        completedChapterIds: completed,
        pending: _userId != null,
      ),
    );
    final writer = _writer;
    if (writer == null) return;
    writer.enqueue({'bookId': widget.bookId, 'chapterId': chapterId, 'completedChapterIds': completed});
    _progressDebounce?.cancel();
    _progressDebounce = Timer(const Duration(milliseconds: 250), writer.flush);
  }

  Future<void> _retrySync() async {
    if (_progressFallback) {
      await _loadBook();
    } else {
      await _writer?.flush();
    }
  }

  void _goTo(int index) {
    if (index < 0 || index >= _chapters.length) return;
    final target = _chapters[index];
    if (target.registrationRequired && !_services.auth.isSignedIn) {
      requireMember(context, 'read', bookTitle: _book?.title);
      return;
    }
    setState(() {
      _index = index;
      _openPanel = null;
      _restoreParagraph = null;
    });
    _persistProgress();
    _loadChapter();
  }

  void _toggleCompleted(Chapter chapter) {
    if (!chapter.canReadContent) return;
    setState(() => _completed.contains(chapter.id) ? _completed.remove(chapter.id) : _completed.add(chapter.id));
    _persistProgress();
  }

  /// The chapter as the reader currently knows it (the loaded copy carries
  /// the latest access state).
  Chapter get _currentChapter {
    final listed = _chapters[_index];
    final loaded = _chapter;
    return loaded != null && loaded.id == listed.id ? loaded : listed;
  }

  void _advance() {
    final hasNext = _index < _chapters.length - 1;
    final current = _currentChapter;
    if (current.registrationRequired) {
      requireMember(context, 'read', bookTitle: _book?.title);
      return;
    }
    if (current.canReadContent && !_completed.contains(current.id)) {
      setState(() => _completed.add(current.id));
      if (!hasNext) _persistProgress();
    }
    if (hasNext) _goTo(_index + 1);
  }

  // --- Reading time -----------------------------------------------------

  void _startTrackerIfEligible() {
    final book = _book;
    final chapter = _chapter;
    if (book == null || chapter == null || _userId == null) return;
    final eligible =
        chapter.accessStatus == 'READABLE' &&
        !book.isDraft &&
        (!book.isPrinted || book.publicationStatus == 'APPROVED') &&
        _chapterPlainText.trim().isNotEmpty;
    if (!eligible) return;
    final tracker = createReadingTracker(
      services: _services,
      bookId: widget.bookId,
      chapter: () => _chapters[_index].id,
      onStatus: (status) {
        if (!_disposed && mounted && status != _reading) setState(() => _reading = status);
      },
    );
    _tracker = tracker;
    unawaited(tracker.flush());
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      tracker.tick(_foreground);
      // 90 s without interaction: warn; tracking itself stops at 120 s.
      if (_foreground && !_idleWarning && tracker.idleMs >= 90000 && mounted) setState(() => _idleWarning = true);
    });
    _reportTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_foreground) unawaited(tracker.flush());
    });
  }

  void _stopTracker() {
    _tickTimer?.cancel();
    _reportTimer?.cancel();
    final tracker = _tracker;
    _tracker = null;
    if (tracker != null) unawaited(tracker.stop());
    _reading = ReadingStatus.inactive;
    _idleWarning = false;
  }

  void _activity() {
    _tracker?.activity();
    if (_idleWarning) setState(() => _idleWarning = false);
  }

  // --- Bookmark ---------------------------------------------------------

  Future<void> _setBookmark(int paragraphIndex) async {
    if (!requireMember(context, 'bookmark', bookTitle: _book?.title)) return;
    final chapter = _chapters[_index];
    final previous = _bookmark;
    setState(
      () => _bookmark = Bookmark(chapterId: chapter.id, chapterIndex: _index, paragraphIndex: paragraphIndex, chapterTitle: chapter.title),
    );
    try {
      await _services.api.run(
        'mutation SetBookmark(\$bookId: ID!, \$chapterId: ID!, \$chapterIndex: Int!, \$paragraphIndex: Int!, \$chapterTitle: String) { setBookmark(bookId: \$bookId, chapterId: \$chapterId, chapterIndex: \$chapterIndex, paragraphIndex: \$paragraphIndex, chapterTitle: \$chapterTitle) { $_bookmarkFields } }',
        variables: {
          'bookId': widget.bookId,
          'chapterId': chapter.id,
          'chapterIndex': _index,
          'paragraphIndex': paragraphIndex,
          'chapterTitle': chapter.title,
        },
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _bookmark = previous);
      showToast(context, 'Ayraç kaydedilemedi. Lütfen tekrar deneyin.', type: ToastType.error);
    }
  }

  Future<void> _removeBookmark() async {
    final previous = _bookmark;
    setState(() => _bookmark = null);
    try {
      await _services.api.run(
        r'mutation RemoveBookmark($bookId: ID!) { removeBookmark(bookId: $bookId) { code message } }',
        variables: {'bookId': widget.bookId},
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _bookmark = previous);
      showToast(context, 'Ayraç kaldırılamadı. Lütfen tekrar deneyin.', type: ToastType.error);
    }
  }

  // --- Quote by selection -----------------------------------------------

  void _quoteSelection() {
    final text = _selectedText.trim();
    if (text.length < 10) {
      showToast(context, 'Alıntı için en az 10 karakter seçin.');
      return;
    }
    if (text.length > 1000) {
      showToast(context, 'En fazla 1000 karakter seçebilirsiniz. Seçimi kısaltın.', type: ToastType.error);
      return;
    }
    // On the website a guest still gets the quote form (Stage 2 B-06); the
    // app asks to sign in first and keeps the selection as the draft.
    if (!requireMember(context, 'quote', bookTitle: _book?.title, draft: text)) return;
    final chapter = _chapters[_index];
    final offset = _chapterPlainText.indexOf(text);
    showQuoteSheet(
      context,
      text: text,
      bookId: widget.bookId,
      bookTitle: _book?.title ?? '',
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterIndex: _index,
      startOffset: offset < 0 ? null : offset,
    );
  }

  Future<void> _copyNotice() async {
    final book = _book;
    final web = _services.config.webUrl;
    await Clipboard.setData(
      ClipboardData(
        text: copyProtectionNotice(
          title: book?.title ?? 'Bilinmeyen Kitap',
          url: '$web${book?.publicPath ?? '/book-detail/${widget.bookId}'}',
        ),
      ),
    );
    if (mounted) showToast(context, 'Kitap bağlantısı kopyalandı. Metni paylaşmak için alıntı özelliğini kullanın.');
  }

  // --- UI ---------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final book = _book;
    if (_bookError != null) {
      final notFound = _bookError is ApiException && (_bookError as ApiException).kind == ApiErrorKind.notFound;
      return Scaffold(
        appBar: AppBar(),
        body: ErrorView(
          title: notFound ? 'Kitap bulunamadı' : 'Kitap yüklenemedi.',
          message: errorMessage(_bookError!),
          onRetry: notFound ? null : () => _loadBook(),
          retryLabel: 'Tekrar dene',
        ),
      );
    }
    if (book == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const LoadingView(label: 'Kitabınız hazırlanıyor...'),
      );
    }
    if (_chapters.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(book.title)),
        body: EmptyView(
          title: 'Bu kitapta henüz okunabilir bölüm yok.',
          action: OutlinedButton(onPressed: () => context.pop(), child: const Text('KİTAP DETAYINA DÖN')),
        ),
      );
    }
    final fontSize = context.watch<ReadingPreferences>().fontSize;
    final current = _chapters[_index];
    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        title: Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Alıntı nasıl eklenir?',
            icon: const Icon(Icons.help_outline),
            onPressed: () => setState(() => _showHelp = !_showHelp),
          ),
          TextButton(onPressed: () => _scaffoldKey.currentState?.openEndDrawer(), child: Text('Bölümler (${_chapters.length})')),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: ValueListenableBuilder<double>(
            valueListenable: _scrollProgress,
            builder: (_, value, _) => LinearProgressIndicator(value: value, minHeight: 3, color: BetikColors.bookmark),
          ),
        ),
      ),
      endDrawer: _ChapterDrawer(
        book: book,
        chapters: _chapters,
        currentIndex: _index,
        completed: _completed,
        showHidden: _userId != null && (book.authorId == _userId || (_services.auth.user?.isAdmin ?? false)),
        onSelect: (index) {
          Navigator.of(context).pop();
          _goTo(index);
        },
        onToggle: _toggleCompleted,
      ),
      body: Listener(
        onPointerDown: (_) => _activity(),
        child: NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (notification.metrics.axis == Axis.vertical && notification.depth == 0) {
              final max = notification.metrics.maxScrollExtent;
              _scrollProgress.value = max <= 0 ? 0 : (notification.metrics.pixels / max).clamp(0, 1).toDouble();
              _tracker?.activity();
            }
            return false;
          },
          child: SingleChildScrollView(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 40),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ..._banners(),
                if (_showHelp) _HelpCard(guest: _userId == null, onClose: () => setState(() => _showHelp = false)),
                const SizedBox(height: 10),
                Text(
                  'Bölüm ${_index + 1} / ${_chapters.length}',
                  textAlign: TextAlign.center,
                  style: serif(size: 15, color: BetikColors.graphite),
                ),
                const SizedBox(height: 4),
                Text(
                  current.title,
                  textAlign: TextAlign.center,
                  style: serif(size: 24, weight: FontWeight.w700, height: 1.25),
                ),
                if (current.isHidden)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Center(child: const TagChip('Okuyuculara kapalı', dark: true)),
                  ),
                const SizedBox(height: 10),
                if (!current.isHidden && !book.isDraft && current.canReadContent)
                  Center(
                    child: OutlinedButton.icon(
                      onPressed: () => showShareSheet(context, type: 'CHAPTER', id: current.id),
                      icon: const Icon(Icons.ios_share, size: 18),
                      label: const Text('BÖLÜMÜ PAYLAŞ'),
                    ),
                  ),
                const OrnamentDivider(),
                _chapterBody(book, fontSize),
                const SizedBox(height: 20),
                _navigation(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _banners() => [
    if (_missingSharedChapter) const _Banner('Paylaşılan bölüm bulunamadı. Kitabın ilk okunabilir bölümü açıldı.'),
    if (_sync == ProgressSyncStatus.error || _progressFallback)
      _Banner('Okuma ilerlemesi eşitlenemedi. Bu cihazdaki kayıt korunuyor.', action: 'Tekrar dene', onAction: _retrySync),
    if (_reading == ReadingStatus.paused)
      const _Banner('Okuma puanı takibi diğer açık okuyucuya geçti. Burada devam etmek için okuyucuyu yeniden açabilirsiniz.'),
    if (_reading == ReadingStatus.error)
      const _Banner('Okuma puanı kaydedilemiyor. Bağlantınız geldiğinde tekrar denenecek; doğrulanamayan süre puanlandırılmaz.'),
    if (_idleWarning)
      _Banner('⏸️ Hareketsiz görünüyorsun. Okuma süresi sayımı birazdan duracak.', action: 'Devam Et', onAction: () async => _activity()),
  ];

  Widget _chapterBody(Book book, double fontSize) {
    if (_chapterLoading) return const Padding(padding: EdgeInsets.all(40), child: LoadingView());
    if (_chapterError != null) {
      return ErrorView(
        title: 'Bölüm yüklenemedi.',
        message: errorMessage(_chapterError!),
        onRetry: _loadChapter,
        retryLabel: 'Tekrar dene',
      );
    }
    final chapter = _chapter;
    if (chapter == null) return const SizedBox.shrink();
    switch (chapter.accessStatus) {
      case 'REGISTRATION_REQUIRED':
        // Guests read the first open chapter only (server gate).
        final firstOpen = _chapters.indexWhere((c) => c.canReadContent);
        return PaperCard(
          child: RegistrationCard(
            intent: RegistrationIntent(action: 'read', returnTo: GoRouterState.of(context).uri.toString(), bookTitle: book.title),
            trailing: Column(
              children: [
                if (firstOpen >= 0 && firstOpen != _index)
                  TextButton(onPressed: () => _goTo(firstOpen), child: const Text('İlk açık bölümü oku')),
                TextButton(onPressed: () => context.pop(), child: const Text('Kitap detayına dön')),
              ],
            ),
          ),
        );
      case 'HIDDEN':
        return const EmptyView(
          icon: Icons.visibility_off_outlined,
          title: 'Gizli bölüm',
          subtitle: 'Bu bölüm yazarı tarafından okuyuculara kapatılmış.',
        );
      case 'UNAVAILABLE':
        return const EmptyView(title: 'Bu bölüm artık erişilebilir değil.', subtitle: 'Bölüm kaldırılmış veya taşınmış olabilir.');
    }
    if (_segments.isEmpty) {
      return const EmptyView(title: 'Bu bölümde henüz metin yok.');
    }
    final signedIn = _userId != null;
    return SelectionArea(
      onSelectionChanged: (content) => _selectedText = content?.plainText ?? '',
      contextMenuBuilder: (context, selectable) => AdaptiveTextSelectionToolbar.buttonItems(
        anchors: selectable.contextMenuAnchors,
        buttonItems: [
          ContextMenuButtonItem(
            label: 'Alıntıla',
            onPressed: () {
              ContextMenuController.removeAny();
              _quoteSelection();
            },
          ),
          ContextMenuButtonItem(
            label: 'Kopyala',
            onPressed: () {
              ContextMenuController.removeAny();
              _copyNotice();
            },
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final segment in _segments)
            if (!segment.isParagraph)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: HtmlBlock(segment.node, fontSize: fontSize),
              )
            else
              _ParagraphBlock(
                key: _paragraphKeys[segment.paragraphIndex],
                segment: segment,
                fontSize: fontSize,
                bookmarked: _bookmark?.chapterId == chapter.id && _bookmark?.paragraphIndex == segment.paragraphIndex,
                count: _counts[segment.paragraphIndex] ?? 0,
                open: _openPanel == segment.paragraphIndex,
                onBookmark: () => _bookmark?.chapterId == chapter.id && _bookmark?.paragraphIndex == segment.paragraphIndex
                    ? _removeBookmark()
                    : _setBookmark(segment.paragraphIndex!),
                onComments: () => setState(() => _openPanel = _openPanel == segment.paragraphIndex ? null : segment.paragraphIndex),
                panel: _openPanel == segment.paragraphIndex
                    ? ParagraphCommentsPanel(
                        bookId: widget.bookId,
                        bookTitle: book.title,
                        chapterId: chapter.id,
                        paragraphIndex: segment.paragraphIndex!,
                        focusCommentId: widget.focusCommentId,
                        onClose: () => setState(() => _openPanel = null),
                        onCountChanged: _loadCounts,
                      )
                    : null,
              ),
          if (_index == _chapters.length - 1)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Text(
                '✦ SON ✦',
                textAlign: TextAlign.center,
                style: serif(size: 16, color: BetikColors.ashGray, letterSpacing: 3),
              ),
            ),
          if (!signedIn)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(
                'Ayraç koymak, yorum yazmak ve alıntı kaydetmek için giriş yapmalısınız.',
                textAlign: TextAlign.center,
                style: sans(size: 12.5, color: BetikColors.ashGray),
              ),
            ),
        ],
      ),
    );
  }

  Widget _navigation() {
    final hasNext = _index < _chapters.length - 1;
    final current = _currentChapter;
    final completed = _completed.contains(current.id);
    final nextLabel = nextButtonLabel(current: current, hasNext: hasNext, completed: completed);
    final disabled = nextButtonDisabled(current: current, hasNext: hasNext, completed: completed);
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(onPressed: _index > 0 ? () => _goTo(_index - 1) : null, child: const Text('ÖNCEKİ BÖLÜM')),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: FilledButton(
            onPressed: disabled ? null : _advance,
            child: Text(trUpper(nextLabel), textAlign: TextAlign.center),
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner(this.text, {this.action, this.onAction});
  final String text;
  final String? action;
  final Future<void> Function()? onAction;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: BetikColors.sepiaLight,
      border: Border.all(color: BetikColors.rust),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(text, style: sans(size: 13, color: BetikColors.charcoal, height: 1.4)),
        ),
        if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
      ],
    ),
  );
}

/// "Alıntı nasıl eklenir?" (F-READ-14): dismissible, with the touch
/// instructions that apply to a phone.
class _HelpCard extends StatelessWidget {
  const _HelpCard({required this.guest, required this.onClose});
  final bool guest;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(14, 10, 6, 12),
    decoration: BoxDecoration(
      color: BetikColors.successBg,
      border: Border.all(color: const Color(0xFFB9D0B9)),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Beğendiğiniz satırları saklayın',
                style: sans(size: 15, weight: FontWeight.w700, color: BetikColors.success),
              ),
            ),
            IconButton(tooltip: 'Alıntı ipucunu kapat', icon: const Icon(Icons.close, size: 20), onPressed: onClose),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Text(
            'Bir kelimeye basılı tutup seçim tutamaçlarını sürükleyin. 10–1000 karakter seçtiğinizde açılan menüden '
            '“Alıntıla”ya dokunun; not ve görünürlük seçerek kaydedebilirsiniz.'
            '${guest ? ' Alıntı kaydetmek için giriş yapmalısınız.' : ''}',
            style: sans(size: 13.5, color: BetikColors.success, height: 1.5),
          ),
        ),
      ],
    ),
  );
}

class _ParagraphBlock extends StatelessWidget {
  const _ParagraphBlock({
    super.key,
    required this.segment,
    required this.fontSize,
    required this.bookmarked,
    required this.count,
    required this.open,
    required this.onBookmark,
    required this.onComments,
    this.panel,
  });
  final ChapterSegment segment;
  final double fontSize;
  final bool bookmarked;
  final int count;
  final bool open;
  final VoidCallback onBookmark;
  final VoidCallback onComments;
  final Widget? panel;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 4),
    padding: EdgeInsets.only(left: bookmarked ? 10 : 0),
    decoration: bookmarked
        ? const BoxDecoration(
            border: Border(left: BorderSide(color: BetikColors.bookmark, width: 3)),
          )
        : null,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (bookmarked)
          SelectionContainer.disabled(
            child: Row(
              children: [
                const Icon(Icons.bookmark, size: 15, color: BetikColors.bookmark),
                const SizedBox(width: 4),
                Text(
                  'Kaldığın yer',
                  style: sans(size: 12, weight: FontWeight.w700, color: BetikColors.bookmark),
                ),
              ],
            ),
          ),
        HtmlBlock(segment.node, fontSize: fontSize),
        // Controls are kept out of the text selection.
        SelectionContainer.disabled(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              IconButton(
                tooltip: bookmarked ? 'Ayracı kaldır' : 'Ayraç koy',
                visualDensity: VisualDensity.compact,
                iconSize: 20,
                icon: Icon(
                  bookmarked ? Icons.bookmark : Icons.bookmark_border,
                  color: bookmarked ? BetikColors.bookmark : BetikColors.ashGray,
                ),
                onPressed: onBookmark,
              ),
              TextButton.icon(
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                onPressed: onComments,
                icon: Icon(
                  open ? Icons.chat_bubble : Icons.chat_bubble_outline,
                  size: 19,
                  color: count > 0 || open ? BetikColors.inkBlack : BetikColors.ashGray,
                ),
                label: Text(count > 0 ? formatCount(count) : '', style: sans(size: 12.5)),
              ),
            ],
          ),
        ),
        if (panel != null) SelectionContainer.disabled(child: panel!),
      ],
    ),
  );
}

/// Table of contents (F-READ-02, F-READ-15).
class _ChapterDrawer extends StatelessWidget {
  const _ChapterDrawer({
    required this.book,
    required this.chapters,
    required this.currentIndex,
    required this.completed,
    required this.showHidden,
    required this.onSelect,
    required this.onToggle,
  });
  final Book book;
  final List<Chapter> chapters;
  final int currentIndex;
  final Set<String> completed;
  final bool showHidden;
  final ValueChanged<int> onSelect;
  final ValueChanged<Chapter> onToggle;

  @override
  Widget build(BuildContext context) {
    final done = chapters.where((chapter) => completed.contains(chapter.id)).length;
    return Drawer(
      width: 320,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextButton.icon(
                    style: TextButton.styleFrom(padding: EdgeInsets.zero),
                    onPressed: () {
                      Navigator.of(context).pop();
                      context.canPop() ? context.pop() : context.go('/book/${book.id}');
                    },
                    icon: const Icon(Icons.arrow_back, size: 18),
                    label: const Text('Kitap Detayına Dön'),
                  ),
                  Text(book.title, style: serif(size: 18, weight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text('${chapters.length} bölümden $done tanesi okundu', style: sans(size: 12.5, color: BetikColors.ashGray)),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(value: chapters.isEmpty ? 0 : done / chapters.length, minHeight: 6),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: ListView.builder(
                itemCount: chapters.length,
                itemBuilder: (context, index) {
                  final chapter = chapters[index];
                  final length = chapter.wordCount != null
                      ? '${formatExactCount(chapter.wordCount)} kelime · ${chapter.pageCount} sayfa'
                      : 'Uzunluk bilgisi hazırlanıyor';
                  return ListTile(
                    selected: index == currentIndex,
                    selectedTileColor: BetikColors.infoBg,
                    onTap: () => onSelect(index),
                    leading: Checkbox(
                      value: completed.contains(chapter.id),
                      onChanged: chapter.canReadContent ? (_) => onToggle(chapter) : null,
                    ),
                    title: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('BÖLÜM ${index + 1}', style: label(size: 10.5)),
                        Text(chapter.title, style: serif(size: 14.5, weight: FontWeight.w700)),
                      ],
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(length),
                        if (chapter.isHidden && showHidden)
                          Text(
                            'Okuyuculara kapalı',
                            style: sans(size: 11.5, color: BetikColors.rust, weight: FontWeight.w600),
                          ),
                        if (chapter.registrationRequired)
                          Text(
                            'Ücretsiz üyelikle oku',
                            style: sans(size: 11.5, color: BetikColors.rust, weight: FontWeight.w600),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
