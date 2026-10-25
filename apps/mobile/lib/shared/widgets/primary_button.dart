import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

/// Filled pill button with a colored glow, optionally led by an SVG icon.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  final String label;

  /// Null disables the button (dimmed, no glow).
  final VoidCallback? onPressed;

  /// Asset path of an SVG drawn with `currentColor`.
  final String? icon;

  static const double _height = 52;
  static const double _iconSize = 19;
  static const double _gap = 9;
  static const double _horizontalPadding = 22;
  static const double _disabledOpacity = 0.45;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final enabled = onPressed != null;

    return Opacity(
      opacity: enabled ? 1 : _disabledOpacity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: AppRadius.fullAll,
          boxShadow: enabled ? AppShadows.glow(colors.primary) : null,
        ),
        child: Material(
          color: colors.primary,
          borderRadius: AppRadius.fullAll,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: _height),
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: _horizontalPadding,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      SvgPicture.asset(
                        icon!,
                        width: _iconSize,
                        height: _iconSize,
                        colorFilter: ColorFilter.mode(
                          colors.onPrimary,
                          BlendMode.srcIn,
                        ),
                      ),
                      const SizedBox(width: _gap),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        style: Theme.of(context).textTheme.labelLarge!.copyWith(
                          color: colors.onPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
