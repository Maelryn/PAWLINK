import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../cases/data/case_models.dart';
import '../../../cases/providers.dart';
import '../case_format.dart';
import 'case_photo.dart';

/// A marker that remembers its case, so a tap and the cluster builder can
/// read it back.
class CaseMarker extends Marker {
  CaseMarker(this.item)
    : super(
        key: ValueKey('pin-${item.id}'),
        point: LatLng(item.location.lat, item.location.lng),
        width: MapPin.size,
        height: MapPin.size,
        // The pointed corner (bottom-start) sits on the location.
        alignment: Alignment.topRight,
        child: CasePin(item: item),
      );

  final Case item;
}

/// The Make pin: a white rounded square with the photo inside, a border in
/// the triage color and a pointed bottom-start corner, tilted a little.
class MapPin extends StatelessWidget {
  const MapPin({super.key, required this.photo, required this.color});

  final String? photo;
  final Color color;

  static const double size = 54;
  static const double _border = 4;
  static const double _inset = 4;
  static const double _tilt = -6 * math.pi / 180;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Transform.rotate(
      angle: _tilt,
      child: Container(
        width: size,
        height: size,
        padding: const EdgeInsets.all(_inset),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border.all(color: color, width: _border),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(18),
            bottomRight: Radius.circular(18),
            bottomLeft: Radius.circular(4),
          ),
          boxShadow: [
            BoxShadow(
              color: colors.textPrimary.withValues(alpha: 0.2),
              blurRadius: 14,
              offset: const Offset(0, 7),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: CasePhoto(src: photo),
        ),
      ),
    );
  }
}

/// The pin of one case; grows while its preview is open. It watches the
/// selection itself, so selecting never rebuilds the marker list (which would
/// re-cluster the map).
class CasePin extends ConsumerWidget {
  const CasePin({super.key, required this.item});

  final Case item;

  static const double _selectedScale = 1.18;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(
      selectedCaseIdProvider.select((id) => id == item.id),
    );

    return Semantics(
      button: true,
      label: '${triageLabel(item.triage)} : ${item.title}',
      child: ExcludeSemantics(
        child: AnimatedScale(
          scale: selected ? _selectedScale : 1,
          alignment: Alignment.bottomLeft,
          duration: const Duration(milliseconds: 150),
          child: MapPin(
            photo: item.photos.firstOrNull,
            color: triageColor(context.colors, item.triage),
          ),
        ),
      ),
    );
  }
}

/// Several cases close together: the pin of the most urgent one with a count
/// badge on its top-end corner (Make: red circle, 25px, "8").
class ClusterPin extends StatelessWidget {
  const ClusterPin({super.key, required this.markers});

  final List<CaseMarker> markers;

  /// Room for the pin plus the badge hanging off its corner.
  static const Size size = Size(70, 70);
  static const double _badge = 25;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final cases = [for (final m in markers) m.item];
    final top = mostUrgent(cases);
    final color = triageColor(colors, top);
    final lead = cases.firstWhere((c) => c.triage == top);

    return Semantics(
      button: true,
      label: '${cases.length} signalements. Toucher pour zoomer.',
      child: ExcludeSemantics(
        child: SizedBox.fromSize(
          size: size,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              PositionedDirectional(
                start: 0,
                bottom: 0,
                child: MapPin(photo: lead.photos.firstOrNull, color: color),
              ),
              PositionedDirectional(
                top: 0,
                end: 0,
                child: Container(
                  width: _badge,
                  height: _badge,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    '${cases.length}',
                    style: Theme.of(context).textTheme.labelSmall!.copyWith(
                      fontWeight: FontWeight.w800,
                      color: colors.onPrimary,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
