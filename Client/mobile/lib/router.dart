import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'core/app_services.dart';
import 'core/models/models.dart';
import 'core/network/api_error.dart';
import 'core/widgets/ui.dart';
import 'features/admin/admin_print_funding.dart';
import 'features/admin/admin_screens.dart';
import 'features/auth/auth_screens.dart';
import 'features/book/book_detail_screen.dart';
import 'features/community/community_screens.dart';
import 'features/discovery/feed_screen.dart';
import 'features/discovery/landing_screen.dart';
import 'features/funding/checkout_screen.dart';
import 'features/funding/print_application_screen.dart';
import 'features/messaging/messages_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/printed/printed_books_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/quotes/quotes_screen.dart';
import 'features/reader/reader_screen.dart';
import 'features/score/leaderboard_screen.dart';
import 'features/sessions/session_detail_screen.dart';
import 'features/sessions/sessions_screen.dart';
import 'features/shell/shell.dart';
import 'features/writing/create_book_screen.dart';
import 'features/writing/dashboard_screen.dart';

/// Routes that need a signed-in member (web `ProtectedRoute`).
const _memberPrefixes = [
  '/create-book', '/dashboard/', '/print/', '/funding-history', '/donate/', '/payment/success', '/messages', '/notifications', //
];

/// Guard decision for [location] (F-AUTH-09). Convenience only: the server
/// authorises every operation again.
///
/// * member routes → `/login?returnTo=…` for guests;
/// * `/admin…` → `/` unless the role is ADMIN;
/// * `/publisher` → `/login` for guests, `/` for members without the role.
String? guardRedirect({required String location, required String path, required bool signedIn, String? role}) {
  if (path.startsWith('/admin')) return role == 'ADMIN' ? null : '/';
  if (path == '/publisher') {
    if (!signedIn) return '/login?returnTo=${Uri.encodeComponent(location)}';
    return role == 'PUBLISHER' || role == 'ADMIN' ? null : '/';
  }
  if (!signedIn && _memberPrefixes.any((prefix) => path == prefix || path.startsWith(prefix))) {
    return '/login?returnTo=${Uri.encodeComponent(location)}';
  }
  // Already signed in: the auth pages have nothing to offer.
  if (signedIn && (path == '/login' || path == '/register')) return '/profile';
  return null;
}

