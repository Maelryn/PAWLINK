import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pawlink/core/theme/app_theme.dart';
import 'package:pawlink/features/adopt/data/adoption_models.dart';
import 'package:pawlink/features/adopt/data/fake_adoption_repository.dart';
import 'package:pawlink/features/adopt/presentation/adopt_detail_screen.dart';
import 'package:pawlink/main.dart';
import 'package:pawlink/shared/widgets/primary_button.dart';

const _ownerPhone = '+213 555 00 00 01';

Future<void> _pumpDetail(WidgetTester tester, String id) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        home: AdoptDetailScreen(id: id),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('repository request rules', () {
    test('demo data reaches every bar state', () async {
      final repo = FakeAdoptionRepository.demo();

      final accepted = (await repo.listing('a5'))!;
      expect((await repo.myRequest('a5'))!.status, RequestStatus.accepted);
      expect(accepted.ownerPhone, _ownerPhone);

      expect((await repo.myRequest('a3'))!.status, RequestStatus.sent);
      expect((await repo.listing('a3'))!.ownerPhone, isNull);

      final held = (await repo.listing('a4'))!;
      expect(await repo.myRequest('a4'), isNull);
      expect(held.reserved, isTrue);
      expect(held.ownerPhone, isNull);

      final open = (await repo.listing('a1'))!;
      expect(open.reserved, isFalse);
      expect(await repo.myRequest('a1'), isNull);
    });

    test('send, then cancel, lets the viewer ask again', () async {
      final repo = FakeAdoptionRepository();
      await repo.sendRequest(
        adoptionId: 'a1',
        message: 'Je cherche un compagnon.',
        housing: HousingType.farm,
        experience: false,
      );
      final mine = (await repo.myRequest('a1'))!;
      expect(mine.status, RequestStatus.sent);
      expect(mine.housing, HousingType.farm);
      expect((await repo.listing('a1'))!.ownerPhone, isNull);

      await repo.cancelRequest(mine.id);
      expect(await repo.myRequest('a1'), isNull);
    });

    test('an animal on hold takes no new request', () async {
      final repo = FakeAdoptionRepository.demo();
      expect(
        () => repo.sendRequest(
          adoptionId: 'a4',
          message: 'Je cherche un compagnon.',
          housing: HousingType.house,
          experience: true,
        ),
        throwsStateError,
      );
    });
  });

  group('adoption detail', () {
    testWidgets('shows the profile and a swipeable gallery of 3 photos', (
      tester,
    ) async {
      await _pumpDetail(tester, 'a1');

      expect(find.text('Simba'), findsNWidgets(2)); // title + action bar
      expect(find.text('Croisé · 4 mois · Mâle'), findsOneWidget);
      expect(find.text('SON HISTOIRE'), findsOneWidget);
      for (var i = 0; i < 3; i++) {
        expect(find.byKey(ValueKey('adopt-dot-$i')), findsOneWidget);
      }
      // The first dot is the long (active) one, then the swipe moves it.
      expect(
        tester.getSize(find.byKey(const ValueKey('adopt-dot-0'))).width,
        greaterThan(
          tester.getSize(find.byKey(const ValueKey('adopt-dot-1'))).width,
        ),
      );
      await tester.drag(
        find.byKey(const ValueKey('adopt-gallery')),
        const Offset(-300, 0),
      );
      await tester.pumpAndSettle();
      expect(
        tester.getSize(find.byKey(const ValueKey('adopt-dot-1'))).width,
        greaterThan(
          tester.getSize(find.byKey(const ValueKey('adopt-dot-0'))).width,
        ),
      );
    });

    testWidgets('a single photo shows no dots', (tester) async {
      await _pumpDetail(tester, 'a3');
      expect(find.byKey(const ValueKey('adopt-dot-0')), findsNothing);
    });

    testWidgets(
      'asking: the form needs 10 characters, the phone stays hidden',
      (tester) async {
        await _pumpDetail(tester, 'a1');
        expect(find.text(_ownerPhone), findsNothing);

        await tester.tap(find.byKey(const ValueKey('adopt-cta')));
        await tester.pumpAndSettle();
        expect(find.text("Demande d'adoption"), findsOneWidget);
        expect(find.text('Appartement'), findsOneWidget);
        expect(find.text('Maison avec jardin'), findsOneWidget);
        expect(find.text('Ferme'), findsOneWidget);
        expect(find.text("J'ai déjà eu des animaux"), findsOneWidget);

        PrimaryButton send() =>
            tester.widget(find.byKey(const ValueKey('adopt-send')));
        expect(send().onPressed, isNull);

        await tester.enterText(
          find.byKey(const ValueKey('adopt-message')),
          'Salut',
        );
        await tester.pump();
        expect(send().onPressed, isNull);

        await tester.tap(find.byKey(const ValueKey('adopt-housing-farm')));
        await tester.enterText(
          find.byKey(const ValueKey('adopt-message')),
          "J'ai un jardin et du temps.",
        );
        await tester.pump();
        expect(send().onPressed, isNotNull);

        await tester.tap(find.byKey(const ValueKey('adopt-send')));
        await tester.pumpAndSettle();

        expect(find.text("Demande d'adoption"), findsNothing);
        expect(find.text('En attente du propriétaire'), findsOneWidget);
        expect(find.text(_ownerPhone), findsNothing);
        expect(find.byKey(const ValueKey('adopt-cta')), findsNothing);
        expect(find.textContaining('Demande envoyée'), findsOneWidget);
      },
    );

    testWidgets('accepted request reveals the phone; cancel needs two taps', (
      tester,
    ) async {
      await _pumpDetail(tester, 'a5');

      expect(find.text('Acceptée'), findsOneWidget);
      expect(find.text(_ownerPhone), findsOneWidget);
      expect(find.byKey(const ValueKey('adopt-call')), findsOneWidget);
      expect(find.byKey(const ValueKey('adopt-whatsapp')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('adopt-cancel')));
      await tester.pump();
      expect(find.text(_ownerPhone), findsOneWidget);
      expect(find.text("Confirmer l'annulation"), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('adopt-cancel')));
      await tester.pumpAndSettle();
      expect(find.text(_ownerPhone), findsNothing);
      expect(find.byKey(const ValueKey('adopt-cta')), findsOneWidget);
    });

    testWidgets('a sent request waits without a phone', (tester) async {
      await _pumpDetail(tester, 'a3');
      expect(find.text('En attente du propriétaire'), findsOneWidget);
      expect(find.text(_ownerPhone), findsNothing);
      expect(find.byKey(const ValueKey('adopt-call')), findsNothing);
    });

    testWidgets('someone else accepted: on hold, nothing to tap', (
      tester,
    ) async {
      await _pumpDetail(tester, 'a4');
      expect(find.text('Adoption en cours'), findsOneWidget);
      expect(find.byKey(const ValueKey('adopt-cta')), findsNothing);
      expect(find.text(_ownerPhone), findsNothing);
    });

    testWidgets('unknown id says the animal is gone', (tester) async {
      await _pumpDetail(tester, 'nope');
      expect(find.text("Cet animal n'est plus disponible."), findsOneWidget);
    });
  });

  testWidgets('tapping a pet card opens its detail, back returns', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 4800);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const ProviderScope(child: PawLinkApp()));
    await tester.pumpAndSettle();

    await tester.tap(
      find.text('Adopter').last,
    ); // the nav tab, after Home's card
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('adopt-pet-a2')));
    await tester.pumpAndSettle();

    expect(find.text('Zitouna'), findsWidgets);
    expect(find.text('SON HISTOIRE'), findsOneWidget);
    expect(find.byKey(const ValueKey('adopt-cta')), findsOneWidget);
    // Above the shell: no tab bar.
    expect(find.text('Accueil'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('adopt-back')));
    await tester.pumpAndSettle();
    expect(find.text('Trouvez un ami'), findsOneWidget);
  });
}
