import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';

/// Glass card, the same surface as Home's cards.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsetsDirectional.all(AppSpacing.lg + 2),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.glass,
        borderRadius: AppRadius.xlAll,
        boxShadow: AppShadows.soft(Theme.of(context).brightness),
      ),
      child: SizedBox(
        width: double.infinity,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// Small uppercase label above a block of a [GlassCard].
class SectionEyebrow extends StatelessWidget {
  const SectionEyebrow(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: AppTextStyles.micro().copyWith(
        color: context.colors.textSecondary,
      ),
    );
  }
}
