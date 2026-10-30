import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/tinted_button.dart';
import '../../data/report_models.dart';
import '../../providers.dart';
import 'step_header.dart';

/// Step 2: where the animal is, from the phone's position. It must be inside
/// Algeria. Without location, a demo position is offered; a report made with
/// it is marked "not on site".
class LocationStep extends ConsumerStatefulWidget {
  const LocationStep({super.key});

  @override
  ConsumerState<LocationStep> createState() => _LocationStepState();
}

class _LocationStepState extends ConsumerState<LocationStep> {
  late final TextEditingController _address;

  @override
  void initState() {
    super.initState();
    _address = TextEditingController(
      text: ref.read(reportControllerProvider).draft.address,
    );
    // Ask as soon as the step opens, once.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final state = ref.read(reportControllerProvider);
      if (state.location == LocationStatus.idle &&
          state.draft.position == null) {
        ref.read(reportControllerProvider.notifier).locate();
      }
    });
  }

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final position = state.draft.position;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const StepHeader(
          icon: 'assets/icons/pin.svg',
          title: "Où se trouve l'animal ?",
          body: 'Le signalement est placé à votre position.',
        ),
        if (state.location == LocationStatus.locating)
          Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              vertical: AppSpacing.xxl,
            ),
            child: Column(
              children: [
                const SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(strokeWidth: 3),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Vérification de votre position…',
                  style: textTheme.titleSmall!.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        if (position != null) ...[
          if (position.isDemo)
            InfoNote(
              icon: 'assets/icons/pin.svg',
              accent: colors.monitor,
              background: colors.monitor.withValues(alpha: 0.12),
              title: 'Position de démo',
              body:
                  'Ce signalement sera marqué « pas sur place » et ne '
                  'comptera pas comme vérifié.',
            )
          else
            InfoNote(
              icon: 'assets/icons/locate-fixed.svg',
              accent: colors.success,
              background: colors.success.withValues(alpha: 0.12),
              title: 'Position trouvée',
              body: 'Vous êtes près de l\'animal ✓',
            ),
          const SizedBox(height: AppSpacing.sm),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              '${position.lat.toStringAsFixed(5)}°, '
              '${position.lng.toStringAsFixed(5)}°',
              style: textTheme.labelMedium!.copyWith(
                color: colors.textTertiary,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            key: const ValueKey('report-address'),
            controller: _address,
            onChanged: controller.setAddress,
            textCapitalization: TextCapitalization.sentences,
            style: textTheme.bodyLarge,
            decoration: InputDecoration(
              hintText: 'Repère, rue, village (optionnel)',
              hintStyle: textTheme.bodyLarge!.copyWith(color: colors.textMuted),
              filled: true,
              fillColor: colors.surface,
              contentPadding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              border: OutlineInputBorder(
                borderRadius: AppRadius.lgAll,
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.lgAll,
                borderSide: BorderSide(color: colors.link, width: 2),
              ),
            ),
          ),
          if (!position.isDemo) ...[
            const SizedBox(height: AppSpacing.md),
            TintedButton(
              label: 'Actualiser ma position',
              icon: 'assets/icons/locate-fixed.svg',
              onPressed: controller.locate,
            ),
          ],
        ],
        if (state.location == LocationStatus.denied ||
            state.location == LocationStatus.outside) ...[
          InfoNote(
            icon: 'assets/icons/pin.svg',
            accent: colors.urgent,
            background: colors.urgentContainer,
            title:
                state.location == LocationStatus.outside
                    ? 'PawLink est disponible uniquement en Algérie'
                    : 'Activez la localisation',
            body:
                state.location == LocationStatus.outside
                    ? 'Votre position semble être hors d\'Algérie. Signaler, '
                        'publier et s\'inscrire sont réservés aux personnes '
                        'en Algérie.'
                    : 'Pour garder les signalements fiables, PawLink a '
                        'besoin de votre position. Autorisez la localisation '
                        'dans les réglages du téléphone, puis réessayez.',
          ),
          const SizedBox(height: AppSpacing.md),
          TintedButton(
            key: const ValueKey('report-retry-location'),
            label: 'Réessayer',
            icon: 'assets/icons/locate-fixed.svg',
            onPressed: controller.locate,
          ),
          const SizedBox(height: AppSpacing.lg),
          DecoratedBox(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadius.xlAll,
            ),
            child: Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Juste pour essayer ?', style: textTheme.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    'Utilisez une position de démo. Ce que vous publiez sera '
                    'marqué « pas sur place » et ne comptera pas comme '
                    'vérifié.',
                    style: textTheme.bodyMedium!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TintedButton(
                    key: const ValueKey('report-demo-position'),
                    label: 'Utiliser la position de démo',
                    icon: 'assets/icons/pin.svg',
                    onPressed: controller.useDemoPosition,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
