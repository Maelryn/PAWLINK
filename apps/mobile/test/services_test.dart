import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pawlink/core/theme/app_theme.dart';
import 'package:pawlink/features/services/data/fake_service_repository.dart';
import 'package:pawlink/features/services/data/service_models.dart';
import 'package:pawlink/features/services/presentation/services_screen.dart';

Future<void> _pumpServices(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1080, 4800);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(body: ServicesScreen()),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test(
    'demo places cover vets, shelters and shops in several cities',
    () async {
      final all = await const FakeServiceRepository().services();
      expect(all, hasLength(6));
      expect(
        all.map((s) => s.type),
        containsAll([ServiceType.vet, ServiceType.shelter, ServiceType.store]),
      );
      expect(all.map((s) => s.city).toSet().length, greaterThanOrEqualTo(5));
    },
  );

  testWidgets('lists Pro places first with the featured badge', (tester) async {
    await _pumpServices(tester);

    expect(find.text('Mis en avant'), findsNWidgets(3));
    final firstTop = tester.getTopLeft(find.text('Clinique des Oliviers')).dy;
    final lastProTop = tester.getTopLeft(find.text('Animalerie Didouche')).dy;
    final firstFree = tester.getTopLeft(find.text('Refuge Les Pattes')).dy;
    expect(firstTop, lessThan(firstFree));
    expect(lastProTop, lessThan(firstFree));
  });

  testWidgets('a chip narrows the list and the count follows', (tester) async {
    await _pumpServices(tester);

    await tester.tap(find.text('Refuges').first);
    await tester.pumpAndSettle();

    expect(find.text('Refuge Les Pattes'), findsOneWidget);
    expect(find.text('Clinique des Oliviers'), findsNothing);
    expect(find.text('1'), findsOneWidget);
  });

  testWidgets('search matches the city and shows an empty state', (
    tester,
  ) async {
    await _pumpServices(tester);

    await tester.enterText(find.byType(TextField), 'constantine');
    await tester.pumpAndSettle();
    expect(find.text('Cabinet Vétérinaire El Khadra'), findsOneWidget);
    expect(find.text('Refuge Les Pattes'), findsNothing);

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();
    expect(find.text('Aucun service trouvé'), findsOneWidget);
  });
}
