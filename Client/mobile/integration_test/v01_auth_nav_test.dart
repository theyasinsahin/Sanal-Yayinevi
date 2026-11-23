// Verification batch 1 — authentication, shell navigation, community pages.
// Runs on a simulator/emulator against the disposable sandbox (see harness).
import 'package:betik/core/network/api_error.dart';
import 'package:betik/features/auth/auth_screens.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support/harness.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('auth, navigation and community', (tester) async {
    final h = Harness(tester, binding, 'auth');
    await h.start();
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(5);
    final email = 'v${platformName}_$stamp@betik-dev.invalid';
    final username = 'v${platformName}_$stamp';
    const password1 = 'Deneme!Sifre1';
    const password2 = 'Yeni!Sifre22';

    await h.scenario('F-NAV-05', 'Unknown path shows the not-found page and its buttons work', () async {
      await h.go('/boyle-bir-sayfa-yok');
      await h.waitFor(find.text('Bu Sayfa Kitapta Yok'));
      await h.shot('not_found');
      await h.tapText('KİTAPLARI KEŞFET');
      expect(h.location, startsWith('/feed'));
      await h.go('/boyle-bir-sayfa-yok');
      await h.tapText('ANA SAYFAYA DÖN');
      expect(h.location, '/');
    });

    await h.scenario('F-NAV-02', 'Guest drawer opens from the menu button and navigates', () async {
      await h.go('/');
      await h.tap(find.byTooltip('Gezinme menüsünü aç'), scroll: false);
      await h.waitFor(find.text('Kayıt Ol'));
      expect(find.text('Profilim'), findsOneWidget); // bottom bar only; no drawer entry for guests
      expect(find.text('Kitap Oluştur'), findsNothing);
      await h.shot('drawer_guest');
      await h.tapText('Hakkımızda');
      await h.waitFor(find.text('Her hikâye bir okurla büyür'));
    });

    await h.scenario('F-COM-01', 'About page content and discover buttons', () async {
      await h.go('/');
      await h.push('/about');
      await h.waitFor(find.text('Betik nedir?'));
      await h.reveal(find.text('Vizyonumuz'));
      await h.shot('about');
      await h.tap(find.text('KİTAPLARI KEŞFET'));
      expect(h.location, startsWith('/feed'));
    });

    await h.scenario('F-COM-04/07', 'Newsletter: validation, subscribe, mail, confirm via link', () async {
      await h.go('/');
      await h.push('/about');
      await h.waitFor(find.text('Betik nedir?'));
      final submit = find.text('ABONE OL');
      await h.reveal(submit);
      final input = find.descendant(of: find.widgetWithText(TextField, 'E-posta adresiniz'), matching: find.byType(EditableText));
      await h.type(input, 'gecersiz');
      await h.tap(submit);
      await h.waitFor(find.text('Geçerli bir e-posta adresi girin.'));
      await h.type(input, email);
      await h.tap(submit);
      await h.waitFor(find.text('Bültene abone olmak için onay kutusunu işaretleyin.'));
      await h.tap(find.byType(CheckboxListTile));
      await h.tap(submit);
      final mail = await h.waitUntil(() => h.latestMail(to: email), what: 'newsletter mail');
      await h.shot('newsletter_subscribed');
      final link = RegExp(r'/newsletter\?[^\s"<]+').firstMatch('${mail['text']} ${mail['html']}')?.group(0)?.replaceAll('&amp;', '&');
      expect(link, isNotNull, reason: 'mail contains a /newsletter link: ${mail['subject']}');
      expect(((await h.dbFind('newslettersubscriptions', {'email': email})).first as Map)['status'], isNot('active'));
      await h.go('/');
      await h.push(link!);
      await h.waitFor(find.text('ABONELİĞİMİ DOĞRULA'));
      await h.tapText('ABONELİĞİMİ DOĞRULA');
      await h.settle(8);
      await h.shot('newsletter_confirmed');
      final subscription = (await h.dbFind('newslettersubscriptions', {'email': email})).first as Map;
      expect(subscription['status'], 'active', reason: 'confirmed server-side');
      // Invalid link
      await h.go('/');
      await h.push('/newsletter?token=abc&action=confirm');
      await h.waitFor(find.textContaining('Geçersiz bağlantı'));
    });

    await h.scenario('F-COM-02/06', 'Contact form: validation, send, mail delivered to the sink; contact info block', () async {
      await h.go('/');
      await h.push('/contact');
      await h.waitFor(find.text('MESAJI GÖNDER'));
      await h.tap(find.text('MESAJI GÖNDER'));
      await h.waitFor(find.textContaining('Ad soyad 2–100'));
      expect(find.text('Geçerli bir e-posta adresi girin.'), findsOneWidget);
      await h.typeIn('Ad Soyad', 'Doğrulama Kullanıcısı');
      await h.typeIn('E-posta Adresi', email);
      await h.typeIn('Konu', 'Mobil doğrulama $stamp');
      await h.typeIn('Mesaj', 'Bu mesaj mobil uygulamanın iletişim formundan gönderildi. Şğüöçı İ.');
      await h.dismissKeyboard();
      await h.tap(find.text('MESAJI GÖNDER'));
      final mail = await h.waitUntil(() => h.latestMail(text: 'Mobil doğrulama $stamp'), what: 'contact mail');
      expect('${mail['text']}${mail['html']}', contains('iletişim formundan'));
      await h.shot('contact_sent');
      await h.reveal(find.text('Bize ulaşın'));
      expect(h.hasContaining('henüz yayımlanmadı') || h.hasContaining('@'), isTrue);
    });

    await h.scenario('F-COM-03', 'Legal pages render and link to contact', () async {
      await h.go('/');
      await h.push('/terms');
      await h.waitFor(find.textContaining('Bu metin taslaktır'));
      await h.shot('terms');
      await h.back();
      await h.push('/privacy');
      await h.waitFor(find.textContaining('Bu metin taslaktır'));
      await h.reveal(find.text('İletişime geçin'));
      await h.tap(find.text('İletişime geçin'));
      await h.waitFor(find.text('MESAJI GÖNDER'));
    });

    await h.scenario('F-AUTH-01', 'Login form: validation and refused credentials', () async {
      await h.go('/login');
      await h.waitFor(h.field('E-posta'));
      await h.tap(find.text('GİRİŞ YAP').last);
      await h.waitFor(find.text('E-posta zorunludur.'));
      expect(find.text('Şifre zorunludur.'), findsOneWidget);
      await h.typeIn('E-posta', readerEmail);
      await h.typeIn('Şifre', 'YanlisSifre1!');
      await h.tap(find.text('GİRİŞ YAP').last);
      await h.settle(10);
      expect(h.services.auth.isSignedIn, isFalse);
      expect(
        h.hasContaining('hatalı') || h.hasContaining('Giriş yapılamadı') || h.hasContaining('Geçersiz'),
        isTrue,
        reason: h.visibleTexts(),
      );
      await h.shot('login_refused');
    });

    await h.scenario('F-AUTH-02/07', 'Register: validation, strength meter, terms, code mail, wrong code, success → profile', () async {
      await h.go('/register');
      await h.waitFor(h.field('Ad Soyad'));
      await h.tap(find.text('DOĞRULAMA KODU GÖNDER'));
      await h.waitFor(find.textContaining('Ad soyad en az 2'));
      await h.typeIn('Ad Soyad', 'Mobil Doğrulama');
      await h.typeIn('Kullanıcı Adı', username);
      await h.typeIn('E-posta', email);
      await h.typeIn('Şifre', 'abc');
      expect(find.byType(PasswordStrengthIndicator), findsOneWidget);
      expect(h.hasContaining('Zayıf'), isTrue, reason: h.visibleTexts());
      await h.typeIn('Şifre', password1);
      expect(h.has('Güçlü') || h.hasContaining('Güçlü'), isTrue, reason: h.visibleTexts());
      expect(find.text('En az 8 karakter'), findsOneWidget, reason: 'only the rule list shows it; the stale field error is gone');
      await h.shot('register_strength');
      await h.dismissKeyboard();
      await h.tap(find.text('DOĞRULAMA KODU GÖNDER'));
      await h.waitFor(find.text('Devam etmek için kullanım koşullarını kabul etmelisiniz.'));
      await h.tap(find.byType(Checkbox));
      await h.tap(find.text('DOĞRULAMA KODU GÖNDER'));
      await h.waitFor(find.text('E-postanı Doğrula'));
      expect(h.hasContaining('KODU YENİDEN GÖNDER ('), isTrue, reason: 'cooldown label');
      await h.shot('register_code_step');
      // "Bilgileri Düzenle" returns to step 1 keeping the values, then forward again is rate-limited by cooldown only on resend.
      final mail = await h.waitUntil(
        () => h.latestMail(to: email, subject: ''),
        what: 'registration mail',
      );
      final code = RegExp(r'\b(\d{6})\b').firstMatch('${mail['text']}')?.group(1);
      expect(code, isNotNull, reason: 'code in mail ${mail['subject']}');
      await h.typeIn('Doğrulama Kodu', '12');
      await h.tap(find.text('KAYIT İŞLEMİNİ TAMAMLA'));
      await h.waitFor(find.text('Doğrulama kodu 6 haneli olmalıdır.'));
      final wrong = code == '000000' ? '111111' : '000000';
      await h.typeIn('Doğrulama Kodu', wrong);
      await h.tap(find.text('KAYIT İŞLEMİNİ TAMAMLA'));
      await h.settle(10);
      expect(h.services.auth.isSignedIn, isFalse);
      expect(find.text('E-postanı Doğrula'), findsOneWidget, reason: 'wrong code keeps step 2');
      await h.shot('register_wrong_code');
      await h.typeIn('Doğrulama Kodu', code!);
      await h.tap(find.text('KAYIT İŞLEMİNİ TAMAMLA'));
      await h.waitUntil(() async => h.services.auth.isSignedIn, what: 'registered session');
      await h.waitFor(find.text('@$username'));
      expect(h.location, startsWith('/profile'));
      expect(await h.dbCount('users', {'email': email}), 1);
      await h.shot('register_done_profile');
    });

    await h.scenario('F-AUTH-06', 'Logout from the member drawer ends the session server-side', () async {
      expect(h.services.auth.isSignedIn, isTrue);
      final token = h.services.auth.token!;
      await h.go('/');
      await h.tap(find.byTooltip('Gezinme menüsünü aç'), scroll: false);
      await h.waitFor(find.text('Kitap Oluştur'));
      expect(find.text('Desteklerim'), findsOneWidget);
      expect(find.text('Yönetim Paneli'), findsNothing);
      await h.shot('drawer_member');
      await h.reveal(find.text('ÇIKIŞ YAP'));
      await h.tap(find.text('ÇIKIŞ YAP'));
      await h.waitUntil(() async => !h.services.auth.isSignedIn, what: 'sign-out');
      await h.settle(6);
      expect(h.location, startsWith('/login'));
      // The old token is now a guest for the server.
      Object? me = 'unset';
      try {
        me = (await h.apiWithToken(token).run('query Me { me { id } }'))['me'];
      } on ApiException catch (error) {
        expect(error.isUnauthenticated, isTrue);
        me = null;
      }
      expect(me, isNull, reason: 'revoked token no longer identifies the user');
    });

    await h.scenario('F-AUTH-04/05', 'Forgot password → mail → paste link → reset → old password refused, new accepted', () async {
      await h.go('/login');
      await h.tapText('Şifremi Unuttum');
      await h.waitFor(find.text('BAĞLANTI GÖNDER'));
      await h.typeIn('E-posta', 'gecersiz');
      await h.tap(find.text('BAĞLANTI GÖNDER'));
      await h.waitFor(find.text('Geçerli bir e-posta adresi girin.'));
      await h.typeIn('E-posta', email);
      await h.tap(find.text('BAĞLANTI GÖNDER'));
      await h.waitFor(find.textContaining('E-postanızı kontrol edin'));
      await h.shot('forgot_sent');
      final mail = await h.waitUntil(() async {
        final m = await h.latestMail(to: email);
        return m != null && '${m['text']}${m['html']}'.contains('reset-password') ? m : null;
      }, what: 'reset mail');
      final link = RegExp(r'https?://[^\s"<]*reset-password/[A-Za-z0-9_\-\.]+').firstMatch('${mail['text']} ${mail['html']}')?.group(0);
      expect(link, isNotNull);
      await h.tapText('BAĞLANTI KODUNU GİR');
      await h.waitFor(find.text('Yeni Şifre Belirle'));
      // Invalid link first
      await h.typeIn('E-postadaki bağlantı', 'merhaba');
      await h.typeIn('Yeni Şifre', password2);
      await h.typeIn('Yeni Şifre (Tekrar)', password2);
      await h.tap(find.text('ŞİFREYİ GÜNCELLE'));
      await h.waitFor(find.text('Geçersiz veya süresi dolmuş bağlantı.'));
      await h.typeIn('E-postadaki bağlantı', link!);
      await h.typeIn('Yeni Şifre (Tekrar)', '${password2}x');
      await h.tap(find.text('ŞİFREYİ GÜNCELLE'));
      await h.waitFor(find.text('Şifreler eşleşmiyor.'));
      await h.typeIn('Yeni Şifre (Tekrar)', password2);
      await h.dismissKeyboard();
      await h.tap(find.text('ŞİFREYİ GÜNCELLE'));
      await h.waitFor(find.textContaining('Şifreniz güncellendi'));
      await h.shot('reset_done');
      await h.waitUntil(() async => h.location.startsWith('/login'), what: 'redirect to login');
      // Old password refused
      await h.typeIn('E-posta', email);
      await h.typeIn('Şifre', password1);
      await h.tap(find.text('GİRİŞ YAP').last);
      await h.settle(10);
      expect(h.services.auth.isSignedIn, isFalse);
      await h.typeIn('Şifre', password2);
      await h.tap(find.text('GİRİŞ YAP').last);
      await h.waitUntil(() async => h.services.auth.isSignedIn, what: 'login with new password');
      // The same link cannot be reused.
      await h.logout();
      await h.go('/reset-password/${link.split('/').last}');
      await h.waitFor(find.text('Yeni Şifre Belirle'));
      await h.typeIn('Yeni Şifre', password1);
      await h.typeIn('Yeni Şifre (Tekrar)', password1);
      await h.dismissKeyboard();
      await h.tap(find.text('ŞİFREYİ GÜNCELLE'));
      await h.waitFor(find.textContaining('Geçersiz veya süresi dolmuş'));
    });

    await h.scenario('F-AUTH-09', 'Guards: guest → login with returnTo; member cannot open admin/publisher; returnTo honoured', () async {
      await h.logout();
      await h.go('/funding-history');
      await h.waitFor(find.text('Giriş Yap'));
      expect(h.location, contains('returnTo'));
      await h.typeIn('E-posta', email);
      await h.typeIn('Şifre', password2);
      await h.tap(find.text('GİRİŞ YAP').last);
      await h.waitFor(find.textContaining('Desteklerim ve ön siparişlerim'));
      await h.go('/admin');
      await h.settle(6);
      expect(h.location, '/');
      await h.go('/publisher');
      await h.settle(6);
      expect(h.location, '/');
      await h.go('/login');
      await h.settle(4);
      expect(h.location, startsWith('/profile'), reason: 'signed-in users are sent away from /login');
    });

    await h.scenario('F-NAV-04', 'Website slug URLs and legacy id URLs resolve to app screens', () async {
      final feed = await h.gql('query { getBookFeed(limit: 1) { books { id publicPath title author { id username publicPath } } } }');
      final book = ((feed['getBookFeed'] as Map)['books'] as List).first as Map;
      await h.go('/');
      await h.push('${book['publicPath']}');
      await h.waitFor(find.text('KİTABI OKU'));
      expect(h.location, startsWith('/book/${book['id']}'));
      await h.go('/');
      await h.push('/book-detail/${book['id']}');
      await h.waitFor(find.text('KİTABI OKU'));
      await h.go('/');
      await h.push('${(book['author'] as Map)['publicPath']}');
      await h.waitFor(find.text('@${(book['author'] as Map)['username']}'));
      expect(h.location, startsWith('/user/'));
      await h.go('/');
      await h.push('${book['publicPath']}/oku');
      await h.waitFor(find.textContaining(RegExp(r'Bölüm \d+ / \d+')));
      await h.go('/');
      await h.push('/kitap/olmayan-kitap-slug-xyz');
      await h.waitFor(find.text('Bu Sayfa Kitapta Yok'));
    });

    await h.logout();
    h.finish();
  });
}
