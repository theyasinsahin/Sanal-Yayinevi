import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/app_services.dart';
import '../../core/config/app_config.dart';
import '../../core/network/api_error.dart';
import '../../core/network/graphql_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/ui.dart';
import '../messaging/share_to_chat.dart';

/// Everything the share dialog needs, built exactly like the website's
/// `shareLinks()` (`Client/src/utils/socialSharing.js`).
///
/// The link that is shared is the **API host's** preview URL
/// `<API>/share/<type>/<slug-or-id>?webOrigin=<web origin>`: crawlers read
/// its Open Graph tags and people are redirected to the web page.
class ShareLinks {
  ShareLinks({
    required this.type,
    required this.id,
    required this.title,
    required this.description,
    required this.url,
    required this.directUrl,
    required this.imageUrl,
    required this.fallbackImageUrl,
  });

  final String type;
  final String id;
  final String title;
  final String description;
  final String url;
  final String directUrl;
  final String imageUrl;
  final String fallbackImageUrl;

  String get caption => [title, description].where((part) => part.isNotEmpty).join('\n\n');
  String get text => '$caption\n\n$url';
  String get whatsapp => 'https://wa.me/?text=${Uri.encodeComponent(text)}';
  String get telegram => 'https://t.me/share/url?url=${Uri.encodeComponent(url)}&text=${Uri.encodeComponent(caption)}';
  String get x => 'https://twitter.com/intent/tweet?text=${Uri.encodeComponent(title)}&url=${Uri.encodeComponent(url)}';

  /// [item] is the `SocialShare` object from `getSocialShare`.
  factory ShareLinks.fromSocialShare(Json item, AppConfig config) {
    // A native app has no browser origin: use the configured website, else
    // the origin the server reports (same fallback as the Capacitor build).
    final webOrigin = config.webUrl.isNotEmpty ? config.webUrl : (item['webOrigin'] as String? ?? '');
    final path = item['path'] as String? ?? '/';
    final type = (item['type'] as String? ?? '').toLowerCase();
    final id = '${item['id'] ?? ''}';
    final readable = RegExp(r'^/(kitap|yazar|oturum)/').hasMatch(path);
    final shareKey = readable ? Uri.decodeComponent(path.split('/').last) : id;
    final preview = Uri.parse(config.apiUrl)
        .resolve('/share/$type/${Uri.encodeComponent(shareKey)}')
        .replace(queryParameters: {'webOrigin': webOrigin});
    final origin = Uri.parse(webOrigin);
    return ShareLinks(
      type: type,
      id: id,
      title: item['title'] as String? ?? '',
      description: item['description'] as String? ?? '',
      url: preview.toString(),
      directUrl: origin.resolve(path).toString(),
      imageUrl: origin.resolve(item['imagePath'] as String? ?? '/social-share/default.jpg').toString(),
      fallbackImageUrl: origin.resolve('/social-share/default.jpg').toString(),
    );
  }
}

const _getSocialShare = r'''
query GetSocialShare($type: SocialShareType!, $id: ID!) {
  getSocialShare(type: $type, id: $id) { type id title description path imagePath webOrigin }
}''';

/// Opens the share sheet for `BOOK`, `CHAPTER`, `QUOTE`, `PROFILE` or
/// `SESSION` (F-SHARE-01). Only public content is shareable; the server's
/// refusal is shown with a retry.
Future<void> showShareSheet(BuildContext context, {required String type, required String id}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _ShareSheet(type: type, id: id),
  );
}

class _ShareSheet extends StatelessWidget {
  const _ShareSheet({required this.type, required this.id});
  final String type;
  final String id;

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
        child: Loader<ShareLinks>(
          load: () async {
            final data = await services.api.run(_getSocialShare, variables: {'type': type, 'id': id});
            return ShareLinks.fromSocialShare(Map<String, dynamic>.from(data['getSocialShare'] as Map), services.config);
          },
          errorBuilder: (context, error, retry) => Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Paylaş', style: serif(size: 20, weight: FontWeight.w700)),
                const SizedBox(height: 12),
                Text(
                  errorMessage(error),
                  textAlign: TextAlign.center,
                  style: sans(size: 14, color: BetikColors.graphite),
                ),
                const SizedBox(height: 12),
                OutlinedButton(onPressed: retry, child: const Text('YENİDEN DENE')),
              ],
            ),
          ),
          builder: (context, links, _) => _ShareBody(links: links, type: type, id: id),
        ),
      ),
    );
  }
}

