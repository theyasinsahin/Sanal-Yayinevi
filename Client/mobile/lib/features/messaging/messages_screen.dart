import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../shell/shell.dart';

const conversationsQuery = 'query GetConversations { getConversations { $conversationFields } }';

const _messagesQuery =
    '''
query GetMessages(\$conversationId: ID!, \$limit: Int, \$offset: Int) {
  getMessages(conversationId: \$conversationId, limit: \$limit, offset: \$offset) { $messageFields }
}''';

const _messageSubscription = '''
subscription OnNewMessage(\$conversationId: ID!) { onNewMessage(conversationId: \$conversationId) { $messageFields } }''';

const sendMessageMutation = 'mutation SendMessage(\$input: SendMessageInput!) { sendMessage(input: \$input) { $messageFields } }';

/// List preview of the last message (F-MSG-01).
String messagePreview(ChatMessage? message, String? myId) {
  if (message == null) return 'Henüz mesaj yok';
  final prefix = message.sender?.id == myId ? 'Sen: ' : '';
  return switch (message.type) {
    'BOOK' => '$prefix📖 Kitap paylaştı',
    'QUOTE' => '$prefix💬 Alıntı paylaştı',
    _ => '$prefix${message.content}',
  };
}

/// Mesajlar (F-MSG-01/02): conversations + "Takip ettiklerin".
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});
  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  static const _pageSize = 30;
  final _loader = GlobalKey<LoaderState<List<Conversation>>>();
  final _search = TextEditingController();
  Timer? _debounce;
  final List<UserSummary> _recipients = [];
  bool _hasMoreRecipients = false;
  bool _recipientsError = false;
  String? _opening;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _loadRecipients(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  /// People the member follows who accept messages (server rule).
  Future<void> _loadRecipients({bool reset = false}) async {
    final generation = reset ? ++_generation : _generation;
    try {
      final data = await context.services.api.run(
        'query GetMessageRecipients(\$search: String, \$limit: Int, \$offset: Int) { getMessageRecipients(search: \$search, limit: \$limit, offset: \$offset) { $userFields } }',
        variables: {'search': _search.text.trim(), 'limit': _pageSize, 'offset': reset ? 0 : _recipients.length},
      );
      if (!mounted || generation != _generation) return;
      final page = jsonList(data['getMessageRecipients']).map(UserSummary.fromJson).toList();
      setState(() {
        if (reset) _recipients.clear();
        final known = _recipients.map((user) => user.id).toSet();
        _recipients.addAll(page.where((user) => known.add(user.id)));
        _hasMoreRecipients = page.length == _pageSize;
        _recipientsError = false;
      });
    } on ApiException {
      if (mounted && generation == _generation) setState(() => _recipientsError = true);
    }
  }

  Future<void> _open(UserSummary user) async {
    setState(() => _opening = user.id);
    try {
      final data = await context.services.api.run(
        'query GetOrCreateConversation(\$recipientId: ID!) { getOrCreateConversation(recipientId: \$recipientId) { $conversationFields } }',
        variables: {'recipientId': user.id},
      );
      final id = jsonMap(data['getOrCreateConversation'])?['id'];
      if (!mounted || id is! String) return;
      await context.push('/messages/$id');
      _loader.currentState?.reload(silent: true);
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message.isEmpty ? 'Konuşma açılamadı. Tekrar deneyin.' : error.message, type: ToastType.error);
    } finally {
      if (mounted) setState(() => _opening = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    final me = services.auth.userId;
    final query = trFold(_search.text.trim());
    return PageScaffold(
      title: 'Mesajlar',
      body: Loader<List<Conversation>>(
        key: _loader,
        // New messages are pushed only into an open chat; the list is
        // refreshed whenever the unread counter changes (30 s polling) —
        // the website's list stays stale until reload (Stage 2 B-09).
        refreshOn: services.badges,
        load: () async {
          final data = await services.api.run(conversationsQuery);
          return jsonList(data['getConversations']).map(Conversation.fromJson).toList();
        },
        errorBuilder: (context, error, retry) => ErrorView(title: 'Mesajlar yüklenemedi.', message: errorMessage(error), onRetry: retry),
        builder: (context, conversations, loader) {
          final visible = query.isEmpty
              ? conversations
              : conversations.where((conversation) {
                  final other = conversation.other(me);
                  return trFold(other?.fullName ?? '').contains(query) || trFold(other?.username ?? '').contains(query);
                }).toList();
          final inConversation = conversations.map((conversation) => conversation.other(me)?.id).toSet();
          final recipients = _recipients.where((user) => !inConversation.contains(user.id)).toList();
          return RefreshIndicator(
            onRefresh: () async {
              await loader.reload(silent: true);
              await _loadRecipients(reset: true);
            },
            child: ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: TextField(
                    controller: _search,
                    maxLength: 120,
                    decoration: const InputDecoration(
                      hintText: 'Mesaj göndereceğin kişiyi ara',
                      counterText: '',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (_) {
                      setState(() {});
                      _debounce?.cancel();
                      _debounce = Timer(const Duration(milliseconds: 250), () => _loadRecipients(reset: true));
                    },
                  ),
                ),
                if (visible.isEmpty && recipients.isEmpty)
                  EmptyView(
                    icon: Icons.chat_bubble_outline,
                    title: query.isEmpty ? 'Henüz konuşman veya mesaj kabul eden bir takibin yok.' : 'Sonuç bulunamadı.',
                  ),
                for (final conversation in visible)
                  () {
                    final other = conversation.other(me);
                    return ListTile(
                      leading: UserAvatar.of(other, size: 44),
                      title: Text(other?.displayName ?? 'Kullanıcı', style: sans(size: 15, weight: FontWeight.w700)),
                      subtitle: Text(messagePreview(conversation.lastMessage, me), maxLines: 1, overflow: TextOverflow.ellipsis),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            conversationTime(conversation.lastMessage?.createdAt ?? conversation.updatedAt),
                            style: sans(size: 11.5, color: BetikColors.ashGray),
                          ),
                          if (conversation.unreadCount > 0)
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(color: BetikColors.messageBadge, borderRadius: BorderRadius.circular(999)),
                              child: Text(
                                conversation.unreadCount > 99 ? '99+' : '${conversation.unreadCount}',
                                style: sans(size: 11, weight: FontWeight.w700, color: Colors.white),
                              ),
                            ),
                        ],
                      ),
                      onTap: () async {
                        await context.push('/messages/${conversation.id}');
                        loader.reload(silent: true);
                      },
                    );
                  }(),
                if (recipients.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                    child: Text('TAKİP ETTİKLERİN', style: label(size: 11)),
                  ),
                  for (final user in recipients)
                    ListTile(
                      leading: UserAvatar.of(user, size: 40),
                      title: Text(user.displayName),
                      subtitle: Text(_opening == user.id ? 'Konuşma açılıyor...' : '@${user.username}'),
                      enabled: _opening == null,
                      onTap: () => _open(user),
                    ),
                ],
                if (_recipientsError)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text('Diğer kişiler yüklenemedi. Tekrar deneyin.', style: sans(size: 13, color: BetikColors.danger)),
                  ),
                if (_hasMoreRecipients)
                  Center(
                    child: TextButton(onPressed: _loadRecipients, child: const Text('Daha fazla kişi göster')),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Inserts [message] into the newest-first list unless it is already there
/// (own messages arrive from the mutation and from the subscription).
bool mergeMessage(List<ChatMessage> messages, ChatMessage message) {
  if (messages.any((existing) => existing.id == message.id)) return false;
  messages.insert(0, message);
  return true;
}

/// Sohbet (F-MSG-03…06, F-MSG-09).
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.conversationId});
  final String conversationId;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  static const _pageSize = 20;
  late final AppServices _services = context.services;
  final _input = TextEditingController();
  final _scroll = ScrollController();

  Conversation? _conversation;

  /// Newest first — the server's order; the list view is reversed so the
  /// newest message sits at the bottom.
  final List<ChatMessage> _messages = [];
  bool _loading = true;
  bool _loadingOlder = false;
  bool _hasOlder = false;
  Object? _error;
  String? _sendError;
  StreamSubscription<Json>? _subscription;
  StreamSubscription<void>? _reconnects;

  @override
  void initState() {
    super.initState();
    _load();
    _subscription = _services.subscriptions
        .subscribe(_messageSubscription, variables: {'conversationId': widget.conversationId})
        .listen(_onIncoming, onError: (Object _) {});
    // Messages sent while the socket was down are not replayed.
    _reconnects = _services.subscriptions.reconnects.listen((_) => _refreshNewest());
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _reconnects?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onIncoming(Json data) {
    final raw = jsonMap(data['onNewMessage']);
    if (raw == null || !mounted) return;
    final message = ChatMessage.fromJson(raw);
    setState(() {
      // Replace the optimistic bubble of an own message.
      if (message.sender?.id == _services.auth.userId) {
        _messages.removeWhere((existing) => existing.pending && existing.content == message.content);
      }
      mergeMessage(_messages, message);
    });
    if (message.sender?.id != _services.auth.userId) _markRead();
  }

  Future<List<ChatMessage>> _fetch(int offset) async {
    final data = await _services.api.run(
      _messagesQuery,
      variables: {'conversationId': widget.conversationId, 'limit': _pageSize, 'offset': offset},
    );
    return jsonList(data['getMessages']).map(ChatMessage.fromJson).toList();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _services.api.run(
        'query GetConversation(\$conversationId: ID!) { getConversation(conversationId: \$conversationId) { $conversationFields } }',
        variables: {'conversationId': widget.conversationId},
      );
      final raw = jsonMap(data['getConversation']);
      if (raw == null) throw ApiException(ApiErrorKind.notFound, 'Konuşma açılamadı.');
      final page = await _fetch(0);
      if (!mounted) return;
      setState(() {
        _conversation = Conversation.fromJson(raw);
        _messages
          ..clear()
          ..addAll(page);
        _hasOlder = page.length == _pageSize;
        _loading = false;
      });
      _markRead();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshNewest() async {
    try {
      final page = await _fetch(0);
      if (!mounted) return;
      setState(() {
        for (final message in page.reversed) {
          mergeMessage(_messages, message);
        }
      });
      _markRead();
    } on ApiException {
      // The next event or manual refresh catches up.
    }
  }

  Future<void> _loadOlder() async {
    setState(() => _loadingOlder = true);
    try {
      final offset = _messages.where((message) => !message.pending).length;
      final page = await _fetch(offset);
      if (!mounted) return;
      final known = _messages.map((message) => message.id).toSet();
      setState(() {
        _messages.addAll(page.where((message) => known.add(message.id)));
        _hasOlder = page.length == _pageSize;
      });
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _loadingOlder = false);
    }
  }

  Future<void> _markRead() async {
    try {
      await _services.api.run(
        r'mutation MarkMessagesAsRead($conversationId: ID!) { markMessagesAsRead(conversationId: $conversationId) }',
        variables: {'conversationId': widget.conversationId},
      );
      unawaited(_services.badges.refreshMessages());
    } on ApiException {
      // Unread counters are corrected by the next poll.
    }
  }

  Future<void> _send() async {
    final content = _input.text.trim();
    if (content.isEmpty) return;
    final me = _services.auth.user!;
    final optimistic = ChatMessage(
      id: 'pending-${DateTime.now().microsecondsSinceEpoch}',
      conversationId: widget.conversationId,
      content: content,
      sender: UserSummary(id: me.id, username: me.username, fullName: me.fullName),
      createdAt: DateTime.now(),
      pending: true,
    );
    setState(() {
      _messages.insert(0, optimistic);
      _sendError = null;
    });
    _input.clear();
    try {
      final data = await _services.api.run(
        sendMessageMutation,
        variables: {
          'input': {'conversationId': widget.conversationId, 'content': content, 'type': 'TEXT'},
        },
      );
      if (!mounted) return;
      final raw = jsonMap(data['sendMessage']);
      setState(() {
        _messages.removeWhere((message) => message.id == optimistic.id);
        if (raw != null) mergeMessage(_messages, ChatMessage.fromJson(raw));
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      // Nothing was sent: remove the bubble, restore the text, say why
      // (for example the recipient restricted messages).
      setState(() {
        _messages.removeWhere((message) => message.id == optimistic.id);
        _sendError = error.message.isEmpty ? 'Mesaj gönderilemedi.' : error.message;
      });
      if (_input.text.isEmpty) _input.text = content;
    }
  }

  Future<void> _delete(ChatMessage message) async {
    try {
      await _services.api.run(
        r'mutation DeleteMessage($messageId: ID!) { deleteMessage(messageId: $messageId) }',
        variables: {'messageId': message.id},
      );
      if (mounted) setState(() => _messages.removeWhere((existing) => existing.id == message.id));
    } on ApiException catch (error) {
      // The website only logs this failure (Stage 1 D-06).
      if (mounted) showToast(context, 'Silme başarısız: ${error.message}', type: ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = _services.auth.userId;
    final other = _conversation?.other(me);
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: GestureDetector(
          onTap: other == null ? null : () => context.push('/user/${other.id}'),
          child: Row(
            children: [
              UserAvatar.of(other, size: 34),
              const SizedBox(width: 10),
              Expanded(child: Text(other?.displayName ?? 'Sohbet', maxLines: 1, overflow: TextOverflow.ellipsis)),
            ],
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const LoadingView()
            : _error != null
            ? ErrorView(title: 'Mesajlar yüklenemedi.', message: errorMessage(_error!), onRetry: _load)
            : Column(
                children: [
                  Expanded(
                    child: _messages.isEmpty
                        ? const EmptyView(title: 'Henüz mesaj yok. Bir şeyler yaz!')
                        : ListView.builder(
                            controller: _scroll,
                            reverse: true,
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                            itemCount: _messages.length + (_hasOlder ? 1 : 0),
                            itemBuilder: (context, index) {
                              if (index == _messages.length) {
                                return Center(
                                  child: TextButton(
                                    onPressed: _loadingOlder ? null : _loadOlder,
                                    child: Text(_loadingOlder ? 'Yükleniyor...' : 'Daha eski mesajlar'),
                                  ),
                                );
                              }
                              final message = _messages[index];
                              final older = index + 1 < _messages.length ? _messages[index + 1] : null;
                              final date = message.createdAt?.toLocal();
                              final olderDate = older?.createdAt?.toLocal();
                              final newDay =
                                  date != null &&
                                  (olderDate == null ||
                                      olderDate.year != date.year ||
                                      olderDate.month != date.month ||
                                      olderDate.day != date.day);
                              return Column(
                                children: [
                                  if (newDay)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 8),
                                      child: Text(chatDayLabel(date), style: label(size: 10.5)),
                                    ),
                                  _Bubble(message: message, mine: message.sender?.id == me, onDelete: () => _delete(message)),
                                ],
                              );
                            },
                          ),
                  ),
                  if (_sendError != null)
                    Container(
                      width: double.infinity,
                      color: const Color(0xFFFDF2F2),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      child: Text(_sendError!, style: sans(size: 13, color: BetikColors.danger)),
                    ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
                    decoration: const BoxDecoration(
                      color: BetikColors.paperWhite,
                      border: Border(top: BorderSide(color: BetikColors.borderMedium)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _input,
                            minLines: 1,
                            maxLines: 5,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: const InputDecoration(hintText: 'Mesaj yaz...'),
                          ),
                        ),
                        ListenableBuilder(
                          listenable: _input,
                          builder: (context, _) => IconButton(
                            tooltip: 'Gönder',
                            icon: const Icon(Icons.send),
                            onPressed: _input.text.trim().isEmpty ? null : _send,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine, required this.onDelete});
  final ChatMessage message;
  final bool mine;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final foreground = mine ? BetikColors.paperWhite : BetikColors.inkBlack;
    final book = message.attachedBook;
    final quote = message.attachedQuote;
    final bubble = Container(
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.76),
      margin: const EdgeInsets.symmetric(vertical: 3),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
      decoration: BoxDecoration(
        color: mine ? BetikColors.inkBlack : BetikColors.paperWhite,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: BetikColors.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (book != null)
            InkWell(
              onTap: () => context.push('/book/${book['id']}'),
              child: Container(
                padding: const EdgeInsets.all(8),
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(color: BetikColors.agedPaper, borderRadius: BorderRadius.circular(8)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    BookCover(jsonString(book['imageUrl']), width: 40, radius: 3),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(jsonString(book['title']), style: serif(size: 13.5, weight: FontWeight.w700)),
                          Text(
                            jsonString(jsonMap(book['author'])?['fullName'], jsonString(jsonMap(book['author'])?['username'])),
                            style: sans(size: 12, color: BetikColors.ashGray),
                          ),
                          Text('Kitaba git →', style: sans(size: 12, weight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (quote != null)
            InkWell(
              onTap: () {
                final quoteBook = jsonMap(quote['book']);
                if (quoteBook != null) context.push('/book/${quoteBook['id']}');
              },
              child: Container(
                padding: const EdgeInsets.all(8),
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(color: BetikColors.agedPaper, borderRadius: BorderRadius.circular(8)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(() {
                      final text = jsonString(quote['text']);
                      return '“${text.length > 200 ? '${text.substring(0, 200)}…' : text}”';
                    }(), style: serif(size: 13.5, style: FontStyle.italic, height: 1.45)),
                    Text(
                      [
                        jsonString(jsonMap(quote['book'])?['title']),
                        jsonString(quote['chapterTitle']),
                      ].where((part) => part.isNotEmpty).join(' · '),
                      style: sans(size: 12, color: BetikColors.ashGray),
                    ),
                  ],
                ),
              ),
            ),
          if (message.content.isNotEmpty) SelectableText(message.content, style: sans(size: 14.5, color: foreground, height: 1.4)),
          const SizedBox(height: 2),
          Text(
            message.pending ? 'Gönderiliyor...' : formatTime(message.createdAt),
            style: sans(size: 10.5, color: mine ? BetikColors.lightSmoke : BetikColors.ashGray),
          ),
        ],
      ),
    );
    return Row(
      mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Only own messages have a menu, and it only offers "Sil": editing
        // exists in the API but not in the product (F-MSG-07).
        if (mine && !message.pending)
          PopupMenuButton<String>(
            tooltip: 'Mesaj seçenekleri',
            icon: const Icon(Icons.more_horiz, size: 18, color: BetikColors.ashGray),
            onSelected: (_) => onDelete(),
            itemBuilder: (_) => const [PopupMenuItem(value: 'delete', child: Text('Sil'))],
          ),
        bubble,
      ],
    );
  }
}
