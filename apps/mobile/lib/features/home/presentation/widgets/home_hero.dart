import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/gradient_text.dart';
import '../../../../shared/widgets/illustration.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/brand_header.dart';

/// Hero: the dog and cat flanking the brand badge, tagline, title with the
/// brand gradient on its second line, subtitle and the report button.
class HomeHero extends StatelessWidget {
  const HomeHero({super.key, required this.onReport});

  final VoidCallback onReport;

  static const double _petSize = 78;
  static const double _markSize = 72;
  static const double _markIconSize = 54;
  static const double _markRadius = 24;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final theme = Theme.of(context);
    final brightness = theme.brightness;
    final width = MediaQuery.sizeOf(context).width;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    // Make clamps the top padding and the title to the viewport width.
    final topPadding = (width * 0.11).clamp(38.0, 48.0);
    final titleSize = (width * 0.102).clamp(36.0, 44.0);
    final titleStyle = theme.textTheme.displayLarge!.copyWith(
      fontSize: titleSize,
    );
    final tilt = 12 * math.pi / 180 * (isRtl ? -1 : 1);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        PositionedDirectional(
          top: 18,
          start: -4,
          child: Transform.rotate(
            angle: -tilt,
            child: const Illustration(
              'assets/illustrations/dog.png',
              size: _petSize,
              shadowOffsetY: 16,
              shadowBlur: 14,
            ),
          ),
        ),
        PositionedDirectional(
          top: 12,
          end: -5,
          child: Transform.rotate(
            angle: tilt,
            child: const Illustration(
              'assets/illustrations/cat.png',
              size: _petSize,
              shadowOffsetY: 16,
              shadowBlur: 14,
            ),
          ),
        ),
        Padding(
          padding: EdgeInsetsDirectional.fromSTEB(
            AppSpacing.sm,
            topPadding,
            AppSpacing.sm,
            32,
          ),
          child: SizedBox(
            width: double.infinity,
            child: Column(
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.glass,
                    borderRadius: BorderRadius.circular(_markRadius),
                    boxShadow:
                        brightness == Brightness.dark
                            ? AppShadows.soft(brightness)
                            : [
                              BoxShadow(
                                color: colors.indigo.withValues(alpha: 0.16),
                                blurRadius: 40,
                                offset: const Offset(0, 20),
                              ),
                            ],
                  ),
                  child: SizedBox(
                    width: _markSize,
                    height: _markSize,
                    child: Center(
                      child: SvgPicture.asset(
                        brandIconAsset(context),
                        width: _markIconSize,
                        height: _markIconSize,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  "Pour les animaux d'Algérie",
                  textAlign: TextAlign.center,
                  style: theme.textTheme.labelMedium!.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  "Vous l'avez vu.",
                  textAlign: TextAlign.center,
                  style: titleStyle,
                ),
                const SizedBox(height: 5),
                GradientText(
                  "On s'en occupe.",
                  textAlign: TextAlign.center,
                  gradient: colors.brandGradient,
                  style: titleStyle,
                ),
                const SizedBox(height: 18),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 315),
                  child: Text(
                    'Signalez un animal en détresse. La communauté se '
                    'mobilise autour de vous.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                PrimaryButton(
                  label: 'Signaler un animal',
                  icon: 'assets/icons/camera.svg',
                  onPressed: onReport,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
