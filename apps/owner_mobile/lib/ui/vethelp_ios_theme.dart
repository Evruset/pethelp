import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// Shared semantic tokens for the owner application.
///
/// Components must obtain colours from [ColorScheme] or this extension rather
/// than embedding local colour literals in individual feature screens.
class VetHelpSurfaceTokens extends ThemeExtension<VetHelpSurfaceTokens> {
  const VetHelpSurfaceTokens({
    required this.groupedSurface,
    required this.glassSurface,
    required this.hairline,
    required this.desktopBackdrop,
    required this.contentMaxWidth,
    required this.cardRadius,
    this.spaceXs = 4,
    this.spaceSm = 8,
    this.spaceMd = 16,
    this.spaceLg = 24,
    this.spaceXl = 32,
    this.fieldRadius = 16,
    this.focusRing = Colors.teal,
    this.focusRingWidth = 2,
    this.success = Colors.green,
    this.warning = Colors.orange,
    this.info = Colors.blue,
  });

  final Color groupedSurface;
  final Color glassSurface;
  final Color hairline;
  final Color desktopBackdrop;
  final double contentMaxWidth;
  final double cardRadius;

  /// Semantic layout and interaction tokens shared by native primitives.
  final double spaceXs;
  final double spaceSm;
  final double spaceMd;
  final double spaceLg;
  final double spaceXl;
  final double fieldRadius;
  final Color focusRing;
  final double focusRingWidth;
  final Color success;
  final Color warning;
  final Color info;

  @override
  VetHelpSurfaceTokens copyWith({
    Color? groupedSurface,
    Color? glassSurface,
    Color? hairline,
    Color? desktopBackdrop,
    double? contentMaxWidth,
    double? cardRadius,
    double? spaceXs,
    double? spaceSm,
    double? spaceMd,
    double? spaceLg,
    double? spaceXl,
    double? fieldRadius,
    Color? focusRing,
    double? focusRingWidth,
    Color? success,
    Color? warning,
    Color? info,
  }) {
    return VetHelpSurfaceTokens(
      groupedSurface: groupedSurface ?? this.groupedSurface,
      glassSurface: glassSurface ?? this.glassSurface,
      hairline: hairline ?? this.hairline,
      desktopBackdrop: desktopBackdrop ?? this.desktopBackdrop,
      contentMaxWidth: contentMaxWidth ?? this.contentMaxWidth,
      cardRadius: cardRadius ?? this.cardRadius,
      spaceXs: spaceXs ?? this.spaceXs,
      spaceSm: spaceSm ?? this.spaceSm,
      spaceMd: spaceMd ?? this.spaceMd,
      spaceLg: spaceLg ?? this.spaceLg,
      spaceXl: spaceXl ?? this.spaceXl,
      fieldRadius: fieldRadius ?? this.fieldRadius,
      focusRing: focusRing ?? this.focusRing,
      focusRingWidth: focusRingWidth ?? this.focusRingWidth,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
    );
  }

  @override
  VetHelpSurfaceTokens lerp(VetHelpSurfaceTokens? other, double t) {
    if (other is! VetHelpSurfaceTokens) return this;
    return VetHelpSurfaceTokens(
      groupedSurface: Color.lerp(groupedSurface, other.groupedSurface, t)!,
      glassSurface: Color.lerp(glassSurface, other.glassSurface, t)!,
      hairline: Color.lerp(hairline, other.hairline, t)!,
      desktopBackdrop: Color.lerp(desktopBackdrop, other.desktopBackdrop, t)!,
      contentMaxWidth:
          contentMaxWidth + (other.contentMaxWidth - contentMaxWidth) * t,
      cardRadius: cardRadius + (other.cardRadius - cardRadius) * t,
      spaceXs: spaceXs + (other.spaceXs - spaceXs) * t,
      spaceSm: spaceSm + (other.spaceSm - spaceSm) * t,
      spaceMd: spaceMd + (other.spaceMd - spaceMd) * t,
      spaceLg: spaceLg + (other.spaceLg - spaceLg) * t,
      spaceXl: spaceXl + (other.spaceXl - spaceXl) * t,
      fieldRadius: fieldRadius + (other.fieldRadius - fieldRadius) * t,
      focusRing: Color.lerp(focusRing, other.focusRing, t)!,
      focusRingWidth:
          focusRingWidth + (other.focusRingWidth - focusRingWidth) * t,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
    );
  }
}

