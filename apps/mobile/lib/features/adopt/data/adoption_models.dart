// Adoption types, mirroring `apps/web/lib/types.ts` field for field so the
// API can be plugged in later without touching the screens.

/// Business rule (README): a listing carries at most three real photos.
const int maxAdoptionPhotos = 3;

enum Species {
  dog,
  cat,
  bird,
  horse,
  cow,
  sheep,
  goat,
  camel,
  donkey,
  rabbit,
  chicken,
  other;

  /// Chip group on the Adopter tab. Birds, rabbits and "other" belong to no
  /// chip: they only appear under "Tous".
  SpeciesGroup? get group => switch (this) {
    dog => SpeciesGroup.dog,
    cat => SpeciesGroup.cat,
    cow ||
    sheep ||
    goat ||
    camel ||
    donkey ||
    horse ||
    chicken => SpeciesGroup.livestock,
    bird || rabbit || other => null,
  };
}

enum SpeciesGroup { dog, cat, livestock }

enum AnimalSex { male, female }

/// Reviewed by an admin before it is public; "adopted" once the owner
/// confirms the animal found its family (then it leaves the list).
enum AdoptionStatus { pending, approved, rejected, adopted }

class GeoPoint {
  const GeoPoint({required this.lat, required this.lng, this.address});

  final double lat;
  final double lng;
  final String? address;
}

class UserLite {
  const UserLite({required this.id, required this.name, this.avatar = ''});

  final String id;
  final String name;
  final String avatar;
}

class Vaccination {
  const Vaccination({required this.name, required this.date});

  final String name;
  final DateTime date;
}

class MedicalEntry {
  const MedicalEntry({required this.date, required this.note});

  final DateTime date;
  final String note;
}

/// Who posted the listing: a shelter account or a person.
class ShelterRef {
  const ShelterRef({required this.id, required this.name});

  final String id;
  final String name;
}

/// Changes the owner made to a live listing, public only once a moderator
/// approves them. Every field is optional (web: `Partial<...>`).
class AdoptionEdit {
  const AdoptionEdit({
    required this.at,
    this.name,
    this.species,
    this.breed,
    this.sex,
    this.ageMonths,
    this.photos,
    this.healthStatus,
    this.vaccinations,
    this.medicalHistory,
    this.behavior,
    this.careNeeds,
    this.story,
    this.ownerPhone,
    this.location,
  });

  final DateTime at;
  final String? name;
  final Species? species;
  final String? breed;
  final AnimalSex? sex;
  final int? ageMonths;
  final List<String>? photos;
  final String? healthStatus;
  final List<Vaccination>? vaccinations;
  final List<MedicalEntry>? medicalHistory;
  final List<String>? behavior;
  final List<String>? careNeeds;
  final String? story;
  final String? ownerPhone;
  final GeoPoint? location;
}

class AdoptionProfile {
  AdoptionProfile({
    required this.id,
    required this.name,
    required this.species,
    this.breed,
    required this.sex,
    required this.ageMonths,
    required this.photos,
    required this.healthStatus,
    this.vaccinations = const [],
    this.medicalHistory = const [],
    this.behavior = const [],
    this.careNeeds = const [],
    required this.story,
    required this.shelter,
    required this.ownerId,
    this.ownerPhone,
    required this.location,
    required this.status,
    required this.createdAt,
    this.pendingEdit,
    this.reserved = false,
  }) : assert(
         photos.length <= maxAdoptionPhotos,
         'An adoption listing has at most $maxAdoptionPhotos photos',
       );

  final String id;
  final String name;
  final Species species;
  final String? breed;
  final AnimalSex sex;
  final int ageMonths;

  /// Asset paths or URLs, first one is the cover.
  final List<String> photos;
  final String healthStatus;
  final List<Vaccination> vaccinations;
  final List<MedicalEntry> medicalHistory;
  final List<String> behavior;
  final List<String> careNeeds;
  final String story;
  final ShelterRef shelter;
  final String ownerId;

  /// Null unless the viewer's request was accepted: the repository strips it
  /// otherwise, screens never decide this.
  final String? ownerPhone;
  final GeoPoint location;
  final AdoptionStatus status;
  final DateTime createdAt;
  final AdoptionEdit? pendingEdit;

  /// The owner already accepted a request: the animal is on hold (web:
  /// `reservedRequestOf`) and nobody else can ask. Filled by the repository.
  final bool reserved;

  String get coverPhoto => photos.first;

  AdoptionProfile withoutOwnerPhone() => _copy(ownerPhone: null);

  AdoptionProfile withReserved(bool value) =>
      _copy(ownerPhone: ownerPhone, reserved: value);

  AdoptionProfile _copy({required String? ownerPhone, bool? reserved}) =>
      AdoptionProfile(
        id: id,
        name: name,
        species: species,
        breed: breed,
        sex: sex,
        ageMonths: ageMonths,
        photos: photos,
        healthStatus: healthStatus,
        vaccinations: vaccinations,
        medicalHistory: medicalHistory,
        behavior: behavior,
        careNeeds: careNeeds,
        story: story,
        shelter: shelter,
        ownerId: ownerId,
        ownerPhone: ownerPhone,
        location: location,
        status: status,
        createdAt: createdAt,
        pendingEdit: pendingEdit,
        reserved: reserved ?? this.reserved,
      );
}

enum HousingType { apartment, house, farm }

enum RequestStatus { sent, accepted, declined, cancelled }

class AdoptionRequest {
  const AdoptionRequest({
    required this.id,
    required this.adoptionId,
    required this.from,
    this.fromPhone,
    required this.message,
    required this.housing,
    required this.experience,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String adoptionId;
  final UserLite from;

  /// Adopter phone, shown to the owner only once they accept.
  final String? fromPhone;
  final String message;
  final HousingType housing;
  final bool experience;
  final RequestStatus status;
  final DateTime createdAt;
}
