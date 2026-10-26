// src/triage.mjs
// The single entry point for the PawLink AI module.
// Pipeline:  report text → Gemini → Zod validation → safety rules → structured result
// Includes: retry on invalid JSON/schema error, 15-second timeout, and a safe fallback.

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { triageSchema } from "./schema.mjs";
import { buildSystemPrompt } from "./prompt.mjs";
import { applySafetyRules } from "./safety.mjs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite";
const TIMEOUT_MS = 25_000;

// Convert Zod schema → JSON Schema once at startup (Zod v4 native).
// Drop the $schema key — Gemini does not need it.
const { $schema, ...jsonSchema } = z.toJSONSchema(triageSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wraps a promise with a hard timeout. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/** One attempt: call Gemini, parse JSON, validate with Zod. */
async function attempt(reportText) {
  const response = await withTimeout(
    ai.models.generateContent({
      model: MODEL,
      contents: `<report>\n${reportText}\n</report>`,
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    }),
    TIMEOUT_MS
  );

  // Step 1 — is it even JSON?
  const raw = JSON.parse(response.text);

  // Step 2 — does it match the schema?
  const parsed = triageSchema.parse(raw);

  return { parsed, usage: response.usageMetadata ?? null };
}

// ─── Safe fallback ───────────────────────────────────────────────────────────
// Produced when both attempts fail.
// Never invents a diagnosis. Sets needs_human_review so the backend can flag it.

function buildFallback(reportText) {
  // Keyword backstop — if obvious emergency keywords are in the text, set urgent.
  const urgency = /\b(not breathing|can't breathe|unconscious|seizure|convulsion|poisoned|hit by a car|bleeding heavily|trapped|ne respire pas|inconscient|convulsions|empoisonné|renversé par une voiture|saigne beaucoup|coincé|لا يتنفس|فاقد الوعي|تشنجات|نزيف شديد)\b/i.test(
    String(reportText)
  )
    ? "urgent"
    : "needs_attention";

  return {
    schema_version: "0.2",
    is_animal_report: true,
    detected_language: "unknown",
    animal: { type: "unknown", category: "unknown" },
    situation_category: "unclear",
    summary: "The AI was unable to process this report. A human review is required.",
    red_flags: [],
    hazards: [],
    urgency,
    urgency_reason: "AI analysis failed; applying precautionary urgency level.",
    confidence: "low",
    needs: urgency === "urgent" ? ["veterinarian"] : ["rescue_volunteer"],
    follow_up_questions: [],
    guidance_keys: urgency === "urgent" ? ["contact_vet_immediately"] : ["contact_vet_or_rescue"],
    forced_urgent_by_rule: urgency === "urgent",
    ai_status: "failed",
    needs_human_review: true,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyse a report and return a structured, safety-checked result.
 *
 * @param {string} reportText  — the raw text from the user
 * @returns {{ result, model, ms, usage, ai_status }}
 */
export async function triage(reportText) {
  const started = Date.now();
  let parsed = null;
  let usage = null;
  let ai_status = "ok";

  // ── First attempt ──────────────────────────────────────────────────────────
  try {
    ({ parsed, usage } = await attempt(reportText));
  } catch (err) {
    console.warn("[triage] First attempt failed:", err.message);

    // ── Retry once ────────────────────────────────────────────────────────────
    try {
      ({ parsed, usage } = await attempt(reportText));
    } catch (retryErr) {
      console.error("[triage] Retry also failed:", retryErr.message);
      ai_status = "failed";
    }
  }

  // ── Fallback if both attempts failed ─────────────────────────────────────
  if (!parsed) {
    const fallback = buildFallback(reportText);
    return {
      result: fallback,
      model: MODEL,
      ms: Date.now() - started,
      usage: null,
      ai_status: "failed",
    };
  }

  // ── Apply safety rules (can only raise urgency, never lower it) ───────────
  const safe = applySafetyRules(reportText, parsed);

  return {
    result: {
      schema_version: "0.2",
      ...safe,
      ai_status,
      needs_human_review: false,
    },
    model: MODEL,
    ms: Date.now() - started,
    usage,
    ai_status,
  };
}
