import 'case_models.dart';

abstract interface class CaseRepository {
  /// Every case, newest first, and again each time one is added or changes,
  /// so a report made elsewhere in the app shows up on the map at once.
  /// API: GET /cases (polling or a socket until the backend pushes)
  Stream<List<Case>> watchCases();

  /// Publishes a new case; the Signaler flow calls it.
  /// API: POST /cases
  Future<Case> addCase(Case newCase);

  /// The viewer offers to help. An open case becomes in progress; offering
  /// twice changes nothing. Fails on a case that is already resolved.
  /// API: POST /cases/:id/helpers
  Future<Case> offerHelp({required String caseId, required HelpType helpType});
}
