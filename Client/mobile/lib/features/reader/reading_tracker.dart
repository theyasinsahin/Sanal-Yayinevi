import 'dart:async';
import 'dart:convert';

import '../../core/app_services.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';

/// Port of `Client/src/utils/readingTracker.js` (F-READ-05).
///
/// The server grants one point per accumulated 60 s of *verified* reading
/// and rejects malformed reports, so the client state machine must match:
/// * time is collected in 1-second ticks, only while the app is in the
///   foreground and the reader was touched within the last 120 s; a tick
///   longer than 2 s (app was suspended) is discarded;
/// * reports carry a strictly increasing `sequence` and 1–60 seconds; a
///   packet keeps its sequence number until the server acknowledges it;
/// * unsent time survives in local storage and is replayed within 120 s;
/// * `READING_SESSION_REPLACED` (reader opened elsewhere) stops tracking,
///   `READING_SESSION_EXPIRED` drops the session so that a new one starts.
enum ReadingStatus { inactive, tracking, saving, paused, error }

class ReadingReportError implements Exception {
  ReadingReportError({required this.terminal, required this.replaced});
  final bool terminal;
  final bool replaced;

  factory ReadingReportError.from(Object error) {
    final code = error is ApiException ? error.code : null;
    return ReadingReportError(
      terminal: const {'READING_SESSION_EXPIRED', 'READING_SESSION_REPLACED', 'BAD_USER_INPUT', 'UNAUTHENTICATED'}.contains(code),
      replaced: code == 'READING_SESSION_REPLACED',
    );
  }
}

typedef StartReadingSession = Future<String> Function(String bookId, String chapterId);

/// Sends one packet and returns the server's `acceptedSeconds`.
typedef ReportReadingTime = Future<int> Function(Json packet);

