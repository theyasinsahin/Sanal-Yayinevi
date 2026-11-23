import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/auth/session.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../shell/shell.dart';

/// In-app destination of a notification, or null when it is not tappable.
/// Port of `Client/src/utils/notificationTarget.js` with the website's
/// legacy URLs replaced by the app's id-based routes (ids come in `meta`).
String? notificationTarget(AppNotification notification, SessionUser? user) {
  final meta = notification.meta;
  String? segment(Object? value) => value is String && value.isNotEmpty ? Uri.encodeComponent(value) : null;
  final bookId = segment(meta['bookId']);
  final chapterId = segment(meta['chapterId']);
  final userId = segment(meta['userId'] ?? meta['requesterId']);
  final commentId = segment(meta['commentId']);
  final entryId = segment(meta['entryId']);
  final sessionId = segment(meta['sessionId']);
  final quoteId = segment(meta['quoteId']);
  final isAdmin = user?.role == 'ADMIN';
  final paragraph = meta['paragraphIndex'];
  switch (notification.type) {
    case 'POINTS_EARNED':
      return null;
    case 'BOOK_REVIEW':
      return isAdmin ? '/admin/printed-books' : (bookId != null ? '/book/$bookId' : '/printed-books');
    case 'NEW_CHAPTER':
      return bookId == null ? null : '/reader/$bookId${chapterId != null ? '?chapter=$chapterId' : ''}';
    case 'BOOK_LIKED':
      return bookId == null ? null : '/book/$bookId';
    case 'COMMENT_RECEIVED' || 'COMMENT_MENTION':
      return bookId == null ? null : '/book/$bookId${commentId != null ? '?comment=$commentId' : '?comments=1'}';
    case 'PARAGRAPH_MENTION':
      return bookId != null && chapterId != null && paragraph is int && paragraph >= 0
          ? '/reader/$bookId?chapter=$chapterId&paragraph=$paragraph${commentId != null ? '&comment=$commentId' : ''}'
          : null;
    case 'QUOTE_MENTION':
      return quoteId == null ? null : '/quotes/$quoteId${commentId != null ? '?comment=$commentId' : ''}';
    case 'QUOTE_LIKED':
      return quoteId == null ? null : '/quotes/$quoteId';
    case 'SESSION_MENTION' || 'SESSION_REPLY':
      return sessionId == null ? null : '/session/$sessionId${entryId != null ? '?entry=$entryId' : ''}';
    case 'FOLLOW_REQUEST' || 'FOLLOW_REQUEST_ACCEPTED' || 'NEW_FOLLOWER':
      return userId == null ? null : '/user/$userId';
    case 'BADGE_EARNED':
      return '/profile';
    case 'PRINT_UPDATE':
      if (bookId != null) return meta['authorId'] == user?.id ? '/print/$bookId' : '/book/$bookId';
      return isAdmin ? '/admin/print-funding' : '/funding-history';
    case 'FUNDING_RECEIVED':
      return bookId != null ? '/print/$bookId' : '/funding-history';
    default:
      return null;
  }
}

