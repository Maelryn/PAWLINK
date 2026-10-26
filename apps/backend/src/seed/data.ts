import type { AdoptionProfile, Case, EmergencyZone, Review, Service, User, UserLite } from "../shared/types";

/* Demo scenario: wildfire in Kabylie (Tizi Ouzou) + everyday cases across Algeria.
   All names, places of business and phone numbers below are fictional demo data. */

const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

export const USERS: User[] = [
  { id: "u1", name: "Yasmine Belkacem", avatar: "", role: "reporter", email: "yasmine@pawlink.dz", phoneVerified: true },
  { id: "u2", name: "Amine Haddad", avatar: "", role: "volunteer", email: "amine@pawlink.dz", phoneVerified: true, helpTypes: ["transport", "search"], rating: 4.9, location: { lat: 36.66, lng: 4.12 } },
  { id: "u3", name: "Dr. Meriem Taleb", avatar: "", role: "vet", email: "dr.taleb@pawlink.dz", phoneVerified: true, licenseVerified: true, helpTypes: ["medical"], rating: 5, location: { lat: 36.6352, lng: 4.1951 }, serviceId: "s2", city: "Larbaâ Nath Irathen", phone: "+213 26 00 00 02", pro: { plan: "pro", since: "2026-09-01T00:00:00.000Z", until: "2026-12-01T00:00:00.000Z" } },
  { id: "u4", name: "Sofiane Meziane", avatar: "", role: "volunteer", email: "sofiane@pawlink.dz", phoneVerified: true, helpTypes: ["foster", "food"], rating: 4.8, location: { lat: 36.6431, lng: 4.1712 } },
  { id: "u5", name: "Lydia Ait Ali", avatar: "", role: "volunteer", email: "lydia@pawlink.dz", phoneVerified: true, helpTypes: ["transport", "food"], rating: 4.7, location: { lat: 36.6588, lng: 4.2552 } },
  { id: "u6", name: "Dr. Rachid Amrani", avatar: "", role: "vet", email: "dr.amrani@pawlink.dz", phoneVerified: true, licenseVerified: true, helpTypes: ["medical"], rating: 4.9, location: { lat: 36.7445, lng: 3.0362 } },
  { id: "u7", name: "Nour Benali", avatar: "", role: "reporter", email: "nour@pawlink.dz", phoneVerified: true },
  { id: "u8", name: "Karim Saadi", avatar: "", role: "volunteer", email: "karim@pawlink.dz", phoneVerified: true, helpTypes: ["boarding", "foster"], rating: 4.6, location: { lat: 36.7631, lng: 2.8512 } },
  { id: "u9", name: "Ines Khelifi", avatar: "", role: "admin", email: "ines@pawlink.dz", phoneVerified: true },
  { id: "u10", name: "Mehdi Ouali", avatar: "", role: "volunteer", email: "mehdi@pawlink.dz", phoneVerified: true, helpTypes: ["search", "transport"], rating: 4.8, location: { lat: 36.6702, lng: 4.2205 } },
  { id: "u11", name: "Compte récent", avatar: "", role: "reporter", email: "nouveau@pawlink.dz", phoneVerified: false },
];

/** Demo accounts (mock auth only; the real API uses hashed passwords + JWT). Same password for all. */
export const DEMO_PASSWORD = "pawlink2026";

const lite = (id: string): UserLite => {
  const u = USERS.find((x) => x.id === id)!;
  return { id: u.id, name: u.name, avatar: u.avatar };
};

export const EMERGENCY_ZONES: EmergencyZone[] = [
  {
    id: "z1",
    name: "Feux de forêt — Larbaâ Nath Irathen",
    region: "Tizi Ouzou, Kabylie",
    type: "wildfire",
    center: { lat: 36.632, lng: 4.205 },
    active: true,
    startedAt: ago(340),
    stats: { cases: 14, urgent: 8, helpers: 37 },
    polygon: {
      type: "Polygon",
      coordinates: [
        [
          [4.118, 36.668],
          [4.162, 36.692],
          [4.228, 36.689],
          [4.284, 36.664],
          [4.312, 36.622],
          [4.296, 36.578],
          [4.248, 36.561],
          [4.188, 36.568],
          [4.139, 36.594],
          [4.112, 36.632],
          [4.118, 36.668],
        ],
      ],
    },
  },
];

