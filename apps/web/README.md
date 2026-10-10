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
| `/` | Landing page (hero with 3D animals, scroll-driven 3D map, features) |
| `/login` | Welcome screen, sign in / sign up (reporter, volunteer, vet, business) on one screen |
| `/map` | Live map: photo pins, clustering, filters, side panel (desktop) / sheet (phone). `?mode=emergency` opens wildfire mode |
| `/report` | 4-step report (photo, position within 2 km, animal, situation), then the AI triage. Needs an account and a position in Algeria |
| `/cases/[id]` | Case: AI analysis, trust checks, timeline, "I can help", "Mark as resolved" |
| `/adopt`, `/adopt/[id]`, `/adopt/new` | Adoption: cards, saved favourites, profile + request, posting (max 3 real photos, admin approval) |
| `/services`, `/services/[id]` | Vets, shelters, transport, shops: near me, reviews, appointment requests |
| `/account` | My space: home, profile, my reports, adoption, business/Pro, notifications, settings |
| `/settings` | Language (FR / AR / EN) and appearance (auto / light / dark) |
| `/pro` | PawLink Pro for businesses (demo payment, code `DEMODAY`) |
| `/admin` | Admin only: overview, moderation queues, emergency zones, users |

## Demo data

Until the API is connected, `lib/store.ts` is a small database saved in the browser (localStorage). Every action notes the API endpoint that replaces it, so the screens don't change when the backend is plugged in. Demo accounts use the password `pawlink2026`.

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
