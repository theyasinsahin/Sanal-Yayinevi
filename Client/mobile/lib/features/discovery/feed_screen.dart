import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/models/models.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../book/book_card.dart';

const bookFeedQuery =
    '''
query GetBookFeed(\$limit: Int, \$after: String, \$sort: BookSort, \$classification: ClassificationFilter, \$search: String, \$funding: BookFundingFilter) {
  getBookFeed(limit: \$limit, after: \$after, sort: \$sort, classification: \$classification, search: \$search, funding: \$funding) {
    books { $bookCardFields }
    endCursor hasNextPage
  }
}''';

const sortLabels = {
  'NEWEST': 'En Yeni',
  'POPULAR': 'En Popüler',
  'OLDEST': 'En Eski',
  'UPDATED': 'En Son Güncellenen',
  'CLOSEST_TO_TARGET': 'Hedefe en yakın',
};

const fundingLabels = {'ALL': 'Tüm kitaplar', 'ACTIVE': 'Desteği açık kitaplar', 'FUNDED': 'Hedefini tamamlayan kitaplar'};

/// Single-select classification filter (slugs), shared by the feed and the
/// printed catalogue.
class ClassificationFilterValue {
  const ClassificationFilterValue({this.format, this.genre, this.feature, this.audience, this.tag});
  final String? format;
  final String? genre;
  final String? feature;
  final String? audience;
  final String? tag;

  bool get isEmpty => format == null && genre == null && feature == null && audience == null && tag == null;

  /// `ClassificationFilter` input, or null when nothing is selected.
  Json? toInput() => isEmpty
      ? null
      : {
          if (format != null) 'formats': [format],
          if (genre != null) 'genres': [genre],
          if (feature != null) 'features': [feature],
          if (audience != null) 'audiences': [audience],
          if (tag != null) 'tags': [tag],
        };

  ClassificationFilterValue copyWith({
    String? Function()? format,
    String? Function()? genre,
    String? Function()? feature,
    String? Function()? audience,
    String? Function()? tag,
  }) => ClassificationFilterValue(
    format: format == null ? this.format : format(),
    genre: genre == null ? this.genre : genre(),
    feature: feature == null ? this.feature : feature(),
    audience: audience == null ? this.audience : audience(),
    tag: tag == null ? this.tag : tag(),
  );
}

/// In-memory feed filter state (the web's `FiltersContext`): lost on
/// restart, shared by every screen that shows the feed.
class FeedFilters extends ChangeNotifier {
  String search = '';
  String sort = 'NEWEST';
  String funding = 'ALL';
  ClassificationFilterValue classification = const ClassificationFilterValue();
  String _fundingBeforeClosest = 'ALL';

  void setSearch(String value) {
    final next = value.length > 100 ? value.substring(0, 100) : value;
    if (next == search) return;
    search = next;
    notifyListeners();
  }

  /// "Hedefe en yakın" only makes sense for open campaigns: the server
  /// forces `funding = ACTIVE` for it. The website leaves the support
  /// filter on ACTIVE after the user picks another sort (Stage 2 B-11); the
  /// app restores the filter the user had chosen before.
  void setSort(String value) {
    if (value == sort) return;
    if (value == 'CLOSEST_TO_TARGET') {
      _fundingBeforeClosest = funding;
      funding = 'ACTIVE';
    } else if (sort == 'CLOSEST_TO_TARGET') {
      funding = _fundingBeforeClosest;
    }
    sort = value;
    notifyListeners();
  }

  void setFunding(String value) {
    if (value == funding) return;
    funding = value;
    if (value != 'ACTIVE' && sort == 'CLOSEST_TO_TARGET') sort = 'NEWEST';
    _fundingBeforeClosest = value;
    notifyListeners();
  }

  void setClassification(ClassificationFilterValue value) {
    classification = value;
    notifyListeners();
  }

  void reset() {
    search = '';
    sort = 'NEWEST';
    funding = 'ALL';
    _fundingBeforeClosest = 'ALL';
    classification = const ClassificationFilterValue();
    notifyListeners();
  }

