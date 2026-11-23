// Disposable content for the verification suites, created through the API
// as the seeded author (the same operations the website uses).
import 'package:betik/core/network/graphql_client.dart';

import 'harness.dart';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/// Website-shaped (Quill 1.3.7) chapter: paragraph indexes 0..4 are the five
/// top-level <p> elements; headings, quote, lists do not count.
const richChapterHtml =
    '<h1>Büyük Başlık</h1>'
    '<p>Paragraf sıfır: İstanbul sabahı sisli ve sessizdi, martılar bile uyuyordu.</p>'
    '<h2>Alt Başlık</h2>'
    '<p>Paragraf bir: <strong>kalın</strong>, <em>italik</em>, <u>altı çizili</u>, <s>üstü çizili</s> ve <a href="https://example.invalid/" rel="noopener noreferrer" target="_blank">bağlantı</a> içerir.</p>'
    '<blockquote>Alıntı bloğu: bir kitap donmuş denizi kıran baltadır.</blockquote>'
    '<ol><li>Birinci madde</li><li>İkinci madde</li></ol>'
    '<ul><li>Madde işareti</li></ul>'
    '<p><img src="$tinyPng"></p>'
    '<p><br></p>'
    '<p>Paragraf dört: son paragraf, çğıöşü ÇĞİÖŞÜ harfleriyle biter.</p>';

String longChapterHtml() => [
  for (var i = 0; i < 60; i++)
    '<p>Uzun bölüm paragrafı $i: Bu metin kaydırma, ilerleme çubuğu ve performans doğrulaması için tekrarlanır. '
        'Okur sayfayı aşağı doğru kaydırdıkça ilerleme artmalıdır.</p>',
].join();

class TestBook {
  TestBook(this.id, this.title, this.chapterIds);
  final String id;
  final String title;
  final List<String> chapterIds;
}

Future<String> createBookRaw(GraphQLClient api, String title, {String description = 'Mobil doğrulama için geçici kitap.'}) async {
  final options = await api.run('query { getClassificationOptions { formats { id } genres { id } } }');
  final classification = options['getClassificationOptions'] as Map;
  final created = await api.run(
    r'mutation CreateBook($title: String!, $classification: ClassificationInput!, $description: String!, $imageUrl: String!) { createBook(title: $title, classification: $classification, description: $description, imageUrl: $imageUrl) { id } }',
    variables: {
      'title': title,
      'classification': {
        'formatId': ((classification['formats'] as List).first as Map)['id'],
        'genreIds': [((classification['genres'] as List).first as Map)['id']],
        'tags': <String>[],
        'narrativeFeatureIds': <String>[],
        'targetAudienceId': null,
        'contentWarningIds': <String>[],
      },
      'description': description,
      'imageUrl': 'https://res.cloudinary.com/betik-sandbox-mock/image/upload/v1/verify.jpg',
    },
  );
  return (created['createBook'] as Map)['id'] as String;
}

Future<String> createChapterRaw(GraphQLClient api, String bookId, String title, String html, {bool hidden = false}) async {
  final chapter = await api.run(
    r'mutation CreateChapter($bookId: ID!, $title: String!, $content: String!, $pageCount: Int, $isHidden: Boolean) { createChapter(bookId: $bookId, title: $title, content: $content, pageCount: $pageCount, isHidden: $isHidden) { id } }',
    variables: {'bookId': bookId, 'title': title, 'content': html, 'pageCount': 1, 'isHidden': hidden},
  );
  return (chapter['createChapter'] as Map)['id'] as String;
}

Future<void> setBookStatus(GraphQLClient api, String bookId, String status) => api.run(
  r'mutation UpdateBookStatus($bookId: ID!, $status: String!) { updateBookStatus(bookId: $bookId, status: $status) { id status } }',
  variables: {'bookId': bookId, 'status': status},
);

/// A published three-chapter book owned by the seeded author.
Future<TestBook> createPublishedBook(Harness h, String title) async {
  final api = await h.apiAs(authorEmail);
  final id = await createBookRaw(api, title);
  final chapters = [
    await createChapterRaw(api, id, 'Biçimli Bölüm', richChapterHtml),
    await createChapterRaw(api, id, 'Uzun Bölüm', longChapterHtml()),
    await createChapterRaw(api, id, 'Son Bölüm', '<p>Son bölümün tek paragrafı burada yer alıyor.</p>'),
  ];
  await setBookStatus(api, id, 'WRITING');
  api.close();
  return TestBook(id, title, chapters);
}

class TestUser {
  TestUser(this.email, this.username, this.password, this.id);
  String email;
  final String username;
  String password;
  final String id;
}

/// Registers a disposable member through the real two-step registration
/// (code read from the sandbox mail sink).
Future<TestUser> registerUser(Harness h, String prefix) async {
  final stamp = DateTime.now().microsecondsSinceEpoch.toString().substring(7);
  final username = '${prefix}_$stamp';
  final email = '$username@betik-dev.invalid';
  const password = 'Gecici!Sifre9';
  final api = h.apiWithToken(null);
  await api.run(
    r'mutation($email: String!, $username: String!) { sendRegistrationCode(email: $email, username: $username) { code message } }',
    variables: {'email': email, 'username': username},
  );
  final mail = await h.waitUntil(() => h.latestMail(to: email), what: 'registration mail');
  final code = RegExp(r'\b(\d{6})\b').firstMatch('${mail['text']}')!.group(1)!;
  final data = await api.run(
    r'mutation($username: String!, $fullName: String!, $email: String!, $password: String!, $code: String!) { registerAndLogin(username: $username, fullName: $fullName, email: $email, password: $password, code: $code) { code message user { id } } }',
    variables: {'username': username, 'fullName': 'Doğrulama ${prefix.toUpperCase()}', 'email': email, 'password': password, 'code': code},
  );
  final user = ((data['registerAndLogin'] as Map)['user'] as Map)['id'] as String;
  return TestUser(email, username, password, user);
}

Future<String> createQuoteRaw(GraphQLClient api, String bookId, String chapterId, String text, {String note = ''}) async {
  final data = await api.run(
    r'mutation CreateQuote($text: String!, $note: String, $bookId: ID!, $chapterId: ID, $chapterTitle: String, $chapterIndex: Int, $location: QuoteLocationInput, $isSpoiler: Boolean, $visibility: QuoteVisibility) { createQuote(text: $text, note: $note, bookId: $bookId, chapterId: $chapterId, chapterTitle: $chapterTitle, chapterIndex: $chapterIndex, location: $location, isSpoiler: $isSpoiler, visibility: $visibility) { id } }',
    variables: {
      'text': text,
      'note': note,
      'bookId': bookId,
      'chapterId': chapterId,
      'chapterTitle': 'Biçimli Bölüm',
      'chapterIndex': 0,
      'location': {'startOffset': 0, 'endOffset': text.length},
      'isSpoiler': false,
      'visibility': 'PUBLIC',
    },
  );
  return (data['createQuote'] as Map)['id'] as String;
}
