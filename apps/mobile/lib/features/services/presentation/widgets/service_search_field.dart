import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// Pill-shaped search input (Make: 48px, radius 18, glass fill).
class ServiceSearchField extends StatelessWidget {
  const ServiceSearchField({super.key, required this.onChanged});

  final ValueChanged<String> onChanged;

  static const double _height = 48;
  static const double _iconSize = 19;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      height: _height,
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: colors.glass,
        borderRadius: AppRadius.lgAll,
      ),
      child: Row(
        children: [
          SvgPicture.asset(
            'assets/icons/search.svg',
            width: _iconSize,
            height: _iconSize,
            colorFilter: ColorFilter.mode(colors.textTertiary, BlendMode.srcIn),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: TextField(
              onChanged: onChanged,
              textInputAction: TextInputAction.search,
              style: textTheme.bodyMedium!.copyWith(color: colors.textPrimary),
              cursorColor: colors.link,
              decoration: InputDecoration(
                hintText: 'Rechercher un lieu, un service...',
                hintStyle: textTheme.bodyMedium!.copyWith(
                  color: colors.textMuted,
                ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isCollapsed: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
