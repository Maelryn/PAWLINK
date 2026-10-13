# PawLink Backend — Prompt for the AI IDE

> Copy everything below the line into your AI IDE (Cursor / Windsurf / opencode / Claude Code)
> with `apps/backend/` as the working directory. Run it **phase by phase**: send Phase 0,
> verify, then send Phase 1, and so on. The `[PHASE]` marker at the top tells it which one.

---

You are the **backend developer on PawLink**, an animal rescue / care / adoption platform for
Algeria. Your job: build the complete NestJS API that the existing, already-finished Next.js
frontend will consume. The frontend runs today on mock data behind a flag; your API is the only
thing standing between it and production.

**Working directory: `apps/backend/` (create it — it currently contains only `.gitkeep`).**

**[PHASE] = 0 · 1 · 2 · 3 · 4**  ← change this line each time you run a phase.

---

## 1. READ FIRST (before writing any code)

These files are the specification. Read them completely — do not guess:

| File | Why |
|---|---|
| `../docs/TEAM_HANDOFF.md` | The contract the frontend dev wrote **for you**: endpoints, data shapes, auth, trust rules, adoption flow, checklist |
| `../apps/web/lib/types.ts` | **Source of truth for every data shape.** Your DTOs must serialize exactly these fields (names, casing, optionality) |
| `../apps/web/lib/store.ts` | Every mutation the UI performs, annotated with its target endpoint. Any action here must have a matching API route |
| `../apps/web/lib/trust.ts` | The trust scoring algorithm you must re-implement **server-side, never trusting client input** |
| `../apps/web/lib/auth.ts` | How the UI signs in/up/registers, and the role model (admin never signable) |
| `../apps/web/lib/mock/data.ts` | The seed dataset: `USERS`, `EMERGENCY_ZONES`, `CASES`, `SERVICES`, `REVIEWS`, `ADOPTIONS`, `DEMO_PASSWORD` |
| `../docs/FRONTEND_PLAN.md` | Product context and current web status |
| `../docs/MOBILE_PLAN.md` | The Expo app will consume the **same** API — keep it mobile-friendly (no browser-only assumptions) |

**You may READ anything in `apps/web/`. You may NOT modify `apps/web/`, `apps/mobile/`, `brand/`, or `docs/` (except appending to this file if a contract must change — flag it loudly).**

---

## 2. STACK (fixed — do not deviate, do not add alternatives)

| Layer | Choice |
|---|---|
| Runtime | Node 22, TypeScript strict, **npm** (same as `apps/web`) |
| Framework | **NestJS 11** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Validation | `class-validator` + global `ValidationPipe({ whitelist: true, transform: true })` |
| ORM | **Prisma** (latest stable) — CRUD only. All geospatial queries are **raw SQL** (`$queryRaw`) |
| Database | **Hosted Supabase** PostgreSQL 15+ with the **PostGIS** extension. No local Docker, no local DB |
| Docs | `@nestjs/swagger` at `/docs` + `/docs-json` |
| Auth | JWT: **access token in response body**, **refresh token in an httpOnly cookie**. Payload `{ sub, role, name }`. `@nestjs/jwt` + `@nestjs/passport` |
| Passwords | `argon2` (or `bcrypt` fallback) |
| Rate limiting | `@nestjs/throttler` (5 reports/hour/account **and** per IP) |
| Realtime | **Socket.IO** gateway (`@nestjs/websockets` + `@nestjs/platform-socket.io`) |
| CORS | `http://localhost:3000` + the Vercel domain, `credentials: true` |
| Storage | **Cloudinary** signed uploads (`POST /uploads/signature`) |
| SMS | **`SmsProvider` interface** with `console` (default — logs + DB the code, demo works offline) and `twilio` implementations |
| Tests | Jest + `supertest` |

Nothing else. No TypeORM, no Drizzle, no Supabase JS client (only NestJS talks to the DB —
**RLS stays off**), no `@nestjs/config` alternatives.

