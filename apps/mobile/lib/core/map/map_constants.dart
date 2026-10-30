import 'package:latlong2/latlong.dart';

/// Map settings shared by every screen that shows a map.
abstract final class MapConstants {
  /// OpenStreetMap raster tiles, light in both themes. The only place the
  /// tile source is named, so it can be swapped for another provider later.
  static const String tileUrl =
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  /// Shown on the map; the "©" is added by the attribution widget.
  static const String attribution = 'OpenStreetMap contributors';

  /// Sent with every tile request (OSM tile usage policy).
  static const String userAgentPackageName = 'dz.pawlink.pawlink';

  /// Where the map opens when the user's position is not available.
  static const LatLng algiers = LatLng(36.7538, 3.0588);

  static const double defaultZoom = 12;
  static const double minZoom = 5;
  static const double maxZoom = 18;

  /// Zoom used when the camera jumps to a single case or to the user.
  static const double focusZoom = 15;
}
