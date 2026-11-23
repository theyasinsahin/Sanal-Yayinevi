import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The signed-in account as returned by `login` / `registerAndLogin` /
/// `googleAuth` and refreshed from `me`.
class SessionUser {
  const SessionUser({required this.id, required this.username, required this.fullName, required this.email, required this.role});

  final String id;
  final String username;
  final String fullName;
  final String email;

  /// `USER`, `PUBLISHER` or `ADMIN`.
  final String role;

  bool get isAdmin => role == 'ADMIN';
  bool get isPublisher => role == 'PUBLISHER' || role == 'ADMIN';

  SessionUser copyWith({String? username, String? fullName, String? email, String? role}) => SessionUser(
    id: id,
    username: username ?? this.username,
    fullName: fullName ?? this.fullName,
    email: email ?? this.email,
    role: role ?? this.role,
  );

  factory SessionUser.fromJson(Map<String, dynamic> json) => SessionUser(
    id: '${json['id'] ?? ''}',
    username: json['username'] as String? ?? '',
    fullName: json['fullName'] as String? ?? '',
    email: json['email'] as String? ?? '',
    role: json['role'] as String? ?? 'USER',
  );

  Map<String, dynamic> toJson() => {'id': id, 'username': username, 'fullName': fullName, 'email': email, 'role': role};
}

class Session {
  const Session(this.token, this.user);
  final String token;
  final SessionUser user;

  DateTime get expiresAt => tokenExpiresAt(token);
  bool get isExpired => !expiresAt.isAfter(DateTime.now());
}

/// Reads `exp` from the JWT payload. An undecodable token counts as expired
/// (epoch 0), exactly like the web client's `tokenExpiresAt`.
DateTime tokenExpiresAt(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3) return DateTime.fromMillisecondsSinceEpoch(0);
    final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))));
    final exp = payload is Map ? payload['exp'] : null;
    if (exp is num && exp.isFinite) return DateTime.fromMillisecondsSinceEpoch((exp * 1000).round());
  } catch (_) {
    // Fall through: malformed token.
  }
  return DateTime.fromMillisecondsSinceEpoch(0);
}

/// Persistence of the session. The JWT is a bearer credential, so the real
/// implementation uses Keychain / Android Keystore — never plain preferences.
abstract class SessionStore {
  Future<Session?> read();
  Future<void> write(Session session);
  Future<void> clear();
}

class SecureSessionStore implements SessionStore {
  SecureSessionStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage(iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device));

  static const _tokenKey = 'betik.session.token';
  static const _userKey = 'betik.session.user';

  final FlutterSecureStorage _storage;

  @override
  Future<Session?> read() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      final user = await _storage.read(key: _userKey);
      if (token == null || user == null) return null;
      final decoded = jsonDecode(user);
      if (decoded is! Map || '${decoded['id'] ?? ''}'.isEmpty) return null;
      return Session(token, SessionUser.fromJson(Map<String, dynamic>.from(decoded)));
    } catch (_) {
      // A corrupted or unreadable keychain entry is the same as no session.
      return null;
    }
  }

  @override
  Future<void> write(Session session) async {
    await _storage.write(key: _tokenKey, value: session.token);
    await _storage.write(key: _userKey, value: jsonEncode(session.user.toJson()));
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}

class MemorySessionStore implements SessionStore {
  MemorySessionStore([this._session]);
  Session? _session;

  @override
  Future<Session?> read() async => _session;

  @override
  Future<void> write(Session session) async => _session = session;

  @override
  Future<void> clear() async => _session = null;
}
