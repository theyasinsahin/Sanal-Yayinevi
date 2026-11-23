import 'dart:convert';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../shell/shell.dart';
import 'funding_shared.dart';

const _workspaceQuery =
    '''
query AuthorPrintWorkspace(\$bookId: ID!) {
  printPaymentMode
  printTariffs { id version label environment configuration policy }
  myPrintApplicationForBook(bookId: \$bookId) { $applicationFields }
  printOverview(bookId: \$bookId) { bookId digitalStatus writingStatus interestCount interested campaign { $campaignFields } }
  getBookById(id: \$bookId) { id title authorId author { id } }
}''';

const _detailQuery = '''
query PrintApplicationDetail(\$id: ID!) {
  printApplicationHistory(id: \$id) { id actorId action from to reason metadata createdAt }
  printApplicationVersions(id: \$id) { id bookId title authorName wordCount estimatedPages contentHash specification declarations createdAt chapters { sourceId title content } }
}''';

/// Read-only details of an application (F-FUND-11): frozen version id and
/// SHA-256, cover PDF, specification, estimate, verified quote, review
/// note, version history and audit log. Used by the author and by admins.
class ApplicationDetails extends StatelessWidget {
  const ApplicationDetails({super.key, required this.application});
  final Json application;

  @override
  Widget build(BuildContext context) {
    final version = jsonMap(application['version']) ?? const {};
    final specification = jsonMap(version['specification']) ?? const {};
    final estimate = jsonMap(application['estimate']) ?? const {};
    final quote = jsonMap(application['verifiedQuote']);
    final review = jsonMap(version['classificationReview']);
    final coverAsset = jsonString(specification['coverAssetId']);
    Widget section(String title, List<Widget> children, {bool open = false}) => ExpansionTile(
      tilePadding: EdgeInsets.zero,
      initiallyExpanded: open,
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      childrenPadding: const EdgeInsets.only(bottom: 8),
      title: Text(title, style: sans(size: 13.5, weight: FontWeight.w600)),
      children: children,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (review?['reviewRequired'] == true)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Notice(
              'Bu eserin anlatım özellikleri için sabit baskı metni, görsel hakları ve varsa üçüncü taraf telif izinleri ayrıca incelenmelidir. Özellik seçimi basım uygunluğu onayı değildir. ${jsonList(review?['features']).map((feature) => feature['name']).join(', ')}',
            ),
          ),
        Text(
          '${version['authorName'] ?? ''} · ${formatExactCount(version['wordCount'])} kelime · tahmini ${jsonInt(version['estimatedPages'])} sayfa',
          style: sans(size: 13.5),
        ),
        Text(
          'Kesin sayfa sayısı seçilen boyut, yazı tipi, mizanpaj ve matbaa ön kontrolünden sonra doğrulanır. Editör sayfa sayısı baskı sayfası değildir.',
          style: sans(size: 12, color: BetikColors.ashGray, height: 1.4),
        ),
        const SizedBox(height: 6),
        SelectableText(
          'Sabitleştirilmiş sürüm: ${version['id']}\nSHA-256: ${version['contentHash']}',
          style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5, height: 1.5),
        ),
        if (coverAsset.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: BusyButton(
              outlined: true,
              icon: Icons.download,
              label: 'Kapak PDF dosyasını indir',
              onPressed: () => downloadPrintAsset(context, coverAsset),
            ),
          ),
        section('Baskı özellikleri ve beyanlar', [
          SelectableText(
            const JsonEncoder.withIndent('  ')
                .convert({'specification': version['specification'], 'declarations': version['declarations']}),
            style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5),
          ),
        ]),
        section('Tahmini maliyet: ${formatMoney(estimate['totalMinor'])}', [
          Text('${estimate['label'] ?? ''} · ${estimate['tariffVersion'] ?? ''}', style: label(size: 11, color: BetikColors.rust)),
          const SizedBox(height: 6),
          CostBreakdown(estimate['components']),
        ]),
        if (quote != null)
          section('Doğrulanmış teklif ve onaylı hedef', open: true, [
            Text('${quote['source'] ?? ''} · ${quote['confirmedPages'] ?? ''} kesin sayfa', style: sans(size: 13)),
            const SizedBox(height: 6),
            CostBreakdown(quote['components']),
            const SizedBox(height: 6),
            Text('Onaylı hedef: ${formatMoney(application['approvedTargetMinor'])}', style: sans(size: 13.5, weight: FontWeight.w700)),
            Text(
              'Onaylı birim satış fiyatı: ${formatMoney(application['approvedUnitPriceMinor'])}',
              style: sans(size: 13.5, weight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            CostBreakdown(quote['sale']),
            Wrap(
              spacing: 8,
              children: [
                if (quote['layoutAssetId'] is String)
                  TextButton(
                    onPressed: () => downloadPrintAsset(context, quote['layoutAssetId'] as String),
                    child: const Text('Mizanpaj PDF'),
                  ),
                if (quote['quoteAssetId'] is String)
                  TextButton(
                    onPressed: () => downloadPrintAsset(context, quote['quoteAssetId'] as String),
                    child: const Text('Matbaa teklif PDF'),
                  ),
              ],
            ),
          ]),
        if (jsonString(application['reviewNote']).isNotEmpty)
          Padding(padding: const EdgeInsets.only(top: 6), child: Notice('İnceleme gerekçesi: ${application['reviewNote']}')),
        section('Son metin, önceki sürümler ve başvuru geçmişi', [
          Loader<Json>(
            load: () => context.services.api.run(_detailQuery, variables: {'id': application['id']}),
            loadingLabel: 'Sürümler yükleniyor…',
            builder: (context, data, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final item in jsonList(data['printApplicationVersions']))
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    expandedCrossAxisAlignment: CrossAxisAlignment.start,
                    title: Text('${formatDateTime(parseApiDate(item['createdAt']))} · ${item['id']}', style: sans(size: 12.5)),
                    children: [
                      SelectableText('SHA-256: ${item['contentHash']}', style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
                      for (final chapter in jsonList(item['chapters'])) ...[
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(jsonString(chapter['title']), style: sans(size: 13.5, weight: FontWeight.w700)),
                        ),
                        Text(() {
                          final content = jsonString(chapter['content']);
                          return content.length > 1500 ? '${content.substring(0, 1500)}…' : content;
                        }(), style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
                      ],
                    ],
                  ),
                for (final item in jsonList(data['printApplicationHistory']))
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text('${item['action']} · ${statusName(item['to'])} ${jsonString(item['reason'])}', style: sans(size: 12.5)),
                    subtitle: Text(formatDateTime(parseApiDate(item['createdAt']))),
                  ),
              ],
            ),
          ),
        ]),
      ],
    );
  }
}

