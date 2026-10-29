import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/app_background.dart';
import '../../../shared/widgets/app_icon.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/round_back_button.dart';
import '../../../shared/widgets/round_close_button.dart';
import '../providers.dart';
import 'ask_step_view.dart';
import 'triage_result_view.dart';
import 'widgets/animal_step.dart';
import 'widgets/location_step.dart';
import 'widgets/photo_step.dart';
import 'widgets/situation_step.dart';

const _stepLabels = ['Photo', 'Lieu', 'Animal', 'Situation'];

/// The Signaler flow: four steps (photo, place, animal, situation), then the
/// triage's quick questions if it has any, then the result. Opens above the
/// tab bar.
class ReportScreen extends ConsumerWidget {
  const ReportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);

    void close() =>
        context.canPop() ? context.pop() : context.go(AppRoutes.home);

    return PopScope(
      // The system back button goes one step back before it leaves.
      canPop: !(state.phase == ReportPhase.form && state.step > 0),
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) controller.back();
      },
      child: Scaffold(
        body: AppBackground(
          child: SafeArea(
            child: Column(
              children: [
                _TopBar(
                  onClose: close,
                  progress:
                      state.phase == ReportPhase.form
                          ? _StepProgress(
                            step: state.step,
                            onJump: controller.goToStep,
                          )
                          : null,
                ),
                Expanded(
                  child: switch (state.phase) {
                    ReportPhase.form => const _FormView(),
                    ReportPhase.ask => const AskStepView(),
                    ReportPhase.result => const TriageResultView(),
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onClose, this.progress});

  final VoidCallback onClose;
  final Widget? progress;

  static const double _side = 40;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.xl,
        AppSpacing.md,
        AppSpacing.xl,
        AppSpacing.md,
      ),
      child: Row(
        children: [
          RoundCloseButton(onTap: onClose),
          Expanded(child: Center(child: progress)),
          const SizedBox(width: _side),
        ],
      ),
    );
  }
}

class _FormView extends ConsumerWidget {
  const _FormView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final colors = context.colors;

    final steps = const [
      PhotoStep(),
      LocationStep(),
      AnimalStep(),
      SituationStep(),
    ];

    final String label;
    if (state.isLastStep) {
      label = 'Envoyer le signalement';
    } else if (state.step == 0 && state.draft.photoPath == null) {
      label = 'Continuer sans photo';
    } else {
      label = 'Continuer';
    }

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: AppSpacing.screenPadding.add(
              const EdgeInsetsDirectional.only(bottom: AppSpacing.lg),
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              child: KeyedSubtree(
                key: ValueKey(state.step),
                child: steps[state.step],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.xl,
            AppSpacing.sm,
            AppSpacing.xl,
            AppSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (state.submitError != null)
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    bottom: AppSpacing.sm,
                  ),
                  child: Text(
                    state.submitError!,
                    textAlign: TextAlign.center,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium!.copyWith(color: colors.urgent),
                  ),
                ),
              Row(
                children: [
                  if (state.step > 0) ...[
                    RoundBackButton(onTap: controller.back),
                    const SizedBox(width: AppSpacing.md),
                  ],
                  Expanded(
                    child: PrimaryButton(
                      key: const ValueKey('report-continue'),
                      label: label,
                      onPressed:
                          !state.canContinue || state.submitting
                              ? null
                              : state.isLastStep
                              ? controller.submit
                              : controller.next,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Four pills in a glass capsule: done (check), current (number and name),
/// next (number). Tapping a done one goes back to it.
class _StepProgress extends StatelessWidget {
  const _StepProgress({required this.step, required this.onJump});

  final int step;
  final ValueChanged<int> onJump;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.glass,
        borderRadius: AppRadius.fullAll,
        border: Border.all(color: colors.glassBorder),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < _stepLabels.length; i++)
              _StepPill(
                index: i,
                label: _stepLabels[i],
                current: i == step,
                done: i < step,
                onTap: i < step ? () => onJump(i) : null,
              ),
          ],
        ),
      ),
    );
  }
}

class _StepPill extends StatelessWidget {
  const _StepPill({
    required this.index,
    required this.label,
    required this.current,
    required this.done,
    required this.onTap,
  });

  final int index;
  final String label;
  final bool current;
  final bool done;
  final VoidCallback? onTap;

  static const double _height = 32;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final color =
        current
            ? colors.onPrimary
            : done
            ? colors.link
            : colors.textTertiary;

    return Semantics(
      button: onTap != null,
      selected: current,
      label: '${index + 1}, $label',
      child: ExcludeSemantics(
        child: Material(
          color: current ? colors.primary : Colors.transparent,
          borderRadius: AppRadius.fullAll,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              height: _height,
              child: Padding(
                padding: EdgeInsetsDirectional.symmetric(
                  horizontal: current ? 12 : 9,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (done)
                      AppIcon('assets/icons/check.svg', size: 14, color: color)
                    else
                      Text(
                        '${index + 1}',
                        style: textTheme.labelLarge!.copyWith(
                          color: color,
                          fontSize: 12.5,
                        ),
                      ),
                    if (current) ...[
                      const SizedBox(width: 4),
                      Text(
                        label,
                        style: textTheme.labelLarge!.copyWith(
                          color: color,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
