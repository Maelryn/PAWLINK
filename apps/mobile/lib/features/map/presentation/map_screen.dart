import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_marker_cluster/flutter_map_marker_cluster.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/map/map_constants.dart';
import '../../../core/map/user_location.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/widgets/brand_header.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../cases/data/case_models.dart';
import '../../cases/providers.dart';
import '../../services/providers.dart' show currentUserIdProvider;
import 'map_markers.dart';
import 'widgets/case_preview_card.dart';
import 'widgets/map_panel.dart';
import 'widgets/map_pin.dart';

/// Carte tab: OpenStreetMap under a floating header and panel, a pin per case
/// (clustered when close), and a preview card when a pin is tapped.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final _controller = MapController();

  /// The camera follows the user once, when the position first arrives. After
  /// that it only moves when the user asks.
  bool _centeredOnUser = false;

  /// "Signaler ici" and the attribution float this far above the bottom nav.
  /// The shell uses `extendBody`, so the map fills the screen and the body's
  /// bottom padding already equals the nav's full height (bar, its margin and
  /// the safe area): measured 114dp on a 34dp-inset phone. The offset is that
  /// padding plus this gap, nothing more.
  static const double _aboveNav = 12;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _centerOnUser(LatLng position) {
    _centeredOnUser = true;
    _controller.move(position, MapConstants.defaultZoom);
  }

  /// Opens the preview of [item] and brings its pin to the middle of the map,
  /// clear of the panel above and the card below.
  void _select(Case item) {
    ref.read(selectedCaseIdProvider.notifier).select(item.id);
    final zoom = _controller.camera.zoom;
    _controller.move(
      LatLng(item.location.lat, item.location.lng),
      zoom < MapConstants.defaultZoom ? MapConstants.focusZoom : zoom,
    );
  }

  void _deselect() => ref.read(selectedCaseIdProvider.notifier).select(null);

  Future<void> _locate() async {
    final position = await ref.refresh(userLocationProvider.future);
    if (!mounted) return;
    if (position == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Position indisponible. Activez la localisation pour PawLink.',
          ),
        ),
      );
      return;
    }
    _controller.move(position, MapConstants.focusZoom);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final aboveNav = MediaQuery.paddingOf(context).bottom + _aboveNav;
    final user = ref.watch(userLocationProvider).value;

    ref.listen(userLocationProvider, (previous, next) {
      final position = next.value;
      if (position != null && !_centeredOnUser) _centerOnUser(position);
    });

    return Stack(
      fit: StackFit.expand,
      children: [
        FlutterMap(
          mapController: _controller,
          options: MapOptions(
            initialCenter: user ?? MapConstants.algiers,
            initialZoom: MapConstants.defaultZoom,
            minZoom: MapConstants.minZoom,
            maxZoom: MapConstants.maxZoom,
            backgroundColor: colors.surfaceVariant,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
            onMapReady: () {
              // The position may have arrived before the map was ready.
              final position = ref.read(userLocationProvider).value;
              if (position != null && !_centeredOnUser) {
                _centerOnUser(position);
              }
            },
            onTap: (tapPosition, point) => _deselect(),
          ),
          children: [
            TileLayer(
              urlTemplate: MapConstants.tileUrl,
              userAgentPackageName: MapConstants.userAgentPackageName,
              maxNativeZoom: 19,
            ),
            if (user != null)
              MarkerLayer(
                markers: [
                  Marker(
                    point: user,
                    width: _UserDot.size,
                    height: _UserDot.size,
                    child: const _UserDot(),
                  ),
                ],
              ),
            _CaseLayer(onSelect: _select),
            // Required by the OSM and CARTO terms; level with "Signaler ici".
            Padding(
              padding: EdgeInsets.only(bottom: aboveNav),
              child: RichAttributionWidget(
                alignment: AttributionAlignment.bottomLeft,
                showFlutterMapAttribution: false,
                attributions: [TextSourceAttribution(MapConstants.attribution)],
              ),
            ),
          ],
        ),
        _Overlay(
          bottomOffset: aboveNav,
          onCaseTap: _select,
          onLocate: _locate,
          onClose: _deselect,
        ),
      ],
    );
  }
}

/// Pins and clusters. Tapping a cluster zooms in on it; tapping a pin opens
/// its preview.
class _CaseLayer extends ConsumerWidget {
  const _CaseLayer({required this.onSelect});

  final ValueChanged<Case> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final markers = ref.watch(caseMarkersProvider);

