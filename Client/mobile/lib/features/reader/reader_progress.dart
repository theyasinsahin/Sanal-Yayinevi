import 'dart:async';
import 'dart:convert';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/graphql_client.dart';

/// Port of `Client/src/utils/readerProgress.js` and of the persistence part
/// of `hooks/useReaderProgress.js`.
///
/// Resume is **per chapter** (Stage 2 S-02): the server stores the last
/// chapter and the completed set, never a scroll offset. Only a bookmark
/// carries a paragraph position.

String progressStorageKey(String bookId, String? userId) => 'book-progress-${userId ?? 'guest'}-$bookId';

/// Local record `{version: 2, lastChapterId, completedChapterIds, pending,
/// updatedAt}` — the same shape the website keeps in `localStorage`.
Json? readLocalProgress(LocalStore store, String bookId, String? userId) {
  final raw = store.getString(progressStorageKey(bookId, userId));
  if (raw == null) return null;
  try {
    final decoded = jsonDecode(raw);
    return decoded is Map ? Map<String, dynamic>.from(decoded) : null;
  } on FormatException {
    return null;
  }
}

Future<void> writeLocalProgress(
  LocalStore store,
  String bookId,
  String? userId, {
  required String chapterId,
  required List<String> completedChapterIds,
  required bool pending,
  DateTime? now,
}) => store.setString(
  progressStorageKey(bookId, userId),
  jsonEncode({
    'version': 2,
    'lastChapterId': chapterId,
    'completedChapterIds': completedChapterIds,
    'pending': pending,
    'updatedAt': (now ?? DateTime.now()).toUtc().toIso8601String(),
  }),
);

/// After sign-up the guest record of the book is adopted by the new account
/// (F-AUTH-10), unless the account already has its own record.
Future<void> migrateGuestProgress(LocalStore store, String bookId, String userId) async {
  final guestKey = progressStorageKey(bookId, null);
  final guest = store.getString(guestKey);
  if (guest == null) return;
  final ownKey = progressStorageKey(bookId, userId);
  if (store.getString(ownKey) == null) {
    try {
      final decoded = Map<String, dynamic>.from(jsonDecode(guest) as Map)..['pending'] = true;
      await store.setString(ownKey, jsonEncode(decoded));
    } catch (_) {
      // A corrupt guest record is simply dropped.
    }
  }
  await store.remove(guestKey);
}

class _Normalized {
  _Normalized(this.chapterId, this.completed, this.timestamp, this.pending);
  final String? chapterId;
  final List<String> completed;
  final int timestamp;
  final bool pending;
}

_Normalized? _normalize(Json? record, List<String> ids) {
  if (record == null) return null;
  Object? completed = record['completedChapterIds'] ?? record['completedChapters'];
  if (completed == null && record['completed'] is List) {
    // Oldest format: chapter indices.
    completed = [
      for (final index in record['completed'] as List)
        if (index is int && index >= 0 && index < ids.length) ids[index],
    ];
  }
  final completedIds = completed is List ? completed.map((id) => '$id').toSet() : <String>{};
  var chapterId = record['lastChapterId'] == null ? null : '${record['lastChapterId']}';
  final lastChapter = record['lastChapter'];
  if ((chapterId == null || chapterId.isEmpty) && lastChapter is int && lastChapter >= 0 && ids.isNotEmpty) {
    chapterId = ids[lastChapter < ids.length ? lastChapter : ids.length - 1];
  }
  final stamp = record['updatedAt'] ?? record['lastReadAt'] ?? record['timestamp'];
  var timestamp = 0;
  if (stamp is String) {
    // `Date.parse` of an ISO string; an epoch-millisecond *string* is NaN
    // there, i.e. 0.
    timestamp = DateTime.tryParse(stamp)?.millisecondsSinceEpoch ?? 0;
  }
  return _Normalized(
    ids.contains(chapterId) ? chapterId : null,
    ids.where(completedIds.contains).toList(),
    timestamp,
    record['pending'] == true,
  );
}

class ResolvedProgress {
  ResolvedProgress({
    required this.chapterId,
    required this.completedChapterIds,
    required this.paragraphIndex,
    required this.source,
    required this.missingSharedChapter,
  });

  final String? chapterId;
  final List<String> completedChapterIds;

  /// Paragraph to scroll to (bookmark resume only).
  final int? paragraphIndex;

  /// `link`, `bookmark`, `progress` or `default`.
  final String source;

  /// A chapter was requested by a link but is not part of the book any more.
  final bool missingSharedChapter;
}

