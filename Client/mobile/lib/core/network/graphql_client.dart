import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

import 'api_error.dart';

typedef Json = Map<String, dynamic>;

/// Supplies the current bearer token, or null for guests / expired tokens.
typedef TokenReader = String? Function();

/// Minimal GraphQL-over-HTTP client for the Betik API.
///
/// Contract notes (Stage 1 `05_authentication_security.md` §7):
/// * one operation per POST to the API origin, `Content-Type: application/json`
///   (Apollo CSRF prevention), no batching, no compressed request bodies;
/// * an invalid token is silently treated as a guest by the server, so an
///   `UNAUTHENTICATED` answer to a request that carried a token means the
///   session was revoked → [onSessionRejected].
class GraphQLClient {
  GraphQLClient({
    required this.endpoint,
    required this.readToken,
    http.Client? httpClient,
    this.onSessionRejected,
    this.timeout = const Duration(seconds: 30),
  }) : _http = httpClient ?? _defaultHttpClient();

  /// Node closes idle keep-alive connections after 5 s (and proxies in
  /// between may do so earlier). Reusing such a connection fails the next
  /// POST with "connection closed before full header was received", which
  /// the user would see as a network error on the first tap after a pause.
  /// Pooled connections are therefore dropped before the server does it.
  static http.Client _defaultHttpClient() => IOClient(HttpClient()..idleTimeout = const Duration(seconds: 3));

  final String endpoint;
  final TokenReader readToken;
  final http.Client _http;
  final Duration timeout;

  /// Called with the token that the server refused.
  void Function(String token)? onSessionRejected;

  Uri get _uri => Uri.parse(endpoint.endsWith('/') ? endpoint : '$endpoint/');

  /// Runs [document] and returns the `data` object.
  ///
  /// Throws [ApiException] for transport failures and for GraphQL errors.
  /// With [allowPartial] a response that has both `data` and `errors` returns
  /// the data (used by screens that can render without a failed sub-field).
  Future<Json> run(String document, {Json variables = const {}, bool allowPartial = false, bool authenticated = true}) async {
    final token = authenticated ? readToken() : null;
    final http.Response response;
    try {
      response = await _http
          .post(
            _uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              if (token != null) 'Authorization': 'Bearer $token',
            },
            body: jsonEncode({'query': document, 'variables': variables}),
          )
          .timeout(timeout);
    } on TimeoutException catch (error) {
      throw ApiException.network(error);
    } on SocketException catch (error) {
      throw ApiException.network(error);
    } on http.ClientException catch (error) {
      throw ApiException.network(error);
    } on HandshakeException catch (error) {
      throw ApiException.network(error);
    }

    Object? body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      body = null;
    }

    if (body is Map && body['errors'] is List && (body['errors'] as List).isNotEmpty) {
      final error = ApiException.fromGraphQL(body['errors'] as List, statusCode: response.statusCode);
      if (error.isUnauthenticated && token != null) onSessionRejected?.call(token);
      final data = body['data'];
      if (allowPartial && data is Map && !error.isUnauthenticated) return Map<String, dynamic>.from(data);
      throw error;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = ApiException.fromHttp(response.statusCode, body);
      if (error.isUnauthenticated && token != null) onSessionRejected?.call(token);
      throw error;
    }
    if (body is Map && body['data'] is Map) return Map<String, dynamic>.from(body['data'] as Map);
    throw ApiException(ApiErrorKind.server, ApiException.genericMessage, statusCode: response.statusCode);
  }

  /// Raw authenticated HTTP for the REST companions (`/api/print/assets`).
  Future<http.Response> rawRequest(
    String method,
    String path, {
    Map<String, String> headers = const {},
    List<int>? body,
    Duration? timeout,
  }) async {
    final token = readToken();
    final request = http.Request(method, Uri.parse(endpoint).resolve(path))
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token', ...headers});
    if (body != null) request.bodyBytes = body;
    try {
      final streamed = await _http.send(request).timeout(timeout ?? const Duration(seconds: 60));
      final response = await http.Response.fromStream(streamed);
      if (response.statusCode >= 200 && response.statusCode < 300) return response;
      Object? decoded;
      try {
        decoded = jsonDecode(utf8.decode(response.bodyBytes));
      } on FormatException {
        decoded = null;
      }
      final error = ApiException.fromHttp(response.statusCode, decoded);
      if (error.isUnauthenticated && token != null) onSessionRejected?.call(token);
      throw error;
    } on TimeoutException catch (error) {
      throw ApiException.network(error);
    } on SocketException catch (error) {
      throw ApiException.network(error);
    } on http.ClientException catch (error) {
      throw ApiException.network(error);
    }
  }

  void close() => _http.close();
}
