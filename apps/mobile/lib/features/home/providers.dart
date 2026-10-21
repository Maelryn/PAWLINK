import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/home_repository.dart';

final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => const FakeHomeRepository(),
);

final nearbySummaryProvider = FutureProvider<NearbySummary>(
  (ref) => ref.watch(homeRepositoryProvider).nearbySummary(),
);
