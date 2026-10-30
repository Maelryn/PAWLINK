import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pawlink/features/map/presentation/widgets/case_preview_card.dart';
import 'package:latlong2/latlong.dart';
import 'package:pawlink/features/report/providers.dart';
import 'package:pawlink/main.dart';
import 'package:pawlink/shared/widgets/primary_button.dart';

Future<void> tapKey(WidgetTester tester, String key) async {
  final finder = find.byKey(ValueKey(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Widget _app(LatLng? position) => ProviderScope(
  overrides: [devicePositionProvider.overrideWithValue(() async => position)],
  child: const PawLinkApp(),
);

void main() {
  testWidgets(
    'report flow: demo position, quick questions, then the new case on the map',
    (tester) async {
      await tester.pumpWidget(_app(null));
      await tester.pumpAndSettle();

      await tapKey(tester, 'nav-create');
      await tapKey(tester, 'create-report');
      expect(find.text('Ajoutez une photo'), findsOneWidget);

      // Photo is optional.
      expect(find.text('Continuer sans photo'), findsOneWidget);
      await tapKey(tester, 'report-continue');

      // No location in tests: the demo position is offered, and marked.
      expect(find.text('Où se trouve l\'animal ?'), findsOneWidget);
      await tapKey(tester, 'report-demo-position');
      expect(find.text('Position de démo'), findsOneWidget);
      await tapKey(tester, 'report-continue');

      // The step stays locked until a species is picked.
      PrimaryButton continueButton() => tester.widget<PrimaryButton>(
        find.byKey(const ValueKey('report-continue')),
      );
      expect(continueButton().onPressed, isNull);
      await tapKey(tester, 'report-species-dog');
      expect(continueButton().onPressed, isNotNull);
      await tapKey(tester, 'report-continue');

      await tapKey(tester, 'report-tag-injured');
      await tapKey(tester, 'report-continue');

      // "Blessé" makes the triage ask two questions.
      expect(find.textContaining('QUESTION 1 SUR 2'), findsOneWidget);
      await tapKey(tester, 'report-answer-no');
      expect(find.textContaining('QUESTION 2 SUR 2'), findsOneWidget);
      await tapKey(tester, 'report-answer-unsure');

      // "Not conscious" forces urgent; the vet advice is there.
      expect(find.text('Urgent'), findsOneWidget);
      expect(
        find.text('Contactez un vétérinaire dès que possible.'),
        findsOneWidget,
      );

      await tapKey(tester, 'report-view-on-map');
      expect(find.byType(CasePreviewCard), findsOneWidget);
      expect(find.textContaining('Chien — Blessé'), findsWidgets);
    },
  );

  testWidgets(
    'a position outside Algeria is refused, the demo one is offered',
    (tester) async {
      await tester.pumpWidget(_app(const LatLng(48.8566, 2.3522)));
      await tester.pumpAndSettle();

      await tapKey(tester, 'nav-create');
      await tapKey(tester, 'create-report');
      await tapKey(tester, 'report-continue');

      expect(
        find.text('PawLink est disponible uniquement en Algérie'),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('report-demo-position')),
        findsOneWidget,
      );
      final next = tester.widget<PrimaryButton>(
        find.byKey(const ValueKey('report-continue')),
      );
      expect(next.onPressed, isNull);
    },
  );

  testWidgets('a real position inside Algeria is used as is', (tester) async {
    await tester.pumpWidget(_app(const LatLng(36.7538, 3.0588)));
    await tester.pumpAndSettle();

    await tapKey(tester, 'nav-create');
    await tapKey(tester, 'create-report');
    await tapKey(tester, 'report-continue');

    expect(find.text('Position trouvée'), findsOneWidget);
    expect(find.text('Position de démo'), findsNothing);
    final next = tester.widget<PrimaryButton>(
      find.byKey(const ValueKey('report-continue')),
    );
    expect(next.onPressed, isNotNull);
  });
}
