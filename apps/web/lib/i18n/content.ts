"use client";

import { useCallback } from "react";
import type { Case } from "../types";
import { useI18n, type Locale } from "./index";

/* English versions of the demo cases, so an English-speaking visitor doesn't see a mix of
   languages. Keyed by the original French title. Cases written by real users are shown as written. */
const EN: Record<string, [title: string, description: string]> = {
  "Troupeau de moutons piégé": ["Flock of sheep trapped", "A flock of about 23 sheep is surrounded by smoke near a sheepfold. The shepherd had to evacuate. The fire is 300 m away."],
  "Chien brûlé aux pattes": ["Dog with burned paws", "Adult dog with visible burns on its front paws. It limps and refuses to move. It's calm but seems to be in pain."],
  "Chèvres coincées dans un ravin": ["Goats stuck in a ravine", "Six goats stuck in a ravine, hard to reach. The smoke is getting closer. We need a team with ropes."],
  "Vache blessée au bord de la route": ["Injured cow by the road", "Cow with a bleeding wound on its hind leg. It escaped from a burning barn."],
  "Cheval désorienté": ["Disoriented horse", "Horse on its own, very agitated, no visible injury. It keeps circling near a burned field."],
  "Âne qui respire difficilement": ["Donkey struggling to breathe", "Donkey coughing and breathing badly after inhaling smoke. It's lying down."],
  "Chatons sous une maison évacuée": ["Kittens under an evacuated house", "Four kittens hiding under an evacuated house, no mother in sight. They look healthy but alone."],
  "Poules sauvées, besoin de nourriture": ["Rescued hens need food", "About thirty evacuated hens, safe in a courtyard. They need grain and water for 3 days."],
  "Chien perdu pendant l'évacuation": ["Dog lost during the evacuation", "Family dog separated from its owners during the evacuation. Blue collar, answers to Rocky."],
  "Brebis avec brûlures légères": ["Ewes with light burns", "Three ewes with singed wool. They eat and walk normally."],
  "Vaches évacuées, besoin d'abri": ["Evacuated cows need shelter", "Eight evacuated cows in good health. They need a temporary pen and hay."],
  "Chat coincé sur un toit": ["Cat stuck on a roof", "Cat stuck on a house roof, the smoke is very thick. It keeps meowing."],
  "Chienne et ses chiots à Bab El Oued": ["Mother dog and puppies in Bab El Oued", "A mother dog with 4 puppies in a car park. She's thin, the puppies look about 3 weeks old."],
  "Chat percuté par une voiture": ["Cat hit by a car", "Cat hit by a car. It won't put weight on its back left leg. Light bleeding from the nose."],
  "Chat avec infection aux yeux": ["Cat with an eye infection", "Stray cat with runny eyes and frequent sneezing. It lives with other cats in the neighbourhood."],
  "Chien abandonné attaché": ["Abandoned dog tied up", "Dog tied to a post since last night, without water. It's friendly and looks in good shape."],
  "Chaton nourri, cherche famille": ["Fed kitten looking for a family", "Rescued kitten, dewormed, ready for adoption."],
  "Chiot avec la gale": ["Puppy with mange", "Puppy losing fur and scratching a lot. It plays with other dogs in the neighbourhood."],
  "Chien errant blessé au port": ["Injured stray dog at the port", "Dog with an open wound on its neck, it's bleeding. It lets people come close."],
  "Chats du quartier à nourrir": ["Neighbourhood cats to feed", "Colony of 7 healthy cats, they need dry food for the week."],
  "Cheval de calèche épuisé": ["Exhausted carriage horse", "Very thin and exhausted horse, slightly limping. It still works every day."],
  "Chèvres avec toux": ["Coughing goats", "Several goats in the herd have been coughing and eating less for 3 days."],
  "Moutons sans eau": ["Sheep without water", "The herd's water point has been dry for 2 days in strong heat. Several animals are weak."],
  "Dromadaire blessé à la patte": ["Camel with an injured leg", "Camel with a cut on its front leg, it can still walk. It needs a vet."],
  "Chien fugueur retrouvé": ["Runaway dog found", "Dog found in good health, waiting for its owners to pick it up."],
  "Vache qui ne mange plus": ["Cow that stopped eating", "Dairy cow that hasn't eaten since yesterday and stays lying down."],
  "Lion blessé sur la plage": ["Injured lion on the beach", "There's an injured lion on the beach come quick!!!"],
};

export function caseText(c: Pick<Case, "title" | "description">, locale: Locale) {
  const tr = locale === "en" ? EN[c.title] : undefined;
  return tr ? { title: tr[0], description: tr[1] } : { title: c.title, description: c.description };
}

/** Title and description of a case in the visitor's language when we have it. */
export function useCaseText() {
  const { locale } = useI18n();
  return useCallback((c: Pick<Case, "title" | "description">) => caseText(c, locale), [locale]);
}
