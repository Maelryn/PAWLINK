import 'adoption_models.dart';
import 'adoption_repository.dart';

/// Stand-in until the backend exposes adoptions. Same six animals as the web
/// mock (`apps/web/lib/mock/data.ts`), photos bundled from the Make file.
class FakeAdoptionRepository implements AdoptionRepository {
  FakeAdoptionRepository({
    this.viewerId = 'me',
    List<AdoptionRequest> requests = const [],
  }) : _requests = [...requests],
       _profiles = _seed();

  /// Every request state reachable in the app: Loulou (a5) accepted, Pacha
  /// (a3) waiting for the owner, Kahwa (a4) on hold for someone else. The
  /// others are open.
  factory FakeAdoptionRepository.demo() => FakeAdoptionRepository(
    requests: [
      _seedRequest('r1', 'a5', 'me', RequestStatus.accepted),
      _seedRequest('r2', 'a3', 'me', RequestStatus.sent),
      _seedRequest('r3', 'a4', 'u9', RequestStatus.accepted),
    ],
  );

  static AdoptionRequest _seedRequest(
    String id,
    String adoptionId,
    String from,
    RequestStatus status,
  ) => AdoptionRequest(
    id: id,
    adoptionId: adoptionId,
    from: UserLite(id: from, name: from == 'me' ? 'Moi' : 'Amine'),
    fromPhone: '+213 555 00 00 02',
    message: "J'ai un jardin et beaucoup de temps pour lui.",
    housing: HousingType.house,
    experience: true,
    status: status,
    createdAt: DateTime(2026, 10, 1),
  );

  /// The signed-in user; auth is not wired yet.
  final String viewerId;
  final List<AdoptionRequest> _requests;
  final List<AdoptionProfile> _profiles;

  /// Shown to the owner once they accept; auth is not wired yet.
  static const _viewerPhone = '+213 555 00 00 02';

  @override
  Future<List<AdoptionProfile>> listings() async => [
    for (final p in _profiles)
      if (p.status == AdoptionStatus.approved) _forViewer(p),
  ];

  @override
  Future<AdoptionProfile?> listing(String id) async {
    for (final p in _profiles) {
      if (p.id == id) return _forViewer(p);
    }
    return null;
  }

  @override
  Future<AdoptionRequest?> myRequest(String adoptionId) async {
    for (final r in _requests) {
      if (r.adoptionId == adoptionId &&
          r.from.id == viewerId &&
          r.status != RequestStatus.cancelled) {
        return r;
      }
    }
    return null;
  }

  @override
  Future<AdoptionRequest> sendRequest({
    required String adoptionId,
    required String message,
    required HousingType housing,
    required bool experience,
  }) async {
    final profile = _profiles.firstWhere((p) => p.id == adoptionId);
    if (_isReserved(profile)) {
      throw StateError('Adoption $adoptionId is already on hold');
    }
    final request = AdoptionRequest(
      id: 'rq${DateTime.now().microsecondsSinceEpoch}',
      adoptionId: adoptionId,
      from: UserLite(id: viewerId, name: 'Moi'),
      fromPhone: _viewerPhone,
      message: message,
      housing: housing,
      experience: experience,
      status: RequestStatus.sent,
      createdAt: DateTime.now(),
    );
    // One request per person and animal: a new one replaces the old.
    _requests
      ..removeWhere((r) => r.adoptionId == adoptionId && r.from.id == viewerId)
      ..insert(0, request);
    return request;
  }

  @override
  Future<void> cancelRequest(String requestId) async {
    final i = _requests.indexWhere((r) => r.id == requestId);
    if (i < 0) return;
    final r = _requests[i];
    _requests[i] = AdoptionRequest(
      id: r.id,
      adoptionId: r.adoptionId,
      from: r.from,
      fromPhone: r.fromPhone,
      message: r.message,
      housing: r.housing,
      experience: r.experience,
      status: RequestStatus.cancelled,
      createdAt: r.createdAt,
    );
  }

  bool _isReserved(AdoptionProfile p) =>
      p.status == AdoptionStatus.approved &&
      _requests.any(
        (r) => r.adoptionId == p.id && r.status == RequestStatus.accepted,
      );

  /// Owner's phone is shared only after the owner accepted this viewer.
  AdoptionProfile _forViewer(AdoptionProfile p) {
    final accepted = _requests.any(
      (r) =>
          r.adoptionId == p.id &&
          r.from.id == viewerId &&
          r.status == RequestStatus.accepted,
    );
    return (accepted ? p : p.withoutOwnerPhone()).withReserved(_isReserved(p));
  }

