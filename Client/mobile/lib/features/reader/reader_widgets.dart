import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/mentions.dart';
import '../../core/widgets/ui.dart';

/// Inline paragraph-comment panel (F-READ-07): oldest first, delete on own
/// comments without confirmation (hard delete), no like control — as on the
/// website.
class ParagraphCommentsPanel extends StatefulWidget {
  const ParagraphCommentsPanel({
    super.key,
    required this.bookId,
    required this.bookTitle,
    required this.chapterId,
    required this.paragraphIndex,
    required this.onClose,
    required this.onCountChanged,
    this.focusCommentId,
  });

  final String bookId;
  final String bookTitle;
  final String chapterId;
  final int paragraphIndex;
  final VoidCallback onClose;
  final VoidCallback onCountChanged;
  final String? focusCommentId;

  @override
  State<ParagraphCommentsPanel> createState() => _ParagraphCommentsPanelState();
}

class _ParagraphCommentsPanelState extends State<ParagraphCommentsPanel> {
  final _loader = GlobalKey<LoaderState<List<SimpleComment>>>();
  final _input = TextEditingController();

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<List<SimpleComment>> _load() async {
    final data = await context.services.api.run(
      r'''query GetParagraphComments($chapterId: ID!, $paragraphIndex: Int!) {
        getParagraphComments(chapterId: $chapterId, paragraphIndex: $paragraphIndex) {
          id content createdAt likedBy user { id username fullName profilePicture }
        }
      }''',
      variables: {'chapterId': widget.chapterId, 'paragraphIndex': widget.paragraphIndex},
    );
    final comments = jsonList(data['getParagraphComments']).map(SimpleComment.fromJson).toList();
    comments.sort(
      (a, b) => (a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0)).compareTo(b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0)),
    );
    return comments;
  }

  Future<void> _send() async {
    final content = _input.text.trim();
    if (content.isEmpty) return;
    if (!requireMember(context, 'paragraph-comment', bookTitle: widget.bookTitle, draft: content)) return;
    try {
      await context.services.api.run(
        r'''mutation AddParagraphComment($bookId: ID!, $chapterId: ID!, $paragraphIndex: Int!, $content: String!) {
          addParagraphComment(bookId: $bookId, chapterId: $chapterId, paragraphIndex: $paragraphIndex, content: $content) { id }
        }''',
        variables: {'bookId': widget.bookId, 'chapterId': widget.chapterId, 'paragraphIndex': widget.paragraphIndex, 'content': content},
      );
      _input.clear();
      widget.onCountChanged();
      await _loader.currentState?.reload(silent: true);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _delete(String id) async {
    try {
      await context.services.api.run(
        r'mutation DeleteParagraphComment($id: ID!) { deleteParagraphComment(id: $id) { code message } }',
        variables: {'id': id},
      );
      widget.onCountChanged();
      await _loader.currentState?.reload(silent: true);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.services.auth.userId;
    return Container(
      margin: const EdgeInsets.only(top: 8, bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: BetikColors.charcoal, borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Paragraf Yorumları',
                  style: sans(size: 14, weight: FontWeight.w700, color: BetikColors.paperWhite),
                ),
              ),
              IconButton(
                tooltip: 'Yorumları kapat',
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.close, color: BetikColors.paperWhite, size: 20),
                onPressed: widget.onClose,
              ),
            ],
          ),
          Loader<List<SimpleComment>>(
            key: _loader,
            load: _load,
            errorBuilder: (context, error, retry) => TextButton(
              onPressed: retry,
              child: Text('Yorumlar yüklenemedi. Tekrar dene', style: sans(size: 13, color: BetikColors.paperWhite)),
            ),
            builder: (context, comments, _) => comments.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Text('Henüz yorum yok. İlk yorumu sen yap!', style: sans(size: 13, color: BetikColors.lightSmoke)),
                  )
                : Column(
                    children: [
                      for (final comment in comments)
                        Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: comment.id == widget.focusCommentId ? const Color(0xFF55483A) : const Color(0xFF3A3A3A),
                            borderRadius: BorderRadius.circular(8),
                          ),
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
                                      '@${comment.user?.username ?? ''} · ${relativeShort(comment.createdAt)}',
                                      style: sans(size: 12, color: BetikColors.lightSmoke),
                                    ),
                                    MentionText(comment.content, style: serif(size: 14, height: 1.5, color: BetikColors.paperWhite)),
                                  ],
                                ),
                              ),
                              if (me != null && comment.user?.id == me)
                                IconButton(
                                  tooltip: 'Yorumu sil',
                                  visualDensity: VisualDensity.compact,
                                  iconSize: 18,
                                  icon: const Icon(Icons.delete_outline, color: BetikColors.lightSmoke),
                                  onPressed: () => _delete(comment.id),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: 6),
          MentionField(controller: _input, hintText: 'Yorumunuzu yazın...', minLines: 2, maxLines: 5, dark: true),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: ListenableBuilder(
              listenable: _input,
              builder: (context, _) => FilledButton(
                style: FilledButton.styleFrom(backgroundColor: BetikColors.paperWhite, foregroundColor: BetikColors.inkBlack),
                onPressed: _input.text.trim().isEmpty ? null : _send,
                child: const Text('GÖNDER'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "Alıntı kaydet" (F-READ-08). Opened from the text-selection menu with
/// 10–1000 selected characters. A duplicate check runs first:
/// * not existing → **Kaydet** (`createQuote`);
/// * a public quote by someone else → **Yeniden paylaş** (`repostQuote`),
///   or choose "Sadece ben" to keep an own private copy;
/// * already mine / already reposted → notice with a link to my quotes.
Future<void> showQuoteSheet(
  BuildContext context, {
  required String text,
  required String bookId,
  required String bookTitle,
  required String chapterId,
  required String chapterTitle,
  required int chapterIndex,
  int? startOffset,
}) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  builder: (_) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: _QuoteSheet(
      text: text,
      bookId: bookId,
      bookTitle: bookTitle,
      chapterId: chapterId,
      chapterTitle: chapterTitle,
      chapterIndex: chapterIndex,
      startOffset: startOffset,
    ),
  ),
);

class _QuoteSheet extends StatefulWidget {
  const _QuoteSheet({
    required this.text,
    required this.bookId,
    required this.bookTitle,
    required this.chapterId,
    required this.chapterTitle,
    required this.chapterIndex,
    this.startOffset,
  });
  final String text;
  final String bookId;
  final String bookTitle;
  final String chapterId;
  final String chapterTitle;
  final int chapterIndex;
  final int? startOffset;

  @override
  State<_QuoteSheet> createState() => _QuoteSheetState();
}

class _QuoteSheetState extends State<_QuoteSheet> {
  final _note = TextEditingController();
  String _visibility = 'PUBLIC';
  bool _spoiler = false;
  bool _checking = true;
  Json? _existing;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _check();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _check() async {
    if (!context.services.auth.isSignedIn) {
      setState(() => _checking = false);
      return;
    }
    setState(() {
      _checking = true;
      _error = null;
    });
    try {
      final data = await context.services.api.run(
        r'''query CheckQuoteExists($text: String!, $bookId: ID!, $visibility: QuoteVisibility) {
          checkQuoteExists(text: $text, bookId: $bookId, visibility: $visibility) {
            exists quote { id text visibility user { id username profilePicture } likedBy repostedBy }
          }
        }''',
        variables: {'text': widget.text, 'bookId': widget.bookId, 'visibility': _visibility},
      );
      final result = jsonMap(data['checkQuoteExists']);
      if (!mounted) return;
      setState(() {
        _existing = result?['exists'] == true ? jsonMap(result?['quote']) : null;
        _checking = false;
      });
    } on ApiException {
      if (mounted) {
        setState(() {
          _checking = false;
          _error = 'Alıntı kontrol edilemedi. Yeniden deneyin.';
        });
      }
    }
  }

  bool get _mine {
    final me = context.services.auth.userId;
    final existing = _existing;
    if (existing == null || me == null) return false;
    return jsonMap(existing['user'])?['id'] == me || jsonIds(existing['repostedBy']).contains(me);
  }

  Future<void> _save() async {
    if (!requireMember(context, 'quote', bookTitle: widget.bookTitle, draft: widget.text)) return;
    final api = context.services.api;
    setState(() => _error = null);
    try {
      if (_existing != null && _visibility == 'PUBLIC') {
        await api.run(
          r'mutation RepostQuote($originalQuoteId: ID!, $repostComment: String, $isSpoiler: Boolean) { repostQuote(originalQuoteId: $originalQuoteId, repostComment: $repostComment, isSpoiler: $isSpoiler) { id } }',
          variables: {'originalQuoteId': _existing!['id'], 'repostComment': _note.text.trim(), 'isSpoiler': _spoiler},
        );
      } else {
        await api.run(
          r'''mutation CreateQuote($text: String!, $note: String, $bookId: ID!, $chapterId: ID, $chapterTitle: String, $chapterIndex: Int, $location: QuoteLocationInput, $isSpoiler: Boolean, $visibility: QuoteVisibility) {
            createQuote(text: $text, note: $note, bookId: $bookId, chapterId: $chapterId, chapterTitle: $chapterTitle, chapterIndex: $chapterIndex, location: $location, isSpoiler: $isSpoiler, visibility: $visibility) { id }
          }''',
          variables: {
            'text': widget.text,
            'note': _note.text.trim(),
            'bookId': widget.bookId,
            'chapterId': widget.chapterId,
            'chapterTitle': widget.chapterTitle,
            'chapterIndex': widget.chapterIndex,
            // The server only stores these offsets and no client reads them
            // back; the app sends offsets within the chapter's plain text.
            if (widget.startOffset != null)
              'location': {'startOffset': widget.startOffset, 'endOffset': widget.startOffset! + widget.text.length},
            'isSpoiler': _spoiler,
            'visibility': _visibility,
          },
        );
      }
      if (!mounted) return;
      setState(() => _success = _visibility == 'PRIVATE' ? 'Özel alıntı kaydedildi!' : 'Alıntı kaydedildi!');
      context.services.invalidateData();
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error.message.contains('QUOTE_EXISTS:') ? 'Bu alıntı seçtiğiniz görünürlükle zaten kaydedilmiş.' : error.message,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final existing = _existing;
    final owner = jsonMap(existing?['user'])?['username'];
    final blocked = existing != null && (_mine || _visibility == 'PRIVATE');
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Alıntı kaydet', style: serif(size: 20, weight: FontWeight.w700)),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              constraints: const BoxConstraints(maxHeight: 160),
              decoration: BoxDecoration(color: BetikColors.agedPaper, borderRadius: BorderRadius.circular(8)),
              child: SingleChildScrollView(
                child: Text('“${widget.text}”', style: serif(size: 15, style: FontStyle.italic, height: 1.55)),
              ),
            ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'PUBLIC', label: Text('Herkese açık')),
                ButtonSegment(value: 'PRIVATE', label: Text('Sadece ben')),
              ],
              selected: {_visibility},
              onSelectionChanged: (selection) {
                setState(() => _visibility = selection.first);
                _check();
              },
            ),
            const SizedBox(height: 10),
            if (_checking)
              const Padding(padding: EdgeInsets.all(8), child: LinearProgressIndicator())
            else if (existing != null && blocked)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Bu alıntı zaten kayıtlı.', style: sans(size: 14, weight: FontWeight.w600)),
                  TextButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      context.go('/profile?tab=quotes');
                    },
                    child: const Text('Profilimdeki alıntılar'),
                  ),
                ],
              )
            else ...[
              if (existing != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    '@$owner tarafından paylaşılmış',
                    style: sans(size: 13.5, color: BetikColors.rust, weight: FontWeight.w600),
                  ),
                ),
              MentionField(controller: _note, hintText: 'Not ekle... (isteğe bağlı)', maxLines: 4, maxLength: 1000),
              CheckboxListTile(
                value: _spoiler,
                onChanged: (value) => setState(() => _spoiler = value ?? false),
                title: const Text('Sürprizbozan içeriyor'),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                dense: true,
              ),
            ],
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(_error!, style: sans(size: 13, color: BetikColors.danger)),
              ),
            if (_success != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _success!,
                  style: sans(size: 14, weight: FontWeight.w700, color: BetikColors.success),
                ),
              ),
            if (!_checking && !blocked && _success == null)
              BusyButton(
                onPressed: _save,
                label: existing != null ? 'Yeniden paylaş' : (_visibility == 'PRIVATE' ? 'Özel olarak kaydet' : 'Kaydet'),
              ),
          ],
        ),
      ),
    );
  }
}
