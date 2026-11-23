import 'dart:convert';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../funding/funding_shared.dart';
import '../funding/print_application_screen.dart';
import '../shell/shell.dart';

const _costFields = [
  ('printingMinor', 'Matbaa üretimi'), ('shippingMinor', 'Kargo'), ('packagingMinor', 'Paketleme'), ('taxMinor', 'Vergi'), //
  ('providerFeeMinor', 'Ödeme giderleri'), ('serviceMinor', 'Yayın hizmetleri'), ('otherMinor', 'Diğer zorunlu giderler'),
];
const _saleFields = [
  ('unitProductionMinor', 'Birim üretim'), ('unitShippingMinor', 'Birim kargo'), ('unitPackagingMinor', 'Birim paketleme'), //
  ('unitTaxMinor', 'Birim vergi'), ('unitFeeMinor', 'Birim ödeme gideri'), ('unitServiceMinor', 'Birim hizmet'),
  ('unitMarginMinor', 'Satış payı'),
];

final _objectId = RegExp(r'^[a-f\d]{24}$', caseSensitive: false);

/// Converts every TL text field to kuruş; null when any value is invalid.
Map<String, int>? amountsToMinor(Map<String, TextEditingController> fields) {
  final result = <String, int>{};
  for (final entry in fields.entries) {
    final minor = parseTlToMinor(entry.value.text);
    if (minor == null) return null;
    result[entry.key] = minor;
  }
  return result;
}

/// Basım, Destek ve Ön Sipariş (F-ADM-07…12): applications, campaigns and
/// production, payments/refunds/orders, tariffs. Sandbox only.
class AdminPrintFundingScreen extends StatelessWidget {
  const AdminPrintFundingScreen({super.key});

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 4,
    child: PageScaffold(
      title: 'Basım, Destek ve Ön Sipariş',
      bottom: const TabBar(
        isScrollable: true,
        tabs: [
          Tab(text: 'BAŞVURULAR'),
          Tab(text: 'KAMPANYA VE ÜRETİM'),
          Tab(text: 'ÖDEME, İADE VE TESLİMAT'),
          Tab(text: 'FİYAT TARİFELERİ'),
        ],
      ),
      body: const TabBarView(children: [_ApplicationsTab(), _CampaignsTab(), _OperationsTab(), _TariffsTab()]),
    ),
  );
}

class _PagedTab extends StatefulWidget {
  const _PagedTab({required this.load, required this.builder, this.pollEvery, this.header});
  final Future<Json> Function(int page) load;
  final (List<Widget>, int) Function(BuildContext context, Json data, Future<void> Function() refresh) builder;
  final Duration? pollEvery;
  final Widget Function(Future<void> Function() refresh)? header;

  @override
  State<_PagedTab> createState() => _PagedTabState();
}

class _PagedTabState extends State<_PagedTab> with AutomaticKeepAliveClientMixin {
  int _page = 1;

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Loader<Json>(
      key: ValueKey(_page),
      load: () => widget.load(_page),
      pollEvery: widget.pollEvery,
      builder: (context, data, loader) {
        Future<void> refresh() => loader.reload(silent: true);
        final (children, count) = widget.builder(context, data, refresh);
        return RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              const Notice('SANDBOX yönetimi. Canlı tahsilat ve gerçek para hareketi kapalıdır.'),
              const SizedBox(height: 10),
              if (widget.header != null) widget.header!(refresh),
              ...children,
              PagerBar(page: _page, hasNext: count >= 20, onPage: (page) => setState(() => _page = page)),
            ],
          ),
        );
      },
    );
  }
}

// --- Applications ----------------------------------------------------------

class _ApplicationsTab extends StatelessWidget {
  const _ApplicationsTab();

  @override
  Widget build(BuildContext context) {
    final api = context.services.api;
    return _PagedTab(
      load: (page) => api.run(
        'query AdminPrintApplications(\$page: Int) { adminPrintApplications(page: \$page) { $applicationFields } }',
        variables: {'page': page},
      ),
      header: (refresh) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: OutlinedButton(onPressed: refresh, child: const Text('BAŞVURULARI YENİLE')),
      ),
      builder: (context, data, refresh) {
        final items = jsonList(data['adminPrintApplications']);
        return (
          [
            if (items.isEmpty) const Text('Bu sayfada başvuru yok.'),
            for (final item in items)
              _ApplicationReview(key: ValueKey('${item['id']}:${item['revision']}'), application: item, refresh: refresh),
          ],
          items.length,
        );
      },
    );
  }
}

class _ApplicationReview extends StatefulWidget {
  const _ApplicationReview({super.key, required this.application, required this.refresh});
  final Json application;
  final Future<void> Function() refresh;

