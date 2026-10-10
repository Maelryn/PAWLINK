# AI — Katia

You build the brain of the report flow (Data/AI, using an existing model, not training one): from what the person describes (plus their photo for a few checks), PawLink tells them **how urgent it is** and **what to do now**, safely. This is the moment judges remember, so it has to be fast, correct and never dangerous.

## 1. Where your code goes

`apps/backend/src/ai/` inside the NestJS backend (Mohamed + Aymen plug it into `POST /cases` and `POST /ai/analyze`). Work on your own branch `ai-katia`, starting from `backend1`. You can prototype in a plain script first (`apps/backend/scripts/try-ai.ts`).

```
src/ai/
  ai.provider.ts         interface AIProvider { analyze(input): Promise<AIRaw> }
  gemini.provider.ts     real Gemini Flash call
  mock.provider.ts       no-key fallback (port of apps/web/lib/ai/analyze.ts)
  safety.ts              keyword rules that override the model (port from the web)
  fallbacks/*.json       3 cached answers: urgent, monitoring, stable
  ai.service.ts          provider → validate → safety → fallback → final answer
  *.spec.ts              tests
```
Pick the provider with `AI_PROVIDER=mock|gemini`. The key is `GEMINI_API_KEY` (free at aistudio.google.com), **in `.env` only, never in git**.

## 2. Input and output (must match exactly)

**Input**
```ts
{ photoUrls: string[];            // 1–3 images
  description: string;            // what the person wrote (fr / en / ar / darija)
  species?: Species;              // what the person picked, can be wrong
  conditionTags?: string[];       // "bleeding", "trapped", "limping"… (see web lib/ai/analyze.ts)
  location: { lat: number; lng: number };
  count?: number;                 // herds
  baseline?: Triage;
  lang: "fr" | "en" | "ar" }      // answer in this language
```

**Output** = `AIAnalysis` in `apps/web/lib/types.ts`, field for field, plus two fields the trust checks use:
```ts
{ triage: "urgent" | "monitoring" | "stable";
  confidence: number;              // 0–1
  summary: string;                 // 1 sentence, in `lang`
  observedSigns: string[];         // what is VISIBLE: "open wound on the leg", "very thin"
  safetyAdvice: string[];          // max 5 short first-aid steps for a normal person
  possiblyContagious: boolean;
  contagionAdvice?: string[];
  recommendedHelp: ("transport"|"foster"|"food"|"medical"|"search"|"boarding"|"funds")[];
  suggestedServices: [];           // backend fills these (nearest vets), leave []
  suggestedHelpers: [];            // backend fills these, leave []
  forcedUrgentByRule: boolean;     // set by safety.ts, not by the model
  disclaimer: string;              // ALWAYS, in `lang`: "This is not a diagnosis. Contact a veterinarian."
  model: string;                   // e.g. "gemini-2.5-flash"
  animalDetected: boolean;         // false if there is no animal in the photo
  isRealPhoto: boolean;            // false for drawings, screenshots, AI images, photos of a screen
  speciesDetected?: Species }
```

## 3. Rules (these keep us safe and make the judges trust it)

1. **Never diagnose.** No disease names as facts ("he has parvo"), no medicine names, no doses. Describe what is visible and say "see a vet".
2. **Safety rules beat the model.** After Gemini answers, run `safety.ts`: if the text or tags contain bleeding / fire / trapped / breathing / poison… (FR, EN, AR, Darija lists are in `apps/web/lib/ai/analyze.ts`), then `triage = "urgent"` and `forcedUrgentByRule = true`. Rules can only **raise** urgency, never lower it.
3. **Strict JSON.** Use `responseMimeType: "application/json"` + a response schema. Validate the answer. If it's invalid, slow (**more than 5 s**) or an error, return the matching cached fallback. **The user must never see an error.**
4. **Person first.** If there's fire, a road or an aggressive animal, the first tip is about the person's own safety.
5. Answer in the user's language. Keep it short, kind and simple: someone stressed is reading it on a phone.
6. No photo stored by you. Read it from the URL, analyse it, done.

## 4. Test set (this is how we prove it works)

**The description drives the triage. The photo is only used for 3 simple checks, never for a diagnosis:**
1. Is there a real animal, and is it a real photo (not a screenshot, drawing or AI image)? → `animalDetected`, `isRealPhoto` (our anti-fake-reports check)
2. Which species? → `speciesDetected`
3. Visible danger (blood, fire, smoke, trapped) → can only make it **more** urgent, never less

Both go in the **same** Gemini call, so there's no extra complexity.

**Test cases**: `apps/backend/test/ai-cases/cases.json`, written with Sabrine (vet student) so they are realistic:
- 30 descriptions (FR / AR / Darija / EN mix): 10 urgent, 10 monitoring, 10 stable, each with the expected triage
- 5 tricky ones: very short ("chien blessé"), contradictory, a joke/fake report, no animal at all
- a few photos (free to use: Unsplash / Pexels / your own) only for the 3 photo checks above, including 2–3 traps (a drawing, a screenshot, an AI image)

Write `npm run ai:eval`, which runs all cases and prints: % correct triage, % of urgent cases caught (must be 100 %), average time. **Put the score in the README.** Judges love numbers we actually measured.

## 5. Dates

| Due | Done |
|---|---|
| **Sun 11 Oct** | Script: 1 photo in → a valid JSON answer from Gemini |
| **Tue 13 Oct** | Full `src/ai/` module + safety rules + fallbacks + unit tests. PR into `backend1` |
| **Wed 14 Oct** | Plugged into `POST /cases` with the backend team. Works on the live API |
| **Tue 20 Oct** | Test cases + `ai:eval` score in the README. Prompt improved until urgent cases are never missed |
| **24 Oct** | Freeze |
