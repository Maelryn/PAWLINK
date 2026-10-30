import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_background.dart';
import '../../../shared/widgets/gradient_text.dart';
import '../../../shared/widgets/illustration.dart';
import '../data/adoption_models.dart';
import '../providers.dart';
import 'adopt_format.dart';
import 'widgets/adopt_action_bar.dart';
import 'widgets/adopt_request_sheet.dart';
import 'widgets/photo_gallery.dart';

/// Adoption profile: photos, story, health, character, who publishes it, and
/// the bar to ask for the animal. Behavior follows the web `/adopt/[id]`;
/// there is no Make design for it, so it reuses the Adopter/Home language.
class AdoptDetailScreen extends ConsumerWidget {
  const AdoptDetailScreen({super.key, required this.id});

  final String id;

  /// Room under the content for the floating action bar.
  static const double _barClearance = 190;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pet = ref.watch(adoptionProvider(id));
    final request = ref.watch(myRequestProvider(id));
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: AppBackground(
        child: pet.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error:
              (error, stack) => _Message(
                title: 'Impossible de charger cet animal.',
                actionLabel: 'Réessayer',
                onAction: () => ref.invalidate(adoptionProvider(id)),
              ),
          data: (pet) {
            if (pet == null) {
              return _Message(
                title: "Cet animal n'est plus disponible.",
                actionLabel: 'Retour',
                onAction: () => context.pop(),
              );
            }
            return Stack(
              children: [
                CustomScrollView(
                  slivers: [
                    SliverPadding(
                      padding: AppSpacing.screenPadding.copyWith(
                        top: top + AppSpacing.md,
                        bottom: _barClearance + bottom,
                      ),
                      sliver: SliverList.list(
                        children: [
                          _BackButton(onTap: () => context.pop()),
                          const SizedBox(height: AppSpacing.md),
                          PhotoGallery(photos: pet.photos, label: pet.name),
                          _Header(pet: pet),
                          _StatTiles(pet: pet),
                          const SizedBox(height: AppSpacing.md),
                          _Section(
                            title: 'Son histoire',
                            child: Text(
                              pet.story,
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          _HealthSection(pet: pet),
                          const SizedBox(height: AppSpacing.md),
                          _CharacterSection(pet: pet),
                          const SizedBox(height: AppSpacing.md),
                          _PublisherCard(pet: pet),
                        ],
                      ),
                    ),
                  ],
                ),
                Positioned.fill(
                  child: Align(
                    alignment: AlignmentDirectional.bottomCenter,
                    child: AdoptActionBar(
                      pet: pet,
                      request: request.value,
                      onRequest: () => _ask(context, pet),
                      onCancel: () {
                        final mine = request.value;
                        if (mine != null) {
                          ref.read(adoptionRequestActionsProvider).cancel(mine);
                          _toast(context, 'Demande annulée');
                        }
                      },
                      onCall: (phone) => _open(Uri(scheme: 'tel', path: phone)),
                      onWhatsapp:
                          (phone) => _open(
                            Uri.https(
                              'wa.me',
                              '/${phone.replaceAll(RegExp(r'\D'), '')}',
                            ),
                          ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _ask(BuildContext context, AdoptionProfile pet) async {
    final sent = await showAdoptRequestSheet(context, pet);
    if (sent == true && context.mounted) {
      _toast(
        context,
        'Demande envoyée. Vous serez prévenu quand le propriétaire répondra.',
      );
    }
  }

  void _toast(BuildContext context, String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _open(Uri uri) =>
      launchUrl(uri, mode: LaunchMode.externalApplication);
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap});

  final VoidCallback onTap;

  static const double _size = 40;
  static const double _iconSize = 22;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        button: true,
        label: 'Retour',
        child: ExcludeSemantics(
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: AppShadows.soft(brightness),
            ),
            child: Material(
              color: colors.glassMedium,
              shape: CircleBorder(side: BorderSide(color: colors.glassBorder)),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                key: const ValueKey('adopt-back'),
                onTap: onTap,
                child: SizedBox(
                  width: _size,
                  height: _size,
                  child: Center(
                    // chevron.svg points toward the reading end: flip it.
                    child: Transform.flip(
                      flipX: true,
                      child: SvgPicture.asset(
                        'assets/icons/chevron.svg',
                        width: _iconSize,
                        height: _iconSize,
                        matchTextDirection: true,
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
          ),
        ),
      ),
    );
  }
}

/// Name in brand gradient, then "Breed · age · sex".
class _Header extends StatelessWidget {
  const _Header({required this.pet});

  final AdoptionProfile pet;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsetsDirectional.only(
        top: AppSpacing.lg,
        bottom: AppSpacing.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GradientText(
            pet.name,
            gradient: colors.brandGradient,
            style: textTheme.headlineLarge!,
          ),
          const SizedBox(height: 6),
          Text(
            '${pet.breed ?? speciesLabel(pet.species)} · '
            '${formatAge(pet.ageMonths)} · ${sexLabel(pet.sex)}',
            style: textTheme.bodyLarge!.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _StatTiles extends StatelessWidget {
  const _StatTiles({required this.pet});

  final AdoptionProfile pet;

  @override
  Widget build(BuildContext context) {
    final stats = [
      ('Espèce', speciesLabel(pet.species)),
      ('Âge', formatAge(pet.ageMonths)),
      ('Sexe', sexLabel(pet.sex)),
    ];

    return Row(
      children: [
        for (var i = 0; i < stats.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(child: _StatTile(label: stats[i].$1, value: stats[i].$2)),
        ],
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return _Card(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.md,
      ),
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: AppTextStyles.micro().copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ],
      ),
    );
  }
}

/// Glass card, the same surface as Home's cards.
class _Card extends StatelessWidget {
  const _Card({
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

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);

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

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Eyebrow(title),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _HealthSection extends StatelessWidget {
  const _HealthSection({required this.pet});

  final AdoptionProfile pet;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('Santé', style: textTheme.headlineSmall)),
              const SizedBox(width: AppSpacing.sm),
              Flexible(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.successRing,
                    borderRadius: AppRadius.fullAll,
                  ),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    child: Text(
                      pet.healthStatus,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelMedium!.copyWith(
                        color: colors.success,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (pet.vaccinations.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            const _Eyebrow('Vaccins'),
            const SizedBox(height: AppSpacing.sm),
            for (final v in pet.vaccinations) ...[
              _VaccineRow(vaccination: v),
              const SizedBox(height: AppSpacing.sm),
            ],
          ],
          if (pet.medicalHistory.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            const _Eyebrow('Historique médical'),
            const SizedBox(height: AppSpacing.md),
            _Timeline(entries: pet.medicalHistory),
          ],
        ],
      ),
    );
  }
}

class _VaccineRow extends StatelessWidget {
  const _VaccineRow({required this.vaccination});

  final Vaccination vaccination;

  static const double _badge = 26;
  static const double _checkSize = 15;
  static const double _syringeSize = 14;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.lgAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        child: Row(
          children: [
            Container(
              width: _badge,
              height: _badge,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colors.success,
                shape: BoxShape.circle,
              ),
              child: SvgPicture.asset(
                'assets/icons/check.svg',
                width: _checkSize,
                height: _checkSize,
                colorFilter: ColorFilter.mode(
                  colors.onPrimary,
                  BlendMode.srcIn,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(vaccination.name, style: textTheme.titleMedium),
            ),
            SvgPicture.asset(
              'assets/icons/syringe.svg',
              width: _syringeSize,
              height: _syringeSize,
              colorFilter: ColorFilter.mode(
                colors.textSecondary,
                BlendMode.srcIn,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              formatDate(vaccination.date),
              style: textTheme.labelMedium!.copyWith(
                fontWeight: FontWeight.w400,
                color: colors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dated notes on a line that runs along the reading start.
class _Timeline extends StatelessWidget {
  const _Timeline({required this.entries});

  final List<MedicalEntry> entries;

  static const double _dot = 12;
  static const double _indent = 20;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        border: BorderDirectional(
          start: BorderSide(color: colors.outline, width: 2),
        ),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.only(start: _indent),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < entries.length; i++)
              Padding(
                padding: EdgeInsetsDirectional.only(
                  bottom: i == entries.length - 1 ? 0 : AppSpacing.lg,
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    PositionedDirectional(
                      start: -(_indent + _dot / 2 + 1),
                      top: 3,
                      child: Container(
                        width: _dot,
                        height: _dot,
                        decoration: BoxDecoration(
                          color: colors.link,
                          shape: BoxShape.circle,
                          border: Border.all(color: colors.surface, width: 3),
                        ),
                      ),
                    ),
                    SizedBox(
                      width: double.infinity,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            formatDate(entries[i].date),
                            style: textTheme.labelMedium!.copyWith(
                              fontWeight: FontWeight.w400,
                              color: colors.textSecondary,
                            ),
                          ),
                          Text(entries[i].note, style: textTheme.bodyLarge),
                        ],
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

class _CharacterSection extends StatelessWidget {
  const _CharacterSection({required this.pet});

  final AdoptionProfile pet;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (pet.behavior.isNotEmpty) ...[
            const _Eyebrow('Caractère'),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final b in pet.behavior)
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.primaryContainer,
                      borderRadius: AppRadius.fullAll,
                    ),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      child: Text(
                        b,
                        style: textTheme.titleSmall!.copyWith(
                          color: colors.link,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
          if (pet.behavior.isNotEmpty && pet.careNeeds.isNotEmpty)
            const SizedBox(height: AppSpacing.lg),
          if (pet.careNeeds.isNotEmpty) ...[
            const _Eyebrow('Besoins'),
            const SizedBox(height: AppSpacing.sm),
            for (final c in pet.careNeeds)
              Padding(
                padding: const EdgeInsetsDirectional.only(bottom: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '•',
                      style: textTheme.bodyLarge!.copyWith(color: colors.link),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: Text(c, style: textTheme.bodyLarge)),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// "Publié par" shelter or person, with the city.
class _PublisherCard extends StatelessWidget {
  const _PublisherCard({required this.pet});

  final AdoptionProfile pet;

  static const double _avatar = 48;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final address = pet.location.address;

    return _Card(
      child: Row(
        children: [
          Container(
            width: _avatar,
            height: _avatar,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Text(
              pet.shelter.name.characters.first.toUpperCase(),
              style: textTheme.titleLarge!.copyWith(color: colors.link),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Publié par',
                  style: textTheme.labelMedium!.copyWith(
                    fontWeight: FontWeight.w400,
                    color: colors.textSecondary,
                  ),
                ),
                Text(
                  pet.shelter.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleLarge,
                ),
                if (address != null)
                  Text(
                    address,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.bodyMedium!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Not found / load error, with one way out.
class _Message extends StatelessWidget {
  const _Message({
    required this.title,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: AppSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Illustration('assets/illustrations/heart.png', size: 70),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: textTheme.headlineMedium,
            ),
            TextButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}
