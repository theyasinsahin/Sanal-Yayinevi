import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../funding/funding_shared.dart' show Notice;
import '../shell/shell.dart';
import 'legal_documents.dart';

class _CommunityPage extends StatelessWidget {
  const _CommunityPage({required this.title, required this.description, required this.children});
  final String title;
  final String description;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Betik / Topluluk',
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Text(title, style: serif(size: 24, weight: FontWeight.w700, height: 1.25)),
        const SizedBox(height: 6),
        Text(
          description,
          style: serif(size: 14.5, style: FontStyle.italic, color: BetikColors.graphite, height: 1.5),
        ),
        const OrnamentDivider(),
        ...children,
      ],
    ),
  );
}

class _Discover extends StatelessWidget {
  const _Discover();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        FilledButton(onPressed: () => context.go('/feed'), child: const Text('KİTAPLARI KEŞFET')),
        OutlinedButton(onPressed: () => context.push('/create-book'), child: const Text('HİKÂYENİ YAZ')),
      ],
    ),
  );
}

/// Yazarlar (F-DISC-06 / F-COM-05): authors with at least one public book
/// and a public profile, 12 per page.
class AuthorsScreen extends StatefulWidget {
  const AuthorsScreen({super.key});
  @override
  State<AuthorsScreen> createState() => _AuthorsScreenState();
}

class _AuthorsScreenState extends State<AuthorsScreen> {
  int _page = 1;

  @override
  Widget build(BuildContext context) => Loader<Json>(
    key: ValueKey(_page),
    load: () async {
      final data = await context.services.api.run(
        r'query GetAuthors($page: Int) { getAuthors(page: $page) { total page pageSize totalPages authors { id username fullName bio profilePicture bookCount pageCount } } }',
        variables: {'page': _page},
        authenticated: false,
      );
      return Map<String, dynamic>.from(data['getAuthors'] as Map);
    },
    loadingLabel: 'Yazarlar yükleniyor…',
    errorBuilder: (context, error, retry) => PageScaffold(
      title: 'Yazarlar',
      body: ErrorView(message: errorMessage(error), onRetry: retry, retryLabel: 'Tekrar dene'),
    ),
    builder: (context, data, _) {
      final authors = jsonList(data['authors']);
      return _CommunityPage(
        title: 'Topluluğumuzdaki ${jsonInt(data['total'])} Yazar',
        description: 'Hikâyeleriyle Betik’e hayat veren yazarlarla tanışın. Yazarların herkese açık kitapları bu listede sayılır.',
        children: [
          if (authors.isEmpty) ...[
            const EmptyView(
              icon: Icons.edit_note,
              title: 'Bu sayfada henüz bir yazar yok',
              subtitle: 'Herkese açık kitaplarını paylaşan yazarlar burada yer alacak.',
            ),
            const _Discover(),
          ] else
            for (final author in authors)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: PaperCard(
                  onTap: () => context.push('/user/${author['id']}'),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      UserAvatar(
                        imageUrl: jsonString(author['profilePicture']),
                        name: jsonString(author['fullName'], jsonString(author['username'])),
                        size: 52,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              jsonString(author['fullName']).isEmpty ? jsonString(author['username']) : jsonString(author['fullName']),
                              style: serif(size: 16, weight: FontWeight.w700),
                            ),
                            Text('@${author['username']}', style: sans(size: 12.5, color: BetikColors.ashGray)),
                            if (jsonString(author['bio']).isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  jsonString(author['bio']),
                                  style: serif(size: 13.5, style: FontStyle.italic, height: 1.4),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            const SizedBox(height: 4),
                            Text(
                              '${jsonInt(author['bookCount'])} kitap · ${jsonInt(author['pageCount'])} sayfa',
                              style: sans(size: 12.5, weight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          PagerBar(page: _page, totalPages: jsonInt(data['totalPages'], 1), onPage: (page) => setState(() => _page = page)),
        ],
      );
    },
  );
}

/// Hakkımızda (F-COM-01): the website's static copy.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const _cards = [
    (
      Icons.auto_stories,
      'Betik nedir?',
      'Yazarların kitaplarını bölüm bölüm oluşturabildiği ve dijital olarak paylaşabildiği; okurların yeni eserlerle tanışabildiği bir buluşma alanı.',
    ),
    (
      Icons.edit_note,
      'Neden Betik?',
      'Bir hikâyeyi yazmak kadar onu paylaşmak da emek ister. Yazarların ilk satırdan itibaren okurlarıyla bağ kurabileceği bir alan oluşturmak için yola çıktık.',
    ),
    (
      Icons.forum,
      'Misyonumuz',
      'Yazmayı ve okumayı ortak bir deneyime dönüştürmek; farklı seslerin görünür olmasına, eserlerin geri bildirimle gelişmesine katkı sağlamak.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    Widget heading(String text) => Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 4),
      child: Text(text, style: serif(size: 18, weight: FontWeight.w700)),
    );
    Widget paragraph(String text) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: serif(size: 14.5, height: 1.6)),
    );
    return _CommunityPage(
      title: 'Her hikâye bir okurla büyür',
      description: 'Betik, yazma cesaretini okuma merakıyla buluşturan sosyal bir yazarlık ve yayıncılık platformudur.',
      children: [
        for (final (icon, title, body) in _cards)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: PaperCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 28),
                  const SizedBox(height: 6),
                  Text(title, style: serif(size: 17, weight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(body, style: serif(size: 14.5, height: 1.55, color: BetikColors.charcoal)),
                ],
              ),
            ),
          ),
        heading('Nasıl çalışır?'),
        paragraph('1. Yazar bir kitap oluşturur, bölümlerini yazar ve paylaşmaya hazır olduğunda okurlara açar.'),
        paragraph('2. Okurlar kitapları keşfeder, okur; yorumlar ve alıntılarla hikâyenin etrafındaki sohbete katılır.'),
        paragraph(
          '3. Uzun vadeli hedefimiz, basım maliyetine göre belirlenen destek hedefleriyle fiziksel baskıya giden yolu açmaktır. Destek toplanması tek başına basım garantisi değildir; koşullar eser bazında açıklanmalıdır.',
        ),
        heading('Yazarlar ve okurlar için'),
        paragraph(
          'Yazarlar için eserlerini geliştirebilecekleri bir çalışma ve paylaşım alanı; okurlar için yeni hikâyeler, takip edebilecekleri yazarlar ve kitaplar üzerine etkileşim sunuyoruz.',
        ),
        heading('Vizyonumuz'),
        paragraph(
          'Bir eserin geleceğinin yalnızca ilk başvuruda değil, onu okuyan insanların kurduğu bağla da şekillenebildiği bir yayıncılık kültürü. Henüz basılı bir eserimiz yok; bu hedefe topluluğumuzla birlikte ilerlemek istiyoruz.',
        ),
        const _Discover(),
        const SizedBox(height: 20),
        const NewsletterForm(),
      ],
    );
  }
}

