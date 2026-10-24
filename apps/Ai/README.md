# PawLink AI Module

> Analyses animal rescue reports using Gemini and returns structured results for the PawLink backend.

## What it does

1. Receives a plain-text report from a user (any language)
2. Calls Gemini (structured JSON mode) to extract: animal info, urgency, red flags, guidance keys, follow-up questions
3. Applies local safety rules — emergency keywords can **raise** urgency but never lower it
4. Returns either the AI result **or a safe fallback** if Gemini fails
5. The `adapter.mjs` converts the result into the exact `AIAnalysis` shape the backend expects

## File structure

```
apps/Ai/
├── src/
│   ├── triage.mjs      ← Main entry point: triage(reportText) → { result, model, ms, ... }
│   ├── adapter.mjs     ← toAIAnalysis(triageOutput) → AIAnalysis (backend contract)
│   ├── schema.mjs      ← Zod schema for the AI-internal v0.2 format
│   ├── prompt.mjs      ← System prompt sent to Gemini
│   └── safety.mjs      ← Keyword safety rules (EN / FR / Arabic / Darija)
├── tests/
│   └── run-suite.mjs   ← Automated tests (39 local + 12 gold vet cases)
├── data/
│   ├── guidance_library.json   ← Vet-approved first-aid advice keys
│   ├── gold_vet_cases.json     ← 12 reference cases from the vet PDF
│   └── pawlink-ai-spec.md      ← Full spec (schema, rules, decisions)
├── .env                ← GEMINI_API_KEY and GEMINI_MODEL (not committed)
├── .env.example        ← Template
├── run-case.mjs        ← Manual one-case runner
└── try-photo.mjs       ← Photo analysis prototype (separate, MVP-only)
```

## Setup

```powershell
cd apps/Ai
npm install

# Copy and fill the .env file:
copy .env.example .env
# Then edit .env and set your GEMINI_API_KEY
```

## Running tests

```powershell
# Local tests only (no API calls, instant):
npm run test:local

# Full suite (includes 12 gold vet cases via real Gemini API):
npm test

# Run one vet case manually:
node --env-file=.env run-case.mjs vet-01
node --env-file=.env run-case.mjs vet-01 fr    # French variant
node --env-file=.env run-case.mjs vet-03 ar    # Arabic variant
```

## How to call from the backend (NestJS)

```typescript
// Example usage in a NestJS service
// The analyseReport() function is the single integration point.

import { analyseReport } from '../../../Ai/src/adapter.mjs';

// In your case creation handler:
const { aiAnalysis, raw, ms, ai_status } = await analyseReport(reportText);

// aiAnalysis is a valid AIAnalysis object — store it on the case:
await this.casesRepo.update(caseId, {
  ai: aiAnalysis,
  // raw is the full AI internal result (v0.2) — optional, for debugging
});
```

### What `analyseReport()` returns

| Field | Type | Description |
|-------|------|-------------|
| `aiAnalysis` | `AIAnalysis` | Ready to store on the case. Passes `isAIAnalysis()`. |
| `raw` | object | Full AI internal result (v0.2 format, includes follow-up questions, etc.) |
| `ms` | number | How long the AI call took |
| `ai_status` | `"ok"` \| `"failed"` | `"failed"` means the fallback was used — flag for human review |

### Fallback behaviour

If Gemini times out, returns invalid JSON, or fails twice:
- `ai_status = "failed"`
- `aiAnalysis.triage = "monitoring"` (safe default — never drops a report)
- Emergency keywords in the text can still force `triage = "urgent"`
- The backend should set `needs_human_review = true` when `ai_status = "failed"`

## Urgency / triage mapping

| AI internal (`urgency`) | Backend (`triage`) |
|-------------------------|-------------------|
| `urgent`                | `urgent`          |
| `needs_attention`       | `monitoring`      |
| `non_urgent`            | `stable`          |

## Needs / HelpType mapping

| AI internal (`needs`) | Backend (`HelpType`) |
|-----------------------|---------------------|
| `veterinarian`        | `medical`           |
| `rescue_volunteer`    | `search`            |
| `transport`           | `transport`         |
| `shelter`             | `boarding`          |
| `foster`              | `foster`            |
| `specialized_rescue`  | `search`            |

## What the AI does NOT do

- ❌ Diagnose diseases or name conditions
- ❌ Prescribe or mention medications
- ❌ Decide which specific vets/volunteers to contact (that's the backend)
- ❌ Compute distances or query the database
- ❌ Claim an animal is safe or will recover
- ❌ Follow instructions embedded inside a report
