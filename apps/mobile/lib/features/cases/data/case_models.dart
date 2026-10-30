// Case types, mirroring `apps/web/lib/types.ts` field for field so the API can
// be plugged in later without touching the screens. Species, GeoPoint,
// UserLite and ServiceType are shared with the other features.

import '../../adopt/data/adoption_models.dart' show GeoPoint, Species, UserLite;
import '../../services/data/service_models.dart' show ServiceType;

/// How urgent a case is. Drives the pin color and the map filters.
enum Triage { urgent, monitoring, stable }

enum CaseStatus {
  open,
  inProgress,
  resolved;

  /// The word the API uses (`in_progress`).
  String get wire => switch (this) {
    open => 'open',
    inProgress => 'in_progress',
    resolved => 'resolved',
  };
}

enum CaseCategory { companion, livestock }

enum HelpType { transport, foster, food, medical, search, boarding, funds }

/// Low-trust reports wait for a moderator before they appear publicly.
enum Moderation { pending, approved, hidden }

enum TrustLevel { verified, unverified, suspicious }

enum TrustCheckId {
  account,
  inAlgeria,
  photoGps,
  photoFresh,
  onSite,
  animalDetected,
  duplicate,
  rateLimit,
}

class TrustCheck {
  const TrustCheck({required this.id, this.ok, this.detail});

  final TrustCheckId id;

  /// true = passed, false = failed, null = not enough data (e.g. a photo
  /// without GPS).
  final bool? ok;
  final String? detail;
}

class Trust {
  const Trust({
    required this.level,
    required this.score,
    this.checks = const [],
    this.confirmations = 0,
    this.flags = 0,
    this.confirmedBy = const [],
    this.deniedBy = const [],
    this.flaggedBy = const [],
  });

  final TrustLevel level;
  final int score;
  final List<TrustCheck> checks;
  final int confirmations;
  final int flags;

  /// People who answered "do you see this animal?" while standing near it
  /// (one answer each).
  final List<String> confirmedBy;
  final List<String> deniedBy;

  /// One "report as fake" per person.
  final List<String> flaggedBy;
}

/// Quick yes/no questions the triage asks when something important is
/// missing.
enum FollowUpId { conscious, bleeding, walk, eating }

class SuggestedService {
  const SuggestedService({
    required this.serviceId,
    required this.type,
    required this.name,
    required this.distanceKm,
  });

  final String serviceId;
  final ServiceType type;
  final String name;
  final double distanceKm;
}

class SuggestedHelper {
  const SuggestedHelper({
    required this.userId,
    required this.name,
    required this.helpType,
    required this.distanceKm,
  });

  final String userId;
  final String name;
  final HelpType helpType;
  final double distanceKm;
}

class AIAnalysis {
  const AIAnalysis({
    required this.triage,
    required this.confidence,
    required this.summary,
    this.observedSigns = const [],
    this.safetyAdvice = const [],
    this.possiblyContagious = false,
    this.contagionAdvice,
    this.recommendedHelp = const [],
    this.suggestedServices = const [],
    this.suggestedHelpers,
    this.forcedUrgentByRule = false,
    this.followUps,
    required this.disclaimer,
    required this.model,
  });

  final Triage triage;
  final double confidence;
  final String summary;
  final List<String> observedSigns;
  final List<String> safetyAdvice;
  final bool possiblyContagious;
  final List<String>? contagionAdvice;
  final List<HelpType> recommendedHelp;
  final List<SuggestedService> suggestedServices;
  final List<SuggestedHelper>? suggestedHelpers;
  final bool forcedUrgentByRule;

  /// Questions still worth asking (answered ones are removed).
  final List<FollowUpId>? followUps;
  final String disclaimer;
  final String model;
}

/// Where a helper is: offered, then on the way, then with the animal.
enum HelperStage { onWay, onSite }

class CaseHelper {
  const CaseHelper({
    required this.user,
    required this.helpType,
    this.stage,
    this.stageAt,
  });

  final UserLite user;
  final HelpType helpType;
  final HelperStage? stage;
  final DateTime? stageAt;
}

/// The person with the animal asked for the next step (a vet, transport, a
/// shelter...).
class NextHelp {
  const NextHelp({required this.types, required this.by, required this.at});

  final List<HelpType> types;
  final String by;
  final DateTime at;
}

/// The reporter's changes to a public report: shown once a moderator
/// approves them.
class CaseEdit {
  const CaseEdit({this.description, this.conditionTags, required this.at});

  final String? description;
  final List<String>? conditionTags;
  final DateTime at;
}

class Case {
  const Case({
    required this.id,
    required this.title,
    required this.species,
    required this.category,
    this.count,
    required this.status,
    required this.triage,
    required this.location,
    this.photos = const [],
    required this.description,
    this.conditionTags = const [],
    required this.reporter,
    this.ai,
    this.emergencyZoneId,
    this.reporterOnSite,
    this.trust,
    this.moderation,
    this.helpers = const [],
    this.nextHelp,
    this.answers,
    required this.createdAt,
    required this.updatedAt,
    this.pendingEdit,
  });

  final String id;
  final String title;
  final Species species;
  final CaseCategory category;

  /// How many animals, for a herd or a litter.
  final int? count;
  final CaseStatus status;
  final Triage triage;
  final GeoPoint location;

  /// Asset paths or URLs.
  final List<String> photos;
  final String description;
  final List<String> conditionTags;
  final UserLite reporter;
  final AIAnalysis? ai;
  final String? emergencyZoneId;

  /// The reporter says they can stay near the animal (or reported it
  /// remotely).
  final bool? reporterOnSite;
  final Trust? trust;
  final Moderation? moderation;

  /// People helping, and where they are.
  final List<CaseHelper> helpers;
  final NextHelp? nextHelp;

  /// The reporter's answers to the triage's quick questions.
  final Map<FollowUpId, bool>? answers;
  final DateTime createdAt;
  final DateTime updatedAt;
  final CaseEdit? pendingEdit;

  /// Shown to everyone on the map: not solved, and not held back by a
  /// moderator.
  bool get isPublic =>
      status != CaseStatus.resolved &&
      (moderation == null || moderation == Moderation.approved);

  bool isHelpedBy(String userId) => helpers.any((h) => h.user.id == userId);

  // Addresses read "place, wilaya" ("Larbaâ Nath Irathen, Tizi Ouzou").
  String? get place => _addressPart(first: true);
  String? get wilaya => _addressPart(first: false);

  String? _addressPart({required bool first}) {
    final parts = location.address?.split(',');
    if (parts == null || parts.isEmpty) return null;
    final part = (first ? parts.first : parts.last).trim();
    return part.isEmpty ? null : part;
  }

  Case copyWith({
    CaseStatus? status,
    List<CaseHelper>? helpers,
    NextHelp? nextHelp,
    DateTime? updatedAt,
  }) => Case(
    id: id,
    title: title,
    species: species,
    category: category,
    count: count,
    status: status ?? this.status,
    triage: triage,
    location: location,
    photos: photos,
    description: description,
    conditionTags: conditionTags,
    reporter: reporter,
    ai: ai,
    emergencyZoneId: emergencyZoneId,
    reporterOnSite: reporterOnSite,
    trust: trust,
    moderation: moderation,
    helpers: helpers ?? this.helpers,
    nextHelp: nextHelp ?? this.nextHelp,
    answers: answers,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    pendingEdit: pendingEdit,
  );
}
