import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/home/presentation/home_screen.dart';
import '../../shared/widgets/app_shell.dart';
import '../../shared/widgets/placeholder_screen.dart';

/// Route paths, so screens never spell them out.
abstract final class AppRoutes {
  static const home = '/';
  static const adopt = '/adopter';
  static const services = '/services';
  static const map = '/carte';
  static const report = '/signaler';
}

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.home,
    routes: [
      // One branch per tab; the indexed stack keeps each tab's state alive.
      // The center "+" is not a branch: it pushes /signaler above the shell.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.adopt,
                builder: (context, state) =>
                    const PlaceholderScreen(title: 'Adopter'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.services,
                builder: (context, state) =>
                    const PlaceholderScreen(title: 'Services'),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.map,
                builder: (context, state) =>
                    const PlaceholderScreen(title: 'Carte'),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.report,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) =>
            const PlaceholderScreen(title: 'Signaler', closable: true),
      ),
    ],
  );
});