let n = 0;
const id = () => `c${++n}`;

export const CASES: Case[] = [
  // ── Wildfire zone (Kabylie) ──
  {
    id: id(), title: "Troupeau de moutons piégé", species: "sheep", category: "livestock", count: 23,
    status: "open", triage: "urgent", emergencyZoneId: "z1",
    location: { lat: 36.6512, lng: 4.1843, address: "Irdjen, Tizi Ouzou" },
    photos: ["/mock/sheep-1.jpg"],
    description: "Un troupeau d'environ 23 moutons est encerclé par la fumée près d'une bergerie. Le berger a dû évacuer. Le feu est à 300 m.",
    conditionTags: ["trapped", "smoke", "fire"],
    reporter: lite("u1"), helpers: [{ user: lite("u2"), helpType: "transport" }],
    createdAt: ago(12), updatedAt: ago(4),
  },
  {
    id: id(), title: "Chien brûlé aux pattes", species: "dog", category: "companion",
    status: "in_progress", triage: "urgent", emergencyZoneId: "z1",
    location: { lat: 36.6378, lng: 4.2021, address: "Larbaâ Nath Irathen" },
    photos: ["/mock/dog-brown.jpg"],
    description: "Chien adulte avec des brûlures visibles aux pattes avant, il boite et refuse de bouger. Il est calme mais semble souffrir.",
    conditionTags: ["burned", "injured"],
    reporter: lite("u7"), helpers: [{ user: lite("u3"), helpType: "medical" }],
    createdAt: ago(26), updatedAt: ago(9),
  },
  {
    id: id(), title: "Chèvres coincées dans un ravin", species: "goat", category: "livestock", count: 6,
    status: "open", triage: "urgent", emergencyZoneId: "z1",
    location: { lat: 36.6205, lng: 4.2338, address: "Aït Aggouacha" },
    photos: ["/mock/goat-1.jpg"],
    description: "Six chèvres coincées dans un ravin, accès difficile. La fumée se rapproche. Besoin d'une équipe avec cordes.",
    conditionTags: ["trapped", "smoke"],
    reporter: lite("u10"), helpers: [],
    createdAt: ago(34), updatedAt: ago(34),
  },
  {
    id: id(), title: "Vache blessée au bord de la route", species: "cow", category: "livestock",
    status: "open", triage: "urgent", emergencyZoneId: "z1",
    location: { lat: 36.6025, lng: 4.2611, address: "Route de Aïn El Hammam" },
    photos: ["/mock/cow-2.jpg"],
    description: "Vache avec une plaie qui saigne à la patte arrière, elle s'est échappée de l'étable en feu.",
    conditionTags: ["bleeding", "injured"],
    reporter: lite("u5"), helpers: [],
    createdAt: ago(41), updatedAt: ago(41),
  },
  {
    id: id(), title: "Cheval désorienté", species: "horse", category: "livestock",
    status: "open", triage: "monitoring", emergencyZoneId: "z1",
    location: { lat: 36.6702, lng: 4.2205, address: "Tizi Rached" },
    photos: ["/mock/horse-1.jpg"],
    description: "Cheval seul, très agité, sans blessure visible. Il tourne en rond près d'un champ brûlé.",
    conditionTags: ["stressed", "lost"],
    reporter: lite("u1"), helpers: [{ user: lite("u10"), helpType: "search" }],
    createdAt: ago(55), updatedAt: ago(20),
  },
  {
    id: id(), title: "Âne qui respire difficilement", species: "donkey", category: "livestock",
    status: "open", triage: "urgent", emergencyZoneId: "z1",
    location: { lat: 36.5862, lng: 4.2184, address: "Aït Yahia" },
    photos: [],
    description: "Âne qui tousse et respire mal après avoir inhalé de la fumée. Il est couché.",
    conditionTags: ["smoke", "breathing"],
    reporter: lite("u7"), helpers: [],
    createdAt: ago(18), updatedAt: ago(18),
  },
  {
    id: id(), title: "Chatons sous une maison évacuée", species: "cat", category: "companion", count: 4,
    status: "open", triage: "monitoring", emergencyZoneId: "z1",
    location: { lat: 36.6431, lng: 4.1712, address: "Village Taourirt" },
    photos: ["/mock/cat-kitten.jpg"],
    description: "Quatre chatons cachés sous une maison évacuée, la mère n'est pas visible. Ils semblent en bonne santé mais seuls.",
    conditionTags: ["abandoned", "young"],
    reporter: lite("u4"), helpers: [{ user: lite("u4"), helpType: "foster" }],
    createdAt: ago(63), updatedAt: ago(30),
  },
  {
    id: id(), title: "Poules sauvées, besoin de nourriture", species: "chicken", category: "livestock", count: 30,
    status: "in_progress", triage: "stable", emergencyZoneId: "z1",
    location: { lat: 36.6588, lng: 4.2552, address: "Aït Frah" },
    photos: [],
    description: "Une trentaine de poules évacuées, en sécurité dans une cour. Besoin de grain et d'eau pour 3 jours.",
    conditionTags: ["evacuated", "needs-food"],
    reporter: lite("u5"), helpers: [{ user: lite("u5"), helpType: "food" }],
    createdAt: ago(120), updatedAt: ago(45),
  },
  {
    id: id(), title: "Chien perdu pendant l'évacuation", species: "dog", category: "companion",
    status: "open", triage: "monitoring", emergencyZoneId: "z1",
    location: { lat: 36.6141, lng: 4.1888, address: "Larbaâ Nath Irathen — sortie sud" },
    photos: ["/mock/dog-aussie.jpg"],
    description: "Chien de famille séparé de ses maîtres pendant l'évacuation. Collier bleu, répond au nom de Rocky.",
    conditionTags: ["lost"],
    reporter: lite("u7"), helpers: [{ user: lite("u2"), helpType: "search" }],
    createdAt: ago(95), updatedAt: ago(60),
  },
  {
    id: id(), title: "Brebis avec brûlures légères", species: "sheep", category: "livestock", count: 3,
    status: "open", triage: "monitoring", emergencyZoneId: "z1",
    location: { lat: 36.5965, lng: 4.2402, address: "Tikjda (piémont)" },
    photos: ["/mock/sheep-1.jpg"],
    description: "Trois brebis avec la laine roussie, elles mangent et marchent normalement.",
    conditionTags: ["burned"],
    reporter: lite("u10"), helpers: [],
    createdAt: ago(140), updatedAt: ago(140),
  },
  {
    id: id(), title: "Vaches évacuées, besoin d'abri", species: "cow", category: "livestock", count: 8,
    status: "in_progress", triage: "stable", emergencyZoneId: "z1",
    location: { lat: 36.6801, lng: 4.1602, address: "Mekla (limite zone)" },
    photos: ["/mock/cow-1.jpg"],
    description: "Huit vaches évacuées, en bonne santé, besoin d'un enclos temporaire et de foin.",
    conditionTags: ["evacuated", "needs-shelter"],
    reporter: lite("u1"), helpers: [{ user: lite("u8"), helpType: "boarding" }],
    createdAt: ago(200), updatedAt: ago(90),
  },
  {
    id: id(), title: "Chat coincé sur un toit", species: "cat", category: "companion",
    status: "open", triage: "urgent", emergencyZoneId: "z1",
    location: { lat: 36.6289, lng: 4.2152, address: "Larbaâ Nath Irathen — centre" },
    photos: ["/mock/cat-orange.jpg"],
    description: "Chat coincé sur le toit d'une maison, la fumée est très dense. Il miaule sans arrêt.",
    conditionTags: ["trapped", "smoke"],
    reporter: lite("u4"), helpers: [],
    createdAt: ago(7), updatedAt: ago(7),
  },

  // ── Alger ──
  {
    id: id(), title: "Chienne et ses chiots à Bab El Oued", species: "dog", category: "companion", count: 5,
    status: "open", triage: "monitoring",
    location: { lat: 36.7905, lng: 3.0512, address: "Bab El Oued, Alger" },
    photos: ["/mock/dog-puppy.jpg"],
    description: "Une chienne avec 4 chiots dans un parking. Elle est maigre, les chiots semblent avoir 3 semaines.",
    conditionTags: ["young", "thin"],
    reporter: lite("u7"), helpers: [{ user: lite("u4"), helpType: "food" }],
    createdAt: ago(180), updatedAt: ago(100),
  },
  {
    id: id(), title: "Chat percuté par une voiture", species: "cat", category: "companion",
    status: "in_progress", triage: "urgent",
    location: { lat: 36.7421, lng: 3.0301, address: "Hydra, Alger" },
    photos: ["/mock/cat-tabby.jpg"],
    description: "Chat percuté par une voiture, il ne pose pas la patte arrière gauche. Saignement léger au museau.",
    conditionTags: ["injured", "bleeding"],
    reporter: lite("u1"), helpers: [{ user: lite("u6"), helpType: "medical" }],
    createdAt: ago(48), updatedAt: ago(15),
  },
  {
    id: id(), title: "Chat avec infection aux yeux", species: "cat", category: "companion",
    status: "open", triage: "monitoring",
    location: { lat: 36.7213, lng: 3.0858, address: "Kouba, Alger" },
    photos: ["/mock/cat-bw.jpg"],
    description: "Chat errant avec les yeux qui coulent et éternuements fréquents. Il vit avec d'autres chats du quartier.",
    conditionTags: ["eyes", "sneezing"],
    reporter: lite("u7"), helpers: [],
    createdAt: ago(260), updatedAt: ago(260),
  },
  {
    id: id(), title: "Chien abandonné attaché", species: "dog", category: "companion",
    status: "open", triage: "monitoring",
    location: { lat: 36.7176, lng: 3.1834, address: "Bab Ezzouar, Alger" },
    photos: ["/mock/dog-white.jpg"],
    description: "Chien attaché à un poteau depuis hier soir, sans eau. Il est gentil et en bonne forme apparente.",
    conditionTags: ["abandoned", "dehydrated"],
    reporter: lite("u1"), helpers: [],
    createdAt: ago(90), updatedAt: ago(90),
  },
  {
    id: id(), title: "Chaton nourri, cherche famille", species: "cat", category: "companion",
    status: "resolved", triage: "stable",
    location: { lat: 36.7672, lng: 3.0298, address: "El Biar, Alger" },
    photos: ["/mock/cat-ginger.jpg"],
    description: "Chaton récupéré, vermifugé, il est prêt pour l'adoption.",
    conditionTags: ["healthy"],
    reporter: lite("u4"), helpers: [{ user: lite("u4"), helpType: "foster" }],
    createdAt: ago(1440), updatedAt: ago(300),
  },
  {
    id: id(), title: "Chiot avec la gale", species: "dog", category: "companion",
    status: "open", triage: "monitoring",
    location: { lat: 36.7311, lng: 3.0522, address: "Bir Mourad Raïs, Alger" },
    photos: ["/mock/dog-jack.jpg"],
    description: "Chiot avec perte de poils et démangeaisons importantes. Il joue avec d'autres chiens du quartier.",
    conditionTags: ["skin", "itching"],
    reporter: lite("u7"), helpers: [],
    createdAt: ago(330), updatedAt: ago(330),
  },

  // ── Ailleurs en Algérie ──
  {
    id: id(), title: "Chien errant blessé au port", species: "dog", category: "companion",
    status: "open", triage: "urgent",
    location: { lat: 35.7058, lng: -0.6415, address: "Port d'Oran" },
    photos: ["/mock/dog-beagle.jpg"],
    description: "Chien avec une plaie ouverte au cou, il saigne. Il se laisse approcher.",
    conditionTags: ["bleeding", "injured"],
    reporter: lite("u1"), helpers: [],
    createdAt: ago(22), updatedAt: ago(22),
  },
  {
    id: id(), title: "Chats du quartier à nourrir", species: "cat", category: "companion", count: 7,
    status: "in_progress", triage: "stable",
    location: { lat: 35.6971, lng: -0.6337, address: "Oran centre" },
    photos: ["/mock/cat-tabby-2.jpg"],
    description: "Colonie de 7 chats en bonne santé, besoin de croquettes pour la semaine.",
    conditionTags: ["needs-food"],
    reporter: lite("u4"), helpers: [{ user: lite("u5"), helpType: "food" }],
    createdAt: ago(600), updatedAt: ago(200),
  },
  {
    id: id(), title: "Cheval de calèche épuisé", species: "horse", category: "livestock",
    status: "open", triage: "monitoring",
    location: { lat: 36.3651, lng: 6.6147, address: "Constantine" },
    photos: ["/mock/horse-1.jpg"],
    description: "Cheval très maigre et épuisé, il boite légèrement. Il travaille encore tous les jours.",
    conditionTags: ["thin", "limping"],
    reporter: lite("u7"), helpers: [],
    createdAt: ago(400), updatedAt: ago(400),
  },
  {
    id: id(), title: "Chèvres avec toux", species: "goat", category: "livestock", count: 12,
    status: "open", triage: "monitoring",
    location: { lat: 36.7509, lng: 5.0567, address: "Béjaïa" },
    photos: ["/mock/goat-1.jpg"],
    description: "Plusieurs chèvres du troupeau toussent et mangent moins depuis 3 jours.",
    conditionTags: ["coughing", "not-eating"],
    reporter: lite("u10"), helpers: [],
    createdAt: ago(720), updatedAt: ago(720),
  },
  {
    id: id(), title: "Moutons sans eau", species: "sheep", category: "livestock", count: 40,
    status: "open", triage: "urgent",
    location: { lat: 34.6728, lng: 3.2631, address: "Djelfa" },
    photos: ["/mock/sheep-1.jpg"],
    description: "Le point d'eau du troupeau est à sec depuis 2 jours, forte chaleur. Plusieurs bêtes sont faibles.",
    conditionTags: ["dehydrated", "heat"],
    reporter: lite("u5"), helpers: [{ user: lite("u2"), helpType: "transport" }],
    createdAt: ago(75), updatedAt: ago(40),
  },
  {
    id: id(), title: "Dromadaire blessé à la patte", species: "camel", category: "livestock",
    status: "open", triage: "monitoring",
    location: { lat: 32.4909, lng: 3.6735, address: "Ghardaïa" },
    photos: [],
    description: "Dromadaire avec une coupure à la patte avant, il marche encore. Besoin d'un vétérinaire.",
    conditionTags: ["injured"],
    reporter: lite("u1"), helpers: [],
    createdAt: ago(500), updatedAt: ago(500),
  },
  {
    id: id(), title: "Chien fugueur retrouvé", species: "dog", category: "companion",
    status: "resolved", triage: "stable",
    location: { lat: 36.4701, lng: 2.8277, address: "Blida" },
    photos: ["/mock/dog-pair.jpg"],
    description: "Chien retrouvé en bonne santé, en attente que ses maîtres le récupèrent.",
    conditionTags: ["healthy"],
    reporter: lite("u7"), helpers: [{ user: lite("u8"), helpType: "boarding" }],
    createdAt: ago(2000), updatedAt: ago(800),
  },
  {
    id: id(), title: "Vache qui ne mange plus", species: "cow", category: "livestock",
    status: "open", triage: "monitoring",
    location: { lat: 36.1911, lng: 5.4137, address: "Sétif" },
    photos: ["/mock/cow-2.jpg"],
    description: "Vache laitière qui ne mange plus depuis hier et reste couchée.",
    conditionTags: ["not-eating"],
    reporter: lite("u5"), helpers: [],
    createdAt: ago(240), updatedAt: ago(240),
  },
];

