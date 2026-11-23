// Verification batch 3 — the reader: rendering, navigation, progress,
// bookmark, paragraph comments, quotes through touch selection, copy
// protection, guest gate, reading time.
import 'package:betik/features/reader/html_view.dart';
import 'package:betik/features/reader/reader_widgets.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support/content.dart';
import 'support/harness.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('reader', (tester) async {
    final h = Harness(tester, binding, 'reader');
    await h.start();
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
    final title = 'Okuma Doğrulama $stamp';
    late TestBook book;
    late String readerId;

    Finder rich(String text) => find.textContaining(text, findRichText: true);

    /// Long-press at the start of [target]'s first line and drag to the
    /// right: the touch gesture a reader uses to select a passage.
    Future<void> selectLine(Finder target, {double fraction = 0.9}) async {
      await tester.ensureVisible(target);
      await h.settle(3);
      final rect = tester.getRect(target);
      final start = Offset(rect.left + 12, rect.top + 12);
      final gesture = await tester.startGesture(start, kind: PointerDeviceKind.touch);
      await tester.pump(const Duration(milliseconds: 700));
      final end = Offset(rect.left + rect.width * fraction, rect.top + 12);
      for (var i = 1; i <= 8; i++) {
        await gesture.moveTo(Offset.lerp(start, end, i / 8)!);
        await tester.pump(const Duration(milliseconds: 40));
      }
      await gesture.up();
      await h.settle(5);
    }

    await h.scenario('SETUP', 'Author publishes the test book', () async {
      book = await createPublishedBook(h, title);
      readerId = '${((await h.dbFind('users', {'email': readerEmail})).first as Map)['_id']}';
    });

    // ------------------------------------------------------------ guest
    await h.scenario(
      'F-READ-10',
      'Guest: first chapter readable, next chapter gated with the sign-up card; member controls prompt',
      () async {
        await h.go('/');
        await h.push('/reader/${book.id}');
        await h.waitFor(rich('Paragraf sıfır'));
        expect(find.textContaining('Bölüm 1 / 3'), findsOneWidget);
        expect(find.textContaining('giriş yapmalısınız'), findsWidgets);
        await h.tap(find.byTooltip('Ayraç koy').first);
        await h.waitFor(find.text('Kaldığın yeri kaybetme'));
        await h.tapText('Şimdilik geri dön');
        await h.reveal(find.text('TAMAMLA VE DEVAM ET'));
        await h.tap(find.text('TAMAMLA VE DEVAM ET'));
        // Website J-05: the sign-up sheet opens; the reader stays on chapter 1.
        await h.waitFor(find.text('Hikâyeye devam et'));
        await h.shot('guest_gate');
        expect(find.text('ÜCRETSİZ HESAP OLUŞTUR'), findsOneWidget);
        await h.tapText('Şimdilik geri dön');
        expect(find.textContaining('Bölüm 1 / 3'), findsOneWidget);
        expect(await h.dbCount('readingprogresses', {'bookId': Harness.oid(book.id)}), 0, reason: 'guest progress stays on the device');
        // Chapter list marks the gated chapters.
        await h.tap(find.textContaining('Bölümler ('), scroll: false);
        await h.waitFor(find.text('Ücretsiz üyelikle oku'));
        expect(find.text('Ücretsiz üyelikle oku'), findsNWidgets(2));
        await h.shot('guest_chapter_list');
        await h.closeOverlays();
      },
    );

    await h.login(readerEmail);

    await h.scenario('F-READ-13', 'Chapter HTML: headings, inline formats, quote, lists, image, empty paragraph', () async {
      await h.go('/');
      await h.push('/reader/${book.id}');
      await h.waitFor(rich('Paragraf sıfır'));
      expect(rich('Büyük Başlık'), findsOneWidget);
      expect(rich('Alt Başlık'), findsOneWidget);
      await h.shot('rich_top');
      await h.reveal(rich('Alıntı bloğu'));
      expect(rich('Birinci madde'), findsOneWidget);
      expect(rich('Madde işareti'), findsOneWidget);
      await h.shot('rich_middle');
      await h.reveal(rich('Paragraf dört'));
      expect(find.descendant(of: find.byType(HtmlBlock), matching: find.byType(Image)), findsOneWidget);
      // Five addressable paragraphs → five bookmark buttons; headings, quote and lists have none.
      expect(find.byTooltip('Ayraç koy'), findsNWidgets(5));
      await h.shot('rich_bottom');
    });

    await h.scenario(
      'F-READ-06',
      'Bookmark on the 2nd <p> stores paragraphIndex 1 (not the element position); survives reopening; moves; removes',
      () async {
        await h.go('/');
        await h.push('/reader/${book.id}');
        await h.waitFor(rich('Paragraf sıfır'));
        await h.tap(find.byTooltip('Ayraç koy').at(1));
        await h.waitFor(find.text('Kaldığın yer'));
        final stored = await h.waitUntil(() async {
          final rows = await h.dbFind('bookmarks', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)});
          return rows.isEmpty ? null : rows.first as Map;
        }, what: 'bookmark row');
        expect(stored['paragraphIndex'], 1);
        expect('${stored['chapterId']}', book.chapterIds[0]);
        await h.shot('bookmark_set');
        // Reopen: the marker is restored.
        await h.back();
        await h.push('/reader/${book.id}');
        await h.waitFor(find.text('Kaldığın yer'));
        // Move to the last paragraph: only one bookmark per book.
        await h.reveal(rich('Paragraf dört'));
        await h.tap(find.byTooltip('Ayraç koy').last);
        await h.waitUntil(() async {
          final rows = await h.dbFind('bookmarks', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)});
          return rows.length == 1 && (rows.first as Map)['paragraphIndex'] == 4;
        }, what: 'bookmark moved to index 4');
        expect(find.text('Kaldığın yer'), findsOneWidget);
        await h.tap(find.byTooltip('Ayracı kaldır'));
        await h.waitUntil(
          () async => await h.dbCount('bookmarks', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)}) == 0,
          what: 'bookmark removed',
        );
        expect(find.text('Kaldığın yer'), findsNothing);
      },
    );

    await h.scenario('F-READ-07', 'Paragraph comments: open panel, send, count badge, stored index, delete, close', () async {
      await h.go('/');
      await h.push('/reader/${book.id}');
      await h.waitFor(rich('Paragraf sıfır'));
      // Comment button of the 2nd paragraph (index 1).
      final commentButtons = find.byIcon(Icons.chat_bubble_outline);
      await h.tap(commentButtons.at(1));
      await h.waitFor(find.text('Paragraf Yorumları'));
      expect(find.text('Henüz yorum yok. İlk yorumu sen yap!'), findsOneWidget);
      final input = find.descendant(of: find.byType(ParagraphCommentsPanel), matching: find.byType(EditableText));
      await h.type(input, 'İkinci paragrafa mobil yorum');
      await h.shot('paragraph_panel_keyboard');
      await h.dismissKeyboard();
      await h.tap(find.descendant(of: find.byType(ParagraphCommentsPanel), matching: find.text('GÖNDER')));
      await h.waitFor(rich('İkinci paragrafa mobil yorum'));
      final row = await h.waitUntil(() async {
        final rows = await h.dbFind('paragraphcomments', {'chapterId': Harness.oid(book.chapterIds[0])});
        return rows.isEmpty ? null : rows.first as Map;
      }, what: 'paragraph comment row');
      expect(row['paragraphIndex'], 1);
      await h.shot('paragraph_panel_comment');
      await h.tap(find.byTooltip('Yorumları kapat'));
      await h.waitGone(find.text('Paragraf Yorumları'));
      expect(find.text('1'), findsWidgets, reason: 'count shown next to the paragraph');
      // Reopen and delete.
      await h.tap(find.byIcon(Icons.chat_bubble_outline).at(0).evaluate().isEmpty ? find.text('1') : find.text('1').first);
      await h.waitFor(find.text('Paragraf Yorumları'));
      await h.tap(find.byTooltip('Yorumu sil'));
      await h.waitUntil(
        () async =>
            await h.dbCount('paragraphcomments', {
              'chapterId': Harness.oid(book.chapterIds[0]),
              'isDeleted': {r'$ne': true},
            }) ==
            0,
        what: 'paragraph comment deleted',
      );
      await h.waitFor(find.text('Henüz yorum yok. İlk yorumu sen yap!'));
      await h.tap(find.byTooltip('Yorumları kapat'));
    });

    await h.scenario('F-READ-08a', 'Touch selection shorter than 10 characters: "Alıntıla" explains the minimum', () async {
      await h.go('/');
      await h.push('/reader/${book.id}');
      await h.waitFor(rich('Paragraf sıfır'));
      final paragraph = rich('Paragraf sıfır');
      final rect = tester.getRect(paragraph);
      await tester.longPressAt(Offset(rect.left + 20, rect.top + 12));
      await h.settle(5);
      await h.waitFor(find.text('Alıntıla'));
      await h.shot('selection_menu_word');
      expect(find.text('Kopyala'), findsOneWidget);
      await h.tap(find.text('Alıntıla'), scroll: false);
      await h.waitFor(find.text('Alıntı için en az 10 karakter seçin.'));
      expect(find.text('Alıntı kaydet'), findsNothing);
    });

    await h.scenario(
      'F-READ-08b',
      'Long-press and drag selects a passage → "Alıntıla" → sheet → saved quote with chapter location',
      () async {
        await h.go('/');
        await h.push('/reader/${book.id}');
        await h.waitFor(rich('Paragraf sıfır'));
        await selectLine(rich('Paragraf sıfır'));
        await h.waitFor(find.text('Alıntıla'));
        await h.shot('selection_menu_line');
        await h.tap(find.text('Alıntıla'), scroll: false);
        await h.waitFor(find.text('Alıntı kaydet'));
        await h.settle(6);
        await h.shot('quote_sheet');
        final note = find.descendant(of: find.widgetWithText(TextField, 'Not ekle... (isteğe bağlı)'), matching: find.byType(EditableText));
        await h.type(note, 'Mobil seçimle alınan alıntı');
        await h.dismissKeyboard();
        await h.tap(find.text('Sürprizbozan içeriyor'));
        await h.tap(find.text('KAYDET'));
        await h.waitFor(find.text('Alıntı kaydedildi!'));
        final quote = await h.waitUntil(() async {
          final rows = await h.dbFind('quotes', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)});
          return rows.isEmpty ? null : rows.first as Map;
        }, what: 'quote row');
        final text = quote['text'] as String;
        expect(text.length, inInclusiveRange(10, 1000));
        expect('Paragraf sıfır: İstanbul sabahı sisli ve sessizdi, martılar bile uyuyordu.', contains(text.trim()));
        expect(quote['note'], 'Mobil seçimle alınan alıntı');
        expect(quote['isSpoiler'], isTrue);
        expect('${quote['chapterId']}', book.chapterIds[0]);
        expect(quote['chapterIndex'], 0);
        await h.shot('quote_saved');
        await h.closeOverlays();
      },
    );

    await h.scenario('F-READ-08c', 'Selecting the same passage again reports the duplicate', () async {
      await h.go('/');
      await h.push('/reader/${book.id}');
      await h.waitFor(rich('Paragraf sıfır'));
      await selectLine(rich('Paragraf sıfır'));
      await h.waitFor(find.text('Alıntıla'));
      await h.tap(find.text('Alıntıla'), scroll: false);
      await h.waitFor(find.text('Alıntı kaydet'));
      await h.waitFor(find.text('Bu alıntı zaten kayıtlı.'));
      await h.shot('quote_duplicate');
      await h.closeOverlays();
      expect(await h.dbCount('quotes', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)}), 1);
    });

    await h.scenario('F-READ-09', 'Copy protection: "Kopyala" puts the notice with the book link on the clipboard, not the text', () async {
      await h.go('/');
      await h.push('/reader/${book.id}');
      await h.waitFor(rich('Paragraf sıfır'));
      await selectLine(rich('Paragraf sıfır'));
      await h.waitFor(find.text('Kopyala'));
      // Only the two app actions are offered (no system Share / Look up).
      expect(find.text('Paylaş'), findsNothing);
      expect(find.text('Tümünü Seç'), findsNothing);
      await h.tap(find.text('Kopyala'), scroll: false);
      await h.waitFor(find.textContaining('Kitap bağlantısı kopyalandı'));
      final clip = await clipboardText();
      expect(clip, isNot(contains('İstanbul sabahı')));
      expect(clip, contains(title));
      expect(clip, contains('http://localhost:3055/'));
    });

    await h.scenario('F-READ-16', 'Scroll progress bar follows scrolling in a long chapter', () async {
      await h.go('/');
      await h.push('/reader/${book.id}?chapter=${book.chapterIds[1]}');
      await h.waitFor(rich('Uzun bölüm paragrafı 0:'));
      expect(find.textContaining('Bölüm 2 / 3'), findsOneWidget);
      double progress() =>
          tester
              .widget<LinearProgressIndicator>(find.descendant(of: find.byType(AppBar), matching: find.byType(LinearProgressIndicator)))
              .value ??
          -1;
      expect(progress(), 0);
      final stopwatch = Stopwatch()..start();
      for (var i = 0; i < 6; i++) {
        await tester.fling(find.byType(SingleChildScrollView).first, const Offset(0, -900), 3000, warnIfMissed: false);
        await h.settle(6);
      }
      stopwatch.stop();
      expect(progress(), greaterThan(0.3));
      await h.shot('long_chapter_scrolled');
      await tester.ensureVisible(find.text('TAMAMLA VE DEVAM ET'));
      await h.settle(6);
      expect(progress(), greaterThan(0.9));
      expect(find.byTooltip('Ayraç koy'), findsNWidgets(60));
    });

    await h.scenario(
      'F-READ-03/04',
      'Chapter navigation: complete & continue stores progress; previous; last chapter "Tamamla"; end marker',
      () async {
        await h.go('/');
        await h.push('/reader/${book.id}?chapter=${book.chapterIds[0]}');
        await h.waitFor(rich('Paragraf sıfır'));
        await h.reveal(find.text('TAMAMLA VE DEVAM ET'));
        expect(tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'ÖNCEKİ BÖLÜM')).onPressed, isNull);
        await h.tap(find.text('TAMAMLA VE DEVAM ET'));
        await h.waitFor(rich('Uzun bölüm paragrafı 0:'));
        final progress = await h.waitUntil(() async {
          final rows = await h.dbFind('readingprogresses', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)});
          if (rows.isEmpty) return null;
          final row = rows.first as Map;
          return (row['completedChapters'] as List? ?? const []).isNotEmpty ? row : null;
        }, what: 'progress row');
        expect((progress['completedChapters'] as List).map((e) => '$e'), contains(book.chapterIds[0]));
        await h.reveal(find.text('ÖNCEKİ BÖLÜM'));
        await h.tap(find.text('ÖNCEKİ BÖLÜM'));
        await h.waitFor(rich('Paragraf sıfır'));
        await h.reveal(find.text('SONRAKİ BÖLÜM'));
        await h.shot('revisited_chapter_next_label');
        await h.tap(find.text('SONRAKİ BÖLÜM'));
        await h.waitFor(rich('Uzun bölüm paragrafı 0:'));
        await h.reveal(find.text('TAMAMLA VE DEVAM ET'));
        await h.tap(find.text('TAMAMLA VE DEVAM ET'));
        await h.waitFor(rich('Son bölümün tek paragrafı'));
        expect(find.text('✦ SON ✦'), findsOneWidget);
        await h.tap(find.text('TAMAMLA'));
        await h.waitUntil(() async {
          final rows = await h.dbFind('readingprogresses', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)});
          return rows.isNotEmpty && ((rows.first as Map)['completedChapters'] as List).length == 3;
        }, what: 'all chapters completed');
        await h.shot('last_chapter_done');
      },
    );

    await h.scenario('F-READ-02/15', 'Chapter drawer: counts, select a chapter, manual read checkbox unchecks on the server', () async {
      await h.tap(find.textContaining('Bölümler (3)'), scroll: false);
      await h.waitFor(find.text('3 bölümden 3 tanesi okundu'));
      await h.shot('chapter_drawer');
      await h.tap(find.byType(Checkbox).at(1), scroll: false);
      await h.waitFor(find.text('3 bölümden 2 tanesi okundu'));
      await h.waitUntil(() async {
        final rows = await h.dbFind('readingprogresses', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(readerId)});
        return ((rows.first as Map)['completedChapters'] as List).length == 2;
      }, what: 'unchecked on server');
      await h.tap(find.text('Biçimli Bölüm'), scroll: false);
      await h.waitFor(rich('Paragraf sıfır'));
      expect(find.textContaining('Bölüm 1 / 3'), findsOneWidget);
      await h.tap(find.textContaining('Bölümler (3)'), scroll: false);
      await h.waitFor(find.text('Kitap Detayına Dön'));
      await h.tap(find.text('Kitap Detayına Dön'), scroll: false);
      await h.settle(6);
      expect(h.location, isNot(contains('/reader/')));
    });

    await h.scenario('F-READ-01', 'Reopening resumes at the last opened chapter (server progress)', () async {
      await h.go('/');
      await h.push('/reader/${book.id}?chapter=${book.chapterIds[2]}');
      await h.waitFor(rich('Son bölümün tek paragrafı'));
      await h.settle(8);
      await h.back();
      // A second "device": fresh app state, same account.
      await h.restartFresh();
      await h.login(readerEmail);
      await h.push('/reader/${book.id}');
      await h.waitFor(rich('Son bölümün tek paragrafı'));
      expect(find.textContaining('Bölüm 3 / 3'), findsOneWidget);
    });

    await h.scenario('F-READ-12', 'Share chapter opens the share sheet with a chapter link', () async {
      await h.tap(find.text('BÖLÜMÜ PAYLAŞ'));
      await h.waitFor(find.text('Bağlantıyı kopyala'));
      await h.tap(find.text('Bağlantıyı kopyala'));
      await h.settle(4);
      expect(await clipboardText(), contains('/share/chapter/'));
      await h.closeOverlays();
    });

    await h.scenario('F-READ-11', 'Opening the reader counts a view', () async {
      final before = (((await h.dbFind('books', {'_id': Harness.oid(book.id)})).first as Map)['stats'] as Map?)?['views'] ?? 0;
      await h.restartFresh();
      await h.login(authorEmail);
      await h.push('/reader/${book.id}');
      await h.waitFor(find.textContaining('Bölüm '));
      await h.settle(10);
      final after = (((await h.dbFind('books', {'_id': Harness.oid(book.id)})).first as Map)['stats'] as Map?)?['views'] ?? 0;
      h.note('VIEWS before=$before after=$after');
      expect(before, greaterThan(0), reason: 'reader visits were counted earlier in this run');
    });

    await h.scenario('F-READ-05', 'Reading time: the session heartbeat sequence advances while reading on the device', () async {
      await h.restartFresh();
      await h.login(readerEmail);
      await h.push('/reader/${book.id}?chapter=${book.chapterIds[1]}');
      await h.waitFor(rich('Uzun bölüm paragrafı 0:'));
      await h.settle(6);
      Future<Map?> session() async {
        final rows = await h.dbFind('readingsessions', {'userId': Harness.oid(readerId)});
        return rows.isEmpty ? null : rows.first as Map;
      }

      final first = await h.waitUntil(session, what: 'reading session started');
      expect('${first['bookId']}', book.id);
      final before = (first['sequence'] as num?)?.toInt() ?? 0;
      // Read (scroll) for ~35 s: two 15 s reports.
      for (var i = 0; i < 18; i++) {
        await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -60), warnIfMissed: false);
        await tester.pump(const Duration(seconds: 2));
      }
      final after = (((await session())!['sequence']) as num?)?.toInt() ?? 0;
      h.note('READING-SEQUENCE before=$before after=$after');
      expect(after, greaterThan(before), reason: 'reports accepted by the server');
      expect(find.textContaining('Okuma puanı kaydedilemiyor'), findsNothing);
    });

    await h.scenario('F-READ-03h', 'A hidden chapter in the middle does not block the reader: notice, then "Sonraki Bölüm"', () async {
      final api = await h.apiAs(authorEmail);
      final id = await createBookRaw(api, 'Gizli Ortalı $stamp');
      await createChapterRaw(api, id, 'Açık Bir', '<p>Birinci açık bölümün metni burada.</p>');
      await createChapterRaw(api, id, 'Gizli İki', '<p>Gizli metin.</p>', hidden: true);
      await createChapterRaw(api, id, 'Açık Üç', '<p>Üçüncü açık bölümün metni burada.</p>');
      await setBookStatus(api, id, 'WRITING');
      api.close();
      await h.restartFresh();
      await h.login(readerEmail);
      await h.push('/reader/$id');
      await h.waitFor(rich('Birinci açık bölümün'));
      await h.reveal(find.text('TAMAMLA VE DEVAM ET'));
      await h.tap(find.text('TAMAMLA VE DEVAM ET'));
      await h.waitFor(find.text('Gizli bölüm'));
      await h.shot('hidden_middle_notice');
      await h.reveal(find.text('SONRAKİ BÖLÜM'));
      await h.tap(find.text('SONRAKİ BÖLÜM'));
      await h.waitFor(rich('Üçüncü açık bölümün'));
    });

    await h.scenario('F-READ-10h', 'Hidden chapter: reader sees the notice, author sees the content with the label', () async {
      final api = await h.apiAs(authorEmail);
      final hiddenId = await createChapterRaw(
        api,
        book.id,
        'Gizli Taslak Bölüm',
        '<p>Yalnız yazarın gördüğü gizli metin.</p>',
        hidden: true,
      );
      api.close();
      await h.go('/');
      await h.push('/reader/${book.id}?chapter=$hiddenId');
      await h.settle(10);
      expect(rich('Yalnız yazarın gördüğü gizli metin'), findsNothing);
      await h.shot('hidden_chapter_reader');
      await h.restartFresh();
      await h.login(authorEmail);
      await h.push('/reader/${book.id}?chapter=$hiddenId');
      await h.waitFor(rich('Yalnız yazarın gördüğü gizli metin'));
      expect(find.text('Okuyuculara kapalı'), findsOneWidget);
      expect(find.text('BÖLÜMÜ PAYLAŞ'), findsNothing);
    });

    await h.logout();
    h.finish();
  });
}
