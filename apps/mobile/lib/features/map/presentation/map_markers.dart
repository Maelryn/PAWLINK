import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../cases/providers.dart';
import 'widgets/map_pin.dart';

/// One marker per visible case. A provider, not built in the screen: the
/// cluster layer re-clusters whenever it receives a new list, so the list
/// must only change when the visible cases do.
final caseMarkersProvider = Provider<List<CaseMarker>>((ref) {
  final cases = ref.watch(visibleCasesProvider).value ?? const [];
  return [for (final c in cases) CaseMarker(c)];
});