/// İletişim (F-COM-02): limits enforced by the server are checked here
/// too; the hidden honeypot field `website` is always sent empty.
class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});
  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  final _form = GlobalKey<FormState>();
  var _autovalidate = AutovalidateMode.disabled;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _subject = TextEditingController();
  final _message = TextEditingController();
  String? _result;
  bool _failed = false;

  @override
  void dispose() {
    for (final controller in [_name, _email, _subject, _message]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) {
      // After a failed submit the messages follow the user's corrections.
      setState(() => _autovalidate = AutovalidateMode.onUserInteraction);
      return;
    }
    setState(() => _result = null);
    try {
      final data = await context.services.api.run(
        r'mutation SendContactMessage($input: ContactMessageInput!) { sendContactMessage(input: $input) { code message } }',
        variables: {
          'input': {
            'name': _name.text.trim(),
            'email': _email.text.trim(),
            'subject': _subject.text.trim(),
            'message': _message.text.trim(),
            'website': '',
          },
        },
        authenticated: false,
      );
      if (!mounted) return;
      final status = jsonMap(data['sendContactMessage']);
      final ok = status?['code'] == 200;
      setState(() {
        _failed = !ok;
        _result = jsonString(status?['message'], ok ? 'Mesajınız iletildi.' : ApiException.genericMessage);
      });
      if (ok) {
        for (final controller in [_name, _email, _subject, _message]) {
          controller.clear();
        }
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _failed = true;
          _result = error.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    String? length(String? value, int min, int max, String name) {
      final size = (value ?? '').trim().length;
      return size < min || size > max ? '$name $min–$max karakter olmalıdır.' : null;
    }

    return _CommunityPage(
      title: 'İletişim',
      description: 'Bir sorunuz, öneriniz veya eserlerle ilgili bir bildiriminiz mi var? Bize yazın.',
      children: [
        Form(
          key: _form,
          autovalidateMode: _autovalidate,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LabeledField(
                label: 'Ad Soyad',
                required: true,
                child: TextFormField(
                  controller: _name,
                  autofillHints: const [AutofillHints.name],
                  textCapitalization: TextCapitalization.words,
                  validator: (value) => length(value, 2, 100, 'Ad soyad'),
                ),
              ),
              LabeledField(
                label: 'E-posta Adresi',
                required: true,
                child: TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  autofillHints: const [AutofillHints.email],
                  validator: (value) =>
                      RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch((value ?? '').trim()) && (value ?? '').trim().length <= 254
                      ? null
                      : 'Geçerli bir e-posta adresi girin.',
                ),
              ),
              LabeledField(
                label: 'Konu',
                required: true,
                child: TextFormField(controller: _subject, validator: (value) => length(value, 3, 150, 'Konu')),
              ),
              LabeledField(
                label: 'Mesaj',
                required: true,
                child: TextFormField(
                  controller: _message,
                  minLines: 4,
                  maxLines: 10,
                  validator: (value) => length(value, 10, 5000, 'Mesaj'),
                ),
              ),
              Text(
                'Adınız, e-posta adresiniz ve mesajınız talebinizi yanıtlamak için e-posta hizmeti aracılığıyla iletilir. Lütfen mesajınıza hassas kişisel bilgi eklemeyin.',
                style: sans(size: 12.5, color: BetikColors.graphite, height: 1.45),
              ),
              TextButton(onPressed: () => context.push('/privacy'), child: const Text('Gizlilik taslağını okuyun.')),
              BusyButton(onPressed: _submit, label: 'Mesajı gönder'),
              if (_result != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Notice(_result!, error: _failed),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Text('Bize ulaşın', style: serif(size: 18, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        const CommunityContactInfo(),
      ],
    );
  }
}

/// Contact e-mail / phone and the configured social links
/// (`getCommunityConfig`, F-COM-06).
class CommunityContactInfo extends StatelessWidget {
  const CommunityContactInfo({super.key});

  @override
  Widget build(BuildContext context) => Loader<Json>(
    load: () async {
      final data = await context.services.api.run(
        'query GetCommunityConfig { getCommunityConfig { email phone socials { instagram x linkedin tiktok } } }',
        authenticated: false,
      );
      return Map<String, dynamic>.from(data['getCommunityConfig'] as Map);
    },
    errorBuilder: (_, _, _) => const SizedBox.shrink(),
    builder: (context, config, _) {
      final email = jsonString(config['email']);
      final phone = jsonString(config['phone']);
      final socials = jsonMap(config['socials']) ?? const {};
      const names = {'instagram': 'Instagram', 'x': 'X', 'linkedin': 'LinkedIn', 'tiktok': 'TikTok'};
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (email.isNotEmpty)
            TextButton(onPressed: () => openExternal(context, 'mailto:$email'), child: Text(email))
          else
            Text('İletişim e-posta adresi henüz yayımlanmadı.', style: sans(size: 13.5)),
          if (phone.isNotEmpty)
            TextButton(onPressed: () => openExternal(context, 'tel:${phone.replaceAll(RegExp(r'[^+\d]'), '')}'), child: Text(phone))
          else
            Text('Telefon bilgisi henüz yayımlanmadı.', style: sans(size: 13.5)),
          Wrap(
            spacing: 8,
            children: [
              for (final entry in names.entries)
                if (jsonString(socials[entry.key]).isNotEmpty)
                  OutlinedButton(onPressed: () => openExternal(context, jsonString(socials[entry.key])), child: Text(trUpper(entry.value))),
            ],
          ),
        ],
      );
    },
  );
}

/// Kullanım Koşulları / Gizlilik Politikası (F-COM-03): the drafts bundled
/// with the website, marked as drafts exactly as there.
class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key, required this.kind});
  final String kind;

  @override
  Widget build(BuildContext context) {
    final document = legalDocuments[kind]!;
    return _CommunityPage(
      title: document.title,
      description: 'Hukuki incelemeye sunulacak başlangıç taslağı · 23 Ekim 2026',
      children: [
        const Notice(
          'Bu metin taslaktır. Veri sorumlusu, başvuru kanalları ve işleyişe ilişkin eksik bilgiler tamamlanıp hukuki inceleme yapılmadan nihai politika olarak değerlendirilmemelidir.',
        ),
        for (final (title, body) in document.sections) ...[
          Padding(
            padding: const EdgeInsets.only(top: 16, bottom: 4),
            child: Text(title, style: serif(size: 17, weight: FontWeight.w700)),
          ),
          Text(body, style: serif(size: 14.5, height: 1.65)),
        ],
        const SizedBox(height: 12),
        TextButton(onPressed: () => context.push('/contact'), child: const Text('İletişime geçin')),
      ],
    );
  }
}

