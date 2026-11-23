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
import '../../core/widgets/ui.dart';
import '../book/book_card.dart';
import '../printed/printed_detail.dart';
import '../quotes/quotes_screen.dart';
import '../share/share_sheet.dart';
import '../shell/shell.dart';
import '../writing/image_upload.dart';
import 'settings.dart';

const _profileBookFields =
    '''
$fundingSummaryFields
publicPath kind printedAuthor publisher publicationYear isbn status digitalStatus writingStatus id title
author { $userFields }
imageUrl description pageCount
$classificationFields
stats { views shares likes }''';

const _profileQuery =
    '''
query GetUserById(\$id: ID!) {
  getUserById(id: \$id) {
    followStatus canViewProfile canViewLibrary canViewFollowList canMessage isSearchIndexable weeklyWritingWords isVerified publicPath
    privacySettings { isProfilePublic isLibraryPublic isFollowListPublic allowMessages showInSearchEngines }
    notificationSettings { newFollower mentionInSession mentionInComment bookComment bookLike quoteLike sessionReply }
    authorSettings { copyrightNote weeklyWordGoal preferredGenres }
    id username fullName email role bio profilePicture
    usersBooks { $_profileBookFields }
    followers { $userFields }
    following { $userFields }
  }
}''';

const _followAction = 'code message followStatus request { id status }';

/// The registration rule for usernames, applied to profile edits as well:
/// the server does not validate this path (Stage 1 K-09).
final RegExp usernamePattern = RegExp(r'^[\p{L}\p{N}_][\p{L}\p{N}_.\-]{2,49}$', unicode: true);

/// Own profile tab: guests are asked to sign in.
class OwnProfileTab extends StatelessWidget {
  const OwnProfileTab({super.key, this.initialTab});
  final String? initialTab;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final id = auth.userId;
    if (id == null) return const SignInRequired(returnTo: '/profile', message: 'Profilinizi görmek için giriş yapmalısınız.');
    return ProfileView(key: ValueKey(id), userId: id, initialTab: initialTab);
  }
}

class UserProfileScreen extends StatelessWidget {
  const UserProfileScreen({super.key, required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Profil',
    body: ProfileView(userId: userId),
  );
}

class ProfileView extends StatefulWidget {
  const ProfileView({super.key, required this.userId, this.initialTab});
  final String userId;
  final String? initialTab;

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  final _loader = GlobalKey<LoaderState<Json?>>();
  late String _tab = widget.initialTab ?? 'published';
  bool _editing = false;

  bool get _isOwn => context.services.auth.userId == widget.userId;

  Future<Json?> _load() async {
    final data = await context.services.api.run(_profileQuery, variables: {'id': widget.userId});
    return jsonMap(data['getUserById']);
  }

