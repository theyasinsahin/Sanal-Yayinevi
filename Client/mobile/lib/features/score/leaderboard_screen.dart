import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/documents.dart';
import '../../core/app_services.dart';
import '../../core/models/models.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../shell/shell.dart';

/// Aktiflik Tablosu (F-SCORE-01/03): top 10 per period with a podium, own
/// rank when outside the top 10. Refreshed by 15 s polling, the
/// `leaderboardUpdated` subscription and on returning to the app.
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});
  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  static const _periods = [('total', 'Genel'), ('monthly', 'Aylık'), ('weekly', 'Haftalık'), ('daily', 'Günlük')];
  final _tick = ValueNotifier<int>(0);
  StreamSubscription<Json>? _subscription;
  String _period = 'total';

  @override
  void initState() {
    super.initState();
    _subscription = context.services.subscriptions
        .subscribe('subscription LeaderboardUpdated { leaderboardUpdated }')
        .listen((_) => _tick.value++, onError: (Object _) {});
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _tick.dispose();
    super.dispose();
  }

  Future<Json> _load() async {
    final services = context.services;
    final me = services.auth.userId;
    final data = await services.api.run(
      '''query Leaderboard(\$period: String${me == null ? '' : ', \$userId: ID!'}) {
        getLeaderboard(period: \$period) { rank points user { $userFields } }
        ${me == null ? '' : 'getUserRank(userId: \$userId, period: \$period) { rank points }'}
      }''',
      variables: {'period': _period, if (me != null) 'userId': me},
    );
    return data;
  }

  @override
  Widget build(BuildContext context) {
    final me = context.services.auth.userId;
    return PageScaffold(
      title: 'Aktiflik Tablosu',
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: SegmentedButton<String>(
              showSelectedIcon: false,
              segments: [for (final (value, title) in _periods) ButtonSegment(value: value, label: Text(title))],
              selected: {_period},
              onSelectionChanged: (selection) => setState(() => _period = selection.first),
            ),
          ),
          Expanded(
            child: Loader<Json>(
              key: ValueKey(_period),
              load: _load,
              pollEvery: const Duration(seconds: 15),
              refreshOn: _tick,
              builder: (context, data, loader) {
                final entries = jsonList(data['getLeaderboard']);
                final rank = jsonMap(data['getUserRank']);
                final inTop = entries.any((entry) => jsonMap(entry['user'])?['id'] == me);
                if (entries.isEmpty) {
                  // The website shows an empty page here; the app says why.
                  return const EmptyView(
                    icon: Icons.emoji_events_outlined,
                    title: 'Bu dönem için henüz puan yok.',
                    subtitle: 'Okuyarak, yazarak ve yorum yaparak puan kazanabilirsin.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => loader.reload(silent: true),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          for (final position in const [1, 0, 2])
                            Expanded(
                              child: position < entries.length
                                  ? _Podium(entry: entries[position], place: position + 1)
                                  : const SizedBox.shrink(),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      for (final entry in entries)
                        () {
                          final user = UserSummary.maybe(entry['user']);
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            tileColor: user?.id == me ? BetikColors.sepiaLight : null,
                            leading: SizedBox(
                              width: 74,
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: 30,
                                    child: Text('#${jsonInt(entry['rank'])}', style: serif(size: 15, weight: FontWeight.w700)),
                                  ),
                                  UserAvatar.of(user, size: 38),
                                ],
                              ),
                            ),
                            title: Text(user?.displayName ?? 'Kullanıcı', style: sans(size: 14.5, weight: FontWeight.w700)),
                            subtitle: Text('@${user?.username ?? ''}'),
                            trailing: Text('${formatExactCount(entry['points'])} puan', style: sans(size: 13.5, weight: FontWeight.w700)),
                            onTap: user == null ? null : () => context.push('/user/${user.id}'),
                          );
                        }(),
                      if (rank != null && !inTop && rank['rank'] != null)
                        Container(
                          margin: const EdgeInsets.only(top: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            border: Border.all(color: BetikColors.inkBlack, width: 2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text('Senin sıran #${rank['rank']}', style: sans(size: 14.5, weight: FontWeight.w700)),
                              ),
                              Text('${formatExactCount(rank['points'])} puan', style: sans(size: 13.5)),
                            ],
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Podium extends StatelessWidget {
  const _Podium({required this.entry, required this.place});
  final Json entry;
  final int place;

  @override
  Widget build(BuildContext context) {
    final user = UserSummary.maybe(entry['user']);
    return GestureDetector(
      onTap: user == null ? null : () => context.push('/user/${user.id}'),
      child: Column(
        children: [
          Text(const ['🥇', '🥈', '🥉'][place - 1], style: TextStyle(fontSize: place == 1 ? 34 : 26)),
          UserAvatar.of(user, size: place == 1 ? 60 : 48),
          const SizedBox(height: 4),
          Text(
            '@${user?.username ?? ''}',
            style: sans(size: 12, weight: FontWeight.w600),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Text('${formatCount(entry['points'])} puan', style: sans(size: 12, color: BetikColors.ashGray)),
          Container(
            margin: const EdgeInsets.only(top: 6, left: 4, right: 4),
            height: place == 1 ? 46 : (place == 2 ? 32 : 22),
            decoration: const BoxDecoration(
              color: BetikColors.agedPaper,
              border: Border(top: BorderSide(color: BetikColors.inkBlack, width: 2)),
            ),
          ),
        ],
      ),
    );
  }
}