---

## 3. CONTRACTS (non-negotiable)

### 3.1 Response envelope
- **Errors** — always `{ statusCode: number, message: string, code: string }` via one global
  exception filter. `code` is a stable machine string (`AUTH_INVALID_CREDENTIALS`,
  `TRUST_RATE_LIMITED`, `MODERATION_REQUIRED`, …). Never leak stack traces.
- **Pagination** — always `{ items: T[], total: number, page: number, pageSize: number }`.
- **Dates** — ISO 8601 UTC strings. **Distances** — km. **Coordinates** — `{ lat, lng }`;
  GeoJSON `[lng, lat]` order **only** inside `EmergencyZone.polygon`.
- **IDs** — string (cuid/uuid), never numbers.

### 3.2 Auth flow
```
POST /auth/register  { name, email, password, phone, role: "reporter"|"volunteer"|"vet" }
  → creates user (role reporter, phoneVerified:false) + sends SMS code
POST /auth/verify-phone { code }        → { accessToken, user } + refresh cookie
POST /auth/login    { email, password } → { accessToken, user } + refresh cookie
POST /auth/refresh  (reads httpOnly cookie) → { accessToken }
POST /auth/logout   → clears cookie
GET/PATCH /me       → current user (includes helpTypes, phone, available, serviceId)
```
- **Admin is never a sign-up option.** Admins exist only via seed/CLI. Every `/admin/*` route
  verifies `role === "admin"` **in the JWT, server-side**.
- A `vet` signup stays `role: "reporter"` until an admin sets `licenseVerified: true`.
- Phone OTP: table `phone_otps { userId, code, expiresAt, attempts }`, 6 digits, 5 min TTL,
  max 5 attempts. `SMS_PROVIDER=console` prints the code to the log and returns it in the
  response **only when `NODE_ENV !== "production"`**.

### 3.3 Endpoints
Implement exactly this surface. `*` = also derivable from `store.ts` / the web pages.

**Auth** `POST /auth/register · /auth/login · /auth/refresh · /auth/logout · /auth/verify-phone · /auth/resend-code`
**Me** `GET /me · PATCH /me · DELETE /me · GET /me/adoptions · GET /me/requests · GET /me/requests/received · GET /me/bookings · GET /me/notifications · POST /me/notifications/read-all`
**Cases**
| Method | Route | Notes |
|---|---|---|
| GET | `/cases?bbox=minLng,minLat,maxLng,maxLat&triage=&species=&category=&status=&zoneId=` | **PostGIS bbox query** — powers the map. Only `moderation = approved` (or `null`) are public |
| GET | `/cases/nearby?lat=&lng=&radiusKm=` | dashboards |
| GET | `/cases/:id` | |
| POST | `/cases` | photos already uploaded (Cloudinary URLs). Response **includes `trust`**. The `ai` field is `null` until the AI service (`apps/Ai/`) is wired in |
| PATCH | `/cases/:id/status` | volunteer / vet / admin only |
| POST | `/cases/:id/help` | `{ helpType, message? }` → emits `help.offered` |
| POST | `/cases/:id/confirm` | "I see it too" → `trust.confirmations++`, raises level |
| POST | `/cases/:id/flag` | 3 flags → back to `moderation: "pending"` |
| PATCH | `/admin/cases/:id/moderation` | `{ decision: "approved" \| "hidden" }` |
**Uploads** `POST /uploads/signature` → Cloudinary signed params (keep EXIF: use `signature` + `timestamp`, do **not** let the client strip metadata before the server reads it)
**Zones** `GET /emergency-zones?active=true · POST /emergency-zones · PATCH /emergency-zones/:id · DELETE /emergency-zones/:id` (write = admin)
**Services** `GET /services?lat=&lng=&type=&radiusKm=&q= · GET /services/:id · POST /services · PATCH /services/:id · GET/POST /services/:id/reviews · POST /services/:id/bookings · PATCH /bookings/:id`
**Adoptions** `GET /adoptions?status=approved · GET /adoptions/:id · POST /adoptions (→ pending) · PATCH /adoptions/:id · POST /adoptions/:id/requests · PATCH /requests/:id`
**Admin** `GET /admin/stats · GET /admin/users · PATCH /admin/users/:id/role · GET /admin/cases · GET /admin/adoptions · PATCH /admin/adoptions/:id · GET /admin/services · PATCH /admin/services/:id`
**Realtime** Socket.IO, events `case.created` · `case.updated` · `help.offered` · `notification`

