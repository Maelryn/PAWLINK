import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/app_icon.dart';
import '../../../shared/widgets/illustration.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/tinted_button.dart';
import '../../cases/data/case_models.dart';
import '../../map/presentation/case_format.dart';
import '../providers.dart';

/// What the reporter sees once the case is sent: the priority, the safety
/// advice and the reminder to see a vet. The rules decide the priority; this
/// is never a diagnosis.
class TriageResultView extends ConsumerWidget {
  const TriageResultView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final result = ref.watch(reportControllerProvider.select((s) => s.result));
    if (result == null) return const SizedBox.shrink();

    final controller = ref.read(reportControllerProvider.notifier);
    final analysis = result.analysis;
    final color = triageColor(colors, analysis.triage);
    final pending = result.created.moderation == Moderation.pending;
    final illustration = switch (analysis.triage) {
      Triage.urgent => 'assets/illustrations/fire.png',
      Triage.monitoring => 'assets/illustrations/stethoscope.png',
      Triage.stable => 'assets/illustrations/heart.png',
    };

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacing.screenPadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppSpacing.lg),
                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.16),
                      shape: BoxShape.circle,
                      border: Border.all(color: color, width: 3),
                    ),
                    child: Illustration(
                      illustration,
                      size: 44,
                      shadowOffsetY: 4,
                      shadowBlur: 6,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Priorité'.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: textTheme.labelMedium!.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                Text(
                  triageLabel(analysis.triage),
                  textAlign: TextAlign.center,
                  style: textTheme.displayLarge!.copyWith(color: color),
                ),
                const SizedBox(height: AppSpacing.md),
                if (pending)
                  _Banner(
                    background: colors.monitor.withValues(alpha: 0.14),
                    color: colors.monitor,
                    text:
                        'Signalement en attente. Un modérateur le vérifie '
                        'avant de le publier.',
                  )
                else
                  _Banner(
                    background: colors.success.withValues(alpha: 0.14),
                    color: colors.success,
                    icon: 'assets/icons/check.svg',
                    text: 'Cas envoyé · Il apparaît maintenant sur la carte.',
                  ),
                const SizedBox(height: AppSpacing.xl),
                _AnalysisCard(analysis: analysis, color: color),
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.xl,
            AppSpacing.md,
            AppSpacing.xl,
            AppSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PrimaryButton(
                key: const ValueKey('report-view-on-map'),
                label: 'Voir sur la carte',
                icon: 'assets/icons/pin.svg',
                onPressed:
                    pending
                        ? null
                        : () {
                          controller.showOnMap();
                          context.go(AppRoutes.map);
                        },
              ),
              const SizedBox(height: AppSpacing.sm),
              TintedButton(
                key: const ValueKey('report-new'),
                label: 'Nouveau signalement',
                icon: 'assets/icons/plus.svg',
                onPressed: controller.startOver,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.background,
    required this.color,
    required this.text,
    this.icon,
  });

  final Color background;
  final Color color;
  final String text;
  final String? icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: background,
          borderRadius: AppRadius.xlAll,
        ),
        child: Padding(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                AppIcon(icon!, size: 16, color: color),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text(
                  text,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall!.copyWith(color: color),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AnalysisCard extends StatelessWidget {
  const _AnalysisCard({required this.analysis, required this.color});

  final AIAnalysis analysis;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.xxxlAll,
        boxShadow: AppShadows.soft(Theme.of(context).brightness),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (analysis.forcedUrgentByRule) ...[
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.urgentContainer,
                  borderRadius: AppRadius.fullAll,
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  child: Text(
                    'Classé urgent par une règle de sécurité',
                    style: textTheme.labelMedium!.copyWith(
                      color: colors.urgent,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            Text(analysis.summary, style: textTheme.bodyLarge),
            if (analysis.possiblyContagious) ...[
              const SizedBox(height: AppSpacing.lg),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.monitor.withValues(alpha: 0.14),
                  borderRadius: AppRadius.lgAll,
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Possiblement contagieux',
                        style: textTheme.titleMedium!.copyWith(
                          color: colors.monitor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "Limitez les contacts jusqu'à l'avis d'un "
                        'vétérinaire.',
                        style: textTheme.bodyMedium!.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            Text(
              'Conseils de sécurité',
              style: textTheme.titleSmall!.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            // All of them, not the first three: the last one is always
            // "contact a vet".
            for (var i = 0; i < analysis.safetyAdvice.length; i++)
              Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: AppSpacing.sm,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colors.primaryContainer,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${i + 1}',
                        style: textTheme.labelSmall!.copyWith(
                          color: colors.link,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Text(
                        analysis.safetyAdvice[i],
                        style: textTheme.bodyLarge,
                      ),
                    ),
                  ],
                ),
              ),
            Divider(color: colors.divider, height: AppSpacing.xl),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppIcon(
                  'assets/icons/stethoscope.svg',
                  size: 16,
                  color: colors.textSecondary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    analysis.disclaimer,
                    style: textTheme.bodySmall!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
