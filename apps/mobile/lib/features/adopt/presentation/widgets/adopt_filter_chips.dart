import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/brand_header.dart';
import '../../providers.dart';

/// Horizontal row of round filter chips: Tous, Favoris, Chien, Chat, Bétail.
class AdoptFilterChips extends StatelessWidget {
  const AdoptFilterChips({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final AdoptFilter selected;
  final ValueChanged<AdoptFilter> onSelected;

  static const double _gap = 12;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: AppSpacing.screenPadding,
      child: Row(
        children: [
          for (final filter in AdoptFilter.values) ...[
            if (filter != AdoptFilter.values.first) const SizedBox(width: _gap),
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

  final AdoptFilter filter;
  final bool active;
  final VoidCallback onTap;

  static const double _circleSize = 54;
  static const double _imageSize = 36;

  String get _label => switch (filter) {
    AdoptFilter.all => 'Tous',
    AdoptFilter.favorites => 'Favoris',
    AdoptFilter.dog => 'Chien',
    AdoptFilter.cat => 'Chat',
    AdoptFilter.livestock => 'Bétail',
  };

  String? get _illustration => switch (filter) {
    AdoptFilter.all => null, // the brand icon, theme dependent
    AdoptFilter.favorites => 'assets/illustrations/heart.png',
    AdoptFilter.dog => 'assets/illustrations/dog.png',
    AdoptFilter.cat => 'assets/illustrations/cat.png',
    AdoptFilter.livestock => 'assets/illustrations/sheep.png',
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
                          brandIconAsset(context),
                          width: _imageSize,
                          height: _imageSize,
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
