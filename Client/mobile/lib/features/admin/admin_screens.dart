import 'dart:async';
import 'dart:convert';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../funding/funding_shared.dart' show Notice, PanelCard, StatGrid;
import '../shell/shell.dart';

// The admin area talks to the same generic, schema-driven API as the
// website. Every operation is authorised again by the server
// (`requireAdmin`); the route guard only keeps non-admins from seeing
// screens that would fail.

const _resourcesQuery =
    'query GetAdminResources { getAdminResources { name label description canCreate indexes fields { name label type required editable enumValues reference sensitive maxLength } } }';

Future<List<Json>>? _resourcesFuture;
Future<List<Json>> loadAdminResources(GraphQLClient api, {bool refresh = false}) {
  if (refresh) _resourcesFuture = null;
  return _resourcesFuture ??= api
      .run(_resourcesQuery)
      .then(
        (data) => jsonList(data['getAdminResources']),
        onError: (Object error) {
          _resourcesFuture = null;
          throw error;
        },
      );
}

const _enumLabels = {
  'ADMIN': 'Yönetici', 'PUBLISHER': 'Yayınevi sahibi', 'USER': 'Kullanıcı', 'DRAFT': 'Taslak', 'WRITING': 'Yazılıyor', //
  'COMPLETED': 'Tamamlandı', 'FUNDING': 'Fonlanıyor', 'FUNDED': 'Fonlandı', 'PUBLISHED': 'Yayımlandı', 'PENDING': 'Bekliyor',
  'APPROVED': 'Onaylandı', 'REJECTED': 'Reddedildi', 'SUCCESS': 'Başarılı', 'FAILED': 'Başarısız', 'REFUNDED': 'İade edildi',
  'DIGITAL': 'Dijital', 'PRINTED': 'Basılı', 'OPEN': 'Herkese açık', 'PRIVATE': 'Özel', 'FOLLOWERS_ONLY': 'Takipçilere açık',
  'pending': 'Onay bekliyor', 'active': 'Aktif', 'unsubscribed': 'Abonelik iptal edildi',
};
String enumLabel(Object? value) => _enumLabels[value] ?? '${value ?? ''}';

/// Value at a dotted path (`privacySettings.isProfilePublic`).
Object? fieldValue(Object? values, String name) {
  Object? current = values;
  for (final part in name.split('.')) {
    if (current is! Map) return null;
    current = current[part];
  }
  return current;
}

String adminPreview(Object? value) {
  if (value == null || value == '') return '—';
  if (value is bool) return value ? 'Evet' : 'Hayır';
  if (value is List) return '${value.length} kayıt';
  if (value is Map) return jsonEncode(value);
  final text = '$value';
  // ISO dates and epoch-millisecond strings are shown as local dates.
  if (RegExp(r'^\d{4}-\d{2}-\d{2}T').hasMatch(text) || RegExp(r'^\d{13}$').hasMatch(text)) {
    final date = parseApiDate(value);
    if (date != null) return formatDateTime(date);
  }
  return enumLabel(text.length > 180 ? text.substring(0, 180) : text);
}

const _adminDestinations = [
  (Icons.print, 'Basım, Destek ve Ön Sipariş', '/admin/print-funding'),
  (Icons.people, 'Kullanıcılar', '/admin/data/User'),
  (Icons.menu_book, 'Kitaplar', '/admin/data/Book'),
  (Icons.category, 'Kitap Türleri', '/admin/data/Genre'),
  (Icons.storage, 'Bütün Veriler', '/admin/data'),
  (Icons.schema, 'Şemalar ve Alanlar', '/admin/schemas'),
  (Icons.account_balance, 'Finans', '/admin/data/Transaction'),
  (Icons.forum, 'Oturum İzinleri', '/admin/session-access'),
  (Icons.fact_check, 'Basılı Kitaplar ve Hak Talepleri', '/admin/printed-books'),
];

/// Yönetim Paneli (F-ADM-01): counters, review queues, legacy revenue,
/// latest audit entries and the admin navigation.
class AdminOverviewScreen extends StatelessWidget {
  const AdminOverviewScreen({super.key});

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Yönetim Paneli',
    body: Loader<Json>(
      load: () async {
        final data = await context.services.api.run('''query GetAdminOverview { getAdminOverview {
              counts { resource label total active } pendingBooks pendingPrintApplications pendingClaims pendingSessionAccess
              revenue { currency amount count } recent { id title revision values } } }''');
        return Map<String, dynamic>.from(data['getAdminOverview'] as Map);
      },
      builder: (context, overview, loader) {
        Widget queue(String title, Object? count, String path) => ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(title),
          trailing: Text('${jsonInt(count)}', style: serif(size: 17, weight: FontWeight.w700)),
          onTap: () => context.push(path),
        );
        final revenue = jsonList(overview['revenue']);
        return RefreshIndicator(
          onRefresh: () => loader.reload(silent: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              PanelCard(
                title: 'İnceleme bekleyenler',
                children: [
                  queue('Basım başvuruları', overview['pendingPrintApplications'], '/admin/print-funding'),
                  queue('Basılı kitap istekleri', overview['pendingBooks'], '/admin/printed-books'),
                  queue('Yazar hak talepleri', overview['pendingClaims'], '/admin/printed-books'),
                  queue('Oturum izni başvuruları', overview['pendingSessionAccess'], '/admin/session-access'),
                ],
              ),
              PanelCard(
                title: 'Kayıtlar',
                children: [
                  StatGrid([
                    for (final count in jsonList(overview['counts']))
                      (jsonString(count['label']), '${jsonInt(count['total'])} (${jsonInt(count['active'])} aktif / arşiv dışı)'),
                  ]),
                ],
              ),
              PanelCard(
                title: 'Başarılı ödemeler',
                children: [
                  if (revenue.isEmpty)
                    Text('Henüz başarılı ödeme yok.', style: sans(size: 13, color: BetikColors.ashGray))
                  else
                    for (final item in revenue)
                      Text(
                        '${jsonDouble(item['amount']).toStringAsFixed(2)} ${item['currency']} · ${jsonInt(item['count'])} işlem',
                        style: sans(size: 13.5),
                      ),
                ],
              ),
              PanelCard(
                title: 'Yönetim araçları',
                children: [
                  for (final (icon, title, path) in _adminDestinations)
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(icon),
                      title: Text(title),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push(path),
                    ),
                ],
              ),
              PanelCard(
                title: 'Son yönetim işlemleri',
                children: [
                  for (final record in jsonList(overview['recent']))
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(jsonString(record['title'])),
                      subtitle: Text(
                        '${adminPreview(fieldValue(record['values'], 'reason'))} · ${adminPreview(fieldValue(record['values'], 'createdAt'))}',
                      ),
                      onTap: () => context.push('/admin/data/AdminAudit?record=${record['id']}'),
                    ),
                ],
              ),
            ],
          ),
        );
      },
    ),
  );
}

