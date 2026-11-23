import 'dart:async';
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_services.dart';
import '../models/models.dart';
import '../network/api_error.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

enum ToastType { info, success, error }

/// Toast (F-NAV-07): stacked at the bottom, auto-dismiss after 3.5 s,
/// closable.
void showToast(BuildContext context, String message, {ToastType type = ToastType.info}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null || message.isEmpty) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(milliseconds: 3500),
        backgroundColor: switch (type) {
          ToastType.success => BetikColors.toastSuccess,
          ToastType.error => BetikColors.toastError,
          ToastType.info => BetikColors.charcoal,
        },
        showCloseIcon: true,
        closeIconColor: Colors.white,
      ),
    );
}

void showError(BuildContext context, Object error, {String? fallback}) =>
    showToast(context, errorMessage(error, fallback: fallback), type: ToastType.error);

/// Native replacement for the website's `window.confirm` dialogs.
Future<bool> confirm(
  BuildContext context,
  String message, {
  String? title,
  String confirmLabel = 'Onayla',
  String cancelLabel = 'Vazgeç',
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: title == null ? null : Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(cancelLabel)),
        FilledButton(
          style: destructive ? FilledButton.styleFrom(backgroundColor: BetikColors.danger) : null,
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(trUpper(confirmLabel)),
        ),
      ],
    ),
  );
  return result ?? false;
}

Future<void> openExternal(BuildContext context, String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null || !(uri.isScheme('http') || uri.isScheme('https') || uri.isScheme('mailto') || uri.isScheme('tel'))) {
    showToast(context, 'Bağlantı açılamadı.', type: ToastType.error);
    return;
  }
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) showToast(context, 'Bağlantı açılamadı.', type: ToastType.error);
}

Future<void> copyText(BuildContext context, String text, {String done = 'Kopyalandı.'}) async {
  await Clipboard.setData(ClipboardData(text: text));
  if (context.mounted) showToast(context, done, type: ToastType.success);
}

// ---------------------------------------------------------------------------
// Guest gate (registration intent, F-AUTH-10)
// ---------------------------------------------------------------------------

const _intentCopy = {
  'read': ('Hikâyeye devam et', 'Sonraki bölümleri okumak için ücretsiz hesap oluştur.'),
  'save': ('Bu kitabı kitaplığında sakla', 'Kitaplarını bir arada tutmak için ücretsiz hesap oluştur.'),
  'follow': ('Yeni bölümlerden haberdar ol', 'Kitabı takip etmek için ücretsiz hesap oluştur.'),
  'like': ('Beğenini paylaş', 'Beğenmek için ücretsiz hesap oluştur.'),
  'comment': ('Sohbete katıl', 'Yorumunu paylaşmak için ücretsiz hesap oluştur.'),
  'quote': ('Beğendiğin satırları sakla', 'Alıntılarını kaydetmek için ücretsiz hesap oluştur.'),
  'bookmark': ('Kaldığın yeri kaybetme', 'Ayracını hesabına kaydetmek için ücretsiz hesap oluştur.'),
  'repost': ('Alıntıyı yeniden paylaş', 'Bu alıntıyı paylaşmak için ücretsiz hesap oluştur.'),
  'printed-reading': ('Okuduğun kitapları bir arada tut', 'Kitabı okuduklarına eklemek ve puan vermek için ücretsiz hesap oluştur.'),
  'recommendations': ('Sana özel kitaplar keşfet', 'İlgi alanlarına uygun öneriler için ücretsiz hesap oluştur.'),
};

(String, String) intentCopy(String action) {
  const aliases = {'comment-like': 'like', 'reply': 'comment', 'paragraph-comment': 'comment', 'quote-comment': 'comment'};
  return _intentCopy[aliases[action] ?? action] ?? _intentCopy['comment']!;
}

/// Returns true when the user is signed in. Otherwise shows the sign-up
/// prompt for [action], remembers where the user was (and an optional
/// [draft]) and returns false.
bool requireMember(BuildContext context, String action, {String? bookTitle, String? draft, Map<String, dynamic>? data}) {
  final services = context.services;
  if (services.auth.isSignedIn) return true;
  final location = GoRouterState.of(context).uri.toString();
  final intent = RegistrationIntent(action: action, returnTo: location, bookTitle: bookTitle, draft: draft, data: data ?? const {});
  showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
        child: RegistrationCard(
          intent: intent,
          trailing: TextButton(onPressed: () => Navigator.of(sheetContext).pop(), child: const Text('Şimdilik geri dön')),
          onNavigate: () => Navigator.of(sheetContext).pop(),
        ),
      ),
    ),
  );
  return false;
}

class RegistrationCard extends StatelessWidget {
  const RegistrationCard({super.key, required this.intent, this.trailing, this.onNavigate});
  final RegistrationIntent intent;
  final Widget? trailing;
  final VoidCallback? onNavigate;

