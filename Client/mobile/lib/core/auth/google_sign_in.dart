import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/app_config.dart';
import '../network/api_error.dart';
import 'auth_controller.dart';

/// Native Google sign-in feeding the backend's existing `googleAuth(token)`.
///
/// The backend (`authenticateWithGoogleCredential`, shared with the website)
/// verifies a Google **ID token** against one audience, its `GOOGLE_CLIENT_ID`
/// web client, then logs in, links or creates the account and returns its own
/// JWT. The app therefore asks Google for an ID token minted for that web
/// client (`serverClientId`) and hands it to the normal session handling
/// (`AuthController.loginWithGoogleIdToken`): secure storage, expiry timers,
/// socket reset and navigation are the same as for e-mail login.

/// Website copy (`Login` page, `?error=google_auth_failed`).
const googleFailedMessage = 'Google ile giriş yapılamadı. Lütfen tekrar deneyin.';

/// Website copy (`?error=google_no_credential`).
const googleNoCredentialMessage = 'Google\'dan giriş bilgisi alınamadı. Lütfen tekrar deneyin.';

const googleNotConfiguredMessage =
    'Google ile giriş bu uygulama sürümünde henüz yapılandırılmadı. Şimdilik e-posta adresinizle giriş yapabilirsiniz.';

const googleInterruptedMessage = 'Google ile giriş yarıda kaldı. Lütfen tekrar deneyin.';

/// Server messages of `authenticateWithGoogleCredential` written for users.
/// Anything else from `googleAuth` (raw token-verification errors such as
/// "Wrong number of segments in token", or the masked production sentence)
/// is shown as [googleFailedMessage], like the website does.
const googleUserFacingServerMessages = {
  'Bu e-posta adresine ait hesap silinmiş.',
  'Bu hesaba mevcut parolanızla giriş yapın; Google bağlantısı ayrıca doğrulanmalıdır.',
  'Giriş bilgileri geçersiz.',
  'Google hesabı doğrulanamadı.',
  'Google girişi bu geliştirme ortamında kapalı.',
};

/// A user-presentable Google sign-in failure.
class GoogleSignInFailure implements Exception {
  const GoogleSignInFailure(this.message, {this.configuration = false, this.cause});
  final String message;

  /// The build or the Google Cloud project is not set up (missing client id,
  /// wrong SHA-1, bundle id or URL scheme). Logged for developers.
  final bool configuration;
  final Object? cause;

  @override
  String toString() => 'GoogleSignInFailure($message${cause == null ? '' : ', $cause'})';
}

/// Source of Google ID tokens. Replaced by a fake in tests.
abstract class GoogleIdTokenSource {
  /// The build carries the client ids this platform needs.
  bool get isConfigured;

  /// Shows Google's account chooser and returns an ID token for the backend
  /// audience, or null when the user cancelled. Throws [GoogleSignInFailure].
  Future<String?> idToken();

  /// Forgets the Google account chosen last, so the next sign-in shows the
  /// chooser again (account switching after logout). Never throws.
  Future<void> signOut();
}

/// [GoogleIdTokenSource] backed by `google_sign_in` 7 (Credential Manager on
/// Android, GoogleSignIn SDK on iOS).
class PluginGoogleIdTokenSource implements GoogleIdTokenSource {
  PluginGoogleIdTokenSource(this.config, {MethodChannel? platformConfig})
    : _platformConfig = platformConfig ?? const MethodChannel('betik/platform_config');
  final AppConfig config;
  final MethodChannel _platformConfig;
  Future<void>? _initialised;

  /// iOS: the GoogleSignIn SDK crashes the app (uncatchable NSException) if
  /// the reversed client id is not a registered URL scheme, so check first.
  Future<void> _checkIosUrlScheme() async {
    if (kIsWeb || !Platform.isIOS) return;
    final expected = reversedGoogleClientId(config.googleIosClientId);
    List<String> schemes;
    try {
      schemes = (await _platformConfig.invokeListMethod<String>('urlSchemes')) ?? const [];
    } on PlatformException catch (error) {
      throw GoogleSignInFailure(googleNotConfiguredMessage, configuration: true, cause: error);
    }
    if (!schemes.contains(expected)) {
      debugPrint('Google sign-in: URL scheme $expected is not registered (ios/Flutter/GoogleSignIn.xcconfig).');
      throw const GoogleSignInFailure(googleNotConfiguredMessage, configuration: true);
    }
  }