  Future<void> _reload() async => _loader.currentState?.reload(silent: true);

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return Loader<Json?>(
      key: _loader,
      load: _load,
      refreshOn: services.dataEpoch,
      // While a follow request is pending the profile is polled, so the
      // button flips to "Takibi Bırak" without a manual refresh.
      pollEvery: const Duration(seconds: 15),
      pollWhen: (user) => user?['followStatus'] == 'PENDING',
      errorBuilder: (context, error, retry) => ErrorView(
        title: 'Profil yüklenemedi',
        message: error is ApiException && !error.isNetwork
            ? 'Profil bilgilerine şu anda ulaşılamıyor. Lütfen yeniden deneyin.'
            : errorMessage(error),
        onRetry: retry,
        extra: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextButton(onPressed: () => context.go('/'), child: const Text('Ana Sayfaya Dön')),
            if (_isOwn)
              TextButton(
                onPressed: () async {
                  final router = GoRouter.of(context);
                  await services.auth.logout();
                  router.go('/login');
                },
                child: const Text('Çıkış Yap'),
              ),
          ],
        ),
      ),
      builder: (context, user, loader) {
        if (user == null) {
          if (_isOwn) {
            // The own profile resolving to null means the account is gone.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) services.auth.endSession(notice: 'Oturumunuz geçersiz. Lütfen tekrar giriş yapın.');
            });
          }
          return EmptyView(
            icon: Icons.person_off_outlined,
            title: 'Kullanıcı Bulunamadı',
            subtitle: 'Aradığınız profil silinmiş veya hiç var olmamış olabilir.',
            action: OutlinedButton(onPressed: () => context.go('/'), child: const Text('ANA SAYFAYA DÖN')),
          );
        }
        return RefreshIndicator(
          onRefresh: () => loader.reload(silent: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              if (_editing)
                _EditProfileForm(
                  user: user,
                  onCancel: () => setState(() => _editing = false),
                  onSaved: () {
                    setState(() => _editing = false);
                    _reload();
                  },
                )
              else
                _Header(user: user, isOwn: _isOwn, onEdit: () => setState(() => _editing = true), onChanged: _reload),
              const SizedBox(height: 16),
              if (user['canViewProfile'] == false)
                const EmptyView(
                  icon: Icons.lock_outline,
                  title: 'Bu profil yalnızca takipçilere açık.',
                  subtitle: 'İçerikleri görmek için kullanıcıyı takip edin.',
                )
              else
                _Tabs(user: user, isOwn: _isOwn, tab: _tab, onTab: (tab) => setState(() => _tab = tab), onChanged: _reload),
            ],
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.user, required this.isOwn, required this.onEdit, required this.onChanged});
  final Json user;
  final bool isOwn;
  final VoidCallback onEdit;
  final Future<void> Function() onChanged;

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    final id = jsonString(user['id']);
    final books = jsonList(user['usersBooks']).map(Book.fromJson).toList();
    final visibleBooks = isOwn ? books : books.where((book) => !book.isDraft).toList();
    final followers = jsonList(user['followers']).map(UserSummary.fromJson).toList();
    final following = jsonList(user['following']).map(UserSummary.fromJson).toList();
    final canViewFollows = user['canViewFollowList'] != false;
    // Totals over the user's books are computed on the client, as on the web.
    final views = books.fold<int>(0, (sum, book) => sum + book.views);
    final likes = books.fold<int>(0, (sum, book) => sum + book.likes);

    Widget stat(String value, String title, {VoidCallback? onTap}) => Expanded(
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(border: Border.all(color: BetikColors.borderMedium)),
          child: Column(
            children: [
              Text(value, style: serif(size: 20, weight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(title, style: label(size: 10.5)),
            ],
          ),
        ),
      ),
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BetikColors.paperWhite,
        border: Border.all(color: BetikColors.inkBlack, width: 2),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        children: [
          UserAvatar(imageUrl: jsonString(user['profilePicture']), name: jsonString(user['fullName']), size: 96),
          const SizedBox(height: 10),
          Text(
            jsonString(user['fullName']).isEmpty ? jsonString(user['username']) : jsonString(user['fullName']),
            style: serif(size: 24, weight: FontWeight.w700, height: 1.2),
            textAlign: TextAlign.center,
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('@${user['username']}', style: sans(size: 14, color: BetikColors.ashGray)),
              if (user['isVerified'] == true) ...[
                const SizedBox(width: 6),
                const Icon(Icons.verified, size: 16, color: BetikColors.info),
                Text(' Doğrulanmış', style: sans(size: 12, color: BetikColors.info)),
              ],
            ],
          ),
          if (jsonString(user['bio']).isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                jsonString(user['bio']),
                style: serif(size: 15, style: FontStyle.italic, height: 1.5),
                textAlign: TextAlign.center,
              ),
            ),
          _ScoreAndBadges(
            userId: id,
            builder: (points, badges) {
              return Column(
                children: [
                  if (badges.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Wrap(
                        spacing: 6,
                        alignment: WrapAlignment.center,
                        children: [
                          for (final badge in badges)
                            Tooltip(
                              message: '${badge['name']}: ${badge['description']}',
                              triggerMode: TooltipTriggerMode.tap,
                              child: Text(jsonString(badge['icon'], '🏅'), style: const TextStyle(fontSize: 22)),
                            ),
                        ],
                      ),
                    ),
                  if (isOwn && jsonString(user['email']).isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.mail, size: 16, color: BetikColors.ashGray),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(jsonString(user['email']), style: serif(size: 13.5, color: BetikColors.graphite)),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      stat('${visibleBooks.length}', 'KİTAPLAR'),
                      stat(
                        canViewFollows ? '${followers.length}' : 'Gizli',
                        'TAKİPÇİLER',
                        onTap: canViewFollows
                            ? () => _showUsers(context, 'Takipçiler', followers, removable: isOwn, onChanged: onChanged)
                            : null,
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      stat(
                        canViewFollows ? '${following.length}' : 'Gizli',
                        'TAKİP EDİLENLER',
                        onTap: canViewFollows ? () => _showUsers(context, 'Takip Edilenler', following, onChanged: onChanged) : null,
                      ),
                      stat('⭐ ${formatCount(points)}', 'PUAN'),
                    ],
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CountLabel(icon: Icons.trending_up, value: views, noun: 'görüntülenme'),
              Text(' görüntülenme  •  ', style: sans(size: 13, color: BetikColors.ashGray)),
              CountLabel(icon: Icons.star, value: likes, noun: 'beğeni'),
              Text(' beğeni', style: sans(size: 13, color: BetikColors.ashGray)),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => showShareSheet(context, type: 'PROFILE', id: id),
            icon: const Icon(Icons.ios_share, size: 18),
            label: const Text('PROFİLİ PAYLAŞ'),
          ),
          const SizedBox(height: 8),
          if (isOwn) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => context.push('/funding-history'),
                icon: const Icon(Icons.receipt_long, size: 18),
                label: const Text('DESTEKLERİM'),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(onPressed: onEdit, icon: const Icon(Icons.edit, size: 18), label: const Text('DÜZENLE')),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final router = GoRouter.of(context);
                      await services.auth.logout();
                      router.go('/login');
                    },
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('ÇIKIŞ YAP'),
                  ),
                ),
              ],
            ),
          ] else ...[
            _FollowButton(user: user, onChanged: onChanged),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: Tooltip(
                message: user['canMessage'] == false ? 'Bu kullanıcı mesaj almayı sınırlandırmış.' : '',
                child: BusyButton(
                  outlined: true,
                  expand: true,
                  icon: Icons.chat_bubble_outline,
                  label: 'Mesaj Gönder',
                  onPressed: user['canMessage'] == false && services.auth.isSignedIn
                      ? null
                      : () async {
                          if (!services.auth.isSignedIn) {
                            return showToast(context, 'Mesaj göndermek için giriş yapmalısınız.');
                          }
                          try {
                            // A query with a write side effect: called only on
                            // this explicit tap, never prefetched.
                            final data = await services.api.run(
                              'query GetOrCreateConversation(\$recipientId: ID!) { getOrCreateConversation(recipientId: \$recipientId) { $conversationFields } }',
                              variables: {'recipientId': id},
                            );
                            final conversation = jsonMap(data['getOrCreateConversation']);
                            if (context.mounted && conversation != null) context.push('/messages/${conversation['id']}');
                          } on ApiException catch (error) {
                            if (context.mounted) {
                              showToast(context, error.message.isEmpty ? 'Konuşma başlatılamadı.' : error.message, type: ToastType.error);
                            }
                          }
                        },
                ),
              ),
            ),
            if (user['canMessage'] == false)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('Bu kullanıcı mesaj almayı sınırlandırmış.', style: sans(size: 12, color: BetikColors.ashGray)),
              ),
          ],
        ],
      ),
    );
  }
}