  @override
  Widget build(BuildContext context) {
    final (title, description) = intentCopy(intent.action);
    void go(String path) {
      context.services.intents.save(intent);
      onNavigate?.call();
      context.push(path);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: serif(size: 20, weight: FontWeight.w700),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          '${intent.bookTitle != null ? '“${intent.bookTitle}” · ' : ''}$description',
          style: sans(size: 14, color: BetikColors.graphite, height: 1.5),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        FilledButton(onPressed: () => go('/register'), child: const Text('ÜCRETSİZ HESAP OLUŞTUR')),
        TextButton(onPressed: () => go('/login'), child: const Text('Zaten hesabım var — Giriş yap')),
        ?trailing,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/// Displays any image reference the API can return: Cloudinary URLs,
/// arbitrary http(s) URLs, root-relative paths served by the web host and
/// `data:` URIs.
class NetImage extends StatelessWidget {
  const NetImage(this.reference, {super.key, this.width, this.height, this.fit = BoxFit.cover, required this.placeholder});
  final String reference;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget placeholder;

  @override
  Widget build(BuildContext context) {
    final url = context.services.config.resolveWebAsset(reference);
    if (url.isEmpty) return placeholder;
    if (url.startsWith('data:')) {
      final comma = url.indexOf(',');
      if (comma < 0) return placeholder;
      try {
        return Image.memory(
          base64.decode(url.substring(comma + 1)),
          width: width,
          height: height,
          fit: fit,
          gaplessPlayback: true,
          errorBuilder: (_, _, _) => placeholder,
        );
      } on FormatException {
        return placeholder;
      }
    }
    if (!url.startsWith('http')) return placeholder;
    return CachedNetworkImage(
      imageUrl: url,
      width: width,
      height: height,
      fit: fit,
      fadeInDuration: const Duration(milliseconds: 150),
      placeholder: (_, _) => placeholder,
      errorWidget: (_, _, _) => placeholder,
    );
  }
}

/// Book cover in the 2:3 ratio with the drawn "Betik" placeholder.
class BookCover extends StatelessWidget {
  const BookCover(this.imageUrl, {super.key, this.width = 100, this.radius = 6});
  final String imageUrl;
  final double width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final height = width * 1.5;
    final placeholder = _CoverPlaceholder(width: width, height: height);
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: width,
        height: height,
        child: NetImage(optimizedImage(imageUrl, 300, 450), width: width, height: height, placeholder: placeholder),
      ),
    );
  }
}

class _CoverPlaceholder extends StatelessWidget {
  const _CoverPlaceholder({required this.width, required this.height});
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: height,
    color: const Color(0xFFE2D9CB),
    child: Stack(
      children: [
        Positioned(
          left: width * 0.1,
          top: 0,
          bottom: 0,
          child: Container(width: 2, color: const Color(0xFFA0876A)),
        ),
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: width * 0.5, height: 2, color: const Color(0xFFA0876A)),
              const SizedBox(height: 5),
              Container(width: width * 0.38, height: 2, color: const Color(0xFFA0876A)),
              SizedBox(height: height * 0.12),
              Text(
                'Betik',
                style: serif(size: (width * 0.13).clamp(8, 16), color: const Color(0xFF7A6652)),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, this.imageUrl = '', this.name = '', this.size = 40});
  final String imageUrl;
  final String name;
  final double size;

  factory UserAvatar.of(UserSummary? user, {double size = 40}) =>
      UserAvatar(imageUrl: user?.profilePicture ?? '', name: user?.displayName ?? '', size: size);

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isEmpty ? '' : trUpper(name.trim().characters.first);
    final placeholder = Container(
      width: size,
      height: size,
      color: BetikColors.agedPaper,
      alignment: Alignment.center,
      child: initial.isEmpty
          ? Icon(Icons.person, size: size * 0.6, color: BetikColors.ashGray)
          : Text(
              initial,
              style: serif(size: size * 0.42, weight: FontWeight.w700, color: BetikColors.graphite),
            ),
    );
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: BetikColors.borderHeavy),
      ),
      clipBehavior: Clip.antiAlias,
      child: NetImage(imageUrl, width: size, height: size, placeholder: placeholder),
    );
  }
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.label});
  final String? label;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2.5)),
          if (label != null) ...[
            const SizedBox(height: 14),
            Text(
              label!,
              style: serif(size: 14, color: BetikColors.ashGray, style: FontStyle.italic),
            ),
          ],
        ],
      ),
    ),
  );
}

class ErrorView extends StatelessWidget {
  const ErrorView({
    super.key,
    this.title = 'Sayfa yüklenemedi',
    required this.message,
    this.onRetry,
    this.retryLabel = 'Tekrar Dene',
    this.extra,
  });
  final String title;
  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;
  final Widget? extra;

