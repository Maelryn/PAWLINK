# PawLink — Backend (NestJS)

The API the PawLink web + mobile apps consume. Built against **`../docs/TEAM_HANDOFF.md`** and
**`../docs/BACKEND_PROMPT.md`** — response shapes must match `../apps/web/lib/types.ts`
field-for-field, because the frontend generates its typed client from this service's Swagger.

**Status: Phase 0 — Foundation** ✅ · **Phase 1 — Auth + profile** ✅ · **Phase 2 — cases, trust, realtime** ✅ · **Phase 3 — marketplace** ✅ · **Phase 4 — admin + hardening** ✅

| Phase | What |
|---|---|
| 0 ✅ | NestJS scaffold · Swagger · Prisma schema (17 tables + PostGIS) · error envelope · health · seed |
| 1 ✅ | register → OTP → verify → login → refresh (rotated cookie) → logout · `/me` GET/PATCH/DELETE · guards · SMS providers |
| 2 ✅ | cases + the PostGIS bbox map query · the 8-check trust pipeline · Socket.IO on `/realtime` |
| 3 ✅ | adoptions, services, reviews, bookings, zones, notifications |
| 4 ✅ | admin (stats, users/roles, moderation queues) · the refresh-token store · Swagger completeness |

> **The AI is not in the backend.** It is a separate service in `apps/Ai/`, owned by the AI
> developer, and the backend has **no** dependency on it (deviation D6). There is no `/ai/analyze`
> route, no `AI_PROVIDER`, and no `src/ai/`. `Case.ai` is always absent and the `animalDetected`
> trust check is always `null` — both are the seam where the AI service will be wired in later.

## Run it

```bash
npm install
# put your real Supabase connection strings in .env (see .env.example), then:
npm run prisma:migrate     # creates tables + PostGIS + indexes
npm run seed               # demo scenario from apps/web/lib/mock/data.ts
npm run seed:admin -- --email you@pawlink.dz --password <secret>   # admin (never via signup)
npm run dev                # http://localhost:4000
```

- Swagger UI → <http://localhost:4000/docs> · machine-readable → `/docs-json` — every route is
  listed there with its request and response schemas, because the frontend generates its typed
  client from it. `npm run docs:check` exits non-zero if a schema, a property or a parameter is
  left undocumented.
- Realtime → `ws://localhost:4000/realtime` (Socket.IO, `auth: { token }`)
- Health → <http://localhost:4000/health> (`status: ok|degraded`, `db: up|down`)
- `pg` is a **direct** dependency: Prisma 7 has no bundled Postgres driver and reaches the database
  through `@prisma/adapter-pg` (`src/common/prisma/`).

## Phase 1 surface

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | public | 202 + SMS code | `role: "admin"` → `AUTH_ROLE_NOT_ALLOWED` |
| POST | `/auth/verify-phone` | public | 200 `{ accessToken, user }` + refresh cookie | |
| POST | `/auth/resend-code` | public | 202, supersedes the previous code | |
| POST | `/auth/login` | public | 200 + refresh cookie | one error for a bad email *and* a bad password |
| POST | `/auth/refresh` | refresh cookie | 200 `{ accessToken }` + a **new** refresh cookie | rotates the token; a replayed one is refused |
| POST | `/auth/logout` | refresh cookie | 204, cookie cleared | revokes the token server-side |
| GET | `/me` | bearer | 200 `User` | read from the database, never from the token |
| PATCH | `/me` | bearer | 200 `User` | profile fields only; a new `phone` clears `phoneVerified` |
| DELETE | `/me` | bearer | 204 | row anonymised, `passwordHash` dropped |

> Nest defaults `POST` to **201**. `/auth/refresh` (`200`) and `/auth/logout` (`204`) declare their
> status explicitly — that omission is exactly what the e2e suite caught.

### Phase 2 surface

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| GET | `/cases?bbox=…` | public (optional bearer) | 200 `{items,total,page,pageSize}` | **one raw PostGIS statement** on the GIST index; ordered `triage` then `createdAt DESC`; `moderation` null or `approved` only |
| GET | `/cases/nearby?lat=&lng=&radiusKm=` | bearer | 200 | `ST_DWithin`, ordered by the KNN operator; each item carries `distanceKm` |
| GET | `/cases/:id` | public (optional bearer) | 200 | a held case is a 404 unless the caller is its reporter |
| POST | `/cases` | bearer + verified phone | 201 | response **includes `trust`**; `@Throttle` 15/h per IP, 5/h per account |
| PATCH | `/cases/:id/status` | volunteer / vet / admin | 200 | a reporter gets `403 FORBIDDEN` |
| POST | `/cases/:id/help` | bearer | 200 | `open → in_progress`; emits `help.offered` + `case.updated`; writes a `help` notification |
| POST | `/cases/:id/confirm` | bearer | 200 | body `{ seen, lat, lng }`; **server-side ≤ 1 km**, one answer per account; 2 "yes" → `verified`, 2 "no" → `suspicious` + back to moderation |
| PATCH | `/cases/:id` | reporter | 200 | description/tags only; a public report stores the change as `pendingEdit` |
| DELETE | `/cases/:id` | reporter | 204 | the row and its notifications go with it |
| POST | `/cases/:id/flag` | bearer | 200 | three distinct flags → `pending`, off the public map |
| PATCH | `/admin/cases/:id/moderation` | admin | 200 | `{ decision: "approved" \| "hidden" }` |
| GET | `/admin/cases` | admin | 200 | no moderation gating — this is the queue |
| POST | `/uploads/signature` | bearer | 201 | Cloudinary signed params; **501 `UPLOADS_NOT_CONFIGURED`** without keys |
| POST | `/uploads/probe` | bearer | 200 | multipart → EXIF + 64-bit dHash, returns an opaque `probeId` |

