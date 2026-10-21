import 'package:flutter/material.dart';

/// Typography. Inter for Latin, IBM Plex Sans Arabic for the AR locale (what
/// the web uses), each with the other as fallback so mixed text such as a
/// Latin clinic name inside Arabic renders correctly. Both are bundled in
/// `assets/fonts`; glyphs missing from both fall back to the platform font.
///
/// Styles carry no color: [AppTheme] applies it from the palette.
abstract final class AppTextStyles {
  static const _latin = 'Inter';
  static const _arabic = 'IBMPlexSansArabic';

  static TextStyle _style(
    double size,
    FontWeight weight, {
    required bool arabic,
    double height = 1.25,
    double spacing = 0,
  }) =>
      TextStyle(
        fontFamily: arabic ? _arabic : _latin,
        fontFamilyFallback: [arabic ? _latin : _arabic],
        fontSize: size,
        // Plex Arabic ships 400-700 only; heavier weights resolve to Bold.
        fontWeight: weight,
        height: height,
        // Tight tracking suits Latin display type but breaks Arabic joins.
        letterSpacing: arabic ? 0 : spacing,
      );

  /// Material text theme built from the Make type scale (its ~20 sizes
  /// collapsed to 12). Pass `arabic: true` for the AR locale.
  static TextTheme textTheme({bool arabic = false}) {
    TextStyle s(double size, FontWeight w,
            {double height = 1.25, double spacing = 0}) =>
        _style(size, w,
            arabic: arabic, height: height, spacing: spacing);
    return TextTheme(
      displayLarge: s(44, FontWeight.w900, height: 0.98, spacing: -2.2),
      displayMedium: s(36, FontWeight.w900, height: 0.98, spacing: -1.8),
      headlineLarge: s(32, FontWeight.w900, height: 1.04, spacing: -1.2),
      headlineMedium: s(25, FontWeight.w800, spacing: -0.7),
      headlineSmall: s(22, FontWeight.w800, spacing: -0.6),
      titleLarge: s(16, FontWeight.w800),
      titleMedium: s(14, FontWeight.w800),
      titleSmall: s(13, FontWeight.w700),
      bodyLarge: s(14, FontWeight.w400, height: 1.48),
      bodyMedium: s(13, FontWeight.w400, height: 1.4),
      bodySmall: s(12, FontWeight.w400, height: 1.35),
      labelLarge: s(15, FontWeight.w700),
      labelMedium: s(11, FontWeight.w700),
      labelSmall: s(10, FontWeight.w700),
    );
  }

  /// Smallest label (badges, "CARTE EN DIRECT" eyebrow). Not part of
  /// Material's scale.
  static TextStyle micro({bool arabic = false}) => _style(
        9,
        FontWeight.w800,
        arabic: arabic,
        spacing: 0.7,
      );
}
