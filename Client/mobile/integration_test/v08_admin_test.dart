// Verification batch 8 — administration: overview, data browser, schema,
// record editor (reason, optimistic lock, moderation), audit trail, admin
// powers in regular screens, role guards.
import 'package:betik/core/widgets/ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support/content.dart';
import 'support/harness.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('administration', (tester) async {
    final h = Harness(tester, binding, 'admin');
    await h.start();
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(7);
    late TestBook book;
    late String commentId;
    final commentText = 'Moderasyon test yorumu $stamp';

    Future<Map> comment() async => (await h.dbFind('comments', {'_id': Harness.oid(commentId)})).first as Map;

    await h.scenario('SETUP', 'Published book with a reader comment', () async {
      book = await createPublishedBook(h, 'Yönetim Doğrulama $stamp');
      final api = await h.apiAs(readerEmail);
      final data = await api.run(
        r'mutation($bookId: ID!, $content: String!) { createComment(bookId: $bookId, content: $content) { id } }',
        variables: {'bookId': book.id, 'content': commentText},
      );
      commentId = (data['createComment'] as Map)['id'] as String;
      api.close();
    });

    await h.scenario('F-ADM-guard', 'Member and publisher cannot open admin screens; the server refuses admin queries', () async {
      await h.login(publisherEmail);
      await h.go('/admin/data/Comment');
      await h.settle(4);
      expect(h.location, '/');
      Object? error;
      try {
        await h.gql('query { getAdminOverview { pendingBooks } }');
      } catch (e) {
        error = e;
      }
      expect(error, isNotNull, reason: 'publisher must be refused by the server');
    });

    await h.login(adminEmail);

    await h.scenario('F-ADM-01', 'Overview: pending counts and per-resource totals', () async {
      await h.go('/');
      await h.push('/admin');
      await h.waitFor(find.text('İnceleme bekleyenler'));
      await h.reveal(find.text('Kitap yorumları'));
      await h.shot('admin_overview');
    });

    await h.scenario('F-ADM-02/04', 'Data browser: comments list, search, status filter; schema view', () async {
      await h.go('/');
      await h.push('/admin/data/Comment');
      await h.waitFor(find.textContaining(' kayıt'));
      await h.reveal(find.textContaining(commentText));
      final search = find.descendant(of: find.widgetWithText(TextField, 'Ara'), matching: find.byType(EditableText));
      await h.type(search, 'Moderasyon test yorumu');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await h.settle(8);
      h.note('ADMIN-SEARCH ${h.visibleTexts(20)}');
      await h.shot('admin_data_comments');
      await h.tap(find.text('Şema ve alanlar'));
      await h.waitFor(find.textContaining('(isDeleted)'));
      await h.shot('admin_schema');
      await h.tap(find.text('Kayıtlar'));
    });

    await h.scenario('F-ADM-03/J-14', 'Record editor: reason required; hide the comment (gone from the book page); restore', () async {
      await h.go('/');
      await h.push('/admin/record/Comment/$commentId');
      await h.waitFor(find.text('DEĞİŞİKLİKLERİ KAYDET'));
      await h.shot('admin_record_editor');
      final hidden = find.ancestor(of: find.textContaining('YAYINDAN KALDIRILMIŞ'), matching: find.byType(LabeledField));
      await h.reveal(hidden);
      await h.tap(find.descendant(of: hidden, matching: find.byType(SwitchListTile)));
      await h.typeIn('İşlem gerekçesi', 'kı');
      await h.dismissKeyboard();
      await h.tap(find.text('DEĞİŞİKLİKLERİ KAYDET'));
      await h.waitFor(find.text('İşlem gerekçesi 5–500 karakter olmalıdır.'));
      await h.typeIn('İşlem gerekçesi', 'Mobil moderasyon doğrulaması');
      await h.dismissKeyboard();
      await h.tap(find.text('DEĞİŞİKLİKLERİ KAYDET'));
      await h.waitFor(find.text('Kayıt güncellendi.'));
      expect((await comment())['isDeleted'], isTrue);
      await h.go('/');
      await h.push('/book/${book.id}');
      await h.waitFor(find.text('KİTABI OKU'));
      await h.reveal(find.text('Yorumlar'));
      await h.settle(6);
      expect(find.textContaining(commentText, findRichText: true), findsNothing);
      await h.go('/');
      await h.push('/admin/record/Comment/$commentId');
      await h.waitFor(find.text('DEĞİŞİKLİKLERİ KAYDET'));
      final hiddenAgain = find.ancestor(of: find.textContaining('YAYINDAN KALDIRILMIŞ'), matching: find.byType(LabeledField));
      await h.reveal(hiddenAgain);
      await h.tap(find.descendant(of: hiddenAgain, matching: find.byType(SwitchListTile)));
      await h.typeIn('İşlem gerekçesi', 'Moderasyon geri alındı');
      await h.dismissKeyboard();
      await h.tap(find.text('DEĞİŞİKLİKLERİ KAYDET'));
      await h.waitFor(find.text('Kayıt güncellendi.'));
      expect((await comment())['isDeleted'], isFalse);
    });

    await h.scenario('F-ADM-03c', 'Optimistic lock: a change saved elsewhere meanwhile → conflict message and reload', () async {
      await h.go('/');
      await h.push('/admin/record/Comment/$commentId');
      await h.waitFor(find.text('DEĞİŞİKLİKLERİ KAYDET'));
      // Another admin session saves first.
      final other = await h.apiAs(adminEmail);
      final current = await other.run(
        r'query($id: ID!) { getAdminRecord(resource: "Comment", id: $id) { revision } }',
        variables: {'id': commentId},
      );
      await other.run(
        r'mutation($id: ID, $revision: String, $changes: JSON!, $reason: String!) { saveAdminRecord(resource: "Comment", id: $id, revision: $revision, changes: $changes, reason: $reason) { id } }',
        variables: {
          'id': commentId,
          'revision': (current['getAdminRecord'] as Map)['revision'],
          'changes': {'content': '$commentText (düzenlendi)'},
          'reason': 'Eşzamanlı düzenleme testi',
        },
      );
      other.close();
      final hidden = find.ancestor(of: find.textContaining('YAYINDAN KALDIRILMIŞ'), matching: find.byType(LabeledField));
      await h.reveal(hidden);
      await h.tap(find.descendant(of: hidden, matching: find.byType(SwitchListTile)));
      await h.typeIn('İşlem gerekçesi', 'Eski sürümden kaydetme denemesi');
      await h.dismissKeyboard();
      await h.tap(find.text('DEĞİŞİKLİKLERİ KAYDET'));
      await h.waitFor(find.text('GÜNCEL KAYDI YENİDEN YÜKLE'));
      await h.shot('admin_conflict');
      expect((await comment())['isDeleted'], isFalse, reason: 'stale save must not apply');
      await h.tap(find.text('GÜNCEL KAYDI YENİDEN YÜKLE'));
      await h.waitFor(find.textContaining('(düzenlendi)'));
    });

    await h.scenario('F-ADM-14', 'Audit trail lists the moderation actions with their reasons', () async {
      await h.go('/');
      await h.push('/admin/data/AdminAudit');
      await h.waitFor(find.textContaining(' kayıt'));
      await h.settle(6);
      await h.reveal(find.textContaining('Mobil moderasyon doğrulaması'));
      await h.shot('admin_audit');
    });

    await h.scenario('F-ADM-13', 'Admin powers in regular screens: delete + classification on another author\'s book (not the author\'s status buttons, as on the website); author dashboard opens', () async {
      final api = await h.apiAs(authorEmail);
      final disposable = await createBookRaw(api, 'Yönetici Silme $stamp');
      await createChapterRaw(api, disposable, 'Tek', '<p>Silinecek kitabın metni.</p>');
      await setBookStatus(api, disposable, 'WRITING');
      api.close();
      await h.go('/');
      await h.push('/book/$disposable');
      await h.waitFor(find.text('KİTABI OKU'));
      await h.reveal(find.text('SİL'));
      expect(find.text('SINIFLANDIRMAYI DÜZENLE'), findsOneWidget);
      expect(find.text('TASLAĞA ÇEK'), findsNothing);
      await h.shot('admin_on_book');
      await h.tap(find.text('SİL'));
      await h.dialogTap('Sil');
      await h.waitUntil(() async {
        final rows = await h.dbFind('books', {'_id': Harness.oid(disposable)});
        return rows.isEmpty || (rows.first as Map)['isDeleted'] == true;
      }, what: 'admin deleted the book');
      await h.go('/');
      await h.push('/dashboard/${book.id}');
      await h.waitFor(find.byTooltip('Bölümler'), timeout: const Duration(seconds: 20));
      await h.shot('admin_dashboard');
    });

    await h.logout();
    h.finish();
  });
}