> Nest defaults `POST` to **201**. `/cases/:id/help`, `/confirm`, `/flag` and `/uploads/probe`
> answer **200** and declare it with `@HttpCode(HttpStatus.OK)` — exactly the omission the
> Phase 1 e2e caught, now covered by the Phase 2 suite.

### Phase 3 surface (marketplace)

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| GET | `/adoptions` | public (optional bearer) | 200 `{items,total,page,pageSize}` | approved only, plus caller's own |
| GET | `/adoptions/:id` | public (optional bearer) | 200 | 404 unless approved/owner/admin |
| POST | `/adoptions` | bearer + verified phone | 201 | EXIF/pHash photo validation |
| PATCH | `/adoptions/:id` | owner | 200 | on a live listing the change waits as `pendingEdit` |
| DELETE | `/adoptions/:id` | owner | 204 | |
| POST | `/adoptions/:id/requests` | bearer | 201 | adoption request |
| GET | `/me/requests` · `/me/requests/received` | bearer | 200 | |
| PATCH | `/requests/:id` | owner | 200 | accept/decline → phone reveal matrix |
| GET/POST | `/services` · `/services/:id` | public (optional bearer) | 200 | geo filter when lat+lng |
| POST | `/services` | bearer | 201 | |
| PATCH | `/services/:id` | owner | 200 | on a live listing the change waits as `pendingEdit` |
| GET/POST | `/services/:id/reviews` | public (optional bearer) / bearer | 200/201 | one review per user |
| POST | `/services/:id/bookings` | bearer | 201 | |
| GET/PATCH | `/bookings/:id` · `/me/bookings` | bearer | 200 | |
| GET/POST/PATCH/DELETE | `/emergency-zones` | public (GET) / admin (write) | 200/201 | PostGIS polygon + ST_Centroid |
| GET/PATCH | `/me/notifications` · `/me/notifications/read-all` | bearer | 200/204 | |
| PATCH | `/admin/adoptions/:id` | admin | 200 | approve/reject + notify |
| PATCH | `/admin/services/:id` | admin | 200 | approve publishes + verifies |

### The surface the website needed (Phase 3.5)

The website (`apps/web`) is the reference client, and it had five screens with no endpoint behind
them. They are all here now; the shapes are the ones in `apps/web/lib/types.ts`, field for field.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| GET | `/me/cases` | bearer | 200 `{items,total,page,pageSize}` | every report the caller made, moderation included |
| POST | `/me/pro` | bearer | 201 `{ user, demo, free }` | demo payment; needs an **approved** listing; same plan twice → `409`; days left kept |
| GET | `/me/favorites` | bearer | 200 `{items,total,page,pageSize}` | saved adoption profiles, newest save first |
| PUT | `/me/favorites/:adoptionId` | bearer | 200 | idempotent — saving twice is the same row |
| DELETE | `/me/favorites/:adoptionId` | bearer | 204 | unsaving something never saved is not an error |
| GET | `/admin/pending-edits` | admin | 200 `{items,total}` | `PendingEdit[]`: cases, adoptions and services in one queue |
| PATCH | `/admin/cases/:id/edit` | admin | 200 | `{ decision: "approve" \| "reject" }` on the reporter's `pendingEdit` |
| PATCH | `/admin/adoptions/:id/edit` | admin | 200 | same decision on a listing's `pendingEdit` |
| PATCH | `/admin/services/:id/edit` | admin | 200 | same decision on a business listing's `pendingEdit` |

**The second review.** An owner may edit their own live listing, but the public version does not
change until a moderator decides: the change travels as `pendingEdit` on the row and is merged (or
dropped) by the `/admin/.../:id/edit` endpoint. A listing that is still `pending` (or `rejected`,
which goes back to `pending`) changes straight away — nobody has seen it yet. The owner is notified
`editApproved` / `editRejected` either way.

**Pro is derived, not stored.** `Service.pro` on the wire is computed from the owner's `users.pro`
subscription on every read (`services/serialize.ts`), and the directory ordering reads the
subscription in SQL. A subscription that expires turns the "featured" flag off by itself; the
`services.pro` column is a cache, never the source of truth.

**"Do you see this animal?"** is a vote, not a confirmation: `seen: false` counts too. The distance
(≤ 1 km) is measured on the **server** from the `lat`/`lng` in the body — the web checks the same
radius on the device, but the device is the client's, so the API check is the one that counts. Two
"yes" raise the case to `verified`; two "no" (and more "no" than "yes") make it `suspicious` and send
it back to the moderators. On creation the API asks the people within 3 km (`confirmAsk`).

### Phase 4 surface (admin + hardening)

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| GET | `/admin/stats` | admin | 200 | aggregate counts |
| GET | `/admin/users` | admin | 200 `{items,total,page,pageSize}` | filter by role/q |
| PATCH | `/admin/users/:id/role` | admin | 200 | role change (+ licenseVerified) |
| GET | `/admin/cases` | admin | 200 | moderation queue (Phase 2) |
| PATCH | `/admin/cases/:id/moderation` | admin | 200 | approve/hidden |
| GET | `/admin/adoptions` | admin | 200 | moderation queue |
| GET | `/admin/services` | admin | 200 | moderation queue |
| GET | `/admin/pending-edits` | admin | 200 `{items,total}` | the second-review queue (cases + adoptions + services) |

