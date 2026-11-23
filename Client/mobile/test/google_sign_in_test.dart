import 'dart:convert';
import 'dart:io';

import 'package:betik/core/app_services.dart';
import 'package:betik/core/auth/auth_controller.dart';
import 'package:betik/core/auth/google_sign_in.dart';
import 'package:betik/core/auth/session.dart';
import 'package:betik/core/config/app_config.dart';
import 'package:betik/core/network/api_error.dart';
import 'package:betik/core/network/graphql_client.dart';
import 'package:betik/core/network/subscription_client.dart';
import 'package:betik/core/theme/app_theme.dart';
import 'package:betik/features/auth/auth_screens.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

const _web = '123456-webclient.apps.googleusercontent.com';
const _ios = '123456-iosclient.apps.googleusercontent.com';

AppConfig _config({String server = '', String ios = ''}) => AppConfig(
  apiUrl: 'http://test',
  wsUrl: '',
  webUrl: 'http://web.test',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  googleServerClientId: server,
  googleIosClientId: ios,
);

String _jwt({String userId = 'g1'}) {
  String part(Object value) => base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  final exp = DateTime.now().add(const Duration(days: 1)).millisecondsSinceEpoch ~/ 1000;
  return '${part({'alg': 'HS256'})}.${part({'userId': userId, 'version': 0, 'exp': exp})}.sig';
}

http.Response _gql(Object body) => http.Response.bytes(utf8.encode(jsonEncode(body)), 200, headers: {'content-type': 'application/json'});

http.Response _error(String message, [String code = 'INTERNAL_SERVER_ERROR']) => _gql({
  'data': null,
  'errors': [
    {
      'message': message,
      'path': ['googleAuth'],
      'extensions': {'code': code},
    },
  ],
});

http.Response _success(String token) => _gql({
  'data': {
    'googleAuth': {
      'token': token,
      'user': {'id': 'g1', 'username': 'gkullanici123', 'fullName': 'Google Kullanıcı', 'email': 'g@gmail.com', 'role': 'USER'},
    },
  },
});

/// Scripted stand-in for Google's account chooser.
class FakeGoogleIdTokenSource implements GoogleIdTokenSource {
  FakeGoogleIdTokenSource({this.configured = true, this.result});
  final bool configured;

  /// A token, null (cancel), or an exception to throw.
  Object? result;
  int requests = 0;
  int signOuts = 0;

  @override
  bool get isConfigured => configured;

  @override
  Future<String?> idToken() async {
    requests++;
    final value = result;
    if (value is Exception || value is Error) throw value!;
    return value as String?;
  }

  @override
  Future<void> signOut() async => signOuts++;
}

class _Backend {
  final requests = <Map<String, dynamic>>[];
  http.Response Function(Map<String, dynamic> body) respond = (_) => _gql({'data': null});

  late final client = MockClient((request) async {
    final body = jsonDecode(request.body) as Map<String, dynamic>;
    requests.add(body);
    return respond(body);
  });
}

Future<(AuthController, _Backend, SessionStore)> _auth() async {
  final backend = _Backend();
  final store = MemorySessionStore();
  final auth = AuthController(store: store, revalidateEvery: Duration.zero);
  auth.attach(GraphQLClient(endpoint: 'http://test', readToken: () => auth.token, httpClient: backend.client));
  await auth.initialise();
  return (auth, backend, store);
}