  factory ErrorView.of(Object error, {VoidCallback? onRetry, String? title}) => ErrorView(
    title: title ?? 'Sayfa yüklenemedi',
    message: error is ApiException && error.isNetwork ? 'Bağlantınızı kontrol edip sayfayı yeniden yükleyin.' : errorMessage(error),
    onRetry: onRetry,
  );

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 36, color: BetikColors.ashGray),
          const SizedBox(height: 12),
          Text(
            title,
            style: serif(size: 19, weight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: sans(size: 14, color: BetikColors.graphite, height: 1.5),
            textAlign: TextAlign.center,
          ),
          if (onRetry != null) ...[const SizedBox(height: 18), OutlinedButton(onPressed: onRetry, child: Text(trUpper(retryLabel)))],
          if (extra != null) ...[const SizedBox(height: 8), extra!],
        ],
      ),
    ),
  );
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.title, this.subtitle, this.action, this.icon});
  final String title;
  final String? subtitle;
  final Widget? action;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 34, color: BetikColors.lightSmoke), const SizedBox(height: 12)],
          Text(
            title,
            style: serif(size: 16, weight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              style: serif(size: 14, color: BetikColors.ashGray, style: FontStyle.italic, height: 1.5),
              textAlign: TextAlign.center,
            ),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    ),
  );
}

/// Loads a value, shows loading / error / data, and can refresh on a timer
/// (foreground only — the web polls only while the tab is visible) or when
/// a [Listenable] fires.
class Loader<T> extends StatefulWidget {
  const Loader({
    super.key,
    required this.load,
    required this.builder,
    this.pollEvery,
    this.pollWhen,
    this.refreshOn,
    this.loadingLabel,
    this.errorTitle,
    this.errorBuilder,
  });

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, LoaderState<T> state) builder;
  final Duration? pollEvery;

  /// Optional condition on the current data; polling is skipped while it
  /// is false (e.g. only while a follow request is pending).
  final bool Function(T data)? pollWhen;
  final Listenable? refreshOn;
  final String? loadingLabel;
  final String? errorTitle;
  final Widget Function(BuildContext context, Object error, VoidCallback retry)? errorBuilder;

  @override
  State<Loader<T>> createState() => LoaderState<T>();
}

class LoaderState<T> extends State<Loader<T>> {
  T? _data;
  bool _hasData = false;
  Object? _error;
  Timer? _timer;
  int _generation = 0;

  bool get hasData => _hasData;

  @override
  void initState() {
    super.initState();
    reload();
    widget.refreshOn?.addListener(_silentReload);
    final every = widget.pollEvery;
    if (every != null) {
      _timer = Timer.periodic(every, (_) {
        final foreground =
            WidgetsBinding.instance.lifecycleState == null || WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
        final wanted = widget.pollWhen == null || (_hasData && widget.pollWhen!(_data as T));
        if (foreground && wanted) _silentReload();
      });
    }
  }

  @override
  void didUpdateWidget(covariant Loader<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshOn != widget.refreshOn) {
      oldWidget.refreshOn?.removeListener(_silentReload);
      widget.refreshOn?.addListener(_silentReload);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    widget.refreshOn?.removeListener(_silentReload);
    super.dispose();
  }

  void _silentReload() => reload(silent: true);

  /// Refetches. With [silent] the current data stays on screen and a
  /// failure is ignored (used for polling).
  Future<void> reload({bool silent = false}) async {
    final generation = ++_generation;
    if (!silent && mounted) {
      setState(() {
        _error = null;
        _hasData = false;
      });
    }
    try {
      final value = await widget.load();
      if (!mounted || generation != _generation) return;
      setState(() {
        _data = value;
        _hasData = true;
        _error = null;
      });
    } catch (error) {
      if (!mounted || generation != _generation) return;
      if (silent && _hasData) return;
      setState(() => _error = error);
    }
  }

  /// Replaces the data locally (optimistic updates).
  void setData(T value) => setState(() {
    _data = value;
    _hasData = true;
  });

  @override
  Widget build(BuildContext context) {
    if (_hasData) return widget.builder(context, _data as T, this);
    final error = _error;
    if (error != null) {
      return widget.errorBuilder?.call(context, error, reload) ?? ErrorView.of(error, onRetry: reload, title: widget.errorTitle);
    }
    return LoadingView(label: widget.loadingLabel);
  }
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/// Uppercase sans label.
class Label extends StatelessWidget {
  const Label(this.text, {super.key, this.color = BetikColors.ashGray, this.size = 12});
  final String text;
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) => Text(
    trUpper(text),
    style: label(color: color, size: size),
  );
}