/// Footer newsletter form (F-COM-04): e-mail + consent → double opt-in
/// e-mail. The honeypot `website` is always empty.
class NewsletterForm extends StatefulWidget {
  const NewsletterForm({super.key});
  @override
  State<NewsletterForm> createState() => _NewsletterFormState();
}

class _NewsletterFormState extends State<NewsletterForm> {
  final _email = TextEditingController();
  bool _consent = false;
  String? _result;
  bool _failed = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return setState(() {
        _failed = true;
        _result = 'Geçerli bir e-posta adresi girin.';
      });
    }
    if (!_consent) {
      return setState(() {
        _failed = true;
        _result = 'Bültene abone olmak için onay kutusunu işaretleyin.';
      });
    }
    try {
      final data = await context.services.api.run(
        r'mutation SubscribeNewsletter($input: NewsletterSubscriptionInput!) { subscribeNewsletter(input: $input) { code message } }',
        variables: {
          'input': {'email': email, 'consent': true, 'website': ''},
        },
        authenticated: false,
      );
      if (!mounted) return;
      final status = jsonMap(data['subscribeNewsletter']);
      setState(() {
        _failed = status?['code'] != 200;
        _result = jsonString(status?['message']);
      });
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _failed = true;
          _result = error.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => PaperCard(
    color: BetikColors.agedPaper,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Bülten', style: serif(size: 17, weight: FontWeight.w700)),
        const SizedBox(height: 8),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          decoration: const InputDecoration(hintText: 'E-posta adresiniz'),
        ),
        CheckboxListTile(
          value: _consent,
          onChanged: (value) => setState(() => _consent = value ?? false),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: Text(
            'Betik gelişmelerini e-postayla almak istiyorum. Her zaman abonelikten çıkabilirim.',
            style: sans(size: 12.5, height: 1.4),
          ),
        ),
        TextButton(onPressed: () => context.push('/privacy'), child: const Text('Verileriniz nasıl işlenir?')),
        BusyButton(onPressed: _submit, label: 'Abone Ol'),
        if (_result != null && _result!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Notice(_result!, error: _failed),
          ),
      ],
    ),
  );
}

