import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../data/adoption_models.dart';
import '../../providers.dart';
import '../adopt_format.dart';
import 'pet_card.dart';

/// Opens the adoption request form. Resolves to true once the request was sent.
Future<bool?> showAdoptRequestSheet(BuildContext context, AdoptionProfile pet) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    builder: (context) => AdoptRequestSheet(pet: pet),
  );
}

/// Web `AdoptRequestSheet`: housing, experience, a message of at least ten
/// characters, and the rule that phones are only shared on acceptance.
class AdoptRequestSheet extends ConsumerStatefulWidget {
  const AdoptRequestSheet({super.key, required this.pet});

  final AdoptionProfile pet;

  /// Shortest message the web accepts.
  static const int minMessageLength = 10;

  @override
  ConsumerState<AdoptRequestSheet> createState() => _AdoptRequestSheetState();
}

class _AdoptRequestSheetState extends ConsumerState<AdoptRequestSheet> {
  final _message = TextEditingController();
  HousingType _housing = HousingType.house;
  bool _experience = true;
  bool _sending = false;
  bool _failed = false;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  bool get _ready =>
      _message.text.trim().length >= AdoptRequestSheet.minMessageLength;

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _failed = false;
    });
    try {
      await ref
          .read(adoptionRequestActionsProvider)
          .send(
            adoptionId: widget.pet.id,
            message: _message.text.trim(),
            housing: _housing,
            experience: _experience,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _sending = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final pet = widget.pet;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sheet,
        borderRadius: AppRadius.sheetTop,
        boxShadow: AppShadows.sheet(Theme.of(context).brightness),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsetsDirectional.fromSTEB(
          AppSpacing.xl,
          AppSpacing.md,
          AppSpacing.xl,
          AppSpacing.xl + keyboard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: colors.outline,
                  borderRadius: AppRadius.fullAll,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                ClipRRect(
                  borderRadius: AppRadius.xlAll,
                  child: SizedBox(
                    width: 64,
                    height: 64,
                    child: PetPhoto(pet.coverPhoto, label: pet.name),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Demande d'adoption",
                        style: textTheme.titleSmall!.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                      Text(
                        pet.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.headlineMedium,
                      ),
                    ],
                  ),
                ),
                _CloseButton(onTap: () => Navigator.of(context).pop()),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              "Le propriétaire lit votre demande. S'il accepte, vous recevez "
              "chacun le numéro de l'autre pour vous rencontrer.",
              style: textTheme.bodyMedium!.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text('Votre logement', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                for (final h in HousingType.values) ...[
                  if (h != HousingType.values.first)
                    const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _HousingTile(
                      housing: h,
                      selected: h == _housing,
                      onTap: () => setState(() => _housing = h),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _ExperienceRow(
              value: _experience,
              onChanged: (v) => setState(() => _experience = v),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text('Parlez de vous', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              key: const ValueKey('adopt-message'),
              controller: _message,
              onChanged: (_) => setState(() {}),
              minLines: 4,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
              style: textTheme.bodyLarge,
              decoration: InputDecoration(
                hintText:
                    "Présentez-vous et dites pourquoi vous voulez "
                    "l'adopter",
                hintStyle: textTheme.bodyLarge!.copyWith(
                  color: colors.textMuted,
                ),
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
            const SizedBox(height: AppSpacing.md),
            const _PhoneRule(),
            const SizedBox(height: AppSpacing.xl),
            if (_failed) ...[
              Text(
                "Impossible d'envoyer la demande. Réessayez.",
                textAlign: TextAlign.center,
                style: textTheme.bodyMedium!.copyWith(color: colors.urgent),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            SizedBox(
              width: double.infinity,
              child: PrimaryButton(
                key: const ValueKey('adopt-send'),
                label: 'Envoyer la demande',
                onPressed: _ready && !_sending ? _send : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onTap});

  final VoidCallback onTap;

  static const double _size = 40;
  static const double _iconSize = 20;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: 'Fermer',
      child: ExcludeSemantics(
        child: Material(
          color: colors.surfaceVariant,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            key: const ValueKey('adopt-sheet-close'),
            onTap: onTap,
            child: SizedBox(
              width: _size,
              height: _size,
              child: Center(
                child: SvgPicture.asset(
                  'assets/icons/x.svg',
                  width: _iconSize,
                  height: _iconSize,
                  colorFilter: ColorFilter.mode(
                    colors.textPrimary,
                    BlendMode.srcIn,
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

class _HousingTile extends StatelessWidget {
  const _HousingTile({
    required this.housing,
    required this.selected,
    required this.onTap,
  });

  final HousingType housing;
  final bool selected;
  final VoidCallback onTap;

  static const double _height = 64;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      selected: selected,
      label: housingLabel(housing),
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
            key: ValueKey('adopt-housing-${housing.name}'),
            onTap: onTap,
            child: SizedBox(
              height: _height,
              child: Center(
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(horizontal: 6),
                  child: Text(
                    housingLabel(housing),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleSmall!.copyWith(
                      color: selected ? colors.link : colors.textPrimary,
                    ),
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

class _ExperienceRow extends StatelessWidget {
  const _ExperienceRow({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.xlAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.xs,
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                "J'ai déjà eu des animaux",
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            Switch(
              key: const ValueKey('adopt-experience'),
              value: value,
              onChanged: onChanged,
              activeTrackColor: colors.success,
              activeColor: colors.onPrimary,
            ),
          ],
        ),
      ),
    );
  }
}

/// The phone rule, said plainly (web: `market.phoneRule`).
class _PhoneRule extends StatelessWidget {
  const _PhoneRule();

  static const double _iconSize = 18;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        borderRadius: AppRadius.lgAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(top: 1),
              child: SvgPicture.asset(
                'assets/icons/lock.svg',
                width: _iconSize,
                height: _iconSize,
                colorFilter: ColorFilter.mode(colors.link, BlendMode.srcIn),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                "Votre numéro n'est partagé que si le propriétaire accepte. "
                'Vous recevez le sien au même moment.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
