import 'service_models.dart';

abstract interface class ServiceRepository {
  /// Approved listings. Order is the repository's; the screen sorts Pro first.
  /// API: GET /services
  Future<List<Service>> services();
}
