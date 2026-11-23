import 'dart:async';
import 'dart:convert';

import 'package:betik/core/app_services.dart';
import 'package:betik/core/auth/auth_controller.dart';
import 'package:betik/core/auth/session.dart';
import 'package:betik/core/config/app_config.dart';
import 'package:betik/core/models/models.dart';
import 'package:betik/core/network/api_error.dart';
import 'package:betik/core/network/graphql_client.dart';
import 'package:betik/core/utils/format.dart';
import 'package:betik/core/widgets/mentions.dart';
import 'package:betik/features/admin/admin_print_funding.dart';
import 'package:betik/features/admin/admin_screens.dart';
import 'package:betik/features/auth/auth_screens.dart';
import 'package:betik/features/book/classification_fields.dart';
import 'package:betik/features/book/comments.dart';
import 'package:betik/features/discovery/feed_screen.dart';
import 'package:betik/features/funding/checkout_screen.dart';
import 'package:betik/features/funding/funding_shared.dart';
import 'package:betik/features/messaging/messages_screen.dart';
import 'package:betik/features/notifications/notifications_screen.dart';
import 'package:betik/features/reader/reader_screen.dart';
import 'package:betik/features/sessions/session_detail_screen.dart';
import 'package:betik/features/share/share_sheet.dart';
import 'package:betik/features/writing/image_upload.dart';
import 'package:betik/router.dart';
import 'package:flutter/services.dart';
import 'package:betik/core/api/documents.dart';
import 'package:betik/features/writing/quill_bridge.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/date_symbol_data_local.dart';

String jwt({required DateTime exp, String userId = 'u1'}) {
  String part(Object value) => base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${part({'alg': 'HS256'})}.${part({'userId': userId, 'version': 0, 'exp': exp.millisecondsSinceEpoch ~/ 1000})}.sig';
}

http.Response gql(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});

