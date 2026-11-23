import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';
import '../shell/shell.dart';
import 'quote_card.dart';

const _feedQuery =
    '''
query GetQuotesFeed(\$limit: Int, \$offset: Int, \$sortBy: String) {
  getQuotesFeed(limit: \$limit, offset: \$offset, sortBy: \$sortBy) { $quoteFields }
}''';

const _searchQuery =
    '''
query SearchQuotes(\$query: String!, \$limit: Int, \$offset: Int) {
  searchQuotes(query: \$query, limit: \$limit, offset: \$offset) { $quoteFields }
}''';

/// Alıntılar (F-QUOTE-01/02): popular/newest, 20 per page with infinite
/// scroll and de-duplication; a non-empty search replaces the feed with the
/// first 20 results (400 ms debounce).
class QuotesScreen extends StatefulWidget {
  const QuotesScreen({super.key});
  @override
  State<QuotesScreen> createState() => _QuotesScreenState();
}

class _QuotesScreenState extends State<QuotesScreen> with AutomaticKeepAliveClientMixin {
  static const _pageSize = 20;
  final _scroll = ScrollController();
  final _search = TextEditingController();
  final List<Quote> _quotes = [];
  Timer? _debounce;
  String _sort = 'popular';
  String _query = '';
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  Object? _error;
  int _generation = 0;

  @override
  bool get wantKeepAlive => true;

  late final ValueNotifier<int> _dataEpoch;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) _more();
    });
    _dataEpoch = context.services.dataEpoch..addListener(_reload);
    _reload();
  }

  @override
  void dispose() {
    _dataEpoch.removeListener(_reload);
    _debounce?.cancel();
    _scroll.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<List<Quote>> _fetch(int offset) async {
    final api = context.services.api;
    final data = _query.isEmpty
        ? await api.run(_feedQuery, variables: {'limit': _pageSize, 'offset': offset, 'sortBy': _sort})
        : await api.run(_searchQuery, variables: {'query': _query, 'limit': _pageSize, 'offset': 0});
    return jsonList(data[_query.isEmpty ? 'getQuotesFeed' : 'searchQuotes']).map(Quote.fromJson).toList();
  }

  Future<void> _reload() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await _fetch(0);
      if (!mounted || generation != _generation) return;
      setState(() {
        _quotes
          ..clear()
          ..addAll(page);
        _hasMore = _query.isEmpty && page.length == _pageSize;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _more() async {
    if (_loading || _loadingMore || !_hasMore) return;
    final generation = _generation;
    setState(() => _loadingMore = true);
    try {
      final page = await _fetch(_quotes.length);
      if (!mounted || generation != _generation) return;
      final known = _quotes.map((quote) => quote.id).toSet();
      setState(() {
        _quotes.addAll(page.where((quote) => known.add(quote.id)));
        _hasMore = page.length == _pageSize;
      });
    } catch (_) {
      // The next scroll retries.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return RefreshIndicator(
      onRefresh: _reload,
      child: ListView(
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(hintText: 'Alıntı, kitap veya yazar ara...', prefixIcon: Icon(Icons.search)),
            onChanged: (value) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 400), () {
                _query = value.trim();
                _reload();
              });
            },
          ),
          const SizedBox(height: 10),
          if (_query.isEmpty)
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'popular', label: Text('En Popüler')),
                ButtonSegment(value: 'newest', label: Text('En Yeni')),
              ],
              selected: {_sort},
              onSelectionChanged: (selection) {
                _sort = selection.first;
                _reload();
              },
            ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(padding: EdgeInsets.only(top: 40), child: LoadingView())
          else if (_error != null)
            ErrorView.of(_error!, onRetry: _reload, title: 'Alıntılar yüklenemedi')
          else if (_quotes.isEmpty)
            EmptyView(
              title: 'Henüz alıntı yok',
              subtitle: _query.isEmpty ? 'Kitap okurken beğendiğin bölümleri alıntıla!' : 'Aramanıza uygun sonuç bulunamadı.',
            )
          else ...[
            for (final quote in _quotes)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: QuoteCard(quote, key: ValueKey(quote.id)),
              ),
            if (_loadingMore) const Padding(padding: EdgeInsets.all(12), child: LoadingView()),
            if (!_hasMore && _query.isEmpty)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  'Tüm alıntılar yüklendi ✦',
                  textAlign: TextAlign.center,
                  style: serif(size: 13, style: FontStyle.italic, color: BetikColors.ashGray),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// `/quotes/:id` (F-QUOTE-07): share links and notifications land here.
class QuoteDetailScreen extends StatelessWidget {
  const QuoteDetailScreen({super.key, required this.quoteId, this.focusCommentId});
  final String quoteId;
  final String? focusCommentId;

  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Kitaptan bir satır',
    body: Loader<Quote?>(
      load: () async {
        final data = await context.services.api.run(
          'query GetQuoteById(\$id: ID!) { getQuoteById(id: \$id) { $quoteFields } }',
          variables: {'id': quoteId},
        );
        final raw = jsonMap(data['getQuoteById']);
        return raw == null ? null : Quote.fromJson(raw);
      },
      builder: (context, quote, _) => quote == null
          ? const EmptyView(title: 'Bu alıntı artık mevcut değil veya herkese açık değil.')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [QuoteCard(quote, initiallyShowComments: focusCommentId != null, focusCommentId: focusCommentId)],
            ),
    ),
  );
}

/// Quotes grouped by book with a count (profile "Alıntılar" tab, F-PROF-07).
class ProfileQuoteGroups extends StatelessWidget {
  const ProfileQuoteGroups(this.quotes, {super.key, this.onChanged});
  final List<Quote> quotes;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    final groups = <String, List<Quote>>{};
    final titles = <String, String>{};
    for (final quote in quotes) {
      final book = quote.source.book;
      final key = book?.id ?? '';
      groups.putIfAbsent(key, () => []).add(quote);
      titles[key] = book?.title ?? 'Kitap';
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final entry in groups.entries) ...[
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 8),
            child: Text('${titles[entry.key]} / ${entry.value.length} alıntı', style: serif(size: 16, weight: FontWeight.w700)),
          ),
          for (final quote in entry.value)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: QuoteCard(quote, key: ValueKey(quote.id), onChanged: onChanged),
            ),
        ],
      ],
    );
  }
}