const _columnsFor = {
  'User': ['username', 'email', 'role', 'isActive'],
  'Book': ['title', 'kind', 'status', 'isDeleted'],
  'Genre': ['name', 'slug', 'isActive'],
  'Transaction': ['amount', 'currency', 'status', 'createdAt'],
  'AdminAudit': ['resource', 'action', 'reason', 'createdAt'],
};

/// Columns shown in the record list (same choice as the website).
List<String> adminColumns(Json resource) {
  final fixed = _columnsFor[resource['name']];
  if (fixed != null) return fixed;
  return jsonList(resource['fields'])
      .where(
        (field) =>
            field['sensitive'] != true &&
            !jsonString(field['name']).startsWith('_') &&
            field['reference'] == null &&
            !jsonString(field['name']).contains('.') &&
            const {'String', 'Boolean', 'Number', 'Date'}.contains(field['type']),
      )
      .take(4)
      .map((field) => jsonString(field['name']))
      .toList();
}

/// Generic data browser (F-ADM-02, F-ADM-04, F-ADM-14).
class AdminDataScreen extends StatefulWidget {
  const AdminDataScreen({super.key, this.resource, this.schemaOnly = false, this.initialRecord, this.relatedField, this.relatedId});
  final String? resource;
  final bool schemaOnly;
  final String? initialRecord;
  final String? relatedField;
  final String? relatedId;

  @override
  State<AdminDataScreen> createState() => _AdminDataScreenState();
}

class _AdminDataScreenState extends State<AdminDataScreen> {
  late String _name = widget.resource ?? 'User';
  final _search = TextEditingController();
  String _query = '';
  String _state = 'ALL';
  int _page = 1;
  late bool _schema = widget.schemaOnly;
  int _version = 0;

