import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// A bundled PNG illustration with the soft drop shadow the Make file gives
/// it (`filter: drop-shadow`), which Flutter has no direct equivalent for:
/// a blurred, tinted copy is painted underneath.
class Illustration extends StatelessWidget {
  const Illustration(
    this.asset, {
    super.key,
    required this.size,
    this.shadowOffsetY = 8,
    this.shadowBlur = 10,
  });

  final String asset;
  final double size;
  final double shadowOffsetY;

  /// CSS blur radius; the Gaussian sigma is half of it.
  final double shadowBlur;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final shadow = isDark
        ? Colors.black.withValues(alpha: 0.4)
        : context.colors.textPrimary.withValues(alpha: 0.16);

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Transform.translate(
            offset: Offset(0, shadowOffsetY),
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(
                sigmaX: shadowBlur / 2,
                sigmaY: shadowBlur / 2,
              ),
              child: Image.asset(
                asset,
                width: size,
                height: size,
                fit: BoxFit.contain,
                color: shadow,
                colorBlendMode: BlendMode.srcIn,
                excludeFromSemantics: true,
              ),
            ),
          ),
          Image.asset(
            asset,
            width: size,
            height: size,
            fit: BoxFit.contain,
            excludeFromSemantics: true,
          ),
        ],
      ),
    );
  }
}
