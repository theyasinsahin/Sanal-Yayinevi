import 'package:intl/intl.dart';

const _locale = 'tr_TR';

/// Tolerant date parser. Three encodings coexist in the API (Stage 1 K-06):
/// ISO-8601 strings, epoch-millisecond strings and plain numbers.
DateTime? parseApiDate(Object? value) {
  if (value == null) return null;
  if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());
  if (value is Map && value['seconds'] is num) {
    return DateTime.fromMillisecondsSinceEpoch(((value['seconds'] as num) * 1000).round());
  }
  if (value is! String || value.isEmpty) return null;
  if (RegExp(r'^\d{10,}$').hasMatch(value)) {
    return DateTime.fromMillisecondsSinceEpoch(int.parse(value));
  }
  return DateTime.tryParse(value);
}

/// `14.11.2026`
String formatDate(DateTime? date) => date == null ? '' : DateFormat('dd.MM.yyyy', _locale).format(date.toLocal());

/// `14.11.2026 16:57`
String formatDateTime(DateTime? date) => date == null ? '' : DateFormat('dd.MM.yyyy HH:mm', _locale).format(date.toLocal());

/// `14 Kasım 16:04`
String formatDayMonthTime(DateTime? date) => date == null ? '' : DateFormat('d MMMM HH:mm', _locale).format(date.toLocal());

/// `14 Kasım 2026`
String formatLongDate(DateTime? date) => date == null ? '' : DateFormat('d MMMM yyyy', _locale).format(date.toLocal());

String formatTime(DateTime? date) => date == null ? '' : DateFormat('HH:mm', _locale).format(date.toLocal());

/// Notification-panel style: `Az önce`, `5dk`, `3sa`, `2g`.
String relativeShort(DateTime? date, {DateTime? now}) {
  if (date == null) return '';
  final minutes = (now ?? DateTime.now()).difference(date).inMinutes;
  if (minutes < 1) return 'Az önce';
  if (minutes < 60) return '${minutes}dk';
  if (minutes < 60 * 24) return '${minutes ~/ 60}sa';
  return '${minutes ~/ (60 * 24)}g';
}

/// Quote-card style: `Az önce`, `5dk önce`, `3sa önce`, `2g önce`.
String relativeAgo(DateTime? date, {DateTime? now}) {
  final short = relativeShort(date, now: now);
  return short.isEmpty || short == 'Az önce' ? short : '$short önce';
}

/// Conversation list: today `HH:mm`, yesterday `Dün`, this week weekday,
/// otherwise `dd.MM`.
String conversationTime(DateTime? date, {DateTime? now}) {
  if (date == null) return '';
  final local = date.toLocal();
  final today = now ?? DateTime.now();
  final days = DateTime(today.year, today.month, today.day).difference(DateTime(local.year, local.month, local.day)).inDays;
  if (days <= 0) return DateFormat('HH:mm', _locale).format(local);
  if (days == 1) return 'Dün';
  if (days < 7) return DateFormat('EEEE', _locale).format(local);
  return DateFormat('dd.MM', _locale).format(local);
}

/// Chat day separator: `Bugün`, `Dün` or a long date.
String chatDayLabel(DateTime date, {DateTime? now}) {
  final local = date.toLocal();
  final today = now ?? DateTime.now();
  final days = DateTime(today.year, today.month, today.day).difference(DateTime(local.year, local.month, local.day)).inDays;
  if (days <= 0) return 'Bugün';
  if (days == 1) return 'Dün';
  return formatLongDate(local);
}

int _normalizeCount(Object? value) => value is num && value.isFinite ? (value < 0 ? 0 : value.truncate()) : 0;

/// Compact Turkish notation (`1,2 B`, `3,4 Mn`), same as the web's
/// `Intl.NumberFormat('tr-TR', {notation: 'compact', maximumFractionDigits: 1})`.
String formatCount(Object? value) {
  final format = NumberFormat.compact(locale: _locale)..maximumFractionDigits = 1;
  return format.format(_normalizeCount(value));
}

String formatExactCount(Object? value) => NumberFormat.decimalPattern(_locale).format(_normalizeCount(value));

/// Money arrives as integer kuruş (`MinorAmount`). `₺4.500,00`.
String formatMoney(Object? minor) {
  final value = minor is num ? minor : num.tryParse('$minor') ?? 0;
  return NumberFormat.currency(locale: _locale, symbol: '₺', decimalDigits: 2, customPattern: '¤#,##0.00').format(value / 100);
}

/// Feed-card variant: `4.500,00 TL`.
String formatMoneyTl(Object? minor) {
  final value = minor is num ? minor : num.tryParse('$minor') ?? 0;
  return '${NumberFormat('#,##0.00', _locale).format(value / 100)} TL';
}

/// Converts a TL amount typed by the user (`"50"`, `"12,5"`, `"1.250,75"`)
/// to integer kuruş. Returns null for anything with more than two decimals
/// or non-numeric input — money is never rounded silently (R-FUND-10).
int? parseTlToMinor(String input) {
  var text = input.trim().replaceAll(' ', '').replaceAll('₺', '');
  if (text.isEmpty) return null;
  if (text.contains(',')) {
    text = text.replaceAll('.', '').replaceAll(',', '.');
  }
  final match = RegExp(r'^(\d+)(?:\.(\d{1,2}))?$').firstMatch(text);
  if (match == null) return null;
  final lira = int.parse(match.group(1)!);
  final fraction = (match.group(2) ?? '').padRight(2, '0');
  return lira * 100 + int.parse(fraction);
}

String formatPercent(num value) {
  final text = value.toStringAsFixed(1);
  return '%${text.endsWith('.0') ? text.substring(0, text.length - 2) : text}';
}

/// Turkish-aware lower-casing (`I` → `ı`, `İ` → `i`) for local filtering.
String trLower(String value) => value.replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();

/// Turkish-aware upper-casing (`i` → `İ`, `ı` → `I`) for uppercase labels.
String trUpper(String value) => value.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();

/// Folding used for local search: Turkish dotted/dotless i are equivalent.
String trFold(String value) => trLower(value).replaceAll('ı', 'i');

/// Strips emoji from genre names (`utils/genreDisplay.js`).
String genreName(String? value) => (value ?? '')
    .replaceAll(RegExp(r'[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]', unicode: true), '')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

/// Cloudinary delivery transformation used by every cover on the web
/// (`utils/ImageUtils.getOptimizedImage`). Other URLs are left untouched.
String optimizedImage(String url, int width, int height) {
  if (url.isEmpty || !url.contains('cloudinary')) return url;
  return url.replaceFirst('/upload/', '/upload/c_fill,w_$width,h_$height,q_auto,f_auto/');
}