/// Basım başvurusu (F-FUND-06): the author's print application workspace.
class PrintApplicationScreen extends StatefulWidget {
  const PrintApplicationScreen({super.key, required this.bookId});
  final String bookId;

  @override
  State<PrintApplicationScreen> createState() => _PrintApplicationScreenState();
}

class _PrintApplicationScreenState extends State<PrintApplicationScreen> {
  final _loader = GlobalKey<LoaderState<Json>>();
  final _cancelReason = TextEditingController();
  bool _newApplication = false;

  @override
  void dispose() {
    _cancelReason.dispose();
    super.dispose();
  }

  Future<void> _reload() async => _loader.currentState?.reload(silent: true);

  Future<void> _act(String document, Json variables) async {
    if (await runPrintAction(context, document, variables) != null) await _reload();
  }

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return PageScaffold(
      title: 'Basım Başvurusu',
      body: Loader<Json>(
        key: _loader,
        load: () => services.api.run(_workspaceQuery, variables: {'bookId': widget.bookId}),
        loadingLabel: 'Başvuru yükleniyor…',
        builder: (context, data, _) {
          final app = jsonMap(data['myPrintApplicationForBook']);
          final overview = jsonMap(data['printOverview']) ?? const {};
          final campaign = jsonMap(overview['campaign']);
          final tariffs = jsonList(data['printTariffs']);
          final book = jsonMap(data['getBookById']);
          final isAuthor = jsonMap(book?['author'])?['id'] == services.auth.userId;
          final state = jsonString(app?['state']);
          final canEdit = app == null || state == 'PREPARING' || state == 'REVISION_REQUESTED' || _newApplication;
          final hasCampaign = campaign != null && app != null && campaign['applicationId'] == app['id'];
          final ready = overview['digitalStatus'] == 'PUBLISHED' && overview['writingStatus'] == 'COMPLETED';
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              TextButton.icon(
                style: TextButton.styleFrom(alignment: Alignment.centerLeft, padding: EdgeInsets.zero),
                onPressed: () => context.push('/dashboard/${widget.bookId}'),
                icon: const Icon(Icons.arrow_back, size: 18),
                label: const Text('Yazı masasına dön'),
              ),
              Text('Basım başvurusu', style: serif(size: 22, weight: FontWeight.w700)),
              const SizedBox(height: 6),
              const Notice('Test ortamı. Kampanya yönetici onayıyla açılır; gerçek ödeme ve basım sözleşmesi kurulmaz.'),
              const SizedBox(height: 10),
              Text(
                'Dijital yayın: ${overview['digitalStatus'] == 'PUBLISHED' ? 'Yayında' : 'Taslak'} · Yazım: ${overview['writingStatus'] == 'COMPLETED' ? 'Tamamlandı' : 'Sürüyor'} · Ücretsiz basım ilgisi: ${jsonInt(overview['interestCount'])}',
                style: sans(size: 13.5),
              ),
              const SizedBox(height: 10),
              if (campaign != null) CampaignCard(campaign),
              if (app != null)
                PanelCard(
                  title: jsonString(jsonMap(app['version'])?['title']),
                  trailing: StatusPill(state),
                  children: [
                    ApplicationDetails(key: ValueKey('${app['id']}:${app['revision']}'), application: app),
                    if (state == 'PREPARING')
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: BusyButton(
                          expand: true,
                          label: 'Başvuruyu incelemeye gönder',
                          onPressed: () => _act(
                            'mutation SubmitPrintApplication(\$applicationId: ID!, \$revision: Int!) { submitPrintApplication(applicationId: \$applicationId, revision: \$revision) { id state revision } }',
                            {'applicationId': app['id'], 'revision': app['revision']},
                          ),
                        ),
                      ),
                    if (!hasCampaign && const {'PREPARING', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED'}.contains(state))
                      ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: Text(
                          'Başvuruyu iptal et',
                          style: sans(size: 13.5, weight: FontWeight.w600, color: BetikColors.danger),
                        ),
                        children: [
                          TextField(
                            controller: _cancelReason,
                            minLines: 2,
                            maxLines: 4,
                            decoration: const InputDecoration(hintText: 'İptal gerekçesi (en az 5 karakter)'),
                            onChanged: (_) => setState(() {}),
                          ),
                          const SizedBox(height: 8),
                          BusyButton(
                            danger: true,
                            label: 'Başvuruyu iptal et',
                            onPressed: _cancelReason.text.trim().length < 5
                                ? null
                                : () => _act(
                                    'mutation CancelPrintApplication(\$applicationId: ID!, \$revision: Int!, \$reason: String!) { cancelPrintApplication(applicationId: \$applicationId, revision: \$revision, reason: \$reason) { id state revision } }',
                                    {'applicationId': app['id'], 'revision': app['revision'], 'reason': _cancelReason.text.trim()},
                                  ),
                          ),
                        ],
                      ),
                  ],
                ),
              if (isAuthor && ready && canEdit)
                _ApplicationEditor(
                  key: ValueKey('${app?['id']}:${app?['revision']}:$_newApplication'),
                  bookId: widget.bookId,
                  application: _newApplication ? null : app,
                  tariffs: tariffs,
                  onSaved: () async {
                    setState(() => _newApplication = false);
                    await _reload();
                  },
                ),
              if (app != null && (state == 'REJECTED' || state == 'CANCELLED') && !_newApplication)
                FilledButton(onPressed: () => setState(() => _newApplication = true), child: const Text('YENİ BAŞVURU HAZIRLA')),
              if (!ready) const Notice('Önce yazı masasından kitabı dijital yayımlayın ve yazımı tamamlayın.'),
              if (tariffs.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Notice('Yönetici henüz örnek fiyat tarifesi oluşturmadı. Başvuru kaydetmeden önce tarife gerekli.'),
                ),
              // Other members see the public campaign card only.
              if (!isAuthor && app == null && campaign == null)
                const Notice('Bu kitap için görüntüleyebileceğiniz bir basım başvurusu yok.'),
            ],
          );
        },
      ),
    );
  }
}