  @override
  void initState() {
    super.initState();
    final record = widget.initialRecord;
    if (record != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _edit(record));
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _edit(String id) async {
    final saved = await context.push<bool>('/admin/record/$_name/$id');
    if (saved == true && mounted) setState(() => _version++);
  }

  @override
  Widget build(BuildContext context) {
    final api = context.services.api;
    return PageScaffold(
      title: widget.schemaOnly ? 'Veri Yapısı ve Şemalar' : 'Veri Yönetimi',
      body: Loader<List<Json>>(
        load: () => loadAdminResources(api),
        loadingLabel: 'Yönetim araçları yükleniyor...',
        builder: (context, resources, _) {
          final resource = resources.where((item) => item['name'] == _name).firstOrNull;
          if (resource == null) return const EmptyView(title: 'Veri grubu bulunamadı.');
          final columns = adminColumns(resource);
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              LabeledField(
                label: 'Veri grubu',
                child: DropdownButtonFormField<String>(
                  initialValue: _name,
                  isExpanded: true,
                  items: [
                    for (final item in resources)
                      DropdownMenuItem(
                        value: item['name'] as String,
                        child: Text(jsonString(item['label']), overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (value) => setState(() {
                    _name = value ?? _name;
                    _page = 1;
                    _query = '';
                    _search.clear();
                  }),
                ),
              ),
              Text(jsonString(resource['description']), style: sans(size: 12.5, color: BetikColors.graphite, height: 1.4)),
              const SizedBox(height: 8),
              if (!widget.schemaOnly)
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment(value: false, label: Text('Kayıtlar')),
                    ButtonSegment(value: true, label: Text('Şema ve alanlar')),
                  ],
                  selected: {_schema},
                  onSelectionChanged: (selection) => setState(() => _schema = selection.first),
                ),
              const SizedBox(height: 10),
              if (_schema)
                _SchemaView(resource: resource)
              else ...[
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _search,
                        maxLength: 120,
                        textInputAction: TextInputAction.search,
                        decoration: const InputDecoration(hintText: 'Ara', counterText: '', prefixIcon: Icon(Icons.search)),
                        onSubmitted: (value) => setState(() {
                          _query = value.trim();
                          _page = 1;
                        }),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.outlined(tooltip: 'Yenile', onPressed: () => setState(() => _version++), icon: const Icon(Icons.refresh)),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _state,
                  decoration: const InputDecoration(labelText: 'Durum'),
                  items: const [
                    DropdownMenuItem(value: 'ALL', child: Text('Tümü')),
                    DropdownMenuItem(value: 'ACTIVE', child: Text('Aktif / arşiv dışı')),
                    DropdownMenuItem(value: 'DELETED', child: Text('Kaldırılmış')),
                    DropdownMenuItem(value: 'INACTIVE', child: Text('Pasif')),
                  ],
                  onChanged: (value) => setState(() {
                    _state = value ?? 'ALL';
                    _page = 1;
                  }),
                ),
                const SizedBox(height: 8),
                if (resource['canCreate'] == true)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: () => _edit('new'),
                      icon: const Icon(Icons.add, size: 18),
                      label: Text(_name == 'Genre' ? 'YENİ TÜR EKLE' : 'YENİ KAYIT EKLE'),
                    ),
                  ),
                Loader<Json>(
                  key: ValueKey('$_name|$_page|$_query|$_state|$_version'),
                  load: () async {
                    final data = await api.run(
                      r'''query GetAdminRecords($resource: String!, $page: Int, $limit: Int, $search: String, $state: String, $relatedField: String, $relatedId: ID) {
                      getAdminRecords(resource: $resource, page: $page, limit: $limit, search: $search, state: $state, relatedField: $relatedField, relatedId: $relatedId) {
                        total page totalPages items { id title revision values }
                      }
                    }''',
                      variables: {
                        'resource': _name,
                        'page': _page,
                        'limit': 25,
                        'search': _query,
                        'state': _state,
                        if (widget.relatedField != null && widget.relatedId != null && _name == widget.resource) ...{
                          'relatedField': widget.relatedField,
                          'relatedId': widget.relatedId,
                        },
                      },
                    );
                    return Map<String, dynamic>.from(data['getAdminRecords'] as Map);
                  },
                  builder: (context, list, _) {
                    final items = jsonList(list['items']);
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text('${jsonInt(list['total'])} kayıt', style: sans(size: 12.5, color: BetikColors.ashGray)),
                        ),
                        if (items.isEmpty) const EmptyView(title: 'Kayıt bulunamadı.'),
                        // A dense table does not fit a phone: each record is a
                        // card with the same columns as label/value pairs.
                        for (final item in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: PaperCard(
                              padding: const EdgeInsets.all(12),
                              onTap: () => _edit(jsonString(item['id'])),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    jsonString(item['title']),
                                    style: serif(size: 15, weight: FontWeight.w700),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  for (final column in columns)
                                    Text(
                                      '$column: ${adminPreview(fieldValue(item['values'], column))}',
                                      style: sans(size: 12.5, color: BetikColors.graphite),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: Text('İNCELE / DÜZENLE', style: label(size: 10.5, color: BetikColors.rust)),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        PagerBar(
                          page: jsonInt(list['page'], 1),
                          totalPages: jsonInt(list['totalPages'], 1),
                          onPage: (page) => setState(() => _page = page),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _SchemaView extends StatelessWidget {
  const _SchemaView({required this.resource});
  final Json resource;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final field in jsonList(resource['fields']))
        Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: BetikColors.borderMedium)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${field['label']} (${field['name']})', style: sans(size: 13.5, weight: FontWeight.w700)),
              Text(
                [
                  'Tür: ${field['type']}',
                  'Zorunlu: ${field['required'] == true ? 'Evet' : 'Hayır'}',
                  field['editable'] == true ? 'Düzenlenebilir' : 'İşlem akışı / Salt okunur',
                  if (field['reference'] != null) 'İlişki: ${field['reference']}',
                  if (field['sensitive'] == true) 'Hassas (maskelenir)',
                  if (jsonIds(field['enumValues']).isNotEmpty) 'Değerler: ${jsonIds(field['enumValues']).join(', ')}',
                ].join(' · '),
                style: sans(size: 12.5, color: BetikColors.graphite, height: 1.4),
              ),
            ],
          ),
        ),
      ExpansionTile(
        tilePadding: EdgeInsets.zero,
        title: Text('Dizinler', style: sans(size: 13.5, weight: FontWeight.w600)),
        children: [
          SelectableText(
            const JsonEncoder.withIndent('  ').convert(resource['indexes']),
            style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5),
          ),
        ],
      ),
    ],
  );
}

const _printedOnlyBookFields = {
  'isbn', 'pageCount', 'printedAuthor', 'publisher', 'publicationYear', 'purchaseUrl', 'publicationEvidenceUrl', //
};
const _longTextFields = {'content', 'text', 'description', 'bio', 'message', 'note'};

/// Record editor (F-ADM-03): only changed fields are sent, with a mandatory
/// reason (5–500 characters) and the record's `revision`; a stale revision
/// answers `CONFLICT` and the editor offers to reload.
class AdminRecordEditorScreen extends StatefulWidget {
  const AdminRecordEditorScreen({super.key, required this.resource, required this.id});
  final String resource;
  final String id;

  @override
  State<AdminRecordEditorScreen> createState() => _AdminRecordEditorScreenState();
}

class _AdminRecordEditorScreenState extends State<AdminRecordEditorScreen> {
  final _loader = GlobalKey<LoaderState<(Json, Json?)>>();
  final _reason = TextEditingController();
  final Map<String, Object?> _changes = {};
  final Map<String, TextEditingController> _text = {};
  String? _failure;
  bool _conflict = false;

  bool get _creating => widget.id == 'new';

  @override
  void dispose() {
    _reason.dispose();
    for (final controller in _text.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<(Json, Json?)> _load() async {
    final api = context.services.api;
    final resources = await loadAdminResources(api);
    final resource = resources.firstWhere(
      (item) => item['name'] == widget.resource,
      orElse: () => throw ApiException(ApiErrorKind.notFound, 'Veri grubu bulunamadı.'),
    );
    if (_creating) return (resource, null);
    final data = await api.run(
      r'query GetAdminRecord($resource: String!, $id: ID!) { getAdminRecord(resource: $resource, id: $id) { id title revision values references { field resource id title exists } } }',
      variables: {'resource': widget.resource, 'id': widget.id},
    );
    final record = jsonMap(data['getAdminRecord']);
    if (record == null) throw ApiException(ApiErrorKind.notFound, 'Kayıt bulunamadı.');
    return (resource, record);
  }

  void _set(String field, Object? value) => setState(() => _changes[field] = value);

  Future<void> _save(Json? record) async {
    final reason = _reason.text.trim();
    final updates = <String, Object?>{
      for (final entry in _changes.entries)
        if (_creating || jsonEncode(entry.value) != jsonEncode(fieldValue(record?['values'], entry.key))) entry.key: entry.value,
    };
    if (updates.isEmpty) return setState(() => _failure = 'Kaydetmek için en az bir alanı değiştirin.');
    if (reason.length < 5 || reason.length > 500) return setState(() => _failure = 'İşlem gerekçesi 5–500 karakter olmalıdır.');
    setState(() {
      _failure = null;
      _conflict = false;
    });
    try {
      await context.services.api.run(
        r'mutation SaveAdminRecord($resource: String!, $id: ID, $revision: String, $changes: JSON!, $reason: String!) { saveAdminRecord(resource: $resource, id: $id, revision: $revision, changes: $changes, reason: $reason) { id title revision values } }',
        variables: {
          'resource': widget.resource,
          'id': _creating ? null : widget.id,
          'revision': record?['revision'],
          'changes': updates,
          'reason': reason,
        },
      );
      if (!mounted) return;
      context.services.invalidateData();
      showToast(context, 'Kayıt güncellendi.', type: ToastType.success);
      context.pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _conflict = error.isConflict;
        _failure = error.message;
      });
    }
  }

  Future<bool> _confirmDiscard() async =>
      _changes.isEmpty || await confirm(context, 'Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?', confirmLabel: 'Çık');

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: _changes.isEmpty,
    onPopInvokedWithResult: (didPop, _) async {
      if (didPop) return;
      final navigator = Navigator.of(context);
      if (await _confirmDiscard()) navigator.pop();
    },
    child: PageScaffold(
      title: _creating ? 'Yeni Kayıt' : 'Kaydı Düzenle',
      body: Loader<(Json, Json?)>(
        key: _loader,
        load: _load,
        builder: (context, data, loader) {
          final (resource, record) = data;
          final values = jsonMap(record?['values']) ?? const {};
          final references = jsonList(record?['references']);
          final fields = jsonList(resource['fields']).where(
            (field) =>
                field['editable'] == true &&
                field['sensitive'] != true &&
                !(widget.resource == 'Book' && values['kind'] != 'PRINTED' && _printedOnlyBookFields.contains(field['name'])),
          );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              Text(
                record == null ? jsonString(resource['label']) : jsonString(record['title']),
                style: serif(size: 20, weight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              for (final field in fields)
                LabeledField(
                  label: jsonString(field['label'], jsonString(field['name'])),
                  required: field['required'] == true,
                  child: _fieldInput(field, values, references),
                ),
              LabeledField(
                label: 'İşlem gerekçesi',
                required: true,
                hint: 'Denetim kaydına yazılır (5–500 karakter).',
                child: TextField(controller: _reason, minLines: 2, maxLines: 4, maxLength: 500),
              ),
              if (_failure != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Notice(_failure!, error: true)),
              if (_conflict)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _changes.clear();
                        for (final controller in _text.values) {
                          controller.dispose();
                        }
                        _text.clear();
                        _conflict = false;
                        _failure = null;
                      });
                      loader.reload();
                    },
                    child: const Text('GÜNCEL KAYDI YENİDEN YÜKLE'),
                  ),
                ),
              BusyButton(onPressed: () => _save(record), label: 'Değişiklikleri kaydet'),
              if (record != null) ...[
                const SizedBox(height: 16),
                if (widget.resource == 'Book')
                  OutlinedButton(
                    onPressed: () => context.push('/dashboard/${widget.id}'),
                    child: const Text('BÖLÜMLER VE YAYIN İŞLEMLERİ'),
                  ),
                if (references.isNotEmpty)
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: Text('İlişkili kayıtlar', style: sans(size: 13.5, weight: FontWeight.w600)),
                    children: [
                      for (final reference in references)
                        ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          title: Text('${reference['field']}: ${reference['title']}'),
                          subtitle: Text('${reference['resource']}${reference['exists'] == false ? ' · kayıt bulunamadı' : ''}'),
                          onTap: reference['exists'] == false
                              ? null
                              : () => context.push('/admin/record/${reference['resource']}/${reference['id']}'),
                        ),
                    ],
                  ),
                TextButton(
                  onPressed: () => context.push('/admin/data/AdminAudit?relatedField=recordId&relatedId=${widget.id}'),
                  child: const Text('Bu kaydın denetim geçmişi'),
                ),
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: Text('Tüm kayıt alanları', style: sans(size: 13.5, weight: FontWeight.w600)),
                  children: [
                    SelectableText(
                      const JsonEncoder.withIndent('  ').convert(values),
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5),
                    ),
                  ],
                ),
              ],
            ],
          );
        },
      ),
    ),
  );

  Widget _fieldInput(Json field, Json values, List<Json> references) {
    final name = jsonString(field['name']);
    final type = jsonString(field['type']);
    final enums = jsonIds(field['enumValues']);
    final current = _changes.containsKey(name) ? _changes[name] : fieldValue(values, name);

    if (field['reference'] != null && (type == 'ObjectId' || type == 'Array')) {
      return _ReferencePicker(
        resource: jsonString(field['reference']),
        multiple: type == 'Array',
        value: current,
        labels: {
          for (final reference in references.where((r) => r['field'] == name)) jsonString(reference['id']): jsonString(reference['title']),
        },
        relatedBook: field['reference'] == 'Chapter' ? values['bookId'] as String? : null,
        onChanged: (value) => _set(name, value),
      );
    }
    if (type == 'Boolean') {
      return SwitchListTile(
        value: current == true,
        onChanged: (value) => _set(name, value),
        contentPadding: EdgeInsets.zero,
        title: Text(current == true ? 'Evet' : 'Hayır'),
      );
    }
    if (enums.isNotEmpty) {
      return DropdownButtonFormField<String>(
        initialValue: current is String && current.isNotEmpty ? current : null,
        isExpanded: true,
        hint: const Text('Seçin'),
        items: [
          if (current is String && current.isNotEmpty && !enums.contains(current))
            DropdownMenuItem(value: current, child: Text('${enumLabel(current)} (mevcut)')),
          for (final option in enums) DropdownMenuItem(value: option, child: Text(enumLabel(option))),
        ],
        onChanged: (value) => _set(name, value),
      );
    }
    final controller = _text.putIfAbsent(
      name,
      () =>
          TextEditingController(text: type == 'Array' ? (current is List ? current.join('\n') : '') : (current == null ? '' : '$current')),
    );
    if (type == 'Number') {
      return TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: (text) => _set(name, text.trim().isEmpty ? null : num.tryParse(text.trim().replaceAll(',', '.'))),
      );
    }
    if (type == 'Array') {
      return TextField(
        controller: controller,
        minLines: 3,
        maxLines: 8,
        decoration: const InputDecoration(hintText: 'Her satıra bir değer'),
        onChanged: (text) => _set(name, text.split('\n').map((item) => item.trim()).where((item) => item.isNotEmpty).toList()),
      );
    }
    final long = _longTextFields.contains(name);
    final maxLength = field['maxLength'] is num ? jsonInt(field['maxLength']) : null;
    return TextField(
      controller: controller,
      minLines: long ? (name == 'content' ? 8 : 3) : 1,
      maxLines: long ? 16 : 1,
      maxLength: maxLength != null && maxLength <= 5000 ? maxLength : null,
      keyboardType: name == 'email' ? TextInputType.emailAddress : TextInputType.text,
      onChanged: (text) => _set(name, text),
    );
  }
}

