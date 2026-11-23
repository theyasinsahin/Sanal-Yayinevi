import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';

// Print funding is **sandbox only**: the backend has no live payment mode
// (`environment` is always SANDBOX; iyzico is restricted to its sandbox
// host). Every surface says so. All money is integer kuruş (`MinorAmount`).

const campaignFields = '''
id bookId authorId applicationId versionId title environment state outcome
targetMinor acceptedMinor reservedMinor availableMinor unitPriceMinor
printRun soldQuantity reservedQuantity supporterCount progressPercent startsAt endsAt
productionState previousProductionState productionRevision financeIssue policy
updates { id state message createdAt }''';

const applicationFields = '''
id bookId authorId revision state tariffId estimate verifiedQuote approvedTargetMinor approvedUnitPriceMinor reviewNote createdAt updatedAt
version { classificationReview id title authorName wordCount estimatedPages contentHash specification declarations }''';

const orderFields =
    'id paymentId campaignId quantity unitPriceMinor totalMinor state previousState revision carrier trackingNumber createdAt';

const paymentFields =
    '''
id campaignId bookId provider checkoutUrl amountMinor donationMinor orderMinor quantity currency state allocated captured issue createdAt
reservation { state expiresAt }
order { $orderFields }
refund { id paymentId amountMinor reason state attempts lastError retryAt providerRefundId }''';

const printOverviewQuery =
    '''
query PrintOverview(\$bookId: ID!) {
  printPaymentMode
  printOverview(bookId: \$bookId) { bookId digitalStatus writingStatus interestCount interested campaign { $campaignFields } }
}''';

const statusNames = {
  'PREPARING': 'Başvuru hazırlanıyor', 'SUBMITTED': 'İncelemede', 'REVISION_REQUESTED': 'Revizyon istendi', //
  'APPROVED': 'Onaylandı', 'REJECTED': 'Reddedildi',
  'ACTIVE': 'Kampanya açık', 'CLOSING': 'Kapanıyor / Uzlaştırılıyor', 'SUCCEEDED': 'Başarıyla tamamlandı',
  'FAILED': 'Başarısız', 'CANCELLED': 'İptal edildi',
  'REFUNDING': 'İadeler sürüyor', 'REFUND_PENDING': 'İade bekleniyor', 'REFUNDED': 'İade edildi',
  'PENDING': 'Bekliyor', 'CREATED': 'Ödeme hazırlanıyor', 'CAPTURED': 'Test ödemesi doğrulandı',
  'NOT_STARTED': 'Üretim başlamadı', 'PREPARATION': 'Basım hazırlığında', 'PRINTER_APPROVED': 'Matbaa onayladı',
  'STARTED': 'Üretim başladı', 'PRINTING': 'Baskıda', 'PRINTED': 'Baskı tamamlandı',
  'PACKAGING': 'Paketleniyor', 'SHIPPING': 'Dağıtımda', 'SHIPPED': 'Kargoya verildi', 'DELIVERED': 'Teslim edildi',
  'COMPLETED': 'Tamamlandı', 'ISSUE': 'Sorun / Gecikme', 'AWAITING_PAYMENT': 'Ödeme bekleniyor',
  'CONFIRMED': 'Ön sipariş onaylandı', 'PROCESSING': 'İşleniyor', 'HELD': 'Rezerve', 'CONSUMED': 'Kullanıldı',
  'EXPIRED': 'Süresi doldu', 'RELEASED': 'Serbest bırakıldı',
};

String statusName(Object? value) => statusNames[value] ?? '${value ?? ''}';

class StatusPill extends StatelessWidget {
  const StatusPill(this.value, {super.key});
  final Object? value;

  @override
  Widget build(BuildContext context) {
    final state = '$value';
    final (background, foreground) = switch (state) {
      'APPROVED' ||
      'ACTIVE' ||
      'SUCCEEDED' ||
      'CAPTURED' ||
      'DELIVERED' ||
      'COMPLETED' ||
      'CONFIRMED' ||
      'REFUNDED' => (BetikColors.successBg, BetikColors.success),
      'REJECTED' || 'FAILED' || 'CANCELLED' || 'ISSUE' || 'EXPIRED' => (const Color(0xFFFDF2F2), BetikColors.danger),
      _ => (BetikColors.sepiaLight, BetikColors.rust),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: foreground),
      ),
      child: Text(
        statusName(value),
        style: sans(size: 11.5, weight: FontWeight.w700, color: foreground),
      ),
    );
  }
}

