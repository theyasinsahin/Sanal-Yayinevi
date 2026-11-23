import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';
import '../book/book_card.dart';
import 'feed_screen.dart';

/// Landing (F-DISC-01): hero with an in-place search over the popular
/// list (10 per page, `POPULAR`), then the static "how it works" section.
class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});
  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> with AutomaticKeepAliveClientMixin {
  late final BookFeedController _feed = BookFeedController(context.services.api, pageSize: 10);
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  bool get wantKeepAlive => true;

  late final ValueNotifier<int> _dataEpoch;

  @override
  void initState() {
    super.initState();
    _dataEpoch = context.services.dataEpoch..addListener(_load);
    _load();
  }

  @override
  void dispose() {
    _dataEpoch.removeListener(_load);
    _debounce?.cancel();
    _search.dispose();
    _feed.dispose();
    super.dispose();
  }

  void _load() => _feed.load({'sort': 'POPULAR', if (_query.isNotEmpty) 'search': _query});

  void _onSearch(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      _query = value.trim();
      _load();
    });
  }

  void _clear() {
    _search.clear();
    _query = '';
    setState(() {});
    _load();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListenableBuilder(
      listenable: _feed,
      builder: (context, _) => RefreshIndicator(
        onRefresh: () async => _load(),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Container(
              color: BetikColors.agedPaper,
              padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Fikriniz Kitaplaşsın', style: serif(size: 30, weight: FontWeight.w700, height: 1.2)),
                  Container(margin: const EdgeInsets.symmetric(vertical: 12), width: 80, height: 3, color: BetikColors.sepiaDark),
                  Text(
                    'Kaleminizden çıkan eserlerin gerçek bir kitaba dönüşme yolculuğuna tanık olun',
                    style: serif(size: 16, style: FontStyle.italic, color: BetikColors.graphite, height: 1.6),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Bir sonraki kitabını bul',
                    style: sans(size: 14, weight: FontWeight.w600, color: BetikColors.graphite),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _search,
                    maxLength: 100,
                    textInputAction: TextInputAction.search,
                    onChanged: _onSearch,
                    decoration: InputDecoration(
                      hintText: 'Kitap, yazar veya alıntı ara...',
                      counterText: '',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(tooltip: 'Aramayı temizle', icon: const Icon(Icons.close), onPressed: _clear),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 22, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_query.isEmpty ? 'En Popüler Kitaplar' : 'Arama Sonuçları', style: serif(size: 24, weight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('Okurların en çok beğendiği kitapları keşfedin.', style: serif(size: 14, color: BetikColors.ashGray)),
                  TextButton(
                    style: TextButton.styleFrom(padding: EdgeInsets.zero),
                    onPressed: () => context.go('/feed'),
                    child: Text(
                      'Tüm Kitapları Gör →',
                      style: sans(size: 14, weight: FontWeight.w700).copyWith(decoration: TextDecoration.underline),
                    ),
                  ),
                  const Divider(),
                  const SizedBox(height: 12),
                  if (_feed.loading)
                    const LoadingView()
                  else if (_feed.error != null)
                    ErrorView(
                      title: 'Kitaplar yüklenemedi',
                      message: 'Bağlantınızı kontrol edip tekrar deneyin.',
                      onRetry: _load,
                      retryLabel: 'Yeniden Dene',
                    )
                  else if (_feed.books.isEmpty)
                    _query.isEmpty
                        ? const EmptyView(title: 'Henüz yayımlanmış kitap bulunmuyor.')
                        : EmptyView(
                            title: 'Aramanızla eşleşen kitap bulunamadı.',
                            action: OutlinedButton(onPressed: _clear, child: const Text('POPÜLER KİTAPLARA DÖN')),
                          )
                  else ...[
                    for (final book in _feed.books) Padding(padding: const EdgeInsets.only(bottom: 12), child: BookCard(book)),
                    if (_feed.moreError != null)
                      Text('Diğer kitaplar yüklenemedi. Tekrar deneyin.', style: sans(size: 13, color: BetikColors.danger)),
                    if (_feed.hasNext)
                      Center(
                        child: OutlinedButton(
                          onPressed: _feed.loadingMore ? null : _feed.loadMore,
                          child: Text(_feed.loadingMore ? 'YÜKLENİYOR...' : 'DAHA FAZLA KİTAP GÖSTER'),
                        ),
                      ),
                  ],
                ],
              ),
            ),
            const _HowItWorks(),
            const _QuickLinks(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _HowItWorks extends StatelessWidget {
  const _HowItWorks();

  static const _steps = [
    ('Yazınızı Yayınlayın', 'Platformumuzda yazınızı zengin metin editörüyle oluşturun ve hedef bağış tutarınızı belirleyin.'),
    ('Topluluk Desteği', 'Okuyucular yazınıza bağış yaparak hedefinize ulaşmanıza yardımcı olsun.'),
    ('Kitabınız Basılsın', 'Hedef tutara ulaştığınızda profesyonel yayınevleriyle kitabınızı bastırın.'),
  ];

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 20),
    padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
    color: BetikColors.agedPaper,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Nasıl Çalışır?', style: serif(size: 22, weight: FontWeight.w700)),
        Text(
          'Hayalinizdeki kitabı 3 adımda gerçeğe dönüştürün',
          style: serif(size: 14, style: FontStyle.italic, color: BetikColors.ashGray),
        ),
        const OrnamentDivider(),
        for (var i = 0; i < _steps.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 44,
                  child: Text(
                    '${i + 1}',
                    style: serif(size: 40, weight: FontWeight.w700, color: BetikColors.fog, height: 1),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_steps[i].$1, style: serif(size: 17, weight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(_steps[i].$2, style: serif(size: 14, color: BetikColors.graphite, height: 1.5)),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

class _QuickLinks extends StatelessWidget {
  const _QuickLinks();

  @override
  Widget build(BuildContext context) {
    Widget link(IconData icon, String title, String path) =>
        ListTile(leading: Icon(icon), title: Text(title), trailing: const Icon(Icons.chevron_right), onTap: () => context.push(path));
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 0),
      child: Column(
        children: [
          link(Icons.menu_book, 'Basılı Kitaplar', '/printed-books'),
          link(Icons.emoji_events_outlined, 'Aktiflik Tablosu', '/leaderboard'),
          link(Icons.groups_outlined, 'Yazarlar', '/authors'),
          link(Icons.info_outline, 'Hakkımızda', '/about'),
        ],
      ),
    );
  }
}