class _ReferencePicker extends StatefulWidget {
  const _ReferencePicker({
    required this.resource,
    required this.multiple,
    required this.value,
    required this.labels,
    required this.onChanged,
    this.relatedBook,
  });
  final String resource;
  final bool multiple;
  final Object? value;
  final Map<String, String> labels;
  final String? relatedBook;
  final ValueChanged<Object?> onChanged;

  @override
  State<_ReferencePicker> createState() => _ReferencePickerState();
}

class _ReferencePickerState extends State<_ReferencePicker> {
  final _search = TextEditingController();
  Timer? _debounce;
  List<Json> _choices = const [];
  bool _error = false;
  late final Map<String, String> _labels = {...widget.labels};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await context.services.api.run(
        r'''query GetAdminRecords($resource: String!, $page: Int, $limit: Int, $search: String, $state: String, $relatedField: String, $relatedId: ID) {
          getAdminRecords(resource: $resource, page: $page, limit: $limit, search: $search, state: $state, relatedField: $relatedField, relatedId: $relatedId) { items { id title } }
        }''',
        variables: {
          'resource': widget.resource,
          'page': 1,
          'limit': 25,
          'search': _search.text.trim(),
          'state': 'ACTIVE',
          if (widget.relatedBook != null) ...{'relatedField': 'bookId', 'relatedId': widget.relatedBook},
        },
      );
      if (!mounted) return;
      setState(() {
        _choices = jsonList(jsonMap(data['getAdminRecords'])?['items']);
        for (final item in _choices) {
          _labels[jsonString(item['id'])] = jsonString(item['title']);
        }
        _error = false;
      });
    } on ApiException {
      if (mounted) setState(() => _error = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.multiple ? jsonIds(widget.value) : <String>[];
    final single = widget.multiple ? null : (widget.value is String && (widget.value as String).isNotEmpty ? widget.value as String : null);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _search,
          decoration: InputDecoration(hintText: widget.multiple ? 'Ad veya başlıkla ara' : 'Kayıt adı veya kimliğiyle ara'),
          onChanged: (_) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 250), _load);
          },
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String?>(
          key: ValueKey('${widget.multiple ? selected.join(',') : single}|${_choices.length}'),
          initialValue: widget.multiple ? null : single,
          isExpanded: true,
          hint: Text(widget.multiple ? 'Eklenecek kaydı seçin' : 'Seçin'),
          items: [
            if (!widget.multiple) const DropdownMenuItem<String?>(value: null, child: Text('Seçin')),
            if (single != null && !_choices.any((item) => item['id'] == single))
              DropdownMenuItem<String?>(
                value: single,
                child: Text('${_labels[single] ?? single} (mevcut kayıt)', overflow: TextOverflow.ellipsis),
              ),
            for (final item in _choices)
              if (!selected.contains(item['id']))
                DropdownMenuItem<String?>(
                  value: item['id'] as String,
                  child: Text(jsonString(item['title']), overflow: TextOverflow.ellipsis),
                ),
          ],
          onChanged: (value) {
            if (widget.multiple) {
              if (value != null) widget.onChanged([...selected, value]);
            } else {
              widget.onChanged(value);
            }
          },
        ),
        if (widget.multiple)
          Wrap(
            spacing: 6,
            children: [
              for (final id in selected)
                InputChip(label: Text(_labels[id] ?? id), onDeleted: () => widget.onChanged(selected.where((item) => item != id).toList())),
            ],
          ),
        if (_error) Text('İlişkili kayıtlar yüklenemedi.', style: sans(size: 12.5, color: BetikColors.danger)),
      ],
    );
  }
}

