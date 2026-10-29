import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icon.dart';
import '../../../../shared/widgets/illustration.dart';
import '../../../adopt/data/adoption_models.dart' show Species;
import '../../../map/presentation/case_format.dart' show speciesLabel;
import '../../data/report_models.dart';
import '../../providers.dart';
import 'step_header.dart';

/// Step 3: which animal, and how many.
class AnimalStep extends ConsumerWidget {
  const AnimalStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(reportControllerProvider).draft;
    final controller = ref.read(reportControllerProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const StepHeader(
          icon: 'assets/icons/paw-print.svg',
          title: 'Quel animal ?',
        ),
        GridView.count(
          crossAxisCount: 4,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
          childAspectRatio: 0.82,
          children: [
            for (final species in reportSpecies)
              _SpeciesTile(
                species: species,
                selected: draft.species == species,
                onTap: () => controller.setSpecies(species),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.xl),
        _CountRow(count: draft.count, onChanged: controller.setCount),
      ],
    );
  }
}

class _SpeciesTile extends StatelessWidget {
  const _SpeciesTile({
    required this.species,
    required this.selected,
    required this.onTap,
  });

  final Species species;
  final bool selected;
  final VoidCallback onTap;

  static const double _imageSize = 40;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final illustration = speciesIllustration(species);
    final label = speciesLabel(species);

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: ExcludeSemantics(
        child: Material(
          color: selected ? colors.primaryContainer : colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.xlAll,
            side: BorderSide(
              color: selected ? colors.link : colors.outline,
              width: selected ? 2 : 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            key: ValueKey('report-species-${species.name}'),
            onTap: onTap,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  height: _imageSize,
                  child: Center(
                    child:
                        illustration != null
                            ? Illustration(
                              illustration,
                              size: _imageSize,
                              shadowOffsetY: 4,
                              shadowBlur: 6,
                            )
                            : AppIcon(
                              'assets/icons/paw-print.svg',
                              size: 30,
                              color:
                                  selected ? colors.link : colors.textTertiary,
                            ),
                  ),
                ),
                const SizedBox(height: 6),
                Padding(
                  padding: const EdgeInsetsDirectional.symmetric(horizontal: 4),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      label,
                      maxLines: 1,
                      style: textTheme.titleSmall!.copyWith(
                        color: selected ? colors.link : colors.textPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({required this.count, required this.onChanged});

  final int count;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.xlAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            Expanded(
              child: Text("Combien d'animaux ?", style: textTheme.labelLarge),
            ),
            _RoundStepper(
              key: const ValueKey('report-count-minus'),
              icon: 'assets/icons/minus.svg',
              label: 'Un de moins',
              onTap: count > 1 ? () => onChanged(count - 1) : null,
            ),
            SizedBox(
              width: 44,
              child: Text(
                '$count',
                textAlign: TextAlign.center,
                style: textTheme.headlineSmall,
              ),
            ),
            _RoundStepper(
              key: const ValueKey('report-count-plus'),
              icon: 'assets/icons/plus.svg',
              label: 'Un de plus',
              onTap: () => onChanged(count + 1),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundStepper extends StatelessWidget {
  const _RoundStepper({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final String icon;
  final String label;
  final VoidCallback? onTap;

  static const double _size = 36;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: label,
      enabled: onTap != null,
      child: ExcludeSemantics(
        child: Material(
          color: colors.surfaceVariant,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: _size,
              height: _size,
              child: Center(
                child: AppIcon(
                  icon,
                  size: 16,
                  color: onTap == null ? colors.textMuted : colors.textPrimary,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