  @override
  State<_ApplicationReview> createState() => _ApplicationReviewState();
}

class _ApplicationReviewState extends State<_ApplicationReview> {
  final _reason = TextEditingController();
  final _source = TextEditingController();
  final _pages = TextEditingController();
  final _days = TextEditingController(text: '30');
  late final _components = {for (final (key, _) in _costFields) key: TextEditingController(text: '0')};
  late final _sale = {for (final (key, _) in _saleFields) key: TextEditingController(text: '0')};
  String _decision = 'REVISION_REQUESTED';
  String? _layout;
  String? _quote;
  bool _preflight = false;
  bool _inspected = false;

  @override
  void dispose() {
    for (final controller in [_reason, _source, _pages, _days, ..._components.values, ..._sale.values]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _fail(String message) => showToast(context, message, type: ToastType.error);

  Future<void> _review() async {
    final app = widget.application;
    final reason = _reason.text.trim();
    if (reason.length < 5) return _fail('İnceleme gerekçesi en az 5 karakter olmalıdır.');
    Json? quote;
    if (_decision == 'APPROVED') {
      if (_source.text.trim().length < 5) return _fail('Teklif referansı en az 5 karakter olmalıdır.');
      final pages = int.tryParse(_pages.text.trim());
      if (pages == null || pages < 1 || pages > 20000) return _fail('Kesin sayfa sayısı 1–20000 arasında olmalıdır.');
      if (!_objectId.hasMatch(_layout ?? '')) {
        return _fail('Onay için son mizanpaj PDF dosyasını yükleyin ve yüklemenin tamamlanmasını bekleyin.');
      }
      if (!_objectId.hasMatch(_quote ?? '')) {
        return _fail('Onay için matbaa teklif PDF dosyasını yükleyin ve yüklemenin tamamlanmasını bekleyin.');
      }
      final components = amountsToMinor(_components);
      final sale = amountsToMinor(_sale);
      if (components == null || sale == null) return _fail('Tutarı en fazla iki ondalık basamakla girin.');
      if (!_preflight) return _fail('Ön kontrol onayını işaretleyin.');
      quote = {
        'source': _source.text.trim(),
        'confirmedPages': pages,
        'layoutAssetId': _layout,
        'quoteAssetId': _quote,
        'preflightConfirmed': true,
        'components': components,
        'sale': sale,
      };
    }
    final result = await runPrintAction(
      context,
      'mutation ReviewPrintApplication(\$input: ReviewPrintApplicationInput!) { reviewPrintApplication(input: \$input) { id state revision } }',
      {
        'input': {
          'applicationId': app['id'],
          'revision': app['revision'],
          'decision': _decision,
          'reason': reason,
          if (quote != null) 'quote': quote,
        },
      },
    );
    if (result != null) await widget.refresh();
  }

  Future<void> _open() async {
    final app = widget.application;
    final days = int.tryParse(_days.text.trim());
    if (days == null || days < 1 || days > 90) return _fail('Kampanya süresi 1–90 gün olmalıdır.');
    final result = await runPrintAction(
      context,
      'mutation OpenFundingCampaign(\$input: OpenPrintCampaignInput!) { openFundingCampaign(input: \$input) { id state } }',
      {
        'input': {'applicationId': app['id'], 'revision': app['revision'], 'days': days},
      },
    );
    if (result != null) await widget.refresh();
  }

  Widget _amounts(String title, List<(String, String)> fields, Map<String, TextEditingController> controllers) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Label('$title (TL)', color: BetikColors.inkBlack),
      const SizedBox(height: 8),
      for (final (key, title) in fields)
        LabeledField(
          label: title,
          child: TextField(
            controller: controllers[key],
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => setState(() {}),
          ),
        ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final app = widget.application;
    final version = jsonMap(app['version']) ?? const {};
    final state = jsonString(app['state']);
    final target = amountsToMinor(_components)?.values.fold<int>(0, (a, b) => a + b) ?? 0;
    final price = amountsToMinor(_sale)?.values.fold<int>(0, (a, b) => a + b) ?? 0;
    return PanelCard(
      title: jsonString(version['title']),
      trailing: StatusPill(state),
      children: [
        SelectableText(
          'Başvuru: ${app['id']} · Yazar: ${version['authorName'] ?? ''}',
          style: sans(size: 12.5, color: BetikColors.graphite),
        ),
        const SizedBox(height: 6),
        ApplicationDetails(application: app),
        if (state == 'SUBMITTED') ...[
          const Divider(height: 24),
          const Label('Yönetici kararı', color: BetikColors.inkBlack),
          const SizedBox(height: 8),
          LabeledField(
            label: 'Karar',
            child: DropdownButtonFormField<String>(
              initialValue: _decision,
              items: const [
                DropdownMenuItem(value: 'REVISION_REQUESTED', child: Text('Revizyon iste')),
                DropdownMenuItem(value: 'REJECTED', child: Text('Reddet')),
                DropdownMenuItem(value: 'APPROVED', child: Text('Onayla')),
              ],
              onChanged: (value) => setState(() => _decision = value ?? 'REVISION_REQUESTED'),
            ),
          ),
          LabeledField(
            label: 'İnceleme gerekçesi',
            required: true,
            child: TextField(controller: _reason, minLines: 2, maxLines: 6, maxLength: 2000),
          ),
          if (_decision == 'APPROVED') ...[
            const Notice(
              'Bu onay sandbox kampanyası oluşturmanıza izin verir; kampanyayı veya ödemeleri kendiliğinden açmaz. Gerçek matbaa fiyatı varmış gibi işlem yapmayın.',
            ),
            const SizedBox(height: 10),
            LabeledField(
              label: 'Matbaa / yayınevi teklif referansı',
              required: true,
              child: TextField(controller: _source, maxLength: 300),
            ),
            LabeledField(
              label: 'Mizanpajdan doğrulanmış kesin sayfa',
              required: true,
              child: TextField(controller: _pages, keyboardType: TextInputType.number),
            ),
            PdfUploadField(label: 'Onaylanacak son mizanpaj PDF', value: _layout, onChanged: (id) => setState(() => _layout = id)),
            PdfUploadField(label: 'Matbaa teklif PDF', value: _quote, onChanged: (id) => setState(() => _quote = id)),
            _amounts('Doğrulanmış toplam baskı maliyetleri', _costFields, _components),
            Text(
              'Baskı adedi: ${jsonMap(version['specification'])?['printRun'] ?? ''}. Yukarıdaki giderler tüm baskı içindir. Aşağıdaki her birim gider en az ilgili toplam giderin baskı adedine bölümü kadar olmalı; küsurat yukarı doğru kuruşa yuvarlanır. Satış payı ayrı eklenir ve eksik birim giderin yerine geçmez.',
              style: sans(size: 12.5, height: 1.45),
            ),
            const SizedBox(height: 10),
            _amounts('Onaylanacak kitap satış fiyatının bileşenleri', _saleFields, _sale),
            Text(
              'Tahmini maliyet: ${formatMoney(jsonMap(app['estimate'])?['totalMinor'])} · Doğrulanmış hedef: ${formatMoney(target)} · Kitap satış fiyatı: ${formatMoney(price)}',
              style: sans(size: 13, weight: FontWeight.w700),
            ),
            CheckboxListTile(
              value: _preflight,
              onChanged: (value) => setState(() => _preflight = value ?? false),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(
                'Son metni, mizanpaj sayfalarını, boyut/taşma payı/kapak çözünürlüğünü ve hak/izin beyanlarını inceledim. Teknik özellikleri bu dosyalar için doğruluyorum.',
                style: sans(size: 12.5, height: 1.4),
              ),
            ),
          ],
          BusyButton(onPressed: _review, label: 'Kararı kaydet'),
        ],
        if (state == 'APPROVED') ...[
          const Divider(height: 24),
          Text(
            'Kampanyayı oluşturmak ödeme sistemini etkinleştirmez. Canlı tahsilat kapalıdır; test ödemeleri yalnızca ayrıca yapılandırılmış geliştirme/test ortamında kullanılabilir.',
            style: sans(size: 12.5, height: 1.45),
          ),
          const SizedBox(height: 8),
          LabeledField(
            label: 'Kampanya süresi (gün)',
            child: TextField(controller: _days, keyboardType: TextInputType.number),
          ),
          CheckboxListTile(
            value: _inspected,
            onChanged: (value) => setState(() => _inspected = value ?? false),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(
              'Onaylı sürüm, hedef ve satış fiyatıyla test kampanyası açılmasını onaylıyorum. Aynı başvuru yeniden kampanya oluşturmaz.',
              style: sans(size: 12.5, height: 1.4),
            ),
          ),
          BusyButton(onPressed: _inspected ? _open : null, label: 'Onaylı sandbox kampanyasını aç'),
        ],
      ],
    );
  }
}

// --- Campaigns and production ---------------------------------------------

const _nextProduction = {
  'PREPARATION': 'PRINTER_APPROVED', 'PRINTER_APPROVED': 'STARTED', 'STARTED': 'PRINTING', 'PRINTING': 'PRINTED', //
  'PRINTED': 'PACKAGING', 'PACKAGING': 'SHIPPING', 'SHIPPING': 'DELIVERED', 'DELIVERED': 'COMPLETED',
};

const _productionLabels = {
  'PRINTER_APPROVED': 'Matbaa onayladı', 'STARTED': 'Üretimi başlat', 'PRINTING': 'Baskıda', 'PRINTED': 'Baskı tamamlandı', //
  'PACKAGING': 'Paketleme', 'SHIPPING': 'Dağıtım', 'DELIVERED': 'Teslimatlar tamamlandı', 'COMPLETED': 'Süreci tamamla',
  'ISSUE': 'Sorun / Gecikme', 'CANCELLED': 'Üretimi iptal et ve iadeleri başlat',
};

/// Production states an admin may choose next (fixed chain, plus ISSUE and
/// its return, plus CANCELLED).
List<String> productionChoices(String current, String? previous) => [
  if ((_nextProduction[current] ?? previous) != null) (_nextProduction[current] ?? previous)!,
  if (current != 'ISSUE') 'ISSUE',
  'CANCELLED',
];

class _CampaignsTab extends StatelessWidget {
  const _CampaignsTab();

  @override
  Widget build(BuildContext context) {
    final api = context.services.api;
    return _PagedTab(
      pollEvery: const Duration(seconds: 15),
      load: (page) => api.run(
        'query AdminFundingCampaigns(\$page: Int) { adminFundingCampaigns(page: \$page) { $campaignFields } }',
        variables: {'page': page},
      ),
      header: (refresh) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Builder(
          builder: (context) => BusyButton(
            label: 'Uzlaştırma ve iade işlerini şimdi çalıştır',
            onPressed: () async {
              // Rate limited to 2 per minute on the server.
              if (await runPrintAction(context, 'mutation RunPrintMaintenance { runPrintMaintenance }', const {}) != null) {
                await refresh();
              }
            },
          ),
        ),
      ),
      builder: (context, data, refresh) {
        final items = jsonList(data['adminFundingCampaigns']);
        return (
          [
            if (items.isEmpty) const Text('Bu sayfada kampanya yok.'),
            for (final item in items)
              _CampaignManager(
                key: ValueKey('${item['id']}:${item['state']}:${item['productionRevision']}'),
                campaign: item,
                refresh: refresh,
              ),
          ],
          items.length,
        );
      },
    );
  }
}

class _CampaignManager extends StatefulWidget {
  const _CampaignManager({super.key, required this.campaign, required this.refresh});
  final Json campaign;
  final Future<void> Function() refresh;