/// Client-generated idempotency key for `startPrintCheckout`
/// (16–100 chars of `[A-Za-z0-9_-]`): a random UUID v4, like the website's
/// `crypto.randomUUID()`.
String newCheckoutKey([Random? random]) {
  final source = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => source.nextInt(256));
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;
  final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Only iyzico's sandbox hosts are ever opened (same check as the web's
/// `PaymentCard`).
String? safeCheckoutUrl(Object? value) {
  if (value is! String) return null;
  final uri = Uri.tryParse(value);
  if (uri == null || uri.scheme != 'https' || uri.userInfo.isNotEmpty || uri.hasPort) return null;
  return const {'sandbox-cpp.iyzipay.com', 'sandbox-api.iyzipay.com'}.contains(uri.host) ? uri.toString() : null;
}

class PanelCard extends StatelessWidget {
  const PanelCard({super.key, required this.children, this.title, this.trailing});
  final String? title;
  final Widget? trailing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: PaperCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null || trailing != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(title ?? '', style: serif(size: 17, weight: FontWeight.w700)),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
          ...children,
        ],
      ),
    ),
  );
}

class StatGrid extends StatelessWidget {
  const StatGrid(this.entries, {super.key});
  final List<(String, String)> entries;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 18,
    runSpacing: 10,
    children: [
      for (final (title, value) in entries)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, style: sans(size: 11.5, color: BetikColors.ashGray)),
            Text(value, style: sans(size: 14, weight: FontWeight.w700)),
          ],
        ),
    ],
  );
}

class CampaignCard extends StatelessWidget {
  const CampaignCard(this.campaign, {super.key});
  final Json campaign;

  @override
  Widget build(BuildContext context) {
    final c = campaign;
    final target = jsonInt(c['targetMinor']);
    final accepted = jsonInt(c['acceptedMinor']);
    final updates = jsonList(c['updates']);
    return PanelCard(
      title: jsonString(c['title']),
      trailing: StatusPill(c['state']),
      children: [
        const SandboxNotice(),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: target <= 0 ? 0 : (accepted / target).clamp(0, 1).toDouble(), minHeight: 8),
        ),
        const SizedBox(height: 6),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: formatMoney(accepted),
                style: sans(size: 15, weight: FontWeight.w700),
              ),
              TextSpan(text: ' / ${formatMoney(target)} · %${jsonDouble(c['progressPercent']).toStringAsFixed(1)}', style: sans(size: 14)),
            ],
          ),
        ),
        const SizedBox(height: 10),
        StatGrid([
          ('Ödeme için ayrılan', formatMoney(c['reservedMinor'])),
          ('Kabul edilebilir kalan', formatMoney(c['availableMinor'])),
          ('Destekçi', '${jsonInt(c['supporterCount'])}'),
          ('Kitap satış fiyatı', formatMoney(c['unitPriceMinor'])),
        ]),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              '${formatDate(parseApiDate(c['startsAt']))} – ${formatDateTime(parseApiDate(c['endsAt']))}',
              style: sans(size: 12.5, color: BetikColors.graphite),
            ),
            StatusPill(c['productionState']),
          ],
        ),
        if (jsonString(c['financeIssue']).isNotEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Notice('Finansal uzlaştırma inceleme gerektiriyor; operasyon ekibine bildirildi.', error: true),
          ),
        if (updates.isNotEmpty)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text('Basım ve kampanya güncellemeleri', style: sans(size: 13.5, weight: FontWeight.w600)),
            children: [
              for (final update in updates)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    '${update['state'] == null ? '' : '${statusName(update['state'])} · '}${jsonString(update['message'])}',
                    style: sans(size: 13),
                  ),
                  subtitle: Text(formatDateTime(parseApiDate(update['createdAt']))),
                ),
            ],
          ),
      ],
    );
  }
}

class Notice extends StatelessWidget {
  const Notice(this.text, {super.key, this.error = false});
  final String text;
  final bool error;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: error ? const Color(0xFFFDF2F2) : BetikColors.sepiaLight,
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: error ? BetikColors.danger : BetikColors.borderHeavy),
    ),
    child: Text(text, style: sans(size: 13, color: error ? BetikColors.danger : BetikColors.graphite, height: 1.4)),
  );
}

const costLabels = {
  'printingMinor': 'Matbaa üretimi', 'shippingMinor': 'Kargo', 'packagingMinor': 'Paketleme', 'taxMinor': 'Vergi', //
  'providerFeeMinor': 'Ödeme giderleri', 'serviceMinor': 'Yayın hizmetleri', 'otherMinor': 'Diğer giderler',
  'unitProductionMinor': 'Birim üretim', 'unitShippingMinor': 'Birim kargo', 'unitPackagingMinor': 'Birim paketleme',
  'unitTaxMinor': 'Birim vergi', 'unitFeeMinor': 'Birim ödeme gideri', 'unitServiceMinor': 'Birim hizmet',
  'unitMarginMinor': 'Satış payı',
};

