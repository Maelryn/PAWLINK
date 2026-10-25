import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/fake_service_repository.dart';
import 'data/rating_summary.dart';
import 'data/service_models.dart';
import 'data/service_repository.dart';

/// Id of the signed-in user; auth is not wired yet.
final currentUserIdProvider = Provider<String>((ref) => 'me');

final serviceRepositoryProvider = Provider<ServiceRepository>(
  (ref) =>
      FakeServiceRepository.demo(viewerId: ref.watch(currentUserIdProvider)),
);

final servicesProvider = FutureProvider<List<Service>>(
  (ref) => ref.watch(serviceRepositoryProvider).services(),
);

/// One place for the detail screen; null when it no longer exists.
final serviceProvider = FutureProvider.family<Service?, String>(
  (ref, id) => ref.watch(serviceRepositoryProvider).service(id),
);

final serviceReviewsProvider = FutureProvider.family<List<Review>, String>(
  (ref, id) => ref.watch(serviceRepositoryProvider).reviews(id),
);

/// Average and histogram, once both the place and its reviews are loaded.
final ratingSummaryProvider = Provider.family<RatingSummary?, String>((
  ref,
  id,
) {
  final service = ref.watch(serviceProvider(id)).value;
  final reviews = ref.watch(serviceReviewsProvider(id)).value;
  if (service == null || reviews == null) return null;
  return RatingSummary.of(service, reviews);
});

/// The viewer's latest appointment request for a place, null when none.
final myBookingProvider = FutureProvider.family<Booking?, String>(
  (ref, id) => ref.watch(serviceRepositoryProvider).myBooking(id),
);

/// Write side of the detail: review, request an appointment, cancel it.
/// Each call refreshes what the screen reads back.
class ServiceActions {
  ServiceActions(this._ref);

  final Ref _ref;

  ServiceRepository get _repo => _ref.read(serviceRepositoryProvider);

  Future<void> saveReview({
    required String serviceId,
    required int rating,
    required String text,
  }) async {
    await _repo.saveReview(serviceId: serviceId, rating: rating, text: text);
    _ref.invalidate(serviceReviewsProvider(serviceId));
  }

  Future<void> sendBooking({
    required String serviceId,
    required String date,
    required String time,
    required String animal,
    required String reason,
  }) async {
    await _repo.sendBooking(
      serviceId: serviceId,
      date: date,
      time: time,
      animal: animal,
      reason: reason,
    );
    _ref.invalidate(myBookingProvider(serviceId));
  }

  Future<void> cancelBooking(Booking booking) async {
    await _repo.cancelBooking(booking.id);
    _ref.invalidate(myBookingProvider(booking.serviceId));
  }
}

final serviceActionsProvider = Provider<ServiceActions>(ServiceActions.new);

/// The round chips of the Services tab. Boarding is grouped with training
/// under "Éducation".
enum ServiceFilter {
  all,
  vet,
  shelter,
  transport,
  education,
  store;

  bool matches(Service s) => switch (this) {
    all => true,
    vet => s.type == ServiceType.vet,
    shelter => s.type == ServiceType.shelter,
    transport => s.type == ServiceType.transport,
    education =>
      s.type == ServiceType.training || s.type == ServiceType.boarding,
    store => s.type == ServiceType.store,
  };
}

class ServiceFilterNotifier extends Notifier<ServiceFilter> {
  @override
  ServiceFilter build() => ServiceFilter.all;

  void select(ServiceFilter filter) => state = filter;
}

final serviceFilterProvider =
    NotifierProvider<ServiceFilterNotifier, ServiceFilter>(
      ServiceFilterNotifier.new,
    );

class ServiceQueryNotifier extends Notifier<String> {
  @override
  String build() => '';

  void set(String query) => state = query;
}

final serviceQueryProvider = NotifierProvider<ServiceQueryNotifier, String>(
  ServiceQueryNotifier.new,
);

/// Whether [s] matches the typed text (name, city or tag).
bool serviceMatchesQuery(Service s, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return true;
  return s.name.toLowerCase().contains(q) ||
      s.city.toLowerCase().contains(q) ||
      s.tags.any((t) => t.toLowerCase().contains(q));
}

/// Services after the chip and the search are applied: Pro first (they are
/// featured), then best rated.
final visibleServicesProvider = Provider<AsyncValue<List<Service>>>((ref) {
  final filter = ref.watch(serviceFilterProvider);
  final query = ref.watch(serviceQueryProvider);
  return ref.watch(servicesProvider).whenData((all) {
    final list = [
      for (final s in all)
        if (filter.matches(s) && serviceMatchesQuery(s, query)) s,
    ];
    list.sort((a, b) {
      if (a.pro != b.pro) return a.pro ? -1 : 1;
      return b.rating.compareTo(a.rating);
    });
    return list;
  });
});
