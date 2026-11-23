import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'graphql_client.dart';

typedef ChannelFactory = WebSocketChannel Function(Uri uri, Iterable<String> protocols);

class _Subscription {
  _Subscription(this.id, this.document, this.variables, this.controller);
  final String id;
  final String document;
  final Json variables;
  final StreamController<Json> controller;
  bool sent = false;
}

/// `graphql-transport-ws` client (the protocol of `graphql-ws`, which the
/// backend speaks on `/graphql`).
///
/// Server rules reproduced here (Stage 1 `05` §8, `09` §1):
/// * subscriptions only; at most 5 per socket;
/// * `connection_init` must arrive within 5 s and carries
///   `{authorization: "Bearer <jwt>"}` (empty string for guests);
/// * a stream ends silently when the token expires or is revoked, so
///   [reset] must be called whenever the session changes;
/// * events are not replayed: after a reconnect callers refetch (see
///   [reconnects]).
class SubscriptionClient {
  SubscriptionClient({required this.url, required this.readToken, ChannelFactory? channelFactory})
    : _channelFactory = channelFactory ?? ((uri, protocols) => WebSocketChannel.connect(uri, protocols: protocols));

  static const maxSubscriptions = 5;

  final String url;
  final TokenReader readToken;
  final ChannelFactory _channelFactory;

  final Map<String, _Subscription> _subscriptions = {};
  final StreamController<void> _reconnects = StreamController<void>.broadcast();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _socketSubscription;
  Timer? _retryTimer;
  bool _acknowledged = false;
  bool _suspended = false;
  bool _disposed = false;
  int _attempt = 0;
  int _nextId = 0;
  bool _hadConnection = false;

  /// Fires after the socket was re-established, so that screens can refetch
  /// what they may have missed while disconnected.
  Stream<void> get reconnects => _reconnects.stream;

  @visibleForTesting
  int get activeCount => _subscriptions.length;

  /// Starts a subscription. The returned stream emits the `data` object of
  /// every event; cancelling the listener sends `complete`.
  Stream<Json> subscribe(String document, {Json variables = const {}}) {
    if (_subscriptions.length >= maxSubscriptions) {
      // The server closes sockets that exceed the limit; refuse locally.
      return Stream<Json>.error(StateError('En fazla $maxSubscriptions eşzamanlı abonelik açılabilir.'));
    }
    late final _Subscription subscription;
    final controller = StreamController<Json>(onCancel: () => _complete(subscription.id));
    subscription = _Subscription('${++_nextId}', document, variables, controller);
    _subscriptions[subscription.id] = subscription;
    controller.onListen = () {
      if (_acknowledged) {
        _send(subscription);
      } else {
        _connect();
      }
    };
    return controller.stream;
  }

  /// Drops the socket and reconnects with the current token. Call on login,
  /// logout and token replacement.
  void reset() {
    _teardown();
    if (_subscriptions.isNotEmpty && !_suspended) _connect();
  }

  /// App moved to the background: close the socket, keep the subscription
  /// list so [resume] can restore it.
  void suspend() {
    _suspended = true;
    _teardown();
  }

  void resume() {
    if (!_suspended) return;
    _suspended = false;
    if (_subscriptions.isNotEmpty) _connect();
  }

  void dispose() {
    _disposed = true;
    _teardown();
    for (final subscription in _subscriptions.values.toList()) {
      subscription.controller.close();
    }
    _subscriptions.clear();
    _reconnects.close();
  }

  void _connect() {
    if (_disposed || _suspended || _channel != null || url.isEmpty) return;
    _retryTimer?.cancel();
    final WebSocketChannel channel;
    try {
      channel = _channelFactory(Uri.parse(url), const ['graphql-transport-ws']);
    } catch (_) {
      _scheduleRetry();
      return;
    }
    _channel = channel;
    _acknowledged = false;
    _socketSubscription = channel.stream.listen(_onMessage, onError: (Object _) => _onClosed(), onDone: _onClosed, cancelOnError: true);
    final token = readToken();
    _write({
      'type': 'connection_init',
      'payload': {'authorization': token == null ? '' : 'Bearer $token'},
    });
  }

  void _onMessage(dynamic raw) {
    if (raw is! String) return;
    final Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      return;
    }
    if (decoded is! Map) return;
    switch (decoded['type']) {
      case 'connection_ack':
        _acknowledged = true;
        _attempt = 0;
        for (final subscription in _subscriptions.values) {
          _send(subscription);
        }
        if (_hadConnection) _reconnects.add(null);
        _hadConnection = true;
      case 'ping':
        _write({'type': 'pong'});
      case 'next':
        final subscription = _subscriptions[decoded['id']];
        final payload = decoded['payload'];
        if (subscription == null || payload is! Map) return;
        final data = payload['data'];
        if (data is Map && !subscription.controller.isClosed) {
          subscription.controller.add(Map<String, dynamic>.from(data));
        }
      case 'error':
      case 'complete':
        // The server ends a stream silently when access is lost (expired
        // token, revoked session, wrong access code). The subscription stays
        // registered so that a later reset()/reconnect retries it.
        final subscription = _subscriptions[decoded['id']];
        if (subscription != null) subscription.sent = false;
    }
  }

  void _send(_Subscription subscription) {
    if (subscription.sent || !subscription.controller.hasListener) return;
    subscription.sent = true;
    _write({
      'id': subscription.id,
      'type': 'subscribe',
      'payload': {'query': subscription.document, 'variables': subscription.variables},
    });
  }

  void _complete(String id) {
    final subscription = _subscriptions.remove(id);
    if (subscription == null) return;
    if (subscription.sent && _acknowledged) _write({'id': id, 'type': 'complete'});
    if (!subscription.controller.isClosed) subscription.controller.close();
    if (_subscriptions.isEmpty) _teardown();
  }

  void _write(Json message) {
    try {
      _channel?.sink.add(jsonEncode(message));
    } catch (_) {
      // The close handler schedules the retry.
    }
  }

  void _onClosed() {
    _clearSocket();
    if (_disposed || _suspended || _subscriptions.isEmpty) return;
    _scheduleRetry();
  }

  void _scheduleRetry() {
    _retryTimer?.cancel();
    // 1 s, 2 s, 4 s … capped at 30 s, with jitter so that many clients do
    // not reconnect in the same instant (20 sockets per IP on the server).
    final seconds = min(30, 1 << min(_attempt, 5));
    _attempt++;
    final delay = Duration(milliseconds: seconds * 1000 + Random().nextInt(400));
    _retryTimer = Timer(delay, _connect);
  }

  void _clearSocket() {
    _socketSubscription?.cancel();
    _socketSubscription = null;
    _channel = null;
    _acknowledged = false;
    for (final subscription in _subscriptions.values) {
      subscription.sent = false;
    }
  }

  void _teardown() {
    _retryTimer?.cancel();
    final channel = _channel;
    _clearSocket();
    channel?.sink.close();
  }
}