void main() {
  group('configuration', () {
    test('client id format', () {
      expect(AppConfig.isGoogleClientId(_web), isTrue);
      expect(AppConfig.isGoogleClientId(''), isFalse);
      expect(AppConfig.isGoogleClientId('webclient.apps.googleusercontent.com'), isFalse);
      expect(AppConfig.isGoogleClientId('$_web '), isFalse);
      expect(AppConfig.isGoogleClientId('GOCSPX-secret'), isFalse, reason: 'a client secret is never a client id');
    });

    test('Android needs the web (server) client id; iOS also needs the iOS client id', () {
      expect(_config().googleSignInConfiguredFor(isIos: false), isFalse);
      expect(_config(server: _web).googleSignInConfiguredFor(isIos: false), isTrue);
      expect(_config(server: _web).googleSignInConfiguredFor(isIos: true), isFalse);
      expect(_config(server: _web, ios: _ios).googleSignInConfiguredFor(isIos: true), isTrue);
      expect(_config(ios: _ios).googleSignInConfiguredFor(isIos: true), isFalse);
    });

    test('reversed iOS client id = Google redirect URL scheme', () {
      expect(reversedGoogleClientId(_ios), 'com.googleusercontent.apps.123456-iosclient');
    });

    test('the plugin identity refuses to open Google without client ids', () async {
      final identity = PluginGoogleIdTokenSource(_config());
      expect(identity.isConfigured, isFalse);
      await expectLater(identity.idToken(), throwsA(isA<GoogleSignInFailure>().having((f) => f.configuration, 'configuration', isTrue)));
      await identity.signOut(); // never initialised: no-op, no throw
    });
  });

  group('error mapping', () {
    test('plugin codes', () {
      GoogleSignInFailure? map(GoogleSignInExceptionCode code) => googleFailureFor(GoogleSignInException(code: code));
      expect(map(GoogleSignInExceptionCode.canceled), isNull, reason: 'a cancel is silent');
      expect(map(GoogleSignInExceptionCode.interrupted)!.message, googleInterruptedMessage);
      expect(map(GoogleSignInExceptionCode.clientConfigurationError)!.configuration, isTrue);
      expect(map(GoogleSignInExceptionCode.providerConfigurationError)!.configuration, isTrue);
      expect(map(GoogleSignInExceptionCode.uiUnavailable)!.message, googleFailedMessage);
      expect(map(GoogleSignInExceptionCode.unknownError)!.message, googleFailedMessage);
    });

    test('backend messages: user-facing Turkish kept, raw verification errors hidden', () {
      String map(ApiException e) => googleBackendMessage(e);
      expect(map(ApiException.network()), ApiException.networkMessage);
      expect(map(ApiException(ApiErrorKind.rateLimited, 'x')), ApiException.rateLimitedMessage);
      expect(map(ApiException(ApiErrorKind.server, 'Bu e-posta adresine ait hesap silinmiş.')), 'Bu e-posta adresine ait hesap silinmiş.');
      expect(
        map(ApiException(ApiErrorKind.server, 'Bu hesaba mevcut parolanızla giriş yapın; Google bağlantısı ayrıca doğrulanmalıdır.')),
        startsWith('Bu hesaba mevcut parolanızla'),
      );
      // What the sandbox backend really returns for a malformed / foreign token:
      expect(map(ApiException(ApiErrorKind.server, 'Wrong number of segments in token: x')), googleFailedMessage);
      expect(map(ApiException(ApiErrorKind.server, 'No pem found for envelope: {}')), googleFailedMessage);
      expect(map(ApiException(ApiErrorKind.server, 'Wrong recipient, payload audience != requiredAudience')), googleFailedMessage);
    });
  });

  group('flow: Google ID token → googleAuth → session', () {
    test('success uses the existing session handling', () async {
      final (auth, backend, store) = await _auth();
      final token = _jwt();
      backend.respond = (_) => _success(token);
      final identity = FakeGoogleIdTokenSource(result: 'google-id-token');

      expect(await signInWithGoogle(identity, auth), GoogleSignInOutcome.signedIn);
      expect(backend.requests, hasLength(1));
      expect(backend.requests.single['query'], contains('googleAuth(token: \$token)'));
      expect(backend.requests.single['variables'], {'token': 'google-id-token'});
      expect(auth.isSignedIn, isTrue);
      expect(auth.token, token, reason: 'the backend JWT, not the Google token, is the session');
      expect((await store.read())?.user.username, 'gkullanici123');
    });

    test('cancel: nothing is sent, still signed out', () async {
      final (auth, backend, _) = await _auth();
      final identity = FakeGoogleIdTokenSource(result: null);
      expect(await signInWithGoogle(identity, auth), GoogleSignInOutcome.cancelled);
      expect(backend.requests, isEmpty);
      expect(auth.isSignedIn, isFalse);
    });

    test('not configured: Google is not opened', () async {
      final (auth, backend, _) = await _auth();
      final identity = FakeGoogleIdTokenSource(configured: false, result: 'x');
      await expectLater(
        signInWithGoogle(identity, auth),
        throwsA(isA<GoogleSignInFailure>().having((f) => f.message, 'message', googleNotConfiguredMessage)),
      );
      expect(identity.requests, 0);
      expect(backend.requests, isEmpty);
    });

    test('token rejected by the backend: generic message, Google account forgotten, not signed in', () async {
      final (auth, backend, _) = await _auth();
      backend.respond = (_) => _error('Wrong recipient, payload audience != requiredAudience');
      final identity = FakeGoogleIdTokenSource(result: 'token-for-another-audience');
      await expectLater(
        signInWithGoogle(identity, auth),
        throwsA(isA<GoogleSignInFailure>().having((f) => f.message, 'message', googleFailedMessage)),
      );
      expect(identity.signOuts, 1);
      expect(auth.isSignedIn, isFalse);
    });

    test('deleted account: the server sentence is shown', () async {
      final (auth, backend, _) = await _auth();
      backend.respond = (_) => _error('Bu e-posta adresine ait hesap silinmiş.');
      await expectLater(
        signInWithGoogle(FakeGoogleIdTokenSource(result: 't'), auth),
        throwsA(isA<GoogleSignInFailure>().having((f) => f.message, 'message', 'Bu e-posta adresine ait hesap silinmiş.')),
      );
    });

    test('rate limited', () async {
      final (auth, backend, _) = await _auth();
      backend.respond = (_) => _error('Too many', 'RATE_LIMITED');
      await expectLater(
        signInWithGoogle(FakeGoogleIdTokenSource(result: 't'), auth),
        throwsA(isA<GoogleSignInFailure>().having((f) => f.message, 'message', ApiException.rateLimitedMessage)),
      );
    });

    test('network failure while calling the backend', () async {
      final store = MemorySessionStore();
      final auth = AuthController(store: store, revalidateEvery: Duration.zero);
      auth.attach(
        GraphQLClient(
          endpoint: 'http://test',
          readToken: () => auth.token,
          httpClient: MockClient((_) async => throw const SocketException('offline')),
        ),
      );
      await auth.initialise();
      await expectLater(
        signInWithGoogle(FakeGoogleIdTokenSource(result: 't'), auth),
        throwsA(isA<GoogleSignInFailure>().having((f) => f.message, 'message', ApiException.networkMessage)),
      );
      expect(auth.isSignedIn, isFalse);
    });

    test('malformed success payload is refused', () async {
      final (auth, backend, _) = await _auth();
      backend.respond = (_) => _gql({
        'data': {
          'googleAuth': {'token': 'not-a-jwt', 'user': null},
        },
      });
      await expectLater(signInWithGoogle(FakeGoogleIdTokenSource(result: 't'), auth), throwsA(isA<GoogleSignInFailure>()));
      expect(auth.isSignedIn, isFalse);
    });

    test('an unexpected plugin error becomes the generic message', () async {
      final (auth, _, _) = await _auth();
      await expectLater(
        signInWithGoogle(FakeGoogleIdTokenSource(result: StateError('boom')), auth),
        throwsA(isA<GoogleSignInFailure>().having((f) => f.message, 'message', googleFailedMessage)),
      );
    });
  });

  group('screens', () {
    Future<(AppServices, _Backend)> services(WidgetTester tester, FakeGoogleIdTokenSource identity) async {
      final backend = _Backend();
      final result = await tester.runAsync(() async {
        final auth = AuthController(store: MemorySessionStore(), revalidateEvery: Duration.zero);
        return AppServices.create(
          config: _config(server: _web, ios: _ios),
          sessionStore: MemorySessionStore(),
          localStore: MemoryLocalStore(),
          api: GraphQLClient(endpoint: 'http://test', readToken: () => auth.token, httpClient: backend.client),
          subscriptions: SubscriptionClient(url: '', readToken: () => null),
          google: identity,
        );
      });
      return (result!, backend);
    }

    Widget app(AppServices services, Widget screen) => MultiProvider(
      providers: [
        Provider<AppServices>.value(value: services),
        ChangeNotifierProvider<AuthController>.value(value: services.auth),
      ],
      child: MaterialApp.router(
        theme: buildBetikTheme(),
        routerConfig: GoRouter(
          routes: [
            GoRoute(path: '/', builder: (_, _) => screen),
            GoRoute(
              path: '/profile',
              builder: (_, _) => const Scaffold(body: Text('PROFILE')),
            ),
            GoRoute(
              path: '/books',
              builder: (_, _) => const Scaffold(body: Text('BOOKS')),
            ),
          ],
        ),
      ),
    );

    Future<void> tapGoogle(WidgetTester tester) async {
      await tester.ensureVisible(find.text('GOOGLE İLE DEVAM ET'));
      await tester.tap(find.text('GOOGLE İLE DEVAM ET'));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 100)));
      await tester.pumpAndSettle();
    }

    testWidgets('login: the button is shown even when the build is not configured, and says so', (tester) async {
      final (s, backend) = await services(tester, FakeGoogleIdTokenSource(configured: false));
      await tester.pumpWidget(app(s, const LoginScreen()));
      expect(find.text('GOOGLE İLE DEVAM ET'), findsOneWidget);
      await tapGoogle(tester);
      expect(find.text(googleNotConfiguredMessage), findsOneWidget);
      expect(backend.requests, isEmpty);
    });

    testWidgets('login: success signs in and goes to the profile (or returnTo)', (tester) async {
      final identity = FakeGoogleIdTokenSource(result: 'google-id-token');
      final (s, backend) = await services(tester, identity);
      backend.respond = (_) => _success(_jwt());
      await tester.pumpWidget(app(s, const LoginScreen(returnTo: '/books')));
      await tapGoogle(tester);
      expect(s.auth.isSignedIn, isTrue);
      expect(find.text('BOOKS'), findsOneWidget);
      // End the session so its expiry / polling timers stop.
      await tester.runAsync(() => s.auth.endSession());
      await tester.pump();
    });

    testWidgets('register: cancel leaves the form untouched without an error', (tester) async {
      final identity = FakeGoogleIdTokenSource(result: null);
      final (s, backend) = await services(tester, identity);
      await tester.pumpWidget(app(s, const RegisterScreen()));
      await tapGoogle(tester);
      expect(identity.requests, 1);
      expect(backend.requests, isEmpty);
      expect(find.text(googleFailedMessage), findsNothing);
      expect(s.auth.isSignedIn, isFalse);
    });

    testWidgets('login: a rejected token shows the website message', (tester) async {
      final (s, backend) = await services(tester, FakeGoogleIdTokenSource(result: 'bad'));
      backend.respond = (_) => _error('Wrong number of segments in token: bad');
      await tester.pumpWidget(app(s, const LoginScreen()));
      await tapGoogle(tester);
      expect(find.text(googleFailedMessage), findsOneWidget);
      expect(s.auth.isSignedIn, isFalse);
    });

    testWidgets('logout also forgets the Google account (account chooser next time)', (tester) async {
      final identity = FakeGoogleIdTokenSource(result: 'google-id-token');
      final (s, backend) = await services(tester, identity);
      backend.respond = (body) => (body['query'] as String).contains('googleAuth')
          ? _success(_jwt())
          : _gql({
              'data': {
                'logout': {'code': 200, 'message': 'ok'},
              },
            });
      await tester.runAsync(() => signInWithGoogle(identity, s.auth));
      expect(s.auth.isSignedIn, isTrue);
      final before = identity.signOuts;
      await tester.runAsync(() => s.auth.logout());
      expect(s.auth.isSignedIn, isFalse);
      expect(identity.signOuts, before + 1);
    });
  });
}