### The refresh-token store (`src/auth/refresh-token.service.ts`)

A refresh JWT proves "this token was signed by us". It says nothing about "this token is still
allowed to be used". Without a store, a stolen cookie is good for the whole 30 days and a logout
only clears the browser's copy. The `refresh_tokens` table is that missing half.

| column | why |
|---|---|
| `jti` (unique) | the handle the token is found by — it is the `jti` inside the JWT |
| `userId` | whose session it is |
| `expiresAt` | the token's own `exp`, read back from the signed token so the two agree exactly |
| `revokedAt` | when it died; null while it is live |
| `revokedReason` | **why** it died — the difference between a stolen copy and a stale client |

What the store buys:

| Situation | Answer |
|---|---|
| a live token | rotated: the old row is marked `rotated`, a new one is written |
| a token marked `rotated` coming back | **a copy** — every session of the account is revoked, `401 AUTH_TOKEN_REUSED` |
| a token marked `logout` coming back | a stale client — refused, but the account's other devices keep working |
| a token marked `reuse` coming back | already dead — refused |
| a token the store never knew | refused, `401 AUTH_TOKEN_INVALID` |
| `DELETE /me` | every session of the account is revoked |

The reason column is what keeps the two "it is dead" cases apart. Without it, a client that had
not noticed a logout would be treated as a thief, and the user would be logged out of the phone
they were still using.

**Client contract:** `POST /auth/refresh` **rotates**. Store the new cookie every time, and do not
blindly retry a refresh that already succeeded — a retry presents a spent token, which the server
reads as a copy and answers by killing the account's sessions.

### The trust pipeline (`src/cases/trust.service.ts`)

A line-for-line port of `apps/web/lib/trust.ts`, because the web UI already *displays* these
scores: drift in the thresholds would be visible to a reporter. `scoreTrust()` is pure and
exported, so the web's own scenarios are asserted against it directly.

```
score   = known.length ? passed / known.length : 0.5      // rounded to 2 decimals
hardFail = some check failed AND its id ∈ { inAlgeria, photoGps, duplicate, rateLimit }
level   = hardFail || score < 0.5        → "suspicious"
          score >= 0.85 && checks[0].ok  → "verified"
          otherwise                      → "unverified"
suspicious → moderation: "pending" → hidden from GET /cases until an admin approves
```

The eight checks, and where each one now reads from:

| id | Real check |
|---|---|
| `account` | `user.phoneVerified`, read from the row |
| `inAlgeria` | `ST_Within(ST_SetSRID(ST_MakePoint(lng,lat),4326), ST_GeomFromGeoJSON($1))` against the checked-in **simplified Algeria polygon** (`src/geo/algeria-boundary.json`, Natural Earth 50m, Douglas-Peucker 0.05°) |
| `photoGps` | `exifr`-read GPS from the probed original vs the pin, `< 2 km` |
| `photoFresh` | EXIF `DateTimeOriginal`, `< 48 h` |
| `onSite` | device GPS `< 5 km`, else `null` |
| `animalDetected` | always `null` — the AI service (`apps/Ai/`) is not delivered yet (D6). The check keeps its place in the order because the web UI renders it. |
| `duplicate` | `sharp` → 64-bit dHash, **Hamming distance computed in SQL**, `≤ 8` against `photo_hashes` |
| `rateLimit` | ≤ 5 reports/hour/account in the service, ≤ 15/hour/IP by the throttler |

### Why uploads are two steps

Cloudinary strips metadata on upload, so "read the EXIF server-side" and "the photos are already
uploaded" cannot both be true. The resolution is `POST /uploads/probe`: the original bytes come to
the API, which reads EXIF and a perceptual hash and hands back an opaque `probeId`.
`POST /cases` then takes `probeIds` — one per photo, enforced — so the only way to influence
`photoGps`, `photoFresh` or `duplicate` is to hand the server a real file first. A probe is usable
for one hour, only by the account that created it.

### The AI is not in the backend

There is **no** `/ai/analyze` route, **no** `AI_PROVIDER`, **no** `src/ai/`. The AI is a separate
service in `apps/Ai/`, owned by the AI developer, and the team decided (deviation D6) that the
backend must have **no dependency on it at all** until that service is delivered — not a stub, not
a mock, no import. Re-wiring it later is additive.

What the backend keeps, and why:

| what | where | why it stays |
|---|---|---|
| the `Case.ai` column | `prisma/schema.prisma` | the seam where the AI service's answer will be stored |
| `src/shared/ai-analysis.ts` | `isAIAnalysis()` / `aiOrUndefined()` | the `AIAnalysis` contract as a runtime guard. `ai` is a `Json` column, so it accepts anything, and the frontend's generated client trusts the Swagger type — so the value is validated on the way out |
| the `animalDetected` trust check | `src/cases/trust.service.ts` | always `null` for now, but it keeps its place in the check order because the web UI renders it. It flips to a real pass/fail when the link is wired in |

The consequence for a caller: `Case.ai` is **absent** from every response, and the `animalDetected`
trust check always reads `null` / *"Analyse IA indisponible"*. The trust score is computed
without it, exactly as it was before the AI existed.