class VetHelpTheme {
  const VetHelpTheme._();

  static ThemeData light() => _theme(Brightness.light);

  static ThemeData dark() => _theme(Brightness.dark);

  static ThemeData _theme(Brightness brightness) {
    final colors = ColorScheme.fromSeed(
      seedColor: Colors.blue,
      brightness: brightness,
    );
    final base = ThemeData(useMaterial3: true, colorScheme: colors);
    final radius = BorderRadius.circular(22);
    final fieldRadius = BorderRadius.circular(16);
    final tokens = VetHelpSurfaceTokens(
      groupedSurface: colors.surfaceContainerLowest,
      glassSurface: colors.surface.withValues(alpha: .82),
      hairline: colors.outlineVariant.withValues(alpha: .72),
      desktopBackdrop: colors.surfaceContainerLow,
      contentMaxWidth: 560,
      cardRadius: 24,
      fieldRadius: 16,
      focusRing: colors.primary,
      success: Colors.green.shade700,
      warning: Colors.orange.shade800,
      info: Colors.blue.shade700,
    );

    return base.copyWith(
      scaffoldBackgroundColor: colors.surface,
      extensions: <ThemeExtension<dynamic>>[tokens],
      appBarTheme: AppBarTheme(
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: colors.surface,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          color: colors.onSurface,
          fontWeight: FontWeight.w700,
          letterSpacing: -.35,
        ),
      ),
      cardTheme: CardThemeData(
        color: tokens.groupedSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        surfaceTintColor: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(color: tokens.hairline),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: tokens.hairline,
        space: 1,
        thickness: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surfaceContainerLowest,
        contentPadding: EdgeInsets.symmetric(
          horizontal: tokens.spaceMd,
          vertical: tokens.spaceMd,
        ),
        border: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(color: tokens.hairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(color: tokens.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(
            color: tokens.focusRing,
            width: tokens.focusRingWidth,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(color: colors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: fieldRadius,
          borderSide: BorderSide(color: colors.error, width: 2),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 52),
          shape: RoundedRectangleBorder(borderRadius: fieldRadius),
          textStyle: base.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 52),
          side: BorderSide(color: tokens.hairline),
          shape: RoundedRectangleBorder(borderRadius: fieldRadius),
          textStyle: base.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colors.primaryContainer,
        foregroundColor: colors.onPrimaryContainer,
        shape: RoundedRectangleBorder(borderRadius: fieldRadius),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: tokens.glassSurface,
        indicatorColor: colors.secondaryContainer,
        height: 72,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          return base.textTheme.labelSmall?.copyWith(
            fontWeight:
                states.contains(WidgetState.selected) ? FontWeight.w700 : null,
          );
        }),
      ),
      tabBarTheme: TabBarThemeData(
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: tokens.hairline,
        labelStyle: base.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        surfaceTintColor: colors.surface,
        showDragHandle: true,
        shape: RoundedRectangleBorder(
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(tokens.cardRadius)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        surfaceTintColor: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: radius),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: fieldRadius),
      ),
      chipTheme: base.chipTheme.copyWith(
        side: BorderSide(color: tokens.hairline),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  static Widget frameBuilder(BuildContext context, Widget? child) {
    final tokens = Theme.of(context).extension<VetHelpSurfaceTokens>();
    final content = child ?? const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, constraints) {
        if (tokens == null || constraints.maxWidth < 700) return content;
        return ColoredBox(
          color: tokens.desktopBackdrop,
          child: Center(
            child: RepaintBoundary(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: tokens.contentMaxWidth),
                child: content,
              ),
            ),
          ),
        );
      },
    );
  }
}

class VetHelpCupertinoTheme {
  const VetHelpCupertinoTheme._();

  static CupertinoThemeData data(BuildContext context) {
    return CupertinoThemeData(
      brightness: MediaQuery.platformBrightnessOf(context),
      primaryColor: CupertinoColors.activeBlue,
      scaffoldBackgroundColor: CupertinoColors.systemGroupedBackground,
      barBackgroundColor: CupertinoColors.systemBackground,
      textTheme: const CupertinoTextThemeData(
        primaryColor: CupertinoColors.label,
        textStyle: TextStyle(
          color: CupertinoColors.label,
          fontFamily: '.SF Pro Text',
        ),
      ),
    );
  }
}
