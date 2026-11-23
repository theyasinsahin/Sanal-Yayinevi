import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import 'core/app_services.dart';
import 'core/auth/auth_controller.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/ui.dart';
import 'features/discovery/feed_screen.dart';
import 'features/writing/quill_bridge.dart';
import 'router.dart';

class BetikApp extends StatefulWidget {
  const BetikApp({super.key, required this.services});
  final AppServices services;

  @override
  State<BetikApp> createState() => _BetikAppState();
}

class _BetikAppState extends State<BetikApp> {
  late final GoRouter _router = buildRouter(widget.services);

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final services = widget.services;
    return MultiProvider(
      providers: [
        Provider<AppServices>.value(value: services),
        ChangeNotifierProvider<AuthController>.value(value: services.auth),
        ChangeNotifierProvider<BadgeController>.value(value: services.badges),
        ChangeNotifierProvider<ReadingPreferences>.value(value: services.readingPreferences),
        ChangeNotifierProvider<FeedFilters>(create: (_) => FeedFilters()),
      ],
      child: MaterialApp.router(
        title: 'Betik',
        debugShowCheckedModeBanner: false,
        theme: buildBetikTheme(),
        routerConfig: _router,
        // The product is Turkish-only; dates, numbers and the framework's
        // own strings (dialogs, selection menus) use tr_TR.
        locale: const Locale('tr', 'TR'),
        supportedLocales: const [Locale('tr', 'TR')],
        localizationsDelegates: [...GlobalMaterialLocalizations.delegates, ...quillBridgeLocalizationDelegates],
        builder: (context, child) {
          if (!services.config.isConfigured) return const _MissingConfiguration();
          return QuillMaterialBridge(child: child ?? const SizedBox.shrink());
        },
      ),
    );
  }
}

/// Release builds carry no endpoint default (see `AppConfig`); a build made
/// without `BETIK_API_URL` says so instead of talking to a wrong server.
class _MissingConfiguration extends StatelessWidget {
  const _MissingConfiguration();
  @override
  Widget build(BuildContext context) => const Scaffold(
    body: ErrorView(
      title: 'Yapılandırma eksik',
      message:
          'Bu derleme için sunucu adresi tanımlanmamış (BETIK_API_URL). '
          'Lütfen uygulamayı doğru yapılandırmayla yeniden derleyin.',
    ),
  );
}
