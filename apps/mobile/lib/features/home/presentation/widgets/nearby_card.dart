import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../data/home_repository.dart';

/// "Carte en direct" teaser: live dot, report count, last update, chevron.
class NearbyCard extends StatelessWidget {
  const NearbyCard({super.key, required this.summary, required this.onTap});

  final NearbySummary summary;
  final VoidCallback onTap;

  static const double _dotSize = 10;
  static const double _dotRing = 3;
  static const double _chevronSize = 22;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final count = summary.reportCount;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xlAll,
        boxShadow: AppShadows.soft(Theme.of(context).brightness),
      ),
      child: Material(
        color: colors.glass,
        borderRadius: AppRadius.xlAll,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsetsDirectional.all(15),
            child: Row(
              children: [
                Container(
                  width: _dotSize,
                  height: _dotSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.success,
                    border: Border.all(
                      color: colors.successRing,
                      width: _dotRing,
                      strokeAlign: BorderSide.strokeAlignOutside,
                    ),
                  ),
                ),
                const SizedBox(width: 11 + _dotRing),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CARTE EN DIRECT',
                        style: AppTextStyles.micro().copyWith(
                          color: colors.link,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        count == 1
                            ? '1 signalement près de vous'
                            : '$count signalements près de vous',
                        style: textTheme.titleMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Dernière mise à jour il y a '
                        '${summary.updatedAgo.inMinutes} min',
                        style: textTheme.labelMedium!.copyWith(
                          fontWeight: FontWeight.w400,
                          color: colors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 11),
                SvgPicture.asset(
                  'assets/icons/chevron.svg',
                  width: _chevronSize,
                  height: _chevronSize,
                  matchTextDirection: true,
                  colorFilter: ColorFilter.mode(
                    colors.textPrimary,
                    BlendMode.srcIn,
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
