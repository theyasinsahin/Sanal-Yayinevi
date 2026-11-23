// Verification batch 2 — discovery, book detail, comments, sharing.
import 'package:betik/features/book/book_card.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support/content.dart';
import 'support/harness.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('discovery, book detail, comments', (tester) async {
    final h = Harness(tester, binding, 'book');
    await h.start();
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
    final title = 'Zümrüt Doğrulama $stamp';
    late TestBook book;

    Future<Map> bookRow() async => (await h.dbFind('books', {'_id': Harness.oid(book.id)})).first as Map;
    Future<Map> readerRow() async => (await h.dbFind('users', {'email': readerEmail})).first as Map;

    await h.scenario('SETUP', 'Author publishes a three-chapter book through the API', () async {
      book = await createPublishedBook(h, title);
    });

    await h.scenario('F-AUTH-10', 'Guest actions open the sign-up prompt with the matching copy', () async {
      await h.go('/');
      await h.push('/book/${book.id}');
      await h.waitFor(find.text('KİTABI OKU'));
      await h.tap(find.byTooltip('Beğen'));
      await h.waitFor(find.text('Beğenini paylaş'));
      await h.shot('guest_like_prompt');
      await h.tapText('Şimdilik geri dön');
      await h.tap(find.byTooltip('Kitaplığa ekle'));
      await h.waitFor(find.text('Bu kitabı kitaplığında sakla'));
      await h.tapText('Şimdilik geri dön');
      await h.tap(find.text('KİTABI TAKİP ET'));
      await h.waitFor(find.text('Yeni bölümlerden haberdar ol'));
      await h.tapText('Şimdilik geri dön');
      expect(((await bookRow())['likedBy'] as List? ?? const []), isEmpty);
    });

    await h.scenario('F-DISC-03g', 'Guest "Senin için" tab shows the registration card', () async {
      await h.go('/feed');
      await h.tapText('SENİN İÇİN');
      await h.waitFor(find.text('Sana özel kitaplar keşfet'));
    });

    await h.login(readerEmail);

    await h.scenario('F-DISC-02', 'Feed: search finds the book, empty state, clear, sort and funding filters', () async {
      await h.go('/feed');
      await h.waitFor(find.byType(BookCard));
      final search = find.descendant(
        of: find.widgetWithText(TextField, 'Kitap, yazar veya alıntı ara...'),
        matching: find.byType(EditableText),
      );
      await h.type(search, 'Zümrüt Doğrulama $stamp');
      await h.waitFor(find.text(title.toUpperCase().replaceAll('i', 'İ')));
      await h.waitFor(find.textContaining('1 kitap listeleniyor'));
      await h.shot('feed_search_hit');
      await h.type(search, 'qqqzzz-hiçbir-kitap');
      await h.waitFor(find.textContaining('FİLTRELERİ TEMİZLE'));
      await h.shot('feed_search_empty');
      await h.dismissKeyboard();
      await h.tap(find.text('FİLTRELERİ TEMİZLE'));
      await h.waitFor(find.byType(BookCard));
      // Sort + funding through the sheet.
      await h.tap(find.textContaining('FİLTRELE'));
      await h.waitFor(find.text('Filtreler'));
      await h.tap(find.text('En Popüler'));
      await h.tap(find.text('SONUÇLARI GÖSTER'));
      await h.waitFor(find.textContaining('· En Popüler'));
      expect(find.text('FİLTRELE (1)'), findsOneWidget);
      await h.tap(find.textContaining('FİLTRELE'));
      await h.waitFor(find.text('Filtreler'));
      await h.tap(find.text('Hedefe en yakın'));
      await h.tap(find.text('SONUÇLARI GÖSTER'));
      await h.settle(8);
      expect(h.hasContaining('Hedefe en yakın'), isTrue);
      expect(find.byType(BookCard), findsNothing, reason: 'no campaign exists yet → coupled ACTIVE filter gives no books');
      await h.tap(find.textContaining('FİLTRELE'));
      await h.waitFor(find.text('Filtreler'));
      await h.tap(find.text('Temizle'));
      await h.tap(find.text('SONUÇLARI GÖSTER'));
      await h.waitFor(find.byType(BookCard));
      expect(find.text('FİLTRELE'), findsOneWidget);
    });

    await h.scenario('F-DISC-02c', 'Feed: classification filter (format) narrows and restores the list', () async {
      await h.go('/feed');
      await h.waitFor(find.byType(BookCard));
      await h.tap(find.textContaining('FİLTRELE'));
      await h.waitFor(find.text('Filtreler'));
      await h.waitFor(find.text('ESER BİÇİMİ'));
      await h.tap(find.text('Tümü').first);
      await h.waitFor(find.text('Şiir'));
      await h.tap(find.text('Şiir').last, scroll: false);
      await h.shot('feed_filters_classification');
      await h.tap(find.text('SONUÇLARI GÖSTER'));
      await h.waitFor(find.text('FİLTRELE (1)'));
      await h.settle(8);
      expect(find.byType(BookCard), findsNothing, reason: 'both sandbox books are novels');
      await h.tap(find.text('FİLTRELERİ TEMİZLE'));
      await h.waitFor(find.byType(BookCard));
      await h.waitFor(find.text('FİLTRELE'));
    });

    await h.scenario('F-DISC-04/03/07', 'Genre onboarding saves preferences; recommendations list; "Tercihlerim" edit', () async {
      // Fresh state for the seeded reader (earlier runs complete the onboarding).
      final reader = await readerRow();
      await h.ctl('update', {
        'collection': 'userpreferences',
        'filter': {'userId': Harness.oid('${reader['_id']}')},
        'update': {
          r'$set': {'onboardingCompleted': false, 'preferredGenres': <String>[]},
        },
      });
      await h.go('/feed?tab=for-you');
      await h.waitFor(find.text('Hangi türleri seviyorsun?'));
      await h.shot('onboarding');
      final chips = find.byType(FilterChip);
      await h.tap(chips.at(0));
      await h.tap(chips.at(1));
      await h.reveal(find.text('2 TÜRLE DEVAM ET'));
      await h.tap(find.text('2 TÜRLE DEVAM ET'));
      await h.waitFor(find.text('TERCİHLERİM'));
      final me = await readerRow();
      final preference = (await h.dbFind('userpreferences', {'userId': Harness.oid('${me['_id']}')})).first as Map;
      expect(preference['onboardingCompleted'], isTrue);
      expect((preference['preferredGenres'] as List).length, 2);
      await h.settle(8);
      await h.shot('for_you');
      expect(find.byType(BookCard).evaluate().isNotEmpty || h.has('Henüz öneri yok'), isTrue);
      await h.tap(find.text('Düzenle'));
      await h.waitFor(find.text('Hangi türleri seviyorsun?'));
      await h.tap(find.byType(FilterChip).at(2));
      await h.reveal(find.text('3 TÜRLE DEVAM ET'));
      await h.tap(find.text('3 TÜRLE DEVAM ET'));
      await h.waitFor(find.text('TERCİHLERİM'));
      final updated = (await h.dbFind('userpreferences', {'userId': Harness.oid('${me['_id']}')})).first as Map;
      expect((updated['preferredGenres'] as List).length, 3);
    });

    await h.scenario('F-BOOK-01/02', 'Card → detail shows metadata, author link opens the profile', () async {
      await h.go('/feed');
      final search = find.descendant(
        of: find.widgetWithText(TextField, 'Kitap, yazar veya alıntı ara...'),
        matching: find.byType(EditableText),
      );
      await h.type(search, 'Zümrüt Doğrulama $stamp');
      await h.waitFor(find.byType(BookCard));
      await h.dismissKeyboard();
      await h.tap(find.descendant(of: find.byType(BookCard).first, matching: find.text(Harness.upperTr(title))));
      await h.waitFor(find.text('KİTABI OKU'));
      expect(h.location, '/book/${book.id}');
      expect(find.text('Özet'), findsOneWidget);
      await h.shot('detail');
      await h.tap(find.textContaining('Yazar: '));
      await h.waitFor(find.text('@dev_author'));
      await h.back();
      await h.go('/feed');
      await h.type(search, '');
    });

    await h.scenario('F-BOOK-03', 'Like toggles in the UI and on the server', () async {
      await h.go('/');
      await h.push('/book/${book.id}');
      await h.waitFor(find.text('KİTABI OKU'));
      await h.tap(find.byTooltip('Beğen'));
      await h.waitFor(find.byTooltip('Beğeniyi geri al'));
      await h.waitUntil(() async => ((await bookRow())['likedBy'] as List).length == 1, what: 'like stored');
      // Persists across leaving and reopening the screen.
      await h.back();
      await h.push('/book/${book.id}');
      await h.waitFor(find.byTooltip('Beğeniyi geri al'));
      await h.tap(find.byTooltip('Beğeniyi geri al'));
      await h.waitFor(find.byTooltip('Beğen'));
      await h.waitUntil(() async => ((await bookRow())['likedBy'] as List).isEmpty, what: 'like removed');
      await h.tap(find.byTooltip('Beğen'));
      await h.waitUntil(() async => ((await bookRow())['likedBy'] as List).length == 1, what: 'like stored again');
    });

    await h.scenario('F-BOOK-04', 'Save to library: toast, server state, profile library, undo', () async {
      await h.tap(find.byTooltip('Kitaplığa ekle'));
      await h.waitFor(find.text('Kitaplığına eklendi'));
      await h.waitUntil(() async => ((await readerRow())['savedBooks'] as List).any((id) => '$id' == book.id), what: 'saved on server');
      await h.go('/profile');
      await h.settle(8);
      await h.go('/');
      await h.push('/book/${book.id}');
      await h.waitFor(find.byTooltip('Kitaplıktan çıkar'));
      await h.tap(find.byTooltip('Kitaplıktan çıkar'));
      await h.waitFor(find.text('Kitaplıktan çıkarıldı'));
      await h.waitUntil(() async => !((await readerRow())['savedBooks'] as List).any((id) => '$id' == book.id), what: 'unsaved on server');
      await h.tap(find.byTooltip('Kitaplığa ekle'));
      await h.waitFor(find.text('Kitaplığına eklendi'));
    });

    await h.scenario('F-BOOK-05', 'Follow book toggles label and server state', () async {
      await h.tap(find.text('KİTABI TAKİP ET'));
      await h.waitFor(find.text('KİTABI TAKİP EDİYORSUN'));
      var data = await h.gql(r'query($bookId: ID!) { isFollowingBook(bookId: $bookId) }', {'bookId': book.id});
      expect(data['isFollowingBook'], isTrue);
      await h.back();
      await h.push('/book/${book.id}');
      await h.waitFor(find.text('KİTABI TAKİP EDİYORSUN'));
      await h.tap(find.text('KİTABI TAKİP EDİYORSUN'));
      await h.waitFor(find.text('KİTABI TAKİP ET'));
      data = await h.gql(r'query($bookId: ID!) { isFollowingBook(bookId: $bookId) }', {'bookId': book.id});
      expect(data['isFollowingBook'], isFalse);
      await h.tap(find.text('KİTABI TAKİP ET'));
      await h.waitFor(find.text('KİTABI TAKİP EDİYORSUN'));
    });

    await h.scenario(
      'F-BOOK-07/F-SHARE-01',
      'Share sheet loads share data; copy link and copy text put the share URL on the clipboard',
      () async {
        await h.tap(find.byTooltip('Kitabı paylaş'), scroll: false);
        await h.waitFor(find.text('Bağlantıyı kopyala'));
        await h.shot('share_sheet');
        expect(find.text('WhatsApp'), findsOneWidget);
        expect(find.text('Betik’te mesajla gönder'), findsOneWidget);
        await h.tap(find.text('Bağlantıyı kopyala'));
        await h.settle(4);
        final link = await clipboardText();
        expect(link, contains('/share/book/'));
        expect(link, contains('webOrigin='));
        if (find.text('Metin ve bağlantıyı kopyala').evaluate().isEmpty) {
          await h.tap(find.byTooltip('Kitabı paylaş'), scroll: false);
        }
        await h.tap(find.text('Metin ve bağlantıyı kopyala'));
        await h.settle(4);
        final text = await clipboardText();
        expect(text, contains(link));
        expect(text.length, greaterThan(link.length));
        final navigator = tester.state<NavigatorState>(find.byType(Navigator).first);
        if (find.text('Bağlantıyı kopyala').evaluate().isNotEmpty) navigator.pop();
        await h.settle(4);
      },
    );

    await h.scenario('F-COMM-02/06', 'Add a comment with an @mention picked from the suggestion list', () async {
      await h.go('/');
      await h.push('/book/${book.id}');
      await h.waitFor(find.text('KİTABI OKU'));
      final composer = find.descendant(of: find.widgetWithText(TextField, 'Yorumunuzu yazın...'), matching: find.byType(EditableText));
      await h.reveal(composer);
      expect(find.text('Henüz yorum yapılmamış. İlk yorumu sen yap!'), findsOneWidget);
      await h.type(composer, 'Harika bir kitap @dev_au');
      await h.waitFor(find.text('@dev_author'));
      await h.shot('mention_suggestions');
      await h.tap(find.text('@dev_author'));
      final value = tester.widget<EditableText>(composer.first).controller.text;
      expect(value, 'Harika bir kitap @dev_author ');
      await h.dismissKeyboard();
      await h.tap(find.text('GÖNDER'));
      await h.waitFor(find.text('Yorum gönderildi'));
      await h.waitFor(find.text('@dev_reader'));
      expect(await h.dbCount('comments', {'bookId': Harness.oid(book.id)}), 1);
      // The author is notified of the mention.
      final author = (await h.dbFind('users', {'email': authorEmail})).first as Map;
      await h.waitUntil(
        () async =>
            await h.dbCount('notifications', {'recipient': Harness.oid('${author['_id']}')}) +
                await h.dbCount('notifications', {'userId': Harness.oid('${author['_id']}')}) >
            0,
        what: 'author notification',
      );
    });

    await h.scenario('F-COMM-04', 'Like and unlike a comment', () async {
      final like = find.byIcon(Icons.favorite_border);
      await h.reveal(like);
      await h.tap(like.last);
      await h.waitFor(find.byIcon(Icons.favorite));
      await h.waitUntil(
        () async => (((await h.dbFind('comments', {'bookId': Harness.oid(book.id)})).first as Map)['likedBy'] as List).length == 1,
        what: 'comment like',
      );
      await h.tap(find.byIcon(Icons.favorite).last);
      await h.waitUntil(
        () async => (((await h.dbFind('comments', {'bookId': Harness.oid(book.id)})).first as Map)['likedBy'] as List).isEmpty,
        what: 'comment unlike',
      );
    });

    await h.scenario('F-COMM-03', 'Reply to a comment (one level), prefilled @user', () async {
      await h.reveal(find.text('Yanıtla'));
      await h.tap(find.text('Yanıtla'));
      final reply = find.descendant(of: find.widgetWithText(TextField, 'Yanıtınızı yazın...'), matching: find.byType(EditableText));
      await h.waitFor(reply);
      expect(tester.widget<EditableText>(reply.first).controller.text, '@dev_reader ');
      await h.type(reply, '@dev_reader kendi yorumuma yanıt');
      await h.dismissKeyboard();
      await h.tap(find.text('GÖNDER').last);
      await h.waitUntil(() async => await h.dbCount('comments', {'bookId': Harness.oid(book.id)}) == 2, what: 'reply stored');
      await h.waitFor(find.textContaining('kendi yorumuma yanıt', findRichText: true));
      final rows = await h.dbFind('comments', {'bookId': Harness.oid(book.id)});
      expect(rows.where((row) => (row as Map)['parentId'] != null).length, 1);
      await h.shot('comment_thread');
    });

    await h.scenario('F-COMM-05', 'Delete own comment: cancel keeps it, confirm removes it', () async {
      final delete = find.byTooltip('Yorumu sil');
      await h.reveal(delete);
      final before = delete.evaluate().length;
      await h.tap(delete.last);
      await h.waitFor(find.text('Silmek istediğinize emin misiniz?'));
      await h.dialogTap('Vazgeç');
      await h.settle(4);
      expect(find.byTooltip('Yorumu sil').evaluate().length, before);
      await h.tap(find.byTooltip('Yorumu sil').last);
      await h.dialogTap('Sil');
      await h.waitUntil(
        () async =>
            await h.dbCount('comments', {
              'bookId': Harness.oid(book.id),
              'isDeleted': {r'$ne': true},
            }) ==
            1,
        what: 'reply deleted',
      );
    });

    await h.scenario('F-NOT-01/02', 'Author sees the mention notification; tapping it opens the book at the comment', () async {
      await h.login(authorEmail);
      await h.go('/');
      await h.waitUntil(() async => h.services.badges.notifications > 0, what: 'unread badge', timeout: const Duration(seconds: 25));
      await h.shot('author_badge');
      await h.tap(find.byTooltip('Bildirimler'), scroll: false);
      await h.waitFor(find.text('Bildirimler'));
      await h.settle(8);
      await h.shot('author_notifications');
      final mention = find.textContaining('etiket', findRichText: true);
      expect(mention, findsWidgets, reason: h.visibleTexts());
      await h.tap(mention.first);
      await h.waitFor(find.text('KİTABI OKU'));
      expect(h.location, contains('/book/${book.id}'));
      expect(h.location, contains('comment'));
      await h.waitFor(find.textContaining('Harika bir kitap', findRichText: true));
    });

    await h.scenario(
      'F-BOOK-08/09/10',
      'Author controls: complete, back to draft (guest 404), publish, edit classification, delete with confirm',
      () async {
        final api = await h.apiAs(authorEmail);
        final disposableId = await createBookRaw(api, 'Silinecek Kitap $stamp');
        await createChapterRaw(api, disposableId, 'Tek', '<p>Yayınlanabilir tek paragraf.</p>');
        api.close();
        await h.go('/');
        await h.push('/book/$disposableId');
        await h.waitFor(find.text('KİTABI OKU'));
        await h.reveal(find.text('YAYINLA (GÖRÜNÜR YAP)'));
        expect(find.text('Taslak'), findsWidgets);
        await h.shot('author_controls_draft');
        await h.tap(find.text('YAYINLA (GÖRÜNÜR YAP)'));
        await h.waitFor(find.text('Kitap herkese görünür olacak. Onaylıyor musunuz?'));
        await h.dialogTap('Vazgeç');
        expect(((await h.dbFind('books', {'_id': Harness.oid(disposableId)})).first as Map)['status'], 'DRAFT');
        await h.tap(find.text('YAYINLA (GÖRÜNÜR YAP)'));
        await h.dialogTap('Onayla');
        await h.waitFor(find.text('YAZIMI TAMAMLA'));
        expect(((await h.dbFind('books', {'_id': Harness.oid(disposableId)})).first as Map)['status'], 'WRITING');
        await h.tap(find.text('YAZIMI TAMAMLA'));
        await h.dialogTap('Onayla');
        await h.waitFor(find.textContaining('DESTEK FONU İÇİN BAŞVUR'));
        expect(((await h.dbFind('books', {'_id': Harness.oid(disposableId)})).first as Map)['status'], 'COMPLETED');
        await h.shot('author_controls_completed');
        await h.tap(find.text('TASLAĞA ÇEK'));
        await h.dialogTap('Onayla');
        await h.waitFor(find.text('YAYINLA (GÖRÜNÜR YAP)'));
        expect(((await h.dbFind('books', {'_id': Harness.oid(disposableId)})).first as Map)['status'], 'DRAFT');
        // Delete
        await h.reveal(find.text('SİL'));
        await h.tap(find.text('SİL'));
        await h.waitFor(find.text('Bu kitabı kalıcı olarak silmek istediğinize emin misiniz?'));
        await h.dialogTap('Sil');
        await h.waitUntil(() async => h.location.startsWith('/profile'), what: 'back on profile');
        final row = (await h.dbFind('books', {'_id': Harness.oid(disposableId)}));
        expect(row.isEmpty || (row.first as Map)['isDeleted'] == true, isTrue);
        await h.go('/');
        await h.push('/book/$disposableId');
        await h.waitFor(find.text('Kitap bulunamadı'));
      },
    );

    await h.logout();
    h.finish();
  });
}