Two rules the AI service has to honour, and that the backend already models:

- **No diagnosis, ever.** Every AI answer carries a veterinarian disclaimer.
- **Safety rules can only raise a triage.** A keyword hit (`bleeding`, `fire`, `trapped`,
  `not breathing`, `saignement`, `feu`, `coincé`…) forces `urgent` and sets
  `forcedUrgentByRule: true`.

The web app carries its own mock of both (`apps/web/lib/ai/analyze.ts`) so the demo works today.

### Realtime (`src/realtime/`)

Socket.IO on `/realtime`, the access token in `auth.token`, verified in **handshake middleware**
(`server.use`) — the only place a connection can genuinely be refused, so an anonymous socket gets
`connect_error` and never joins.

| event | when | payload |
|---|---|---|
| `case.created` | a case is stored **and it is public** | `{ case: Case }` |
| `case.updated` | status, confirm or flag | `{ case: Case }` |
| `help.offered` | `POST /cases/:id/help` | `{ caseId, helper: UserLite, helpType }` |
| `notification` | a notification row is written | `{ notification }` |

## Phase 1 verified against a real database

Proven on a throwaway PostgreSQL 17.5 + PostGIS 3.5 container (no Supabase credentials needed):

| Check | Result |
|---|---|
| `prisma migrate status` before anything | 1 migration found, `20261003000000_init` not yet applied |
| `prisma migrate deploy` | applied cleanly |
| `prisma migrate status` after | **Database schema is up to date!** |
| `prisma migrate diff --from-config-datasource --to-schema` | **No difference detected** (exit 0) |
| `npm run seed` | users:11 zones:1 cases:27 helpers:13 trustChecks:189 services:14 reviews:5 adoptions:6 |
| `npm test` | 96/96 |
| `npm run test:e2e` | **21/21** (17 auth steps + 4 health/Swagger/envelope) |
| login as a seeded user with `pawlink2026` | 200 — the argon2 hashes from `seed.ts` verify |
| login as the unverified seeded user `u11` | 403 `AUTH_PHONE_NOT_VERIFIED` |
| live register → OTP (logged, phone masked) → verify → `/me` → refresh → logout | all 200/202/204 as documented |
| `DELETE /me` then read the row | `name = 'Compte supprimé'`, `passwordHash` null, **0 orphaned rows** on `cases.reporterId` |

Security model:

- **Protected by default.** `JwtAuthGuard` and `RolesGuard` are global guards, so a route needs a
  valid bearer token unless it opts out with `@Public()`. `/health` and `/auth/*` do; nothing else.
- **Rotation is real, and it is revocable.** Every `POST /auth/refresh` mints a refresh token with a
  fresh `jti` (`randomUUID`), so the cookie genuinely changes, and the old one is **recorded as spent**
  in the `refresh_tokens` store. The access token lives its 15 minutes and stays stateless — a
  deny-list for access tokens is a different table with a different cost. The refresh token is what
  ends a session, because the access token cannot be renewed.
- Access token in the response body, refresh token in an httpOnly cookie scoped to `path=/auth`,
  `secure` in production. Access and refresh use separate secrets and separate TTLs.
- OTP: 6 digits, 5-minute TTL, 5 attempts, one live code per phone. With `SMS_PROVIDER=console`
  the code is logged in development **and returned in the response**; in production it is neither
  logged nor returned.
- Admin exists only through `seed` / `seed:admin`; `@Roles('admin')` is checked against the JWT
  role server-side, never against anything the client sends.

## Test

```bash
npm run test       # unit: 291 tests — error envelope, users, SMS, OTP, tokens, auth, bbox,
                   # EXIF, dHash, geo, serialize, trust, realtime, cases, refresh-token store
npm run test:e2e   # boots the app against a real database: 79 tests
npm run docs:check # every schema, property and parameter is documented
npm run lint
npx tsc --noEmit  # the only gate that also sees scripts/
```

`npm run test:e2e` needs a reachable database. Without one the suites report themselves as
**skipped**, with the reason printed once — they never pass silently.

## Environment

Copy `.env.example` → `.env`. The API must start with **only** the two database URLs set —
`SMS_PROVIDER=console`, no Cloudinary ⇒ everything else degrades gracefully
(uploads answer a typed `UPLOADS_NOT_CONFIGURED` error), so the demo never needs paid services.

## Layout