  @override
  State<_CampaignManager> createState() => _CampaignManagerState();
}

class _CampaignManagerState extends State<_CampaignManager> {
  final _message = TextEditingController();
  late final List<String> _choices = productionChoices(
    jsonString(widget.campaign['productionState']),
    widget.campaign['previousProductionState'] as String?,
  );
  late String _state = _choices.first;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _act(String document, Json variables) async {
    if (await runPrintAction(context, document, variables) != null) await widget.refresh();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.campaign;
    final state = jsonString(c['state']);
    final production = jsonString(c['productionState']);
    final ready = _message.text.trim().length >= 5;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CampaignCard(c),
        PanelCard(
          children: [
            Row(
              children: [
                Expanded(
                  child: SelectableText('Kampanya: ${c['id']}', style: sans(size: 12, color: BetikColors.ashGray)),
                ),
                TextButton(onPressed: () => context.push('/book/${c['bookId']}'), child: const Text('Kitap sayfası')),
              ],
            ),
            LabeledField(
              label: 'İşlem / güncelleme gerekçesi',
              hint: 'En az 5 karakter. Üretim güncellemeleri destekçilere ve yazara bildirilir.',
              child: TextField(controller: _message, minLines: 2, maxLines: 5, maxLength: 2000, onChanged: (_) => setState(() {})),
            ),
            if (state == 'ACTIVE' || state == 'CLOSING')
              BusyButton(
                danger: true,
                label: 'Kampanyayı kapat ve tam iade sürecine al',
                onPressed: !ready
                    ? null
                    : () async {
                        if (!await confirm(
                          context,
                          'Kampanya kapatılacak ve tüm ödemeler iade sürecine alınacak. Onaylıyor musunuz?',
                          confirmLabel: 'Kapat',
                          destructive: true,
                        )) {
                          return;
                        }
                        await _act(
                          'mutation CloseFundingCampaign(\$campaignId: ID!, \$reason: String!) { closeFundingCampaign(campaignId: \$campaignId, reason: \$reason) { id state } }',
                          {'campaignId': c['id'], 'reason': _message.text.trim()},
                        );
                      },
              ),
            if (state == 'SUCCEEDED' && production != 'COMPLETED' && production != 'CANCELLED') ...[
              LabeledField(
                label: 'Sonraki üretim durumu',
                child: DropdownButtonFormField<String>(
                  initialValue: _state,
                  isExpanded: true,
                  items: [
                    for (final value in _choices)
                      DropdownMenuItem(value: value, child: Text(_productionLabels[value] ?? statusName(value))),
                  ],
                  onChanged: (value) => setState(() => _state = value ?? _state),
                ),
              ),
              BusyButton(
                label: 'Üretim durumunu kaydet',
                onPressed: !ready
                    ? null
                    : () => _act(
                        'mutation UpdatePrintProduction(\$input: PrintProductionInput!) { updatePrintProduction(input: \$input) { id productionState productionRevision } }',
                        {
                          'input': {
                            'campaignId': c['id'],
                            'revision': c['productionRevision'],
                            'state': _state,
                            'message': _message.text.trim(),
                          },
                        },
                      ),
              ),
            ],
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text('Denetim geçmişi', style: sans(size: 13.5, weight: FontWeight.w600)),
              children: [
                Loader<List<Json>>(
                  load: () async {
                    final data = await context.services.api.run(
                      r'query PrintCampaignAudit($campaignId: ID!) { printCampaignAudit(campaignId: $campaignId) { id actorId action from to reason metadata createdAt } }',
                      variables: {'campaignId': c['id']},
                    );
                    return jsonList(data['printCampaignAudit']);
                  },
                  builder: (context, history, _) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final item in history)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            '${formatDateTime(parseApiDate(item['createdAt']))} · ${item['action']} · ${item['to'] ?? ''} · ${item['reason'] ?? ''}',
                            style: sans(size: 12.5),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

// --- Payments, refunds, orders ----------------------------------------------

class _OperationsTab extends StatelessWidget {
  const _OperationsTab();

  @override
  Widget build(BuildContext context) {
    final api = context.services.api;
    return _PagedTab(
      load: (page) => api.run(
        '''query AdminFundingOperations(\$page: Int) {
          adminFundingPayments(page: \$page) { $paymentFields }
          adminPrintOrders(page: \$page) { $orderFields shippingAddress }
          adminFundingRefunds(page: \$page) { id paymentId amountMinor reason state attempts lastError retryAt providerRefundId }
        }''',
        variables: {'page': page},
      ),
      builder: (context, data, refresh) {
        final refunds = jsonList(data['adminFundingRefunds']);
        final payments = jsonList(data['adminFundingPayments']);
        final orders = jsonList(data['adminPrintOrders']);
        Widget heading(String text) => Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 8),
          child: Text(text, style: serif(size: 18, weight: FontWeight.w700)),
        );
        final count = [refunds.length, payments.length, orders.length].reduce((a, b) => a > b ? a : b);
        return (
          [
            heading('İadeler'),
            if (refunds.isEmpty) Text('Kayıt yok.', style: sans(size: 13, color: BetikColors.ashGray)),
            for (final refund in refunds)
              PanelCard(
                title: formatMoney(refund['amountMinor']),
                trailing: StatusPill(refund['state']),
                children: [
                  Text('${refund['reason'] ?? ''} · Deneme: ${jsonInt(refund['attempts'])}', style: sans(size: 13)),
                  SelectableText('${refund['paymentId']}', style: sans(size: 12, color: BetikColors.ashGray)),
                  if (jsonString(refund['lastError']).isNotEmpty)
                    Text(jsonString(refund['lastError']), style: sans(size: 12.5, color: BetikColors.danger)),
                  if (refund['state'] == 'FAILED')
                    BusyButton(
                      label: 'İadeyi yeniden dene',
                      onPressed: () async {
                        final result = await runPrintAction(
                          context,
                          r'mutation RetryPrintRefund($refundId: ID!) { retryPrintRefund(refundId: $refundId) { id state attempts lastError } }',
                          {'refundId': refund['id']},
                        );
                        if (result != null) await refresh();
                      },
                    ),
                ],
              ),
            heading('Ödemeler'),
            if (payments.isEmpty) Text('Kayıt yok.', style: sans(size: 13, color: BetikColors.ashGray)),
            for (final payment in payments)
              _PaymentManager(key: ValueKey('${payment['id']}:${payment['state']}'), payment: payment, refresh: refresh),
            heading('Ön sipariş ve teslimat'),
            if (orders.isEmpty) Text('Kayıt yok.', style: sans(size: 13, color: BetikColors.ashGray)),
            for (final order in orders)
              _OrderManager(key: ValueKey('${order['id']}:${order['revision']}:${order['state']}'), order: order, refresh: refresh),
          ],
          count,
        );
      },
    );
  }
}

class _PaymentManager extends StatefulWidget {
  const _PaymentManager({super.key, required this.payment, required this.refresh});
  final Json payment;
  final Future<void> Function() refresh;
  @override
  State<_PaymentManager> createState() => _PaymentManagerState();
}

class _PaymentManagerState extends State<_PaymentManager> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.payment;
    final refundable = p['captured'] == true && p['state'] != 'REFUND_PENDING' && p['state'] != 'REFUNDED';
    return PanelCard(
      title: formatMoney(p['amountMinor']),
      trailing: StatusPill(p['state']),
      children: [
        SelectableText('Ödeme: ${p['id']}', style: sans(size: 12, color: BetikColors.ashGray)),
        Text(
          'Karşılıksız: ${formatMoney(p['donationMinor'])} · Ön sipariş: ${jsonInt(p['quantity'])} adet / ${formatMoney(p['orderMinor'])}',
          style: sans(size: 13),
        ),
        if (jsonString(p['issue']).isNotEmpty) Notice('Operasyon incelemesi: ${p['issue']}', error: true),
        if (refundable) ...[
          const SizedBox(height: 8),
          LabeledField(
            label: 'Tam iade gerekçesi',
            child: TextField(controller: _reason, minLines: 1, maxLines: 4, maxLength: 2000, onChanged: (_) => setState(() {})),
          ),
          BusyButton(
            danger: true,
            label: 'Tam iade iste',
            onPressed: _reason.text.trim().length < 5
                ? null
                : () async {
                    final result = await runPrintAction(
                      context,
                      r'mutation RequestPrintRefund($paymentId: ID!, $reason: String!) { requestPrintRefund(paymentId: $paymentId, reason: $reason) { id state } }',
                      {'paymentId': p['id'], 'reason': _reason.text.trim()},
                    );
                    if (result != null) await widget.refresh();
                  },
          ),
        ],
      ],
    );
  }
}

/// Order states an admin may set next.
List<String> orderChoices(String state, String? previous) => switch (state) {
  'CONFIRMED' => const ['PACKAGING', 'ISSUE'],
  'PACKAGING' => const ['SHIPPED', 'ISSUE'],
  'SHIPPED' => const ['DELIVERED', 'ISSUE'],
  'ISSUE' => [if (previous != null) previous],
  _ => const [],
};

class _OrderManager extends StatefulWidget {
  const _OrderManager({super.key, required this.order, required this.refresh});
  final Json order;
  final Future<void> Function() refresh;
  @override
  State<_OrderManager> createState() => _OrderManagerState();
}

class _OrderManagerState extends State<_OrderManager> {
  late final _carrier = TextEditingController(text: jsonString(widget.order['carrier']));
  late final _tracking = TextEditingController(text: jsonString(widget.order['trackingNumber']));
  final _reason = TextEditingController();
  late final List<String> _states = orderChoices(jsonString(widget.order['state']), widget.order['previousState'] as String?);
  late String? _state = _states.isEmpty ? null : _states.first;

