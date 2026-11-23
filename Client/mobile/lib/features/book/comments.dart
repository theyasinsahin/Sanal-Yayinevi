import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/mentions.dart';
import '../../core/widgets/ui.dart';

const _commentsQuery = r'''
query GetCommentsByBookId($bookId: ID!) {
  getCommentsByBookId(bookId: $bookId) { id content date parentId likedBy userId { id username fullName profilePicture } }
}''';

class CommentThread {
  CommentThread(this.root, this.replies);
  final BookComment root;
  final List<BookComment> replies;
}

/// The server returns one flat list (`Comment.replies` is always empty);
/// the client groups by `parentId`. Roots newest first, replies oldest
/// first, a reply whose root is missing is shown as a root (F-COMM-01).
List<CommentThread> threadComments(List<BookComment> comments) {
  final roots = comments.where((comment) => comment.parentId == null).toList();
  final rootIds = roots.map((comment) => comment.id).toSet();
  final replies = <String, List<BookComment>>{};
  for (final comment in comments) {
    final parent = comment.parentId;
    if (parent == null) continue;
    if (rootIds.contains(parent)) {
      replies.putIfAbsent(parent, () => []).add(comment);
    } else {
      roots.add(comment);
    }
  }
  int byDate(BookComment a, BookComment b) =>
      (a.date ?? DateTime.fromMillisecondsSinceEpoch(0)).compareTo(b.date ?? DateTime.fromMillisecondsSinceEpoch(0));
  roots.sort((a, b) => byDate(b, a));
  return [for (final root in roots) CommentThread(root, (replies[root.id] ?? [])..sort(byDate))];
}

/// Book comments (F-COMM-01…06), used by digital and printed books.
class CommentsSection extends StatefulWidget {
  const CommentsSection({super.key, required this.bookId, required this.bookTitle, this.focusCommentId, this.title = 'Yorumlar'});
  final String bookId;
  final String bookTitle;
  final String? focusCommentId;
  final String title;

