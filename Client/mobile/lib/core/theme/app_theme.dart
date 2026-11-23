import 'package:material_ui/material_ui.dart';

/// Colour tokens copied from the website's `:root` variables
/// (`Client/src/index.css`): a printed-page palette of ink and paper.
abstract final class BetikColors {
  static const inkBlack = Color(0xFF1A1A1A);
  static const charcoal = Color(0xFF2D2D2D);
  static const graphite = Color(0xFF4A4A4A);
  static const ashGray = Color(0xFF6B6B6B);
  static const silverGray = Color(0xFF8E8E8E);
  static const lightSmoke = Color(0xFFB8B8B8);
  static const fog = Color(0xFFD4D4D4);

  static const paperWhite = Color(0xFFFAFAF8);
  static const cream = Color(0xFFF5F4F0);
  static const agedPaper = Color(0xFFEBE8E0);
  static const parchment = Color(0xFFE8E4D8);
  static const vintageBeige = Color(0xFFDCD7C8);
  static const sepiaLight = Color(0xFFF4F1E8);
  static const sepiaDark = Color(0xFFA89F8F);

  /// Logo bookmark / reader bookmark marker.
  static const bookmark = Color(0xFFE63B11);

  /// Radio buttons, focus rings, warning text.
  static const rust = Color(0xFF8B4513);
  static const success = Color(0xFF2D5016);
  static const successBg = Color(0xFFF0F7F0);
  static const danger = Color(0xFF8B0000);
  static const messageBadge = Color(0xFF1F9D74);
  static const notificationBadge = Color(0xFFEF4444);
  static const info = Color(0xFF2563EB);
  static const infoBg = Color(0xFFEFF6FF);

  static const toastSuccess = Color(0xFF059669);
  static const toastError = Color(0xFFDC2626);
  static const toastInfo = Color(0xFF2563EB);

  static const borderLight = Color(0x141A1A1A);
  static const borderMedium = Color(0x261A1A1A);
  static const borderHeavy = Color(0x401A1A1A);
}

abstract final class BetikFonts {
  static const serif = 'LibreBaskerville';
  static const sans = 'Inter';
}

/// Both families are bundled as variable fonts; the weight axis is set
/// explicitly so that the result does not depend on engine heuristics.
TextStyle serif({
  double size = 16,
  FontWeight weight = FontWeight.w400,
  Color color = BetikColors.inkBlack,
  FontStyle style = FontStyle.normal,
  double? height,
  double? letterSpacing,
}) => TextStyle(
  fontFamily: BetikFonts.serif,
  fontSize: size,
  fontWeight: weight,
  fontVariations: [FontVariation.weight(weight.value.toDouble())],
  fontStyle: style,
  color: color,
  height: height,
  letterSpacing: letterSpacing,
);

TextStyle sans({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = BetikColors.inkBlack,
  double? height,
  double? letterSpacing,
}) => TextStyle(
  fontFamily: BetikFonts.sans,
  fontSize: size,
  fontWeight: weight,
  fontVariations: [FontVariation.weight(weight.value.toDouble())],
  color: color,
  height: height,
  letterSpacing: letterSpacing,
);

/// Uppercase sans label used over serif content throughout the product.
TextStyle label({double size = 12, Color color = BetikColors.ashGray, FontWeight weight = FontWeight.w700}) =>
    sans(size: size, weight: weight, color: color, letterSpacing: 1.1);