  @override
  void dispose() {
    _carrier.dispose();
    _tracking.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _update() async {
    if (_reason.text.trim().length < 5) {
      return showToast(context, 'Güncelleme açıklaması en az 5 karakter olmalıdır.', type: ToastType.error);
    }
    if (_state == 'SHIPPED' && (_carrier.text.trim().isEmpty || _tracking.text.trim().isEmpty)) {
      return showToast(context, 'Kargo firması ve takip numarası zorunludur.', type: ToastType.error);
    }
    final order = widget.order;
    final result = await runPrintAction(
      context,
      'mutation UpdatePrintOrder(\$input: PrintOrderUpdateInput!) { updatePrintOrder(input: \$input) { id state revision } }',
      {
        'input': {
          'orderId': order['id'],
          'revision': order['revision'],
          'state': _state,
          'carrier': _carrier.text.trim(),
          'trackingNumber': _tracking.text.trim(),
          'reason': _reason.text.trim(),
        },
      },
    );
    if (result != null) await widget.refresh();
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final address = jsonMap(order['shippingAddress']);
    const labels = {
      'PACKAGING': 'Paketleme', 'SHIPPED': 'Kargoya verildi', 'DELIVERED': 'Teslim edildi', 'ISSUE': 'Sorun / Gecikme', //
      'CONFIRMED': 'Onaylı sipariş',
    };
    return PanelCard(
      title: 'Ön sipariş · ${jsonInt(order['quantity'])} kitap / ${formatMoney(order['totalMinor'])}',
      trailing: StatusPill(order['state']),
      children: [
        SelectableText('${order['id']}', style: sans(size: 12, color: BetikColors.ashGray)),
        ExpansionTile(
          tilePadding: EdgeInsets.zero,
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          title: Text('Yetkili teslimat bilgileri', style: sans(size: 13.5, weight: FontWeight.w600)),
          children: [
            if (address != null)
              SelectableText(
                '${address['fullName'] ?? ''}\n${address['phone'] ?? ''}\n${address['line'] ?? ''}\n${address['district'] ?? ''} / ${address['city'] ?? ''} ${address['postalCode'] ?? ''}',
                style: sans(size: 13, height: 1.5),
              ),
            Text('Bu bilgileri yalnızca sipariş teslimatı için kullanın.', style: sans(size: 12, color: BetikColors.ashGray)),
          ],
        ),
        if (_states.isNotEmpty) ...[
          LabeledField(
            label: 'Sipariş durumu',
            child: DropdownButtonFormField<String>(
              initialValue: _state,
              items: [for (final value in _states) DropdownMenuItem(value: value, child: Text(labels[value] ?? statusName(value)))],
              onChanged: (value) => setState(() => _state = value),
            ),
          ),
          if (_state == 'SHIPPED') ...[
            LabeledField(
              label: 'Kargo firması',
              required: true,
              child: TextField(controller: _carrier, maxLength: 100),
            ),
            LabeledField(
              label: 'Kargo takip numarası',
              required: true,
              child: TextField(controller: _tracking, maxLength: 100),
            ),
          ],
          LabeledField(
            label: 'Güncelleme açıklaması',
            required: true,
            child: TextField(controller: _reason, minLines: 1, maxLines: 4, maxLength: 2000),
          ),
          BusyButton(onPressed: _update, label: 'Siparişi güncelle'),
        ],
      ],
    );
  }
}

// --- Tariffs ---------------------------------------------------------------

class _TariffsTab extends StatefulWidget {
  const _TariffsTab();
  @override
  State<_TariffsTab> createState() => _TariffsTabState();
}

class _TariffsTabState extends State<_TariffsTab> with AutomaticKeepAliveClientMixin {
  final _loader = GlobalKey<LoaderState<List<Json>>>();
  final _version = TextEditingController();
  final _label = TextEditingController(text: 'ÖRNEK SANDBOX — gerçek matbaa teklifi değildir');
  static const _priceFields = [
    ('enzo', 'Enzo sayfa başı'), ('ivory', 'Ivory sayfa başı'), ('coated', 'Kuşe sayfa başı'), //
    ('paperback', 'Karton kapak başı'), ('hardcover', 'Sert kapak başı'), ('setupMinor', 'Sabit hazırlık'),
    ('packagingPerUnitMinor', 'Kitap başı paketleme'), ('shippingPerUnitMinor', 'Kitap başı kargo'),
    ('serviceMinor', 'Toplam yayın hizmeti'),
  ];
  static const _rateFields = [
    ('dimensionSmall', '13,5 × 21 boyut oranı', '100'), ('dimensionLarge', '16 × 24 boyut oranı', '120'), //
    ('colorBps', 'Renkli sayfa oranı', '200'), ('taxBps', 'Vergi oranı', '0'), ('feeBps', 'Ödeme işlem oranı', '0'),
  ];
  static const _policyFields = [
    ('min', 'Minimum karşılıksız destek (TL)', '50'), ('max', 'Maksimum karşılıksız destek (TL)', '100000'), //
    ('quick', 'Hızlı tutarlar (TL, boşlukla ayırın)', '50 100 250 500'), ('days', 'Varsayılan kampanya günü', '30'),
    ('reservation', 'Rezervasyon süresi (dakika)', '15'), ('quantity', 'Sepette en fazla kitap adedi', '10'),
  ];
  late final _prices = {for (final (key, _) in _priceFields) key: TextEditingController()};
  late final _rates = {for (final (key, _, initial) in _rateFields) key: TextEditingController(text: initial)};
  late final _policy = {for (final (key, _, initial) in _policyFields) key: TextEditingController(text: initial)};

