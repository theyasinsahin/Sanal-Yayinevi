import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import 'messages_screen.dart';

/// "Betik’te mesajla gönder" (F-MSG-08): pick one of the **existing**
/// conversations, add an optional message and send the book or quote as an
/// attachment (`sendMessage(type: BOOK | QUOTE)`).
Future<void> showShareToChat(BuildContext context, {required String type, required String id, required String title}) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: _ShareToChat(type: type, id: id, title: title),
      ),
    );

class _ShareToChat extends StatefulWidget {
  const _ShareToChat({required this.type, required this.id, required this.title});
  final String type;
  final String id;
  final String title;

  @override
  State<_ShareToChat> createState() => _ShareToChatState();
}

class _ShareToChatState extends State<_ShareToChat> {
  final _search = TextEditingController();
  final _message = TextEditingController();
  String? _selected;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _search.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() => _error = null);
    try {
      await context.services.api.run(
        sendMessageMutation,
        variables: {
          'input': {
            'conversationId': _selected,
            'content': _message.text.trim(),
            'type': widget.type,
            if (widget.type == 'BOOK') 'attachedBookId': widget.id else 'attachedQuoteId': widget.id,
          },
        },
      );
      if (!mounted) return;
      setState(() => _sent = true);
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message.isEmpty ? 'Paylaşım gönderilemedi.' : error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.services.auth.userId;
    final query = trFold(_search.text.trim());
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.8),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(widget.type == 'BOOK' ? 'Kitabı paylaş' : 'Alıntıyı paylaş', style: serif(size: 20, weight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                widget.title,
                style: serif(size: 14, style: FontStyle.italic, color: BetikColors.graphite),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _search,
                decoration: const InputDecoration(hintText: 'Kişi ara...', prefixIcon: Icon(Icons.search)),
                onChanged: (_) => setState(() {}),
              ),
              Flexible(
                child: Loader<List<Conversation>>(
                  load: () async {
                    final data = await context.services.api.run(conversationsQuery);
                    return jsonList(data['getConversations']).map(Conversation.fromJson).toList();
                  },
                  builder: (context, conversations, _) {
                    final visible = conversations.where((conversation) {
                      final other = conversation.other(me);
                      return query.isEmpty ||
                          trFold(other?.fullName ?? '').contains(query) ||
                          trFold(other?.username ?? '').contains(query);
                    }).toList();
                    if (visible.isEmpty) return const EmptyView(title: 'Sonuç bulunamadı.');
                    return RadioGroup<String>(
                      groupValue: _selected,
                      onChanged: (value) => setState(() => _selected = value),
                      child: ListView(
                        shrinkWrap: true,
                        children: [
                          for (final conversation in visible)
                            RadioListTile<String>(
                              value: conversation.id,
                              contentPadding: EdgeInsets.zero,
                              secondary: UserAvatar.of(conversation.other(me), size: 34),
                              title: Text(conversation.other(me)?.displayName ?? 'Kullanıcı'),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _message,
                maxLines: 3,
                minLines: 1,
                decoration: const InputDecoration(hintText: 'Bir mesaj ekle... (isteğe bağlı)'),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(_error!, style: sans(size: 13, color: BetikColors.danger)),
                ),
              const SizedBox(height: 10),
              if (_sent)
                Text(
                  'Gönderildi ✓',
                  textAlign: TextAlign.center,
                  style: sans(size: 15, weight: FontWeight.w700, color: BetikColors.success),
                )
              else
                BusyButton(onPressed: _selected == null ? null : _send, label: 'Gönder'),
            ],
          ),
        ),
      ),
    );
  }
}
