import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/illustration.dart';

/// Pastel tile with an illustration, a title, a subtitle and an arrow badge.
class ActionCard extends StatelessWidget {
  const ActionCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.illustration,
    required this.tone,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String illustration;
  final AppTone tone;
  final VoidCallback onTap;

  static const double _minHeight = 142;
  static const double _illustrationSize = 48;
  static const double _badgeSize = 25;
  static const double _badgeIconSize = 14;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: Colors.transparent,
      borderRadius: AppRadius.xxlAll,
      clipBehavior: Clip.antiAlias,
      child: Ink(
        decoration: BoxDecoration(gradient: colors.tone(tone)),
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: _minHeight),
            child: Stack(
              children: [
                Padding(
                  padding: const EdgeInsetsDirectional.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Illustration(illustration, size: _illustrationSize),
                      const SizedBox(height: AppSpacing.md),
                      Text(title, style: textTheme.titleLarge),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: textTheme.labelMedium!.copyWith(
                          fontWeight: FontWeight.w400,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                PositionedDirectional(
                  top: 14,
                  end: 14,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.glass,
                      shape: BoxShape.circle,
                    ),
                    child: SizedBox(
                      width: _badgeSize,
                      height: _badgeSize,
                      child: Center(
                        child: SvgPicture.asset(
                          'assets/icons/chevron.svg',
                          width: _badgeIconSize,
                          height: _badgeIconSize,
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}