/// Points and badges, refreshed every 15 s and on `myScoreUpdated`.
class _ScoreAndBadges extends StatelessWidget {
  const _ScoreAndBadges({required this.userId, required this.builder});
  final String userId;
  final Widget Function(int points, List<Json> badges) builder;

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return Loader<(int, List<Json>)>(
      pollEvery: const Duration(seconds: 15),
      refreshOn: services.badges.scoreTick,
      load: () async {
        final data = await services.api.run(
          r'''query ProfileScore($userId: ID!) {
            getUserScore(userId: $userId) { id totalPoints }
            getUserBadges(userId: $userId) { id earnedAt badge { key name description icon } }
          }''',
          variables: {'userId': userId},
          allowPartial: true,
        );
        return (
          jsonInt(jsonMap(data['getUserScore'])?['totalPoints']),
          [
            for (final item in jsonList(data['getUserBadges']))
              if (jsonMap(item['badge']) != null) jsonMap(item['badge'])!,
          ],
        );
      },
      errorBuilder: (_, _, _) => builder(0, const []),
      builder: (context, data, _) => builder(data.$1, data.$2),
    );
  }
}

class _FollowButton extends StatelessWidget {
  const _FollowButton({required this.user, required this.onChanged});
  final Json user;
  final Future<void> Function() onChanged;

