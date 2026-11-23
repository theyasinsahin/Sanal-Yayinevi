import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../funding/funding_shared.dart';
import '../printed/printed_detail.dart';
import '../share/share_sheet.dart';
import '../shell/shell.dart';
import 'classification_fields.dart';
import 'comments.dart';

const bookDetailQuery =
    '''
query GetBookDetail(\$id: ID!) {
  getBookById(id: \$id) {
    $bookCardFields
    $printedBookFields
    authorId likedBy tags
    chapters { id title createdAt pageCount isHidden canReadContent accessStatus wordCount }
  }
}''';

const updateBookStatusMutation = r'''
mutation UpdateBookStatus($bookId: ID!, $status: String!) {
  updateBookStatus(bookId: $bookId, status: $status) { id status digitalStatus writingStatus }
}''';

class BookDetailData {
  BookDetailData(this.book, this.saved);
  final Book? book;
  final bool saved;
}

class BookDetailScreen extends StatefulWidget {
  const BookDetailScreen({super.key, required this.bookId, this.focusCommentId, this.scrollToComments = false});
  final String bookId;
  final String? focusCommentId;
  final bool scrollToComments;

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen> {
  final _loader = GlobalKey<LoaderState<BookDetailData>>();
  final _commentsKey = GlobalKey();
  bool _scrolledToComments = false;

  Future<BookDetailData> _load() async {
    final services = context.services;
    final data = await services.api.run(bookDetailQuery, variables: {'id': widget.bookId});
    final raw = jsonMap(data['getBookById']);
    var saved = false;
    final me = services.auth.userId;
    if (raw != null && me != null) {
      try {
        final viewer = await services.api.run(
          r'query GetBookViewer($id: ID!) { getUserById(id: $id) { id role savedBooks { id } } }',
          variables: {'id': me},
        );
        saved = jsonList(jsonMap(viewer['getUserById'])?['savedBooks']).any((book) => book['id'] == widget.bookId);
      } on ApiException {
        // The saved flag is secondary; the page still renders.
      }
    }
    return BookDetailData(raw == null ? null : Book.fromJson(raw), saved);
  }

  void _reload() => _loader.currentState?.reload(silent: true);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    return Loader<BookDetailData>(
      key: _loader,
      load: _load,
      refreshOn: auth.sessionEpoch,
      errorBuilder: (context, error, retry) => PageScaffold(
        title: 'Kitap',
        body: ErrorView(title: 'Kitap açılamadı', message: errorMessage(error), onRetry: retry),
      ),
      builder: (context, data, loader) {
        final book = data.book;
        if (book == null) {
          // Drafts of other authors, deleted books and unknown ids all look
          // the same to the client: not found.
          return PageScaffold(
            title: 'Kitap',
            body: EmptyView(
              icon: Icons.menu_book_outlined,
              title: 'Kitap bulunamadı',
              subtitle: 'Bu kitap kaldırılmış veya henüz yayımlanmamış olabilir.',
              action: OutlinedButton(onPressed: () => context.go('/feed'), child: const Text('KİTAPLIĞA DÖN')),
            ),
          );
        }
        final me = auth.user;
        final isAuthor = me != null && book.authorId == me.id;
        final isAdmin = me?.isAdmin ?? false;
        if (widget.scrollToComments && !_scrolledToComments) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            final target = _commentsKey.currentContext;
            if (target == null) return;
            _scrolledToComments = true;
            Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 300));
          });
        }
        return PageScaffold(
          title: book.isPrinted ? 'Basılı Eser' : 'Kitap Detayı',
          actions: [
            if (!book.isDraft && (!book.isPrinted || book.publicationStatus == 'APPROVED'))
              IconButton(
                tooltip: 'Kitabı paylaş',
                icon: const Icon(Icons.ios_share),
                onPressed: () => showShareSheet(context, type: 'BOOK', id: book.id),
              ),
          ],
          body: RefreshIndicator(
            onRefresh: () => loader.reload(silent: true),
            // Not a lazy list: a link to the comments (notification, share)
            // must be able to scroll to a section that is far below the fold,
            // which a ListView would not have built yet.
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (book.isPrinted)
                    PrintedBookDetail(book: book, isAdmin: isAdmin, onChanged: _reload)
                  else ...[
                    _DigitalHeader(book: book, saved: data.saved, onChanged: _reload),
                    if (isAuthor || isAdmin) ...[
                      const SizedBox(height: 16),
                      _AuthorControls(book: book, isAuthor: isAuthor, onChanged: _reload),
                    ],
                    const SizedBox(height: 20),
                    Text('Eser hakkında', style: serif(size: 20, weight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    ClassificationSummary(book.classification),
                    if (isAuthor || isAdmin) ...[const SizedBox(height: 8), ClassificationEditor(book: book, onSaved: _reload)],
                    const SizedBox(height: 20),
                    if (!book.isDraft) BookFundingPanel(bookId: book.id),
                    const OrnamentDivider(),
                    CommentsSection(key: _commentsKey, bookId: book.id, bookTitle: book.title, focusCommentId: widget.focusCommentId),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _DigitalHeader extends StatefulWidget {
  const _DigitalHeader({required this.book, required this.saved, required this.onChanged});
  final Book book;
  final bool saved;
  final VoidCallback onChanged;

  @override
  State<_DigitalHeader> createState() => _DigitalHeaderState();
}

class _DigitalHeaderState extends State<_DigitalHeader> {
  late bool _liked;
  late int _likes;
  late bool _saved;
  bool? _following;

  @override
  void initState() {
    super.initState();
    _sync();
    _loadFollowing();
  }

  @override
  void didUpdateWidget(covariant _DigitalHeader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.book != widget.book || oldWidget.saved != widget.saved) _sync();
  }

  void _sync() {
    final me = context.services.auth.userId;
    _liked = me != null && widget.book.likedBy.contains(me);
    _likes = widget.book.likes;
    _saved = widget.saved;
  }

  Future<void> _loadFollowing() async {
    if (!context.services.auth.isSignedIn) return;
    try {
      final data = await context.services.api.run(
        r'query IsFollowingBook($bookId: ID!) { isFollowingBook(bookId: $bookId) }',
        variables: {'bookId': widget.book.id},
      );
      if (mounted) setState(() => _following = data['isFollowingBook'] == true);
    } on ApiException {
      // Leave the button in its default state.
    }
  }

  Future<void> _like() async {
    if (!requireMember(context, 'like', bookTitle: widget.book.title)) return;
    final wasLiked = _liked;
    setState(() {
      _liked = !wasLiked;
      _likes += wasLiked ? -1 : 1;
    });
    try {
      await context.services.api.run(
        r'mutation LikeBook($bookId: ID!) { likeBook(bookId: $bookId) { id stats { likes } likedBy } }',
        variables: {'bookId': widget.book.id},
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _liked = wasLiked;
        _likes += wasLiked ? 1 : -1;
      });
      showToast(context, 'Beğeni işlemi başarısız', type: ToastType.error);
    }
  }

  Future<void> _save() async {
    if (!requireMember(context, 'save', bookTitle: widget.book.title)) return;
    final wasSaved = _saved;
    setState(() => _saved = !wasSaved);
    try {
      await context.services.api.run(
        r'mutation ToggleSaveBook($bookId: ID!) { toggleSaveBook(bookId: $bookId) { id savedBooks { id } } }',
        variables: {'bookId': widget.book.id},
      );
      if (mounted) showToast(context, wasSaved ? 'Kitaplıktan çıkarıldı' : 'Kitaplığına eklendi', type: ToastType.success);
    } catch (_) {
      if (!mounted) return;
      setState(() => _saved = wasSaved);
      showToast(context, 'Kaydetme işlemi başarısız', type: ToastType.error);
    }
  }

  Future<void> _follow() async {
    if (!requireMember(context, 'follow', bookTitle: widget.book.title)) return;
    final was = _following ?? false;
    setState(() => _following = !was);
    try {
      final data = await context.services.api.run(
        r'mutation ToggleBookFollow($bookId: ID!) { toggleBookFollow(bookId: $bookId) { isFollowing followCount } }',
        variables: {'bookId': widget.book.id},
      );
      if (mounted) setState(() => _following = jsonMap(data['toggleBookFollow'])?['isFollowing'] == true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _following = was);
      showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final book = widget.book;
    Widget meta(String title, Widget value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(title, style: serif(size: 14, color: BetikColors.ashGray)),
          ),
          Expanded(
            child: Align(alignment: Alignment.centerRight, child: value),
          ),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(child: BookCover(book.imageUrl, width: 180, radius: 10)),
        const SizedBox(height: 16),
        PaperCard(
          child: Column(
            children: [
              meta(
                'Biçim / Tür:',
                Wrap(
                  alignment: WrapAlignment.end,
                  spacing: 6,
                  runSpacing: 6,
                  children: [for (final chip in book.classification.summary) TagChip(chip)],
                ),
              ),
              const Divider(),
              meta('Sayfa:', Text('${book.pageCount}', style: serif(size: 15, weight: FontWeight.w700))),
              const Divider(),
              meta('Yayın:', Text(formatDate(book.publishDate), style: serif(size: 15, weight: FontWeight.w700))),
              const Divider(),
              meta('Beğeni:', Text(formatExactCount(_likes), style: serif(size: 15, weight: FontWeight.w700))),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (book.isDraft) const Align(alignment: Alignment.centerLeft, child: TagChip('Taslak', dark: true)),
        Text(book.title, style: serif(size: 28, weight: FontWeight.w700, height: 1.2)),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: book.author == null ? null : () => context.push('/user/${book.author!.id}'),
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: 'Yazar: ',
                  style: sans(size: 14, color: BetikColors.ashGray),
                ),
                TextSpan(
                  text: book.authorName,
                  style: sans(size: 14, weight: FontWeight.w700).copyWith(decoration: TextDecoration.underline),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => context.push('/reader/${book.id}'),
                icon: const Icon(Icons.auto_stories, size: 18),
                label: const Text('KİTABI OKU'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.outlined(
              tooltip: _liked ? 'Beğeniyi geri al' : 'Beğen',
              onPressed: _like,
              icon: Icon(_liked ? Icons.favorite : Icons.favorite_border, color: _liked ? BetikColors.notificationBadge : null),
            ),
            IconButton.outlined(
              tooltip: _saved ? 'Kitaplıktan çıkar' : 'Kitaplığa ekle',
              onPressed: _save,
              icon: Icon(_saved ? Icons.bookmark : Icons.bookmark_border),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (!book.isDraft)
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _follow,
                  child: Text((_following ?? false) ? 'KİTABI TAKİP EDİYORSUN' : 'KİTABI TAKİP ET'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  // Protected route: guests are sent to sign in first.
                  onPressed: () => context.services.auth.isSignedIn
                      ? context.push('/donate/${book.id}')
                      : context.push('/login?returnTo=${Uri.encodeComponent('/donate/${book.id}')}'),
                  child: const Text('DESTEK OL'),
                ),
              ),
            ],
          ),
        const SizedBox(height: 18),
        Text('Özet', style: serif(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        // Descriptions are plain text; markup in them is shown literally.
        Text(
          book.description.isEmpty ? 'Henüz açıklama eklenmemiş.' : book.description,
          style: serif(size: 15, height: 1.65, color: BetikColors.charcoal),
        ),
      ],
    );
  }
}

/// Author publication controls (F-BOOK-08, F-BOOK-10). The state machine is
/// enforced by the server; the confirmations and labels are the website's.
class _AuthorControls extends StatelessWidget {
  const _AuthorControls({required this.book, required this.isAuthor, required this.onChanged});
  final Book book;
  final bool isAuthor;
  final VoidCallback onChanged;

  Future<void> _setStatus(BuildContext context, String status, String question) async {
    if (!await confirm(context, question)) return;
    if (!context.mounted) return;
    try {
      await context.services.api.run(updateBookStatusMutation, variables: {'bookId': book.id, 'status': status});
      if (!context.mounted) return;
      context.services.invalidateData();
      onChanged();
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  Future<void> _delete(BuildContext context) async {
    if (!await confirm(context, 'Bu kitabı kalıcı olarak silmek istediğinize emin misiniz?', confirmLabel: 'Sil', destructive: true)) {
      return;
    }
    if (!context.mounted) return;
    try {
      await context.services.api.run(r'mutation DeleteBook($id: ID!) { deleteBook(id: $id) { code message } }', variables: {'id': book.id});
      if (!context.mounted) return;
      context.services.invalidateData();
      context.go('/profile');
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasText = book.chapters.any((chapter) => (chapter.wordCount ?? 0) > 0);
    return PaperCard(
      color: BetikColors.sepiaLight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            book.isDraft ? 'Taslak' : (book.isCompleted ? 'Yazım tamamlandı' : 'Yayında'),
            style: serif(size: 16, weight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          if (isAuthor)
            FilledButton.icon(
              onPressed: () => context.push('/dashboard/${book.id}'),
              icon: const Icon(Icons.edit, size: 18),
              label: const Text('YAZMAYA DEVAM ET'),
            ),
          // Admins get delete (and classification) on other authors' books;
          // the status buttons are the author's.
          if (!isAuthor)
            const SizedBox.shrink()
          else if (book.isDraft) ...[
            OutlinedButton(
              onPressed: hasText ? () => _setStatus(context, 'WRITING', 'Kitap herkese görünür olacak. Onaylıyor musunuz?') : null,
              child: const Text('YAYINLA (GÖRÜNÜR YAP)'),
            ),
            if (!hasText) Text('Yayınlamak için en az bir bölüme metin ekleyin.', style: sans(size: 12.5, color: BetikColors.ashGray)),
          ] else ...[
            if (!book.isCompleted)
              OutlinedButton(
                onPressed: () => _setStatus(context, 'COMPLETED', 'Kitabın yazım aşamasını bitirdiniz mi?'),
                child: const Text('YAZIMI TAMAMLA'),
              ),
            OutlinedButton(
              onPressed: () => _setStatus(context, 'DRAFT', 'Kitap yayından kaldırılıp taslağa çekilecek. Onaylıyor musunuz?'),
              child: const Text('TASLAĞA ÇEK'),
            ),
            if (book.isCompleted && isAuthor)
              OutlinedButton(
                onPressed: () => context.push('/print/${book.id}'),
                child: const Text('DESTEK FONU İÇİN BAŞVUR / BAŞVURUMU GÖR'),
              ),
          ],
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: BetikColors.danger,
              side: const BorderSide(color: BetikColors.danger, width: 2),
            ),
            onPressed: () => _delete(context),
            child: const Text('SİL'),
          ),
        ],
      ),
    );
  }
}