/// Thin rule with a centred ornament, as on the website's section breaks.
class OrnamentDivider extends StatelessWidget {
  const OrnamentDivider({super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text('❦', style: serif(size: 16, color: BetikColors.lightSmoke)),
        ),
        const Expanded(child: Divider()),
      ],
    ),
  );
}

/// Icon + compact number, with the exact value for screen readers.
class CountLabel extends StatelessWidget {
  const CountLabel({
    super.key,
    required this.icon,
    required this.value,
    required this.noun,
    this.color = BetikColors.ashGray,
    this.size = 13,
  });
  final IconData icon;
  final int value;
  final String noun;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Semantics(
    label: '${formatExactCount(value)} $noun',
    excludeSemantics: true,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: size + 3, color: color),
        const SizedBox(width: 4),
        Text(
          formatCount(value),
          style: sans(size: size, color: color, weight: FontWeight.w500),
        ),
      ],
    ),
  );
}

class TagChip extends StatelessWidget {
  const TagChip(this.text, {super.key, this.dark = false});
  final String text;
  final bool dark;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: dark ? BetikColors.inkBlack : BetikColors.agedPaper,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: BetikColors.borderMedium),
    ),
    child: Text(text, style: serif(size: 12, color: dark ? BetikColors.paperWhite : BetikColors.inkBlack)),
  );
}

/// "ÖNCEKİ / Sayfa n / SONRAKİ" pager used by every page-numbered list.
class PagerBar extends StatelessWidget {
  const PagerBar({super.key, required this.page, this.totalPages, required this.onPage, this.hasNext});
  final int page;
  final int? totalPages;
  final bool? hasNext;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    final canNext = hasNext ?? (totalPages != null && page < totalPages!);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          OutlinedButton(onPressed: page > 1 ? () => onPage(page - 1) : null, child: const Text('ÖNCEKİ')),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Text(
              totalPages == null ? 'Sayfa $page' : 'Sayfa $page / ${totalPages! < 1 ? 1 : totalPages}',
              style: sans(size: 13, weight: FontWeight.w600),
            ),
          ),
          OutlinedButton(onPressed: canNext ? () => onPage(page + 1) : null, child: const Text('SONRAKİ')),
        ],
      ),
    );
  }
}

/// A bordered paper card.
class PaperCard extends StatelessWidget {
  const PaperCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color = BetikColors.paperWhite,
    this.onTap,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: color,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(color: BetikColors.borderMedium),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

/// "SANDBOX · Gerçek para alınmaz" — shown on every funding surface.
class SandboxNotice extends StatelessWidget {
  const SandboxNotice({super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: BetikColors.sepiaLight,
      border: Border.all(color: BetikColors.rust),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text('SANDBOX · Gerçek para alınmaz', style: label(size: 11, color: BetikColors.rust)),
  );
}

/// Button that shows a spinner while its async action runs and prevents
/// double submission.
class BusyButton extends StatefulWidget {
  const BusyButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.outlined = false,
    this.danger = false,
    this.icon,
    this.expand = false,
  });
  final Future<void> Function()? onPressed;
  final String label;
  final bool outlined;
  final bool danger;
  final IconData? icon;
  final bool expand;

  @override
  State<BusyButton> createState() => _BusyButtonState();
}

class _BusyButtonState extends State<BusyButton> {
  bool _busy = false;

  Future<void> _run() async {
    final action = widget.onPressed;
    if (action == null || _busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !_busy;
    final color = widget.danger ? BetikColors.danger : null;
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (_busy)
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: BetikColors.silverGray)),
          )
        else if (widget.icon != null)
          Padding(padding: const EdgeInsets.only(right: 8), child: Icon(widget.icon, size: 18)),
        Flexible(child: Text(trUpper(widget.label), textAlign: TextAlign.center)),
      ],
    );
    final button = widget.outlined
        ? OutlinedButton(
            onPressed: enabled ? _run : null,
            style: color == null
                ? null
                : OutlinedButton.styleFrom(
                    foregroundColor: color,
                    side: BorderSide(color: color, width: 2),
                  ),
            child: child,
          )
        : FilledButton(
            onPressed: enabled ? _run : null,
            style: color == null ? null : FilledButton.styleFrom(backgroundColor: color),
            child: child,
          );
    return widget.expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Form field with the uppercase label (and red asterisk) above it.
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child, this.required = false, this.hint});
  final String label;
  final Widget child;
  final bool required;
  final String? hint;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            children: [
              TextSpan(text: trUpper(label), style: labelStyle),
              if (required)
                TextSpan(
                  text: ' *',
                  style: labelStyle.copyWith(color: BetikColors.toastError),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        child,
        if (hint != null) ...[const SizedBox(height: 4), Text(hint!, style: sans(size: 12, color: BetikColors.ashGray))],
      ],
    ),
  );

  static final labelStyle = label_(BetikColors.graphite);
}

TextStyle label_(Color color) => label(color: color);