    return MarkerClusterLayerWidget(
      options: MarkerClusterLayerOptions(
        markers: markers,
        maxClusterRadius: 60,
        size: ClusterPin.size,
        // The pointed corner of the pin sits on the location, as for a pin.
        alignment: Alignment.topRight,
        padding: const EdgeInsets.all(64),
        maxZoom: MapConstants.maxZoom,
        zoomToBoundsOnClick: true,
        // The screen centers the camera itself (it also clears the card).
        centerMarkerOnClick: false,
        onMarkerTap: (marker) => onSelect((marker as CaseMarker).item),
        builder:
            (context, clustered) =>
                ClusterPin(markers: clustered.cast<CaseMarker>()),
      ),
    );
  }
}

/// Everything floating over the map, in one column: header pill, panel,
/// the buttons, and the preview card under them while a pin is selected. The
/// panel takes only the height left over, so it can never run under the
/// buttons or the card.
class _Overlay extends ConsumerWidget {
  const _Overlay({
    required this.bottomOffset,
    required this.onCaseTap,
    required this.onLocate,
    required this.onClose,
  });

  /// Space kept free at the bottom for the nav.
  final double bottomOffset;
  final ValueChanged<Case> onCaseTap;
  final VoidCallback onLocate;
  final VoidCallback onClose;

  static const double _headerSide = 15;
  static const double _panelSide = 12;
  static const double _pillBlur = 12;
  static const double _rowHeight = 42;
  static const double _pillPadding = 6;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;
    final topInset = MediaQuery.paddingOf(context).top;
    final headerTop = topInset > 10 ? topInset : 10.0;
    final selected = ref.watch(selectedCaseProvider);
    final viewerId = ref.watch(currentUserIdProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: _headerSide,
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Make: a glass pill slightly wider than the header content.
              PositionedDirectional(
                top: headerTop - _pillPadding,
                start: -7,
                end: -7,
                height: _rowHeight + 2 * _pillPadding,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: AppRadius.fullAll,
                    boxShadow: AppShadows.soft(brightness),
                  ),
                  child: ClipRRect(
                    borderRadius: AppRadius.fullAll,
                    child: BackdropFilter(
                      filter: ImageFilter.blur(
                        sigmaX: _pillBlur,
                        sigmaY: _pillBlur,
                      ),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.glass,
                          borderRadius: AppRadius.fullAll,
                          border: Border.all(color: colors.glassBorder),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              // Settings has no destination yet.
              BrandHeader(onSettings: () {}),
            ],
          ),
        ),
        // The space between the header and the bottom row: the panel, then
        // the locate button under it. The panel takes what is left after the
        // button; the rest is the map.
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Flexible(
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    _panelSide,
                    AppSpacing.xs,
                    _panelSide,
                    0,
                  ),
                  child: MapPanel(onCaseTap: onCaseTap),
                ),
              ),
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  _panelSide,
                  AppSpacing.md,
                  _panelSide,
                  0,
                ),
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: _LocateButton(onTap: onLocate),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            18,
            AppSpacing.sm,
            18,
            0,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              PrimaryButton(
                key: const ValueKey('map-report'),
                label: 'Signaler ici',
                icon: 'assets/icons/camera.svg',
                onPressed: () => context.push(AppRoutes.report),
              ),
            ],
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.ease,
          alignment: Alignment.bottomCenter,
          child:
              selected == null
                  ? const SizedBox(width: double.infinity)
                  : Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      12,
                      10,
                      12,
                      0,
                    ),
                    child: CasePreviewCard(
                      key: ValueKey('preview-${selected.id}'),
                      item: selected,
                      viewerId: viewerId,
                      onHelp:
                          () =>
                              ref.read(caseActionsProvider).offerHelp(selected),
                      onClose: onClose,
                    ),
                  ),
        ),
        SizedBox(height: bottomOffset),
      ],
    );
  }
}

/// Round glass button that recenters the map on the user.
class _LocateButton extends StatelessWidget {
  const _LocateButton({required this.onTap});

  final VoidCallback onTap;

  static const double _size = 52;
  static const double _iconSize = 22;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;

    return Semantics(
      button: true,
      label: 'Ma position',
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: AppShadows.floating(brightness),
          ),
          child: Material(
            color: colors.glassStrong,
            shape: CircleBorder(side: BorderSide(color: colors.glassBorder)),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: const ValueKey('map-locate'),
              onTap: onTap,
              child: SizedBox(
                width: _size,
                height: _size,
                child: Center(
                  child: SvgPicture.asset(
                    'assets/icons/locate-fixed.svg',
                    width: _iconSize,
                    height: _iconSize,
                    colorFilter: ColorFilter.mode(colors.link, BlendMode.srcIn),
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

/// Where the user is: a blue dot with a white ring.
class _UserDot extends StatelessWidget {
  const _UserDot();

  static const double size = 22;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Container(
      decoration: BoxDecoration(
        color: colors.link,
        shape: BoxShape.circle,
        border: Border.all(color: colors.surface, width: 3),
        boxShadow: [
          BoxShadow(color: colors.link.withValues(alpha: 0.35), blurRadius: 8),
        ],
      ),
    );
  }
}
