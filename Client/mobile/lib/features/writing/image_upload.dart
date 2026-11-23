import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/app_services.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';

/// Image handling shared by covers, session covers, avatars and chapter
/// images. Ports the website's `ImageUpload` (F-WRITE-03):
///
/// * JPEG / PNG / WebP only, at most 8 MB;
/// * more than 40 megapixels or a side over 12,000 px is rejected;
/// * the picture is **centre-cropped** to the target aspect ratio (no crop
///   UI on the web either), optionally scaled down to a maximum width and
///   re-encoded as JPEG quality 92;
/// * the result goes straight to Cloudinary with an *unsigned* preset; the
///   backend only ever stores the returned `secure_url`.
class ImageProblem implements Exception {
  ImageProblem(this.message);
  final String message;
}

const invalidImageMessage = 'JPEG, PNG veya WebP biçiminde, en fazla 8 MB bir görsel seçin.';
const maxImageBytes = 8 * 1024 * 1024;

/// `jpeg`, `png` or `webp` from the file signature, else null. The MIME
/// type reported by pickers is not reliable across platforms.
String? sniffImageType(Uint8List bytes) {
  bool at(int offset, List<int> signature) {
    if (bytes.length < offset + signature.length) return false;
    for (var i = 0; i < signature.length; i++) {
      if (bytes[offset + i] != signature[i]) return false;
    }
    return true;
  }

  if (at(0, const [0xFF, 0xD8, 0xFF])) return 'jpeg';
  if (at(0, const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'png';
  if (at(0, const [0x52, 0x49, 0x46, 0x46]) && at(8, const [0x57, 0x45, 0x42, 0x50])) return 'webp';
  return null;
}

/// Source rectangle of the centre crop (same arithmetic as the web
/// `cropImage`): returns `(x, y, width, height)`.
(int, int, int, int) centerCropRect(int width, int height, double aspectRatio) {
  if (width / height > aspectRatio) {
    final cropWidth = (height * aspectRatio).round();
    return (((width - cropWidth) / 2).round(), 0, cropWidth, height);
  }
  final cropHeight = (width / aspectRatio).round();
  return (0, ((height - cropHeight) / 2).round(), width, cropHeight);
}

class _CropRequest {
  _CropRequest(this.bytes, this.aspectRatio, this.maxWidth, this.quality);
  final Uint8List bytes;
  final double? aspectRatio;
  final int? maxWidth;
  final int quality;
}

Uint8List _cropAndEncode(_CropRequest request) {
  final decoded = img.decodeImage(request.bytes);
  if (decoded == null) throw ImageProblem('Görsel okunamadı.');
  // Phone cameras store the orientation in EXIF; bake it in before cropping.
  var image = img.bakeOrientation(decoded);
  final w = image.width, h = image.height;
  if (w * h > 40000000 || w > 12000 || h > 12000) throw ImageProblem('Görsel çözünürlüğü çok yüksek.');
  if (w <= 0 || h <= 0) throw ImageProblem('Görsel ölçüleri okunamadı.');
  final ratio = request.aspectRatio;
  if (ratio != null) {
    final (x, y, cw, ch) = centerCropRect(w, h, ratio);
    image = img.copyCrop(image, x: x, y: y, width: cw, height: ch);
  }
  final maxWidth = request.maxWidth;
  if (maxWidth != null && image.width > maxWidth) {
    image = img.copyResize(image, width: maxWidth, interpolation: img.Interpolation.average);
  }
  return img.encodeJpg(image, quality: request.quality);
}

/// Validates, crops and re-encodes off the UI thread.
Future<Uint8List> prepareImage(Uint8List bytes, {double? aspectRatio, int? maxWidth, int quality = 92}) async {
  if (bytes.length > maxImageBytes || sniffImageType(bytes) == null) throw ImageProblem(invalidImageMessage);
  return compute(_cropAndEncode, _CropRequest(bytes, aspectRatio, maxWidth, quality));
}

/// Test seam: replaces the system photo picker (which no widget test can
/// drive). Everything after the pick — validation, crop, upload — is the
/// production path.
@visibleForTesting
Future<Uint8List?> Function()? debugPickImageOverride;

Future<Uint8List?> pickImageBytes() async {
  final override = debugPickImageOverride;
  if (override != null) return override();
  final file = await ImagePicker().pickImage(source: ImageSource.gallery, requestFullMetadata: false);
  return file?.readAsBytes();
}

/// Unsigned upload: `POST https://api.cloudinary.com/v1_1/<cloud>/image/upload`
/// with `file` + `upload_preset`. Returns `secure_url`.
Future<String> uploadToCloudinary(AppConfig config, Uint8List jpeg, {http.Client? client}) async {
  if (!config.imageUploadEnabled) throw ImageProblem('Görsel yükleme bu derlemede yapılandırılmamış.');
  final request = http.MultipartRequest('POST', config.cloudinaryUploadUri)
    ..fields['upload_preset'] = config.cloudinaryUploadPreset
    ..files.add(http.MultipartFile.fromBytes('file', jpeg, filename: 'upload.jpg'));
  final http.StreamedResponse streamed;
  try {
    streamed = await (client ?? http.Client()).send(request).timeout(const Duration(seconds: 60));
  } catch (_) {
    throw ImageProblem('Görsel yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
  }
  final body = await streamed.stream.bytesToString();
  Object? decoded;
  try {
    decoded = jsonDecode(body);
  } on FormatException {
    decoded = null;
  }
  final url = decoded is Map ? decoded['secure_url'] : null;
  if (streamed.statusCode != 200 || url is! String || url.isEmpty) {
    throw ImageProblem('Görsel yüklenemedi. Lütfen tekrar deneyin.');
  }
  return url;
}

/// Picker + preview used by forms. Reports the uploaded URL through
/// [onUploaded]; never reports a URL for an upload that did not succeed.
class ImageUploadField extends StatefulWidget {
  const ImageUploadField({
    super.key,
    required this.onUploaded,
    this.currentImage = '',
    this.label = 'Resim Yükle',
    this.aspectRatio = 2 / 3,
    this.maxWidth,
    this.previewWidth = 120,
    this.onRemoved,
    this.circular = false,
  });

  final ValueChanged<String> onUploaded;
  final String currentImage;
  final String label;
  final double aspectRatio;
  final int? maxWidth;
  final double previewWidth;
  final VoidCallback? onRemoved;
  final bool circular;

  @override
  State<ImageUploadField> createState() => _ImageUploadFieldState();
}

class _ImageUploadFieldState extends State<ImageUploadField> {
  bool _busy = false;
  Uint8List? _local;

  Future<void> _pick() async {
    final config = context.services.config;
    try {
      final picked = await pickImageBytes();
      if (picked == null || !mounted) return;
      setState(() => _busy = true);
      final jpeg = await prepareImage(picked, aspectRatio: widget.aspectRatio, maxWidth: widget.maxWidth);
      final url = await uploadToCloudinary(config, jpeg);
      if (!mounted) return;
      setState(() => _local = jpeg);
      widget.onUploaded(url);
    } on ImageProblem catch (problem) {
      if (mounted) showToast(context, problem.message, type: ToastType.error);
    } catch (_) {
      if (mounted) showToast(context, 'Görsel seçilemedi.', type: ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = context.services.config.imageUploadEnabled;
    final height = widget.previewWidth / widget.aspectRatio;
    final hasImage = _local != null || widget.currentImage.isNotEmpty;
    final placeholder = Container(
      color: BetikColors.agedPaper,
      alignment: Alignment.center,
      child: const Icon(Icons.add_photo_alternate_outlined, color: BetikColors.ashGray, size: 30),
    );
    final preview = SizedBox(
      width: widget.previewWidth,
      height: height,
      child: _local != null
          ? Image.memory(_local!, fit: BoxFit.cover)
          : NetImage(widget.currentImage, width: widget.previewWidth, height: height, placeholder: placeholder),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            widget.circular ? ClipOval(child: preview) : ClipRRect(borderRadius: BorderRadius.circular(6), child: preview),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  OutlinedButton.icon(
                    onPressed: enabled && !_busy ? _pick : null,
                    icon: _busy
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.upload, size: 18),
                    label: Text(_busy ? 'YÜKLENİYOR...' : trUpper(widget.label)),
                  ),
                  if (hasImage && widget.onRemoved != null)
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () {
                              setState(() => _local = null);
                              widget.onRemoved!();
                            },
                      child: const Text('Görseli kaldır'),
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          enabled ? 'JPEG, PNG veya WebP · en fazla 8 MB' : 'Görsel yükleme bu derlemede yapılandırılmamış.',
          style: sans(size: 12, color: enabled ? BetikColors.ashGray : BetikColors.danger),
        ),
      ],
    );
  }
}

/// Chapter images are stored **inside the chapter HTML** as base64 `data:`
/// URIs (what the web editor does — Stage 2 S-05). The sanitiser accepts
/// PNG/JPEG/WebP of at most 450,000 base64 characters and a request may not
/// exceed 2 MB, so phone photos are scaled down until they fit.
Future<String> prepareEmbeddedImage(Uint8List bytes) async {
  if (bytes.length > maxImageBytes || sniffImageType(bytes) == null) throw ImageProblem(invalidImageMessage);
  for (final (width, quality) in const [(1280, 82), (1024, 78), (800, 74), (640, 70), (480, 64)]) {
    final jpeg = await compute(_cropAndEncode, _CropRequest(bytes, null, width, quality));
    final encoded = base64Encode(jpeg);
    if (encoded.length <= 440000) return 'data:image/jpeg;base64,$encoded';
  }
  throw ImageProblem('Görsel bölüme eklenemeyecek kadar büyük.');
}
