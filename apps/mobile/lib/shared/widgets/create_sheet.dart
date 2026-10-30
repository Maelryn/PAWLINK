import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'app_icon.dart';
import 'illustration.dart';
import 'round_close_button.dart';

enum _CreateChoice { report, adopt }

/// The "+" sheet of the Make file: what do you want to do. "Signaler un
/// animal" starts the report flow; the adoption listing is not built yet.
Future<void> showCreateSheet(BuildContext context) async {
  final choice = await showModalBottomSheet<_CreateChoice>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    builder: (context) => const _CreateSheet(),
  );
  if (!context.mounted || choice == null) return;
  switch (choice) {
    case _CreateChoice.report:
      context.push(AppRoutes.report);
    case _CreateChoice.adopt:
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Bientôt disponible')));
  }
}

class _CreateSheet extends StatelessWidget {
  const _CreateSheet();

  static const double _handleWidth = 40;
  static const double _handleHeight = 4;
  static const double _iconTile = 64;
  static const double _iconSize = 47;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sheet,
        borderRadius: AppRadius.sheetTop,
        boxShadow: AppShadows.sheet(Theme.of(context).brightness),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsetsDirectional.fromSTEB(
          AppSpacing.xl,
          13,
          AppSpacing.xl,
          bottomInset > 28 ? bottomInset : 28,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: _handleWidth,
                height: _handleHeight,
                decoration: BoxDecoration(
                  color: colors.outline,
                  borderRadius: AppRadius.fullAll,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: _iconTile,
                  height: _iconTile,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.primaryContainer,
                    borderRadius: AppRadius.xlAll,
                  ),
                  child: const Illustration(
                    'assets/illustrations/camera.png',
                    size: _iconSize,
                    shadowOffsetY: 4,
                    shadowBlur: 6,
                  ),
                ),
                const Spacer(),
                RoundCloseButton(onTap: () => Navigator.of(context).pop()),
              ],
            ),
            const SizedBox(height: 17),
            Text('Que voulez-vous faire ?', style: textTheme.headlineMedium),
            const SizedBox(height: 5),
            Text(
              'Votre signalement aide la communauté à intervenir plus vite.',
              style: textTheme.bodyMedium!.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 18),
            _CreateOption(
              key: const ValueKey('create-report'),
              icon: 'assets/icons/camera.svg',
              iconColor: colors.link,
              tile: BoxDecoration(
                color: colors.primaryContainer,
                borderRadius: AppRadius.lgAll,
              ),
              title: 'Signaler un animal',
              subtitle: 'Blessé, perdu ou en danger',
              onTap: () => Navigator.of(context).pop(_CreateChoice.report),
            ),
            const SizedBox(height: 9),
            _CreateOption(
              key: const ValueKey('create-adopt'),
              icon: 'assets/icons/heart.svg',
              iconColor: colors.favorite,
              tile: BoxDecoration(
                gradient: colors.tone(AppTone.pink),
                borderRadius: AppRadius.lgAll,
              ),
              title: "Proposer à l'adoption",
              subtitle: 'Publier un profil documenté',
              onTap: () => Navigator.of(context).pop(_CreateChoice.adopt),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreateOption extends StatelessWidget {
  const _CreateOption({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.tile,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String icon;
  final Color iconColor;
  final BoxDecoration tile;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  static const double _tileSize = 47;
  static const double _iconSize = 22;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xlAll,
        boxShadow: AppShadows.soft(Theme.of(context).brightness),
      ),
      child: Material(
        color: colors.surface,
        borderRadius: AppRadius.xlAll,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Row(
              children: [
                Container(
                  width: _tileSize,
                  height: _tileSize,
                  alignment: Alignment.center,
                  decoration: tile,
                  child: AppIcon(icon, size: _iconSize, color: iconColor),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: textTheme.titleMedium),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: textTheme.labelMedium!.copyWith(
                          color: colors.textTertiary,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ),
                AppIcon(
                  'assets/icons/chevron.svg',
                  size: 24,
                  color: colors.textTertiary,
                  matchTextDirection: true,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