const VERIFIED = (confirmations: number): Case["trust"] => ({
  level: "verified",
  score: 0.92,
  confirmations,
  flags: 0,
  checks: [
    { id: "account", ok: true },
    { id: "inAlgeria", ok: true },
    { id: "photoGps", ok: true },
    { id: "photoFresh", ok: true },
    { id: "onSite", ok: true },
    { id: "animalDetected", ok: true },
    { id: "duplicate", ok: true },
  ],
});
CASES.forEach((c, i) => {
  c.trust = VERIFIED((i * 7) % 5);
  c.moderation = "approved";
});

// A low-trust report waiting in the moderation queue (fresh account, recycled photo, pin far from the phone).
CASES.push({
  id: id(), title: "Lion blessé sur la plage", species: "other", category: "companion",
  status: "open", triage: "urgent",
  location: { lat: 36.7952, lng: 3.0211, address: "Plage de Bab El Oued" },
  photos: ["/mock/dog-beagle.jpg"],
  description: "Il y a un lion blessé sur la plage venez vite !!!",
  conditionTags: ["injured"],
  reporter: lite("u11"), helpers: [],
  reporterOnSite: false,
  moderation: "pending",
  trust: {
    level: "suspicious",
    score: 0.18,
    confirmations: 0,
    flags: 3,
    checks: [
      { id: "account", ok: false },
      { id: "inAlgeria", ok: true },
      { id: "photoGps", ok: false },
      { id: "photoFresh", ok: false },
      { id: "onSite", ok: false },
      { id: "animalDetected", ok: true },
      { id: "duplicate", ok: false },
    ],
  },
  createdAt: ago(16), updatedAt: ago(16),
});