  int get activeCount =>
      (sort == 'NEWEST' ? 0 : 1) +
      (funding == 'ALL' ? 0 : 1) +
      [
        classification.format,
        classification.genre,
        classification.feature,
        classification.audience,
        classification.tag,
      ].where((value) => value != null).length;

  String get title => switch (funding) {
    'ACTIVE' => 'Desteği Açık Kitaplar',
    'FUNDED' => 'Hedefini Tamamlayan Kitaplar',
    _ => 'Keşfet',
  };
}

/// Cursor-paged feed loader with de-duplication; a response that belongs
/// to an older filter state is discarded.
class BookFeedController extends ChangeNotifier {
  BookFeedController(this._api, {this.pageSize = 24});

  final GraphQLClient _api;
  final int pageSize;
  final List<Book> books = [];
  String? _cursor;
  bool hasNext = false;
  bool loading = false;
  bool loadingMore = false;
  Object? error;
  Object? moreError;
  int _generation = 0;
  Json _variables = const {};
  bool _disposed = false;

  /// The feed screen can be left while a request is still in flight (e.g.
  /// the session changes and the screen is rebuilt). A late answer must not
  /// notify a disposed controller — that throws in debug and is a leak in
  /// release (found on the Android emulator, Stage 3 verification, V-10).
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    super.dispose();
  }

  Future<void> load(Json variables) async {
    final generation = ++_generation;
    _variables = variables;
    loading = true;
    error = null;
    moreError = null;
    notifyListeners();
    try {
      final data = await _api.run(bookFeedQuery, variables: {...variables, 'limit': pageSize});
      if (generation != _generation) return;
      final page = data['getBookFeed'] as Map;
      books
        ..clear()
        ..addAll(jsonList(page['books']).map(Book.fromJson));
      _cursor = page['endCursor'] as String?;
      hasNext = page['hasNextPage'] == true;
    } catch (e) {
      if (generation != _generation) return;
      error = e;
    } finally {
      if (generation == _generation) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadMore() async {
    if (!hasNext || loadingMore || loading) return;
    final generation = _generation;
    loadingMore = true;
    moreError = null;
    notifyListeners();
    try {
      final data = await _api.run(bookFeedQuery, variables: {..._variables, 'limit': pageSize, 'after': _cursor});
      if (generation != _generation) return;
      final page = data['getBookFeed'] as Map;
      final known = books.map((book) => book.id).toSet();
      books.addAll(jsonList(page['books']).map(Book.fromJson).where((book) => known.add(book.id)));
      _cursor = page['endCursor'] as String?;
      hasNext = page['hasNextPage'] == true;
    } catch (e) {
      if (generation == _generation) moreError = e;
    } finally {
      if (generation == _generation) {
        loadingMore = false;
        notifyListeners();
      }
    }
  }
}

/// Keşfet (F-DISC-02/03/04/07): "Tüm kitaplar" | "Senin için".
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key, this.initialTab});
  final String? initialTab;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this, initialIndex: widget.initialTab == 'for-you' ? 1 : 0);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Material(
        color: BetikColors.paperWhite,
        child: TabBar(
          controller: _tabs,
          tabAlignment: TabAlignment.fill,
          tabs: const [
            Tab(text: 'TÜM KİTAPLAR'),
            Tab(text: 'SENİN İÇİN'),
          ],
        ),
      ),
      Expanded(
        child: TabBarView(controller: _tabs, children: const [_AllBooksTab(), _ForYouTab()]),
      ),
    ],
  );
}

class _AllBooksTab extends StatefulWidget {
  const _AllBooksTab();
  @override
  State<_AllBooksTab> createState() => _AllBooksTabState();
}

class _AllBooksTabState extends State<_AllBooksTab> with AutomaticKeepAliveClientMixin {
  late final BookFeedController _feed = BookFeedController(context.services.api);
  late final FeedFilters _filters = context.read<FeedFilters>();
  late final TextEditingController _search = TextEditingController(text: _filters.search);
  Timer? _debounce;

  @override
  bool get wantKeepAlive => true;

  late final ValueNotifier<int> _dataEpoch;

