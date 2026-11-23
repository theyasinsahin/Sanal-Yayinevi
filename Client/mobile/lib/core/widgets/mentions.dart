import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../app_services.dart';
import '../models/models.dart';
import '../network/api_error.dart';
import '../theme/app_theme.dart';
import 'ui.dart';

/// Same token rule as the server's `mentionedUsernames` and the web
/// `MentionInput`: `@` + 3–50 username characters, not preceded by a
/// username character.
final RegExp mentionPattern = RegExp(r'(?<![\p{L}\p{N}_.\-@])@([\p{L}\p{N}_][\p{L}\p{N}_.\-]{2,49})', unicode: true);

/// The partial `@token` immediately before the caret, if any.
final RegExp _activeToken = RegExp(r'(?:^|[^\p{L}\p{N}_.\-@])@([\p{L}\p{N}_.\-]{0,50})$', unicode: true);

String? activeMentionQuery(String text, int caret) {
  if (caret < 0 || caret > text.length) return null;
  return _activeToken.firstMatch(text.substring(0, caret))?.group(1);
}

/// Replaces the active token with `@username ` and returns the new value.
TextEditingValue insertMention(TextEditingValue value, String username) {
  final caret = value.selection.baseOffset < 0 ? value.text.length : value.selection.baseOffset;
  final before = value.text.substring(0, caret);
  final at = before.lastIndexOf('@');
  if (at < 0) return value;
  final replaced = '${before.substring(0, at)}@$username ';
  return TextEditingValue(
    text: replaced + value.text.substring(caret),
    selection: TextSelection.collapsed(offset: replaced.length),
  );
}

/// Text with clickable `@mentions` (plain text on the wire; rendering turns
/// them into profile links).
class MentionText extends StatefulWidget {
  const MentionText(this.text, {super.key, this.style, this.maxLines});
  final String text;
  final TextStyle? style;
  final int? maxLines;

  @override
  State<MentionText> createState() => _MentionTextState();
}

class _MentionTextState extends State<MentionText> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
    final style = widget.style ?? serif(size: 15, height: 1.55);
    final spans = <InlineSpan>[];
    var cursor = 0;
    for (final match in mentionPattern.allMatches(widget.text)) {
      if (match.start > cursor) spans.add(TextSpan(text: widget.text.substring(cursor, match.start)));
      final username = match.group(1)!;
      final recognizer = TapGestureRecognizer()..onTap = () => context.push('/yazar/${Uri.encodeComponent(username)}');
      _recognizers.add(recognizer);
      spans.add(
        TextSpan(
          text: '@$username',
          style: style.copyWith(color: BetikColors.rust, fontWeight: FontWeight.w700),
          recognizer: recognizer,
        ),
      );
      cursor = match.end;
    }
    if (cursor < widget.text.length) spans.add(TextSpan(text: widget.text.substring(cursor)));
    return Text.rich(
      TextSpan(style: style, children: spans),
      maxLines: widget.maxLines,
      overflow: widget.maxLines == null ? null : TextOverflow.ellipsis,
    );
  }
}

/// Text field with `@mention` autocomplete (F-COMM-06). Used by book
/// comments, replies, paragraph comments, quote notes, quote comments and
/// session entries.
class MentionField extends StatefulWidget {
  const MentionField({
    super.key,
    required this.controller,
    this.hintText,
    this.minLines = 1,
    this.maxLines = 5,
    this.maxLength,
    this.onSubmitted,
    this.enabled = true,
    this.showHint = true,
    this.focusNode,
    this.textInputAction,
    this.dark = false,
  });

  final TextEditingController controller;
  final String? hintText;
  final int minLines;
  final int maxLines;
  final int? maxLength;
  final VoidCallback? onSubmitted;
  final bool enabled;
  final bool showHint;
  final FocusNode? focusNode;
  final TextInputAction? textInputAction;
  final bool dark;

  @override
  State<MentionField> createState() => _MentionFieldState();
}

class _MentionFieldState extends State<MentionField> {
  Timer? _debounce;
  List<UserSummary> _suggestions = const [];
  bool _open = false;
  bool _searched = false;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged() {
    final value = widget.controller.value;
    final query = value.selection.isCollapsed ? activeMentionQuery(value.text, value.selection.baseOffset) : null;
    // The query needs a session; guests simply get no suggestions.
    if (query == null || !context.services.auth.isSignedIn) {
      _debounce?.cancel();
      if (_open) setState(() => _open = false);
      return;
    }
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () => _search(query));
  }

  Future<void> _search(String query) async {
    final generation = ++_generation;
    try {
      final data = await context.services.api.run(
        r'query SearchMentionUsers($query: String!) { searchMentionUsers(query: $query) { id username fullName profilePicture } }',
        variables: {'query': query},
      );
      if (!mounted || generation != _generation) return;
      setState(() {
        _suggestions = [
          for (final item in (data['searchMentionUsers'] as List? ?? const []))
            if (item is Map) UserSummary.fromJson(Map<String, dynamic>.from(item)),
        ];
        _open = true;
        _searched = true;
      });
    } on ApiException {
      if (mounted && generation == _generation) setState(() => _open = false);
    }
  }

  void _select(UserSummary user) {
    widget.controller.value = insertMention(widget.controller.value, user.username);
    setState(() => _open = false);
  }

  @override
  Widget build(BuildContext context) {
    final foreground = widget.dark ? BetikColors.paperWhite : BetikColors.inkBlack;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          enabled: widget.enabled,
          minLines: widget.minLines,
          maxLines: widget.maxLines,
          maxLength: widget.maxLength,
          textInputAction: widget.textInputAction,
          onSubmitted: widget.onSubmitted == null ? null : (_) => widget.onSubmitted!(),
          textCapitalization: TextCapitalization.sentences,
          style: serif(size: 15, color: foreground),
          decoration: InputDecoration(
            hintText: widget.hintText,
            fillColor: widget.dark ? const Color(0xFF3A3A3A) : null,
            hintStyle: widget.dark ? serif(size: 14, color: BetikColors.lightSmoke, style: FontStyle.italic) : null,
            counterText: widget.maxLength == null ? null : '',
          ),
        ),
        if (_open)
          Container(
            margin: const EdgeInsets.only(top: 4),
            constraints: const BoxConstraints(maxHeight: 220),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              border: Border.all(color: BetikColors.borderHeavy),
              borderRadius: BorderRadius.circular(8),
            ),
            // The suggestion rows are ListTiles: they need a Material surface
            // of their own for the background and the tap ink.
            child: Material(
              color: BetikColors.paperWhite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                    child: Text('Herkese açık hesaplar ve takipçilerin', style: label(size: 10.5)),
                  ),
                  if (_suggestions.isEmpty && _searched)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
                      child: Text('Etiketleyebileceğin bir kullanıcı bulunamadı.', style: sans(size: 13, color: BetikColors.ashGray)),
                    )
                  else
                    Flexible(
                      child: ListView(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        children: [
                          for (final user in _suggestions)
                            ListTile(
                              dense: true,
                              leading: UserAvatar.of(user, size: 30),
                              title: Text('@${user.username}', style: sans(size: 14, weight: FontWeight.w600)),
                              subtitle: user.fullName.isEmpty ? null : Text(user.fullName),
                              onTap: () => _select(user),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        if (widget.showHint)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Birini etiketlemek için @ yaz.',
              style: sans(size: 11.5, color: widget.dark ? BetikColors.lightSmoke : BetikColors.ashGray),
            ),
          ),
      ],
    );
  }
}
