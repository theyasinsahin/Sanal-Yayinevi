import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../../core/app_services.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';

/// Logo + wordmark as in the website's top bar.
class BetikWordmark extends StatelessWidget {
  const BetikWordmark({super.key});
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Image.asset('assets/images/app_icon.png', height: 34),
      const SizedBox(width: 6),
      Text('BETİK', style: serif(size: 20, weight: FontWeight.w700, letterSpacing: 1)),
    ],
  );
}

class CountBadge extends StatelessWidget {
  const CountBadge({super.key, required this.count, required this.color, required this.child});
  final int count;
  final Color color;
  final Widget child;
  @override
  Widget build(BuildContext context) =>
      Badge(isLabelVisible: count > 0, backgroundColor: color, label: Text(count > 99 ? '99+' : '$count'), child: child);
}

/// Root scaffold of the five primary destinations.
///
/// The website's top bar (five links + role-dependent actions, collapsing
/// into a hamburger slide-out on phones where the badges are hidden until
/// the menu opens) becomes: a bottom navigation bar for the destinations
/// used most, always-visible message and notification badges in the app
/// bar, and a drawer that keeps *every* destination of the web menu.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final badges = context.watch<BadgeController>();
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: GestureDetector(onTap: () => navigationShell.goBranch(0, initialLocation: true), child: const BetikWordmark()),
        actions: [
          if (auth.isSignedIn) ...[
            IconButton(
              tooltip: 'Mesajlar',
              onPressed: () => context.push('/messages'),
              icon: CountBadge(count: badges.messages, color: BetikColors.messageBadge, child: const Icon(Icons.chat_bubble_outline)),
            ),
            IconButton(
              tooltip: 'Bildirimler',
              onPressed: () => context.push('/notifications'),
              icon: CountBadge(
                count: badges.notifications,
                color: BetikColors.notificationBadge,
                child: const Icon(Icons.notifications_none),
              ),
            ),
          ] else
            TextButton(onPressed: () => context.push('/login'), child: const Text('GİRİŞ YAP')),
          const SizedBox(width: 4),
        ],
      ),
      drawer: const AppDrawer(),
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(index, initialLocation: index == navigationShell.currentIndex),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Ana Sayfa'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Keşfet'),
          NavigationDestination(icon: Icon(Icons.format_quote_outlined), selectedIcon: Icon(Icons.format_quote), label: 'Alıntılar'),
          NavigationDestination(icon: Icon(Icons.forum_outlined), selectedIcon: Icon(Icons.forum), label: 'Oturumlar'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profilim'),
        ],
      ),
    );
  }
}

/// Every destination of the website's navigation, footer included
/// (F-NAV-01/02/03), with role-dependent entries.
class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final badges = context.watch<BadgeController>();
    final user = auth.user;

    Widget item(IconData icon, String title, String path, {Widget? trailing, bool go = false}) => ListTile(
      leading: Icon(icon),
      title: Text(title),
      trailing: trailing,
      onTap: () {
        Navigator.of(context).pop();
        go ? context.go(path) : context.push(path);
      },
    );

    Widget badge(int count, Color color) => count > 0
        ? Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(999)),
            child: Text(
              count > 99 ? '99+' : '$count',
              style: sans(size: 11, weight: FontWeight.w700, color: Colors.white),
            ),
          )
        : const SizedBox.shrink();

    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const BetikWordmark(),
                  if (user != null) ...[
                    const SizedBox(height: 10),
                    Text(user.fullName.isEmpty ? user.username : user.fullName, style: serif(size: 16, weight: FontWeight.w700)),
                    Text('@${user.username}', style: sans(size: 13, color: BetikColors.ashGray)),
                  ],
                ],
              ),
            ),
            const Divider(),
            item(Icons.explore, 'Keşfet', '/feed', go: true),
            item(Icons.format_quote, 'Alıntılar', '/quotes', go: true),
            item(Icons.menu_book, 'Basılı Kitaplar', '/printed-books'),
            item(Icons.emoji_events, 'Aktiflik Tablosu', '/leaderboard'),
            item(Icons.forum, 'Oturumlar', '/sessions', go: true),
            const Divider(),
            if (user != null) ...[
              item(Icons.person, 'Profilim', '/profile', go: true),
              item(Icons.edit, 'Kitap Oluştur', '/create-book'),
              item(Icons.chat_bubble_outline, 'Mesajlar', '/messages', trailing: badge(badges.messages, BetikColors.messageBadge)),
              item(
                Icons.notifications,
                'Bildirimler',
                '/notifications',
                trailing: badge(badges.notifications, BetikColors.notificationBadge),
              ),
              item(Icons.receipt_long, 'Desteklerim', '/funding-history'),
              if (user.isPublisher) item(Icons.business, 'Yayınevi Portalı', '/publisher'),
              if (user.isAdmin) item(Icons.admin_panel_settings, 'Yönetim Paneli', '/admin'),
            ] else ...[
              item(Icons.login, 'Giriş Yap', '/login'),
              item(Icons.person_add_alt, 'Kayıt Ol', '/register'),
            ],
            const Divider(),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
              child: Text('KURUMSAL', style: label(size: 11)),
            ),
            item(Icons.groups_outlined, 'Yazarlar', '/authors'),
            item(Icons.info_outline, 'Hakkımızda', '/about'),
            item(Icons.mail_outline, 'İletişim', '/contact'),
            item(Icons.gavel_outlined, 'Kullanım Koşulları', '/terms'),
            item(Icons.privacy_tip_outlined, 'Gizlilik Politikası', '/privacy'),
            if (user != null) ...[
              const Divider(),
              Padding(
                padding: const EdgeInsets.all(16),
                child: BusyButton(
                  outlined: true,
                  icon: Icons.logout,
                  label: 'Çıkış Yap',
                  onPressed: () async {
                    final router = GoRouter.of(context);
                    Navigator.of(context).pop();
                    // Server-side this signs out every device (authVersion++),
                    // exactly like the website's "Çıkış Yap".
                    await auth.logout();
                    router.go('/login');
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Standard scaffold for pushed (non-tab) screens.
class PageScaffold extends StatelessWidget {
  const PageScaffold({super.key, required this.title, required this.body, this.actions, this.floatingActionButton, this.bottom});
  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final PreferredSizeWidget? bottom;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title), actions: actions, bottom: bottom),
    body: SafeArea(top: false, child: body),
    floatingActionButton: floatingActionButton,
  );
}

/// Shown when a guest opens a member-only tab (profile).
class SignInRequired extends StatelessWidget {
  const SignInRequired({super.key, required this.returnTo, this.message = 'Bu sayfayı görmek için giriş yapmalısınız.'});
  final String returnTo;
  final String message;

  @override
  Widget build(BuildContext context) => EmptyView(
    icon: Icons.lock_outline,
    title: message,
    action: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        FilledButton(onPressed: () => context.push('/login?returnTo=${Uri.encodeComponent(returnTo)}'), child: const Text('GİRİŞ YAP')),
        TextButton(
          onPressed: () => context.push('/register?returnTo=${Uri.encodeComponent(returnTo)}'),
          child: const Text('Ücretsiz hesap oluştur'),
        ),
      ],
    ),
  );
}
