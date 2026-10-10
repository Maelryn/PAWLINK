import type { AiTemplates } from './types';

/** English templates — verbatim from `apps/web/lib/i18n/en.ts`. */
export const en: AiTemplates = {
  species: {
    dog: 'Dog',
    cat: 'Cat',
    bird: 'Bird',
    horse: 'Horse',
    cow: 'Cow',
    sheep: 'Sheep',
    goat: 'Goat',
    camel: 'Camel',
    donkey: 'Donkey',
    rabbit: 'Rabbit',
    chicken: 'Poultry',
    other: 'Other',
  },
  summaries: {
    urgent: (species, n) =>
      n > 1
        ? `${n} animals (${species}) appear to be in immediate danger. Getting a vet or rescue team on site is the priority.`
        : `A ${species.toLowerCase()} appears to be in immediate danger. Getting a vet or rescue team on site is the priority.`,
    monitoring: (species, n) =>
      n > 1
        ? `${n} animals (${species}) need attention soon, but the situation looks under control for now.`
        : `This ${species.toLowerCase()} needs attention soon, but the situation looks under control for now.`,
    stable: (species, n) =>
      n > 1
        ? `${n} animals (${species}) look safe. Basic needs like food and shelter are the next step.`
        : `This ${species.toLowerCase()} looks safe. Basic needs like food and shelter are the next step.`,
  },
  signsMap: {
    trapped: 'Animal cannot move away by itself',
    smoke: 'Exposure to smoke reported',
    fire: 'Fire close to the animal',
    burned: 'Visible burn marks',
    injured: 'Signs of injury or pain',
    bleeding: 'Active bleeding reported',
    stressed: 'Signs of stress or panic',
    lost: 'Separated from owner',
    breathing: 'Difficulty breathing',
    abandoned: 'Left without caretaker',
    young: 'Very young animals',
    evacuated: 'Already evacuated to safety',
    'needs-food': 'Low food supply',
    'needs-shelter': 'No proper shelter',
    thin: 'Visible weight loss',
    eyes: 'Discharge from the eyes',
    sneezing: 'Frequent sneezing',
    dehydrated: 'Possible dehydration',
    healthy: 'No visible issue',
    skin: 'Hair loss or skin lesions',
    itching: 'Frequent scratching',
    limping: 'Limping',
    coughing: 'Coughing',
    'not-eating': 'Reduced appetite',
    heat: 'High heat exposure',
  },
  advice: {
    distance: 'Approach slowly and keep a safe distance. A scared animal may bite or kick.',
    noFood: "Don't give human medication or force food.",
    cool: 'Move the animal to shade and cool burns with clean, lukewarm water, never ice.',
    noOintment: "Don't apply creams, oil or butter on burns.",
    smoke: 'Get the animal into fresh air as soon as it is safe for you.',
    pressure: 'If bleeding, press a clean cloth gently on the wound.',
    water: 'Offer small amounts of fresh water, little and often.',
    warm: 'Keep young animals warm and together.',
    yourSafety: 'Never enter a fire zone. Follow Civil Protection instructions.',
    isolate: 'Separate the animal from other animals if you can.',
    bowls: "Don't share food or water bowls with other animals.",
    hands: 'Wash your hands after any contact and wear gloves if possible.',
    vet: 'Contact a veterinarian as soon as possible.',
    herd: 'Keep the herd together and calm; avoid loud noises.',
  },
  disclaimer: 'PawLink AI does not diagnose. Always contact a veterinarian.',
};