> **AI is out of scope for this backend.** `POST /ai/analyze`, the `AIProvider`
> interface, the safety-rule layer, the Gemini integration and the 3 cached
> fallbacks belong to the **AI developer** in `apps/Ai/`. The backend must not
> import, call or depend on any AI module. The `animalDetected` trust check and
> the `Case.ai` field stay in place as `null`/unavailable until that service is
> delivered and the link is wired in.

### 3.5 Trust & anti-abuse — every report, server-side
Re-implement `apps/web/lib/trust.ts` with **real** checks. Return `trust: { level, score, checks[], confirmations, flags }` on every case.

| id | Real check |
|---|---|
| `account` | `phoneVerified === true` |
| `inAlgeria` | `ST_Within(point, algeria_polygon)` — seed a simplified Algeria boundary GeoJSON. Fallback to the bbox `lat 18.9–37.2 / lng -8.7–12` if you cannot source the polygon, and say so |
| `photoGps` | EXIF `GPSLatitude/Longitude` read **server-side from the original file before upload** (`exifr`) vs report pin, `< 2 km`, else `null` |
| `photoFresh` | EXIF `DateTimeOriginal` `< 48 h`, else `null` |
| `onSite` | device GPS (optional field) `< 5 km`, else `null` |
| `animalDetected` | `null` — the AI service (`apps/Ai/`) is not delivered yet; flips to the AI answer when the backend↔AI link is wired in |
| `duplicate` | perceptual hash: `sharp` → 64-bit dHash, Hamming distance ≤ 8 against stored hashes = duplicate |
| `rateLimit` | ≤ 5 reports / hour / account and / IP |

Scoring, `hardFail` ids and level thresholds stay **exactly** as in `lib/trust.ts`.
`level === "suspicious"` ⇒ `moderation: "pending"` ⇒ **hidden from the public map and from
`GET /cases` until an admin approves it.**

### 3.6 Domain rules
- **Adoption:** owner posts (max **3** photos, rejects images without camera EXIF Make/Model/DateTimeOriginal, plus pHash dup check) → `pending` → admin approves → public → adopter sends one request (`message`, `housing`, `experience`) → owner `accepted`/`declined` → **phone numbers of both parties appear only in the response when status is `accepted`**. PawLink never handles money.
- **Reviews:** authenticated, **one per user per service**, rating 1–5, owner can `reply`.
- **Services:** created by a business/vet account (`ownerId`) → `status: "pending"` → admin approves. `pro: true` users are sorted first.
- **Notifications:** created server-side for `adoptRequest`, `adoptAccepted`, `adoptDeclined`, `listingApproved`, `listingRejected`, `booking`, `bookingConfirmed`, `bookingDeclined`, `help`, `review`, `serviceApproved`, `proActive` (see `NotificationKind` in `types.ts`) and pushed over Socket.IO.
- **Role guards:** `status` changes on a case → volunteer/vet/admin. Every `admin` route → admin guard. UI hiding is cosmetic; **the server is the enforcement point**.

---

## 4. DATABASE (Prisma + hosted Supabase + PostGIS)

- Env: `SUPABASE_DB_URL` = **direct** connection for `prisma migrate`;
  `DATABASE_URL` = **pooled** connection at runtime. Both from Supabase → Connect → Postgres
  (ORM/Prisma tab). Prefer the **session pooler** for `DATABASE_URL` — the transaction pooler
  (6543) can break Prisma's prepared statements, and the direct endpoint may be IPv6-only.
