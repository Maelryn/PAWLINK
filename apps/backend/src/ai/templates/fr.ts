import type { AiTemplates } from './types';

/** French templates — verbatim from `apps/web/lib/i18n/fr.ts`. The default language. */
export const fr: AiTemplates = {
  species: {
    dog: 'Chien',
    cat: 'Chat',
    bird: 'Oiseau',
    horse: 'Cheval',
    cow: 'Vache',
    sheep: 'Mouton',
    goat: 'Chèvre',
    camel: 'Dromadaire',
    donkey: 'Âne',
    rabbit: 'Lapin',
    chicken: 'Volaille',
    other: 'Autre',
  },
  summaries: {
    urgent: (species, n) =>
      n > 1
        ? `${n} animaux (${species.toLowerCase()}) semblent en danger immédiat. Faire venir un vétérinaire ou une équipe de secours est la priorité.`
        : `L'animal (${species.toLowerCase()}) semble en danger immédiat. Faire venir un vétérinaire ou une équipe de secours est la priorité.`,
    monitoring: (species, n) =>
      n > 1
        ? `${n} animaux (${species.toLowerCase()}) ont besoin d'attention rapidement, mais la situation semble maîtrisée pour l'instant.`
        : `L'animal (${species.toLowerCase()}) a besoin d'attention rapidement, mais la situation semble maîtrisée pour l'instant.`,
    stable: (species, n) =>
      n > 1
        ? `${n} animaux (${species.toLowerCase()}) semblent en sécurité. Prochaine étape : nourriture et abri.`
        : `L'animal (${species.toLowerCase()}) semble en sécurité. Prochaine étape : nourriture et abri.`,
  },
  signsMap: {
    trapped: "L'animal ne peut pas s'éloigner seul",
    smoke: 'Exposition à la fumée signalée',
    fire: "Feu à proximité de l'animal",
    burned: 'Traces de brûlures visibles',
    injured: 'Signes de blessure ou de douleur',
    bleeding: 'Saignement actif signalé',
    stressed: 'Signes de stress ou de panique',
    lost: 'Séparé de son propriétaire',
    breathing: 'Difficultés respiratoires',
    abandoned: 'Laissé sans personne',
    young: 'Animaux très jeunes',
    evacuated: 'Déjà évacué en sécurité',
    'needs-food': 'Peu de nourriture',
    'needs-shelter': "Pas d'abri adapté",
    thin: 'Perte de poids visible',
    eyes: 'Écoulement des yeux',
    sneezing: 'Éternuements fréquents',
    dehydrated: 'Déshydratation possible',
    healthy: 'Aucun problème visible',
    skin: 'Perte de poils ou lésions',
    itching: 'Se gratte beaucoup',
    limping: 'Boiterie',
    coughing: 'Toux',
    'not-eating': 'Appétit réduit',
    heat: 'Forte exposition à la chaleur',
  },
  advice: {
    distance: 'Approchez doucement et gardez vos distances : un animal effrayé peut mordre ou ruer.',
    noFood: 'Ne donnez pas de médicaments humains et ne forcez pas à manger.',
    cool: "Mettez l'animal à l'ombre et refroidissez les brûlures à l'eau propre tiède, jamais de glace.",
    noOintment: 'Ne mettez ni crème, ni huile, ni beurre sur les brûlures.',
    smoke: "Amenez l'animal à l'air frais dès que c'est sans danger pour vous.",
    pressure: 'En cas de saignement, appuyez doucement un tissu propre sur la plaie.',
    water: "Proposez de l'eau fraîche en petite quantité, souvent.",
    warm: 'Gardez les petits au chaud et ensemble.',
    yourSafety: 'N\'entrez jamais dans une zone de feu. Suivez les consignes de la Protection civile.',
    isolate: 'Séparez les animaux malades des autres si vous le pouvez.',
    bowls: "Ne partagez pas les gamelles de nourriture ou d'eau.",
    hands: 'Lavez-vous les mains après chaque contact, portez des gants si possible.',
    vet: 'Contactez un vétérinaire dès que possible.',
    herd: 'Gardez le troupeau groupé et calme, évitez les bruits forts.',
  },
  disclaimer: "L'IA PawLink ne pose pas de diagnostic. Contactez toujours un vétérinaire.",
};