class CostBreakdown extends StatelessWidget {
  const CostBreakdown(this.value, {super.key});
  final Object? value;
  @override
  Widget build(BuildContext context) {
    final map = jsonMap(value);
    if (map == null) return const SizedBox.shrink();
    return StatGrid([
      for (final entry in map.entries)
        if (entry.value is num) (costLabels[entry.key] ?? entry.key, formatMoney(entry.value)),
    ]);
  }
}

/// Runs a mutation with user feedback; returns its data or null on failure.
Future<Json?> runPrintAction(BuildContext context, String document, Json variables, {String success = 'İşlem kaydedildi.'}) async {
  try {
    final data = await context.services.api.run(document, variables: variables);
    if (context.mounted && success.isNotEmpty) showToast(context, success, type: ToastType.success);
    return data;
  } catch (error) {
    if (context.mounted) showError(context, error);
    return null;
  }
}

/// Payment card (F-FUND-04, F-FUND-10): state, breakdown, reservation,
/// order, refund, and the provider-specific actions for pending payments.
class PaymentCard extends StatelessWidget {
  const PaymentCard({super.key, required this.payment, required this.mode, required this.onChanged, this.showLinks = true});
  final Json payment;
  final String mode;
  final Future<void> Function() onChanged;
  final bool showLinks;

  @override
  Widget build(BuildContext context) {
    final p = payment;
    final state = jsonString(p['state']);
    final pending = state == 'CREATED' || state == 'PENDING';
    final provider = jsonString(p['provider']);
    final reservation = jsonMap(p['reservation']);
    final order = jsonMap(p['order']);
    final refund = jsonMap(p['refund']);
    final checkoutUrl = safeCheckoutUrl(p['checkoutUrl']);

    Future<void> act(String document, Json variables) async {
      if (await runPrintAction(context, document, variables) != null) await onChanged();
    }

    const simulate =
        'mutation SimulatePrintPayment(\$paymentId: ID!, \$outcome: String!) { simulatePrintPayment(paymentId: \$paymentId, outcome: \$outcome) { id state } }';
    const cancel = 'mutation CancelPrintPayment(\$paymentId: ID!) { cancelPrintPayment(paymentId: \$paymentId) { id state } }';

    return PanelCard(
      title: formatMoney(p['amountMinor']),
      trailing: StatusPill(state),
      children: [
        Text('SANDBOX · Bu kayıt gerçek para hareketi değildir.', style: label(size: 11, color: BetikColors.rust)),
        const SizedBox(height: 8),
        if (jsonString(p['issue']).isNotEmpty)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Notice('Ödeme sağlayıcı kaydıyla uyuşmuyor. Operasyon incelemesi gerekiyor.', error: true),
          ),
        SelectableText(
          'İşlem: ${p['id']} · ${formatDateTime(parseApiDate(p['createdAt']))}',
          style: sans(size: 12, color: BetikColors.ashGray),
        ),
        const SizedBox(height: 4),
        Text(
          'Karşılıksız destek: ${formatMoney(p['donationMinor'])} · Ön sipariş: ${jsonInt(p['quantity'])} kitap / ${formatMoney(p['orderMinor'])}',
          style: sans(size: 13),
        ),
        if (reservation != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Wrap(
              spacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('Rezervasyon:', style: sans(size: 13)),
                StatusPill(reservation['state']),
                Text(formatDateTime(parseApiDate(reservation['expiresAt'])), style: sans(size: 12.5, color: BetikColors.ashGray)),
              ],
            ),
          ),
        if (order != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Ön sipariş', style: sans(size: 13.5, weight: FontWeight.w700)),
                    const SizedBox(width: 8),
                    StatusPill(order['state']),
                  ],
                ),
                if (jsonString(order['carrier']).isNotEmpty)
                  Text('${order['carrier']} · Takip: ${order['trackingNumber'] ?? ''}', style: sans(size: 13)),
                SelectableText('Sipariş: ${order['id']}', style: sans(size: 12, color: BetikColors.ashGray)),
              ],
            ),
          ),
        if (refund != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('İade', style: sans(size: 13.5, weight: FontWeight.w700)),
                    const SizedBox(width: 8),
                    StatusPill(refund['state']),
                  ],
                ),
                Text('${formatMoney(refund['amountMinor'])} · ${jsonString(refund['reason'])}', style: sans(size: 13)),
                if (refund['state'] == 'FAILED')
                  Text('İade henüz tamamlanamadı. Operasyon ekibi yeniden deneyecek.', style: sans(size: 13, color: BetikColors.danger)),
              ],
            ),
          ),
        if (mode == 'IYZICO_SANDBOX' && provider == 'IYZICO_SANDBOX' && pending) ...[
          const SizedBox(height: 10),
          Text(
            'Kart bilgilerinizi iyzico\'nun güvenli test ödeme sayfasında girin. Yalnızca iyzico test kartları kullanılır.',
            style: sans(size: 13),
          ),
          const SizedBox(height: 8),
          if (checkoutUrl != null)
            FilledButton(
              // The hosted page is a third-party payment form: it opens in an
              // in-app browser tab, never in an app-owned WebView. iyzico's
              // return redirect targets the website; the user closes the tab
              // and the state below is refreshed from the API.
              onPressed: () async {
                await launchUrl(Uri.parse(checkoutUrl), mode: LaunchMode.inAppBrowserView);
                await onChanged();
              },
              child: const Text('İYZİCO İLE TEST KARTIYLA ÖDE'),
            )
          else
            Text('iyzico ödeme sayfası hazırlanıyor. Ödeme durumunu yeniden kontrol edin.', style: sans(size: 13)),
          Wrap(
            spacing: 8,
            children: [
              OutlinedButton(onPressed: onChanged, child: const Text('ÖDEME DURUMUNU GÜNCELLE')),
              TextButton(onPressed: () => act(cancel, {'paymentId': p['id']}), child: const Text('Ödemeyi iptal et')),
            ],
          ),
        ],
        if (mode == 'SANDBOX' && provider == 'SANDBOX' && pending) ...[
          const SizedBox(height: 10),
          Text('Test sağlayıcısında bir sonuç seçin. Kart bilgisi girmeyin.', style: sans(size: 13)),
          const SizedBox(height: 8),
          BusyButton(
            expand: true,
            label: 'Test ödemesini başarılı sonuçlandır',
            onPressed: () => act(simulate, {'paymentId': p['id'], 'outcome': 'CAPTURED'}),
          ),
          const SizedBox(height: 6),
          BusyButton(
            expand: true,
            outlined: true,
            label: 'Başarısız ödeme dene',
            onPressed: () => act(simulate, {'paymentId': p['id'], 'outcome': 'FAILED'}),
          ),
          TextButton(onPressed: () => act(cancel, {'paymentId': p['id']}), child: const Text('Ödemeyi iptal et')),
        ],
        if (showLinks)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Wrap(
              spacing: 8,
              children: [TextButton(onPressed: () => context.push('/book/${p['bookId']}'), child: const Text('Kitaba dön'))],
            ),
          ),
      ],
    );
  }
}

