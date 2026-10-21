import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/app_background.dart';
import '../providers.dart';
import 'widgets/action_card.dart';
import 'widgets/home_header.dart';
import 'widgets/home_hero.dart';
import 'widgets/nearby_card.dart';

/// Accueil: header, hero, "Agir maintenant" cards and the live-map teaser.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  /// Clearance for the floating bottom nav (Make: 104px).
  static const double _navClearance = 104;
  static const double _gridGap = 10;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final nearby = ref.watch(nearbySummaryProvider);

    void report() => context.push(AppRoutes.report);

    final actions = [
      ActionCard(
        key: const ValueKey('home-action-report'),
        title: 'Signaler',
        subtitle: 'Un animal en détresse',
        illustration: 'assets/illustrations/camera.png',
        tone: AppTone.blue,
        onTap: report,
      ),
      ActionCard(
        key: const ValueKey('home-action-adopt'),
        title: 'Adopter',
        subtitle: 'Trouvez votre compagnon',
        illustration: 'assets/illustrations/heart.png',
        tone: AppTone.pink,
        onTap: () => context.go(AppRoutes.adopt),
      ),
      ActionCard(
        key: const ValueKey('home-action-services'),
        title: 'Services',
        subtitle: 'Soins et aide près de vous',
        illustration: 'assets/illustrations/stethoscope.png',
        tone: AppTone.mint,
        onTap: () => context.go(AppRoutes.services),
      ),
      ActionCard(
        key: const ValueKey('home-action-emergency'),
        title: 'Urgence',
        subtitle: 'Voir la carte en direct',
        illustration: 'assets/illustrations/fire.png',
        tone: AppTone.peach,
        onTap: () => context.go(AppRoutes.map),
      ),
    ];

    return AppBackground(
      child: SingleChildScrollView(
        padding: AppSpacing.screenPadding.add(
          EdgeInsetsDirectional.only(bottom: _navClearance + bottomInset),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Settings has no destination yet.
            HomeHeader(onSettings: () {}),
            HomeHero(onReport: report),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Agir maintenant'.toUpperCase(),
              style: textTheme.labelMedium!.copyWith(color: colors.link),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('Que voulez-vous faire ?', style: textTheme.headlineSmall),
            const SizedBox(height: 14),
            for (var i = 0; i < actions.length; i += 2) ...[
              if (i > 0) const SizedBox(height: _gridGap),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: actions[i]),
                    const SizedBox(width: _gridGap),
                    Expanded(child: actions[i + 1]),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            nearby.maybeWhen(
              data: (summary) => NearbyCard(
                summary: summary,
                onTap: () => context.go(AppRoutes.map),
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}
