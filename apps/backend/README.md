# PawLink — Backend (NestJS)

The API the PawLink web + mobile apps consume. Built against **`../docs/TEAM_HANDOFF.md`** and
**`../docs/BACKEND_PROMPT.md`** — response shapes must match `../apps/web/lib/types.ts`
field-for-field, because the frontend generates its typed client from this service's Swagger.

**Status: Phase 0 — Foundation** ✅ · **Phase 1 — Auth + profile** ✅ · Phase 2 (cases/trust/AI/realtime) · Phase 3 (marketplace) · Phase 4 (admin/hardening)

| Phase | What |
|---|---|
| 0 ✅ | NestJS scaffold · Swagger · Prisma schema (15 tables + PostGIS) · error envelope · health · seed |
| 1 ✅ | register → OTP → verify → login → refresh (rotated cookie) → logout · `/me` GET/PATCH/DELETE · guards · SMS providers |
| 2 ⬜ | cases + bbox query + trust pipeline + `/ai/analyze` + Socket.IO |
| 3 ⬜ | adoptions, services, reviews, bookings, zones, notifications |
| 4 ⬜ | admin, moderation queues, hardening |

## Run it

```bash
npm install
# put your real Supabase connection strings in .env (see .env.example), then:
npm run prisma:migrate     # creates tables + PostGIS + indexes
npm run seed               # demo scenario from apps/web/lib/mock/data.ts
npm run seed:admin -- --email you@pawlink.dz --password <secret>   # admin (never via signup)
npm run dev                # http://localhost:4000
```

- Swagger UI → <http://localhost:4000/docs> · machine-readable → `/docs-json`
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
| POST | `/auth/refresh` | refresh cookie | 200 `{ accessToken }` + a **new** refresh cookie | |
| POST | `/auth/logout` | refresh cookie | 204, cookie cleared | no body |
| GET | `/me` | bearer | 200 `User` | read from the database, never from the token |
| PATCH | `/me` | bearer | 200 `User` | profile fields only; a new `phone` clears `phoneVerified` |
| DELETE | `/me` | bearer | 204 | row anonymised, `passwordHash` dropped |

> Nest defaults `POST` to **201**. `/auth/refresh` (`200`) and `/auth/logout` (`204`) declare their
> status explicitly — that omission is exactly what the e2e suite caught.

### Phase 1 verified against a real database

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
- **"Rotation" is unique but not revocable.** Every `POST /auth/refresh` mints a refresh token with a
  fresh `jti` (`randomUUID`), so the cookie genuinely changes and a leaked older one cannot be
  replayed as "the current session". With no server-side store there is still no deny-list: the
  access token lives its 15 minutes, a refresh cookie its 30 days. `refresh_tokens` is the Phase 4
  fix (PHASE1_PLAN.md risk R1) — and `jti` is exactly what makes it possible then.
- Access token in the response body, refresh token in an httpOnly cookie scoped to `path=/auth`,
  `secure` in production. Access and refresh use separate secrets and separate TTLs.
- OTP: 6 digits, 5-minute TTL, 5 attempts, one live code per phone. With `SMS_PROVIDER=console`
  the code is logged in development **and returned in the response**; in production it is neither
  logged nor returned.
- Admin exists only through `seed` / `seed:admin`; `@Roles('admin')` is checked against the JWT
  role server-side, never against anything the client sends.

## Test

```bash
npm run test       # unit (error envelope, users, SMS, OTP, tokens, auth)
npm run test:e2e   # boots the app: /health, /docs, auth flow, role denial
npm run lint
```

`npm run test:e2e` needs a reachable database. Without one the auth suite reports itself as
**skipped** with the reason — it never passes silently.


## Test

```bash
npm run test       # unit (error envelope, …)
npm run test:e2e   # boots the app: /health, /docs-json, error envelope
npm run lint
```

## Environment

Copy `.env.example` → `.env`. The API must start with **only** the two database URLs set —
`AI_PROVIDER=mock`, `SMS_PROVIDER=console`, no Cloudinary ⇒ everything else degrades gracefully
(uploads answer a typed `UPLOADS_NOT_CONFIGURED` error), so the demo never needs paid services.

## Layout

```
prisma/schema.prisma   15 tables · PostGIS geography columns (trigger-maintained) · GIST indexes
src/main.ts            Swagger + CORS + configureApp()
src/setup.ts           pipes/filters — shared by server and tests
src/common/filters     { statusCode, message, code } global error envelope
src/common/prisma      PrismaService (never crashes the boot; 503 DB_UNAVAILABLE instead)
src/common/env.ts      isProduction() / maskPhone() — no phone number ever reaches a log in full
src/common/decorators  @Roles() · @Public() · @CurrentUser()
src/health             GET /health
src/shared/types.ts    verbatim copy of apps/web/lib/types.ts — the response contract
src/shared/enums.ts    runtime mirrors of the Prisma enums (class-validator needs values)
src/seed/data.ts       verbatim copy of apps/web/lib/mock/data.ts — the demo scenario
src/users              UsersService + userRowToUser(), the only row → User mapper
src/sms                SmsProvider interface · console (default) · twilio · SmsService
src/auth               controller/service · OtpService · TokensService · strategies · guards · DTOs
src/me                 GET/PATCH/DELETE /me
scripts/seed.ts        ports the demo scenario into PostgreSQL (re-runnable)
scripts/create-admin.ts the ONLY way an admin account is created
test/global-setup.ts   decides whether the e2e suites run or are reported as skipped
```

## Phase 1 implementation notes

Decisions taken while building Phase 1, all consistent with `docs/BACKEND_PROMPT.md` §3:

- **`JwtAuthGuard` and `RolesGuard` are APP_GUARDs** (secure by default) rather than per-route
  `@UseGuards`. A new route is protected the moment it exists; forgetting a guard is impossible.
- **`phone_otps` has no phone column**, so `POST /auth/verify-phone` accepts an optional `phone`
  that scopes the lookup to one account. Without it the code-only lookup scans live codes.
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

## Contract rules that are not negotiable

1. Never trust the client — roles, moderation, trust, EXIF, rate limits are server-side.
2. Response fields match `src/shared/types.ts` exactly.
3. No diagnosis, ever; every AI answer carries a veterinarian disclaimer.
4. Admin exists only via `seed:admin`; every `/admin/*` route checks the JWT role.
5. Adoption phone numbers are revealed only when a request is `accepted`.
