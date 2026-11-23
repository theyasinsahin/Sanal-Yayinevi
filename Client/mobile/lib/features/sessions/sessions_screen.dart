import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/mentions.dart';
import '../../core/widgets/ui.dart';
import '../funding/funding_shared.dart' show Notice;
import '../share/share_sheet.dart';
import '../writing/image_upload.dart';

const _accessFields = 'status reason requestedAt reviewedAt reviewNote revision user { id username fullName email }';

class SessionCover extends StatelessWidget {
  const SessionCover(this.url, {super.key, this.height = 140});
  final String url;
  final double height;

  @override
  Widget build(BuildContext context) {
    final fallback = Image.asset('assets/images/session_default_cover.jpg', height: height, width: double.infinity, fit: BoxFit.cover);
    // The default cover is a root-relative path served by the web host; the
    // same picture is bundled so it shows without a configured web origin.
    if (url.isEmpty || url.startsWith('/images/sessions/')) return fallback;
    return NetImage(url, height: height, width: double.infinity, placeholder: fallback);
  }
}

class SessionCard extends StatelessWidget {
  const SessionCard(this.session, {super.key});
  final WritingSession session;

  @override
  Widget build(BuildContext context) => PaperCard(
    padding: EdgeInsets.zero,
    onTap: () => context.push('/session/${session.id}'),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SessionCover(session.coverImageUrl, height: 120),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  TagChip(session.typeLabel, dark: session.isPrivate),
                  if (!session.isActive) ...[const SizedBox(width: 6), const TagChip('Kapalı')],
                  const Spacer(),
                  Text(formatDate(session.createdAt), style: sans(size: 12, color: BetikColors.ashGray)),
                ],
              ),
              const SizedBox(height: 8),
              Text(trUpper(session.title), style: serif(size: 16, weight: FontWeight.w700, letterSpacing: 0.5)),
              if (session.description.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    session.description,
                    style: serif(size: 13.5, color: BetikColors.graphite, height: 1.45),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              if (session.tags.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(session.tags.map((tag) => '#$tag').join(' '), style: sans(size: 12.5, color: BetikColors.rust)),
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  UserAvatar.of(session.createdBy, size: 24),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(session.createdBy?.displayName ?? '', style: sans(size: 12.5, weight: FontWeight.w600)),
                  ),
                  Text('${session.participantCount} katılımcı', style: sans(size: 12.5, color: BetikColors.ashGray)),
                  if (session.isShareable)
                    IconButton(
                      tooltip: 'Oturumu paylaş',
                      visualDensity: VisualDensity.compact,
                      iconSize: 18,
                      icon: const Icon(Icons.ios_share),
                      onPressed: () => showShareSheet(context, type: 'SESSION', id: session.id),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// Oturumlar (F-SESS-01/02/03/14).
class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});
  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> with AutomaticKeepAliveClientMixin {
  static const _pageSize = 20;
  final _search = TextEditingController();
  final List<WritingSession> _sessions = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  Object? _error;

  @override
  bool get wantKeepAlive => true;

  late final ValueNotifier<int> _dataEpoch;

  @override
  void initState() {
    super.initState();
    _dataEpoch = context.services.dataEpoch..addListener(_reload);
    _reload();
  }

  @override
  void dispose() {
    _dataEpoch.removeListener(_reload);
    _search.dispose();
    super.dispose();
  }

  Future<List<WritingSession>> _fetch(int offset) async {
    final data = await context.services.api.run(
      'query GetSessions(\$limit: Int, \$offset: Int) { getSessions(limit: \$limit, offset: \$offset) { $sessionFields } }',
      variables: {'limit': _pageSize, 'offset': offset},
    );
    return jsonList(data['getSessions']).map(WritingSession.fromJson).toList();
  }

  Future<void> _reload() async {
    if (!mounted) return;
    setState(() {
      _loading = _sessions.isEmpty;
      _error = null;
    });
    try {
      final page = await _fetch(0);
      if (!mounted) return;
      setState(() {
        _sessions
          ..clear()
          ..addAll(page);
        _hasMore = page.length == _pageSize;
        _loading = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    }
  }

  Future<void> _more() async {
    setState(() => _loadingMore = true);
    try {
      final page = await _fetch(_sessions.length);
      if (!mounted) return;
      final known = _sessions.map((session) => session.id).toSet();
      setState(() {
        _sessions.addAll(page.where((session) => known.add(session.id)));
        _hasMore = page.length == _pageSize;
      });
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final auth = context.watch<AuthController>();
    // There is no server search: the box filters the sessions already
    // loaded (title, description, tags), as on the website.
    final query = trFold(_search.text.trim());
    final visible = query.isEmpty
        ? _sessions
        : _sessions
              .where(
                (session) =>
                    trFold(session.title).contains(query) ||
                    trFold(session.description).contains(query) ||
                    session.tags.any((tag) => trFold(tag).contains(query)),
              )
              .toList();
    return RefreshIndicator(
      onRefresh: _reload,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text('Yazı Oturumları', style: serif(size: 24, weight: FontWeight.w700)),
          Text(
            'Bir tema etrafında birlikte yazın, paylaşın.',
            style: serif(size: 14, style: FontStyle.italic, color: BetikColors.ashGray),
          ),
          const SizedBox(height: 12),
          SessionAccessPanel(key: ValueKey(auth.userId), onCreated: _reload),
          const SizedBox(height: 12),
          TextField(
            controller: _search,
            decoration: const InputDecoration(hintText: 'Başlık, açıklama veya etiket ara...', prefixIcon: Icon(Icons.search)),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(padding: EdgeInsets.only(top: 30), child: LoadingView())
          else if (_error != null)
            ErrorView(title: 'Oturumlar yüklenemedi.', message: errorMessage(_error!), onRetry: _reload)
          else if (visible.isEmpty)
            query.isEmpty
                ? const EmptyView(title: 'Henüz oturum yok', subtitle: 'İlk oturumu sen aç!')
                : const EmptyView(title: 'Aramanıza uygun oturum bulunamadı.')
          else ...[
            for (final session in visible) Padding(padding: const EdgeInsets.only(bottom: 12), child: SessionCard(session)),
            if (_hasMore)
              Center(
                child: OutlinedButton(onPressed: _loadingMore ? null : _more, child: Text(_loadingMore ? 'YÜKLENİYOR...' : 'DAHA FAZLA')),
              ),
          ],
        ],
      ),
    );
  }
}

/// Session-creation permission (F-SESS-02): NONE → request form, PENDING →
/// waiting + "Durumu yenile", REJECTED → note + re-request, APPROVED →
/// "+ Oturum Aç". Polled every 30 s like the website.
class SessionAccessPanel extends StatefulWidget {
  const SessionAccessPanel({super.key, required this.onCreated});
  final VoidCallback onCreated;

  @override
  State<SessionAccessPanel> createState() => _SessionAccessPanelState();
}

class _SessionAccessPanelState extends State<SessionAccessPanel> {
  final _reason = TextEditingController();
  final _loader = GlobalKey<LoaderState<Json>>();
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    final reason = _reason.text.trim();
    if (reason.length < 10 || reason.length > 1000) {
      return setState(() => _error = 'Lütfen en az 10 karakterlik bir açıklama yazın.');
    }
    setState(() => _error = null);
    try {
      await context.services.api.run(
        'mutation RequestSessionAccess(\$reason: String!) { requestSessionCreationAccess(reason: \$reason) { $_accessFields } }',
        variables: {'reason': reason},
      );
      _reason.clear();
      await _loader.currentState?.reload(silent: true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!context.services.auth.isSignedIn) {
      return PaperCard(
        color: BetikColors.sepiaLight,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Oturum oluşturma iznine ücretsiz başvurabilirsiniz.', style: sans(size: 13.5)),
            TextButton(
              onPressed: () => context.push('/login?returnTo=${Uri.encodeComponent('/sessions')}'),
              child: const Text('Başvurmak için giriş yapın'),
            ),
          ],
        ),
      );
    }
    return Loader<Json>(
      key: _loader,
      pollEvery: const Duration(seconds: 30),
      load: () async {
        final data = await context.services.api.run('query MySessionAccess { mySessionCreationAccess { $_accessFields } }');
        return Map<String, dynamic>.from(data['mySessionCreationAccess'] as Map);
      },
      errorBuilder: (context, error, retry) => Notice(errorMessage(error), error: true),
      builder: (context, access, loader) {
        final status = jsonString(access['status'], 'NONE');
        if (status == 'APPROVED') {
          return FilledButton.icon(
            onPressed: () async {
              final created = await showCreateSessionSheet(context);
              if (created == true) widget.onCreated();
            },
            icon: const Icon(Icons.add, size: 18),
            label: const Text('OTURUM AÇ'),
          );
        }
        if (status == 'PENDING') {
          return PaperCard(
            color: BetikColors.sepiaLight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Oturum açma başvurunuz yönetici onayını bekliyor.', style: sans(size: 13.5)),
                const SizedBox(height: 6),
                OutlinedButton(onPressed: () => loader.reload(silent: true), child: const Text('DURUMU YENİLE')),
              ],
            ),
          );
        }
        return PaperCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Oturum açmak ister misin?', style: serif(size: 17, weight: FontWeight.w700)),
              if (status == 'REJECTED') ...[
                const SizedBox(height: 6),
                Notice('Önceki başvurunuz onaylanmadı.${jsonString(access['reviewNote']).isEmpty ? '' : ' Not: ${access['reviewNote']}'}'),
              ],
              const SizedBox(height: 8),
              LabeledField(
                label: 'Nasıl oturumlar düzenlemek istiyorsunuz?',
                required: true,
                child: TextField(controller: _reason, minLines: 2, maxLines: 6, maxLength: 1000),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(_error!, style: sans(size: 13, color: BetikColors.danger)),
                ),
              BusyButton(onPressed: _request, label: status == 'REJECTED' ? 'Yeniden izin iste' : 'Oturum açma izni iste'),
            ],
          ),
        );
      },
    );
  }
}

