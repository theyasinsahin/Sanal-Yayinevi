import 'dart:async';

import 'package:flutter/foundation.dart';

import '../network/api_error.dart';
import '../network/graphql_client.dart';
import 'session.dart';

const _userFields = 'id username fullName email role';

/// Result of an auth mutation that reports failure inside a successful
/// response (`Status{code:400}` — Stage 1 `05` §3).
class StatusResult {
  const StatusResult(this.ok, this.message);
  final bool ok;
  final String message;

  factory StatusResult.fromJson(Object? json) {
    if (json is Map) return StatusResult(json['code'] == 200, json['message'] as String? ?? '');
    return const StatusResult(false, ApiException.genericMessage);
  }
}

/// Owns the session lifecycle. Ports the frontend-only rules of the web
/// `AuthContext` (F-AUTH-08) because the server never answers 401:
///
/// * a stored token whose `exp` has passed is discarded before any request;
/// * the session is validated with `me` on start, on app resume and every
///   60 s in the foreground; `me.id` mismatch or `UNAUTHENTICATED` signs out;
/// * a timer fires exactly at token expiry (24 h, no refresh token exists);
/// * any `UNAUTHENTICATED` answer to a request that carried the current
///   token signs out locally.
class AuthController extends ChangeNotifier {
  AuthController({required SessionStore store, this.revalidateEvery = const Duration(seconds: 60)})
    // ignore: prefer_initializing_formals
    : _store = store;

  final SessionStore _store;
  final Duration revalidateEvery;

  late GraphQLClient _client;
  Session? _session;
  bool _initialising = true;
  Timer? _expiryTimer;
  Timer? _revalidateTimer;
  bool _validating = false;
  bool _foreground = true;

  /// Why the last session ended; shown once on the login screen.
  String? signedOutNotice;

  /// Bumped whenever the signed-in identity changes (login, logout, token
  /// replacement). The subscription socket and per-user caches listen to it.
  final ValueNotifier<int> sessionEpoch = ValueNotifier<int>(0);

  SessionUser? get user => _session?.user;
  bool get isSignedIn => _session != null;
  bool get isInitialising => _initialising;
  String? get userId => _session?.user.id;

  /// The token for the next request; an expired token is dropped before it
  /// is sent (the server would silently answer as a guest).
  String? get token {
    final session = _session;
    if (session == null) return null;
    if (session.isExpired) {
      scheduleMicrotask(() => _expire(session.token));
      return null;
    }
    return session.token;
  }

  void attach(GraphQLClient client) {
    _client = client;
    client.onSessionRejected = invalidate;
  }

  Future<void> initialise() async {
    final stored = await _store.read();
    if (stored != null && !stored.isExpired) {
      _session = stored;
      _armTimers();
    } else if (stored != null) {
      await _store.clear();
    }
    _initialising = false;
    notifyListeners();
    if (_session != null) unawaited(validate());
  }