/// Oturum İzinleri (F-ADM-06).
class AdminSessionAccessScreen extends StatefulWidget {
  const AdminSessionAccessScreen({super.key});
  @override
  State<AdminSessionAccessScreen> createState() => _AdminSessionAccessScreenState();
}

class _AdminSessionAccessScreenState extends State<AdminSessionAccessScreen> {
  String _status = 'PENDING';
  int _page = 1;
  int _version = 0;
  final Map<String, TextEditingController> _notes = {};

  @override
  void dispose() {
    for (final controller in _notes.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _review(Json item, bool approve) async {
    final userId = jsonString(jsonMap(item['user'])?['id']);
    final note = _notes[userId]?.text.trim() ?? '';
    // A note of at least 5 characters is required to reject or revoke.
    if (!approve && note.length < 5) {
      return showToast(context, 'Reddetmek veya izni kaldırmak için en az 5 karakterlik bir not yazın.', type: ToastType.error);
    }
    try {
      await context.services.api.run(
        r'mutation ReviewSessionAccess($userId: ID!, $revision: Int!, $approve: Boolean!, $note: String) { reviewSessionCreationAccess(userId: $userId, revision: $revision, approve: $approve, note: $note) { status revision } }',
        variables: {'userId': userId, 'revision': item['revision'], 'approve': approve, 'note': note},
      );
      if (!mounted) return;
      showToast(context, approve ? 'Oturum açma izni verildi.' : 'Başvuru reddedildi / izin kaldırıldı.', type: ToastType.success);
      setState(() => _version++);
    } on ApiException catch (error) {
      if (!mounted) return;
      showToast(
        context,
        error.isConflict ? 'Kayıt başka bir işlemle değişti. Liste yenilendi; lütfen yeniden deneyin.' : error.message,
        type: ToastType.error,
      );
      if (error.isConflict) setState(() => _version++);
    }
  }

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Oturum İzinleri',
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        DropdownButtonFormField<String>(
          initialValue: _status,
          decoration: const InputDecoration(labelText: 'Durum'),
          items: const [
            DropdownMenuItem(value: 'PENDING', child: Text('Onay bekleyenler')),
            DropdownMenuItem(value: 'APPROVED', child: Text('İzin verilenler')),
            DropdownMenuItem(value: 'REJECTED', child: Text('Reddedilen / izni kaldırılanlar')),
          ],
          onChanged: (value) => setState(() {
            _status = value ?? 'PENDING';
            _page = 1;
          }),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton(onPressed: () => setState(() => _version++), child: const Text('LİSTEYİ YENİLE')),
        ),
        const SizedBox(height: 8),
        Loader<Json>(
          key: ValueKey('$_status|$_page|$_version'),
          pollEvery: const Duration(seconds: 30),
          load: () async {
            final data = await context.services.api.run(
              r'''query SessionAccessRequests($status: SessionAccessStatus!, $page: Int!) {
                  sessionAccessRequests(status: $status, page: $page) {
                    items { status reason requestedAt reviewedAt reviewNote revision user { id username fullName email } }
                    total page totalPages
                  }
                }''',
              variables: {'status': _status, 'page': _page},
            );
            return Map<String, dynamic>.from(data['sessionAccessRequests'] as Map);
          },
          builder: (context, data, _) {
            final items = jsonList(data['items']);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (items.isEmpty) const EmptyView(title: 'Bu durumda başvuru yok.'),
                for (final item in items)
                  () {
                    final user = jsonMap(item['user']) ?? const {};
                    final note = _notes.putIfAbsent(jsonString(user['id']), TextEditingController.new);
                    return PanelCard(
                      title: jsonString(user['fullName']).isEmpty ? '@${user['username']}' : jsonString(user['fullName']),
                      children: [
                        Text('@${user['username']} · ${user['email'] ?? ''}', style: sans(size: 12.5, color: BetikColors.graphite)),
                        Text(
                          'Başvuru: ${formatDateTime(parseApiDate(item['requestedAt']))}',
                          style: sans(size: 12.5, color: BetikColors.ashGray),
                        ),
                        const SizedBox(height: 6),
                        Text(jsonString(item['reason']), style: serif(size: 14, height: 1.5)),
                        if (jsonString(item['reviewNote']).isNotEmpty)
                          Padding(padding: const EdgeInsets.only(top: 6), child: Notice('Not: ${item['reviewNote']}')),
                        const SizedBox(height: 8),
                        TextField(
                          controller: note,
                          maxLength: 500,
                          decoration: const InputDecoration(hintText: 'Yönetici notu'),
                        ),
                        Wrap(
                          spacing: 8,
                          children: [
                            if (_status != 'APPROVED') FilledButton(onPressed: () => _review(item, true), child: const Text('ONAYLA')),
                            if (_status != 'REJECTED')
                              OutlinedButton(
                                onPressed: () => _review(item, false),
                                child: Text(_status == 'APPROVED' ? 'İZNİ KALDIR' : 'REDDET'),
                              ),
                          ],
                        ),
                      ],
                    );
                  }(),
                PagerBar(
                  page: jsonInt(data['page'], 1),
                  totalPages: jsonInt(data['totalPages'], 1),
                  onPage: (page) => setState(() => _page = page),
                ),
              ],
            );
          },
        ),
      ],
    ),
  );
}

