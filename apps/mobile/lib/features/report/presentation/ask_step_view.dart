import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/app_icon.dart';
import '../../../shared/widgets/illustration.dart';
import '../../cases/data/case_models.dart' show FollowUpId;
import '../providers.dart';

const _questions = {
  FollowUpId.conscious: "L'animal est-il conscient ?",
  FollowUpId.bleeding: 'Saigne-t-il beaucoup ?',
  FollowUpId.walk: 'Peut-il se lever ou marcher ?',
  FollowUpId.eating: 'Boit-il ou mange-t-il ce que vous lui donnez ?',
};

const _hints = {
  FollowUpId.conscious: 'Yeux ouverts, il réagit quand vous lui parlez',
  FollowUpId.bleeding: 'Du sang qui continue de couler',
  FollowUpId.walk: 'Même lentement ou en boitant',
  FollowUpId.eating: "De l'eau ou un peu de nourriture",
};

/// The triage asks what is still missing, one question at a time, with big
/// yes/no buttons. The answers can only raise the urgency.
class AskStepView extends ConsumerWidget {
  const AskStepView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final index = state.questionIndex.clamp(0, state.questions.length - 1);
    final question = state.questions[index];

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacing.screenPadding,
            child: Center(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.glassStrong,
                  borderRadius: AppRadius.xxxlAll,
                  border: Border.all(color: colors.glassBorder),
                  boxShadow: AppShadows.soft(Theme.of(context).brightness),
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.xl,
                    AppSpacing.xxl,
                    AppSpacing.xl,
                    AppSpacing.xxl,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Illustration(
                        'assets/illustrations/stethoscope.png',
                        size: 76,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'PawLink · question ${index + 1} sur '
                                '${state.questions.length}'
                            .toUpperCase(),
                        textAlign: TextAlign.center,
                        style: textTheme.labelMedium!.copyWith(
                          color: colors.link,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        "Une petite question pour bien évaluer l'urgence",
                        textAlign: TextAlign.center,
                        style: textTheme.bodyMedium!.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: Column(
                          key: ValueKey(question),
                          children: [
                            const SizedBox(height: AppSpacing.xl),
                            Text(
                              _questions[question]!,
                              textAlign: TextAlign.center,
                              style: textTheme.headlineMedium,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              _hints[question]!,
                              textAlign: TextAlign.center,
                              style: textTheme.bodyLarge!.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          for (var i = 0; i < state.questions.length; i++) ...[
                            if (i > 0) const SizedBox(width: 6),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: i == index ? 22 : 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color:
                                    i <= index
                                        ? colors.link
                                        : colors.surfaceMuted,
                                borderRadius: AppRadius.fullAll,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.xl,
            AppSpacing.lg,
            AppSpacing.xl,
            AppSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (state.submitting)
                const Padding(
                  padding: EdgeInsetsDirectional.only(bottom: AppSpacing.md),
                  child: Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 3),
                    ),
                  ),
                ),
              Row(
                children: [
                  Expanded(
                    child: _AnswerButton(
                      key: const ValueKey('report-answer-yes'),
                      label: 'Oui',
                      icon: 'assets/icons/check.svg',
                      color: colors.success,
                      onTap: () => controller.answer(true),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: _AnswerButton(
                      key: const ValueKey('report-answer-no'),
                      label: 'Non',
                      icon: 'assets/icons/x.svg',
                      color: colors.urgent,
                      onTap: () => controller.answer(false),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              TextButton(
                key: const ValueKey('report-answer-unsure'),
                onPressed: () => controller.answer(null),
                child: Text(
                  'Je ne sais pas',
                  style: textTheme.labelLarge!.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AnswerButton extends StatelessWidget {
  const _AnswerButton({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final String icon;
  final Color color;
  final VoidCallback onTap;

  static const double _height = 64;
  static const double _badge = 32;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xxlAll,
        boxShadow: AppShadows.soft(brightness),
      ),
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.xxlAll,
          side: BorderSide(color: colors.outline),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(
            height: _height,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: _badge,
                  height: _badge,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                  child: AppIcon(icon, size: 16, color: colors.onPrimary),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(label, style: Theme.of(context).textTheme.headlineSmall),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
