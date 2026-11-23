import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Build-time configuration. Every value comes from `--dart-define`
/// (or `--dart-define-from-file`); nothing here is a secret.
///
/// Release builds have **no** endpoint default on purpose: the production
/// hostnames are not recorded in the repository (Stage 1 U-02), and a
/// development address must never ship as a production default.
class AppConfig {
  const AppConfig({
    required this.apiUrl,
    required this.wsUrl,
    required this.webUrl,
    required this.cloudinaryCloudName,
    required this.cloudinaryUploadPreset,
    this.cloudinaryApiBase = 'https://api.cloudinary.com',
    required this.googleServerClientId,
    required this.googleIosClientId,
  });

  /// GraphQL HTTP endpoint (the bare API origin; Apollo is mounted on `/`).
  final String apiUrl;

  /// GraphQL WebSocket endpoint (`/graphql`, protocol `graphql-transport-ws`).
  final String wsUrl;

  /// Public website origin. Shared links, root-relative images and legal
  /// links resolve against it.
  final String webUrl;

  final String cloudinaryCloudName;
  final String cloudinaryUploadPreset;

  /// Origin of the Cloudinary upload API. Only regional accounts
  /// (`https://api-eu.cloudinary.com`) and isolated test environments change
  /// it (`BETIK_CLOUDINARY_API_BASE`).
  final String cloudinaryApiBase;

  Uri get cloudinaryUploadUri => Uri.parse('$cloudinaryApiBase/v1_1/$cloudinaryCloudName/image/upload');

  /// The backend's `GOOGLE_CLIENT_ID` (a *web* OAuth client). The ID token
  /// sent to `googleAuth(token)` must carry this audience. Required on both
  /// platforms.
  final String googleServerClientId;

  /// The iOS OAuth client of the same Google Cloud project. Required on iOS;
  /// its reversed form must also be registered as a URL scheme
  /// (`ios/Flutter/GoogleSignIn.xcconfig`, see `tool/configure_google_sign_in.sh`).
  final String googleIosClientId;

  bool get isConfigured => apiUrl.isNotEmpty;
  bool get imageUploadEnabled => cloudinaryCloudName.isNotEmpty && cloudinaryUploadPreset.isNotEmpty;

  /// Google sign-in is a product requirement on both platforms, so the button
  /// is always shown; without these ids it explains that the build is not
  /// configured instead of opening Google.
  bool get googleSignInConfigured => googleSignInConfiguredFor(isIos: !kIsWeb && Platform.isIOS);

  @visibleForTesting
  bool googleSignInConfiguredFor({required bool isIos}) {
    if (!isGoogleClientId(googleServerClientId)) return false;
    return !isIos || isGoogleClientId(googleIosClientId);
  }

  /// `<project number>-<id>.apps.googleusercontent.com`.
  static bool isGoogleClientId(String value) => RegExp(r'^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$').hasMatch(value);

  static const _api = String.fromEnvironment('BETIK_API_URL');
  static const _ws = String.fromEnvironment('BETIK_WS_URL');
  static const _web = String.fromEnvironment('BETIK_WEB_URL');
  static const _cloud = String.fromEnvironment('BETIK_CLOUDINARY_CLOUD_NAME');
  static const _preset = String.fromEnvironment('BETIK_CLOUDINARY_UPLOAD_PRESET');
  static const _cloudApi = String.fromEnvironment('BETIK_CLOUDINARY_API_BASE', defaultValue: 'https://api.cloudinary.com');
  static const _googleServer = String.fromEnvironment('BETIK_GOOGLE_SERVER_CLIENT_ID');
  static const _googleIos = String.fromEnvironment('BETIK_GOOGLE_IOS_CLIENT_ID');
  static const _devPort = int.fromEnvironment('BETIK_DEV_API_PORT', defaultValue: 5000);
  static const _devWebPort = int.fromEnvironment('BETIK_DEV_WEB_PORT', defaultValue: 3000);

  /// Host of the developer machine as seen from the running app. The Android
  /// emulator reaches it through 10.0.2.2; the iOS simulator shares the
  /// host's loopback. Physical devices need an explicit `BETIK_API_URL`.
  static String get _devHost => (!kIsWeb && Platform.isAndroid) ? '10.0.2.2' : 'localhost';

  static AppConfig fromEnvironment() {
    var api = _api;
    var web = _web;
    if (api.isEmpty && !kReleaseMode) api = 'http://$_devHost:$_devPort';
    if (web.isEmpty && !kReleaseMode) web = 'http://$_devHost:$_devWebPort';
    return AppConfig(
      apiUrl: _trim(api),
      wsUrl: _ws.isNotEmpty ? _ws : deriveWsUrl(api),
      webUrl: _trim(web),
      cloudinaryCloudName: _cloud,
      cloudinaryUploadPreset: _preset,
      cloudinaryApiBase: _trim(_cloudApi),
      googleServerClientId: _googleServer,
      googleIosClientId: _googleIos,
    );
  }

  static String _trim(String value) => value.endsWith('/') ? value.substring(0, value.length - 1) : value;

  /// Same derivation as the web client's `createApiConfig`.
  static String deriveWsUrl(String apiUrl) {
    if (apiUrl.isEmpty) return '';
    final api = Uri.parse(apiUrl);
    return api.replace(scheme: api.scheme == 'https' ? 'wss' : 'ws', path: '/graphql').toString();
  }

  /// Resolves image/link references that may be absolute, root-relative
  /// (served by the web host) or `data:` URIs.
  String resolveWebAsset(String reference) {
    if (reference.isEmpty) return reference;
    if (reference.startsWith('data:') || reference.contains('://')) return reference;
    if (reference.startsWith('/') && webUrl.isNotEmpty) return '$webUrl$reference';
    return reference;
  }
}
