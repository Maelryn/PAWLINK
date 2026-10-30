import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

/// Round glass back button at the top-start of a detail screen.
class RoundBackButton extends StatelessWidget {
  const RoundBackButton({super.key, required this.onTap});

  final VoidCallback onTap;

  static const double _size = 40;
  static const double _iconSize = 22;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        button: true,
        label: 'Retour',
        child: ExcludeSemantics(
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: AppShadows.soft(brightness),
            ),
            child: Material(
              color: colors.glassMedium,
              shape: CircleBorder(side: BorderSide(color: colors.glassBorder)),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onTap,
                child: SizedBox(
                  width: _size,
                  height: _size,
                  child: Center(
                    // chevron.svg points toward the reading end: flip it.
                    child: Transform.flip(
                      flipX: true,
                      child: SvgPicture.asset(
                        'assets/icons/chevron.svg',
                        width: _iconSize,
                        height: _iconSize,
                        matchTextDirection: true,
                        colorFilter: ColorFilter.mode(
                          colors.textPrimary,
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
