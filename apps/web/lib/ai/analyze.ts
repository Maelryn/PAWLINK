import type { Dict } from "../i18n/en";
import { SERVICES, USERS } from "../mock/data";
import type { AIAnalysis, FollowUpId, GeoPoint, HelpType, Service, ServiceType, Species, Triage, User } from "../types";
import { availabilityOf } from "../people";
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
  /** Answers to the quick questions: they can only raise the urgency. */
  answers?: Partial<Record<FollowUpId, boolean>>;
  /** The members to match (defaults to the demo list). */
  people?: User[];
}

const RANK: Triage[] = ["stable", "monitoring", "urgent"];
const raise = (t: Triage, to: Triage) => (RANK.indexOf(to) > RANK.indexOf(t) ? to : t);

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
  // the reporter's answers: not conscious or heavy bleeding = urgent; can't walk = one level up; not eating = at least "to watch"
  const ans = input.answers ?? {};
  const answeredUrgent = ans.conscious === false || ans.bleeding === true;
  if (ans.walk === false) triage = raise(triage, triage === "stable" ? "monitoring" : "urgent");
  if (ans.eating === false) triage = raise(triage, "monitoring");
  const forcedUrgentByRule = (ruleHit || answeredUrgent) && triage !== "urgent";
  if (ruleHit || answeredUrgent) triage = "urgent";

  const speciesName = t.common.species[input.species];
  const count = input.count ?? 1;

  const observedSigns = tags.map((tag) => t.ai.signsMap[tag]).filter(Boolean);
  if (ans.conscious === false) observedSigns.unshift(t.ask.signs.notConscious);
  if (ans.bleeding === true) observedSigns.unshift(t.ask.signs.heavyBleeding);
  if (ans.walk === false) observedSigns.push(t.ask.signs.cantWalk);
  if (ans.eating === false) observedSigns.push(t.ask.signs.notEating);
  if (observedSigns.length === 0) observedSigns.push(t.ai.signsMap.healthy);

  const a = t.ai.advice;
  const advice = new Set<string>();
  if (tags.includes("fire") || tags.includes("smoke") || tags.includes("trapped")) advice.add(a.yourSafety);
  if (tags.includes("burned")) {
    advice.add(a.cool);
    advice.add(a.noOintment);
  }
  if (tags.includes("smoke") || tags.includes("breathing")) advice.add(a.smoke);
  if (tags.includes("bleeding") || ans.bleeding === true) advice.add(a.pressure);
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

  // Members nearby whose skills match what the case needs: the people available now first, never the ones "away".
  // Uses the real member list (new volunteers included), not a fixed demo list.
  const suggestedHelpers = (input.people ?? USERS)
    .filter((u) => u.location && u.helpTypes?.length && (u.role === "volunteer" || u.role === "vet") && availabilityOf(u) !== "away")
    .flatMap((u) => {
      const h = u.helpTypes!.find((x) => help.has(x));
      return h ? [{ userId: u.id, name: u.name, helpType: h, distanceKm: Math.round(distanceKm(input.location, u.location!) * 10) / 10, now: availabilityOf(u) === "now" }] : [];
    })
    .filter((x) => x.distanceKm < 60)
    .sort((a, b) => Number(b.now) - Number(a.now) || a.distanceKm - b.distanceKm)
    .slice(0, 3)
    .map((x) => ({ userId: x.userId, name: x.name, helpType: x.helpType, distanceKm: x.distanceKm }));

  // What's still worth asking: the most important first, at most 2, never what the report already says
  const injured = tags.some((x) => ["injured", "limping", "trapped", "burned", "breathing", "bleeding"].includes(x)) || ruleHit;
  const followUps = (
    [
      injured && ans.conscious === undefined && "conscious",
      injured && !tags.includes("bleeding") && ans.bleeding === undefined && "bleeding",
      (injured || tags.includes("young")) && !tags.includes("limping") && ans.walk === undefined && "walk",
      tags.some((x) => ["thin", "lost", "abandoned", "young"].includes(x)) && !tags.some((x) => ["not-eating", "dehydrated"].includes(x)) && ans.eating === undefined && "eating",
    ].filter(Boolean) as FollowUpId[]
  ).slice(0, 2);

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
    followUps: followUps.length ? followUps : undefined,
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
