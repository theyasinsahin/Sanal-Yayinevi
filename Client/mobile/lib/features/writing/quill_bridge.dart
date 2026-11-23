// `flutter_quill` 11 is still built on the Material library that ships
// inside the Flutter SDK (`package:flutter/material.dart`), which Flutter
// 3.47+ deprecates in favour of `package:material_ui`. The two libraries
// define distinct `Theme` / `MaterialLocalizations` types, so widgets from
// one cannot find ancestors from the other.
//
// This file is the single place where the deprecated library is imported.
// It supplies what the editor looks up — a legacy `Theme`, `Material` and
// the legacy localisation delegates — so that the rest of the app can use
// `material_ui` only. Remove it when flutter_quill migrates.
//
// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart' as legacy;
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart' as legacy_l10n;
import 'package:flutter_quill/flutter_quill.dart' show FlutterQuillLocalizations;

import '../../core/theme/app_theme.dart';

/// Added to `MaterialApp.localizationsDelegates`. Overlay content created
/// by the editor (selection toolbar, magnifier) is built above any local
/// wrapper, so the delegates must live at the root.
///
/// On iOS the editor's selection toolbar is built from the SDK's legacy
/// Cupertino widgets, which look up the legacy `CupertinoLocalizations`;
/// without that delegate every long-press in the editor threw and no
/// copy/paste menu appeared (found on the iOS simulator, Stage 3
/// verification).
const List<LocalizationsDelegate<dynamic>> quillBridgeLocalizationDelegates = [
  legacy_l10n.GlobalMaterialLocalizations.delegate,
  legacy_l10n.GlobalCupertinoLocalizations.delegate,
  FlutterQuillLocalizations.delegate,
];

final legacy.ThemeData _legacyTheme = legacy.ThemeData(
  useMaterial3: true,
  fontFamily: BetikFonts.serif,
  colorScheme: const legacy.ColorScheme.light(
    primary: BetikColors.inkBlack,
    onPrimary: BetikColors.paperWhite,
    secondary: BetikColors.rust,
    surface: BetikColors.paperWhite,
    onSurface: BetikColors.inkBlack,
  ),
  textSelectionTheme: const legacy.TextSelectionThemeData(
    cursorColor: BetikColors.inkBlack,
    selectionColor: Color(0x33A89F8F),
    selectionHandleColor: BetikColors.rust,
  ),
);

/// Wraps the whole app (see `app.dart`) so every `flutter_quill` widget and
/// overlay finds a legacy theme.
class QuillMaterialBridge extends StatelessWidget {
  const QuillMaterialBridge({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => legacy.Theme(data: _legacyTheme, child: child);
}

/// Local wrapper for the editor surface: a legacy `Material` ancestor for
/// ink and text-selection widgets.
class QuillSurface extends StatelessWidget {
  const QuillSurface({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => legacy.Material(type: legacy.MaterialType.transparency, child: child);
}