class _ShareBody extends StatefulWidget {
  const _ShareBody({required this.links, required this.type, required this.id});
  final ShareLinks links;
  final String type;
  final String id;

  @override
  State<_ShareBody> createState() => _ShareBodyState();
}

class _ShareBodyState extends State<_ShareBody> {
  bool _loadingImage = false;

  /// Downloads the preview image from the web host (falling back to the
  /// default image) and returns it as a shareable file.
  Future<XFile?> _imageFile() async {
    for (final url in {widget.links.imageUrl, widget.links.fallbackImageUrl}) {
      try {
        final response = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 20));
        final type = response.headers['content-type'] ?? '';
        if (response.statusCode != 200 || !type.startsWith('image/')) continue;
        final directory = await getTemporaryDirectory();
        final file = File('${directory.path}/betik-${widget.links.type}-${widget.links.id}.jpg');
        await file.writeAsBytes(response.bodyBytes);
        return XFile(file.path, mimeType: type);
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  Future<void> _shareWithImage() async {
    setState(() => _loadingImage = true);
    final file = await _imageFile();
    if (!mounted) return;
    setState(() => _loadingImage = false);
    if (file == null) {
      showToast(
        context,
        'Paylaşım görseli yüklenemedi. Bağlantıyı paylaşabilir veya görseli tekrar yükleyebilirsiniz.',
        type: ToastType.error,
      );
      return;
    }
    await SharePlus.instance.share(ShareParams(text: widget.links.text, files: [file]));
  }

  @override
  Widget build(BuildContext context) {
    final links = widget.links;
    final canMessage = (widget.type == 'BOOK' || widget.type == 'QUOTE') && context.services.auth.isSignedIn;
    Widget tile(IconData icon, String title, VoidCallback onTap, {String? subtitle}) =>
        ListTile(leading: Icon(icon), title: Text(title), subtitle: subtitle == null ? null : Text(subtitle), onTap: onTap);
    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.only(bottom: 16),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Paylaş', style: serif(size: 20, weight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                links.title,
                style: serif(size: 15, weight: FontWeight.w700),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (links.description.isNotEmpty)
                Text(
                  links.description,
                  style: sans(size: 13, color: BetikColors.ashGray),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
        tile(Icons.ios_share, 'Diğer uygulamalar', () => SharePlus.instance.share(ShareParams(text: links.text, subject: links.title))),
        tile(Icons.chat, 'WhatsApp', () => openExternal(context, links.whatsapp)),
        tile(Icons.send, 'Telegram', () => openExternal(context, links.telegram)),
        tile(Icons.alternate_email, 'X', () => openExternal(context, links.x)),
        tile(Icons.link, 'Bağlantıyı kopyala', () => copyText(context, links.url, done: 'Bağlantı kopyalandı.')),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 2),
          child: Text('Story / Durum', style: label()),
        ),
        ListTile(
          leading: _loadingImage
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.image_outlined),
          title: const Text('Görsel ve bağlantıyı paylaş'),
          subtitle: const Text('Önizleme görseli paylaşım menüsüne eklenir; oradan kaydedebilirsiniz.'),
          onTap: _loadingImage ? null : _shareWithImage,
        ),
        tile(Icons.copy_all, 'Metin ve bağlantıyı kopyala', () => copyText(context, links.text, done: 'Metin ve bağlantı kopyalandı.')),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 6, 20, 6),
          child: SelectableText(links.url, style: sans(size: 12, color: BetikColors.ashGray)),
        ),
        if (canMessage) ...[
          const Divider(),
          tile(Icons.forum_outlined, 'Betik’te mesajla gönder', () {
            Navigator.of(context).pop();
            showShareToChat(context, type: widget.type, id: widget.id, title: links.title);
          }),
        ],
      ],
    );
  }
}