  static const _kouba = GeoPoint(
    lat: 36.7255,
    lng: 3.0921,
    address: 'Kouba, Alger',
  );
  static const _tizi = GeoPoint(
    lat: 36.6911,
    lng: 4.0811,
    address: 'Tizi Ouzou',
  );
  static const _hydra = GeoPoint(
    lat: 36.7445,
    lng: 3.0362,
    address: 'Hydra, Alger',
  );
  static const _elBiar = GeoPoint(
    lat: 36.7672,
    lng: 3.0298,
    address: 'El Biar, Alger',
  );
  static const _darElHayawane = ShelterRef(
    id: 's7',
    name: 'Refuge Dar El Hayawane',
  );
  static const _lesPattes = ShelterRef(
    id: 's6',
    name: 'Refuge Les Pattes de Kabylie',
  );
  static const _phone = '+213 555 00 00 01';

  static List<AdoptionProfile> _seed() => [
    AdoptionProfile(
      id: 'a1',
      name: 'Simba',
      species: Species.dog,
      breed: 'Croisé',
      sex: AnimalSex.male,
      ageMonths: 4,
      photos: const [
        'assets/images/pets/dog-puppy.jpg',
        'assets/images/pets/dog-pair.jpg',
        'assets/images/pets/dog-white.jpg',
      ],
      healthStatus: 'En pleine forme',
      vaccinations: [
        Vaccination(name: 'CHPPi', date: DateTime(2026, 8, 12)),
        Vaccination(name: 'Rage', date: DateTime(2026, 9, 10)),
      ],
      medicalHistory: [
        MedicalEntry(
          date: DateTime(2026, 8, 2),
          note: 'Sauvé à Bab El Oued, déshydraté',
        ),
        MedicalEntry(date: DateTime(2026, 8, 12), note: 'Vermifugé et vacciné'),
      ],
      behavior: const [
        'Joueur',
        'Sociable avec les chats',
        'Adore les enfants',
      ],
      careNeeds: const ['Sorties quotidiennes', 'Éducation de base'],
      story:
          'Simba a été trouvé avec ses frères et sœurs dans un parking. Il est curieux, câlin et apprend très vite.',
      shelter: _darElHayawane,
      ownerId: 'u1',
      ownerPhone: _phone,
      location: _kouba,
      status: AdoptionStatus.approved,
      createdAt: DateTime(2026, 4, 12),
    ),
    AdoptionProfile(
      id: 'a2',
      name: 'Zitouna',
      species: Species.cat,
      breed: 'Européen',
      sex: AnimalSex.female,
      ageMonths: 3,
      photos: const [
        'assets/images/pets/cat-kitten.jpg',
        'assets/images/pets/cat-orange.jpg',
      ],
      healthStatus: 'En bonne santé',
      vaccinations: [
        Vaccination(name: 'Typhus / Coryza', date: DateTime(2026, 9, 1)),
      ],
      medicalHistory: [
        MedicalEntry(
          date: DateTime(2026, 8, 20),
          note: 'Sauvée lors des feux de Kabylie',
        ),
      ],
      behavior: const ['Douce', 'Un peu timide au début', 'Ronronne beaucoup'],
      careNeeds: const ['Intérieur', 'Rappel vaccin en octobre'],
      story:
          'Zitouna a été retrouvée sous une maison évacuée pendant les feux. Elle a repris des forces et cherche un foyer calme.',
      shelter: _lesPattes,
      ownerId: 'u1',
      ownerPhone: _phone,
      location: _tizi,
      status: AdoptionStatus.approved,
      createdAt: DateTime(2026, 5, 4),
    ),
    AdoptionProfile(
      id: 'a3',
      name: 'Pacha',
      species: Species.dog,
      breed: 'Berger australien croisé',
      sex: AnimalSex.male,
      ageMonths: 26,
      photos: const ['assets/images/pets/dog-aussie.jpg'],
      healthStatus: 'En pleine forme',
      vaccinations: [
        Vaccination(name: 'CHPPi', date: DateTime(2026, 3, 14)),
        Vaccination(name: 'Rage', date: DateTime(2026, 3, 14)),
      ],
      medicalHistory: [
        MedicalEntry(
          date: DateTime(2026, 3, 1),
          note: 'Abandonné, puce non enregistrée',
        ),
        MedicalEntry(date: DateTime(2026, 3, 20), note: 'Castré'),
      ],
      behavior: const ['Énergique', 'Très intelligent', 'Obéissant'],
      careNeeds: const ['Grand espace', "2h d'activité par jour"],
      story:
          'Pacha est un chien brillant qui adore apprendre. Parfait pour une famille sportive avec un jardin.',
      shelter: _darElHayawane,
      ownerId: 'u1',
      ownerPhone: _phone,
      location: _kouba,
      status: AdoptionStatus.approved,
      createdAt: DateTime(2026, 4, 12),
    ),
    AdoptionProfile(
      id: 'a4',
      name: 'Kahwa',
      species: Species.cat,
      breed: 'Tigré',
      sex: AnimalSex.male,
      ageMonths: 18,
      photos: const [
        'assets/images/pets/cat-tabby.jpg',
        'assets/images/pets/cat-tabby-2.jpg',
        'assets/images/pets/cat-bw.jpg',
      ],
      healthStatus: "Guéri d'une fracture",
      vaccinations: [
        Vaccination(name: 'Typhus / Coryza', date: DateTime(2026, 5, 2)),
        Vaccination(name: 'Rage', date: DateTime(2026, 5, 2)),
      ],
      medicalHistory: [
        MedicalEntry(
          date: DateTime(2026, 4, 10),
          note: 'Fracture de la patte arrière (accident)',
        ),
        MedicalEntry(date: DateTime(2026, 6, 1), note: 'Guérison complète'),
      ],
      behavior: const ['Calme', 'Indépendant', 'Aime les câlins le soir'],
      careNeeds: const ["Pas d'escaliers raides les premiers mois"],
      story:
          "Kahwa a survécu à un accident de voiture à Hydra. Aujourd'hui il marche parfaitement et attend son humain.",
      shelter: _darElHayawane,
      ownerId: 'u1',
      ownerPhone: _phone,
      location: _hydra,
      status: AdoptionStatus.approved,
      createdAt: DateTime(2026, 4, 12),
    ),
    AdoptionProfile(
      id: 'a5',
      name: 'Loulou',
      species: Species.dog,
      breed: 'Jack Russell',
      sex: AnimalSex.female,
      ageMonths: 38,
      photos: const ['assets/images/pets/dog-jack.jpg'],
      healthStatus: 'Traitée pour la gale — guérie',
      vaccinations: [
        Vaccination(name: 'CHPPi', date: DateTime(2026, 2, 11)),
        Vaccination(name: 'Rage', date: DateTime(2026, 2, 11)),
      ],
      medicalHistory: [
        MedicalEntry(
          date: DateTime(2026, 1, 15),
          note: 'Gale sarcoptique traitée',
        ),
        MedicalEntry(date: DateTime(2026, 2, 20), note: 'Stérilisée'),
      ],
      behavior: const ['Affectueuse', 'Vive', 'Préfère être seule chien'],
      careNeeds: const ["Jouets d'occupation"],
      story:
          'Loulou a retrouvé son beau pelage après son traitement. Elle est pleine de vie et très attachante.',
      shelter: _lesPattes,
      ownerId: 'u1',
      ownerPhone: _phone,
      location: _tizi,
      status: AdoptionStatus.approved,
      createdAt: DateTime(2026, 5, 4),
    ),
    AdoptionProfile(
      id: 'a6',
      name: 'Sukkar',
      species: Species.cat,
      breed: 'Roux',
      sex: AnimalSex.male,
      ageMonths: 7,
      photos: const ['assets/images/pets/cat-ginger.jpg'],
      healthStatus: 'En pleine forme',
      vaccinations: [
        Vaccination(name: 'Typhus / Coryza', date: DateTime(2026, 7, 21)),
      ],
      medicalHistory: [
        MedicalEntry(date: DateTime(2026, 7, 1), note: 'Recueilli à El Biar'),
      ],
      behavior: const ['Joueur', 'Bavard', 'Aime les autres chats'],
      careNeeds: const ['Griffoir', 'Jeux quotidiens'],
      story:
          'Sukkar porte bien son nom : il est doux comme le sucre et adore discuter avec tout le monde.',
      shelter: _darElHayawane,
      ownerId: 'u1',
      ownerPhone: _phone,
      location: _elBiar,
      status: AdoptionStatus.approved,
      createdAt: DateTime(2026, 4, 12),
    ),
  ];
}
