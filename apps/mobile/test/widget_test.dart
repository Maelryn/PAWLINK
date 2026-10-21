import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pawlink/main.dart';
void main() {
  testWidgets('shell shows tabs and "+" pushes Signaler above it',
      (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: PawLinkApp()));
    await tester.pumpAndSettle();

    expect(find.text('Accueil'), findsWidgets);

    await tester.tap(find.text('Carte').last);
    await tester.pumpAndSettle();
    expect(find.text('Carte'), findsWidgets);

    await tester.tap(find.byKey(const ValueKey('nav-create')));
    await tester.pumpAndSettle();
    expect(find.text('Signaler'), findsWidgets);
    expect(find.byType(CloseButton), findsOneWidget);
  });

  testWidgets('home shows hero and cards that navigate',
      (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: PawLinkApp()));
    await tester.pumpAndSettle();

    expect(find.text("Vous l'avez vu."), findsOneWidget);
    expect(find.text('Que voulez-vous faire ?'), findsOneWidget);
    expect(find.text('3 signalements près de vous'), findsOneWidget);

    final adopt = find.byKey(const ValueKey('home-action-adopt'));
    await tester.ensureVisible(adopt);
    await tester.tap(adopt);
    await tester.pumpAndSettle();
    expect(find.text("Vous l'avez vu."), findsNothing);

    await tester.tap(find.text('Accueil').last);
    await tester.pumpAndSettle();
    final report = find.byKey(const ValueKey('home-action-report'));
    await tester.ensureVisible(report);
    await tester.tap(report);
    await tester.pumpAndSettle();
    expect(find.byType(CloseButton), findsOneWidget);
  });
}