GoRouter buildRouter(AppServices services) {
  String? query(GoRouterState state, String name) => state.uri.queryParameters[name];
  String param(GoRouterState state, String name) => state.pathParameters[name] ?? '';

  return GoRouter(
    initialLocation: '/',
    refreshListenable: services.auth,
    errorBuilder: (_, _) => const NotFoundScreen(),
    redirect: (context, state) {
      final auth = services.auth;
      if (auth.isInitialising) return null;
      final path = state.uri.path;
      if (auth.isSignedIn && (path == '/login' || path == '/register')) {
        // Signing in notifies this router before the form can navigate:
        // honour the remembered destination here (returnTo → pending
        // registration intent → own profile).
        final returnTo = state.uri.queryParameters['returnTo'];
        if (returnTo != null && returnTo.startsWith('/') && !returnTo.startsWith('//')) return returnTo;
        return services.intents.returnTo ?? '/profile';
      }
      return guardRedirect(location: state.uri.toString(), path: state.uri.path, signedIn: auth.isSignedIn, role: auth.user?.role);
    },
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => HomeShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: '/', builder: (_, _) => const LandingScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/feed',
                builder: (_, state) => FeedScreen(key: ValueKey(query(state, 'tab')), initialTab: query(state, 'tab')),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/quotes', builder: (_, _) => const QuotesScreen())],
          ),
          StatefulShellBranch(
            routes: [GoRoute(path: '/sessions', builder: (_, _) => const SessionsScreen())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, state) => OwnProfileTab(key: ValueKey(query(state, 'tab')), initialTab: query(state, 'tab')),
              ),
            ],
          ),
        ],
      ),

      // --- Auth -------------------------------------------------------------
      GoRoute(
        path: '/login',
        builder: (_, state) => LoginScreen(returnTo: query(state, 'returnTo'), errorCode: query(state, 'error')),
      ),
      GoRoute(
        path: '/register',
        builder: (_, state) => RegisterScreen(returnTo: query(state, 'returnTo')),
      ),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/sifremi-unuttum', redirect: (_, _) => '/forgot-password'),
      GoRoute(path: '/reset-password', builder: (_, _) => const ResetPasswordScreen()),
      GoRoute(
        path: '/reset-password/:token',
        builder: (_, state) => ResetPasswordScreen(token: param(state, 'token')),
      ),

      // --- Content (id based; used by all in-app navigation) --------------
      GoRoute(
        path: '/book/:id',
        builder: (_, state) => BookDetailScreen(
          key: ValueKey(state.uri.toString()),
          bookId: param(state, 'id'),
          focusCommentId: query(state, 'comment'),
          scrollToComments: query(state, 'comments') != null || query(state, 'comment') != null,
        ),
      ),
      GoRoute(
        path: '/reader/:bookId',
        builder: (_, state) => ReaderScreen(
          key: ValueKey(state.uri.toString()),
          bookId: param(state, 'bookId'),
          chapterId: query(state, 'chapter'),
          paragraph: int.tryParse(query(state, 'paragraph') ?? ''),
          focusCommentId: query(state, 'comment'),
        ),
      ),
      GoRoute(
        path: '/user/:id',
        builder: (_, state) => UserProfileScreen(key: ValueKey(param(state, 'id')), userId: param(state, 'id')),
      ),
      GoRoute(
        path: '/session/:id',
        builder: (_, state) =>
            SessionDetailScreen(key: ValueKey(state.uri.toString()), sessionId: param(state, 'id'), focusEntryId: query(state, 'entry')),
      ),
      GoRoute(
        path: '/quotes/:id',
        builder: (_, state) => QuoteDetailScreen(quoteId: param(state, 'id'), focusCommentId: query(state, 'comment')),
      ),
      GoRoute(path: '/printed-books', builder: (_, _) => const PrintedBooksScreen()),
      GoRoute(path: '/leaderboard', builder: (_, _) => const LeaderboardScreen()),
      GoRoute(path: '/authors', builder: (_, _) => const AuthorsScreen()),
      GoRoute(path: '/about', builder: (_, _) => const AboutScreen()),
      GoRoute(path: '/contact', builder: (_, _) => const ContactScreen()),
      GoRoute(
        path: '/terms',
        builder: (_, _) => const LegalScreen(kind: 'terms'),
      ),
      GoRoute(
        path: '/privacy',
        builder: (_, _) => const LegalScreen(kind: 'privacy'),
      ),
      GoRoute(
        path: '/newsletter',
        builder: (_, state) => NewsletterScreen(token: query(state, 'token'), action: query(state, 'action')),
      ),

      // --- Member -----------------------------------------------------------
      GoRoute(path: '/create-book', builder: (_, _) => const CreateBookScreen()),
      GoRoute(
        path: '/dashboard/:bookId',
        builder: (_, state) => DashboardScreen(key: ValueKey(param(state, 'bookId')), bookId: param(state, 'bookId')),
      ),
      GoRoute(
        path: '/print/:bookId',
        builder: (_, state) => PrintApplicationScreen(bookId: param(state, 'bookId')),
      ),
      GoRoute(
        path: '/donate/:bookId',
        builder: (_, state) => CheckoutScreen(bookId: param(state, 'bookId')),
      ),
      GoRoute(path: '/funding-history', builder: (_, _) => const FundingHistoryScreen()),
      GoRoute(path: '/payment/success', redirect: (_, _) => '/funding-history'),
      GoRoute(
        path: '/payment/failure',
        builder: (_, state) => PaymentFailureScreen(reason: query(state, 'reason')),
      ),
      GoRoute(path: '/messages', builder: (_, _) => const MessagesScreen()),
      GoRoute(
        path: '/messages/:id',
        builder: (_, state) => ChatScreen(key: ValueKey(param(state, 'id')), conversationId: param(state, 'id')),
      ),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),

      // --- Roles --------------------------------------------------------------
      GoRoute(path: '/publisher', builder: (_, _) => const PublisherPortalScreen()),
      GoRoute(path: '/admin', builder: (_, _) => const AdminOverviewScreen()),
      GoRoute(path: '/admin/users', redirect: (_, _) => '/admin/data/User'),
      GoRoute(path: '/admin/books', redirect: (_, _) => '/admin/data/Book'),
      GoRoute(path: '/admin/genres', redirect: (_, _) => '/admin/data/Genre'),
      GoRoute(path: '/admin/transactions', redirect: (_, _) => '/admin/data/Transaction'),
      GoRoute(
        path: '/admin/data',
        builder: (_, state) => AdminDataScreen(key: ValueKey(state.uri.toString())),
      ),
      GoRoute(
        path: '/admin/data/:resource',
        builder: (_, state) => AdminDataScreen(
          key: ValueKey(state.uri.toString()),
          resource: param(state, 'resource'),
          initialRecord: query(state, 'record'),
          relatedField: query(state, 'relatedField'),
          relatedId: query(state, 'relatedId'),
        ),
      ),
      GoRoute(
        path: '/admin/record/:resource/:id',
        builder: (_, state) =>
            AdminRecordEditorScreen(key: ValueKey(state.uri.toString()), resource: param(state, 'resource'), id: param(state, 'id')),
      ),
      GoRoute(path: '/admin/schemas', builder: (_, _) => const AdminDataScreen(schemaOnly: true)),
      GoRoute(path: '/admin/session-access', builder: (_, _) => const AdminSessionAccessScreen()),
      GoRoute(path: '/admin/printed-books', builder: (_, _) => const AdminPrintedBooksScreen()),
      GoRoute(path: '/admin/print-funding', builder: (_, _) => const AdminPrintFundingScreen()),

      // --- Website URLs (shared links, e-mails, deep links) -----------------
      // Canonical slug URLs and the legacy id URLs of the website resolve
      // to the id-based routes above (F-NAV-04).
      GoRoute(
        path: '/kitap/:slug',
        builder: (_, state) => _Resolve(type: 'BOOK', reference: param(state, 'slug'), target: _bookTarget(state)),
      ),
      GoRoute(
        path: '/kitap/:slug/oku',
        builder: (_, state) => _Resolve(type: 'BOOK', reference: param(state, 'slug'), target: (route) => '/reader/${route['id']}'),
      ),
      GoRoute(
        path: '/kitap/:slug/bolum/:chapter',
        builder: (_, state) => _Resolve(
          type: 'BOOK',
          reference: param(state, 'slug'),
          chapter: param(state, 'chapter'),
          target: (route) => Uri(
            path: '/reader/${route['id']}',
            queryParameters: {
              if (route['chapterId'] != null) 'chapter': '${route['chapterId']}',
              if (query(state, 'paragraph') != null) 'paragraph': query(state, 'paragraph'),
            },
          ).toString(),
        ),
      ),
      GoRoute(
        path: '/yazar/:username',
        builder: (_, state) => _Resolve(type: 'PROFILE', reference: param(state, 'username'), target: (route) => '/user/${route['id']}'),
      ),
      GoRoute(
        path: '/oturum/:slug',
        builder: (_, state) => _Resolve(
          type: 'SESSION',
          reference: param(state, 'slug'),
          target: (route) =>
              '/session/${route['id']}${_fragmentId(state, 'entry-') == null ? '' : '?entry=${_fragmentId(state, 'entry-')}'}',
        ),
      ),
      GoRoute(
        path: '/book-detail/:id',
        redirect: (_, state) {
          final comment = _fragmentId(state, 'comment-');
          return '/book/${param(state, 'id')}${comment != null ? '?comment=$comment' : (state.uri.fragment == 'comments' ? '?comments=1' : '')}';
        },
      ),
      GoRoute(
        path: '/book-reader/:id',
        redirect: (_, state) => Uri(
          path: '/reader/${param(state, 'id')}',
          queryParameters: {
            ...state.uri.queryParameters,
            if (_fragmentId(state, 'paragraph-comment-') != null) 'comment': _fragmentId(state, 'paragraph-comment-'),
          },
        ).toString(),
      ),
      GoRoute(
        path: '/sessions/:id',
        redirect: (_, state) {
          final entry = _fragmentId(state, 'entry-');
          return '/session/${param(state, 'id')}${entry == null ? '' : '?entry=$entry'}';
        },
      ),
    ],
  );
}

