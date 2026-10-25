import '../data/adoption_models.dart';

/// "3 mois", "1 an", "3 ans" from an age in months.
String formatAge(int months) {
  if (months < 12) return '$months mois';
  final years = months ~/ 12;
  return years == 1 ? '1 an' : '$years ans';
}

/// Make shows the sex as a symbol next to the name.
String sexSymbol(AnimalSex sex) => sex == AnimalSex.female ? '♀' : '♂';

String speciesLabel(Species species) => switch (species) {
  Species.dog => 'Chien',
  Species.cat => 'Chat',
  Species.bird => 'Oiseau',
  Species.horse => 'Cheval',
  Species.cow => 'Vache',
  Species.sheep => 'Mouton',
  Species.goat => 'Chèvre',
  Species.camel => 'Chameau',
  Species.donkey => 'Âne',
  Species.rabbit => 'Lapin',
  Species.chicken => 'Poule',
  Species.other => 'Autre',
};

String sexLabel(AnimalSex sex) => sex == AnimalSex.female ? 'Femelle' : 'Mâle';

String housingLabel(HousingType housing) => switch (housing) {
  HousingType.apartment => 'Appartement',
  HousingType.house => 'Maison avec jardin',
  HousingType.farm => 'Ferme',
};

/// Status of the viewer's own request (web `market.status`).
String requestStatusLabel(RequestStatus status) => switch (status) {
  RequestStatus.sent => 'En attente du propriétaire',
  RequestStatus.accepted => 'Acceptée',
  RequestStatus.declined => 'Refusée',
  RequestStatus.cancelled => 'Annulée',
};

const _months = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.', //
];

/// "12 août 2026" style, as the web prints vaccine and history dates.
String formatDate(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';

/// "Jack Russell · Tizi Ouzou"; falls back to the species without a breed.
String petDetail(AdoptionProfile p) {
  final place = p.location.address;
  final what = p.breed ?? speciesLabel(p.species);
  return place == null ? what : '$what · $place';
}
