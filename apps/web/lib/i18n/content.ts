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


/* Arabic versions of the same demo cases. */
const AR: Record<string, [title: string, description: string]> = {
  "Troupeau de moutons piégé": ["قطيع أغنام محاصر", "قطيع من نحو 23 رأسًا من الأغنام يحاصره الدخان قرب حظيرة. اضطر الراعي إلى الإخلاء، والنار على بعد 300 متر."],
  "Chien brûlé aux pattes": ["كلب محروق الأرجل", "كلب بالغ بحروق ظاهرة في قائمتيه الأماميتين، يعرج ويرفض الحركة. هادئ لكنه يبدو متألمًا."],
  "Chèvres coincées dans un ravin": ["ماعز عالقة في وادٍ", "ستّ عنزات عالقة في وادٍ يصعب الوصول إليه، والدخان يقترب. نحتاج فريقًا بالحبال."],
  "Vache blessée au bord de la route": ["بقرة مصابة على حافة الطريق", "بقرة بجرح ينزف في قائمتها الخلفية، هربت من إسطبل يحترق."],
  "Cheval désorienté": ["حصان تائه", "حصان وحيد مضطرب جدًا دون إصابة ظاهرة، يدور قرب حقل محترق."],
  "Âne qui respire difficilement": ["حمار يتنفس بصعوبة", "حمار يسعل ويتنفس بصعوبة بعد استنشاق الدخان، وهو مستلقٍ."],
  "Chatons sous une maison évacuée": ["قطط صغيرة تحت منزل مُخلى", "أربع قطط صغيرة مختبئة تحت منزل تم إخلاؤه، والأم غير ظاهرة. تبدو بصحة جيدة لكنها وحيدة."],
  "Poules sauvées, besoin de nourriture": ["دجاج تم إنقاذه يحتاج إلى غذاء", "نحو ثلاثين دجاجة تم إجلاؤها وهي في أمان داخل فناء. تحتاج حبوبًا وماءً لثلاثة أيام."],
  "Chien perdu pendant l'évacuation": ["كلب ضاع أثناء الإخلاء", "كلب عائلة انفصل عن أصحابه أثناء الإخلاء. طوقه أزرق ويستجيب لاسم روكي."],
  "Brebis avec brûlures légères": ["نعاج بحروق خفيفة", "ثلاث نعاج احترق صوفها قليلًا، تأكل وتمشي بشكل طبيعي."],
  "Vaches évacuées, besoin d'abri": ["أبقار تم إجلاؤها تحتاج إلى مأوى", "ثماني بقرات تم إجلاؤها بصحة جيدة، تحتاج حظيرة مؤقتة وتبنًا."],
  "Chat coincé sur un toit": ["قط عالق فوق سطح", "قط عالق فوق سطح منزل والدخان كثيف جدًا. يموء دون توقف."],
  "Chienne et ses chiots à Bab El Oued": ["كلبة وجراؤها في باب الواد", "كلبة مع 4 جراء في موقف سيارات. هي نحيفة، ويبدو عمر الجراء نحو 3 أسابيع."],
  "Chat percuté par une voiture": ["قط صدمته سيارة", "قط صدمته سيارة ولا يضع قائمته الخلفية اليسرى على الأرض. نزيف خفيف من الأنف."],
  "Chat avec infection aux yeux": ["قط مصاب بالتهاب في العينين", "قط شارد عيناه تدمعان ويعطس كثيرًا، يعيش مع قطط أخرى في الحي."],
  "Chien abandonné attaché": ["كلب مهجور مربوط", "كلب مربوط في عمود منذ مساء أمس دون ماء. لطيف ويبدو بحالة جيدة."],
  "Chaton nourri, cherche famille": ["قط صغير يبحث عن عائلة", "قط صغير تم إنقاذه وتطعيمه ضد الديدان، جاهز للتبني."],
  "Chiot avec la gale": ["جرو مصاب بالجرب", "جرو يفقد شعره ويحك جسمه كثيرًا، يلعب مع كلاب أخرى في الحي."],
  "Chien errant blessé au port": ["كلب شارد مصاب في الميناء", "كلب بجرح مفتوح في رقبته ينزف، يسمح بالاقتراب منه."],
  "Chats du quartier à nourrir": ["قطط الحي تحتاج إلى طعام", "مجموعة من 7 قطط بصحة جيدة، تحتاج طعامًا جافًا لأسبوع."],
  "Cheval de calèche épuisé": ["حصان عربة منهك", "حصان نحيف جدًا ومنهك يعرج قليلًا، وما زال يعمل كل يوم."],
  "Chèvres avec toux": ["ماعز تسعل", "عدة عنزات في القطيع تسعل وتأكل أقل منذ 3 أيام."],
  "Moutons sans eau": ["أغنام دون ماء", "نقطة الماء الخاصة بالقطيع جافة منذ يومين مع حرارة شديدة. عدة رؤوس ضعيفة."],
  "Dromadaire blessé à la patte": ["جمل مصاب في قائمته", "جمل بجرح في قائمته الأمامية، ما زال يمشي. يحتاج إلى بيطري."],
  "Chien fugueur retrouvé": ["كلب هارب تم العثور عليه", "كلب عُثر عليه بصحة جيدة، ينتظر أن يأخذه أصحابه."],
  "Vache qui ne mange plus": ["بقرة توقفت عن الأكل", "بقرة حلوب لم تأكل منذ أمس وتبقى مستلقية."],
  "Lion blessé sur la plage": ["أسد مصاب على الشاطئ", "يوجد أسد مصاب على الشاطئ تعالوا بسرعة!!!"],
};

