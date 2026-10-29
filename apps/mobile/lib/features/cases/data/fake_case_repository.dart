import 'dart:async';

import '../../adopt/data/adoption_models.dart' show GeoPoint, Species, UserLite;
import 'case_models.dart';
import 'case_repository.dart';

/// In-memory cases around Algiers, Tizi Ouzou and Oran. Replace with the
/// API-backed repository; the screens only know [CaseRepository].
class FakeCaseRepository implements CaseRepository {
  FakeCaseRepository({this.viewerId = 'me', List<Case> cases = const []})
    : _cases = [...cases];

  /// Fifteen cases, five of them close enough to another to form a cluster at
  /// city zoom. Triage is spread across urgent, monitoring and stable, and
  /// one case in Oran already has a helper on the way.
  factory FakeCaseRepository.demo({String viewerId = 'me'}) {
    final now = DateTime.now();

    Case make(
      String id,
      String title, {
      required Species species,
      CaseCategory category = CaseCategory.companion,
      int? count,
      CaseStatus status = CaseStatus.open,
      required Triage triage,
      required double lat,
      required double lng,
      required String address,
      required String photo,
      required String description,
      List<String> tags = const [],
      required String reporter,
      required int minutesAgo,
      List<CaseHelper> helpers = const [],
      AIAnalysis? ai,
      Trust? trust,
    }) => Case(
      id: id,
      title: title,
      species: species,
      category: category,
      count: count,
      status: status,
      triage: triage,
      location: GeoPoint(lat: lat, lng: lng, address: address),
      photos: [photo],
      description: description,
      conditionTags: tags,
      reporter: UserLite(id: 'u-$id', name: reporter),
      ai: ai,
      trust: trust,
      moderation: Moderation.approved,
      helpers: helpers,
      createdAt: now.subtract(Duration(minutes: minutesAgo)),
      updatedAt: now.subtract(Duration(minutes: minutesAgo)),
    );

    const pets = 'assets/images/pets';
    const sheep = 'assets/illustrations/sheep.png';

    return FakeCaseRepository(
      viewerId: viewerId,
      cases: [
        // Tizi Ouzou (six)
        make(
          'c-tizi-1',
          'Chat coincé sur un toit',
          species: Species.cat,
          triage: Triage.urgent,
          lat: 36.6361,
          lng: 4.2133,
          address: 'Larbaâ Nath Irathen, Tizi Ouzou',
          photo: '$pets/cat-tabby.jpg',
          description:
              'Un chat tigré miaule depuis ce matin sur le toit d\'un garage, '
              'sans accès pour descendre. Il n\'a pas bu depuis hier.',
          tags: ['coincé', 'déshydraté'],
          reporter: 'Samir A.',
          minutesAgo: 11,
          ai: const AIAnalysis(
            triage: Triage.urgent,
            confidence: 0.82,
            summary:
                'Animal bloqué en hauteur, risque de chute et de '
                'déshydratation.',
            observedSigns: ['position en hauteur', 'cris continus'],
            safetyAdvice: ['Ne pas le poursuivre', 'Poser de l\'eau à portée'],
            recommendedHelp: [HelpType.search],
            disclaimer: 'Analyse automatique, ne remplace pas un vétérinaire.',
            model: 'demo',
          ),
          trust: const Trust(
            level: TrustLevel.verified,
            score: 86,
            confirmations: 2,
          ),
        ),
        make(
          'c-tizi-2',
          'Troupeau de moutons piégé',
          species: Species.sheep,
          category: CaseCategory.livestock,
          count: 8,
          triage: Triage.urgent,
          lat: 36.5028,
          lng: 4.0831,
          address: 'Ouadhias, Tizi Ouzou',
          photo: sheep,
          description:
              'Huit moutons bloqués dans un ravin après un éboulement. Le '
              'berger ne peut pas les remonter seul.',
          tags: ['ravin', 'plusieurs animaux'],
          reporter: 'Lyes B.',
          minutesAgo: 18,
        ),
        make(
          'c-tizi-3',
          'Chien blessé à la patte',
          species: Species.dog,
          triage: Triage.urgent,
          lat: 36.7118,
          lng: 4.0459,
          address: 'Centre-ville, Tizi Ouzou',
          photo: '$pets/dog-jack.jpg',
          description:
              'Un petit chien boite beaucoup, la patte arrière saigne. Il se '
              'laisse approcher.',
          tags: ['blessé', 'saigne'],
          reporter: 'Nadia K.',
          minutesAgo: 35,
        ),
        make(
          'c-tizi-4',
          'Chiot seul près de la gare',
          species: Species.dog,
          triage: Triage.monitoring,
          lat: 36.7270,
          lng: 4.0580,
          address: 'Boukhalfa, Tizi Ouzou',
          photo: '$pets/dog-puppy.jpg',
          description:
              'Un chiot d\'environ deux mois traîne près de la gare '
              'routière, personne ne semble le réclamer.',
          tags: ['jeune', 'seul'],
          reporter: 'Yanis M.',
          minutesAgo: 95,
        ),
        make(
          'c-tizi-5',
          'Chatons dans un carton',
          species: Species.cat,
          count: 4,
          triage: Triage.monitoring,
          lat: 36.7447,
          lng: 4.3722,
          address: 'Azazga, Tizi Ouzou',
          photo: '$pets/cat-kitten.jpg',
          description:
              'Quatre chatons abandonnés dans un carton devant un '
              'commerce. Ils ont froid mais bougent bien.',
          tags: ['abandonné', 'portée'],
          reporter: 'Samira O.',
          minutesAgo: 140,
        ),
        make(
          'c-tizi-6',
          'Chat roux nourri par le quartier',
          species: Species.cat,
          triage: Triage.stable,
          lat: 36.7314,
          lng: 3.9553,
          address: 'Draâ Ben Khedda, Tizi Ouzou',
          photo: '$pets/cat-orange.jpg',
          description:
              'Un chat roux en bonne santé vit dans la cour. Les voisins '
              'cherchent quelqu\'un pour le stériliser.',
          tags: ['stérilisation'],
          reporter: 'Hocine T.',
          minutesAgo: 600,
        ),
        // Alger (five)
        make(
          'c-alger-1',
          'Chienne avec ses petits sous un camion',
          species: Species.dog,
          count: 5,
          triage: Triage.urgent,
          lat: 36.7253,
          lng: 3.0836,
          address: 'Kouba, Alger',
          photo: '$pets/dog-pair.jpg',
          description:
              'Une chienne et quatre chiots vivent sous un camion garé. Le '
              'propriétaire doit le déplacer demain matin.',
          tags: ['portée', 'danger'],
          reporter: 'Amel D.',
          minutesAgo: 22,
        ),
        make(
          'c-alger-2',
          'Chat tigré amaigri',
          species: Species.cat,
          triage: Triage.monitoring,
          lat: 36.7456,
          lng: 3.0372,
          address: 'Hydra, Alger',
          photo: '$pets/cat-tabby-2.jpg',
          description:
              'Chat très maigre qui rôde près des poubelles. Il accepte la '
              'nourriture mais reste méfiant.',
          tags: ['maigre'],
          reporter: 'Rachid L.',
          minutesAgo: 70,
        ),
        make(
          'c-alger-3',
          'Berger australien errant',
          species: Species.dog,
          triage: Triage.monitoring,
          lat: 36.7667,
          lng: 3.0333,
          address: 'El Biar, Alger',
          photo: '$pets/dog-aussie.jpg',
          description:
              'Un chien avec un collier mais sans puce se promène seul sur '
              'la route depuis ce matin.',
          tags: ['perdu', 'collier'],
          reporter: 'Meriem H.',
          minutesAgo: 120,
        ),
        make(
          'c-alger-4',
          'Chat noir et blanc sociable',
          species: Species.cat,
          triage: Triage.stable,
          lat: 36.7889,
          lng: 3.0506,
          address: 'Bab El Oued, Alger',
          photo: '$pets/cat-bw.jpg',
          description:
              'Chat en bonne forme qui vient réclamer des câlins. Cherche '
              'une famille.',
          tags: ['sociable'],
          reporter: 'Walid S.',
          minutesAgo: 300,
        ),
        make(
          'c-alger-5',
          'Chien blanc errant près de la rocade',
          species: Species.dog,
          triage: Triage.urgent,
          lat: 36.7231,
          lng: 3.1853,
          address: 'Bab Ezzouar, Alger',
          photo: '$pets/dog-white.jpg',
          description:
              'Chien désorienté au bord de la rocade, il traverse entre les '
              'voitures. Besoin de quelqu\'un avec une laisse.',
          tags: ['danger', 'route'],
          reporter: 'Farid Z.',
          minutesAgo: 8,
        ),
        // Oran (four)
        make(
          'c-oran-1',
          'Chien attaché au soleil',
          species: Species.dog,
          triage: Triage.urgent,
          lat: 35.6971,
          lng: -0.6308,
          address: 'Centre, Oran',
          photo: '$pets/dog-white.jpg',
          description:
              'Un chien est attaché sans eau ni ombre sur un terrain '
              'vague depuis plusieurs heures.',
          tags: ['soif', 'chaleur'],
          reporter: 'Kheira B.',
          minutesAgo: 45,
        ),
        make(
          'c-oran-2',
          'Chienne blessée prise en charge',
          species: Species.dog,
          status: CaseStatus.inProgress,
          triage: Triage.monitoring,
          lat: 35.6392,
          lng: -0.6128,
          address: 'Es Senia, Oran',
          photo: '$pets/dog-aussie.jpg',
          description:
              'Chienne renversée par une moto, elle marche mais refuse de '
              'manger. Un bénévole est en route pour la conduire chez le '
              'vétérinaire.',
          tags: ['accident'],
          reporter: 'Houari M.',
          minutesAgo: 160,
          helpers: [
            CaseHelper(
              user: const UserLite(id: 'u-karim', name: 'Karim'),
              helpType: HelpType.transport,
              stage: HelperStage.onWay,
              stageAt: now.subtract(const Duration(minutes: 20)),
            ),
          ],
        ),
        make(
          'c-oran-3',
          'Chaton trouvé sous une voiture',
          species: Species.cat,
          triage: Triage.monitoring,
          lat: 35.7186,
          lng: -0.5461,
          address: 'Bir El Djir, Oran',
          photo: '$pets/cat-ginger.jpg',
          description:
              'Un chaton de quelques semaines miaule sous une voiture. La '
              'mère est introuvable.',
          tags: ['jeune', 'seul'],
          reporter: 'Imane R.',
          minutesAgo: 210,
        ),
        make(
          'c-oran-4',
          'Chien du port, en bonne santé',
          species: Species.dog,
          triage: Triage.stable,
          lat: 35.8531,
          lng: -0.3156,
          address: 'Arzew, Oran',
          photo: '$pets/dog-jack.jpg',
          description:
              'Chien du port, nourri par les pêcheurs. Rien d\'urgent, '
              'mais une vaccination serait la bienvenue.',
          tags: ['vaccination'],
          reporter: 'Mourad G.',
          minutesAgo: 900,
        ),
      ],
    );
  }