ThemeData buildBetikTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: BetikColors.inkBlack,
    onPrimary: BetikColors.paperWhite,
    secondary: BetikColors.rust,
    onSecondary: BetikColors.paperWhite,
    error: BetikColors.danger,
    onError: BetikColors.paperWhite,
    surface: BetikColors.paperWhite,
    onSurface: BetikColors.inkBlack,
    surfaceContainerHighest: BetikColors.agedPaper,
    outline: BetikColors.borderHeavy,
    outlineVariant: BetikColors.borderMedium,
  );

  OutlineInputBorder inputBorder(Color color, [double width = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(8),
    borderSide: BorderSide(color: color, width: width),
  );

  final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(6));
  final buttonText = sans(size: 13, weight: FontWeight.w700, letterSpacing: 1.0);

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: BetikColors.cream,
    fontFamily: BetikFonts.sans,
    splashFactory: InkRipple.splashFactory,
    textTheme: TextTheme(
      displaySmall: serif(size: 30, weight: FontWeight.w700, height: 1.2),
      headlineMedium: serif(size: 24, weight: FontWeight.w700, height: 1.25),
      headlineSmall: serif(size: 20, weight: FontWeight.w700, height: 1.3),
      titleLarge: serif(size: 18, weight: FontWeight.w700, height: 1.3),
      titleMedium: serif(size: 16, weight: FontWeight.w700, height: 1.35),
      titleSmall: sans(size: 14, weight: FontWeight.w600),
      bodyLarge: serif(size: 16, height: 1.6),
      bodyMedium: sans(size: 14, height: 1.5),
      bodySmall: sans(size: 12, color: BetikColors.ashGray, height: 1.45),
      labelLarge: buttonText,
      labelMedium: label(),
      labelSmall: label(size: 11),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: BetikColors.paperWhite,
      foregroundColor: BetikColors.inkBlack,
      elevation: 0,
      scrolledUnderElevation: 1,
      surfaceTintColor: Colors.transparent,
      shadowColor: BetikColors.borderMedium,
      centerTitle: false,
      titleTextStyle: serif(size: 18, weight: FontWeight.w700),
      shape: const Border(bottom: BorderSide(color: BetikColors.borderMedium)),
    ),
    dividerTheme: const DividerThemeData(color: BetikColors.borderMedium, thickness: 1, space: 1),
    cardTheme: CardThemeData(
      color: BetikColors.paperWhite,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: BetikColors.borderMedium),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BetikColors.inkBlack,
        foregroundColor: BetikColors.paperWhite,
        disabledBackgroundColor: BetikColors.fog,
        disabledForegroundColor: BetikColors.ashGray,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: BetikColors.inkBlack,
        backgroundColor: BetikColors.paperWhite,
        side: const BorderSide(color: BetikColors.inkBlack, width: 2),
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: BetikColors.inkBlack,
        minimumSize: const Size(44, 44),
        textStyle: sans(size: 14, weight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: BetikColors.paperWhite,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: inputBorder(BetikColors.borderHeavy),
      enabledBorder: inputBorder(BetikColors.borderHeavy),
      focusedBorder: inputBorder(BetikColors.rust, 2),
      errorBorder: inputBorder(BetikColors.danger),
      focusedErrorBorder: inputBorder(BetikColors.danger, 2),
      hintStyle: serif(size: 14, color: BetikColors.silverGray, style: FontStyle.italic),
      labelStyle: sans(size: 14, color: BetikColors.ashGray),
      errorStyle: sans(size: 12, color: BetikColors.danger),
      helperStyle: sans(size: 12, color: BetikColors.ashGray),
      errorMaxLines: 3,
      helperMaxLines: 3,
    ),
    chipTheme: ChipThemeData(
      backgroundColor: BetikColors.agedPaper,
      selectedColor: BetikColors.inkBlack,
      side: const BorderSide(color: BetikColors.borderMedium),
      labelStyle: serif(size: 12.5),
      secondaryLabelStyle: serif(size: 12.5, color: BetikColors.paperWhite),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      shape: const StadiumBorder(),
      showCheckmark: false,
    ),
    radioTheme: RadioThemeData(fillColor: WidgetStateProperty.all(BetikColors.rust)),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? BetikColors.rust : Colors.transparent),
      side: const BorderSide(color: BetikColors.graphite, width: 1.5),
    ),
    switchTheme: SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected) ? BetikColors.inkBlack : BetikColors.fog,
      ),
      thumbColor: WidgetStateProperty.all(BetikColors.paperWhite),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: BetikColors.inkBlack,
      unselectedLabelColor: BetikColors.ashGray,
      indicatorColor: BetikColors.inkBlack,
      labelStyle: label(color: BetikColors.inkBlack),
      unselectedLabelStyle: label(),
      dividerColor: BetikColors.borderMedium,
      tabAlignment: TabAlignment.start,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: BetikColors.paperWhite,
      surfaceTintColor: Colors.transparent,
      indicatorColor: BetikColors.agedPaper,
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => sans(
          size: 11,
          weight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? BetikColors.inkBlack : BetikColors.ashGray,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(size: 24, color: states.contains(WidgetState.selected) ? BetikColors.inkBlack : BetikColors.ashGray),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: BetikColors.paperWhite,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      titleTextStyle: serif(size: 19, weight: FontWeight.w700),
      contentTextStyle: sans(size: 14, height: 1.5, color: BetikColors.graphite),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: BetikColors.paperWhite,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      contentTextStyle: sans(size: 14, color: Colors.white, weight: FontWeight.w500),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: BetikColors.inkBlack, linearTrackColor: BetikColors.vintageBeige),
    listTileTheme: ListTileThemeData(
      iconColor: BetikColors.graphite,
      titleTextStyle: serif(size: 15),
      subtitleTextStyle: sans(size: 12.5, color: BetikColors.ashGray),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: BetikColors.paperWhite,
      surfaceTintColor: Colors.transparent,
      textStyle: sans(size: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: const BorderSide(color: BetikColors.borderMedium),
      ),
    ),
    drawerTheme: const DrawerThemeData(backgroundColor: BetikColors.paperWhite, surfaceTintColor: Colors.transparent),
    expansionTileTheme: const ExpansionTileThemeData(
      shape: Border(),
      collapsedShape: Border(),
      iconColor: BetikColors.inkBlack,
      textColor: BetikColors.inkBlack,
    ),
  );
}