  /// Confirms the stored session with the server and refreshes the role.
  Future<void> validate() async {
    final session = _session;
    if (session == null || _validating) return;
    _validating = true;
    try {
      final data = await _client.run('query Me { me { $_userFields } }');
      final me = data['me'];
      if (_session?.token != session.token) return;
      if (me is! Map || '${me['id']}' != session.user.id) {
        await _signOutLocally(notice: 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.');
        return;
      }
      final fresh = SessionUser.fromJson(Map<String, dynamic>.from(me));
      final current = session.user;
      if (fresh.role != current.role ||
          fresh.username != current.username ||
          fresh.fullName != current.fullName ||
          fresh.email != current.email) {
        _session = Session(session.token, fresh);
        await _store.write(_session!);
        notifyListeners();
      }
    } on ApiException catch (error) {
      // UNAUTHENTICATED is handled through onSessionRejected. Network errors
      // keep the session: being offline is not a sign-out.
      if (error.kind == ApiErrorKind.forbidden) {
        await _signOutLocally(notice: 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.');
      }
    } finally {
      _validating = false;
    }
  }

  Future<void> login(String email, String password) async {
    final data = await _client.run(
      'mutation Login(\$email: String!, \$password: String!) { login(email: \$email, password: \$password) { token user { $_userFields } } }',
      variables: {'email': email.trim(), 'password': password},
      authenticated: false,
    );
    await _acceptPayload(data['login']);
  }

  /// `googleAuth(token)` expects a Google **ID token** whose audience is the
  /// backend's web client id (not an access token).
  Future<void> loginWithGoogleIdToken(String idToken) async {
    final data = await _client.run(
      'mutation GoogleAuth(\$token: String!) { googleAuth(token: \$token) { token user { $_userFields } } }',
      variables: {'token': idToken},
      authenticated: false,
    );
    await _acceptPayload(data['googleAuth']);
  }

  Future<StatusResult> sendRegistrationCode({required String email, required String username}) async {
    final data = await _client.run(
      'mutation SendRegistrationCode(\$email: String!, \$username: String!) { sendRegistrationCode(email: \$email, username: \$username) { code message } }',
      variables: {'email': email.trim(), 'username': username.trim()},
      authenticated: false,
    );
    return StatusResult.fromJson(data['sendRegistrationCode']);
  }

  Future<StatusResult> registerAndLogin({
    required String username,
    required String fullName,
    required String email,
    required String password,
    required String code,
  }) async {
    final data = await _client.run(
      'mutation RegisterAndLogin(\$username: String!, \$fullName: String!, \$email: String!, \$password: String!, \$code: String!) { registerAndLogin(username: \$username, fullName: \$fullName, email: \$email, password: \$password, code: \$code) { code message token user { $_userFields } } }',
      variables: {
        'username': username.trim(),
        'fullName': fullName.trim(),
        'email': email.trim(),
        'password': password,
        'code': code.trim(),
      },
      authenticated: false,
    );
    final payload = data['registerAndLogin'];
    final status = StatusResult.fromJson(payload);
    if (status.ok && payload is Map && payload['token'] is String && payload['user'] is Map) {
      await _acceptPayload(payload);
      return status;
    }
    // A 200 without a token would be a fabricated success; treat as failure.
    return StatusResult(false, status.message.isEmpty ? ApiException.genericMessage : status.message);
  }

  Future<StatusResult> forgotPassword(String email) async {
    final data = await _client.run(
      'mutation ForgotPassword(\$email: String!) { forgotPassword(email: \$email) { code message } }',
      variables: {'email': email.trim()},
      authenticated: false,
    );
    return StatusResult.fromJson(data['forgotPassword']);
  }

  Future<StatusResult> resetPassword({required String token, required String newPassword}) async {
    final data = await _client.run(
      'mutation ResetPassword(\$token: String!, \$newPassword: String!) { resetPassword(token: \$token, newPassword: \$newPassword) { code message } }',
      variables: {'token': token, 'newPassword': newPassword},
      authenticated: false,
    );
    return StatusResult.fromJson(data['resetPassword']);
  }

  /// `logout` revokes **every** device's token on the server (authVersion++).
  /// The local session is cleared even when the call fails, like the web.
  Future<void> logout() async {
    if (_session != null) {
      try {
        await _client.run('mutation Logout { logout { code message } }');
      } on ApiException {
        // Local sign-out must not depend on the network.
      }
    }
    await _signOutLocally();
  }

  /// Called after `changeEmail` / `changePassword` / `deactivateAccount` /
  /// `deleteAccount`: the server has already invalidated the token.
  Future<void> endSession({String? notice}) => _signOutLocally(notice: notice);

  /// The server refused [rejectedToken]. Ignored when the user has signed in
  /// again since that request was sent.
  void invalidate(String rejectedToken) {
    if (_session?.token != rejectedToken) return;
    unawaited(_signOutLocally(notice: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.'));
  }

  void updateLocalUser({String? username, String? fullName}) {
    final session = _session;
    if (session == null) return;
    _session = Session(session.token, session.user.copyWith(username: username, fullName: fullName));
    unawaited(_store.write(_session!));
    notifyListeners();
  }

  void onAppResumed() {
    _foreground = true;
    final session = _session;
    if (session == null) return;
    if (session.isExpired) {
      _expire(session.token);
      return;
    }
    _armTimers();
    unawaited(validate());
  }

  void onAppPaused() {
    _foreground = false;
    _revalidateTimer?.cancel();
  }

  Future<void> _acceptPayload(Object? payload) async {
    if (payload is! Map || payload['token'] is! String || payload['user'] is! Map) {
      throw ApiException(ApiErrorKind.server, ApiException.genericMessage);
    }
    final session = Session(payload['token'] as String, SessionUser.fromJson(Map<String, dynamic>.from(payload['user'] as Map)));
    if (session.isExpired || session.user.id.isEmpty) {
      throw ApiException(ApiErrorKind.server, ApiException.genericMessage);
    }
    _session = session;
    signedOutNotice = null;
    await _store.write(session);
    _armTimers();
    sessionEpoch.value++;
    notifyListeners();
  }

  void _expire(String token) {
    if (_session?.token != token) return;
    unawaited(_signOutLocally(notice: 'Oturum süreniz doldu. Lütfen yeniden giriş yapın.'));
  }

  Future<void> _signOutLocally({String? notice}) async {
    if (_session == null) return;
    _session = null;
    signedOutNotice = notice;
    _expiryTimer?.cancel();
    _revalidateTimer?.cancel();
    sessionEpoch.value++;
    notifyListeners();
    await _store.clear();
  }

  void _armTimers() {
    _expiryTimer?.cancel();
    _revalidateTimer?.cancel();
    final session = _session;
    if (session == null) return;
    final remaining = session.expiresAt.difference(DateTime.now());
    _expiryTimer = Timer(remaining.isNegative ? Duration.zero : remaining, () => _expire(session.token));
    if (_foreground && revalidateEvery > Duration.zero) {
      _revalidateTimer = Timer.periodic(revalidateEvery, (_) => validate());
    }
  }

  @override
  void dispose() {
    _expiryTimer?.cancel();
    _revalidateTimer?.cancel();
    sessionEpoch.dispose();
    super.dispose();
  }
}
