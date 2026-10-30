import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

/// Soft secondary pill (Make: primaryContainer fill, link-blue label).
class TintedButton extends StatelessWidget {
  const TintedButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;

  /// Asset path of an SVG drawn with `currentColor`.
  final String icon;
  final VoidCallback onPressed;

  static const double _height = 52;
  static const double _iconSize = 19;
  static const double _gap = 9;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Material(
      color: colors.primaryContainer,
      borderRadius: AppRadius.fullAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: SizedBox(
          height: _height,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SvgPicture.asset(
                icon,
                width: _iconSize,
                height: _iconSize,
                colorFilter: ColorFilter.mode(colors.link, BlendMode.srcIn),
              ),
              const SizedBox(width: _gap),
              Flexible(
                child: Text(
                  label,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge!.copyWith(color: colors.link),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
