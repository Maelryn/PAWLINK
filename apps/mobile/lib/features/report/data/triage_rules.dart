// The safety-rule layer of the web triage (`apps/web/lib/ai/analyze.ts`),
// ported alone: no AI call, no diagnosis. Danger words always force "urgent",
// the rules and the reporter's answers can only raise the level, and the
// advice always ends with "see a vet".

import '../../adopt/data/adoption_models.dart' show Species;
import '../../cases/data/case_models.dart';

class TriageInput {
  const TriageInput({
    required this.species,
    required this.speciesName,
    required this.count,
    required this.description,
    required this.conditionTags,
    this.answers = const {},
  });

  final Species species;

  /// Display name of the species, for the summary sentence.
  final String speciesName;
  final int count;
  final String description;
  final List<String> conditionTags;

  /// The reporter's answers to the quick questions. They can only raise the
  /// urgency.
  final Map<FollowUpId, bool> answers;

  TriageInput withAnswers(Map<FollowUpId, bool> answers) => TriageInput(
    species: species,
    speciesName: speciesName,
    count: count,
    description: description,
    conditionTags: conditionTags,
    answers: answers,
  );
}

const _urgentTags = {'trapped', 'bleeding', 'breathing', 'fire', 'burned'};
const _urgentKeywords = [
  // fr
  'saign', 'sang', 'feu', 'brûl', 'brul', 'piég', 'coinc', 'respir',
  'inconscient', 'percut', 'fractur', 'empoison', 'convuls',
  // en
  'bleed', 'blood', 'fire', 'burn', 'trapped', 'stuck', 'breath',
  'unconscious', 'hit by', 'poison', 'seizure',
  // ar / darija
  'نزيف', 'دم', 'حريق', 'نار', 'محاصر', 'تنفس', 'حروق', 'مسموم',
  'ضربتو طوموبيل',
];
const _contagiousTags = {'eyes', 'sneezing', 'skin', 'itching', 'coughing'};
const _contagiousKeywords = [
  'gale',
  'mange',
  'toux',
  'cough',
  'diarr',
  'vomi',
  'teigne',
  'سعال',
  'إسهال',
  'جرب',
];
const _monitorTags = {
  'injured', 'lost', 'stressed', 'thin', 'dehydrated', 'limping',
  'not-eating', 'heat', 'young', 'abandoned', //
  ..._contagiousTags,
};
const _injuredTags = {
  'injured',
  'limping',
  'trapped',
  'burned',
  'breathing',
  'bleeding',
};

const _signs = {
  'trapped': "L'animal ne peut pas s'éloigner seul",
  'smoke': 'Exposition à la fumée signalée',
  'fire': "Feu à proximité de l'animal",
  'burned': 'Traces de brûlures visibles',
  'injured': 'Signes de blessure ou de douleur',
  'bleeding': 'Saignement actif signalé',
  'stressed': 'Signes de stress ou de panique',
  'lost': 'Séparé de son propriétaire',
  'breathing': 'Difficultés respiratoires',
  'abandoned': 'Laissé sans personne',
  'young': 'Animaux très jeunes',
  'evacuated': 'Déjà évacué en sécurité',
  'needs-food': 'Peu de nourriture',
  'needs-shelter': "Pas d'abri adapté",
  'thin': 'Perte de poids visible',
  'eyes': 'Écoulement des yeux',
  'sneezing': 'Éternuements fréquents',
  'dehydrated': 'Déshydratation possible',
  'skin': 'Perte de poils ou lésions',
  'itching': 'Se gratte beaucoup',
  'limping': 'Boiterie',
  'coughing': 'Toux',
  'not-eating': 'Appétit réduit',
  'heat': 'Forte exposition à la chaleur',
};

const _healthy = 'Aucun problème visible';
const _notConscious = 'Inconscient';
const _heavyBleeding = 'Saigne beaucoup';
const _cantWalk = 'Ne peut pas se lever ni marcher';
const _notEating = 'Ne boit pas, ne mange pas';

const _adviceDistance =
    'Approchez doucement et gardez vos distances : un animal effrayé peut '
    'mordre ou ruer.';
