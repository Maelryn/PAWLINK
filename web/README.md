# PawLink — Web

Next.js 16 · TypeScript · Tailwind v4 · Motion · MapLibre (OpenStreetMap). FR / AR (RTL) / EN, light and dark modes.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. `npm install` also copies the map worker and the Arabic text plugin into `public/maplibre/` (see `scripts/copy-map-assets.mjs`).

## Pages

| Route | What |
|---|---|
| `/` | Landing page (hero with 3D animals, scroll-driven 3D map, bento features) |
| `/map` | Live map: photo pins, clustering, filters, side panel / mobile sheet. `?mode=emergency` opens the wildfire mode |
| `/report` | 4-step report flow, then the AI triage reveal. The new case drops onto the map |
| `/cases/[id]` | Case detail: AI analysis, timeline, "I can help" |
| `/adopt`, `/adopt/[id]` | Adoption cards and structured profiles |
| `/services` | Vets, shelters, transport… with ratings and reviews |
| `/dashboard` | Reporter / volunteer / vet views (switch role at the top) |
| `/admin` | Overview charts, moderation, emergency zones, users |

## Where things live

```
app/                  routes
components/brand      logo (SVG)
components/ui         Button, TriageBadge, Chip, Segmented, Avatar, Stars, CasePhoto, TimeAgo
components/motion     Reveal, SplitWords, CountUp, FloatingEmoji, TiltCard
components/map        MapView (MapLibre), mapStyle (Apple-like recolor), Pins, MapExperience
components/cases      AICard, CaseRow, CaseCard, HelpPicker
lib/types.ts          shared types (= contract with the NestJS backend, see docs/TEAM_HANDOFF.md)
lib/mock/data.ts      demo scenario (Kabylie wildfire + cases across Algeria), all fictional
lib/ai/analyze.ts     mock AI triage + safety-rule layer (mirrors POST /ai/analyze)
lib/store.ts          client store; swap its actions for API calls when the backend is live
lib/i18n/             fr.ts, ar.ts, en.ts
```

## Plugging in the backend

Everything reads from `lib/store.ts` and `lib/ai/analyze.ts`. When the NestJS API is ready:
1. Replace `CASES` / `SERVICES` / `ADOPTIONS` with fetches to `/cases?bbox=`, `/services`, `/adoptions`.
2. Replace `analyzeAsync` with `POST /ai/analyze`. The response shape is already `AIAnalysis`.
3. Replace `store.addCase` / `store.offerHelp` with `POST /cases` / `POST /cases/:id/help` and subscribe to realtime `case.created`.

Keep the mock path behind a flag (`NEXT_PUBLIC_USE_MOCK=true`) so the demo always works offline.
