import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Screen background: the base color with the three radial glows of the Make
/// `.app-shell` (blue top-start, violet top-end, pink lower-end).
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return ColoredBox(
      color: colors.background,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _Glow(x: 0.08, y: 0.18, extent: 0.28, color: colors.glowBlue),
          _Glow(x: 0.94, y: 0.18, extent: 0.30, color: colors.glowViolet),
          _Glow(x: 0.80, y: 0.76, extent: 0.30, color: colors.glowPink),
          child,
        ],
      ),
    );
  }
}

/// CSS `radial-gradient(circle at x y, color, transparent extent)`: the circle
/// is sized to the farthest corner, and [extent] is the fraction of that
/// radius where the color has faded out. [x] is measured from the reading
/// start, so the glows mirror in RTL.
class _Glow extends StatelessWidget {
  const _Glow({
    required this.x,
    required this.y,
    required this.extent,
    required this.color,
  });

  final double x;
  final double y;
  final double extent;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final h = box.maxHeight;
        final farthest = math.sqrt(
          math.pow(math.max(x, 1 - x) * w, 2) +
              math.pow(math.max(y, 1 - y) * h, 2),
        );
        final radius = farthest * extent / math.min(w, h);

        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: AlignmentDirectional(x * 2 - 1, y * 2 - 1),
              radius: radius,
              colors: [color, color.withValues(alpha: 0)],
            ),
          ),
        );
      },
    );
  }
}
