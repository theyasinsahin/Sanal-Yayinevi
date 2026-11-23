import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../auth/auth_screens.dart';
import '../discovery/feed_screen.dart';

/// "Ayarlar" tab of the own profile (F-SET-01…08): Hesap · Gizlilik ·
/// Bildirimler · Yazar · Görünüm · Hesabı Sil.
class SettingsPanel extends StatefulWidget {
  const SettingsPanel({super.key, required this.user, required this.onChanged});

  /// `getUserById(self)` with the three settings objects.
  final Json user;
  final VoidCallback onChanged;

  @override
  State<SettingsPanel> createState() => _SettingsPanelState();
}

class _SettingsPanelState extends State<SettingsPanel> {
  static const _sections = ['Hesap', 'Gizlilik', 'Bildirimler', 'Yazar', 'Görünüm', 'Hesabı Sil'];
  int _section = 0;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (var i = 0; i < _sections.length; i++)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(trUpper(_sections[i])),
                  selected: _section == i,
                  onSelected: (_) => setState(() => _section = i),
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      switch (_section) {
        0 => const _AccountSettings(),
        1 => _PrivacySettings(initial: jsonMap(widget.user['privacySettings']) ?? const {}, onSaved: widget.onChanged),
        2 => _NotificationSettings(initial: jsonMap(widget.user['notificationSettings']) ?? const {}, onSaved: widget.onChanged),
        3 => _AuthorSettings(
          initial: jsonMap(widget.user['authorSettings']) ?? const {},
          weeklyWords: jsonInt(widget.user['weeklyWritingWords']),
          onSaved: widget.onChanged,
        ),
        4 => const _AppearanceSettings(),
        _ => const _DangerZone(),
      },
    ],
  );
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: PaperCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: serif(size: 17, weight: FontWeight.w700)),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    ),
  );
}

Future<void> _endSession(BuildContext context, String notice, {String location = '/login'}) async {
  final router = GoRouter.of(context);
  await context.services.auth.endSession(notice: notice);
  router.go(location);
}

// --- Hesap -----------------------------------------------------------------

class _AccountSettings extends StatefulWidget {
  const _AccountSettings();
  @override
  State<_AccountSettings> createState() => _AccountSettingsState();
}

class _AccountSettingsState extends State<_AccountSettings> {
  final _newEmail = TextEditingController();
  final _emailPassword = TextEditingController();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _show = false;

