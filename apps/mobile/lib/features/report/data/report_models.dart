// What the reporter fills in. Species and condition tags mirror the web
// (`apps/web/lib/species.ts`, `ReportFlow.tsx`) so a case made here reads the
// same on both.

import '../../adopt/data/adoption_models.dart' show Species;
import '../../cases/data/case_models.dart' show CaseCategory;

/// Where the position came from, and whether it is usable.
enum LocationStatus { idle, locating, found, denied, outside }

class ReportPosition {
  const ReportPosition({
    required this.lat,
    required this.lng,
    this.isDemo = false,
  });

  final double lat;
  final double lng;

  /// The "position de démo" shortcut: the report is marked "not on site".
  final bool isDemo;
}

/// Species the reporter can pick, in the web's order (companions first).
const reportSpecies = [
  Species.dog,
  Species.cat,
  Species.bird,
  Species.rabbit,
  Species.horse,
  Species.cow,
  Species.sheep,
  Species.goat,
  Species.camel,
  Species.donkey,
  Species.chicken,
];

const _livestock = {
  Species.horse,
  Species.cow,
  Species.sheep,
  Species.goat,
  Species.camel,
  Species.donkey,
  Species.chicken,
};

CaseCategory categoryOf(Species species) =>
    _livestock.contains(species)
        ? CaseCategory.livestock
        : CaseCategory.companion;

/// Bundled illustration of a species, or null when none was exported yet (the
/// picker then shows the paw icon).
String? speciesIllustration(Species species) => switch (species) {
  Species.dog => 'assets/illustrations/dog.png',
  Species.cat => 'assets/illustrations/cat.png',
  Species.sheep => 'assets/illustrations/sheep.png',
  Species.rabbit => 'assets/illustrations/rabbit.png',
  _ => null,
};

class ConditionTag {
  const ConditionTag(this.id, this.label, {this.highlight = false});

  /// Stored on the case; the same ids as the web.
  final String id;
  final String label;

  /// Drawn in the urgent color when selected. Only a visual cue: the triage
  /// rules have their own list.
  final bool highlight;
}

const conditionTags = [
  ConditionTag('injured', 'Blessé', highlight: true),
  ConditionTag('bleeding', 'Saignement', highlight: true),
  ConditionTag('burned', 'Brûlures', highlight: true),
  ConditionTag('trapped', 'Piégé', highlight: true),
  ConditionTag('smoke', 'Fumée', highlight: true),
  ConditionTag('breathing', 'Respire mal', highlight: true),
  ConditionTag('lost', 'Perdu'),
  ConditionTag('abandoned', 'Abandonné'),
  ConditionTag('thin', 'Maigre'),
  ConditionTag('dehydrated', 'Déshydraté'),
  ConditionTag('limping', 'Boite'),
  ConditionTag('not-eating', 'Ne mange plus'),
  ConditionTag('eyes', 'Yeux qui coulent'),
  ConditionTag('sneezing', 'Éternue'),
  ConditionTag('skin', 'Problème de peau'),
  ConditionTag('coughing', 'Tousse'),
  ConditionTag('young', 'Très jeune'),
  ConditionTag('needs-food', 'Besoin de nourriture'),
];

String tagLabel(String id) {
  for (final tag in conditionTags) {
    if (tag.id == id) return tag.label;
  }
  return id;
}

/// Shortest description that counts when no tag is selected (web: > 6).
const int minDescriptionLength = 7;

/// A report being written.
class ReportDraft {
  const ReportDraft({
    this.photoPath,
    this.position,
    this.address = '',
    this.species,
    this.count = 1,
    this.tags = const [],
    this.description = '',
  });

  /// Local file picked from the camera or the gallery.
  final String? photoPath;
  final ReportPosition? position;
  final String address;
  final Species? species;
  final int count;

  /// Tag ids, in the order they were picked.
  final List<String> tags;
  final String description;

  bool get hasEnoughSituation =>
      tags.isNotEmpty || description.trim().length >= minDescriptionLength;

  ReportDraft copyWith({
    String? photoPath,
    bool clearPhoto = false,
    ReportPosition? position,
    String? address,
    Species? species,
    int? count,
    List<String>? tags,
    String? description,
  }) => ReportDraft(
    photoPath: clearPhoto ? null : photoPath ?? this.photoPath,
    position: position ?? this.position,
    address: address ?? this.address,
    species: species ?? this.species,
    count: count ?? this.count,
    tags: tags ?? this.tags,
    description: description ?? this.description,
  );
}