```
prisma/schema.prisma   17 tables · PostGIS geography columns (trigger-maintained) · GIST indexes
src/main.ts            Swagger + CORS + configureApp()
src/setup.ts           pipes/filters — shared by server and tests
src/common/filters     { statusCode, message, code } global error envelope
src/common/prisma      PrismaService (never crashes the boot; 503 DB_UNAVAILABLE instead)
src/common/env.ts      isProduction() / maskPhone() — no phone number ever reaches a log in full
src/common/decorators  @Roles() · @Public() · @CurrentUser()
src/health             GET /health
src/shared/types.ts    verbatim copy of apps/web/lib/types.ts — the response contract
src/shared/enums.ts    runtime mirrors of the Prisma enums (class-validator needs values)
src/shared/phone.ts    the one phone rule — every DTO that takes a number uses it
src/seed/data.ts       verbatim copy of apps/web/lib/mock/data.ts — the demo scenario
src/users              UsersService + userRowToUser(), the only row → User mapper
src/sms                SmsProvider interface · console (default) · twilio · SmsService
src/auth               controller/service · OtpService · TokensService · RefreshTokenService ·
                       strategies · guards · DTOs
src/me                 GET/PATCH/DELETE /me
src/cases              the map query (bbox.ts) · the trust pipeline · caseRowToCase · DTOs
src/uploads            POST /uploads/probe (EXIF + dHash) · /uploads/signature (Cloudinary)
src/geo                the checked-in Algeria boundary + ST_Within / ST_DWithin helpers
src/realtime           the Socket.IO gateway on /realtime + the four typed events
src/admin              /admin/stats · /admin/users · the three moderation queues
src/shared/ai-analysis the AIAnalysis contract as a runtime guard — the seam where apps/Ai/ lands
scripts/seed.ts        ports the demo scenario into PostgreSQL (re-runnable)
scripts/create-admin.ts the ONLY way an admin account is created
scripts/docs-check.ts  the Swagger completeness gate — every schema/property/parameter documented
test/global-setup.ts   decides whether the e2e suites run or are reported as skipped
```

## Phase 1 implementation notes

Decisions taken while building Phase 1, all consistent with `docs/BACKEND_PROMPT.md` §3:

- **`JwtAuthGuard` and `RolesGuard` are APP_GUARDs** (secure by default) rather than per-route
  `@UseGuards`. A new route is protected the moment it exists; forgetting a guard is impossible.
- **`phone_otps` has no phone column**, so `POST /auth/verify-phone` accepts an optional `phone`
  that scopes the lookup to one account. Without it the code-only lookup scans live codes.
- **One phone rule** (`src/shared/phone.ts`), used by every DTO that takes a number:
  `POST /auth/register`, `POST /auth/verify-phone`, `POST /auth/resend-code` and `PATCH /me`. It
  counts the **whole** string — the leading `+` included — so what registration accepts,
  verification accepts too. It used to be written four times in two incompatible spellings: the
  regex in the auth DTOs counted only the characters *inside* its class, so the `+` was free and
  21 characters were accepted, while `verify-phone` capped the string at 20. An account registered
  with a 21-character phone could never confirm its code (register → 202, verify → 400, forever).
  A new DTO must use `PHONE_PATTERN`, never a second spelling of it.
- **`DELETE /me` anonymises** instead of deleting: `passwordHash` becomes the "this account is
  gone" marker, so `/me` can refuse a dead account without a schema change and the foreign keys on
  `cases.reporterId` / `reviews.authorId` keep resolving.
- **Extra error codes** beyond the spec's list: `AUTH_PHONE_TAKEN`, `AUTH_USER_NOT_FOUND`,
  `AUTH_ACCOUNT_DELETED`, `AUTH_SECRET_MISSING`, `SMS_PROVIDER_NOT_CONFIGURED`,
  `SMS_DELIVERY_FAILED`. All follow the same `{ statusCode, message, code }` envelope.
- **The e2e suite disables the throttler** (`overrideGuard(ThrottlerGuard)`): the acceptance flow
  walks through more register calls than the 5-per-10-minutes limit allows. Rate limiting is
  exercised by its own decorators, not by that suite.
- The global exception filter also recognises **raw driver failures** (SASL errors, `ECONNREFUSED`,
  pool timeouts) and answers `503 DB_UNAVAILABLE` — as the README always claimed — instead of a
  `500`, because `@prisma/adapter-pg` surfaces them as bare `Error`s that carry no Prisma code.

## Phase 2 verified against a real database

The same throwaway **PostgreSQL 17.5 + PostGIS 3.5.2** container, recreated and re-seeded for this
phase. Every row below was produced by running the command, not by reasoning about it.

