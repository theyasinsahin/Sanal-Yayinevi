// Contract tests against a RUNNING, DISPOSABLE Betik backend (the Stage 2
// sandbox). Skipped unless the environment provides it:
//
//   BETIK_TEST_API=http://localhost:5055 BETIK_TEST_PASSWORD=<seed password> \
//     flutter test test/integration/live_api_test.dart
//
// The tests create and delete their own data (a draft book, comments, a
// conversation message). Never point them at a database that matters.
import 'dart:async';
import 'dart:io';

import 'package:betik/core/api/documents.dart';
import 'package:betik/core/auth/auth_controller.dart';
import 'package:betik/core/auth/session.dart';
import 'package:betik/core/config/app_config.dart';
import 'package:betik/core/models/models.dart';
import 'package:betik/core/network/api_error.dart';
import 'package:betik/core/network/graphql_client.dart';
import 'package:betik/core/network/subscription_client.dart';
import 'package:betik/core/richtext/page_count.dart';
import 'package:betik/core/richtext/paragraphs.dart';
import 'package:betik/core/richtext/quill_html.dart';
import 'package:betik/core/utils/format.dart';
import 'package:betik/features/book/book_detail_screen.dart';
import 'package:betik/features/discovery/feed_screen.dart';
import 'package:betik/features/funding/funding_shared.dart';
import 'package:betik/features/messaging/messages_screen.dart';
import 'package:betik/features/reader/reader_progress.dart';
import 'package:betik/features/reader/reading_tracker.dart';
import 'package:flutter_test/flutter_test.dart';

class Account {
  Account(this.auth, this.api);
  final AuthController auth;
  final GraphQLClient api;
  String get id => auth.userId!;
}

