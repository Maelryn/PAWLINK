import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';

/// Round "x" that closes a bottom sheet.
class RoundCloseButton extends StatelessWidget {
  const RoundCloseButton({super.key, required this.onTap});

  final VoidCallback onTap;

  static const double _size = 40;
  static const double _iconSize = 20;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: 'Fermer',
      child: ExcludeSemantics(
        child: Material(
          color: colors.surfaceVariant,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: _size,
              height: _size,
              child: Center(
                child: SvgPicture.asset(
                  'assets/icons/x.svg',
                  width: _iconSize,
                  height: _iconSize,
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
    );
  }
}
