import 'package:flutter_test/flutter_test.dart';
import 'package:pawlink/features/adopt/data/adoption_models.dart';
import 'package:pawlink/features/cases/data/case_models.dart';
import 'package:pawlink/features/report/data/triage_rules.dart';

TriageInput input({
  List<String> tags = const [],
  String description = '',
  int count = 1,
  Species species = Species.dog,
  Map<FollowUpId, bool> answers = const {},
}) => TriageInput(
  species: species,
  speciesName: 'Chien',
  count: count,
  description: description,
  conditionTags: tags,
  answers: answers,
);

void main() {
  group('safety rules', () {
    test('an urgent tag always forces urgent', () {
      final a = analyzeReport(input(tags: ['bleeding']));
      expect(a.triage, Triage.urgent);
      expect(a.forcedUrgentByRule, isTrue);
    });

    test('a danger word in the description forces urgent', () {
      for (final word in ['Il saigne', 'hit by a car', 'نزيف']) {
        expect(
          analyzeReport(input(tags: ['lost'], description: word)).triage,
          Triage.urgent,
          reason: word,
        );
      }
    });

    test('a calm report stays stable, a weak sign is monitoring', () {
      expect(analyzeReport(input(tags: ['needs-food'])).triage, Triage.stable);
      expect(analyzeReport(input(tags: ['thin'])).triage, Triage.monitoring);
    });

    test('answers only raise the urgency', () {
      final base = input(tags: ['thin']);
      expect(
        analyzeReport(base.withAnswers({FollowUpId.conscious: false})).triage,
        Triage.urgent,
      );
      expect(
        analyzeReport(base.withAnswers({FollowUpId.walk: true})).triage,
        Triage.monitoring,
      );
      expect(
        analyzeReport(
          input(tags: ['young']).withAnswers({FollowUpId.walk: false}),
        ).triage,
        Triage.urgent,
      );
    });

    test('the advice always ends with seeing a vet, within five items', () {
      for (final tags in [
        <String>[],
        ['burned', 'smoke', 'bleeding', 'young', 'dehydrated'],
      ]) {
        final a = analyzeReport(input(tags: tags, count: 5));
        expect(a.safetyAdvice.length, lessThanOrEqualTo(5));
        expect(
          a.safetyAdvice,
          contains('Contactez un vétérinaire dès que possible.'),
        );
        expect(a.disclaimer, contains('pas de diagnostic'));
      }
    });

    test('asks at most two questions, and not the ones already answered', () {
      final a = analyzeReport(input(tags: ['injured', 'thin']));
      expect(a.followUps, [FollowUpId.conscious, FollowUpId.bleeding]);
      final b = analyzeReport(
        input(tags: ['injured', 'thin'], answers: {FollowUpId.conscious: true}),
      );
      expect(b.followUps, [FollowUpId.bleeding, FollowUpId.walk]);
      expect(analyzeReport(input()).followUps, isNull);
    });
  });
}