  @override
  void dispose() {
    for (final controller in [_newEmail, _emailPassword, _current, _next, _confirm]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _changeEmail() async {
    final email = trLower(_newEmail.text.trim());
    if (email.isEmpty || _emailPassword.text.isEmpty) return showToast(context, 'Tüm alanları doldurun.', type: ToastType.error);
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return showToast(context, 'Geçerli bir e-posta girin.', type: ToastType.error);
    }
    try {
      final data = await context.services.api.run(
        r'mutation ChangeEmail($newEmail: String!, $currentPassword: String!) { changeEmail(newEmail: $newEmail, currentPassword: $currentPassword) { code message } }',
        variables: {'newEmail': email, 'currentPassword': _emailPassword.text},
      );
      if (!mounted) return;
      final message = jsonString(jsonMap(data['changeEmail'])?['message'], 'E-posta güncellendi.');
      showToast(context, message, type: ToastType.success);
      // The server has already revoked this token (authVersion++); sign out
      // now instead of waiting for the next request to fail.
      await _endSession(context, '$message Lütfen yeni e-posta adresinizle giriş yapın.');
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _changePassword() async {
    if (_current.text.isEmpty || _next.text.isEmpty || _confirm.text.isEmpty) {
      return showToast(context, 'Tüm alanları doldurun.', type: ToastType.error);
    }
    final problem = passwordProblem(_next.text);
    if (problem != null) return showToast(context, problem, type: ToastType.error);
    if (_next.text != _confirm.text) return showToast(context, 'Yeni şifreler eşleşmiyor.', type: ToastType.error);
    try {
      await context.services.api.run(
        r'mutation ChangePassword($currentPassword: String!, $newPassword: String!) { changePassword(currentPassword: $currentPassword, newPassword: $newPassword) { code message } }',
        variables: {'currentPassword': _current.text, 'newPassword': _next.text},
      );
      if (!mounted) return;
      showToast(context, 'Şifre başarıyla değiştirildi.', type: ToastType.success);
      await _endSession(context, 'Şifreniz değiştirildi. Lütfen yeni şifrenizle giriş yapın.');
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final passed = passwordRules.where((rule) => rule.test(_next.text)).length;
    const strength = ['', 'Zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];
    return Column(
      children: [
        _Section(
          title: 'E-posta Değiştir',
          children: [
            LabeledField(
              label: 'Yeni E-posta',
              child: TextField(controller: _newEmail, keyboardType: TextInputType.emailAddress, autocorrect: false),
            ),
            LabeledField(
              label: 'E-posta için mevcut şifre',
              hint: 'Yeni adresinize bilgilendirme e-postası gönderilir. Değişiklikten sonra yeniden giriş yapmanız gerekir.',
              child: TextField(controller: _emailPassword, obscureText: true),
            ),
            BusyButton(onPressed: _changeEmail, label: 'E-postayı Güncelle'),
          ],
        ),
        _Section(
          title: 'Şifre Değiştir',
          children: [
            LabeledField(
              label: 'Mevcut Şifre',
              child: TextField(controller: _current, obscureText: !_show),
            ),
            LabeledField(
              label: 'Yeni Şifre',
              hint: _next.text.isEmpty ? null : 'Şifre gücü: ${strength[passed]}',
              child: TextField(controller: _next, obscureText: !_show, onChanged: (_) => setState(() {})),
            ),
            LabeledField(
              label: 'Yeni Şifre (Tekrar)',
              child: TextField(controller: _confirm, obscureText: !_show),
            ),
            CheckboxListTile(
              value: _show,
              onChanged: (value) => setState(() => _show = value ?? false),
              title: const Text('Şifreleri göster'),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
            ),
            Text(
              'Google ile kayıt olduysanız şifre oluşturmak için giriş ekranındaki “Şifremi Unuttum” bağlantısını kullanın.',
              style: sans(size: 12, color: BetikColors.ashGray),
            ),
            const SizedBox(height: 8),
            BusyButton(onPressed: _changePassword, label: 'Şifreyi Güncelle'),
          ],
        ),
      ],
    );
  }
}

// --- Gizlilik ----------------------------------------------------------------

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({required this.title, required this.subtitle, required this.value, required this.onChanged});
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) =>
      SwitchListTile(value: value, onChanged: onChanged, title: Text(title), subtitle: Text(subtitle), contentPadding: EdgeInsets.zero);
}

class _PrivacySettings extends StatefulWidget {
  const _PrivacySettings({required this.initial, required this.onSaved});
  final Json initial;
  final VoidCallback onSaved;
  @override
  State<_PrivacySettings> createState() => _PrivacySettingsState();
}

class _PrivacySettingsState extends State<_PrivacySettings> {
  late Json _value = _normalize(widget.initial);
  late Json _saved = _normalize(widget.initial);

  static Json _normalize(Json source) => {
    'isProfilePublic': source['isProfilePublic'] != false,
    'isLibraryPublic': source['isLibraryPublic'] != false,
    'isFollowListPublic': source['isFollowListPublic'] != false,
    'allowMessages': jsonString(source['allowMessages'], 'everyone'),
    'showInSearchEngines': source['showInSearchEngines'] != false,
  };

  bool get _dirty => _value.toString() != _saved.toString();

  Future<void> _save() async {
    try {
      await context.services.api.run(
        r'mutation UpdatePrivacySettings($privacySettings: PrivacySettingsInput!) { updatePrivacySettings(privacySettings: $privacySettings) { id } }',
        variables: {'privacySettings': _value},
      );
      if (!mounted) return;
      setState(() => _saved = Map.of(_value));
      showToast(context, 'Gizlilik ayarları kaydedildi.', type: ToastType.success);
      widget.onSaved();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget toggle(String key, String title, String subtitle) => _ToggleRow(
      title: title,
      subtitle: subtitle,
      value: _value[key] == true,
      onChanged: (value) => setState(() => _value = {..._value, key: value}),
    );
    const messaging = {
      'everyone': ('Herkes', 'Tüm kullanıcılar size mesaj gönderebilir.'),
      'followers': ('Sadece Takipçiler', 'Yalnızca sizi takip eden kişiler mesaj gönderebilir.'),
      'none': ('Kimse', 'Mesaj kutunuzu tamamen kapatır.'),
    };
    return _Section(
      title: 'Gizlilik',
      children: [
        toggle('isProfilePublic', 'Herkese Açık Profil', 'Kapalıyken profiliniz yalnızca takipçilerinize görünür.'),
        toggle('showInSearchEngines', 'Arama Motorlarında Görün', 'Profilinizin web aramalarında listelenmesine izin verir.'),
        toggle('isLibraryPublic', 'Kitaplığı Göster', 'Kaydettiğiniz ve okuduğunuz kitaplar profilinizde görünür.'),
        toggle('isFollowListPublic', 'Takip Listesini Göster', 'Takipçi ve takip ettikleriniz listesi görünür.'),
        const SizedBox(height: 8),
        const Label('Mesajlaşma', color: BetikColors.inkBlack),
        RadioGroup<String>(
          groupValue: _value['allowMessages'] as String,
          onChanged: (value) => setState(() => _value = {..._value, 'allowMessages': value ?? 'everyone'}),
          child: Column(
            children: [
              for (final entry in messaging.entries)
                RadioListTile<String>(
                  value: entry.key,
                  title: Text(entry.value.$1),
                  subtitle: Text(entry.value.$2),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),
            ],
          ),
        ),
        if (_dirty) BusyButton(onPressed: _save, label: 'Kaydet'),
      ],
    );
  }
}

// --- Bildirimler -------------------------------------------------------------

class _NotificationSettings extends StatefulWidget {
  const _NotificationSettings({required this.initial, required this.onSaved});
  final Json initial;
  final VoidCallback onSaved;
  @override
  State<_NotificationSettings> createState() => _NotificationSettingsState();
}

class _NotificationSettingsState extends State<_NotificationSettings> {
  /// The seven flags the product exposes. The schema's other five
  /// (`publishingOffer`, `offerUpdate`, `emailDigest`, `emailOffers`,
  /// `emailMarketing`) are not editable on the website and are never sent.
  static const _flags = [
    ('newFollower', 'Yeni Takipçi', 'Onayladığınız takip isteği sonrası bilgi bildirimi. Onay bekleyen istekler her zaman gösterilir.'),
    ('mentionInSession', 'Oturumda Bahsedilme', 'Bir oturumda etiketlendiğinizde.'),
    (
      'mentionInComment',
      'Yorum ve Alıntıda Etiketlenme',
      'Kitap veya paragraf yorumunda, alıntı notunda ya da yanıtında etiketlendiğinizde.',
    ),
    ('bookComment', 'Kitaba Yorum', 'Kitabınıza birisi yorum yaptığında.'),
    ('bookLike', 'Kitaba Beğeni', 'Kitabınız beğenildiğinde.'),
    ('quoteLike', 'Alıntıya Beğeni', 'Bir alıntınız beğenildiğinde.'),
    ('sessionReply', 'Oturumda Yeni İleti', 'Katıldığınız veya oluşturduğunuz oturuma yeni bir ileti eklendiğinde.'),
  ];

  late Json _value = {for (final flag in _flags) flag.$1: widget.initial[flag.$1] != false};
  late Json _saved = Map.of(_value);

  Future<void> _save() async {
    try {
      await context.services.api.run(
        r'mutation UpdateNotificationSettings($notificationSettings: NotificationSettingsInput!) { updateNotificationSettings(notificationSettings: $notificationSettings) { id } }',
        variables: {'notificationSettings': _value},
      );
      if (!mounted) return;
      setState(() => _saved = Map.of(_value));
      showToast(context, 'Bildirim tercihleri kaydedildi.', type: ToastType.success);
      widget.onSaved();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => _Section(
    title: 'Bildirimler',
    children: [
      Text(
        'Bu tercihler uygulama içi bildirimleri belirler. Anlık (push) bildirim gönderilmez.',
        style: sans(size: 12.5, color: BetikColors.ashGray),
      ),
      for (final (key, title, subtitle) in _flags)
        _ToggleRow(
          title: title,
          subtitle: subtitle,
          value: _value[key] == true,
          onChanged: (value) => setState(() => _value = {..._value, key: value}),
        ),
      if (_value.toString() != _saved.toString()) BusyButton(onPressed: _save, label: 'Kaydet'),
    ],
  );
}

// --- Yazar ---------------------------------------------------------------------

class _AuthorSettings extends StatefulWidget {
  const _AuthorSettings({required this.initial, required this.weeklyWords, required this.onSaved});
  final Json initial;
  final int weeklyWords;
  final VoidCallback onSaved;
  @override
  State<_AuthorSettings> createState() => _AuthorSettingsState();
}

class _AuthorSettingsState extends State<_AuthorSettings> {
  late final _note = TextEditingController(text: jsonString(widget.initial['copyrightNote']));
  late final _goal = TextEditingController(text: widget.initial['weeklyWordGoal'] == null ? '' : '${widget.initial['weeklyWordGoal']}');
  late final Set<String> _genres = jsonIds(widget.initial['preferredGenres']).toSet();
  bool _dirty = false;

  @override
  void dispose() {
    _note.dispose();
    _goal.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final goalText = _goal.text.trim();
    final goal = goalText.isEmpty ? null : int.tryParse(goalText);
    if (goalText.isNotEmpty && (goal == null || goal < 0)) {
      return showToast(context, 'Kelime hedefi sıfır veya pozitif bir tam sayı olmalı.', type: ToastType.error);
    }
    try {
      await context.services.api.run(
        r'mutation UpdateAuthorSettings($authorSettings: AuthorSettingsInput!) { updateAuthorSettings(authorSettings: $authorSettings) { id } }',
        variables: {
          'authorSettings': {'copyrightNote': _note.text.trim(), 'weeklyWordGoal': goal, 'preferredGenres': _genres.toList()},
        },
      );
      if (!mounted) return;
      setState(() => _dirty = false);
      showToast(context, 'Yazar ayarları kaydedildi.', type: ToastType.success);
      widget.onSaved();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final goal = int.tryParse(_goal.text.trim());
    return _Section(
      title: 'Yazar',
      children: [
        LabeledField(
          label: 'Telif Notu',
          hint: '${_note.text.length}/300',
          child: TextField(
            controller: _note,
            maxLength: 300,
            minLines: 2,
            maxLines: 5,
            decoration: const InputDecoration(hintText: 'Yayıneviyle paylaşmak istediğiniz telif ve iletişim tercihleri…', counterText: ''),
            onChanged: (_) => setState(() => _dirty = true),
          ),
        ),
        LabeledField(
          label: 'Haftalık Kelime Hedefi',
          hint: 'Boş bırakırsanız hedef kapanır. Hafta pazartesi başlar.',
          child: TextField(
            controller: _goal,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: 'Örn. 5000'),
            onChanged: (_) => setState(() => _dirty = true),
          ),
        ),
        if (goal != null && goal > 0) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(value: (widget.weeklyWords / goal).clamp(0, 1).toDouble(), minHeight: 6),
          ),
          const SizedBox(height: 4),
          Text(
            'Bu hafta ${formatExactCount(widget.weeklyWords)} / ${formatExactCount(goal)} kelime yazdınız.',
            style: sans(size: 12.5, color: BetikColors.graphite),
          ),
          const SizedBox(height: 10),
        ],
        const Label('Tercih Ettiğiniz Türler', color: BetikColors.inkBlack),
        Text('Önerilerinizi etkiler.', style: sans(size: 12, color: BetikColors.ashGray)),
        const SizedBox(height: 6),
        Loader<List<Term>>(
          load: () async {
            final data = await context.services.api.run('query GetAllGenres { getAllGenres { id name slug group hexColor isActive } }');
            return jsonList(data['getAllGenres']).map(Term.fromJson).where((genre) => genre.isActive).toList();
          },
          builder: (context, genres, _) =>
              GenreChoices(genres: genres, selected: _genres, byName: true, onChanged: () => setState(() => _dirty = true)),
        ),
        const SizedBox(height: 10),
        if (_dirty) BusyButton(onPressed: _save, label: 'Kaydet'),
      ],
    );
  }
}

// --- Görünüm -------------------------------------------------------------------

class _AppearanceSettings extends StatefulWidget {
  const _AppearanceSettings();
  @override
  State<_AppearanceSettings> createState() => _AppearanceSettingsState();
}

class _AppearanceSettingsState extends State<_AppearanceSettings> {
  late String _size = context.read<ReadingPreferences>().size;

  @override
  Widget build(BuildContext context) {
    final preferences = context.watch<ReadingPreferences>();
    return _Section(
      title: 'Görünüm',
      children: [
        Text('Okuma yazı boyutu yalnızca bu cihazda saklanır.', style: sans(size: 12.5, color: BetikColors.ashGray)),
        RadioGroup<String>(
          groupValue: _size,
          onChanged: (value) => setState(() => _size = value ?? 'md'),
          child: Column(
            children: [
              for (final entry in ReadingPreferences.labels.entries)
                RadioListTile<String>(
                  value: entry.key,
                  title: Text('${entry.value} (${ReadingPreferences.sizes[entry.key]!.toInt()} px)'),
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: BetikColors.agedPaper, borderRadius: BorderRadius.circular(8)),
          child: Text(
            'Bir kitap, içimizdeki donmuş denizi kıracak balta olmalıdır.',
            style: serif(size: ReadingPreferences.sizes[_size]!, height: 1.7),
          ),
        ),
        const SizedBox(height: 10),
        if (_size != preferences.size)
          BusyButton(
            label: 'Kaydet',
            onPressed: () async {
              await preferences.setSize(_size);
              if (context.mounted) showToast(context, 'Okuma yazı boyutu kaydedildi.', type: ToastType.success);
            },
          ),
      ],
    );
  }
}

// --- Hesabı Sil ---------------------------------------------------------------

class _DangerZone extends StatefulWidget {
  const _DangerZone();
  @override
  State<_DangerZone> createState() => _DangerZoneState();
}

class _DangerZoneState extends State<_DangerZone> {
  static const _phrase = 'hesabımı sil';
  final _confirmText = TextEditingController();
  bool _confirmDeactivate = false;
  bool _confirmDelete = false;

  @override
  void dispose() {
    _confirmText.dispose();
    super.dispose();
  }

  Future<void> _deactivate() async {
    try {
      await context.services.api.run('mutation DeactivateAccount { deactivateAccount { code message } }');
      if (!mounted) return;
      showToast(context, 'Hesabınız devre dışı bırakıldı.', type: ToastType.success);
      await _endSession(context, 'Hesabınız devre dışı bırakıldı. Yeniden giriş yaparak etkinleştirebilirsiniz.');
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _delete() async {
    try {
      await context.services.api.run('mutation DeleteAccount { deleteAccount { code message } }');
      if (!mounted) return;
      showToast(context, 'Hesabınız kalıcı olarak silindi.', type: ToastType.success);
      await _endSession(context, 'Hesabınız kalıcı olarak silindi.', location: '/');
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Turkish-locale comparison: "HESABIMI SİL" also matches.
    final matches = trLower(_confirmText.text.trim()) == _phrase;
    return _Section(
      title: 'Tehlikeli Bölge',
      children: [
        Text('Hesabı Devre Dışı Bırak', style: sans(size: 14, weight: FontWeight.w700)),
        Text(
          'Profiliniz ve içerikleriniz gizlenir. Yeniden giriş yaptığınızda hesabınız etkinleşir.',
          style: sans(size: 13, color: BetikColors.graphite, height: 1.4),
        ),
        const SizedBox(height: 8),
        if (!_confirmDeactivate)
          OutlinedButton(onPressed: () => setState(() => _confirmDeactivate = true), child: const Text('DEVRE DIŞI BIRAK'))
        else ...[
          Text('Emin misiniz? Hesabınız gizlenecek ve oturumunuz kapatılacak.', style: sans(size: 13, color: BetikColors.danger)),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: BusyButton(danger: true, onPressed: _deactivate, label: 'Evet, Devre Dışı Bırak'),
              ),
              const SizedBox(width: 8),
              TextButton(onPressed: () => setState(() => _confirmDeactivate = false), child: const Text('Vazgeç')),
            ],
          ),
        ],
        const Divider(height: 28),
        Text(
          'Hesabı Kalıcı Olarak Sil',
          style: sans(size: 14, weight: FontWeight.w700, color: BetikColors.danger),
        ),
        Text(
          'Kitaplarınız, yorumlarınız ve alıntılarınız kaldırılır. Bu işlem uygulamadan geri alınamaz.',
          style: sans(size: 13, color: BetikColors.graphite, height: 1.4),
        ),
        const SizedBox(height: 8),
        if (!_confirmDelete)
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: BetikColors.danger,
              side: const BorderSide(color: BetikColors.danger, width: 2),
            ),
            onPressed: () => setState(() => _confirmDelete = true),
            child: const Text('HESABI SİL'),
          )
        else ...[
          Text('Lütfen tam olarak "$_phrase" yazın.', style: sans(size: 13)),
          const SizedBox(height: 6),
          TextField(controller: _confirmText, autocorrect: false, onChanged: (_) => setState(() {})),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: BusyButton(danger: true, onPressed: matches ? _delete : null, label: 'Kalıcı Olarak Sil'),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () => setState(() {
                  _confirmDelete = false;
                  _confirmText.clear();
                }),
                child: const Text('Vazgeç'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