  /// Id of the person using the app; auth is not wired yet.
  final String viewerId;

  final List<Case> _cases;
  final _changes = StreamController<List<Case>>.broadcast();

  List<Case> _snapshot() {
    final list = [..._cases]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return List.unmodifiable(list);
  }

  void _emit() => _changes.add(_snapshot());

  @override
  Stream<List<Case>> watchCases() async* {
    yield _snapshot();
    yield* _changes.stream;
  }

  @override
  Future<Case> addCase(Case newCase) async {
    _cases.add(newCase);
    _emit();
    return newCase;
  }

  @override
  Future<Case> offerHelp({
    required String caseId,
    required HelpType helpType,
  }) async {
    final index = _cases.indexWhere((c) => c.id == caseId);
    if (index < 0) throw StateError('Unknown case $caseId');
    final current = _cases[index];
    if (current.status == CaseStatus.resolved) {
      throw StateError('Case $caseId is already resolved');
    }
    if (current.isHelpedBy(viewerId)) return current;

    final now = DateTime.now();
    final updated = current.copyWith(
      status: CaseStatus.inProgress,
      helpers: [
        ...current.helpers,
        CaseHelper(
          user: UserLite(id: viewerId, name: 'Moi'),
          helpType: helpType,
        ),
      ],
      updatedAt: now,
    );
    _cases[index] = updated;
    _emit();
    return updated;
  }
}
