import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pawlink/features/adopt/data/adoption_models.dart';
import 'package:pawlink/features/adopt/data/fake_adoption_repository.dart';
import 'package:pawlink/features/adopt/presentation/adopt_screen.dart';
import 'package:pawlink/core/theme/app_theme.dart';

AdoptionRequest _request(String adoptionId, RequestStatus status) =>
    AdoptionRequest(
      id: 'r-$adoptionId',
      adoptionId: adoptionId,
      from: const UserLite(id: 'me', name: 'Moi'),
      message: 'Bonjour',
      housing: HousingType.house,
      experience: true,
      status: status,
      createdAt: DateTime(2026, 10, 1),
    );

Future<void> _pumpAdopt(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1080, 4800);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(body: AdoptScreen()),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('repository rules', () {
    test('owner phone is hidden until the request is accepted', () async {
      final none = await FakeAdoptionRepository().listings();
      expect(none, hasLength(6));
      expect(none.every((p) => p.ownerPhone == null), isTrue);

      final sent = FakeAdoptionRepository(
        requests: [_request('a1', RequestStatus.sent)],
      );
      expect((await sent.listing('a1'))!.ownerPhone, isNull);

      final accepted = FakeAdoptionRepository(
        requests: [_request('a1', RequestStatus.accepted)],
      );
      expect((await accepted.listing('a1'))!.ownerPhone, isNotNull);
      expect((await accepted.listing('a2'))!.ownerPhone, isNull);
    });

    test('a listing holds at most three photos', () {
      AdoptionProfile withPhotos(int n) => AdoptionProfile(
        id: 'x',
        name: 'X',
        species: Species.dog,
        sex: AnimalSex.male,
        ageMonths: 1,
        photos: List.filled(n, 'p.jpg'),
        healthStatus: '',
        story: '',
        shelter: const ShelterRef(id: 's', name: 'S'),
        ownerId: 'u',
        location: const GeoPoint(lat: 0, lng: 0),
        status: AdoptionStatus.approved,
        createdAt: DateTime(2026),
      );
      expect(() => withPhotos(3), returnsNormally);
      expect(() => withPhotos(4), throwsAssertionError);
    });

    test('Bétail groups farm animals only', () {
      expect(Species.sheep.group, SpeciesGroup.livestock);
      expect(Species.rabbit.group, isNull);
      expect(Species.dog.group, SpeciesGroup.dog);
    });
  });

  group('Adopter tab', () {
    testWidgets('lists the six animals and filters by chip', (tester) async {
      await _pumpAdopt(tester);

      expect(find.text('Trouvez un ami'), findsOneWidget);
      expect(find.text('Près de moi'), findsOneWidget);
      for (final name in [
        'Simba',
        'Zitouna',
        'Pacha',
        'Kahwa',
        'Loulou',
        'Sukkar',
      ]) {
        expect(find.text(name), findsOneWidget);
      }
      expect(find.text('3 mois'), findsOneWidget);
      expect(find.text('Jack Russell · Tizi Ouzou'), findsOneWidget);

      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();
      expect(find.text('Zitouna'), findsOneWidget);
      expect(find.text('Simba'), findsNothing);

      await tester.tap(find.text('Bétail'));
      await tester.pumpAndSettle();
      expect(find.text('Aucun animal pour le moment'), findsOneWidget);
    });

    testWidgets('hearts feed the Favoris chip', (tester) async {
      await _pumpAdopt(tester);

      await tester.tap(find.text('Favoris'));
      await tester.pumpAndSettle();
      expect(find.text('Aucun favori'), findsOneWidget);

      await tester.tap(find.text('Tous'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('adopt-favorite-a3')));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Favoris'));
      await tester.pumpAndSettle();
      expect(find.text('Pacha'), findsOneWidget);
      expect(find.text('Simba'), findsNothing);

      await tester.tap(find.byKey(const ValueKey('adopt-favorite-a3')));
      await tester.pumpAndSettle();
      expect(find.text('Aucun favori'), findsOneWidget);
    });
  });
}