- First migration runs `CREATE EXTENSION IF NOT EXISTS postgis;` (raw SQL via
  `prisma db execute` or a migration file).
- Tables: `users`, `phone_otps`, `cases`, `case_helpers`, `case_confirms`, `case_flags`,
  `trust_checks`, `photo_hashes`, `emergency_zones`, `services`, `reviews`, `bookings`,
  `adoptions`, `adoption_requests`, `notifications`.
- **Geometry pattern** — keep `lat`/`lng` as readable `Double` columns AND maintain a synced
  geography column, so Prisma handles data access while SQL handles space:
  ```sql
  location geography(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED
  ```
  Declare it in the Prisma schema as `location Unsupported("geography")?` so migrate-diffing
  never tries to drop it, and never `select` it — geo queries go through `$queryRaw`.
  `emergency_zones.polygon` is `geography(Polygon, 4326)` written with
  `ST_GeomFromGeoJSON($1)`.
- **Indexes:** GIST on `cases.location`, `services.location`, `adoptions.location`,
  `emergency_zones.polygon`; btree on `cases(triage, status, moderation, "createdAt")`,
  `cases("reporterId")`, `services(type)`, `adoptions(status)`.
- **Bbox query must be one raw statement**, e.g.
  `SELECT … FROM cases WHERE location && ST_MakeEnvelope($1,$2,$3,$4,4326)::geography …`
  using `ST_DWithin`/`ST_Intersects` as appropriate, ordered by `triage` then `createdAt DESC`.
- Timestamps: `createdAt` / `updatedAt` with `@updatedAt`. All IDs `text` (cuid).
- `prisma migrate dev` must run clean against Supabase with no drift.

---

## 5. ENVIRONMENT (`.env.example` + real `.env` never committed)

```
NODE_ENV=development
PORT=4000
SUPABASE_DB_URL=          # direct, migrations (port 5432)
DATABASE_URL=             # pooled, runtime (port 6543)
JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_TTL=30d
CORS_ORIGINS=http://localhost:3000
SMS_PROVIDER=console      # console | twilio
TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= TWILIO_FROM=
CLOUDINARY_CLOUD_NAME= CLOUDINARY_API_KEY= CLOUDINARY_API_SECRET=
```

**Credentials — handled by the human, obeyed by you:**
- `apps/backend/.env` already contains the real values (Supabase connection strings, etc.).
  Treat it as a read-only secret store: read it when you need a value, **never print, echo,
  quote or copy its contents** into code, logs, tests, Swagger examples or your report.
- `.env` must be gitignored; `.env.example` holds the keys only, with empty/dummy values.
- Only the two **database connection strings** are required. Supabase dashboard links and the
  `anon` / `service_role` API keys are **not** used — nothing here talks to the Supabase HTTP API.
- If the direct connection fails (common on Windows/IPv4: Supabase direct can be IPv6-only),
  use the **session pooler** for runtime and report it — do not silently change the config.