void main() {
  setUpAll(() => initializeDateFormatting('tr_TR'));

  group('token lifecycle', () {
    test('exp is read from the JWT; malformed tokens count as expired', () {
      final exp = DateTime.now().add(const Duration(hours: 24));
      expect(tokenExpiresAt(jwt(exp: exp)).difference(exp).inSeconds.abs(), lessThan(2));
      expect(tokenExpiresAt('not-a-token').millisecondsSinceEpoch, 0);
      expect(Session('x.y', const SessionUser(id: '1', username: 'a', fullName: '', email: '', role: 'USER')).isExpired, isTrue);
    });

    test('an expired stored session is discarded on start', () async {
      final store = MemorySessionStore(
        Session(
          jwt(exp: DateTime.now().subtract(const Duration(minutes: 1))),
          const SessionUser(id: 'u1', username: 'a', fullName: 'A', email: 'a@b.c', role: 'USER'),
        ),
      );
      final auth = AuthController(store: store, revalidateEvery: Duration.zero);
      auth.attach(GraphQLClient(endpoint: 'http://test', readToken: () => auth.token, httpClient: MockClient((_) async => gql({}))));
      await auth.initialise();
      expect(auth.isSignedIn, isFalse);
      expect(await store.read(), isNull);
    });

    test('login stores the session; UNAUTHENTICATED on a later request signs out locally', () async {
      final token = jwt(exp: DateTime.now().add(const Duration(hours: 24)));
      var revoked = false;
      final client = MockClient((request) async {
        final body = jsonDecode(request.body) as Map;
        final query = body['query'] as String;
        expect(request.headers['content-type'], startsWith('application/json'));
        if (query.contains('login(')) {
          expect(request.headers.containsKey('authorization'), isFalse);
          return gql({
            'data': {
              'login': {
                'token': token,
                'user': {'id': 'u1', 'username': 'dev_reader', 'fullName': 'R', 'email': 'r@x.y', 'role': 'USER'},
              },
            },
          });
        }
        if (revoked) {
          // The server answers HTTP 200 with a coded GraphQL error.
          return gql({
            'data': null,
            'errors': [
              {
                'message': 'Giriş yapmalısınız.',
                'extensions': {'code': 'UNAUTHENTICATED'},
              },
            ],
          });
        }
        expect(request.headers['authorization'], 'Bearer $token');
        return gql({
          'data': {
            'me': {'id': 'u1', 'username': 'dev_reader', 'fullName': 'R', 'email': 'r@x.y', 'role': 'ADMIN'},
          },
        });
      });
      final store = MemorySessionStore();
      final auth = AuthController(store: store, revalidateEvery: Duration.zero);
      final api = GraphQLClient(endpoint: 'http://test', readToken: () => auth.token, httpClient: client);
      auth.attach(api);
      await auth.initialise();
      await auth.login('r@x.y', 'pw');
      expect(auth.isSignedIn, isTrue);
      expect((await store.read())?.token, token);

      await auth.validate();
      expect(auth.user?.role, 'ADMIN', reason: 'role is refreshed from me');

      revoked = true;
      await expectLater(
        api.run('query Me { me { id } }'),
        throwsA(isA<ApiException>().having((e) => e.isUnauthenticated, 'unauth', isTrue)),
      );
      await Future<void>.delayed(Duration.zero);
      expect(auth.isSignedIn, isFalse);
      expect(await store.read(), isNull);
      expect(auth.signedOutNotice, isNotNull);
    });

    test('registerAndLogin: code 400 inside a successful response is a failure, never a session', () async {
      final auth = AuthController(store: MemorySessionStore(), revalidateEvery: Duration.zero);
      auth.attach(
        GraphQLClient(
          endpoint: 'http://test',
          readToken: () => auth.token,
          httpClient: MockClient(
            (_) async => gql({
              'data': {
                'registerAndLogin': {'code': 400, 'message': 'Doğrulama kodu hatalı.', 'token': null, 'user': null},
              },
            }),
          ),
        ),
      );
      await auth.initialise();
      final status = await auth.registerAndLogin(username: 'u', fullName: 'U', email: 'u@x.y', password: 'Aa1!aaaa', code: '000000');
      expect(status.ok, isFalse);
      expect(status.message, 'Doğrulama kodu hatalı.');
      expect(auth.isSignedIn, isFalse);
    });
  });

  group('error normalisation', () {
    test('GraphQL codes, validation details and HTTP bodies', () {
      final validation = ApiException.fromGraphQL([
        {
          'message': 'Validasyon Hatası',
          'extensions': {
            'code': 'BAD_USER_INPUT',
            'details': ['Telefon: 10–20 karakter gerekli.'],
          },
        },
      ]);
      expect(validation.kind, ApiErrorKind.validation);
      expect(validation.message, 'Telefon: 10–20 karakter gerekli.');
      final uncoded = ApiException.fromGraphQL([
        {
          'message': 'Bu kullanıcı mesaj almayı sınırlandırmış.',
          'extensions': {'code': 'INTERNAL_SERVER_ERROR'},
        },
      ]);
      expect(uncoded.kind, ApiErrorKind.server);
      expect(uncoded.message, 'Bu kullanıcı mesaj almayı sınırlandırmış.');
      expect(ApiException.fromHttp(429, {'error': 'RATE_LIMITED'}).kind, ApiErrorKind.rateLimited);
      expect(
        ApiException.fromGraphQL([
          {
            'message': 'x',
            'extensions': {'code': 'CONFLICT'},
          },
        ]).isConflict,
        isTrue,
      );
    });

    test('transport failures become a network error; nothing is fabricated', () async {
      final api = GraphQLClient(
        endpoint: 'http://test',
        readToken: () => null,
        httpClient: MockClient((_) async => throw http.ClientException('down')),
      );
      await expectLater(api.run('{ healthCheck }'), throwsA(isA<ApiException>().having((e) => e.isNetwork, 'network', isTrue)));
      final rateLimited = GraphQLClient(
        endpoint: 'http://test',
        readToken: () => null,
        httpClient: MockClient((_) async => gql({'error': 'RATE_LIMITED'}, 429)),
      );
      await expectLater(
        rateLimited.run('{ healthCheck }'),
        throwsA(isA<ApiException>().having((e) => e.kind, 'kind', ApiErrorKind.rateLimited)),
      );
    });
  });

  group('configuration', () {
    test('WebSocket URL is derived like the web client', () {
      expect(AppConfig.deriveWsUrl('http://localhost:5000'), 'ws://localhost:5000/graphql');
      expect(AppConfig.deriveWsUrl('https://api.example.com'), 'wss://api.example.com/graphql');
    });
  });

  group('formatting', () {
    test('tolerant date parser (ISO, epoch-ms string, number)', () {
      expect(parseApiDate('2026-11-14T13:57:11.000Z')!.toUtc().hour, 13);
      expect(parseApiDate('1794664631000')!.millisecondsSinceEpoch, 1794664631000);
      expect(parseApiDate(1794664631000)!.millisecondsSinceEpoch, 1794664631000);
      expect(parseApiDate(null), isNull);
      expect(parseApiDate('nonsense'), isNull);
    });

    test('relative times', () {
      final now = DateTime(2026, 11, 14, 12);
      expect(relativeShort(now.subtract(const Duration(seconds: 20)), now: now), 'Az önce');
      expect(relativeShort(now.subtract(const Duration(minutes: 15)), now: now), '15dk');
      expect(relativeAgo(now.subtract(const Duration(hours: 3)), now: now), '3sa önce');
      expect(relativeShort(now.subtract(const Duration(days: 2)), now: now), '2g');
    });

    test('money is integer kuruş', () {
      expect(formatMoney(450000), '₺4.500,00');
      expect(formatMoneyTl(450000), '4.500,00 TL');
      expect(parseTlToMinor('50'), 5000);
      expect(parseTlToMinor('12,5'), 1250);
      expect(parseTlToMinor('12.50'), 1250);
      expect(parseTlToMinor('1.250,75'), 125075);
      expect(parseTlToMinor('0'), 0);
      expect(parseTlToMinor('12,345'), isNull, reason: 'more than two decimals is rejected, never rounded');
      expect(parseTlToMinor('abc'), isNull);
      expect(parseTlToMinor('-5'), isNull);
    });

    test('Turkish casing and Cloudinary transformation', () {
      expect(trUpper('kitap detayına dön'), 'KİTAP DETAYINA DÖN');
      expect(trLower('IŞIK İLE'), 'ışık ile');
      expect(trFold('IŞIK') == trFold('işik'), isTrue);
      expect(
        optimizedImage('https://res.cloudinary.com/x/image/upload/v1/a.jpg', 300, 450),
        'https://res.cloudinary.com/x/image/upload/c_fill,w_300,h_450,q_auto,f_auto/v1/a.jpg',
      );
      expect(optimizedImage('https://example.com/a.jpg', 300, 450), 'https://example.com/a.jpg');
    });
  });

  group('models', () {
    test('book status derivation matches the server (explicit fields win, legacy status is the fallback)', () {
      expect(
        Book.fromJson({'id': '1', 'title': 't', 'digitalStatus': 'PUBLISHED', 'writingStatus': 'COMPLETED', 'status': 'DRAFT'}).isDraft,
        isFalse,
      );
      expect(Book.fromJson({'id': '1', 'title': 't', 'status': 'DRAFT'}).isDraft, isTrue);
      expect(Book.fromJson({'id': '1', 'title': 't', 'status': 'COMPLETED'}).isCompleted, isTrue);
      final card = Book.fromJson({
        'id': '1',
        'title': 't',
        'pageCount': 23,
        'stats': {'views': 1001, 'likes': 2},
      });
      expect(card.readingMinutes, 8);
      expect(card.isPopular, isTrue);
    });

    test('comment.userId is a User object; flat list is threaded one level deep', () {
      final comments = [
        {
          'id': 'r1',
          'content': 'kök eski',
          'date': '2026-11-01T10:00:00Z',
          'parentId': null,
          'userId': {'id': 'a', 'username': 'a'},
        },
        {
          'id': 'r2',
          'content': 'kök yeni',
          'date': '2026-11-02T10:00:00Z',
          'parentId': null,
          'userId': {'id': 'b', 'username': 'b'},
        },
        {
          'id': 'c2',
          'content': '@a ikinci',
          'date': '2026-11-03T12:00:00Z',
          'parentId': 'r1',
          'userId': {'id': 'b', 'username': 'b'},
        },
        {
          'id': 'c1',
          'content': '@a ilk',
          'date': '2026-11-03T10:00:00Z',
          'parentId': 'r1',
          'userId': {'id': 'b', 'username': 'b'},
        },
      ].map(BookComment.fromJson).toList();
      expect(comments.first.user?.username, 'a');
      final threads = threadComments(comments);
      expect(threads.map((t) => t.root.id), ['r2', 'r1'], reason: 'roots newest first');
      expect(threads.last.replies.map((c) => c.id), ['c1', 'c2'], reason: 'replies oldest first');
    });
  });

  group('validation rules', () {
    test('password rules are the server rules', () {
      expect(passwordProblem('Aa1!aaaa'), isNull);
      expect(passwordProblem('aa1!aaaa'), 'En az 1 büyük harf');
      expect(passwordProblem('Aa1!aa'), 'En az 8 karakter');
      expect(passwordProblem('Aaaaaaa1'), contains('özel karakter'));
      expect(extractResetToken('http://x/reset-password/${'ab' * 32}'), 'ab' * 32);
      expect(extractResetToken('short'), isNull);
    });

    test('classification limits', () {
      final value = ClassificationValue();
      expect(value.validate(), ['Bir eser biçimi seçin.', 'En az 1, en fazla 3 tür/konu seçin.']);
      value.formatId = 'f';
      value.genreIds.addAll(['1', '2', '3']);
      expect(value.validate(), isEmpty);
      value.genreIds.add('4');
      expect(value.validate(), isNotEmpty);
      expect(value.tagProblem('a'), contains('2–50'));
      expect(value.tagProblem('Bilim Kurgu'), isNull);
      value.tags.add('Bilim Kurgu');
      expect(value.tagProblem('bilim  kurgu'), 'Bu etiket zaten eklendi.');
      expect(value.tagProblem('<script>'), isNotNull);
      expect(value.toInput()['formatId'], 'f');
    });

    test('mentions: token detection and insertion', () {
      expect(mentionPattern.allMatches('selam @dev_author ve @çağrı.x!').map((m) => m.group(1)), ['dev_author', 'çağrı.x']);
      expect(mentionPattern.hasMatch('mail@example.com'), isFalse);
      expect(activeMentionQuery('merhaba @de', 11), 'de');
      expect(activeMentionQuery('merhaba', 7), isNull);
      final inserted = insertMention(
        const TextEditingValue(text: 'merhaba @de', selection: TextSelection.collapsed(offset: 11)),
        'dev_author',
      );
      expect(inserted.text, 'merhaba @dev_author ');
      expect(inserted.selection.baseOffset, inserted.text.length);
    });
  });

  group('feed filters', () {
    test('"Hedefe en yakın" forces ACTIVE and the previous support filter is restored afterwards', () {
      final filters = FeedFilters()..setFunding('FUNDED');
      filters.setSort('CLOSEST_TO_TARGET');
      expect(filters.funding, 'ACTIVE');
      filters.setSort('POPULAR');
      expect(filters.funding, 'FUNDED');
      filters.setSort('CLOSEST_TO_TARGET');
      filters.setFunding('ALL');
      expect(filters.sort, 'NEWEST', reason: 'leaving ACTIVE while sorted by target resets the sort');
    });

    test('classification filter sends slugs', () {
      expect(const ClassificationFilterValue().toInput(), isNull);
      expect(const ClassificationFilterValue(genre: 'bilim-kurgu', tag: 'uzay').toInput(), {
        'genres': ['bilim-kurgu'],
        'tags': ['uzay'],
      });
    });
  });

  group('navigation', () {
    test('route guards', () {
      String? guard(String path, {bool signedIn = false, String? role}) =>
          guardRedirect(location: path, path: Uri.parse(path).path, signedIn: signedIn, role: role);
      expect(guard('/create-book'), '/login?returnTo=%2Fcreate-book');
      expect(guard('/messages/abc'), startsWith('/login'));
      expect(guard('/feed'), isNull);
      expect(guard('/book/1'), isNull);
      expect(guard('/admin/data'), '/');
      expect(guard('/admin', signedIn: true, role: 'USER'), '/');
      expect(guard('/admin', signedIn: true, role: 'PUBLISHER'), '/');
      expect(guard('/admin', signedIn: true, role: 'ADMIN'), isNull);
      expect(guard('/publisher'), startsWith('/login'));
      expect(guard('/publisher', signedIn: true, role: 'USER'), '/');
      expect(guard('/publisher', signedIn: true, role: 'PUBLISHER'), isNull);
      expect(guard('/publisher', signedIn: true, role: 'ADMIN'), isNull);
    });

    test('notification targets', () {
      const reader = SessionUser(id: 'me', username: 'r', fullName: '', email: '', role: 'USER');
      const admin = SessionUser(id: 'adm', username: 'a', fullName: '', email: '', role: 'ADMIN');
      String? target(String type, Map<String, dynamic> meta, [SessionUser user = reader]) =>
          notificationTarget(AppNotification(id: 'n', type: type, title: '', message: '', meta: meta), user);
      expect(target('POINTS_EARNED', {}), isNull);
      expect(target('BADGE_EARNED', {}), '/profile');
      expect(target('NEW_CHAPTER', {'bookId': 'b', 'chapterId': 'c'}), '/reader/b?chapter=c');
      expect(target('COMMENT_MENTION', {'bookId': 'b', 'commentId': 'k'}), '/book/b?comment=k');
      expect(target('COMMENT_RECEIVED', {'bookId': 'b'}), '/book/b?comments=1');
      expect(
        target('PARAGRAPH_MENTION', {'bookId': 'b', 'chapterId': 'c', 'paragraphIndex': 3, 'commentId': 'k'}),
        '/reader/b?chapter=c&paragraph=3&comment=k',
      );
      expect(target('PARAGRAPH_MENTION', {'bookId': 'b', 'chapterId': 'c'}), isNull);
      expect(target('QUOTE_MENTION', {'quoteId': 'q', 'commentId': 'k'}), '/quotes/q?comment=k');
      expect(target('SESSION_REPLY', {'sessionId': 's', 'entryId': 'e'}), '/session/s?entry=e');
      expect(target('FOLLOW_REQUEST', {'requesterId': 'u'}), '/user/u');
      expect(target('BOOK_REVIEW', {'bookId': 'b'}), '/book/b');
      expect(target('BOOK_REVIEW', {'bookId': 'b'}, admin), '/admin/printed-books');
      expect(target('PRINT_UPDATE', {'bookId': 'b', 'authorId': 'me'}), '/print/b');
      expect(target('PRINT_UPDATE', {'bookId': 'b', 'authorId': 'x'}), '/book/b');
      expect(target('PRINT_UPDATE', {}, admin), '/admin/print-funding');
      expect(target('FUNDING_RECEIVED', {}), '/funding-history');
      expect(target('SOMETHING_NEW', {}), isNull);
    });

    test('registration intent is kept for its origin and expires when consumed', () {
      final intents = IntentStore()..save(RegistrationIntent(action: 'comment', returnTo: '/book/1', draft: 'taslak'));
      expect(intents.returnTo, '/book/1');
      expect(intents.consume('comment', '/book/2'), isNull);
      expect(intents.consume('like', '/book/1'), isNull);
      expect(intents.consume('comment', '/book/1')?.draft, 'taslak');
      expect(intents.returnTo, isNull);
    });
  });

  group('reader', () {
    test('primary button label by state', () {
      const open = Chapter(id: '2', title: 'b');
      const gated = Chapter(id: '2', title: 'b', accessStatus: 'REGISTRATION_REQUIRED', canReadContent: false);
      const hidden = Chapter(id: '2', title: 'b', accessStatus: 'HIDDEN', canReadContent: false);
      // Website rule: the CURRENT chapter decides (BookReader/index.jsx).
      expect(nextButtonLabel(current: open, hasNext: true, completed: false), 'Tamamla ve Devam Et');
      expect(nextButtonLabel(current: open, hasNext: true, completed: true), 'Sonraki Bölüm');
      expect(nextButtonLabel(current: gated, hasNext: true, completed: false), 'Ücretsiz üyelikle oku');
      expect(nextButtonLabel(current: hidden, hasNext: true, completed: false), 'Sonraki Bölüm');
      expect(nextButtonLabel(current: hidden, hasNext: false, completed: false), 'Okuyuculara kapalı');
      expect(nextButtonLabel(current: open, hasNext: false, completed: false), 'Tamamla');
      expect(nextButtonLabel(current: open, hasNext: false, completed: true), '✦ Tamamlandı');
      // A hidden chapter in the middle must not block the reader (was a defect).
      expect(nextButtonDisabled(current: open, hasNext: true, completed: false), isFalse);
      expect(nextButtonDisabled(current: hidden, hasNext: true, completed: false), isFalse);
      expect(nextButtonDisabled(current: hidden, hasNext: false, completed: false), isTrue);
      expect(nextButtonDisabled(current: open, hasNext: false, completed: true), isTrue);
      expect(nextButtonDisabled(current: gated, hasNext: false, completed: false), isFalse);
    });

    test('copy action places the website notice, not the text', () {
      final notice = copyProtectionNotice(title: 'Çağ & Işık', url: 'https://betik.example/kitap/cag');
      expect(notice, startsWith('Kitap: Çağ & Işık\nLink: https://betik.example/kitap/cag\n\n* Bu platformdaki'));
    });
  });

  group('sharing', () {
    const config = AppConfig(
      apiUrl: 'https://api.betik.example',
      wsUrl: 'wss://api.betik.example/graphql',
      webUrl: 'https://betik.example',
      cloudinaryCloudName: '',
      cloudinaryUploadPreset: '',
      googleServerClientId: '',
      googleIosClientId: '',
    );

    test('shared link is the API preview URL with the slug and web origin', () {
      final links = ShareLinks.fromSocialShare({
        'type': 'BOOK', 'id': '64f000000000000000000001', 'title': 'Çağ', 'description': 'Özet', //
        'path': '/kitap/cag-ve-isik-dev_author', 'imagePath': '/social-share/book.jpg', 'webOrigin': 'https://other.example',
      }, config);
      expect(links.url, 'https://api.betik.example/share/book/cag-ve-isik-dev_author?webOrigin=https%3A%2F%2Fbetik.example');
      expect(links.directUrl, 'https://betik.example/kitap/cag-ve-isik-dev_author');
      expect(links.imageUrl, 'https://betik.example/social-share/book.jpg');
      expect(links.text, 'Çağ\n\nÖzet\n\n${links.url}');
      expect(links.whatsapp, startsWith('https://wa.me/?text='));
    });

    test('non-slug paths share the id', () {
      final links = ShareLinks.fromSocialShare({
        'type': 'QUOTE',
        'id': 'q1',
        'title': 'Alıntı',
        'description': '',
        'path': '/quotes/q1',
        'imagePath': '/social-share/quote.jpg',
        'webOrigin': 'x',
      }, config);
      expect(links.url, startsWith('https://api.betik.example/share/quote/q1?'));
    });

    test('relative assets resolve against the web host', () {
      expect(config.resolveWebAsset('/images/sessions/default-cover.jpg'), 'https://betik.example/images/sessions/default-cover.jpg');
      expect(config.resolveWebAsset('https://cdn/x.png'), 'https://cdn/x.png');
      expect(config.resolveWebAsset('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
    });
  });

  group('payments', () {
    test('idempotency key is a UUID v4 within the server pattern', () {
      final key = newCheckoutKey();
      expect(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$').hasMatch(key), isTrue);
      expect(RegExp(r'^[A-Za-z0-9_-]{16,100}$').hasMatch(key), isTrue);
      expect(newCheckoutKey(), isNot(key));
    });

    test('basket total and hosted checkout allow-list', () {
      expect(basketTotalMinor(unitPriceMinor: 12550, quantity: 2, donationMinor: 5000), 30100);
      expect(safeCheckoutUrl('https://sandbox-cpp.iyzipay.com/x?token=1'), isNotNull);
      expect(safeCheckoutUrl('https://evil.example/pay'), isNull);
      expect(safeCheckoutUrl('http://sandbox-cpp.iyzipay.com/x'), isNull);
      expect(safeCheckoutUrl('https://user@sandbox-cpp.iyzipay.com/x'), isNull);
      expect(safeCheckoutUrl(null), isNull);
    });

    test('status labels', () {
      expect(statusName('CAPTURED'), 'Test ödemesi doğrulandı');
      expect(statusName('REFUND_PENDING'), 'İade bekleniyor');
      expect(statusName('SOMETHING'), 'SOMETHING');
    });

    test('admin state machines', () {
      expect(productionChoices('PREPARATION', null), ['PRINTER_APPROVED', 'ISSUE', 'CANCELLED']);
      expect(productionChoices('ISSUE', 'PRINTING'), ['PRINTING', 'CANCELLED']);
      expect(orderChoices('PACKAGING', null), ['SHIPPED', 'ISSUE']);
      expect(orderChoices('ISSUE', 'SHIPPED'), ['SHIPPED']);
      expect(orderChoices('DELIVERED', null), isEmpty);
    });
  });

  group('admin helpers', () {
    test('nested field values and previews', () {
      expect(
        fieldValue({
          'privacySettings': {'isProfilePublic': false},
        }, 'privacySettings.isProfilePublic'),
        false,
      );
      expect(fieldValue({'a': 1}, 'a.b'), isNull);
      expect(adminPreview(true), 'Evet');
      expect(adminPreview(['x', 'y']), '2 kayıt');
      expect(adminPreview(''), '—');
      expect(adminPreview('ADMIN'), 'Yönetici');
      expect(adminColumns({'name': 'User', 'fields': []}), ['username', 'email', 'role', 'isActive']);
    });
  });

  group('real-time merges', () {
    test('a message that arrives from both the mutation and the subscription is shown once', () {
      final messages = <ChatMessage>[];
      const message = ChatMessage(id: 'm1', conversationId: 'c', content: 'selam');
      expect(mergeMessage(messages, message), isTrue);
      expect(mergeMessage(messages, message), isFalse);
      expect(messages, hasLength(1));
      expect(
        messagePreview(
          const ChatMessage(
            id: 'm',
            conversationId: 'c',
            content: '',
            type: 'BOOK',
            sender: UserSummary(id: 'me', username: 'm'),
          ),
          'me',
        ),
        'Sen: 📖 Kitap paylaştı',
      );
      expect(messagePreview(null, 'me'), 'Henüz mesaj yok');
    });

    test('session entries are de-duplicated', () {
      final entries = <SessionEntry>[];
      const entry = SessionEntry(id: 'e1', sessionId: 's', content: 'yazı');
      expect(mergeEntry(entries, entry), isTrue);
      expect(mergeEntry(entries, entry), isFalse);
    });
  });

  group('images', () {
    test('type sniffing and centre crop arithmetic match the web cropImage', () {
      expect(sniffImageType(Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0])), 'jpeg');
      expect(sniffImageType(Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])), 'png');
      expect(sniffImageType(Uint8List.fromList([0x47, 0x49, 0x46, 0x38])), isNull, reason: 'GIF is not accepted');
      expect(centerCropRect(3000, 2000, 2 / 3), (834, 0, 1333, 2000));
      expect(centerCropRect(1000, 3000, 2 / 3), (0, 750, 1000, 1500));
      expect(centerCropRect(1600, 900, 16 / 9), (0, 0, 1600, 900));
    });
  });

  group('stage 3 verification regressions', () {
    test('recommendations ask only for fields the resolver loads (no pageCount)', () {
      expect(recommendationBookFields, isNot(contains('pageCount')));
      expect(recommendationBookFields, contains('publicPath'));
    });

    test('editor bridge registers the legacy Cupertino localisations (iOS selection toolbar)', () {
      expect(quillBridgeLocalizationDelegates.map((d) => d.type.toString()), contains('CupertinoLocalizations'));
    });
  });

  group('feed controller', () {
    test('a response that arrives after dispose does not notify (V-10)', () async {
      final gate = Completer<http.Response>();
      final client = GraphQLClient(endpoint: 'http://test.invalid', readToken: () => null, httpClient: MockClient((_) => gate.future));
      final feed = BookFeedController(client);
      final pending = feed.load(const {'sort': 'NEWEST'});
      feed.dispose();
      gate.complete(
        http.Response(
          jsonEncode({
            'data': {
              'getBookFeed': {'books': [], 'endCursor': null, 'hasNextPage': false},
            },
          }),
          200,
        ),
      );
      await pending; // must not throw "used after being disposed"
    });
  });
}