/// Chooses the starting chapter: **link-requested chapter → server bookmark
/// → saved progress (a `pending` local record wins, otherwise the newer) →
/// first readable chapter**. When resuming from a bookmark or from
/// progress, every earlier chapter counts as completed.
ResolvedProgress resolveReaderProgress({
  required List<Chapter> chapters,
  Bookmark? bookmark,
  Json? local,
  Json? server,
  String? requestedChapterId,
}) {
  final ids = chapters.map((chapter) => chapter.id).toList();
  final candidates = [_normalize(local, ids), _normalize(server, ids)].whereType<_Normalized>().toList()
    ..sort((a, b) {
      final pending = (b.pending ? 1 : 0) - (a.pending ? 1 : 0);
      return pending != 0 ? pending : b.timestamp - a.timestamp;
    });
  final saved = candidates.isEmpty ? null : candidates.first;
  final completed = <String>{...?saved?.completed};
  final requestedIndex = requestedChapterId == null ? -1 : ids.indexOf(requestedChapterId);
  final bookmarkIndex = bookmark == null ? -1 : ids.indexOf(bookmark.chapterId);

  final firstReadable = chapters.indexWhere((chapter) => chapter.canReadContent);
  var index = firstReadable < 0 ? 0 : firstReadable;
  int? paragraphIndex;
  var source = 'default';

  if (requestedIndex >= 0) {
    index = requestedIndex;
    source = 'link';
  } else if (bookmarkIndex >= 0) {
    index = bookmarkIndex;
    source = 'bookmark';
    paragraphIndex = bookmark!.paragraphIndex >= 0 ? bookmark.paragraphIndex : null;
  } else if (saved != null) {
    if (saved.chapterId != null) {
      index = ids.indexOf(saved.chapterId!);
    } else {
      final firstOpen = ids.indexWhere((id) => !completed.contains(id));
      index = firstOpen < 0 ? 0 : firstOpen;
      if (ids.isNotEmpty && ids.every(completed.contains)) index = ids.length - 1;
    }
    source = 'progress';
  }
  if (source == 'bookmark' || source == 'progress') completed.addAll(ids.take(index));

  return ResolvedProgress(
    chapterId: index >= 0 && index < ids.length ? ids[index] : null,
    completedChapterIds: [
      for (final chapter in chapters)
        if (completed.contains(chapter.id) && chapter.canReadContent) chapter.id,
    ],
    paragraphIndex: paragraphIndex,
    source: source,
    missingSharedChapter: requestedChapterId != null && requestedChapterId.isNotEmpty && requestedIndex < 0,
  );
}

enum ProgressSyncStatus { saved, saving, error }

/// Serialises writes so that a slow response can never replace a newer
/// local selection (port of `ProgressWriter`).
class ProgressWriter {
  ProgressWriter({required this.save, this.onStatus});

  final Future<void> Function(Json variables) save;
  final void Function(ProgressSyncStatus status)? onStatus;

  Json? _latest;
  String _saved = '';
  Future<void>? _sending;

  void enqueue(Json variables) => _latest = variables;

  bool get hasUnsent => _latest != null && jsonEncode(_latest) != _saved;

  Future<void> flush() async {
    final inFlight = _sending;
    if (inFlight != null) {
      await inFlight;
      return flush();
    }
    final variables = _latest;
    if (variables == null) return;
    final signature = jsonEncode(variables);
    if (signature == _saved) return;
    final sending = () async {
      onStatus?.call(ProgressSyncStatus.saving);
      try {
        await save(variables);
        _saved = signature;
        onStatus?.call(ProgressSyncStatus.saved);
      } catch (_) {
        onStatus?.call(ProgressSyncStatus.error);
      }
    }();
    _sending = sending;
    await sending;
    _sending = null;
    final latest = _latest;
    if (latest != null && jsonEncode(latest) != signature) return flush();
  }
}

const saveReadingProgressMutation = r'''
mutation SaveReadingProgress($bookId: ID!, $chapterId: ID!, $completedChapterIds: [ID!]!) {
  saveReadingProgress(bookId: $bookId, chapterId: $chapterId, completedChapterIds: $completedChapterIds) {
    id lastChapterId completedChapters lastReadAt isCompleted
  }
}''';

const getReadingProgressQuery = r'''
query GetReadingProgress($bookId: ID!) {
  getReadingProgress(bookId: $bookId) { id lastChapterId completedChapters lastReadAt isCompleted }
}''';
