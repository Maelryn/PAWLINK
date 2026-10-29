import '../../../core/map/algeria.dart';
import '../../adopt/data/adoption_models.dart' show GeoPoint, UserLite;
import '../../cases/data/case_models.dart';
import 'report_models.dart';

/// Turns a finished report into the [Case] the repository stores.
Case buildReportCase({
  required ReportDraft draft,
  required String speciesName,
  required UserLite reporter,
  required AIAnalysis analysis,
  required Trust trust,
  required Map<FollowUpId, bool> answers,
  required DateTime now,
}) {
  final position = draft.position!;
  final species = draft.species!;
  final typedAddress = draft.address.trim();
  // No reverse geocoding yet: without a typed place the case has no address.
  final address =
      typedAddress.isNotEmpty
          ? typedAddress
          : position.isDemo
          ? Algeria.demoAddress
          : null;
  final tagText = draft.tags.map(tagLabel);
  final typedDescription = draft.description.trim();

  return Case(
    id: 'new-${now.millisecondsSinceEpoch}',
    title:
        '$speciesName — '
        '${tagText.take(2).join(', ').ifEmpty('Signaler un animal')}',
    species: species,
    category: categoryOf(species),
    count: draft.count > 1 ? draft.count : null,
    status: CaseStatus.open,
    triage: analysis.triage,
    location: GeoPoint(lat: position.lat, lng: position.lng, address: address),
    photos: [if (draft.photoPath != null) draft.photoPath!],
    description:
        typedDescription.isNotEmpty ? typedDescription : tagText.join(', '),
    conditionTags: draft.tags,
    reporter: reporter,
    ai: analysis,
    reporterOnSite: !position.isDemo,
    trust: trust,
    moderation:
        trust.level == TrustLevel.suspicious
            ? Moderation.pending
            : Moderation.approved,
    answers: answers.isEmpty ? null : answers,
    createdAt: now,
    updatedAt: now,
  );
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
