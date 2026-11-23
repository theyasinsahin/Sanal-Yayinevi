import 'dart:async';

import 'package:flutter/foundation.dart';

/// Port of `Client/src/utils/chapterAutosave.js` (F-WRITE-05).
///
/// One editor session owns its drafts:
/// * a chapter is saved 1.5 s after the last change and at the latest 10 s
///   after the first unsaved change;
/// * saves are serialised; a failed save marks the chapter *uncertain* and
///   stops automatic retries until [flush] is called (the "Kaydet" button,
///   leaving the screen, coming back online);
/// * a refetch may refresh metadata and add chapters but never replaces
///   text edited in this session.
enum AutosaveStatus { saved, saving, pending, error }

class ChapterDraft {
  ChapterDraft({required this.id, required this.title, required this.content, this.isHidden = false, this.pageCount = 0, this.wordCount})
    : savedContent = content;

  final String id;
  String title;
  String content;
  String savedContent;
  bool isHidden;
  int pageCount;
  int? wordCount;
  bool touched = false;
  bool saving = false;
  bool uncertain = false;
  Object? error;
  int firstDirtyAt = 0;
  int changedAt = 0;

  bool get dirty => uncertain || content != savedContent;
}

typedef SaveChapter = Future<void> Function(ChapterDraft draft, String content);

class ChapterAutosave extends ChangeNotifier {
  ChapterAutosave({
    required this.save,
    this.delay = const Duration(milliseconds: 1500),
    this.maxWait = const Duration(seconds: 10),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final SaveChapter save;
  final Duration delay;
  final Duration maxWait;
  final DateTime Function() _now;

  final Map<String, ChapterDraft> _records = {};
  final Set<String> _deleted = {};
  List<String> _order = [];
  String? selectedId;
  Timer? _timer;
  Future<void>? _running;
  bool _disposed = false;

  int get _ms => _now().millisecondsSinceEpoch;

  List<ChapterDraft> get chapters => [
    for (final id in _order)
      if (_records[id] != null) _records[id]!,
  ];
  ChapterDraft? get selected => selectedId == null ? null : _records[selectedId];
  bool get hasUnsaved => _records.values.any((record) => record.dirty || record.saving);

  AutosaveStatus get status {
    if (_records.values.any((record) => record.saving)) return AutosaveStatus.saving;
    final pending = _records.values.where((record) => record.dirty);
    if (pending.any((record) => record.error != null)) return AutosaveStatus.error;
    return pending.isEmpty ? AutosaveStatus.saved : AutosaveStatus.pending;
  }

  Object? get error {
    for (final record in _records.values) {
      if (record.dirty && record.error != null) return record.error;
    }
    return null;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  void _schedule() {
    _stopTimer();
    final pending = _records.values.where((record) => record.dirty && record.error == null).toList();
    if (pending.isEmpty || _disposed) return;
    var due = 1 << 62;
    for (final record in pending) {
      final a = record.changedAt + delay.inMilliseconds;
      final b = record.firstDirtyAt + maxWait.inMilliseconds;
      final candidate = a < b ? a : b;
      if (candidate < due) due = candidate;
    }
    final wait = due - _ms;
    _timer = Timer(Duration(milliseconds: wait < 0 ? 0 : wait), () {
      _timer = null;
      flush(drain: false).catchError((Object _) {});
    });
  }

  Future<void> _persist(bool drain) async {
    do {
      final pending = _records.values.where((record) => record.dirty).toList();
      if (pending.isEmpty) break;
      for (final record in pending) {
        if (_deleted.contains(record.id) || !record.dirty) continue;
        final content = record.content;
        record
          ..saving = true
          ..error = null;
        _notify();
        try {
          await save(record, content);
          record
            ..savedContent = content
            ..uncertain = false
            ..saving = false;
          if (record.dirty) record.firstDirtyAt = record.changedAt;
        } catch (error) {
          record
            ..saving = false
            ..error = error
            ..uncertain = true
            ..firstDirtyAt = _ms;
          _notify();
          rethrow;
        }
        _notify();
      }
    } while (drain && hasUnsaved);
  }

  /// Saves everything that is unsaved. Throws when a save fails.
  Future<void> flush({bool drain = true}) {
    _stopTimer();
    final running = _running;
    if (running != null) {
      return running.then((_) => drain && hasUnsaved ? flush() : null, onError: (Object _) => drain && hasUnsaved ? flush() : null);
    }
    if (!hasUnsaved) return Future.value();
    late final Future<void> current;
    current = _persist(drain).whenComplete(() {
      if (identical(_running, current)) _running = null;
      _schedule();
    });
    _running = current;
    return current;
  }

  /// Merges the chapter list from the server.
  void load(List<ChapterDraft> incoming) {
    final wasEmpty = _order.isEmpty;
    _order = [
      for (final chapter in incoming)
        if (!_deleted.contains(chapter.id)) chapter.id,
    ];
    for (final chapter in incoming) {
      if (_deleted.contains(chapter.id)) continue;
      final existing = _records[chapter.id];
      if (existing == null) {
        _records[chapter.id] = chapter;
      } else if (!existing.touched) {
        existing
          ..title = chapter.title
          ..content = chapter.content
          ..savedContent = chapter.content
          ..isHidden = chapter.isHidden
          ..pageCount = chapter.pageCount
          ..wordCount = chapter.wordCount;
      } else {
        existing
          ..title = chapter.title
          ..isHidden = chapter.isHidden
          ..wordCount = chapter.wordCount;
      }
    }
    // Keep an unsaved draft even if a concurrent refetch omitted its chapter.
    for (final record in _records.values) {
      if (record.dirty && !_order.contains(record.id)) _order.add(record.id);
    }
    if (selectedId != null && !_order.contains(selectedId)) selectedId = null;
    if (selectedId == null && wasEmpty && _order.isNotEmpty) selectedId = _order.first;
    _notify();
  }

  /// The editor content of the selected chapter changed.
  void edit(String content) {
    final record = selected;
    if (record == null || content == record.content) return;
    final wasDirty = record.dirty;
    record
      ..content = content
      ..touched = true
      ..error = null
      ..changedAt = _ms;
    if (!wasDirty) record.firstDirtyAt = record.changedAt;
    _notify();
    _schedule();
  }

  void select(String id) {
    if (!_records.containsKey(id) || _deleted.contains(id)) return;
    selectedId = id;
    _notify();
  }

  void remove(String id) {
    _deleted.add(id);
    _records.remove(id);
    _order.remove(id);
    if (selectedId == id) selectedId = null;
    _notify();
    _schedule();
  }

  @override
  void dispose() {
    _disposed = true;
    _stopTimer();
    super.dispose();
  }
}