export const SERVICES: Service[] = [
  { id: "s1", type: "vet", name: "Clinique Vétérinaire des Oliviers", location: { lat: 36.7102, lng: 4.0512, address: "Tizi Ouzou" }, phone: "+213 26 00 00 01", openNow: true, rating: 4.9, reviewCount: 214, tags: ["24/7", "Urgences", "Grands animaux"] },
  { id: "s2", type: "vet", name: "Cabinet Dr. Taleb", location: { lat: 36.6352, lng: 4.1951, address: "Larbaâ Nath Irathen" }, phone: "+213 26 00 00 02", openNow: true, rating: 4.8, reviewCount: 96, tags: ["Urgences", "Bétail"] },
  { id: "s3", type: "vet", name: "Clinique Vétérinaire El Biar", location: { lat: 36.7661, lng: 3.0315, address: "El Biar, Alger" }, phone: "+213 23 00 00 03", openNow: true, rating: 4.7, reviewCount: 388, tags: ["Chirurgie", "Chats & chiens"] },
  { id: "s4", type: "vet", name: "Vet Hydra Care", location: { lat: 36.7445, lng: 3.0362, address: "Hydra, Alger" }, phone: "+213 23 00 00 04", openNow: false, rating: 4.6, reviewCount: 152, tags: ["Imagerie", "NAC"] },
  { id: "s5", type: "vet", name: "Clinique Vétérinaire Es-Sénia", location: { lat: 35.6611, lng: -0.6208, address: "Oran" }, phone: "+213 41 00 00 05", openNow: true, rating: 4.5, reviewCount: 120, tags: ["24/7"] },
  { id: "s6", type: "shelter", name: "Refuge Les Pattes de Kabylie", location: { lat: 36.6911, lng: 4.0811, address: "Tizi Ouzou" }, phone: "+213 26 00 00 06", openNow: true, rating: 4.9, reviewCount: 77, tags: ["Chiens", "Chats", "Accueil d'urgence"] },
  { id: "s7", type: "shelter", name: "Refuge Dar El Hayawane", location: { lat: 36.7255, lng: 3.0921, address: "Kouba, Alger" }, phone: "+213 23 00 00 07", openNow: true, rating: 4.8, reviewCount: 301, tags: ["Adoption", "Stérilisation"] },
  { id: "s8", type: "shelter", name: "Ferme refuge Tikjda", location: { lat: 36.4489, lng: 4.1205, address: "Bouira" }, rating: 4.7, reviewCount: 41, tags: ["Bétail", "Chevaux"] },
  { id: "s9", type: "transport", name: "Ambulance Animale Kabylie", location: { lat: 36.6812, lng: 4.1112, address: "Tizi Ouzou" }, phone: "+213 26 00 00 09", openNow: true, rating: 4.9, reviewCount: 58, tags: ["Bétaillère", "24/7"] },
  { id: "s10", type: "transport", name: "PetTaxi Alger", location: { lat: 36.7538, lng: 3.0588, address: "Alger centre" }, phone: "+213 23 00 00 10", openNow: true, rating: 4.6, reviewCount: 133, tags: ["Chats & chiens"] },
  { id: "s11", type: "boarding", name: "Pension Canine Sidi Fredj", location: { lat: 36.7631, lng: 2.8512, address: "Staouéli" }, rating: 4.5, reviewCount: 89, tags: ["Jardin", "Promenades"] },
  { id: "s12", type: "training", name: "École du Chien Blida", location: { lat: 36.4802, lng: 2.8301, address: "Blida" }, rating: 4.7, reviewCount: 64, tags: ["Éducation", "Comportement"] },
  { id: "s13", type: "store", name: "Animalerie Didouche", location: { lat: 36.7651, lng: 3.0491, address: "Didouche Mourad, Alger" }, openNow: true, rating: 4.4, reviewCount: 210, tags: ["Croquettes", "Accessoires"] },
  { id: "s14", type: "store", name: "Aliments Bétail Draâ Ben Khedda", location: { lat: 36.7342, lng: 3.9612, address: "Draâ Ben Khedda" }, openNow: true, rating: 4.6, reviewCount: 37, tags: ["Foin", "Grain"] },
];