// --- PDF assets (REST companions of the print workspace) ---------------------

/// Picks a PDF (≤10 MB) and uploads it with `POST /api/print/assets`
/// (raw body, `Content-Type: application/pdf`, `X-Filename`). Returns the
/// asset id, or null when the user cancels.
/// Test seam: replaces the system document picker (which no widget test can
/// drive) with a (file name, bytes) pair. Validation and upload below are
/// the production path.
@visibleForTesting
Future<(String, Uint8List)?> Function()? debugPickPdfOverride;

Future<(String, Uint8List)?> _pickPdf() async {
  final override = debugPickPdfOverride;
  if (override != null) return override();
  final file = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: const ['pdf']);
  if (file == null) return null;
  return (file.name, await file.xFile.readAsBytes());
}

Future<String?> pickAndUploadPdf(BuildContext context) async {
  final picked = await _pickPdf();
  if (picked == null || !context.mounted) return null;
  final (fileName, bytes) = picked;
  if (!context.mounted) return null;
  if (bytes.length > 10 * 1024 * 1024) {
    if (context.mounted) showToast(context, 'PDF en fazla 10 MB olmalı.', type: ToastType.error);
    return null;
  }
  // The server checks the same signature; fail early with a clear message.
  if (bytes.length < 5 || String.fromCharCodes(bytes.sublist(0, 5)) != '%PDF-') {
    if (context.mounted) showToast(context, 'Seçilen dosya geçerli bir PDF değil.', type: ToastType.error);
    return null;
  }
  try {
    final response = await context.services.api.rawRequest(
      'POST',
      '/api/print/assets',
      headers: {'Content-Type': 'application/pdf', 'X-Filename': Uri.encodeComponent(fileName)},
      body: bytes,
    );
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    final id = decoded is Map ? decoded['id'] : null;
    if (id is! String) throw ApiException(ApiErrorKind.server, 'Dosya yüklenemedi.');
    return id;
  } on ApiException catch (error) {
    if (context.mounted) showToast(context, error.message.isEmpty ? 'Dosya yüklenemedi.' : error.message, type: ToastType.error);
    return null;
  }
}