  @override
  State<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends State<CommentsSection> {
  final _loader = GlobalKey<LoaderState<List<BookComment>>>();
  final _composer = TextEditingController();
  final _focusKey = GlobalKey();
  bool _scrolled = false;

  @override
  void initState() {
    super.initState();
    // A guest who was sent to sign-up while writing gets the draft back.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final intent = context.services.intents.consume('comment', GoRouterState.of(context).uri.toString());
      if (intent?.draft != null) _composer.text = intent!.draft!;
    });
  }

  @override
  void dispose() {
    _composer.dispose();
    super.dispose();
  }

  Future<List<BookComment>> _load() async {
    final data = await context.services.api.run(_commentsQuery, variables: {'bookId': widget.bookId}, authenticated: false);
    return jsonList(data['getCommentsByBookId']).map(BookComment.fromJson).toList();
  }

  Future<void> _reload() async => _loader.currentState?.reload(silent: true);

  Future<void> _send() async {
    final content = _composer.text.trim();
    if (content.isEmpty) return;
    if (!requireMember(context, 'comment', bookTitle: widget.bookTitle, draft: content)) return;
    try {
      await context.services.api.run(
        r'mutation CreateComment($bookId: ID!, $content: String!) { createComment(bookId: $bookId, content: $content) { id } }',
        variables: {'bookId': widget.bookId, 'content': content},
      );
      _composer.clear();
      if (mounted) showToast(context, 'Yorum gönderildi', type: ToastType.success);
      await _reload();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  void _scrollToFocus() {
    if (_scrolled) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _focusKey.currentContext;
      if (target == null) return;
      _scrolled = true;
      Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 300), alignment: 0.2);
    });
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = context.services.auth.isSignedIn;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.title, style: serif(size: 20, weight: FontWeight.w700)),
        const SizedBox(height: 10),
        MentionField(controller: _composer, hintText: 'Yorumunuzu yazın...', minLines: 2, maxLines: 6),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: ListenableBuilder(
            listenable: _composer,
            builder: (context, _) =>
                BusyButton(onPressed: _composer.text.trim().isEmpty ? null : _send, label: signedIn ? 'Gönder' : 'Gönder'),
          ),
        ),
        const SizedBox(height: 12),
        Loader<List<BookComment>>(
          key: _loader,
          load: _load,
          builder: (context, comments, _) {
            final threads = threadComments(comments);
            if (threads.isEmpty) {
              return const EmptyView(title: 'Henüz yorum yapılmamış. İlk yorumu sen yap!');
            }
            if (widget.focusCommentId != null) _scrollToFocus();
            return Column(
              children: [
                for (final thread in threads) ...[
                  _CommentItem(
                    key: thread.root.id == widget.focusCommentId ? _focusKey : null,
                    comment: thread.root,
                    bookId: widget.bookId,
                    bookTitle: widget.bookTitle,
                    rootId: thread.root.id,
                    highlighted: thread.root.id == widget.focusCommentId,
                    onChanged: _reload,
                  ),
                  for (final reply in thread.replies)
                    Padding(
                      padding: const EdgeInsets.only(left: 28),
                      child: _CommentItem(
                        key: reply.id == widget.focusCommentId ? _focusKey : null,
                        comment: reply,
                        bookId: widget.bookId,
                        bookTitle: widget.bookTitle,
                        rootId: thread.root.id,
                        highlighted: reply.id == widget.focusCommentId,
                        onChanged: _reload,
                      ),
                    ),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}

class _CommentItem extends StatefulWidget {
  const _CommentItem({
    super.key,
    required this.comment,
    required this.bookId,
    required this.bookTitle,
    required this.rootId,
    required this.onChanged,
    this.highlighted = false,
  });
  final BookComment comment;
  final String bookId;
  final String bookTitle;
  final String rootId;
  final bool highlighted;
  final Future<void> Function() onChanged;

  @override
  State<_CommentItem> createState() => _CommentItemState();
}

class _CommentItemState extends State<_CommentItem> {
  late List<String> _likedBy = widget.comment.likedBy;
  TextEditingController? _reply;

  @override
  void didUpdateWidget(covariant _CommentItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.comment != widget.comment) _likedBy = widget.comment.likedBy;
  }

  @override
  void dispose() {
    _reply?.dispose();
    super.dispose();
  }

  String get _prefix => '@${widget.comment.user?.username ?? ''} ';

  Future<void> _toggleLike() async {
    if (!requireMember(context, 'comment-like', bookTitle: widget.bookTitle)) return;
    final me = context.services.auth.userId!;
    final before = _likedBy;
    // Optimistic toggle, rolled back on failure.
    setState(() => _likedBy = before.contains(me) ? (before.toList()..remove(me)) : [...before, me]);
    try {
      await context.services.api.run(
        r'mutation ToggleCommentLike($commentId: ID!) { toggleCommentLike(commentId: $commentId) { id likedBy } }',
        variables: {'commentId': widget.comment.id},
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _likedBy = before);
      showError(context, error);
    }
  }

  Future<void> _delete() async {
    if (!await confirm(context, 'Silmek istediğinize emin misiniz?', confirmLabel: 'Sil', destructive: true)) return;
    if (!mounted) return;
    try {
      await context.services.api.run(
        r'mutation DeleteComment($id: ID!) { deleteComment(id: $id) { code message } }',
        variables: {'id': widget.comment.id},
      );
      await widget.onChanged();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _sendReply() async {
    final content = _reply!.text.trim();
    if (content.isEmpty || content == _prefix.trim()) return;
    if (!requireMember(context, 'reply', bookTitle: widget.bookTitle, draft: content)) return;
    try {
      // Replies are one level deep: the server attaches a reply-to-reply to
      // the root and prefixes the mention itself when it is missing.
      await context.services.api.run(
        r'mutation ReplyToComment($bookId: ID!, $content: String!, $parentCommentId: ID!) { replyToComment(bookId: $bookId, content: $content, parentCommentId: $parentCommentId) { id } }',
        variables: {'bookId': widget.bookId, 'content': content, 'parentCommentId': widget.comment.id},
      );
      setState(() {
        _reply?.dispose();
        _reply = null;
      });
      await widget.onChanged();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final comment = widget.comment;
    final me = context.services.auth.userId;
    final liked = me != null && _likedBy.contains(me);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: widget.highlighted ? BetikColors.sepiaLight : BetikColors.paperWhite,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: widget.highlighted ? BetikColors.rust : BetikColors.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              UserAvatar.of(comment.user, size: 30),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: comment.user == null ? null : () => context.push('/user/${comment.user!.id}'),
                  child: Text('@${comment.user?.username ?? 'kullanıcı'}', style: sans(size: 13.5, weight: FontWeight.w700)),
                ),
              ),
              Text(formatDate(comment.date), style: sans(size: 12, color: BetikColors.ashGray)),
            ],
          ),
          const SizedBox(height: 8),
          MentionText(comment.content),
          Row(
            children: [
              TextButton.icon(
                onPressed: _toggleLike,
                icon: Icon(
                  liked ? Icons.favorite : Icons.favorite_border,
                  size: 18,
                  color: liked ? BetikColors.notificationBadge : BetikColors.ashGray,
                ),
                label: Text(formatCount(_likedBy.length), style: sans(size: 12.5, color: BetikColors.graphite)),
              ),
              TextButton(
                onPressed: () => setState(() {
                  if (_reply == null) {
                    _reply = TextEditingController(text: _prefix);
                  } else {
                    _reply!.dispose();
                    _reply = null;
                  }
                }),
                child: const Text('Yanıtla'),
              ),
              const Spacer(),
              // Only the owner can delete (the server refuses everyone else,
              // including the book's author and admins — Stage 2 S-07).
              if (me != null && comment.user?.id == me)
                IconButton(
                  tooltip: 'Yorumu sil',
                  iconSize: 19,
                  icon: const Icon(Icons.delete_outline, color: BetikColors.danger),
                  onPressed: _delete,
                ),
            ],
          ),
          if (_reply != null) ...[
            MentionField(controller: _reply!, hintText: 'Yanıtınızı yazın...', maxLines: 4, showHint: false),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: ListenableBuilder(
                listenable: _reply!,
                builder: (context, _) {
                  final text = _reply!.text.trim();
                  return BusyButton(onPressed: text.isEmpty || text == _prefix.trim() ? null : _sendReply, label: 'Gönder');
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}