// Listing details, verification and Pro (featured) status
const DESCRIPTIONS: Record<string, string> = {
  vet: "Consultations, vaccins, chirurgie et urgences. Chiens, chats et animaux de ferme.",
  shelter: "Accueil, soins et adoption d'animaux abandonnés ou sauvés.",
  transport: "Transport d'animaux blessés ou à adopter, avec cage et bétaillère.",
  boarding: "Garde de chiens et chats pendant vos absences, jardin et promenades.",
  training: "Éducation canine, comportement et socialisation.",
  store: "Nourriture, accessoires et produits d'hygiène pour animaux.",
};
SERVICES.forEach((s) => {
  s.status = "approved";
  s.verified = ["s1", "s2", "s3", "s5", "s6", "s7", "s9"].includes(s.id);
  s.pro = ["s1", "s2", "s9", "s13"].includes(s.id);
  s.description = DESCRIPTIONS[s.type];
  s.hours = s.tags?.includes("24/7") ? "24h/24 · 7j/7" : "Sam–Jeu · 08:30–18:00";
});
SERVICES.find((s) => s.id === "s2")!.ownerId = "u3";

export const REVIEWS: Review[] = [
  { id: "r1", serviceId: "s1", author: lite("u7"), rating: 5, text: "Ils ont soigné mon chien brûlé en pleine nuit pendant les feux. Équipe incroyable.", createdAt: ago(3000) },
  { id: "r2", serviceId: "s1", author: lite("u1"), rating: 5, text: "Très professionnels, ils prennent aussi les moutons et les vaches.", createdAt: ago(9000) },
  { id: "r3", serviceId: "s3", author: lite("u4"), rating: 4, text: "Bon accueil, un peu d'attente le samedi.", createdAt: ago(12000) },
  { id: "r4", serviceId: "s7", author: lite("u8"), rating: 5, text: "Refuge très propre, les animaux sont bien suivis.", createdAt: ago(20000) },
  { id: "r5", serviceId: "s9", author: lite("u5"), rating: 5, text: "Arrivés en 20 minutes pour transporter une vache blessée.", createdAt: ago(5000) },
];