class _ApplicationEditor extends StatefulWidget {
  const _ApplicationEditor({super.key, required this.bookId, required this.application, required this.tariffs, required this.onSaved});
  final String bookId;
  final Json? application;
  final List<Json> tariffs;
  final Future<void> Function() onSaved;

  @override
  State<_ApplicationEditor> createState() => _ApplicationEditorState();
}

class _ApplicationEditorState extends State<_ApplicationEditor> {
  late Json _spec;
  late String? _tariffId;
  final _declarations = {'copyright': false, 'permissions': false, 'terms': false};
  late final _printRun = TextEditingController(text: '${_spec['printRun']}');
  late final _dpi = TextEditingController(text: '${_spec['coverDpi']}');
  late final _bleed = TextEditingController(text: '${_spec['bleedMm']}');
  late final _notes = TextEditingController(text: jsonString(_spec['notes']));

  @override
  void initState() {
    super.initState();
    final previous = jsonMap(jsonMap(widget.application?['version'])?['specification']);
    _spec = {
      'dimension': '13.5x21',
      'paperType': 'enzo',
      'coverType': 'paperback',
      'color': 'BW',
      'printRun': 100,
      'coverAssetId': '',
      'coverDpi': 300,
      'bleedMm': 3,
      'notes': '',
      ...?previous,
    }..remove('coverSha256');
    final stored = widget.application?['tariffId'];
    _tariffId = stored is String && widget.tariffs.any((tariff) => tariff['id'] == stored)
        ? stored
        : (widget.tariffs.isEmpty ? null : widget.tariffs.first['id'] as String?);
  }

