import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth/auth_controller.dart';
import 'auth/google_sign_in.dart';
import 'auth/session.dart';
import 'config/app_config.dart';
import 'network/api_error.dart';
import 'network/graphql_client.dart';
import 'network/subscription_client.dart';

/// Device-local key/value store (reading progress, font size, unsent
/// reading time, checkout idempotency keys). Never holds credentials.
abstract class LocalStore {
  String? getString(String key);
  Future<void> setString(String key, String value);
  Future<void> remove(String key);
  Iterable<String> keys();
}

class PrefsLocalStore implements LocalStore {
  PrefsLocalStore(this._prefs);
  final SharedPreferences _prefs;
  @override
  String? getString(String key) => _prefs.getString(key);
  @override
  Future<void> setString(String key, String value) => _prefs.setString(key, value);
  @override
  Future<void> remove(String key) => _prefs.remove(key);
  @override
  Iterable<String> keys() => _prefs.getKeys();
}

class MemoryLocalStore implements LocalStore {
  final Map<String, String> values = {};
  @override
  String? getString(String key) => values[key];
  @override
  Future<void> setString(String key, String value) async => values[key] = value;
  @override
  Future<void> remove(String key) async => values.remove(key);
  @override
  Iterable<String> keys() => values.keys.toList();
}

/// Reading font size (F-NAV-11 / F-SET-06): three steps, device-local only,
/// stored under the website's key name `app_font_size`.
class ReadingPreferences extends ChangeNotifier {
  ReadingPreferences(this._store) {
    final stored = _store.getString(_key);
    if (sizes.containsKey(stored)) _size = stored!;
  }

  static const _key = 'app_font_size';
  static const sizes = {'sm': 16.0, 'md': 18.0, 'lg': 20.0};
  static const labels = {'sm': 'Küçük', 'md': 'Orta', 'lg': 'Büyük'};

  final LocalStore _store;
  String _size = 'md';

  String get size => _size;
  double get fontSize => sizes[_size]!;

  Future<void> setSize(String value) async {
    if (!sizes.containsKey(value) || value == _size) return;
    _size = value;
    notifyListeners();
    await _store.setString(_key, value);
  }
}

/// A member-only action attempted by a guest (F-AUTH-10). Kept in memory
/// for 30 minutes and consumed by the originating screen after sign-in.
class RegistrationIntent {
  RegistrationIntent({required this.action, required this.returnTo, this.bookTitle, this.draft, this.data = const {}})
    : createdAt = DateTime.now();
  final String action;
  final String returnTo;
  final String? bookTitle;
  final String? draft;
  final Map<String, dynamic> data;
  final DateTime createdAt;

  bool get isFresh => DateTime.now().difference(createdAt) < const Duration(minutes: 30);
}

class IntentStore {
  RegistrationIntent? _intent;

  void save(RegistrationIntent intent) => _intent = intent;

  /// Where to go after authentication: the intent's origin, or null.
  String? get returnTo => (_intent?.isFresh ?? false) ? _intent!.returnTo : null;

  /// Returns and clears the pending intent when it matches [action] and
  /// [location].
  RegistrationIntent? consume(String action, String location) {
    final intent = _intent;
    if (intent == null || !intent.isFresh) {
      _intent = null;
      return null;
    }
    if (intent.action != action || intent.returnTo != location) return null;
    _intent = null;
    return intent;
  }

  RegistrationIntent? peek() => (_intent?.isFresh ?? false) ? _intent : null;
  void clear() => _intent = null;
}

/// Unread counters for the app bar. The backend has no push and no events
/// for notifications, so these are polled in the foreground like the web:
/// notifications every 15 s, messages every 30 s; a `myScoreUpdated` event
/// triggers an immediate refresh (points always create a notification).
class BadgeController extends ChangeNotifier {
  BadgeController(this._services);

  final AppServices _services;
  Timer? _notificationTimer;
  Timer? _messageTimer;
  StreamSubscription<Json>? _scoreSubscription;
  int notifications = 0;
  int messages = 0;

  /// Bumped on every `myScoreUpdated` event; score-dependent screens listen.
  final ValueNotifier<int> scoreTick = ValueNotifier<int>(0);

  void start() {
    stop();
    if (!_services.auth.isSignedIn) {
      if (notifications != 0 || messages != 0) {
        notifications = 0;
        messages = 0;
        notifyListeners();
      }
      return;
    }
    refresh();
    _notificationTimer = Timer.periodic(const Duration(seconds: 15), (_) => refreshNotifications());
    _messageTimer = Timer.periodic(const Duration(seconds: 30), (_) => refreshMessages());
    _scoreSubscription = _services.subscriptions.subscribe('subscription MyScoreUpdated { myScoreUpdated }').listen((_) {
      scoreTick.value++;
      refreshNotifications();
    }, onError: (Object _) {});
  }