> **This is the Phase 2 record and it predates deviation D6.** It is kept as the history of what
> was proven at that time. The `/ai/analyze` rows that were verified then have been dropped from
> this table — the AI moved to `apps/Ai/` — and the counts are as they were in Phase 2, not as they
> are today. **The current state is the [Phase 4 record](#phase-4-verified-against-the-real-supabase-project) below.**

| Check | Result |
|---|---|
| `prisma migrate deploy` | applied cleanly — **2 migrations** (`…_init`, `20261010200738_photo_probes`) |
| `prisma migrate status` | **Database schema is up to date!** |
| `prisma migrate diff --from-config-datasource --to-schema` | **No difference detected** (exit 0) |
| `npm run seed` | users:11 zones:1 cases:27 helpers:13 trustChecks:189 services:14 reviews:5 adoptions:6 — **the counts did not move** |
| `npm test` | **278/278** |
| `npm run test:e2e` | **53/53** (21 Phase 1 + 32 Phase 2) — on the container **and** on real Supabase |
| `GET /cases?bbox=3.9,36.5,4.4,36.9` | 13 cases, **urgent-first**, `total: 13` with `pageSize` unchanged |
| a bbox around Algiers only | the Kabylie cases are absent, `c13` is present |
| `?bbox=,,,` / `?bbox=1,2,3` / `?bbox=0,0,0,200` / `?bbox=-180,-90,180,90` | 400 `VALIDATION_ERROR` for all four |
| the seeded `pending` case | **absent** from the public bbox, present in `GET /admin/cases` |
| `POST /uploads/probe` on `with-exif.jpg` | `probeId`, `exif.gps = {lat:36.632,lng:4.205}`, `takenAt`, `camera`, 16-hex dHash |
| `POST /uploads/probe` on `no-exif.jpg` | `exif: {}` **and no error** — `exifr` returns `undefined`, not `null` |
| the same dHash for `with-exif.jpg` and `recompressed.jpg` | confirmed — that is what catches a reused photo |
| `POST /uploads/signature` with no keys | **501 `UPLOADS_NOT_CONFIGURED`**, never a 500 |
| `POST /cases` | response contains **`trust`**; `moderation` null for a verified reporter |
| a client-supplied `trust: {level:"verified", confirmations:99}` | ignored — recomputed, `confirmations: 0` |
| an out-of-Algeria pin (Paris) | `trust.level: "suspicious"`, `moderation: "pending"`, absent from the public bbox, present for an admin |
| the same photo twice | `duplicate: false` with a detail string → `pending` |
| `GET /cases/:id` for a held case as a stranger | **404** |
| `POST /cases/:id/confirm` by two different accounts | `confirmations: 2`, `score: 0.96`, `level: "verified"` |
| `POST /cases/:id/confirm` twice by one account | 409 `CONFLICT` — one per account |
| `POST /cases/:id/flag` ×3 by three accounts | `moderation: "pending"`, gone from the public map |
| `PATCH /cases/:id/status` by a volunteer / by the reporter | **200** / **403 `FORBIDDEN`** |
| `suggestedServices` | the nearest vet at **1.0 km**, transport 10 km, shelter 12.9 km — matches an independent `ST_Distance` query |
| the 6th report in an hour | **429 `TRUST_RATE_LIMITED`** |
| Socket.IO with no handshake token | `connect_error` — the socket never joins |
| Socket.IO with a forged token | `connect_error` |
| a connected socket creating a case and receiving help | `case.created` · `case.updated` · `help.offered` · `notification` all arrive with the documented payloads |
| a **held** case | **no `case.created` broadcast** |
| `/docs-json` | all 23 routes listed, each with request and response schemas |
| boot log | no token, password, OTP or API key appears in any line |

Live smoke (`npm start` + `curl` + a real `socket.io-client`) was used for the socket rows, the
Swagger route list and the boot log, because a unit test cannot prove a broadcast is delivered.

### What only running it caught

| Bug | Why the tests missed it | Fix |
|---|---|---|
| `Cannot access 'PointDto' before initialization` at boot | no unit test loaded the controller; `tsc` is happy | nested DTO classes are declared **first** in the file — `emitDecoratorMetadata` turns a property's type into `Reflect.metadata('design:type', X)`, which is evaluated while the class is being defined. `src/app.bootstrap.spec.ts` now imports every controller and DTO, and was verified to fail when the order is reverted |
| `Nest can't resolve dependencies of the RealtimeGateway (?)` | same | `TokensService` is imported as a **value**, not `import type` — a type-only import is erased before the metadata is written |
| `Cannot access 'CreateCaseLocationDto' before initialization` | same | nested DTO declared first, plus the bootstrap spec above |
| `GeoService` unresolvable in `CasesModule` | `GeoModule` is `@Global()`, so it is importable **nowhere** until it is imported once | `GeoModule` added to `app.module.ts` |
| `Post /cases` answered with eight `ok: null` trust checks | the row from `create`'s transaction is written **before** the `trust_checks`, so its `trustChecks` is empty | the service re-reads the case after the transaction |
| `GET /admin/cases` → 500 | `Prisma.join([])` **throws** on an empty array, and an unfiltered admin list builds none | `WHERE TRUE` when there are no filters |
| `@Throttle` 5/h per IP shadowed the account limit, so `TRUST_RATE_LIMITED` was unreachable | the two limits were the same number, so the guard always fired first | the per-IP throttler is now a 15/h backstop, documented in the controller |
| `photos` always failed validation | `@MaxLength(6)` on an **array** always fails — class-validator's `maxLength` returns false for non-strings | `@ArrayMaxSize(6)` |

### Tier B — verified against the real Supabase project

The project `PawLink` (`fymwcbevypwvtiocreuh`, eu-west-1, PostgreSQL 17) was paused and empty. After
restoring it and applying the migrations, which is the stricter test — an empty `public`, so the
migrations had to create PostGIS themselves rather than inherit it from a `postgis/postgis` image:

| Tier B check | Result |
|---|---|
| `prisma migrate deploy` on an empty database | ✅ both migrations applied cleanly |
| PostGIS created by the migration | ✅ `postgis 3.3.7 a0c7967`, GEOS 3.14.1, PROJ 9.7.1 |
| the 3 `*_set_location` triggers and 4 GIST indexes | ✅ all present on Supabase |
| drift (`migrate diff --exit-code`) | ✅ "No difference detected" |
| `npm run seed` | ✅ **identical counts to the container** |
| `npm run test:e2e` | ✅ **53/53** through the **session pooler** |
| the trigger-maintained geography | ✅ all 12 cases in the Tizi Ouzou bbox have a non-null `location` |
| `ST_Distance` nearest vet | ✅ 1.0 km — the same number the container produced |
| e2e self-cleaning on Supabase | ✅ cases back to 27, `photo_probes` 0, `photo_hashes` 0 |

**The bug Tier B caught that the container could not.** `.env.example` documented `DATABASE_URL` as
the session pooler while showing the *direct* connection. The real pooler needs the **project ref in
the username** (`postgres.PROJECT_REF`), otherwise Supavisor answers
`(ENOIDENTIFIER) no tenant identifier provided (external_id or sni_hostname required)`; and the
**session** pooler is port 5432 on the pooler host — port 6543 is the transaction pooler, which
breaks Prisma's prepared statements. The seed failed on exactly that before it passed.
`.env.example` now states both rules.

**One security finding, reported rather than acted on.** Supabase's advisories flag **Row Level
Security disabled on all 19 tables** (the 17 application tables, `_prisma_migrations` and PostGIS's
`spatial_ref_sys`). That is deliberate — `docs/BACKEND_PROMPT.md` §2 says "only
NestJS talks to the DB, RLS stays off", and the API connects as `postgres` — but it becomes live the
moment anyone hands the anon key to a browser or subscribes to Realtime. Enabling RLS without
policies would block all access, so the policies have to be designed first. Flagged, not applied.

Still unproven for want of credentials: a valid Cloudinary signature and Twilio delivery. Each
degrades gracefully. (Real Gemini vision is no longer the backend's problem — the AI moved to
`apps/Ai/`, see D6.)

## Phase 4 verified against the real Supabase project

**This is the current record.** The Phase 1, Phase 2 and Tier B sections above are the history of
what was proven at the time; this one is where the API stands today.

Verified on the real project `PawLink` (`fymwcbevypwvtiocreuh`, eu-west-1, PostgreSQL 17) through
the **session pooler**, on 2026-10-21.

| Check | Result |
|---|---|
| `prisma migrate deploy` | ✅ applied cleanly — **4 migrations** (`…_init`, `…_photo_probes`, `…_refresh_tokens`, `…_refresh_token_reason`) |
| `prisma migrate status` | ✅ **Database schema is up to date!** |
| drift (`migrate diff --exit-code`) | ✅ **No difference detected** (exit 0) |
| the schema | ✅ **17 tables** + PostGIS; `refresh_tokens` present with its `jti` unique index |
| `npm run build` · `npm run lint` · `npx tsc --noEmit` | ✅ exit 0 · exit 0 · exit 0 |
| `npm test` | ✅ **21 suites / 291 tests** |
| `npm run test:e2e` | ✅ **6 suites / 79 tests** — 7 of them new, on the refresh-token store |
| `npm run docs:check` | ✅ 54 operations · 30 schemas · 137 properties · 83 parameters, all documented |
| `npm run seed` | ✅ users:11 zones:1 cases:27 helpers:13 trustChecks:189 services:14 reviews:5 adoptions:6 |
| the e2e suites' footprint | ✅ **0** `refresh_tokens` rows and **0** leftover accounts left behind |

The refresh-token store, against the real database:

| Check | Result |
|---|---|
| signing in | ✅ a row is written, live, with the token's own expiry |
| `POST /auth/refresh` | ✅ the spent row is marked `rotated` and a new row is written |
| `POST /auth/logout` | ✅ the row is marked `logout`; the dead cookie is then refused |
| a stale cookie after a logout | ✅ refused — and the account's **other** sessions keep working |
| a **rotated** cookie replayed | ✅ `401 AUTH_TOKEN_REUSED` — every session of the account dies |
| a token signed with the real secret but never issued | ✅ refused, `401 AUTH_TOKEN_INVALID` |
| `DELETE /me` | ✅ every session of the account is revoked |

**One environment note.** The direct Supabase host is unreachable from some networks (IPv6-only
hosts). When `prisma migrate` cannot reach it, point `SUPABASE_DB_URL` at the **session pooler**
string — the same one as `DATABASE_URL` — and the migrations apply normally. `prisma.config.ts`
says so, and this is how the run above was done.

## Deviations from the spec documents

Each one is a deliberate departure from `docs/BACKEND_PROMPT.md`, `PHASE1_PLAN.md` or
`PHASE2_PLAN.md`, with the reason. The full list with the same numbering lives in
`docs/BACKEND_PROMPT.md` §Deviations (D1–D9), plus D10–D14 for the website's missing endpoints.

1. **`photo_probes` is a new table** (migration `20261010200738_photo_probes`). §4's table list does
   not include it. It is PHASE2_PLAN §6 option A, and the alternative — trusting client-extracted
   EXIF — is the one thing §3.5 forbids. Rows hold EXIF + a dHash and expire after an hour; they are
   pruned on every probe, so no cron is needed. `photo_hashes` keeps the permanent record.
2. **`users` has no geography column, so `suggestedHelpers` is measured in JavaScript.** §7.5 asks
   for `users.location`, but the schema has only `lat`/`lng` there and adding one is a schema change
   outside this phase's scope. The distance uses the same great-circle formula the trust pipeline
   and the web mock use, so the numbers agree — it is still real data from the database rather than
   the hard-coded mock array. `suggestedServices` **is** real PostGIS.
3. **The per-IP report limit is 15/h, not 5/h.** At exactly 5 it would always fire before the
   account-level check and the documented `429 TRUST_RATE_LIMITED` would be unreachable. The
   per-account 5/h is the contract; the throttler is the coarser backstop against account farming.
4. **Moderation endpoints under `/admin/*` ship in Phase 2** (R6). The trust pipeline cannot be
   demonstrated without a `pending → approved` path, and a report held forever is a report the
   reporter never gets answered.
5. **`GET /cases` is public** (R9, `BACKEND_PROMPT` §3.3 wins over `TEAM_HANDOFF` §5). It accepts an
   **optional** bearer token so a signed-in reporter still sees their own held report; an admin's
   full view is `GET /admin/cases`.
6. **`animalDetected` is always `null`.** The AI service that would answer it is not delivered yet
   (D6), so the check has no data to work with and says so (`"Analyse IA indisponible"`). The
   field keeps its place in the check order because the web UI renders it.
7. **`socket.io-client` is a devDependency.** The e2e suite connects a real socket; without it the
   "the broadcast actually arrives" rows above could only be asserted with a mock, which would
   defeat the point.
8. **Nest's 201 default is declared explicitly** on the routes that answer 200 (`/cases/:id/help`,
   `/confirm`, `/flag`, `/uploads/probe`) — the same omission the Phase 1 suite caught.