export function caseText(c: Pick<Case, "title" | "description">, locale: Locale) {
  const tr = locale === "en" ? EN[c.title] : locale === "ar" ? AR[c.title] : undefined;
  return tr ? { title: tr[0], description: tr[1] } : { title: c.title, description: c.description };
}

/** Title and description of a case in the visitor's language when we have it. */
export function useCaseText() {
  const { locale } = useI18n();
  return useCallback((c: Pick<Case, "title" | "description">) => caseText(c, locale), [locale]);
}

/* Demo adoption profiles and service listings: short phrases in English and Arabic.
   Anything written by real users is shown as written. */
const PHRASES: Record<string, [en: string, ar: string]> = {
  "Croisé": ["Mixed breed", "هجين"],
  "Européen": ["European shorthair", "أوروبي"],
  "Berger australien croisé": ["Australian Shepherd mix", "راعي أسترالي هجين"],
  "Tigré": ["Tabby", "مخطّط"],
  "Roux": ["Ginger", "برتقالي"],
  "En pleine forme": ["In great shape", "بصحة ممتازة"],
  "En bonne santé": ["Healthy", "بصحة جيدة"],
  "Guéri d'une fracture": ["Recovered from a fracture", "تعافى من كسر"],
  "Traitée pour la gale — guérie": ["Treated for mange, now healed", "عولجت من الجرب وشُفيت"],
  "Sauvé à Bab El Oued, déshydraté": ["Rescued in Bab El Oued, dehydrated", "أُنقذ في باب الواد وكان يعاني من الجفاف"],
  "Vermifugé et vacciné": ["Dewormed and vaccinated", "عولج من الديدان وتم تطعيمه"],
  "Sauvée lors des feux de Kabylie": ["Rescued during the Kabylie fires", "أُنقذت خلال حرائق القبائل"],
  "Abandonné, puce non enregistrée": ["Abandoned, microchip not registered", "مهجور، شريحته غير مسجّلة"],
  "Castré": ["Neutered", "مخصي"],
  "Fracture de la patte arrière (accident)": ["Broken hind leg (accident)", "كسر في القائمة الخلفية (حادث)"],
  "Guérison complète": ["Fully healed", "شفاء تام"],
  "Gale sarcoptique traitée": ["Sarcoptic mange treated", "عولج الجرب"],
  "Stérilisée": ["Spayed", "معقّمة"],
  "Recueilli à El Biar": ["Taken in at El Biar", "تم إيواؤه في الأبيار"],
  "Joueur": ["Playful", "مرح"],
  "Sociable avec les chats": ["Good with cats", "ودود مع القطط"],
  "Adore les enfants": ["Loves children", "يحب الأطفال"],
  "Douce": ["Gentle", "لطيفة"],
  "Un peu timide au début": ["A bit shy at first", "خجولة قليلًا في البداية"],
  "Ronronne beaucoup": ["Purrs a lot", "تخرخر كثيرًا"],
  "Énergique": ["Energetic", "نشيط"],
  "Très intelligent": ["Very smart", "ذكي جدًا"],
  "Obéissant": ["Obedient", "مطيع"],
  "Calme": ["Calm", "هادئ"],
  "Indépendant": ["Independent", "مستقل"],
  "Aime les câlins le soir": ["Loves cuddles in the evening", "يحب الأحضان في المساء"],
  "Affectueuse": ["Affectionate", "حنونة"],
  "Vive": ["Lively", "نشيطة"],
  "Préfère être seule chien": ["Prefers to be the only dog", "تفضّل أن تكون الكلبة الوحيدة"],
  "Bavard": ["Chatty", "كثير المواء"],
  "Aime les autres chats": ["Likes other cats", "يحب القطط الأخرى"],
  "Sorties quotidiennes": ["Daily walks", "نزهات يومية"],
  "Éducation de base": ["Basic training", "تدريب أساسي"],
  "Intérieur": ["Indoors", "داخل المنزل"],
  "Rappel vaccin en octobre": ["Vaccine booster in October", "جرعة تذكيرية في أكتوبر"],
  "Grand espace": ["Lots of space", "مساحة كبيرة"],
  "2h d'activité par jour": ["2 hours of activity a day", "ساعتان من النشاط يوميًا"],
  "Pas d'escaliers raides les premiers mois": ["No steep stairs for the first months", "تجنّب السلالم الشديدة في الأشهر الأولى"],
  "Jouets d'occupation": ["Puzzle toys", "ألعاب ذهنية"],
  "Griffoir": ["Scratching post", "مخدش"],
  "Jeux quotidiens": ["Daily play", "لعب يومي"],
  "Rage": ["Rabies", "داء الكلب"],
  "Typhus / Coryza": ["Feline typhus / flu", "تيفوس وزكام القطط"],
  "Simba a été trouvé avec ses frères et sœurs dans un parking. Il est curieux, câlin et apprend très vite.": ["Simba was found with his brothers and sisters in a car park. He's curious, cuddly and learns very fast.", "عُثر على سيمبا مع إخوته في موقف سيارات. فضولي وحنون ويتعلم بسرعة كبيرة."],
  "Zitouna a été retrouvée sous une maison évacuée pendant les feux. Elle a repris des forces et cherche un foyer calme.": ["Zitouna was found under an evacuated house during the fires. She has regained her strength and is looking for a calm home.", "عُثر على زيتونة تحت منزل تم إخلاؤه أثناء الحرائق. استعادت قوتها وتبحث عن بيت هادئ."],
  "Pacha est un chien brillant qui adore apprendre. Parfait pour une famille sportive avec un jardin.": ["Pacha is a bright dog who loves to learn. Perfect for an active family with a garden.", "باشا كلب ذكي يحب التعلّم. مثالي لعائلة نشيطة لديها حديقة."],
  "Kahwa a survécu à un accident de voiture à Hydra. Aujourd'hui il marche parfaitement et attend son humain.": ["Kahwa survived a car accident in Hydra. Today he walks perfectly and is waiting for his human.", "نجا قهوة من حادث سيارة في حيدرة. اليوم يمشي بشكل ممتاز وينتظر صاحبه."],
  "Loulou a retrouvé son beau pelage après son traitement. Elle est pleine de vie et très attachante.": ["Loulou got her beautiful coat back after her treatment. She's full of life and very endearing.", "استعادت لولو فروها الجميل بعد العلاج. مليئة بالحياة ومحبوبة جدًا."],
  "Sukkar porte bien son nom : il est doux comme le sucre et adore discuter avec tout le monde.": ["Sukkar lives up to his name (it means sugar): he's sweet and loves chatting with everyone.", "سُكّر يحمل اسمه عن جدارة: حلو كالسكر ويحب الدردشة مع الجميع."],
  "Consultations, vaccins, chirurgie et urgences. Chiens, chats et animaux de ferme.": ["Consultations, vaccines, surgery and emergencies. Dogs, cats and farm animals.", "استشارات، تطعيمات، جراحة وطوارئ. كلاب وقطط وحيوانات المزرعة."],
  "Accueil, soins et adoption d'animaux abandonnés ou sauvés.": ["Shelter, care and adoption for abandoned or rescued animals.", "إيواء ورعاية وتبنّي الحيوانات المهجورة أو المُنقذة."],
  "Transport d'animaux blessés ou à adopter, avec cage et bétaillère.": ["Transport for injured animals or animals going to adoption, with crates and a livestock trailer.", "نقل الحيوانات المصابة أو المعروضة للتبنّي بأقفاص وشاحنة مواشي."],
  "Garde de chiens et chats pendant vos absences, jardin et promenades.": ["Dog and cat sitting while you're away, with a garden and walks.", "رعاية الكلاب والقطط أثناء غيابك، مع حديقة ونزهات."],
  "Éducation canine, comportement et socialisation.": ["Dog training, behaviour and socialisation.", "تدريب الكلاب وسلوكها وتعويدها على الاختلاط."],
  "Nourriture, accessoires et produits d'hygiène pour animaux.": ["Food, accessories and hygiene products for animals.", "طعام وإكسسوارات ومنتجات نظافة للحيوانات."],
  "Urgences": ["Emergencies", "طوارئ"],
  "Grands animaux": ["Large animals", "حيوانات كبيرة"],
  "Bétail": ["Livestock", "مواشي"],
  "Chirurgie": ["Surgery", "جراحة"],
  "Chats & chiens": ["Cats & dogs", "قطط وكلاب"],
  "Imagerie": ["Imaging", "تصوير طبي"],
  "NAC": ["Exotic pets", "حيوانات أليفة غير تقليدية"],
  "Chiens": ["Dogs", "كلاب"],
  "Chats": ["Cats", "قطط"],
  "Accueil d'urgence": ["Emergency intake", "استقبال طارئ"],
  "Adoption": ["Adoption", "تبنٍّ"],
  "Stérilisation": ["Sterilisation", "تعقيم"],
  "Chevaux": ["Horses", "خيول"],
  "Bétaillère": ["Livestock trailer", "شاحنة مواشي"],
  "Jardin": ["Garden", "حديقة"],
  "Promenades": ["Walks", "نزهات"],
  "Éducation": ["Training", "تدريب"],
  "Comportement": ["Behaviour", "سلوك"],
  "Croquettes": ["Dry food", "طعام جاف"],
  "Accessoires": ["Accessories", "إكسسوارات"],
  "Foin": ["Hay", "تبن"],
  "Grain": ["Grain", "حبوب"],
  "24h/24 · 7j/7": ["24/7", "24 ساعة · 7 أيام"],
  "Sam–Jeu · 08:30–18:00": ["Sat–Thu · 08:30–18:00", "السبت–الخميس · 08:30–18:00"],
};

export function translateDemo(text: string | undefined, locale: Locale): string {
  if (!text || locale === "fr") return text ?? "";
  const p = PHRASES[text];
  return p ? (locale === "en" ? p[0] : p[1]) : text;
}

/** Translate demo content (breeds, health notes, service tags…) when we have it. */
export function useDemoText() {
  const { locale } = useI18n();
  return useCallback((text: string | undefined) => translateDemo(text, locale), [locale]);
}
