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
import '../../core/widgets/mentions.dart';
import '../../core/widgets/ui.dart';
import '../share/share_sheet.dart';
import '../shell/shell.dart';
import '../writing/image_upload.dart';
import 'sessions_screen.dart';

const _entriesQuery =
    '''
query GetSessionEntries(\$sessionId: ID!, \$limit: Int, \$offset: Int, \$accessCode: String) {
  getSessionEntries(sessionId: \$sessionId, limit: \$limit, offset: \$offset, accessCode: \$accessCode) { $entryFields }
}''';

const _entrySubscription =
    '''
subscription OnNewSessionEntry(\$sessionId: ID!, \$accessCode: String) {
  onNewSessionEntry(sessionId: \$sessionId, accessCode: \$accessCode) { $entryFields }
}''';

/// Adds [entry] unless an entry with the same id is already present (own
/// posts arrive twice: mutation result and subscription event).
bool mergeEntry(List<SessionEntry> entries, SessionEntry entry) {
  if (entries.any((existing) => existing.id == entry.id)) return false;
  entries.add(entry);
  return true;
}

/// Oturum detayı (F-SESS-04…13).
class SessionDetailScreen extends StatefulWidget {
  const SessionDetailScreen({super.key, required this.sessionId, this.focusEntryId});
  final String sessionId;
  final String? focusEntryId;

  @override
  State<SessionDetailScreen> createState() => _SessionDetailScreenState();
}

class _SessionDetailScreenState extends State<SessionDetailScreen> {
  static const _pageSize = 30;
  late final AppServices _services = context.services;
  final _composer = TextEditingController();
  final _codeField = TextEditingController();
  final _focusKey = GlobalKey();

  WritingSession? _session;
  bool _loading = true;
  Object? _error;
  bool _denied = false;

  /// Kept in memory only, for this visit; sent with every entries / like /
  /// add / subscription call of a private session.
  String? _accessCode;
  String? _gateError;

  /// Server order (oldest first); shown reversed.
  final List<SessionEntry> _entries = [];
  bool _entriesLoading = false;
  bool _hasMore = false;
  Object? _entriesError;
  bool _focusMissing = false;
  bool _editingCover = false;
  String? _pendingCover;

  StreamSubscription<Json>? _subscription;
  StreamSubscription<void>? _reconnects;

  bool get _isCreator => _session?.createdBy?.id != null && _session!.createdBy!.id == _services.auth.userId;

  /// The website shows the code gate to the creator as well (Stage 1 D-07)
  /// although the server lets the creator read without it; the app skips
  /// the gate for the creator unless the server asks for the code.
  bool _forceGate = false;
  bool get _needsGate => _session != null && _session!.isPrivate && _accessCode == null && (!_isCreator || _forceGate);

  @override
  void initState() {
    super.initState();
    _services.auth.sessionEpoch.addListener(_load);
    // Events are not replayed after a dropped socket: refetch on reconnect.
    _reconnects = _services.subscriptions.reconnects.listen((_) => _loadEntries(reset: true));
    _load();
  }