/// Bildirimler (F-NOT-01/02/03). The backend has no push channel: this is
/// the same latest-20 list the website's bell shows, refreshed by polling.
/// Opening it marks everything as read.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _marked = false;

  Future<List<AppNotification>> _load() async {
    final services = context.services;
    final data = await services.api.run('query GetNotifications { getNotifications { id type meta title message icon isRead createdAt } }');
    final notifications = jsonList(data['getNotifications']).map(AppNotification.fromJson).toList();
    if (notifications.any((notification) => !notification.isRead) || !_marked) {
      _marked = true;
      try {
        await services.api.run('mutation MarkNotificationsRead { markNotificationsRead }');
        services.badges.clearNotifications();
      } on ApiException {
        // The badge is corrected by the next poll.
      }
    }
    return notifications;
  }

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return PageScaffold(
      title: 'Bildirimler',
      body: Loader<List<AppNotification>>(
        load: _load,
        pollEvery: const Duration(seconds: 15),
        refreshOn: services.badges.scoreTick,
        builder: (context, notifications, loader) => RefreshIndicator(
          onRefresh: () => loader.reload(silent: true),
          child: ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              FollowRequestsPanel(onChanged: () => loader.reload(silent: true)),
              if (notifications.isEmpty)
                const EmptyView(icon: Icons.notifications_none, title: 'Diğer bildirim yok.')
              else
                for (final notification in notifications)
                  () {
                    final target = notificationTarget(notification, services.auth.user);
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: BetikColors.agedPaper,
                        child: Text(
                          notification.icon?.isNotEmpty == true ? notification.icon! : '🔔',
                          style: const TextStyle(fontSize: 18),
                        ),
                      ),
                      title: Text(
                        notification.title,
                        style: sans(size: 14.5, weight: notification.isRead ? FontWeight.w600 : FontWeight.w800),
                      ),
                      subtitle: Text(notification.message, style: sans(size: 13, color: BetikColors.graphite, height: 1.35)),
                      trailing: Text(relativeShort(notification.createdAt), style: sans(size: 12, color: BetikColors.ashGray)),
                      tileColor: notification.isRead ? null : BetikColors.sepiaLight,
                      onTap: target == null ? null : () => context.push(target),
                    );
                  }(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pending incoming follow requests with Kabul Et / Reddet (F-NOT-03,
/// F-FOLLOW-02): 20 per page, polled every 15 s while only the first page
/// is loaded.
class FollowRequestsPanel extends StatefulWidget {
  const FollowRequestsPanel({super.key, required this.onChanged});
  final VoidCallback onChanged;

  @override
  State<FollowRequestsPanel> createState() => _FollowRequestsPanelState();
}

class _FollowRequestsPanelState extends State<FollowRequestsPanel> {
  static const _pageSize = 20;
  final _loader = GlobalKey<LoaderState<Json>>();
  final List<Json> _extra = [];
  String? _message;
  bool _moreError = false;

  Future<Json> _page(int offset) async {
    final data = await context.services.api.run(
      'query GetIncomingFollowRequests(\$limit: Int!, \$offset: Int!) { getIncomingFollowRequests(limit: \$limit, offset: \$offset) { total items { id status createdAt requester { $userFields } } } }',
      variables: {'limit': _pageSize, 'offset': offset},
    );
    return Map<String, dynamic>.from(data['getIncomingFollowRequests'] as Map);
  }

  Future<void> _respond(String requestId, bool accept) async {
    final services = context.services;
    try {
      final data = await services.api.run(
        r'mutation RespondToFollowRequest($requestId: ID!, $accept: Boolean!) { respondToFollowRequest(requestId: $requestId, accept: $accept) { code message followStatus request { id status } } }',
        variables: {'requestId': requestId, 'accept': accept},
      );
      if (!mounted) return;
      setState(() {
        _message = jsonString(jsonMap(data['respondToFollowRequest'])?['message'], 'İşlem tamamlandı.');
        _extra.removeWhere((item) => item['id'] == requestId);
      });
      await _loader.currentState?.reload(silent: true);
      services.invalidateData();
      widget.onChanged();
    } on ApiException catch (error) {
      if (mounted) setState(() => _message = error.message.isEmpty ? 'Takip isteği yanıtlanamadı.' : error.message);
    }
  }

  @override
  Widget build(BuildContext context) => Loader<Json>(
    key: _loader,
    load: () => _page(0),
    pollEvery: const Duration(seconds: 15),
    pollWhen: (_) => _extra.isEmpty,
    errorBuilder: (_, _, _) => const SizedBox.shrink(),
    builder: (context, data, _) {
      final first = jsonList(data['items']);
      final ids = first.map((item) => item['id']).toSet();
      final items = [...first, ..._extra.where((item) => !ids.contains(item['id']))];
      final total = jsonInt(data['total']);
      if (items.isEmpty && _message == null) return const SizedBox.shrink();
      return Container(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: BetikColors.paperWhite,
          border: Border.all(color: BetikColors.borderHeavy),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Takip İstekleri ($total)', style: sans(size: 14, weight: FontWeight.w700)),
            if (_message != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(_message!, style: sans(size: 12.5, color: BetikColors.graphite)),
              ),
            if (items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('Onay bekleyen takip isteği yok.', style: sans(size: 13, color: BetikColors.ashGray)),
              ),
            for (final item in items)
              () {
                final requester = UserSummary.maybe(item['requester']);
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: requester == null ? null : () => context.push('/user/${requester.id}'),
                        child: UserAvatar.of(requester, size: 36),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(requester?.displayName ?? 'Kullanıcı', style: sans(size: 13.5, weight: FontWeight.w700)),
                            Text('@${requester?.username ?? ''}', style: sans(size: 12, color: BetikColors.ashGray)),
                          ],
                        ),
                      ),
                      FilledButton(
                        style: FilledButton.styleFrom(minimumSize: const Size(0, 36), padding: const EdgeInsets.symmetric(horizontal: 10)),
                        onPressed: () => _respond(jsonString(item['id']), true),
                        child: const Text('KABUL ET'),
                      ),
                      const SizedBox(width: 6),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 36),
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                        onPressed: () => _respond(jsonString(item['id']), false),
                        child: const Text('REDDET'),
                      ),
                    ],
                  ),
                );
              }(),
            if (_moreError) Text('Diğer takip istekleri yüklenemedi.', style: sans(size: 12.5, color: BetikColors.danger)),
            if (items.length < total)
              TextButton(
                onPressed: () async {
                  try {
                    final next = await _page(items.length);
                    if (mounted) {
                      setState(() {
                        _extra.addAll(jsonList(next['items']));
                        _moreError = false;
                      });
                    }
                  } on ApiException {
                    if (mounted) setState(() => _moreError = true);
                  }
                },
                child: const Text('Diğer İstekler'),
              ),
          ],
        ),
      );
    },
  );
}
