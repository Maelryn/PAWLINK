import '../../adopt/data/adoption_models.dart' show GeoPoint, UserLite;
import 'service_models.dart';
import 'service_repository.dart';

/// Demo listings in different cities. Replace with the API-backed repository.
class FakeServiceRepository implements ServiceRepository {
  FakeServiceRepository({
    this.viewerId = 'me',
    List<Review> reviews = const [],
    List<Booking> bookings = const [],
  }) : _reviews = [...reviews],
       _bookings = [...bookings];

  /// Reviews on four places and one appointment request in each state, so
  /// every card of the detail can be reached:
  /// Oliviers confirmed (and reviewed by the viewer), Didouche sent,
  /// Ambulance declined, Khadra cancelled, Blida open to ask, Refuge not Pro,
  /// Pension Les Amis owned by the viewer.
  factory FakeServiceRepository.demo({String viewerId = 'me'}) {
    final now = DateTime.now();
    UserLite me() => UserLite(id: viewerId, name: 'Moi');

    Review review(
      String id,
      String serviceId,
      UserLite author,
      int rating,
      String text,
      int daysAgo, {
      String? reply,
    }) => Review(
      id: id,
      serviceId: serviceId,
      author: author,
      rating: rating,
      text: text,
      createdAt: now.subtract(Duration(days: daysAgo)),
      reply: reply,
    );

    Booking booking(
      String id,
      String serviceId,
      int inDays,
      String time,
      String animal,
      String reason,
      BookingStatus status,
    ) => Booking(
      id: id,
      serviceId: serviceId,
      from: me(),
      date: bookingDateKey(now.add(Duration(days: inDays))),
      time: time,
      animal: animal,
      reason: reason,
      status: status,
      createdAt: now.subtract(const Duration(hours: 5)),
    );

    return FakeServiceRepository(
      viewerId: viewerId,
      reviews: [
        review(
          'rv1',
          's-oliviers',
          me(),
          5,
          "Équipe attentive, Luna a été opérée en urgence et tout s'est très "
              'bien passé.',
          3,
        ),
        review(
          'rv2',
          's-oliviers',
          const UserLite(id: 'u2', name: 'Karim B.'),
          5,
          'Rapides et rassurants, on a pu récupérer Pacha le soir même.',
          12,
          reply: 'Merci Karim, au plaisir de revoir Pacha en pleine forme !',
        ),
        review(
          'rv3',
          's-oliviers',
          const UserLite(id: 'u3', name: 'Sofia M.'),
          4,
          'Un peu d\'attente le samedi, mais personnel très gentil.',
          40,
        ),
        review(
          'rv4',
          's-refuge-pattes',
          const UserLite(id: 'u4', name: 'Yanis A.'),
          5,
          "Accueil chaleureux, j'ai adopté ma chienne ici.",
          8,
        ),
        review(
          'rv5',
          's-didouche',
          const UserLite(id: 'u5', name: 'Lila H.'),
          4,
          'Bon choix de croquettes et prix corrects.',
          21,
        ),
        review(
          'rv6',
          's-ambulance-kabylie',
          const UserLite(id: 'u6', name: 'Nadia T.'),
          5,
          'Arrivés en 20 minutes pour un chat blessé, merci !',
          1,
        ),
      ],
      bookings: [
        booking(
          'bk1',
          's-oliviers',
          3,
          '10:30',
          'Luna (chienne)',
          'Vaccin annuel',
          BookingStatus.confirmed,
        ),
        booking(
          'bk2',
          's-didouche',
          2,
          '15:00',
          'Pacha (chat)',
          'Conseil alimentation',
          BookingStatus.sent,
        ),
        booking(
          'bk3',
          's-ambulance-kabylie',
          1,
          '08:00',
          'Mimosa (chat)',
          'Transport vers la clinique',
          BookingStatus.declined,
        ),
        booking(
          'bk4',
          's-khadra',
          5,
          '16:00',
          'Rex (chien)',
          'Contrôle',
          BookingStatus.cancelled,
        ),
      ],
    );
  }

  /// The signed-in user; auth is not wired yet.
  final String viewerId;
  final List<Review> _reviews;

  /// Newest first.
  final List<Booking> _bookings;

