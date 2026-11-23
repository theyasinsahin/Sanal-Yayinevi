// Verification batch 5 — profile, follow, notifications, messaging, quotes,
// settings and account lifecycle. Uses two disposable registered accounts.
import 'package:betik/core/app_services.dart';
import 'package:betik/core/auth/session.dart';
import 'package:betik/features/quotes/quote_card.dart';
import 'package:betik/features/reader/html_view.dart';
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

  testWidgets('social, settings, account', (tester) async {
    final h = Harness(tester, binding, 'social');
    await h.start();
    late TestUser a;
    late TestUser b;
    late TestBook book;
    late String quoteId;
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(7);
    final quoteText = 'Sisli sabah alıntısı $stamp ile doğrulanır.';

    Future<Map> userRow(String id) async => (await h.dbFind('users', {'_id': Harness.oid(id)})).first as Map;
    Future<void> openTab(String label) async {
      final chip = find.widgetWithText(ChoiceChip, Harness.upperTr(label));
      await h.reveal(chip);
      await h.tap(chip);
    }

    Future<void> openSettings(String section) async {
      await h.go('/profile?tab=settings');
      await h.settle(6);
      await h.reveal(find.widgetWithText(ChoiceChip, 'HESAP'));
      await openTab(section);
    }

    await h.scenario('SETUP', 'Register two disposable members, publish a book, author quotes it', () async {
      a = await registerUser(h, 'va');
      b = await registerUser(h, 'vb');
      book = await createPublishedBook(h, 'Sosyal Doğrulama $stamp');
      final api = await h.apiAs(a.email, password: a.password);
      quoteId = await createQuoteRaw(api, book.id, book.chapterIds[0], quoteText, note: 'A kullanıcısının notu');
      api.close();
    });

    await h.login(a.email, password: a.password);

    await h.scenario('F-PROF-01/02', 'Own profile: edit name, bio, avatar (upload); username rule enforced', () async {
      await h.go('/profile');
      await h.waitFor(find.text('@${a.username}'));
      await h.tap(find.text('DÜZENLE'));
      await h.waitFor(find.text('Profili Düzenle'));
      await h.typeIn('Kullanıcı Adı', 'x');
      await h.tap(find.text('KAYDET'));
      await h.waitFor(find.textContaining('Kullanıcı adı 3–50 karakter'));
      await h.typeIn('Kullanıcı Adı', a.username);
      await h.typeIn('Ad Soyad', 'Ayşe Doğrulama Çiçek');
      await h.typeIn('Hakkımda', 'Mobilde güncellenen biyografi. Şiir ve öykü okurum.');
      debugPickImageOverride = () async {
        final image = img.Image(width: 500, height: 400);
        img.fill(image, color: img.ColorRgb8(40, 90, 160));
        return Uint8List.fromList(img.encodePng(image));
      };
      await h.tap(find.text('RESİM YÜKLE'));
      await h.waitUntil(() async => ((await h.ctl('uploads')) as List).isNotEmpty, what: 'avatar upload');
      await h.settle(6);
      debugPickImageOverride = null;
      await h.shot('profile_edit');
      await h.dismissKeyboard();
      await h.tap(find.text('KAYDET'));
      await h.waitFor(find.text('Profil başarıyla güncellendi.'));
      final row = await userRow(a.id);
      expect(row['fullName'], 'Ayşe Doğrulama Çiçek');
      expect(row['bio'], contains('Mobilde güncellenen'));
      expect('${row['profilePicture']}', startsWith('https://res.cloudinary.com/betik-sandbox-mock/'));
      await h.waitFor(find.text('Ayşe Doğrulama Çiçek'));
    });

    await h.scenario('F-PROF-05', 'Share profile copies the profile share link', () async {
      await h.go('/profile');
      await h.tap(find.text('PROFİLİ PAYLAŞ'));
      await h.waitFor(find.text('Bağlantıyı kopyala'));
      await h.tap(find.text('Bağlantıyı kopyala'), scroll: false);
      await h.settle(3);
      expect(await clipboardText(), contains('/share/profile/'));
      await h.closeOverlays();
    });

    await h.scenario('F-PROF-07', 'Profile quotes tab groups quotes by book', () async {
      await h.go('/profile?tab=quotes');
      await h.waitFor(find.text('PROFİLİ PAYLAŞ'));
      await h.reveal(find.textContaining('/ 1 alıntı'));
      expect(find.textContaining('Sosyal Doğrulama $stamp'), findsWidgets);
      expect(find.textContaining(quoteText, findRichText: true), findsOneWidget);
      await h.shot('profile_quotes');
    });

    await h.scenario(
      'F-SET-03',
      'Privacy: private profile + messages closed → saved; another member sees the restricted profile',
      () async {
        await openSettings('Gizlilik');
        await h.waitFor(find.text('Herkese Açık Profil'));
        await h.tap(find.text('Herkese Açık Profil'));
        await h.tap(find.text('Kimse'));
        await h.shot('settings_privacy');
        await h.tap(find.text('KAYDET'));
        await h.waitFor(find.text('Gizlilik ayarları kaydedildi.'));
        final privacy = (await userRow(a.id))['privacySettings'] as Map;
        expect(privacy['isProfilePublic'], isFalse);
        expect(privacy['allowMessages'], 'none');
        await h.login(b.email, password: b.password);
        await h.go('/');
        await h.push('/user/${a.id}');
        await h.waitFor(find.text('Bu profil yalnızca takipçilere açık.'));
        expect(find.text('Bu kullanıcı mesaj almayı sınırlandırmış.'), findsWidgets);
        await h.shot('private_profile_as_other');
        // Revert as A.
        await h.login(a.email, password: a.password);
        await openSettings('Gizlilik');
        await h.waitFor(find.text('Herkese Açık Profil'));
        await h.tap(find.text('Herkese Açık Profil'));
        await h.tap(find.text('Herkes'));
        await h.tap(find.text('KAYDET'));
        await h.waitFor(find.text('Gizlilik ayarları kaydedildi.'));
        expect(((await userRow(a.id))['privacySettings'] as Map)['isProfilePublic'], isTrue);
      },
    );

    await h.scenario('F-SET-04', 'Notification preferences: toggle one flag, save, stored; save button only when changed', () async {
      await openSettings('Bildirimler');
      await h.waitFor(find.text('Kitaba Beğeni'));
      expect(find.text('KAYDET'), findsNothing);
      await h.tap(find.text('Kitaba Beğeni'));
      await h.tap(find.text('KAYDET'));
      await h.waitFor(find.text('Bildirim tercihleri kaydedildi.'));
      expect(((await userRow(a.id))['notificationSettings'] as Map)['bookLike'], isFalse);
    });

    await h.scenario('F-SET-05', 'Author settings: invalid weekly goal refused, valid values saved', () async {
      await openSettings('Yazar');
      await h.waitFor(h.field('Telif Notu'));
      await h.typeIn('Telif Notu', 'Yayıneviyle e-posta üzerinden iletişim tercih ederim.');
      await h.typeIn('Haftalık Kelime Hedefi', '-5');
      await h.dismissKeyboard();
      await h.tap(find.text('KAYDET'));
      await h.waitFor(find.text('Kelime hedefi sıfır veya pozitif bir tam sayı olmalı.'));
      await h.typeIn('Haftalık Kelime Hedefi', '5000');
      await h.dismissKeyboard();
      await h.tap(find.byType(FilterChip).first);
      await h.tap(find.text('KAYDET'));
      await h.waitFor(find.text('Yazar ayarları kaydedildi.'));
      final author = (await userRow(a.id))['authorSettings'] as Map;
      expect(author['weeklyWordGoal'], 5000);
      expect(author['copyrightNote'], contains('e-posta'));
      expect((author['preferredGenres'] as List).length, 1);
    });

    await h.scenario('F-SET-06/F-NAV-11', 'Appearance: large reading size saved on the device and used by the reader', () async {
      await openSettings('Görünüm');
      await h.waitFor(find.textContaining('Büyük (20 px)'));
      await h.tap(find.textContaining('Büyük (20 px)'));
      await h.tap(find.text('KAYDET'));
      await h.waitFor(find.text('Okuma yazı boyutu kaydedildi.'));
      expect(h.services.readingPreferences.size, 'lg');
      expect(h.services.local.getString('app_font_size'), 'lg');
      await h.go('/');
      await h.push('/reader/${book.id}');
      await h.waitFor(find.textContaining('Paragraf sıfır', findRichText: true));
      expect(tester.widget<HtmlBlock>(find.byType(HtmlBlock).first).fontSize, 20);
      await h.shot('reader_large_font');
      await h.back();
      await openSettings('Görünüm');
      await h.tap(find.textContaining('Orta (18 px)'));
      await h.tap(find.text('KAYDET'));
      await h.waitFor(find.text('Okuma yazı boyutu kaydedildi.'));
    });

    await h.scenario('F-FOLLOW-01', 'B sends a follow request, withdraws it, sends it again', () async {
      await h.login(b.email, password: b.password);
      await h.go('/');
      await h.push('/user/${a.id}');
      await h.waitFor(find.text('TAKİP İSTEĞİ GÖNDER'));
      await h.tap(find.text('TAKİP İSTEĞİ GÖNDER'));
      await h.waitFor(find.text('İSTEĞİ GERİ ÇEK'));
      expect(find.text('Takip isteği onay bekliyor.'), findsOneWidget);
      expect(await h.dbCount('followrequests', {'requesterId': Harness.oid(b.id), 'status': 'PENDING'}), 1);
      await h.tap(find.text('İSTEĞİ GERİ ÇEK'));
      await h.waitFor(find.text('TAKİP İSTEĞİ GÖNDER'));
      expect(await h.dbCount('followrequests', {'requesterId': Harness.oid(b.id), 'status': 'PENDING'}), 0);
      await h.tap(find.text('TAKİP İSTEĞİ GÖNDER'));
      await h.waitFor(find.text('İSTEĞİ GERİ ÇEK'));
    });

    await h.scenario('F-NOT-03/F-FOLLOW-02', 'A rejects in the notifications panel; B asks again; A accepts → B follows A', () async {
      await h.login(a.email, password: a.password);
      await h.go('/');
      await h.push('/notifications');
      await h.waitFor(find.text('Takip İstekleri (1)'));
      await h.shot('follow_request_panel');
      await h.tap(find.text('REDDET'));
      await h.waitFor(find.text('Onay bekleyen takip isteği yok.'));
      expect(await h.dbCount('followrequests', {'requesterId': Harness.oid(b.id), 'status': 'PENDING'}), 0);
      final apiB = await h.apiAs(b.email, password: b.password);
      await apiB.run(r'mutation($id: ID!) { requestFollowUser(targetId: $id) { code } }', variables: {'id': a.id});
      apiB.close();
      await h.back();
      await h.push('/notifications');
      await h.waitFor(find.text('KABUL ET'));
      await h.tap(find.text('KABUL ET'));
      await h.waitFor(find.text('Onay bekleyen takip isteği yok.'));
      final followers = ((await userRow(a.id))['followers'] as List).map((e) => '$e');
      expect(followers, contains(b.id));
    });

    await h.scenario('F-FOLLOW-03', 'B is notified that the request was accepted; tapping opens A\'s profile', () async {
      await h.login(b.email, password: b.password);
      await h.go('/');
      await h.push('/notifications');
      await h.waitFor(find.textContaining('kabul', findRichText: true));
      await h.shot('follow_accepted_notification');
      await h.tap(find.textContaining('kabul', findRichText: true).first);
      await h.waitFor(find.text('@${a.username}'));
      expect(h.location, '/user/${a.id}');
      expect(find.text('TAKİBİ BIRAK'), findsOneWidget);
    });

    await h.scenario('F-PROF-04/F-MSG-02/03/04', 'B messages A from the profile: chat opens, send, stored, A sees unread', () async {
      await h.tap(find.text('MESAJ GÖNDER'));
      await h.waitFor(find.text('Henüz mesaj yok. Bir şeyler yaz!'));
      final input = find.descendant(of: find.widgetWithText(TextField, 'Mesaj yaz...'), matching: find.byType(EditableText));
      await h.type(input, 'Merhaba A, mobil uygulamadan selam! 👋');
      await h.tap(find.byTooltip('Gönder'), scroll: false);
      await h.waitFor(find.text('Merhaba A, mobil uygulamadan selam! 👋'));
      await h.waitGone(find.text('Gönderiliyor...'));
      expect(await h.dbCount('messages', {'sender': Harness.oid(b.id)}) + await h.dbCount('messages', {'senderId': Harness.oid(b.id)}), 1);
      await h.shot('chat_sent');
    });

    await h.scenario('F-MSG-05', 'Real-time: a message A sends arrives in B\'s open chat without refreshing', () async {
      final apiA = await h.apiAs(a.email, password: a.password);
      final conv = await apiA.run(r'query($id: ID!) { getOrCreateConversation(recipientId: $id) { id } }', variables: {'id': b.id});
      await apiA.run(
        r'mutation($input: SendMessageInput!) { sendMessage(input: $input) { id } }',
        variables: {
          'input': {'conversationId': (conv['getOrCreateConversation'] as Map)['id'], 'content': 'Canlı yanıt geldi', 'type': 'TEXT'},
        },
      );
      apiA.close();
      await h.waitFor(find.text('Canlı yanıt geldi'), timeout: const Duration(seconds: 10));
      await h.shot('chat_live');
    });

    await h.scenario('F-MSG-06', 'Delete own message from the bubble menu', () async {
      await h.tap(find.byTooltip('Mesaj seçenekleri').first, scroll: false);
      await h.tap(find.text('Sil').last, scroll: false);
      await h.waitGone(find.text('Merhaba A, mobil uygulamadan selam! 👋'));
    });

    await h.scenario('F-MSG-01/08/09', 'Share the book into the conversation; book bubble opens the book; list shows preview', () async {
      await h.go('/');
      await h.push('/book/${book.id}');
      await h.waitFor(find.text('KİTABI OKU'));
      await h.tap(find.byTooltip('Kitabı paylaş'), scroll: false);
      await h.tap(find.text('Betik’te mesajla gönder'), scroll: false);
      await h.waitFor(find.text('Kitabı paylaş'));
      await h.waitFor(find.descendant(of: find.byType(BottomSheet), matching: find.byType(ListTile)));
      await h.tap(find.descendant(of: find.byType(BottomSheet), matching: find.byType(ListTile)).first, scroll: false);
      await h.tap(find.text('GÖNDER').last, scroll: false);
      await h.waitFor(find.text('Gönderildi ✓'));
      await h.closeOverlays();
      await h.closeOverlays();
      await h.go('/');
      await h.push('/messages');
      await h.waitFor(find.textContaining('📖 Kitap paylaştı'));
      await h.shot('conversation_list');
      await h.tap(find.textContaining('📖 Kitap paylaştı'));
      await h.waitFor(find.text('Kitaba git →'));
      await h.shot('chat_book_bubble');
      await h.tap(find.text('Kitaba git →'));
      await h.waitFor(find.text('KİTABI OKU'));
    });

    await h.scenario('F-QUOTE-02/03/07', 'Search quotes, card content, open detail', () async {
      await h.go('/quotes');
      final search = find.descendant(
        of: find.widgetWithText(TextField, 'Alıntı, kitap veya yazar ara...'),
        matching: find.byType(EditableText),
      );
      await h.type(search, 'Sisli sabah alıntısı $stamp');
      await h.waitFor(find.textContaining(quoteText, findRichText: true));
      expect(find.byType(QuoteCard), findsOneWidget);
      expect(find.textContaining('A kullanıcısının notu', findRichText: true), findsOneWidget);
      await h.shot('quote_search');
      await h.dismissKeyboard();
      await h.go('/');
      await h.push('/quotes/$quoteId');
      await h.waitFor(find.textContaining(quoteText, findRichText: true));
      expect(find.text('Kitaptan bir satır'), findsOneWidget);
    });

    await h.scenario('F-QUOTE-04', 'Like / unlike a quote', () async {
      await h.tap(find.byIcon(Icons.favorite_border).first);
      await h.waitFor(find.byIcon(Icons.favorite));
      Future<List> likes() async => ((await h.dbFind('quotes', {'_id': Harness.oid(quoteId)})).first as Map)['likedBy'] as List;
      await h.waitUntil(() async => (await likes()).length == 1, what: 'quote liked');
      await h.tap(find.byIcon(Icons.favorite).first);
      await h.waitUntil(() async => (await likes()).isEmpty, what: 'quote unliked');
      await h.tap(find.byIcon(Icons.favorite_border).first);
      await h.waitUntil(() async => (await likes()).length == 1, what: 'quote liked again');
    });

    await h.scenario('F-QUOTE-06', 'Quote comments: add, count, delete', () async {
      await h.tap(find.byIcon(Icons.chat_bubble_outline).first);
      await h.waitFor(find.text('Henüz yorum yok. İlk yorumu sen yap!'));
      final input = find.descendant(of: find.widgetWithText(TextField, 'Yorum yaz...'), matching: find.byType(EditableText));
      await h.type(input, 'Alıntıya mobil yorum');
      await h.tap(find.byTooltip('Gönder'), scroll: false);
      await h.waitFor(find.textContaining('Alıntıya mobil yorum', findRichText: true));
      expect(await h.dbCount('quotecomments', {'quoteId': Harness.oid(quoteId)}), 1);
      await h.tap(find.byTooltip('Yorumu sil'));
      await h.waitUntil(
        () async =>
            await h.dbCount('quotecomments', {
              'quoteId': Harness.oid(quoteId),
              'isDeleted': {r'$ne': true},
            }) ==
            0,
        what: 'quote comment deleted',
      );
    });

    await h.scenario('F-QUOTE-05/10', 'Repost with a comment, appears in the feed as a repost; undo repost', () async {
      await h.tap(find.byIcon(Icons.repeat).first);
      final comment = find.descendant(of: find.widgetWithText(TextField, 'Yorum ekle (isteğe bağlı)'), matching: find.byType(EditableText));
      await h.waitFor(comment);
      await h.type(comment, 'Bunu herkes okumalı');
      await h.tap(find.text('YENİDEN PAYLAŞ'));
      await h.waitFor(find.text('Alıntı yeniden paylaşıldı.'));
      expect(
        await h.dbCount('quotes', {'originalQuote': Harness.oid(quoteId), 'isRepost': true}) +
            await h.dbCount('quotes', {'originalQuoteId': Harness.oid(quoteId), 'isRepost': true}),
        1,
      );
      await h.go('/');
      await h.push('/quotes/$quoteId');
      await h.waitFor(find.byIcon(Icons.repeat));
      await h.tap(find.byIcon(Icons.repeat).first);
      await h.settle(6);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(
        () async =>
            await h.dbCount('quotes', {
              'isRepost': true,
              'userId': Harness.oid(b.id),
              'isDeleted': {r'$ne': true},
            }) ==
            0,
        what: 'repost undone',
      );
    });

    await h.scenario('F-PROF-03/F-FOLLOW-04', 'A opens the followers list and removes B', () async {
      await h.login(a.email, password: a.password);
      await h.go('/profile');
      await h.waitFor(find.text('TAKİPÇİLER'));
      await h.tap(find.text('TAKİPÇİLER'));
      await h.waitFor(find.text('@${b.username}'));
      await h.shot('followers_sheet');
      await h.tap(find.text('Takipçiyi Çıkar'));
      await h.settle(6);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(
        () async => !((await userRow(a.id))['followers'] as List).map((e) => '$e').contains(b.id),
        what: 'follower removed',
      );
      await h.closeOverlays();
    });

    await h.scenario(
      'F-NOT-01/02',
      'Notifications list (like, comment-free), opening marks read, tapping a quote-like opens the quote',
      () async {
        await h.go('/');
        await h.push('/notifications');
        await h.waitFor(find.text('Bildirimler'));
        await h.settle(8);
        final like = find.textContaining('beğen', findRichText: true);
        await h.waitFor(like);
        await h.shot('notifications_a');
        await h.tap(like.first);
        await h.settle(6);
        h.note('NOTIFICATION-TARGET ${h.location}');
        expect(h.location, anyOf(startsWith('/quotes/'), startsWith('/book/')));
        expect(
          await h.dbCount('notifications', {'recipientId': Harness.oid(a.id), 'isRead': false}) +
              await h.dbCount('notifications', {'userId': Harness.oid(a.id), 'isRead': false}),
          0,
        );
      },
    );

    await h.scenario(
      'F-SET-02',
      'Change password: wrong current refused, mismatch caught, success signs out, new password works',
      () async {
        await openSettings('Hesap');
        await h.waitFor(h.field('Mevcut Şifre'));
        await h.typeIn('Mevcut Şifre', 'YanlisSifre!1');
        await h.typeIn('Yeni Şifre', 'Yepyeni!Sifre3');
        await h.typeIn('Yeni Şifre (Tekrar)', 'Yepyeni!Sifre3x');
        await h.dismissKeyboard();
        await h.tap(find.text('ŞİFREYİ GÜNCELLE'));
        await h.waitFor(find.text('Yeni şifreler eşleşmiyor.'));
        await h.typeIn('Yeni Şifre (Tekrar)', 'Yepyeni!Sifre3');
        await h.dismissKeyboard();
        await h.tap(find.text('ŞİFREYİ GÜNCELLE'));
        await h.settle(10);
        expect(h.services.auth.isSignedIn, isTrue, reason: 'wrong current password must not sign out');
        await h.shot('change_password_wrong_current');
        await h.typeIn('Mevcut Şifre', a.password);
        await h.dismissKeyboard();
        await h.tap(find.text('ŞİFREYİ GÜNCELLE'));
        await h.waitUntil(() async => !h.services.auth.isSignedIn, what: 'signed out after password change');
        a.password = 'Yepyeni!Sifre3';
        await h.login(a.email, password: a.password);
      },
    );

    await h.scenario('F-SET-01', 'Change e-mail: info mail, signed out, sign-in with the new address', () async {
      final newEmail = 'new_${a.username}@betik-dev.invalid';
      await openSettings('Hesap');
      await h.typeIn('Yeni E-posta', newEmail);
      await h.typeIn('E-posta için mevcut şifre', a.password);
      await h.dismissKeyboard();
      await h.tap(find.text('E-POSTAYI GÜNCELLE'));
      await h.waitUntil(() async => !h.services.auth.isSignedIn, what: 'signed out after e-mail change');
      expect((await userRow(a.id))['email'], newEmail);
      final mails = await h.latestMail(to: newEmail) ?? await h.latestMail(to: a.email);
      h.note('EMAIL-CHANGE-MAIL ${mails?['to']} | ${mails?['subject']}');
      a.email = newEmail;
      await h.login(a.email, password: a.password);
    });

    await h.scenario('F-SET-07', 'Deactivate (B): inline confirm, signed out, profile hidden from others, sign-in reactivates', () async {
      await h.login(b.email, password: b.password);
      await openSettings('Hesabı Sil');
      await h.tap(find.text('DEVRE DIŞI BIRAK'));
      await h.waitFor(find.textContaining('Emin misiniz?'));
      await h.shot('deactivate_confirm');
      await h.tap(find.text('EVET, DEVRE DIŞI BIRAK'));
      await h.waitUntil(() async => !h.services.auth.isSignedIn, what: 'signed out after deactivation');
      expect((await userRow(b.id))['isActive'], isFalse);
      await h.go('/');
      await h.push('/user/${b.id}');
      await h.waitFor(find.text('Kullanıcı Bulunamadı'));
      await h.login(b.email, password: b.password);
      expect((await userRow(b.id))['isActive'], isTrue);
    });

    await h.scenario('F-SET-08', 'Delete account (B): phrase required, deleted, sign-in refused', () async {
      await openSettings('Hesabı Sil');
      await h.tap(find.widgetWithText(OutlinedButton, 'HESABI SİL'));
      await h.reveal(find.text('KALICI OLARAK SİL'));
      final phrase = find.byType(EditableText).last;
      await h.type(phrase, 'hesabimi sil');
      final button = find.ancestor(of: find.text('KALICI OLARAK SİL'), matching: find.bySubtype<ButtonStyleButton>());
      expect(tester.widget<ButtonStyleButton>(button.first).onPressed, isNull);
      await h.type(phrase, 'hesabımı sil');
      await h.shot('delete_confirm');
      await h.tap(find.text('KALICI OLARAK SİL'));
      await h.waitUntil(() async => !h.services.auth.isSignedIn, what: 'signed out after deletion');
      final row = await h.dbFind('users', {'_id': Harness.oid(b.id)});
      expect(row.isEmpty || (row.first as Map)['isDeleted'] == true, isTrue);
      await h.go('/login');
      await h.typeIn('E-posta', b.email);
      await h.typeIn('Şifre', b.password);
      await h.tap(find.text('GİRİŞ YAP').last);
      await h.settle(10);
      expect(h.services.auth.isSignedIn, isFalse);
    });

    await h.scenario('F-AUTH-08', 'Session persists in the Keychain/Keystore across an app restart; logout clears it', () async {
      final store = SecureSessionStore();
      await store.clear();
      h.services = await AppServices.create(sessionStore: store, localStore: MemoryLocalStore());
      await h.restartWith(h.services);
      await h.login(a.email, password: a.password);
      expect(await store.read(), isNotNull);
      // "Restart": a new composition root reading the same secure storage.
      final restarted = await AppServices.create(sessionStore: SecureSessionStore(), localStore: MemoryLocalStore());
      await h.restartWith(restarted);
      expect(restarted.auth.isSignedIn, isTrue);
      await h.go('/profile');
      await h.waitFor(find.text('@${a.username}'));
      await h.logout();
      expect(await SecureSessionStore().read(), isNull);
    });

    await h.logout();
    h.finish();
  });
}