/// Basılı Kitaplar ve Hak Talepleri (F-ADM-05): two queues polled every
/// 30 s.
class AdminPrintedBooksScreen extends StatefulWidget {
  const AdminPrintedBooksScreen({super.key});
  @override
  State<AdminPrintedBooksScreen> createState() => _AdminPrintedBooksScreenState();
}

class _AdminPrintedBooksScreenState extends State<AdminPrintedBooksScreen> {
  final _loader = GlobalKey<LoaderState<Json>>();
  final Map<String, TextEditingController> _notes = {};

  @override
  void dispose() {
    for (final controller in _notes.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _review(String document, Json variables, {required bool approve, required String key}) async {
    final note = _notes[key]?.text.trim() ?? '';
    if (!approve && note.isEmpty) {
      return showToast(context, 'Reddetmek için bir not yazın; istek sahibine gösterilir.', type: ToastType.error);
    }
    try {
      await context.services.api.run(document, variables: {...variables, 'approve': approve, 'note': note});
      if (!mounted) return;
      showToast(context, 'İşlem kaydedildi.', type: ToastType.success);
      context.services.invalidateData();
      await _loader.currentState?.reload(silent: true);
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Basılı Kitaplar ve Hak Talepleri',
    body: Loader<Json>(
      key: _loader,
      pollEvery: const Duration(seconds: 30),
      load: () => context.services.api.run('''query GetPrintedReviews {
            getPrintedBookReviews { publicPath id title isbn printedAuthor publisher publicationYear pageCount description imageUrl purchaseUrl publicationEvidenceUrl submittedBy { id username fullName } }
            getBookClaimReviews { id evidence evidenceUrl status createdAt claimant { id username fullName } book { publicPath id title isbn printedAuthor } }
          }'''),
      builder: (context, data, loader) {
        final books = jsonList(data['getPrintedBookReviews']);
        final claims = jsonList(data['getBookClaimReviews']);
        Widget noteField(String key) => Padding(
          padding: const EdgeInsets.only(top: 8),
          child: TextField(
            controller: _notes.putIfAbsent(key, TextEditingController.new),
            maxLength: 1000,
            minLines: 1,
            maxLines: 3,
            decoration: const InputDecoration(hintText: 'İnceleme notu'),
          ),
        );
        return RefreshIndicator(
          onRefresh: () => loader.reload(silent: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              Text('Kitap ekleme istekleri', style: serif(size: 19, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (books.isEmpty) Text('Bekleyen istek yok.', style: sans(size: 13, color: BetikColors.ashGray)),
              for (final book in books)
                PanelCard(
                  title: jsonString(book['title']),
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        BookCover(jsonString(book['imageUrl']), width: 56),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${book['printedAuthor'] ?? ''} · ${book['publisher'] ?? ''} · ${book['publicationYear'] ?? ''}\n${jsonInt(book['pageCount'])} sayfa · ISBN: ${book['isbn'] ?? '—'}\nGönderen: @${jsonMap(book['submittedBy'])?['username'] ?? ''}',
                            style: sans(size: 12.5, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      jsonString(book['description']),
                      style: serif(size: 13.5, height: 1.45),
                      maxLines: 6,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Wrap(
                      spacing: 4,
                      children: [
                        TextButton(onPressed: () => context.push('/book/${book['id']}'), child: const Text('Önizle')),
                        if (jsonString(book['publicationEvidenceUrl']).isNotEmpty)
                          TextButton(
                            onPressed: () => openExternal(context, jsonString(book['publicationEvidenceUrl'])),
                            child: const Text('Yayın kanıtı ↗'),
                          ),
                        if (jsonString(book['purchaseUrl']).isNotEmpty)
                          TextButton(
                            onPressed: () => openExternal(context, jsonString(book['purchaseUrl'])),
                            child: const Text('Satın alma ↗'),
                          ),
                      ],
                    ),
                    noteField('book:${book['id']}'),
                    Wrap(
                      spacing: 8,
                      children: [
                        for (final approve in const [true, false])
                          approve
                              ? FilledButton(
                                  onPressed: () => _review(
                                    r'mutation ReviewPrintedBook($bookId: ID!, $approve: Boolean!, $note: String) { reviewPrintedBook(bookId: $bookId, approve: $approve, note: $note) { id publicationStatus reviewNote } }',
                                    {'bookId': book['id']},
                                    approve: true,
                                    key: 'book:${book['id']}',
                                  ),
                                  child: const Text('ONAYLA'),
                                )
                              : OutlinedButton(
                                  onPressed: () => _review(
                                    r'mutation ReviewPrintedBook($bookId: ID!, $approve: Boolean!, $note: String) { reviewPrintedBook(bookId: $bookId, approve: $approve, note: $note) { id publicationStatus reviewNote } }',
                                    {'bookId': book['id']},
                                    approve: false,
                                    key: 'book:${book['id']}',
                                  ),
                                  child: const Text('REDDET'),
                                ),
                      ],
                    ),
                  ],
                ),
              const SizedBox(height: 12),
              Text('Yazar hak talepleri', style: serif(size: 19, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (claims.isEmpty) Text('Bekleyen talep yok.', style: sans(size: 13, color: BetikColors.ashGray)),
              for (final claim in claims)
                PanelCard(
                  title: jsonString(jsonMap(claim['book'])?['title']),
                  children: [
                    Text(
                      'Talep eden: @${jsonMap(claim['claimant'])?['username'] ?? ''} · ${formatDateTime(parseApiDate(claim['createdAt']))}',
                      style: sans(size: 12.5, color: BetikColors.graphite),
                    ),
                    const SizedBox(height: 6),
                    Text(jsonString(claim['evidence']), style: serif(size: 13.5, height: 1.5)),
                    if (jsonString(claim['evidenceUrl']).isNotEmpty)
                      TextButton(
                        onPressed: () => openExternal(context, jsonString(claim['evidenceUrl'])),
                        child: const Text('Destekleyici bağlantı ↗'),
                      ),
                    // Approving assigns the claimant as the book's author.
                    noteField('claim:${claim['id']}'),
                    Wrap(
                      spacing: 8,
                      children: [
                        FilledButton(
                          onPressed: () => _review(
                            r'mutation ReviewBookClaim($claimId: ID!, $approve: Boolean!, $note: String) { reviewBookClaim(claimId: $claimId, approve: $approve, note: $note) { id status reviewNote } }',
                            {'claimId': claim['id']},
                            approve: true,
                            key: 'claim:${claim['id']}',
                          ),
                          child: const Text('ONAYLA'),
                        ),
                        OutlinedButton(
                          onPressed: () => _review(
                            r'mutation ReviewBookClaim($claimId: ID!, $approve: Boolean!, $note: String) { reviewBookClaim(claimId: $claimId, approve: $approve, note: $note) { id status reviewNote } }',
                            {'claimId': claim['id']},
                            approve: false,
                            key: 'claim:${claim['id']}',
                          ),
                          child: const Text('REDDET'),
                        ),
                      ],
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    ),
  );
}

/// Yayınevi Portalı (F-PUB-01): read-only catalogue for `PUBLISHER` and
/// `ADMIN`, refreshed every 30 s.
class PublisherPortalScreen extends StatefulWidget {
  const PublisherPortalScreen({super.key});
  @override
  State<PublisherPortalScreen> createState() => _PublisherPortalScreenState();
}

class _PublisherPortalScreenState extends State<PublisherPortalScreen> {
  final _search = TextEditingController();
  String _query = '';
  String _funding = 'ALL';
  int _page = 1;
  int _version = 0;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Yayınevi Portalı',
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _search,
                maxLength: 100,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(hintText: 'Kitap veya yazar ara', counterText: ''),
                onSubmitted: (value) => setState(() {
                  _query = value.trim();
                  _page = 1;
                }),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: () => setState(() {
                _query = _search.text.trim();
                _page = 1;
              }),
              child: const Text('ARA'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _funding,
          decoration: const InputDecoration(labelText: 'Destek durumu'),
          items: const [
            DropdownMenuItem(value: 'ALL', child: Text('Tüm dijital kitaplar')),
            DropdownMenuItem(value: 'HAS_CAMPAIGN', child: Text('Kampanya açılmış kitaplar')),
            DropdownMenuItem(value: 'ACTIVE', child: Text('Desteğe açık')),
            DropdownMenuItem(value: 'SUCCEEDED', child: Text('Hedefe ulaşan')),
          ],
          onChanged: (value) => setState(() {
            _funding = value ?? 'ALL';
            _page = 1;
          }),
        ),
        Row(
          children: [
            Expanded(
              child: Text('Destek tutarları 30 saniyede bir güncellenir', style: sans(size: 12, color: BetikColors.ashGray)),
            ),
            TextButton(onPressed: () => setState(() => _version++), child: const Text('Yenile')),
            TextButton(
              onPressed: () => setState(() {
                _search.clear();
                _query = '';
                _funding = 'ALL';
                _page = 1;
              }),
              child: const Text('Filtreleri temizle'),
            ),
          ],
        ),
        Loader<Json>(
          key: ValueKey('$_query|$_funding|$_page|$_version'),
          pollEvery: const Duration(seconds: 30),
          load: () async {
            final data = await context.services.api.run(
              r'''query PublisherCatalog($page: Int!, $limit: Int!, $search: String!, $funding: PublisherFundingFilter!) {
                  publisherCatalog(page: $page, limit: $limit, search: $search, funding: $funding) {
                    total page totalPages refreshedAt
                    items { id urlSlug title imageUrl authorName writingStatus publishDate campaign { id state environment targetMinor acceptedMinor supporterCount endsAt updatedAt } }
                  }
                }''',
              variables: {'page': _page, 'limit': 20, 'search': _query, 'funding': _funding},
            );
            return Map<String, dynamic>.from(data['publisherCatalog'] as Map);
          },
          errorBuilder: (context, error, retry) => ErrorView(
            message: error is ApiException && error.isNetwork
                ? error.message
                : 'Portal verileri alınamadı. Erişiminiz değiştiyse yeniden giriş yapın.',
            onRetry: retry,
          ),
          builder: (context, data, _) {
            final items = jsonList(data['items']);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('${jsonInt(data['total'])} kitap', style: sans(size: 12.5, color: BetikColors.ashGray)),
                const SizedBox(height: 8),
                if (items.isEmpty) const EmptyView(title: 'Bu filtrelerle eşleşen kitap yok.'),
                for (final item in items)
                  () {
                    final campaign = jsonMap(item['campaign']);
                    final target = jsonInt(campaign?['targetMinor']);
                    final accepted = jsonInt(campaign?['acceptedMinor']);
                    final ended =
                        campaign != null &&
                        campaign['state'] == 'ACTIVE' &&
                        (parseApiDate(campaign['endsAt'])?.isBefore(DateTime.now()) ?? false);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: PaperCard(
                        onTap: () => context.push('/book/${item['id']}'),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            BookCover(jsonString(item['imageUrl']), width: 56),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item['writingStatus'] == 'COMPLETED' ? 'YAZIMI TAMAMLANDI' : 'YAZIMI SÜRÜYOR',
                                    style: label(size: 10.5),
                                  ),
                                  Text(jsonString(item['title']), style: serif(size: 15.5, weight: FontWeight.w700)),
                                  Text(jsonString(item['authorName']), style: sans(size: 12.5, color: BetikColors.graphite)),
                                  Text(
                                    'Dijital yayın: ${formatDate(parseApiDate(item['publishDate']))}',
                                    style: sans(size: 12, color: BetikColors.ashGray),
                                  ),
                                  if (campaign != null) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      ended
                                          ? 'Süre doldu · Kapanış bekleniyor'
                                          : const {
                                                  'ACTIVE': 'Kampanya açık', 'SUCCEEDED': 'Başarıyla tamamlandı', 'FAILED': 'Başarısız', //
                                                  'CANCELLED': 'İptal edildi', 'CLOSING': 'Kapanıyor / Uzlaştırılıyor',
                                                }[campaign['state']] ??
                                                '${campaign['state']}',
                                      style: sans(size: 12.5, weight: FontWeight.w700),
                                    ),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(3),
                                      child: LinearProgressIndicator(
                                        value: target <= 0 ? 0 : (accepted / target).clamp(0, 1).toDouble(),
                                        minHeight: 6,
                                      ),
                                    ),
                                    Text(
                                      '${formatMoney(accepted)} / ${formatMoney(target)} · ${jsonInt(campaign['supporterCount'])} destekçi · Bitiş: ${formatDate(parseApiDate(campaign['endsAt']))}',
                                      style: sans(size: 12, color: BetikColors.graphite),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }(),
                PagerBar(
                  page: jsonInt(data['page'], 1),
                  totalPages: jsonInt(data['totalPages'], 1),
                  onPage: (page) => setState(() => _page = page),
                ),
              ],
            );
          },
        ),
      ],
    ),
  );
}
