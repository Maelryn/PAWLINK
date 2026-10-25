import '../../adopt/data/adoption_models.dart' show GeoPoint;
import 'service_models.dart';
import 'service_repository.dart';

/// Demo listings in different cities. Replace with the API-backed repository.
class FakeServiceRepository implements ServiceRepository {
  const FakeServiceRepository();

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
      hours: '14:00 - 18:00',
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
      hours: '09:00 - 17:00',
      verified: true,
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
      hours: '24h/24',
      pro: true,
    ),
  ];

  @override
  Future<List<Service>> services() async => _all;
}
