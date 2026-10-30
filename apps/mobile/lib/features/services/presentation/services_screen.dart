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
import '../providers.dart';
import 'widgets/service_card.dart';
import 'widgets/service_filter_chips.dart';
import 'widgets/service_search_field.dart';

/// Services tab: title, search, filter chips and the list of places.
class ServicesScreen extends ConsumerWidget {
  const ServicesScreen({super.key});

  /// Clearance for the floating bottom nav (Make: 104px).
  static const double _navClearance = 104;
  static const double _rowGap = 11;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final filter = ref.watch(serviceFilterProvider);
    final services = ref.watch(visibleServicesProvider);

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
                  ServiceSearchField(
                    onChanged: ref.read(serviceQueryProvider.notifier).set,
                  ),
                  const SizedBox(height: 15),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: ServiceFilterChips(
              selected: filter,
              onSelected: ref.read(serviceFilterProvider.notifier).select,
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 18)),
          SliverPadding(
            padding: AppSpacing.screenPadding,
            sliver: SliverToBoxAdapter(
              child: _ListHeading(count: services.value?.length),
            ),
          ),
          ...services.when(
            data:
                (list) =>
                    list.isEmpty
                        ? [const SliverToBoxAdapter(child: _EmptyState())]
                        : [
                          SliverPadding(
                            padding: AppSpacing.screenPadding,
                            sliver: SliverList.separated(
                              itemCount: list.length,
                              separatorBuilder:
                                  (context, index) =>
                                      const SizedBox(height: _rowGap),
                              itemBuilder:
                                  (context, index) => ServiceCard(
                                    key: ValueKey('service-${list[index].id}'),
                                    service: list[index],
                                    onTap:
                                        () => context.push(
                                          AppRoutes.serviceDetail(
                                            list[index].id,
                                          ),
                                        ),
                                  ),
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
                      onRetry: () => ref.invalidate(servicesProvider),
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
      padding: const EdgeInsetsDirectional.only(top: 16, bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Services', style: textTheme.headlineLarge),
                const SizedBox(height: 7),
                Text(
                  "De l'aide qualifiée près de vous.",
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

/// "Près de vous" with the number of places shown.
class _ListHeading extends StatelessWidget {
  const _ListHeading({required this.count});

  final int? count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Près de vous', style: textTheme.headlineSmall),
          if (count != null)
            Text(
              '$count',
              style: textTheme.bodySmall!.copyWith(color: colors.textTertiary),
            ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 25,
        vertical: 70,
      ),
      child: Column(
        children: [
          const Illustration('assets/illustrations/stethoscope.png', size: 70),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Aucun service trouvé',
            textAlign: TextAlign.center,
            style: textTheme.headlineMedium,
          ),
          const SizedBox(height: 4),
          Text(
            'Essayez une autre recherche ou une autre catégorie.',
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
            'Impossible de charger les services.',
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
