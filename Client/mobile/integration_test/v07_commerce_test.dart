// Verification batch 7 — printed catalogue (submit, admin review, rating,
// shelf, page quote, author claim), print application, admin approval with
// PDFs, sandbox campaign, mock checkout (success, failure, cancel),
// history, admin refund and order handling, publisher catalogue.
import 'dart:convert';

import 'package:betik/features/funding/funding_shared.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:material_ui/material_ui.dart';

import 'support/content.dart';
import 'support/harness.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('printed books, print funding, checkout, publisher', (tester) async {
    final h = Harness(tester, binding, 'commerce');
    await h.start();
    final stamp = DateTime.now().millisecondsSinceEpoch.toString().substring(7);
    late TestUser supporter;
    late TestUser claimant;
    String? printedId;
    late TestBook book;
    String? applicationId;
    String? campaignId;

    Future<Map> row(String collection, String id) async => (await h.dbFind(collection, {'_id': Harness.oid(id)})).first as Map;
    Future<Uint8List> pdf(String name) async => base64Decode(await h.ctl('pdf', {'name': name}) as String);
    Finder ours(Finder f) => find.descendant(
      of: find.ancestor(of: find.text('Basım Doğrulama $stamp'), matching: find.byType(PanelCard)),
      matching: f,
    );
    Future<void> typeInOurs(String label, String text) => h.type(ours(h.field(label)), text);
    Finder inPanel(String marker, Finder f) => find.descendant(
      of: find.ancestor(of: find.textContaining(marker), matching: find.byType(PanelCard)).first,
      matching: f,
    );

    await h.scenario('SETUP', 'Register supporter and claimant; author completes a published book', () async {
      supporter = await registerUser(h, 'cs');
      claimant = await registerUser(h, 'cc');
      book = await createPublishedBook(h, 'Basım Doğrulama $stamp');
      final api = await h.apiAs(authorEmail);
      await setBookStatus(api, book.id, 'COMPLETED');
      api.close();
    });

    // ------------------------------------------------------------ printed
    await h.login(supporter.email, password: supporter.password);

    await h.scenario('F-PRINTED-02/03', 'Submit a printed book: client rules, server accepts, listed as under review', () async {
      await h.go('/');
      await h.push('/printed-books');
      await h.tap(find.text('BASILI KİTAP EKLE'));
      await h.waitFor(find.text('Basılı kitap ekle'));
      await h.typeIn('ISBN', '123');
      await h.tap(find.text('ISBN İLE BUL'));
      await h.settle(6);
      await h.shot('printed_isbn_invalid');
      h.note('ISBN-INVALID-VISIBLE ${h.visibleTexts(12)}');
      await h.typeIn('ISBN', '');
      await h.reveal(find.text('İNCELEME İSTEĞİ GÖNDER'));
      await h.tap(find.text('İNCELEME İSTEĞİ GÖNDER'));
      await h.settle(4);
      expect(
        h.hasContaining('Kitap adı zorunludur') || h.hasContaining('Yayın kanıtı bağlantısı zorunludur'),
        isTrue,
        reason: h.visibleTexts(),
      );
      await h.typeIn('Kitap adı', 'Basılı Doğrulama Romanı $stamp');
      await h.typeIn('Yazar', 'Basılı Yazar');
      await h.typeIn('Yayınevi', 'Sandbox Yayınları');
      await h.typeIn('Basım yılı', '2021');
      await h.typeIn('Sayfa sayısı', '240');
      await h.typeIn('Açıklama', 'Mobil uygulamadan eklenen basılı kitap doğrulama kaydı, yirmi karakterden uzun.');
      await h.typeIn('Yayın kanıtı bağlantısı', 'http://kanit.invalid/kitap');
      await h.dismissKeyboard();
      final format = find.text('Seçin');
      if (format.evaluate().isNotEmpty) {
        await h.tap(format);
        await h.tap(find.text('Roman').last, scroll: false);
      }
      final chips = find.byType(FilterChip);
      await h.reveal(chips);
      await h.tap(chips.first);
      await h.tap(find.text('İNCELEME İSTEĞİ GÖNDER'));
      await h.waitFor(find.textContaining('https:// ile başlamalıdır'));
      await h.typeIn('Yayın kanıtı bağlantısı', 'https://kanit.invalid/kitap');
      await h.dismissKeyboard();
      await h.tap(find.text('İNCELEME İSTEĞİ GÖNDER'));
      await h.settle(10);
      h.note('PRINTED-SUBMIT ${h.visibleTexts(80)}');
      await h.shot('printed_submit_result');
      await h.reveal(find.textContaining('İsteğiniz Betik\'e iletildi'));
      final rows = await h.dbFind('books', {'title': 'Basılı Doğrulama Romanı $stamp'});
      expect(rows.length, 1);
      printedId = '${(rows.first as Map)['_id']}';
      expect((rows.first as Map)['publicationStatus'], 'PENDING');
      await h.go('/');
      await h.push('/printed-books');
      await h.waitFor(find.textContaining('Basılı Kitap Katkılarım'));
      await h.tap(find.textContaining('Basılı Kitap Katkılarım'));
      await h.waitFor(find.text('İncelemede'));
      await h.shot('printed_my_submissions');
    });

    await h.scenario('F-ADM-05a', 'Admin approves the printed book in the review queue', () async {
      await h.login(adminEmail);
      await h.go('/');
      await h.push('/admin/printed-books');
      await h.waitFor(find.textContaining('Basılı Doğrulama Romanı $stamp'));
      await h.shot('admin_printed_queue');
      await h.tap(inPanel('Basılı Doğrulama Romanı $stamp', find.text('ONAYLA')));
      await h.settle(4);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(() async => (await row('books', printedId!))['publicationStatus'] == 'APPROVED', what: 'printed approved');
    });

    await h.scenario('F-PRINTED-01/04/05', 'Catalogue lists the book; detail; rate and review; update; remove; add again', () async {
      await h.login(supporter.email, password: supporter.password);
      await h.go('/');
      await h.push('/printed-books');
      final search = find.descendant(
        of: find.widgetWithText(TextField, 'Kitap, yazar, yayınevi veya ISBN ara'),
        matching: find.byType(EditableText),
      );
      await h.type(search, 'Basılı Doğrulama Romanı $stamp');
      await h.dismissKeyboard();
      await h.waitFor(find.text('1 basılı eser'));
      await h.tap(find.text('Basılı Doğrulama Romanı $stamp').last);
      await h.waitFor(find.text('Okudum ve değerlendirdim'));
      expect(find.text('Sandbox Yayınları'), findsWidgets);
      await h.reveal(find.text('OKUDUM, KİTAPLIĞIMA EKLE'));
      await h.tap(find.text('OKUDUM, KİTAPLIĞIMA EKLE'));
      await h.waitFor(find.text('Lütfen 1–5 arasında bir puan seçin.'));
      await h.tap(find.byIcon(Icons.star_border).at(3));
      final review = find.descendant(
        of: find.widgetWithText(TextField, 'Değerlendirmeniz (isteğe bağlı)'),
        matching: find.byType(EditableText),
      );
      await h.type(review, 'Akıcı ve güçlü bir roman.');
      await h.dismissKeyboard();
      await h.tap(find.text('OKUDUM, KİTAPLIĞIMA EKLE'));
      await h.waitFor(find.text('Değerlendirmeniz kaydedildi.'));
      final reading =
          (await h.dbFind('printedbookreadings', {'bookId': Harness.oid(printedId!), 'userId': Harness.oid(supporter.id)})).first as Map;
      expect(reading['rating'], 4);
      await h.shot('printed_review');
      await h.tap(find.text('Okuduklarımdan kaldır'));
      await h.waitFor(find.text('Okuduklarınızdan kaldırıldı.'));
      expect(
        await h.dbCount('printedbookreadings', {
          'bookId': Harness.oid(printedId!),
          'userId': Harness.oid(supporter.id),
          'isDeleted': {r'$ne': true},
        }),
        0,
      );
      await h.tap(find.byIcon(Icons.star_border).at(4));
      await h.tap(find.text('OKUDUM, KİTAPLIĞIMA EKLE'));
      await h.waitFor(find.text('Değerlendirmeniz kaydedildi.'));
    });

    await h.scenario('F-QUOTE-09', 'Quote from the printed book with a page number (range checked)', () async {
      await h.reveal(find.text('ALINTIYI PAYLAŞ'));
      await h.typeIn('Kısa alıntı', 'Basılı kitaptan sayfa numaralı alıntı.');
      await h.typeIn('Sayfa numarası', '999');
      await h.dismissKeyboard();
      await h.tap(find.text('ALINTIYI PAYLAŞ'));
      await h.waitFor(find.text('Sayfa numarası 1 ile 240 arasında olmalıdır.'));
      await h.typeIn('Sayfa numarası', '42');
      await h.dismissKeyboard();
      await h.tap(find.text('ALINTIYI PAYLAŞ'));
      await h.waitFor(find.text('Alıntınız kaydedildi.'));
      final quote = (await h.dbFind('quotes', {'bookId': Harness.oid(printedId!), 'userId': Harness.oid(supporter.id)})).first as Map;
      expect(quote['pageNumber'], 42);
      await h.waitFor(find.textContaining('Sayfa 42'));
    });

    await h.scenario('F-PRINTED-06', 'Printed shelf on the profile lists the rated book', () async {
      await h.go('/profile?tab=printed');
      await h.waitFor(find.text('1 basılı kitap okundu'));
      expect(find.text('Basılı Doğrulama Romanı $stamp'), findsOneWidget);
      await h.shot('printed_shelf');
    });

    await h.scenario('F-PRINTED-07/F-ADM-05b', 'Author claim: validation, submit, admin approves, claimant gets chapter tools', () async {
      await h.login(claimant.email, password: claimant.password);
      await h.go('/');
      await h.push('/book/$printedId');
      await h.tap(find.text('Bu kitabın yazarı mısınız? Hak talebinde bulunun'));
      await h.typeIn('Hak talebi açıklaması', 'kısa');
      await h.dismissKeyboard();
      await h.tap(find.text('HAK TALEBİNİ GÖNDER'));
      await h.waitFor(find.text('Hak talebi açıklaması 20–3000 karakter olmalıdır.'));
      await h.typeIn('Hak talebi açıklaması', 'Bu kitabın yazarıyım; yayınevi sözleşmemi paylaşabilirim.');
      await h.dismissKeyboard();
      await h.tap(find.text('HAK TALEBİNİ GÖNDER'));
      await h.waitFor(find.textContaining('Yazar hak talebiniz inceleniyor'));
      await h.login(adminEmail);
      await h.go('/');
      await h.push('/admin/printed-books');
      await h.waitFor(find.text('Yazar hak talepleri'));
      await h.tap(inPanel('@${claimant.username}', find.text('ONAYLA')));
      await h.settle(4);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(
        () async => await h.dbCount('bookclaims', {'status': 'APPROVED', 'claimantId': Harness.oid(claimant.id)}) == 1,
        what: 'claim approved',
      );
      await h.login(claimant.email, password: claimant.password);
      await h.go('/');
      await h.push('/book/$printedId');
      await h.waitFor(find.text('Bölüm ekle / düzenle'));
      await h.shot('claim_approved');
    });

    // ------------------------------------------------------------ print funding
    await h.scenario('F-FUND-06/11', 'Author: print application form, cover PDF upload, save frozen version, submit', () async {
      debugPickPdfOverride = () async => ('kapak.pdf', await pdf('cover'));
      await h.login(authorEmail);
      await h.go('/');
      await h.push('/print/${book.id}');
      await h.waitFor(find.text('Basım için başvur'));
      final save = find.text('BASIM SÜRÜMÜNÜ SABİTLE VE BAŞVURUYU KAYDET');
      await h.reveal(save);
      expect(
        tester.widget<ButtonStyleButton>(find.ancestor(of: save, matching: find.bySubtype<ButtonStyleButton>()).first).onPressed,
        isNull,
      );
      if (find.text('Tarife seçin').evaluate().isNotEmpty) {
        await h.tap(find.text('Tarife seçin'));
        await h.tap(find.textContaining('docker-development-v1').last, scroll: false);
      }
      await h.tap(find.text('PDF SEÇ VE YÜKLE'));
      await h.waitFor(find.textContaining('Özel dosya:'));
      for (final declaration in ['Eserin hak sahibiyim', 'Alıntı, görsel', 'Başvurunun yönetici']) {
        await h.tap(find.textContaining(declaration));
      }
      await h.shot('print_application_form');
      await h.tap(save);
      await h.waitUntil(() async => await h.dbCount('printapplications', {'bookId': Harness.oid(book.id)}) == 1, what: 'application saved');
      await h.settle(6);
      await h.reveal(find.text('BAŞVURUYU İNCELEMEYE GÖNDER'));
      expect(find.textContaining('SHA-256:'), findsWidgets);
      final app = (await h.dbFind('printapplications', {'bookId': Harness.oid(book.id)})).first as Map;
      applicationId = '${app['_id']}';
      expect(app['state'], 'PREPARING');
      await h.shot('print_application_saved');
      await h.tap(find.text('BAŞVURUYU İNCELEMEYE GÖNDER'));
      await h.settle(4);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(() async => (await row('printapplications', applicationId!))['state'] == 'SUBMITTED', what: 'submitted');
      debugPickPdfOverride = null;
    });

    await h.scenario('F-ADM-07', 'Admin approves with quote, confirmed pages, two PDFs and verified amounts', () async {
      await h.login(adminEmail);
      await h.go('/');
      await h.push('/admin/print-funding');
      await h.waitFor(find.text('BAŞVURULARI YENİLE'));
      // Earlier runs left other applications in the queue: act only inside
      // this run's card.
      await h.reveal(ours(find.text('YÖNETİCİ KARARI')));
      await h.tap(ours(find.text('Revizyon iste')));
      await h.tap(find.text('Onayla').last, scroll: false);
      await typeInOurs('İnceleme gerekçesi', 'Mobil doğrulama onayı.');
      await typeInOurs('Matbaa / yayınevi teklif referansı', 'TEKLIF-001');
      await typeInOurs('Mizanpajdan doğrulanmış kesin sayfa', '120');
      var n = 0;
      debugPickPdfOverride = () async => (n++ == 0 ? 'mizanpaj.pdf' : 'teklif.pdf', await pdf(n == 1 ? 'layout' : 'quote'));
      await h.tap(ours(find.text('PDF SEÇ VE YÜKLE')).first);
      await h.waitFor(ours(find.textContaining('Özel dosya:')));
      await h.tap(ours(find.text('PDF SEÇ VE YÜKLE')).first);
      await h.waitUntil(() async => ours(find.textContaining('Özel dosya:')).evaluate().length == 2, what: 'second PDF');
      const costs = {
        'Matbaa üretimi': '3000', 'Kargo': '500', 'Paketleme': '200', 'Vergi': '400', //
        'Ödeme giderleri': '100', 'Yayın hizmetleri': '300', 'Diğer zorunlu giderler': '0',
      };
      for (final entry in costs.entries) {
        await typeInOurs(entry.key, entry.value);
      }
      const sale = {
        'Birim üretim': '30', 'Birim kargo': '5', 'Birim paketleme': '2', 'Birim vergi': '4', //
        'Birim ödeme gideri': '1', 'Birim hizmet': '3', 'Satış payı': '5',
      };
      for (final entry in sale.entries) {
        await typeInOurs(entry.key, entry.value);
      }
      await h.dismissKeyboard();
      await h.tap(ours(find.textContaining('Son metni, mizanpaj sayfalarını')));
      await h.shot('admin_approve_form');
      await h.tap(ours(find.text('KARARI KAYDET')));
      await h.waitUntil(
        () async => (await row('printapplications', applicationId!))['state'] == 'APPROVED',
        what: 'application approved',
        timeout: const Duration(seconds: 20),
      );
      debugPickPdfOverride = null;
      final app = await row('printapplications', applicationId!);
      h.note('APPROVED target=${app['approvedTargetMinor']} unit=${app['approvedUnitPriceMinor']}');
      expect(app['approvedTargetMinor'], 450000);
      expect(app['approvedUnitPriceMinor'], 5000);
    });

    await h.scenario('F-ADM-08', 'Admin opens the sandbox campaign (confirmation required)', () async {
      await h.settle(6);
      // Approved applications of earlier runs stay in the sandbox list above ours.
      await h.reveal(ours(find.text('ONAYLI SANDBOX KAMPANYASINI AÇ')), maxSteps: 200);
      expect(
        tester
            .widget<ButtonStyleButton>(
              find.ancestor(of: ours(find.text('ONAYLI SANDBOX KAMPANYASINI AÇ')), matching: find.bySubtype<ButtonStyleButton>()).first,
            )
            .onPressed,
        isNull,
      );
      await h.tap(ours(find.textContaining('Onaylı sürüm, hedef ve satış fiyatıyla')));
      await h.tap(ours(find.text('ONAYLI SANDBOX KAMPANYASINI AÇ')));
      await h.waitUntil(
        () async => await h.dbCount('fundingcampaigns', {'bookId': Harness.oid(book.id), 'state': 'ACTIVE'}) == 1,
        what: 'campaign active',
      );
      campaignId = '${((await h.dbFind('fundingcampaigns', {'bookId': Harness.oid(book.id)})).first as Map)['_id']}';
    });

    await h.scenario('F-FUND-01/02', 'Book detail shows the campaign card and the support link; free interest toggles', () async {
      await h.login(supporter.email, password: supporter.password);
      await h.go('/');
      await h.push('/book/${book.id}');
      await h.reveal(find.text('DESTEK VE ÖN SİPARİŞ SEÇENEKLERİ →'));
      expect(find.text('Kampanya açık'), findsWidgets);
      await h.shot('book_campaign_card');
      await h.reveal(find.text('BASILMASINI İSTİYORUM'));
      await h.tap(find.text('BASILMASINI İSTİYORUM'));
      await h.waitFor(find.text('BASIM İLGİMİ GERİ ÇEK'));
      expect(await h.dbCount('printinterests', {'bookId': Harness.oid(book.id), 'userId': Harness.oid(supporter.id)}), 1);
      await h.tap(find.text('BASIM İLGİMİ GERİ ÇEK'));
      await h.waitFor(find.text('BASILMASINI İSTİYORUM'));
    });

    await h.scenario(
      'F-FUND-03/04/09',
      'Checkout: 1 copy + 100 TL, address, consents → reservation (amount in kuruş, idempotency key) → simulated success',
      () async {
        await h.reveal(find.text('DESTEK VE ÖN SİPARİŞ SEÇENEKLERİ →'));
        await h.tap(find.text('DESTEK VE ÖN SİPARİŞ SEÇENEKLERİ →'));
        await h.waitFor(find.text('Sepet'));
        await h.tap(find.byTooltip('Artır'));
        await h.typeIn('İlave karşılıksız destek (TL)', '100');
        final fields = {
          'Alıcı adı soyadı': 'Destekçi Doğrulama',
          'Telefon': '05550000000',
          'İl': 'İstanbul',
          'İlçe': 'Kadıköy',
          'Posta kodu': '34710',
          'Açık adres': 'Sandbox Sokak No 1',
        };
        for (final entry in fields.entries) {
          await h.typeIn(entry.key, entry.value);
        }
        await h.dismissKeyboard();
        await h.tap(find.textContaining('Teslimat bilgilerimin sipariş'));
        await h.tap(find.textContaining('Sepetin tam bedeline'));
        await h.waitFor(find.textContaining('Sepet toplamı: ₺150,00'));
        await h.shot('checkout_filled');
        await h.tap(find.text('TEST ÖDEME REZERVASYONU OLUŞTUR'));
        await h.waitFor(find.text('TEST ÖDEMESİNİ BAŞARILI SONUÇLANDIR'), timeout: const Duration(seconds: 20));
        final payment = (await h.dbFind('fundingpayments', {'userId': Harness.oid(supporter.id)})).first as Map;
        h.note('PAYMENT ${jsonEncode(payment).substring(0, 400)}');
        expect(payment['amountMinor'], 15000);
        expect(payment['donationMinor'], 10000);
        expect('${payment['idempotencyKey'] ?? payment['clientKey'] ?? ''}'.isNotEmpty, isTrue);
        await h.shot('checkout_reserved');
        await h.tap(find.text('TEST ÖDEMESİNİ BAŞARILI SONUÇLANDIR'));
        await h.waitUntil(
          () async => ((await h.dbFind('fundingpayments', {'userId': Harness.oid(supporter.id)})).first as Map)['state'] == 'CAPTURED',
          what: 'captured',
        );
        await h.waitFor(find.text('Test ödemesi doğrulandı'));
        await h.shot('checkout_captured');
      },
    );

    await h.scenario('F-FUND-04f/10', 'New basket: failed payment; another: cancelled from history', () async {
      await h.tap(find.text('YENİ TEST İŞLEMİ HAZIRLA'));
      await h.waitFor(find.text('Sepet'));
      await h.typeIn('İlave karşılıksız destek (TL)', '50');
      await h.dismissKeyboard();
      await h.tap(find.textContaining('Sepetin tam bedeline'));
      await h.tap(find.text('TEST ÖDEME REZERVASYONU OLUŞTUR'));
      await h.waitFor(find.text('BAŞARISIZ ÖDEME DENE'));
      await h.tap(find.text('BAŞARISIZ ÖDEME DENE'));
      await h.waitUntil(
        () async => await h.dbCount('fundingpayments', {'userId': Harness.oid(supporter.id), 'state': 'FAILED'}) == 1,
        what: 'failed payment',
      );
      await h.tap(find.text('YENİ TEST İŞLEMİ HAZIRLA'));
      await h.typeIn('İlave karşılıksız destek (TL)', '75');
      await h.dismissKeyboard();
      await h.tap(find.textContaining('Sepetin tam bedeline'));
      await h.tap(find.text('TEST ÖDEME REZERVASYONU OLUŞTUR'));
      await h.waitFor(find.text('BAŞARISIZ ÖDEME DENE'));
      await h.go('/');
      await h.push('/funding-history');
      await h.waitFor(find.text('Desteklerim ve ön siparişlerim'));
      await h.reveal(find.text('Ödemeyi iptal et'));
      await h.shot('history_pending');
      await h.tap(find.text('Ödemeyi iptal et'));
      await h.settle(4);
      if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
      await h.waitUntil(
        () async => await h.dbCount('fundingpayments', {'userId': Harness.oid(supporter.id), 'state': 'CANCELLED'}) == 1,
        what: 'cancelled payment',
      );
    });

    await h.scenario('F-FUND-05', 'Funding history lists captured, failed and cancelled payments with their states', () async {
      await h.go('/');
      await h.push('/funding-history');
      await h.waitFor(find.text('Test ödemesi doğrulandı'));
      expect(find.text('Başarısız'), findsWidgets);
      expect(find.text('İptal edildi'), findsWidgets);
      expect(find.textContaining('₺150,00'), findsWidgets);
      await h.shot('history_states');
    });

    await h.scenario(
      'F-ADM-10a/12',
      'Admin: full refund of a captured payment while the campaign is active; maintenance run; supporter sees "İade edildi"',
      () async {
        await h.login(adminEmail);
        await h.go('/');
        await h.push('/admin/print-funding');
        await h.tap(find.text('ÖDEME, İADE VE TESLİMAT'));
        await h.reveal(find.text('Ön sipariş ve teslimat'));
        await h.shot('admin_payments');
        // The list holds every run's payments: act on this run's captured payment.
        final payment = (await h.dbFind('fundingpayments', {'userId': Harness.oid(supporter.id), 'state': 'CAPTURED'})).first as Map;
        Finder card(String marker, Finder f) => find.descendant(
          of: find.ancestor(of: find.textContaining(marker), matching: find.byType(PanelCard)),
          matching: f,
        );
        final paymentId = 'Ödeme: ${payment['_id']}';
        await h.reveal(find.text(paymentId));
        await h.type(card(paymentId, h.field('Tam iade gerekçesi')), 'Mobil doğrulama iadesi.');
        await h.dismissKeyboard();
        await h.tap(card(paymentId, find.text('TAM İADE İSTE')));
        await h.settle(4);
        if (find.byType(AlertDialog).evaluate().isNotEmpty) await h.dialogTap('Onayla');
        await h.waitUntil(
          () async => await h.dbCount('fundingrefunds', {'paymentId': Harness.oid('${payment['_id']}')}) > 0,
          what: 'refund requested',
        );
        await h.tap(find.text('KAMPANYA VE ÜRETİM'));
        await h.reveal(find.text('UZLAŞTIRMA VE İADE İŞLERİNİ ŞİMDİ ÇALIŞTIR'));
        await h.tap(find.text('UZLAŞTIRMA VE İADE İŞLERİNİ ŞİMDİ ÇALIŞTIR'));
        await h.waitUntil(
          () async => ((await h.dbFind('fundingpayments', {'_id': Harness.oid('${payment['_id']}')})).first as Map)['state'] == 'REFUNDED',
          what: 'refunded',
          timeout: const Duration(seconds: 25),
        );
        await h.login(supporter.email, password: supporter.password);
        await h.go('/');
        await h.push('/funding-history');
        await h.waitFor(find.text('İade edildi'));
        await h.shot('history_refunded');
      },
    );

    await h.scenario(
      'F-ADM-09/10b',
      'Target reached → maintenance settles the campaign (SUCCEEDED) → admin steps production to PRINTED → pre-order CONFIRMED → PACKAGING',
      () async {
        // Setup (checkout UI already verified above): a second supporter fills the exact remaining target.
        final second = await registerUser(h, 'c2');
        final campaign = await row('fundingcampaigns', campaignId!);
        final remaining =
            (campaign['targetMinor'] as num).toInt() -
            (campaign['acceptedMinor'] as num).toInt() -
            ((campaign['reservedMinor'] as num?) ?? 0).toInt();
        h.note('FILL remaining=$remaining');
        final api = await h.apiAs(second.email, password: second.password);
        final started = await api.run(
          r'mutation($input: PrintCheckoutInput!) { startPrintCheckout(input: $input) { id state } }',
          variables: {
            'input': {
              'campaignId': campaignId,
              'idempotencyKey': 'verify-fill-$stamp',
              'quantity': 1,
              'donationMinor': remaining - 5000,
              'shippingAddress': {
                'fullName': 'İkinci Destekçi',
                'phone': '05550000001',
                'city': 'İzmir',
                'district': 'Konak',
                'postalCode': '35250',
                'line': 'Sandbox Cad. 2',
                'consent': true,
              },
            },
          },
        );
        final secondPayment = (started['startPrintCheckout'] as Map)['id'] as String;
        await api.run(
          r'mutation($paymentId: ID!, $outcome: String!) { simulatePrintPayment(paymentId: $paymentId, outcome: $outcome) { id state } }',
          variables: {'paymentId': secondPayment, 'outcome': 'CAPTURED'},
        );
        api.close();
        // Admin: maintenance settles the campaign.
        await h.login(adminEmail);
        await h.go('/');
        await h.push('/admin/print-funding');
        await h.tap(find.text('KAMPANYA VE ÜRETİM'));
        await h.reveal(find.text('UZLAŞTIRMA VE İADE İŞLERİNİ ŞİMDİ ÇALIŞTIR'));
        await h.tap(find.text('UZLAŞTIRMA VE İADE İŞLERİNİ ŞİMDİ ÇALIŞTIR'));
        await h.waitUntil(
          () async => (await row('fundingcampaigns', campaignId!))['state'] == 'SUCCEEDED',
          what: 'campaign succeeded',
          timeout: const Duration(seconds: 25),
        );
        // Production PREPARATION → PRINTER_APPROVED → STARTED → PRINTING → PRINTED through the app.
        Finder ourCampaign(Finder f) => find.descendant(
          of: find.ancestor(of: find.textContaining('Kampanya: $campaignId'), matching: find.byType(PanelCard)),
          matching: f,
        );
        for (final next in const ['PRINTER_APPROVED', 'STARTED', 'PRINTING', 'PRINTED']) {
          await h.go('/');
          await h.push('/admin/print-funding');
          await h.tap(find.text('KAMPANYA VE ÜRETİM'));
          await h.reveal(find.textContaining('Kampanya: $campaignId'));
          await h.type(ourCampaign(h.field('İşlem / güncelleme gerekçesi')), 'Üretim adımı: $next');
          await h.dismissKeyboard();
          await h.tap(ourCampaign(find.text('ÜRETİM DURUMUNU KAYDET')));
          await h.waitUntil(() async => (await row('fundingcampaigns', campaignId!))['productionState'] == next, what: 'production $next');
        }
        await h.shot('production_printed');
        // The second supporter's pre-order → PACKAGING.
        final order = (await h.dbFind('printpreorders', {'paymentId': Harness.oid(secondPayment)})).first as Map;
        final orderId = '${order['_id']}';
        h.note('ORDER $orderId state=${order['state']}');
        Finder orderCard(Finder f) => find.descendant(
          of: find.ancestor(of: find.textContaining(orderId), matching: find.byType(PanelCard)),
          matching: f,
        );
        await h.go('/');
        await h.push('/admin/print-funding');
        await h.tap(find.text('ÖDEME, İADE VE TESLİMAT'));
        await h.reveal(find.textContaining(orderId));
        await h.type(orderCard(h.field('Güncelleme açıklaması')), 'Paketleme başladı.');
        await h.dismissKeyboard();
        await h.tap(orderCard(find.text('SİPARİŞİ GÜNCELLE')));
        await h.waitUntil(() async => (await row('printpreorders', orderId))['state'] == 'PACKAGING', what: 'order packaging');
        await h.shot('order_packaging');
      },
    );

    await h.scenario('F-ADM-11', 'Admin creates a new sample tariff version', () async {
      await h.login(adminEmail);
      await h.go('/');
      await h.push('/admin/print-funding');
      await h.tap(find.text('FİYAT TARİFELERİ'));
      await h.waitFor(find.text('Yeni örnek tarife sürümü'));
      await h.typeIn('Sürüm adı', 'mobil-dogrulama-$stamp');
      const prices = {
        'Enzo sayfa başı': '1', 'Ivory sayfa başı': '1', 'Kuşe sayfa başı': '2', 'Karton kapak başı': '10', //
        'Sert kapak başı': '20',
        'Sabit hazırlık': '100',
        'Kitap başı paketleme': '10',
        'Kitap başı kargo': '10',
        'Toplam yayın hizmeti': '100',
      };
      for (final entry in prices.entries) {
        await h.typeIn(entry.key, entry.value);
      }
      await h.dismissKeyboard();
      await h.tap(find.text('ÖRNEK TARİFE SÜRÜMÜNÜ OLUŞTUR'));
      await h.settle(8);
      h.note('TARIFF-CREATE ${h.visibleTexts(30)}');
      await h.waitUntil(() async => await h.dbCount('printtariffs', {'version': 'mobil-dogrulama-$stamp'}) == 1, what: 'tariff created');
    });

    await h.scenario('F-ADM-08a', 'Campaign audit trail lists settlement and production steps', () async {
      await h.login(adminEmail);
      await h.go('/');
      await h.push('/admin/print-funding');
      await h.tap(find.text('KAMPANYA VE ÜRETİM'));
      final audit = find.descendant(
        of: find.ancestor(of: find.textContaining('Kampanya: $campaignId'), matching: find.byType(PanelCard)),
        matching: find.text('Denetim geçmişi'),
      );
      await h.reveal(audit);
      await h.tap(audit);
      await h.settle(8);
      await h.reveal(find.textContaining('CAMPAIGN_SETTLED'));
      expect(find.textContaining('PRODUCTION_UPDATED'), findsWidgets);
      await h.shot('campaign_audit');
    });

    await h.scenario('F-PUB-01', 'Publisher catalogue: publisher sees books and campaign filter; member is redirected', () async {
      await h.login(publisherEmail);
      await h.go('/publisher');
      await h.waitFor(find.textContaining(' kitap'));
      await h.shot('publisher_catalog');
      final search = find.descendant(of: find.widgetWithText(TextField, 'Kitap veya yazar ara'), matching: find.byType(EditableText));
      await h.type(search, 'Basım Doğrulama $stamp');
      await h.tap(find.text('ARA'));
      await h.waitFor(find.textContaining('Basım Doğrulama $stamp'));
      await h.login(supporter.email, password: supporter.password);
      await h.go('/publisher');
      await h.settle(4);
      expect(h.location, '/');
    });

    await h.logout();
    h.finish();
  });
}