  @override
  void dispose() {
    _printRun.dispose();
    _dpi.dispose();
    _bleed.dispose();
    _notes.dispose();
    super.dispose();
  }

  int? _inRange(TextEditingController controller, int min, int max) {
    final value = int.tryParse(controller.text.trim());
    return value != null && value >= min && value <= max ? value : null;
  }

  Future<void> _save() async {
    final printRun = _inRange(_printRun, 1, 100000);
    final dpi = _inRange(_dpi, 300, 2400);
    final bleed = _inRange(_bleed, 3, 20);
    if (printRun == null) return showToast(context, 'Baskı adedi 1–100000 arasında olmalıdır.', type: ToastType.error);
    if (dpi == null) return showToast(context, 'Kapak çözünürlüğü 300–2400 DPI arasında olmalıdır.', type: ToastType.error);
    if (bleed == null) return showToast(context, 'Taşma payı 3–20 mm arasında olmalıdır.', type: ToastType.error);
    final result = await runPrintAction(
      context,
      'mutation SavePrintApplication(\$input: SavePrintApplicationInput!) { savePrintApplication(input: \$input) { id state revision } }',
      {
        'input': {
          'bookId': widget.bookId,
          'tariffId': _tariffId,
          // Optimistic locking: the server refuses a stale revision.
          if (widget.application != null) 'revision': widget.application!['revision'],
          'specification': {..._spec, 'printRun': printRun, 'coverDpi': dpi, 'bleedMm': bleed, 'notes': _notes.text.trim()},
          'declarations': _declarations,
        },
      },
    );
    if (result != null) await widget.onSaved();
  }

