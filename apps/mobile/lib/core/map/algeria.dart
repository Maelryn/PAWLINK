import 'package:latlong2/latlong.dart';

/// Where PawLink works. Reports are only accepted from inside Algeria.
abstract final class Algeria {
  /// Bounding box of the country, the same one the web checks (`inAlgeria`).
  /// The backend must check again.
  static bool contains(LatLng point) =>
      point.latitude > 18.9 &&
      point.latitude < 37.2 &&
      point.longitude > -8.7 &&
      point.longitude < 12;

  /// Stand-in position for testers without location (Larbaâ Nath Irathen).
  /// A report made from it is marked "not on site".
  static const LatLng demoPosition = LatLng(36.6455, 4.1979);
  static const String demoAddress = 'Larbaâ Nath Irathen, Tizi Ouzou';
}