The frontend reads `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) and
`NEXT_PUBLIC_USE_MOCK`. Your API must work with **zero** of the optional third-party keys set
(`AI_PROVIDER=mock`, `SMS_PROVIDER=console`, no Cloudinary → return a clear typed error for
uploads) so the demo never depends on the network. (The AI service is a separate app; it is
not part of this backend's env or demo path.)

---

## 6. RULES (violating any of these is a failed build)

1. **Never trust the client.** Roles, moderation, trust, rate limits, EXIF, duplicates — all server-side.
2. Response field names/types must match `apps/web/lib/types.ts` **exactly** — the frontend will generate its typed client from your Swagger.
3. No diagnosis, no medical claims, disclaimer always present.
4. Admin only via seed/CLI; admin routes guarded in the JWT.
5. Phone numbers revealed only under the rules in §3.6.
6. Everything must stay runnable without paid third-party services.
7. No new framework/ORM/npm-heavy dependencies outside §2 without flagging it first.
8. Never log tokens, passwords, OTP codes in production, or Cloudinary secrets.

---

## 7. PHASES — do only `[PHASE]`, then STOP and report

Each phase ends with: **builds clean · lint clean · tests green · `/docs` up to date · seed still runs.**

**Phase 0 — Foundation**
NestJS project in `apps/backend` (own `package.json`, `.eslintrc`, `tsconfig`), global
ValidationPipe + exception filter (`{statusCode,message,code}`), Swagger at `/docs`, CORS,
`@nestjs/throttler`, Prisma schema for §4 + first migration against Supabase, PostGIS
extension, `.env.example`, health route `GET /health`, seed script that ports
`apps/web/lib/mock/data.ts` (users with hashed `pawlink2026`, wildfire zone + cases, services,
reviews, adoptions) plus an `npm run seed:admin` CLI. **Acceptance:** `npm run dev` boots,
`/docs` renders, `prisma migrate status` is clean, seed populates all tables.

**Phase 1 — Auth + profile**
Register → OTP → verify → login → refresh → logout → `GET/PATCH/DELETE /me`, guards
(`JwtAuthGuard`, `RolesGuard`, `AdminGuard`), throttling, `console`/`twilio` SMS providers.
**Acceptance:** Jest e2e covering register → verify → login → `/me` → refresh → role denial,
and admin routes rejecting non-admins.

**Phase 2 — Cases + trust + realtime (the core)**
`/cases` (PostGIS bbox + filters + moderation gating), create case with EXIF/pHash/Algeria/
rate-limit trust pipeline, status changes, help offers, confirm/flag, moderation queue,
`/uploads/signature`, Socket.IO emitting `case.created`/`case.updated`/`help.offered`. **Acceptance:** unit tests for
the trust scorer (port `lib/trust.ts` cases); e2e creating a
case returns `trust` and it appears in the bbox query. (`ai` stays `null` — the AI
service in `apps/Ai/` is a separate workstream.)

**Phase 3 — Marketplace + services + zones**
Adoption flow (§3.6 end-to-end incl. phone reveal), services + reviews + bookings, emergency
zones CRUD + `zoneId` filter, notifications (DB rows + Socket.IO). **Acceptance:** e2e for
"request accepted ⇒ phone revealed, declined ⇒ hidden"; one-review-per-user enforced.

**Phase 4 — Admin + hardening**
`/admin/stats`, users/roles, moderation queues for cases/adoptions/services, rate-limit tuning,
Swagger completeness (every schema documented), README for `apps/backend` (setup, env, seed,
endpoints), final test pass. **Acceptance:** the frontend can be pointed at
`NEXT_PUBLIC_API_URL=http://localhost:4000` with no type mismatches.

---

## 8. WHEN YOU FINISH A PHASE, REPORT

1. Swagger URL + list of routes added this phase (table).
2. Commands to run it (`install`, `migrate`, `seed`, `dev`, `test`).
3. Test results.
4. Any deviation from §3 — **with justification** (append to this file under `## Deviations`).
5. Anything you could not do and why.

---

## Deviations

_Recorded by the Phase 0 re-audit (2026-10-09, branch `backend1`). Nothing in §3 contracts changed._

