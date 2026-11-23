import 'dart:convert';

import 'package:betik/core/app_services.dart';
import 'package:betik/core/auth/auth_controller.dart';
import 'package:betik/core/auth/session.dart';
import 'package:betik/core/config/app_config.dart';
import 'package:betik/core/models/models.dart';
import 'package:betik/core/network/graphql_client.dart';
import 'package:betik/core/network/subscription_client.dart';
import 'package:betik/core/theme/app_theme.dart';
import 'package:betik/core/widgets/ui.dart';
import 'package:betik/features/auth/auth_screens.dart';
import 'package:betik/features/book/book_card.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

const _config = AppConfig(
  apiUrl: 'http://test',
  wsUrl: '',
  webUrl: 'http://web.test',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  googleServerClientId: '',
  googleIosClientId: '',
);

Future<AppServices> _services(http.Client client) async {
  final auth = AuthController(store: MemorySessionStore(), revalidateEvery: Duration.zero);
  return AppServices.create(
    config: _config,
    sessionStore: MemorySessionStore(),
    localStore: MemoryLocalStore(),
    api: GraphQLClient(endpoint: 'http://test', readToken: () => auth.token, httpClient: client),
    subscriptions: SubscriptionClient(url: '', readToken: () => null),
  );
}

Widget _app(AppServices services, Widget Function(BuildContext) home, {List<GoRoute> extra = const []}) => MultiProvider(
  providers: [
    Provider<AppServices>.value(value: services),
    ChangeNotifierProvider<AuthController>.value(value: services.auth),
  ],
  child: MaterialApp.router(
    theme: buildBetikTheme(),
    routerConfig: GoRouter(
      routes: [
        GoRoute(path: '/', builder: (context, _) => home(context)),
        GoRoute(
          path: '/profile',
          builder: (_, _) => const Scaffold(body: Text('PROFILE')),
        ),
        GoRoute(
          path: '/register',
          builder: (_, _) => const Scaffold(body: Text('REGISTER')),
        ),
        GoRoute(
          path: '/login',
          builder: (_, _) => const Scaffold(body: Text('LOGIN')),
        ),
        ...extra,
      ],
    ),
  ),
);

void main() {
  testWidgets('login: empty form is rejected locally; a refused login shows the generic Turkish message', (tester) async {
    var requests = 0;
    final services = await tester.runAsync(
      () => _services(
        MockClient((request) async {
          requests++;
          return http.Response.bytes(
            utf8.encode(
              jsonEncode({
                'data': null,
                'errors': [
                  {
                    'message': 'Giriş bilgileri geçersiz.',
                    'extensions': {'code': 'INTERNAL_SERVER_ERROR'},
                  },
                ],
              }),
            ),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      ),
    );
    await tester.pumpWidget(_app(services!, (_) => const LoginScreen()));
    await tester.tap(find.text('GİRİŞ YAP'));
    await tester.pump();
    expect(find.text('E-posta zorunludur.'), findsOneWidget);
    expect(find.text('Şifre zorunludur.'), findsOneWidget);
    expect(requests, 0, reason: 'nothing is sent for an invalid form');

    await tester.enterText(find.byType(TextFormField).at(0), 'reader@betik-dev.invalid');
    await tester.enterText(find.byType(TextFormField).at(1), 'wrong');
    await tester.tap(find.text('GİRİŞ YAP'));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
    await tester.pump();
    expect(requests, 1);
    expect(find.text('Giriş yapılamadı. Bilgilerinizi kontrol edin.'), findsOneWidget);
    expect(services.auth.isSignedIn, isFalse);
  });

  testWidgets('book card: derived values, no overflow on a small phone with large text', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final services = await tester.runAsync(() => _services(MockClient((_) async => http.Response('{}', 200))));
    final book = Book.fromJson({
      'id': 'b1',
      'title': 'Çağ & Işık: çok uzun bir kitap başlığı iki satıra taşsın diye',
      'description': 'a' * 200,
      'pageCount': 23,
      'status': 'WRITING',
      'digitalStatus': 'PUBLISHED',
      'stats': {'views': 123456, 'likes': 98765},
      'commentCount': 4321,
      'author': {'id': 'u', 'username': 'dev_author', 'fullName': 'Docker author'},
      'format': {'id': 'f', 'slug': 'roman', 'name': 'Roman'},
      'genres': [
        {'id': 'g', 'slug': 'fantastik', 'name': 'Fantastik'},
      ],
      'fundingSummary': {
        'id': 'c',
        'state': 'ACTIVE',
        'environment': 'SANDBOX',
        'targetMinor': 450000,
        'acceptedMinor': 10000,
        'remainingMinor': 440000,
        'progressPercent': 2.2,
        'isOpen': true,
        'goalReached': false,
        'endsAt': '2026-12-14T00:00:00.000Z',
      },
    });
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(size: Size(320, 640), textScaler: TextScaler.linear(1.4)),
        child: _app(services!, (_) => Scaffold(body: SingleChildScrollView(child: BookCard(book)))),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull, reason: 'no RenderFlex overflow');
    expect(find.text('23S.'), findsOneWidget);
    expect(find.text('~8 DK OKUMA'), findsOneWidget);
    expect(find.text('Popüler'), findsOneWidget);
    expect(find.text('${'a' * 120}...'), findsOneWidget);
    expect(find.text('100,00 TL / 4.500,00 TL hedef'), findsOneWidget);
    expect(find.text('Tamamlanma: %2.2'), findsOneWidget);
  });

  testWidgets('book card without a page count (recommendations) shows no page badge and no reading time, like the website', (tester) async {
    final services = await tester.runAsync(() => _services(MockClient((_) async => http.Response('{}', 200))));
    final book = Book.fromJson({
      'id': 'b2',
      'title': 'Öneri',
      'description': 'Kısa',
      'status': 'WRITING',
      'author': {'id': 'u', 'username': 'dev_author', 'fullName': 'Docker author'},
    });
    await tester.pumpWidget(_app(services!, (_) => Scaffold(body: SingleChildScrollView(child: BookCard(book)))));
    await tester.pump();
    expect(find.text('0S.'), findsNothing);
    expect(find.textContaining('DK OKUMA'), findsNothing);
  });

  testWidgets('guest gate: a member-only action opens the sign-up prompt and remembers the origin', (tester) async {
    final services = await tester.runAsync(() => _services(MockClient((_) async => http.Response('{}', 200))));
    await tester.pumpWidget(
      _app(
        services!,
        (context) => Scaffold(
          body: Center(
            child: FilledButton(
              onPressed: () => requireMember(context, 'like', bookTitle: 'Çağ & Işık'),
              child: const Text('BEĞEN'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('BEĞEN'));
    await tester.pumpAndSettle();
    expect(find.text('Beğenini paylaş'), findsOneWidget);
    expect(find.text('“Çağ & Işık” · Beğenmek için ücretsiz hesap oluştur.'), findsOneWidget);
    expect(find.text('Şimdilik geri dön'), findsOneWidget);
    await tester.tap(find.text('ÜCRETSİZ HESAP OLUŞTUR'));
    await tester.pumpAndSettle();
    expect(find.text('REGISTER'), findsOneWidget);
    expect(services.intents.returnTo, '/');
  });
}
