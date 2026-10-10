# PawLink

**In Algeria, people who find an injured or lost animal don't know who to call. PawLink connects them in minutes with nearby volunteers and vets.**

Report an animal with a photo and its position. An AI triage says how urgent it is and what to do right now (never a diagnosis, always "see a vet"). The case appears on a live map of Algeria, nearby volunteers and vets are told, someone taps "I can help", and the case goes from open to in progress to resolved. Around that core: wildfire/flood emergency mode, anti-fake-report checks, pet adoption and a directory of vets and shelters.

Built by a team of six students in Algeria during the Thirduni programme (October 2026).

---

## What works today

| Feature | Status |
|---|---|
| Website, phone + desktop, French / Arabic (right-to-left) / English, light + dark | ✅ |
| Accounts (reporter, volunteer, vet, business) and a hidden admin | ✅ website (demo data) · ✅ API Phase 1 on branch `backend1` |
| Report flow: photo, position (must be in Algeria and within 2 km of the animal), animal, situation | ✅ |
| AI triage with safety rules (danger words always force "urgent", never a diagnosis) | ✅ rule layer + demo model in the website · 🟡 Gemini integration in progress |
| Live map of Algeria: photo pins, clustering, filters, 3D, emergency mode | ✅ |
| "I can help" → in progress → "Mark as resolved", notifications | ✅ |
| Trust checks against fake reports: Algeria only, 2 km rule, real camera photo (EXIF), duplicate photo, rate limit, admin moderation | ✅ website · 🟡 server-side versions in Phase 2 |
| Adoption (max 3 real photos, admin approval, request → phone shown only if accepted, saved favourites) | ✅ |
| Vets, shelters and shops: reviews and replies, appointment requests, PawLink Pro listing | ✅ (payment is a demo, no real money) |
| Shared real database for everyone (NestJS + Supabase) | 🟡 Phase 1 done, Phase 2 (cases, map, AI) in progress |
| Native mobile app (Expo) | 🟡 screens built on branch `aymen-mobile`; the website already works on phones |

**Honest note:** until the API is connected, the website runs on a demo database saved in your browser (`apps/web/lib/store.ts`). Everything works, but what you create is only visible in your own browser. Each store action names the API endpoint that replaces it.

## Try it

Live demo: the link is in our Thirduni submission.

Demo accounts, password `pawlink2026`:

| Account | Role |
|---|---|
| `yasmine@pawlink.dz` | reporter |
| `amine@pawlink.dz` | volunteer |
| `dr.taleb@pawlink.dz` | vet with a Pro business |
| `ines@pawlink.dz` | admin |

Reporting needs your location in Algeria. If location is blocked, use "Use the demo position": the report is then marked "not on site" and can't count as verified.

## Run it locally

Website (Node 20+):

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000. `npm install` also copies the map worker into `public/maplibre/`.

API (branch `backend1`, see `apps/backend/README.md` there):

```bash
git checkout backend1
cd apps/backend
npm install
cp .env.example .env      # add your own Supabase / Postgres connection strings
npm run prisma:migrate
npm run seed
npm run dev               # http://localhost:4000, Swagger at /docs
```

No secrets are committed. `.env*` files are git-ignored.

## How it's built

| Part | Stack |
|---|---|
| Website `apps/web` | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Motion, MapLibre GL + OpenFreeMap / OpenStreetMap, exifr |
| API `apps/backend` (branch `backend1`) | NestJS 11, Prisma 7, PostgreSQL + PostGIS (Supabase), JWT + refresh cookie, argon2, Swagger, Jest |
| AI | Google Gemini Flash behind a provider interface, plus a safety-rule layer that runs after the model |
| Mobile `apps/mobile` (branch `aymen-mobile`) | Expo + React Native |
| Hosting | Vercel (website), Supabase (database + photos) |
| AI tools used to build it | Claude Code (Anthropic) for code, design and docs. AI-made code was reviewed and tested by the team |

```
apps/
  web/        website (Next.js)
  backend/    API (NestJS) – on branch backend1
  mobile/     native app (Expo) – on branch aymen-mobile
brand/        logo and app icon, light and dark
docs/
  tasks/      who does what, with dates (backend, AI, data)
  research/   facts with sources, interviews
```

## What's next

See `docs/tasks/README.md` for the October plan. After October: launch in Algiers and Tizi Ouzou with local rescue associations, open the real backend and AI to the public, and bring the first vets and pet shops onto PawLink Pro.
