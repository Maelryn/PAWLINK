import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pawlink/core/theme/app_theme.dart';
import 'package:pawlink/features/adopt/data/adoption_models.dart'
    show GeoPoint, UserLite;
import 'package:pawlink/features/services/data/fake_service_repository.dart';
import 'package:pawlink/features/services/data/rating_summary.dart';
import 'package:pawlink/features/services/data/service_models.dart';
import 'package:pawlink/features/services/presentation/service_detail_screen.dart';
import 'package:pawlink/features/services/presentation/services_screen.dart';

Future<void> _pumpDetail(WidgetTester tester, String id) async {
  tester.view.physicalSize = const Size(1080, 6000);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        home: ServiceDetailScreen(id: id),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

String _statusText(WidgetTester tester) =>
    tester.widget<Text>(find.byKey(const ValueKey('booking-status'))).data!;

void main() {
  group('repository booking rules', () {
    test('demo data reaches every booking state', () async {
      final repo = FakeServiceRepository.demo();

      expect(
        (await repo.myBooking('s-oliviers'))!.status,
        BookingStatus.confirmed,
      );
      expect((await repo.myBooking('s-didouche'))!.status, BookingStatus.sent);
      expect(
        (await repo.myBooking('s-ambulance-kabylie'))!.status,
        BookingStatus.declined,
      );
      expect(
        (await repo.myBooking('s-khadra'))!.status,
        BookingStatus.cancelled,
      );
      expect(await repo.myBooking('s-ecole-blida'), isNull);
    });

    test('only Pro places that are not yours take a request', () async {
      final repo = FakeServiceRepository.demo();
      final day = bookingDateKey(DateTime.now().add(const Duration(days: 2)));

      Future<Booking> book(String id) => repo.sendBooking(
        serviceId: id,
        date: day,
        time: '10:00',
        animal: 'Luna',
        reason: '',
      );

      expect(book('s-refuge-pattes'), throwsStateError);
      expect(book('s-pension-amis'), throwsStateError);
      expect((await book('s-ecole-blida')).status, BookingStatus.sent);
    });

    test('a slot in the past is refused', () async {
      final repo = FakeServiceRepository.demo();
      final yesterday = bookingDateKey(
        DateTime.now().subtract(const Duration(days: 1)),
      );
      expect(
        repo.sendBooking(
          serviceId: 's-ecole-blida',
          date: yesterday,
          time: '10:00',
          animal: 'Luna',
          reason: '',
        ),
        throwsArgumentError,
      );
    });

    test(
      'cancel keeps the request as cancelled, and one can ask again',
      () async {
        final repo = FakeServiceRepository.demo();
        final mine = (await repo.myBooking('s-didouche'))!;

        await repo.cancelBooking(mine.id);
        expect(
          (await repo.myBooking('s-didouche'))!.status,
          BookingStatus.cancelled,
        );

        final day = bookingDateKey(DateTime.now().add(const Duration(days: 4)));
        await repo.sendBooking(
          serviceId: 's-didouche',
          date: day,
          time: '11:00',
          animal: 'Pacha',
          reason: 'Croquettes',
        );
        expect(
          (await repo.myBooking('s-didouche'))!.status,
          BookingStatus.sent,
        );
      },
    );

    test('a sent request whose day has passed no longer shows', () async {
      final yesterday = bookingDateKey(
        DateTime.now().subtract(const Duration(days: 1)),
      );
      final repo = FakeServiceRepository(
        bookings: [
          Booking(
            id: 'old',
            serviceId: 's-oliviers',
            from: const UserLite(id: 'me', name: 'Moi'),
            date: yesterday,
            time: '09:00',
            animal: 'Luna',
            reason: '',
            status: BookingStatus.confirmed,
            createdAt: DateTime.now(),
          ),
        ],
      );
      expect(await repo.myBooking('s-oliviers'), isNull);
    });
  });

  group('reviews', () {
    test('a new review replaces the previous one', () async {
      final repo = FakeServiceRepository.demo();
      expect((await repo.reviews('s-oliviers')), hasLength(3));

      await repo.saveReview(serviceId: 's-oliviers', rating: 2, text: ' Bof ');
      final after = await repo.reviews('s-oliviers');
      expect(after, hasLength(3));
      final mine = after.firstWhere((r) => r.author.id == 'me');
      expect(mine.rating, 2);
      expect(mine.text, 'Bof');
      expect(after.first, mine); // newest first
    });

    test('the owner cannot review their own place', () {
      final repo = FakeServiceRepository.demo();
      expect(
        repo.saveReview(serviceId: 's-pension-amis', rating: 5, text: ''),
        throwsStateError,
      );
    });

    test('the average blends the written reviews into the listing', () {
      const service = Service(
        id: 's',
        type: ServiceType.vet,
        name: 'S',
        location: GeoPoint(lat: 0, lng: 0),
        rating: 4,
        reviewCount: 3,
      );
      final reviews = [
        for (final stars in [5, 5, 1])
          Review(
            id: 'r$stars',
            serviceId: 's',
            author: const UserLite(id: 'u', name: 'U'),
            rating: stars,
            text: '',
            createdAt: DateTime(2026),
          ),
      ];
      final summary = RatingSummary.of(service, reviews);

      expect(summary.count, 6);
      expect(summary.rating, 3.8); // (4 * 3 + 5 + 5 + 1) / 6
      // The three historical reviews are counted at the rounded average.
      expect(summary.shares[4], 0.5);
      expect(summary.shares[5], closeTo(2 / 6, 1e-9));
      expect(summary.shares[1], closeTo(1 / 6, 1e-9));
      expect(summary.shares[3], 0);
    });
  });

  group('service detail', () {
    testWidgets('shows the place, how to reach it and its hours', (
      tester,
    ) async {
      await _pumpDetail(tester, 's-oliviers');

      expect(find.text('Clinique des Oliviers'), findsOneWidget);
      expect(find.text('Mis en avant'), findsOneWidget);
      expect(find.text('Appeler'), findsOneWidget);
      expect(find.text('Itinéraire'), findsOneWidget);
      expect(find.text('Urgences'), findsOneWidget);
      expect(
        find.textContaining('08:00 - 19:00 · Ouvert', findRichText: true),
        findsOneWidget,
      );
      // 216 listed reviews + 3 written ones.
      expect(find.text('219 avis'), findsOneWidget);
    });

    testWidgets('an unknown place says so', (tester) async {
      await _pumpDetail(tester, 'unknown');
      expect(find.text("Ce lieu n'existe pas."), findsOneWidget);
    });

    testWidgets('confirmed: shows the slot and can be cancelled', (
      tester,
    ) async {
      await _pumpDetail(tester, 's-oliviers');

      expect(_statusText(tester), 'Confirmé');
      expect(find.byKey(const ValueKey('booking-cancel')), findsOneWidget);
      expect(find.byKey(const ValueKey('booking-cta')), findsNothing);
      expect(find.textContaining('10:30'), findsOneWidget);
      expect(
        find.textContaining('Luna (chienne) · Vaccin annuel'),
        findsOneWidget,
      );
    });

    testWidgets('sent: waits for the place, cancel asks twice', (tester) async {
      await _pumpDetail(tester, 's-didouche');
      expect(_statusText(tester), 'En attente de confirmation');

      await tester.tap(find.byKey(const ValueKey('booking-cancel')));
      await tester.pump();
      expect(find.text("Confirmer l'annulation"), findsOneWidget);
      expect(_statusText(tester), 'En attente de confirmation');

      await tester.tap(find.byKey(const ValueKey('booking-cancel')));
      await tester.pumpAndSettle();
      expect(_statusText(tester), 'Rendez-vous annulé');
      expect(find.byKey(const ValueKey('booking-cancel')), findsNothing);
      expect(find.text('Demander un autre créneau'), findsOneWidget);
    });

    testWidgets('declined: says so and offers another slot', (tester) async {
      await _pumpDetail(tester, 's-ambulance-kabylie');

      expect(_statusText(tester), 'Indisponible, choisissez un autre créneau');
      expect(find.byKey(const ValueKey('booking-cancel')), findsNothing);
      expect(find.text('Demander un autre créneau'), findsOneWidget);
    });

    testWidgets('cancelled: says so and offers another slot', (tester) async {
      await _pumpDetail(tester, 's-khadra');

      expect(_statusText(tester), 'Rendez-vous annulé');
      expect(find.text('Demander un autre créneau'), findsOneWidget);
    });

    testWidgets('no request yet: the first call to action', (tester) async {
      await _pumpDetail(tester, 's-ecole-blida');

      expect(find.byKey(const ValueKey('booking-status')), findsNothing);
      expect(find.text('Demander un rendez-vous'), findsOneWidget);
    });

    testWidgets('a place that is not Pro takes no online request', (
      tester,
    ) async {
      await _pumpDetail(tester, 's-refuge-pattes');

      expect(find.byKey(const ValueKey('booking-only-pro')), findsOneWidget);
      expect(find.byKey(const ValueKey('booking-cta')), findsNothing);
    });

    testWidgets('your own place: no request and no review form', (
      tester,
    ) async {
      await _pumpDetail(tester, 's-pension-amis');

      expect(
        find.text(
          "C'est votre fiche. Les clients réservent et vous notent ici.",
        ),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('booking-cta')), findsNothing);
      expect(find.byKey(const ValueKey('review-send')), findsNothing);
    });

    testWidgets('asking for a slot: date, time, animal, then it is sent', (
      tester,
    ) async {
      await _pumpDetail(tester, 's-ecole-blida');

      await tester.tap(find.byKey(const ValueKey('booking-cta')));
      await tester.pumpAndSettle();
      expect(find.text('Demande de rendez-vous'), findsOneWidget);

      // A disabled PrimaryButton is dimmed.
      bool sendEnabled() =>
          tester
              .widget<Opacity>(
                find.descendant(
                  of: find.byKey(const ValueKey('booking-send')),
                  matching: find.byType(Opacity),
                ),
              )
              .opacity ==
          1;
      expect(sendEnabled(), isFalse);

      await tester.enterText(
        find.byKey(const ValueKey('booking-animal')),
        'Rex, berger allemand',
      );
      await tester.enterText(
        find.byKey(const ValueKey('booking-reason')),
        'Cours de base',
      );
      await tester.tap(find.byKey(const ValueKey('booking-date')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('booking-time')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(sendEnabled(), isTrue);

      await tester.tap(find.byKey(const ValueKey('booking-send')));
      await tester.pumpAndSettle();

      expect(find.text('Demande de rendez-vous'), findsNothing);
      expect(_statusText(tester), 'En attente de confirmation');
      expect(find.textContaining('09:00'), findsOneWidget);
      expect(
        find.textContaining('Rex, berger allemand · Cours de base'),
        findsOneWidget,
      );
      expect(
        find.text("Demande envoyée. L'établissement va confirmer."),
        findsOneWidget,
      );
    });

    testWidgets('reviews: summary, owner reply and the viewer\'s own review', (
      tester,
    ) async {
      await _pumpDetail(tester, 's-oliviers');

      expect(find.byKey(const ValueKey('reviews-average')), findsOneWidget);
      expect(find.text('Karim B.'), findsOneWidget);
      expect(
        find.text('Merci Karim, au plaisir de revoir Pacha en pleine forme !'),
        findsOneWidget,
      );
      expect(find.text("Réponse de l'établissement"), findsOneWidget);
      // The viewer already reviewed this place: the form edits that review.
      expect(find.text('Votre avis'), findsOneWidget);
      expect(find.textContaining('Équipe attentive'), findsWidgets);
    });

    testWidgets('reviews: a new review needs a rating, then replaces nothing', (
      tester,
    ) async {
      await _pumpDetail(tester, 's-didouche');
      expect(find.text('Laisser un avis'), findsOneWidget);
      expect(find.text('Lila H.'), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey('review-text')),
        'Très bon accueil',
      );
      await tester.tap(find.byKey(const ValueKey('review-star-5')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('review-send')));
      await tester.pumpAndSettle();

      expect(find.text('Merci pour votre avis !'), findsOneWidget);
      expect(find.text('Moi'), findsOneWidget);
      expect(find.text('Votre avis'), findsOneWidget);
      expect(find.text('Lila H.'), findsOneWidget);
      // 210 listed + Lila + the new one.
      expect(find.text('212 avis'), findsOneWidget);
    });

    testWidgets('a place with no review says so', (tester) async {
      await _pumpDetail(tester, 's-khadra');
      expect(find.text("Pas encore d'avis"), findsOneWidget);
    });

    testWidgets('tapping a place card in the directory opens its detail', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1080, 4800);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const Scaffold(body: ServicesScreen()),
          ),
          GoRoute(
            path: '/services/:id',
            builder:
                (context, state) =>
                    ServiceDetailScreen(id: state.pathParameters['id']!),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            theme: AppTheme.light(),
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Cabinet Vétérinaire El Khadra'));
      await tester.pumpAndSettle();

      expect(find.byType(ServiceDetailScreen), findsOneWidget);
      expect(find.text('Cabinet Vétérinaire El Khadra'), findsOneWidget);
    });
  });
}
