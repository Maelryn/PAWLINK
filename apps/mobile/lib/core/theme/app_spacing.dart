import 'package:flutter/material.dart';

/// Spacing scale (logical px). Make used ~14 distinct values; collapsed to six.
abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;

  /// Horizontal padding of every screen.
  static const EdgeInsetsDirectional screenPadding =
      EdgeInsetsDirectional.symmetric(horizontal: xl);
}

/// Corner radii. Make used ~15 values; collapsed to eight steps.
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 28;
  static const double sheet = 34;
  static const double full = 999;

  static const BorderRadius smAll = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius mdAll = BorderRadius.all(Radius.circular(md));
  static const BorderRadius lgAll = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius xlAll = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius xxlAll = BorderRadius.all(Radius.circular(xxl));
  static const BorderRadius xxxlAll = BorderRadius.all(Radius.circular(xxxl));
  static const BorderRadius fullAll = BorderRadius.all(Radius.circular(full));
  static const BorderRadius sheetTop =
      BorderRadius.vertical(top: Radius.circular(sheet));
}

/// Elevation shadows. Light follows Make; dark follows the web, where cards
/// get a hairline ring instead of a soft drop shadow.
abstract final class AppShadows {
  /// Cards, list rows, icon buttons.
  static List<BoxShadow> soft(Brightness b) => b == Brightness.dark
      ? const [BoxShadow(color: Color(0x0FFFFFFF), spreadRadius: 1)]
      : const [
          BoxShadow(
            color: Color(0x14232848),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ];

  /// Floating surfaces: bottom nav, map panel.
  static List<BoxShadow> floating(Brightness b) => b == Brightness.dark
      ? const [
          BoxShadow(
            color: Color(0x99000000),
            blurRadius: 36,
            offset: Offset(0, 12),
          ),
        ]
      : const [
          BoxShadow(
            color: Color(0x292C2F43),
            blurRadius: 40,
            offset: Offset(0, 16),
          ),
        ];

  /// Bottom sheet, casting upwards.
  static List<BoxShadow> sheet(Brightness b) => b == Brightness.dark
      ? const [
          BoxShadow(
            color: Color(0x99000000),
            blurRadius: 50,
            offset: Offset(0, -20),
          ),
        ]
      : const [
          BoxShadow(
            color: Color(0x2E17192D),
            blurRadius: 50,
            offset: Offset(0, -20),
          ),
        ];

  /// Colored glow under a filled primary button or the create button.
  static List<BoxShadow> glow(Color color) => [
        BoxShadow(
          color: color.withValues(alpha: 0.3),
          blurRadius: 24,
          offset: const Offset(0, 12),
        ),
      ];
}
