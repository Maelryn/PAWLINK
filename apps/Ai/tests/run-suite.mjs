// tests/run-suite.mjs
// PawLink AI module — automated test suite
//
// Tests are split into two groups:
//   LOCAL   — pure logic, no Gemini API calls (fast, free, always runnable)
//   GOLD    — run all 12 vet cases against the real Gemini API (requires .env)
//
// Usage:
//   node --env-file=.env tests/run-suite.mjs           # all tests
//   node --env-file=.env tests/run-suite.mjs --local   # local tests only

import { readFileSync } from "node:fs";
import { applySafetyRules } from "../src/safety.mjs";
import { toAIAnalysis } from "../src/adapter.mjs";

// ── Minimal isAIAnalysis guard (mirrors the backend's runtime check) ──────────
// We inline it so the test has zero backend dependencies.
const TRIAGE_VALUES = ["urgent", "monitoring", "stable"];
const HELP_TYPES = ["transport", "foster", "food", "medical", "search", "boarding", "funds"];
const SERVICE_TYPES = ["vet", "shelter", "transport", "boarding", "training", "store"];

function isAIAnalysis(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const a = value;
  if (typeof a.triage !== "string" || !TRIAGE_VALUES.includes(a.triage)) return false;
  if (typeof a.confidence !== "number" || !Number.isFinite(a.confidence)) return false;
  if (typeof a.summary !== "string") return false;
  if (!Array.isArray(a.observedSigns) || !a.observedSigns.every((x) => typeof x === "string")) return false;
  if (!Array.isArray(a.safetyAdvice) || !a.safetyAdvice.every((x) => typeof x === "string")) return false;
  if (typeof a.possiblyContagious !== "boolean") return false;
  if (a.contagionAdvice !== undefined && (!Array.isArray(a.contagionAdvice) || !a.contagionAdvice.every((x) => typeof x === "string"))) return false;
  if (!Array.isArray(a.recommendedHelp) || !a.recommendedHelp.every((x) => HELP_TYPES.includes(x))) return false;
  if (!Array.isArray(a.suggestedServices) || !a.suggestedServices.every((s) => {
    if (s === null || typeof s !== "object") return false;
    return typeof s.serviceId === "string" && typeof s.name === "string" && SERVICE_TYPES.includes(s.type) && Number.isFinite(s.distanceKm);
  })) return false;
  if (typeof a.forcedUrgentByRule !== "boolean") return false;
  if (typeof a.disclaimer !== "string" || a.disclaimer.length === 0) return false;
  if (typeof a.model !== "string") return false;
  return true;
}