const _adviceNoFood =
    'Ne donnez pas de médicaments humains et ne forcez pas à manger.';
const _adviceCool =
    "Mettez l'animal à l'ombre et refroidissez les brûlures à l'eau propre "
    'tiède, jamais de glace.';
const _adviceNoOintment =
    'Ne mettez ni crème, ni huile, ni beurre sur les brûlures.';
const _adviceSmoke =
    "Amenez l'animal à l'air frais dès que c'est sans danger pour vous.";
const _advicePressure =
    'En cas de saignement, appuyez doucement un tissu propre sur la plaie.';
const _adviceWater = "Proposez de l'eau fraîche en petite quantité, souvent.";
const _adviceWarm = 'Gardez les petits au chaud et ensemble.';
const _adviceYourSafety =
    "N'entrez jamais dans une zone de feu. Suivez les consignes de la "
    'Protection civile.';
const _adviceIsolate = "Séparez l'animal des autres animaux si possible.";
const _adviceBowls = 'Ne partagez pas les gamelles de nourriture ou d\'eau.';
const _adviceHands =
    'Lavez-vous les mains après chaque contact, portez des gants si possible.';
const _adviceVet = 'Contactez un vétérinaire dès que possible.';
const _adviceHerd =
    'Gardez le troupeau groupé et calme, évitez les bruits forts.';

const _herdSpecies = {
  Species.sheep,
  Species.goat,
  Species.cow,
  Species.camel,
  Species.chicken,
};

const disclaimer =
    'PawLink ne pose pas de diagnostic. Contactez toujours un vétérinaire.';

int _rank(Triage t) => switch (t) {
  Triage.stable => 0,
  Triage.monitoring => 1,
  Triage.urgent => 2,
};

Triage _raise(Triage t, Triage to) => _rank(to) > _rank(t) ? to : t;

String _summary(Triage triage, String species, int n) {
  final name = species.toLowerCase();
  return switch (triage) {
    Triage.urgent =>
      n > 1
          ? '$n animaux ($name) semblent en danger immédiat. Faire venir un '
              'vétérinaire ou une équipe de secours est la priorité.'
          : "L'animal ($name) semble en danger immédiat. Faire venir un "
              'vétérinaire ou une équipe de secours est la priorité.',
    Triage.monitoring =>
      n > 1
          ? '$n animaux ($name) ont besoin d\'attention rapidement, mais la '
              'situation semble maîtrisée pour l\'instant.'
          : "L'animal ($name) a besoin d'attention rapidement, mais la "
              "situation semble maîtrisée pour l'instant.",
    Triage.stable =>
      n > 1
          ? '$n animaux ($name) semblent en sécurité. Prochaine étape : '
              'nourriture et abri.'
          : "L'animal ($name) semble en sécurité. Prochaine étape : nourriture "
              'et abri.',
  };
}

