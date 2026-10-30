import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/app_background.dart';
import '../../../shared/widgets/brand_header.dart';
import '../../../shared/widgets/illustration.dart';
import '../../../shared/widgets/location_pill.dart';
import '../data/adoption_models.dart';
import '../providers.dart';
import 'widgets/adopt_filter_chips.dart';
import 'widgets/pet_card.dart';

/// Adopter tab: title, filter chips and the two-column grid of listings.
class AdoptScreen extends ConsumerWidget {
  const AdoptScreen({super.key});

  /// Clearance for the floating bottom nav (Make: 104px).
  static const double _navClearance = 104;
  static const double _columnGap = 10;
  static const double _rowGap = 18;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final filter = ref.watch(adoptFilterProvider);
    final favorites = ref.watch(favoritesProvider);
    final listings = ref.watch(visibleListingsProvider);

    return AppBackground(
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: AppSpacing.screenPadding,
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Settings has no destination yet.
                  BrandHeader(onSettings: () {}),
                  const _TitleRow(),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: AdoptFilterChips(
              selected: filter,
              onSelected: ref.read(adoptFilterProvider.notifier).select,
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 21)),
          ...listings.when(
            data:
                (pets) =>
                    pets.isEmpty
                        ? [
                          SliverToBoxAdapter(
                            child: _EmptyState(filter: filter),
                          ),
                        ]
                        : [
                          SliverPadding(
                            padding: AppSpacing.screenPadding,
                            sliver: _PetGrid(
                              pets: pets,
                              favorites: favorites,
                              onToggleFavorite:
                                  ref.read(favoritesProvider.notifier).toggle,
                            ),
                          ),
                        ],
            loading:
                () => const [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsetsDirectional.symmetric(vertical: 70),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ),
                ],
            error:
                (error, stack) => [
                  SliverToBoxAdapter(
                    child: _LoadError(
                      onRetry: () => ref.invalidate(adoptionListingsProvider),
                    ),
                  ),
                ],
          ),
          SliverToBoxAdapter(
            child: SizedBox(height: _navClearance + bottomInset),
          ),
        ],
      ),
    );
  }
}

class _TitleRow extends StatelessWidget {
  const _TitleRow();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsetsDirectional.only(top: 16, bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Trouvez un ami', style: textTheme.headlineLarge),
                const SizedBox(height: 7),
                Text(
                  'Sauvés, soignés et prêts pour un foyer.',
                  style: textTheme.bodyMedium!.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          const LocationPill(),
        ],
      ),
    );
  }
}

/// Rows of two cards, built lazily; a row is as tall as its taller card.
class _PetGrid extends StatelessWidget {
  const _PetGrid({
    required this.pets,
    required this.favorites,
    required this.onToggleFavorite,
  });

  final List<AdoptionProfile> pets;
  final Set<String> favorites;
  final void Function(String id) onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final rowCount = (pets.length + 1) ~/ 2;

    Widget card(AdoptionProfile pet) => PetCard(
      key: ValueKey('adopt-pet-${pet.id}'),
      pet: pet,
      isFavorite: favorites.contains(pet.id),
      onToggleFavorite: () => onToggleFavorite(pet.id),
      onTap: () => context.push(AppRoutes.adoptDetail(pet.id)),
    );

    return SliverList.separated(
      itemCount: rowCount,
      separatorBuilder:
          (context, index) => const SizedBox(height: AdoptScreen._rowGap),
      itemBuilder: (context, row) {
        final first = pets[row * 2];
        final second = row * 2 + 1 < pets.length ? pets[row * 2 + 1] : null;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: card(first)),
            const SizedBox(width: AdoptScreen._columnGap),
            Expanded(child: second == null ? const SizedBox() : card(second)),
          ],
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});

  final AdoptFilter filter;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final favorites = filter == AdoptFilter.favorites;

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 25,
        vertical: 70,
      ),
      child: Column(
        children: [
          const Illustration('assets/illustrations/heart.png', size: 70),
          const SizedBox(height: AppSpacing.md),
          Text(
            favorites ? 'Aucun favori' : 'Aucun animal pour le moment',
            textAlign: TextAlign.center,
            style: textTheme.headlineMedium,
          ),
          const SizedBox(height: 4),
          Text(
            favorites
                ? "Touchez le cœur d'un profil pour le retrouver ici."
                : 'De nouveaux profils arrivent bientôt.',
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium!.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(vertical: 70),
      child: Column(
        children: [
          Text(
            'Impossible de charger les animaux.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium!.copyWith(color: colors.textSecondary),
          ),
          TextButton(onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}
