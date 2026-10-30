import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/providers.dart' show currentUserIdProvider;
import 'data/case_models.dart';
import 'data/case_repository.dart';
import 'data/fake_case_repository.dart';

final caseRepositoryProvider = Provider<CaseRepository>(
  (ref) => FakeCaseRepository.demo(viewerId: ref.watch(currentUserIdProvider)),
);

/// Every case, live: a case added through the repository (the Signaler flow)
/// or changed (someone offers help) reaches every screen watching this.
final casesProvider = StreamProvider<List<Case>>(
  (ref) => ref.watch(caseRepositoryProvider).watchCases(),
);

/// Write side of the cases. The stream above carries the result back.
class CaseActions {
  CaseActions(this._ref);

  final Ref _ref;

  CaseRepository get _repo => _ref.read(caseRepositoryProvider);

  Future<void> addCase(Case newCase) => _repo.addCase(newCase);

  /// Asks the Carte tab to open [caseId]: centered, with its preview card.
  /// The tab and the search are reset so the case cannot be filtered out.
  void showOnMap(String caseId) {
    _ref.read(mapStatusFilterProvider.notifier).select(MapStatusFilter.all);
    _ref.read(mapQueryProvider.notifier).set('');
    _ref.read(focusCaseIdProvider.notifier).request(caseId);
  }

  /// "Je peux aider": the case moves to in progress. The map has no way to
  /// pick what kind of help, so it follows the triage's first suggestion.
  Future<void> offerHelp(Case target) => _repo.offerHelp(
    caseId: target.id,
    helpType: target.ai?.recommendedHelp.firstOrNull ?? HelpType.transport,
  );
}

final caseActionsProvider = Provider<CaseActions>(CaseActions.new);

/// The status tabs of the map. "Urgent" doubles as the emergency mode: the
/// "Mode urgence" switch is on exactly when only urgent cases are shown.
enum MapStatusFilter {
  all,
  urgent,
  monitoring;

  bool matches(Case c) => switch (this) {
    all => true,
    urgent => c.triage == Triage.urgent,
    monitoring => c.triage == Triage.monitoring,
  };
}

class MapStatusFilterNotifier extends Notifier<MapStatusFilter> {
  @override
  MapStatusFilter build() => MapStatusFilter.all;

  void select(MapStatusFilter filter) => state = filter;
}

final mapStatusFilterProvider =
    NotifierProvider<MapStatusFilterNotifier, MapStatusFilter>(
      MapStatusFilterNotifier.new,
    );

class MapQueryNotifier extends Notifier<String> {
  @override
  String build() => '';

  void set(String query) => state = query;
}

final mapQueryProvider = NotifierProvider<MapQueryNotifier, String>(
  MapQueryNotifier.new,
);

/// Whether [c] matches the typed text (title or place).
bool caseMatchesQuery(Case c, String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return true;
  return c.title.toLowerCase().contains(q) ||
      (c.location.address ?? '').toLowerCase().contains(q);
}

/// Cases on the map after the tab and the search are applied, newest first.
final visibleCasesProvider = Provider<AsyncValue<List<Case>>>((ref) {
  final filter = ref.watch(mapStatusFilterProvider);
  final query = ref.watch(mapQueryProvider);
  return ref.watch(casesProvider).whenData((all) {
    return [
      for (final c in all)
        if (c.isPublic && filter.matches(c) && caseMatchesQuery(c, query)) c,
    ];
  });
});

class SelectedCaseIdNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String? id) => state = id;
}

final selectedCaseIdProvider =
    NotifierProvider<SelectedCaseIdNotifier, String?>(
      SelectedCaseIdNotifier.new,
    );

/// The case the map was asked to show (see [CaseActions.showOnMap]), until the
/// map has moved to it.
class FocusCaseIdNotifier extends Notifier<String?> {
  @override
  String? build() => null;

  void request(String id) => state = id;

  void clear() => state = null;
}

final focusCaseIdProvider = NotifierProvider<FocusCaseIdNotifier, String?>(
  FocusCaseIdNotifier.new,
);

/// The requested case once it is in the visible list. A case just added
/// reaches the list a moment after the request, so the map waits on this
/// rather than on the id.
final focusCaseProvider = Provider<Case?>((ref) {
  final id = ref.watch(focusCaseIdProvider);
  if (id == null) return null;
  final visible = ref.watch(visibleCasesProvider).value ?? const [];
  return visible.where((c) => c.id == id).firstOrNull;
});

/// The case whose preview is open. Read from the live list so the card
/// follows changes (help offered); null once it is filtered out or gone.
final selectedCaseProvider = Provider<Case?>((ref) {
  final id = ref.watch(selectedCaseIdProvider);
  if (id == null) return null;
  final visible = ref.watch(visibleCasesProvider).value ?? const [];
  return visible.where((c) => c.id == id).firstOrNull;
});

/// The line under "Mode urgence": the wilaya with the most urgent cases and
/// how many it has. Null when nothing is urgent.
class EmergencySummary {
  const EmergencySummary({required this.wilaya, required this.urgentCount});

  final String? wilaya;
  final int urgentCount;
}

final emergencySummaryProvider = Provider<EmergencySummary?>((ref) {
  final all = ref.watch(casesProvider).value ?? const [];
  final byWilaya = <String?, int>{};
  for (final c in all) {
    if (c.isPublic && c.triage == Triage.urgent) {
      byWilaya.update(c.wilaya, (n) => n + 1, ifAbsent: () => 1);
    }
  }
  if (byWilaya.isEmpty) return null;
  final top = byWilaya.entries.reduce((a, b) => b.value > a.value ? b : a);
  return EmergencySummary(wilaya: top.key, urgentCount: top.value);
});