  void stop() {
    _notificationTimer?.cancel();
    _messageTimer?.cancel();
    _scoreSubscription?.cancel();
    _scoreSubscription = null;
  }

  Future<void> refresh() => Future.wait([refreshNotifications(), refreshMessages()]);

  Future<void> refreshNotifications() async {
    if (!_services.auth.isSignedIn) return;
    try {
      final data = await _services.api.run('query GetUnreadNotificationCount { getUnreadNotificationCount }');
      _set(notifications: (data['getUnreadNotificationCount'] as num?)?.toInt() ?? 0);
    } on ApiException {
      // Keep the last known value; the next tick retries.
    }
  }

  Future<void> refreshMessages() async {
    if (!_services.auth.isSignedIn) return;
    try {
      final data = await _services.api.run('query GetUnreadMessageCount { getUnreadMessageCount }');
      _set(messages: (data['getUnreadMessageCount'] as num?)?.toInt() ?? 0);
    } on ApiException {
      // See above.
    }
  }

  void clearNotifications() => _set(notifications: 0);

  void _set({int? notifications, int? messages}) {
    final n = notifications ?? this.notifications;
    final m = messages ?? this.messages;
    if (n == this.notifications && m == this.messages) return;
    this.notifications = n;
    this.messages = m;
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    scoreTick.dispose();
    super.dispose();
  }
}

/// Composition root: every long-lived object of the app.
class AppServices with WidgetsBindingObserver {
  AppServices._({
    required this.config,
    required this.auth,
    required this.api,
    required this.subscriptions,
    required this.local,
    required this.google,
  }) {
    readingPreferences = ReadingPreferences(local);
    badges = BadgeController(this);
  }

  final AppConfig config;
  final AuthController auth;
  final GraphQLClient api;
  final SubscriptionClient subscriptions;
  final LocalStore local;
  final GoogleIdTokenSource google;
  final IntentStore intents = IntentStore();
  late final ReadingPreferences readingPreferences;
  late final BadgeController badges;

  /// Raised by screens that changed data other screens show (book status,
  /// follow state…). Listeners refetch.
  final ValueNotifier<int> dataEpoch = ValueNotifier<int>(0);
  void invalidateData() => dataEpoch.value++;

  static Future<AppServices> create({
    AppConfig? config,
    SessionStore? sessionStore,
    LocalStore? localStore,
    GraphQLClient? api,
    SubscriptionClient? subscriptions,
    GoogleIdTokenSource? google,
  }) async {
    final resolvedConfig = config ?? AppConfig.fromEnvironment();
    final auth = AuthController(store: sessionStore ?? SecureSessionStore());
    final client = api ?? GraphQLClient(endpoint: resolvedConfig.apiUrl, readToken: () => auth.token);
    auth.attach(client);
    final services = AppServices._(
      config: resolvedConfig,
      auth: auth,
      api: client,
      subscriptions: subscriptions ?? SubscriptionClient(url: resolvedConfig.wsUrl, readToken: () => auth.token),
      local: localStore ?? PrefsLocalStore(await SharedPreferences.getInstance()),
      google: google ?? PluginGoogleIdTokenSource(resolvedConfig),
    );
    await auth.initialise();
    auth.sessionEpoch.addListener(services._onSessionChanged);
    services._onSessionChanged();
    WidgetsBinding.instance.addObserver(services);
    return services;
  }

  void _onSessionChanged() {
    // New identity → new socket (connection_init carries the token) and
    // fresh counters.
    subscriptions.reset();
    badges.start();
    invalidateData();
    // Signed out (logout, expiry, revoked token): forget the Google account
    // too, so the next Google sign-in offers the account chooser.
    if (!auth.isSignedIn) unawaited(google.signOut());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      auth.onAppResumed();
      subscriptions.resume();
      badges.start();
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      auth.onAppPaused();
      subscriptions.suspend();
      badges.stop();
    }
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    badges.dispose();
    subscriptions.dispose();
    api.close();
    auth.dispose();
    dataEpoch.dispose();
  }

  // Small JSON helpers for the local store.
  Map<String, dynamic>? readJson(String key) {
    final raw = local.getString(key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map ? Map<String, dynamic>.from(decoded) : null;
    } on FormatException {
      return null;
    }
  }

  Future<void> writeJson(String key, Map<String, dynamic> value) => local.setString(key, jsonEncode(value));
}

extension AppServicesContext on BuildContext {
  AppServices get services => read<AppServices>();
  GraphQLClient get api => read<AppServices>().api;
  AuthController get auth => read<AuthController>();
}