/// `/newsletter?token=…&action=confirm|unsubscribe` (F-COM-07): target of
/// the e-mailed links when they are opened in the app.
class NewsletterScreen extends StatefulWidget {
  const NewsletterScreen({super.key, this.token, this.action});
  final String? token;
  final String? action;

  @override
  State<NewsletterScreen> createState() => _NewsletterScreenState();
}

class _NewsletterScreenState extends State<NewsletterScreen> {
  String? _result;

  bool get _valid =>
      (widget.action == 'confirm' || widget.action == 'unsubscribe') && RegExp(r'^[a-f0-9]{64}$').hasMatch(widget.token ?? '');

  Future<void> _manage() async {
    try {
      final data = await context.services.api.run(
        r'mutation ManageNewsletter($token: String!, $action: NewsletterAction!) { manageNewsletter(token: $token, action: $action) { code message } }',
        variables: {'token': widget.token, 'action': widget.action},
        authenticated: false,
      );
      if (mounted) setState(() => _result = jsonString(jsonMap(data['manageNewsletter'])?['message']));
    } on ApiException catch (error) {
      if (mounted) setState(() => _result = error.message);
    }
  }

  @override
  Widget build(BuildContext context) => _CommunityPage(
    title: 'Bülten aboneliğiniz',
    description: 'Abonelik tercihinizi yönetin.',
    children: [
      if (_valid) ...[
        Text(
          widget.action == 'confirm'
              ? 'Betik bültenini almak için e-posta adresinizi doğrulayın.'
              : 'Betik bülten aboneliğinizi iptal edebilirsiniz.',
          style: serif(size: 15, height: 1.5),
        ),
        const SizedBox(height: 12),
        BusyButton(onPressed: _manage, label: widget.action == 'confirm' ? 'Aboneliğimi doğrula' : 'Abonelikten çık'),
      ] else
        const Notice('Geçersiz bağlantı. Size gönderilen e-postadaki bağlantıyı kullanın.'),
      if (_result != null) Padding(padding: const EdgeInsets.only(top: 12), child: Notice(_result!)),
    ],
  );
}

/// 404 (F-NAV-05).
class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});
  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Betik',
    body: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '❝404❞',
              style: serif(size: 54, weight: FontWeight.w700, color: BetikColors.lightSmoke),
            ),
            const SizedBox(height: 8),
            Text(
              'Bu Sayfa Kitapta Yok',
              style: serif(size: 22, weight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Aradığınız sayfa taşınmış, kaldırılmış veya hiç yazılmamış olabilir.',
              style: serif(size: 14.5, style: FontStyle.italic, color: BetikColors.graphite),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            FilledButton(onPressed: () => context.go('/'), child: const Text('ANA SAYFAYA DÖN')),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: () => context.go('/feed'), child: const Text('KİTAPLARI KEŞFET')),
          ],
        ),
      ),
    ),
  );
}
