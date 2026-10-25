import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../providers.dart';

/// Horizontal row of round filter chips: Tous, Vétérinaires, Refuges,
/// Transport, Éducation, Animaleries.
class ServiceFilterChips extends StatelessWidget {
  const ServiceFilterChips({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final ServiceFilter selected;
  final ValueChanged<ServiceFilter> onSelected;

  static const double _gap = 12;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: AppSpacing.screenPadding,
      child: Row(
        children: [
          for (final filter in ServiceFilter.values) ...[
            if (filter != ServiceFilter.values.first)
              const SizedBox(width: _gap),
            _RoundFilter(
              filter: filter,
              active: filter == selected,
              onTap: () => onSelected(filter),
            ),
          ],
        ],
      ),
    );
  }
}

class _RoundFilter extends StatelessWidget {
  const _RoundFilter({
    required this.filter,
    required this.active,
    required this.onTap,
  });

  final ServiceFilter filter;
  final bool active;
  final VoidCallback onTap;

  static const double _circleSize = 54;
  static const double _imageSize = 36;
  static const double _iconSize = 20;

  String get _label => switch (filter) {
    ServiceFilter.all => 'Tous',
    ServiceFilter.vet => 'Vétérinaires',
    ServiceFilter.shelter => 'Refuges',
    ServiceFilter.transport => 'Transport',
    ServiceFilter.education => 'Éducation',
    ServiceFilter.store => 'Animaleries',
  };

  String? get _illustration => switch (filter) {
    ServiceFilter.all => null, // the sliders icon
    ServiceFilter.vet => 'assets/illustrations/stethoscope.png',
    ServiceFilter.shelter => 'assets/illustrations/home.png',
    ServiceFilter.transport => 'assets/illustrations/truck.png',
    ServiceFilter.education => 'assets/illustrations/bone.png',
    ServiceFilter.store => 'assets/illustrations/bowl.png',
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final illustration = _illustration;

    return Semantics(
      button: true,
      selected: active,
      label: _label,
      child: ExcludeSemantics(
        child: InkResponse(
          onTap: onTap,
          radius: _circleSize / 2 + 6,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.ease,
                width: _circleSize,
                height: _circleSize,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.glassMedium,
                  border: Border.all(
                    width: 2,
                    color: active ? colors.link : Colors.transparent,
                  ),
                  boxShadow:
                      active
                          ? [
                            BoxShadow(
                              color: colors.link.withValues(alpha: 0.16),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ]
                          : null,
                ),
                child:
                    illustration == null
                        ? SvgPicture.asset(
                          'assets/icons/sliders.svg',
                          width: _iconSize,
                          height: _iconSize,
                          colorFilter: ColorFilter.mode(
                            colors.textPrimary,
                            BlendMode.srcIn,
                          ),
                        )
                        : Image.asset(
                          illustration,
                          width: _imageSize,
                          height: _imageSize,
                          fit: BoxFit.contain,
                        ),
              ),
              const SizedBox(height: 5),
              Text(
                _label,
                style: textTheme.labelSmall!.copyWith(
                  fontWeight: active ? FontWeight.w800 : FontWeight.w400,
                  color: active ? colors.link : colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
