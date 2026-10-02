import type { HelpType, ServiceType, Species, Triage } from "./types";

export const SPECIES_EMOJI: Record<Species, string> = {
  dog: "/3d/dog.png",
  cat: "/3d/cat.png",
  bird: "/3d/bird.png",
  horse: "/3d/horse.png",
  cow: "/3d/cow.png",
  sheep: "/3d/sheep.png",
  goat: "/3d/goat.png",
  camel: "/3d/camel.png",
  donkey: "/3d/donkey.png",
  rabbit: "/3d/rabbit.png",
  chicken: "/3d/chicken.png",
  other: "/3d/paw.png",
};

export const LIVESTOCK: Species[] = ["horse", "cow", "sheep", "goat", "camel", "donkey", "chicken"];
export const COMPANION: Species[] = ["dog", "cat", "bird", "rabbit"];
export const ALL_SPECIES: Species[] = [...COMPANION, ...LIVESTOCK];

export const TRIAGE_ORDER: Record<Triage, number> = { urgent: 0, monitoring: 1, stable: 2 };

export const TRIAGE_COLOR: Record<Triage, string> = {
  urgent: "var(--urgent)",
  monitoring: "var(--monitor)",
  stable: "var(--stable)",
};

/** Raw hex for places CSS variables can't reach (map paint, canvas). */
export const TRIAGE_HEX: Record<Triage, string> = {
  urgent: "#ff3b30",
  monitoring: "#ff9500",
  stable: "#34c759",
};

export const HELP_EMOJI: Record<HelpType, string> = {
  transport: "/3d/truck.png",
  foster: "/3d/home.png",
  food: "/3d/bowl.png",
  medical: "/3d/stethoscope.png",
  search: "/3d/owl.png",
  boarding: "/3d/tent.png",
  funds: "/3d/heart.png",
};

export const SERVICE_EMOJI: Record<ServiceType, string> = {
  vet: "/3d/stethoscope.png",
  shelter: "/3d/home.png",
  transport: "/3d/truck.png",
  boarding: "/3d/tent.png",
  training: "/3d/bone.png",
  store: "/3d/bowl.png",
};

export const SERVICE_COLOR: Record<ServiceType, string> = {
  vet: "#0a7cff",
  shelter: "#af52de",
  transport: "#ff9500",
  boarding: "#32ade6",
  training: "#34c759",
  store: "#ff2d55",
};
