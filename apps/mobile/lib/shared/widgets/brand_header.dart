import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'gradient_text.dart';

/// Brand icon asset for the current theme.
String brandIconAsset(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? 'assets/brand/pawlink-icon-dark.svg'
        : 'assets/brand/pawlink-icon-light.svg';

/// Logo and wordmark on the start side, settings button on the end side.
class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, required this.onSettings});

  final VoidCallback onSettings;

  static const double _minHeight = 76;
  static const double _minTopPadding = 10;
  static const double _logoSize = 34;
  static const double _logoGap = 8;
  static const double _buttonSize = 42;
  static const double _buttonIconSize = 19;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;
    final topInset = MediaQuery.paddingOf(context).top;

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: _minHeight),
      child: Padding(
        padding: EdgeInsetsDirectional.only(
          top: topInset > _minTopPadding ? topInset : _minTopPadding,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // The brand name is Latin: it keeps its order in RTL.
            Directionality(
              textDirection: TextDirection.ltr,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(_logoSize * 0.225),
                      boxShadow: [
                        BoxShadow(
                          color: colors.primary.withValues(alpha: 0.25),
                          blurRadius: 9,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: SvgPicture.asset(
                      brandIconAsset(context),
                      width: _logoSize,
                      height: _logoSize,
                    ),
                  ),
                  const SizedBox(width: _logoGap),
                  GradientText(
                    'pawlink',
                    gradient: colors.brandGradient,
                    style: Theme.of(context).textTheme.headlineSmall!.copyWith(
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.8,
                    ),
                  ),
                ],
              ),
            ),
            Semantics(
              button: true,
              label: 'Paramètres',
              child: ExcludeSemantics(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: AppShadows.soft(brightness),
                  ),
                  child: Material(
                    color: colors.glassMedium,
                    shape: const CircleBorder(),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: onSettings,
                      child: SizedBox(
                        width: _buttonSize,
                        height: _buttonSize,
                        child: Center(
                          child: SvgPicture.asset(
                            'assets/icons/settings.svg',
                            width: _buttonIconSize,
                            height: _buttonIconSize,
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
          ],
        ),
      ),
    );
  }
}
