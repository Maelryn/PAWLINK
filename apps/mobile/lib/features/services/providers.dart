import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/fake_service_repository.dart';
import 'data/service_models.dart';
import 'data/service_repository.dart';

final serviceRepositoryProvider = Provider<ServiceRepository>(
  (ref) => const FakeServiceRepository(),
);

final servicesProvider = FutureProvider<List<Service>>(
  (ref) => ref.watch(serviceRepositoryProvider).services(),
);

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
