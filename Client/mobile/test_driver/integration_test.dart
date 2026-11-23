import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// Host side of `flutter drive`: stores the screenshots the on-device test
/// takes. The output directory comes from `BETIK_SCREENSHOT_DIR`.
Future<void> main() async {
  final directory = Directory(Platform.environment['BETIK_SCREENSHOT_DIR'] ?? 'build/screenshots');
  await integrationDriver(
    onScreenshot: (name, bytes, [args]) async {
      await directory.create(recursive: true);
      await File('${directory.path}/$name.png').writeAsBytes(bytes);
      return true;
    },
  );
}
