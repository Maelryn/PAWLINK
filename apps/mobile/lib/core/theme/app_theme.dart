import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_spacing.dart';
import 'app_text_styles.dart';

/// Light and dark [ThemeData]. Pass `arabic: true` (from the active locale)
/// to switch the type to IBM Plex Sans Arabic.
abstract final class AppTheme {
  static ThemeData light({bool arabic = false}) =>
      _build(AppColors.light, Brightness.light, arabic);

  static ThemeData dark({bool arabic = false}) =>
      _build(AppColors.dark, Brightness.dark, arabic);

  static ThemeData _build(AppColors c, Brightness brightness, bool arabic) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.link,
      secondary: c.indigo,
      onSecondary: c.onPrimary,
      tertiary: c.violet,
      onTertiary: c.onPrimary,
      error: c.urgent,
      onError: c.onPrimary,
      errorContainer: c.urgentContainer,
      onErrorContainer: c.urgent,
      surface: c.surface,
      onSurface: c.textPrimary,
      onSurfaceVariant: c.textSecondary,
      surfaceContainerLowest: c.background,
      surfaceContainerLow: c.surface,
      surfaceContainer: c.surface,
      surfaceContainerHigh: c.surfaceVariant,
      surfaceContainerHighest: c.surfaceMuted,
      outline: c.outline,
      outlineVariant: c.divider,
      shadow: const Color(0xFF000000),
      scrim: c.scrim,
      inverseSurface: c.inverse,
      onInverseSurface: c.onInverse,
      inversePrimary: c.primary,
    );

    final textTheme = AppTextStyles.textTheme(arabic: arabic).apply(
      bodyColor: c.textPrimary,
      displayColor: c.textPrimary,
    );
    final family = textTheme.bodyMedium!;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: c.background,
      canvasColor: c.background,
      fontFamily: family.fontFamily,
      fontFamilyFallback: family.fontFamilyFallback,
      textTheme: textTheme,
      dividerColor: c.divider,
      extensions: [c],
      splashFactory: InkSparkle.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: c.textPrimary,
        titleTextStyle: textTheme.headlineSmall,
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.xxlAll),
      ),
      dividerTheme: DividerThemeData(color: c.divider, space: 1, thickness: 1),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.sheet,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: c.scrim,
        showDragHandle: true,
        dragHandleColor: c.outline,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.sheetTop),
        clipBehavior: Clip.antiAlias,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: c.primary,
          foregroundColor: c.onPrimary,
          minimumSize: const Size(0, 52),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.xxl,
          ),
          shape: const StadiumBorder(),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.link,
          textStyle: textTheme.labelLarge,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.glass,
        hintStyle: textTheme.bodyMedium!.copyWith(color: c.textMuted),
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        border: const OutlineInputBorder(
          borderRadius: AppRadius.lgAll,
          borderSide: BorderSide.none,
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStatePropertyAll(c.onPrimary),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? c.success
              : c.outline,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.inverse,
        contentTextStyle: textTheme.bodyMedium!.copyWith(color: c.onInverse),
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      ),
    );
  }
}