  @override
  bool get isConfigured => config.googleSignInConfigured;

  Future<void> _initialise() => _initialised ??= GoogleSignIn.instance
      .initialize(
        // iOS needs its own client id; Android identifies the app by package
        // name + signing certificate and needs none.
        clientId: !kIsWeb && Platform.isIOS ? config.googleIosClientId : null,
        serverClientId: config.googleServerClientId,
      )
      .catchError((Object error) {
        _initialised = null;
        throw error;
      });

  @override
  Future<String?> idToken() async {
    if (!isConfigured) throw const GoogleSignInFailure(googleNotConfiguredMessage, configuration: true);
    try {
      await _checkIosUrlScheme();
      await _initialise();
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) throw const GoogleSignInFailure(googleNoCredentialMessage);
      return token;
    } on GoogleSignInException catch (error) {
      final failure = googleFailureFor(error);
      if (failure == null) return null;
      if (failure.configuration) debugPrint('Google sign-in configuration error: ${error.code} ${error.description}');
      throw failure;
    } on GoogleSignInFailure {
      rethrow;
    } catch (error) {
      debugPrint('Google sign-in failed: $error');
      throw GoogleSignInFailure(googleFailedMessage, cause: error);
    }
  }

  @override
  Future<void> signOut() async {
    if (_initialised == null) return;
    try {
      await _initialised;
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // Local sign-out never depends on Google.
    }
  }
}

/// `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`
/// (the iOS redirect URL scheme Google expects).
String reversedGoogleClientId(String clientId) {
  const suffix = '.apps.googleusercontent.com';
  final prefix = clientId.endsWith(suffix) ? clientId.substring(0, clientId.length - suffix.length) : clientId;
  return 'com.googleusercontent.apps.$prefix';
}

/// Plugin error → user message; null for a deliberate cancel.
///
/// Note (plugin README): on Android some configuration errors (wrong SHA-1 or
/// package name) arrive as `canceled` right after an account was picked; they
/// cannot be told apart from a real cancel.
GoogleSignInFailure? googleFailureFor(GoogleSignInException error) => switch (error.code) {
  GoogleSignInExceptionCode.canceled => null,
  GoogleSignInExceptionCode.interrupted => GoogleSignInFailure(googleInterruptedMessage, cause: error),
  GoogleSignInExceptionCode.clientConfigurationError ||
  GoogleSignInExceptionCode.providerConfigurationError => GoogleSignInFailure(googleFailedMessage, configuration: true, cause: error),
  _ => GoogleSignInFailure(googleFailedMessage, cause: error),
};

/// `googleAuth` error → user message.
String googleBackendMessage(ApiException error) {
  if (error.isNetwork) return error.message;
  if (error.kind == ApiErrorKind.rateLimited) return ApiException.rateLimitedMessage;
  if (googleUserFacingServerMessages.contains(error.message.trim())) return error.message.trim();
  return googleFailedMessage;
}

enum GoogleSignInOutcome { signedIn, cancelled }

/// The whole flow: Google account → ID token → `googleAuth` → session.
/// Throws [GoogleSignInFailure] with a message for the screen.
Future<GoogleSignInOutcome> signInWithGoogle(GoogleIdTokenSource identity, AuthController auth) async {
  if (!identity.isConfigured) throw const GoogleSignInFailure(googleNotConfiguredMessage, configuration: true);
  final String? token;
  try {
    token = await identity.idToken();
  } on GoogleSignInFailure {
    rethrow;
  } catch (error) {
    throw GoogleSignInFailure(googleFailedMessage, cause: error);
  }
  if (token == null) return GoogleSignInOutcome.cancelled;
  try {
    await auth.loginWithGoogleIdToken(token);
  } on ApiException catch (error) {
    // Let the next attempt choose a different Google account.
    unawaited(identity.signOut());
    throw GoogleSignInFailure(googleBackendMessage(error), cause: error);
  }
  return GoogleSignInOutcome.signedIn;
}
