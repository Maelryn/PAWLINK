import 'adoption_models.dart';

abstract interface class AdoptionRepository {
  /// Public listings (approved), newest first. `ownerPhone` is only filled
  /// for listings where the viewer's request was accepted.
  /// API: GET /adoptions
  Future<List<AdoptionProfile>> listings();

  /// API: GET /adoptions/:id
  Future<AdoptionProfile?> listing(String id);

  /// The viewer's live request for this listing (sent, accepted or declined).
  /// A cancelled request counts as none, so the viewer can ask again.
  /// API: GET /adoptions/:id/requests/mine
  Future<AdoptionRequest?> myRequest(String adoptionId);

  /// Sends (or replaces) the viewer's request.
  /// API: POST /adoptions/:id/requests
  Future<AdoptionRequest> sendRequest({
    required String adoptionId,
    required String message,
    required HousingType housing,
    required bool experience,
  });

  /// The adopter withdraws their request, also after it was accepted.
  /// API: POST /adoption-requests/:id/cancel
  Future<void> cancelRequest(String requestId);
}
