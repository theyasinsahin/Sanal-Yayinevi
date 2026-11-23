/// One error type for every failure channel of the backend.
///
/// The API is inconsistent (Stage 1 K-05): GraphQL errors with or without an
/// `extensions.code`, `Status{code:400}` inside successful responses, and
/// plain JSON bodies for HTTP 4xx/5xx. Everything is normalised here.
enum ApiErrorKind {
  /// No connection, DNS failure, timeout.
  network,

  /// `UNAUTHENTICATED` / HTTP 401: the session is gone.
  unauthenticated,

  /// `FORBIDDEN`: signed in but not allowed.
  forbidden,

  /// `NOT_FOUND`.
  notFound,

  /// `RATE_LIMITED`, `TOO_MANY_REQUESTS`, HTTP 429.
  rateLimited,

  /// `BAD_USER_INPUT`, `CONFLICT` and other coded validation failures.
  validation,

  /// Uncoded business errors (code `INTERNAL_SERVER_ERROR`). In development
  /// the message is user-facing Turkish text; in production it is the
  /// generic masked sentence. Either way it is safe to show.
  server,
}

class ApiException implements Exception {
  ApiException(this.kind, this.message, {this.code, this.details = const [], this.statusCode});

  final ApiErrorKind kind;

  /// Turkish, user-presentable.
  final String message;

  /// `extensions.code` when the server sent one.
  final String? code;
  final List<String> details;
  final int? statusCode;

  bool get isNetwork => kind == ApiErrorKind.network;
  bool get isUnauthenticated => kind == ApiErrorKind.unauthenticated;
  bool get isConflict => code == 'CONFLICT';

  static const networkMessage = 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.';
  static const genericMessage = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
  static const rateLimitedMessage = 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.';
  static const unauthenticatedMessage = 'Giriş yapmalısınız.';

  factory ApiException.network([Object? cause]) => ApiException(ApiErrorKind.network, networkMessage);

  /// Builds the exception from the first entry of a GraphQL `errors` array.
  factory ApiException.fromGraphQL(List<dynamic> errors, {int? statusCode}) {
    final first = errors.isNotEmpty && errors.first is Map ? errors.first as Map : const {};
    final rawMessage = first['message'];
    final extensions = first['extensions'] is Map ? first['extensions'] as Map : const {};
    final code = extensions['code'] is String ? extensions['code'] as String : null;
    final details = extensions['details'] is List ? (extensions['details'] as List).whereType<String>().toList() : const <String>[];
    var message = rawMessage is String && rawMessage.trim().isNotEmpty ? rawMessage.trim() : genericMessage;
    if (details.isNotEmpty) message = details.join('\n');
    return ApiException(
      kindForCode(code, statusCode: statusCode),
      message,
      code: code,
      details: details,
      statusCode: statusCode,
    );
  }

  /// Non-GraphQL JSON bodies: `{error: 'RATE_LIMITED', message?}`.
  factory ApiException.fromHttp(int statusCode, Object? body) {
    String? code;
    String? message;
    if (body is Map) {
      if (body['error'] is String) code = body['error'] as String;
      if (body['message'] is String) message = body['message'] as String;
    }
    final kind = kindForCode(code, statusCode: statusCode);
    return ApiException(
      kind,
      message ??
          switch (kind) {
            ApiErrorKind.rateLimited => rateLimitedMessage,
            ApiErrorKind.unauthenticated => unauthenticatedMessage,
            _ => genericMessage,
          },
      code: code,
      statusCode: statusCode,
    );
  }

  static ApiErrorKind kindForCode(String? code, {int? statusCode}) {
    switch (code) {
      case 'UNAUTHENTICATED':
        return ApiErrorKind.unauthenticated;
      case 'FORBIDDEN':
        return ApiErrorKind.forbidden;
      case 'NOT_FOUND':
        return ApiErrorKind.notFound;
      case 'RATE_LIMITED':
      case 'TOO_MANY_REQUESTS':
        return ApiErrorKind.rateLimited;
      case 'BAD_USER_INPUT':
      case 'BAD_REQUEST':
      case 'CONFLICT':
      case 'CAPACITY_EXCEEDED':
      case 'GRAPHQL_VALIDATION_FAILED':
        return ApiErrorKind.validation;
    }
    if (statusCode == 401) return ApiErrorKind.unauthenticated;
    if (statusCode == 403) return ApiErrorKind.forbidden;
    if (statusCode == 404) return ApiErrorKind.notFound;
    if (statusCode == 429) return ApiErrorKind.rateLimited;
    return ApiErrorKind.server;
  }

  @override
  String toString() => 'ApiException($kind, $code, $message)';
}

/// Message to show for any thrown object.
String errorMessage(Object error, {String? fallback}) {
  if (error is ApiException) return error.message;
  return fallback ?? ApiException.genericMessage;
}