String? _fragmentId(GoRouterState state, String prefix) {
  final fragment = state.uri.fragment;
  return fragment.startsWith(prefix) && fragment.length > prefix.length ? fragment.substring(prefix.length) : null;
}

String Function(Map<String, dynamic>) _bookTarget(GoRouterState state) {
  final comment = _fragmentId(state, 'comment-');
  return (route) => '/book/${route['id']}${comment != null ? '?comment=$comment' : ''}';
}

/// Resolves a website slug with `resolvePublicRoute` and replaces itself
/// with the id-based screen; unknown or inaccessible references show the
/// not-found page.
class _Resolve extends StatelessWidget {
  const _Resolve({required this.type, required this.reference, required this.target, this.chapter});
  final String type;
  final String reference;
  final String? chapter;
  final String Function(Map<String, dynamic> route) target;

  @override
  Widget build(BuildContext context) => Loader<Map<String, dynamic>?>(
    load: () async {
      final data = await context.services.api.run(
        r'query ResolvePublicRoute($type: PublicRouteType!, $reference: String!, $chapter: String) { resolvePublicRoute(type: $type, reference: $reference, chapter: $chapter) { id path chapterId } }',
        variables: {'type': type, 'reference': reference, 'chapter': chapter},
      );
      final route = jsonMap(data['resolvePublicRoute']);
      if (route != null && context.mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) context.pushReplacement(target(route));
        });
      }
      return route;
    },
    errorBuilder: (context, error, retry) => error is ApiException && error.isNetwork
        ? Scaffold(
            appBar: AppBar(),
            body: ErrorView.of(error, onRetry: retry),
          )
        : const NotFoundScreen(),
    builder: (context, route, _) => route == null
        ? const NotFoundScreen()
        : Scaffold(
            appBar: AppBar(),
            body: const LoadingView(label: 'Sayfa yükleniyor...'),
          ),
  );
}
