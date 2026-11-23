// Verification batch 4 — authoring: create book with cover upload, writing
// dashboard, native editor (toolbar, keyboard, undo, autosave), chapter
// management, publication, website-content compatibility.
import 'dart:io' show Platform;

import 'package:betik/features/writing/chapter_editor.dart';
import 'package:betik/features/writing/image_upload.dart';
import 'package:flutter/services.dart';
import 'package:flutter_quill/flutter_quill.dart' as quill;
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support/content.dart';
import 'support/harness.dart';

Uint8List _photo() {
  final image = img.Image(width: 900, height: 1000);
  img.fill(image, color: img.ColorRgb8(176, 94, 52));
  img.fillRect(image, x1: 300, y1: 300, x2: 600, y2: 700, color: img.ColorRgb8(30, 30, 30));
  return Uint8List.fromList(img.encodePng(image));
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('authoring and native editor', (tester) async {
    final h = Harness(tester, binding, 'write');
    await h.start();
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
    final title = 'Yazar Doğrulama $stamp';
    String? bookId;

    Future<Map> bookRow(String id) async => (await h.dbFind('books', {'_id': Harness.oid(id)})).first as Map;
    Future<List> chapterRows(String id) => h.dbFind('chapters', {'bookId': Harness.oid(id), 'isDeleted': false}, 20);
    Future<Map> chapterRow(String id) async => (await h.dbFind('chapters', {'_id': Harness.oid(id)})).first as Map;
    quill.QuillController editorController() => tester
        .widget<quill.QuillEditor>(find.descendant(of: find.byType(ChapterEditor), matching: find.byType(quill.QuillEditor)))
        .controller;

    Future<void> openDrawer() async {
      await h.tap(find.byTooltip('Bölümler'), scroll: false);
      await h.waitFor(find.text('EKLE'));
    }

    /// Opens [title] in the dashboard of the test book, whatever state the
    /// previous scenario left.
    Future<void> openChapter(String title) async {
      if (!h.location.startsWith('/dashboard/$bookId')) {
        await h.go('/');
        await h.push('/dashboard/$bookId');
        await h.waitFor(find.byTooltip('Bölümler'));
      }
      await openDrawer();
      await h.tap(find.descendant(of: find.byType(Drawer), matching: find.text(title)), scroll: false);
      await h.waitFor(find.byType(ChapterEditor));
      await h.settle(4);
    }

    Future<void> focusEditorEnd() async {
      if (!tester.testTextInput.isRegistered) tester.testTextInput.register();
      final editor = find.byType(quill.QuillEditor);
      await h.waitFor(editor);
      await tester.tap(editor);
      await h.settle(4);
      final controller = editorController();
      controller.updateSelection(TextSelection.collapsed(offset: controller.document.length - 1), quill.ChangeSource.local);
      await h.settle(3);
    }

    /// What a software keyboard does: it sends the editor a new editing
    /// value (the editor's current text with [text] inserted at the caret)
    /// over the platform text-input connection of the focused editor.
    Future<void> keyboardType(String text) async {
      final controller = editorController();
      final focus = FocusManager.instance.primaryFocus;
      final attached = tester.testTextInput.hasAnyClients;
      h.note('IME focus=${focus?.debugLabel ?? focus.runtimeType} attached=$attached sel=${controller.selection}');
      if (!attached) throw TestFailure('Editor lost its keyboard connection before typing "$text" (focus: $focus)');
      final plain = controller.document.toPlainText();
      final selection = controller.selection;
      final start = selection.start < 0 ? plain.length - 1 : selection.start;
      final end = selection.end < 0 ? start : selection.end;
      final next = plain.replaceRange(start, end, text);
      tester.testTextInput.updateEditingValue(
        TextEditingValue(
          text: next,
          selection: TextSelection.collapsed(offset: start + text.length),
        ),
      );
      await h.settle(3);
    }

    Future<void> waitSaved() async {
      await h.waitFor(
        find.text('OTOMATİK KAYIT BEKLENİYOR…').evaluate().isEmpty ? find.text('KAYDEDİLDİ') : find.text('KAYDEDİLDİ'),
        timeout: const Duration(seconds: 20),
      );
      await h.waitFor(find.text('KAYDEDİLDİ'), timeout: const Duration(seconds: 20));
    }

    await h.login(authorEmail);

    await h.scenario(
      'F-WRITE-01/02/03',
      'Create book: validation list, cover picked → cropped → uploaded (sandbox Cloudinary), classification, draft saved → dashboard',
      () async {
        debugPickImageOverride = () async => _photo();
        await h.go('/');
        await h.push('/create-book');
        await h.waitFor(find.text('Yeni Kitap'));
        await h.tap(find.text('TASLAK OLARAK KAYDET'));
        await h.waitFor(find.text('Lütfen şu alanları düzeltin:'));
        expect(h.hasContaining('Kapak resmi yüklemek zorunludur.'), isTrue);
        expect(h.hasContaining('Kitap başlığı zorunludur.'), isTrue);
        expect(h.hasContaining('Bir eser biçimi seçin.'), isTrue);
        expect(h.hasContaining('Açıklama zorunludur.'), isTrue);
        await h.shot('create_validation');
        await h.tap(find.text('KAPAK YÜKLE'));
        await h.waitUntil(() async => ((await h.ctl('uploads')) as List).isNotEmpty, what: 'upload request');
        final upload = ((await h.ctl('uploads')) as List).last as Map;
        expect(upload['ok'], isTrue, reason: '$upload');
        expect(upload['jpeg'], isTrue, reason: 'cropped image re-encoded as JPEG');
        await h.settle(8);
        await h.typeIn('Kitap Başlığı', title);
        await h.tap(find.text('Seçin'));
        await h.waitFor(find.text('Roman').last);
        await h.tap(find.text('Roman').last, scroll: false);
        final genres = find.byType(FilterChip);
        await h.reveal(genres);
        await h.tap(genres.at(0));
        await h.tap(genres.at(1));
        await h.typeIn('Açıklama', 'Mobil yazar akışıyla oluşturulan doğrulama kitabı. Türkçe: çğıöşü.');
        await h.dismissKeyboard();
        await h.shot('create_filled');
        await h.tap(find.text('TASLAK OLARAK KAYDET'));
        await h.waitUntil(() async => h.location.startsWith('/dashboard/'), what: 'dashboard', timeout: const Duration(seconds: 20));
        bookId = h.location.split('/').last.split('?').first;
        final row = await bookRow(bookId!);
        expect(row['title'], title);
        expect(row['status'], 'DRAFT');
        expect('${row['imageUrl']}', startsWith('https://res.cloudinary.com/betik-sandbox-mock/'));
        expect((row['genreIds'] as List).length, 2);
        debugPickImageOverride = null;
      },
    );

    await h.scenario(
      'F-WRITE-04/09',
      'Dashboard: empty state, publish blocked, add chapter (title required), add hidden chapter',
      () async {
        await h.waitFor(find.text('HOŞGELDİNİZ'));
        expect(find.text('Yayınlamak için en az bir bölüme metin ekleyin.'), findsOneWidget);
        expect(
          tester
              .widget<ButtonStyleButton>(
                find.ancestor(of: find.text('YAYINLA (GÖRÜNÜR YAP)'), matching: find.bySubtype<ButtonStyleButton>()).first,
              )
              .onPressed,
          isNull,
        );
        await h.shot('dashboard_empty');
        await openDrawer();
        await h.tap(find.text('EKLE'), scroll: false);
        await h.waitFor(find.text('Bölüm başlığı zorunludur.'));
        final input = find.descendant(of: find.widgetWithText(TextField, 'Yeni bölüm başlığı'), matching: find.byType(EditableText));
        await h.type(input, 'Birinci Bölüm');
        await h.tap(find.text('EKLE'), scroll: false);
        // The app opens the new chapter right away (deliberate difference from the website).
        await h.waitFor(find.byType(ChapterEditor));
        expect(find.text('Birinci Bölüm'), findsOneWidget);
        await openDrawer();
        await h.type(input, 'Gizli Bölüm');
        await h.tap(find.text('Yeni bölümü gizli oluştur'), scroll: false);
        await h.tap(find.text('EKLE'), scroll: false);
        await h.waitFor(find.text('Gizli Bölüm · Gizli'));
        await openDrawer();
        await h.shot('dashboard_drawer');
        final rows = await chapterRows(bookId!);
        expect(rows.length, 2);
        expect(rows.where((r) => (r as Map)['isHidden'] == true).length, 1);
        await h.tap(find.descendant(of: find.byType(Drawer), matching: find.text('Birinci Bölüm')), scroll: false);
        await h.waitFor(find.byType(ChapterEditor));
      },
    );

    await h.scenario(
      'F-WRITE-05a',
      'Editor: toolbar heading/bold/italic/list + typing through the text-input channel → autosave HTML is Quill-compatible',
      () async {
        await openChapter('Birinci Bölüm');
        await focusEditorEnd();
        // Heading 1 line
        await h.tap(find.byTooltip('Başlık düzeyi'), scroll: false);
        await h.tap(find.text('Başlık 1').last, scroll: false);
        await keyboardType('Açılış');
        await keyboardType('\n');
        // The line after a heading must be a normal paragraph (Quill behaviour).
        if (find.text('Başlık 1').evaluate().isNotEmpty) {
          await h.tap(find.byTooltip('Başlık düzeyi'), scroll: false);
          await h.tap(find.text('Normal').last, scroll: false);
        }
        await keyboardType('Düz metin ');
        await h.tap(find.byTooltip('Kalın'), scroll: false);
        await keyboardType('kalın');
        await h.tap(find.byTooltip('Kalın'), scroll: false);
        await keyboardType(' ve ');
        await h.tap(find.byTooltip('İtalik'), scroll: false);
        await keyboardType('italik');
        await h.tap(find.byTooltip('İtalik'), scroll: false);
        await keyboardType(' çğıöşü.');
        await keyboardType('\n');
        await h.tap(find.byTooltip('Madde işaretli liste'), scroll: false);
        await keyboardType('madde bir');
        await keyboardType('\n');
        await keyboardType('madde iki');
        await h.shot('editor_formatted');
        await waitSaved();
        final chapters = await chapterRows(bookId!);
        final first = chapters.firstWhere((r) => (r as Map)['title'] == 'Birinci Bölüm') as Map;
        final html = first['content'] as String;
        h.note('EDITOR-HTML $html');
        expect(html, contains('<h1>Açılış</h1>'));
        expect(html, contains('<strong>kalın</strong>'));
        expect(html, contains('<em>italik</em>'));
        expect(html, contains('çğıöşü.'));
        expect(html, contains('<ul><li>madde bir</li><li>madde iki</li></ul>'));
        expect(first['pageCount'], 1);
      },
    );

    await h.scenario('F-WRITE-05b', 'Editor: undo removes the last edit, redo restores it, both are saved', () async {
      await openChapter('Birinci Bölüm');
      await focusEditorEnd();
      await keyboardType(' geri-alınacak');
      final controller = editorController();
      expect(controller.document.toPlainText(), contains('geri-alınacak'));
      String text() => editorController().document.toPlainText().replaceAll('\n', '⏎');
      h.note('UNDO-0 hasUndo=${editorController().hasUndo} ${text()}');
      await h.tap(find.byTooltip('Geri al'));
      h.note('UNDO-1 hasUndo=${editorController().hasUndo} ${text()}');
      expect(text(), isNot(contains('geri-alınacak')), reason: 'after undo');
      await h.tap(find.byTooltip('Yinele'));
      h.note('UNDO-2 ${text()}');
      expect(text(), contains('geri-alınacak'), reason: 'after redo');
      await h.tap(find.byTooltip('Geri al'));
      expect(text(), isNot(contains('geri-alınacak')), reason: 'after second undo');
      await waitSaved();
      final chapters = await chapterRows(bookId!);
      final first = chapters.firstWhere((r) => (r as Map)['title'] == 'Birinci Bölüm') as Map;
      expect(first['content'], isNot(contains('geri-alınacak')));
    });

    await h.scenario('F-WRITE-05k', 'Real system keyboard typing in the editor', () async {
      // Inside `flutter drive` the framework's test text-input channel stays
      // in charge after any `enterText`, so the OS keyboard is never shown
      // (verified: `dumpsys input_method` → mInputShown=false). This path was
      // verified in a normal debug run instead: evidence
      // `android_manual_editor_real_keyboard.png` and the stored HTML in
      // stage-3/verification_log.md.
      throw SkipScenario('system keyboard cannot be shown under the integration-test binding; verified manually on Android');
    });

    await h.scenario(
      'F-WRITE-05c',
      'Copy and paste inside the editor through the selection toolbar (long-press, toolbar buttons)',
      () async {
        await openChapter('Birinci Bölüm');
        await focusEditorEnd();
        await Clipboard.setData(const ClipboardData(text: ''));
        final rect = tester.getRect(find.byType(quill.QuillEditor));
        // Long-press a word of the second line ("Düz metin ..."): selects the word and shows the toolbar.
        final wordAt = Offset(rect.left + 40, rect.top + 75);
        if (Platform.isIOS) {
          // iOS: a long-press moves the caret (magnifier); a double-tap selects the word.
          await tester.tapAt(wordAt);
          await tester.pump(const Duration(milliseconds: 60));
          await tester.tapAt(wordAt);
        } else {
          await tester.longPressAt(wordAt);
        }
        await h.settle(8);
        final selection = editorController().selection;
        h.note('COPY selection=$selection');
        await h.shot('editor_selection_toolbar');
        expect(selection.isCollapsed, isFalse, reason: 'long-press selects a word');
        final word = editorController().document.toPlainText().substring(selection.start, selection.end);
        await h.waitFor(find.text('Kopyala'));
        await h.tap(find.text('Kopyala').first, scroll: false);
        expect(await clipboardText(), word);
        // Caret at the end; the paste menu comes from a long-press (Android) or a tap on the caret (iOS).
        await focusEditorEnd();
        final caret = Offset(rect.left + rect.width / 2, rect.bottom - 120);
        await tester.longPressAt(caret);
        await h.settle(6);
        if (find.text('Yapıştır').evaluate().isEmpty) {
          await tester.tapAt(caret);
          await h.settle(6);
        }
        await h.shot('editor_paste_menu');
        await h.waitFor(find.text('Yapıştır'));
        final before = editorController().document.toPlainText();
        await h.tap(find.text('Yapıştır').first, scroll: false);
        await h.settle(6);
        final after = editorController().document.toPlainText();
        expect(after.length, before.length + word.length);
        await waitSaved();
      },
    );

    await h.scenario(
      'F-WRITE-05d',
      'Read-edit-save-read: leave dashboard, the reader shows the formatted text, reopening the editor keeps it unchanged',
      () async {
        await openChapter('Birinci Bölüm');
        await waitSaved();
        final before = ((await chapterRows(bookId!)).firstWhere((r) => (r as Map)['title'] == 'Birinci Bölüm') as Map)['content'] as String;
        await openDrawer();
        await h.tap(find.text('OKUYUCU MODU'), scroll: false);
        await h.waitFor(find.textContaining('Açılış', findRichText: true));
        expect(find.textContaining('madde bir', findRichText: true), findsOneWidget);
        await h.shot('reader_after_edit');
        await h.back();
        await h.go('/');
        await h.push('/dashboard/$bookId');
        await openDrawer();
        await h.tap(find.descendant(of: find.byType(Drawer), matching: find.text('Birinci Bölüm')), scroll: false);
        await h.waitFor(find.byType(ChapterEditor));
        await h.settle(10);
        expect(find.text('Bu bölüm salt okunur açıldı'), findsNothing);
        final after = ((await chapterRows(bookId!)).firstWhere((r) => (r as Map)['title'] == 'Birinci Bölüm') as Map)['content'] as String;
        expect(after, before, reason: 'opening the editor must not rewrite the chapter');
      },
    );

    await h.scenario(
      'F-WRITE-05e',
      'Website-created rich chapter: opens editable, an appended paragraph keeps headings/quote/lists/image/link',
      () async {
        final api = await h.apiAs(authorEmail);
        final id = await createChapterRaw(api, bookId!, 'Web Bölümü', richChapterHtml);
        api.close();
        final original = (await chapterRow(id))['content'] as String;
        await h.go('/');
        await h.push('/dashboard/$bookId');
        await openDrawer();
        await h.tap(find.descendant(of: find.byType(Drawer), matching: find.text('Web Bölümü')), scroll: false);
        await h.waitFor(find.byType(ChapterEditor));
        await h.settle(8);
        expect(find.text('Bu bölüm salt okunur açıldı'), findsNothing);
        await h.shot('web_chapter_in_editor');
        await focusEditorEnd();
        await keyboardType('\nMobilde eklenen paragraf.');
        await waitSaved();
        final saved = (await chapterRow(id))['content'] as String;
        h.note('WEB-ORIGINAL $original\nWEB-SAVED $saved');
        for (final part in [
          '<h1>Büyük Başlık</h1>',
          '<h2>Alt Başlık</h2>',
          '<blockquote>',
          '<ol><li>Birinci madde</li>',
          '<ul><li>Madde işareti</li></ul>',
          '<img src="data:image/png;base64',
          '<strong>kalın</strong>',
          'href="https://example.invalid/"',
          '<p><br',
        ]) {
          expect(saved, contains(part), reason: 'kept $part');
        }
        expect(saved, contains('<p>Mobilde eklenen paragraf.</p>'));
      },
    );

    await h.scenario('F-WRITE-05f', 'Chapter with markup the editor cannot write back opens read-only and is not rewritten', () async {
      final api = await h.apiAs(authorEmail);
      final id = await createChapterRaw(
        api,
        bookId!,
        'Uyumsuz Bölüm',
        '<h4>Dördüncü düzey</h4><p>Metin <span class="ozel">işaretli</span></p><pre>kod</pre>',
      );
      api.close();
      final original = (await chapterRow(id))['content'] as String;
      h.note('INCOMPATIBLE-STORED $original');
      await h.go('/');
      await h.push('/dashboard/$bookId');
      await openDrawer();
      await h.tap(find.descendant(of: find.byType(Drawer), matching: find.text('Uyumsuz Bölüm')), scroll: false);
      await h.waitFor(find.byType(ChapterEditor));
      await h.settle(8);
      await h.shot('incompatible_chapter');
      final readOnly = find.text('Bu bölüm salt okunur açıldı').evaluate().isNotEmpty;
      h.note('INCOMPATIBLE-READONLY $readOnly');
      expect(readOnly, isTrue, reason: 'stored: $original');
      expect(find.byTooltip('Kalın'), findsNothing);
      await h.settle(10);
      expect((await chapterRow(id))['content'], original);
    });

    await h.scenario('F-WRITE-06/08/07', 'Hide/show from the chapter menu; publish from the bar; share chapter from the menu', () async {
      await openDrawer();
      await h.tap(find.descendant(of: find.byType(Drawer), matching: find.text('Birinci Bölüm')), scroll: false);
      await h.waitFor(find.byType(ChapterEditor));
      final firstId = '${((await chapterRows(bookId!)).firstWhere((r) => (r as Map)['title'] == 'Birinci Bölüm') as Map)['_id']}';
      await h.tap(find.byTooltip('Bölüm işlemleri'), scroll: false);
      await h.tap(find.text('Okuyuculardan gizle'), scroll: false);
      await h.waitFor(find.text('Birinci Bölüm · Gizli'));
      expect((await chapterRow(firstId))['isHidden'], isTrue);
      await h.tap(find.byTooltip('Bölüm işlemleri'), scroll: false);
      await h.tap(find.text('Okuyuculara aç'), scroll: false);
      await h.waitGone(find.text('Birinci Bölüm · Gizli'));
      expect((await chapterRow(firstId))['isHidden'], isFalse);
      // Publish
      await h.tap(find.text('YAYINLA (GÖRÜNÜR YAP)'), scroll: false);
      await h.dialogTap('Onayla');
      await h.waitFor(find.text('Kitabınız okuyuculara açık'));
      expect((await bookRow(bookId!))['status'], 'WRITING');
      await h.shot('dashboard_published');
      // Share (only for a published book's visible chapter)
      await h.tap(find.byTooltip('Bölüm işlemleri'), scroll: false);
      await h.tap(find.text('Bölümü paylaş'), scroll: false);
      await h.waitFor(find.text('Bağlantıyı kopyala'));
      await h.tap(find.text('Bağlantıyı kopyala'), scroll: false);
      await h.settle(3);
      expect(await clipboardText(), contains('/share/chapter/'));
      await h.closeOverlays();
      // Complete
      await h.tap(find.text('YAZIMI TAMAMLA'), scroll: false);
      await h.dialogTap('Onayla');
      await h.waitFor(find.text('Kitabınızın yazımı tamamlandı'));
      expect((await bookRow(bookId!))['status'], 'COMPLETED');
    });

    await h.scenario('F-WRITE-04d', 'Delete a chapter: cancel keeps it, confirm removes it', () async {
      await openDrawer();
      await h.tap(find.byTooltip('Bölümü sil').last, scroll: false);
      await h.dialogTap('Vazgeç');
      final before = (await chapterRows(bookId!)).length;
      await openDrawer();
      await h.tap(find.byTooltip('Bölümü sil').last, scroll: false);
      await h.dialogTap('Sil');
      await h.waitFor(find.text('Bölüm silindi'));
      expect((await chapterRows(bookId!)).length, before - 1);
    });

    await h.scenario('F-BOOK-09/F-WRITE-02e', 'Edit classification from the dashboard: genre limit, save, server updated', () async {
      await openDrawer();
      await h.tap(find.text('SINIFLANDIRMAYI DÜZENLE'), scroll: false);
      await h.waitFor(find.text('SINIFLANDIRMAYI KAYDET'));
      final chips = find.byType(FilterChip);
      await h.reveal(chips);
      await h.tap(chips.at(2));
      await h.reveal(find.text('SINIFLANDIRMAYI KAYDET'));
      await h.tap(find.text('SINIFLANDIRMAYI KAYDET'));
      await h.waitFor(find.text('Sınıflandırma kaydedildi.'));
      expect(((await bookRow(bookId!))['genreIds'] as List).length, 3);
      await h.closeOverlays();
    });

    await h.scenario('F-WRITE-10', '"Okuyucu Modu" opens the reader for the book', () async {
      await openDrawer();
      await h.tap(find.text('OKUYUCU MODU'), scroll: false);
      await h.waitFor(find.textContaining(RegExp(r'Bölüm \d+ / \d+')));
      expect(h.location, startsWith('/reader/$bookId'));
    });

    await h.scenario('F-WRITE-guard', 'Another member opening the dashboard gets no editor; server refuses writes', () async {
      await h.login(readerEmail);
      await h.go('/');
      expect(bookId, isNotNull);
      await h.push('/dashboard/$bookId');
      await h.settle(10);
      expect(find.byType(ChapterEditor), findsNothing);
      expect(h.hasContaining('erişim yetkiniz yok') || h.hasContaining('yazar hak talebinizin'), isTrue, reason: h.visibleTexts());
      await h.shot('dashboard_non_owner');
    });

    await h.logout();
    h.finish();
  });
}
