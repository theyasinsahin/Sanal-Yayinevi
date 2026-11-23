import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/mentions.dart';
import '../../core/widgets/ui.dart';
import '../share/share_sheet.dart';

/// Quote card (F-QUOTE-03…06, F-QUOTE-10).
///
/// Deliberately *not* offered, as on the website: deleting an own quote
/// (F-QUOTE-08) and liking a quote comment — the API has them, the product
/// UI does not.
class QuoteCard extends StatefulWidget {
  const QuoteCard(this.quote, {super.key, this.initiallyShowComments = false, this.focusCommentId, this.onChanged});
  final Quote quote;
  final bool initiallyShowComments;
  final String? focusCommentId;
  final VoidCallback? onChanged;

  @override
  State<QuoteCard> createState() => _QuoteCardState();
}

class _QuoteCardState extends State<QuoteCard> {
  late Quote _quote = widget.quote;
  late bool _revealed = !widget.quote.isSpoiler;
  late bool _showComments = widget.initiallyShowComments;
  bool _reposting = false;
  final _repostComment = TextEditingController();

  @override
  void didUpdateWidget(covariant QuoteCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.quote != widget.quote) _quote = widget.quote;
  }

  @override
  void dispose() {
    _repostComment.dispose();
    super.dispose();
  }

  /// Likes, reposts and comments act on the original quote.
  Quote get _target => _quote.source;

  Future<void> _like() async {
    if (!requireMember(context, 'like', data: {'quoteId': _target.id})) return;
    final me = context.services.auth.userId!;
    final before = _quote;
    final likes = _quote.likedBy.contains(me) ? (_quote.likedBy.toList()..remove(me)) : [..._quote.likedBy, me];
    setState(() => _quote = _quote.copyWith(likedBy: likes));
    try {
      await context.services.api.run(
        r'mutation ToggleQuoteLike($id: ID!) { toggleQuoteLike(id: $id) { id likedBy } }',
        variables: {'id': _quote.id},
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _quote = before);
      showError(context, error);
    }
  }

  Future<void> _repost() async {
    final me = context.services.auth.userId!;
    try {
      await context.services.api.run(
        r'mutation RepostQuote($originalQuoteId: ID!, $repostComment: String, $isSpoiler: Boolean) { repostQuote(originalQuoteId: $originalQuoteId, repostComment: $repostComment, isSpoiler: $isSpoiler) { id } }',
        variables: {'originalQuoteId': _quote.id, 'repostComment': _repostComment.text.trim(), 'isSpoiler': _quote.isSpoiler},
      );
      if (!mounted) return;
      setState(() {
        _quote = _quote.copyWith(repostedBy: [..._quote.repostedBy, me]);
        _reposting = false;
        _repostComment.clear();
      });
      showToast(context, 'Alıntı yeniden paylaşıldı.', type: ToastType.success);
      widget.onChanged?.call();
    } catch (error) {
      // The website swallows this error silently (Stage 1 D-06); the app
      // tells the user.
      if (mounted) showError(context, error);
    }
  }

  Future<void> _unrepost() async {
    final me = context.services.auth.userId!;
    final before = _quote;
    setState(() => _quote = _quote.copyWith(repostedBy: _quote.repostedBy.toList()..remove(me)));
    try {
      await context.services.api.run(
        r'mutation UnrepostQuote($originalQuoteId: ID!) { unrepostQuote(originalQuoteId: $originalQuoteId) }',
        variables: {'originalQuoteId': _quote.id},
      );
      widget.onChanged?.call();
    } catch (error) {
      if (!mounted) return;
      setState(() => _quote = before);
      showError(context, error);
    }
  }

  void _onRepostPressed() {
    if (!requireMember(context, 'repost', data: {'quoteId': _quote.id})) return;
    final me = context.services.auth.userId!;
    if (_quote.repostedBy.contains(me)) {
      _unrepost();
    } else {
      setState(() => _reposting = !_reposting);
    }
  }

  @override
  Widget build(BuildContext context) {
    final quote = _quote;
    final source = quote.source;
    final me = context.services.auth.userId;
    final liked = me != null && quote.likedBy.contains(me);
    final reposted = me != null && quote.repostedBy.contains(me);
    final book = source.book;

    return PaperCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (quote.isRepost) ...[
            Row(
              children: [
                const Icon(Icons.repeat, size: 16, color: BetikColors.ashGray),
                const SizedBox(width: 6),
                Expanded(
                  child: Text('@${quote.user?.username ?? ''} yeniden paylaştı', style: sans(size: 12.5, color: BetikColors.ashGray)),
                ),
              ],
            ),
            if ((quote.repostComment ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: MentionText(quote.repostComment!, style: serif(size: 14, height: 1.5)),
              ),
            const Divider(height: 20),
          ],
          if (quote.isPrivate)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('Özel · Sadece ben', style: label(size: 11, color: BetikColors.rust)),
            ),
          if (!_revealed)
            InkWell(
              onTap: () => setState(() => _revealed = true),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: BetikColors.agedPaper, borderRadius: BorderRadius.circular(8)),
                child: Text(
                  '⚠️ Sürprizbozan içeriyor — Görmek için dokun',
                  textAlign: TextAlign.center,
                  style: sans(size: 13.5, weight: FontWeight.w600, color: BetikColors.graphite),
                ),
              ),
            )
          else ...[
            Text('❝', style: serif(size: 30, color: BetikColors.lightSmoke, height: 0.9)),
            SelectableText(source.text, style: serif(size: 16, height: 1.65, style: FontStyle.italic)),
            if ((source.note ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: MentionText('“${source.note}”', style: serif(size: 14, height: 1.5, color: BetikColors.graphite)),
              ),
          ],
          const SizedBox(height: 12),
          if (book != null)
            InkWell(
              onTap: () => context.push('/book/${book.id}'),
              child: Row(
                children: [
                  BookCover(book.imageUrl, width: 34, radius: 3),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          book.title,
                          style: serif(size: 13.5, weight: FontWeight.w700),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          [
                            if ((source.chapterTitle ?? '').isNotEmpty) source.chapterTitle!,
                            if (source.pageNumber != null) 'Sayfa ${source.pageNumber}',
                          ].join(' · '),
                          style: sans(size: 12, color: BetikColors.ashGray),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              UserAvatar.of(source.user, size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: source.user == null ? null : () => context.push('/user/${source.user!.id}'),
                  child: Text('@${source.user?.username ?? ''}', style: sans(size: 13, weight: FontWeight.w600)),
                ),
              ),
              Text(relativeAgo(quote.createdAt), style: sans(size: 12, color: BetikColors.ashGray)),
            ],
          ),
          if (!quote.isPrivate) ...[
            const Divider(height: 20),
            Row(
              children: [
                TextButton.icon(
                  onPressed: () => setState(() => _showComments = !_showComments),
                  icon: const Icon(Icons.chat_bubble_outline, size: 18),
                  label: Text(formatCount(quote.commentCount)),
                ),
                if (!quote.isRepost)
                  TextButton.icon(
                    onPressed: _onRepostPressed,
                    icon: Icon(Icons.repeat, size: 18, color: reposted ? BetikColors.messageBadge : null),
                    label: Text(formatCount(quote.repostedBy.length)),
                  ),
                TextButton.icon(
                  onPressed: _like,
                  icon: Icon(liked ? Icons.favorite : Icons.favorite_border, size: 18, color: liked ? BetikColors.notificationBadge : null),
                  label: Text(formatCount(quote.likedBy.length)),
                ),
                const Spacer(),
                IconButton(
                  tooltip: 'Alıntıyı paylaş',
                  iconSize: 19,
                  icon: const Icon(Icons.ios_share),
                  onPressed: () => showShareSheet(context, type: 'QUOTE', id: _target.id),
                ),
              ],
            ),
            if (_reposting) ...[
              MentionField(controller: _repostComment, hintText: 'Yorum ekle (isteğe bağlı)', maxLines: 3),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(onPressed: () => setState(() => _reposting = false), child: const Text('İptal')),
                  const SizedBox(width: 8),
                  BusyButton(onPressed: _repost, label: 'Yeniden Paylaş'),
                ],
              ),
            ],
            if (_showComments)
              QuoteComments(
                quoteId: quote.id,
                focusCommentId: widget.focusCommentId,
                onCountChanged: (count) => setState(() => _quote = _quote.copyWith(commentCount: count)),
              ),
          ],
        ],
      ),
    );
  }
}

