/// Live-map teaser shown at the bottom of Home.
class NearbySummary {
  const NearbySummary({required this.reportCount, required this.updatedAgo});

  final int reportCount;
  final Duration updatedAgo;
}

abstract interface class HomeRepository {
  Future<NearbySummary> nearbySummary();
}

/// Stand-in until the backend exposes nearby reports.
class FakeHomeRepository implements HomeRepository {
  const FakeHomeRepository();

  @override
  Future<NearbySummary> nearbySummary() async =>
      const NearbySummary(reportCount: 3, updatedAgo: Duration(minutes: 4));
}