export const ADOPTIONS: AdoptionProfile[] = [
  {
    id: "a1", name: "Simba", species: "dog", breed: "Croisé", sex: "male", ageMonths: 4,
    photos: ["/mock/dog-puppy.jpg"], healthStatus: "En pleine forme",
    vaccinations: [{ name: "CHPPi", date: "2026-08-12" }, { name: "Rage", date: "2026-09-10" }],
    medicalHistory: [{ date: "2026-08-02", note: "Sauvé à Bab El Oued, déshydraté" }, { date: "2026-08-12", note: "Vermifugé et vacciné" }],
    behavior: ["Joueur", "Sociable avec les chats", "Adore les enfants"], careNeeds: ["Sorties quotidiennes", "Éducation de base"],
    story: "Simba a été trouvé avec ses frères et sœurs dans un parking. Il est curieux, câlin et apprend très vite.",
    shelter: { id: "s7", name: "Refuge Dar El Hayawane" }, ownerId: "u1", ownerPhone: "+213 555 00 00 01", status: "approved", createdAt: ago(9000), location: { lat: 36.7255, lng: 3.0921, address: "Kouba, Alger" },
  },
  {
    id: "a2", name: "Zitouna", species: "cat", breed: "Européen", sex: "female", ageMonths: 3,
    photos: ["/mock/cat-kitten.jpg"], healthStatus: "En bonne santé",
    vaccinations: [{ name: "Typhus / Coryza", date: "2026-09-01" }],
    medicalHistory: [{ date: "2026-08-20", note: "Sauvée lors des feux de Kabylie" }],
    behavior: ["Douce", "Un peu timide au début", "Ronronne beaucoup"], careNeeds: ["Intérieur", "Rappel vaccin en octobre"],
    story: "Zitouna a été retrouvée sous une maison évacuée pendant les feux. Elle a repris des forces et cherche un foyer calme.",
    shelter: { id: "s6", name: "Refuge Les Pattes de Kabylie" }, ownerId: "u1", ownerPhone: "+213 555 00 00 01", status: "approved", createdAt: ago(7000), location: { lat: 36.6911, lng: 4.0811, address: "Tizi Ouzou" },
  },
  {
    id: "a3", name: "Pacha", species: "dog", breed: "Berger australien croisé", sex: "male", ageMonths: 26,
    photos: ["/mock/dog-aussie.jpg"], healthStatus: "En pleine forme",
    vaccinations: [{ name: "CHPPi", date: "2026-03-14" }, { name: "Rage", date: "2026-03-14" }],
    medicalHistory: [{ date: "2026-03-01", note: "Abandonné, puce non enregistrée" }, { date: "2026-03-20", note: "Castré" }],
    behavior: ["Énergique", "Très intelligent", "Obéissant"], careNeeds: ["Grand espace", "2h d'activité par jour"],
    story: "Pacha est un chien brillant qui adore apprendre. Parfait pour une famille sportive avec un jardin.",
    shelter: { id: "s7", name: "Refuge Dar El Hayawane" }, ownerId: "u1", ownerPhone: "+213 555 00 00 01", status: "approved", createdAt: ago(9000), location: { lat: 36.7255, lng: 3.0921, address: "Kouba, Alger" },
  },
  {
    id: "a4", name: "Kahwa", species: "cat", breed: "Tigré", sex: "male", ageMonths: 18,
    photos: ["/mock/cat-tabby.jpg"], healthStatus: "Guéri d'une fracture",
    vaccinations: [{ name: "Typhus / Coryza", date: "2026-05-02" }, { name: "Rage", date: "2026-05-02" }],
    medicalHistory: [{ date: "2026-04-10", note: "Fracture de la patte arrière (accident)" }, { date: "2026-06-01", note: "Guérison complète" }],
    behavior: ["Calme", "Indépendant", "Aime les câlins le soir"], careNeeds: ["Pas d'escaliers raides les premiers mois"],
    story: "Kahwa a survécu à un accident de voiture à Hydra. Aujourd'hui il marche parfaitement et attend son humain.",
    shelter: { id: "s7", name: "Refuge Dar El Hayawane" }, ownerId: "u1", ownerPhone: "+213 555 00 00 01", status: "approved", createdAt: ago(9000), location: { lat: 36.7445, lng: 3.0362, address: "Hydra, Alger" },
  },
  {
    id: "a5", name: "Loulou", species: "dog", breed: "Jack Russell", sex: "female", ageMonths: 38,
    photos: ["/mock/dog-jack.jpg"], healthStatus: "Traitée pour la gale — guérie",
    vaccinations: [{ name: "CHPPi", date: "2026-02-11" }, { name: "Rage", date: "2026-02-11" }],
    medicalHistory: [{ date: "2026-01-15", note: "Gale sarcoptique traitée" }, { date: "2026-02-20", note: "Stérilisée" }],
    behavior: ["Affectueuse", "Vive", "Préfère être seule chien"], careNeeds: ["Jouets d'occupation"],
    story: "Loulou a retrouvé son beau pelage après son traitement. Elle est pleine de vie et très attachante.",
    shelter: { id: "s6", name: "Refuge Les Pattes de Kabylie" }, ownerId: "u1", ownerPhone: "+213 555 00 00 01", status: "approved", createdAt: ago(7000), location: { lat: 36.6911, lng: 4.0811, address: "Tizi Ouzou" },
  },
  {
    id: "a6", name: "Sukkar", species: "cat", breed: "Roux", sex: "male", ageMonths: 7,
    photos: ["/mock/cat-ginger.jpg"], healthStatus: "En pleine forme",
    vaccinations: [{ name: "Typhus / Coryza", date: "2026-07-21" }],
    medicalHistory: [{ date: "2026-07-01", note: "Recueilli à El Biar" }],
    behavior: ["Joueur", "Bavard", "Aime les autres chats"], careNeeds: ["Griffoir", "Jeux quotidiens"],
    story: "Sukkar porte bien son nom : il est doux comme le sucre et adore discuter avec tout le monde.",
    shelter: { id: "s7", name: "Refuge Dar El Hayawane" }, ownerId: "u1", ownerPhone: "+213 555 00 00 01", status: "approved", createdAt: ago(9000), location: { lat: 36.7672, lng: 3.0298, address: "El Biar, Alger" },
  },
];

export const STATS = {
  animalsHelped: 12480,
  volunteers: 3215,
  vets: 418,
  wilayas: 58,
};
