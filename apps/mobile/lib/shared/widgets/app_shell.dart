import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_text_styles.dart';

/// Scaffold around the tab branches. The nav floats over the content, so
/// each screen scrolls underneath it.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: AppBottomNav(
        currentIndex: navigationShell.currentIndex,
        // Tapping the active tab returns to its root.
        onSelect:
            (index) => navigationShell.goBranch(
              index,
              initialLocation: index == navigationShell.currentIndex,
            ),
        onCreate: () => context.push(AppRoutes.report),
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.label, this.icon);

  final String label;
  final String icon;
}

const _leadingItems = [
  _NavItem('Accueil', 'assets/icons/home.svg'),
  _NavItem('Adopter', 'assets/icons/heart.svg'),
];

const _trailingItems = [
  _NavItem('Services', 'assets/icons/stethoscope.svg'),
  _NavItem('Carte', 'assets/icons/map.svg'),
];

/// Floating glass bar from the Make file: two tabs, the raised "+" create
/// button, two tabs, in five equal columns. [currentIndex] is the branch
/// index (0-3); the "+" is not a branch.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onSelect,
    required this.onCreate,
  });

  final int currentIndex;
  final ValueChanged<int> onSelect;
  final VoidCallback onCreate;

  // Component geometry from the Make `.bottom-nav` rules.
  static const double _height = 70;
  static const double _maxWidth = 406;
  static const double _sideMargin = 12;
  static const double _bottomMargin = 10;
  static const double _blur = 20;
  static const EdgeInsetsDirectional _padding = EdgeInsetsDirectional.symmetric(
    horizontal: 7,
    vertical: 5,
  );

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(
          _sideMargin,
          0,
          _sideMargin,
          _bottomMargin,
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxWidth),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: AppRadius.xxxlAll,
                boxShadow: AppShadows.floating(brightness),
              ),
              child: ClipRRect(
                borderRadius: AppRadius.xxxlAll,
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: _blur, sigmaY: _blur),
                  child: Container(
                    height: _height,
                    padding: _padding,
                    decoration: BoxDecoration(
                      color: colors.glassMedium,
                      borderRadius: AppRadius.xxxlAll,
                      border: Border.all(color: colors.glassBorder),
                    ),
                    child: Row(
                      children: [
                        for (var i = 0; i < _leadingItems.length; i++)
                          Expanded(
                            child: _NavButton(
                              item: _leadingItems[i],
                              selected: currentIndex == i,
                              onTap: () => onSelect(i),
                            ),
                          ),
                        Expanded(child: _CreateButton(onTap: onCreate)),
                        for (var i = 0; i < _trailingItems.length; i++)
                          Expanded(
                            child: _NavButton(
                              item: _trailingItems[i],
                              selected:
                                  currentIndex == _leadingItems.length + i,
                              onTap: () => onSelect(_leadingItems.length + i),
                            ),
                          ),
                      ],
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

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  static const double _height = 56;
  static const double _iconSize = 22;
  static const double _gap = 3;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = selected ? colors.link : colors.textTertiary;

    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: ExcludeSemantics(
        child: Center(
          child: SizedBox(
            height: _height,
            child: Material(
              color: selected ? colors.primaryContainer : Colors.transparent,
              borderRadius: AppRadius.xlAll,
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onTap,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SvgPicture.asset(
                      item.icon,
                      width: _iconSize,
                      height: _iconSize,
                      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
                    ),
                    const SizedBox(height: _gap),
                    Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.navLabel().copyWith(color: color),
                    ),
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

class _CreateButton extends StatelessWidget {
  const _CreateButton({required this.onTap});

  final VoidCallback onTap;

  static const double _size = 50;
  static const double _iconSize = 27;

  /// The button sits 6px above the bar's centre line.
  static const double _lift = 6;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: 'Signaler',
      child: ExcludeSemantics(
        child: Center(
          child: Transform.translate(
            offset: const Offset(0, -_lift),
            child: GestureDetector(
              key: const ValueKey('nav-create'),
              onTap: onTap,
              child: Container(
                width: _size,
                height: _size,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: colors.createGradient,
                  borderRadius: AppRadius.xlAll,
                  boxShadow: AppShadows.glow(colors.primary),
                ),
                child: SvgPicture.asset(
                  'assets/icons/plus.svg',
                  width: _iconSize,
                  height: _iconSize,
                  colorFilter: ColorFilter.mode(
                    colors.onPrimary,
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