  @override
  Widget build(BuildContext context) {
    final status = jsonString(user['followStatus'], 'NOT_FOLLOWING');
    final (text, field, argument) = switch (status) {
      'PENDING' => ('İsteği Geri Çek', 'cancelFollowRequest', 'targetId'),
      'FOLLOWING' => ('Takibi Bırak', 'unfollowUser', 'targetId'),
      // Every follow is a request that needs approval, public profiles
      // included.
      _ => ('Takip İsteği Gönder', 'requestFollowUser', 'targetId'),
    };
    return Column(
      children: [
        BusyButton(
          expand: true,
          outlined: status != 'NOT_FOLLOWING',
          label: text,
          onPressed: () async {
            if (!context.services.auth.isSignedIn) {
              showToast(context, 'Takip etmek için giriş yapmalısınız.');
              return;
            }
            try {
              final data = await context.services.api.run(
                'mutation FollowAction(\$id: ID!) { $field($argument: \$id) { $_followAction } }',
                variables: {'id': user['id']},
              );
              final result = jsonMap(data[field]);
              if (context.mounted) showToast(context, jsonString(result?['message'], 'İşlem tamamlandı.'));
              await onChanged();
            } on ApiException catch (error) {
              if (context.mounted) {
                showToast(context, error.message.isEmpty ? 'Takip işlemi tamamlanamadı.' : error.message, type: ToastType.error);
              }
            }
          },
        ),
        if (status == 'PENDING')
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('Takip isteği onay bekliyor.', style: sans(size: 12.5, color: BetikColors.ashGray)),
          ),
      ],
    );
  }
}

void _showUsers(
  BuildContext context,
  String title,
  List<UserSummary> users, {
  bool removable = false,
  required Future<void> Function() onChanged,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (_, scroll) => StatefulBuilder(
        builder: (context, setState) => ListView(
          controller: scroll,
          padding: const EdgeInsets.only(bottom: 16),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(title, style: serif(size: 19, weight: FontWeight.w700)),
            ),
            if (users.isEmpty) const EmptyView(title: 'Burada henüz kimse yok.'),
            for (final user in users)
              ListTile(
                leading: UserAvatar.of(user, size: 38),
                title: Text(user.displayName),
                subtitle: Text('@${user.username}'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  context.push('/user/${user.id}');
                },
                trailing: removable
                    ? TextButton(
                        onPressed: () async {
                          try {
                            final data = await context.services.api.run(
                              'mutation RemoveFollower(\$followerId: ID!) { removeFollower(followerId: \$followerId) { $_followAction } }',
                              variables: {'followerId': user.id},
                            );
                            if (context.mounted) {
                              showToast(context, jsonString(jsonMap(data['removeFollower'])?['message'], 'İşlem tamamlandı.'));
                            }
                            setState(() => users.remove(user));
                            await onChanged();
                          } on ApiException catch (error) {
                            if (context.mounted) {
                              showToast(context, error.message.isEmpty ? 'Takipçi çıkarılamadı.' : error.message, type: ToastType.error);
                            }
                          }
                        },
                        child: const Text('Takipçiyi Çıkar'),
                      )
                    : null,
              ),
          ],
        ),
      ),
    ),
  );
}

class _EditProfileForm extends StatefulWidget {
  const _EditProfileForm({required this.user, required this.onCancel, required this.onSaved});
  final Json user;
  final VoidCallback onCancel;
  final VoidCallback onSaved;