  @override
  Widget build(BuildContext context) {
    Widget select(String title, String key, Map<String, String> options) => LabeledField(
      label: title,
      child: DropdownButtonFormField<String>(
        initialValue: options.containsKey(_spec[key]) ? _spec[key] as String : options.keys.first,
        isExpanded: true,
        items: [for (final entry in options.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
        onChanged: (value) => setState(() => _spec[key] = value),
      ),
    );
    Widget number(String title, TextEditingController controller) => LabeledField(
      label: title,
      required: true,
      child: TextField(controller: controller, keyboardType: TextInputType.number),
    );
    final complete = jsonString(_spec['coverAssetId']).isNotEmpty && _tariffId != null && _declarations.values.every((v) => v);
    const declarationLabels = {
      'copyright': 'Eserin hak sahibiyim ve basım yetkisine sahibim.',
      'permissions': 'Alıntı, görsel ve üçüncü taraf içeriklerin gerekli izinlerini aldım.',
      'terms': 'Başvurunun yönetici incelemesi gerektirdiğini; bu ortamın yalnızca test olduğunu, yayın/basım sözleşmesi oluşturmadığını kabul ediyorum.',
    };
    return PanelCard(
      title: widget.application != null ? 'Baskı özelliklerini düzenle' : 'Basım için başvur',
      children: [
        Text(
          'Kaydettiğinizde son kayıtlı bölüm metinleri yeni ve değişmez bir basım sürümüne kopyalanır. Dijital metni değiştirmek bu sürümü değiştirmez.',
          style: sans(size: 13, height: 1.45),
        ),
        const SizedBox(height: 12),
        const Label('Fiziksel baskı', color: BetikColors.inkBlack),
        const SizedBox(height: 8),
        select('Kitap boyutu', 'dimension', const {'13.5x21': '13,5 × 21 cm', '16x24': '16 × 24 cm'}),
        select('Kapak türü', 'coverType', const {'paperback': 'Karton kapak', 'hardcover': 'Sert kapak'}),
        select('Kağıt', 'paperType', const {'enzo': 'Enzo', 'ivory': 'Ivory', 'coated': 'Kuşe'}),
        select('İç baskı', 'color', const {'BW': 'Siyah beyaz', 'COLOR': 'Renkli'}),
        number('Tahmini baskı adedi', _printRun),
        number('Kapak çözünürlüğü (DPI)', _dpi),
        number('Taşma payı (mm)', _bleed),
        LabeledField(
          label: 'Örnek maliyet tarifesi',
          required: true,
          child: DropdownButtonFormField<String>(
            initialValue: _tariffId,
            isExpanded: true,
            hint: const Text('Tarife seçin'),
            items: [
              for (final tariff in widget.tariffs)
                DropdownMenuItem(
                  value: tariff['id'] as String,
                  child: Text('${tariff['version']} — ${tariff['label']}', overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (value) => setState(() => _tariffId = value),
          ),
        ),
        PdfUploadField(
          label: 'Kapak PDF (özel dosya, en fazla 10 MB)',
          value: jsonString(_spec['coverAssetId']).isEmpty ? null : jsonString(_spec['coverAssetId']),
          onChanged: (id) => setState(() => _spec['coverAssetId'] = id),
        ),
        LabeledField(
          label: 'Ek baskı tercihleri',
          child: TextField(controller: _notes, minLines: 2, maxLines: 6, maxLength: 2000),
        ),
        const Label('Eser ve izin beyanları · print-sandbox-v1', color: BetikColors.inkBlack),
        for (final entry in declarationLabels.entries)
          CheckboxListTile(
            value: _declarations[entry.key],
            onChanged: (value) => setState(() => _declarations[entry.key] = value ?? false),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(entry.value, style: sans(size: 12.5, height: 1.4)),
          ),
        const SizedBox(height: 8),
        BusyButton(expand: true, onPressed: complete ? _save : null, label: 'Basım sürümünü sabitle ve başvuruyu kaydet'),
      ],
    );
  }
}