  @override
  void initState() {
    super.initState();
    _filters.addListener(_reload);
    _dataEpoch = context.services.dataEpoch..addListener(_reload);
    _reload();
  }

  @override
  void dispose() {
    _filters.removeListener(_reload);
    _dataEpoch.removeListener(_reload);
    _debounce?.cancel();
    _search.dispose();
    _feed.dispose();
    super.dispose();
  }

  void _reload() {
    final classification = _filters.classification.toInput();
    _feed.load({
      'sort': _filters.sort,
      'funding': _filters.funding,
      if (_filters.search.trim().isNotEmpty) 'search': _filters.search.trim(),
      if (classification != null) 'classification': classification,
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListenableBuilder(
      listenable: Listenable.merge([_feed, _filters]),
      builder: (context, _) => RefreshIndicator(
        onRefresh: () async => _reload(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            TextField(
              controller: _search,
              maxLength: 100,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Kitap, yazar veya alıntı ara...',
                counterText: '',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Aramayı temizle',
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _search.clear();
                          _filters.setSearch('');
                        },
                      ),
              ),
              onChanged: (value) {
                setState(() {});
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 250), () => _filters.setSearch(value));
              },
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(_filters.title, style: serif(size: 20, weight: FontWeight.w700)),
                ),
                OutlinedButton.icon(
                  onPressed: () => showFeedFilters(context, _filters),
                  icon: const Icon(Icons.tune, size: 18),
                  label: Text(_filters.activeCount == 0 ? 'FİLTRELE' : 'FİLTRELE (${_filters.activeCount})'),
                ),
              ],
            ),
            const SizedBox(height: 4),
            if (!_feed.loading && _feed.error == null)
              Text(
                '${_feed.books.length}${_feed.hasNext ? '+' : ''} kitap listeleniyor · ${sortLabels[_filters.sort]}',
                style: sans(size: 12.5, color: BetikColors.ashGray),
              ),
            const SizedBox(height: 10),
            if (_feed.loading)
              const Padding(padding: EdgeInsets.only(top: 40), child: LoadingView())
            else if (_feed.error != null)
              ErrorView.of(_feed.error!, onRetry: _reload, title: 'Kitaplar yüklenemedi')
            else if (_feed.books.isEmpty)
              EmptyView(
                title: trUpper('Aramanızla eşleşen kitap bulunamadı.'),
                subtitle: 'Filtreleri değiştirmeyi deneyebilirsiniz.',
                action: _filters.activeCount > 0 || _filters.search.isNotEmpty
                    ? OutlinedButton(
                        onPressed: () {
                          _search.clear();
                          _filters.reset();
                        },
                        child: const Text('FİLTRELERİ TEMİZLE'),
                      )
                    : null,
              )
            else ...[
              for (final book in _feed.books) Padding(padding: const EdgeInsets.only(bottom: 12), child: BookCard(book)),
              if (_feed.moreError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Diğer kitaplar yüklenemedi. Tekrar deneyin.',
                    textAlign: TextAlign.center,
                    style: sans(size: 13, color: BetikColors.danger),
                  ),
                ),
              if (_feed.hasNext)
                Center(
                  child: OutlinedButton(
                    onPressed: _feed.loadingMore ? null : _feed.loadMore,
                    child: Text(_feed.loadingMore ? 'YÜKLENİYOR...' : 'DAHA FAZLA GÖSTER'),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Filter sheet. On the website the same panel fills the whole first screen
/// on a phone; here it opens on demand.
Future<void> showFeedFilters(BuildContext context, FeedFilters filters) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  builder: (context) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: 0.85,
    maxChildSize: 0.95,
    builder: (context, scroll) => ListenableBuilder(
      listenable: filters,
      builder: (context, _) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Filtreler', style: serif(size: 20, weight: FontWeight.w700)),
              ),
              TextButton(onPressed: filters.reset, child: const Text('Temizle')),
            ],
          ),
          ClassificationFilterPanel(value: filters.classification, onChanged: filters.setClassification),
          const SizedBox(height: 8),
          const Label('Destek durumu', color: BetikColors.inkBlack),
          RadioGroup<String>(
            groupValue: filters.funding,
            onChanged: (value) => filters.setFunding(value ?? 'ALL'),
            child: Column(
              children: [
                for (final entry in fundingLabels.entries)
                  RadioListTile<String>(value: entry.key, title: Text(entry.value), dense: true, contentPadding: EdgeInsets.zero),
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Label('Sırala', color: BetikColors.inkBlack),
          RadioGroup<String>(
            groupValue: filters.sort,
            onChanged: (value) => filters.setSort(value ?? 'NEWEST'),
            child: Column(
              children: [
                for (final entry in sortLabels.entries)
                  RadioListTile<String>(
                    value: entry.key,
                    title: Text(entry.value),
                    subtitle: entry.key == 'CLOSEST_TO_TARGET' ? const Text('Yalnızca desteği açık kitapları gösterir.') : null,
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('SONUÇLARI GÖSTER')),
        ],
      ),
    ),
  ),
);

/// Classification options are the same for every screen; cache them for the
/// lifetime of the app session.
Future<ClassificationOptions>? _optionsFuture;
Future<ClassificationOptions> loadClassificationOptions(GraphQLClient api, {bool refresh = false}) {
  if (refresh) _optionsFuture = null;
  return _optionsFuture ??= api
      .run(classificationOptionsQuery)
      .then(
        (data) => ClassificationOptions.fromJson(Map<String, dynamic>.from(data['getClassificationOptions'] as Map)),
        onError: (Object error) {
          _optionsFuture = null;
          throw error;
        },
      );
}

class ClassificationFilterPanel extends StatelessWidget {
  const ClassificationFilterPanel({super.key, required this.value, required this.onChanged});
  final ClassificationFilterValue value;
  final ValueChanged<ClassificationFilterValue> onChanged;

  @override
  Widget build(BuildContext context) => Loader<ClassificationOptions>(
    load: () => loadClassificationOptions(context.services.api),
    builder: (context, options, _) {
      Widget select(String title, List<Term> terms, String? selected, ValueChanged<String?> onSelect) => LabeledField(
        label: title,
        child: DropdownButtonFormField<String?>(
          initialValue: terms.any((term) => term.slug == selected) ? selected : null,
          isExpanded: true,
          items: [
            const DropdownMenuItem<String?>(value: null, child: Text('Tümü')),
            for (final term in terms)
              DropdownMenuItem<String?>(
                value: term.slug,
                child: Text(term.name, overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: onSelect,
        ),
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          select('Eser biçimi', options.formats, value.format, (v) => onChanged(value.copyWith(format: () => v))),
          select('Tür ve konu', options.genres, value.genre, (v) => onChanged(value.copyWith(genre: () => v))),
          select('Anlatım özelliği', options.features, value.feature, (v) => onChanged(value.copyWith(feature: () => v))),
          select('Hedef okur kitlesi', options.audiences, value.audience, (v) => onChanged(value.copyWith(audience: () => v))),
          _TagFilter(
            selected: value.tag,
            onChanged: (v) => onChanged(value.copyWith(tag: () => v)),
          ),
        ],
      );
    },
  );
}

class _TagFilter extends StatefulWidget {
  const _TagFilter({required this.selected, required this.onChanged});
  final String? selected;
  final ValueChanged<String?> onChanged;
  @override
  State<_TagFilter> createState() => _TagFilterState();
}

class _TagFilterState extends State<_TagFilter> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<Term> _results = const [];

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _search(String text) {
    _debounce?.cancel();
    if (text.trim().length < 2) {
      setState(() => _results = const []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final data = await context.services.api.run(
          r'query SearchClassificationTags($search: String) { searchClassificationTags(search: $search) { id slug name isActive } }',
          variables: {'search': text.trim()},
        );
        if (mounted) setState(() => _results = jsonList(data['searchClassificationTags']).map(Term.fromJson).toList());
      } on ApiException {
        // Suggestions are optional.
      }
    });
  }

  @override
  Widget build(BuildContext context) => LabeledField(
    label: 'Etiket ara',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.selected != null)
          InputChip(label: Text('#${widget.selected}'), onDeleted: () => widget.onChanged(null))
        else
          TextField(
            controller: _controller,
            maxLength: 50,
            decoration: const InputDecoration(counterText: ''),
            onChanged: _search,
          ),
        if (widget.selected == null && _results.isNotEmpty)
          Wrap(
            spacing: 6,
            children: [
              for (final tag in _results)
                ActionChip(
                  label: Text('#${tag.name}'),
                  onPressed: () {
                    _controller.clear();
                    setState(() => _results = const []);
                    widget.onChanged(tag.slug);
                  },
                ),
            ],
          ),
      ],
    ),
  );
}