  @override
  State<_EditProfileForm> createState() => _EditProfileFormState();
}

class _EditProfileFormState extends State<_EditProfileForm> {
  late final _fullName = TextEditingController(text: jsonString(widget.user['fullName']));
  late final _username = TextEditingController(text: jsonString(widget.user['username']));
  late final _bio = TextEditingController(text: jsonString(widget.user['bio']));
  late String _picture = jsonString(widget.user['profilePicture']);
  String? _error;

  @override
  void dispose() {
    _fullName.dispose();
    _username.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final username = _username.text.trim();
    final fullName = _fullName.text.trim();
    if (username.isEmpty) return setState(() => _error = 'Kullanıcı adı zorunludur.');
    if (!usernamePattern.hasMatch(username)) {
      return setState(() => _error = 'Kullanıcı adı 3–50 karakter olmalı; harf, rakam, alt çizgi, nokta ve tire içerebilir.');
    }
    if (fullName.isNotEmpty && (fullName.length < 2 || fullName.length > 120)) {
      return setState(() => _error = 'Ad soyad 2–120 karakter olmalıdır.');
    }
    setState(() => _error = null);
    try {
      await context.services.api.run(
        r'''mutation UpdateProfile($username: String!, $fullName: String!, $bio: String!, $profilePicture: String) {
          updateProfile(username: $username, fullName: $fullName, bio: $bio, profilePicture: $profilePicture) { id username fullName bio profilePicture }
        }''',
        variables: {'username': username, 'fullName': fullName, 'bio': _bio.text.trim(), 'profilePicture': _picture},
      );
      if (!mounted) return;
      context.services.auth.updateLocalUser(username: username, fullName: fullName);
      showToast(context, 'Profil başarıyla güncellendi.', type: ToastType.success);
      widget.onSaved();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) => PaperCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Profili Düzenle', style: serif(size: 18, weight: FontWeight.w700)),
        const SizedBox(height: 12),
        // The website crops avatars with the 2:3 book-cover ratio
        // (Stage 1 D-05); avatars are shown as circles, so the app crops
        // to a square.
        ImageUploadField(
          label: 'Resim Yükle',
          currentImage: _picture,
          aspectRatio: 1,
          maxWidth: 800,
          previewWidth: 84,
          circular: true,
          onUploaded: (url) => setState(() => _picture = url),
        ),
        const SizedBox(height: 12),
        LabeledField(
          label: 'Ad Soyad',
          child: TextField(controller: _fullName, textCapitalization: TextCapitalization.words),
        ),
        LabeledField(
          label: 'Kullanıcı Adı',
          required: true,
          child: TextField(controller: _username, autocorrect: false),
        ),
        LabeledField(
          label: 'Hakkımda',
          child: TextField(controller: _bio, minLines: 2, maxLines: 6, maxLength: 1000),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(_error!, style: sans(size: 13, color: BetikColors.danger)),
          ),
        Row(
          children: [
            Expanded(
              child: BusyButton(onPressed: _save, label: 'Kaydet'),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(onPressed: widget.onCancel, child: const Text('İPTAL')),
            ),
          ],
        ),
      ],
    ),
  );
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.user, required this.isOwn, required this.tab, required this.onTab, required this.onChanged});
  final Json user;
  final bool isOwn;
  final String tab;
  final ValueChanged<String> onTab;
  final Future<void> Function() onChanged;

  @override
  Widget build(BuildContext context) {
    final id = jsonString(user['id']);
    final books = jsonList(user['usersBooks']).map(Book.fromJson).toList();
    final published = books.where((book) => !book.isDraft).toList();
    final drafts = books.where((book) => book.isDraft).toList();
    final canViewLibrary = user['canViewLibrary'] != false;
    final tabs = <(String, String)>[
      ('published', 'Yayınlananlar'),
      if (canViewLibrary) ('library', 'Dijital Kitaplık'),
      if (canViewLibrary) ('printed', 'Okuduğum Basılı Kitaplar'),
      if (isOwn) ('drafts', 'Taslaklar (${drafts.length})'),
      ('quotes', 'Alıntılar'),
      if (isOwn) ('following', 'Takip'),
      if (isOwn) ('settings', 'Ayarlar'),
    ];
    final current = tabs.any((entry) => entry.$1 == tab) ? tab : 'published';

    Widget bookList(List<Book> items, String empty) => items.isEmpty
        ? EmptyView(title: empty)
        : Column(
            children: [for (final book in items) Padding(padding: const EdgeInsets.only(bottom: 12), child: BookCard(book))],
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The website's seven tabs wrap over several lines on a phone; here
        // they scroll sideways.
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final (key, title) in tabs)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(label: Text(trUpper(title)), selected: current == key, onSelected: (_) => onTab(key)),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        switch (current) {
          'library' => _SavedBooks(userId: id),
          'printed' => PrintedReadingLibrary(userId: id, isOwner: isOwn),
          'drafts' => bookList(drafts, 'Henüz taslak kitabınız yok.'),
          'quotes' => _UserQuotes(userId: id, isOwn: isOwn),
          'following' => _FollowedBooks(key: ValueKey(id)),
          'settings' => SettingsPanel(user: user, onChanged: onChanged),
          _ => bookList(published, isOwn ? 'Henüz yayımlanmış kitabınız yok.' : 'Henüz yayımlanmış kitap yok.'),
        },
      ],
    );
  }
}

