import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/adoption_models.dart';
import 'data/adoption_repository.dart';
import 'data/fake_adoption_repository.dart';

final adoptionRepositoryProvider = Provider<AdoptionRepository>(
  (ref) => FakeAdoptionRepository.demo(),
);

final adoptionListingsProvider = FutureProvider<List<AdoptionProfile>>(
  (ref) => ref.watch(adoptionRepositoryProvider).listings(),
);

/// One listing for the detail screen; null when it no longer exists.
final adoptionProvider = FutureProvider.family<AdoptionProfile?, String>(
  (ref, id) => ref.watch(adoptionRepositoryProvider).listing(id),
);

/// The viewer's own request for a listing, null when there is none.
final myRequestProvider = FutureProvider.family<AdoptionRequest?, String>(
  (ref, id) => ref.watch(adoptionRepositoryProvider).myRequest(id),
);

/// Send / cancel a request, then refresh what depends on it (the phone and
/// the bar state come back from the repository, not from the screen).
class AdoptionRequestActions {
  AdoptionRequestActions(this._ref);

  final Ref _ref;

  AdoptionRepository get _repo => _ref.read(adoptionRepositoryProvider);

  Future<void> send({
    required String adoptionId,
    required String message,
    required HousingType housing,
    required bool experience,
  }) async {
    await _repo.sendRequest(
      adoptionId: adoptionId,
      message: message,
      housing: housing,
      experience: experience,
    );
    _refresh(adoptionId);
  }

  Future<void> cancel(AdoptionRequest request) async {
    await _repo.cancelRequest(request.id);
    _refresh(request.adoptionId);
  }

  void _refresh(String adoptionId) {
    _ref.invalidate(myRequestProvider(adoptionId));
    _ref.invalidate(adoptionProvider(adoptionId));
    _ref.invalidate(adoptionListingsProvider);
  }
}

final adoptionRequestActionsProvider = Provider<AdoptionRequestActions>(
  AdoptionRequestActions.new,
);

/// Saved listings (the heart), local only for now.
/// API later: PUT/DELETE /me/favorites/:adoptionId
class FavoritesNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  void toggle(String adoptionId) {
    state =
        state.contains(adoptionId)
            ? ({...state}..remove(adoptionId))
            : {...state, adoptionId};
  }
}

final favoritesProvider = NotifierProvider<FavoritesNotifier, Set<String>>(
  FavoritesNotifier.new,
);

/// The round chips of the Adopter tab.
enum AdoptFilter {
  all,
  favorites,
  dog,
  cat,
  livestock;

  bool matches(AdoptionProfile p, Set<String> favoriteIds) => switch (this) {
    all => true,
    favorites => favoriteIds.contains(p.id),
    dog => p.species.group == SpeciesGroup.dog,
    cat => p.species.group == SpeciesGroup.cat,
    livestock => p.species.group == SpeciesGroup.livestock,
  };
}

class AdoptFilterNotifier extends Notifier<AdoptFilter> {
  @override
  AdoptFilter build() => AdoptFilter.all;

  void select(AdoptFilter filter) => state = filter;
}

final adoptFilterProvider = NotifierProvider<AdoptFilterNotifier, AdoptFilter>(
  AdoptFilterNotifier.new,
);

/// Listings after the active chip is applied.
final visibleListingsProvider = Provider<AsyncValue<List<AdoptionProfile>>>((
  ref,
) {
  final filter = ref.watch(adoptFilterProvider);
  final favorites = ref.watch(favoritesProvider);
  return ref
      .watch(adoptionListingsProvider)
      .whenData(
        (all) => [
          for (final p in all)
            if (filter.matches(p, favorites)) p,
        ],
      );
});