void main() {
  final endpoint = Platform.environment['BETIK_TEST_API'];
  final password = Platform.environment['BETIK_TEST_PASSWORD'];
  final skip = endpoint == null || password == null ? 'BETIK_TEST_API / BETIK_TEST_PASSWORD not set' : null;

  Future<Account> signIn(String email) async {
    final auth = AuthController(store: MemorySessionStore(), revalidateEvery: Duration.zero);
    final api = GraphQLClient(endpoint: endpoint!, readToken: () => auth.token);
    auth.attach(api);
    await auth.initialise();
    await auth.login(email, password!);
    return Account(auth, api);
  }

  late Account reader;
  late Account author;
  late Account admin;
  late Account publisher;

  setUpAll(() async {
    if (skip != null) return;
    reader = await signIn('reader@betik-dev.invalid');
    author = await signIn('author@betik-dev.invalid');
    admin = await signIn('admin@betik-dev.invalid');
    publisher = await signIn('publisher@betik-dev.invalid');
  });

  group('live backend', skip: skip, () {
    test('login returns a 24-hour JWT and me confirms the role', () async {
      expect(reader.auth.isSignedIn, isTrue);
      final lifetime = tokenExpiresAt(reader.auth.token!).difference(DateTime.now());
      expect(lifetime.inHours, inInclusiveRange(23, 24));
      await admin.auth.validate();
      expect(admin.auth.user?.role, 'ADMIN');
      expect(publisher.auth.user?.isPublisher, isTrue);
    });

    test('wrong password is a failure with the generic message; guests get UNAUTHENTICATED on member operations', () async {
      final auth = AuthController(store: MemorySessionStore(), revalidateEvery: Duration.zero);
      final api = GraphQLClient(endpoint: endpoint!, readToken: () => auth.token);
      auth.attach(api);
      await auth.initialise();
      await expectLater(
        auth.login('reader@betik-dev.invalid', 'wrong-password'),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Giriş bilgileri geçersiz.')),
      );
      expect(auth.isSignedIn, isFalse);
      await expectLater(
        api.run('query GetNotifications { getNotifications { id } }'),
        throwsA(isA<ApiException>().having((e) => e.isUnauthenticated, 'unauthenticated', isTrue)),
      );
    });

    test('feed, book detail and date encodings', () async {
      final data = await reader.api.run(bookFeedQuery, variables: {'limit': 24, 'sort': 'NEWEST', 'funding': 'ALL'});
      final books = jsonList((data['getBookFeed'] as Map)['books']).map(Book.fromJson).toList();
      expect(books, isNotEmpty);
      expect(books.first.publishDate, isNotNull, reason: 'DateTime fields are ISO strings the tolerant parser reads');
      final detail = await reader.api.run(bookDetailQuery, variables: {'id': books.first.id});
      final book = Book.fromJson(Map<String, dynamic>.from(detail['getBookById'] as Map));
      expect(book.title, books.first.title);
      expect(book.isDraft, isFalse);
      expect(book.classification.format, isNotNull);

      final searched = await reader.api.run(
        bookFeedQuery,
        variables: {'limit': 24, 'sort': 'CLOSEST_TO_TARGET', 'funding': 'ACTIVE', 'search': 'zzzz-no-such'},
      );
      expect(jsonList((searched['getBookFeed'] as Map)['books']), isEmpty);
    });

    test('dynamic documents: leaderboard with own rank, follow action', () async {
      final leaderboard = await reader.api.run(
        'query Leaderboard(\$period: String, \$userId: ID!) { getLeaderboard(period: \$period) { rank points user { $userFields } } getUserRank(userId: \$userId, period: \$period) { rank points } }',
        variables: {'period': 'total', 'userId': reader.id},
      );
      expect(leaderboard['getLeaderboard'], isA<List<dynamic>>());

      const action = 'code message followStatus request { id status }';
      final request = await reader.api.run(
        'mutation FollowAction(\$id: ID!) { requestFollowUser(targetId: \$id) { $action } }',
        variables: {'id': publisher.id},
      );
      final status = (request['requestFollowUser'] as Map)['followStatus'];
      expect(status, anyOf('PENDING', 'FOLLOWING'), reason: 'every follow is a request');
      if (status == 'PENDING') {
        final cancel = await reader.api.run(
          'mutation FollowAction(\$id: ID!) { cancelFollowRequest(targetId: \$id) { $action } }',
          variables: {'id': publisher.id},
        );
        expect((cancel['cancelFollowRequest'] as Map)['followStatus'], 'NOT_FOLLOWING');
      }
    });

    test('author: create draft → chapter HTML survives the server sanitiser → page count → reader contract', () async {
      final options = await author.api.run(classificationOptionsQuery);
      final classification = ClassificationOptions.fromJson(Map<String, dynamic>.from(options['getClassificationOptions'] as Map));
      expect(classification.formats, isNotEmpty);

      final created = await author.api.run(
        r'mutation CreateBook($title: String!, $classification: ClassificationInput!, $description: String!, $imageUrl: String!) { createBook(title: $title, classification: $classification, description: $description, imageUrl: $imageUrl) { id title } }',
        variables: {
          'title': 'Stage 3 Flutter sözleşme testi ${DateTime.now().millisecondsSinceEpoch}',
          'classification': {
            'formatId': classification.formats.first.id,
            'genreIds': [classification.genres.first.id],
            'tags': <String>[],
            'narrativeFeatureIds': <String>[],
            'targetAudienceId': null,
            'contentWarningIds': <String>[],
          },
          'description': 'Flutter istemcisinin sözleşme testi için geçici taslak.',
          'imageUrl': 'https://res.cloudinary.com/betik-sandbox-mock/image/upload/v1/stage3.jpg',
        },
      );
      final bookId = (created['createBook'] as Map)['id'] as String;
      addTearDown(
        () => author.api.run(r'mutation DeleteBook($id: ID!) { deleteBook(id: $id) { code message } }', variables: {'id': bookId}),
      );

      final chapter = await author.api.run(
        r'mutation CreateChapter($bookId: ID!, $title: String!, $content: String!, $pageCount: Int, $isHidden: Boolean) { createChapter(bookId: $bookId, title: $title, content: $content, pageCount: $pageCount, isHidden: $isHidden) { id title } }',
        variables: {'bookId': bookId, 'title': 'Biçim Testi', 'content': '', 'pageCount': 0, 'isHidden': false},
      );
      final chapterId = (chapter['createChapter'] as Map)['id'] as String;

      // What the native editor produces for a document with every toolbar
      // format (Delta → HTML).
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      final html = deltaToHtml([
        {'insert': 'Başlık'},
        {
          'insert': '\n',
          'attributes': {'header': 1},
        },
        {'insert': 'Özel: <b>değil</b> & "tırnak" İıŞşĞğ 😀 '},
        {
          'insert': 'kalın',
          'attributes': {'bold': true},
        },
        {'insert': ' '},
        {
          'insert': 'italik',
          'attributes': {'italic': true},
        },
        {'insert': ' '},
        {
          'insert': 'altı',
          'attributes': {'underline': true},
        },
        {'insert': ' '},
        {
          'insert': 'üstü',
          'attributes': {'strike': true},
        },
        {'insert': ' '},
        {
          'insert': 'bağlantı',
          'attributes': {'link': 'https://example.com/?a=1&b=2'},
        },
        {'insert': '\n\nAlıntı satırı'},
        {
          'insert': '\n',
          'attributes': {'blockquote': true},
        },
        {'insert': 'bir'},
        {
          'insert': '\n',
          'attributes': {'list': 'ordered'},
        },
        {'insert': 'madde'},
        {
          'insert': '\n',
          'attributes': {'list': 'bullet'},
        },
        {
          'insert': {'image': png},
        },
        {'insert': '\nSon paragraf.\n'},
      ]);
      final pageCount = computePageCount(html);
      final saved = await author.api.run(
        r'mutation UpdateChapter($chapterId: ID!, $content: String, $pageCount: Int) { updateChapter(chapterId: $chapterId, content: $content, pageCount: $pageCount) { id pageCount wordCount content } }',
        variables: {'chapterId': chapterId, 'content': html, 'pageCount': pageCount},
      );
      final stored = (saved['updateChapter'] as Map)['content'] as String;
      // The server's sanitiser re-serialises void elements in XHTML style
      // (`<br />`, `<img … />`) — for chapters saved from the website too.
      // Apart from that the stored HTML is exactly what the app sent.
      expect(stored.replaceAll(' />', '>'), html, reason: 'nothing is stripped or rewritten by the server sanitiser');
      expect(canonicalHtml(stored), canonicalHtml(html));
      expect((saved['updateChapter'] as Map)['pageCount'], pageCount);
      expect(((saved['updateChapter'] as Map)['wordCount'] as num) > 0, isTrue);

      // Reading it back and editing again changes nothing.
      expect(roundTripsCleanly(stored), isTrue);
      expect(deltaToHtml(htmlToDelta(stored).ops), html, reason: 'opening and re-saving reproduces the same document');
      expect(computePageCount(stored), pageCount, reason: 'page count is independent of the void-element spelling');
      expect(segmentChapter(stored).map((s) => s.paragraphIndex), [
        null,
        0,
        1,
        null,
        null,
        null,
        2,
        3,
      ], reason: 'only top-level <p> blocks are addressable');

      // Publish (WRITING, like the website) and read as another member.
      await author.api.run(updateBookStatusMutation, variables: {'bookId': bookId, 'status': 'WRITING'});
      final reading = await reader.api.run(
        r'query GetReadingChapter($bookId: ID!, $chapterId: ID!) { getReadingChapter(bookId: $bookId, chapterId: $chapterId) { id title content accessStatus canReadContent pageCount wordCount } }',
        variables: {'bookId': bookId, 'chapterId': chapterId},
      );
      final read = Chapter.fromJson(Map<String, dynamic>.from(reading['getReadingChapter'] as Map));
      expect(read.accessStatus, 'READABLE');
      expect(read.content, stored);

      // Bookmark on paragraph 2, paragraph comment, progress, reading time.
      final bookmark = await reader.api.run(
        r'mutation SetBookmark($bookId: ID!, $chapterId: ID!, $chapterIndex: Int!, $paragraphIndex: Int!, $chapterTitle: String) { setBookmark(bookId: $bookId, chapterId: $chapterId, chapterIndex: $chapterIndex, paragraphIndex: $paragraphIndex, chapterTitle: $chapterTitle) { chapterId chapterIndex paragraphIndex chapterTitle } }',
        variables: {'bookId': bookId, 'chapterId': chapterId, 'chapterIndex': 0, 'paragraphIndex': 2, 'chapterTitle': 'Biçim Testi'},
      );
      expect(Bookmark.maybe(bookmark['setBookmark'])?.paragraphIndex, 2);

      await reader.api.run(
        r'mutation AddParagraphComment($bookId: ID!, $chapterId: ID!, $paragraphIndex: Int!, $content: String!) { addParagraphComment(bookId: $bookId, chapterId: $chapterId, paragraphIndex: $paragraphIndex, content: $content) { id } }',
        variables: {'bookId': bookId, 'chapterId': chapterId, 'paragraphIndex': 2, 'content': 'Flutter paragraf yorumu'},
      );
      final counts = await reader.api.run(
        r'query GetParagraphCommentCounts($chapterId: ID!) { getParagraphCommentCounts(chapterId: $chapterId) { paragraphIndex count } }',
        variables: {'chapterId': chapterId},
      );
      expect(jsonList(counts['getParagraphCommentCounts']).single, {'paragraphIndex': 2, 'count': 1});

      final progress = await reader.api.run(
        saveReadingProgressMutation,
        variables: {
          'bookId': bookId,
          'chapterId': chapterId,
          'completedChapterIds': [chapterId],
        },
      );
      expect((progress['saveReadingProgress'] as Map)['isCompleted'], isTrue);
      final state = await reader.api.run(getReadingProgressQuery, variables: {'bookId': bookId});
      final resolved = resolveReaderProgress(
        chapters: [read],
        bookmark: Bookmark.maybe(bookmark['setBookmark']),
        server: Map<String, dynamic>.from(state['getReadingProgress'] as Map),
      );
      expect((resolved.source, resolved.paragraphIndex), ('bookmark', 2));

      final session = await reader.api.run(startReadingSessionMutation, variables: {'bookId': bookId, 'chapterId': chapterId});
      final sessionId = (session['startReadingSession'] as Map)['sessionId'] as String;
      await Future<void>.delayed(const Duration(milliseconds: 2200));
      final report = await reader.api.run(
        reportReadingTimeMutation,
        variables: {'sessionId': sessionId, 'sequence': 1, 'seconds': 2, 'chapterId': chapterId},
      );
      expect((report['reportReadingTime'] as Map)['sequence'], 1);
      expect((report['reportReadingTime'] as Map)['acceptedSeconds'], inInclusiveRange(1, 2));
      // Claiming more time than really passed is refused with a code the
      // tracker understands.
      await expectLater(
        reader.api.run(
          reportReadingTimeMutation,
          variables: {'sessionId': sessionId, 'sequence': 2, 'seconds': 60, 'chapterId': chapterId},
        ),
        throwsA(isA<ApiException>()),
      );

      // Quote: duplicate check, create, duplicate detected afterwards.
      const quoteText = 'Özel: <b>değil</b> & "tırnak" İıŞşĞğ';
      Future<bool> exists() async {
        final check = await reader.api.run(
          r'query CheckQuoteExists($text: String!, $bookId: ID!, $visibility: QuoteVisibility) { checkQuoteExists(text: $text, bookId: $bookId, visibility: $visibility) { exists } }',
          variables: {'text': quoteText, 'bookId': bookId, 'visibility': 'PUBLIC'},
        );
        return (check['checkQuoteExists'] as Map)['exists'] == true;
      }

      expect(await exists(), isFalse);
      await reader.api.run(
        r'mutation CreateQuote($text: String!, $note: String, $bookId: ID!, $chapterId: ID, $chapterTitle: String, $chapterIndex: Int, $location: QuoteLocationInput, $isSpoiler: Boolean, $visibility: QuoteVisibility) { createQuote(text: $text, note: $note, bookId: $bookId, chapterId: $chapterId, chapterTitle: $chapterTitle, chapterIndex: $chapterIndex, location: $location, isSpoiler: $isSpoiler, visibility: $visibility) { id } }',
        variables: {
          'text': quoteText,
          'note': '',
          'bookId': bookId,
          'chapterId': chapterId,
          'chapterTitle': 'Biçim Testi',
          'chapterIndex': 0,
          'location': {'startOffset': 6, 'endOffset': 6 + quoteText.length},
          'isSpoiler': false,
          'visibility': 'PUBLIC',
        },
      );
      expect(await exists(), isTrue);

      // A non-owner cannot write to the book (the server enforces it).
      await expectLater(
        reader.api.run(
          r'mutation UpdateChapter($chapterId: ID!, $content: String, $pageCount: Int) { updateChapter(chapterId: $chapterId, content: $content, pageCount: $pageCount) { id } }',
          variables: {'chapterId': chapterId, 'content': '<p>x</p>', 'pageCount': 1},
        ),
        throwsA(isA<ApiException>()),
      );
    }, timeout: const Timeout(Duration(seconds: 60)));

    test('comments: create, flat list with parentId, reply flattening, delete', () async {
      final feed = await reader.api.run(bookFeedQuery, variables: {'limit': 1, 'sort': 'NEWEST'});
      final bookId = jsonList((feed['getBookFeed'] as Map)['books']).first['id'] as String;
      final created = await reader.api.run(
        r'mutation CreateComment($bookId: ID!, $content: String!) { createComment(bookId: $bookId, content: $content) { id } }',
        variables: {'bookId': bookId, 'content': 'Flutter sözleşme yorumu'},
      );
      final id = (created['createComment'] as Map)['id'] as String;
      final reply = await author.api.run(
        r'mutation ReplyToComment($bookId: ID!, $content: String!, $parentCommentId: ID!) { replyToComment(bookId: $bookId, content: $content, parentCommentId: $parentCommentId) { id } }',
        variables: {'bookId': bookId, 'content': '@dev_reader teşekkürler', 'parentCommentId': id},
      );
      final list = await reader.api.run(
        r'query GetCommentsByBookId($bookId: ID!) { getCommentsByBookId(bookId: $bookId) { id content date parentId likedBy userId { id username fullName profilePicture } } }',
        variables: {'bookId': bookId},
      );
      final comments = jsonList(list['getCommentsByBookId']).map(BookComment.fromJson).toList();
      final mine = comments.firstWhere((comment) => comment.id == id);
      expect(mine.user?.id, reader.id);
      expect(mine.date, isNotNull);
      expect(comments.firstWhere((comment) => comment.id == (reply['replyToComment'] as Map)['id']).parentId, id);
      await reader.api.run(r'mutation DeleteComment($id: ID!) { deleteComment(id: $id) { code message } }', variables: {'id': id});
    });

    test('real WebSocket: a chat message reaches the other participant through onNewMessage', () async {
      // The reader may only start a conversation with someone they follow
      // or who accepts everyone; open it from the author's side as well.
      final conversation = await author.api.run(
        'query GetOrCreateConversation(\$recipientId: ID!) { getOrCreateConversation(recipientId: \$recipientId) { $conversationFields } }',
        variables: {'recipientId': reader.id},
      );
      final conversationId = (conversation['getOrCreateConversation'] as Map)['id'] as String;

      final socket = SubscriptionClient(url: AppConfig.deriveWsUrl(endpoint!), readToken: () => reader.auth.token);
      final received = Completer<ChatMessage>();
      final subscription = socket
          .subscribe(
            'subscription OnNewMessage(\$conversationId: ID!) { onNewMessage(conversationId: \$conversationId) { $messageFields } }',
            variables: {'conversationId': conversationId},
          )
          .listen((data) {
            if (!received.isCompleted) received.complete(ChatMessage.fromJson(Map<String, dynamic>.from(data['onNewMessage'] as Map)));
          });
      await Future<void>.delayed(const Duration(milliseconds: 800)); // connection_init → ack → subscribe

      final text = 'Flutter canlı mesaj ${DateTime.now().millisecondsSinceEpoch}';
      final sent = await author.api.run(
        sendMessageMutation,
        variables: {
          'input': {'conversationId': conversationId, 'content': text, 'type': 'TEXT'},
        },
      );
      final message = await received.future.timeout(const Duration(seconds: 8));
      expect(message.content, text);
      expect(message.sender?.id, author.id);
      expect(message.createdAt, isNotNull);

      final unread = await reader.api.run('query GetUnreadMessageCount { getUnreadMessageCount }');
      expect((unread['getUnreadMessageCount'] as num) >= 1, isTrue);
      await reader.api.run(
        r'mutation MarkMessagesAsRead($conversationId: ID!) { markMessagesAsRead(conversationId: $conversationId) }',
        variables: {'conversationId': conversationId},
      );
      final messages = await reader.api.run(
        'query GetMessages(\$conversationId: ID!, \$limit: Int, \$offset: Int) { getMessages(conversationId: \$conversationId, limit: \$limit, offset: \$offset) { $messageFields } }',
        variables: {'conversationId': conversationId, 'limit': 20, 'offset': 0},
      );
      expect(jsonList(messages['getMessages']).first['content'], text, reason: 'server order is newest first');

      await subscription.cancel();
      socket.dispose();
      await author.api.run(
        r'mutation DeleteMessage($messageId: ID!) { deleteMessage(messageId: $messageId) }',
        variables: {'messageId': (sent['sendMessage'] as Map)['id']},
      );
    }, timeout: const Timeout(Duration(seconds: 30)));

    test('funding: payment mode, overview shape, money in minor units', () async {
      final feed = await reader.api.run(bookFeedQuery, variables: {'limit': 24, 'sort': 'NEWEST'});
      final bookId = jsonList((feed['getBookFeed'] as Map)['books']).first['id'];
      final data = await reader.api.run(printOverviewQuery, variables: {'bookId': bookId});
      expect(data['printPaymentMode'], anyOf('SANDBOX', 'IYZICO_SANDBOX', 'DISABLED'));
      final overview = data['printOverview'] as Map;
      expect(overview['interestCount'], isA<int>());
      final campaign = overview['campaign'];
      if (campaign is Map) {
        expect(campaign['targetMinor'], isA<int>());
        expect(formatMoney(campaign['targetMinor']), startsWith('₺'));
      }
      final history = await reader.api.run(
        'query MyFundingHistory(\$page: Int) { printPaymentMode myFundingPayments(page: \$page) { $paymentFields } }',
        variables: {'page': 1},
      );
      expect(history['myFundingPayments'], isA<List<dynamic>>());
    });

    test('roles: admin and publisher operations are refused for a member and work for the role', () async {
      const overview =
          'query GetAdminOverview { getAdminOverview { pendingBooks pendingPrintApplications pendingClaims pendingSessionAccess counts { resource label total active } } }';
      await expectLater(reader.api.run(overview), throwsA(isA<ApiException>().having((e) => e.kind, 'kind', ApiErrorKind.forbidden)));
      final data = await admin.api.run(overview);
      expect(jsonList((data['getAdminOverview'] as Map)['counts']), isNotEmpty);

      final records = await admin.api.run(
        r'query GetAdminRecords($resource: String!, $page: Int, $limit: Int, $search: String, $state: String) { getAdminRecords(resource: $resource, page: $page, limit: $limit, search: $search, state: $state) { total page totalPages items { id title revision values } } }',
        variables: {'resource': 'User', 'page': 1, 'limit': 25, 'search': 'dev_', 'state': 'ALL'},
      );
      expect(((records['getAdminRecords'] as Map)['total'] as num) >= 4, isTrue);

      const catalog =
          r'query PublisherCatalog($page: Int!, $limit: Int!, $search: String!, $funding: PublisherFundingFilter!) { publisherCatalog(page: $page, limit: $limit, search: $search, funding: $funding) { total page totalPages refreshedAt items { id title authorName writingStatus } } }';
      const variables = {'page': 1, 'limit': 20, 'search': '', 'funding': 'ALL'};
      await expectLater(reader.api.run(catalog, variables: variables), throwsA(isA<ApiException>()));
      expect((await publisher.api.run(catalog, variables: variables))['publisherCatalog'], isA<Map<dynamic, dynamic>>());
    });

    test('logout revokes the token on the server (all devices)', () async {
      final second = await signIn('reader@betik-dev.invalid');
      final oldToken = second.auth.token!;
      await second.auth.logout();
      expect(second.auth.isSignedIn, isFalse);
      final stale = GraphQLClient(endpoint: endpoint!, readToken: () => oldToken);
      await expectLater(
        stale.run('query Me { me { id } }'),
        throwsA(isA<ApiException>().having((e) => e.isUnauthenticated, 'unauthenticated', isTrue)),
      );
      // `logout` bumps authVersion: the session opened in setUpAll is gone
      // too. Sign in again so later tests are independent of the order.
      reader = await signIn('reader@betik-dev.invalid');
    });
  });
}
