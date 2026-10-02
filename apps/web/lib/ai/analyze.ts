import type { Dict } from "../i18n/en";
import { SERVICES, USERS } from "../mock/data";
import type { AIAnalysis, GeoPoint, HelpType, Service, ServiceType, Species, Triage } from "../types";
import { distanceKm, hashHue } from "../utils";

/* Mock provider for the AI triage. Mirrors what the backend (Gemini Flash) returns, including
   the safety-rule layer: certain keywords always force "urgent", whatever the model says. */

export interface AnalyzeInput {
  species: Species;
  count?: number;
  description: string;
  conditionTags: string[];
  location: GeoPoint;
  /** Baseline triage (e.g. already set on a stored case). Rules can only raise it. */
  baseline?: Triage;
}

const URGENT_TAGS = ["trapped", "bleeding", "breathing", "fire", "burned"];
const URGENT_KEYWORDS = [
  // fr
  "saign", "sang", "feu", "brûl", "brul", "piég", "coinc", "respir", "inconscient", "percut", "fractur", "empoison", "convuls",
  // en
  "bleed", "blood", "fire", "burn", "trapped", "stuck", "breath", "unconscious", "hit by", "poison", "seizure",
  // ar / darija
  "نزيف", "دم", "حريق", "نار", "محاصر", "تنفس", "حروق", "مسموم", "ضربتو طوموبيل",
];
const CONTAGIOUS_TAGS = ["eyes", "sneezing", "skin", "itching", "coughing"];
const CONTAGIOUS_KEYWORDS = ["gale", "mange", "toux", "cough", "diarr", "vomi", "teigne", "سعال", "إسهال", "جرب"];
const MONITOR_TAGS = ["injured", "lost", "stressed", "thin", "dehydrated", "limping", "not-eating", "heat", "young", "abandoned", ...CONTAGIOUS_TAGS];

export function analyze(input: AnalyzeInput, t: Dict): AIAnalysis {
  const text = input.description.toLowerCase();
  const tags = input.conditionTags;

  const ruleHit =
    tags.some((x) => URGENT_TAGS.includes(x)) || URGENT_KEYWORDS.some((k) => text.includes(k.toLowerCase()));
  const contagious =
    tags.some((x) => CONTAGIOUS_TAGS.includes(x)) || CONTAGIOUS_KEYWORDS.some((k) => text.includes(k.toLowerCase()));

  let triage: Triage = input.baseline ?? (tags.some((x) => MONITOR_TAGS.includes(x)) || contagious ? "monitoring" : "stable");
  const forcedUrgentByRule = ruleHit && triage !== "urgent";
  if (ruleHit) triage = "urgent";

  const speciesName = t.common.species[input.species];
  const count = input.count ?? 1;

  const observedSigns = tags.map((tag) => t.ai.signsMap[tag]).filter(Boolean);
  if (observedSigns.length === 0) observedSigns.push(t.ai.signsMap.healthy);

  const a = t.ai.advice;
  const advice = new Set<string>();
  if (tags.includes("fire") || tags.includes("smoke") || tags.includes("trapped")) advice.add(a.yourSafety);
  if (tags.includes("burned")) {
    advice.add(a.cool);
    advice.add(a.noOintment);
  }
  if (tags.includes("smoke") || tags.includes("breathing")) advice.add(a.smoke);
  if (tags.includes("bleeding")) advice.add(a.pressure);
  if (tags.includes("dehydrated") || tags.includes("heat") || tags.includes("burned")) advice.add(a.water);
  if (tags.includes("young")) advice.add(a.warm);
  if (count > 2 && ["sheep", "goat", "cow", "camel", "chicken"].includes(input.species)) advice.add(a.herd);
  if (triage !== "stable") advice.add(a.distance);
  advice.add(a.noFood);
  advice.add(a.vet);

  const contagionAdvice = contagious ? [a.isolate, a.bowls, a.hands] : undefined;

  const help = new Set<HelpType>();
  if (tags.some((x) => ["injured", "bleeding", "burned", "breathing", "limping", "coughing", "eyes", "skin", "not-eating"].includes(x)) || triage === "urgent")
    help.add("medical");
  if (tags.some((x) => ["trapped", "injured", "burned", "bleeding"].includes(x))) help.add("transport");
  if (tags.some((x) => ["trapped", "lost"].includes(x))) help.add("search");
  if (tags.some((x) => ["needs-food", "dehydrated", "thin", "evacuated"].includes(x))) help.add("food");
  if (tags.some((x) => ["needs-shelter", "evacuated"].includes(x))) help.add("boarding");
  if (tags.some((x) => ["abandoned", "young"].includes(x))) help.add("foster");
  if (help.size === 0) help.add("foster");

  const wanted: ServiceType[] = ["vet", ...(help.has("transport") ? (["transport"] as const) : []), "shelter"];
  const suggestedServices = nearestServices(input.location, wanted, 3).map(({ s, d }) => ({
    serviceId: s.id,
    type: s.type,
    name: s.name,
    distanceKm: Math.round(d * 10) / 10,
  }));

  // Volunteers / vets nearby whose declared skills match what the case needs
  const suggestedHelpers = USERS.filter((u) => u.location && u.helpTypes && (u.role === "volunteer" || u.role === "vet"))
    .flatMap((u) => {
      const h = u.helpTypes!.find((x) => help.has(x));
      return h ? [{ userId: u.id, name: u.name, helpType: h, distanceKm: Math.round(distanceKm(input.location, u.location!) * 10) / 10 }] : [];
    })
    .filter((x) => x.distanceKm < 60)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 3);

  const seed = hashHue(input.description + input.species) / 360;

  return {
    triage,
    confidence: Math.round((0.8 + seed * 0.16) * 100) / 100,
    summary: t.ai.summaries[triage](speciesName, count),
    observedSigns,
    safetyAdvice: [...advice].slice(0, 5),
    possiblyContagious: contagious,
    contagionAdvice,
    recommendedHelp: [...help],
    suggestedServices,
    suggestedHelpers,
    forcedUrgentByRule,
    disclaimer: t.ai.disclaimer,
    model: "gemini-flash (mock)",
  };
}

export function nearestServices(p: GeoPoint, types: ServiceType[], limit: number) {
  const out: { s: Service; d: number }[] = [];
  for (const type of types) {
    const best = SERVICES.filter((s) => s.type === type)
      .map((s) => ({ s, d: distanceKm(p, s.location) }))
      .sort((x, y) => x.d - y.d)[0];
    if (best) out.push(best);
  }
  return out.slice(0, limit);
}

/** Simulated network latency, so the UI can show its "thinking" sequence. */
export async function analyzeAsync(input: AnalyzeInput, t: Dict, ms = 3200) {
  await new Promise((r) => setTimeout(r, ms));
  return analyze(input, t);
}
