import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icon.dart';

/// Icon tile, title and one line of help, at the top of each step.
class StepHeader extends StatelessWidget {
  const StepHeader({
    super.key,
    required this.icon,
    required this.title,
    this.body,
  });

  final String icon;
  final String title;
  final String? body;

  static const double _tile = 48;
  static const double _iconSize = 24;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xl),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: _tile,
            height: _tile,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.primaryContainer,
              borderRadius: AppRadius.lgAll,
            ),
            child: AppIcon(icon, size: _iconSize, color: colors.link),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: textTheme.headlineSmall),
                if (body != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    body!,
                    style: textTheme.bodyMedium!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A rounded note with a leading icon: success, warning or error, depending
/// on the colors passed.
class InfoNote extends StatelessWidget {
  const InfoNote({
    super.key,
    required this.icon,
    required this.accent,
    required this.background,
    required this.title,
    required this.body,
  });

  final String icon;
  final Color accent;
  final Color background;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.xlAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(top: 1),
              child: AppIcon(icon, size: 20, color: accent),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: textTheme.titleMedium!.copyWith(color: accent),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    body,
                    style: textTheme.bodyMedium!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
