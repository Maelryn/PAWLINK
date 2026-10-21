import 'package:flutter/material.dart';

/// Pastel card/visual tones used by the action cards and service visuals.
enum AppTone { blue, pink, mint, peach, lilac }

/// PawLink colors and gradients, registered on [ThemeData] as an extension.
///
/// Light values come from the Figma Make file (near-duplicates collapsed).
/// Dark values come from the web app (`apps/web/app/globals.css`, `.dark`),
/// except the ones marked "derived", which exist in neither source.
///
/// Read it with `context.colors`; never hard-code hex in screens.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.background,
    required this.surface,
    required this.sheet,
    required this.surfaceVariant,
    required this.surfaceMuted,
    required this.glass,
    required this.glassMedium,
    required this.glassStrong,
    required this.glassBorder,
    required this.divider,
    required this.outline,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textMuted,
    required this.primary,
    required this.onPrimary,
    required this.link,
    required this.primaryContainer,
    required this.indigo,
    required this.violet,
    required this.urgent,
    required this.urgentContainer,
    required this.favorite,
    required this.monitor,
    required this.success,
    required this.successRing,
    required this.rating,
    required this.inverse,
    required this.onInverse,
    required this.scrim,
    required this.glowBlue,
    required this.glowViolet,
    required this.glowPink,
    required this.brandGradient,
    required this.createGradient,
    required this.toneGradients,
  });

  // Surfaces
  final Color background;
  final Color surface;
  final Color sheet;
  final Color surfaceVariant;
  final Color surfaceMuted;

  /// Translucent "glass" fills (blur is applied in widgets).
  final Color glass;
  final Color glassMedium;
  final Color glassStrong;
  final Color glassBorder;

  final Color divider;
  final Color outline;

  // Text
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textMuted;

  // Brand
  final Color primary;
  final Color onPrimary;

  /// Blue used for links, active labels and borders.
  final Color link;
  final Color primaryContainer;
  final Color indigo;
  final Color violet;

  // Status
  final Color urgent;
  final Color urgentContainer;
  final Color favorite;
  final Color monitor;
  final Color success;
  final Color successRing;
  final Color rating;

  // Inverse (active status tab)
  final Color inverse;
  final Color onInverse;

  final Color scrim;

  /// Background glows: the three radial blobs behind the app shell.
  final Color glowBlue;
  final Color glowViolet;
  final Color glowPink;

  // Gradients
  final LinearGradient brandGradient;
  final LinearGradient createGradient;
  final Map<AppTone, LinearGradient> toneGradients;

  LinearGradient tone(AppTone tone) => toneGradients[tone]!;

  // CSS 90deg / 145deg. Directional so they flip with the reading side.
  static const _start90 = AlignmentDirectional.centerStart;
  static const _end90 = AlignmentDirectional.centerEnd;
  static const _start145 = AlignmentDirectional(-0.57, -0.82);
  static const _end145 = AlignmentDirectional(0.57, 0.82);

  static LinearGradient _tone(Color from, Color to) =>
      LinearGradient(begin: _start145, end: _end145, colors: [from, to]);

  static final light = AppColors(
    background: const Color(0xFFF8F8FC),
    surface: const Color(0xFFFFFFFF),
    sheet: const Color(0xFFFBFBFD),
    surfaceVariant: const Color(0xFFEEEEF3),
    surfaceMuted: const Color(0xFFE4E7EF),
    glass: const Color(0xB8FFFFFF), // .72
    glassMedium: const Color(0xCCFFFFFF), // .80
    glassStrong: const Color(0xE6FFFFFF), // .90
    glassBorder: const Color(0xBFFFFFFF),
    divider: const Color(0x0D000000),
    outline: const Color(0xFFD6D6DD),
    textPrimary: const Color(0xFF17171B),
    textSecondary: const Color(0xFF6E6E78),
    textTertiary: const Color(0xFF797982),
    textMuted: const Color(0xFF898993),
    primary: const Color(0xFF0B86F9),
    onPrimary: const Color(0xFFFFFFFF),
    link: const Color(0xFF0783FF),
    primaryContainer: const Color(0xFFE8F3FF),
    indigo: const Color(0xFF5365FF),
    violet: const Color(0xFF8B45ED),
    urgent: const Color(0xFFFF3C4F),
    urgentContainer: const Color(0xFFF6E6EB),
    favorite: const Color(0xFFFF315F),
    monitor: const Color(0xFFFF9E19),
    success: const Color(0xFF25C46B),
    successRing: const Color(0xFFB8E5CD),
    rating: const Color(0xFFF4B000),
    inverse: const Color(0xFF1D1D21),
    onInverse: const Color(0xFFFFFFFF),
    scrim: const Color(0x59181926),
    glowBlue: const Color(0x2953A0FF), // .16
    glowViolet: const Color(0x217E5DFF), // .13
    glowPink: const Color(0x1AFF77AB), // .10
    brandGradient: const LinearGradient(
      begin: _start90,
      end: _end90,
      colors: [Color(0xFF168CFF), Color(0xFF5365FF), Color(0xFF8B45ED)],
      stops: [0, 0.62, 1],
    ),
    createGradient: const LinearGradient(
      begin: _start145,
      end: _end145,
      colors: [Color(0xFF1393FF), Color(0xFF5365FF)],
    ),
    toneGradients: {
      AppTone.blue: _tone(const Color(0xFFE5F1FF), const Color(0xFFCBDFFF)),
      AppTone.pink: _tone(const Color(0xFFFFE9F0), const Color(0xFFFFD1E0)),
      AppTone.mint: _tone(const Color(0xFFE7FAED), const Color(0xFFCDEED8)),
      AppTone.peach: _tone(const Color(0xFFFFF2DD), const Color(0xFFFFDFAE)),
      AppTone.lilac: _tone(const Color(0xFFF5EAFF), const Color(0xFFE6D1FF)),
    },
  );

  static final dark = AppColors(
    background: const Color(0xFF000000),
    surface: const Color(0xFF1C1C1E),
    sheet: const Color(0xFF1C1C1E),
    surfaceVariant: const Color(0xFF2C2C2E),
    surfaceMuted: const Color(0xFF3A3A3C),
    glass: const Color(0x8C26262A), // .55
    glassMedium: const Color(0xAD26262A), // .68, derived (web has .55/.80)
    glassStrong: const Color(0xCC26262A), // .80
    glassBorder: const Color(0x1FFFFFFF),
    divider: const Color(0x8C545458),
    outline: const Color(0xFF3A3A3C),
    textPrimary: const Color(0xFFF5F5F7),
    // The web has two label greys; Make's secondary/tertiary share one here.
    textSecondary: const Color(0xFF98989D),
    textTertiary: const Color(0xFF98989D),
    textMuted: const Color(0xFF636366),
    primary: const Color(0xFF0A84FF),
    onPrimary: const Color(0xFFFFFFFF),
    link: const Color(0xFF0A84FF),
    primaryContainer: const Color(0x330A84FF),
    indigo: const Color(0xFF7D7AFF),
    violet: const Color(0xFF8B45ED), // derived: web gradient ends in pink
    urgent: const Color(0xFFFF453A),
    urgentContainer: const Color(0x33FF453A),
    favorite: const Color(0xFFFF2D55),
    monitor: const Color(0xFFFF9F0A),
    success: const Color(0xFF30D158),
    successRing: const Color(0x3330D158),
    rating: const Color(0xFFF4B000), // derived: not in web
    inverse: const Color(0xFFF5F5F7),
    onInverse: const Color(0xFF000000),
    scrim: const Color(0x59181926),
    // Web dark hero gradient stops, used as the three glows.
    glowBlue: const Color(0xFF0B1830),
    glowViolet: const Color(0xFF1A1236),
    glowPink: const Color(0xFF2A0F1F),
    brandGradient: const LinearGradient(
      begin: _start90,
      end: _end90,
      colors: [Color(0xFF0A84FF), Color(0xFF7D7AFF), Color(0xFF8B45ED)],
      stops: [0, 0.62, 1],
    ),
    createGradient: const LinearGradient(
      begin: _start145,
      end: _end145,
      colors: [Color(0xFF0A84FF), Color(0xFF7D7AFF)],
    ),
    toneGradients: {
      // blue and lilac are derived; the other three are from the web.
      AppTone.blue: _tone(const Color(0xFF14304F), const Color(0xFF0E2038)),
      AppTone.pink: _tone(const Color(0xFF3A1826), const Color(0xFF2A121C)),
      AppTone.mint: _tone(const Color(0xFF16301F), const Color(0xFF112418)),
      AppTone.peach: _tone(const Color(0xFF3A2418), const Color(0xFF2A1A12)),
      AppTone.lilac: _tone(const Color(0xFF2A1F4A), const Color(0xFF1D1535)),
    },
  );

  /// The palette is immutable and defined by [light] and [dark] only.
  @override
  AppColors copyWith() => this;

  /// Hard switch at the midpoint: keeps the extension simple, and the
  /// built-in [ThemeData] colors still animate.
  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return t < 0.5 ? this : other;
  }
}

extension AppColorsContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}