class QuoteComments extends StatefulWidget {
  const QuoteComments({super.key, required this.quoteId, required this.onCountChanged, this.focusCommentId});
  final String quoteId;
  final String? focusCommentId;
  final ValueChanged<int> onCountChanged;

  @override
  State<QuoteComments> createState() => _QuoteCommentsState();
}

class _QuoteCommentsState extends State<QuoteComments> {
  final _loader = GlobalKey<LoaderState<List<SimpleComment>>>();
  final _input = TextEditingController();

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<List<SimpleComment>> _load() async {
    final data = await context.services.api.run(
      r'query GetQuoteComments($quoteId: ID!) { getQuoteComments(quoteId: $quoteId) { id content likedBy createdAt user { id username fullName profilePicture } } }',
      variables: {'quoteId': widget.quoteId},
    );
    final comments = jsonList(data['getQuoteComments']).map(SimpleComment.fromJson).toList();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onCountChanged(comments.length);
    });
    return comments;
  }

  Future<void> _send() async {
    final content = _input.text.trim();
    if (content.isEmpty) return;
    if (!requireMember(context, 'quote-comment', draft: content, data: {'quoteId': widget.quoteId})) return;
    try {
      await context.services.api.run(
        r'mutation AddQuoteComment($quoteId: ID!, $content: String!) { addQuoteComment(quoteId: $quoteId, content: $content) { id } }',
        variables: {'quoteId': widget.quoteId, 'content': content},
      );
      _input.clear();
      await _loader.currentState?.reload(silent: true);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _delete(String id) async {
    try {
      await context.services.api.run(
        r'mutation DeleteQuoteComment($id: ID!) { deleteQuoteComment(id: $id) { code message } }',
        variables: {'id': id},
      );
      await _loader.currentState?.reload(silent: true);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.services.auth.userId;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Divider(height: 16),
        Loader<List<SimpleComment>>(
          key: _loader,
          load: _load,
          builder: (context, comments, _) => Column(
            children: [
              if (comments.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text('Henüz yorum yok. İlk yorumu sen yap!', style: sans(size: 13, color: BetikColors.ashGray)),
                ),
              for (final comment in comments)
                Container(
                  color: comment.id == widget.focusCommentId ? BetikColors.sepiaLight : null,
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      UserAvatar.of(comment.user, size: 26),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '@${comment.user?.username ?? ''} · ${relativeAgo(comment.createdAt)}',
                              style: sans(size: 12, color: BetikColors.ashGray),
                            ),
                            MentionText(comment.content, style: serif(size: 14, height: 1.5)),
                          ],
                        ),
                      ),
                      if (me != null && comment.user?.id == me)
                        IconButton(
                          tooltip: 'Yorumu sil',
                          iconSize: 18,
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(Icons.delete_outline, color: BetikColors.danger),
                          onPressed: () => _delete(comment.id),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: MentionField(
                controller: _input,
                hintText: 'Yorum yaz...',
                maxLines: 3,
                textInputAction: TextInputAction.send,
                onSubmitted: _send,
                showHint: false,
              ),
            ),
            IconButton(tooltip: 'Gönder', icon: const Icon(Icons.send), onPressed: _send),
          ],
        ),
      ],
    );
  }
}