  static const _all = <Service>[
    Service(
      id: 's-oliviers',
      type: ServiceType.vet,
      name: 'Clinique des Oliviers',
      location: GeoPoint(lat: 36.7118, lng: 4.0459, address: 'Tizi Ouzou'),
      phone: '+213 26 21 00 01',
      openNow: true,
      rating: 4.9,
      reviewCount: 216,
      tags: ['Urgences', 'Chirurgie'],
      description:
          'Clinique vétérinaire avec bloc opératoire et service des urgences. '
          'Consultations, vaccins, chirurgie et suivi des animaux de '
          'compagnie.',
      hours: '08:00 - 19:00',
      verified: true,
      pro: true,
    ),
    Service(
      id: 's-refuge-pattes',
      type: ServiceType.shelter,
      name: 'Refuge Les Pattes',
      location: GeoPoint(lat: 35.6971, lng: -0.6308, address: 'Oran'),
      phone: '+213 41 30 00 02',
      openNow: true,
      rating: 4.9,
      reviewCount: 77,
      tags: ['Chiens', 'Chats'],
      description:
          'Refuge associatif qui recueille les chiens et les chats '
          'abandonnés. Visites et adoptions sur place, du lundi au samedi.',
      hours: '10:00 - 17:00',
      verified: true,
    ),
    Service(
      id: 's-didouche',
      type: ServiceType.store,
      name: 'Animalerie Didouche',
      location: GeoPoint(lat: 36.7538, lng: 3.0588, address: 'Alger'),
      phone: '+213 21 70 00 03',
      openNow: true,
      rating: 4.4,
      reviewCount: 210,
      tags: ['Alimentation', 'Accessoires'],
      description:
          'Aliments, accessoires et conseils pour chiens, chats et oiseaux. '
          'Livraison possible dans Alger.',
      hours: '09:00 - 20:00',
      pro: true,
    ),
    Service(
      id: 's-ecole-blida',
      type: ServiceType.training,
      name: 'École du Chien Blida',
      location: GeoPoint(lat: 36.4701, lng: 2.8277, address: 'Blida'),
      phone: '+213 25 40 00 04',
      openNow: false,
      rating: 4.7,
      reviewCount: 64,
      tags: ['Éducation', 'Socialisation'],
      description:
          'Éducation positive, socialisation des chiots et cours '
          'individuels ou en petit groupe.',
      hours: '14:00 - 18:00',
      pro: true,
    ),
    Service(
      id: 's-khadra',
      type: ServiceType.vet,
      name: 'Cabinet Vétérinaire El Khadra',
      location: GeoPoint(lat: 36.365, lng: 6.6147, address: 'Constantine'),
      phone: '+213 31 90 00 05',
      openNow: false,
      rating: 4.6,
      reviewCount: 133,
      tags: ['Vaccins', 'Consultations'],
      description:
          'Cabinet de quartier : consultations, vaccins, puce électronique '
          'et petite chirurgie.',
      hours: '09:00 - 17:00',
      verified: true,
      pro: true,
    ),
    Service(
      id: 's-ambulance-kabylie',
      type: ServiceType.transport,
      name: 'Ambulance Animale Kabylie',
      location: GeoPoint(lat: 36.7167, lng: 4.05, address: 'Tizi Ouzou'),
      phone: '+213 26 21 00 06',
      openNow: true,
      rating: 4.9,
      reviewCount: 59,
      tags: ['Transport', 'Urgences'],
      description:
          "Transport d'animaux blessés ou malades vers une clinique, de jour "
          'comme de nuit, dans toute la Kabylie.',
      hours: '24h/24',
      pro: true,
    ),
    Service(
      id: 's-pension-amis',
      type: ServiceType.boarding,
      name: 'Pension Les Amis',
      location: GeoPoint(lat: 36.7509, lng: 5.0567, address: 'Béjaïa'),
      phone: '+213 34 20 00 07',
      openNow: true,
      rating: 4.8,
      reviewCount: 41,
      tags: ['Pension', 'Promenades'],
      description:
          'Pension familiale avec jardin clôturé : séjours courts ou longs '
          'pour chiens et chats, promenades tous les jours.',
      hours: '08:00 - 20:00',
      ownerId: 'me',
      pro: true,
    ),
  ];

  Service? _service(String id) {
    for (final s in _all) {
      if (s.id == id) return s;
    }
    return null;
  }

  @override
  Future<List<Service>> services() async => _all;

  @override
  Future<Service?> service(String id) async => _service(id);

  @override
  Future<List<Review>> reviews(String serviceId) async => [
    for (final r in _reviews)
      if (r.serviceId == serviceId) r,
  ]..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  @override
  Future<Review> saveReview({
    required String serviceId,
    required int rating,
    required String text,
  }) async {
    final service = _service(serviceId);
    if (service == null || service.ownerId == viewerId) {
      throw StateError('Cannot review $serviceId');
    }
    if (rating < 1 || rating > 5) throw RangeError.range(rating, 1, 5);
    final review = Review(
      id: 'rv${DateTime.now().microsecondsSinceEpoch}',
      serviceId: serviceId,
      author: UserLite(id: viewerId, name: 'Moi'),
      rating: rating,
      text: text.trim(),
      createdAt: DateTime.now(),
    );
    // One review per person and place: a new one replaces the old.
    _reviews
      ..removeWhere((r) => r.serviceId == serviceId && r.author.id == viewerId)
      ..add(review);
    return review;
  }

  @override
  Future<Booking?> myBooking(String serviceId) async {
    for (final b in _bookings) {
      if (b.serviceId != serviceId || b.from.id != viewerId) continue;
      final past = b.date.compareTo(bookingDateKey(DateTime.now())) < 0;
      return b.isActive && past ? null : b;
    }
    return null;
  }

  @override
  Future<Booking> sendBooking({
    required String serviceId,
    required String date,
    required String time,
    required String animal,
    required String reason,
  }) async {
    final service = _service(serviceId);
    if (service == null || !service.pro || service.ownerId == viewerId) {
      throw StateError('$serviceId takes no appointment request');
    }
    final when = DateTime.tryParse('${date}T$time');
    if (when == null || when.isBefore(DateTime.now())) {
      throw ArgumentError('$date $time is not in the future');
    }
    final booking = Booking(
      id: 'bk${DateTime.now().microsecondsSinceEpoch}',
      serviceId: serviceId,
      from: UserLite(id: viewerId, name: 'Moi'),
      date: date,
      time: time,
      animal: animal.trim(),
      reason: reason.trim(),
      status: BookingStatus.sent,
      createdAt: DateTime.now(),
    );
    _bookings.insert(0, booking);
    return booking;
  }

  @override
  Future<void> cancelBooking(String bookingId) async {
    final i = _bookings.indexWhere((b) => b.id == bookingId);
    if (i < 0 || !_bookings[i].isActive) return;
    _bookings[i] = _bookings[i].withStatus(BookingStatus.cancelled);
  }
}
