// On-device journey against a RUNNING, DISPOSABLE backend (Stage 2 sandbox).
//
//   flutter drive --driver=test_driver/integration_test.dart \
//     --target=integration_test/app_journey_test.dart -d <simulator> \
//     --dart-define=BETIK_API_URL=http://localhost:5055 \
//     --dart-define=BETIK_WEB_URL=http://localhost:3055 \
//     --dart-define=BETIK_TEST_EMAIL=author@betik-dev.invalid \
//     --dart-define=BETIK_TEST_PASSWORD=<seed password>
//
// It signs in through the real login form and walks the main screens,
// asserting on real server data and saving a screenshot of each.
import 'package:betik/app.dart';
import 'package:betik/core/app_services.dart';
import 'package:betik/core/auth/session.dart';
import 'package:betik/features/book/book_card.dart';
import 'package:betik/features/reader/html_view.dart';
import 'package:betik/features/writing/chapter_editor.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';

const _email = String.fromEnvironment('BETIK_TEST_EMAIL');
const _password = String.fromEnvironment('BETIK_TEST_PASSWORD');

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('guest → sign in → discover → detail → reader → dashboard → social screens', (tester) async {
    await initializeDateFormatting('tr_TR');
    final services = await AppServices.create(sessionStore: MemorySessionStore(), localStore: MemoryLocalStore());
    await tester.pumpWidget(BetikApp(services: services));

    /// Pumps frames until [finder] matches (network data arrives) or fails.
    Future<void> waitFor(Finder finder, {Duration timeout = const Duration(seconds: 20)}) async {
      final end = DateTime.now().add(timeout);
      while (DateTime.now().isBefore(end)) {
        await tester.pump(const Duration(milliseconds: 200));
        if (finder.evaluate().isNotEmpty) return;
      }
      fail('Timed out waiting for $finder');
    }

    Future<void> settle([int frames = 6]) async {
      for (var i = 0; i < frames; i++) {
        await tester.pump(const Duration(milliseconds: 200));
      }
    }

    Future<void> shot(String name) async {
      await settle();
      await binding.takeScreenshot(name);
    }

    GoRouter router() => GoRouter.of(tester.element(find.byType(Scaffold).first));
    void expectNoError() => expect(tester.takeException(), isNull);

    // --- Guest ----------------------------------------------------------
    await waitFor(find.byType(BookCard));
    expect(find.text('Fikriniz Kitaplaşsın'), findsOneWidget);
    await shot('01_landing_guest');

    // A member-only route sends a guest to the login form.
    router().go('/create-book');
    await waitFor(find.text('Giriş Yap'));
    await shot('02_login');

    // --- Sign in through the form -----------------------------------------
    await tester.enterText(find.byType(TextFormField).at(0), _email);
    await tester.enterText(find.byType(TextFormField).at(1), _password);
    await tester.tap(find.text('GİRİŞ YAP').last);
    // returnTo brings the member to the page that required the session.
    await waitFor(find.text('Yeni Kitap'));
    expect(services.auth.isSignedIn, isTrue);
    await shot('03_create_book');

    // --- Profile -------------------------------------------------------------
    router().go('/profile');
    await waitFor(find.text('PROFİLİ PAYLAŞ'));
    expect(find.text('@${services.auth.user!.username}'), findsWidgets);
    await shot('04_profile_own');

    // --- Feed → detail ------------------------------------------------------
    router().go('/feed');
    await waitFor(find.byType(BookCard));
    await shot('05_feed');
    await tester.tap(find.text('FİLTRELE').first);
    await waitFor(find.text('Filtreler'));
    await shot('06_feed_filters');
    Navigator.of(tester.element(find.text('Filtreler'))).pop();
    await settle();

    await tester.tap(find.byType(BookCard).first);
    await waitFor(find.text('KİTABI OKU'));
    expectNoError();
    await shot('07_book_detail');
    final bookPath = router().state.uri.path;
    final bookId = bookPath.split('/').last;

    // --- Reader ------------------------------------------------------------
    router().push('/reader/$bookId');
    await waitFor(find.byType(HtmlBlock));
    expect(find.textContaining('Bölüm 1 /'), findsOneWidget);
    await shot('08_reader');
    await tester.tap(find.textContaining('Bölümler ('));
    await waitFor(find.text('Kitap Detayına Dön'));
    await shot('09_reader_chapters');
    Navigator.of(tester.element(find.text('Kitap Detayına Dön'))).pop();
    await settle();
    router().pop();
    await settle();

    // --- Writing dashboard with the native editor (the author owns it) ------
    router().push('/dashboard/$bookId');
    await waitFor(find.text('KAYDET'), timeout: const Duration(seconds: 25));
    expect(find.byType(ChapterEditor), findsOneWidget);
    expect(find.text('KAYDEDİLDİ'), findsOneWidget);
    await shot('10_dashboard_editor');
    router().pop();
    await settle();

    // --- Other tabs and pushed screens --------------------------------------
    for (final (path, marker, name) in const [
      ('/quotes', 'En Popüler', '11_quotes'),
      ('/sessions', 'Yazı Oturumları', '12_sessions'),
      ('/leaderboard', 'Genel', '13_leaderboard'),
      ('/printed-books', 'Basılı Kitaplar', '14_printed_books'),
      ('/messages', 'Mesaj göndereceğin kişiyi ara', '15_messages'),
      ('/notifications', 'Bildirimler', '16_notifications'),
      ('/funding-history', 'Desteklerim ve ön siparişlerim', '17_funding_history'),
      ('/authors', 'Betik / Topluluk', '18_authors'),
    ]) {
      path == '/quotes' || path == '/sessions' ? router().go(path) : router().push(path);
      await waitFor(find.textContaining(marker));
      await settle(8);
      expectNoError();
      await binding.takeScreenshot(name);
      if (path != '/quotes' && path != '/sessions') {
        router().pop();
        await settle(3);
      }
    }

    // --- Guards for roles the account does not have ------------------------
    router().go('/admin');
    await settle(5);
    expect(router().state.uri.path, services.auth.user!.isAdmin ? '/admin' : '/');

    // --- Sign out ------------------------------------------------------------
    await services.auth.logout();
    await settle(5);
    expect(services.auth.isSignedIn, isFalse);
    router().go('/messages');
    await waitFor(find.text('Giriş Yap'));
    expectNoError();
  });
}
