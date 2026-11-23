import 'dart:async';
import 'dart:convert';

import 'package:betik/core/app_services.dart';
import 'package:betik/core/models/models.dart';
import 'package:betik/core/network/subscription_client.dart';
import 'package:betik/core/richtext/page_count.dart';
import 'package:betik/core/richtext/paragraphs.dart';
import 'package:betik/core/richtext/quill_html.dart';
import 'package:betik/core/richtext/rich_text.dart';
import 'package:betik/features/reader/reader_progress.dart';
import 'package:betik/features/reader/reading_tracker.dart';
import 'package:betik/features/writing/chapter_autosave.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stream_channel/stream_channel.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

List<Chapter> chapters(int count, {Set<int> gated = const {}}) => [
  for (var i = 0; i < count; i++)
    Chapter(
      id: 'c$i',
      title: 'Bölüm $i',
      canReadContent: !gated.contains(i),
      accessStatus: gated.contains(i) ? 'REGISTRATION_REQUIRED' : 'READABLE',
    ),
];

class FakeClock {
  int ms = 1000000;
  DateTime call() => DateTime.fromMillisecondsSinceEpoch(ms);
}

void main() {
  group('reader start position (port of resolveReaderProgress)', () {
    test('priority: link → bookmark → progress → first readable', () {
      final list = chapters(4);
      const bookmark = Bookmark(chapterId: 'c2', chapterIndex: 2, paragraphIndex: 5);
      final server = {
        'lastChapterId': 'c1',
        'completedChapters': ['c0'],
        'lastReadAt': '2026-11-14T10:00:00.000Z',
      };

      final link = resolveReaderProgress(chapters: list, bookmark: bookmark, server: server, requestedChapterId: 'c3');
      expect((link.chapterId, link.source, link.paragraphIndex), ('c3', 'link', null));

      final marked = resolveReaderProgress(chapters: list, bookmark: bookmark, server: server);
      expect((marked.chapterId, marked.source, marked.paragraphIndex), ('c2', 'bookmark', 5));
      expect(marked.completedChapterIds, ['c0', 'c1'], reason: 'earlier chapters count as completed');

      final progress = resolveReaderProgress(chapters: list, server: server);
      expect((progress.chapterId, progress.source), ('c1', 'progress'));

      final fresh = resolveReaderProgress(chapters: list);
      expect((fresh.chapterId, fresh.source), ('c0', 'default'));
    });

    test('a pending local record wins over a newer server record; otherwise the newer one', () {
      final list = chapters(3);
      final server = {
        'lastChapterId': 'c2',
        'completedChapters': ['c0', 'c1'],
        'lastReadAt': '2026-11-14T12:00:00.000Z',
      };
      final localPending = {
        'version': 2,
        'lastChapterId': 'c1',
        'completedChapterIds': ['c0'],
        'pending': true,
        'updatedAt': '2026-11-14T09:00:00.000Z',
      };
      final localSynced = {...localPending, 'pending': false};
      expect(resolveReaderProgress(chapters: list, local: localPending, server: server).chapterId, 'c1');
      expect(resolveReaderProgress(chapters: list, local: localSynced, server: server).chapterId, 'c2');
    });

    test('guests start at the first readable chapter; gated chapters are never completed', () {
      final list = chapters(3, gated: {1, 2});
      final resolved = resolveReaderProgress(
        chapters: list,
        local: {
          'lastChapterId': 'c2',
          'completedChapterIds': ['c0', 'c1'],
          'updatedAt': '2026-11-14T09:00:00.000Z',
        },
      );
      expect(resolved.completedChapterIds, ['c0']);
      expect(resolveReaderProgress(chapters: chapters(2, gated: {0})).chapterId, 'c1');
    });

    test('a shared chapter that no longer exists is reported', () {
      final resolved = resolveReaderProgress(chapters: chapters(2), requestedChapterId: 'gone');
      expect(resolved.missingSharedChapter, isTrue);
      expect(resolved.chapterId, 'c0');
    });

    test('legacy index-based records are understood; all-completed resumes on the last chapter', () {
      final resolved = resolveReaderProgress(
        chapters: chapters(3),
        local: {
          'completed': [0, 1, 2],
          'lastChapter': 9,
        },
      );
      expect(resolved.chapterId, 'c2');
      final done = resolveReaderProgress(
        chapters: chapters(2),
        server: {
          'completedChapters': ['c0', 'c1'],
          'lastReadAt': '2026-11-14T12:00:00.000Z',
        },
      );
      expect(done.chapterId, 'c1');
    });

    test('local record shape and guest migration', () async {
      final store = MemoryLocalStore();
      await writeLocalProgress(store, 'b1', null, chapterId: 'c1', completedChapterIds: ['c0'], pending: false);
      expect(store.values.keys.single, 'book-progress-guest-b1');
      final record = jsonDecode(store.values.values.single) as Map;
      expect(record['version'], 2);
      expect(record.keys, containsAll(['lastChapterId', 'completedChapterIds', 'pending', 'updatedAt']));
      await migrateGuestProgress(store, 'b1', 'u1');
      expect(store.values.keys.single, 'book-progress-u1-b1');
      expect(readLocalProgress(store, 'b1', 'u1')?['pending'], true, reason: 'adopted progress still has to be sent');
    });
  });

  group('progress writer', () {
    test('writes are serialised and only the latest state is sent after a slow request', () async {
      final sent = <String>[];
      final gate = Completer<void>();
      final statuses = <ProgressSyncStatus>[];
      final writer = ProgressWriter(
        save: (variables) async {
          sent.add(variables['chapterId'] as String);
          if (sent.length == 1) await gate.future;
        },
        onStatus: statuses.add,
      );
      writer.enqueue({'chapterId': 'c0'});
      final first = writer.flush();
      writer.enqueue({'chapterId': 'c1'});
      writer.enqueue({'chapterId': 'c2'});
      gate.complete();
      await first;
      expect(sent, ['c0', 'c2']);
      expect(statuses.last, ProgressSyncStatus.saved);
      await writer.flush();
      expect(sent, ['c0', 'c2'], reason: 'nothing new to send');
    });

    test('a failed save is reported and retried by the next flush', () async {
      var fail = true;
      final statuses = <ProgressSyncStatus>[];
      final writer = ProgressWriter(save: (_) async => fail ? throw StateError('offline') : null, onStatus: statuses.add);
      writer.enqueue({'chapterId': 'c0'});
      await writer.flush();
      expect(statuses.last, ProgressSyncStatus.error);
      expect(writer.hasUnsent, isTrue);
      fail = false;
      await writer.flush();
      expect(statuses.last, ProgressSyncStatus.saved);
      expect(writer.hasUnsent, isFalse);
    });
  });

  group('reading-time tracker (port of ReadingTracker)', () {
    ReadingTracker build(
      FakeClock clock,
      List<Map<String, dynamic>> reports,
      MemoryLocalStore store, {
      Object? Function(Map<String, dynamic>)? onReport,
      List<ReadingStatus>? statuses,
    }) {
      var session = 0;
      return ReadingTracker(
        userId: 'u1',
        bookId: 'b1',
        chapter: () => 'c0',
        store: store,
        now: clock.call,
        onStatus: statuses?.add,
        start: (_, _) async => 's${++session}',
        report: (packet) async {
          reports.add(Map.of(packet));
          final result = onReport?.call(packet);
          if (result is ReadingReportError) throw result;
          return packet['seconds'] as int;
        },
      );
    }

    test('one-second ticks accumulate; reports carry increasing sequence numbers and at most 60 s', () async {
      final clock = FakeClock();
      final reports = <Map<String, dynamic>>[];
      final tracker = build(clock, reports, MemoryLocalStore());
      await tracker.flush(); // opens the session
      expect(tracker.sessionId, 's1');
      for (var i = 0; i < 15; i++) {
        clock.ms += 1000;
        tracker.tick(true);
      }
      await tracker.flush();
      expect(reports, [
        {'sessionId': 's1', 'sequence': 1, 'seconds': 15, 'chapterId': 'c0'},
      ]);
      for (var i = 0; i < 75; i++) {
        clock.ms += 1000;
        tracker.activity();
        tracker.tick(true);
      }
      await tracker.flush();
      expect(reports.skip(1).map((r) => (r['sequence'], r['seconds'])), [(2, 60), (3, 15)]);
    });

    test('background time, long gaps and idle time are not counted', () async {
      final clock = FakeClock();
      final reports = <Map<String, dynamic>>[];
      final tracker = build(clock, reports, MemoryLocalStore());
      await tracker.flush();
      clock.ms += 1000;
      tracker.tick(false); // app in background
      clock.ms += 30000;
      tracker.tick(true); // one 30 s "tick" after a suspension is discarded
      expect(tracker.queueMs, 0);
      // Idle for more than 120 s: ticks stop counting until the next activity.
      for (var i = 0; i < 130; i++) {
        clock.ms += 1000;
        tracker.tick(true);
      }
      expect(tracker.queueMs, lessThanOrEqualTo(120000));
      final idleQueue = tracker.queueMs;
      clock.ms += 1000;
      tracker.tick(true);
      expect(tracker.queueMs, idleQueue);
      expect(tracker.idleMs, greaterThanOrEqualTo(90000));
    });

    test('a failed packet keeps its sequence number and is replayed', () async {
      final clock = FakeClock();
      final reports = <Map<String, dynamic>>[];
      var fail = true;
      final tracker = build(
        clock,
        reports,
        MemoryLocalStore(),
        onReport: (_) => fail ? ReadingReportError(terminal: false, replaced: false) : null,
      );
      await tracker.flush();
      for (var i = 0; i < 10; i++) {
        clock.ms += 1000;
        tracker.tick(true);
      }
      await tracker.flush();
      expect(tracker.pending?['sequence'], 1);
      fail = false;
      await tracker.flush();
      expect(reports.map((r) => r['sequence']), [1, 1]);
      expect(tracker.pending, isNull);
      expect(tracker.sequence, 1);
    });

    test('READING_SESSION_REPLACED stops tracking on this device', () async {
      final clock = FakeClock();
      final statuses = <ReadingStatus>[];
      final tracker = build(
        clock,
        [],
        MemoryLocalStore(),
        statuses: statuses,
        onReport: (_) => ReadingReportError(terminal: true, replaced: true),
      );
      await tracker.flush();
      clock.ms += 1000;
      tracker.tick(true);
      await tracker.flush();
      expect(statuses.last, ReadingStatus.paused);
      expect(tracker.stopped, isTrue);
      expect(tracker.sessionId, isNull);
    });

    test('unsent time left by an earlier reader is replayed within 120 s', () async {
      final clock = FakeClock();
      final store = MemoryLocalStore();
      await store.setString(
        'betik:reading:u1:b1:old',
        jsonEncode({'sessionId': 'old', 'sequence': 4, 'pending': null, 'queueMs': 12500, 'savedAt': clock.ms - 5000}),
      );
      await store.setString(
        'betik:reading:u1:b1:stale',
        jsonEncode({'sessionId': 'stale', 'sequence': 1, 'pending': null, 'queueMs': 9000, 'savedAt': clock.ms - 500000}),
      );
      final reports = <Map<String, dynamic>>[];
      final tracker = build(clock, reports, store);
      await tracker.open();
      expect(reports, [
        {'sessionId': 'old', 'sequence': 5, 'seconds': 12, 'chapterId': 'c0'},
      ]);
      expect(store.keys().where((key) => key.contains(':old') || key.contains(':stale')), isEmpty);
    });
  });

  group('chapter autosave (port of createChapterAutosave)', () {
    test('saves are serialised per session and a later edit is not lost', () async {
      final saved = <String>[];
      final gate = Completer<void>();
      final autosave = ChapterAutosave(
        save: (draft, content) async {
          saved.add(content);
          if (saved.length == 1) await gate.future;
        },
      );
      autosave.load([ChapterDraft(id: 'c1', title: 'Bir', content: '<p>a</p>')]);
      expect(autosave.selectedId, 'c1');
      autosave.edit('<p>ab</p>');
      expect(autosave.status, AutosaveStatus.pending);
      final first = autosave.flush();
      autosave.edit('<p>abc</p>');
      expect(autosave.status, AutosaveStatus.saving);
      gate.complete();
      await first;
      expect(saved, ['<p>ab</p>', '<p>abc</p>']);
      expect(autosave.status, AutosaveStatus.saved);
      autosave.dispose();
    });

    test('a failed save marks the chapter uncertain until a manual flush succeeds', () async {
      var fail = true;
      final autosave = ChapterAutosave(save: (_, _) async => fail ? throw StateError('offline') : null);
      autosave.load([ChapterDraft(id: 'c1', title: 'Bir', content: '')]);
      autosave.edit('<p>x</p>');
      await expectLater(autosave.flush(), throwsStateError);
      expect(autosave.status, AutosaveStatus.error);
      expect(autosave.hasUnsaved, isTrue);
      fail = false;
      await autosave.flush();
      expect(autosave.status, AutosaveStatus.saved);
      autosave.dispose();
    });

    test('a refetch never replaces text edited in this session', () {
      final autosave = ChapterAutosave(save: (_, _) async {});
      autosave.load([ChapterDraft(id: 'c1', title: 'Bir', content: '<p>sunucu</p>')]);
      autosave.edit('<p>yerel</p>');
      autosave.load([
        ChapterDraft(id: 'c1', title: 'Yeni ad', content: '<p>sunucu 2</p>', isHidden: true),
        ChapterDraft(id: 'c2', title: 'İki', content: ''),
      ]);
      expect(autosave.selected?.content, '<p>yerel</p>');
      expect(autosave.selected?.title, 'Yeni ad');
      expect(autosave.selected?.isHidden, isTrue);
      expect(autosave.chapters.map((chapter) => chapter.id), ['c1', 'c2']);
      autosave.dispose();
    });

    test('timer: 1.5 s after the last change', () async {
      final saved = <String>[];
      final autosave = ChapterAutosave(save: (_, content) async => saved.add(content), delay: const Duration(milliseconds: 40));
      autosave.load([ChapterDraft(id: 'c1', title: 'Bir', content: '')]);
      autosave.edit('<p>1</p>');
      await Future<void>.delayed(const Duration(milliseconds: 15));
      autosave.edit('<p>12</p>');
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(saved, ['<p>12</p>']);
      autosave.dispose();
    });
  });

  group('editor conversion beyond the web toolbar', () {
    test('an empty chapter is one empty line', () {
      expect(htmlToDelta('').ops, [
        {'insert': '\n'},
      ]);
      expect(deltaToHtml(htmlToDelta('').ops), '<p><br></p>');
    });

    test('allow-listed formats the web editor does not offer are kept as editable equivalents', () {
      const html =
          '<h3>Ara başlık</h3><p>H<sub>2</sub>O ve x<sup>2</sup> <code>kod</code></p>'
          '<pre class="ql-syntax" spellcheck="false">satır 1\nsatır 2\n</pre><hr><p>son</p>';
      final converted = htmlToDelta(html);
      expect(converted.warnings, isEmpty);
      expect(deltaToHtml(converted.ops), html);
    });

    test('non-Quill HTML is converted without losing text and is reported', () {
      const html = '<div>bir<br>iki</div><ul><li>a<ul><li>iç</li></ul></li></ul>metin';
      final converted = htmlToDelta(html);
      expect(converted.warnings, isNotEmpty);
      final plain = plainTextOf(deltaToHtml(converted.ops));
      for (final word in ['bir', 'iki', 'a', 'iç', 'metin']) {
        expect(plain, contains(word));
      }
      expect(roundTripsCleanly(html), isFalse);
      expect(deltaToHtml(converted.ops), contains('<li class="ql-indent-1">iç</li>'));
    });

    test('tag aliases are equivalent, not a change', () {
      expect(roundTripsCleanly('<p><b>kalın</b> <i>italik</i> <strike>çizili</strike></p>'), isTrue);
      expect(roundTripsCleanly('<p>düz</p>'), isTrue);
    });

    test('saving from the app yields the page count the website would compute for the same HTML', () {
      final ops = [
        for (var i = 0; i < 43; i++) {'insert': '$i. ${List.filled(60, 'kelime').join(' ')}\n'},
      ];
      final html = deltaToHtml(ops);
      expect(paragraphCount(html), 43);
      expect(computePageCount(html), greaterThan((plainTextOf(html).length / maxCharsPerPage).ceil() - 1));
      expect(computePageCount('<p><br></p>'), 1);
      expect(computePageCount(''), 0);
    });

    test('embedded image rules', () {
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(isSafeRasterDataUri(png), isTrue);
      expect(isSafeRasterDataUri('data:image/svg+xml;base64,PHN2Zz4='), isFalse);
      expect(isSafeRasterDataUri('data:image/png;base64,${'A' * 450004}'), isFalse);
      expect(
        isSafeRasterDataUri('data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'),
        isFalse,
        reason: 'declared type must match the bytes',
      );
      expect(hasChapterContent('<p><br></p><p> ​</p>'), isFalse);
      expect(hasChapterContent('<p>a</p>'), isTrue);
    });
  });

  group('graphql-transport-ws client', () {
    test('connection_init carries the bearer token; subscribe after ack; events are delivered; complete on cancel', () async {
      final controller = StreamChannelController<dynamic>(sync: true);
      final sentToServer = <Map<String, dynamic>>[];
      controller.foreign.stream.listen((raw) => sentToServer.add(jsonDecode(raw as String) as Map<String, dynamic>));
      final client = SubscriptionClient(
        url: 'ws://test/graphql',
        readToken: () => 'jwt-token',
        channelFactory: (uri, protocols) {
          expect(protocols, ['graphql-transport-ws']);
          return _FakeChannel(controller.local);
        },
      );
      final events = <Map<String, dynamic>>[];
      final subscription = client
          .subscribe('subscription S(\$id: ID!) { onNewMessage(conversationId: \$id) { id } }', variables: {'id': 'c1'})
          .listen(events.add);
      await Future<void>.delayed(Duration.zero);
      expect(sentToServer.single, {
        'type': 'connection_init',
        'payload': {'authorization': 'Bearer jwt-token'},
      });
      controller.foreign.sink.add(jsonEncode({'type': 'connection_ack'}));
      await Future<void>.delayed(Duration.zero);
      expect(sentToServer[1]['type'], 'subscribe');
      expect((sentToServer[1]['payload'] as Map)['variables'], {'id': 'c1'});
      final id = sentToServer[1]['id'];

      controller.foreign.sink.add(jsonEncode({'type': 'ping'}));
      controller.foreign.sink.add(
        jsonEncode({
          'id': id,
          'type': 'next',
          'payload': {
            'data': {
              'onNewMessage': {'id': 'm1'},
            },
          },
        }),
      );
      await Future<void>.delayed(Duration.zero);
      expect(sentToServer.any((message) => message['type'] == 'pong'), isTrue);
      expect(events.single['onNewMessage'], {'id': 'm1'});

      await subscription.cancel();
      await Future<void>.delayed(Duration.zero);
      expect(sentToServer.last, {'id': id, 'type': 'complete'});
      client.dispose();
    });

    test('at most five subscriptions per socket', () async {
      final client = SubscriptionClient(
        url: 'ws://test/graphql',
        readToken: () => null,
        channelFactory: (_, _) => _FakeChannel(StreamChannelController<dynamic>().local),
      );
      final streams = [for (var i = 0; i < 6; i++) client.subscribe('subscription { leaderboardUpdated }')];
      expect(client.activeCount, 5);
      await expectLater(streams.last.first, throwsStateError);
      client.dispose();
    });
  });
}

class _FakeChannel extends StreamChannelMixin<dynamic> implements WebSocketChannel {
  _FakeChannel(this._channel);
  final StreamChannel<dynamic> _channel;

  @override
  Stream<dynamic> get stream => _channel.stream;

  @override
  WebSocketSink get sink => _FakeSink(_channel.sink);

  @override
  int? get closeCode => null;

  @override
  String? get closeReason => null;

  @override
  String? get protocol => 'graphql-transport-ws';

  @override
  Future<void> get ready => Future.value();
}

class _FakeSink implements WebSocketSink {
  _FakeSink(this._sink);
  final StreamSink<dynamic> _sink;

  @override
  void add(dynamic event) => _sink.add(event);

  @override
  void addError(Object error, [StackTrace? stackTrace]) => _sink.addError(error, stackTrace);

  @override
  Future<dynamic> addStream(Stream<dynamic> stream) => _sink.addStream(stream);

  @override
  Future<dynamic> close([int? closeCode, String? closeReason]) => _sink.close();

  @override
  Future<dynamic> get done => _sink.done;
}
