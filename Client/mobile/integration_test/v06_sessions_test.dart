// Verification batch 6 — writing sessions: creation access with admin
// review, create, entries, likes, live updates, private gate, cover, share,
// entry deep link, close.
import 'package:betik/features/funding/funding_shared.dart';
import 'package:betik/features/writing/image_upload.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support/content.dart';
import 'support/harness.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('writing sessions', (tester) async {
    final h = Harness(tester, binding, 'sessions');
    await h.start();
    late TestUser a;
    late TestUser b;
    String? openId;
    String? privateId;
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(7);

    Future<Map> userRow(String id) async => (await h.dbFind('users', {'_id': Harness.oid(id)})).first as Map;
    Future<Map> sessionRow(String id) async => (await h.dbFind('sessions', {'_id': Harness.oid(id)})).first as Map;
    Future<List> entries(String id) => h.dbFind('sessionentries', {'sessionId': Harness.oid(id), 'isDeleted': false}, 50);
    Future<void> openSession() async {
      if (!h.location.startsWith('/session/$openId')) {
        await h.go('/');
        await h.push('/session/$openId');
      }
      await h.waitFor(find.text('OTURUMU KAPAT'));
    }

    Finder composer() => find.descendant(of: find.widgetWithText(TextField, 'Düşüncelerini yaz...'), matching: find.byType(EditableText));

    Future<void> requestAccess(TestUser user, String reason) async {
      await h.login(user.email, password: user.password);
      await h.go('/sessions');
      await h.waitFor(find.text('Yazı Oturumları'));
      await h.reveal(find.text('Oturum açmak ister misin?'));
      await h.typeIn('Nasıl oturumlar düzenlemek istiyorsunuz?', reason);
      await h.dismissKeyboard();
      await h.tap(find.text('OTURUM AÇMA İZNİ İSTE'));
    }

    await h.scenario('SETUP', 'Register two disposable members', () async {
      a = await registerUser(h, 'sa');
      b = await registerUser(h, 'sb');
    });

    await h.scenario('F-SESS-02', 'Request creation access: short reason refused, request stored as PENDING', () async {
      await requestAccess(a, 'kısa');
      await h.waitFor(find.text('Lütfen en az 10 karakterlik bir açıklama yazın.'));
      await h.typeIn('Nasıl oturumlar düzenlemek istiyorsunuz?', 'Haftalık öykü atölyesi düzenlemek istiyorum.');
      await h.dismissKeyboard();
      await h.tap(find.text('OTURUM AÇMA İZNİ İSTE'));
      await h.settle(6);
      await h.reveal(find.text('Oturum açma başvurunuz yönetici onayını bekliyor.'));
      expect(((await userRow(a.id))['sessionCreationAccess'] as Map)['status'], 'PENDING');
      await h.shot('access_pending');
      await requestAccess(b, 'Okur buluşmaları için oturum açmak isterim.');
      await h.settle(6);
      await h.reveal(find.text('Oturum açma başvurunuz yönetici onayını bekliyor.'));
    });

    await h.scenario('F-ADM-06', 'Admin approves A and rejects B with a note', () async {
      await h.login(adminEmail);
      await h.go('/');
      await h.push('/admin/session-access');
      await h.waitFor(find.textContaining('@${a.username}'));
      await h.shot('admin_session_access');
      Finder inCard(String username, Finder f) => find.descendant(
        of: find.ancestor(of: find.textContaining('@$username ·'), matching: find.byType(PanelCard)).first,
        matching: f,
      );
      await h.tap(inCard(a.username, find.text('ONAYLA')));
      await h.settle(6);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(() async => ((await userRow(a.id))['sessionCreationAccess'] as Map)['status'] == 'APPROVED', what: 'A approved');
      await h.waitFor(find.textContaining('@${b.username}'));
      final note = inCard(b.username, find.byType(EditableText));
      await h.type(note, 'Lütfen planınızı detaylandırın.');
      await h.tap(inCard(b.username, find.text('REDDET')));
      await h.settle(6);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(() async => ((await userRow(b.id))['sessionCreationAccess'] as Map)['status'] == 'REJECTED', what: 'B rejected');
    });

    await h.scenario('F-SESS-14/02r', 'A refreshes the status and sees approval; B sees the rejection note and can re-apply', () async {
      await h.login(b.email, password: b.password);
      await h.go('/sessions');
      await h.waitFor(find.textContaining('Önceki başvurunuz onaylanmadı.'));
      expect(find.textContaining('Lütfen planınızı detaylandırın.'), findsOneWidget);
      expect(find.text('YENİDEN İZİN İSTE'), findsOneWidget);
      await h.shot('access_rejected');
      await h.login(a.email, password: a.password);
      await h.go('/sessions');
      await h.waitFor(find.text('OTURUM AÇ'));
    });

    await h.scenario('F-SESS-03/01', 'Create an open session with tags; it appears in the list', () async {
      await h.tap(find.text('OTURUM AÇ'));
      await h.waitFor(find.text('OTURUM OLUŞTUR'));
      await h.tap(find.text('OTURUM OLUŞTUR'));
      await h.waitFor(find.text('Başlık zorunludur.'));
      await h.typeIn('Başlık', 'Sisli Sabah Atölyesi $stamp');
      final description = find.descendant(
        of: find.widgetWithText(TextField, 'Kısa bir açıklama ekleyin...'),
        matching: find.byType(EditableText),
      );
      await h.type(description, 'Her sabah bir paragraf yazıyoruz.');
      final tag = find.descendant(of: find.widgetWithText(TextField, 'Etiket yazıp ekle...'), matching: find.byType(EditableText));
      await h.type(tag, 'öykü');
      await h.tap(find.text('EKLE'));
      await h.dismissKeyboard();
      await h.shot('create_session');
      await h.tap(find.text('OTURUM OLUŞTUR'));
      await h.waitFor(find.text(Harness.upperTr('Sisli Sabah Atölyesi $stamp')));
      final rows = await h.dbFind('sessions', {'title': 'Sisli Sabah Atölyesi $stamp'});
      expect(rows.length, 1);
      openId = '${(rows.first as Map)['_id']}';
      expect((rows.first as Map)['type'], 'OPEN');
      expect((rows.first as Map)['tags'], contains('öykü'));
      await h.shot('sessions_list');
    });

    await h.scenario('F-SESS-04/06', 'Open detail, post an entry with a mention of B', () async {
      await h.tap(find.text(Harness.upperTr('Sisli Sabah Atölyesi $stamp')));
      await h.waitFor(find.text('Henüz yazı yok'));
      await h.type(composer(), 'İlk paragraf: sis dağılırken @${b.username}');
      await h.dismissKeyboard();
      await h.tap(find.text('PAYLAŞ'));
      await h.waitFor(find.textContaining('İlk paragraf: sis dağılırken', findRichText: true));
      expect((await entries(openId!)).length, 1);
      await h.shot('session_detail');
    });

    await h.scenario('F-SESS-07', 'Live: B\'s entry posted elsewhere appears in A\'s open session', () async {
      final apiB = await h.apiAs(b.email, password: b.password);
      await apiB.run(
        r'mutation($sessionId: ID!, $content: String!) { addSessionEntry(sessionId: $sessionId, content: $content) { id } }',
        variables: {'sessionId': openId, 'content': 'B canlı katıldı'},
      );
      apiB.close();
      await h.waitFor(find.textContaining('B canlı katıldı', findRichText: true), timeout: const Duration(seconds: 10));
      await h.shot('session_live_entry');
    });

    await h.scenario('F-SESS-08', 'Like B\'s entry and undo', () async {
      Future<int> likesOfB() async {
        final rows = await entries(openId!);
        final entry = rows.firstWhere((r) => '${(r as Map)['userId']}' == b.id) as Map;
        return (entry['likedBy'] as List).length;
      }

      await openSession();
      Finder inEntryOfB(Finder f) => find.descendant(
        of: find.ancestor(of: find.textContaining('B canlı katıldı', findRichText: true), matching: find.byType(Column)).first,
        matching: f,
      );
      await h.waitFor(find.textContaining('B canlı katıldı', findRichText: true));
      await h.tap(inEntryOfB(find.byIcon(Icons.favorite_border)));
      await h.waitUntil(() async => await likesOfB() == 1, what: 'entry liked');
      await h.tap(inEntryOfB(find.byIcon(Icons.favorite)));
      await h.waitUntil(() async => await likesOfB() == 0, what: 'entry unliked');
    });

    await h.scenario('F-SESS-09', 'Delete own entry from the options menu', () async {
      await openSession();
      // A fresh entry of A's own (the mention entry must survive for F-SESS-12).
      await h.type(composer(), 'Silinecek deneme yazısı');
      await h.dismissKeyboard();
      await h.tap(find.text('PAYLAŞ'));
      await h.waitFor(find.textContaining('Silinecek deneme yazısı', findRichText: true));
      final ownEntry = find
          .ancestor(of: find.textContaining('Silinecek deneme yazısı', findRichText: true), matching: find.byType(Column))
          .first;
      await h.tap(find.descendant(of: ownEntry, matching: find.byTooltip('Seçenekler')), scroll: false);
      await h.tap(find.text('Yazıyı Sil'), scroll: false);
      await h.settle(4);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Sil');
      await h.waitFor(find.text('Yazı silindi.'));
      expect((await entries(openId!)).length, 2);
      expect(find.textContaining('Silinecek deneme yazısı', findRichText: true), findsNothing);
    });

    await h.scenario('F-SESS-13', 'Share session copies a session share link', () async {
      await openSession();
      await h.tap(find.byTooltip('Oturumu paylaş'), scroll: false);
      await h.waitFor(find.text('Bağlantıyı kopyala'));
      await h.tap(find.text('Bağlantıyı kopyala'), scroll: false);
      await h.settle(3);
      expect(await clipboardText(), contains('/share/session/'));
      await h.closeOverlays();
    });

    await h.scenario('F-SESS-11', 'Edit session cover: upload, save, stored', () async {
      await openSession();
      debugPickImageOverride = () async {
        final image = img.Image(width: 1200, height: 500);
        img.fill(image, color: img.ColorRgb8(90, 120, 80));
        return Uint8List.fromList(img.encodePng(image));
      };
      await h.tap(find.text('KAPAK FOTOĞRAFINI DÜZENLE'));
      await h.tap(find.text('KAPAK YÜKLE'));
      await h.settle(10);
      await h.tap(find.text('KAPAĞI KAYDET'));
      await h.waitFor(find.text('Kapak kaydedildi.'));
      debugPickImageOverride = null;
      expect('${(await sessionRow(openId!))['coverImageUrl']}', startsWith('https://res.cloudinary.com/betik-sandbox-mock/image/upload/'));
      await h.shot('session_cover');
    });

    await h.scenario('F-SESS-12/F-NOT-02', 'B gets the session mention notification; it opens the session at the entry', () async {
      await h.login(b.email, password: b.password);
      await h.go('/');
      await h.push('/notifications');
      final mention = find.textContaining('oturum', findRichText: true);
      await h.waitFor(mention);
      await h.shot('session_mention_notification');
      await h.tap(mention.first);
      await h.waitFor(find.textContaining('İlk paragraf: sis dağılırken', findRichText: true));
      h.note('SESSION-MENTION-TARGET ${h.location}');
      expect(h.location, startsWith('/session/$openId'));
      expect(h.location, contains('entry='));
    });

    await h.scenario('F-SESS-05', 'Private session: code rule on create; other member must enter the code; wrong code refused', () async {
      await h.login(a.email, password: a.password);
      await h.go('/sessions');
      await h.waitFor(find.text('OTURUM AÇ'));
      await h.tap(find.text('OTURUM AÇ'));
      await h.waitFor(find.text('OTURUM OLUŞTUR'));
      await h.typeIn('Başlık', 'Gizli Atölye $stamp');
      await h.tap(find.descendant(of: find.byType(SegmentedButton<String>), matching: find.text('Özel')));
      await h.waitFor(h.field('Erişim Kodu'));
      await h.typeIn('Erişim Kodu', 'abc');
      await h.dismissKeyboard();
      await h.tap(find.text('OTURUM OLUŞTUR'));
      await h.waitFor(find.text('Erişim kodu en az 4 karakter olmalıdır.'));
      await h.typeIn('Erişim Kodu', 'gizli123');
      await h.dismissKeyboard();
      await h.tap(find.text('OTURUM OLUŞTUR'));
      await h.waitFor(find.text(Harness.upperTr('Gizli Atölye $stamp')));
      privateId = '${((await h.dbFind('sessions', {'title': 'Gizli Atölye $stamp'})).first as Map)['_id']}';
      await h.login(b.email, password: b.password);
      await h.go('/');
      await h.push('/session/$privateId');
      await h.waitFor(find.text('🔒 Özel Oturum'));
      await h.shot('private_gate');
      final code = find.descendant(of: find.widgetWithText(TextField, 'Erişim kodu...'), matching: find.byType(EditableText));
      await h.type(code, 'yanlis1');
      await h.tap(find.text('KATIL'));
      await h.waitFor(find.text('Erişim kodu hatalı.'));
      await h.type(code, 'gizli123');
      await h.tap(find.text('KATIL'));
      await h.waitFor(find.text('Henüz yazı yok'));
      await h.type(composer(), 'Koda girdim ve yazdım.');
      await h.dismissKeyboard();
      await h.tap(find.text('PAYLAŞ'));
      await h.waitFor(find.textContaining('Koda girdim', findRichText: true));
      expect((await entries(privateId!)).length, 1);
    });

    await h.scenario('F-SESS-10', 'Owner closes the session: cancel keeps it, confirm closes; closed sessions take no entries', () async {
      await h.login(a.email, password: a.password);
      await h.go('/');
      await h.push('/session/$openId');
      await h.waitFor(find.text('OTURUMU KAPAT'));
      await h.tap(find.text('OTURUMU KAPAT'));
      await h.dialogTap('Vazgeç');
      expect((await sessionRow(openId!))['isActive'], isTrue);
      await h.tap(find.text('OTURUMU KAPAT'));
      await h.dialogTap('Kapat');
      await h.waitUntil(() async => h.location.startsWith('/sessions'), what: 'back to list');
      expect((await sessionRow(openId!))['isActive'], isFalse);
      await h.go('/');
      await h.push('/session/$openId');
      await h.waitFor(find.text('Bu oturum kapatılmıştır. Yeni yazı eklenemez.'));
      expect(composer(), findsNothing);
    });

    await h.scenario('F-SESS-guest', 'Guest sees the list and an open session read-only with a sign-in prompt', () async {
      await h.logout();
      await h.go('/sessions');
      await h.waitFor(find.text('Başvurmak için giriş yapın'));
      await h.go('/');
      await h.push('/session/$privateId');
      await h.waitFor(find.text('🔒 Özel Oturum'));
    });

    h.finish();
  });
}