/// Create-session sheet (F-SESS-03). Server limits: title ≤150, description
/// ≤500, private code 4–72 characters, cover must be a Cloudinary URL.
Future<bool?> showCreateSessionSheet(BuildContext context) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  builder: (context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: const _CreateSessionForm(),
  ),
);

class _CreateSessionForm extends StatefulWidget {
  const _CreateSessionForm();
  @override
  State<_CreateSessionForm> createState() => _CreateSessionFormState();
}

class _CreateSessionFormState extends State<_CreateSessionForm> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _code = TextEditingController();
  final _tag = TextEditingController();
  final List<String> _tags = [];
  String _type = 'OPEN';
  String _cover = '';
  String? _error;

  @override
  void dispose() {
    for (final controller in [_title, _description, _code, _tag]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _addTag() {
    final tag = _tag.text.trim().replaceAll('#', '');
    if (tag.isEmpty || _tags.contains(tag)) return;
    setState(() {
      _tags.add(tag);
      _tag.clear();
    });
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty) return setState(() => _error = 'Başlık zorunludur.');
    if (_type == 'PRIVATE' && _code.text.trim().length < 4) {
      return setState(() => _error = 'Erişim kodu en az 4 karakter olmalıdır.');
    }
    setState(() => _error = null);
    try {
      await context.services.api.run(
        'mutation CreateSession(\$input: CreateSessionInput!) { createSession(input: \$input) { $sessionFields } }',
        variables: {
          'input': {
            'title': _title.text.trim(),
            'description': _description.text.trim(),
            'coverImageUrl': _cover,
            'type': _type,
            'tags': _tags,
            if (_type == 'PRIVATE') 'accessCode': _code.text.trim(),
          },
        },
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Oturum Aç', style: serif(size: 20, weight: FontWeight.w700)),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Kapak (isteğe bağlı)',
            child: ImageUploadField(
              label: 'Kapak Yükle',
              currentImage: _cover,
              aspectRatio: 16 / 9,
              maxWidth: 1600,
              previewWidth: 160,
              onUploaded: (url) => setState(() => _cover = url),
              onRemoved: () => setState(() => _cover = ''),
            ),
          ),
          LabeledField(
            label: 'Başlık',
            required: true,
            child: TextField(
              controller: _title,
              maxLength: 150,
              decoration: const InputDecoration(counterText: ''),
            ),
          ),
          LabeledField(
            label: 'Açıklama',
            child: MentionField(controller: _description, hintText: 'Kısa bir açıklama ekleyin...', maxLength: 500, minLines: 2),
          ),
          LabeledField(
            label: 'Oturum türü',
            child: SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'OPEN', label: Text('Herkese Açık')),
                ButtonSegment(value: 'FOLLOWERS_ONLY', label: Text('Takipçilere')),
                ButtonSegment(value: 'PRIVATE', label: Text('Özel')),
              ],
              selected: {_type},
              onSelectionChanged: (selection) => setState(() => _type = selection.first),
            ),
          ),
          if (_type == 'PRIVATE')
            LabeledField(
              label: 'Erişim Kodu',
              required: true,
              hint: 'En az 4 karakter. Katılımcılarla siz paylaşırsınız.',
              child: TextField(
                controller: _code,
                maxLength: 72,
                autocorrect: false,
                decoration: const InputDecoration(counterText: ''),
              ),
            ),
          LabeledField(
            label: 'Etiketler',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _tag,
                        decoration: const InputDecoration(hintText: 'Etiket yazıp ekle...'),
                        onSubmitted: (_) => _addTag(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(onPressed: _addTag, child: const Text('EKLE')),
                  ],
                ),
                Wrap(
                  spacing: 6,
                  children: [for (final tag in _tags) InputChip(label: Text('#$tag'), onDeleted: () => setState(() => _tags.remove(tag)))],
                ),
              ],
            ),
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Notice(_error!, error: true)),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('İPTAL')),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: BusyButton(onPressed: _submit, label: 'Oturum Oluştur'),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