// ── Simple test runner ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL ${label}${detail ? " — " + detail : ""}`);
    failed++;
    failures.push(`${label}${detail ? ": " + detail : ""}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

// ── Fake Gemini output helpers ────────────────────────────────────────────────

function makeInternalResult(overrides = {}) {
  return {
    schema_version: "0.2",
    is_animal_report: true,
    detected_language: "en",
    animal: { type: "dog", category: "companion" },
    situation_category: "bleeding_wound",
    summary: "Dog with a bleeding leg wound.",
    red_flags: ["heavy_bleeding"],
    hazards: [],
    urgency: "urgent",
    urgency_reason: "Heavy bleeding reported.",
    confidence: "high",
    needs: ["veterinarian"],
    follow_up_questions: [],
    guidance_keys: ["bleeding_pressure", "contact_vet_immediately"],
    forced_urgent_by_rule: false,
    ai_status: "ok",
    needs_human_review: false,
    ...overrides,
  };
}

function makeTriageOutput(resultOverrides = {}, metaOverrides = {}) {
  return {
    result: makeInternalResult(resultOverrides),
    model: "gemini-2.0-flash-lite",
    ms: 1200,
    usage: null,
    ai_status: "ok",
    ...metaOverrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL TESTS — no API calls
// ─────────────────────────────────────────────────────────────────────────────

section("Safety rules — urgency escalation");

{
  // Base result with non-urgent urgency
  const base = makeInternalResult({ urgency: "non_urgent", red_flags: [], confidence: "medium" });

  // EN keyword
  const enResult = applySafetyRules("The dog is not breathing and is unconscious", base);
  assert("EN keyword forces urgent", enResult.urgency === "urgent");
  assert("EN keyword sets forced_urgent_by_rule=true", enResult.forced_urgent_by_rule === true);

  // FR keyword
  const frBase = makeInternalResult({ urgency: "non_urgent", red_flags: [], confidence: "medium" });
  const frResult = applySafetyRules("Le chien saigne beaucoup et ne respire pas", frBase);
  assert("FR keyword forces urgent", frResult.urgency === "urgent");

  // Arabic keyword
  const arBase = makeInternalResult({ urgency: "non_urgent", red_flags: [], confidence: "medium" });
  const arResult = applySafetyRules("الكلب لا يتنفس وفاقد الوعي", arBase);
  assert("Arabic keyword forces urgent", arResult.urgency === "urgent");

  // No keyword — should NOT escalate
  const stableBase = makeInternalResult({ urgency: "non_urgent", red_flags: [], confidence: "high" });
  const stableResult = applySafetyRules("The cat is a bit tired but eating normally", stableBase);
  assert("No keyword — urgency unchanged", stableResult.urgency === "non_urgent");
  assert("No keyword — forced_urgent_by_rule=false", stableResult.forced_urgent_by_rule === false);
}

section("Safety rules — cannot downgrade urgency");

{
  const base = makeInternalResult({ urgency: "urgent", red_flags: ["heavy_bleeding"], confidence: "high" });
  const result = applySafetyRules("dog is scratching its ear", base);
  assert("Already-urgent stays urgent even with safe-sounding text", result.urgency === "urgent");
}

section("Adapter — backend contract");

{
  // Standard urgent case
  const out = makeTriageOutput();
  const analysis = toAIAnalysis(out);
  assert("triage maps urgent→urgent", analysis.triage === "urgent");
  assert("confidence maps high→0.9", analysis.confidence === 0.9);
  assert("summary is a string", typeof analysis.summary === "string");
  assert("observedSigns is array", Array.isArray(analysis.observedSigns));
  assert("safetyAdvice is array of strings", Array.isArray(analysis.safetyAdvice) && analysis.safetyAdvice.every((x) => typeof x === "string"));
  assert("safetyAdvice expanded (not raw keys)", !analysis.safetyAdvice.some((s) => s.includes("_")));
  assert("suggestedServices is empty array", Array.isArray(analysis.suggestedServices) && analysis.suggestedServices.length === 0);
  assert("forcedUrgentByRule is boolean", typeof analysis.forcedUrgentByRule === "boolean");
  assert("disclaimer is non-empty string", typeof analysis.disclaimer === "string" && analysis.disclaimer.length > 10);
  assert("model is string", typeof analysis.model === "string");
  assert("passes isAIAnalysis()", isAIAnalysis(analysis));

  // needs_attention case
  const monOut = makeTriageOutput({ urgency: "needs_attention", confidence: "medium", red_flags: [] });
  const monAnalysis = toAIAnalysis(monOut);
  assert("needs_attention maps → monitoring", monAnalysis.triage === "monitoring");
  assert("confidence maps medium→0.6", monAnalysis.confidence === 0.6);
  assert("monitoring passes isAIAnalysis()", isAIAnalysis(monAnalysis));

  // non_urgent / stable
  const stableOut = makeTriageOutput({ urgency: "non_urgent", confidence: "high", red_flags: [], needs: ["foster"] });
  const stableAnalysis = toAIAnalysis(stableOut);
  assert("non_urgent maps → stable", stableAnalysis.triage === "stable");
  assert("foster need maps → foster HelpType", stableAnalysis.recommendedHelp.includes("foster"));
  assert("stable passes isAIAnalysis()", isAIAnalysis(stableAnalysis));
}

section("Adapter — needs mapping");

{
  const needCases = [
    { needs: ["veterinarian"], expected: ["medical"] },
    { needs: ["rescue_volunteer"], expected: ["search"] },
    { needs: ["transport"], expected: ["transport"] },
    { needs: ["shelter"], expected: ["boarding"] },
    { needs: ["foster"], expected: ["foster"] },
    { needs: ["specialized_rescue"], expected: ["search"] },
    { needs: ["veterinarian", "transport"], expected: ["medical", "transport"] },
    { needs: ["specialized_rescue", "rescue_volunteer"], expected: ["search"] }, // deduplicated
  ];

  for (const { needs, expected } of needCases) {
    const out = makeTriageOutput({ needs });
    const { recommendedHelp } = toAIAnalysis(out);
    const ok = expected.every((e) => recommendedHelp.includes(e)) && recommendedHelp.length === expected.length;
    assert(
      `needs ${JSON.stringify(needs)} → ${JSON.stringify(expected)}`,
      ok,
      `got ${JSON.stringify(recommendedHelp)}`
    );
  }
}

section("Adapter — contagion detection");

{
  // Via hazard
  const hazardOut = makeTriageOutput({ hazards: ["contagion_risk"], red_flags: ["suspected_contagious_serious"] });
  const hazardAnalysis = toAIAnalysis(hazardOut);
  assert("possiblyContagious=true when contagion_risk hazard", hazardAnalysis.possiblyContagious === true);
  assert("contagionAdvice present when contagious", Array.isArray(hazardAnalysis.contagionAdvice) && hazardAnalysis.contagionAdvice.length > 0);

  // No contagion
  const safeOut = makeTriageOutput({ hazards: [], red_flags: [] });
  const safeAnalysis = toAIAnalysis(safeOut);
  assert("possiblyContagious=false when no contagion signals", safeAnalysis.possiblyContagious === false);
  assert("contagionAdvice absent when not contagious", safeAnalysis.contagionAdvice === undefined);
}

section("Adapter — fallback result still passes isAIAnalysis()");

{
  // Simulate a failed AI response by building a triage output with a fallback-like result
  const fallbackOut = {
    result: {
      schema_version: "0.2",
      is_animal_report: true,
      detected_language: "unknown",
      animal: { type: "unknown", category: "unknown" },
      situation_category: "unclear",
      summary: "The AI was unable to process this report. A human review is required.",
      red_flags: [],
      hazards: [],
      urgency: "needs_attention",
      urgency_reason: "AI analysis failed; applying precautionary urgency level.",
      confidence: "low",
      needs: ["rescue_volunteer"],
      follow_up_questions: [],
      guidance_keys: ["contact_vet_or_rescue"],
      forced_urgent_by_rule: false,
      ai_status: "failed",
      needs_human_review: true,
    },
    model: "gemini-2.0-flash-lite",
    ms: 100,
    usage: null,
    ai_status: "failed",
  };

  const fallbackAnalysis = toAIAnalysis(fallbackOut);
  assert("Fallback triage is monitoring", fallbackAnalysis.triage === "monitoring");
  assert("Fallback confidence is 0.3", fallbackAnalysis.confidence === 0.3);
  assert("Fallback passes isAIAnalysis()", isAIAnalysis(fallbackAnalysis));
}

// ─────────────────────────────────────────────────────────────────────────────
// GOLD TESTS — real Gemini API calls
// ─────────────────────────────────────────────────────────────────────────────

const localOnly = process.argv.includes("--local");

if (localOnly) {
  console.log("\n⚡ --local flag: skipping gold case tests.\n");
} else if (!process.env.GEMINI_API_KEY) {
  console.log("\n⚠️  GEMINI_API_KEY not set — skipping gold case tests. Use --local to silence this.\n");
} else {
  section("Gold vet cases — real Gemini API");

  const { triage } = await import("../src/triage.mjs");
  const goldPath = new URL("../data/gold_vet_cases.json", import.meta.url);
  const gold = JSON.parse(readFileSync(goldPath, "utf8"));

  const sameSet = (a, b) =>
    JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

  for (const testCase of gold.cases) {
    const text = testCase.report.en;
    const exp = testCase.expected;

    let out;
    try {
      out = await triage(text);
    } catch (err) {
      assert(`${testCase.id} — triage() did not throw`, false, err.message);
      continue;
    }

    // If both API attempts failed, triage() returned the safe fallback.
    // We verify the fallback is safe but don't count it as a model logic failure.
    const caseLabel = `[${testCase.id}] ${testCase.title}`;
    if (out.ai_status === "failed") {
      console.log(`  ⚠️  ${caseLabel} — API unavailable, fallback activated (not a logic failure)`);
      const analysis = toAIAnalysis(out);
      assert(`${caseLabel} — fallback passes isAIAnalysis()`, isAIAnalysis(analysis));
      assert(`${caseLabel} — fallback triage is monitoring or urgent`, ["monitoring", "urgent"].includes(analysis.triage));
      continue;
    }

    const r = out.result;

    assert(`${caseLabel} — is_animal_report`, r.is_animal_report === exp.is_animal_report);
    assert(
      `${caseLabel} — urgency`,
      r.urgency === exp.urgency,
      `got=${r.urgency}, expected=${exp.urgency}`
    );
    assert(
      `${caseLabel} — animal.type`,
      r.animal.type === exp.animal.type,
      `got=${r.animal.type}`
    );
    assert(
      `${caseLabel} — situation_category`,
      r.situation_category === exp.situation_category ||
        (testCase.situation_category_also_ok ?? []).includes(r.situation_category),
      `got=${r.situation_category}, expected=${exp.situation_category}`
    );
    assert(
      `${caseLabel} — red_flags`,
      // Over-detection is safe: expected flags must ALL be present,
      // but Gemini adding extra reasonable flags (e.g. smoke_exposure near a fire) is OK.
      exp.red_flags.every((f) => r.red_flags.includes(f)),
      `missing=[${exp.red_flags.filter((f) => !r.red_flags.includes(f))}]  got=[${r.red_flags}]`
    );

    // Needs: must contain required, optional extras are fine.
    // 'transport' is always treated as optional: Gemini often correctly
    // adds it (the animal needs moving) even when the gold file omits it.
    const missingNeeds = exp.needs.filter((n) => !r.needs.includes(n));
    const optionalNeeds = [...(testCase.needs_optional ?? []), "transport"];
    const unexpectedNeeds = r.needs.filter((n) => !exp.needs.includes(n) && !optionalNeeds.includes(n));
    assert(
      `${caseLabel} — needs`,
      missingNeeds.length === 0 && unexpectedNeeds.length === 0,
      `missing=[${missingNeeds}] unexpected=[${unexpectedNeeds}]`
    );

    // Adapter contract: output must pass isAIAnalysis()
    try {
      const analysis = toAIAnalysis(out);
      assert(`${caseLabel} — adapter produces valid AIAnalysis`, isAIAnalysis(analysis));
    } catch (adapterErr) {
      assert(`${caseLabel} — adapter does not throw`, false, adapterErr.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log("\n" + "═".repeat(64));
console.log(`🐾 PawLink AI Tests: ${passed}/${total} passed  ${failed > 0 ? `(${failed} FAILED)` : "✨ all good"}`);

if (failures.length > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) console.log(`  • ${f}`);
}

console.log("═".repeat(64) + "\n");

process.exit(failed > 0 ? 1 : 0);