/// Runs the rules. Same input, same output: nothing random, nothing remote.
AIAnalysis analyzeReport(TriageInput input) {
  final text = input.description.toLowerCase();
  final tags = input.conditionTags;
  final answers = input.answers;

  final ruleHit =
      tags.any(_urgentTags.contains) ||
      _urgentKeywords.any((k) => text.contains(k.toLowerCase()));
  final contagious =
      tags.any(_contagiousTags.contains) ||
      _contagiousKeywords.any((k) => text.contains(k.toLowerCase()));

  var triage =
      tags.any(_monitorTags.contains) || contagious
          ? Triage.monitoring
          : Triage.stable;

  // Not conscious or heavy bleeding = urgent; can't walk = one level up; not
  // eating = at least "to watch".
  final answeredUrgent =
      answers[FollowUpId.conscious] == false ||
      answers[FollowUpId.bleeding] == true;
  if (answers[FollowUpId.walk] == false) {
    triage = _raise(
      triage,
      triage == Triage.stable ? Triage.monitoring : Triage.urgent,
    );
  }
  if (answers[FollowUpId.eating] == false) {
    triage = _raise(triage, Triage.monitoring);
  }
  final forcedUrgentByRule =
      (ruleHit || answeredUrgent) && triage != Triage.urgent;
  if (ruleHit || answeredUrgent) triage = Triage.urgent;

  final observedSigns = [
    for (final tag in tags)
      if (_signs[tag] != null) _signs[tag]!,
  ];
  if (answers[FollowUpId.conscious] == false) {
    observedSigns.insert(0, _notConscious);
  }
  if (answers[FollowUpId.bleeding] == true) {
    observedSigns.insert(0, _heavyBleeding);
  }
  if (answers[FollowUpId.walk] == false) observedSigns.add(_cantWalk);
  if (answers[FollowUpId.eating] == false) observedSigns.add(_notEating);
  if (observedSigns.isEmpty) observedSigns.add(_healthy);

  final advice = <String>{
    if (tags.contains('fire') ||
        tags.contains('smoke') ||
        tags.contains('trapped'))
      _adviceYourSafety,
    if (tags.contains('burned')) ...[_adviceCool, _adviceNoOintment],
    if (tags.contains('smoke') || tags.contains('breathing')) _adviceSmoke,
    if (tags.contains('bleeding') || answers[FollowUpId.bleeding] == true)
      _advicePressure,
    if (tags.contains('dehydrated') ||
        tags.contains('heat') ||
        tags.contains('burned'))
      _adviceWater,
    if (tags.contains('young')) _adviceWarm,
    if (input.count > 2 && _herdSpecies.contains(input.species)) _adviceHerd,
    if (triage != Triage.stable) _adviceDistance,
  };
  // Five at most, but the last two always stay: no medication, see a vet. (The
  // web cut the list at five and could drop the vet.)
  const closing = [_adviceNoFood, _adviceVet];
  final safetyAdvice = [...advice.take(5 - closing.length), ...closing];

  final help = <HelpType>{
    if (tags.any(
          const {
            'injured', 'bleeding', 'burned', 'breathing', 'limping',
            'coughing', 'eyes', 'skin', 'not-eating', //
          }.contains,
        ) ||
        triage == Triage.urgent)
      HelpType.medical,
    if (tags.any(const {'trapped', 'injured', 'burned', 'bleeding'}.contains))
      HelpType.transport,
    if (tags.any(const {'trapped', 'lost'}.contains)) HelpType.search,
    if (tags.any(
      const {'needs-food', 'dehydrated', 'thin', 'evacuated'}.contains,
    ))
      HelpType.food,
    if (tags.any(const {'needs-shelter', 'evacuated'}.contains))
      HelpType.boarding,
    if (tags.any(const {'abandoned', 'young'}.contains)) HelpType.foster,
  };
  if (help.isEmpty) help.add(HelpType.foster);

  // What is still worth asking: the most important first, at most two, never
  // what the report already says.
  final injured = tags.any(_injuredTags.contains) || ruleHit;
  final followUps =
      [
        if (injured && answers[FollowUpId.conscious] == null)
          FollowUpId.conscious,
        if (injured &&
            !tags.contains('bleeding') &&
            answers[FollowUpId.bleeding] == null)
          FollowUpId.bleeding,
        if ((injured || tags.contains('young')) &&
            !tags.contains('limping') &&
            answers[FollowUpId.walk] == null)
          FollowUpId.walk,
        if (tags.any(const {'thin', 'lost', 'abandoned', 'young'}.contains) &&
            !tags.any(const {'not-eating', 'dehydrated'}.contains) &&
            answers[FollowUpId.eating] == null)
          FollowUpId.eating,
      ].take(2).toList();

  return AIAnalysis(
    triage: triage,
    // Rules give no confidence figure; the result screen does not show one.
    confidence: 0,
    summary: _summary(triage, input.speciesName, input.count),
    observedSigns: observedSigns,
    safetyAdvice: safetyAdvice,
    possiblyContagious: contagious,
    contagionAdvice:
        contagious ? const [_adviceIsolate, _adviceBowls, _adviceHands] : null,
    recommendedHelp: help.toList(),
    forcedUrgentByRule: forcedUrgentByRule,
    followUps: followUps.isEmpty ? null : followUps,
    disclaimer: disclaimer,
    model: 'rules',
  );
}
