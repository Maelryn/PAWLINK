import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/report_models.dart';
import '../../providers.dart';
import 'step_header.dart';

/// Step 4: what is going on. Tags to touch, then a few words.
class SituationStep extends ConsumerStatefulWidget {
  const SituationStep({super.key});

  @override
  ConsumerState<SituationStep> createState() => _SituationStepState();
}

class _SituationStepState extends ConsumerState<SituationStep> {
  late final TextEditingController _description;

  @override
  void initState() {
    super.initState();
    _description = TextEditingController(
      text: ref.read(reportControllerProvider).draft.description,
    );
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final tags = ref.watch(
      reportControllerProvider.select((s) => s.draft.tags),
    );
    final controller = ref.read(reportControllerProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const StepHeader(
          icon: 'assets/icons/stethoscope.svg',
          title: 'Que se passe-t-il ?',
          body: 'Touchez ce que vous voyez, puis ajoutez quelques mots.',
        ),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final tag in conditionTags)
              _TagChip(
                tag: tag,
                selected: tags.contains(tag.id),
                onTap: () => controller.toggleTag(tag.id),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        TextField(
          key: const ValueKey('report-description'),
          controller: _description,
          onChanged: controller.setDescription,
          minLines: 3,
          maxLines: 6,
          textCapitalization: TextCapitalization.sentences,
          style: textTheme.bodyLarge,
          decoration: InputDecoration(
            hintText:
                'Ex. : Le chien boite et a des brûlures aux pattes. Il est '
                'près de la station-service.',
            hintStyle: textTheme.bodyLarge!.copyWith(color: colors.textMuted),
            filled: true,
            fillColor: colors.surface,
            contentPadding: const EdgeInsetsDirectional.all(AppSpacing.lg),
            border: OutlineInputBorder(
              borderRadius: AppRadius.xlAll,
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: AppRadius.xlAll,
              borderSide: BorderSide(color: colors.link, width: 2),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Les faux signalements font perdre du temps aux secouristes : '
          'PawLink vérifie chaque signalement.',
          style: textTheme.bodySmall!.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({
    required this.tag,
    required this.selected,
    required this.onTap,
  });

  final ConditionTag tag;
  final bool selected;
  final VoidCallback onTap;

  static const double _height = 38;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    final Color fill;
    final Color text;
    if (!selected) {
      fill = colors.surface;
      text = colors.textPrimary;
    } else if (tag.highlight) {
      fill = colors.urgent;
      text = colors.onPrimary;
    } else {
      fill = colors.inverse;
      text = colors.onInverse;
    }

    return Semantics(
      button: true,
      selected: selected,
      label: tag.label,
      child: ExcludeSemantics(
        child: Material(
          color: fill,
          borderRadius: AppRadius.fullAll,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            key: ValueKey('report-tag-${tag.id}'),
            onTap: onTap,
            child: SizedBox(
              height: _height,
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(horizontal: 14),
                child: Center(
                  widthFactor: 1,
                  child: Text(
                    tag.label,
                    style: textTheme.titleSmall!.copyWith(color: text),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
