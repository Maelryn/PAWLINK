import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/illustration.dart';
import '../../data/service_models.dart';

/// Look of each service type: label under the name, tone and illustration of
/// the visual (Make: vet blue, shelter lilac, transport peach, training mint,
/// shop pink).
extension ServiceTypeStyle on ServiceType {
  String get label => switch (this) {
    ServiceType.vet => 'Vétérinaires',
    ServiceType.shelter => 'Refuges',
    ServiceType.transport => 'Transport',
    ServiceType.boarding => 'Pension',
    ServiceType.training => 'Éducation',
    ServiceType.store => 'Animaleries',
  };

  AppTone get tone => switch (this) {
    ServiceType.vet => AppTone.blue,
    ServiceType.shelter => AppTone.lilac,
    ServiceType.transport => AppTone.peach,
    ServiceType.boarding || ServiceType.training => AppTone.mint,
    ServiceType.store => AppTone.pink,
  };

  String get illustration => switch (this) {
    ServiceType.vet => 'assets/illustrations/stethoscope.png',
    ServiceType.shelter => 'assets/illustrations/home.png',
    ServiceType.transport => 'assets/illustrations/truck.png',
    ServiceType.boarding ||
    ServiceType.training => 'assets/illustrations/bone.png',
    ServiceType.store => 'assets/illustrations/bowl.png',
  };
}

/// Row card of the directory: colored visual, name, rating, city, type.
/// Pro listings carry the "Mis en avant" badge; open ones "Ouvert".
class ServiceCard extends StatelessWidget {
  const ServiceCard({super.key, required this.service, this.onTap});

  final Service service;

  /// Null until the place detail screen exists.
  final VoidCallback? onTap;

  static const double _visualWidth = 104;
  static const double _visualHeight = 100;
  static const double _illustrationSize = 54;
  static const double _arrowSize = 18;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final brightness = Theme.of(context).brightness;
    final arabic = Localizations.localeOf(context).languageCode == 'ar';
    final small = textTheme.labelSmall!;

    return Semantics(
      button: onTap != null,
      label: '${service.name}, ${service.type.label}, ${service.city}',
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.glassMedium,
            borderRadius: AppRadius.xxlAll,
            boxShadow: AppShadows.soft(brightness),
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: AppRadius.xxlAll,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsetsDirectional.all(9),
                child: Row(
                  children: [
                    Container(
                      width: _visualWidth,
                      height: _visualHeight,
                      decoration: BoxDecoration(
                        gradient: colors.tone(service.type.tone),
                        borderRadius: AppRadius.lgAll,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Illustration(
                            service.type.illustration,
                            size: _illustrationSize,
                            shadowBlur: 9,
                          ),
                          if (service.pro)
                            PositionedDirectional(
                              top: 6,
                              start: 6,
                              child: _Badge(
                                label: 'Mis en avant',
                                color: colors.glassStrong,
                                textStyle: AppTextStyles.micro(
                                  arabic: arabic,
                                ).copyWith(
                                  fontSize: 7,
                                  letterSpacing: 0,
                                  color: colors.link,
                                ),
                                padding: const EdgeInsetsDirectional.symmetric(
                                  horizontal: 5,
                                  vertical: 3,
                                ),
                              ),
                            ),
                          if (service.openNow ?? false)
                            PositionedDirectional(
                              bottom: 6,
                              start: 6,
                              child: _Badge(
                                label: 'Ouvert',
                                color: colors.success,
                                textStyle: AppTextStyles.micro(
                                  arabic: arabic,
                                ).copyWith(
                                  fontSize: 8,
                                  letterSpacing: 0,
                                  color: colors.onPrimary,
                                ),
                                padding: const EdgeInsetsDirectional.symmetric(
                                  horizontal: 6,
                                  vertical: 3,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            service.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.titleSmall!.copyWith(height: 1.15),
                          ),
                          const SizedBox(height: 5),
                          Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: '★',
                                  style: TextStyle(color: colors.rating),
                                ),
                                TextSpan(
                                  text:
                                      ' ${service.rating.toStringAsFixed(1)}'
                                      ' (${service.reviewCount})'
                                      ' · ${service.city}',
                                ),
                              ],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: small.copyWith(
                              fontWeight: FontWeight.w400,
                              color: colors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            service.type.label,
                            style: AppTextStyles.micro(arabic: arabic).copyWith(
                              letterSpacing: 0,
                              fontWeight: FontWeight.w700,
                              color: colors.link,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    SvgPicture.asset(
                      'assets/icons/chevron.svg',
                      width: _arrowSize,
                      height: _arrowSize,
                      matchTextDirection: true,
                      colorFilter: ColorFilter.mode(
                        colors.textMuted,
                        BlendMode.srcIn,
                      ),
                    ),
                    const SizedBox(width: 2),
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

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    required this.textStyle,
    required this.padding,
  });

  final String label;
  final Color color;
  final TextStyle textStyle;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(color: color, borderRadius: AppRadius.fullAll),
      child: Padding(padding: padding, child: Text(label, style: textStyle)),
    );
  }
}