/// Downloads `GET /api/print/assets/:id` and hands the file to the system
/// share sheet (save to Files, open in a viewer…). The website saves it as
/// `baski-belgesi.pdf`.
Future<void> downloadPrintAsset(BuildContext context, String id) async {
  try {
    final response = await context.services.api.rawRequest('GET', '/api/print/assets/$id');
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/baski-belgesi.pdf');
    await file.writeAsBytes(response.bodyBytes);
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'application/pdf')]));
  } on ApiException {
    if (context.mounted) showToast(context, 'Dosya indirilemedi veya erişim yetkiniz yok.', type: ToastType.error);
  }
}

class PdfUploadField extends StatelessWidget {
  const PdfUploadField({super.key, required this.label, required this.value, required this.onChanged, this.enabled = true});
  final String label;
  final String? value;
  final ValueChanged<String> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) => LabeledField(
    label: label,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        BusyButton(
          outlined: true,
          icon: Icons.upload_file,
          label: value == null ? 'PDF seç ve yükle' : 'PDF değiştir',
          onPressed: !enabled
              ? null
              : () async {
                  final id = await pickAndUploadPdf(context);
                  if (id != null) onChanged(id);
                },
        ),
        if (value != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('Özel dosya: $value', style: sans(size: 12, color: BetikColors.ashGray)),
          ),
      ],
    ),
  );
}

/// Funding panel on the book detail page (F-FUND-01): free interest toggle,
/// campaign card and link to the checkout. Polls every 30 s.
class BookFundingPanel extends StatelessWidget {
  const BookFundingPanel({super.key, required this.bookId});
  final String bookId;

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return Loader<Json>(
      pollEvery: const Duration(seconds: 30),
      load: () => services.api.run(printOverviewQuery, variables: {'bookId': bookId}),
      loadingLabel: 'Basım bilgileri yükleniyor…',
      errorBuilder: (context, error, retry) => Notice(errorMessage(error), error: true),
      builder: (context, data, loader) {
        final overview = jsonMap(data['printOverview']) ?? const {};
        final mode = jsonString(data['printPaymentMode']);
        final campaign = jsonMap(overview['campaign']);
        final interested = overview['interested'] == true;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PanelCard(
              title: 'Bu kitabın basılmasını istiyorum',
              children: [
                Text(
                  '${jsonInt(overview['interestCount'])} okur basılı kitabı görmek istiyor. Bu ücretsiz ilgi bildirimi ödeme veya teslimat hakkı oluşturmaz.',
                  style: sans(size: 13.5, height: 1.45),
                ),
                const SizedBox(height: 10),
                if (services.auth.isSignedIn)
                  BusyButton(
                    outlined: true,
                    label: interested ? 'Basım ilgimi geri çek' : 'Basılmasını istiyorum',
                    onPressed: overview['digitalStatus'] != 'PUBLISHED'
                        ? null
                        : () async {
                            final result = await runPrintAction(
                              context,
                              'mutation SetPrintInterest(\$bookId: ID!, \$interested: Boolean!) { setPrintInterest(bookId: \$bookId, interested: \$interested) }',
                              {'bookId': bookId, 'interested': !interested},
                            );
                            if (result != null) await loader.reload(silent: true);
                          },
                  )
                else
                  OutlinedButton(onPressed: () => context.push('/login'), child: const Text('İLGİ BİLDİRMEK İÇİN GİRİŞ YAP')),
              ],
            ),
            if (campaign != null) ...[
              CampaignCard(campaign),
              if (campaign['state'] == 'ACTIVE')
                mode == 'SANDBOX' || mode == 'IYZICO_SANDBOX'
                    ? OutlinedButton(
                        onPressed: () => context.push('/donate/$bookId'),
                        child: const Text('DESTEK VE ÖN SİPARİŞ SEÇENEKLERİ →'),
                      )
                    : const Notice('Kampanya oluşturuldu. Ödemeler ve ön sipariş işlemleri kapalıdır.'),
            ] else
              const Notice('Bu kitap için henüz onaylı basım kampanyası yok.'),
          ],
        );
      },
    );
  }
}