  @override
  bool get wantKeepAlive => true;

  @override
  void dispose() {
    for (final controller in [_version, _label, ..._prices.values, ..._rates.values, ..._policy.values]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _create() async {
    void fail(String message) => showToast(context, message, type: ToastType.error);
    if (_version.text.trim().isEmpty || _label.text.trim().isEmpty) return fail('Sürüm adı ve açıklama zorunludur.');
    final price = amountsToMinor(_prices);
    // Percentages are entered as "120" and stored as basis points (×100),
    // the same conversion the website applies.
    final rate = amountsToMinor(_rates);
    final min = parseTlToMinor(_policy['min']!.text), max = parseTlToMinor(_policy['max']!.text);
    final quick = _policy['quick']!.text.trim().split(RegExp(r'\s+')).where((part) => part.isNotEmpty).map(parseTlToMinor).toList();
    final days = int.tryParse(_policy['days']!.text.trim());
    final reservation = int.tryParse(_policy['reservation']!.text.trim());
    final quantity = int.tryParse(_policy['quantity']!.text.trim());
    if (price == null || rate == null || min == null || max == null || quick.contains(null)) {
      return fail('Tutarı en fazla iki ondalık basamakla girin.');
    }
    if (days == null || reservation == null || quantity == null) return fail('Politika alanları tam sayı olmalıdır.');
    final result = await runPrintAction(
      context,
      r'mutation CreatePrintTariff($input: JSON!) { createPrintTariff(input: $input) { id version label } }',
      {
        'input': {
          'version': _version.text.trim(),
          'label': _label.text.trim(),
          'pageRates': {'enzo': price['enzo'], 'ivory': price['ivory'], 'coated': price['coated']},
          'coverRates': {'paperback': price['paperback'], 'hardcover': price['hardcover']},
          'dimensionBps': {'13.5x21': rate['dimensionSmall'], '16x24': rate['dimensionLarge']},
          'colorBps': rate['colorBps'],
          'taxBps': rate['taxBps'],
          'feeBps': rate['feeBps'],
          'setupMinor': price['setupMinor'],
          'packagingPerUnitMinor': price['packagingPerUnitMinor'],
          'shippingPerUnitMinor': price['shippingPerUnitMinor'],
          'serviceMinor': price['serviceMinor'],
          'policy': {
            'donationMinMinor': min,
            'donationMaxMinor': max,
            'quickAmountsMinor': quick,
            'campaignDays': days,
            'reservationMinutes': reservation,
            'maxOrderQuantity': quantity,
          },
        },
      },
    );
    if (result != null) {
      _version.clear();
      await _loader.currentState?.reload(silent: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    Widget field(String title, TextEditingController controller, {bool decimal = true}) => LabeledField(
      label: title,
      child: TextField(
        controller: controller,
        keyboardType: decimal ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
      ),
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const Notice('SANDBOX yönetimi. Canlı tahsilat ve gerçek para hareketi kapalıdır.'),
        const SizedBox(height: 10),
        PanelCard(
          title: 'Yeni örnek tarife sürümü',
          children: [
            Text(
              'Tarifeler değiştirilemez. Yeni fiyatlar için yeni sürüm oluşturun; mevcut onaylı hedefler ve satış fiyatları değişmez. Aşağıdaki tutarlar gerçek matbaa fiyatı olarak kullanılmaz.',
              style: sans(size: 12.5, height: 1.45),
            ),
            const SizedBox(height: 10),
            LabeledField(
              label: 'Sürüm adı',
              required: true,
              child: TextField(controller: _version, maxLength: 80),
            ),
            LabeledField(
              label: 'Açıklama',
              required: true,
              child: TextField(controller: _label, maxLength: 200),
            ),
            const Label('Örnek birim ve sabit fiyatlar (TL)', color: BetikColors.inkBlack),
            const SizedBox(height: 8),
            for (final (key, title) in _priceFields) field(title, _prices[key]!),
            const Label('Oranlar (%)', color: BetikColors.inkBlack),
            const SizedBox(height: 8),
            for (final (key, title, _) in _rateFields) field(title, _rates[key]!),
            const Label('Destek politikası', color: BetikColors.inkBlack),
            const SizedBox(height: 8),
            for (final (key, title, _) in _policyFields) field(title, _policy[key]!, decimal: key != 'quick'),
            BusyButton(onPressed: _create, label: 'Örnek tarife sürümünü oluştur'),
          ],
        ),
        Loader<List<Json>>(
          key: _loader,
          load: () async {
            final data = await context.services.api.run(
              'query PrintTariffs { printTariffs { id version label environment configuration policy } }',
            );
            return jsonList(data['printTariffs']);
          },
          loadingLabel: 'Tarifeler yükleniyor…',
          builder: (context, tariffs, _) => Column(
            children: [
              for (final tariff in tariffs)
                PanelCard(
                  title: jsonString(tariff['version']),
                  children: [
                    Text(jsonString(tariff['label']), style: sans(size: 13)),
                    ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      title: Text('Fiyat bileşenleri ve politika', style: sans(size: 13.5, weight: FontWeight.w600)),
                      children: [
                        SelectableText(
                          const JsonEncoder.withIndent('  ')
                              .convert({'configuration': tariff['configuration'], 'policy': tariff['policy']}),
                          style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5),
                        ),
                      ],
                    ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }
}