// --- Senin için -------------------------------------------------------------

const _recommendationsQuery =
    '''
query GetRecommendations(\$limit: Int, \$offset: Int) {
  getRecommendations(limit: \$limit, offset: \$offset) { score reason book { $recommendationBookFields } }
}''';

const _preferenceQuery = 'query GetUserPreference { getUserPreference { id onboardingCompleted preferredGenres { id name slug } } }';

class _ForYouTab extends StatefulWidget {
  const _ForYouTab();
  @override
  State<_ForYouTab> createState() => _ForYouTabState();
}

class _ForYouTabState extends State<_ForYouTab> with AutomaticKeepAliveClientMixin {
  final List<(Book, String)> _items = [];
  bool _hasMore = true;
  bool _loadingMore = false;
  bool _editing = false;
  int _version = 0;

  @override
  bool get wantKeepAlive => true;

  Future<Json?> _loadPreference() async {
    final data = await context.services.api.run(_preferenceQuery);
    final preference = jsonMap(data['getUserPreference']);
    if (preference != null && preference['onboardingCompleted'] == true) {
      _items.clear();
      _hasMore = true;
      await _more();
    }
    return preference;
  }

  Future<void> _more() async {
    if (_loadingMore || !_hasMore) return;
    if (mounted) setState(() => _loadingMore = true);
    try {
      final data = await context.services.api.run(_recommendationsQuery, variables: {'limit': 10, 'offset': _items.length});
      final page = jsonList(data['getRecommendations']);
      final known = _items.map((item) => item.$1.id).toSet();
      for (final item in page) {
        final book = Book.fromJson(Map<String, dynamic>.from(item['book'] as Map));
        if (known.add(book.id)) _items.add((book, item['reason'] as String? ?? 'POPULAR'));
      }
      _hasMore = page.length == 10;
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final auth = context.watch<AuthController>();
    if (!auth.isSignedIn) {
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: PaperCard(
            child: RegistrationCard(
              intent: RegistrationIntent(action: 'recommendations', returnTo: '/feed?tab=for-you'),
            ),
          ),
        ),
      );
    }
    return Loader<Json?>(
      key: ValueKey('${auth.userId}-$_version'),
      load: _loadPreference,
      builder: (context, preference, loader) {
        final done = preference != null && preference['onboardingCompleted'] == true;
        final genres = jsonList(preference?['preferredGenres']).map(Term.fromJson).toList();
        if (!done || _editing) {
          return GenreOnboarding(
            initial: genres.map((genre) => genre.id).toSet(),
            onCancel: done ? () => setState(() => _editing = false) : null,
            onSaved: () => setState(() {
              _editing = false;
              _version++;
            }),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => setState(() => _version++),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              PaperCard(
                color: BetikColors.sepiaLight,
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(child: Label('Tercihlerim', color: BetikColors.inkBlack)),
                        TextButton(onPressed: () => setState(() => _editing = true), child: const Text('Düzenle')),
                      ],
                    ),
                    Wrap(spacing: 6, runSpacing: 6, children: [for (final genre in genres) TagChip(genre.name)]),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text('SENİN İÇİN', style: serif(size: 20, weight: FontWeight.w700, letterSpacing: 1)),
              Text(
                'Tercihlerine göre seçildi',
                style: serif(size: 13, style: FontStyle.italic, color: BetikColors.ashGray),
              ),
              const SizedBox(height: 12),
              if (_items.isEmpty)
                const EmptyView(title: 'Henüz öneri yok', subtitle: 'Yeni kitaplar yayımlandıkça burada göreceksin.')
              else
                for (final (book, reason) in _items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: BookCard(book, reason: reason),
                  ),
              if (_hasMore && _items.isNotEmpty)
                Center(
                  child: OutlinedButton(
                    onPressed: _loadingMore ? null : _more,
                    child: Text(_loadingMore ? 'YÜKLENİYOR...' : 'DAHA FAZLA GÖSTER'),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Genre picker (F-DISC-04): at least one genre; saves with
/// `saveUserPreference(genreIds)`.
class GenreOnboarding extends StatefulWidget {
  const GenreOnboarding({super.key, required this.initial, required this.onSaved, this.onCancel});
  final Set<String> initial;
  final VoidCallback onSaved;
  final VoidCallback? onCancel;

  @override
  State<GenreOnboarding> createState() => _GenreOnboardingState();
}

class _GenreOnboardingState extends State<GenreOnboarding> {
  late final Set<String> _selected = {...widget.initial};

  Future<void> _save() async {
    try {
      await context.services.api.run(
        r'mutation SaveUserPreference($genreIds: [ID!]!) { saveUserPreference(genreIds: $genreIds) { id onboardingCompleted } }',
        variables: {'genreIds': _selected.toList()},
      );
      widget.onSaved();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => Loader<List<Term>>(
    load: () async {
      final data = await context.services.api.run('query GetAllGenres { getAllGenres { id name slug group hexColor isActive } }');
      return jsonList(data['getAllGenres']).map(Term.fromJson).where((genre) => genre.isActive).toList();
    },
    builder: (context, genres, _) => ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Hangi türleri seviyorsun?', style: serif(size: 22, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(
          'En az bir tür seç; önerilerini buna göre hazırlayalım.',
          style: serif(size: 14, style: FontStyle.italic, color: BetikColors.ashGray),
        ),
        const SizedBox(height: 16),
        GenreChoices(genres: genres, selected: _selected, onChanged: () => setState(() {})),
        const SizedBox(height: 20),
        BusyButton(
          onPressed: _selected.isEmpty ? null : _save,
          label: _selected.isEmpty ? 'En az bir tür seç' : '${_selected.length} türle devam et',
        ),
        if (widget.onCancel != null) TextButton(onPressed: widget.onCancel, child: const Text('Vazgeç')),
      ],
    ),
  );
}

const genreGroupLabels = {'FICTION': 'Kurgu ve Hikâyeler', 'KNOWLEDGE': 'Bilgi ve Düşünce'};

/// Genres as selectable chips, grouped like the website's picker.
class GenreChoices extends StatelessWidget {
  const GenreChoices({super.key, required this.genres, required this.selected, required this.onChanged, this.max, this.byName = false});
  final List<Term> genres;
  final Set<String> selected;
  final VoidCallback onChanged;
  final int? max;

  /// Author settings store genre **names**; everything else stores ids.
  final bool byName;

  @override
  Widget build(BuildContext context) {
    final groups = <String, List<Term>>{};
    for (final genre in genres) {
      groups.putIfAbsent(genre.group ?? '', () => []).add(genre);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in groups.entries) ...[
          if (genreGroupLabels[entry.key] != null)
            Padding(padding: const EdgeInsets.only(top: 6, bottom: 6), child: Label(genreGroupLabels[entry.key]!)),
          Wrap(
            spacing: 6,
            runSpacing: 2,
            children: [
              for (final genre in entry.value)
                () {
                  final key = byName ? genre.name : genre.id;
                  final isSelected = selected.contains(key);
                  final blocked = !isSelected && max != null && selected.length >= max!;
                  return FilterChip(
                    label: Text(genre.name),
                    selected: isSelected,
                    onSelected: blocked
                        ? null
                        : (value) {
                            value ? selected.add(key) : selected.remove(key);
                            onChanged();
                          },
                  );
                }(),
            ],
          ),
        ],
      ],
    );
  }
}
