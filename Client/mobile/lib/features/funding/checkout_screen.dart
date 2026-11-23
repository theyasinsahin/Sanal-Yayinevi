import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../shell/shell.dart';
import 'funding_shared.dart';

const _startCheckout =
    'mutation StartPrintCheckout(\$input: PrintCheckoutInput!) { startPrintCheckout(input: \$input) { $paymentFields } }';
const _myPayment = 'query MyFundingPayment(\$id: ID!) { myFundingPayment(id: \$id) { $paymentFields } }';

/// Basket total in kuruş: `unitPrice × quantity + donation`. Informational
/// only — "Kesin toplam sunucuda hesaplanır".
int basketTotalMinor({required int unitPriceMinor, required int quantity, required int donationMinor}) =>
    unitPriceMinor * quantity + donationMinor;

/// Destek ve kitap ön siparişi (F-FUND-03, F-FUND-04, F-FUND-09).
///
/// Sandbox only: the backend has no live payment mode. The request carries
/// a client-generated idempotency key that is created once per basket,
/// persisted per user + campaign and reused when the same request is
/// repeated, so a lost response can never create a second payment.
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, required this.bookId});
  final String bookId;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _loader = GlobalKey<LoaderState<Json>>();
  final _donation = TextEditingController(text: '50');
  final _address = {
    for (final field in const ['fullName', 'phone', 'city', 'district', 'postalCode', 'line']) field: TextEditingController(),
  };
  int _quantity = 0;
  bool _addressConsent = false;
  bool _accepted = false;
  bool _attempted = false;
  Json? _payment;
  String? _key;

  @override
  void dispose() {
    _donation.dispose();
    for (final controller in _address.values) {
      controller.dispose();
    }
    super.dispose();
  }

  String _storageKey(String campaignId) => 'betik-checkout:${context.services.auth.userId}:$campaignId';

  Future<void> _start(Json campaign) async {
    final services = context.services;
    final donationMinor = parseTlToMinor(_donation.text);
    if (donationMinor == null || !_accepted) return;
    final campaignId = jsonString(campaign['id']);
    final storageKey = _storageKey(campaignId);
    _key ??= services.local.getString(storageKey) ?? newCheckoutKey();
    await services.local.setString(storageKey, _key!);
    if (!mounted) return;
    setState(() => _attempted = true);
    final result = await runPrintAction(context, _startCheckout, {
      'input': {
        'campaignId': campaignId,
        'idempotencyKey': _key,
        'quantity': _quantity,
        'donationMinor': donationMinor,
        if (_quantity > 0)
          'shippingAddress': {for (final entry in _address.entries) entry.key: entry.value.text.trim(), 'consent': _addressConsent},
      },
    }, success: '');
    if (result != null && mounted) {
      setState(() => _payment = jsonMap(result['startPrintCheckout']));
      await _loader.currentState?.reload(silent: true);
    }
  }

  Future<void> _resetBasket(String campaignId) async {
    await context.services.local.remove(_storageKey(campaignId));
    if (!mounted) return;
    setState(() {
      _key = null;
      _payment = null;
      _attempted = false;
      _accepted = false;
    });
  }

  Future<void> _refreshPayment() async {
    final id = _payment?['id'];
    if (id == null) return;
    try {
      final data = await context.services.api.run(_myPayment, variables: {'id': id});
      final fresh = jsonMap(data['myFundingPayment']);
      if (mounted && fresh != null) setState(() => _payment = fresh);
    } on ApiException {
      // Keep the last known state; the next poll retries.
    }
    await _loader.currentState?.reload(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return PageScaffold(
      title: 'Destek ve Ön Sipariş',
      body: Loader<Json>(
        key: _loader,
        pollEvery: const Duration(seconds: 15),
        load: () async {
          final data = await services.api.run(printOverviewQuery, variables: {'bookId': widget.bookId});
          if (_payment != null) await _refreshPaymentQuietly();
          return data;
        },
        loadingLabel: 'Kampanya yükleniyor…',
        builder: (context, data, _) {
          final mode = jsonString(data['printPaymentMode']);
          final campaign = jsonMap(jsonMap(data['printOverview'])?['campaign']);
          final paymentsEnabled = mode == 'SANDBOX' || mode == 'IYZICO_SANDBOX';
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              Text('Destek ve kitap ön siparişi', style: serif(size: 22, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              Notice(
                mode == 'IYZICO_SANDBOX'
                    ? 'iyzico test ortamı · Test kartlarıyla ödeme ve ön sipariş akışını kullanabilirsiniz. Gerçek para tahsil edilmez.'
                    : 'Yalnızca sandbox testi. Gerçek ödeme alınmaz; fiziksel teslimat taahhüdü oluşmaz.',
              ),
              const SizedBox(height: 12),
              if (campaign != null) CampaignCard(campaign) else const Notice('Kitabın onaylı destek kampanyası yok.'),
              if (_payment != null && campaign != null) ...[
                PaymentCard(payment: _payment!, mode: mode, onChanged: _refreshPayment),
                if (!const {'CREATED', 'PENDING'}.contains(_payment!['state']))
                  OutlinedButton(onPressed: () => _resetBasket(jsonString(campaign['id'])), child: const Text('YENİ TEST İŞLEMİ HAZIRLA')),
              ] else if (campaign != null)
                _basket(campaign, mode, paymentsEnabled),
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.push('/funding-history'), child: const Text('Desteklerim ve ön siparişlerim →')),
            ],
          );
        },
      ),
    );
  }

  Future<void> _refreshPaymentQuietly() async {
    try {
      final data = await context.services.api.run(_myPayment, variables: {'id': _payment!['id']});
      final fresh = jsonMap(data['myFundingPayment']);
      if (mounted && fresh != null) _payment = fresh;
    } on ApiException {
      // Polling failure: keep the last state.
    }
  }

  Widget _basket(Json campaign, String mode, bool paymentsEnabled) {
    final policy = jsonMap(campaign['policy']) ?? const {};
    final unitPrice = jsonInt(campaign['unitPriceMinor']);
    final maxQuantity = jsonInt(policy['maxOrderQuantity'], 10);
    final quickAmounts = policy['quickAmountsMinor'] is List
        ? (policy['quickAmountsMinor'] as List).whereType<num>().toList()
        : const <num>[];
    final donationMinor = parseTlToMinor(_donation.text);
    final validAmount = donationMinor != null;
    final total = basketTotalMinor(unitPriceMinor: unitPrice, quantity: _quantity, donationMinor: donationMinor ?? 0);
    final addressComplete = _quantity == 0 || (_address.values.every((c) => c.text.trim().isNotEmpty) && _addressConsent);
    final locked = _attempted || !paymentsEnabled || campaign['state'] != 'ACTIVE';
    final canSubmit = validAmount && total > 0 && _accepted && addressComplete && paymentsEnabled && campaign['state'] == 'ACTIVE';

    const addressLabels = {
      'fullName': 'Alıcı adı soyadı',
      'phone': 'Telefon',
      'city': 'İl',
      'district': 'İlçe',
      'postalCode': 'Posta kodu',
      'line': 'Açık adres',
    };

    return PanelCard(
      title: 'Sepet',
      children: [
        if (!paymentsEnabled)
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Notice('Ödemeler kapalı. Test ödeme sistemi sunucuda etkinleştirilmelidir.'),
          ),
        IgnorePointer(
          ignoring: locked,
          child: Opacity(
            opacity: locked ? 0.55 : 1,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LabeledField(
                  label: 'Fiziksel kitap adedi',
                  hint:
                      'Kitap başına ${formatMoney(unitPrice)}. Kargo ve vergi onaylanmış fiyata dahildir. Ön sipariş teslimat hakkı oluşturur; kampanya başarısız olursa tam iade edilir.',
                  child: Row(
                    children: [
                      IconButton.outlined(
                        tooltip: 'Azalt',
                        onPressed: _quantity > 0 ? () => setState(() => _quantity--) : null,
                        icon: const Icon(Icons.remove),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                        child: Text('$_quantity', style: serif(size: 20, weight: FontWeight.w700)),
                      ),
                      IconButton.outlined(
                        tooltip: 'Artır',
                        onPressed: _quantity < maxQuantity ? () => setState(() => _quantity++) : null,
                        icon: const Icon(Icons.add),
                      ),
                    ],
                  ),
                ),
                LabeledField(
                  label: 'İlave karşılıksız destek (TL)',
                  hint:
                      'Karşılıksız destek fiziksel kitap hakkı vermez. Destek sınırı: ${formatMoney(policy['donationMinMinor'])} – ${formatMoney(policy['donationMaxMinor'])}. Aynı sepette kitap ve ilave destek seçebilirsiniz.',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _donation,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(errorText: validAmount ? null : 'Tutarı en fazla iki ondalık basamakla girin.'),
                        onChanged: (_) => setState(() {}),
                      ),
                      Wrap(
                        spacing: 6,
                        children: [
                          for (final amount in quickAmounts)
                            ActionChip(
                              label: Text(formatMoney(amount)),
                              onPressed: () => setState(() => _donation.text = (amount / 100).toStringAsFixed(amount % 100 == 0 ? 0 : 2)),
                            ),
                          ActionChip(label: const Text('İlave destek yok'), onPressed: () => setState(() => _donation.text = '0')),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_quantity > 0) ...[
                  const Label('Teslimat bilgileri', color: BetikColors.inkBlack),
                  const SizedBox(height: 8),
                  for (final entry in addressLabels.entries)
                    LabeledField(
                      label: entry.value,
                      required: true,
                      child: TextField(
                        controller: _address[entry.key],
                        maxLength: entry.key == 'line' ? 500 : 120,
                        keyboardType: entry.key == 'phone'
                            ? TextInputType.phone
                            : (entry.key == 'postalCode' ? TextInputType.number : TextInputType.text),
                        minLines: 1,
                        maxLines: entry.key == 'line' ? 3 : 1,
                        decoration: const InputDecoration(counterText: ''),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                  CheckboxListTile(
                    value: _addressConsent,
                    onChanged: (value) => setState(() => _addressConsent = value ?? false),
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(
                      'Teslimat bilgilerimin sipariş işlemleri amacıyla yetkili operasyon tarafından işlenmesini kabul ediyorum. Bilgiler yazara ve diğer okurlara gösterilmez.',
                      style: sans(size: 12.5, height: 1.4),
                    ),
                  ),
                ],
                CheckboxListTile(
                  value: _accepted,
                  onChanged: (value) => setState(() => _accepted = value ?? false),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Text(
                    'Sepetin tam bedeline, rezervasyon süresine ve kampanya başarısızlığında tam iade kuralına onay veriyorum. Rezervasyondan sonra geç doğrulanan ödeme de tam iade edilir.',
                    style: sans(size: 12.5, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Sepet toplamı: ${validAmount ? formatMoney(total) : 'Geçerli bir tutar girin'}',
          style: sans(size: 15, weight: FontWeight.w700),
        ),
        Text(
          'Kesin toplam sunucuda hesaplanır. Sepet kalan hedefe tam sığmalıdır; kısmi tahsilat yapılmaz.',
          style: sans(size: 12, color: BetikColors.ashGray),
        ),
        const SizedBox(height: 10),
        BusyButton(
          expand: true,
          onPressed: canSubmit ? () => _start(campaign) : null,
          label: _attempted
              ? 'Aynı işlemi güvenle yeniden sorgula'
              : (mode == 'IYZICO_SANDBOX' ? 'iyzico test ödemesine geç' : 'Test ödeme rezervasyonu oluştur'),
        ),
        if (_attempted) ...[
          const SizedBox(height: 8),
          const Notice(
            'İstek gönderildi; sepet kilitlendi. Yanıt kaybolduysa aynı düğmeyle mevcut işlem alınır. Yeniden başlamadan önce işlem geçmişinizi kontrol edin.',
          ),
          TextButton(
            onPressed: () => _resetBasket(jsonString(campaign['id'])),
            child: const Text('Yeni sepet hazırla (önceki işlem ayrıca sürer)'),
          ),
        ],
      ],
    );
  }
}

/// Desteklerim ve ön siparişlerim (F-FUND-05, F-FUND-10): 20 per page,
/// polled every 15 s; pending reservations stay actionable here.
class FundingHistoryScreen extends StatefulWidget {
  const FundingHistoryScreen({super.key});
  @override
  State<FundingHistoryScreen> createState() => _FundingHistoryScreenState();
}

class _FundingHistoryScreenState extends State<FundingHistoryScreen> {
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return PageScaffold(
      title: 'Desteklerim',
      body: Loader<Json>(
        key: ValueKey(_page),
        pollEvery: const Duration(seconds: 15),
        load: () => services.api.run(
          'query MyFundingHistory(\$page: Int) { printPaymentMode myFundingPayments(page: \$page) { $paymentFields } }',
          variables: {'page': _page},
        ),
        builder: (context, data, loader) {
          final payments = jsonList(data['myFundingPayments']);
          final mode = jsonString(data['printPaymentMode']);
          return RefreshIndicator(
            onRefresh: () => loader.reload(silent: true),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Text('Desteklerim ve ön siparişlerim', style: serif(size: 22, weight: FontWeight.w700)),
                const SizedBox(height: 8),
                const Align(alignment: Alignment.centerLeft, child: SandboxNotice()),
                const SizedBox(height: 12),
                if (payments.isEmpty)
                  const EmptyView(title: 'Henüz destek veya ön sipariş işleminiz yok.')
                else
                  for (final payment in payments) PaymentCard(payment: payment, mode: mode, onChanged: () => loader.reload(silent: true)),
                // The API has no total; a full page means there may be more.
                PagerBar(page: _page, hasNext: payments.length >= 20, onPage: (page) => setState(() => _page = page)),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Legacy `/payment/failure` (F-FUND-07): the old donation flow is closed
/// on the server (HTTP 410); the page only explains and links on.
class PaymentFailureScreen extends StatelessWidget {
  const PaymentFailureScreen({super.key, this.reason});
  final String? reason;

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Ödeme',
    body: EmptyView(
      icon: Icons.error_outline,
      title: 'Ödeme Başarısız',
      subtitle: (reason ?? '').isEmpty ? 'İşleminiz tamamlanamadı.' : reason,
      action: OutlinedButton(onPressed: () => context.go('/feed'), child: const Text('KEŞFET SAYFASINA DÖN')),
    ),
  );
}