9. **`refresh_tokens` is a new table** (migrations `20261021160000_refresh_tokens` and
   `20261021163000_refresh_token_reason`). §4's table list does not include it, and
   `PHASE1_PLAN.md` risk R1 asked for it to be **flagged before adding** — this is that flag.
   Without it, rotation is cosmetic: a stolen refresh cookie stays usable for its full 30 days and
   a logout only clears the browser's copy. The table records the token's `jti`, its expiry, and
   whether it has been revoked, so a session can genuinely be ended and a replayed token can be
   recognised. The `revokedReason` column is what separates a **stolen** copy (a rotated token
   coming back — every session of the account dies) from a **stale** client (a token revoked by a
   logout coming back — refused, but the account's other devices keep working). Access tokens stay
   stateless: a deny-list for them is a different table with a different cost, and they live 15
   minutes.

10. **`favorites` is a new table** (migration `20261021200000_pro_favorites_pending_edits`). §4's
    table list does not include it. The website's adoption marketplace is built around the heart
    button — "saved" is a filter tab of its own — and keeping it client-side would lose it the
    moment the browser does. One row per `(userId, adoptionId)`, so saving twice is the same row.
11. **`cases.pendingEdit`, `adoptions.pendingEdit` and `services.pendingEdit` are new `Json`
    columns.** The second review (`docs/tasks/BACKEND.md` §2b) needs the owner's proposed change to
    wait somewhere while the public version stays live. A separate `pending_edits` table would have
    to mirror three different row shapes; a nullable column on each row keeps the change next to
    what it changes, and deleting the row deletes the proposal with it.
12. **`case_confirms.seen` is a new column, and `POST /cases/:id/confirm` now takes a body.** The
    endpoint used to mean "I see it too" with an empty body, but the website asks the opposite
    question too ("I don't see it") and the two answers have different effects. A `seen` boolean
    makes the row a **vote**; `true` is the old behaviour. The body also carries the caller's
    `lat`/`lng` so the 1 km rule can be enforced on the server.
13. **Four notification kinds were added** (`confirmAsk`, `caseConfirmed`, `editApproved`,
    `editRejected`) — values of the existing `NotificationKind` enum, not new tables.
14. **The new migration is written but not applied here.** The Supabase project was unreachable
    from this machine (`P1001`), so `prisma migrate deploy` could not run; the SQL in
    `prisma/migrations/20261021200000_pro_favorites_pending_edits/` is what to run next. `prisma
    generate` did run, so the code compiles and the unit suite covers the logic — but nothing in
    this batch has been exercised against a real Postgres yet.

## Phase 2 implementation notes

Decisions taken while building this phase, all consistent with `docs/BACKEND_PROMPT.md`:

- **One trust scorer, pure and exported.** `scoreTrust()` in `src/cases/trust.service.ts` is the
  web's arithmetic with no I/O in it, so the web's own five scenarios are asserted against the same
  function the server runs rather than against a paraphrase of it.
- **The bbox is one raw statement; the relations are Prisma's.** `location &&` on the GIST index does
  the spatial work, `COUNT(*) OVER ()` gives the matching total in the same round trip, and
  `include` loads the reporter, helpers and checks — then the SQL's ordering is preserved in
  JavaScript, because the map depends on urgent-first.
- **The Hamming distance is computed in SQL**, not in Node: `bit_count(('x' || hash)::bit(64) # …)`
  compares against every stored hash without shipping them out.
- **`OptionalJwtAuthGuard`** is paired with `@Public()` on the case reads: the global
  `JwtAuthGuard` runs first and would otherwise reject the anonymous caller before the optional
  guard could attach one.
- **`src/shared/ai-analysis.ts`** holds the `AIAnalysis` contract as a runtime guard, used by the
  row mapper, because a `Json` column accepts anything and the frontend's generated client trusts
  the Swagger type. It is the seam where the `apps/Ai/` service will be wired in.
- **`caseRowToCase` is the only row → `Case` mapper**, and it strips `animalDetected`/`isRealPhoto`
  on the way in: those two are internal facts for the trust checks, not part of the web's `Case`.

## Contract rules that are not negotiable

1. Never trust the client — roles, moderation, trust, EXIF, rate limits are server-side.
2. Response fields match `src/shared/types.ts` exactly.
3. No diagnosis, ever. The AI service must attach a veterinarian disclaimer to every answer; the
   backend's own contract carries no AI answer at all (D6).
4. Admin exists only via `seed:admin`; every `/admin/*` route checks the JWT role.
5. Adoption phone numbers are revealed only when a request is `accepted`.
6. A refresh token is only usable while the server says so. The store is the authority, not the
   cookie's signature.