class _SavedBooks extends StatelessWidget {
  const _SavedBooks({required this.userId});
  final String userId;
  @override
  Widget build(BuildContext context) => Loader<List<Book>>(
    refreshOn: context.services.dataEpoch,
    load: () async {
      final data = await context.services.api.run(
        'query GetProfileSavedBooks(\$id: ID!) { getUserById(id: \$id) { id savedBooks { $_profileBookFields } } }',
        variables: {'id': userId},
      );
      return jsonList(jsonMap(data['getUserById'])?['savedBooks']).map(Book.fromJson).toList();
    },
    builder: (context, books, _) => books.isEmpty
        ? const EmptyView(title: 'Kitaplıkta henüz kitap yok.')
        : Column(
            children: [for (final book in books) Padding(padding: const EdgeInsets.only(bottom: 12), child: BookCard(book))],
          ),
  );
}

class _FollowedBooks extends StatelessWidget {
  const _FollowedBooks({super.key});
  @override
  Widget build(BuildContext context) => Loader<List<Book>>(
    load: () async {
      final data = await context.services.api.run('query GetFollowedBooks { getFollowedBooks { $_profileBookFields } }');
      return jsonList(data['getFollowedBooks']).map(Book.fromJson).toList();
    },
    builder: (context, books, _) => books.isEmpty
        ? const EmptyView(
            title: 'Henüz takip ettiğiniz kitap yok.',
            subtitle: 'Takip ettiğiniz kitaplara yeni bölüm eklendiğinde bildirim alırsınız.',
          )
        : Column(
            children: [for (final book in books) Padding(padding: const EdgeInsets.only(bottom: 12), child: BookCard(book))],
          ),
  );
}

class _UserQuotes extends StatelessWidget {
  const _UserQuotes({required this.userId, required this.isOwn});
  final String userId;
  final bool isOwn;
  @override
  Widget build(BuildContext context) => Loader<List<Quote>>(
    refreshOn: context.services.dataEpoch,
    load: () async {
      final data = await context.services.api.run(
        'query GetQuotesByUser(\$userId: ID!) { getQuotesByUser(userId: \$userId) { $quoteFields } }',
        variables: {'userId': userId},
      );
      return jsonList(data['getQuotesByUser'])
          .map(Quote.fromJson)
          // Private quotes are for their owner only.
          .where((quote) => isOwn || !quote.isPrivate)
          .toList();
    },
    builder: (context, quotes, loader) => quotes.isEmpty
        ? const EmptyView(title: 'Henüz alıntı yok', subtitle: 'Kitap okurken beğendiğin bölümleri alıntıla!')
        : ProfileQuoteGroups(quotes, onChanged: () => loader.reload(silent: true)),
  );
}