| # | Deviation | Justification |
|---|---|---|
| D1 | §4 asks for `location geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng,lat),4326)) STORED`. Phase 0 ships a **BEFORE INSERT/UPDATE trigger** (`pawlink_set_location()`) instead, declared in `prisma/migrations/20261003000000_init/migration.sql`. | Prisma cannot model a generated-column expression, so `prisma migrate dev` reads drift on every run and tries to drop/recreate the column. The trigger keeps the DDL byte-identical to what `schema.prisma` declares (column + GIST index are both modelled), so `migrate dev` stays clean. Same data, same indexes, same `$queryRaw` usage — only the sync mechanism differs. |
| D2 | `CREATE EXTENSION postgis` is hand-placed at the **top** of the initial migration, and the trigger block is hand-composed at the **bottom**, rather than living in a separate migration. | The `geography` type must exist before any table uses it, and the trigger function must exist after the tables. Prisma's own generated migrations do not know either ordering. The composed file is what `prisma migrate deploy` applies. |
| D3 | Lint config is `eslint.config.mjs` (ESLint 9 **flat config**) instead of the `.eslintrc` named in §7. | ESLint 9 removed `.eslintrc` support; `eslint-config-expo`-style flat config is the only supported form. Same rule set, same `npm run lint`. |
| D4 | `pg` + `@types/pg` are now **direct** dependencies of `apps/backend`. | Prisma 7 has no built-in Postgres driver: the client talks through `PrismaPg` (`@prisma/adapter-pg`), which pulls `pg` transitively. Relying on that made the runtime DB driver one `npm` hoisting accident away from breaking. Pinned explicitly (`pg ^8.23.1`). |
| D5 | `datasource.url` is not in `schema.prisma`; it lives in `prisma.config.ts`. | Prisma 7 moved connection URLs out of the schema. `SUPABASE_DB_URL` (direct) is used by migrate commands, `DATABASE_URL` (session pooler) at runtime through the adapter. |
| D6 | **AI removed from the backend scope.** The original §3.4 (`POST /ai/analyze`, `AIProvider`, safety-rule layer, Gemini, 3 cached fallbacks), the `animalDetected` trust signal, `Case.ai` writes, the AI env vars and the Phase 2 AI acceptance are all stripped. The `animalDetected` check and the `Case.ai` column stay in place, always `null`/unwritten. | The AI work belongs to a separate developer in `apps/Ai/`, not to the backend. The team decided there must be **no backend↔AI link at all** until that service is delivered, so the backend neither imports nor calls any AI module. Re-wiring is additive: bring back an `AIProvider` client and feed `animalDetected` + `Case.ai` from it. |

_Recorded by Phase 3 (2026-10-13, marketplace: adoptions, services, zones, notifications)._

| # | Deviation | Justification |
|---|---|---|
| D7 | **Phase 3 pre-flight: stale AI e2e assertions aligned to D6.** `test/e2e` cases that still asserted the removed `/ai/analyze` contract were rewritten to the post-D6 reality (and a `freshExif()` helper added in `test/support/e2e-gate.ts` to re-date fixture EXIF at upload). | Required by `docs/PHASE3_PROMPT.md` §2: the AI routes were stripped by D6 but Phase 1's e2e still asserted them, so the suite could never be green before feature code. Recorded here as instructed; no contract changed. |
| D8 | **Marketplace reads are public.** `GET /adoptions`, `GET /adoptions/:id`, `GET /services`, `GET /services/:id`, `GET /services/:id/reviews` run `@Public()` + `OptionalJwtAuthGuard`, and `GET /emergency-zones` is `@Public()`, instead of "all routes authenticated by default" (PHASE3 §3 preamble). Every write stays behind the global `JwtAuthGuard`. | `apps/web` browses `/adopt`, `/services` and the rescue map logged-out — login gates *actions*, not pages — and the Phase 2 `GET /cases` precedent already reads public-with-optional-viewer. The optional guard preserves viewer-dependent rules (owner sees their own pending listing) while a token is absent for anonymous visitors. |

### Known cosmetic issue (not a deviation)

`prisma/migrations/20261003000000_init/migration.sql` contains one comment block whose box-drawing
characters were double-encoded (`â”€` instead of `─`) when the migration was composed. It is inside
SQL comments and has **zero** runtime effect. It is deliberately **not** edited: modifying a migration
that may already be applied would break `prisma migrate status` checksum verification. Fix it only by
squashing the migration history on a fresh database.

