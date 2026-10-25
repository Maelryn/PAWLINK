import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

/// "Près de moi": display-only until geolocation is wired.
class LocationPill extends StatelessWidget {
  const LocationPill({super.key});

  static const double _height = 39;
  static const double _iconSize = 16;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.glassMedium,
        borderRadius: AppRadius.fullAll,
        boxShadow: AppShadows.soft(brightness),
      ),
      child: SizedBox(
        height: _height,
        child: Padding(
          padding: const EdgeInsetsDirectional.symmetric(horizontal: 11),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SvgPicture.asset(
                'assets/icons/pin.svg',
                width: _iconSize,
                height: _iconSize,
                colorFilter: ColorFilter.mode(colors.link, BlendMode.srcIn),
              ),
              const SizedBox(width: 5),
              Text(
                'Près de moi',
                style: Theme.of(context).textTheme.labelMedium!.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colors.link,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