  @override
  void dispose() {
    _services.auth.sessionEpoch.removeListener(_load);
    _subscription?.cancel();
    _reconnects?.cancel();
    _composer.dispose();
    _codeField.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
      _denied = false;
    });
    try {
      final data = await _services.api.run(
        'query GetSession(\$sessionId: ID!) { getSession(sessionId: \$sessionId) { $sessionFields } }',
        variables: {'sessionId': widget.sessionId},
      );
      if (!mounted) return;
      final raw = jsonMap(data['getSession']);
      setState(() {
        _session = raw == null ? null : WritingSession.fromJson(raw);
        _loading = false;
      });
      if (_session != null && !_needsGate) await _loadEntries(reset: true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        // A followers-only session refuses non-followers with an uncoded
        // error; the website ends up on its generic crash page (Stage 2
        // B-02). Anything that is not a transport problem is shown as the
        // access message the page was written to show.
        _denied = !error.isNetwork && error.kind != ApiErrorKind.rateLimited;
        _error = error;
      });
    }
  }

  Future<void> _loadEntries({bool reset = false}) async {
    final session = _session;
    if (session == null || _entriesLoading) return;
    setState(() {
      _entriesLoading = true;
      _entriesError = null;
    });
    try {
      final data = await _services.api.run(
        _entriesQuery,
        variables: {'sessionId': session.id, 'limit': _pageSize, 'offset': reset ? 0 : _entries.length, 'accessCode': _accessCode},
      );
      if (!mounted) return;
      final page = jsonList(data['getSessionEntries']).map(SessionEntry.fromJson).toList();
      setState(() {
        if (reset) _entries.clear();
        for (final entry in page) {
          mergeEntry(_entries, entry);
        }
        _hasMore = page.length == _pageSize;
        _entriesLoading = false;
      });
      _subscribe();
      await _ensureFocusedEntry();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _entriesLoading = false);
      if (session.isPrivate && !error.isNetwork) {
        // A code-related failure (changed code, or the server wants the
        // code from the creator after all) sends the visitor to the gate.
        setState(() {
          _gateError = _accessCode == null ? null : 'Erişim kodu hatalı.';
          _accessCode = null;
          _forceGate = true;
        });
      } else {
        setState(() => _entriesError = error);
      }
    }
  }

  /// Deep link `#entry-<id>` (F-SESS-12): fetch the entry when it is not in
  /// the loaded pages, then scroll to it.
  Future<void> _ensureFocusedEntry() async {
    final id = widget.focusEntryId;
    if (id == null || _focusMissing) return;
    if (!_entries.any((entry) => entry.id == id)) {
      try {
        final data = await _services.api.run(
          'query GetSessionEntry(\$sessionId: ID!, \$entryId: ID!, \$accessCode: String) { getSessionEntry(sessionId: \$sessionId, entryId: \$entryId, accessCode: \$accessCode) { $entryFields } }',
          variables: {'sessionId': widget.sessionId, 'entryId': id, 'accessCode': _accessCode},
        );
        final raw = jsonMap(data['getSessionEntry']);
        if (!mounted) return;
        if (raw == null) {
          setState(() => _focusMissing = true);
          return;
        }
        setState(() => mergeEntry(_entries, SessionEntry.fromJson(raw)));
      } on ApiException {
        if (mounted) setState(() => _focusMissing = true);
        return;
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _focusKey.currentContext;
      if (target != null) Scrollable.ensureVisible(target, duration: const Duration(milliseconds: 300), alignment: 0.2);
    });
  }

  void _subscribe() {
    if (_subscription != null) return;
    _subscription = _services.subscriptions
        .subscribe(_entrySubscription, variables: {'sessionId': widget.sessionId, 'accessCode': _accessCode})
        .listen((data) {
          final raw = jsonMap(data['onNewSessionEntry']);
          if (raw == null || !mounted) return;
          setState(() => mergeEntry(_entries, SessionEntry.fromJson(raw)));
        }, onError: (Object _) {});
  }

  Future<void> _verifyCode() async {
    final code = _codeField.text.trim();
    if (code.length < 4) return setState(() => _gateError = 'Erişim kodu en az 4 karakter olmalıdır.');
    setState(() => _gateError = null);
    try {
      final data = await _services.api.run(
        r'query VerifySessionAccessCode($sessionId: ID!, $accessCode: String!) { verifySessionAccessCode(sessionId: $sessionId, accessCode: $accessCode) }',
        variables: {'sessionId': widget.sessionId, 'accessCode': code},
      );
      if (!mounted) return;
      if (data['verifySessionAccessCode'] != true) return setState(() => _gateError = 'Erişim kodu hatalı.');
      setState(() => _accessCode = code);
      await _loadEntries(reset: true);
    } on ApiException catch (error) {
      // Attempts are limited to 10 per 15 minutes.
      if (mounted) setState(() => _gateError = error.message);
    }
  }

  Future<void> _post() async {
    final content = _composer.text.trim();
    if (content.isEmpty) return;
    try {
      final data = await _services.api.run(
        'mutation AddSessionEntry(\$sessionId: ID!, \$content: String!, \$accessCode: String) { addSessionEntry(sessionId: \$sessionId, content: \$content, accessCode: \$accessCode) { $entryFields } }',
        variables: {'sessionId': widget.sessionId, 'content': content, 'accessCode': _accessCode},
      );
      if (!mounted) return;
      _composer.clear();
      final raw = jsonMap(data['addSessionEntry']);
      if (raw != null) setState(() => mergeEntry(_entries, SessionEntry.fromJson(raw)));
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message.isEmpty ? 'Yazı gönderilemedi.' : error.message, type: ToastType.error);
    }
  }

  Future<void> _like(SessionEntry entry) async {
    // The website shows a toast here instead of the sign-up prompt used
    // elsewhere (Stage 1 D-08); kept as is.
    if (!_services.auth.isSignedIn) return showToast(context, 'Beğenmek için giriş yapmalısınız.');
    try {
      final data = await _services.api.run(
        'mutation ToggleSessionEntryLike(\$entryId: ID!, \$accessCode: String) { toggleSessionEntryLike(entryId: \$entryId, accessCode: \$accessCode) { $entryFields } }',
        variables: {'entryId': entry.id, 'accessCode': _accessCode},
      );
      final raw = jsonMap(data['toggleSessionEntryLike']);
      if (raw == null || !mounted) return;
      final index = _entries.indexWhere((existing) => existing.id == entry.id);
      if (index >= 0) setState(() => _entries[index] = SessionEntry.fromJson(raw));
    } on ApiException {
      if (mounted) showToast(context, 'Beğeni işlemi başarısız oldu.', type: ToastType.error);
    }
  }

  Future<void> _deleteEntry(SessionEntry entry) async {
    try {
      await _services.api.run(
        r'mutation DeleteSessionEntry($entryId: ID!) { deleteSessionEntry(entryId: $entryId) }',
        variables: {'entryId': entry.id},
      );
      if (!mounted) return;
      setState(() => _entries.removeWhere((existing) => existing.id == entry.id));
      showToast(context, 'Yazı silindi.', type: ToastType.success);
    } on ApiException {
      if (mounted) showToast(context, 'Yazı silinemedi.', type: ToastType.error);
    }
  }

  Future<void> _close() async {
    if (!await confirm(context, 'Oturumu kapatmak istediğinize emin misiniz?', confirmLabel: 'Kapat', destructive: true)) return;
    try {
      await _services.api.run(
        r'mutation CloseSession($sessionId: ID!) { closeSession(sessionId: $sessionId) }',
        variables: {'sessionId': widget.sessionId},
      );
      if (!mounted) return;
      _services.invalidateData();
      context.go('/sessions');
    } on ApiException {
      if (mounted) showToast(context, 'Oturum kapatılamadı.', type: ToastType.error);
    }
  }

  Future<void> _saveCover() async {
    try {
      final data = await _services.api.run(
        'mutation UpdateSessionCover(\$sessionId: ID!, \$coverImageUrl: String) { updateSessionCover(sessionId: \$sessionId, coverImageUrl: \$coverImageUrl) { $sessionFields } }',
        variables: {'sessionId': widget.sessionId, 'coverImageUrl': _pendingCover ?? ''},
      );
      if (!mounted) return;
      setState(() {
        _session = WritingSession.fromJson(Map<String, dynamic>.from(data['updateSessionCover'] as Map));
        _editingCover = false;
        _pendingCover = null;
      });
      _services.invalidateData();
      showToast(context, 'Kapak kaydedildi.', type: ToastType.success);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const PageScaffold(title: 'Oturum', body: LoadingView());
    if (_error != null) {
      return PageScaffold(
        title: 'Oturum',
        body: _denied
            ? EmptyView(
                icon: Icons.lock_outline,
                title: 'Bu oturuma erişim yetkiniz yok.',
                subtitle: 'Takipçilere özel oturumlar yalnızca oturum sahibinin takipçilerine açıktır.',
                action: OutlinedButton(onPressed: () => context.pop(), child: const Text('GERİ DÖN')),
              )
            : ErrorView.of(_error!, onRetry: _load),
      );
    }
    final session = _session;
    if (session == null) {
      return PageScaffold(
        title: 'Oturum',
        body: EmptyView(
          title: 'Oturum bulunamadı.',
          action: OutlinedButton(onPressed: () => context.go('/sessions'), child: const Text('OTURUMLARA DÖN')),
        ),
      );
    }
    if (_needsGate) return PageScaffold(title: session.title, body: _gate());

    final me = _services.auth.user;
    final canEditCover = _isCreator || (me?.isAdmin ?? false);
    final shown = _entries.reversed.toList();
    return PageScaffold(
      title: 'Oturum',
      actions: [
        if (session.isShareable)
          IconButton(
            tooltip: 'Oturumu paylaş',
            icon: const Icon(Icons.ios_share),
            onPressed: () => showShareSheet(context, type: 'SESSION', id: session.id),
          ),
      ],
      body: RefreshIndicator(
        onRefresh: () => _loadEntries(reset: true),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            ClipRRect(borderRadius: BorderRadius.circular(10), child: SessionCover(_pendingCover ?? session.coverImageUrl, height: 150)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                TagChip(session.typeLabel, dark: session.isPrivate),
                if (!session.isActive) const TagChip('Kapalı'),
                for (final tag in session.tags) TagChip('#$tag'),
              ],
            ),
            const SizedBox(height: 8),
            Text(session.title, style: serif(size: 24, weight: FontWeight.w700, height: 1.25)),
            if (session.description.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: MentionText(session.description)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: session.createdBy == null ? null : () => context.push('/user/${session.createdBy!.id}'),
              child: Row(
                children: [
                  UserAvatar.of(session.createdBy, size: 26),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${session.createdBy?.displayName ?? 'Kullanıcı'} · ${session.participantCount} katılımcı · ${_entries.length}${_hasMore ? '+' : ''} yazı',
                      style: sans(size: 13, color: BetikColors.graphite),
                    ),
                  ),
                ],
              ),
            ),
            if (canEditCover || (_isCreator && session.isActive))
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Wrap(
                  spacing: 8,
                  children: [
                    if (canEditCover)
                      OutlinedButton(
                        onPressed: () => setState(() {
                          _editingCover = !_editingCover;
                          _pendingCover = null;
                        }),
                        child: Text(_editingCover ? 'VAZGEÇ' : 'KAPAK FOTOĞRAFINI DÜZENLE'),
                      ),
                    if (_isCreator && session.isActive)
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: BetikColors.danger,
                          side: const BorderSide(color: BetikColors.danger, width: 2),
                        ),
                        onPressed: _close,
                        child: const Text('OTURUMU KAPAT'),
                      ),
                  ],
                ),
              ),
            if (_editingCover)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: PaperCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ImageUploadField(
                        label: 'Kapak Yükle',
                        currentImage: _pendingCover ?? session.coverImageUrl,
                        aspectRatio: 16 / 9,
                        maxWidth: 1600,
                        previewWidth: 160,
                        onUploaded: (url) => setState(() => _pendingCover = url),
                        onRemoved: () => setState(() => _pendingCover = ''),
                      ),
                      const SizedBox(height: 8),
                      BusyButton(onPressed: _saveCover, label: 'Kapağı kaydet'),
                    ],
                  ),
                ),
              ),
            const OrnamentDivider(),
            if (!session.isActive)
              const Padding(padding: EdgeInsets.only(bottom: 12), child: Text('Bu oturum kapatılmıştır. Yeni yazı eklenemez.'))
            else if (me == null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: OutlinedButton(
                  onPressed: () => context.push('/login?returnTo=${Uri.encodeComponent('/session/${session.id}')}'),
                  child: const Text('YAZI PAYLAŞMAK İÇİN GİRİŞ YAP'),
                ),
              )
            else ...[
              MentionField(controller: _composer, hintText: 'Düşüncelerini yaz...', minLines: 2, maxLines: 10, maxLength: 5000),
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerRight,
                child: ListenableBuilder(
                  listenable: _composer,
                  builder: (context, _) => BusyButton(onPressed: _composer.text.trim().isEmpty ? null : _post, label: 'Paylaş'),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (_focusMissing)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  'Etiketlendiğiniz ileti bulunamadı veya artık erişilebilir değil.',
                  style: sans(size: 13, color: BetikColors.danger),
                ),
              ),
            if (_entriesError != null)
              ErrorView.of(_entriesError!, onRetry: () => _loadEntries(reset: true), title: 'Yazılar yüklenemedi')
            else if (shown.isEmpty && !_entriesLoading)
              const EmptyView(title: 'Henüz yazı yok', subtitle: 'İlk yazıyı sen paylaş!')
            else
              for (final entry in shown)
                _EntryCard(
                  key: entry.id == widget.focusEntryId ? _focusKey : ValueKey(entry.id),
                  entry: entry,
                  mine: entry.user?.id == me?.id,
                  myId: me?.id,
                  highlighted: entry.id == widget.focusEntryId,
                  onLike: () => _like(entry),
                  onDelete: () => _deleteEntry(entry),
                ),
            if (_entriesLoading) const Padding(padding: EdgeInsets.all(16), child: LoadingView()),
            if (_hasMore && !_entriesLoading)
              Center(
                child: OutlinedButton(onPressed: _loadEntries, child: const Text('DİĞER İLETİLERİ YÜKLE')),
              ),
          ],
        ),
      ),
    );
  }

  Widget _gate() => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: PaperCard(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '🔒 Özel Oturum',
              style: serif(size: 20, weight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'Bu oturuma katılmak için erişim kodu gereklidir.',
              style: sans(size: 14, color: BetikColors.graphite),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _codeField,
              obscureText: true,
              autocorrect: false,
              decoration: InputDecoration(hintText: 'Erişim kodu...', errorText: _gateError),
              onSubmitted: (_) => _verifyCode(),
            ),
            const SizedBox(height: 10),
            BusyButton(onPressed: _verifyCode, label: 'Katıl'),
            TextButton(onPressed: () => context.pop(), child: const Text('← Oturumlara Dön')),
          ],
        ),
      ),
    ),
  );
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({
    super.key,
    required this.entry,
    required this.mine,
    required this.myId,
    required this.highlighted,
    required this.onLike,
    required this.onDelete,
  });
  final SessionEntry entry;
  final bool mine;
  final String? myId;
  final bool highlighted;
  final VoidCallback onLike;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final liked = myId != null && entry.likedBy.contains(myId);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(12, 10, 4, 4),
      decoration: BoxDecoration(
        color: highlighted ? BetikColors.sepiaLight : BetikColors.paperWhite,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: highlighted ? BetikColors.rust : BetikColors.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              UserAvatar.of(entry.user, size: 30),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: entry.user == null ? null : () => context.push('/user/${entry.user!.id}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(entry.user?.displayName ?? 'Kullanıcı', style: sans(size: 13.5, weight: FontWeight.w700)),
                          ),
                          if (mine) ...[const SizedBox(width: 6), Text('SEN', style: label(size: 10, color: BetikColors.rust))],
                        ],
                      ),
                      Text(formatDayMonthTime(entry.createdAt), style: sans(size: 11.5, color: BetikColors.ashGray)),
                    ],
                  ),
                ),
              ),
              if (mine)
                PopupMenuButton<String>(
                  tooltip: 'Seçenekler',
                  icon: const Icon(Icons.more_horiz),
                  onSelected: (_) => onDelete(),
                  itemBuilder: (_) => const [PopupMenuItem(value: 'delete', child: Text('Yazıyı Sil'))],
                ),
            ],
          ),
          Padding(padding: const EdgeInsets.only(top: 8, right: 8), child: MentionText(entry.content)),
          TextButton.icon(
            onPressed: onLike,
            icon: Icon(
              liked ? Icons.favorite : Icons.favorite_border,
              size: 18,
              color: liked ? BetikColors.notificationBadge : BetikColors.ashGray,
            ),
            label: Text(formatCount(entry.likeCount), style: sans(size: 12.5, color: BetikColors.graphite)),
          ),
        ],
      ),
    );
  }
}