class ReadingTracker {
  ReadingTracker({
    required this.userId,
    required this.bookId,
    required this.chapter,
    required this.start,
    required this.report,
    required this.store,
    this.onStatus,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now {
    lastTick = _ms;
    lastActivity = _ms;
  }

  final String userId;
  final String bookId;

  /// Current chapter id at the time of a report.
  final String Function() chapter;
  final StartReadingSession start;
  final ReportReadingTime report;
  final LocalStore store;
  final void Function(ReadingStatus status)? onStatus;
  final DateTime Function() _now;

  String get prefix => 'betik:reading:$userId:$bookId:';

  String? sessionId;
  int queueMs = 0;
  int sequence = 0;
  Json? pending;
  late int lastTick;
  late int lastActivity;
  int lastConfirmedAt = 0;
  bool stopped = false;
  bool _sending = false;
  Future<void>? _opening;
  final List<Completer<void>> _waiters = [];

  int get _ms => _now().millisecondsSinceEpoch;
  String get _key => '$prefix$sessionId';

  void _persist() {
    if (sessionId == null) return;
    store.setString(
      _key,
      jsonEncode({'sessionId': sessionId, 'sequence': sequence, 'pending': pending, 'queueMs': queueMs, 'savedAt': _ms}),
    );
  }

  /// Replays buffers left by an earlier reader of the same book (younger
  /// than 120 s), then starts a new server session.
  Future<void> open() async {
    for (final key in store.keys().where((key) => key.startsWith(prefix)).toList()) {
      try {
        final old = Map<String, dynamic>.from(jsonDecode(store.getString(key) ?? 'null') as Map);
        if (_ms - (old['savedAt'] as num).toInt() < 120000) {
          var replaySequence = (old['sequence'] as num).toInt();
          final oldPending = old['pending'];
          if (oldPending is Map) {
            await report(Map<String, dynamic>.from(oldPending));
            replaySequence = (oldPending['sequence'] as num).toInt();
          }
          final seconds = _min(60, (old['queueMs'] as num).toInt() ~/ 1000);
          if (seconds > 0) {
            await report({'sessionId': old['sessionId'], 'sequence': replaySequence + 1, 'seconds': seconds, 'chapterId': chapter()});
          }
        }
        await store.remove(key);
      } on ReadingReportError catch (error) {
        if (!error.terminal) {
          onStatus?.call(ReadingStatus.error);
          return;
        }
        await store.remove(key);
      } catch (_) {
        // Unreadable buffer: nothing to replay.
        await store.remove(key);
      }
    }
    if (stopped) return;
    try {
      sessionId = await start(bookId, chapter());
      lastTick = _ms;
      lastActivity = _ms;
      lastConfirmedAt = _ms;
      onStatus?.call(ReadingStatus.tracking);
    } catch (_) {
      onStatus?.call(ReadingStatus.error);
    }
  }

  /// The reader was touched or scrolled.
  void activity() {
    lastActivity = _ms;
    if (sessionId != null && _ms - lastConfirmedAt >= 110000) flush();
  }

  /// Called once per second. [visible] is false while the app is not in the
  /// foreground.
  void tick(bool visible) {
    final now = _ms;
    final elapsed = now - lastTick;
    if (sessionId != null &&
        !stopped &&
        visible &&
        now - lastConfirmedAt < 120000 &&
        now - lastActivity <= 120000 &&
        elapsed >= 0 &&
        elapsed <= 2000) {
      queueMs += elapsed;
      _persist();
    }
    lastTick = now;
  }

  /// Milliseconds since the last interaction (idle banner at 90 s).
  int get idleMs => _ms - lastActivity;

  Future<void> flush({bool closing = false}) async {
    // A session without a confirmed report for 110 s is about to expire on
    // the server (120 s): drop it and open a fresh one.
    if (!closing &&
        !_sending &&
        sessionId != null &&
        pending == null &&
        queueMs < 1000 &&
        _ms - lastActivity < 120000 &&
        _ms - lastConfirmedAt >= 110000) {
      await store.remove(_key);
      sessionId = null;
      sequence = 0;
      queueMs = 0;
    }
    if (sessionId == null) {
      if (!closing && !stopped && _opening == null && _ms - lastActivity < 120000) {
        final opening = open().whenComplete(() => _opening = null);
        _opening = opening;
        await opening;
      }
      return;
    }
    if (_sending) {
      final waiter = Completer<void>();
      _waiters.add(waiter);
      return waiter.future;
    }
    _sending = true;
    try {
      while (pending != null || queueMs >= 1000) {
        if (pending == null) {
          final seconds = _min(60, queueMs ~/ 1000);
          queueMs -= seconds * 1000;
          pending = {'sessionId': sessionId, 'sequence': sequence + 1, 'seconds': seconds, 'chapterId': chapter()};
        }
        _persist();
        onStatus?.call(ReadingStatus.saving);
        final accepted = await report(pending!);
        if (accepted > 0) lastConfirmedAt = _ms;
        sequence = (pending!['sequence'] as num).toInt();
        pending = null;
        _persist();
      }
      onStatus?.call(ReadingStatus.tracking);
    } on ReadingReportError catch (error) {
      onStatus?.call(error.replaced ? ReadingStatus.paused : ReadingStatus.error);
      if (error.terminal) {
        await store.remove(_key);
        sessionId = null;
        pending = null;
        queueMs = 0;
        sequence = 0;
        if (error.replaced) stopped = true;
      }
    } catch (_) {
      onStatus?.call(ReadingStatus.error);
    } finally {
      _sending = false;
      for (final waiter in _waiters.splice()) {
        waiter.complete();
      }
    }
  }

  /// Leaving the reader: persist and send what is left.
  Future<void> stop() async {
    stopped = true;
    final opening = _opening;
    if (opening != null) await opening;
    _persist();
    await flush(closing: true);
  }
}

int _min(int a, int b) => a < b ? a : b;

extension<T> on List<T> {
  List<T> splice() {
    final copy = toList();
    clear();
    return copy;
  }
}

const startReadingSessionMutation = r'''
mutation StartReadingSession($bookId: ID!, $chapterId: ID!) { startReadingSession(bookId: $bookId, chapterId: $chapterId) { sessionId } }''';

const reportReadingTimeMutation = r'''
mutation ReportReadingTime($sessionId: String!, $sequence: Int!, $seconds: Int!, $chapterId: ID!) {
  reportReadingTime(sessionId: $sessionId, sequence: $sequence, seconds: $seconds, chapterId: $chapterId) {
    sequence acceptedSeconds earnedPoints
  }
}''';

/// Wires a [ReadingTracker] to the API with the website's 10-second request
/// deadline.
ReadingTracker createReadingTracker({
  required AppServices services,
  required String bookId,
  required String Function() chapter,
  void Function(ReadingStatus status)? onStatus,
}) {
  final api = services.api;
  return ReadingTracker(
    userId: services.auth.userId!,
    bookId: bookId,
    chapter: chapter,
    store: services.local,
    onStatus: onStatus,
    start: (book, chapterId) async {
      final data = await api
          .run(startReadingSessionMutation, variables: {'bookId': book, 'chapterId': chapterId})
          .timeout(const Duration(seconds: 10));
      return (data['startReadingSession'] as Map)['sessionId'] as String;
    },
    report: (packet) async {
      try {
        final data = await api.run(reportReadingTimeMutation, variables: packet).timeout(const Duration(seconds: 10));
        final result = data['reportReadingTime'];
        if (result is! Map) throw ApiException(ApiErrorKind.server, 'Okuma kaydı doğrulanamadı.');
        return (result['acceptedSeconds'] as num?)?.toInt() ?? 0;
      } catch (error) {
        throw ReadingReportError.from(error);
      }
    },
  );
}
